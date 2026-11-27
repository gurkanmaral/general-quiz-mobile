import {
  DailyQuestionSchema,
  localize,
  type ContentLanguage,
  type DailyQuestion,
  type QUESTION_CATEGORIES,
  type QUESTION_THEMES,
} from '@/contracts';
import { rotationSlug } from '@/shared';
import dailyOriginals from '@/fallback/daily-originals.json';
import dailySchedule from '@/fallback/schedule.json';

export type KnowledgeCategory = (typeof QUESTION_CATEGORIES)[number];

/** A Daily Question resolved to one language, as the KNO. screen renders it. */
export type KnowledgeQuestion = {
  id: string;
  category: KnowledgeCategory;
  eyebrow: string;
  question: string;
  options: readonly string[];
  correctIndex: number;
  answerTitle: string;
  summary: string;
  facts: readonly { label: string; value: string; detail: string }[];
  video?: { title: string; creator: string; url: string };
  sourceUrl: string;
  sourceLabel: string;
  theme: (typeof QUESTION_THEMES)[number];
};

export function toKnowledgeQuestion(daily: DailyQuestion, language: ContentLanguage = 'en'): KnowledgeQuestion {
  const text = (value: Parameters<typeof localize>[0]) => localize(value, language);
  return {
    id: daily.slug,
    category: daily.category,
    eyebrow: text(daily.eyebrow),
    question: text(daily.text),
    options: daily.options.map(text),
    correctIndex: daily.correctIndex,
    answerTitle: text(daily.answerTitle),
    summary: text(daily.summary),
    facts: daily.facts.map((fact) => ({ label: text(fact.label), value: text(fact.value), detail: text(fact.detail) })),
    ...(daily.video ? { video: { title: text(daily.video.title), creator: daily.video.creator, url: daily.video.url } } : {}),
    sourceUrl: daily.source.url,
    sourceLabel: text(daily.source.label),
    theme: daily.theme,
  };
}

/** Published Daily content bundled from `content/` — the last-resort fallback when the API and cache fail (NFR-4). */
const BUNDLED_QUESTIONS = new Map(
  dailyOriginals.questions
    .filter((question) => question.status === 'published')
    .map((question) => {
      const parsed = DailyQuestionSchema.parse(question);
      return [parsed.slug, parsed] as const;
    }),
);

const BUNDLED_ENTRIES = new Map(
  dailySchedule.entries
    .filter((entry: { status: string }) => entry.status === 'published')
    .map((entry: { dailyDate: string; question: string }) => [entry.dailyDate, entry.question] as const),
);

/** A bundled published question by slug (e.g. the one a player already answered). */
export function bundledQuestionBySlug(slug: string): DailyQuestion | undefined {
  return BUNDLED_QUESTIONS.get(slug);
}

/** The bundled Daily for a local date: explicit schedule entry first, then the rotation (same rule as the API). */
export function bundledDailyQuestion(dailyDate: string): DailyQuestion {
  const slug = BUNDLED_ENTRIES.get(dailyDate) ?? rotationSlug(dailySchedule.rotation, dailyDate);
  const question = (slug && BUNDLED_QUESTIONS.get(slug)) ?? BUNDLED_QUESTIONS.values().next().value;
  if (!question) throw new Error('No bundled Daily content');
  return question;
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Bundled question for a local date (used by tests and as the offline fallback). */
export function questionForDate(date: Date): KnowledgeQuestion {
  return toKnowledgeQuestion(bundledDailyQuestion(localDateKey(date)));
}
