import * as Notifications from 'expo-notifications';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { localDateKey } from './knowledge';
import { storage } from './storage';

/**
 * The daily reminder: a local notification on the phone at a time the player picks ("Today's question
 * is waiting"). No server involved. Instead of one repeating alarm, each of the next DAYS_AHEAD days is
 * scheduled on its own, so a day the player has already played can be skipped and the text can vary.
 * The schedule is rebuilt whenever the app opens, a Daily is played, or the setting changes.
 */

export type Reminder = { enabled: boolean; hour: number; minute: number };

const KEY = 'kno:reminder';
/** Set once the Today screen has offered the reminder, so it asks only once. */
const OFFERED_KEY = 'kno:reminder-offered';
const ID_PREFIX = 'kno-daily-';
const CHANNEL = 'daily';
const DAYS_AHEAD = 14;
export const DEFAULT_REMINDER: Reminder = { enabled: false, hour: 9, minute: 0 };

const MESSAGES = [
  { title: "Today's question is waiting 🦉", body: 'One good question, one memorable story.' },
  { title: 'Know one more thing today', body: 'Your Daily is ready. It takes a minute.' },
  { title: 'New Daily unlocked ✨', body: 'Can you get it right?' },
  { title: 'A new story is waiting 📖', body: "Answer today's question to read it." },
  { title: 'Keep your streak going 🔥', body: "Today's question is ready when you are." },
];

function read(): Reminder {
  try {
    const value = JSON.parse(storage.getItem(KEY) ?? 'null') as Partial<Reminder> | null;
    if (value && typeof value.hour === 'number' && typeof value.minute === 'number') return { enabled: Boolean(value.enabled), hour: value.hour, minute: value.minute };
  } catch {
    // fall through to the default
  }
  return DEFAULT_REMINDER;
}

// A tiny store so Settings and the Today offer show the same state.
let current: Reminder | null = null;
const listeners = new Set<() => void>();
const snapshot = () => (current ??= read());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
function save(next: Reminder) {
  current = next;
  storage.setItem(KEY, JSON.stringify(next));
  for (const listener of listeners) listener();
}

export function useReminder(): Reminder {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export const reminderOffered = () => storage.getItem(OFFERED_KEY) === '1';
export const markReminderOffered = () => storage.setItem(OFFERED_KEY, '1');

/** "9:00", in the phone's own 12/24-hour style. */
export function formatTime(hour: number, minute: number): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

/** Shows reminders as a banner even while the app is open. Call once at startup. */
export function setUpNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Daily question', importance: Notifications.AndroidImportance.DEFAULT }).catch(() => {});
  }
}

async function permitted(ask: boolean): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!ask || !existing.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Rebuilds the schedule: cancels our pending reminders, then schedules the next DAYS_AHEAD days at
 * the chosen time, skipping today when it's already played or the time has passed.
 */
export async function syncReminders(playedToday: boolean): Promise<void> {
  try {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(pending.filter((item) => item.identifier.startsWith(ID_PREFIX)).map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
    const reminder = snapshot();
    if (!reminder.enabled || !(await permitted(false))) return;
    const now = new Date();
    for (let offset = 0; offset < DAYS_AHEAD; offset += 1) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, reminder.hour, reminder.minute, 0, 0);
      if (offset === 0 && (playedToday || at <= now)) continue;
      const key = localDateKey(at);
      const seed = [...key].reduce((total, character) => total + character.charCodeAt(0), 0);
      const message = MESSAGES[seed % MESSAGES.length]!;
      await Notifications.scheduleNotificationAsync({
        identifier: `${ID_PREFIX}${key}`,
        content: { ...message, data: { url: '/' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
      });
    }
  } catch {
    // Scheduling is best effort (e.g. no notification support on this device).
  }
}

export type EnableResult = 'on' | 'denied';

/** Turns the reminder on at a time, asking for permission first; 'denied' when the player said no. */
export async function enableReminder(hour: number, minute: number, playedToday: boolean): Promise<EnableResult> {
  markReminderOffered();
  if (!(await permitted(true))) {
    save({ enabled: false, hour, minute });
    return 'denied';
  }
  save({ enabled: true, hour, minute });
  await syncReminders(playedToday);
  return 'on';
}

export async function disableReminder(playedToday: boolean): Promise<void> {
  save({ ...snapshot(), enabled: false });
  await syncReminders(playedToday);
}

/** Changes the time of an enabled reminder. */
export async function setReminderTime(hour: number, minute: number, playedToday: boolean): Promise<void> {
  save({ ...snapshot(), hour, minute });
  await syncReminders(playedToday);
}
