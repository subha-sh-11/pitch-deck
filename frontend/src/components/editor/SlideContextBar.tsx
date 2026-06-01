"use client";

import { useState } from "react";
import type { Slide, SlideAppearance } from "@/types/slide";
import {
  SLIDE_BACKGROUND_OPTIONS,
  SLIDE_COLOR_SWATCHES,
  SLIDE_STYLE_OPTIONS,
} from "@/lib/slide-appearance";

interface SlideContextBarProps {
  slide: Slide;
  onAppearanceChange: (appearance: Partial<SlideAppearance>) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onResetStyle?: () => void;
}

export function SlideContextBar({
  slide,
  onAppearanceChange,
  onDuplicate,
  onDelete,
  onResetStyle,
}: SlideContextBarProps) {
  const [styleOpen, setStyleOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const appearance = slide.appearance ?? {
    styleVariant: "cinematic",
    accentColor: "#22d3ee",
    backgroundKey: "default",
  };

  const bgPreview =
    SLIDE_BACKGROUND_OPTIONS.find((b) => b.id === appearance.backgroundKey) ??
    SLIDE_BACKGROUND_OPTIONS[0];

  function closeAll() {
    setStyleOpen(false);
    setColorOpen(false);
    setBgOpen(false);
    setMoreOpen(false);
  }

  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-[#E0E0E5] bg-white px-2 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              closeAll();
              setStyleOpen(!styleOpen);
            }}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#1A1A1F] hover:bg-[#F0F0F3]"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#F0F0F3] text-xs">
              ◫
            </span>
            Slide style
          </button>
          {styleOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-44 rounded-xl border border-[#E0E0E5] bg-white py-1 shadow-xl">
              {SLIDE_STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`block w-full px-4 py-2 text-left text-sm hover:bg-[#F0F0F3] ${
                    appearance.styleVariant === opt.id ? "font-semibold text-[#4F46E5]" : ""
                  }`}
                  onClick={() => {
                    onAppearanceChange({ styleVariant: opt.id });
                    setStyleOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              closeAll();
              setColorOpen(!colorOpen);
            }}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#1A1A1F] hover:bg-[#F0F0F3]"
          >
            <span
              className="h-6 w-6 rounded-md border border-[#E0E0E5]"
              style={{ backgroundColor: appearance.accentColor }}
            />
            Slide color
          </button>
          {colorOpen && (
            <div className="absolute bottom-full left-0 mb-2 rounded-xl border border-[#E0E0E5] bg-white p-3 shadow-xl">
              <div className="grid grid-cols-3 gap-2">
                {SLIDE_COLOR_SWATCHES.map((sw) => (
                  <button
                    key={sw.id}
                    type="button"
                    title={sw.label}
                    className={`h-8 w-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                      appearance.accentColor === sw.hex
                        ? "border-[#4F46E5]"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: sw.hex }}
                    onClick={() => {
                      onAppearanceChange({ accentColor: sw.hex });
                      setColorOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              closeAll();
              setBgOpen(!bgOpen);
            }}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#1A1A1F] hover:bg-[#F0F0F3]"
          >
            <span
              className="h-6 w-10 rounded-md border border-[#E0E0E5]"
              style={{ background: bgPreview.preview }}
            />
            Background image
          </button>
          {bgOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-52 rounded-xl border border-[#E0E0E5] bg-white p-2 shadow-xl">
              {SLIDE_BACKGROUND_OPTIONS.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  className={`mb-1 flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-[#F0F0F3] ${
                    appearance.backgroundKey === bg.id ? "ring-2 ring-[#4F46E5]" : ""
                  }`}
                  onClick={() => {
                    onAppearanceChange({ backgroundKey: bg.id });
                    setBgOpen(false);
                  }}
                >
                  <span
                    className="h-8 w-12 shrink-0 rounded-md border border-[#E0E0E5]"
                    style={{ background: bg.preview }}
                  />
                  {bg.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              closeAll();
              setMoreOpen(!moreOpen);
            }}
            className="rounded-xl px-2 py-2 text-[#5C5C66] hover:bg-[#F0F0F3]"
          >
            ···
          </button>
          {moreOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-40 rounded-xl border border-[#E0E0E5] bg-white py-1 shadow-xl">
              {["Duplicate slide", "Delete slide", "Reset style"].map((action) => (
                <button
                  key={action}
                  type="button"
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-[#F0F0F3]"
                  onClick={() => {
                    if (action === "Duplicate slide") onDuplicate?.();
                    if (action === "Delete slide") onDelete?.();
                    if (action === "Reset style") onResetStyle?.();
                    setMoreOpen(false);
                  }}
                >
                  {action}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
