"use client";

// Fully-themed replacement for native <select>: the browser's option popup
// can't be styled reliably (some Chromium builds paint it light regardless of
// color-scheme), so this renders options in-DOM via the workspace overlay
// system instead. Posts its value through a hidden input, so it drops into
// uncontrolled FormData forms exactly like a native select.

import { useState, type KeyboardEvent } from "react";
import { OverlayPanel, useOverlay } from "@/components/ui/overlay";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function Select({
  label,
  name,
  options,
  defaultValue,
  onChange,
  className = "",
}: SelectProps) {
  const overlay = useOverlay("menu");
  const [value, setValue] = useState(defaultValue ?? options[0]?.value ?? "");
  const selected = options.find((o) => o.value === value);

  function onPanelKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>("button[role='menuitemradio']"),
    );
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? items.length - 1
          : e.key === "ArrowDown"
            ? Math.min(idx + 1, items.length - 1)
            : Math.max(idx - 1, 0);
    items[next]?.focus();
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label
          htmlFor={overlay.triggerProps.id}
          className="block text-sm font-medium text-text-primary"
        >
          {label}
        </label>
      )}
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        {...overlay.triggerProps}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border-glass bg-surface-2 px-4 py-2.5 text-left text-sm text-text-primary transition-colors focus:border-accent-neon/50 focus:outline-none focus:ring-1 focus:ring-accent-neon/30"
      >
        <span className="truncate">{selected?.label ?? "Select…"}</span>
        <svg
          viewBox="0 0 16 16"
          className={`h-4 w-4 shrink-0 text-text-dim transition-transform ${overlay.open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      <OverlayPanel state={overlay} align="start" label={label ?? name} className="p-1.5">
        <div
          style={{ width: overlay.triggerEl?.offsetWidth }}
          className="max-h-72 overflow-y-auto"
          onKeyDown={onPanelKeyDown}
        >
          {options.map((o) => {
            const isSelected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                onClick={() => {
                  setValue(o.value);
                  onChange?.(o.value);
                  overlay.close({ restoreFocus: true });
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:bg-surface-2 ${
                  isSelected
                    ? "bg-surface-2 text-text-primary"
                    : "text-text-muted hover:bg-surface-2 hover:text-text-primary"
                }`}
              >
                <span className="truncate">{o.label}</span>
                {isSelected && (
                  <svg
                    viewBox="0 0 16 16"
                    className="h-4 w-4 shrink-0 text-accent-neon"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M3 8.5l3.5 3.5L13 5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </OverlayPanel>
    </div>
  );
}
