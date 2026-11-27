import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { STREAK_REPAIR_DAYS, countsForStreak } from '@/shared';
import { localDailyQuestion } from '@/lib/dailyContent';
import { localDateKey, toKnowledgeQuestion } from '@/lib/knowledge';
import { useProgress } from '@/lib/progress';
import { Block, Body, Chip, Display, Kicker, PressBlock } from '@/ui/kit';
import { colors, fonts } from '@/ui/theme';

const LIBRARY_DAYS = 6;

function shiftDate(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

const todayDate = (key: string) => new Date(`${key}T12:00:00`);

/** The last five days: played (✓), missed (dashed) or today (web .knowledge-week). */
export function WeekStrip() {
  const { history, today, streak } = useProgress();
  const base = todayDate(today);
  const counts = (key: string) => {
    const play = history.plays[key];
    return play ? countsForStreak({ dailyDate: key, playedOn: play.playedOn }) : false;
  };
  const days = [-4, -3, -2, -1, 0].map((offset) => {
    const date = shiftDate(base, offset);
    const key = localDateKey(date);
    return { key, label: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date), day: date.getDate(), done: counts(key), missed: offset < 0 && !counts(key), isToday: offset === 0 };
  });
  const answered = Object.keys(history.plays).length;
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Kicker>Build a daily ritual</Kicker>
        <Display style={styles.title}>Your week</Display>
        <Body style={styles.lead}>
          {answered} discover{answered === 1 ? 'y' : 'ies'} completed · best streak {streak.best}
        </Body>
      </View>
      <View style={styles.week}>
        {days.map((day) => (
          <View key={day.key} style={styles.dayOuter} accessible accessibilityLabel={`${day.label} ${day.day}: ${day.done ? 'played' : day.missed ? 'missed' : 'today'}`}>
            {!day.missed && <View style={styles.dayShadow} />}
            <View style={[styles.day, day.isToday && styles.dayToday, day.done && styles.dayDone, day.missed && styles.dayMissed]}>
              <Text style={styles.dayLabel}>{day.label}</Text>
              <Text style={[styles.dayNumber, day.missed && styles.dayStruck]}>{day.done ? '✓' : day.day}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Past days to catch up on (web .knowledge-library); each opens that day's Daily. */
export function LibraryList() {
  const { history, today } = useProgress();
  const base = todayDate(today);
  const shortDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const days = Array.from({ length: LIBRARY_DAYS }, (_, index) => {
    const date = shiftDate(base, -(index + 1));
    const key = localDateKey(date);
    const stored = history.plays[key];
    const item = toKnowledgeQuestion(localDailyQuestion(key, stored?.questionId));
    const record = stored?.questionId === item.id ? stored : undefined;
    const tooLate = !record && !countsForStreak({ dailyDate: key, playedOn: today });
    return { date, key, item, record, onTime: !record || record.playedOn <= key, tooLate };
  });
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Kicker color={colors.sky}>Missed one?</Kicker>
        <Display style={styles.title}>Library</Display>
        <Body style={styles.lead}>Play a missed day within {STREAK_REPAIR_DAYS} days to keep your streak.</Body>
      </View>
      <View style={styles.cards}>
        {days.map(({ date, key, item, record, onTime, tooLate }) => (
          <PressBlock key={key} offset={5} down={false} radius={17} color={tooLate ? colors.panel : colors.white} onPress={() => router.push(`/day/${key}`)} accessibilityRole="link" style={styles.card}>
            <View style={styles.cardMeta}>
              <Chip label={item.category} color={colors.sky} />
              <Text style={styles.cardDate}>{shortDate.format(date)}</Text>
            </View>
            <Display style={styles.cardTitle}>{item.eyebrow}</Display>
            <View style={[styles.status, record ? (record.correct ? styles.statusRight : styles.statusWrong) : tooLate ? styles.statusLate : null]}>
              <Text style={styles.statusText}>
                {record ? `${record.correct ? '✓ Got it' : '× Missed it'}${onTime ? '' : ' · caught up'}` : tooLate ? 'Play late · no streak' : 'Play this one'} →
              </Text>
            </View>
          </PressBlock>
        ))}
      </View>
    </View>
  );
}

/** A compact streak card for the top of the Library tab. */
export function StreakCard() {
  const { streak } = useProgress();
  return (
    <Block offset={6} radius={20} color={streak.current > 0 ? colors.cream : colors.white} style={styles.streakCard}>
      <Text style={styles.streakFlame}>🔥</Text>
      <View style={styles.streakBody}>
        <Display style={styles.streakNumber}>{streak.current}-day streak</Display>
        <Body style={styles.lead}>Best so far: {streak.best}. Catch up on a missed day below to keep it alive.</Body>
      </View>
    </Block>
  );
}

const styles = StyleSheet.create({
  section: { gap: 16 },
  head: { gap: 10, alignItems: 'flex-start' },
  title: { fontSize: 40, lineHeight: 40, letterSpacing: -2.4 },
  lead: { fontSize: 14, lineHeight: 20, color: colors.muted },
  week: { flexDirection: 'row', gap: 8 },
  dayOuter: { flex: 1, height: 92 },
  dayShadow: { position: 'absolute', left: 3, top: 3, right: -3, bottom: -3, borderRadius: 12, backgroundColor: colors.ink },
  day: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 2, borderColor: colors.ink, borderRadius: 12, backgroundColor: colors.white },
  dayToday: { backgroundColor: colors.sky },
  dayDone: { backgroundColor: colors.lime },
  dayMissed: { borderStyle: 'dashed', backgroundColor: 'transparent', opacity: 0.55 },
  dayLabel: { fontFamily: fonts.bodyBlack, fontSize: 10, textTransform: 'uppercase', color: colors.ink },
  dayNumber: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  dayStruck: { textDecorationLine: 'line-through' },
  cards: { gap: 14 },
  card: { gap: 12, padding: 18 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.muted },
  cardTitle: { fontSize: 22, lineHeight: 25 },
  status: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1.5, borderColor: colors.ink, borderRadius: 999, backgroundColor: colors.yellow },
  statusRight: { backgroundColor: colors.lime },
  statusWrong: { backgroundColor: colors.blush },
  statusLate: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  statusText: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.ink },
  streakCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  streakFlame: { fontSize: 40 },
  streakBody: { flex: 1, gap: 4 },
  streakNumber: { fontSize: 26 },
});
