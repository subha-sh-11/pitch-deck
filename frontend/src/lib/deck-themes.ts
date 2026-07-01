import type { ColorToken, DesignDirection } from "@/types/design";

// Minimal valid design used as a base when the deck hasn't carried one yet.
export const FALLBACK_DESIGN: DesignDirection = {
  mood: "Cinematic",
  cinematicTone: "Grounded, atmospheric",
  palette: [
    { name: "Base", hex: "#0A0F14", usage: "background" },
    { name: "Accent", hex: "#22D3EE", usage: "accent" },
    { name: "Text", hex: "#E6F6FA", usage: "text" },
  ],
  typography: { headings: "Display serif", body: "Humanist sans", accents: "Uppercase", treatment: "Minimal" },
  visualStyle: ["Cinematic"],
  backgroundStyle: "Dark textured",
  imageStyle: "Cinematic, realistic lighting",
  layoutStyle: "Asymmetric, generous negative space",
  rationale: "",
};

export interface DeckTheme {
  name: string;
  /** 3 swatch colours for the picker chip: [base, accent, text]. */
  swatches: [string, string, string];
  palette: ColorToken[];
}

const theme = (name: string, base: string, accent: string, text: string): DeckTheme => ({
  name,
  swatches: [base, accent, text],
  palette: [
    { name: "Base", hex: base, usage: "background" },
    { name: "Accent", hex: accent, usage: "accent" },
    { name: "Text", hex: text, usage: "text" },
  ],
});

// Brightness-varied so the picker is never dark-only. Dark themes use light text;
// light themes use dark text (the renderer's byUsage() reads these by `usage`).
export const DECK_THEMES: DeckTheme[] = [
  // Dark
  theme("Cinematic Noir", "#0B0B0D", "#B8862F", "#EDE7DA"),
  theme("Electric Teal", "#0A0F14", "#22D3EE", "#E6F6FA"),
  theme("Crimson Bold", "#0A0A0A", "#E11D48", "#FAFAFA"),
  // Light / warm
  theme("Warm Cream", "#F3E9D8", "#C16A4B", "#3A2A1C"),
  theme("Sunlit Pop", "#FFF7E6", "#FF6F61", "#2B2B2B"),
  theme("Daylight Sage", "#EDF2EC", "#2F5A57", "#1E2A26"),
];

/** Replace (or insert) the accent colour in a design's palette — returns a new design. */
export function withAccent(design: DesignDirection, hex: string): DesignDirection {
  const palette = [...(design.palette ?? [])];
  const i = palette.findIndex((c) => (c.usage ?? "").toLowerCase().includes("accent"));
  if (i >= 0) palette[i] = { ...palette[i], hex };
  else palette.push({ name: "Accent", hex, usage: "accent" });
  return { ...design, palette };
}

/** Current accent hex from a design, for the colour input. */
export function accentOf(design: DesignDirection | null | undefined): string {
  const c = design?.palette?.find((p) => (p.usage ?? "").toLowerCase().includes("accent"));
  return c?.hex ?? "#22D3EE";
}
