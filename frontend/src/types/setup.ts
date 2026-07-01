import type { Slide } from "./slide";
import type { IntakeFormData } from "./workflow";

export type SetupStepId = "identity" | "body" | "pitch";

export type GenerationStatus = "idle" | "generating" | "ready";

export interface ExtractedScriptSummary {
  fields: { label: string; value: string }[];
  fileName: string;
}

export interface SetupWizardState {
  formData: IntakeFormData;
  completedSteps: SetupStepId[];
  selectedTemplateId: string | null;
  scriptUploaded: boolean;
  extractedSummary: ExtractedScriptSummary | null;
  draftSlides: Slide[];
  contentApproved: boolean;
  generationStatus: GenerationStatus;
}

export const EMPTY_INTAKE_FORM: IntakeFormData = {
  title: "",
  tagline: "",
  logline: "",
  genreBlend: "",
  tone: "",
  synopsis: "",
  storyWorld: "",
  mainCharacters: "",
  supportingCharacters: "",
  characterDynamics: "",
  usp: "",
  showCross: "",
  targetAudience: "",
  releaseFit: "",
  visualAesthetic: "",
  colorPalette: "",
  textureStyle: "",
  designDirection: "",
  themes: "",
  keyScenes: "",
  visualMood: "",
  format: "",
  whyNow: "",
  visualReferences: "",
  moodBoard: "",
  pitchingTo: "",
  creativeTeam: "",
  directorStatement: "",
  directorVision: "",
  budget: "",
  productionStatus: "",
  distribution: "",
  deckLength: "",
  deliveryFormat: "",
};
