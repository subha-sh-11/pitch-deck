import type { DeckAction } from "@/lib/api/deck";
import type { ColorToken } from "@/types/design";
import type { Slide, SlideAppearance, SlideContent, SlideType } from "@/types/slide";

/** The editor mutation surface the agent's actions are applied through. */
export interface DeckActionHandlers {
  slides: Slide[];
  onUpdateSlide: (id: string, patch: Partial<SlideContent> & { title?: string }) => void;
  onMoveSlide: (index: number, direction: "up" | "down") => void;
  /** `init` carries the director's request into the new slide: its title and the contentBrief
   *  (stored as the slide's purpose) that generation writes the copy from. `generate` asks the
   *  editor to write the slide's real content right after the create lands. */
  onInsertAfter: (
    index: number,
    slideType: SlideType,
    init?: { title?: string; contentBrief?: string; pointCount?: number; generate?: boolean },
  ) => void | Promise<void>;
  onDeleteSlide: (id: string) => boolean;
  /** `direction` is the director's change request ("punchier, lead with the comps") — flows
   *  into the regeneration writer as instructions. */
  onRegenerateSlide: (id: string, direction?: string) => Promise<void>;
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
  /** Restore the deck to the state before the agent's previous change (chat undo). */
  onUndoLast?: () => void;
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
      return `Adding ${a.title ? `“${a.title}”` : `a ${String(a.slideType).replace(/_/g, " ")} slide`} after slide ${a.afterSlideNumber}`;
    case "delete_slide":
      return `Removing ${name(a.slideId)}`;
    case "regenerate_slide":
      return `Regenerating ${name(a.slideId)}${a.direction ? ` — ${a.direction}` : " — copy and image"}`;
    case "generate_image":
      return `Generating an image for ${name(a.slideId)}`;
    case "set_appearance": {
      const fields = Object.keys(a).filter((k) => k !== "op" && k !== "slideId");
      return `Restyling ${name(a.slideId)} (${fields.join(", ")})`;
    }
    case "style_image": {
      const parts = [
        a.imageBlur !== undefined ? "blur" : null,
        a.imageDim !== undefined ? "dim" : null,
        a.imageScale !== undefined ? "zoom" : null,
      ].filter(Boolean);
      return `Adjusting the image on ${name(a.slideId)} (${parts.join(", ") || "look"})`;
    }
    case "set_accent":
      return `Recolouring the deck accent to ${a.hex}`;
    case "set_theme":
      return "Applying a new colour theme to the whole deck";
    case "set_font":
      return `Switching the display font to ${a.font}`;
    case "undo_last":
      return "Restoring the deck to before the last change";
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
        const content = h.slides.find((s) => s.id === slideId)?.content;
        // List edits pass {text fields} only — merge back the imagery the agent kept so an
        // edit never wipes TMDB posters, character portraits, or mood-tile stills.
        if (patch.comps) {
          const existing = content?.comps ?? [];
          patch.comps = patch.comps.map((c) => ({
            ...c,
            posterUrl:
              c.posterUrl ??
              existing.find((e) => e.title.toLowerCase() === c.title.toLowerCase())?.posterUrl,
          }));
        }
        if (patch.characters) {
          const existing = content?.characters ?? [];
          patch.characters = patch.characters.map((c) => {
            const prev = existing.find((e) => e.name.toLowerCase() === c.name.toLowerCase());
            return { ...prev, ...c, imageUrl: c.imageUrl ?? prev?.imageUrl };
          });
        }
        if (patch.moodBlocks) {
          const existing = content?.moodBlocks ?? [];
          patch.moodBlocks = patch.moodBlocks.map((b) => {
            const prev = existing.find((e) => e.label.toLowerCase() === b.label.toLowerCase());
            return {
              ...b,
              color: b.color ?? prev?.color ?? "#888888",
              imageUrl: b.imageUrl ?? prev?.imageUrl,
            };
          });
        }
        h.onUpdateSlide(slideId, patch as Partial<SlideContent>);
        break;
      }
      case "delete_slide": {
        h.onDeleteSlide(a.slideId);
        const i = order.indexOf(a.slideId);
        if (i >= 0) order.splice(i, 1);
        break;
      }
      case "regenerate_slide": {
        await h.onRegenerateSlide(a.slideId, a.direction);
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
        // A contentBrief means the director asked for a slide ABOUT something — generate its
        // real content immediately (awaited, so the chat narration tracks the work).
        await h.onInsertAfter(idx2, a.slideType as SlideType, {
          title: a.title,
          contentBrief: a.contentBrief,
          pointCount: a.pointCount,
          generate: Boolean(a.contentBrief),
        });
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
      case "undo_last": {
        h.onUndoLast?.();
        break;
      }
    }
    onProgress?.(idx, "done");
  }
}
