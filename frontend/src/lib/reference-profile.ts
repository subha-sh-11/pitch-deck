import type { ReferenceProfile } from "@/types/design";

/**
 * Turns the loose, model-authored referenceProfile (design_direction.referenceProfile) into a
 * small, typed "slide treatment" the templates can render deterministically.
 *
 * Every field of the profile is free text from the reference_analysis agent, so this module is
 * the ONE place that parses it (case-insensitive keyword matching, defensive against missing /
 * malformed values). Templates never touch the raw profile.
 *
 * With no profile, `deriveTreatment` returns DEFAULT_TREATMENT — every value is a no-op, so a
 * deck without references renders exactly as before.
 */

export type DisplayScale = "default" | "large" | "oversized";
export type TitlePlacement = "default" | "centered" | "lower-left";
export type WhitespaceMode = "default" | "airy" | "tight";

export interface SlideTreatment {
  /** True when a reference profile is present (used to gate profile-only flourishes). */
  hasProfile: boolean;
  /** typography.scale → display headings scale up on cover / logline / statement slides. */
  displayScale: DisplayScale;
  /** layout.titlePlacement → cover/divider title position (centered vs lower-left over image). */
  titlePlacement: TitlePlacement;
  /** layout.whitespace + layout.density → padding & decorative-element budget. */
  whitespace: WhitespaceMode;
  /** Padding delta (percentage points) added to each template's base content padding,
   * exposed as the --slide-pad-delta CSS var. airy → +1.75, tight → -1.5, else 0. */
  padDeltaPct: number;
  /** composition / slideTreatments.moodBoard mentions collage → moodboard renders as a
   * collage (rotated, offset, framed tiles) instead of a flat grid. */
  collage: boolean;
  /** imageTreatment.overlays describes scrims → extra dim layer under text over images. */
  scrimStrong: boolean;
  /** surface.framing mentions film-strip → strong film-strip bands frame image slides. */
  filmStrip: boolean;
  /** surface.framing mentions borders/frames (non film-strip) → inner frame on hero slides. */
  frameBorder: boolean;
  /** imageTreatment.texture / surface mentions grain → deck-wide grain motif. */
  grainy: boolean;
  /** imageTreatment.overlays mentions vignette → deck-wide vignette motif. */
  vignette: boolean;
  /** surface.backgrounds describes a gradient ground → full CSS background built from the
   * profile's dominant palette, exposed as the --slide-ground CSS var. */
  groundCss: string | null;
}

export const DEFAULT_TREATMENT: SlideTreatment = {
  hasProfile: false,
  displayScale: "default",
  titlePlacement: "default",
  whitespace: "default",
  padDeltaPct: 0,
  collage: false,
  scrimStrong: false,
  filmStrip: false,
  frameBorder: false,
  grainy: false,
  vignette: false,
  groundCss: null,
};

function mentions(v: unknown, ...keywords: string[]): boolean {
  if (typeof v !== "string" || !v) return false;
  const s = v.toLowerCase();
  return keywords.some((k) => s.includes(k));
}

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function asHex(v: unknown): string | null {
  return typeof v === "string" && HEX_RE.test(v.trim()) ? v.trim() : null;
}

export function deriveTreatment(profile?: ReferenceProfile | null): SlideTreatment {
  if (!profile || typeof profile !== "object") return DEFAULT_TREATMENT;

  const layout = profile.layout ?? {};
  const typography = profile.typography ?? {};
  const surface = profile.surface ?? {};
  const imageTreatment = profile.imageTreatment ?? {};
  const surfaceMotifs = Array.isArray(surface.motifs) ? surface.motifs.join(" · ") : "";

  // ── Typography scale ──
  const displayScale: DisplayScale = mentions(typography.scale, "oversized", "huge", "massive")
    ? "oversized"
    : mentions(typography.scale, "large")
      ? "large"
      : "default";

  // ── Title placement (cover / divider-like slides) ──
  const titlePlacement: TitlePlacement = mentions(layout.titlePlacement, "center")
    ? "centered"
    : mentions(layout.titlePlacement, "lower", "bottom")
      ? "lower-left"
      : "default";

  // ── Whitespace / density → padding + decoration budget ──
  const whitespace: WhitespaceMode =
    mentions(layout.whitespace, "high") || mentions(layout.density, "minimal")
      ? "airy"
      : mentions(layout.whitespace, "low") || mentions(layout.density, "dense")
        ? "tight"
        : "default";
  const padDeltaPct = whitespace === "airy" ? 1.75 : whitespace === "tight" ? -1.5 : 0;

  // ── Surface language ──
  const framing = `${surface.framing ?? ""} ${surfaceMotifs}`;
  const filmStrip = mentions(framing, "film-strip", "film strip", "filmstrip", "sprocket");
  const frameBorder =
    !filmStrip && mentions(framing, "border", "frame", "inset", "keyline", "rule");
  const grainy = mentions(
    `${imageTreatment.texture ?? ""} ${surface.backgrounds ?? ""} ${surfaceMotifs}`,
    "grain",
    "halation",
    "texture",
    "paper",
    "dust",
    "scratch",
  );
  const scrimStrong = mentions(
    imageTreatment.overlays,
    "scrim",
    "overlay",
    "gradient",
    "dark",
    "dim",
  );
  const vignette = mentions(
    `${imageTreatment.overlays ?? ""} ${surfaceMotifs}`,
    "vignette",
  );

  // ── Gradient ground built from the profile's own dominant colours ──
  const wantsGradient =
    mentions(surface.backgrounds, "gradient") || mentions(profile.palette?.ground, "gradient");
  const dominant = (profile.palette?.dominant ?? [])
    .map(asHex)
    .filter((c): c is string => Boolean(c));
  let groundCss: string | null = null;
  if (wantsGradient && dominant.length > 0) {
    const c0 = dominant[0];
    const c1 = dominant[1] ?? `color-mix(in srgb, ${c0} 80%, #000)`;
    groundCss = `linear-gradient(168deg, ${c1} 0%, ${c0} 58%, color-mix(in srgb, ${c0} 72%, #000) 100%)`;
  }

  // ── Moodboard collage ──
  const collage = mentions(
    `${profile.composition ?? ""} ${profile.slideTreatments?.moodBoard ?? ""}`,
    "collage",
    "scrapbook",
    "layered",
    "mosaic",
    "overlap",
  );

  return {
    hasProfile: true,
    displayScale,
    titlePlacement,
    whitespace,
    padDeltaPct,
    collage,
    scrimStrong,
    filmStrip,
    frameBorder,
    grainy,
    vignette,
    groundCss,
  };
}
