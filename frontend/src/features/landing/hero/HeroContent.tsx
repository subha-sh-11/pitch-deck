import Link from "next/link";
import { projectRoutes } from "@/lib/routes";

/** Centered headline, supporting copy and the two primary CTAs. */
export function HeroContent() {
  return (
    <div className="hero-copy">
      <h1 className="hero-heading">
        Turn your story into a{" "}
        <em>producer-ready cinematic pitch</em>
      </h1>

      <p className="hero-sub">
        From one-line ideas to full scripts, create polished cinematic decks with
        compelling content, consistent artwork, and investor-ready storytelling.
      </p>

      <div className="hero-cta">
        <Link href={projectRoutes.newProject()} className="hero-cta-primary">
          Create your pitch deck
        </Link>
      </div>
    </div>
  );
}
