"use client";

// ── Workspace overlay system ──────────────────────────────────────────────
// The ONE primitive behind every dropdown / menu / popover in the editor
// chrome, so positioning, dismissal, stacking, and a11y behave identically:
//
// • Panels portal to <body> and anchor to their trigger via floating-ui —
//   flip + shift keep them inside an 8px viewport boundary, and autoUpdate
//   repositions them when the viewport or any scroll container moves.
// • Exactly one overlay is open at a time: opening any overlay closes the
//   rest, and closeAllOverlays() lets tab switches force-close everything.
// • Escape and item-select close AND restore focus to the trigger;
//   outside-pointerdown closes without stealing focus.
//
// Trigger/panel elements are held in STATE via callback refs (React 19
// ref-as-prop) rather than RefObjects, so nothing ref-like is ever read
// during render. Spread `state.triggerProps` onto the trigger button — the
// callback ref rides along inside it.
//
// Z-index scale (see styles/cinematic.css): panels render at z-40; only
// modal backdrops (50) / dialogs (60) / toasts (70) may sit above them.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react-dom";

type Listener = (openId: string | null) => void;
const bus = new Set<Listener>();
const broadcast = (openId: string | null) => bus.forEach((l) => l(openId));

/** Force-close every open overlay (used on inspector tab switches etc.). */
export function closeAllOverlays() {
  broadcast(null);
}

export interface OverlayState {
  id: string;
  open: boolean;
  toggle: () => void;
  close: (opts?: { restoreFocus?: boolean }) => void;
  /** The live trigger element (set by the callback ref inside triggerProps). */
  triggerEl: HTMLButtonElement | null;
  /** Spread onto the trigger button — includes the ref and all aria wiring. */
  triggerProps: {
    ref: (el: HTMLButtonElement | null) => void;
    id: string;
    "aria-haspopup": "menu" | "dialog";
    "aria-expanded": boolean;
    "aria-controls": string | undefined;
    onClick: () => void;
  };
}

export function useOverlay(role: "menu" | "dialog" = "menu"): OverlayState {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [triggerEl, setTriggerEl] = useState<HTMLButtonElement | null>(null);

  // Single-open coordination: close when a DIFFERENT overlay announces itself
  // (or when closeAllOverlays broadcasts null).
  useEffect(() => {
    const l: Listener = (openId) => {
      if (openId !== id) setOpen(false);
    };
    bus.add(l);
    return () => void bus.delete(l);
  }, [id]);

  const close = useCallback(
    (opts?: { restoreFocus?: boolean }) => {
      setOpen(false);
      if (opts?.restoreFocus) triggerEl?.focus();
    },
    [triggerEl],
  );

  // NOTE: broadcast must stay OUTSIDE the setOpen updater — updaters can run
  // during React's render phase, and broadcasting there setStates every other
  // overlay while a component is rendering ("cannot update while rendering").
  const toggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    if (next) broadcast(id);
  }, [open, id]);

  return {
    id,
    open,
    toggle,
    close,
    triggerEl,
    triggerProps: {
      ref: setTriggerEl,
      id: `${id}-trigger`,
      "aria-haspopup": role,
      "aria-expanded": open,
      "aria-controls": open ? `${id}-panel` : undefined,
      onClick: toggle,
    },
  };
}

const CloseContext = createContext<OverlayState["close"]>(() => {});

export function OverlayPanel({
  state,
  align = "end",
  role = "menu",
  label,
  className = "",
  children,
}: {
  state: OverlayState;
  align?: "start" | "end";
  role?: "menu" | "dialog";
  /** Accessible name — panels portal away from their surrounding context. */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const { open, close, triggerEl, id } = state;
  const [panelEl, setPanelEl] = useState<HTMLElement | null>(null);

  const { floatingStyles } = useFloating({
    strategy: "fixed",
    placement: align === "end" ? "bottom-end" : "bottom-start",
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    elements: { reference: triggerEl, floating: panelEl },
  });

  // Escape closes + returns focus to the trigger; outside-pointerdown just
  // closes (the click's own target keeps focus).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close({ restoreFocus: true });
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelEl?.contains(t) || triggerEl?.contains(t)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, close, panelEl, triggerEl]);

  // Keyboard flow continues inside the panel: focus its first control (or the
  // panel itself for content-only popovers like Help).
  useEffect(() => {
    if (!open || !panelEl) return;
    const first = panelEl.querySelector<HTMLElement>("button, [href], input, [tabindex]");
    (first ?? panelEl).focus();
  }, [open, panelEl]);

  if (!open) return null;
  return createPortal(
    <div
      ref={setPanelEl}
      id={`${id}-panel`}
      role={role}
      aria-label={label}
      tabIndex={-1}
      style={floatingStyles as CSSProperties}
      className={`animate-dropdown-in z-40 rounded-xl border border-border-glass bg-surface-1 shadow-2xl shadow-black/50 outline-none ${className}`}
    >
      <CloseContext.Provider value={close}>{children}</CloseContext.Provider>
    </div>,
    document.body,
  );
}

/** A standard menu row: closes the overlay (restoring trigger focus), then acts. */
export function OverlayMenuItem({
  onSelect,
  disabled,
  className = "",
  children,
}: {
  onSelect: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const close = useContext(CloseContext);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        close({ restoreFocus: true });
        onSelect();
      }}
      className={`w-full rounded-lg px-3 py-2 text-left text-[13px] text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary focus-visible:bg-surface-2 disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}
