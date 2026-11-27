import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { haptics } from '@/lib/haptics';
import { useProgress } from '@/lib/progress';
import { disableReminder, enableReminder, formatTime, markReminderOffered, reminderOffered, setReminderTime, useReminder } from '@/lib/reminder';
import { Block, Body, Button, Display, LinkButton, PressBlock } from '@/ui/kit';
import { colors, fonts } from '@/ui/theme';

function usePlayedToday(): boolean {
  const { history, today } = useProgress();
  return Boolean(history.plays[today]);
}

/** True when the phone blocks notifications for KNO. and won't ask again (only Settings can fix it). */
function useBlocked(): [boolean, () => void] {
  const [blocked, setBlocked] = useState(false);
  const check = () =>
    void Notifications.getPermissionsAsync().then(
      (status) => setBlocked(!status.granted && !status.canAskAgain),
      () => {},
    );
  useEffect(check, []);
  return [blocked, check];
}

/** The reminder time: the phone's own picker (inline pill on iOS, a dialog on Android). */
function TimePicker({ hour, minute, onPick }: { hour: number; minute: number; onPick: (hour: number, minute: number) => void }) {
  const value = new Date();
  value.setHours(hour, minute, 0, 0);
  const onChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'set' && date) onPick(date.getHours(), date.getMinutes());
  };
  if (Platform.OS === 'ios') {
    return <DateTimePicker value={value} mode="time" display="compact" minuteInterval={5} onChange={onChange} accentColor={colors.blue} accessibilityLabel="Reminder time" />;
  }
  return (
    <PressBlock offset={3} radius={11} onPress={() => DateTimePickerAndroid.open({ value, mode: 'time', onChange })} accessibilityLabel={`Reminder time, ${formatTime(hour, minute)}. Change`} style={styles.androidTime}>
      <Text style={styles.androidTimeText}>{formatTime(hour, minute)}</Text>
    </PressBlock>
  );
}

/** Settings: the daily reminder on/off and its time. */
export function ReminderCard() {
  const reminder = useReminder();
  const playedToday = usePlayedToday();
  const [blocked, recheck] = useBlocked();
  const [busy, setBusy] = useState(false);

  const toggle = async (on: boolean) => {
    setBusy(true);
    if (on) {
      const result = await enableReminder(reminder.hour, reminder.minute, playedToday);
      if (result === 'denied') recheck();
      else haptics.correct();
    } else {
      await disableReminder(playedToday);
    }
    setBusy(false);
  };

  return (
    <Block offset={5} radius={18} color={reminder.enabled ? colors.cream : colors.white} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.text}>
          <Display style={styles.title}>Daily reminder</Display>
          <Body style={styles.muted}>{reminder.enabled ? `Every day at ${formatTime(reminder.hour, reminder.minute)}, unless you've already played.` : 'A nudge on your phone when the new question is out.'}</Body>
        </View>
        <Switch value={reminder.enabled} disabled={busy} onValueChange={(next) => void toggle(next)} trackColor={{ true: colors.lime, false: colors.stone }} thumbColor={colors.white} accessibilityLabel="Daily reminder" />
      </View>
      {reminder.enabled && (
        <View style={styles.timeRow}>
          <Text style={styles.timeLabel}>Remind me at</Text>
          <TimePicker hour={reminder.hour} minute={reminder.minute} onPick={(hour, minute) => void setReminderTime(hour, minute, playedToday)} />
        </View>
      )}
      {blocked && !reminder.enabled && (
        <View style={styles.blocked}>
          <Body style={styles.blockedText}>Notifications are off for KNO. Turn them on in your phone's Settings to get the reminder.</Body>
          <LinkButton label="Open Settings" onPress={() => void Linking.openSettings()} />
        </View>
      )}
    </Block>
  );
}

/** Shown once on Today after answering: "Want a reminder tomorrow?" */
export function ReminderOffer() {
  const reminder = useReminder();
  const playedToday = usePlayedToday();
  const [hidden, setHidden] = useState(() => reminderOffered());
  const [busy, setBusy] = useState(false);
  if (hidden || reminder.enabled || !playedToday) return null;
  const time = formatTime(reminder.hour, reminder.minute);
  return (
    <Animated.View entering={FadeInDown.delay(600).springify().damping(15)}>
      <Block offset={6} radius={20} color={colors.sky} style={styles.offer}>
        <Text style={styles.offerEmoji}>🔔</Text>
        <Display style={styles.offerTitle}>Come back tomorrow?</Display>
        <Body style={styles.offerText}>Get a reminder when the next question is out. You can change the time in Settings.</Body>
        <View style={styles.offerActions}>
          <Button
            label={`Remind me at ${time}`}
            tone="ink"
            busy={busy}
            onPress={async () => {
              setBusy(true);
              const result = await enableReminder(reminder.hour, reminder.minute, playedToday);
              if (result === 'on') haptics.correct();
              setBusy(false);
              setHidden(true);
            }}
          />
          <LinkButton
            label="Not now"
            color={colors.ink}
            onPress={() => {
              markReminderOffered();
              setHidden(true);
            }}
          />
        </View>
      </Block>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  text: { flex: 1, gap: 4 },
  title: { fontSize: 20 },
  muted: { fontSize: 13, lineHeight: 19, color: colors.muted },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 12, borderTopWidth: 2, borderTopColor: colors.faint, borderStyle: 'dashed' },
  timeLabel: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink },
  androidTime: { minWidth: 92, height: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  androidTimeText: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  blocked: { gap: 6 },
  blockedText: { fontSize: 13, lineHeight: 19 },
  offer: { padding: 18, gap: 10 },
  offerEmoji: { fontSize: 30 },
  offerTitle: { fontSize: 24, lineHeight: 27, letterSpacing: -1 },
  offerText: { fontSize: 14, lineHeight: 20 },
  offerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginTop: 4 },
});
