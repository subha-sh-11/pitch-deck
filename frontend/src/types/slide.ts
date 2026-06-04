export type SlideType =
  | "cover"
  | "logline"
  | "genre_blend"
  | "synopsis"
  | "story_world"
  | "character"
  | "supporting_characters"
  | "usp"
  | "show_cross"
  | "visual_aesthetic"
  | "target_audience"
  | "budget"
  | "market_potential"
  | "directors_vision"
  | "team"
  | "contact"
  | "generic";

export type SlideStatus =
  | "draft"
  | "approved"
  | "needs_review"
  | "design_generated";

export interface SlideContent {
  heading: string;
  subheading?: string;
  body?: string;
  footer?: string;
  bullets?: string[];
  items?: { title: string; description: string }[];
  characters?: {
    name: string;
    role: string;
    description: string;
    wound?: string;
  }[];
  comps?: { title: string; note: string; posterUrl?: string }[];
  moodBlocks?: { label: string; color: string }[];
  /** Backend-generated image (served URL) bound to this slide, if any. */
  imageUrl?: string;
  imagePrompt?: string;
}

export interface SlideLayout {
  template: string;
  layoutType: string;
}

export type SlideStyleVariant = "cinematic" | "minimal" | "bold";

export type SlideBackgroundKey =
  | "default"
  | "warm-portrait"
  | "concrete"
  | "water"
  | "dark-gradient";

export interface SlideAppearance {
  styleVariant: SlideStyleVariant;
  accentColor: string;
  backgroundKey: SlideBackgroundKey;
}

export interface SlideComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface Slide {
  id: string;
  slideNumber: number;
  slideType: SlideType;
  title: string;
  purpose: string;
  content: SlideContent;
  layout: SlideLayout;
  status: SlideStatus;
  imagePrompt?: string;
  aiRationale?: string;
  appearance?: SlideAppearance;
  speakerNotes?: string;
  comments?: SlideComment[];
  transition?: string;
}

export const SLIDE_STATUS_LABELS: Record<SlideStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  needs_review: "Needs Review",
  design_generated: "Design Generated",
};

export const SLIDE_TYPE_LABELS: Record<SlideType, string> = {
  cover: "Cover",
  logline: "Logline",
  genre_blend: "Genre Blend",
  synopsis: "Synopsis",
  story_world: "Story World",
  character: "Character",
  supporting_characters: "Supporting Characters",
  usp: "USP",
  show_cross: "Show Cross",
  visual_aesthetic: "Visual Aesthetic",
  target_audience: "Target Audience",
  budget: "Budget",
  market_potential: "Market Potential",
  directors_vision: "Director's Vision",
  team: "Team",
  contact: "Contact",
  generic: "Generic",
};
