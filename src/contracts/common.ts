import { z } from 'zod';

/** Text in every content language; English is required, Turkish optional until translated. */
export const LocalizedTextSchema = z.object({
  en: z.string().min(1),
  tr: z.string().min(1).optional(),
});
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;
export type ContentLanguage = keyof LocalizedText;

/** Picks the requested language, falling back to English. */
export function localize(text: LocalizedText, language: ContentLanguage = 'en'): string {
  return text[language] ?? text.en;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True when `value` is `YYYY-MM-DD` and names a real calendar day. */
export function isCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** A player's local calendar date (AD-5). Range checks happen on the server. */
export const DailyDateSchema = z.string().refine(isCalendarDate, { message: 'Expected a calendar date as YYYY-MM-DD' });

/** RFC 9457 problem details with KNO.'s stable `code` extension. */
export const ProblemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  detail: z.string().optional(),
  instance: z.string().optional(),
});
export type Problem = z.infer<typeof ProblemSchema>;

/** `GET /health`: 200 when everything is up, 503 with `database: "down"` when Postgres is unreachable. */
export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  database: z.enum(['ok', 'down']),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
