"use client";

import { useRef, useState } from "react";
import { closeAllOverlays } from "@/components/ui/overlay";
import {
  DEFAULT_SLIDE_APPEARANCE,
  SLIDE_BACKGROUND_OPTIONS,
  SLIDE_COLOR_SWATCHES,
  SLIDE_STYLE_OPTIONS,
} from "@/lib/slide-appearance";
import type { Slide, SlideAppearance, SlideVersion } from "@/types/slide";

export type InspectorTab = "design" | "images" | "history";

const TAB_ORDER: InspectorTab[] = ["design", "images", "history"];

/** Uploads above this size are rejected before they ever hit the network. */
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

// The right-hand properties inspector for the presentation editor: what's ON the
// selected slide (Images), how it LOOKS (Design), and what it USED to be (History).
// Collapsible to a 44px icon rail; width is controlled by the parent workspace.
export function DeckInspector({
  slide,
  images,
  currentImageUrl,
  versions,
  busy,
  actionError,
  onClearError,
  onUseImage,
  onRemoveImage,
  onImportImage,
  onGenerateImage,
  onRestoreVersion,
  onAppearance,
  collapsed,
  onExpand,
  onCollapse,
}: {
  slide?: Slide;
  images: string[];
  currentImageUrl?: string;
  versions: SlideVersion[];
  busy: null | "import" | "generate";
  /** Async generate/upload failure from the parent — shown in the Images tab. */
  actionError?: string | null;
  onClearError?: () => void;
  onUseImage: (url: string) => void;
  onRemoveImage: (url: string) => void;
  onImportImage: (file: File) => void;
  onGenerateImage: () => void;
  onRestoreVersion: (v: SlideVersion) => void;
  onAppearance: (patch: Partial<SlideAppearance>) => void;
  collapsed: boolean;
  onExpand: (tab?: InspectorTab) => void;
  onCollapse: () => void;
}) {
  const [tab, setTab] = useState<InspectorTab>("images");
  const fileRef = useRef<HTMLInputElement>(null);
  // Upload-validation errors, merged with the parent's async errors for display.
  const [localError, setLocalError] = useState<string | null>(null);
  // Gallery selection: click picks a thumbnail; an explicit action (or double-click)
  // applies it. A url that left the gallery (slide switched, image deleted) is ignored,
  // which also resets the pick when the director moves to another slide.
  const [picked, setPicked] = useState<string | null>(null);
  const pickedThumb = picked && images.includes(picked) ? picked : null;
  const error = localError ?? actionError ?? null;

  const appearance: SlideAppearance = { ...DEFAULT_SLIDE_APPEARANCE, ...(slide?.appearance ?? {}) };
  const composition = appearance.composition ?? "full";

  // Switching inspector context dismisses any open menu/popover app-wide.
  const selectTab = (t: InspectorTab) => {
    setTab(t);
    closeAllOverlays();
  };
  const open = (t: InspectorTab) => {
    selectTab(t);
    if (collapsed) onExpand(t);
  };

  if (collapsed) {
    return (
      <div className="flex h-full w-11 shrink-0 flex-col items-center gap-1 border-l border-border-glass bg-surface-1/40 py-2">
        <RailButton title="Design" onClick={() => open("design")}>
          <BrushIcon />
        </RailButton>
        <RailButton title="Images" onClick={() => open("images")}>
          <ImageIcon />
        </RailButton>
        <RailButton title={`History${versions.length ? ` · ${versions.length}` : ""}`} onClick={() => open("history")}>
          <HistoryIcon />
        </RailButton>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-1/40">
      {/* Tabs + collapse — 44px row; the whole tab surface is clickable. */}
      <div className="flex h-11 shrink-0 items-stretch gap-1 border-b border-border-glass px-2 py-1">
        <InspectorTabs tab={tab} onSelect={selectTab} historyCount={versions.length} />
        <button
          type="button"
          onClick={onCollapse}
          title="Collapse the inspector"
          aria-label="Collapse the inspector"
          className="my-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-dim transition-colors hover:bg-surface-2 hover:text-text-primary"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      </div>

      {/* What the inspector is editing */}
      {slide && (
        <div className="shrink-0 border-b border-border-glass px-4 py-2 text-xs text-text-dim">
          Slide {slide.slideNumber} · <span className="text-text-muted">{slide.title || slide.slideType}</span>
        </div>
      )}

      {/* Only THIS region scrolls — never the page. @container drives the gallery's
          one-vs-two-column layout off the actual inspector width. */}
      <div className="@container min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {tab === "design" && (
          <div role="tabpanel" id="insp-panel-design" aria-labelledby="insp-tab-design" className="space-y-5 p-4">
            <Field label="Style">
              <div className="grid grid-cols-3 gap-1.5">
                {SLIDE_STYLE_OPTIONS.map((o) => (
                  <ChoiceButton
                    key={o.id}
                    active={appearance.styleVariant === o.id}
                    onClick={() => onAppearance({ styleVariant: o.id })}
                  >
                    {o.label}
                  </ChoiceButton>
                ))}
              </div>
            </Field>

            <Field label="Composition" hint="How the image and text share the slide">
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { id: "full", label: "Full bleed" },
                  { id: "split", label: "Split" },
                  { id: "framed", label: "Framed" },
                ] as const).map((o) => (
                  <ChoiceButton
                    key={o.id}
                    active={composition === o.id}
                    onClick={() => onAppearance({ composition: o.id })}
                  >
                    {o.label}
                  </ChoiceButton>
                ))}
              </div>
              {composition !== "full" && (
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  {(["left", "right"] as const).map((side) => (
                    <ChoiceButton
                      key={side}
                      active={(appearance.imageSide ?? "right") === side}
                      onClick={() => onAppearance({ imageSide: side })}
                    >
                      Image {side}
                    </ChoiceButton>
                  ))}
                </div>
              )}
            </Field>

            <Field label="Background">
              <div className="grid grid-cols-5 gap-1.5">
                {SLIDE_BACKGROUND_OPTIONS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    title={b.label}
                    onClick={() => onAppearance({ backgroundKey: b.id })}
                    className={`aspect-square rounded-lg border transition-all ${
                      appearance.backgroundKey === b.id
                        ? "border-accent-neon ring-1 ring-accent-neon/50"
                        : "border-border-glass hover:border-white/40"
                    }`}
                    style={{ background: b.preview }}
                  />
                ))}
              </div>
            </Field>

            <Field label="Slide accent">
              <div className="flex flex-wrap items-center gap-1.5">
                {SLIDE_COLOR_SWATCHES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.label}
                    onClick={() => onAppearance({ accentColor: c.hex })}
                    className={`h-6 w-6 rounded-full border transition-all ${
                      appearance.accentColor.toLowerCase() === c.hex.toLowerCase()
                        ? "border-accent-neon ring-1 ring-accent-neon/50"
                        : "border-white/20 hover:border-white/50"
                    }`}
                    style={{ background: c.hex }}
                  />
                ))}
                <label
                  className="flex h-6 cursor-pointer items-center gap-1 rounded-full border border-border-glass px-2 text-[10px] uppercase tracking-wider text-text-dim hover:text-text-primary"
                  title="Pick any accent colour for this slide"
                >
                  Custom
                  <input
                    type="color"
                    value={appearance.accentColor}
                    onChange={(e) => onAppearance({ accentColor: e.target.value })}
                    className="h-4 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                </label>
              </div>
            </Field>

            <Field label="Text colour" hint="Overrides the deck palette on this slide only">
              <div className="flex items-center gap-1.5">
                <label className="flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-border-glass px-2 text-xs text-text-muted hover:text-text-primary">
                  <input
                    type="color"
                    value={appearance.textColor ?? "#fafafa"}
                    onChange={(e) => onAppearance({ textColor: e.target.value })}
                    className="h-4 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  {appearance.textColor ?? "Deck default"}
                </label>
                {appearance.textColor && (
                  <button
                    type="button"
                    onClick={() => onAppearance({ textColor: undefined })}
                    className="rounded-lg border border-border-glass px-2 py-1 text-xs text-text-dim transition-colors hover:text-text-primary"
                    title="Back to the deck's palette"
                  >
                    Reset
                  </button>
                )}
              </div>
            </Field>
          </div>
        )}

        {tab === "images" && (
          <div role="tabpanel" id="insp-panel-images" aria-labelledby="insp-tab-images" className="p-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                // Clear immediately so picking the SAME file again still fires onChange.
                e.currentTarget.value = "";
                if (!f) return;
                if (!f.type.startsWith("image/")) {
                  setLocalError("That file isn't an image — use PNG, JPG, WebP, or GIF.");
                  return;
                }
                if (f.size > MAX_UPLOAD_BYTES) {
                  setLocalError("That image is over 12 MB — please pick a smaller file.");
                  return;
                }
                setLocalError(null);
                onImportImage(f);
              }}
            />

            {error && (
              <div
                role="alert"
                className="mb-3 flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-300"
              >
                <span className="min-w-0 flex-1">{error}</span>
                <button
                  type="button"
                  aria-label="Dismiss error"
                  onClick={() => {
                    setLocalError(null);
                    onClearError?.();
                  }}
                  className="shrink-0 rounded px-1 text-red-300/80 transition-colors hover:text-red-200"
                >
                  ×
                </button>
              </div>
            )}

            <div className="mb-3 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onGenerateImage}
                disabled={!!busy}
                aria-busy={busy === "generate"}
                className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent-neon text-xs font-semibold text-zinc-950 transition-colors hover:bg-accent-neon-dim disabled:opacity-50"
                title="Generate one new image for this slide"
              >
                ✨ Generate
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={!!busy}
                aria-busy={busy === "import"}
                className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-glass text-xs font-semibold text-text-muted transition-colors hover:text-text-primary disabled:opacity-50"
                title="Upload an image from your computer"
              >
                ⬆ Upload
              </button>
            </div>
            {busy && (
              <p aria-live="polite" className="mb-3 flex items-center gap-2 text-xs text-text-dim">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-neon border-t-transparent" />
                {busy === "import"
                  ? "Uploading…"
                  : "Generating — your current image stays until the new one is ready…"}
              </p>
            )}

            {currentImageUrl && (
              <section className="mb-4">
                <SectionLabel>In this slide</SectionLabel>
                <div className="overflow-hidden rounded-lg border-2 border-accent-neon">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentImageUrl} alt="Current slide image" className="aspect-video w-full object-cover" />
                </div>
                {/* Essential controls stay visible — never hover-only. */}
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={!!busy}
                    title="Replace with an image from your computer"
                    className="flex h-8 items-center justify-center rounded-lg border border-border-glass text-xs text-text-muted transition-colors hover:border-white/30 hover:text-text-primary disabled:opacity-50"
                  >
                    Replace…
                  </button>
                  <button
                    type="button"
                    onClick={() => onUseImage(currentImageUrl)}
                    title="Remove from this slide (stays in the gallery)"
                    className="flex h-8 items-center justify-center rounded-lg border border-border-glass text-xs text-text-muted transition-colors hover:border-red-400/40 hover:text-red-300"
                  >
                    Remove from slide
                  </button>
                </div>
              </section>
            )}

            <section>
              <SectionLabel>Gallery</SectionLabel>
              {images.length === 0 && !busy ? (
                <div className="flex flex-col items-center gap-2.5 px-4 py-10 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-text-dim">
                    <ImageIcon />
                  </span>
                  <p className="text-sm font-medium text-text-muted">No images yet</p>
                  <p className="text-xs leading-relaxed text-text-dim">
                    Generate a cinematic still for this slide, or upload your own.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 @min-[15rem]:grid-cols-2">
                  {images.map((u, i) => {
                    const current = u === currentImageUrl;
                    const isPicked = u === pickedThumb;
                    return (
                      <div
                        key={`${i}-${u}`}
                        className={`relative overflow-hidden rounded-lg border-2 transition-colors ${
                          current
                            ? "border-accent-neon"
                            : isPicked
                              ? "border-white/60"
                              : "border-transparent hover:border-white/40"
                        }`}
                      >
                        {/* Click selects; double-click (or the explicit button) applies —
                            so scrolling past thumbnails can't change the slide. */}
                        <button
                          type="button"
                          onClick={() => setPicked(u)}
                          onDoubleClick={() => onUseImage(u)}
                          title="Click to select — double-click to place on the slide"
                          className="block w-full"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt={`Gallery image ${i + 1}`} className="aspect-video w-full object-cover" />
                        </button>
                        {current && (
                          <span className="pointer-events-none absolute left-1 top-1 rounded bg-accent-neon px-1.5 text-[9px] font-semibold text-zinc-950">
                            ✓ In slide
                          </span>
                        )}
                        {isPicked && (
                          <div className="flex gap-1 bg-surface-2/60 p-1">
                            <button
                              type="button"
                              onClick={() => onUseImage(u)}
                              className="h-7 min-w-0 flex-1 truncate rounded-md bg-surface-3 px-1 text-[11px] font-medium text-text-primary transition-colors hover:bg-[var(--surface-4)]"
                            >
                              {current ? "Remove from slide" : "Use on slide"}
                            </button>
                            <button
                              type="button"
                              aria-label="Delete image from the gallery"
                              title="Delete from the gallery"
                              onClick={() => {
                                setPicked(null);
                                onRemoveImage(u);
                              }}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-dim transition-colors hover:bg-red-500/20 hover:text-red-300"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "history" && (
          <div role="tabpanel" id="insp-panel-history" aria-labelledby="insp-tab-history" className="p-3">
            {versions.length === 0 ? (
              <div className="flex flex-col items-center gap-2.5 px-4 py-12 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-text-dim">
                  <HistoryIcon />
                </span>
                <p className="text-sm font-medium text-text-muted">No earlier versions yet</p>
                <p className="text-xs leading-relaxed text-text-dim">
                  Changes to this slide will appear here, so you can compare or restore them.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {[...versions].reverse().map((v) => (
                  <button
                    key={v.ts}
                    type="button"
                    onClick={() => onRestoreVersion(v)}
                    title="Restore this version"
                    className="group flex items-center gap-2 overflow-hidden rounded-lg border border-transparent p-1 text-left transition-colors hover:border-white/30 hover:bg-white/[0.03]"
                  >
                    <span className="relative block h-11 w-20 shrink-0 overflow-hidden rounded bg-surface-2">
                      {v.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.imageUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] text-text-muted">{v.label}</span>
                      <span className="block text-[10px] text-text-dim">
                        {new Date(v.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-accent-neon opacity-0 transition-opacity group-hover:opacity-100">
                      Restore
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">{label}</span>
      </div>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-snug text-text-dim/80">{hint}</p>}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">{children}</h3>
  );
}

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
        active
          ? "border-accent-neon bg-accent-neon/10 text-text-primary"
          : "border-border-glass text-text-muted hover:border-white/30 hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

/** Proper ARIA tabs: whole surface clickable, roving tabindex, ←/→ move between
 *  tabs, and every switch force-closes any open menu/popover. */
function InspectorTabs({
  tab,
  onSelect,
  historyCount,
}: {
  tab: InspectorTab;
  onSelect: (t: InspectorTab) => void;
  historyCount: number;
}) {
  const refs = useRef(new Map<InspectorTab, HTMLButtonElement>());
  const move = (from: InspectorTab, dir: 1 | -1) => {
    const next = TAB_ORDER[(TAB_ORDER.indexOf(from) + dir + TAB_ORDER.length) % TAB_ORDER.length];
    onSelect(next);
    refs.current.get(next)?.focus();
  };
  const labelFor = (t: InspectorTab) =>
    t === "design" ? "Design" : t === "images" ? "Images" : historyCount ? `History · ${historyCount}` : "History";

  return (
    <div role="tablist" aria-label="Slide inspector" className="flex min-w-0 flex-1 items-stretch gap-1">
      {TAB_ORDER.map((t) => {
        const active = t === tab;
        return (
          <button
            key={t}
            ref={(el) => {
              if (el) refs.current.set(t, el);
              else refs.current.delete(t);
            }}
            type="button"
            role="tab"
            id={`insp-tab-${t}`}
            aria-selected={active}
            aria-controls={`insp-panel-${t}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(t)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                move(t, 1);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                move(t, -1);
              }
            }}
            className={`relative min-w-0 flex-1 truncate rounded-md px-2 text-[13px] font-medium transition-colors ${
              active ? "bg-surface-3 text-text-primary" : "text-text-dim hover:bg-surface-2/60 hover:text-text-muted"
            }`}
          >
            {labelFor(t)}
            {/* Active underline — anchors the selected tab beyond the fill alone. */}
            {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent-neon" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

function RailButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-text-dim transition-colors hover:bg-surface-2 hover:text-text-primary"
    >
      {children}
    </button>
  );
}

function BrushIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M9.06 11.9 20.5 3.5c.6-.44 1.44.4 1 1L13.1 15.94" />
      <path d="M9.06 11.9c-2.3.3-3.56 1.7-3.56 3.6 0 1.9-1.5 2.5-3 2.5 1 1.5 2.5 2.5 4.5 2.5 3 0 6.1-1.6 6.1-4.56" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m5 19 5.5-5.5L14 17l3-3 4 4" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}
