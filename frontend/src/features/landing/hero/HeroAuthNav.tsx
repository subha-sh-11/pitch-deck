"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fetchMe, logout, type AuthUser } from "@/lib/api";
import { projectRoutes } from "@/lib/routes";

/**
 * Header auth zone for the cinematic hero. Reuses the exact same auth logic as
 * the shared AuthNav (`fetchMe` / `logout`) — only the styling differs.
 * Logged out → Login + Get started. Logged in → avatar with a dropdown menu.
 */
export function HeroAuthNav() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Reserve space to avoid layout shift / flash before auth state resolves.
  if (!ready) return <span style={{ width: 150, height: 43 }} aria-hidden />;

  if (!user) {
    return (
      <>
        <Link href={projectRoutes.signup()} className="hero-btn hero-btn-ghost">
          Login
        </Link>
        <Link href={projectRoutes.signup()} className="hero-btn hero-btn-primary">
          Get started
        </Link>
      </>
    );
  }

  const display = user.name || user.email;
  const initial = display.trim().charAt(0).toUpperCase() || "U";

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={display}
        className="hero-btn hero-btn-primary"
        style={{ width: 43, padding: 0, borderRadius: 999 }}
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#100a09]/95 shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur"
        >
          <div className="border-b border-white/10 px-4 py-3">
            <p className="truncate text-sm font-medium text-[#f1ece7]">
              {user.name || "Account"}
            </p>
            <p className="truncate text-xs text-white/50">{user.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              logout();
              setOpen(false);
              setUser(null);
              router.refresh();
              router.push("/");
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-white/70 transition-colors hover:bg-white/[0.05] hover:text-[#f1ece7]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
