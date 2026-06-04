import type { SlideType } from "@/types/slide";

/** Slide types a user can add from the editor's "Add slide" menu. */
export const ADDABLE_SLIDE_TYPES: {
  slideType: SlideType;
  title: string;
  purpose: string;
}[] = [
  { slideType: "cover", title: "Cover", purpose: "Title and tone." },
  { slideType: "logline", title: "Logline", purpose: "Story hook." },
  { slideType: "synopsis", title: "Synopsis", purpose: "Story journey." },
  { slideType: "character", title: "Characters", purpose: "Key characters." },
  { slideType: "usp", title: "USP", purpose: "Unique selling points." },
  { slideType: "show_cross", title: "Show Cross", purpose: "Comparable films." },
  { slideType: "visual_aesthetic", title: "Visual Aesthetic", purpose: "Mood and look." },
  { slideType: "target_audience", title: "Target Audience", purpose: "Audience fit." },
  { slideType: "generic", title: "Custom Slide", purpose: "Additional content." },
];
