import type { SlideAppearance, SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";
import { SplitLayout } from "../shared/SplitLayout";

interface GenericSlideProps {
  content: SlideContent;
  /** Layout variant: "text_led" (label + copy/bullets) | "statement" (short copy as a big display line). */
  layout?: string;
  appearance?: SlideAppearance;
}

export function GenericSlide({ content, layout, appearance }: GenericSlideProps) {
  const statement = layout === "statement";
  const comp = appearance?.composition;

  // Two-column / framed composition (text-led slides): text in one half, image in the other.
  if (!statement && (comp === "split" || comp === "framed") && content.imageUrl) {
    return (
      <SlideFrame>
        <SplitLayout imageUrl={content.imageUrl} imageSide={appearance?.imageSide} framed={comp === "framed"}>
          <SlideLabel>
            <EditableText k="heading" as="span" value={content.heading} />
          </SlideLabel>
          {content.body && (
            <EditableText
              k="body"
              as="p"
              multiline
              className="mt-5 whitespace-pre-line text-sm leading-relaxed text-[var(--slide-text,#F5F1E8)]"
              value={content.body}
            />
          )}
          {content.bullets && (
            <ul className="mt-5 space-y-3">
              {content.bullets.map((b, i) => (
                <li key={i} className="flex gap-3 text-sm text-[var(--slide-text,#F5F1E8)]">
                  <span className="text-[var(--slide-accent,#22d3ee)]">◆</span>
                  <EditableText
                    k={`bullet-${i}`}
                    as="span"
                    multiline
                    className="whitespace-pre-line"
                    value={b}
                  />
                </li>
              ))}
            </ul>
          )}
        </SplitLayout>
      </SlideFrame>
    );
  }

  if (statement) {
    /* ── Short, punchy copy lands as a statement, not a small paragraph ── */
    return (
      <SlideFrame imageUrl={content.imageUrl}>
        <div
          className={`absolute inset-0 ${
            content.imageUrl ? "bg-black/70" : "bg-[var(--slide-bg,#0a0a0c)]"
          }`}
        />
        <div className="relative flex h-full flex-col items-center justify-center p-[10%] text-center">
          <SlideLabel>{content.heading}</SlideLabel>
          {content.body && (
            <p className="mt-6 max-w-3xl font-display text-[clamp(1.2rem,2.6vw,2.1rem)] font-medium leading-snug text-[var(--slide-text,#F5F1E8)]">
              {content.body}
            </p>
          )}
          <div
            className="mt-8 h-px w-24"
            style={{ background: "linear-gradient(to right, transparent, var(--slide-accent), transparent)" }}
          />
        </div>
      </SlideFrame>
    );
  }

  return (
    <SlideFrame imageUrl={content.imageUrl}>
      <div
        className={`absolute inset-0 ${
          content.imageUrl ? "bg-black/65" : "bg-[var(--slide-bg,#0a0a0c)]"
        }`}
      />
      <div className="relative flex h-full flex-col p-[7%]">
        <SlideLabel>
          <EditableText k="heading" as="span" value={content.heading} />
        </SlideLabel>
        {content.body && (
          <EditableText
            k="body"
            as="p"
            multiline
            className="mt-5 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-[var(--slide-text-muted,#9CA3AF)]"
            value={content.body}
          />
        )}
        {content.bullets && (
          <ul className="mt-5 space-y-3">
            {content.bullets.map((b, i) => (
              <li key={i} className="flex gap-3 text-sm text-[var(--slide-text,#F5F1E8)]">
                <span className="text-[var(--slide-accent,#22d3ee)]">◆</span>
                <EditableText
                  k={`bullet-${i}`}
                  as="span"
                  multiline
                  className="whitespace-pre-line"
                  value={b}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </SlideFrame>
  );
}
