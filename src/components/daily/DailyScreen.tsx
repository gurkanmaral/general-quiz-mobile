import { router } from 'expo-router';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useAccount } from '@/lib/account';
import { useProgress } from '@/lib/progress';
import { AppHeader, BackBar, Screen } from '@/ui/Screen';
import { Block, Body, Display, Icon, Label, PressBlock } from '@/ui/kit';
import { colors, fonts } from '@/ui/theme';
import { DailyView } from './DailyView';
import { WeekStrip } from './Week';
import { ReminderOffer } from '@/components/ReminderCard';

/** Today (the first tab) or a Library day (`/day/<date>`). */
export function DailyScreen({ viewKey }: { viewKey: string }) {
  const { today, reload } = useProgress();
  const account = useAccount();
  const isToday = viewKey === today;
  const scroll = useRef<ScrollViewInstance>(null);
  const dailyY = useRef(0);
  const date = new Date(`${viewKey}T12:00:00`);
  const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(date);

  return (
    <Screen
      scrollRef={scroll}
      header={isToday ? <AppHeader /> : <BackBar title="From the library" />}
      onRefresh={isToday ? () => {
        reload();
        void account.refresh();
      } : undefined}
    >
      {account.banner && isToday && (
        <Block offset={4} radius={14} color={colors.mint} style={styles.banner}>
          <Body style={styles.bannerText}>{account.banner}</Body>
          <Pressable onPress={account.dismissBanner} accessibilityLabel="Dismiss" hitSlop={10}>
            <Icon name="close" size={18} />
          </Pressable>
        </Block>
      )}
      <View style={styles.intro}>
        <Label style={styles.date}>
          <Text style={styles.dateTag}>{isToday ? 'Daily issue' : 'From the library'}</Text> {dateLabel}
        </Label>
        <Display style={styles.h1}>
          Know one more <Text style={styles.em}>thing</Text> today.
        </Display>
        {isToday ? (
          <View style={styles.introNote}>
            <View style={styles.oneQuestion}>
              <Text style={styles.oneQuestionText}>1 question</Text>
            </View>
            <Body style={styles.introText}>One good question, one memorable story. That’s it.</Body>
          </View>
        ) : (
          <PressBlock offset={5} down={false} radius={14} color={colors.yellow} onPress={() => router.navigate('/')} style={styles.back}>
            <Text style={styles.backText}>Back to today</Text>
            <Icon name="arrow" size={18} />
          </PressBlock>
        )}
      </View>
      <View
        onLayout={(event) => {
          dailyY.current = event.nativeEvent.layout.y;
        }}
      >
        <DailyView key={viewKey} viewKey={viewKey} onScrollTo={(y) => scroll.current?.scrollTo({ y: dailyY.current + y - 12, animated: true })} />
      </View>
      {isToday && (
        <>
          <ReminderOffer />
          <WeekStrip />
          <PressBlock offset={5} down={false} radius={16} color={colors.sky} onPress={() => router.navigate('/library')} accessibilityRole="link" style={styles.libraryLink}>
            <View style={styles.libraryBody}>
              <Label>Missed one?</Label>
              <Display style={styles.libraryTitle}>Open the Library</Display>
            </View>
            <Icon name="arrow" size={22} />
          </PressBlock>
        </>
      )}
      <View style={styles.footer}>
        <Text style={styles.footerBrand}>KNO.</Text>
        <Body style={styles.footerText}>One good question. Every single day.</Body>
        <Pressable onPress={() => router.push('/privacy')} accessibilityRole="link">
          <Text style={styles.footerLink}>Privacy · Gizlilik</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  bannerText: { flex: 1, fontFamily: fonts.bodyBold },
  intro: { gap: 12, alignItems: 'flex-start' },
  date: { color: colors.muted },
  dateTag: { color: colors.blue },
  h1: { fontSize: 40, lineHeight: 44, letterSpacing: -2.6 },
  em: { color: colors.blue, fontFamily: fonts.display },
  introNote: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  oneQuestion: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.yellow },
  oneQuestionText: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  introText: { flex: 1, fontSize: 14, lineHeight: 20 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 13 },
  backText: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink },
  libraryLink: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 12 },
  libraryBody: { flex: 1, gap: 4 },
  libraryTitle: { fontSize: 24 },
  footer: { gap: 6, paddingTop: 20, borderTopWidth: 3, borderTopColor: colors.ink },
  footerBrand: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  footerText: { fontSize: 13 },
  footerLink: { fontFamily: fonts.bodyHeavy, fontSize: 13, textDecorationLine: 'underline', color: colors.ink },
});
