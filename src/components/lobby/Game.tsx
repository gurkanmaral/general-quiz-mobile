import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { LOBBY_COMMANDS, localize, type LobbyPlayer, type LobbyStanding, type LobbyState } from '@/contracts';
import { nameWithTitle } from '@/lib/account';
import { haptics } from '@/lib/haptics';
import { AnswerOption, type OptionState } from '@/components/AnswerOption';
import { ReportQuestion } from '@/components/ReportQuestion';
import { UnlockCelebration } from '@/components/Unlocks';
import { Avatar, Block, Body, Button, Chip, Display, Kicker, Label } from '@/ui/kit';
import { colors, fonts } from '@/ui/theme';
import { useCountdown, type Send } from './useLobby';

/** Players still in the Lobby who are playing this game (they're on the leaderboard). */
function playersInGame(state: LobbyState): LobbyPlayer[] {
  return state.leaderboard.flatMap((row) => state.players.find((player) => player.id === row.userId) ?? []);
}

const ranksOf = (rows: LobbyStanding[]) => new Map(rows.map((row) => [row.userId, row.rank]));

/** Each player's rank on the leaderboard before the current one, to show who climbed after a reveal. */
function usePreviousRanks(rows: LobbyStanding[]): Map<string, number> {
  const key = rows.map((row) => `${row.userId}:${row.rank}:${row.score}`).join('|');
  const [memory, setMemory] = useState(() => ({ key, ranks: ranksOf(rows), previous: new Map<string, number>() }));
  if (memory.key !== key) {
    setMemory({ key, ranks: ranksOf(rows), previous: memory.ranks });
    return memory.ranks;
  }
  return memory.previous;
}

function StandingChip({ state, player, gained }: { state: LobbyState; player: LobbyPlayer | undefined; gained: number | null }) {
  if (!player) return <Chip label="Left" dashed />;
  if (!player.connected) return <Chip label="Reconnecting…" dashed />;
  if (state.phase === 'reveal') {
    if (gained === null) return null;
    return (
      <Animated.View entering={ZoomIn.springify().damping(10)}>
        <Chip label={`+${gained}`} color={gained > 0 ? colors.lime : 'transparent'} dashed={gained === 0} />
      </Animated.View>
    );
  }
  if (state.phase !== 'question') return null;
  return player.answered ? (
    <Animated.View key="in" entering={ZoomIn.springify().damping(10)}>
      <Chip label="✓ Locked in" color={colors.lime} />
    </Animated.View>
  ) : (
    <Chip label="Thinking…" color={colors.paper} />
  );
}

/**
 * Live standings under the Question and the reveal: avatars, who has answered, points won and rank
 * moves. Rows slide to their new place when the order changes (layout animation).
 */
export function LiveStandings({ state }: { state: LobbyState }) {
  const previous = usePreviousRanks(state.leaderboard);
  const revealing = state.phase === 'reveal';
  const step = state.question ?? state.reveal;
  return (
    <Block offset={7} radius={22} border={3} style={styles.standings}>
      <View style={styles.standingsHead}>
        <Display style={styles.standingsTitle}>Standings</Display>
        {step && (
          <Label style={styles.muted}>
            Q {step.index + 1} / {step.total}
          </Label>
        )}
      </View>
      <View style={styles.standingsList} accessibilityLabel="Leaderboard">
        {state.leaderboard.map((row) => {
          const player = state.players.find((item) => item.id === row.userId);
          const gained = revealing ? (state.reveal?.results.find((result) => result.userId === row.userId)?.points ?? null) : null;
          const before = previous.get(row.userId);
          const move = revealing && before !== undefined ? before - row.rank : 0;
          const me = row.userId === state.me;
          const offline = Boolean(player && !player.connected);
          return (
            <Animated.View key={row.userId} layout={LinearTransition.springify().damping(17).stiffness(140)} style={[styles.row, me && styles.rowMe, move > 0 && styles.rowUp, offline && styles.rowOffline]}>
              <View style={[styles.rank, row.rank === 1 && styles.rankFirst]}>
                <Text style={styles.rankText}>{row.rank}</Text>
              </View>
              <Avatar id={player?.avatar ?? null} />
              <View style={styles.rowName}>
                <Text style={styles.rowUser} numberOfLines={1}>
                  {player?.username ?? 'Someone who left'}
                  {me && <Text style={styles.you}> · you</Text>}
                </Text>
                <StandingChip state={state} player={player} gained={gained} />
              </View>
              <View style={styles.rowScore}>
                <Animated.Text key={row.score} entering={gained ? ZoomIn.springify().damping(8) : undefined} style={styles.score}>
                  {row.score}
                </Animated.Text>
                {move !== 0 && (
                  <Text style={[styles.move, { color: move > 0 ? colors.up : colors.down }]} accessibilityLabel={`${move > 0 ? 'up' : 'down'} ${Math.abs(move)}`}>
                    {move > 0 ? '▲' : '▼'} {Math.abs(move)}
                  </Text>
                )}
              </View>
            </Animated.View>
          );
        })}
      </View>
    </Block>
  );
}

/** Who has locked in an answer: avatars that light up, a meter and one clear line. */
function AnswerTracker({ state, locked }: { state: LobbyState; locked: boolean }) {
  const players = playersInGame(state);
  const total = players.length;
  const answered = players.filter((player) => player.answered).length;
  const everyone = total > 0 && answered === total;
  let line: string;
  if (total <= 1) line = locked ? 'Locked in!' : 'Pick your answer before the timer runs out.';
  else if (everyone) line = locked ? "Locked in! Everyone's in." : "Everyone's in!";
  else if (locked) line = `Locked in! Waiting for ${total - answered} more…`;
  else line = `${answered} of ${total} locked in`;
  return (
    <View style={[styles.tracker, everyone && styles.trackerAll]}>
      {total > 1 && (
        <>
          <View style={styles.faces} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {players.map((player) => (
              <View key={player.id}>
                <Avatar id={player.avatar} size="sm" faded={!player.answered} />
                {player.answered && (
                  <Animated.View entering={ZoomIn.springify().damping(9)} style={styles.check}>
                    <Text style={styles.checkText}>✓</Text>
                  </Animated.View>
                )}
              </View>
            ))}
          </View>
          <View style={styles.meter}>
            <Animated.View layout={LinearTransition} style={[styles.meterFill, { width: `${(answered / total) * 100}%` }]} />
          </View>
        </>
      )}
      <Text style={styles.trackerLine} accessibilityLiveRegion="polite">
        {line}
      </Text>
    </View>
  );
}

/** The countdown, pinned in the top bar so it never scrolls away. A buzz at 5 seconds if you haven't answered. */
export function QuestionTimer({ state }: { state: LobbyState }) {
  const question = state.question!;
  const left = useCountdown(question.deadline, question.serverNow);
  const seconds = Math.ceil(left / 1000);
  const answered = question.myAnswer !== null && question.myAnswer !== undefined;
  useEffect(() => {
    if (seconds === 5 && !answered) haptics.warn();
  }, [seconds, answered]);
  return (
    <View style={[styles.timer, left <= 5000 && styles.timerLow]} accessibilityLabel={`${seconds} seconds left`}>
      <Text style={styles.timerText}>{seconds}</Text>
    </View>
  );
}

export function QuestionView({ state, send }: { state: LobbyState; send: Send }) {
  const question = state.question!;
  const left = useCountdown(question.deadline, question.serverNow);
  const [picked, setPicked] = useState<number | null>(null);
  const locked = question.myAnswer ?? picked;
  const answer = async (index: number) => {
    if (locked !== null) return;
    setPicked(index);
    haptics.press();
    const ack = await send(LOBBY_COMMANDS.answer, { index: question.index, selectedIndex: index });
    if (!ack.ok && ack.code !== 'lobby.alreadyAnswered') setPicked(null);
  };
  return (
    <Block offset={8} radius={24} border={3} style={styles.card}>
      <View style={styles.meta}>
        <Chip label={`Question ${question.index + 1} / ${question.total}`} color={colors.sky} />
      </View>
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${(left / question.limitMs) * 100}%` }]} />
      </View>
      <View style={styles.eyebrowRow}>
        {question.difficulty === 'expert' && <Chip label="Expert" color={colors.coral} />}
        <Text style={styles.eyebrow}>{localize(question.eyebrow)}</Text>
      </View>
      <Animated.View entering={FadeInDown.springify().damping(16)} style={styles.questionBlock}>
        <Display style={styles.question} accessibilityRole="header">
          {localize(question.text)}
        </Display>
        <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Answer choices">
          {question.options.map((option, index) => (
            <AnswerOption key={index} index={index} label={localize(option)} state={locked === index ? 'selected' : 'idle'} disabled={locked !== null || left === 0} onPress={() => void answer(index)} />
          ))}
        </View>
      </Animated.View>
      <AnswerTracker state={state} locked={locked !== null} />
    </Block>
  );
}

export function RevealView({ state }: { state: LobbyState }) {
  const reveal = state.reveal!;
  const mine = reveal.results.find((result) => result.userId === state.me);
  const optionState = (index: number): OptionState => (index === reveal.correctIndex ? 'correct' : mine?.selectedIndex === index ? 'wrong' : 'idle');
  const correct = Boolean(mine?.correct);
  useEffect(() => {
    if (correct) haptics.correct();
    else haptics.wrong();
  }, [correct]);
  return (
    <Block offset={8} radius={24} border={3} style={styles.card}>
      <View style={styles.meta}>
        <Chip label={`Question ${reveal.index + 1} / ${reveal.total}`} color={colors.sky} />
        <Label style={styles.muted}>{reveal.index + 1 === reveal.total ? 'Final results next' : 'Next question soon'}</Label>
      </View>
      <Display style={styles.question}>{localize(reveal.text)}</Display>
      <View style={styles.options}>
        {reveal.options.map((option, index) => (
          <AnswerOption key={index} index={index} label={localize(option)} state={optionState(index)} disabled />
        ))}
      </View>
      <Animated.View entering={FadeInDown.springify().damping(15)}>
        <Block offset={5} down radius={16} color={mine?.correct ? colors.correct : colors.blush} style={styles.reveal}>
          <Text style={styles.verdict} accessibilityLiveRegion="polite">
            {mine?.correct ? `+${mine.points} points!` : mine?.selectedIndex === null ? "Time's up — 0 points." : 'Not this time — 0 points.'}
          </Text>
          <Display style={styles.answerTitle}>{localize(reveal.answerTitle)}</Display>
          <Body>{localize(reveal.summary)}</Body>
          <ReportQuestion key={reveal.questionSlug} questionSlug={reveal.questionSlug} source="lobby" returnTo={`/lobby/${state.code}`} />
        </Block>
      </Animated.View>
    </Block>
  );
}

/** The podium's sticky bottom bar: Play again for the Host, then Leave. */
export function PodiumActions({ state, send }: { state: LobbyState; send: Send }) {
  const isHost = state.hostId === state.me;
  return (
    <View style={styles.podiumActions}>
      {isHost ? <Button label="Play again" size="lg" onPress={() => void send(LOBBY_COMMANDS.playAgain)} /> : <Body style={styles.center}>The Host can start another round.</Body>}
      <Button label="Leave" tone="white" onPress={() => router.navigate('/quizzes')} />
    </View>
  );
}

export function PodiumView({ state }: { state: LobbyState }) {
  const ranking = state.podium?.ranking ?? [];
  const mine = ranking.find((row) => row.userId === state.me);
  const top = [ranking[1], ranking[0], ranking[2]].filter((row): row is (typeof ranking)[number] => Boolean(row));
  const heights: Record<number, number> = { 1: 150, 2: 118, 3: 98 };
  const steps: Record<number, string> = { 1: colors.yellow, 2: colors.sky, 3: colors.blush };
  return (
    <View style={styles.podiumRoot}>
      <Block offset={8} radius={24} border={3} style={styles.card}>
        <Kicker>Final results · {localize(state.quiz.title)}</Kicker>
        <Display style={styles.podiumTitle}>{mine?.rank === 1 ? 'You won!' : mine ? `You came ${mine.rank}${['st', 'nd', 'rd'][mine.rank - 1] ?? 'th'}` : 'Podium'}</Display>
        <View style={styles.podium} accessibilityLabel="Podium">
          {top.map((row, index) => (
            <Animated.View key={row.userId} entering={FadeInDown.delay(250 + (2 - index) * 180).springify().damping(12)} style={styles.podiumCol}>
              <Avatar id={row.player.avatar} size="lg" />
              <Text style={styles.podiumName} numberOfLines={1}>
                {row.player.username}
              </Text>
              <View style={[styles.step, { height: heights[row.rank] ?? 90, backgroundColor: steps[row.rank] ?? colors.white }]}>
                <View style={styles.place}>
                  <Text style={styles.placeText} accessibilityLabel={`Place ${row.rank}`}>
                    {row.rank}
                  </Text>
                </View>
                <Text style={styles.stepScore}>{row.score}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
        <Display style={styles.rankingTitle}>Full ranking</Display>
        <View style={styles.ranking} accessibilityLabel="Ranking">
          {ranking.map((row) => (
            <View key={row.userId} style={[styles.rankingRow, row.userId === state.me && styles.rowMe]}>
              <View style={styles.rank}>
                <Text style={styles.rankText}>{row.rank}</Text>
              </View>
              <Avatar id={row.player.avatar} size="sm" />
              <View style={styles.rowName}>
                <Text style={styles.rowUser}>{nameWithTitle(row.player.username, row.player.title)}</Text>
                <Text style={styles.rankingSub}>
                  {row.correct} correct
                  {row.unlocks.length > 0 ? ` · unlocked ${row.unlocks.map((award) => `${award.icon} ${localize(award.name)}`).join(', ')}` : ''}
                </Text>
              </View>
              <Text style={styles.score}>{row.score}</Text>
            </View>
          ))}
        </View>
        {mine && <UnlockCelebration unlocks={mine.unlocks} />}
      </Block>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, gap: 14 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { color: colors.muted },
  timer: { minWidth: 52, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.ink, borderRadius: 10, backgroundColor: colors.white },
  timerLow: { backgroundColor: colors.coral },
  timerText: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  progress: { height: 10, overflow: 'hidden', borderWidth: 2, borderColor: colors.ink, borderRadius: 999, backgroundColor: colors.panel },
  progressFill: { height: '100%', backgroundColor: colors.blue },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  eyebrow: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.muted },
  questionBlock: { gap: 14 },
  question: { fontSize: 27, lineHeight: 30, letterSpacing: -1.2 },
  options: { gap: 6 },
  reveal: { gap: 10, padding: 16 },
  verdict: { fontFamily: fonts.bodyBlack, fontSize: 16, color: colors.ink },
  answerTitle: { fontSize: 24, lineHeight: 27 },
  tracker: { gap: 12, padding: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.ink, borderRadius: 16 },
  trackerAll: { borderStyle: 'solid', backgroundColor: colors.mint },
  faces: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  check: { position: 'absolute', right: -6, bottom: -6, width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  checkText: { fontFamily: fonts.bodyBlack, fontSize: 10, color: colors.ink },
  meter: { height: 10, overflow: 'hidden', borderWidth: 2, borderColor: colors.ink, borderRadius: 999, backgroundColor: colors.paper },
  meterFill: { height: '100%', backgroundColor: colors.lime },
  trackerLine: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink },
  standings: { padding: 16, gap: 12 },
  standingsHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  standingsTitle: { fontSize: 24, letterSpacing: -1 },
  standingsList: { gap: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 9, borderWidth: 2, borderColor: colors.ink, borderRadius: 14, backgroundColor: colors.white },
  rowMe: { backgroundColor: colors.cream },
  rowUp: { borderColor: colors.up, borderWidth: 3 },
  rowOffline: { opacity: 0.55, borderStyle: 'dashed' },
  rank: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.ink, borderRadius: 8, backgroundColor: colors.sky },
  rankFirst: { backgroundColor: colors.yellow },
  rankText: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
  rowName: { flex: 1, gap: 4, alignItems: 'flex-start' },
  rowUser: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  you: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.muted },
  rowScore: { alignItems: 'flex-end', gap: 2 },
  score: { fontFamily: fonts.display, fontSize: 21, color: colors.ink },
  move: { fontFamily: fonts.bodyBlack, fontSize: 11 },
  podiumRoot: { gap: 22 },
  podiumTitle: { fontSize: 40, lineHeight: 44, letterSpacing: -2.2 },
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 6 },
  podiumCol: { flex: 1, alignItems: 'center', gap: 6 },
  podiumName: { fontFamily: fonts.display, fontSize: 15, color: colors.ink, maxWidth: '100%' },
  step: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 12, borderWidth: 3, borderColor: colors.ink, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
  place: { position: 'absolute', top: -16, width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  placeText: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  stepScore: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  rankingTitle: { fontSize: 22, marginTop: 8 },
  ranking: { gap: 8 },
  rankingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderWidth: 2, borderColor: colors.ink, borderRadius: 12, backgroundColor: colors.white },
  rankingSub: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.blue },
  podiumActions: { gap: 10 },
  center: { textAlign: 'center' },
});
