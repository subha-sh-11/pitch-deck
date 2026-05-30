import type { WorkflowStep } from "@/types/workflow";

export const workspaceStepDefinitions: Omit<WorkflowStep, "status">[] = [
  {
    id: "intake",
    number: 1,
    label: "Intake",
    description:
      "Collect film story, genre, characters, and visual direction.",
  },
  {
    id: "questions",
    number: 2,
    label: "Questions",
    description: "AI asks only the missing pitch-critical details.",
  },
  {
    id: "story-analysis",
    number: 3,
    label: "Story Analysis",
    description: "Understand theme, tone, world, and commercial angle.",
  },
  {
    id: "outline",
    number: 4,
    label: "Outline",
    description: "Create the 15–16 slide pitch deck structure.",
  },
  {
    id: "content",
    number: 5,
    label: "Content",
    description: "Generate and approve slide-by-slide pitch content.",
  },
  {
    id: "design",
    number: 6,
    label: "Design",
    description: "Create cinematic design direction for the story world.",
  },
  {
    id: "editor",
    number: 7,
    label: "Editor",
    description: "Preview and refine the deck slides.",
  },
  {
    id: "review",
    number: 8,
    label: "Review",
    description: "Check clarity, consistency, and pitch readiness.",
  },
  {
    id: "export",
    number: 9,
    label: "Export",
    description: "Download PDF or PowerPoint.",
  },
];
