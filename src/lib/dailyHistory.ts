import type { StreakPlay } from '@/shared';
import { storage } from './storage';
import { localDateKey } from './knowledge';

/** One answered Daily, keyed in the history by its Daily Date. */
export type DailyPlay = {
  questionId: string;
  selectedIndex: number;
  correct: boolean;
  answeredAt: string;
  /** Local date on which the player answered; later than the Daily Date for Library catch-up. */
  playedOn: string;
};

export type DailyHistory = { version: 2; plays: Record<string, DailyPlay> };

export const HISTORY_KEY = 'kno:daily-v2';
/** Pre-v2 storage, read once for migration and left in place as a backup. */
export const LEGACY_KEY = 'curio-daily:progress-v1';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function emptyHistory(): DailyHistory {
  return { version: 2, plays: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toPlay(value: unknown, fallbackPlayedOn?: string, forcePlayedOn?: string): DailyPlay | null {
  if (!isRecord(value)) return null;
  const { questionId, selectedIndex, correct, answeredAt, playedOn } = value;
  if (typeof questionId !== 'string' || typeof selectedIndex !== 'number' || typeof correct !== 'boolean' || typeof answeredAt !== 'string') {
    return null;
  }
  const answered = new Date(answeredAt);
  const derived = Number.isNaN(answered.getTime()) ? fallbackPlayedOn : localDateKey(answered);
  const day = forcePlayedOn ?? (typeof playedOn === 'string' && DATE_PATTERN.test(playedOn) ? playedOn : derived);
  if (!day) return null;
  return { questionId, selectedIndex, correct, answeredAt, playedOn: day };
}

function hasKey(key: string): boolean {
  try {
    return storage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function readJson(key: string): unknown {
  try {
    return JSON.parse(storage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

/**
 * Convert v1 `{ answers, catchUp }` into v2 plays. v1 `answers` were always played on their own
 * date, so their `playedOn` is the date key; catch-up plays take the local date of `answeredAt`.
 * On-time answers win over catch-up for the same date.
 */
export function migrateLegacy(value: unknown): DailyHistory {
  const history = emptyHistory();
  if (!isRecord(value)) return history;
  for (const [source, onTime] of [[value.catchUp, false], [value.answers, true]] as const) {
    if (!isRecord(source)) continue;
    for (const [date, raw] of Object.entries(source)) {
      if (!DATE_PATTERN.test(date)) continue;
      const play = toPlay(raw, date, onTime ? date : undefined);
      if (play) history.plays[date] = play;
    }
  }
  return history;
}

export function readHistory(): DailyHistory {
  const stored = readJson(HISTORY_KEY);
  if (isRecord(stored) && stored.version === 2 && isRecord(stored.plays)) {
    const history = emptyHistory();
    for (const [date, raw] of Object.entries(stored.plays)) {
      const play = DATE_PATTERN.test(date) ? toPlay(raw) : null;
      if (play) history.plays[date] = play;
    }
    return history;
  }
  // Migrate only when v2 was never written; a damaged v2 store must not be replaced by stale v1 data.
  if (hasKey(HISTORY_KEY)) return emptyHistory();
  const migrated = migrateLegacy(readJson(LEGACY_KEY));
  if (Object.keys(migrated.plays).length > 0) writeHistory(migrated);
  return migrated;
}

export function writeHistory(history: DailyHistory): void {
  try {
    storage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // The Daily still works when storage is unavailable; only persistence is lost.
  }
}

export function streakPlays(history: DailyHistory): StreakPlay[] {
  return Object.entries(history.plays).map(([dailyDate, play]) => ({ dailyDate, playedOn: play.playedOn }));
}
