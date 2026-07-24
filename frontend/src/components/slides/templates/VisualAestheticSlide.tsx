import type { CSSProperties } from "react";
import type { SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";
import { useSlideTreatment } from "../shared/SlideTreatmentContext";

interface VisualAestheticSlideProps {
  content: SlideContent;
}

// Deterministic collage geometry (per tile index) — slight rotations and offsets so the
// moodboard reads as pinned/layered references, not a flat grid. Kept small enough that
// every label stays fully readable.
const COLLAGE_ROTATION = [-1.6, 1.3, -1.1, 1.8, -1.4, 1.0, -0.8, 1.5];
const COLLAGE_OFFSET: [number, number][] = [
  [0, 0],
  [0.6, -0.8],
  [-0.6, 0.7],
  [0.5, 0.9],
  [-0.5, -0.6],
  [0.7, 0.5],
];

export function VisualAestheticSlide({ content }: VisualAestheticSlideProps) {
  const blocks = content.moodBlocks ?? [];
  const t = useSlideTreatment();
  // Reference profile: a collage-habit moodboard renders as a collage, not a flat grid.
  const collage = t.collage && blocks.length > 1;

  return (
    <SlideFrame>
      {/* A moodboard of per-tile film references — each tile its OWN still; no single shared bg. */}
      <div
        className="absolute inset-0"
        style={{ background: "var(--slide-ground, var(--slide-bg, #0a0a0c))" }}
      />
      <div className="relative flex h-full flex-col p-[calc(7%_+_var(--slide-pad-delta,0%))]">
        <SlideLabel>
          <EditableText k="heading" as="span" value={content.heading || "Visual Aesthetic"} />
        </SlideLabel>
        {content.body && (
          <EditableText
            k="body"
            as="p"
            multiline
            className="mt-2 whitespace-pre-line text-xs text-[var(--slide-text-muted,#9CA3AF)]"
            value={content.body}
          />
        )}
        <div
          className={`mt-5 grid flex-1 grid-cols-3 grid-rows-2 ${collage ? "gap-3" : "gap-2"}`}
        >
          {blocks.map((block, i) => {
            const collageStyle: CSSProperties | undefined = collage
              ? {
                  transform: `rotate(${COLLAGE_ROTATION[i % COLLAGE_ROTATION.length]}deg) translate(${
                    COLLAGE_OFFSET[i % COLLAGE_OFFSET.length][0]
                  }%, ${COLLAGE_OFFSET[i % COLLAGE_OFFSET.length][1]}%)`,
                }
              : undefined;
            return (
              <div
                key={i}
                className={`relative flex flex-col justify-end overflow-hidden p-3 ${
                  i === 0 ? "col-span-2 row-span-1" : ""
                } ${
                  collage
                    ? "rounded-sm shadow-2xl ring-1 ring-white/20"
                    : "rounded-md"
                }`}
                style={{
                  ...(block.imageUrl ? {} : { backgroundColor: block.color }),
                  ...collageStyle,
                }}
              >
                {block.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={block.imageUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                <EditableText
                  k={`mood-${i}-label`}
                  as="span"
                  className="relative text-[11px] font-semibold uppercase tracking-wider text-white/90"
                  value={block.label}
                />
              </div>
            );
          })}
        </div>
      </div>
    </SlideFrame>
  );
}
