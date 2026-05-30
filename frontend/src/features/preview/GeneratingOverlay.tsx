"use client";

interface GeneratingOverlayProps {
  message?: string;
}

export function GeneratingOverlay({
  message = "Building your cinematic pitch deck…",
}: GeneratingOverlayProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-0/90 backdrop-blur-sm">
      <div className="glass-panel-strong max-w-md rounded-2xl p-10 text-center">
        <div className="mx-auto mb-6 h-12 w-12 animate-pulse rounded-full border-2 border-accent-gold border-t-transparent" />
        <p className="font-display text-xl font-semibold text-text-primary">
          {message}
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Applying template, visual direction, and your approved slide content.
        </p>
      </div>
    </div>
  );
}
