import type { CSSProperties } from "react";
import type { DesignDirection, DesignMotif } from "@/types/design";
import type { Slide, SlideContent } from "@/types/slide";
import { fontFamilyOf } from "@/lib/fonts";
import { deriveTreatment } from "@/lib/reference-profile";
import { DEFAULT_SLIDE_APPEARANCE, getBackgroundCss } from "@/lib/slide-appearance";
import { SlideEditProvider, type ImageActions } from "./editing/SlideEditContext";
import { SlideMotifs } from "./shared/SlideMotifs";
import { SlideTreatmentProvider } from "./shared/SlideTreatmentContext";
import {
  CharacterSlide,
  ContactSlide,
  CoverSlide,
  GenericSlide,
  GenreBlendSlide,
  LoglineSlide,
  MarketPotentialSlide,
  RelationshipMapSlide,
  ShowCrossSlide,
  StoryWorldSlide,
  SynopsisSlide,
  TargetAudienceSlide,
  USPGridSlide,
  VisualAestheticSlide,
} from "./templates";

function byUsage(dd: DesignDirection | undefined, kw: string): string | undefined {
  return dd?.palette?.find((c) => (c.usage ?? "").toLowerCase().includes(kw))?.hex;
}

/** Accent color derived from the AI design palette (applied to every slide). */
function paletteAccent(dd?: DesignDirection): string | undefined {
  if (!dd?.palette?.length) return undefined;
  return (
    byUsage(dd, "accent") ??
    byUsage(dd, "highlight") ??
    dd.palette[Math.min(2, dd.palette.length - 1)]?.hex
  );
}

// "Loud" motifs (film-strip frame, inner border) only render on a few HERO slides, so the deck
// doesn't read the same on every slide. Subtle grain/vignette stay deck-wide for texture.
const HERO_MOTIF_SLIDES = new Set([
  "cover",
  "visual_aesthetic",
  "directors_vision",
  "story_world",
  "contact",
]);
const LOUD_MOTIFS = new Set(["film_strip", "frame"]);

interface SlideRendererProps {
  slide: Slide;
  className?: string;
  designDirection?: DesignDirection;
  /** Enable PPT-style inline editing (canvas only). */
  editing?: boolean;
  /** Persist a content patch (edited text, moved elements, text boxes, image). */
  onContentChange?: (patch: Partial<SlideContent>) => void;
  /** Image replace handlers (upload / regenerate). */
  imageActions?: ImageActions;
}

export function SlideRenderer({
  slide,
  className = "",
  designDirection,
  editing = false,
  onContentChange,
  imageActions,
}: SlideRendererProps) {
  const { content, slideType } = slide;
  const appearance = { ...DEFAULT_SLIDE_APPEARANCE, ...slide.appearance };
  const bgCss = getBackgroundCss(appearance.backgroundKey);

  // Reference-derived surface language (design_direction.referenceProfile). Neutral when no
  // profile exists, so decks without references render exactly as before.
  const treatment = deriveTreatment(designDirection?.referenceProfile);

  // The AI palette drives accent/text on every slide; a user-customized appearance wins.
  const accentColor =
    slide.appearance?.accentColor ?? paletteAccent(designDirection) ?? appearance.accentColor;
  const bgColor =
    byUsage(designDirection, "background") ?? byUsage(designDirection, "base") ?? "#0a0a0c";
  // Text that sits OVER a full-bleed photographic image must stay light (scrim-backed) for
  // legibility, no matter the deck theme — otherwise a light theme's dark text vanishes on a dark
  // photo. Text on the slide's own (theme) background follows the palette. Synopsis is excluded
  // because it renders its copy on a solid theme-coloured panel, not over the image.
  // A per-slide appearance.textColor override always wins.
  const overImage = Boolean(content.imageUrl) && slideType !== "synopsis";
  const themeText = byUsage(designDirection, "text") ?? "#F5F1E8";
  const textColor = slide.appearance?.textColor ?? (overImage ? "#F5F1E8" : themeText);
  // Muted tone blends toward the surface behind the text (a dark scrim over images, else the bg)
  // so secondary copy stays readable in both cases.
  const mutedColor = `color-mix(in srgb, ${textColor} 70%, ${overImage ? "#0a0a0c" : bgColor})`;
  const fontDisplay = fontFamilyOf(designDirection?.fonts?.display);

  const variantOverlay =
    appearance.styleVariant === "minimal"
      ? "opacity-[0.92]"
      : appearance.styleVariant === "bold"
        ? "contrast-[1.08] saturate-[1.1]"
        : "";

  // Backend layout decision (content-aware variant); templates fall back gracefully.
  const layoutType = slide.layout?.layoutType;
  const template = (() => {
    switch (slideType) {
      case "cover":
        return <CoverSlide content={content} layout={layoutType} />;
      case "logline":
        return <LoglineSlide content={content} layout={layoutType} appearance={appearance} />;
      case "genre_blend":
        return <GenreBlendSlide content={content} />;
      case "synopsis":
        return <SynopsisSlide content={content} layout={layoutType} />;
      case "story_world":
        return <StoryWorldSlide content={content} layout={layoutType} />;
      case "character":
      case "supporting_characters":
        return <CharacterSlide content={content} />;
      case "relationship_map":
        return <RelationshipMapSlide content={content} />;
      case "usp":
        return <USPGridSlide content={content} />;
      case "show_cross":
        return <ShowCrossSlide content={content} />;
      case "visual_aesthetic":
        return <VisualAestheticSlide content={content} />;
      case "target_audience":
        return <TargetAudienceSlide content={content} />;
      case "market_potential":
        return <MarketPotentialSlide content={content} />;
      case "contact":
        return <ContactSlide content={content} />;
      default:
        return <GenericSlide content={content} layout={layoutType} appearance={appearance} />;
    }
  })();

  // Profile-driven motifs join the design direction's own. A film-strip framing habit in the
  // references becomes a real compositional frame on IMAGE slides (strong bands), not just a
  // hero-slide decoration; grain/vignette read deck-wide like the reference's surface.
  const gatedMotifs = HERO_MOTIF_SLIDES.has(slideType)
    ? designDirection?.motifs
    : designDirection?.motifs?.filter((m) => !LOUD_MOTIFS.has(m));
  const profileMotifs: DesignMotif[] = [];
  const strongFilmStrip = treatment.filmStrip && Boolean(content.imageUrl);
  if (strongFilmStrip) profileMotifs.push("film_strip");
  if (treatment.frameBorder && HERO_MOTIF_SLIDES.has(slideType)) profileMotifs.push("frame");
  if (treatment.grainy) profileMotifs.push("grain");
  if (treatment.vignette && content.imageUrl) profileMotifs.push("vignette");
  const motifs = profileMotifs.length
    ? Array.from(new Set([...(gatedMotifs ?? []), ...profileMotifs]))
    : gatedMotifs;

  return (
    <div
      className={`relative aspect-video w-full overflow-hidden ${className}`}
      style={
        {
          "--slide-accent": accentColor,
          "--slide-text": textColor,
          "--slide-bg": bgColor,
          "--slide-text-muted": mutedColor,
          ...(fontDisplay ? { "--slide-font-display": fontDisplay } : {}),
          // Reference-profile surface vars — consumed by SlideFrame + templates, all with
          // no-op fallbacks so their absence changes nothing.
          ...(treatment.groundCss ? { "--slide-ground": treatment.groundCss } : {}),
          ...(treatment.padDeltaPct
            ? { "--slide-pad-delta": `${treatment.padDeltaPct}%` }
            : {}),
          ...(treatment.scrimStrong ? { "--slide-scrim-extra": "0.16" } : {}),
        } as CSSProperties
      }
    >
      {appearance.backgroundKey !== "default" && (
        <div
          className="absolute inset-0 z-0"
          style={{ background: bgCss }}
        />
      )}
      <div
        className={`relative z-10 h-full w-full ${variantOverlay}`}
        style={
          appearance.styleVariant === "bold"
            ? { boxShadow: `inset 0 0 0 3px ${appearance.accentColor}33` }
            : undefined
        }
      >
        <SlideTreatmentProvider value={treatment}>
          <SlideEditProvider
            content={content}
            editing={editing}
            onContentChange={onContentChange}
            imageActions={imageActions}
          >
            {template}
          </SlideEditProvider>
        </SlideTreatmentProvider>
      </div>
      {/* Graphic motifs from the design direction (+ the reference profile's surface language).
          Loud ones (film-strip, frame) are limited to HERO slides so the deck varies — except a
          reference-mandated film strip, which frames every image slide. Subtle grain/vignette
          stay deck-wide for texture. */}
      <SlideMotifs motifs={motifs} strongFilmStrip={strongFilmStrip} />
      {/* Consistent slide nav per the deck spec: section label bottom-left, slide number
          bottom-right. Subtle, non-interactive, kept in the bottom margin so it never covers copy.
          Omitted on the cover and closing/contact slides. */}
      {slideType !== "cover" && slideType !== "contact" && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-between px-[4.5%] pb-[2.2%] text-[10px] uppercase tracking-[0.22em]"
          style={{ color: "var(--slide-text-muted, #9CA3AF)", opacity: 0.72 }}
          aria-hidden
        >
          <span>{slideType.replace(/_/g, " ")}</span>
          {slide.slideNumber ? <span>{String(slide.slideNumber).padStart(2, "0")}</span> : null}
        </div>
      )}
    </div>
  );
}
