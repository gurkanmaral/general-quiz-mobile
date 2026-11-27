import { z } from 'zod';
import { LocalizedTextSchema } from './common';
import { OPTIONS_PER_DAILY_QUESTION, QuestionDifficultySchema } from './daily';
import { PlayerCardSchema } from './social';
import { UnlockedAwardSchema } from './progress';

// ---------------------------------------------------------------------------------------------
// Lobbies (Epic 5, FR-27–FR-34). One Socket.IO namespace; each Lobby is a server actor (AD-8).

export const LOBBY_NAMESPACE = '/lobby';
export const LOBBY_MAX_PLAYERS = 20;
export const LOBBY_QUESTION_COUNT = { min: 5, max: 20, default: 10 } as const;
export const LOBBY_TIME_LIMIT_S = { min: 10, max: 30, default: 20 } as const;

/** Short Lobby Code: six characters without look-alikes (no I, O, 0, 1). */
export const LOBBY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LobbyCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/));

export const LobbySettingsSchema = z.object({
  quizSlug: z.string().min(1),
  questionCount: z.number().int().min(LOBBY_QUESTION_COUNT.min).max(LOBBY_QUESTION_COUNT.max),
  timeLimitS: z.number().int().min(LOBBY_TIME_LIMIT_S.min).max(LOBBY_TIME_LIMIT_S.max),
});
export type LobbySettings = z.infer<typeof LobbySettingsSchema>;

/** `POST /api/v1/lobbies`: open a Lobby for a Quiz; the creator is Host (FR-27). */
export const CreateLobbyBodySchema = z.object({ quizSlug: z.string().min(1) });
export const CreateLobbyResponseSchema = z.object({ code: z.string() });
export type CreateLobbyResponse = z.infer<typeof CreateLobbyResponseSchema>;

/** `POST /api/v1/lobbies/{code}/invites`: invite a Friend (FR-29). */
export const LobbyInviteBodySchema = z.object({ userId: z.string().min(1) });

export const LobbyPlayerSchema = PlayerCardSchema.extend({
  /** False while the player's connection is lost (they can rejoin, FR-33). */
  connected: z.boolean(),
  /** Points in the current game. */
  score: z.number().int().min(0),
  /** Answered the current Question (never which option, until the reveal). */
  answered: z.boolean(),
});
export type LobbyPlayer = z.infer<typeof LobbyPlayerSchema>;

export const LOBBY_PHASES = ['waiting', 'question', 'reveal', 'podium'] as const;

/** Points for a correct answer `elapsedMs` after the Question appeared (FR-32): 1000 → 500 linearly. */
export function lobbyPoints(correct: boolean, elapsedMs: number, limitMs: number): number {
  if (!correct) return 0;
  const share = Math.min(Math.max(elapsedMs / limitMs, 0), 1);
  return Math.round(1000 - 500 * share);
}

/** A running Question as players see it: never the correct option (AD-7). */
export const LobbyQuestionSchema = z
  .object({
    index: z.number().int().min(0),
    total: z.number().int().min(1),
    difficulty: QuestionDifficultySchema,
    eyebrow: LocalizedTextSchema,
    text: LocalizedTextSchema,
    options: z.array(LocalizedTextSchema).length(OPTIONS_PER_DAILY_QUESTION),
    /** Server times (AD-8); clients count down against `deadline` shifted by their offset to `serverNow`. */
    startedAt: z.iso.datetime({ offset: true }),
    deadline: z.iso.datetime({ offset: true }),
    serverNow: z.iso.datetime({ offset: true }),
    limitMs: z.number().int().min(1),
    /** The receiving player's locked answer. */
    myAnswer: z.number().int().min(0).max(OPTIONS_PER_DAILY_QUESTION - 1).nullable(),
  })
  .strict();
export type LobbyQuestion = z.infer<typeof LobbyQuestionSchema>;

export const LobbyResultSchema = z.object({
  userId: z.string(),
  selectedIndex: z.number().int().nullable(),
  correct: z.boolean(),
  points: z.number().int().min(0),
});

/** After a Question ends: the answer, the story line and everyone's points (FR-31, FR-32). */
export const LobbyRevealSchema = z.object({
  index: z.number().int().min(0),
  total: z.number().int().min(1),
  /** Revealed with the answer, so players can report a wrong Question (Story 6.1). */
  questionSlug: z.string().min(1),
  difficulty: QuestionDifficultySchema,
  text: LocalizedTextSchema,
  options: z.array(LocalizedTextSchema).length(OPTIONS_PER_DAILY_QUESTION),
  correctIndex: z.number().int().min(0).max(OPTIONS_PER_DAILY_QUESTION - 1),
  answerTitle: LocalizedTextSchema,
  summary: LocalizedTextSchema,
  results: z.array(LobbyResultSchema),
  /** When the next Question (or the podium) comes. */
  nextAt: z.iso.datetime({ offset: true }),
  serverNow: z.iso.datetime({ offset: true }),
});
export type LobbyReveal = z.infer<typeof LobbyRevealSchema>;

export const LobbyStandingSchema = z.object({
  userId: z.string(),
  score: z.number().int().min(0),
  /** Correct answers in this game. */
  correct: z.number().int().min(0),
  /** Equal scores share a rank (1, 2, 2, 4). */
  rank: z.number().int().min(1),
});
export type LobbyStanding = z.infer<typeof LobbyStandingSchema>;

/** The end of a game (FR-34): full ranking with each player's newly earned Badges and Titles. */
export const LobbyPodiumSchema = z.object({
  ranking: z.array(
    LobbyStandingSchema.extend({
      player: PlayerCardSchema,
      /** Unlocked by this game through the Quiz Record (FR-16, FR-17). */
      unlocks: z.array(UnlockedAwardSchema),
    }),
  ),
});
export type LobbyPodium = z.infer<typeof LobbyPodiumSchema>;

/** `lobby:state`, sent to each player after every change: what that player may see. */
export const LobbyStateSchema = z.object({
  code: z.string(),
  hostId: z.string(),
  /** The receiving player's id. */
  me: z.string(),
  quiz: z.object({ slug: z.string(), title: LocalizedTextSchema }),
  settings: LobbySettingsSchema,
  /** In joining order: the first is the longest present. */
  players: z.array(LobbyPlayerSchema),
  phase: z.enum(LOBBY_PHASES),
  /** Set while a Question runs. */
  question: LobbyQuestionSchema.nullable(),
  /** Set between Questions. */
  reveal: LobbyRevealSchema.nullable(),
  /** Everyone in the game, best first (empty before the first game). */
  leaderboard: z.array(LobbyStandingSchema),
  /** Set once the last Question ended. */
  podium: LobbyPodiumSchema.nullable(),
});
export type LobbyState = z.infer<typeof LobbyStateSchema>;

/** Client → server commands; each is acknowledged with a `LobbyAck`. */
export const LOBBY_COMMANDS = {
  join: 'lobby:join',
  leave: 'lobby:leave',
  settings: 'lobby:settings',
  kick: 'lobby:kick',
  start: 'lobby:start',
  answer: 'lobby:answer',
  playAgain: 'lobby:playAgain',
} as const;
export const LobbyJoinSchema = z.object({ code: LobbyCodeSchema });
export const LobbySettingsUpdateSchema = LobbySettingsSchema.partial();
export type LobbySettingsUpdate = z.infer<typeof LobbySettingsUpdateSchema>;
export const LobbyKickSchema = z.object({ userId: z.string().min(1) });
/** The first answer to a Question locks (FR-31). */
export const LobbyAnswerSchema = z.object({
  index: z.number().int().min(0),
  selectedIndex: z.number().int().min(0).max(OPTIONS_PER_DAILY_QUESTION - 1),
});

/** Server → client events. */
export const LOBBY_EVENTS = {
  state: 'lobby:state',
  /** The player is no longer in the Lobby (removed by the Host, or the Lobby closed). */
  removed: 'lobby:removed',
} as const;
export const LobbyRemovedSchema = z.object({ reason: z.enum(['kicked', 'closed']) });
export type LobbyRemoved = z.infer<typeof LobbyRemovedSchema>;

export const LOBBY_PROBLEM_CODES = {
  invalid: 'lobby.invalid',
  notFound: 'lobby.notFound',
  quizNotFound: 'lobby.quizNotFound',
  full: 'lobby.full',
  inProgress: 'lobby.inProgress',
  notHost: 'lobby.notHost',
  notInLobby: 'lobby.notInLobby',
  kicked: 'lobby.kicked',
  profileIncomplete: 'lobby.profileIncomplete',
  wrongPhase: 'lobby.wrongPhase',
  unknownPlayer: 'lobby.unknownPlayer',
  alreadyAnswered: 'lobby.alreadyAnswered',
  tooLate: 'lobby.tooLate',
  noQuestions: 'lobby.noQuestions',
} as const;
export type LobbyProblemCode = (typeof LOBBY_PROBLEM_CODES)[keyof typeof LOBBY_PROBLEM_CODES];

export const LobbyAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), code: z.string() }),
]);
export type LobbyAck = z.infer<typeof LobbyAckSchema>;
