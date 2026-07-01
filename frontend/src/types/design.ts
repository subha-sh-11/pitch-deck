export interface ColorToken {
  name: string;
  hex: string;
  usage?: string;
}

export interface TypographyDirection {
  headings: string;
  body: string;
  accents: string;
  treatment: string;
}

export interface DesignFonts {
  display: string;
  body?: string;
}

/** Graphic motifs the deck carries deck-wide (rendered by SlideMotifs), derived from the
 * design direction / the director's reference images. */
export type DesignMotif = "film_strip" | "grain" | "vignette" | "frame";

export interface DesignDirection {
  mood: string;
  cinematicTone: string;
  palette: ColorToken[];
  typography: TypographyDirection;
  visualStyle: string[];
  backgroundStyle: string;
  imageStyle: string;
  layoutStyle: string;
  rationale: string;
  fonts?: DesignFonts;
  /** Recurring graphic motifs applied across every slide (e.g. film-strip edges, grain). */
  motifs?: DesignMotif[];
}
