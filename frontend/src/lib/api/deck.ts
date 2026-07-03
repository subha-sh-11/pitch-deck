import type { Deck } from "@/types/deck";
import type { DesignDirection } from "@/types/design";
import type {
  Slide,
  SlideAppearance,
  SlideBackgroundKey,
  SlideComment,
  SlideContent,
  SlideStatus,
  SlideStyleVariant,
  SlideType,
} from "@/types/slide";
import { apiFetch } from "./client";

/** A candidate visual system the director can choose from (a complete "template"). */
export interface DesignCandidate {
  id: string;
  label: string;
  vibe: string;
  design: DesignDirection;
}

/** Generate 4-5 distinct, story-grounded visual systems for the deck. */
export const getDesignCandidates = (projectId: string) =>
  apiFetch<{ candidates: DesignCandidate[] }>(`/projects/${projectId}/design/candidates`, {
    method: "POST",
  });

/** Apply a chosen visual system to the built deck (persists deck-wide). */
export const applyDeckDesign = (projectId: string, design: DesignDirection) =>
  apiFetch<Deck>(`/projects/${projectId}/deck/design`, {
    method: "PUT",
    body: JSON.stringify({ design }),
  });

export const getDeck = (projectId: string) =>
  apiFetch<Deck>(`/projects/${projectId}/deck`);

export interface SlideMetaInput {
  speakerNotes?: string;
  transition?: string;
  appearance?: SlideAppearance;
  comments?: SlideComment[];
}

export interface SlideUpdateInput {
  title?: string;
  content?: Partial<SlideContent>;
  status?: SlideStatus;
  meta?: SlideMetaInput;
}

export const updateSlide = (slideId: string, data: SlideUpdateInput) =>
  apiFetch<Slide>(`/slides/${slideId}`, { method: "PATCH", body: JSON.stringify(data) });

export interface SlideCreateInput {
  slideType: SlideType;
  slideNumber: number; // desired 1-based position
  title?: string;
  purpose?: string;
  content?: Partial<SlideContent>;
  layout?: { template: string; layoutType: string };
}

/** Persist a slide added in the editor; returns the slide with its real backend id. */
export const createSlide = (projectId: string, data: SlideCreateInput) =>
  apiFetch<Slide>(`/projects/${projectId}/deck/slides`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const deleteSlide = (slideId: string) =>
  apiFetch<void>(`/slides/${slideId}`, { method: "DELETE" });

/** Persist the editor's slide order (array of slide ids, first = slide 1). */
export const reorderSlides = (projectId: string, slideIds: string[]) =>
  apiFetch<Deck>(`/projects/${projectId}/deck/slides/reorder`, {
    method: "POST",
    body: JSON.stringify({ slideIds }),
  });

// ── Agent action layer: natural-language deck edits ──

export type DeckAction =
  | { op: "edit_slide"; slideId: string; title?: string; heading?: string; subheading?: string; body?: string; bullets?: string[]; items?: { title: string; description: string }[] }
  | { op: "style_image"; slideId: string; imageBlur?: number; imageDim?: number; imageScale?: number }
  | { op: "move_slide"; slideId: string; direction: "up" | "down"; steps?: number }
  | { op: "add_slide"; afterSlideNumber: number; slideType: string }
  | { op: "delete_slide"; slideId: string }
  | { op: "regenerate_slide"; slideId: string }
  | { op: "generate_image"; slideId: string; imagePrompt?: string }
  | { op: "set_appearance"; slideId: string; styleVariant?: SlideStyleVariant; accentColor?: string; backgroundKey?: SlideBackgroundKey; textColor?: string; composition?: "full" | "split" | "framed"; imageSide?: "left" | "right" }
  | { op: "set_accent"; hex: string }
  | { op: "set_theme"; palette: { name: string; hex: string; usage: string }[] }
  | { op: "set_font"; font: "cormorant" | "playfair" | "oswald" | "poppins" | "anton" };

export interface DeckCommandResult {
  message: string;
  actions: DeckAction[];
  /** Actions the agent emitted that the backend discarded as invalid — when > 0 and
   *  `actions` is empty, the agent's message may claim a change that never applied. */
  discarded?: number;
}

/** Example commands shown when the agent needs direction — so the user always knows what
 *  kind of instruction works (the way Claude/ChatGPT suggest next steps). */
const COMMAND_EXAMPLES =
  'For example: “make slide 2’s text white”, “add an image to the cover”, or “move the budget slide up”.';

/** Honest chat text for a deck-command result: echo the agent's message only when its
 *  changes actually applied; otherwise say so instead of relaying a fabricated "Done". */
export function honestDeckCommandText(res: DeckCommandResult): string {
  if (res.actions.length > 0) return res.message;
  if ((res.discarded ?? 0) > 0) {
    return (
      "I tried to make that change but it didn't apply cleanly — tell me the exact slide (or rephrase) and I'll do it.\n" +
      COMMAND_EXAMPLES
    );
  }
  if (!res.message) {
    return `I didn't change anything — tell me which slide and what to change and I'll do it.\n${COMMAND_EXAMPLES}`;
  }
  // Zero actions and none discarded: a clarification question or an honest "can't do that".
  // A question gets example commands so the user knows how to answer; a success-sounding
  // claim gets corrected with an explicit "nothing applied" note.
  return res.message.includes("?")
    ? `${res.message}\n${COMMAND_EXAMPLES}`
    : `${res.message}\n(No changes were applied to the deck.)`;
}

export interface DeckCommandTurn {
  role: "user" | "assistant";
  text: string;
}

/** A reference image shared with the deck agent (base64, no data-URL prefix). */
export interface DeckCommandImage {
  name: string;
  mediaType: string;
  data: string;
}

/** Send a plain-language instruction + current slides (+ recent chat history so follow-ups like a
 * bare "9th" resolve against the agent's own previous question, + the selected slide as the default
 * target, + any reference images to adapt the look from); get back its reply and edit actions. */
export const deckCommand = (
  projectId: string,
  instruction: string,
  slides: Pick<Slide, "id" | "slideNumber" | "slideType" | "title" | "content">[],
  history: DeckCommandTurn[] = [],
  selectedSlideId?: string,
  images: DeckCommandImage[] = [],
) =>
  apiFetch<DeckCommandResult>(`/projects/${projectId}/deck/command`, {
    method: "POST",
    body: JSON.stringify({ instruction, slides, history, selectedSlideId, images }),
  });
