import type { ReactNode } from "react";

/**
 * Thin-line, single-accent icon set for film pitch decks (genre / USP / audience / market /
 * production). One stroke colour (inherits `currentColor` → set it to the deck accent), no fills,
 * no emojis — per the design bible. Use `iconForLabel()` to pick an icon from a slide label.
 */
export type IconName =
  | "crime" | "thriller" | "mystery" | "horror" | "romance" | "comedy" | "drama"
  | "action" | "adventure" | "scifi" | "fantasy" | "war" | "sport" | "music" | "doc"
  | "audience" | "age" | "platform" | "market" | "budget" | "production" | "release"
  | "whyNow" | "spark";

const ICONS: Record<IconName, ReactNode> = {
  crime: <><path d="M12 3l7 3v5c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z" /><path d="M12 8.5v3.5" /><path d="M12 15h.01" /></>,
  thriller: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  mystery: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-3.8-3.8" /></>,
  horror: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />,
  romance: <path d="M12 21s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" />,
  comedy: <><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2.2 4 2.2S16 14 16 14" /><path d="M9 9h.01" /><path d="M15 9h.01" /></>,
  drama: <><circle cx="12" cy="12" r="9" /><path d="M8.5 15h7" /><path d="M9 9h.01" /><path d="M15 9h.01" /></>,
  action: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  adventure: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5.5-5.5 2 2-5.5 5.5-2z" /></>,
  scifi: <><circle cx="12" cy="12" r="3" /><ellipse cx="12" cy="12" rx="10" ry="4" /></>,
  fantasy: <path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z" />,
  war: <><path d="M12 3l7 3v5c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></>,
  sport: <><path d="M8 4h8v4a4 4 0 0 1-8 0V4z" /><path d="M8 6H5v1a3 3 0 0 0 3 3" /><path d="M16 6h3v1a3 3 0 0 1-3 3" /><path d="M9.5 20h5M12 14v6" /></>,
  music: <><path d="M9 18V6l10-2v12" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="16" r="2" /></>,
  doc: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M7 4v16" /></>,
  audience: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.5a3 3 0 0 1 0 5.5M20.5 19a5.5 5.5 0 0 0-3.5-5.1" /></>,
  age: <><circle cx="12" cy="8" r="3.5" /><path d="M5.5 19a6.5 6.5 0 0 1 13 0" /></>,
  platform: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M10.5 8.5l4 2.5-4 2.5z" /><path d="M9 21h6" /></>,
  market: <><path d="M4 5v14h16" /><path d="M7 15l3.5-4.5 3 2L21 6" /></>,
  budget: <><circle cx="12" cy="12" r="9" /><path d="M9.5 8.5h5M9.5 12h5M14 8.5c-3.2 0-4 2-4 3.5s1 3.5 4.5 3.5" /></>,
  production: <><rect x="3" y="8.5" width="18" height="11.5" rx="1.5" /><path d="M3.5 8.5l2-4 4 1.4-2 4M9.5 5.4l4 1.4-2 4" /></>,
  release: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 3v4M16 3v4" /></>,
  whyNow: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  spark: <path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6L12 4z" />,
};

const LABEL_MATCHERS: [RegExp, IconName][] = [
  [/crime|heist|gang|mafia|underworld|noir/, "crime"],
  [/thrill|suspense|tension|chase/, "thriller"],
  [/myster|whodunit|investigat|detective/, "mystery"],
  [/horror|slasher|haunt|supernatural/, "horror"],
  [/romance|romanc|love|relationship/, "romance"],
  [/comedy|comic|humou?r|satire|funny/, "comedy"],
  [/drama|emotion|family|coming.?of.?age/, "drama"],
  [/action|fight|combat/, "action"],
  [/adventure|quest|journey|expedition/, "adventure"],
  [/sci.?fi|science|tech|cyber|space|future/, "scifi"],
  [/fantasy|myth|magic|epic|legend/, "fantasy"],
  [/war|battle|military|combat/, "war"],
  [/sport|game|match|athlet|champion|badminton|cricket|race/, "sport"],
  [/music|song|dance|rhythm/, "music"],
  [/document|docu|real.?life/, "doc"],
  [/audience|viewer|demograph|primary|segment|fan/, "audience"],
  [/age|youth|adult|gen.?z|millenn/, "age"],
  [/ott|stream|platform|theatr|cinema|release fit|play/, "platform"],
  [/market|commercial|revenue|box.?office|business|potential/, "market"],
  [/budget|cost|finance|fund|scale|invest/, "budget"],
  [/production|shoot|stage|crew|status|pipeline/, "production"],
  [/release|distribut|launch|schedule/, "release"],
  [/why.?now|timely|moment|zeitgeist|urgency/, "whyNow"],
];

/** Pick the best-fitting icon for a slide/segment label (falls back to a neutral spark). */
export function iconForLabel(label: string | undefined, fallback: IconName = "spark"): IconName {
  const t = (label || "").toLowerCase();
  for (const [re, name] of LABEL_MATCHERS) {
    if (re.test(t)) return name;
  }
  return fallback;
}

interface SlideIconProps {
  name: IconName;
  /** Pixel size (square). */
  size?: number;
  className?: string;
}

/** A thin-line icon. Colour comes from `currentColor`, so set text colour to the deck accent. */
export function SlideIcon({ name, size = 18, className = "" }: SlideIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {ICONS[name]}
    </svg>
  );
}
