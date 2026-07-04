"use client";

import Link from "next/link";
import { useState } from "react";
import { NAV_ITEMS } from "./data";
import { projectRoutes } from "@/lib/routes";
import { HeroNav } from "./HeroNav";
import { HeroAuthNav } from "./HeroAuthNav";

/** Logo, centered nav capsule, auth actions, and the mobile menu. */
export function HeroHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="hero-header">
        <Link href="/" className="hero-logo" aria-label="Pitch-deck home">
          <span className="hero-logo-mark" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9L20 9.5V18.5A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5z"
                fill="currentColor"
                fillOpacity="0.9"
              />
              <path d="M9 9.5v5l4.5-2.5z" fill="#fff" />
            </svg>
          </span>
          <span>
            Pitch<span className="hero-logo-accent">-</span>deck
          </span>
        </Link>

        <HeroNav />

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
      </header>

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
    </>
  );
}
