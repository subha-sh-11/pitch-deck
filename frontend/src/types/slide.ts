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

export type SlideStatus = "draft" | "approved" | "needs_review";

export interface SlideContent {
  heading: string;
  subheading?: string;
  body?: string;
  bullets?: string[];
  items?: { title: string; description: string }[];
  characters?: { name: string; role: string; description: string }[];
  comps?: { title: string; note: string }[];
  moodBlocks?: { label: string; color: string }[];
}

export interface SlideLayout {
  template: string;
  layoutType: string;
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
  aiRationale?: string;
}

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
