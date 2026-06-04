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

export const regenerateSlide = (slideId: string) =>
  apiFetch<GenerationJob>(`/generate/slides/${slideId}/regenerate`, { method: "POST" });

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
