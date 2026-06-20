import type { SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface MarketPotentialSlideProps {
  content: SlideContent;
}

export function MarketPotentialSlide({ content }: MarketPotentialSlideProps) {
  const items =
    content.items ??
    content.bullets?.map((b) => ({ title: b, description: "" })) ??
    [];

  return (
    <SlideFrame imageUrl={content.imageUrl}>
      <div
        className={`absolute inset-0 ${content.imageUrl ? "bg-black/65" : "bg-[var(--slide-bg,#0a0a0c)]"}`}
      />
      <div className="relative flex h-full flex-col p-[7%]">
        <SlideLabel>
          <EditableText k="heading" as="span" value={content.heading || "Market Potential"} />
        </SlideLabel>
        {items.length > 0 ? (
          <div className="mt-6 grid flex-1 grid-cols-2 gap-4">
            {items.map((item, i) => (
              <div
                key={i}
                className="flex flex-col justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] p-5"
              >
                <div className="mb-3 h-1 w-8" style={{ background: "var(--slide-accent)" }} />
                <EditableText
                  k={`item-${i}-title`}
                  as="h3"
                  className="font-display text-lg font-semibold text-[var(--slide-text,#F5F1E8)]"
                  value={item.title}
                />
                {item.description && (
                  <EditableText
                    k={`item-${i}-desc`}
                    as="p"
                    multiline
                    className="mt-2 whitespace-pre-line text-xs leading-relaxed text-[var(--slide-text-muted,#9CA3AF)]"
                    value={item.description}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          content.body && (
            <EditableText
              k="body"
              as="p"
              multiline
              className="mt-6 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-[var(--slide-text-muted,#C9CDD3)]"
              value={content.body}
            />
          )
        )}
      </div>
    </SlideFrame>
  );
}
