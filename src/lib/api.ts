import {
  AuthErrorSchema,
  AuthProvidersResponseSchema,
  DailyAnswerBodySchema,
  DailyAnswerResponseSchema,
  DailyHistoryResponseSchema,
  DailyMergeBodySchema,
  DailyMergeResponseSchema,
  DailyResponseSchema,
  DELETE_ACCOUNT_CONFIRMATION,
  DeleteAccountBodySchema,
  MeResponseSchema,
  ProblemSchema,
  ProfileUpdateSchema,
  QuizListResponseSchema,
  EquipTitleBodySchema,
  EquipTitleResponseSchema,
  ProfileResponseSchema,
  SoloAnswerBodySchema,
  SoloAnswerResponseSchema,
  SoloGameResponseSchema,
  SendVerificationCodeBodySchema,
  VerifyEmailCodeBodySchema,
  SignInEmailBodySchema,
  SignInSocialBodySchema,
  SignInSocialResponseSchema,
  SignUpEmailBodySchema,
  type AuthProvidersResponse,
  type DailyAnswerBody,
  type DailyAnswerResponse,
  type DailyHistoryResponse,
  type DailyMergeBody,
  type DailyMergeResponse,
  type DailyResponse,
  type MeResponse,
  type ProfileUpdate,
  type QuizListResponse,
  type EquipTitleResponse,
  type ProfileResponse,
  type SoloAnswerBody,
  type SoloAnswerResponse,
  type SoloGameResponse,
  type VerifyEmailCodeBody,
  type SignInEmailBody,
  type SignInSocialBody,
  type SignUpEmailBody,
  FriendsResponseSchema,
  LinkOwnerResponseSchema,
  SendFriendRequestBodySchema,
  SendFriendRequestResponseSchema,
  type FriendsResponse,
  type LinkOwnerResponse,
  type SendFriendRequestBody,
  type SendFriendRequestResponse,
  NotificationsResponseSchema,
  MarkReadResponseSchema,
  type NotificationsResponse,
  NudgeBodySchema,
  SocialSettingsSchema,
  type SocialSettings,
  CreateLobbyResponseSchema,
  type CreateLobbyResponse,
  ReportBodySchema,
  ReportResponseSchema,
  type ReportBody,
  type ReportResponse,
} from '@/contracts';
import { API_URL } from './config';
import { getToken, setToken } from './session';

/** The API lives on another origin; requests authenticate with the bearer token (AD-12). */
const API_BASE = `${API_URL}/api/v1`;

/** A slow API must not hold up the Daily: give up and keep the offline content (NFR-4). */
export const API_TIMEOUT_MS = 8_000;

export class ApiError extends Error {}

/** `GET /api/v1/daily/{dailyDate}`; throws on network errors, timeouts, non-2xx responses and bodies that break the contract. */
export async function fetchDaily(dailyDate: string, signal?: AbortSignal): Promise<DailyResponse> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, API_TIMEOUT_MS);
  signal?.addEventListener('abort', abort);
  try {
    const res = await fetch(`${API_BASE}/daily/${encodeURIComponent(dailyDate)}`, {
      signal: controller.signal,
      headers: authHeaders({ Accept: 'application/json' }),
    });
    if (!res.ok) throw new ApiError(`Daily request failed with ${res.status}`);
    const parsed = DailyResponseSchema.safeParse(await res.json());
    if (!parsed.success || parsed.data.dailyDate !== dailyDate) throw new ApiError('Daily response does not match the contract');
    return parsed.data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

// ---------------------------------------------------------------------------------------------
// Accounts (Stories 1.3, 1.4, 1.7). Better Auth lives at `/api/auth`. Native apps have no
// cookies: sign-in responses carry the session token in `set-auth-token` (bearer plugin).

const AUTH_BASE = `${API_URL}/api/auth`;

/** A problem+json (or Better Auth `{ code }`) error the UI can map to a message. */
export class ApiProblemError extends ApiError {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    readonly detail?: string,
  ) {
    super(`Request failed with ${status}${code ? ` (${code})` : ''}`);
  }
}

function authHeaders(headers: Record<string, string>): Record<string, string> {
  const token = getToken();
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

async function request(path: string, init: RequestInit = {}, timeoutMs = API_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(path, { ...init, headers: authHeaders({ ...headers, ...(init.headers as Record<string, string>) }), signal: controller.signal });
    // Signing in (or confirming the email code) starts a session: keep its token.
    const issued = res.headers.get('set-auth-token');
    if (issued) await setToken(issued);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function failure(res: Response): Promise<ApiProblemError> {
  const body = await res.json().catch(() => undefined);
  const problem = ProblemSchema.safeParse(body);
  if (problem.success) return new ApiProblemError(res.status, problem.data.code, problem.data.detail);
  const auth = AuthErrorSchema.safeParse(body);
  return new ApiProblemError(res.status, auth.success ? auth.data.code : undefined, auth.success ? auth.data.message : undefined);
}

async function json<T>(res: Response, schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }): Promise<T> {
  if (!res.ok) throw await failure(res);
  const parsed = schema.safeParse(await res.json().catch(() => undefined));
  if (!parsed.success) throw new ApiError('Response does not match the contract');
  return parsed.data;
}

/** `GET /api/v1/me`: the signed-in player, or null when signed out. Throws when the API is unreachable. */
export async function fetchMe(): Promise<MeResponse | null> {
  if (!getToken()) return null;
  const res = await request(`${API_BASE}/me`);
  if (res.status === 401) {
    // Expired or revoked session: forget the token.
    await setToken(null);
    return null;
  }
  return json(res, MeResponseSchema);
}

export async function fetchAuthProviders(): Promise<AuthProvidersResponse> {
  return json(await request(`${API_BASE}/auth/providers`), AuthProvidersResponseSchema);
}

export async function updateProfile(body: ProfileUpdate): Promise<MeResponse> {
  return json(await request(`${API_BASE}/me/profile`, { method: 'PUT', body: JSON.stringify(ProfileUpdateSchema.parse(body)) }), MeResponseSchema);
}

/** Better Auth answers `{ ... }` on success; only the status matters here. */
async function authPost(path: string, body: unknown): Promise<unknown> {
  const res = await request(`${AUTH_BASE}${path}`, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw await failure(res);
  return res.json().catch(() => ({}));
}

export async function signUpWithEmail(body: SignUpEmailBody): Promise<void> {
  await authPost('/sign-up/email', SignUpEmailBodySchema.parse(body));
}

export async function signInWithEmail(body: SignInEmailBody): Promise<void> {
  await authPost('/sign-in/email', SignInEmailBodySchema.parse(body));
}

/** Sends a new email-confirmation code. */
export async function sendVerificationCode(email: string): Promise<void> {
  await authPost('/email-otp/send-verification-otp', SendVerificationCodeBodySchema.parse({ email, type: 'email-verification' }));
}

/** Confirms the email with its 6-digit code; the server signs the player in. */
export async function verifyEmailCode(body: VerifyEmailCodeBody): Promise<void> {
  await authPost('/email-otp/verify-email', VerifyEmailCodeBodySchema.parse(body));
}

/** Starts Google sign-in; resolves to the Google URL the browser must open. */
export async function startGoogleSignIn(body: SignInSocialBody): Promise<string> {
  const parsed = SignInSocialResponseSchema.safeParse(await authPost('/sign-in/social', SignInSocialBodySchema.parse(body)));
  if (!parsed.success) throw new ApiError('Google sign-in did not return a URL');
  return parsed.data.url;
}

export async function signOut(): Promise<void> {
  try {
    await authPost('/sign-out', {});
  } finally {
    await setToken(null);
  }
}

// ---------------------------------------------------------------------------------------------
// Signed-in Daily (Story 1.5): the server stores answers and computes the Streak (AD-3).

export async function fetchDailyHistory(today: string): Promise<DailyHistoryResponse> {
  return json(await request(`${API_BASE}/daily/history?today=${encodeURIComponent(today)}`), DailyHistoryResponseSchema);
}

export async function postDailyAnswer(dailyDate: string, body: DailyAnswerBody): Promise<DailyAnswerResponse> {
  const res = await request(`${API_BASE}/daily/${encodeURIComponent(dailyDate)}/answer`, {
    method: 'POST',
    body: JSON.stringify(DailyAnswerBodySchema.parse(body)),
  });
  return json(res, DailyAnswerResponseSchema);
}

/** `POST /api/v1/daily/merge`: the signed-out history, sent once after sign-in (Story 1.6). */
export async function mergeDailyHistory(body: DailyMergeBody): Promise<DailyMergeResponse> {
  return json(await request(`${API_BASE}/daily/merge`, { method: 'POST', body: JSON.stringify(DailyMergeBodySchema.parse(body)) }), DailyMergeResponseSchema);
}

/** `DELETE /api/v1/me` (Story 1.7): deletes the account and every row the player owns. */
export async function deleteAccount(): Promise<void> {
  const res = await request(`${API_BASE}/me`, { method: 'DELETE', body: JSON.stringify(DeleteAccountBodySchema.parse({ confirm: DELETE_ACCOUNT_CONFIRMATION })) });
  if (!res.ok) throw await failure(res);
  await setToken(null);
}

// ---------------------------------------------------------------------------------------------
// Quizzes (Epic 2). Public list; signed-in players also get their own results.

export async function fetchQuizzes(): Promise<QuizListResponse> {
  return json(await request(`${API_BASE}/quizzes`), QuizListResponseSchema);
}

/** `POST /api/v1/quizzes/{slug}/games`: a new Solo Game; Questions come without answers (AD-7). */
export async function startSoloGame(slug: string): Promise<SoloGameResponse> {
  return json(await request(`${API_BASE}/quizzes/${encodeURIComponent(slug)}/games`, { method: 'POST' }), SoloGameResponseSchema);
}

/** `POST /api/v1/solo-games/{gameId}/answers`: records an answer and reveals the correct option and story. */
export async function answerSoloGame(gameId: string, body: SoloAnswerBody): Promise<SoloAnswerResponse> {
  const res = await request(`${API_BASE}/solo-games/${encodeURIComponent(gameId)}/answers`, {
    method: 'POST',
    body: JSON.stringify(SoloAnswerBodySchema.parse(body)),
  });
  return json(res, SoloAnswerResponseSchema);
}

// ---------------------------------------------------------------------------------------------
// Profile (Story 3.3). `today` is the player's local date (AD-5), for the Streak.

export async function fetchProfile(today: string): Promise<ProfileResponse> {
  return json(await request(`${API_BASE}/profile?today=${encodeURIComponent(today)}`), ProfileResponseSchema);
}

/** Equips an earned Title, or none with null (FR-18). */
export async function equipTitle(title: string | null): Promise<EquipTitleResponse> {
  const res = await request(`${API_BASE}/profile/title`, { method: 'PUT', body: JSON.stringify(EquipTitleBodySchema.parse({ title })) });
  return json(res, EquipTitleResponseSchema);
}

// ---------------------------------------------------------------------------------------------
// Friends (Story 4.1).

async function noContent(res: Response): Promise<void> {
  if (!res.ok) throw await failure(res);
}

/** `today` is the player's local date (AD-5): Friends' Daily status is for that day (FR-23). */
export async function fetchFriends(today: string): Promise<FriendsResponse> {
  return json(await request(`${API_BASE}/friends?today=${encodeURIComponent(today)}`), FriendsResponseSchema);
}

export async function sendFriendRequest(body: SendFriendRequestBody): Promise<SendFriendRequestResponse> {
  const res = await request(`${API_BASE}/friends/requests`, { method: 'POST', body: JSON.stringify(SendFriendRequestBodySchema.parse(body)) });
  return json(res, SendFriendRequestResponseSchema);
}

export async function acceptFriendRequest(id: string): Promise<void> {
  await noContent(await request(`${API_BASE}/friends/requests/${encodeURIComponent(id)}/accept`, { method: 'POST' }));
}

/** Declines an incoming or withdraws an outgoing request. */
export async function dismissFriendRequest(id: string): Promise<void> {
  await noContent(await request(`${API_BASE}/friends/requests/${encodeURIComponent(id)}`, { method: 'DELETE' }));
}

export async function removeFriend(userId: string): Promise<void> {
  await noContent(await request(`${API_BASE}/friends/${encodeURIComponent(userId)}`, { method: 'DELETE' }));
}

/** Who a friend link or Nudge Link belongs to (public). */
export async function fetchLinkOwner(token: string): Promise<LinkOwnerResponse> {
  return json(await request(`${API_BASE}/links/${encodeURIComponent(token)}`), LinkOwnerResponseSchema);
}

// ---------------------------------------------------------------------------------------------
// Notifications (Story 4.2). Live updates come over Socket.IO (`realtime.ts`).

export async function fetchNotifications(): Promise<NotificationsResponse> {
  return json(await request(`${API_BASE}/notifications`), NotificationsResponseSchema);
}

export async function markNotificationsRead(): Promise<void> {
  await json(await request(`${API_BASE}/notifications/read`, { method: 'POST' }), MarkReadResponseSchema);
}

// ---------------------------------------------------------------------------------------------
// Nudges (Story 4.4).

/** Nudges a Friend for the player's local `dailyDate` (AD-5). */
export async function nudgeFriend(userId: string, dailyDate: string): Promise<void> {
  const res = await request(`${API_BASE}/friends/${encodeURIComponent(userId)}/nudge`, { method: 'POST', body: JSON.stringify(NudgeBodySchema.parse({ dailyDate })) });
  await noContent(res);
}

export async function fetchSocialSettings(): Promise<SocialSettings> {
  return json(await request(`${API_BASE}/social/settings`), SocialSettingsSchema);
}

export async function updateSocialSettings(body: SocialSettings): Promise<SocialSettings> {
  return json(await request(`${API_BASE}/social/settings`, { method: 'PUT', body: JSON.stringify(SocialSettingsSchema.parse(body)) }), SocialSettingsSchema);
}

// ---------------------------------------------------------------------------------------------
// Lobbies (Epic 5). Play runs over the `/lobby` socket; REST creates Lobbies and sends invites.

export async function createLobby(quizSlug: string): Promise<CreateLobbyResponse> {
  return json(await request(`${API_BASE}/lobbies`, { method: 'POST', body: JSON.stringify({ quizSlug }) }), CreateLobbyResponseSchema);
}

export async function inviteToLobby(code: string, userId: string): Promise<void> {
  await noContent(await request(`${API_BASE}/lobbies/${encodeURIComponent(code)}/invites`, { method: 'POST', body: JSON.stringify({ userId }) }));
}

// ---------------------------------------------------------------------------------------------
// Reports (Story 6.1).

/** Reports a revealed Question as wrong; signed-in only and rate-limited (`rateLimited`). */
export async function reportQuestion(body: ReportBody): Promise<ReportResponse> {
  return json(await request(`${API_BASE}/reports`, { method: 'POST', body: JSON.stringify(ReportBodySchema.parse(body)) }), ReportResponseSchema);
}
