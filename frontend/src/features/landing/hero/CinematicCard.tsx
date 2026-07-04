import Image from "next/image";
import type { CinematicCardData } from "./data";

interface CinematicCardProps {
  card: CinematicCardData;
  /** Eager-load only the first few above-the-fold cards. */
  priority?: boolean;
  /** Duplicated marquee instances: empty alt + hidden from the a11y tree. */
  decorative?: boolean;
}

/**
 * A single cinematic portrait card. The image is a pre-cropped 3:4 WebP, shown
 * with next/image `fill` + object-fit cover so it never stretches or shifts.
 */
export function CinematicCard({ card, priority = false, decorative = false }: CinematicCardProps) {
  return (
    <figure className="hero-card" aria-hidden={decorative || undefined}>
      <Image
        className="hero-card__img"
        src={card.src}
        alt={decorative ? "" : card.alt}
        fill
        sizes="(max-width: 640px) 185px, (max-width: 1024px) 210px, 238px"
        quality={95}
        priority={priority}
        draggable={false}
        style={card.objectPosition ? { objectPosition: card.objectPosition } : undefined}
      />
      <span className="hero-card__scrim" aria-hidden />
    </figure>
  );
}
