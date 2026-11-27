import { z } from 'zod';
import { DailyDateSchema, LocalizedTextSchema } from './common';

export const QUESTION_CATEGORIES = ['Movies', 'Books', 'Science', 'History', 'Music', 'Technology', 'World'] as const;
export const QUESTION_THEMES = ['violet', 'crimson', 'cyan', 'amber', 'coral', 'blue', 'emerald'] as const;
export const OPTIONS_PER_DAILY_QUESTION = 4;

export const QuestionCategorySchema = z.enum(QUESTION_CATEGORIES);
export type QuestionCategory = z.infer<typeof QuestionCategorySchema>;
export const QuestionThemeSchema = z.enum(QUESTION_THEMES);
export type QuestionTheme = z.infer<typeof QuestionThemeSchema>;

/** Every Question is Standard or Expert (glossary: Difficulty). */
export const QUESTION_DIFFICULTIES = ['standard', 'expert'] as const;
export const QuestionDifficultySchema = z.enum(QUESTION_DIFFICULTIES);
export type QuestionDifficulty = z.infer<typeof QuestionDifficultySchema>;

export const QuestionFactSchema = z.object({
  label: LocalizedTextSchema,
  value: LocalizedTextSchema,
  detail: LocalizedTextSchema,
});

/** The Daily Question as served to clients. Includes the correct option (AD-4 exception). */
export const DailyQuestionSchema = z.object({
  slug: z.string().min(1),
  category: QuestionCategorySchema,
  theme: QuestionThemeSchema,
  eyebrow: LocalizedTextSchema,
  text: LocalizedTextSchema,
  options: z.array(LocalizedTextSchema).length(OPTIONS_PER_DAILY_QUESTION),
  correctIndex: z.number().int().min(0).max(OPTIONS_PER_DAILY_QUESTION - 1),
  answerTitle: LocalizedTextSchema,
  summary: LocalizedTextSchema,
  facts: z.array(QuestionFactSchema),
  /** A video to continue with; optional (Quiz Questions usually have none). */
  video: z.object({ title: LocalizedTextSchema, creator: z.string().min(1), url: z.url() }).optional(),
  source: z.object({ label: LocalizedTextSchema, url: z.url() }),
});
export type DailyQuestion = z.infer<typeof DailyQuestionSchema>;

export const DailyParamsSchema = z.object({ dailyDate: DailyDateSchema });

/** `GET /api/v1/daily/{dailyDate}` response body. */
export const DailyResponseSchema = z.object({
  dailyDate: DailyDateSchema,
  question: DailyQuestionSchema,
});
export type DailyResponse = z.infer<typeof DailyResponseSchema>;

export const DAILY_PROBLEM_CODES = {
  invalidDate: 'daily.invalidDate',
  notScheduled: 'daily.notScheduled',
  invalidAnswer: 'daily.invalidAnswer',
  /** `playedOn` is not "today" anywhere on Earth right now (AD-5). */
  invalidPlayedOn: 'daily.invalidPlayedOn',
  /** The Daily Date is after `playedOn` (a Daily cannot be answered before its date). */
  answerWindowClosed: 'daily.answerWindowClosed',
  /** The first answer is final (FR-8). */
  alreadyAnswered: 'daily.alreadyAnswered',
  invalidMerge: 'daily.invalidMerge',
} as const;

// ---------------------------------------------------------------------------------------------
// Signed-in Daily (Stories 1.5, 1.6): answers, Library history and the server Streak (AD-3, AD-6).

/** `{ current, best }` as computed by the shared `computeStreak`. */
export const StreakSchema = z.object({
  current: z.number().int().min(0),
  best: z.number().int().min(0),
});
export type Streak = z.infer<typeof StreakSchema>;

/** One answered Daily Date of a signed-in player. */
export const DailyPlaySchema = z.object({
  dailyDate: DailyDateSchema,
  questionSlug: z.string().min(1),
  selectedIndex: z.number().int().min(0).max(OPTIONS_PER_DAILY_QUESTION - 1),
  correct: z.boolean(),
  answeredAt: z.iso.datetime({ offset: true }),
  /** The player's local date when they answered (AD-5); later than `dailyDate` for late plays. */
  playedOn: DailyDateSchema,
});
export type DailyPlay = z.infer<typeof DailyPlaySchema>;

/** `POST /api/v1/daily/{dailyDate}/answer` body. */
export const DailyAnswerBodySchema = z.object({
  selectedIndex: z.number().int().min(0).max(OPTIONS_PER_DAILY_QUESTION - 1),
  /** The player's local date now (AD-5). */
  playedOn: DailyDateSchema,
});
export type DailyAnswerBody = z.infer<typeof DailyAnswerBodySchema>;

export const DailyAnswerResponseSchema = z.object({
  play: DailyPlaySchema,
  correctIndex: z.number().int().min(0).max(OPTIONS_PER_DAILY_QUESTION - 1),
  streak: StreakSchema,
});
export type DailyAnswerResponse = z.infer<typeof DailyAnswerResponseSchema>;

/** `GET /api/v1/daily/history?today=YYYY-MM-DD`: `today` is the player's local date (AD-5). */
export const DailyHistoryQuerySchema = z.object({ today: DailyDateSchema });

export const DailyHistoryResponseSchema = z.object({
  /** Every answered Daily Date, oldest first. Unlisted dates are "not played". */
  plays: z.array(DailyPlaySchema),
  streak: StreakSchema,
});
export type DailyHistoryResponse = z.infer<typeof DailyHistoryResponseSchema>;

/** Most plays one merge accepts (years of daily play). */
export const MAX_MERGE_PLAYS = 2000;

/**
 * `POST /api/v1/daily/merge` body: the browser's signed-out history, sent once on sign-in (FR-3, AD-4).
 * `correct` is used only when the server no longer knows the answered Question.
 */
export const DailyMergeBodySchema = z.object({
  today: DailyDateSchema,
  plays: z.array(DailyPlaySchema).max(MAX_MERGE_PLAYS),
});
export type DailyMergeBody = z.infer<typeof DailyMergeBodySchema>;

export const DailyMergeResponseSchema = DailyHistoryResponseSchema.extend({
  /** Daily Dates added or replaced by an earlier local answer. */
  merged: z.number().int().min(0),
  /** Local plays ignored because their dates are impossible (e.g. in the future). */
  skipped: z.number().int().min(0),
});
export type DailyMergeResponse = z.infer<typeof DailyMergeResponseSchema>;
