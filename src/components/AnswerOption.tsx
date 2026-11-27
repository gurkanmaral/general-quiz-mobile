import { StyleSheet, Text, View } from 'react-native';
import { PressBlock } from '@/ui/kit';
import { colors, fonts } from '@/ui/theme';

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong';

const LOOK: Record<OptionState, { bg: string; fg: string }> = {
  idle: { bg: '#ffffff', fg: colors.ink },
  selected: { bg: colors.blue, fg: '#ffffff' },
  correct: { bg: colors.lime, fg: colors.ink },
  wrong: { bg: colors.coral, fg: colors.ink },
};

/** One answer choice (web .knowledge-option): letter key, text, and ✓ / × once revealed. */
export function AnswerOption({ index, label, state, disabled, onPress }: { index: number; label: string; state: OptionState; disabled?: boolean; onPress?: () => void }) {
  const { bg, fg } = LOOK[state];
  const letter = String.fromCharCode(65 + index);
  return (
    <PressBlock
      onPress={onPress}
      disabled={disabled}
      color={bg}
      radius={13}
      offset={5}
      down
      haptic="select"
      accessibilityRole="radio"
      accessibilityLabel={`${letter}. ${label}${state === 'correct' ? ', correct answer' : state === 'wrong' ? ', your answer, wrong' : ''}`}
      accessibilityState={{ checked: state === 'selected' || state === 'wrong' }}
      outerStyle={disabled ? styles.noFade : undefined}
      style={styles.face}
    >
      <View style={[styles.key, { borderColor: fg }]}>
        <Text style={[styles.keyText, { color: fg }]}>{letter}</Text>
      </View>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
      {(state === 'correct' || state === 'wrong') && <Text style={styles.status}>{state === 'correct' ? '✓' : '×'}</Text>}
    </PressBlock>
  );
}

const styles = StyleSheet.create({
  // A revealed option is disabled but must keep its full colour.
  noFade: { opacity: 1 },
  face: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 14, paddingVertical: 10 },
  key: { width: 33, height: 33, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: 8 },
  keyText: { fontFamily: fonts.bodyHeavy, fontSize: 12 },
  text: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 21 },
  status: { fontFamily: fonts.bodyBlack, fontSize: 22, color: colors.ink },
});
