import { useEffect, useMemo, useState } from 'react';
import { DailyResponseSchema, type DailyQuestion, type DailyResponse } from '@/contracts';
import { fetchDaily } from './api';
import { storage } from './storage';
import { bundledDailyQuestion, bundledQuestionBySlug, toKnowledgeQuestion, type KnowledgeQuestion } from './knowledge';

export const DAILY_CACHE_KEY = 'kno:daily-cache-v1';
/** Enough to cover the Library; older dates fall back to bundled content. */
const MAX_CACHED_DATES = 31;

type DailyCache = Record<string, DailyResponse>;

export function readDailyCache(): DailyCache {
  try {
    const raw = JSON.parse(storage.getItem(DAILY_CACHE_KEY) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const cache: DailyCache = {};
    for (const [date, value] of Object.entries(raw)) {
      const parsed = DailyResponseSchema.safeParse(value);
      if (parsed.success && parsed.data.dailyDate === date) cache[date] = parsed.data;
    }
    return cache;
  } catch {
    return {};
  }
}

/** Keeps the last API response per Daily Date, newest dates first. */
export function cacheDaily(response: DailyResponse): void {
  const next = { ...readDailyCache(), [response.dailyDate]: response };
  const kept = Object.keys(next).sort().reverse().slice(0, MAX_CACHED_DATES);
  try {
    storage.setItem(DAILY_CACHE_KEY, JSON.stringify(Object.fromEntries(kept.map((date) => [date, next[date]]))));
  } catch {
    // Storage full or blocked: the Daily still works from the API or bundled content.
  }
}

/**
 * Offline Daily for a date (NFR-4). With `answeredSlug` (the player's play for that date), the
 * answered question wins wherever it is found; otherwise the cached API response, else bundled content.
 */
export function localDailyQuestion(dailyDate: string, answeredSlug?: string): DailyQuestion {
  const cached = readDailyCache()[dailyDate]?.question;
  if (answeredSlug) {
    const answered = cached?.slug === answeredSlug ? cached : bundledQuestionBySlug(answeredSlug);
    if (answered) return answered;
  }
  return cached ?? bundledDailyQuestion(dailyDate);
}

/**
 * The Daily to show for `dailyDate`. Renders the offline question at once, then asks the API and
 * switches to (and caches) its answer — unless the player already answered a different question
 * for that date, which is never swapped out. API failures keep the offline question.
 */
export function useDailyQuestion(dailyDate: string, answeredSlug?: string): KnowledgeQuestion {
  const offline = useMemo(() => toKnowledgeQuestion(localDailyQuestion(dailyDate, answeredSlug)), [dailyDate, answeredSlug]);
  const [fetched, setFetched] = useState<{ dailyDate: string; question: KnowledgeQuestion } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchDaily(dailyDate, controller.signal).then(
      (response) => {
        if (controller.signal.aborted) return;
        if (answeredSlug && response.question.slug !== answeredSlug) return;
        cacheDaily(response);
        setFetched({ dailyDate, question: toKnowledgeQuestion(response.question) });
      },
      () => undefined,
    );
    return () => controller.abort();
  }, [dailyDate, answeredSlug]);

  const fresh = fetched?.dailyDate === dailyDate ? fetched.question : undefined;
  return fresh && (!answeredSlug || fresh.id === answeredSlug) ? fresh : offline;
}
