import Link from "next/link";
import { NAV_ITEMS } from "./data";

/** Centered rounded navigation capsule. The active item sits in a light pill. */
export function HeroNav() {
  return (
    <nav className="hero-nav" aria-label="Primary">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="hero-nav-link"
          data-active={item.active ? "true" : undefined}
          aria-current={item.active ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
