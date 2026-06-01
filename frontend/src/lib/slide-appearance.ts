import type { SlideAppearance, SlideBackgroundKey, SlideStyleVariant } from "@/types/slide";

export const DEFAULT_SLIDE_APPEARANCE: SlideAppearance = {
  styleVariant: "cinematic",
  accentColor: "#22d3ee",
  backgroundKey: "default",
};

export const SLIDE_STYLE_OPTIONS: { id: SlideStyleVariant; label: string }[] = [
  { id: "cinematic", label: "Cinematic" },
  { id: "minimal", label: "Minimal" },
  { id: "bold", label: "Bold" },
];

export const SLIDE_COLOR_SWATCHES = [
  { id: "cyan", hex: "#22d3ee", label: "Electric blue" },
  { id: "lime", hex: "#a3e635", label: "Lime" },
  { id: "zinc", hex: "#71717a", label: "Zinc" },
  { id: "white", hex: "#fafafa", label: "White" },
  { id: "indigo", hex: "#818cf8", label: "Indigo" },
  { id: "black", hex: "#18181b", label: "Black" },
];

export const SLIDE_BACKGROUND_OPTIONS: {
  id: SlideBackgroundKey;
  label: string;
  preview: string;
}[] = [
  {
    id: "default",
    label: "Default",
    preview: "linear-gradient(135deg, #141418, #080808)",
  },
  {
    id: "warm-portrait",
    label: "Warm portrait",
    preview: "linear-gradient(160deg, #3d2a24 0%, #8b5a4a 40%, #1a1210 100%)",
  },
  {
    id: "concrete",
    label: "Concrete",
    preview: "linear-gradient(145deg, #2A2A2A, #101010)",
  },
  {
    id: "water",
    label: "Water",
    preview: "linear-gradient(180deg, #1a1a1f 0%, #3F5F4A 50%, #A9C6C7 100%)",
  },
  {
    id: "dark-gradient",
    label: "Dark gradient",
    preview: "linear-gradient(135deg, #050505, #1a1a2e)",
  },
];

export function getBackgroundCss(key: SlideBackgroundKey): string {
  return (
    SLIDE_BACKGROUND_OPTIONS.find((b) => b.id === key)?.preview ??
    SLIDE_BACKGROUND_OPTIONS[0].preview
  );
}

export const SLIDE_TRANSITIONS = [
  "None",
  "Fade",
  "Slide up",
  "Slide left",
  "Zoom",
  "Cinematic dissolve",
];
