import { StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { localize, type AwardSummary, type Rarity, type UnlockedAward } from '@/contracts';
import { Block, Body, Display, Label } from '@/ui/kit';
import { colors, fonts } from '@/ui/theme';

/** "🏅 Middle-earth Fan · 🎭 Gandalf": what a Quiz can award (FR-13). */
export function AwardChips({ awards }: { awards: readonly AwardSummary[] }) {
  if (awards.length === 0) return null;
  return (
    <View style={styles.chips} accessibilityLabel="Badges and Titles to earn">
      {awards.map((award) => (
        <View key={award.slug} style={[styles.chip, award.kind === 'title' && styles.chipTitle]}>
          <Text style={styles.chipText}>
            {award.icon} {localize(award.name)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** "12% of players have this" (FR-19); "New" before Rarity is first computed. */
export function rarityText(rarity: Rarity): string {
  return rarity.percent === null ? 'Rarity not counted yet' : `${rarity.label} of players have this`;
}

/** Celebrates Badges and Titles a game just unlocked (FR-16, FR-17): cards pop in one by one. */
export function UnlockCelebration({ unlocks }: { unlocks: readonly UnlockedAward[] }) {
  if (unlocks.length === 0) return null;
  return (
    <View style={styles.unlocks}>
      <Display style={styles.unlocksTitle}>{unlocks.length === 1 ? '🎉 New unlock!' : `🎉 ${unlocks.length} new unlocks!`}</Display>
      {unlocks.map((award, index) => (
        <Animated.View key={award.slug} entering={ZoomIn.delay(150 + index * 140).springify().damping(12)}>
          <Block offset={4} radius={16} color={award.kind === 'badge' ? colors.cream : colors.violet} style={styles.unlock}>
            <Text style={styles.unlockIcon}>{award.icon}</Text>
            <View style={styles.unlockBody}>
              <Label>{award.kind === 'badge' ? 'Badge earned' : 'Title unlocked'}</Label>
              <Display style={styles.unlockName}>{localize(award.name)}</Display>
              <Body style={styles.unlockText}>{localize(award.description)}</Body>
              <Text style={styles.rarity}>{rarityText(award.rarity)}</Text>
            </View>
          </Block>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1.5, borderColor: colors.ink, borderRadius: 999, backgroundColor: colors.cream },
  chipTitle: { backgroundColor: colors.violet },
  chipText: { fontFamily: fonts.bodyHeavy, fontSize: 11, color: colors.ink },
  unlocks: { gap: 12 },
  unlocksTitle: { fontSize: 26 },
  unlock: { flexDirection: 'row', gap: 14, padding: 14, alignItems: 'flex-start' },
  unlockIcon: { fontSize: 36 },
  unlockBody: { flex: 1, gap: 3 },
  unlockName: { fontSize: 22 },
  unlockText: { fontSize: 14, lineHeight: 20 },
  rarity: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.blue },
});
