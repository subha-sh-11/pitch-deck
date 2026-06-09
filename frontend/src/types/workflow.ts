export type WorkflowStepId =
  | "intake"
  | "questions"
  | "story-analysis"
  | "outline"
  | "content"
  | "design"
  | "editor"
  | "review"
  | "export";

export type WorkflowStepStatus = "completed" | "active" | "upcoming";

export interface WorkflowStep {
  id: WorkflowStepId;
  number: number;
  label: string;
  description: string;
  status: WorkflowStepStatus;
}

export interface StoryAnalysis {
  coreTheme: string;
  emotionalCore: string;
  genreDna: string[];
  storyWorld: string;
  commercialAngle: string;
  audiencePromise: string;
  visualWorld: string;
  pitchPositioning: string;
}

export interface IntakeAnalysis {
  completenessScore: number;
  detectedSignals: { label: string; value: string }[];
  missingDetails: string[];
  followUpQuestions: { question: string; placeholder: string }[];
}

export interface QualityReviewFinding {
  slideTitle: string;
  status: "strong" | "needs_work" | "needs_detail";
  suggestion: string;
}

export interface QualityReview {
  overallReadiness: number;
  contentClarity: number;
  visualConsistency: number;
  investorReadiness: number;
  exportReadiness: number;
  findings: QualityReviewFinding[];
}

export interface IntakeFormData {
  title: string;
  tagline: string;
  logline: string;
  genreBlend: string;
  tone: string;
  synopsis: string;
  storyWorld: string;
  mainCharacters: string;
  characterDynamics: string;
  usp: string;
  showCross: string;
  targetAudience: string;
  releaseFit: string;
  visualAesthetic: string;
  colorPalette: string;
  textureStyle: string;
  designDirection: string;
  themes: string;
  keyScenes: string;
  visualMood: string;
  // Pitch-deck checklist additions (format, look, market, team, business, output)
  format: string;
  whyNow: string;
  visualReferences: string;
  moodBoard: string;
  pitchingTo: string;
  creativeTeam: string;
  directorStatement: string;
  budget: string;
  productionStatus: string;
  distribution: string;
  deckLength: string;
  deliveryFormat: string;
}
