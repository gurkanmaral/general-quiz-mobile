import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { localize, type SoloAnswerResponse, type SoloGameResponse } from '@/contracts';
import { useAccount } from '@/lib/account';
import { ApiProblemError, answerSoloGame, startSoloGame } from '@/lib/api';
import { AnswerOption, type OptionState } from '@/components/AnswerOption';
import { ReportQuestion } from '@/components/ReportQuestion';
import { UnlockCelebration } from '@/components/Unlocks';
import { BackBar, Screen } from '@/ui/Screen';
import { Block, Body, Button, Chip, Display, ErrorText, Kicker, Label, LinkButton, Note } from '@/ui/kit';
import { accents, colors, fonts } from '@/ui/theme';
import { percent } from '@/lib/format';

type Phase =
  | { name: 'starting' }
  | { name: 'startFailed'; notFound: boolean }
  | { name: 'playing'; game: SoloGameResponse; index: number; reveal: SoloAnswerResponse | null }
  | { name: 'finished'; game: SoloGameResponse; last: SoloAnswerResponse }
  | { name: 'replaced' };

function resultLine(score: number, total: number): string {
  const share = score / total;
  if (share === 1) return 'Flawless. Every single one.';
  if (share >= 0.8) return 'Brilliant — you really know this.';
  if (share >= 0.5) return 'Solid run. Play again to fill the gaps.';
  return 'Every miss is a story you know now. Go again!';
}

/** A Solo Game (FR-14): ten Questions one by one; the server records each answer and reveals the story. */
export default function SoloGameScreen() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const { status, ready, requireSignIn } = useAccount();
  const [phase, setPhase] = useState<Phase>({ name: 'starting' });
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const started = useRef<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    if (!ready) return;
    const key = `${slug}:${round}`;
    if (started.current === key) return;
    started.current = key;
    setPhase({ name: 'starting' });
    setSelected(null);
    setError(null);
    startSoloGame(slug).then(
      (game) => setPhase({ name: 'playing', game, index: 0, reveal: null }),
      (caught: unknown) => setPhase({ name: 'startFailed', notFound: caught instanceof ApiProblemError && caught.status === 404 }),
    );
  }, [ready, slug, round]);

  const playAgain = useCallback(() => setRound((value) => value + 1), []);

  const submit = async () => {
    if (phase.name !== 'playing' || phase.reveal || selected === null || saving) return;
    const question = phase.game.questions[phase.index]!;
    setSaving(true);
    setError(null);
    try {
      const reveal = await answerSoloGame(phase.game.gameId, { position: question.position, selectedIndex: selected });
      setPhase({ ...phase, reveal });
    } catch (caught) {
      if (caught instanceof ApiProblemError && caught.code === 'quizzes.gameOver') setPhase({ name: 'replaced' });
      else setError("Couldn't save your answer. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (phase.name !== 'playing' || !phase.reveal) return;
    if (phase.reveal.result) setPhase({ name: 'finished', game: phase.game, last: phase.reveal });
    else {
      setPhase({ ...phase, index: phase.index + 1, reveal: null });
      setSelected(null);
    }
    scroll.current?.scrollTo({ y: 0, animated: true });
  };

  const back = <BackBar title="Solo game" onBack={() => router.navigate('/quizzes')} />;

  if (status === 'loading') return <Screen header={back}>{null}</Screen>;
  if (!ready) {
    return (
      <Screen header={back}>
        <Block offset={8} radius={24} border={3} style={styles.card}>
          <Kicker>Solo game</Kicker>
          <Display style={styles.h1}>Sign in to play</Display>
          <Body>Quizzes keep your record, badges and titles on your account. The Daily stays free without one.</Body>
          <Button label="Sign in or create an account" size="lg" onPress={() => requireSignIn(`/play/${slug}`)} />
          <LinkButton label="Back to Quizzes" onPress={() => router.navigate('/quizzes')} />
        </Block>
      </Screen>
    );
  }
  if (phase.name === 'starting') {
    return (
      <Screen header={back}>
        <Note>Shuffling questions…</Note>
      </Screen>
    );
  }
  if (phase.name === 'startFailed' || phase.name === 'replaced') {
    const message =
      phase.name === 'replaced' ? 'This game was replaced by a newer one (maybe on another device).' : phase.notFound ? "This quiz isn't available." : "Couldn't start the game. Check your connection and try again.";
    return (
      <Screen header={back}>
        <Block offset={8} radius={24} border={3} style={styles.card}>
          <ErrorText>{message}</ErrorText>
          {!(phase.name === 'startFailed' && phase.notFound) && <Button label={phase.name === 'replaced' ? 'Start a new game' : 'Try again'} onPress={playAgain} />}
          <LinkButton label="Back to Quizzes" onPress={() => router.navigate('/quizzes')} />
        </Block>
      </Screen>
    );
  }

  const title = localize(phase.game.quiz.title);
  const accent = accents[phase.game.quiz.theme] ?? colors.sky;

  if (phase.name === 'finished') {
    const result = phase.last.result!;
    return (
      <Screen header={back}>
        <Block offset={8} radius={24} border={3} style={styles.card}>
          <Kicker color={accent}>{title}</Kicker>
          <Animated.View entering={ZoomIn.springify().damping(11)} style={styles.scoreRow} accessible accessibilityLabel={`${result.score} out of ${result.total}`}>
            <Text style={styles.score}>{result.score}</Text>
            <Text style={styles.scoreTotal}>/{result.total}</Text>
          </Animated.View>
          <Display style={styles.resultLine} accessibilityLiveRegion="polite">
            {resultLine(result.score, result.total)}
          </Display>
          <UnlockCelebration unlocks={phase.last.unlocks} />
          {phase.last.record && (
            <Body style={styles.record}>
              Quiz Record: <Text style={styles.bold}>{percent(phase.last.record.correctShare)}%</Text> of {title} answered correctly · {phase.last.record.correctStandard} standard, {phase.last.record.correctExpert} expert ·{' '}
              {phase.last.record.gamesPlayed} game{phase.last.record.gamesPlayed === 1 ? '' : 's'} played
            </Body>
          )}
          <Button label="Play again" size="lg" onPress={playAgain} />
          <LinkButton label="Back to Quizzes" onPress={() => router.navigate('/quizzes')} />
        </Block>
      </Screen>
    );
  }

  const { game, index, reveal } = phase;
  const question = game.questions[index]!;
  const total = game.questions.length;
  const optionState = (option: number): OptionState => {
    if (reveal && option === reveal.correctIndex) return 'correct';
    if (reveal && option === selected) return 'wrong';
    return selected === option ? 'selected' : 'idle';
  };

  return (
    <Screen header={back} scrollRef={scroll}>
      <Block offset={8} radius={24} border={3} style={styles.card}>
        <View style={styles.meta}>
          <Chip label={title} color={accent} />
          <Text style={styles.count} accessibilityLabel={`Question ${index + 1} of ${total}`}>
            {index + 1} / {total}
          </Text>
        </View>
        <View style={styles.progress}>
          <View style={[styles.progressFill, { width: `${((index + (reveal ? 1 : 0)) / total) * 100}%` }]} />
        </View>
        <View style={styles.eyebrowRow}>
          {question.difficulty === 'expert' && <Chip label="Expert" color={colors.coral} />}
          <Text style={styles.eyebrow}>{localize(question.eyebrow)}</Text>
        </View>
        <Animated.View key={question.slug} entering={FadeInDown.springify().damping(16)} style={styles.questionBlock}>
          <Display style={styles.question} accessibilityRole="header">
            {localize(question.text)}
          </Display>
          <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Answer choices">
            {question.options.map((option, optionIndex) => (
              <AnswerOption key={`${question.slug}-${optionIndex}`} index={optionIndex} label={localize(option)} state={optionState(optionIndex)} disabled={reveal !== null || saving} onPress={() => setSelected(optionIndex)} />
            ))}
          </View>
        </Animated.View>
        {!reveal ? (
          <View style={styles.submit}>
            <Button label={saving ? 'Saving…' : 'Check answer'} icon="arrow" size="lg" busy={saving} disabled={selected === null} onPress={() => void submit()} />
            {error && <ErrorText>{error}</ErrorText>}
          </View>
        ) : (
          <Animated.View entering={FadeInDown.springify().damping(15)}>
            <Block offset={5} down radius={16} color={reveal.correct ? colors.correct : colors.blush} style={styles.reveal}>
              <Text style={styles.verdict} accessibilityLiveRegion="polite">
                {reveal.correct ? '✓ Correct' : '× Not quite'} · {reveal.score} / {total}
              </Text>
              <Display style={styles.answerTitle}>{localize(reveal.answerTitle)}</Display>
              <Body>{localize(reveal.summary)}</Body>
              {reveal.facts.map((fact) => (
                <View key={localize(fact.label)} style={styles.fact}>
                  <Label>{localize(fact.label)}</Label>
                  <Body>
                    <Text style={styles.bold}>{localize(fact.value)}</Text> {localize(fact.detail)}
                  </Body>
                </View>
              ))}
              <LinkButton label={`Source: ${localize(reveal.source.label)}`} onPress={() => void WebBrowser.openBrowserAsync(reveal.source.url)} />
              <ReportQuestion key={question.slug} questionSlug={question.slug} source="solo" returnTo={`/play/${slug}`} />
              <Button label={reveal.result ? 'See your result' : 'Next question'} icon="arrow" size="lg" onPress={next} />
            </Block>
          </Animated.View>
        )}
      </Block>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, gap: 14 },
  h1: { fontSize: 38, lineHeight: 38, letterSpacing: -2 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  count: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  progress: { height: 10, overflow: 'hidden', borderWidth: 2, borderColor: colors.ink, borderRadius: 999, backgroundColor: colors.panel },
  progressFill: { height: '100%', backgroundColor: colors.blue },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  eyebrow: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.muted },
  questionBlock: { gap: 14 },
  question: { fontSize: 27, lineHeight: 30, letterSpacing: -1.2 },
  options: { gap: 6 },
  submit: { gap: 10 },
  reveal: { gap: 10, padding: 16 },
  verdict: { fontFamily: fonts.bodyBlack, fontSize: 15, color: colors.ink },
  answerTitle: { fontSize: 24, lineHeight: 27 },
  fact: { gap: 2 },
  bold: { fontFamily: fonts.bodyHeavy },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline' },
  score: { fontFamily: fonts.display, fontSize: 110, lineHeight: 112, letterSpacing: -6, color: colors.ink },
  scoreTotal: { fontFamily: fonts.display, fontSize: 44, color: colors.faint },
  resultLine: { fontSize: 24, lineHeight: 28 },
  record: { fontSize: 14, lineHeight: 20 },
});
