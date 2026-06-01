import type { Slide, SlideType } from "@/types/slide";

interface SlideMiniArtProps {
  slide: Slide;
  className?: string;
}

export function SlideMiniArt({ slide, className = "" }: SlideMiniArtProps) {
  const { slideType, content } = slide;
  const base = "absolute inset-0 bg-[#0a0a0c]";

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <MiniLayout slideType={slideType} content={content} base={base} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/25" />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_40px_rgba(34,211,238,0.06)]" />
    </div>
  );
}

function MiniLayout({
  slideType,
  content,
  base,
}: {
  slideType: SlideType;
  content: Slide["content"];
  base: string;
}) {
  switch (slideType) {
    case "cover":
      return (
        <div className={base}>
          <div className="absolute inset-0 bg-gradient-to-br from-[#141418] via-[#0c0c0e] to-[#050505]" />
          <div className="absolute -right-[10%] bottom-0 h-[85%] w-[55%] rounded-tl-[40%] bg-gradient-to-tl from-[#3F5F4A]/50 to-[#2A2A2A]/30" />
          <div className="absolute bottom-[18%] left-[8%] right-[42%]">
            <p className="font-display text-[11px] font-bold tracking-[0.12em] text-white/95 sm:text-sm">
              {content.heading}
            </p>
            {content.subheading && (
              <p className="mt-1 text-[7px] italic text-accent-neon/90 sm:text-[9px]">
                {content.subheading}
              </p>
            )}
            <div className="mt-2 h-px w-10 bg-gradient-to-r from-accent-neon/60 to-transparent" />
          </div>
        </div>
      );
    case "logline":
      return (
        <div className={base}>
          <div className="absolute left-[6%] top-[12%] bottom-[12%] w-0.5 bg-accent-neon shadow-[0_0_12px_rgba(34,211,238,0.5)]" />
          <div className="absolute left-[10%] right-[8%] top-[20%] space-y-2">
            <div className="h-1 w-12 rounded-full bg-accent-neon/40" />
            <div className="space-y-1">
              <div className="h-0.5 w-full rounded bg-white/15" />
              <div className="h-0.5 w-[92%] rounded bg-white/10" />
              <div className="h-0.5 w-[78%] rounded bg-white/10" />
            </div>
          </div>
        </div>
      );
    case "genre_blend":
      return (
        <div className={base}>
          <div className="absolute inset-[8%] grid grid-cols-3 gap-1.5">
            {(content.items ?? [1, 2, 3]).slice(0, 3).map((item, i) => (
              <div
                key={i}
                className="flex flex-col justify-end rounded-md border border-white/[0.08] bg-gradient-to-b from-white/[0.07] to-transparent p-1.5"
              >
                <div className="mb-1 h-0.5 w-3/4 rounded bg-accent-neon/50" />
                <div className="h-0.5 w-full rounded bg-white/10" />
                {typeof item === "object" && "title" in item && (
                  <p className="mt-1 truncate text-[5px] text-white/40">{item.title}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    case "story_world":
      return (
        <div className={base}>
          <div className="absolute inset-[8%] grid grid-cols-2 grid-rows-2 gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-md border border-white/[0.08] bg-gradient-to-br from-[#3F5F4A]/20 to-[#1a1a1f]"
              >
                <div className="p-1.5">
                  <div className="h-0.5 w-2/3 rounded bg-white/25" />
                  <div className="mt-1 h-0.5 w-full rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    case "character":
    case "supporting_characters":
      return (
        <div className={base}>
          <div className="absolute inset-[8%] grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex flex-col rounded-md border border-white/[0.08] bg-white/[0.04] p-1.5"
              >
                <div className="mb-1.5 h-6 w-full rounded-sm bg-gradient-to-b from-[#8A4B2A]/35 to-transparent" />
                <div className="h-0.5 w-2/3 rounded bg-white/20" />
                <div className="mt-0.5 h-0.5 w-full rounded bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      );
    case "usp":
      return (
        <div className={base}>
          <div className="absolute inset-[8%] grid grid-cols-2 gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.03] p-1.5"
              >
                <div className="h-1.5 w-1.5 shrink-0 rounded-sm bg-accent-neon/70" />
                <div className="h-0.5 flex-1 rounded bg-white/12" />
              </div>
            ))}
          </div>
        </div>
      );
    case "show_cross":
      return (
        <div className={base}>
          <div className="absolute inset-[8%] grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-md border border-white/[0.08] bg-gradient-to-b from-[#2A2A2A] to-[#111113] p-1"
              >
                <div className="h-0.5 w-2/3 rounded bg-white/25" />
                <div className="mt-1 h-0.5 w-full rounded bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      );
    case "visual_aesthetic":
      return (
        <div className={base}>
          <div className="absolute inset-[8%] grid grid-cols-3 grid-rows-2 gap-1">
            {["#2A2A2A", "#3F5F4A", "#8A4B2A", "#A9C6C7", "#1a1a1f", "#22d3ee"].map(
              (color) => (
                <div
                  key={color}
                  className="rounded-sm border border-white/[0.06]"
                  style={{ backgroundColor: color }}
                />
              ),
            )}
          </div>
        </div>
      );
    case "target_audience":
      return (
        <div className={base}>
          <div className="absolute inset-[8%] grid grid-cols-2 gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-md border border-accent-neon/20 bg-accent-neon/[0.06] p-1.5"
              >
                <div className="h-0.5 w-1/2 rounded bg-accent-neon/50" />
                <div className="mt-1 h-0.5 w-full rounded bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      );
    case "synopsis":
      return (
        <div className={base}>
          <div className="absolute inset-0 grid grid-cols-2">
            <div className="space-y-1.5 p-3">
              <div className="h-1 w-8 rounded bg-white/20" />
              <div className="h-0.5 w-full rounded bg-white/10" />
              <div className="h-0.5 w-[90%] rounded bg-white/10" />
              <div className="h-0.5 w-[75%] rounded bg-white/10" />
            </div>
            <div className="bg-gradient-to-br from-[#3F5F4A]/35 to-[#2A2A2A]/50" />
          </div>
        </div>
      );
    case "market_potential":
    case "budget":
    case "directors_vision":
    case "team":
      return (
        <div className={base}>
          <div className="absolute inset-[8%] grid grid-cols-2 gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-md bg-white/[0.04] p-1.5">
                <div className="mb-1 h-0.5 w-3 rounded bg-accent-neon/60" />
                <div className="h-0.5 w-full rounded bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      );
    case "contact":
      return (
        <div className={base}>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
            <div className="h-px w-12 bg-gradient-to-r from-transparent via-accent-neon/60 to-transparent" />
            <div className="h-1 w-16 rounded bg-white/15" />
            <div className="h-0.5 w-10 rounded bg-white/10" />
          </div>
        </div>
      );
    default:
      return (
        <div className={base}>
          <div className="absolute inset-4 space-y-2">
            <div className="h-1 w-10 rounded bg-accent-neon/40" />
            <div className="h-0.5 w-full rounded bg-white/12" />
            <div className="h-0.5 w-4/5 rounded bg-white/10" />
          </div>
        </div>
      );
  }
}
