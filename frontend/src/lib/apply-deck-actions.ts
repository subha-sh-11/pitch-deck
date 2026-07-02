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

/**
 * Apply the agent's structured edit actions to the live deck via the editor's existing
 * mutation functions. Index math is tracked locally so multi-step moves compose correctly.
 */
export async function applyDeckActions(
  actions: DeckAction[],
  h: DeckActionHandlers,
): Promise<void> {
  const order = h.slides.map((s) => s.id); // working order, kept in sync with mutations

  for (const a of actions) {
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
        const idx = Math.min(Math.max((a.afterSlideNumber ?? order.length) - 1, 0), Math.max(order.length - 1, 0));
        h.onInsertAfter(idx, a.slideType as SlideType);
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
  }
}
