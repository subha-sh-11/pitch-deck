import type { PitchTemplate } from "@/types/template";

export type TemplatePreviewLayout =
  | "thriller-dark"
  | "streaming-neon"
  | "festival-editorial"
  | "series-grid"
  | "documentary-warm"
  | "action-bold";

export interface TemplatePreviewTheme {
  layout: TemplatePreviewLayout;
  gradient: string;
  accent: string;
  secondary: string;
}

export const templatePreviewThemes: Record<string, TemplatePreviewTheme> = {
  "investor-thriller": {
    layout: "thriller-dark",
    gradient: "linear-gradient(145deg, #050505 0%, #1a1a1f 40%, #3F5F4A 100%)",
    accent: "#22d3ee",
    secondary: "#8A4B2A",
  },
  "ott-streaming": {
    layout: "streaming-neon",
    gradient: "linear-gradient(135deg, #0a0a12 0%, #1e1b4b 50%, #0891b2 100%)",
    accent: "#a3e635",
    secondary: "#22d3ee",
  },
  "festival-directors": {
    layout: "festival-editorial",
    gradient: "linear-gradient(160deg, #111113 0%, #27272a 55%, #52525b 100%)",
    accent: "#fafafa",
    secondary: "#a1a1aa",
  },
  "series-bible-lite": {
    layout: "series-grid",
    gradient: "linear-gradient(120deg, #18181b 0%, #3F5F4A 45%, #050505 100%)",
    accent: "#67e8f9",
    secondary: "#3F5F4A",
  },
  "documentary-realism": {
    layout: "documentary-warm",
    gradient: "linear-gradient(180deg, #1c1917 0%, #44403c 50%, #78716c 100%)",
    accent: "#a8a29e",
    secondary: "#d6d3d1",
  },
  "action-blockbuster": {
    layout: "action-bold",
    gradient: "linear-gradient(135deg, #09090b 0%, #7f1d1d 45%, #18181b 100%)",
    accent: "#f87171",
    secondary: "#22d3ee",
  },
};

export function getTemplatePreviewTheme(template: PitchTemplate): TemplatePreviewTheme {
  return (
    templatePreviewThemes[template.id] ?? {
      layout: "thriller-dark",
      gradient: "linear-gradient(145deg, #050505, #27272a)",
      accent: "#22d3ee",
      secondary: "#52525b",
    }
  );
}
