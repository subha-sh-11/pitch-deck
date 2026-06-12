import { apiFetch } from "./client";

/** Shapes returned by the intake-interview agent (see backend intake_interview.py). */
export type InterviewInputType = "free_text" | "chips" | "cards" | "none";

export interface InterviewOption {
  label: string;
  value: unknown;
  selected?: boolean;
}

export interface InterviewAsk {
  field: string | null;
  inputType: InterviewInputType;
  options: InterviewOption[];
  allowFreeText: boolean;
}

export interface InterviewAssumption {
  field: string;
  label: string;
  value: unknown;
}

export type InterviewBrief = Record<
  string,
  { value: unknown; method: string; confidence: number }
>;

export interface InterviewSectionOption {
  label: string;
  value?: string;
  selected?: boolean;
  colors?: string[];
}

export interface InterviewSection {
  id: string;
  field?: string | null;
  title: string;
  help?: string;
  kind: "textarea" | "chips" | "multi" | "swatches" | "slider";
  options?: InterviewSectionOption[];
  min?: number;
  max?: number;
  value?: string | number;
}

export interface InterviewResult {
  brief: InterviewBrief;
  sections?: InterviewSection[];
  assumptions: InterviewAssumption[];
  message: string;
  ask: InterviewAsk;
  ready: boolean;
  missingRequired: string[];
}

export interface InterviewHistoryTurn {
  role: "user" | "assistant";
  text: string;
  askedQuestion?: boolean;
}

export interface InterviewPillars {
  title?: string;
  logline?: string;
  synopsis?: string;
  meta?: Record<string, unknown>;
}

/** A reference image shared this turn (downscaled client-side, base64 without data-URL prefix). */
export interface InterviewImage {
  name: string;
  mediaType: string;
  data: string;
}

export interface InterviewTurnInput {
  history: InterviewHistoryTurn[];
  pillars: InterviewPillars;
  brief?: InterviewBrief | null;
  images?: InterviewImage[];
}

/** One interview turn — returns the agent's next message + ask, the cumulative brief, and a ready flag. */
export const interview = (projectId: string, input: InterviewTurnInput) =>
  apiFetch<InterviewResult>(`/projects/${projectId}/interview`, {
    method: "POST",
    body: JSON.stringify(input),
  });

/** Materialise the finished brief into the saved IntakeFormData on the project. */
export const finalizeInterview = (projectId: string, brief: InterviewBrief) =>
  apiFetch<Record<string, string>>(`/projects/${projectId}/interview/finalize`, {
    method: "POST",
    body: JSON.stringify({ brief }),
  });
