import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { STREAK_REPAIR_DAYS, countsForStreak } from '@/shared';
import { useAccount } from '@/lib/account';
import { useDailyQuestion } from '@/lib/dailyContent';
import type { DailyHistory } from '@/lib/dailyHistory';
import { useProgress } from '@/lib/progress';
import { buildShareText, shareText, webHome } from '@/lib/share';
import { AnswerOption, type OptionState } from '@/components/AnswerOption';
import { ReportQuestion } from '@/components/ReportQuestion';
import { Block, Body, Button, Chip, Display, ErrorText, Icon, Kicker, Label, LinkButton, PressBlock } from '@/ui/kit';
import { colors, fonts } from '@/ui/theme';

const CAST_ROTATION_MS = 8_000;

/** The KNO. cast (web KNO_CAST), shown on the artwork panel. */
const KNO_CAST = [
  { name: 'The Reel Ranger', role: 'Cinema cartographer', tagline: 'Tracks clues across every story.', image: require('../../../assets/cast/reel-ranger.webp'), alt: 'A fox-like explorer with a vintage film projector head and cinema-ticket clue' },
  { name: 'The Archive Owl', role: 'Keeper of curious facts', tagline: 'Finds the detail everyone missed.', image: require('../../../assets/cast/archive-owl.webp'), alt: 'An owl curator with film-reel glasses, paper feathers and a glowing clue card' },
  { name: 'Chapter & Scene', role: 'Book-and-screen detectives', tagline: 'Two minds. One excellent hunch.', image: require('../../../assets/cast/chapter-scene.webp'), alt: 'Animated book and clapperboard detectives Chapter and Scene' },
] as const;

export function issueNumber(history: DailyHistory, key: string): number {
  return Object.keys(history.plays).filter((answered) => answered < key).length + 1;
}

const youtubeSearchUrl = (query: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
const open = (url: string) => void WebBrowser.openBrowserAsync(url);

function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

/** The dark stage with the rotating KNO. cast (web .knowledge-art). */
function CastArt({ dateKey, category, issue }: { dateKey: string; category: string; issue: number }) {
  const reduced = useReduceMotion();
  const seed = [...dateKey].reduce((total, character) => total + character.charCodeAt(0), 0) % KNO_CAST.length;
  const [active, setActive] = useState(seed);
  useEffect(() => setActive(seed), [seed]);
  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') setActive((current) => (current + 1) % KNO_CAST.length);
    }, CAST_ROTATION_MS);
    return () => clearInterval(timer);
  }, [reduced]);
  const mascot = KNO_CAST[active] ?? KNO_CAST[0];
  return (
    <LinearGradient colors={[colors.artTop, '#101321', colors.artBottom]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.art}>
      <View style={styles.artTop}>
        <Text style={styles.artLabel}>KNO. cast</Text>
        <Text style={styles.artIssue}>
          <Text style={styles.artIssueSmall}>Daily field note </Text>№ {String(issue).padStart(3, '0')}
        </Text>
      </View>
      <View style={styles.ringOne} />
      <View style={styles.ringTwo} />
      <Text style={[styles.star, { top: 70, right: 34 }]}>✦</Text>
      <Text style={[styles.star, { bottom: 120, left: 26, fontSize: 14 }]}>✦</Text>
      <View style={styles.stage}>
        <View style={styles.stageShadow} />
        <Animated.View key={mascot.name} entering={reduced ? undefined : ZoomIn.springify().damping(13)} style={styles.mascotWrap}>
          <Image source={mascot.image} style={styles.mascot} contentFit="contain" accessibilityLabel={mascot.alt} />
        </Animated.View>
      </View>
      <View style={[styles.sticker, styles.stickerOne]}>
        <Text style={styles.stickerText}>New cast</Text>
      </View>
      <View style={[styles.sticker, styles.stickerTwo]}>
        <Text style={styles.stickerText}>{category}</Text>
      </View>
      <View style={styles.artFooter} accessibilityLiveRegion="polite">
        <Text style={styles.artRole}>{mascot.role}</Text>
        <Text style={styles.artName}>{mascot.name}</Text>
        <Text style={styles.artTagline}>{mascot.tagline}</Text>
      </View>
    </LinearGradient>
  );
}

/**
 * One Daily (Today, or a Library day): the cast, the question, the answer, then the story behind it.
 * Same behaviour as the web's Daily page (FR-1–FR-3, FR-6–FR-10).
 */
export function DailyView({ viewKey, onScrollTo }: { viewKey: string; onScrollTo?: (y: number) => void }) {
  const account = useAccount();
  const progress = useProgress();
  const { history, today } = progress;
  const isToday = viewKey === today;
  const stored = history.plays[viewKey];
  const question = useDailyQuestion(viewKey, stored?.questionId);
  const previous = stored?.questionId === question.id ? stored : undefined;
  const [selected, setSelected] = useState<number | null>(previous?.selectedIndex ?? null);
  const submitted = Boolean(previous);
  const [saving, setSaving] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const answerable = progress.ready && progress.canAnswer(viewKey);
  const storyY = useRef(0);

  useEffect(() => {
    setSelected(previous?.selectedIndex ?? null);
  }, [viewKey, question.id, previous?.selectedIndex]);

  const countsIfPlayedToday = countsForStreak({ dailyDate: viewKey, playedOn: today });
  const issue = issueNumber(history, viewKey);
  const date = new Date(`${viewKey}T12:00:00`);
  const shortDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);

  const submit = async () => {
    if (selected === null || submitted || saving || !answerable) return;
    let outcome = progress.record(viewKey, question.id, selected, question.correctIndex);
    if (typeof outcome !== 'string') {
      setSaving(true);
      outcome = await outcome;
      setSaving(false);
    }
    if (outcome === 'saved') setTimeout(() => onScrollTo?.(storyY.current), 450);
  };

  const share = async () => {
    const play = history.plays[viewKey];
    if (!play) return;
    const ok = await shareText(buildShareText({ issue, correct: play.correct, streak: progress.streak.current, url: webHome }));
    setShareFailed(!ok);
  };

  const optionState = (index: number): OptionState => {
    if (submitted && index === question.correctIndex) return 'correct';
    if (submitted && index === selected) return 'wrong';
    return selected === index ? 'selected' : 'idle';
  };
  const correct = selected === question.correctIndex;
  const channelUrl = question.video ? youtubeSearchUrl(`${question.video.creator} YouTube channel`) : undefined;

  return (
    <View style={styles.root}>
      <Block offset={8} radius={26} border={3} style={styles.card}>
        {!focusMode && <CastArt dateKey={viewKey} category={question.category} issue={issue} />}
        <View style={styles.panel}>
          <View style={styles.meta}>
            <Chip label={question.category} color={colors.sky} />
            <View style={styles.metaEnd}>
              <Label style={styles.metaDate}>{isToday ? 'Today' : shortDate}</Label>
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: focusMode }} onPress={() => setFocusMode((value) => !value)} hitSlop={8}>
                <Text style={styles.focusToggle}>{focusMode ? 'Show artwork' : 'Question only'}</Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.eyebrow}>{question.eyebrow}</Text>
          <Display style={styles.question} accessibilityRole="header">
            {question.question}
          </Display>
          <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Answer choices">
            {question.options.map((option, index) => (
              <AnswerOption key={option} index={index} label={option} state={optionState(index)} disabled={submitted} onPress={() => setSelected(index)} />
            ))}
          </View>
          {!submitted ? (
            <View style={styles.submitArea}>
              <Button label={saving ? 'Saving…' : 'Reveal the answer'} icon="arrow" size="lg" busy={saving} disabled={selected === null || !answerable} onPress={() => void submit()} />
              {progress.error ? (
                <View style={styles.noteRow}>
                  <ErrorText>{progress.error}</ErrorText>
                  {!progress.ready && <LinkButton label="Try again" onPress={progress.reload} />}
                </View>
              ) : (
                progress.ready &&
                answerable &&
                !countsIfPlayedToday && <Body style={styles.lateNote}>This day is more than {STREAK_REPAIR_DAYS} days ago: it goes into your Library but won’t count for your streak.</Body>
              )}
            </View>
          ) : (
            <Animated.View entering={FadeInDown.springify().damping(14)}>
              <Block offset={5} down radius={14} color={correct ? colors.correct : colors.blush} style={styles.result}>
                <Display style={styles.resultLine} accessibilityLiveRegion="polite">
                  {correct ? 'You got it.' : 'Not this time—but now you know.'}
                </Display>
                <View style={styles.resultActions}>
                  <Button label={shareFailed ? 'Share failed' : 'Share'} tone="white" size="sm" icon="share" onPress={() => void share()} />
                  <Button label="Read the story" tone="white" size="sm" icon="down" onPress={() => onScrollTo?.(storyY.current)} />
                </View>
                {!account.ready && account.status !== 'loading' && (
                  <View style={styles.saveStreak}>
                    <Body style={styles.saveStreakText}>Keep your streak on every device.</Body>
                    <LinkButton label="Sign in to save it" onPress={() => account.requireSignIn('/')} />
                  </View>
                )}
              </Block>
            </Animated.View>
          )}
        </View>
      </Block>

      {submitted && (
        <Animated.View
          entering={FadeIn.duration(500)}
          style={styles.story}
          onLayout={(event: LayoutChangeEvent) => {
            storyY.current = event.nativeEvent.layout.y;
          }}
        >
          <View style={styles.storyHead}>
            <Kicker>The story behind the answer</Kicker>
            <Display style={styles.answerTitle}>{question.answerTitle}</Display>
            <Body style={styles.summary}>{question.summary}</Body>
            <ReportQuestion key={question.id} questionSlug={question.id} source="daily" returnTo={isToday ? '/' : `/day/${viewKey}`} />
          </View>

          <View style={styles.facts}>
            {question.facts.map((fact, index) => (
              <Animated.View key={fact.label} entering={FadeInDown.delay(150 + index * 110).springify().damping(15)}>
                <Block offset={5} radius={18} color={[colors.cream, colors.violet, colors.mint][index % 3]} style={styles.fact}>
                  <Label>{fact.label}</Label>
                  <Display style={styles.factValue}>{fact.value}</Display>
                  <Body style={styles.factDetail}>{fact.detail}</Body>
                </Block>
              </Animated.View>
            ))}
          </View>

          <View style={styles.exploreHead}>
            <Kicker color={colors.sky}>Keep exploring</Kicker>
            <Display style={styles.exploreTitle}>Choose your next rabbit hole.</Display>
            <Body>Watch an explainer, meet a trusted creator, or go straight to the source.</Body>
          </View>
          <View style={styles.more}>
            {question.video && (
              <PressBlock offset={6} down={false} radius={18} color={colors.coral} onPress={() => open(question.video!.url)} accessibilityRole="link" style={styles.watch}>
                <View style={styles.watchIcon}>
                  <Icon name="play" size={22} color={colors.white} />
                </View>
                <View style={styles.watchBody}>
                  <Label style={styles.watchSmall}>Featured explainer · {question.video.creator}</Label>
                  <Display style={styles.watchTitle}>{question.video.title}</Display>
                  <Text style={styles.watchCta}>Open on YouTube →</Text>
                </View>
              </PressBlock>
            )}
            {question.video && channelUrl && <Resource small="Creator to follow" title={question.video.creator} cta="Explore the channel" color={colors.yellow} onPress={() => open(channelUrl)} />}
            <Resource small="Primary reading" title={question.sourceLabel} cta="Read the source" color={colors.white} onPress={() => open(question.sourceUrl)} />
            <Resource small="More perspectives" title="Explore this topic" cta="Search YouTube" color={colors.sky} onPress={() => open(youtubeSearchUrl(`${question.answerTitle} explained ${question.category}`))} />
          </View>
        </Animated.View>
      )}
    </View>
  );
}

function Resource({ small, title, cta, color, onPress }: { small: string; title: string; cta: string; color: string; onPress: () => void }) {
  return (
    <PressBlock offset={5} down={false} radius={16} color={color} onPress={onPress} accessibilityRole="link" style={styles.resource}>
      <Label style={styles.watchSmall}>{small}</Label>
      <Display style={styles.resourceTitle}>{title}</Display>
      <Text style={styles.resourceCta}>{cta} →</Text>
    </PressBlock>
  );
}

const styles = StyleSheet.create({
  root: { gap: 26 },
  card: { overflow: 'hidden' },
  art: { height: 360, padding: 18, overflow: 'hidden', borderBottomWidth: 3, borderBottomColor: colors.ink },
  artTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 5 },
  artLabel: { fontFamily: fonts.display, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.white },
  artIssue: { fontFamily: fonts.display, fontSize: 13, color: colors.white, textAlign: 'right' },
  artIssueSmall: { fontSize: 10, color: 'rgba(255,253,245,0.6)' },
  ringOne: { position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 1.5, borderColor: 'rgba(255,216,61,0.22)', top: 40, left: '50%', marginLeft: -130 },
  ringTwo: { position: 'absolute', width: 190, height: 190, borderRadius: 95, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(169,233,255,0.3)', top: 76, left: '50%', marginLeft: -95 },
  star: { position: 'absolute', color: colors.yellow, fontSize: 20 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stageShadow: { position: 'absolute', bottom: 6, width: 150, height: 18, borderRadius: 75, backgroundColor: 'rgba(0,0,0,0.55)' },
  mascotWrap: { width: '82%', height: '100%' },
  mascot: { width: '100%', height: '100%' },
  sticker: { position: 'absolute', paddingHorizontal: 11, paddingVertical: 7, borderWidth: 2, borderColor: colors.ink, borderRadius: 9 },
  stickerOne: { left: 16, top: 64, backgroundColor: colors.yellow, transform: [{ rotate: '-7deg' }] },
  stickerTwo: { right: 16, bottom: 96, backgroundColor: colors.sky, transform: [{ rotate: '5deg' }] },
  stickerText: { fontFamily: fonts.display, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.ink },
  artFooter: { gap: 2 },
  artRole: { fontFamily: fonts.bodyBlack, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: colors.yellow },
  artName: { fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.6, color: colors.white },
  artTagline: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,253,245,0.72)' },
  panel: { padding: 18, gap: 14 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  metaEnd: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metaDate: { color: colors.muted },
  focusToggle: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.blue, textDecorationLine: 'underline' },
  eyebrow: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.muted },
  question: { fontSize: 29, lineHeight: 31, letterSpacing: -1.3 },
  options: { gap: 6, marginTop: 4 },
  submitArea: { gap: 10, marginTop: 6 },
  noteRow: { gap: 6 },
  lateNote: { fontSize: 13, lineHeight: 19, color: colors.muted },
  result: { gap: 12, padding: 16 },
  resultLine: { fontSize: 22, lineHeight: 26 },
  resultActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  saveStreak: { gap: 4 },
  saveStreakText: { fontSize: 14 },
  story: { gap: 22 },
  storyHead: { gap: 12, alignItems: 'flex-start' },
  answerTitle: { fontSize: 40, lineHeight: 40, letterSpacing: -2.4 },
  summary: { fontSize: 17, lineHeight: 26 },
  facts: { gap: 14 },
  fact: { gap: 6, padding: 18 },
  factValue: { fontSize: 34, letterSpacing: -1.6 },
  factDetail: { fontSize: 14, lineHeight: 20 },
  exploreHead: { gap: 10, alignItems: 'flex-start' },
  exploreTitle: { fontSize: 32, lineHeight: 33, letterSpacing: -1.6 },
  more: { gap: 14 },
  watch: { flexDirection: 'row', gap: 14, padding: 18, alignItems: 'center' },
  watchIcon: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  watchBody: { flex: 1, gap: 4 },
  watchSmall: { fontSize: 10 },
  watchTitle: { fontSize: 22, lineHeight: 25 },
  watchCta: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.ink },
  resource: { gap: 6, padding: 18 },
  resourceTitle: { fontSize: 21, lineHeight: 24 },
  resourceCta: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.blue },
});
