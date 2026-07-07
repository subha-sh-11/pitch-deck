import { PARTNERS } from "./data";

/** Understated monochrome trust strip. Text labels — no trademarked logos. */
export function PartnerStrip() {
  return (
    <div className="hero-partners" aria-label="Built for leading streaming platforms and producers">
      {PARTNERS.map((name) => (
        <span key={name} className="hero-partner">
          {name}
        </span>
      ))}
    </div>
  );
}
