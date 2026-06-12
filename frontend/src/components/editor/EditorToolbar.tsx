"use client";

import { Button } from "@/components/ui/Button";

interface EditorToolbarProps {
  currentIndex: number;
  totalSlides: number;
  zoom: number;
  onPrevious: () => void;
  onNext: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onPreview?: () => void;
  onRegenerateStyle?: () => void;
  toastMessage?: string | null;
}

function ToolbarDivider() {
  return <span className="mx-1 hidden h-4 w-px bg-white/[0.08] sm:block" />;
}

export function EditorToolbar({
  currentIndex,
  totalSlides,
  zoom,
  onPrevious,
  onNext,
  onMoveUp,
  onMoveDown,
  onZoomIn,
  onZoomOut,
  onPreview,
  onRegenerateStyle,
  toastMessage,
}: EditorToolbarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-[#0c0c0c]/80 px-4 py-2">
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" size="sm" disabled={currentIndex === 0} onClick={onPrevious}>
          ← Previous
        </Button>
        <span className="min-w-[4.5rem] text-center text-xs font-medium text-[#9CA3AF]">
          {currentIndex + 1} / {totalSlides}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={currentIndex >= totalSlides - 1}
          onClick={onNext}
        >
          Next →
        </Button>

        <ToolbarDivider />

        <Button variant="ghost" size="sm" disabled={currentIndex === 0} onClick={onMoveUp}>
          Move up
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={currentIndex >= totalSlides - 1}
          onClick={onMoveDown}
        >
          Move down
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md text-sm text-[#9CA3AF] transition-colors hover:bg-white/[0.06] hover:text-[#F5F1E8]"
          onClick={onZoomOut}
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="min-w-[3rem] text-center text-xs font-medium text-[#9CA3AF]">
          {zoom}%
        </span>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md text-sm text-[#9CA3AF] transition-colors hover:bg-white/[0.06] hover:text-[#F5F1E8]"
          onClick={onZoomIn}
          aria-label="Zoom in"
        >
          +
        </button>

        <ToolbarDivider />

        <Button variant="ghost" size="sm" onClick={onPreview}>
          Preview
        </Button>
        <Button variant="ghost" size="sm" onClick={onRegenerateStyle}>
          Regenerate Deck Style
        </Button>

        {toastMessage && (
          <span className="ml-2 text-[11px] text-[#f8c9a4]">{toastMessage}</span>
        )}
      </div>
    </div>
  );
}
