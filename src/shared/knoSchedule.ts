/** A repeating Daily rotation: the Question for a date is `questions[(days since anchor) mod length]`. */
export type DailyRotation = {
  anchor: string;
  questions: readonly string[];
};

const MS_PER_DAY = 86_400_000;

/** Whole days from 1970-01-01 to a `YYYY-MM-DD` date string (calendar arithmetic, no time zone). */
export function dayNumber(dailyDate: string): number {
  const [year, month, day] = dailyDate.split('-').map(Number);
  return Math.floor(Date.UTC(year!, month! - 1, day!) / MS_PER_DAY);
}

/** Slug of the rotation Question for a Daily Date, or undefined for an empty rotation. */
export function rotationSlug(rotation: DailyRotation, dailyDate: string): string | undefined {
  const length = rotation.questions.length;
  if (length === 0) return undefined;
  const offset = dayNumber(dailyDate) - dayNumber(rotation.anchor);
  return rotation.questions[((offset % length) + length) % length];
}
