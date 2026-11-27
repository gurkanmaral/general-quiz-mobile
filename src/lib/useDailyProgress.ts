import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DailyPlaySchema, MAX_MERGE_PLAYS, type DailyHistoryResponse, type DailyPlay as ServerPlay, type Streak } from '@/contracts';
import { computeStreak } from '@/shared';
import { ApiProblemError, fetchDailyHistory, mergeDailyHistory, postDailyAnswer } from './api';
import { readHistory, streakPlays, writeHistory, type DailyHistory, type DailyPlay } from './dailyHistory';
import { localDateKey } from './knowledge';

export type RecordOutcome = 'saved' | 'failed';

export type DailyProgress = {
  /** `local`: signed out, history in localStorage (AD-4). `server`: signed in, the API owns it (AD-3). */
  mode: 'local' | 'server';
  /** False while a signed-in player's history is loading or could not be loaded. */
  ready: boolean;
  history: DailyHistory;
  streak: Streak;
  /** A message when the signed-in history or the last answer could not reach the server. */
  error: string | null;
  /** Whether an unanswered Daily Date may be answered now. */
  canAnswer: (dailyDate: string) => boolean;
  /** Signed out it records synchronously; signed in it resolves once the server has answered. */
  record: (dailyDate: string, questionId: string, selectedIndex: number, correctIndex: number) => RecordOutcome | Promise<RecordOutcome>;
  reload: () => void;
};

const EMPTY: DailyHistory = { version: 2, plays: {} };
const LOAD_FAILED = "Couldn't load your Library. Check your connection and try again.";
const SAVE_FAILED = "Couldn't save your answer. Check your connection and try again.";

function fromServer(play: ServerPlay): DailyPlay {
  return {
    questionId: play.questionSlug,
    selectedIndex: play.selectedIndex,
    correct: play.correct,
    answeredAt: play.answeredAt,
    playedOn: play.playedOn,
  };
}

function toHistory(plays: readonly ServerPlay[]): DailyHistory {
  return { version: 2, plays: Object.fromEntries(plays.map((play) => [play.dailyDate, fromServer(play)])) };
}

/** Local plays in the merge contract's shape; unusable entries are dropped. */
export function toMergePlays(history: DailyHistory): ServerPlay[] {
  const plays: ServerPlay[] = [];
  for (const [dailyDate, play] of Object.entries(history.plays)) {
    const answeredAt = new Date(play.answeredAt);
    if (Number.isNaN(answeredAt.getTime())) continue;
    const parsed = DailyPlaySchema.safeParse({
      dailyDate,
      questionSlug: play.questionId,
      selectedIndex: play.selectedIndex,
      correct: play.correct,
      answeredAt: answeredAt.toISOString(),
      playedOn: play.playedOn,
    });
    if (parsed.success) plays.push(parsed.data);
  }
  return plays.sort((a, b) => a.dailyDate.localeCompare(b.dailyDate)).slice(-MAX_MERGE_PLAYS);
}

/** One merge per user at a time (React StrictMode runs effects twice in development). */
const merging = new Map<string, Promise<DailyHistoryResponse>>();

/**
 * Signed-in history. If this device has signed-out plays, they are merged first (FR-3, AD-4):
 * on success the local history is cleared; on failure it is kept and the merge retries on the
 * next load, while the server history is shown meanwhile.
 */
function loadServerHistory(userId: string, today: string, onMerged: () => void): Promise<DailyHistoryResponse> {
  const plays = toMergePlays(readHistory());
  if (plays.length === 0) return fetchDailyHistory(today);
  const pending = merging.get(userId);
  if (pending) return pending;
  const merge = mergeDailyHistory({ today, plays })
    .then(
      (response) => {
        writeHistory(EMPTY);
        onMerged();
        return response as DailyHistoryResponse;
      },
      () => fetchDailyHistory(today),
    )
    .finally(() => merging.delete(userId));
  merging.set(userId, merge);
  return merge;
}

/**
 * The player's Daily answers, Library and Streak. Signed out it is the local history with the
 * shared `computeStreak`; signed in the server stores answers and returns the Streak (Story 1.5).
 */
export function useDailyProgress({ userId, today }: { userId: string | null; today: string }): DailyProgress {
  const [local, setLocal] = useState<DailyHistory>(readHistory);
  const [server, setServer] = useState<{ userId: string; history: DailyHistory; streak: Streak } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const latestUser = useRef(userId);
  latestUser.current = userId;

  useEffect(() => {
    if (!userId) {
      setServer(null);
      setError(null);
      // Back to signed-out play: pick up whatever is in local storage now.
      setLocal(readHistory());
      return;
    }
    let live = true;
    setError(null);
    loadServerHistory(userId, today, () => setLocal(EMPTY)).then(
      (response) => {
        if (!live) return;
        setServer({ userId, history: toHistory(response.plays), streak: response.streak });
      },
      () => {
        if (live) setError(LOAD_FAILED);
      },
    );
    return () => {
      live = false;
    };
  }, [userId, today, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  const mode = userId ? 'server' : 'local';
  const serverHistory = server && server.userId === userId ? server : null;
  const history = mode === 'server' ? (serverHistory?.history ?? EMPTY) : local;
  const localStreak = useMemo(() => computeStreak(streakPlays(local), today), [local, today]);
  const streak = mode === 'server' ? (serverHistory?.streak ?? { current: 0, best: 0 }) : localStreak;

  const canAnswer = useCallback(
    // Any past Library day can be played; beyond the repair window it just does not count for the Streak.
    (dailyDate: string) => dailyDate <= today && (mode === 'local' || Boolean(serverHistory)),
    [mode, today, serverHistory],
  );

  const saveOnServer = useCallback(
    async (user: string, dailyDate: string, selectedIndex: number, playedOn: string): Promise<RecordOutcome> => {
      setError(null);
      try {
        const response = await postDailyAnswer(dailyDate, { selectedIndex, playedOn });
        if (latestUser.current !== user) return 'failed';
        setServer((current) =>
          current && current.userId === user
            ? { userId: user, history: { ...current.history, plays: { ...current.history.plays, [dailyDate]: fromServer(response.play) } }, streak: response.streak }
            : current,
        );
        return 'saved';
      } catch (caught) {
        // Answered on another device meanwhile: show the stored (first) answer.
        if (caught instanceof ApiProblemError && caught.code === 'daily.alreadyAnswered') {
          reload();
          return 'saved';
        }
        setError(caught instanceof ApiProblemError && caught.detail ? caught.detail : SAVE_FAILED);
        return 'failed';
      }
    },
    [reload],
  );

  const record = useCallback(
    (dailyDate: string, questionId: string, selectedIndex: number, correctIndex: number): RecordOutcome | Promise<RecordOutcome> => {
      const now = new Date();
      if (!userId) {
        const play: DailyPlay = { questionId, selectedIndex, correct: selectedIndex === correctIndex, answeredAt: now.toISOString(), playedOn: localDateKey(now) };
        setLocal((current) => {
          const next: DailyHistory = { ...current, plays: { ...current.plays, [dailyDate]: play } };
          writeHistory(next);
          return next;
        });
        return 'saved';
      }
      return saveOnServer(userId, dailyDate, selectedIndex, localDateKey(now));
    },
    [userId, saveOnServer],
  );
  return { mode, ready: mode === 'local' || Boolean(serverHistory), history, streak, error, canAnswer, record, reload };
}
