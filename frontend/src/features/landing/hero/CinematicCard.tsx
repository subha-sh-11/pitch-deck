import type { CinematicCardData } from "./data";

/**
 * A single cinematic portrait card.
 *
 * The default assets are original vector (SVG) posters, so they stay perfectly
 * sharp at every breakpoint (no upscaling / no blur). Drop a raster photo into
 * `src` later and it renders identically via `object-fit: cover`.
 */
export function CinematicCard({ card }: { card: CinematicCardData }) {
  return (
    <figure className={`hero-card${card.focal ? " hero-card--focal" : ""}`} role="listitem">
      {/* eslint-disable-next-line @next/next/no-img-element -- vector SVG poster: <img> keeps it crisp and avoids raster optimization */}
      <img
        className="hero-card__img"
        src={card.src}
        alt={card.alt}
        style={card.objectPosition ? { objectPosition: card.objectPosition } : undefined}
        loading={card.focal ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={card.focal ? "high" : "auto"}
        draggable={false}
      />
      <span className="hero-card__scrim" aria-hidden />
    </figure>
  );
}
