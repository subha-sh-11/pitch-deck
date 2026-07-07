/**
 * Deck display fonts. Five are bundled at build time (next/font in layout.tsx) and referenced by a
 * short key; the rest are Google Fonts loaded ON DEMAND via an injected <link>, so the picker can
 * offer a wide genre-spanning set — and the director can import ANY Google font by name — without
 * bloating the build.
 */
export interface FontOption {
  /** Stored on the deck. A bundled key (cormorant…) or a Google Fonts family name. */
  value: string;
  label: string;
  /** Genre grouping for the picker. */
  genre: string;
  /** True for the 5 bundled next/font families (already in the document). */
  builtin?: boolean;
}

const BUILTIN = new Set(["cormorant", "playfair", "oswald", "anton", "poppins"]);

export const FONT_OPTIONS: FontOption[] = [
  // Elegant / literary / drama
  { value: "cormorant", label: "Cormorant", genre: "Elegant / Drama", builtin: true },
  { value: "playfair", label: "Playfair Display", genre: "Elegant / Drama", builtin: true },
  { value: "Cinzel", label: "Cinzel — epic", genre: "Elegant / Drama" },
  { value: "EB Garamond", label: "EB Garamond — literary", genre: "Elegant / Drama" },
  { value: "Abril Fatface", label: "Abril Fatface — fashion", genre: "Elegant / Drama" },
  // Poster / action / bold
  { value: "anton", label: "Anton", genre: "Poster / Action", builtin: true },
  { value: "oswald", label: "Oswald", genre: "Poster / Action", builtin: true },
  { value: "Bebas Neue", label: "Bebas Neue", genre: "Poster / Action" },
  { value: "Archivo Black", label: "Archivo Black", genre: "Poster / Action" },
  // Modern / clean sans
  { value: "poppins", label: "Poppins", genre: "Modern / Clean", builtin: true },
  { value: "Inter", label: "Inter", genre: "Modern / Clean" },
  { value: "Montserrat", label: "Montserrat", genre: "Modern / Clean" },
  // Horror / thriller
  { value: "Creepster", label: "Creepster — horror", genre: "Horror / Thriller" },
  { value: "Nosifer", label: "Nosifer — dripping", genre: "Horror / Thriller" },
  { value: "Metal Mania", label: "Metal Mania", genre: "Horror / Thriller" },
  // Comedy / family / comic
  { value: "Bangers", label: "Bangers — comic", genre: "Comedy / Family" },
  { value: "Fredoka", label: "Fredoka — friendly", genre: "Comedy / Family" },
  { value: "Comic Neue", label: "Comic Neue", genre: "Comedy / Family" },
  // Sci-fi / tech
  { value: "Orbitron", label: "Orbitron — sci-fi", genre: "Sci-Fi / Tech" },
  { value: "Audiowide", label: "Audiowide — tech", genre: "Sci-Fi / Tech" },
  // Romance / script
  { value: "Dancing Script", label: "Dancing Script", genre: "Romance / Script" },
  { value: "Great Vibes", label: "Great Vibes", genre: "Romance / Script" },
  { value: "Pacifico", label: "Pacifico — casual", genre: "Romance / Script" },
  // Western / noir / vintage
  { value: "Rye", label: "Rye — western", genre: "Western / Noir" },
  { value: "Special Elite", label: "Special Elite — typewriter", genre: "Western / Noir" },
];

const _loaded = new Set<string>();

/** Inject a Google Fonts stylesheet for a family (once). Bundled families are already present. */
export function loadFont(value: string | undefined): void {
  if (!value || _loaded.has(value) || BUILTIN.has(value)) return;
  _loaded.add(value);
  if (typeof document === "undefined") return;
  const family = value.trim().replace(/\s+/g, "+");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
  link.dataset.dynFont = value;
  document.head.appendChild(link);
}

/** The CSS `font-family` value to apply for a stored display-font key/name. */
export function fontFamilyOf(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const vars: Record<string, string> = {
    cormorant: "var(--font-cormorant)",
    playfair: "var(--font-playfair)",
    oswald: "var(--font-oswald)",
    anton: "var(--font-anton)",
    poppins: "var(--font-poppins)",
  };
  return vars[value] ?? `'${value}'`;
}
