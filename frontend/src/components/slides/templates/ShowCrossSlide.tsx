import type { SlideContent } from "@/types/slide";
import { CardControls } from "../editing/CardControls";
import { EditableText } from "../editing/EditableText";
import { MovableCard } from "../editing/MovableCard";
import { useSlideEdit } from "../editing/SlideEditContext";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface ShowCrossSlideProps {
  content: SlideContent;
}

export function ShowCrossSlide({ content }: ShowCrossSlideProps) {
  const comps = content.comps ?? [];
  const { patchContent } = useSlideEdit();
  const duplicate = (i: number) => patchContent({ comps: [...comps, { ...comps[i] }] });
  const remove = (i: number) => patchContent({ comps: comps.filter((_, j) => j !== i) });
  const setImage = (i: number, url: string) =>
    patchContent({ comps: comps.map((c, j) => (j === i ? { ...c, posterUrl: url } : c)) });

  return (
    <SlideFrame imageUrl={content.imageUrl}>
      <div
        className={`absolute inset-0 ${content.imageUrl ? "bg-black/70" : "bg-[var(--slide-bg,#0a0a0c)]"}`}
      />
      <div className="relative flex h-full flex-col p-[7%]">
        <SlideLabel>
          <EditableText k="heading" as="span" value={content.heading || "Show Cross"} />
        </SlideLabel>
        <div className="mt-5 grid min-h-0 flex-1 grid-cols-3 gap-4">
          {comps.map((comp, i) => (
            <MovableCard
              key={i}
              ck={`comp-${i}`}
              className="group relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/[0.08]"
            >
              <CardControls
                onDuplicate={() => duplicate(i)}
                onDelete={() => remove(i)}
                onSetImage={(url) => setImage(i, url)}
              />
              <div className="relative min-h-0 flex-1 bg-gradient-to-b from-[#2A2A2A] via-[#1a1a1f] to-[#3F5F4A]/20">
                {comp.posterUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={comp.posterUrl}
                    alt={comp.title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                <div className="absolute bottom-2 left-3 right-3">
                  <EditableText
                    k={`comp-${i}-title`}
                    as="p"
                    className="font-display text-base font-bold leading-tight text-[var(--slide-text,#F5F1E8)]"
                    value={comp.title}
                  />
                </div>
              </div>
              <div className="shrink-0 p-3">
                <EditableText
                  k={`comp-${i}-note`}
                  as="p"
                  multiline
                  className="line-clamp-3 whitespace-pre-line text-[11px] leading-relaxed text-[var(--slide-text-muted,#9CA3AF)]"
                  value={comp.note}
                />
              </div>
            </MovableCard>
          ))}
        </div>
        {content.body && (
          <EditableText
            k="body"
            as="p"
            multiline
            className="mt-3 shrink-0 whitespace-pre-line border-t border-white/[0.06] pt-3 text-center text-xs italic"
            style={{ color: "var(--slide-accent)" }}
            value={content.body}
          />
        )}
      </div>
    </SlideFrame>
  );
}
