import type { SlideContent } from "@/types/slide";
import { CardControls } from "../editing/CardControls";
import { EditableText } from "../editing/EditableText";
import { MovableCard } from "../editing/MovableCard";
import { useSlideEdit } from "../editing/SlideEditContext";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";
import { SlideIcon } from "../shared/SlideIcon";

interface USPGridSlideProps {
  content: SlideContent;
}

export function USPGridSlide({ content }: USPGridSlideProps) {
  const bullets = content.bullets ?? [];
  const { patchContent } = useSlideEdit();
  const duplicate = (i: number) => patchContent({ bullets: [...bullets, bullets[i]] });
  const remove = (i: number) => patchContent({ bullets: bullets.filter((_, j) => j !== i) });

  return (
    <SlideFrame imageUrl={content.imageUrl}>
      <div
        className={`absolute inset-0 ${content.imageUrl ? "bg-black/65" : "bg-[var(--slide-bg,#0a0a0c)]"}`}
      />
      <div className="relative flex h-full flex-col p-[7%]">
        <SlideLabel>
          <EditableText k="heading" as="span" value={content.heading || "Unique Selling Points"} />
        </SlideLabel>
        <div className="mt-6 grid flex-1 grid-cols-2 gap-4 content-start">
          {bullets.map((bullet, i) => (
            <MovableCard
              key={i}
              ck={`bullet-${i}`}
              className="group relative flex items-start gap-4 overflow-hidden rounded-xl border border-[var(--slide-accent,#22d3ee)]/25 bg-gradient-to-br from-white/[0.07] to-transparent p-5"
            >
              <CardControls onDuplicate={() => duplicate(i)} onDelete={() => remove(i)} />
              {/* accent rail makes each point read as a highlighted callout, not a flat row */}
              <div className="absolute left-0 top-0 h-full w-1 bg-[var(--slide-accent,#22d3ee)]" />
              {/* small thin-line marker — icons stay subtle on USP, per the design bible */}
              <SlideIcon
                name="spark"
                size={15}
                className="absolute right-3 top-3 text-[var(--slide-accent,#22d3ee)] opacity-50"
              />
              <span className="font-display text-3xl font-bold leading-none text-[var(--slide-accent,#22d3ee)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <EditableText
                k={`bullet-${i}`}
                as="p"
                multiline
                className="whitespace-pre-line text-base font-medium leading-snug text-[var(--slide-text,#F5F1E8)]"
                value={bullet}
              />
            </MovableCard>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
