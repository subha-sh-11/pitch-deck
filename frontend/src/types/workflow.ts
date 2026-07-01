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

export type QualityIssueSeverity = "high" | "medium" | "low";

/** One problem the quality-review agent found. Mirrors backend quality_review.run() output. */
export interface QualityReviewIssue {
  severity: QualityIssueSeverity;
  /** 1-based slide number the issue is about, when slide-specific. */
  slideNumber?: number | null;
  slideType?: string | null;
  /** repeated_images | missing_producer_slide | readability | generic_copy | spelling | … */
  category: string;
  message: string;
}

/** Structural QA over the finished deck (stored on Deck.qualityReview). */
export interface QualityReview {
  /** 0–100, a clean 100 docked by issue severity. */
  score: number;
  summary: string;
  issues: QualityReviewIssue[];
  /** ISO-8601 timestamp of when the review ran. */
  checkedAt?: string;
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
  supportingCharacters: string;
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
  directorVision: string;
  budget: string;
  productionStatus: string;
  distribution: string;
  deckLength: string;
  deliveryFormat: string;
}
