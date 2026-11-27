import { z } from 'zod';
import { LocalizedTextSchema } from './common';
import { AwardSummarySchema, QuizRecordSchema, UnlockedAwardSchema } from './progress';
import { OPTIONS_PER_DAILY_QUESTION, QuestionCategorySchema, QuestionDifficultySchema, QuestionFactSchema, QuestionThemeSchema } from './daily';

// ---------------------------------------------------------------------------------------------
// Quizzes page (Story 2.2, FR-13).

/** A player's best finished Solo Game in a Quiz. */
export const BestResultSchema = z.object({
  score: z.number().int().min(0),
  total: z.number().int().min(1),
});
export type BestResult = z.infer<typeof BestResultSchema>;

/** One published, listed Quiz as a card on the Quizzes page. */
export const QuizSummarySchema = z.object({
  slug: z.string().min(1),
  title: LocalizedTextSchema,
  description: LocalizedTextSchema,
  category: QuestionCategorySchema,
  theme: QuestionThemeSchema,
  /** Published Questions, in total and by Difficulty. */
  questionCount: z.number().int().min(1),
  standardCount: z.number().int().min(0),
  expertCount: z.number().int().min(0),
  /** The Badges and Titles this Quiz can award (FR-13). */
  awards: z.array(AwardSummarySchema),
  /** The signed-in player's best Solo Game; null when signed out or never finished. */
  best: BestResultSchema.nullable(),
  /** The signed-in player's Quiz Record; null when signed out or never played. */
  record: QuizRecordSchema.nullable(),
});
export type QuizSummary = z.infer<typeof QuizSummarySchema>;

/** `GET /api/v1/quizzes`: public; signed-in players also get their own results. */
export const QuizListResponseSchema = z.object({ quizzes: z.array(QuizSummarySchema) });
export type QuizListResponse = z.infer<typeof QuizListResponseSchema>;

// ---------------------------------------------------------------------------------------------
// Solo Games (Story 2.3, FR-14). Questions arrive without the correct option or story (AD-7).

/** Questions per Solo Game (fewer when a Quiz has fewer published Questions). */
export const SOLO_GAME_SIZE = 10;

/** A Question as a player sees it before answering: no correct option, story or facts (AD-7). */
export const SoloQuestionSchema = z
  .object({
    position: z.number().int().min(0),
    slug: z.string().min(1),
    difficulty: QuestionDifficultySchema,
    eyebrow: LocalizedTextSchema,
    text: LocalizedTextSchema,
    options: z.array(LocalizedTextSchema).length(OPTIONS_PER_DAILY_QUESTION),
  })
  .strict();
export type SoloQuestion = z.infer<typeof SoloQuestionSchema>;

/** `POST /api/v1/quizzes/{slug}/games` response (201). */
export const SoloGameResponseSchema = z.object({
  gameId: z.string().min(1),
  quiz: z.object({ slug: z.string().min(1), title: LocalizedTextSchema, category: QuestionCategorySchema, theme: QuestionThemeSchema }),
  questions: z.array(SoloQuestionSchema).min(1).max(SOLO_GAME_SIZE),
});
export type SoloGameResponse = z.infer<typeof SoloGameResponseSchema>;

/** `POST /api/v1/solo-games/{gameId}/answers` body: answers are given in order. */
export const SoloAnswerBodySchema = z.object({
  position: z.number().int().min(0).max(SOLO_GAME_SIZE - 1),
  selectedIndex: z.number().int().min(0).max(OPTIONS_PER_DAILY_QUESTION - 1),
});
export type SoloAnswerBody = z.infer<typeof SoloAnswerBodySchema>;

/** The finished game's result (FR-14). */
export const SoloResultSchema = z.object({
  score: z.number().int().min(0),
  total: z.number().int().min(1),
});
export type SoloResult = z.infer<typeof SoloResultSchema>;

/** The recorded answer, revealed only now: correctness, the correct option and the story. */
export const SoloAnswerResponseSchema = z.object({
  position: z.number().int().min(0),
  correct: z.boolean(),
  correctIndex: z.number().int().min(0).max(OPTIONS_PER_DAILY_QUESTION - 1),
  answerTitle: LocalizedTextSchema,
  summary: LocalizedTextSchema,
  facts: z.array(QuestionFactSchema),
  source: z.object({ label: LocalizedTextSchema, url: z.url() }),
  /** Correct answers so far. */
  score: z.number().int().min(0),
  /** Set once the last Question is answered. */
  result: SoloResultSchema.nullable(),
  /** The updated Quiz Record, with the last answer only. */
  record: QuizRecordSchema.nullable(),
  /** Badges and Titles newly earned by this game (last answer only), to celebrate (FR-16, FR-17). */
  unlocks: z.array(UnlockedAwardSchema),
});
export type SoloAnswerResponse = z.infer<typeof SoloAnswerResponseSchema>;

export const QUIZZES_PROBLEM_CODES = {
  notFound: 'quizzes.notFound',
  gameNotFound: 'quizzes.gameNotFound',
  /** The game was finished or abandoned (e.g. another game was started). */
  gameOver: 'quizzes.gameOver',
  alreadyAnswered: 'quizzes.alreadyAnswered',
  /** Answers must come in order: `position` must be the next unanswered Question. */
  wrongPosition: 'quizzes.wrongPosition',
  invalidAnswer: 'quizzes.invalidAnswer',
} as const;
