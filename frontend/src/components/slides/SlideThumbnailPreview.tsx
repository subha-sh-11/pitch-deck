import type { Slide, SlideType } from "@/types/slide";
import { SLIDE_TYPE_LABELS } from "@/types/slide";

interface SlideThumbnailPreviewProps {
  slide: Slide;
  active?: boolean;
}

export function SlideThumbnailPreview({ slide, active }: SlideThumbnailPreviewProps) {
  const { slideType, content } = slide;

  return (
    <div
      className={`relative aspect-video w-full overflow-hidden rounded-md ${
        active ? "ring-1 ring-[#22d3ee]/40" : ""
      }`}
    >
      <ThumbnailArt slideType={slideType} content={content} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
      {active && (
        <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(34,211,238,0.15)]" />
      )}
    </div>
  );
}

function ThumbnailArt({
  slideType,
  content,
}: {
  slideType: SlideType;
  content: Slide["content"];
}) {
  const base = "absolute inset-0 bg-[#0c0c0e]";

  switch (slideType) {
    case "cover":
      return (
        <div className={base}>
          <div className="absolute inset-0 bg-gradient-to-br from-[#141418] to-[#080808]" />
          <div className="absolute bottom-0 right-0 h-3/4 w-1/2 rounded-tl-full bg-[#2A2A2A]/80" />
          <div className="absolute bottom-2 left-2 right-[45%]">
            <p className="truncate font-display text-[7px] font-bold text-[#F5F1E8]">
              {content.heading}
            </p>
          </div>
        </div>
      );
    case "logline":
      return (
        <div className={base}>
          <div className="absolute left-1 top-1 bottom-1 w-0.5 bg-[#22d3ee]" />
          <div className="absolute left-2.5 right-1 top-2 space-y-0.5">
            <div className="h-0.5 w-4 bg-[#22d3ee]/60" />
            <div className="h-0.5 w-full bg-white/10" />
            <div className="h-0.5 w-3/4 bg-white/10" />
          </div>
        </div>
      );
    case "genre_blend":
      return (
        <div className={base}>
          <div className="absolute inset-1 grid grid-cols-3 gap-0.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-sm bg-gradient-to-b from-white/[0.06] to-transparent"
              />
            ))}
          </div>
        </div>
      );
    case "synopsis":
      return (
        <div className={base}>
          <div className="absolute inset-0 grid grid-cols-2">
            <div className="space-y-0.5 p-1">
              <div className="h-0.5 w-3 bg-white/20" />
              <div className="h-0.5 w-full bg-white/10" />
              <div className="h-0.5 w-4/5 bg-white/10" />
            </div>
            <div className="bg-gradient-to-br from-[#3F5F4A]/40 to-[#2A2A2A]" />
          </div>
        </div>
      );
    case "story_world":
      return (
        <div className={base}>
          <div className="absolute inset-1 grid grid-cols-2 grid-rows-2 gap-0.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-sm border border-white/[0.06] bg-white/[0.03]" />
            ))}
          </div>
        </div>
      );
    case "character":
    case "supporting_characters":
      return (
        <div className={base}>
          <div className="absolute inset-1 grid grid-cols-3 gap-0.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col rounded-sm bg-white/[0.04] p-0.5">
                <div className="mb-0.5 h-2 w-full rounded-sm bg-[#8A4B2A]/30" />
                <div className="h-0.5 w-2/3 bg-white/20" />
              </div>
            ))}
          </div>
        </div>
      );
    case "usp":
      return (
        <div className={base}>
          <div className="absolute inset-1 grid grid-cols-2 gap-0.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-0.5 rounded-sm bg-white/[0.04] p-0.5">
                <div className="h-1 w-1 rounded-sm bg-[#22d3ee]/60" />
                <div className="h-0.5 flex-1 bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      );
    case "show_cross":
      return (
        <div className={base}>
          <div className="absolute inset-1 grid grid-cols-3 gap-0.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-sm bg-gradient-to-b from-[#2A2A2A] to-[#1a1a1f]"
              />
            ))}
          </div>
        </div>
      );
    case "visual_aesthetic":
      return (
        <div className={base}>
          <div className="absolute inset-1 grid grid-cols-3 grid-rows-2 gap-0.5">
            {["#2A2A2A", "#3F5F4A", "#8A4B2A", "#A9C6C7", "#1a1a1f", "#22d3ee"].map(
              (color) => (
                <div key={color} className="rounded-sm" style={{ backgroundColor: color }} />
              ),
            )}
          </div>
        </div>
      );
    case "target_audience":
      return (
        <div className={base}>
          <div className="absolute inset-1 grid grid-cols-2 gap-0.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-sm border border-[#22d3ee]/20 bg-[#22d3ee]/10"
              />
            ))}
          </div>
        </div>
      );
    case "market_potential":
      return (
        <div className={base}>
          <div className="absolute inset-1 grid grid-cols-2 gap-0.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-sm bg-white/[0.04] p-0.5">
                <div className="mb-0.5 h-0.5 w-2 bg-[#22d3ee]" />
                <div className="h-0.5 w-full bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      );
    case "contact":
      return (
        <div className={base}>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="h-px w-4 bg-[#22d3ee]/60" />
            <div className="mt-1 h-0.5 w-6 bg-white/20" />
            <div className="mt-0.5 h-0.5 w-4 bg-white/10" />
          </div>
        </div>
      );
    default:
      return (
        <div className={base}>
          <div className="absolute inset-2 space-y-1">
            <div className="h-0.5 w-4 bg-[#22d3ee]/50" />
            <div className="h-0.5 w-full bg-white/10" />
            <div className="h-0.5 w-3/4 bg-white/10" />
          </div>
          <span className="absolute bottom-1 right-1 text-[6px] text-white/30">
            {SLIDE_TYPE_LABELS[slideType] ?? slideType}
          </span>
        </div>
      );
  }
}
