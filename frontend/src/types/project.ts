export type ProjectType =
  | "feature_film"
  | "web_series"
  | "short_film"
  | "documentary"
  | "pilot"
  | "other";

export type PitchPurpose =
  | "investor"
  | "ott"
  | "studio"
  | "producer"
  | "festival"
  | "cast_crew"
  | "internal";

export type StoryStage =
  | "raw_idea"
  | "one_line"
  | "synopsis_ready"
  | "partial_script"
  | "full_script"
  | "pilot_shot"
  | "partially_shot"
  | "completed";

export type ProjectStatus =
  | "intake"
  | "questions"
  | "story_analysis"
  | "outline"
  | "content"
  | "design"
  | "editor"
  | "review"
  | "export"
  | "completed";

export type ProductionStatus =
  | "development"
  | "script_ready"
  | "pre_production"
  | "in_production"
  | "post_production";

export interface Project {
  id: string;
  title: string;
  projectType: ProjectType;
  pitchPurpose: PitchPurpose;
  storyStage: StoryStage;
  genres: string[];
  tone: string[];
  language: string;
  productionStatus: ProductionStatus;
  status: ProjectStatus;
  updatedAt: string;
}

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  feature_film: "Feature Film",
  web_series: "Web Series",
  short_film: "Short Film",
  documentary: "Documentary",
  pilot: "Pilot",
  other: "Other",
};

export const PITCH_PURPOSE_LABELS: Record<PitchPurpose, string> = {
  investor: "Investor Pitch",
  ott: "OTT / Streaming Pitch",
  studio: "Studio Pitch",
  producer: "Producer Pitch",
  festival: "Festival Pitch",
  cast_crew: "Cast / Crew Attachment",
  internal: "Internal Development",
};

export const STORY_STAGE_LABELS: Record<StoryStage, string> = {
  raw_idea: "Raw Idea",
  one_line: "One Line",
  synopsis_ready: "Synopsis Ready",
  partial_script: "Partial Script",
  full_script: "Full Script",
  pilot_shot: "Pilot Shot",
  partially_shot: "Partially Shot",
  completed: "Completed Project",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  intake: "Intake",
  questions: "Questions",
  story_analysis: "Story Analysis",
  outline: "Outline",
  content: "Content Review",
  design: "Design",
  editor: "Editor",
  review: "Review",
  export: "Export",
  completed: "Completed",
};
