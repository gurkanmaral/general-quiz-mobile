import { z } from 'zod';
import { LocalizedTextSchema } from './common';
import { AvatarIdSchema, EquippedTitleSchema, UsernameSchema } from './accounts';

// ---------------------------------------------------------------------------------------------
// Friends (Story 4.1, FR-21, FR-22): mutual friendships from accepted Friend Requests.

/** What other players see of someone: never the email (Username, avatar, equipped Title). */
export const PlayerCardSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  avatar: AvatarIdSchema.nullable(),
  title: EquippedTitleSchema.nullable(),
});
export type PlayerCard = z.infer<typeof PlayerCardSchema>;

/** A pending Friend Request, incoming (from `player`) or outgoing (to `player`). */
export const FriendRequestSchema = z.object({
  id: z.string().min(1),
  player: PlayerCardSchema,
  createdAt: z.iso.datetime({ offset: true }),
});
export type FriendRequest = z.infer<typeof FriendRequestSchema>;

/**
 * A Friend on the Friends list (FR-23): Streak and whether they played the viewer's today's Daily
 * — never their answer.
 */
export const FriendSchema = PlayerCardSchema.extend({
  streak: z.number().int().min(0),
  playedToday: z.boolean(),
  /** The viewer already nudged this Friend for today (FR-24: once per Daily Date). */
  nudged: z.boolean(),
  /** Nudge is offered: not played today, not nudged yet, and the Friend receives Nudges. */
  canNudge: z.boolean(),
});
export type Friend = z.infer<typeof FriendSchema>;

/** `GET /api/v1/friends`: Friends, pending requests both ways, and the player's own friend-link token. */
export const FriendsResponseSchema = z.object({
  friends: z.array(FriendSchema),
  incoming: z.array(FriendRequestSchema),
  outgoing: z.array(FriendRequestSchema),
  /** Opens `/f/<linkToken>`; whoever opens it is offered a Friend Request to this player. */
  linkToken: z.string().min(1),
});
export type FriendsResponse = z.infer<typeof FriendsResponseSchema>;

/** `GET /api/v1/friends?today=YYYY-MM-DD`: the viewer's local date (AD-5). */
export const FriendsQuerySchema = z.object({ today: z.string() });

/** A personal link token (friend link `/f/<token>`, Nudge Link `/n/<token>`). */
export const LinkTokenSchema = z.string().regex(/^[A-Za-z0-9]{8,32}$/);

/** `POST /api/v1/friends/requests`: by Username or by the token of a friend link. */
export const SendFriendRequestBodySchema = z.union([
  z.object({ username: UsernameSchema }).strict(),
  z.object({ token: LinkTokenSchema }).strict(),
]);
export type SendFriendRequestBody = z.infer<typeof SendFriendRequestBodySchema>;

/**
 * `requested`: a request is pending with `player`. `friends`: `player` had already asked you, so
 * your request accepted theirs (FR-21: still mutual consent).
 */
export const SendFriendRequestResponseSchema = z.object({
  status: z.enum(['requested', 'friends']),
  player: PlayerCardSchema,
});
export type SendFriendRequestResponse = z.infer<typeof SendFriendRequestResponseSchema>;

/** `GET /api/v1/links/{token}` (public): who owns a friend link or Nudge Link. */
export const LinkOwnerResponseSchema = z.object({
  player: z.object({ username: z.string().min(1), avatar: AvatarIdSchema.nullable() }),
  /** For a signed-in opener: already Friends (or the link is their own), so no Friend Request is offered. */
  connected: z.boolean(),
});
export type LinkOwnerResponse = z.infer<typeof LinkOwnerResponseSchema>;

export const SOCIAL_PROBLEM_CODES = {
  invalidRequest: 'social.invalidRequest',
  playerNotFound: 'social.playerNotFound',
  /** You cannot befriend yourself. */
  self: 'social.self',
  alreadyFriends: 'social.alreadyFriends',
  requestNotFound: 'social.requestNotFound',
  /** Finish the Username/avatar step before adding Friends. */
  profileIncomplete: 'social.profileIncomplete',
  linkNotFound: 'social.linkNotFound',
  invalidToday: 'social.invalidToday',
  notFriend: 'social.notFriend',
  alreadyPlayed: 'social.alreadyPlayed',
  alreadyNudged: 'social.alreadyNudged',
  nudgesOff: 'social.nudgesOff',
  invalidSettings: 'social.invalidSettings',
} as const;

// ---------------------------------------------------------------------------------------------
// Notifications (Story 4.2, FR-26): stored in `social`, pushed live over Socket.IO `/notifications`.

/** Who caused a notification. */
export const NotificationActorSchema = z.object({ username: z.string().min(1), avatar: AvatarIdSchema.nullable() });

const notificationBase = {
  id: z.string().min(1),
  actor: NotificationActorSchema,
  createdAt: z.iso.datetime({ offset: true }),
  read: z.boolean(),
};

export const NotificationSchema = z.discriminatedUnion('kind', [
  /** Opens the Friends view. */
  z.object({ ...notificationBase, kind: z.literal('friendRequest') }),
  /** Opens today's Daily (Story 4.4). `streak` is the recipient's Streak when nudged. */
  z.object({ ...notificationBase, kind: z.literal('nudge'), dailyDate: z.string(), streak: z.number().int().min(0) }),
  /** Opens the Lobby (Story 5.1). */
  z.object({ ...notificationBase, kind: z.literal('lobbyInvite'), code: z.string().min(1), quizTitle: LocalizedTextSchema }),
]);
export type Notification = z.infer<typeof NotificationSchema>;
export type NotificationKind = Notification['kind'];

/** `GET /api/v1/notifications`: newest first, with the unread count. */
export const NotificationsResponseSchema = z.object({
  notifications: z.array(NotificationSchema),
  unread: z.number().int().min(0),
});
export type NotificationsResponse = z.infer<typeof NotificationsResponseSchema>;

/** `POST /api/v1/notifications/read`: marks every notification read. */
export const MarkReadResponseSchema = z.object({ unread: z.literal(0) });

/** Socket.IO namespace and events for live notifications (AD-13). */
export const NOTIFICATIONS_NAMESPACE = '/notifications';
/** Server → client: a new notification and the new unread count. */
export const NOTIFICATION_EVENT = 'notification';
export const NotificationEventSchema = z.object({ notification: NotificationSchema, unread: z.number().int().min(0) });
export type NotificationEvent = z.infer<typeof NotificationEventSchema>;
/** Server → client: the unread count changed (e.g. read on another device). */
export const UNREAD_EVENT = 'unread';
export const UnreadEventSchema = z.object({ unread: z.number().int().min(0) });
/** The Socket.IO path on the API origin (proxied with `/api`). */
export const SOCKET_PATH = '/api/socket.io';

// ---------------------------------------------------------------------------------------------
// Nudges (Story 4.4, FR-24, FR-25).

/** `POST /api/v1/friends/{userId}/nudge`: the sender's local Daily Date (AD-5). */
export const NudgeBodySchema = z.object({ dailyDate: z.string() });
export type NudgeBody = z.infer<typeof NudgeBodySchema>;

/** `GET|PUT /api/v1/social/settings`: whether the player receives Nudges. */
export const SocialSettingsSchema = z.object({ receiveNudges: z.boolean() });
export type SocialSettings = z.infer<typeof SocialSettingsSchema>;
