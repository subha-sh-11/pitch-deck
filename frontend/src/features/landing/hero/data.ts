import { projectRoutes } from "@/lib/routes";

/** Centered navigation-capsule items. `active` renders inside the light pill. */
export interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Create", href: projectRoutes.newProject(), active: true },
  { label: "Examples", href: projectRoutes.dashboard() },
];

/** A cinematic portrait card in the hero gallery marquee. */
export interface CinematicCardData {
  id: string;
  src: string;
  alt: string;
  /** Per-image object-position for micro-framing (assets are pre-cropped to 3:4). */
  objectPosition?: string;
}

/**
 * Curated order for the marquee's visual rhythm — alternating cool / warm and
 * close-up / wide, with the strongest vertical character (Londuw) at the centre:
 *   Joker (cool close-up) → Hotel California (warm graphic) → Londuw (cool focal)
 *   → Private Eye (warm noir) → Notice Served (cool horror).
 * Assets are portrait 3:4 WebP crops generated with sharp from the source art.
 */
export const CINEMATIC_CARDS: CinematicCardData[] = [
  {
    id: "joker",
    src: "/hero/joker-phoenix.webp",
    alt: "Joaquin Phoenix as the Joker in extreme close-up, half his face in cracked clown make-up against black.",
    objectPosition: "50% 42%",
  },
  {
    id: "hotel-california",
    src: "/hero/hotel-california.webp",
    alt: "A stark red poster: a rope descending to a lone pine tree, evoking Hotel California.",
    objectPosition: "50% 46%",
  },
  {
    id: "londuw",
    src: "/hero/londuw-witch.webp",
    alt: "A pale, rune-tattooed sorceress with long white braids standing in a cold, misty teal forest.",
    objectPosition: "50% 30%",
  },
  {
    id: "private-eye",
    src: "/hero/private-eye-detective.webp",
    alt: "A film-noir detective in a trench coat and fedora raising a vintage camera, in warm sepia light.",
    objectPosition: "50% 38%",
  },
  {
    id: "notice-served",
    src: "/hero/notice-served-swamp.webp",
    alt: "A green-eyed old woman rising from a misty swamp at dusk as birds scatter overhead.",
    objectPosition: "50% 48%",
  },
];

/** Understated trust strip — text labels, not trademarked logos. */
export const PARTNERS: string[] = [
  "Netflix",
  "Prime Video",
  "Aha",
  "Hotstar",
  "Studios",
  "Producers",
];
