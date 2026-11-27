import { z } from 'zod';
import { LocalizedTextSchema } from './common';
import { AvatarIdSchema, EquippedTitleSchema } from './accounts';
import { QuestionDifficultySchema, StreakSchema } from './daily';

// ---------------------------------------------------------------------------------------------
// Quiz Record (Story 2.4, FR-15): computed and stored by the server only (AD-3).

/** A player's progress in one Quiz across all games. Counts cover currently published Questions. */
export const QuizRecordSchema = z.object({
  /** Finished games plus abandoned games with at least one answer. */
  gamesPlayed: z.number().int().min(0),
  gamesWon: z.number().int().min(0),
  /** Distinct Questions ever answered correctly, by Difficulty. */
  correctStandard: z.number().int().min(0),
  correctExpert: z.number().int().min(0),
  /** Share of the Quiz's published Questions ever answered correctly, 0–1. */
  correctShare: z.number().min(0).max(1),
});
export type QuizRecord = z.infer<typeof QuizRecordSchema>;

// ---------------------------------------------------------------------------------------------
// Badges and Titles (Story 3.1, FR-16, FR-17): declarative Unlock Rules from a closed set (AD-10).

/** The only Unlock Rule types. New types are added to the evaluator in `progress`, never to content code. */
export const UNLOCK_RULE_TYPES = ['correctShare', 'allCorrect', 'gamesWon'] as const;

export const UnlockRuleSchema = z.discriminatedUnion('type', [
  /** At least `min` (0–1) of the Quiz's published Questions (of `difficulty`, if set) ever answered correctly. */
  z.object({ type: z.literal('correctShare'), min: z.number().gt(0).max(1), difficulty: QuestionDifficultySchema.optional() }).strict(),
  /** Every published Question of `difficulty` answered correctly at least once. */
  z.object({ type: z.literal('allCorrect'), difficulty: QuestionDifficultySchema }).strict(),
  /** At least `min` games of the Quiz won. */
  z.object({ type: z.literal('gamesWon'), min: z.number().int().min(1) }).strict(),
]);
export type UnlockRule = z.infer<typeof UnlockRuleSchema>;

export const AWARD_KINDS = ['badge', 'title'] as const;
export const AwardKindSchema = z.enum(AWARD_KINDS);
export type AwardKind = z.infer<typeof AwardKindSchema>;

/** A Badge or Title as a Quiz card lists it ("🏅 Middle-earth Fan · 🎭 Gandalf"). */
export const AwardSummarySchema = z.object({
  slug: z.string().min(1),
  kind: AwardKindSchema,
  name: LocalizedTextSchema,
  icon: z.string().min(1),
});
export type AwardSummary = z.infer<typeof AwardSummarySchema>;

// ---------------------------------------------------------------------------------------------
// Rarity (Story 3.2, FR-19): the share of Ranked Accounts holding an item, precomputed daily (AD-11).

/** Below this share an item shows "<1%" rather than a rounded 0%. */
export const RARITY_FLOOR_PERCENT = 1;

export const RaritySchema = z.object({
  /** 0–100, or null before the first computation. */
  percent: z.number().min(0).max(100).nullable(),
  /** Display text: "12%", "<1%", or "New" when not computed yet. */
  label: z.string().min(1),
});
export type Rarity = z.infer<typeof RaritySchema>;

export function rarityLabel(percent: number | null): string {
  if (percent === null) return 'New';
  if (percent < RARITY_FLOOR_PERCENT) return '<1%';
  return `${Math.round(percent)}%`;
}

export function toRarity(percent: number | null): Rarity {
  return { percent, label: rarityLabel(percent) };
}

/** A Badge or Title the player just earned, celebrated on the result screen with its Rarity. */
export const UnlockedAwardSchema = AwardSummarySchema.extend({
  quizSlug: z.string().min(1),
  description: LocalizedTextSchema,
  rarity: RaritySchema,
});
export type UnlockedAward = z.infer<typeof UnlockedAwardSchema>;

// ---------------------------------------------------------------------------------------------
// Profile and equipped Title (Story 3.3, FR-18, FR-20).

/** A Badge or Title on a Profile: earned in colour, unearned greyed with how to earn it (own Profile only). */
export const ProfileAwardSchema = AwardSummarySchema.extend({
  quizSlug: z.string().min(1),
  description: LocalizedTextSchema,
  rarity: RaritySchema,
  earned: z.boolean(),
  earnedAt: z.iso.datetime({ offset: true }).nullable(),
  /** Set for unearned items on one's own Profile. */
  howToEarn: z.string().nullable(),
});
export type ProfileAward = z.infer<typeof ProfileAwardSchema>;

export const ProfileQuizSchema = z.object({
  slug: z.string().min(1),
  title: LocalizedTextSchema,
  awards: z.array(ProfileAwardSchema),
});
export type ProfileQuiz = z.infer<typeof ProfileQuizSchema>;

/** `GET /api/v1/profile?today=` (own) and `GET /api/v1/players/{username}?today=` (others). */
export const ProfileResponseSchema = z.object({
  username: z.string().min(1),
  avatar: AvatarIdSchema.nullable(),
  title: EquippedTitleSchema.nullable(),
  streak: StreakSchema,
  /** True on one's own Profile: unearned items are included, Titles can be equipped. */
  own: z.boolean(),
  quizzes: z.array(ProfileQuizSchema),
});
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;

export const ProfileQuerySchema = z.object({ today: z.string() });

/** `PUT /api/v1/profile/title`: equip an earned Title, or none with `null` (FR-18). */
export const EquipTitleBodySchema = z.object({ title: z.string().min(1).nullable() });
export type EquipTitleBody = z.infer<typeof EquipTitleBodySchema>;

export const EquipTitleResponseSchema = z.object({ title: EquippedTitleSchema.nullable() });
export type EquipTitleResponse = z.infer<typeof EquipTitleResponseSchema>;

export const PROGRESS_PROBLEM_CODES = {
  invalidToday: 'progress.invalidToday',
  invalidTitle: 'progress.invalidTitle',
  /** The Title is unknown, a Badge, or not earned by the player. */
  titleNotEarned: 'progress.titleNotEarned',
  playerNotFound: 'progress.playerNotFound',
  /** Profiles are visible only to Friends and Lobby co-players (FR-20). */
  profileForbidden: 'progress.profileForbidden',
} as const;
