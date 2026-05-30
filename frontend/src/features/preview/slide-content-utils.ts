import type { Slide, SlideContent } from "@/types/slide";

export function slideContentToText(content: SlideContent): string {
  if (content.body) return content.body;
  if (content.bullets?.length) return content.bullets.join("\n");
  if (content.items?.length) {
    return content.items.map((i) => `${i.title}: ${i.description}`).join("\n");
  }
  if (content.characters?.length) {
    return content.characters
      .map((c) => `${c.name} — ${c.role}: ${c.description}`)
      .join("\n");
  }
  return content.heading;
}

export function textToSlideContentPatch(
  text: string,
  existing: SlideContent,
): Partial<SlideContent> {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length > 1) {
    return { body: undefined, bullets: lines };
  }
  return { body: text, bullets: undefined };
}

export function getSelectedSlide(
  slides: Slide[],
  selectedId: string | null,
): Slide | undefined {
  if (!selectedId) return slides[0];
  return slides.find((s) => s.id === selectedId) ?? slides[0];
}
