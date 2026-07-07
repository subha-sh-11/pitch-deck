"use client";

import { useRef, useState } from "react";
import { useSlideEdit } from "./SlideEditContext";

/**
 * Hover controls for a repeatable "card" in a list-based slide (genre tiles, comp cards, USP
 * points, market cards…). Drop inside a `group relative` card wrapper. Duplicates/deletes the
 * WHOLE card via the slide's content array (patchContent), so cards behave like PowerPoint blocks.
 * Pass `onSetImage` for cards that carry their OWN image (characters, genre tiles) to enable
 * per-card upload / paste-URL.
 */
export function CardControls({
  onDuplicate,
  onDelete,
  onSetImage,
}: {
  onDuplicate: () => void;
  onDelete: () => void;
  onSetImage?: (url: string) => void;
}) {
  const { editing, imageActions } = useSlideEdit();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  if (!editing) return null;

  const pickImage = async (file: File) => {
    if (!imageActions?.upload || !onSetImage) return;
    setBusy(true);
    try {
      onSetImage(await imageActions.upload(file));
    } finally {
      setBusy(false);
    }
  };
  const pasteImage = () => {
    const url = window.prompt("Paste an image URL for this card:")?.trim();
    if (url && onSetImage) onSetImage(url);
  };

  return (
    <div
      data-slide-toolbar
      className="absolute right-1.5 top-1.5 z-30 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {onSetImage && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickImage(f);
              e.currentTarget.value = "";
            }}
          />
          <button
            type="button"
            title="Change this card's image (upload)"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
            disabled={busy}
            className="flex h-6 w-6 items-center justify-center rounded bg-black/70 text-xs text-white hover:bg-black/90 disabled:opacity-50"
          >
            {busy ? "…" : "🖼"}
          </button>
          <button
            type="button"
            title="Set this card's image from a URL"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); pasteImage(); }}
            className="flex h-6 w-6 items-center justify-center rounded bg-black/70 text-[10px] text-white hover:bg-black/90"
          >
            🔗
          </button>
        </>
      )}
      <button
        type="button"
        title="Duplicate this card"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate();
        }}
        className="flex h-6 w-6 items-center justify-center rounded bg-black/70 text-xs text-white hover:bg-black/90"
      >
        ⧉
      </button>
      <button
        type="button"
        title="Delete this card"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="flex h-6 w-6 items-center justify-center rounded bg-black/70 text-xs text-white hover:bg-red-500/80"
      >
        ✕
      </button>
    </div>
  );
}
