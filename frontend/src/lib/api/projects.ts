import type {
  PitchPurpose,
  ProductionStatus,
  Project,
  ProjectType,
  StoryStage,
} from "@/types/project";
import type { IntakeFormData } from "@/types/workflow";
import { apiFetch } from "./client";

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
