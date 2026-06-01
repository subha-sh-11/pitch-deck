import type { Slide, SlideContent, SlideType } from "@/types/slide";

export interface SlideContentBlock {
  label: string;
  value: string;
}

function titleCaseHeading(heading: string, slideType: SlideType): string {
  if (slideType !== "cover") return heading;
  if (heading === heading.toUpperCase() && heading.length > 1) {
    return heading
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return heading;
}

export function formatSlidePreviewBlocks(slide: Slide): SlideContentBlock[] {
  const { content, slideType } = slide;
  const blocks: SlideContentBlock[] = [];

  if (slideType === "cover") {
    if (content.heading) {
      blocks.push({
        label: "Title",
        value: titleCaseHeading(content.heading, slideType),
      });
    }
    if (content.subheading) blocks.push({ label: "Tagline", value: content.subheading });
    if (content.body) blocks.push({ label: "Subtitle", value: content.body });
    if (content.footer) blocks.push({ label: "Credit", value: content.footer });
    return blocks;
  }

  if (slideType === "logline") {
    if (content.body) blocks.push({ label: "Logline", value: content.body });
    return blocks.length ? blocks : [{ label: "Content", value: content.heading }];
  }

  if (content.items?.length) {
    for (const item of content.items) {
      blocks.push({
        label: item.title,
        value: item.description,
      });
    }
    return blocks;
  }

  if (content.characters?.length) {
    for (const c of content.characters) {
      blocks.push({
        label: c.name,
        value: [c.role, c.description].filter(Boolean).join(" — "),
      });
    }
    return blocks;
  }

  if (content.comps?.length) {
    if (content.body) {
      blocks.push({ label: "Positioning", value: content.body });
    }
    for (const comp of content.comps) {
      blocks.push({ label: comp.title, value: comp.note });
    }
    return blocks;
  }

  if (content.bullets?.length) {
    return content.bullets.map((b, i) => ({
      label: content.bullets!.length > 1 ? `Point ${i + 1}` : "Content",
      value: b,
    }));
  }

  if (content.moodBlocks?.length) {
    if (content.body) {
      blocks.push({ label: "Visual Direction", value: content.body });
    }
    for (const m of content.moodBlocks) {
      blocks.push({ label: m.label, value: m.color });
    }
    return blocks;
  }

  if (content.subheading) {
    blocks.push({ label: "Subheading", value: content.subheading });
  }
  if (content.body) {
    blocks.push({
      label: slideType === "synopsis" ? "Synopsis" : "Content",
      value: content.body,
    });
  }
  if (content.footer) {
    blocks.push({ label: "Footer", value: content.footer });
  }

  if (blocks.length === 0 && content.heading) {
    blocks.push({ label: "Content", value: content.heading });
  }

  return blocks;
}

export function blocksToEditableText(blocks: SlideContentBlock[]): string {
  return blocks.map((b) => `${b.label}:\n${b.value}`).join("\n\n");
}

export function applyEditableTextToSlide(
  slide: Slide,
  text: string,
): Partial<SlideContent> {
  const { slideType, content } = slide;

  if (slideType === "cover") {
    const parts = text.split(/\n\n+/);
    const patch: Partial<SlideContent> = {};
    for (const part of parts) {
      const [label, ...rest] = part.split(":\n");
      const value = rest.join(":\n").trim();
      if (label === "Title") patch.heading = value.toUpperCase();
      if (label === "Tagline") patch.subheading = value;
      if (label === "Subtitle") patch.body = value;
      if (label === "Credit") patch.footer = value;
    }
    return Object.keys(patch).length ? patch : { body: text };
  }

  if (slideType === "logline") {
    return { body: text.replace(/^Logline:\n?/i, "").trim() || text };
  }

  if (content.items?.length || slideType === "genre_blend" || slideType === "market_potential") {
    const sections = text.split(/\n\n+/).filter(Boolean);
    const items = sections.map((section) => {
      const nl = section.indexOf("\n");
      if (nl === -1) {
        const colon = section.indexOf(":");
        if (colon > 0) {
          return {
            title: section.slice(0, colon).trim(),
            description: section.slice(colon + 1).trim(),
          };
        }
        return { title: section.trim(), description: "" };
      }
      const label = section.slice(0, nl).replace(/:$/, "").trim();
      const value = section.slice(nl + 1).trim();
      return { title: label, description: value };
    });
    return { items };
  }

  if (content.characters?.length) {
    const lines = text.split("\n").filter((l) => l.trim());
    const characters = lines.map((line) => {
      const [namePart, desc] = line.split(":").map((s) => s.trim());
      const [name, role] = (namePart ?? "").split("—").map((s) => s.trim());
      return {
        name: name || "Character",
        role: role || "",
        description: desc || "",
      };
    });
    return { characters };
  }

  if (content.bullets?.length) {
    const bullets = text
      .split("\n")
      .map((l) => l.replace(/^Point \d+:\s*/i, "").trim())
      .filter(Boolean);
    return { bullets };
  }

  return { body: text };
}
