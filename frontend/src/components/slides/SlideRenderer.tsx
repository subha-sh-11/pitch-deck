import type { Slide } from "@/types/slide";
import {
  CharacterSlide,
  ContactSlide,
  CoverSlide,
  GenericSlide,
  GenreBlendSlide,
  LoglineSlide,
  ShowCrossSlide,
  StoryWorldSlide,
  SynopsisSlide,
  TargetAudienceSlide,
  USPGridSlide,
  VisualAestheticSlide,
} from "./SlideTemplates";

interface SlideRendererProps {
  slide: Slide;
  className?: string;
}

export function SlideRenderer({ slide, className = "" }: SlideRendererProps) {
  const { content, slideType } = slide;

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
      case "contact":
        return <ContactSlide content={content} />;
      default:
        return <GenericSlide content={content} />;
    }
  })();

  return (
    <div className={`aspect-video w-full overflow-hidden ${className}`}>
      {template}
    </div>
  );
}
