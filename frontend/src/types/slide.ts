export type SlideType =
  | "cover"
  | "logline"
  | "genre_blend"
  | "synopsis"
  | "story_world"
  | "character"
  | "supporting_characters"
  | "relationship_map"
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
  items?: { title: string; description: string; imageUrl?: string; imagePrompt?: string }[];
  characters?: {
    name: string;
    role: string;
    description: string;
    /** Apparent age / build / defining look — drives the portrait so the face matches. */
    appearance?: string;
    wound?: string;
    /** Backend-generated portrait (served URL) for this character, if any. */
    imageUrl?: string;
    imagePrompt?: string;
  }[];
  comps?: { title: string; note: string; posterUrl?: string }[];
  moodBlocks?: { label: string; color: string; imageUrl?: string; imagePrompt?: string }[];
  /** Relationship-map slide: labelled edges between characters (nodes come from `characters`). */
  relationships?: { source: string; target: string; label?: string }[];
  /** Backend-generated image (served URL) bound to this slide, if any. */
  imageUrl?: string;
  imagePrompt?: string;
  /** Multiple generated image options to choose from in the full-screen gallery. */
  imageCandidates?: string[];
  /** PPT-style editing: per-element overrides keyed by a stable element key. */
  edits?: Record<string, SlideElementEdit>;
  /** PPT-style editing: free-form text boxes the user added anywhere on the slide. */
  textBoxes?: SlideTextBox[];
}

/** Override applied to a built-in template text element (inline editing + drag + restyle). */
export interface SlideElementEdit {
  /** Replacement text (when the user edits the copy in place). */
  text?: string;
  /** Drag offset as a percentage of slide width/height (container-query units). */
  dxPct?: number;
  dyPct?: number;
  /** Text color override. */
  color?: string;
  /** Multiplier on the element's font size (0.5–2). */
  fontScale?: number;
  /** Hide this element. */
  hidden?: boolean;
}

/** A free-form text box placed anywhere on the slide (PowerPoint-style). */
export interface SlideTextBox {
  id: string;
  text: string;
  /** Position + width as a percentage of the slide (container-query units). */
  xPct: number;
  yPct: number;
  wPct: number;
  /** Font size in cqw units (≈ % of slide width). */
  fontSize: number;
  color?: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
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

/** How a slide arranges its image vs its text. "full" = image full-bleed with text overlaid
 *  (default); "split" = image one side, text the other (two-column); "framed" = image inset as a
 *  bordered block beside the text. */
export type SlideComposition = "full" | "split" | "framed";

export interface SlideAppearance {
  styleVariant: SlideStyleVariant;
  accentColor: string;
  backgroundKey: SlideBackgroundKey;
  /** Optional per-slide text colour override (wins over the deck palette text) — used when a
   *  slide's background (e.g. a dark full-bleed image) needs different text from the deck theme. */
  textColor?: string;
  /** Per-slide composition variant (text-centric slides: logline, generic). */
  composition?: SlideComposition;
  /** Which side the image sits on for split/framed compositions (default "right"). */
  imageSide?: "left" | "right";
}

export interface SlideComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

/** The editable prompts behind a workshop slide. */
export interface SlidePrompts {
  contentInstructions?: string;
  /** The full writer prompt as edited in the workshop (sent verbatim). */
  contentPrompt?: string;
  imagePrompt?: string;
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
  /** Workshop: the editable prompts behind this slide. */
  prompts?: SlidePrompts;
  /** Workshop: whether this slide has been generated at least once. */
  generated?: boolean;
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
  relationship_map: "Relationship Map",
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
