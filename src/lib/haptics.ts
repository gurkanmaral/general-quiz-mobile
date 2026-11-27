import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Haptics are a nicety: never let a missing engine (web, old Android) throw.
const safe = (run: () => Promise<void>) => {
  if (Platform.OS === 'web') return;
  run().catch(() => {});
};

export const haptics = {
  /** A press on a button or card. */
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** A heavier press: start a game, lock in an answer. */
  press: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Picking from a set: answer options, tabs, segmented settings. */
  select: () => safe(() => Haptics.selectionAsync()),
  correct: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  wrong: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  warn: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
