import type { WorkflowStepId } from "@/types/workflow";

export const projectRoutes = {
  dashboard: () => "/dashboard",
  newProject: () => "/projects/new",
  projectRoot: (id: string) => `/projects/${id}`,
  setupIdentity: (id: string) => `/projects/${id}/setup/identity`,
  setupBody: (id: string) => `/projects/${id}/setup/body`,
  setupPitch: (id: string) => `/projects/${id}/setup/pitch`,
  templates: (id: string) => `/projects/${id}/templates`,
  /** The deck lives in the Presentation tab of the intake studio. */
  editor: (id: string) => `/projects/${id}/setup/identity`,
  /** @deprecated content-preview step removed; templates now generates straight to the editor */
  preview: (id: string) => `/projects/${id}/templates`,
  /** @deprecated use setupIdentity */
  intake: (id: string) => `/projects/${id}/setup/identity`,
  /** @deprecated redirects to setup */
  questions: (id: string) => `/projects/${id}/setup/identity`,
  storyAnalysis: (id: string) => `/projects/${id}/setup/identity`,
  outline: (id: string) => `/projects/${id}/templates`,
  content: (id: string) => `/projects/${id}/templates`,
  design: (id: string) => `/projects/${id}/templates`,
  /** AI quality-review screen (deck QA score + issues to fix). */
  review: (id: string) => `/projects/${id}/review`,
  /** Real export/download page (PDF / PPTX / images / print). */
  export: (id: string) => `/projects/${id}/export`,
  step: (id: string, stepId: WorkflowStepId) => {
    const map: Record<WorkflowStepId, (projectId: string) => string> = {
      intake: projectRoutes.setupIdentity,
      questions: projectRoutes.setupIdentity,
      "story-analysis": projectRoutes.setupIdentity,
      outline: projectRoutes.templates,
      content: projectRoutes.templates,
      design: projectRoutes.templates,
      editor: projectRoutes.editor,
      review: projectRoutes.review,
      export: projectRoutes.export,
    };
    return map[stepId](id);
  },
};
