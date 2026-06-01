import type { CSSProperties } from "react";
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

interface SlideRendererProps {
  slide: Slide;
  className?: string;
}

export function SlideRenderer({ slide, className = "" }: SlideRendererProps) {
  const { content, slideType } = slide;
  const appearance = { ...DEFAULT_SLIDE_APPEARANCE, ...slide.appearance };
  const bgCss = getBackgroundCss(appearance.backgroundKey);

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
          "--slide-accent": appearance.accentColor,
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
