/**
 * KNO. Daily Streak. Dates are local calendar dates as `YYYY-MM-DD` strings.
 *
 * A play counts for its Daily Date when it happened no more than `repairDays`
 * days after that date. The current Streak ends today, or yesterday when today
 * is not played yet. The best Streak is the longest counted run ever.
 *
 * The API (apps/api daily module) calls this same function (AD-6); both pass
 * `content/fixtures/streak-cases.json`.
 */

export const STREAK_REPAIR_DAYS = 3;

export type StreakPlay = {
  /** The Daily Date the question belongs to. */
  dailyDate: string;
  /** The local date on which the player answered it. */
  playedOn: string;
};

export type StreakSummary = { current: number; best: number };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Whole days from `from` to `to` (both `YYYY-MM-DD`). */
export function daysBetween(from: string, to: string): number {
  return Math.round(dayNumber(to) - dayNumber(from));
}

function dayNumber(key: string): number {
  if (!DATE_PATTERN.test(key)) return Number.NaN;
  const [year, month, day] = key.split('-').map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/** The date `n` days after `key`. */
export function shiftDateKey(key: string, n: number): string {
  const date = new Date((dayNumber(key) + n) * 86_400_000);
  return date.toISOString().slice(0, 10);
}

/** Whether a play keeps its Daily Date in the Streak. */
export function countsForStreak(play: StreakPlay, repairDays = STREAK_REPAIR_DAYS): boolean {
  const late = daysBetween(play.dailyDate, play.playedOn);
  return Number.isFinite(late) && late >= 0 && late <= repairDays;
}

export function computeStreak(
  plays: readonly StreakPlay[],
  today: string,
  repairDays = STREAK_REPAIR_DAYS,
): StreakSummary {
  const counted = new Set(
    plays
      .filter((play) => play.dailyDate <= today && countsForStreak(play, repairDays))
      .map((play) => play.dailyDate),
  );

  let cursor = counted.has(today) ? today : shiftDateKey(today, -1);
  let current = 0;
  while (counted.has(cursor)) {
    current += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of [...counted].sort()) {
    run = previous !== null && daysBetween(previous, date) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }

  return { current, best: Math.max(best, current) };
}
