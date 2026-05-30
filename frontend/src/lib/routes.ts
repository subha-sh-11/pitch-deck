import type { WorkflowStepId } from "@/types/workflow";

export const MOCK_PROJECT_ID = "mock-project";

export const projectRoutes = {
  dashboard: () => "/dashboard",
  newProject: () => "/projects/new",
  projectRoot: (id: string) => `/projects/${id}`,
  setupIdentity: (id: string) => `/projects/${id}/setup/identity`,
  setupBody: (id: string) => `/projects/${id}/setup/body`,
  setupPitch: (id: string) => `/projects/${id}/setup/pitch`,
  templates: (id: string) => `/projects/${id}/templates`,
  preview: (id: string) => `/projects/${id}/preview`,
  editor: (id: string) => `/projects/${id}/editor`,
  /** @deprecated use setupIdentity */
  intake: (id: string) => `/projects/${id}/setup/identity`,
  /** @deprecated redirects to setup */
  questions: (id: string) => `/projects/${id}/setup/identity`,
  storyAnalysis: (id: string) => `/projects/${id}/setup/identity`,
  outline: (id: string) => `/projects/${id}/templates`,
  content: (id: string) => `/projects/${id}/preview`,
  design: (id: string) => `/projects/${id}/templates`,
  review: (id: string) => `/projects/${id}/editor`,
  export: (id: string) => `/projects/${id}/editor`,
  step: (id: string, stepId: WorkflowStepId) => {
    const map: Record<WorkflowStepId, (projectId: string) => string> = {
      intake: projectRoutes.setupIdentity,
      questions: projectRoutes.setupIdentity,
      "story-analysis": projectRoutes.setupIdentity,
      outline: projectRoutes.templates,
      content: projectRoutes.preview,
      design: projectRoutes.templates,
      editor: projectRoutes.editor,
      review: projectRoutes.editor,
      export: projectRoutes.editor,
    };
    return map[stepId](id);
  },
};
