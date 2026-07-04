import { CINEMATIC_CARDS } from "./data";
import { CinematicCard } from "./CinematicCard";

/**
 * Five-card cinematic row. On desktop the cards align to one baseline and the
 * outer two clip gracefully at the viewport edge; below 1024px it becomes a
 * horizontal snap carousel.
 *
 * Cards render as direct children so the CSS `:nth-child` entrance stagger
 * matches — do not wrap them in list items.
 */
export function CinematicGallery() {
  return (
    <div className="hero-gallery-wrap">
      <div
        className="hero-gallery"
        role="list"
        aria-label="Cinematic pitch-deck visuals"
      >
        {CINEMATIC_CARDS.map((card) => (
          <CinematicCard key={card.id} card={card} />
        ))}
      </div>
      <div className="hero-gallery-fade" aria-hidden />
    </div>
  );
}
