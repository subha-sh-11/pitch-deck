import type { CSSProperties } from "react";
import type { DesignMotif } from "@/types/design";

// Monochrome film grain as an inline SVG data-URI (no unique-id needed, unlike an inline
// <filter>, so it's safe to render once per slide). Matches the subtle base grain in SlideFrame.
const GRAIN_URI =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='nm'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23nm)'/%3E%3C/svg%3E\")";

// Evenly spaced light perforations (sprocket holes) over the dark film band.
const HOLES =
  "repeating-linear-gradient(to right, color-mix(in srgb, var(--slide-text,#F5F1E8) 80%, transparent) 0 0.9%, transparent 0.9% 2.7%)";

function FilmStripBand({ edge, strong = false }: { edge: "top" | "bottom"; strong?: boolean }) {
  return (
    <div
      className="absolute inset-x-0"
      style={
        {
          [edge]: 0,
          height: strong ? "7.5%" : "4.4%",
          background: strong ? "rgba(5,5,7,0.92)" : "rgba(8,8,10,0.72)",
        } as CSSProperties
      }
    >
      <div className="absolute inset-x-0 top-[15%] h-[26%]" style={{ backgroundImage: HOLES }} />
      <div className="absolute inset-x-0 bottom-[15%] h-[26%]" style={{ backgroundImage: HOLES }} />
      {strong && (
        // hairline along the band's inner edge, so the strip reads as a deliberate frame
        <div
          className="absolute inset-x-0"
          style={
            {
              [edge === "top" ? "bottom" : "top"]: 0,
              height: 1,
              background: "color-mix(in srgb, var(--slide-accent,#caa86a) 35%, transparent)",
            } as CSSProperties
          }
        />
      )}
    </div>
  );
}

/**
 * Deck-wide graphic motifs derived from the design direction (which the design agent fills from
 * the director's reference images). Rendered as a non-interactive overlay above the slide content,
 * positioned at the edges so it never sits over copy (templates pad content ~8%).
 *
 * `strongFilmStrip` (from the reference profile's surface.framing) turns the film-strip bands
 * into a real compositional frame — taller, denser, with an accent hairline — on image slides.
 */
export function SlideMotifs({
  motifs,
  strongFilmStrip = false,
}: {
  motifs?: DesignMotif[];
  strongFilmStrip?: boolean;
}) {
  if (!motifs?.length) return null;
  const has = (m: DesignMotif) => motifs.includes(m);
  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
      {has("vignette") && (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)",
          }}
        />
      )}
      {has("grain") && (
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: GRAIN_URI }} />
      )}
      {has("frame") && (
        <div
          className="absolute inset-[2.6%]"
          style={{
            border: "1px solid color-mix(in srgb, var(--slide-accent,#caa86a) 45%, transparent)",
          }}
        />
      )}
      {has("film_strip") && (
        <>
          <FilmStripBand edge="top" strong={strongFilmStrip} />
          <FilmStripBand edge="bottom" strong={strongFilmStrip} />
        </>
      )}
    </div>
  );
}
