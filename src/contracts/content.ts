import { z } from 'zod';

// ---------------------------------------------------------------------------------------------
// Reports (Story 6.1, FR-38): a player flags a revealed Question as wrong.

/** Where the Question was revealed. */
export const ReportSourceSchema = z.enum(['daily', 'solo', 'lobby']);
export type ReportSource = z.infer<typeof ReportSourceSchema>;

export const REPORT_NOTE_MAX = 500;

/** `POST /api/v1/reports` body. */
export const ReportBodySchema = z.object({
  questionSlug: z.string().min(1).max(200),
  source: ReportSourceSchema,
  note: z.string().trim().max(REPORT_NOTE_MAX).optional(),
});
export type ReportBody = z.infer<typeof ReportBodySchema>;

/** `POST /api/v1/reports` response (201). */
export const ReportResponseSchema = z.object({ id: z.string().min(1) });
export type ReportResponse = z.infer<typeof ReportResponseSchema>;

export const CONTENT_PROBLEM_CODES = {
  invalidReport: 'content.invalidReport',
  questionNotFound: 'content.questionNotFound',
} as const;

/** Shared problem code for per-user rate limits (Stories 6.1, 6.3); responses carry `Retry-After`. */
export const RATE_LIMITED_CODE = 'rateLimited';
