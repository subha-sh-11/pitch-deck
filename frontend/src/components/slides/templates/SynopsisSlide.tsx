import type { SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface SynopsisSlideProps {
  content: SlideContent;
  /** Layout variant: "split_image_text" (image right) | "text_columns" (editorial, no image panel). */
  layout?: string;
}

export function SynopsisSlide({ content, layout }: SynopsisSlideProps) {
  const acts = content.items ?? [];
  const paragraphs = content.body?.split(/\n\n+/).filter(Boolean) ?? [content.body ?? ""];
  // Only fall back to image-less editorial columns when there's no image AND no act structure.
  const columns = layout === "text_columns" && !content.imageUrl && acts.length === 0;

  /* ── 3-act timeline — the preferred synopsis layout (story flow left, image right) ── */
  if (acts.length > 0) {
    return (
      <SlideFrame>
        <div className="absolute inset-0 bg-[var(--slide-bg,#0a0a0c)]" />
        <div className="relative grid h-full grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col justify-center p-[7%] pr-[5%]">
            <SlideLabel>
              <EditableText k="heading" as="span" value={content.heading || "Synopsis"} />
            </SlideLabel>
            <ol className="mt-6 space-y-4">
              {acts.map((act, i) => (
                <li key={i} className="flex gap-4">
                  {/* 3-act timeline rail */}
                  <div className="flex flex-col items-center">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
                      style={{ borderColor: "var(--slide-accent)", color: "var(--slide-accent)" }}
                    >
                      {i + 1}
                    </span>
                    {i < acts.length - 1 && (
                      <span
                        className="mt-1 w-px flex-1"
                        style={{ background: "color-mix(in srgb, var(--slide-accent) 40%, transparent)" }}
                      />
                    )}
                  </div>
                  <div className="pb-1">
                    <EditableText
                      k={`item-${i}-title`}
                      as="h3"
                      className="font-display text-sm font-semibold text-[var(--slide-text,#F5F1E8)]"
                      value={act.title}
                    />
                    {act.description && (
                      <EditableText
                        k={`item-${i}-desc`}
                        as="p"
                        multiline
                        className="mt-1 whitespace-pre-line text-[clamp(0.6rem,0.95cqw,0.8rem)] leading-relaxed text-[var(--slide-text-muted,#9CA3AF)]"
                        value={act.description}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative overflow-hidden">
            {content.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={content.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1f] to-[#080808]" />
            )}
            {/* blend the image into the text column */}
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[var(--slide-bg,#0a0a0c)]" />
          </div>
        </div>
      </SlideFrame>
    );
  }

  if (columns) {
    /* ── Editorial full-width columns — for image-less or very long synopses ── */
    return (
      <SlideFrame>
        <div className="absolute inset-0 bg-[var(--slide-bg,#0a0a0c)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.05),transparent_50%)]" />
        <div className="relative flex h-full flex-col justify-center p-[8%]">
          <SlideLabel>
            <EditableText k="heading" as="span" value={content.heading || "Synopsis"} />
          </SlideLabel>
          <div
            className="mt-6 gap-10 text-[clamp(0.65rem,1cqw,0.85rem)] leading-relaxed text-[var(--slide-text-muted,#9CA3AF)] [column-fill:balance]"
            style={{ columns: 2 }}
          >
            {paragraphs.map((para) => (
              <p key={para.slice(0, 40)} className="mb-4 break-inside-avoid">
                {para}
              </p>
            ))}
          </div>
          <div
            className="mt-8 h-px w-24"
            style={{ background: "linear-gradient(to right, var(--slide-accent), transparent)" }}
          />
        </div>
      </SlideFrame>
    );
  }

  /* ── Split: text left, imagery right (no act structure available) ── */
  return (
    <SlideFrame>
      <div className="absolute inset-0 bg-[var(--slide-bg,#0a0a0c)]" />
      <div className="relative grid h-full grid-cols-2 gap-0">
        <div className="flex flex-col justify-center p-[8%] pr-[6%]">
          <SlideLabel>
            <EditableText k="heading" as="span" value={content.heading || "Synopsis"} />
          </SlideLabel>
          <EditableText
            k="body"
            as="div"
            multiline
            className="mt-5 whitespace-pre-line text-[clamp(0.65rem,1cqw,0.85rem)] leading-relaxed text-[var(--slide-text-muted,#9CA3AF)]"
            value={content.body ?? ""}
          />
        </div>
        <div className="relative overflow-hidden">
          {content.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={content.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1f] to-[#080808]" />
          )}
          {/* blend the image into the text column */}
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#0a0a0c]" />
        </div>
      </div>
    </SlideFrame>
  );
}
