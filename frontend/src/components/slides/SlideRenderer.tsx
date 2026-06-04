import type { CSSProperties } from "react";
import type { DesignDirection } from "@/types/design";
import type { Slide } from "@/types/slide";
import { DEFAULT_SLIDE_APPEARANCE, getBackgroundCss } from "@/lib/slide-appearance";
import {
  CharacterSlide,
  ContactSlide,
  CoverSlide,
  GenericSlide,
  GenreBlendSlide,
  LoglineSlide,
  MarketPotentialSlide,
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

// Theme display fonts → the CSS vars loaded in layout.tsx.
const FONT_VARS: Record<string, string> = {
  cormorant: "var(--font-cormorant)",
  playfair: "var(--font-playfair)",
  oswald: "var(--font-oswald)",
  poppins: "var(--font-poppins)",
  anton: "var(--font-anton)",
};

interface SlideRendererProps {
  slide: Slide;
  className?: string;
  designDirection?: DesignDirection;
}

export function SlideRenderer({ slide, className = "", designDirection }: SlideRendererProps) {
  const { content, slideType } = slide;
  const appearance = { ...DEFAULT_SLIDE_APPEARANCE, ...slide.appearance };
  const bgCss = getBackgroundCss(appearance.backgroundKey);

  // The AI palette drives accent/text on every slide; a user-customized appearance wins.
  const accentColor =
    slide.appearance?.accentColor ?? paletteAccent(designDirection) ?? appearance.accentColor;
  const textColor = byUsage(designDirection, "text");
  const fontDisplay = designDirection?.fonts?.display
    ? FONT_VARS[designDirection.fonts.display]
    : undefined;

  const variantOverlay =
    appearance.styleVariant === "minimal"
      ? "opacity-[0.92]"
      : appearance.styleVariant === "bold"
        ? "contrast-[1.08] saturate-[1.1]"
        : "";

  const template = (() => {
    switch (slideType) {
      case "cover":
        return <CoverSlide content={content} />;
      case "logline":
        return <LoglineSlide content={content} />;
      case "genre_blend":
        return <GenreBlendSlide content={content} />;
      case "synopsis":
        return <SynopsisSlide content={content} />;
      case "story_world":
        return <StoryWorldSlide content={content} />;
      case "character":
      case "supporting_characters":
        return <CharacterSlide content={content} />;
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
        return <GenericSlide content={content} />;
    }
  })();

  return (
    <div
      className={`relative aspect-video w-full overflow-hidden ${className}`}
      style={
        {
          "--slide-accent": accentColor,
          ...(textColor ? { "--slide-text": textColor } : {}),
          ...(fontDisplay ? { "--slide-font-display": fontDisplay } : {}),
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
        {template}
      </div>
    </div>
  );
}
