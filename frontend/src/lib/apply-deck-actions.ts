import type { DeckAction } from "@/lib/api/deck";
import type { ColorToken } from "@/types/design";
import type { Slide, SlideAppearance, SlideContent, SlideType } from "@/types/slide";

/** The editor mutation surface the agent's actions are applied through. */
export interface DeckActionHandlers {
  slides: Slide[];
  onUpdateSlide: (id: string, patch: Partial<SlideContent> & { title?: string }) => void;
  onMoveSlide: (index: number, direction: "up" | "down") => void;
  onInsertAfter: (index: number, slideType: SlideType) => void;
  onDeleteSlide: (id: string) => boolean;
  onRegenerateSlide: (id: string) => Promise<void>;
  /** Generate (or replace) just the image on a slide, optionally from a prompt.
   *  Falls back to onRegenerateSlide when not provided. */
  onGenerateImage?: (id: string, imagePrompt?: string) => Promise<void>;
  /** Per-slide layout / look (style variant, accent, background). */
  onSetAppearance?: (id: string, patch: Partial<SlideAppearance>) => void;
  /** Instant, regen-free design changes (deck-wide). */
  onSetAccent?: (hex: string) => void;
  onSetTheme?: (palette: ColorToken[]) => void;
  /** Deck-wide display font (one of the loaded theme fonts). */
  onSetFont?: (font: string) => void;
}

/** Human-readable one-liner for an action — what the agent is DOING, shown to the user in
 *  the chat as a live tool step (the way Claude/ChatGPT narrate their tool use). */
export function describeDeckAction(a: DeckAction, slides: Pick<Slide, "id" | "slideNumber" | "title">[]): string {
  const name = (id: string) => {
    const s = slides.find((x) => x.id === id);
    return s ? `“${s.title}” (slide ${s.slideNumber})` : "a slide";
  };
  switch (a.op) {
    case "edit_slide": {
      const fields = Object.keys(a).filter((k) => k !== "op" && k !== "slideId");
      return `Rewriting ${fields.join(", ") || "copy"} on ${name(a.slideId)}`;
    }
    case "move_slide":
      return `Moving ${name(a.slideId)} ${a.direction}${a.steps && a.steps > 1 ? ` ${a.steps} places` : ""}`;
    case "add_slide":
      return `Adding a ${String(a.slideType).replace(/_/g, " ")} slide after slide ${a.afterSlideNumber}`;
    case "delete_slide":
      return `Removing ${name(a.slideId)}`;
    case "regenerate_slide":
      return `Regenerating ${name(a.slideId)} — copy and image`;
    case "generate_image":
      return `Generating an image for ${name(a.slideId)}`;
    case "set_appearance": {
      const fields = Object.keys(a).filter((k) => k !== "op" && k !== "slideId");
      return `Restyling ${name(a.slideId)} (${fields.join(", ")})`;
    }
    case "set_accent":
      return `Recolouring the deck accent to ${a.hex}`;
    case "set_theme":
      return "Applying a new colour theme to the whole deck";
    case "set_font":
      return `Switching the display font to ${a.font}`;
  }
}

/**
 * Apply the agent's structured edit actions to the live deck via the editor's existing
 * mutation functions. Index math is tracked locally so multi-step moves compose correctly.
 *
 * ``onProgress(index, phase)`` fires before ("start") and after ("done") each action, so the
 * chat can narrate slow steps (image generation, slide regeneration) while they run.
 */
export async function applyDeckActions(
  actions: DeckAction[],
  h: DeckActionHandlers,
  onProgress?: (index: number, phase: "start" | "done") => void,
): Promise<void> {
  const order = h.slides.map((s) => s.id); // working order, kept in sync with mutations

  for (const [idx, a] of actions.entries()) {
    onProgress?.(idx, "start");
    switch (a.op) {
      case "edit_slide": {
        const { op: _op, slideId, ...patch } = a;
        void _op;
        h.onUpdateSlide(slideId, patch);
        break;
      }
      case "delete_slide": {
        h.onDeleteSlide(a.slideId);
        const i = order.indexOf(a.slideId);
        if (i >= 0) order.splice(i, 1);
        break;
      }
      case "regenerate_slide": {
        await h.onRegenerateSlide(a.slideId);
        break;
      }
      case "generate_image": {
        // Prefer image-only generation; fall back to a full slide regen if unavailable.
        if (h.onGenerateImage) await h.onGenerateImage(a.slideId, a.imagePrompt);
        else await h.onRegenerateSlide(a.slideId);
        break;
      }
      case "set_appearance": {
        const { op: _op, slideId, ...patch } = a;
        void _op;
        h.onSetAppearance?.(slideId, patch);
        break;
      }
      case "style_image": {
        const { op: _op, slideId, ...patch } = a;
        void _op;
        h.onUpdateSlide(slideId, patch); // imageBlur / imageDim / imageScale → content
        break;
      }
      case "add_slide": {
        const idx2 = Math.min(Math.max((a.afterSlideNumber ?? order.length) - 1, 0), Math.max(order.length - 1, 0));
        h.onInsertAfter(idx2, a.slideType as SlideType);
        break;
      }
      case "move_slide": {
        let i = order.indexOf(a.slideId);
        if (i < 0) break;
        const steps = a.steps && a.steps > 0 ? a.steps : 1;
        for (let n = 0; n < steps; n++) {
          const j = a.direction === "up" ? i - 1 : i + 1;
          if (j < 0 || j >= order.length) break;
          h.onMoveSlide(i, a.direction);
          [order[i], order[j]] = [order[j], order[i]];
          i = j;
        }
        break;
      }
      case "set_accent": {
        h.onSetAccent?.(a.hex);
        break;
      }
      case "set_theme": {
        h.onSetTheme?.(a.palette as ColorToken[]);
        break;
      }
      case "set_font": {
        h.onSetFont?.(a.font);
        break;
      }
    }
    onProgress?.(idx, "done");
  }
}
