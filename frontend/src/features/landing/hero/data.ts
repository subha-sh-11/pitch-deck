import { projectRoutes } from "@/lib/routes";

/** Centered navigation-capsule items. `active` renders inside the light pill. */
export interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Create", href: projectRoutes.newProject(), active: true },
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Dashboard", href: projectRoutes.dashboard() },
];

/** A cinematic portrait card in the hero gallery. */
export interface CinematicCardData {
  id: string;
  src: string;
  alt: string;
  /** CSS object-position, tuned per composition. */
  objectPosition?: string;
  /** The visually strongest, above-the-fold card — loaded eagerly and sized up. */
  focal?: boolean;
}

export const CINEMATIC_CARDS: CinematicCardData[] = [
  {
    id: "inner-cinema",
    src: "/hero/inner-cinema.svg",
    alt: "A filmmaker's side profile emerging from pitch black, lit by a soft burgundy glow.",
    objectPosition: "60% center",
  },
  {
    id: "vision-projection",
    src: "/hero/vision-projection.svg",
    alt: "A solitary creator standing inside a narrow projector light field as an idea becomes visible.",
    objectPosition: "center center",
  },
  {
    id: "hero-focal",
    src: "/hero/hero-focal.svg",
    alt: "A cinematic portrait split by petrol-teal and deep-red light against black.",
    objectPosition: "center 40%",
    focal: true,
  },
  {
    id: "script-to-screen",
    src: "/hero/script-to-screen.svg",
    alt: "A dark character silhouette with a crimson rim light and abstract story fragments.",
    objectPosition: "50% center",
  },
  {
    id: "story-awakening",
    src: "/hero/story-awakening.svg",
    alt: "A profile looking upward into soft burgundy atmospheric light.",
    objectPosition: "45% center",
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
