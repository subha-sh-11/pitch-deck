import type { SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface MarketPotentialSlideProps {
  content: SlideContent;
}

/**
 * Editorial "market case" layout — glass tiles with oversized ghost numerals and an accent
 * spine, arranged in a staggered rhythm over a directional cinematic scrim so the copy reads
 * cleanly on any backdrop.
 */
export function MarketPotentialSlide({ content }: MarketPotentialSlideProps) {
  const items =
    content.items ??
    content.bullets?.map((b) => ({ title: b, description: "" })) ??
    [];

  // Split a "Lead-in: detail" title into a punchy lead + supporting line when the copy
  // arrives as one string (keeps older content rendering nicely in the new layout).
  const split = (item: { title: string; description: string }) => {
    if (item.description) return { lead: item.title, body: item.description };
    const m = item.title.match(/^([^:.]{2,40})[:.—-]\s*(.+)$/);
    return m ? { lead: m[1].trim(), body: m[2].trim() } : { lead: item.title, body: "" };
  };

  return (
    <SlideFrame imageUrl={content.imageUrl}>
      {/* Directional scrim: anchored dark behind the heading, opening toward the image. */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-black/65 to-black/35" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

      <div className="relative flex h-full min-h-0 flex-col p-[6.5%]">
        <SlideLabel>
          <EditableText k="heading" as="span" value={content.heading || "Market Potential"} />
        </SlideLabel>

        {items.length > 0 ? (
          <div className="mt-6 grid min-h-0 flex-1 grid-cols-2 gap-x-5 gap-y-4 content-center">
            {items.map((item, i) => {
              const { lead, body } = split(item);
              return (
                <div
                  key={i}
                  // Stagger the right column down for an editorial, non-grid rhythm.
                  className={`group relative flex min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md transition-colors hover:border-[color:var(--slide-accent)]/50 ${
                    i % 2 === 1 ? "lg:translate-y-5" : ""
                  }`}
                >
                  {/* Oversized ghost index numeral */}
                  <span
                    className="pointer-events-none absolute -right-1 -top-3 select-none font-display text-[5.5rem] font-bold leading-none text-white/[0.06]"
                    aria-hidden
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {/* Accent spine */}
                  <div
                    className="mr-4 mt-1 w-[3px] shrink-0 rounded-full"
                    style={{ background: "var(--slide-accent)" }}
                  />
                  <div className="relative flex min-w-0 flex-col">
                    <EditableText
                      k={`item-${i}-title`}
                      as="h3"
                      className="font-display text-[clamp(1rem,1.5vw,1.35rem)] font-semibold leading-tight text-[#F5F1E8]"
                      value={lead}
                    />
                    {body && (
                      <EditableText
                        k={`item-${i}-desc`}
                        as="p"
                        multiline
                        className="mt-2 whitespace-pre-line text-[clamp(0.68rem,0.95vw,0.85rem)] leading-relaxed text-[#C2C7CE]"
                        value={body}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          content.body && (
            <EditableText
              k="body"
              as="p"
              multiline
              className="mt-6 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-[#C9CDD3]"
              value={content.body}
            />
          )
        )}
      </div>
    </SlideFrame>
  );
}
