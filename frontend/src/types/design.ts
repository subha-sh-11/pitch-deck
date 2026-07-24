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

// ── Reference-derived visual profile ──
// Produced by the backend reference_analysis agent from the director's uploaded references
// and embedded (slim) at design_direction.referenceProfile. All fields are loose descriptive
// strings straight from the model — consumers parse them defensively (see lib/reference-profile).

export interface ReferenceProfilePalette {
  dominant?: string[];
  supporting?: string[];
  accent?: string[];
  /** "dark | light | textured | image-based | mixed" */
  ground?: string;
}

export interface ReferenceProfileTypography {
  /** e.g. "large condensed sans, tight tracking" */
  character?: string;
  /** "oversized | large | moderate | small-editorial" */
  scale?: string;
  hierarchy?: string;
}

export interface ReferenceProfileLayout {
  /** "minimal | moderate | dense" */
  density?: string;
  /** "low | medium | high" */
  whitespace?: string;
  symmetry?: string;
  imageToText?: string;
  /** e.g. "lower-left over image", "centered" */
  titlePlacement?: string;
  textPerSlide?: string;
}

export interface ReferenceProfileImageTreatment {
  cropping?: string;
  grading?: string;
  /** e.g. "film grain, slight halation" */
  texture?: string;
  /** e.g. "dark bottom scrim under text" */
  overlays?: string;
}

export interface ReferenceProfileSurface {
  /** ground treatment, e.g. "near-black with subtle grain", "warm gradient over dark" */
  backgrounds?: string;
  /** "borders/frames/masks/film-strip/none" */
  framing?: string;
  motifs?: string[];
  dividers?: string;
}

export interface ReferenceProfileSlideTreatments {
  cover?: string;
  character?: string;
  /** "collage vs single-image atmosphere" */
  moodBoard?: string;
}

export interface ReferenceProfile {
  style?: string;
  mood?: string;
  palette?: ReferenceProfilePalette;
  typography?: ReferenceProfileTypography;
  layout?: ReferenceProfileLayout;
  composition?: string;
  imageTreatment?: ReferenceProfileImageTreatment;
  surface?: ReferenceProfileSurface;
  slideTreatments?: ReferenceProfileSlideTreatments;
  synthesis?: string;
}

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
  /** Slim copy of the reference-derived visual profile (backend reference_analysis agent).
   * When present, slide templates render the reference's surface language (grounds, framing,
   * type scale, collage habits). Absent → the deck renders exactly as before. */
  referenceProfile?: ReferenceProfile | null;
}
