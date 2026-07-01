"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Interview } from "./useInterview";

const MAX_REFERENCES = 10;

/**
 * "Choose Your Visual Direction" — the director collects up to 10 inspiration references in a single
 * folder-like container. Thumbnails sit INSIDE the box as a horizontal strip (fixed height, scrolls
 * left→right) so adding images never pushes the brief/summary below it down. The Add button stays
 * pinned on the right; clicking a thumbnail opens a lightbox; hovering reveals a remove control.
 */
export function ReferenceUpload({ iv }: { iv: Interview }) {
  const { referenceImages, addReferenceImages, removeReferenceImage } = iv;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const count = referenceImages.length;
  const full = count >= MAX_REFERENCES;
  const active = referenceImages.find((r) => r.id === activeId) ?? null;

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (files && files.length) addReferenceImages(Array.from(files));
    },
    [addReferenceImages],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (!full) handleFiles(e.dataTransfer.files);
    },
    [full, handleFiles],
  );

  const openPicker = () => {
    if (!full) inputRef.current?.click();
  };

  // Close the lightbox on Escape.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <section className="shrink-0 border-b border-border-glass bg-surface-1/30 px-4 py-3">
      <header className="mb-2.5 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-neon">
            Choose Your Visual Direction
          </h3>
          <p className="text-[11px] text-text-muted">
            Drop a collection of references — stills, posters, palettes — and I’ll use them for
            inspiration.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border-glass px-2.5 py-1 text-[11px] text-text-muted">
          {count}/{MAX_REFERENCES} references
        </span>
      </header>

      {/* One fixed-height container. Thumbnails fill it left→right and scroll horizontally; the
          Add button is a sibling pinned on the right, so the section never grows taller. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!full) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex h-[108px] items-stretch gap-2 rounded-xl border-2 border-dashed p-2 transition-colors ${
          dragging ? "border-accent-neon bg-accent-neon/10" : "border-border-glass bg-surface-2/30"
        }`}
      >
        <div className="flex min-w-0 flex-1 items-stretch gap-2 overflow-x-auto [scrollbar-width:thin]">
          {count === 0 ? (
            <button
              type="button"
              onClick={openPicker}
              className="flex w-full items-center justify-center gap-2 rounded-lg text-sm text-text-muted transition-colors hover:text-text-primary"
            >
              <FolderIcon active={dragging} />
              Drop references here, or click to add
            </button>
          ) : (
            referenceImages.map((ref) => (
              <figure
                key={ref.id}
                className="group relative aspect-square h-full shrink-0 overflow-hidden rounded-lg border border-border-glass bg-surface-2/40"
              >
                <button
                  type="button"
                  onClick={() => setActiveId(ref.id)}
                  aria-label={`Preview ${ref.name}`}
                  className="block h-full w-full"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- ephemeral object URL, not a static/remote asset */}
                  <img src={ref.previewUrl} alt={ref.name} className="h-full w-full object-cover" />
                </button>
                <button
                  type="button"
                  onClick={() => removeReferenceImage(ref.id)}
                  aria-label={`Remove ${ref.name}`}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/85 group-hover:opacity-100"
                >
                  <CloseIcon />
                </button>
              </figure>
            ))
          )}
        </div>

        {/* Add button — always on the right, never scrolls away. */}
        {count > 0 && (
          <button
            type="button"
            onClick={openPicker}
            disabled={full}
            title={full ? "Reference folder full" : "Add references"}
            className={`flex aspect-square h-full shrink-0 flex-col items-center justify-center gap-1 rounded-lg border text-[11px] transition-all active:scale-95 ${
              full
                ? "cursor-not-allowed border-border-glass text-text-dim opacity-50 active:scale-100"
                : "cursor-pointer border-border-glass bg-surface-2/40 text-text-muted hover:border-accent-neon/50 hover:bg-surface-2/70 hover:text-text-primary"
            }`}
          >
            <PlusIcon />
            {full ? "Full" : "Add"}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = ""; // allow re-selecting the same file after a remove
        }}
      />

      {/* Lightbox — larger preview of the clicked reference. */}
      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview of ${active.name}`}
          onClick={() => setActiveId(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm"
        >
          <figure className="relative max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ephemeral object URL, not a static/remote asset */}
            <img
              src={active.previewUrl}
              alt={active.name}
              className="max-h-[82vh] w-auto rounded-lg object-contain shadow-2xl"
            />
            <figcaption className="mt-2 text-center text-sm text-white/80">{active.name}</figcaption>
            <button
              type="button"
              onClick={() => setActiveId(null)}
              aria-label="Close preview"
              className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-zinc-900 shadow-lg transition-colors hover:bg-white/90"
            >
              <CloseIcon />
            </button>
          </figure>
        </div>
      )}
    </section>
  );
}

function FolderIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={active ? "text-accent-neon" : "text-text-dim"}
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M12 11v5M9.5 13.5 12 11l2.5 2.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
