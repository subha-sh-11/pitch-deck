import type { Deck } from "@/types/deck";
import type {
  Slide,
  SlideAppearance,
  SlideComment,
  SlideContent,
  SlideStatus,
  SlideType,
} from "@/types/slide";
import { apiFetch } from "./client";

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
  | { op: "regenerate_slide"; slideId: string; instruction?: string; useReference?: boolean }
  | { op: "set_accent"; hex: string }
  | { op: "set_theme"; palette: { name: string; hex: string; usage: string }[] };

export interface DeckCommandResult {
  message: string;
  actions: DeckAction[];
}

/** Send a plain-language instruction + current slides; get back the agent's reply and edit actions. */
export const deckCommand = (
  projectId: string,
  instruction: string,
  slides: Pick<Slide, "id" | "slideNumber" | "slideType" | "title" | "content">[],
  images?: { name: string; mediaType: string; data: string }[],
) =>
  apiFetch<DeckCommandResult>(`/projects/${projectId}/deck/command`, {
    method: "POST",
    body: JSON.stringify({ instruction, slides, images: images ?? [] }),
  });
