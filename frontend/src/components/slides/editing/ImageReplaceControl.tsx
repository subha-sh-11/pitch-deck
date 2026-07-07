"use client";

import { useEffect, useRef, useState } from "react";
import { useSlideEdit } from "./SlideEditContext";

/** Floating control (top-right of the slide, edit mode only) to replace the slide image. */
export function ImageReplaceControl() {
  const { editing, imageUrl, imageActions, setImageUrl, imageEffects, patchContent } = useSlideEdit();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the popup when clicking anywhere outside it (or pressing Escape).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Fires on the file dialog too, but the file input lives inside rootRef, so picking a file
    // (which briefly blurs) won't close it.
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!editing) return null;

  async function onFile(file: File) {
    if (!imageActions?.upload) return;
    setBusy(true);
    try {
      const url = await imageActions.upload(file);
      setImageUrl(url);
      setOpen(false);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onRegenerate() {
    if (!imageActions?.regenerate) return;
    setBusy(true);
    setError(null);
    try {
      const url = await imageActions.regenerate();
      if (url) {
        setImageUrl(url);
        setOpen(false);
      } else {
        setError("Image service is busy (quota). Try again shortly, or upload / paste a URL.");
      }
    } catch {
      setError("Couldn't regenerate. Try again, or upload / paste a URL.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="absolute right-2 top-2 z-40" onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-[11px] text-white/90 backdrop-blur transition-colors hover:bg-black/75"
        title="Replace image"
      >
        <IconImage />
        {imageUrl ? "Replace image" : "Add image"}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-60 rounded-lg border border-white/10 bg-[#15151a] p-3 text-white shadow-2xl">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
          <button
            type="button"
            disabled={busy || !imageActions?.upload}
            onClick={() => fileRef.current?.click()}
            className="mb-2 w-full rounded-md bg-[#22d3ee] px-3 py-2 text-xs font-medium text-black hover:bg-[#22d3ee]/90 disabled:opacity-50"
          >
            {busy ? "Working…" : "Upload from computer"}
          </button>

          <div className="mb-2 flex gap-1">
            <input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="Paste image URL"
              className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-xs outline-none focus:border-[#22d3ee]"
            />
            <button
              type="button"
              disabled={!urlDraft.trim()}
              onClick={() => {
                setImageUrl(urlDraft.trim());
                setUrlDraft("");
                setOpen(false);
              }}
              className="rounded-md bg-white/10 px-2 py-1.5 text-xs hover:bg-white/20 disabled:opacity-40"
            >
              Set
            </button>
          </div>

          {imageActions?.regenerate && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onRegenerate()}
              className="w-full rounded-md border border-white/15 px-3 py-2 text-xs hover:bg-white/10 disabled:opacity-50"
            >
              ✨ Regenerate with AI
            </button>
          )}

          {/* Non-destructive adjustments to the CURRENT background image (blur / darken). */}
          {imageUrl && (
            <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
              <label className="block text-[11px] text-white/80">
                <span className="mb-1 flex justify-between">
                  <span>Blur background</span>
                  <span className="text-white/50">{imageEffects?.blur ?? 0}px</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={16}
                  step={1}
                  value={imageEffects?.blur ?? 0}
                  onChange={(e) => patchContent({ imageBlur: Number(e.target.value) })}
                  className="w-full accent-[#22d3ee]"
                />
              </label>
              <label className="block text-[11px] text-white/80">
                <span className="mb-1 flex justify-between">
                  <span>Darken background</span>
                  <span className="text-white/50">{Math.round((imageEffects?.dim ?? 0) * 100)}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={0.85}
                  step={0.05}
                  value={imageEffects?.dim ?? 0}
                  onChange={(e) => patchContent({ imageDim: Number(e.target.value) })}
                  className="w-full accent-[#22d3ee]"
                />
              </label>
              {(imageEffects?.blur || imageEffects?.dim) ? (
                <button
                  type="button"
                  onClick={() => patchContent({ imageBlur: 0, imageDim: 0 })}
                  className="text-[11px] text-white/50 underline hover:text-white/80"
                >
                  Reset image adjustments
                </button>
              ) : null}
            </div>
          )}

          {error && <p className="mt-2 text-[11px] leading-snug text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}

function IconImage() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}
