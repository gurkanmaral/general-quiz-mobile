import { z } from 'zod';
import { LocalizedTextSchema } from './common';

/** The KNO. avatar set a player picks from (rendered by the client). */
export const AVATAR_IDS = ['owl', 'scout', 'fox', 'robot', 'cat', 'octopus', 'rocket', 'cactus'] as const;
export const AvatarIdSchema = z.enum(AVATAR_IDS);
export type AvatarId = z.infer<typeof AvatarIdSchema>;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
/** Letters, digits and underscores; stored lower-cased, so uniqueness is case-insensitive. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;

export const UsernameSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN_LENGTH, { message: `At least ${USERNAME_MIN_LENGTH} characters` })
  .max(USERNAME_MAX_LENGTH, { message: `At most ${USERNAME_MAX_LENGTH} characters` })
  .regex(USERNAME_PATTERN, { message: 'Use letters, numbers and _ only' });

/** `PUT /api/v1/me/profile` body: the Username/avatar step after the first sign-in. */
export const ProfileUpdateSchema = z.object({
  username: UsernameSchema,
  avatar: AvatarIdSchema,
});
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;

/** The Title shown next to a player's name ("Mert · Gandalf", FR-18). */
export const EquippedTitleSchema = z.object({
  slug: z.string().min(1),
  name: LocalizedTextSchema,
  icon: z.string().min(1),
});
export type EquippedTitle = z.infer<typeof EquippedTitleSchema>;

/** `GET /api/v1/me` and `PUT /api/v1/me/profile` response: the signed-in player. */
export const MeResponseSchema = z.object({
  id: z.string().min(1),
  email: z.string(),
  /** As the player typed it (case kept); null until the profile step is done. */
  username: z.string().nullable(),
  avatar: AvatarIdSchema.nullable(),
  /** True once a Username and an avatar are chosen. */
  profileComplete: z.boolean(),
  /** The equipped Title shown next to the name (FR-18); absent or null when none. */
  title: EquippedTitleSchema.nullable().optional(),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

/** `GET /api/v1/auth/providers`: which optional sign-in providers the server offers. */
export const AuthProvidersResponseSchema = z.object({ google: z.boolean() });
export type AuthProvidersResponse = z.infer<typeof AuthProvidersResponseSchema>;

/**
 * Bodies the web sends to Better Auth at `/api/auth/*` (AD-12). Better Auth owns these endpoints;
 * the schemas pin the subset KNO. uses so the client and server agree.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const AuthEmailSchema = z.string().trim().pipe(z.email());
export const AuthPasswordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

export const SignUpEmailBodySchema = z.object({
  name: z.string(),
  email: AuthEmailSchema,
  password: AuthPasswordSchema,
  /** Same-origin path the verification link returns to (FR-5). */
  callbackURL: z.string().startsWith('/'),
});
export type SignUpEmailBody = z.infer<typeof SignUpEmailBodySchema>;

export const SignInEmailBodySchema = z.object({
  email: AuthEmailSchema,
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
  callbackURL: z.string().startsWith('/').optional(),
});
export type SignInEmailBody = z.infer<typeof SignInEmailBodySchema>;

export const EMAIL_CODE_LENGTH = 6;
export const EmailCodeSchema = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.');

/** Asks for a new email-confirmation code. */
export const SendVerificationCodeBodySchema = z.object({
  email: AuthEmailSchema,
  type: z.literal('email-verification'),
});
export type SendVerificationCodeBody = z.infer<typeof SendVerificationCodeBodySchema>;

/** Confirms the email with the code; signs the player in. */
export const VerifyEmailCodeBodySchema = z.object({
  email: AuthEmailSchema,
  otp: EmailCodeSchema,
});
export type VerifyEmailCodeBody = z.infer<typeof VerifyEmailCodeBodySchema>;

export const SignInSocialBodySchema = z.object({
  provider: z.literal('google'),
  callbackURL: z.string().startsWith('/'),
  newUserCallbackURL: z.string().startsWith('/').optional(),
  errorCallbackURL: z.string().startsWith('/').optional(),
});
export type SignInSocialBody = z.infer<typeof SignInSocialBodySchema>;

/** Better Auth's `{ url, redirect }` answer to a social sign-in start. */
export const SignInSocialResponseSchema = z.object({ url: z.url(), redirect: z.boolean() });

/** Better Auth error body: `{ code, message }` (e.g. `EMAIL_NOT_VERIFIED`, `INVALID_EMAIL_OR_PASSWORD`). */
export const AuthErrorSchema = z.object({ code: z.string().optional(), message: z.string().optional() });

/** `DELETE /api/v1/me` body: an explicit confirmation so the call cannot happen by accident (FR-4). */
export const DELETE_ACCOUNT_CONFIRMATION = 'DELETE';
export const DeleteAccountBodySchema = z.object({ confirm: z.literal(DELETE_ACCOUNT_CONFIRMATION) });
export type DeleteAccountBody = z.infer<typeof DeleteAccountBodySchema>;

export const ACCOUNTS_PROBLEM_CODES = {
  unauthorized: 'accounts.unauthorized',
  invalidProfile: 'accounts.invalidProfile',
  usernameTaken: 'accounts.usernameTaken',
  usernameNotAllowed: 'accounts.usernameNotAllowed',
  confirmationRequired: 'accounts.confirmationRequired',
} as const;
