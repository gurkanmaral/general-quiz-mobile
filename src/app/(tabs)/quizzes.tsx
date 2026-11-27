import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { QUESTION_CATEGORIES, localize, type QuizSummary } from '@/contracts';
import { useAccount } from '@/lib/account';
import { createLobby, fetchQuizzes } from '@/lib/api';
import { storage } from '@/lib/storage';
import { AwardChips } from '@/components/Unlocks';
import { percent } from '@/lib/format';
import { AppHeader, Screen } from '@/ui/Screen';
import { Block, Body, Button, Chip, Display, Kicker, Note, PageTitle, PressBlock, Skeleton } from '@/ui/kit';
import { accents, colors, fonts } from '@/ui/theme';

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; quizzes: QuizSummary[] };
type Category = (typeof QUESTION_CATEGORIES)[number];
type Filter = 'All' | Category;

const CATEGORY_ICONS: Record<Category, string> = { Movies: '🎬', Books: '📚', Science: '🔬', History: '🏛️', Music: '🎵', Technology: '💻', World: '🌍' };
const CATEGORY_COLORS: Record<Filter, string> = {
  All: colors.yellow,
  Movies: colors.mint,
  Books: colors.blush,
  Science: colors.ice,
  History: colors.cream,
  World: colors.violet,
  Music: colors.lilac,
  Technology: colors.stone,
};
const FILTER_KEY = 'kno:quiz-category';

function readFilter(): Filter {
  const value = storage.getItem(FILTER_KEY);
  return value && (value === 'All' || (QUESTION_CATEGORIES as readonly string[]).includes(value)) ? (value as Filter) : 'All';
}

const countLabel = (count: number) => (count === 0 ? 'Coming soon' : `${count} ${count === 1 ? 'quiz' : 'quizzes'}`);


function CategoryPicker({ quizzes, selected, onPick }: { quizzes: readonly QuizSummary[]; selected: Filter; onPick: (value: Filter) => void }) {
  const counts = new Map<string, number>();
  for (const quiz of quizzes) counts.set(quiz.category, (counts.get(quiz.category) ?? 0) + 1);
  const tiles: { value: Filter; icon: string; count: number }[] = [
    { value: 'All', icon: '✨', count: quizzes.length },
    ...QUESTION_CATEGORIES.map((category) => ({ value: category, icon: CATEGORY_ICONS[category], count: counts.get(category) ?? 0 })),
  ];
  return (
    // A swipeable row on a phone, so the quizzes start on the first screen.
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catsScroll} contentContainerStyle={styles.cats} accessibilityLabel="Categories">
      {tiles.map((tile) => {
        const active = selected === tile.value;
        return (
          <PressBlock
            key={tile.value}
            outerStyle={styles.catOuter}
            offset={active ? 2 : 4}
            down={false}
            radius={16}
            color={CATEGORY_COLORS[tile.value]}
            border={active ? 3 : 2}
            disabled={tile.count === 0}
            haptic="select"
            onPress={() => onPick(tile.value)}
            accessibilityState={{ selected: active }}
            style={[styles.cat, active && styles.catActive]}
          >
            <Text style={styles.catIcon}>{tile.icon}</Text>
            <Text style={styles.catName}>{tile.value === 'All' ? 'All quizzes' : tile.value}</Text>
            <Text style={styles.catCount}>{countLabel(tile.count)}</Text>
          </PressBlock>
        );
      })}
    </ScrollView>
  );
}

function QuizCard({ quiz }: { quiz: QuizSummary }) {
  const { requireSignIn, status } = useAccount();
  const title = localize(quiz.title);
  const [opening, setOpening] = useState<'idle' | 'busy' | 'failed'>('idle');
  const play = () => {
    const target = `/play/${quiz.slug}`;
    if (requireSignIn(target)) router.push(`/play/${quiz.slug}`);
  };
  /** Opens a Lobby for this Quiz; the player becomes Host (FR-27). */
  const openLobby = async () => {
    if (!requireSignIn('/quizzes')) return;
    setOpening('busy');
    try {
      const { code } = await createLobby(quiz.slug);
      setOpening('idle');
      router.push(`/lobby/${code}`);
    } catch {
      setOpening('failed');
    }
  };
  return (
    <Block offset={5} radius={18} color={accents[quiz.theme] ?? colors.white} style={styles.quiz}>
      <View style={styles.quizTop}>
        <Chip label={quiz.category} />
        <Text style={styles.quizMeta}>
          {quiz.questionCount} Q · {quiz.expertCount} expert
        </Text>
      </View>
      <Display style={styles.quizTitle}>{title}</Display>
      <Body style={styles.quizText}>{localize(quiz.description)}</Body>
      <AwardChips awards={quiz.awards} />
      {quiz.record && (
        <View style={styles.record}>
          <View style={styles.meter} accessibilityRole="progressbar" accessibilityLabel="Answered correctly" accessibilityValue={{ min: 0, max: 100, now: percent(quiz.record.correctShare) }}>
            <View style={[styles.meterFill, { width: `${percent(quiz.record.correctShare)}%` }]} />
          </View>
          <Body style={styles.recordText}>
            <Text style={styles.bold}>{percent(quiz.record.correctShare)}%</Text> answered correctly · {quiz.record.gamesPlayed} game{quiz.record.gamesPlayed === 1 ? '' : 's'}
          </Body>
        </View>
      )}
      <View style={styles.quizFoot}>
        <Text style={[styles.best, !quiz.best && styles.bestEmpty]}>
          {quiz.best ? (
            <>
              Best <Text style={styles.bestScore}>{quiz.best.score}/{quiz.best.total}</Text>
            </>
          ) : status === 'signedIn' ? (
            'Not played yet'
          ) : (
            'Sign in to play'
          )}
        </Text>
        <View style={styles.buttons}>
          <Button label={opening === 'failed' ? 'Try again' : 'Lobby'} tone="white" size="sm" busy={opening === 'busy'} onPress={() => void openLobby()} accessibilityLabel={`Create Lobby for ${title}`} />
          <Button label="Play" tone="ink" size="sm" icon="play" onPress={play} accessibilityLabel={`Play ${title}`} />
        </View>
      </View>
    </Block>
  );
}

/** The Quizzes tab (FR-13): pick a Category, then quiz cards. Browsing is public; playing needs sign-in (FR-5). */
export default function QuizzesScreen() {
  const { status } = useAccount();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<Filter>(readFilter);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    let live = true;
    setState((current) => (current.status === 'ready' ? current : { status: 'loading' }));
    fetchQuizzes().then(
      (response) => live && setState({ status: 'ready', quizzes: response.quizzes }),
      () => live && setState({ status: 'error' }),
    ).finally(() => live && setRefreshing(false));
    return () => {
      live = false;
    };
  }, [status, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const pick = (value: Filter) => {
    setFilter(value);
    storage.setItem(FILTER_KEY, value);
  };

  return (
    <Screen
      header={<AppHeader />}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        retry();
      }}
    >
      <View style={styles.intro}>
        <Kicker>Play a whole topic</Kicker>
        <PageTitle>Quizzes</PageTitle>
        <Body>Pick a topic, then a quiz. Ten questions a game; earn badges and titles as you master it.</Body>
      </View>
      {state.status === 'loading' && <Skeleton count={3} height={170} label="Loading quizzes" />}
      {state.status === 'error' && (
        <Note tone="error" action={{ label: 'Try again', onPress: retry }}>
          Couldn't load the quizzes. Check your connection.
        </Note>
      )}
      {state.status === 'ready' && state.quizzes.length === 0 && <Note>No quizzes yet — check back soon.</Note>}
      {state.status === 'ready' && state.quizzes.length > 0 && (
        <>
          <CategoryPicker quizzes={state.quizzes} selected={filter} onPick={pick} />
          <Display style={styles.groupTitle}>{filter === 'All' ? 'All quizzes' : filter}</Display>
          <View style={styles.list}>
            {state.quizzes
              .filter((quiz) => filter === 'All' || quiz.category === filter)
              .map((quiz, index) => (
                <Animated.View key={quiz.slug} entering={FadeInDown.delay(index * 60).springify().damping(16)}>
                  <QuizCard quiz={quiz} />
                </Animated.View>
              ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 10, alignItems: 'flex-start' },
  // Bleed to the screen edges so the row visibly continues off-screen.
  catsScroll: { marginHorizontal: -18, flexGrow: 0 },
  // flex-start: a row ScrollView would otherwise stretch each tile's shadow past its face.
  cats: { gap: 6, paddingHorizontal: 18, paddingBottom: 2, alignItems: 'flex-start' },
  catOuter: { width: 122 },
  cat: { height: 100, padding: 12, gap: 2, justifyContent: 'space-between' },
  catActive: { transform: [{ translateX: 2 }, { translateY: 2 }] },
  catIcon: { fontSize: 26 },
  catName: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  catCount: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  groupTitle: { fontSize: 30, letterSpacing: -1.4 },
  list: { gap: 16 },
  quiz: { padding: 16, gap: 10 },
  quizTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quizMeta: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.ink },
  quizTitle: { fontSize: 24, lineHeight: 26, letterSpacing: -1.1 },
  quizText: { fontSize: 14, lineHeight: 20 },
  record: { gap: 6 },
  meter: { height: 10, overflow: 'hidden', borderWidth: 2, borderColor: colors.ink, borderRadius: 999, backgroundColor: colors.white },
  meterFill: { height: '100%', backgroundColor: colors.lime },
  recordText: { fontSize: 13 },
  bold: { fontFamily: fonts.bodyHeavy },
  quizFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 },
  best: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  bestEmpty: { color: colors.muted },
  bestScore: { fontFamily: fonts.display, fontSize: 16 },
  buttons: { flexDirection: 'row', gap: 8 },
});
