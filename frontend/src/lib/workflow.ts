import type { ProjectStatus } from "@/types/project";
import type { WorkflowStep, WorkflowStepId, WorkflowStepStatus } from "@/types/workflow";
import { projectRoutes } from "./routes";

export const WORKFLOW_STEP_ORDER: WorkflowStepId[] = [
  "intake",
  "questions",
  "story-analysis",
  "outline",
  "content",
  "design",
  "editor",
  "review",
  "export",
];

const STEP_TO_STATUS: Record<WorkflowStepId, ProjectStatus> = {
  intake: "intake",
  questions: "questions",
  "story-analysis": "story_analysis",
  outline: "outline",
  content: "content",
  design: "design",
  editor: "editor",
  review: "review",
  export: "export",
};

export function getStepFromPathname(pathname: string): WorkflowStepId | null {
  for (const step of WORKFLOW_STEP_ORDER) {
    if (pathname.includes(`/${step}`)) {
      return step;
    }
  }
  return null;
}

export function getStepStatus(
  stepId: WorkflowStepId,
  activeStepId: WorkflowStepId | null,
): WorkflowStepStatus {
  if (!activeStepId) return "upcoming";
  const activeIndex = WORKFLOW_STEP_ORDER.indexOf(activeStepId);
  const stepIndex = WORKFLOW_STEP_ORDER.indexOf(stepId);
  if (stepIndex < activeIndex) return "completed";
  if (stepIndex === activeIndex) return "active";
  return "upcoming";
}

export function buildWorkflowSteps(
  projectId: string,
  activeStepId: WorkflowStepId | null,
  stepDefinitions: Omit<WorkflowStep, "status">[],
): WorkflowStep[] {
  return stepDefinitions.map((step) => ({
    ...step,
    status: getStepStatus(step.id, activeStepId),
  }));
}

export function getProgressFromStatus(status: ProjectStatus): number {
  const statusOrder: ProjectStatus[] = [
    "intake",
    "questions",
    "story_analysis",
    "outline",
    "content",
    "design",
    "editor",
    "review",
    "export",
    "completed",
  ];
  const index = statusOrder.indexOf(status);
  if (index === -1) return 0;
  return Math.round(((index + 1) / statusOrder.length) * 100);
}

export function getPhaseLabel(stepId: WorkflowStepId | null): string {
  const labels: Record<WorkflowStepId, string> = {
    intake: "Creative Intake",
    questions: "AI Gap Analysis",
    "story-analysis": "Story Analysis",
    outline: "Deck Outline",
    content: "Content Review",
    design: "Design Direction",
    editor: "Slide Editor",
    review: "Quality Review",
    export: "Export",
  };
  return stepId ? labels[stepId] : "Workspace";
}

export { STEP_TO_STATUS, projectRoutes };
