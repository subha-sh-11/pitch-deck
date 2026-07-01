import type { Slide } from "@/types/slide";
import type { StoryAnalysis } from "@/types/workflow";
import { apiFetch } from "./client";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface GenerationJob {
  id: string;
  projectId?: string;
  jobType: string;
  status: JobStatus;
  progress: number;
  result?: unknown;
  error?: string | null;
  /** "queued" (Celery) or "inline" (ran in-request) — backend dispatch hint. */
  mode?: string;
}

export const generateDeck = (projectId: string, templateId?: string, withImages = true) => {
  const params = new URLSearchParams();
  if (templateId) params.set("template_id", templateId);
  params.set("with_images", String(withImages));
  return apiFetch<GenerationJob>(`/generate/${projectId}/deck?${params.toString()}`, {
    method: "POST",
  });
};

export const generateDesign = (projectId: string) =>
  apiFetch<GenerationJob>(`/generate/${projectId}/design`, { method: "POST" });

/** Story Blueprint: compute + persist the AI's StoryAnalysis from the current intake, without
 *  generating any slides — for the editable "AI understanding" read-back before building. */
export const analyzeStory = (projectId: string) =>
  apiFetch<StoryAnalysis>(`/generate/${projectId}/analyze`, { method: "POST" });

/** Workshop step 1: analysis + design + outline → empty slide shells (no batch generation). */
export const prepareDeck = (projectId: string, templateId?: string) => {
  const params = new URLSearchParams();
  if (templateId) params.set("template_id", templateId);
  const qs = params.toString();
  return apiFetch<GenerationJob>(`/generate/${projectId}/deck/prepare${qs ? `?${qs}` : ""}`, {
    method: "POST",
  });
};

export interface WorkshopGenerateInput {
  /** Director's notes the content agent must follow for this slide. */
  instructions?: string;
  /** Edited diffusion prompt — used verbatim instead of the auto-built one. */
  imagePrompt?: string;
  /** The FULL writer prompt as edited in the workshop — used verbatim. */
  contentPrompt?: string;
  /** A change folded into the built image prompt ("add guns and roses, photoreal"). */
  imageInstruction?: string;
  /** Reference image for true image-to-image style transfer ({mediaType, data: base64}). */
  referenceImage?: { mediaType: string; data: string };
  withImage?: boolean;
}

/** The EXACT prompt that will go to the LLM to prepare this slide. */
export const getSlidePrompt = (slideId: string) =>
  apiFetch<{ prompt: string; source: "edited" | "composed" }>(
    `/generate/slides/${slideId}/prompt`,
  );

export const regenerateSlide = (slideId: string, input?: WorkshopGenerateInput) =>
  apiFetch<GenerationJob>(`/generate/slides/${slideId}/regenerate`, {
    method: "POST",
    ...(input ? { body: JSON.stringify(input) } : {}),
  });

/** Workshop: regenerate ONLY the image as a tracked job, optionally from an edited prompt. */
export const workshopSlideImage = (slideId: string, prompt?: string) =>
  apiFetch<GenerationJob>(`/generate/slides/${slideId}/image`, {
    method: "POST",
    body: JSON.stringify({ prompt: prompt ?? null }),
  });

/** Generate 3 image options for a slide (full-screen gallery to choose from). */
export const slideImageVariants = (slideId: string, prompt?: string) =>
  apiFetch<{ slide: Slide; urls: string[]; ok: boolean; reason?: string }>(
    `/generate/slides/${slideId}/image-variants`,
    { method: "POST", body: JSON.stringify({ prompt: prompt ?? null }) },
  );

/** Workshop final step: all slides approved → deck becomes the presentation. */
export const assembleDeck = (projectId: string) =>
  apiFetch<import("@/types/deck").Deck>(`/projects/${projectId}/deck/assemble`, {
    method: "POST",
  });

export interface RegenerateImageResult {
  slide: Slide;
  ok: boolean;
  reason?: string;
}

/** Regenerate only the slide image (keeps text/edits). Returns ok=false when the
 *  image provider is unavailable (e.g. quota) — the existing image is kept. */
export const regenerateSlideImage = (slideId: string) =>
  apiFetch<RegenerateImageResult>(`/generate/slides/${slideId}/regenerate-image`, {
    method: "POST",
  });

export interface ProjectImageResult {
  ok: boolean;
  url?: string;
  reason?: string;
}

/** Generate an image for a slide TYPE — used by editor-added (client-only) slides
 *  that have no backend row yet. */
export const generateProjectImage = (projectId: string, slideType: string) =>
  apiFetch<ProjectImageResult>(
    `/generate/${projectId}/slide-image?slide_type=${encodeURIComponent(slideType)}`,
    { method: "POST" },
  );

export const getJob = (jobId: string) => apiFetch<GenerationJob>(`/jobs/${jobId}`);

export interface PollOptions {
  onProgress?: (job: GenerationJob) => void;
  intervalMs?: number;
  timeoutMs?: number;
}

/**
 * Poll a job until it succeeds/fails. When the backend runs generation inline
 * (no Celery/Redis), the create call already returns a terminal job, so this
 * resolves on the first check.
 */
export async function pollJob(
  job: GenerationJob,
  { onProgress, intervalMs = 1200, timeoutMs = 300_000 }: PollOptions = {},
): Promise<GenerationJob> {
  let current = job;
  const start = Date.now();
  onProgress?.(current);
  while (current.status !== "succeeded" && current.status !== "failed") {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Generation timed out");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
    current = await getJob(job.id);
    onProgress?.(current);
  }
  return current;
}
