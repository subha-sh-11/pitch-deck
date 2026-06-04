import type {
  PitchPurpose,
  ProductionStatus,
  Project,
  ProjectType,
  StoryStage,
} from "@/types/project";
import type { IntakeFormData } from "@/types/workflow";
import { API_BASE_URL, ApiError, apiFetch } from "./client";

/** Full project payload (adds intake + analysis to the dashboard summary shape). */
export interface ProjectDetail extends Project {
  ownerId: string;
  intakeForm: IntakeFormData | null;
  scriptSummary: { fileName: string; fields: { label: string; value: string }[] } | null;
  storyAnalysis: Record<string, unknown> | null;
  lastEditedAt: string | null;
  createdAt: string;
}

export interface CreateProjectInput {
  title: string;
  projectType?: ProjectType;
  pitchPurpose?: PitchPurpose;
  storyStage?: StoryStage;
  genres?: string[];
  tone?: string[];
  language?: string;
  productionStatus?: ProductionStatus;
}

export type UpdateProjectInput = Partial<CreateProjectInput> & { status?: string };

export const listProjects = () => apiFetch<Project[]>("/projects");

export const createProject = (data: CreateProjectInput) =>
  apiFetch<ProjectDetail>("/projects", { method: "POST", body: JSON.stringify(data) });

export const getProject = (id: string) => apiFetch<ProjectDetail>(`/projects/${id}`);

export const updateProject = (id: string, data: UpdateProjectInput) =>
  apiFetch<ProjectDetail>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const saveIntake = (id: string, form: IntakeFormData) =>
  apiFetch<ProjectDetail>(`/projects/${id}/intake`, {
    method: "PUT",
    body: JSON.stringify({ form }),
  });

export const recommendTemplate = (id: string) =>
  apiFetch<{ templateId: string }>(`/projects/${id}/recommend-template`);

export const deleteProject = (id: string) =>
  apiFetch<void>(`/projects/${id}`, { method: "DELETE" });

export interface IntakeExtractResult {
  fileName: string;
  form: IntakeFormData;
  /** camelCase intake keys that were populated from the script. */
  filledFields: (keyof IntakeFormData)[];
}

/**
 * Upload a script (PDF/DOCX/FDX/TXT) and get back auto-extracted intake fields.
 * Uses raw fetch (not apiFetch) because multipart bodies must not set Content-Type.
 */
export async function extractScript(
  projectId: string,
  file: File,
): Promise<IntakeExtractResult> {
  const body = new FormData();
  body.append("file", file);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/projects/${projectId}/intake/extract`, {
      method: "POST",
      body,
    });
  } catch (err) {
    throw new ApiError(0, `Network error: ${(err as Error).message}`);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json())?.detail ?? detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as IntakeExtractResult;
}
