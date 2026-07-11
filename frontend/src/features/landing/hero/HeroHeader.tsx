"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { NAV_ITEMS } from "./data";
import { projectRoutes } from "@/lib/routes";
import { HeroAuthNav } from "./HeroAuthNav";

/** Logo, centered nav capsule, auth actions, and the mobile menu.
 *  Fixed to the top of the viewport so it stays visible (and clickable)
 *  as the whole landing page scrolls; gains a solid backdrop once scrolled. */
export function HeroHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="hero-header" data-scrolled={scrolled ? "true" : "false"}>
      <div className="hero-header-inner">
        <Link href="/" className="hero-logo" aria-label="Pitch Deck home">
          <span className="hero-logo-img">
            <Image
              src="/pitchdeck-logo.png"
              alt="Pitch Deck"
              fill
              sizes="120px"
              priority
              style={{ objectFit: "contain" }}
            />
          </span>
        </Link>

        <div className="hero-right">
          <div className="hero-auth">
            <HeroAuthNav />
          </div>

          <div className="hero-mobile-controls">
            <Link href={projectRoutes.signup()} className="hero-btn hero-btn-primary">
              Get started
            </Link>
            <button
              type="button"
              className="hero-menu-btn"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="hero-mobile-menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                {menuOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <>
                    <path d="M4 7h16" />
                    <path d="M4 12h16" />
                    <path d="M4 17h16" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div
        id="hero-mobile-menu"
        className="hero-mobile-menu"
        data-open={menuOpen ? "true" : "false"}
      >
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="hero-mobile-link"
            onClick={() => setMenuOpen(false)}
          >
            {item.label}
          </Link>
        ))}
        <Link
          href={projectRoutes.signup()}
          className="hero-mobile-link"
          onClick={() => setMenuOpen(false)}
        >
          Login
        </Link>
      </div>
    </header>
  );
}
