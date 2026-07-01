"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fetchMe, logout, type AuthUser } from "@/lib/api";
import { projectRoutes } from "@/lib/routes";

/** Nav auth state: "Get Started" when logged out; an avatar → dropdown menu when signed in. */
export function AuthNav() {
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

  // Close the dropdown on outside click / Escape.
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

  if (!ready) return <span className="h-9 w-9" aria-hidden />; // reserve space, avoid flash

  if (!user) {
    return (
      <Link
        href={projectRoutes.signup()}
        className="landing-btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold text-zinc-950"
      >
        Get Started
      </Link>
    );
  }

  const display = user.name || user.email;
  const initial = display.trim().charAt(0).toUpperCase() || "U";

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={display}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-neon/90 text-sm font-semibold text-zinc-950 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-accent-neon/50"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-xl border border-border-glass bg-surface-1/95 shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur"
        >
          <div className="border-b border-border-glass px-4 py-3">
            <p className="truncate text-sm font-medium text-text-primary">{user.name || "Account"}</p>
            <p className="truncate text-xs text-text-dim">{user.email}</p>
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
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-text-muted transition-colors hover:bg-white/[0.05] hover:text-text-primary"
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
