import type { PitchTemplate } from "@/types/template";
import { mockDesignDirection, mockOutline } from "./mock-deck";

const investorOutline = mockOutline.filter((s) => s.slideNumber <= 14);

const ottOutline = [
  mockOutline[0],
  mockOutline[1],
  mockOutline[2],
  mockOutline[3],
  mockOutline[4],
  mockOutline[5],
  mockOutline[7],
  mockOutline[8],
  mockOutline[9],
  mockOutline[10],
  mockOutline[12],
  mockOutline[15],
].map((item, i) => ({ ...item, slideNumber: i + 1 }));

const festivalOutline = [
  mockOutline[0],
  mockOutline[1],
  mockOutline[2],
  mockOutline[3],
  mockOutline[4],
  mockOutline[5],
  mockOutline[8],
  mockOutline[9],
  mockOutline[10],
  mockOutline[13],
  mockOutline[14],
  mockOutline[15],
].map((item, i) => ({ ...item, slideNumber: i + 1 }));

const seriesOutline = [
  mockOutline[0],
  mockOutline[1],
  mockOutline[2],
  mockOutline[3],
  mockOutline[4],
  mockOutline[5],
  mockOutline[6],
  mockOutline[7],
  mockOutline[8],
  mockOutline[10],
  mockOutline[12],
  mockOutline[13],
  mockOutline[14],
  mockOutline[15],
].map((item, i) => ({ ...item, slideNumber: i + 1 }));

export const mockTemplates: PitchTemplate[] = [
  {
    id: "investor-thriller",
    name: "Investor Thriller Deck",
    description:
      "Built for financiers and producers. Emphasizes market potential, budget scale, and commercial hook.",
    slideCount: investorOutline.length,
    slideOutline: investorOutline,
    designDirection: mockDesignDirection,
    matchTags: [
      "survival",
      "thriller",
      "investor",
      "suspense",
      "dark",
      "contained",
    ],
  },
  {
    id: "ott-streaming",
    name: "OTT / Streaming Pitch",
    description:
      "Audience-first structure for platform executives. Highlights bingeability, genre blend, and release fit.",
    slideCount: ottOutline.length,
    slideOutline: ottOutline,
    designDirection: {
      ...mockDesignDirection,
      mood: "Dark survival thriller with streaming-forward clarity",
      cinematicTone: "Urgent, emotional, platform-ready, high contrast",
    },
    matchTags: ["ott", "streaming", "audience", "telugu", "series", "thriller"],
  },
  {
    id: "festival-directors",
    name: "Festival Director's Vision",
    description:
      "Craft and vision led. Ideal for festival programmers and creative attachments.",
    slideCount: festivalOutline.length,
    slideOutline: festivalOutline,
    designDirection: {
      ...mockDesignDirection,
      mood: "Author-driven cinematic atmosphere",
      layoutStyle:
        "Poetic cover slides, visual-first story world, minimal market copy",
    },
    matchTags: ["festival", "director", "vision", "poetic", "artistic"],
  },
  {
    id: "series-bible-lite",
    name: "Series Bible Lite",
    description:
      "Expanded character and world focus for limited series or multi-season OTT pitches.",
    slideCount: seriesOutline.length,
    slideOutline: seriesOutline,
    designDirection: {
      ...mockDesignDirection,
      mood: "Episodic tension with world-building depth",
    },
    matchTags: ["web series", "series", "character", "world", "ott"],
  },
];

export function getTemplateById(id: string): PitchTemplate | undefined {
  return mockTemplates.find((t) => t.id === id);
}

export function scoreTemplateMatch(
  template: PitchTemplate,
  genreBlend: string,
  tone: string,
): number {
  const haystack = `${genreBlend} ${tone}`.toLowerCase();
  return template.matchTags.reduce(
    (score, tag) => (haystack.includes(tag) ? score + 1 : score),
    0,
  );
}

export function getRecommendedTemplates(
  genreBlend: string,
  tone: string,
): PitchTemplate[] {
  return [...mockTemplates].sort(
    (a, b) =>
      scoreTemplateMatch(b, genreBlend, tone) -
      scoreTemplateMatch(a, genreBlend, tone),
  );
}
