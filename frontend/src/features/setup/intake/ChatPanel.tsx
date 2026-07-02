"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { projectRoutes } from "@/lib/routes";
import type { ChatMessage, Interview } from "./useInterview";
import { useWorkshopOptional } from "./workshop";

// The left conversation rail (narrow). All state lives in the shared interview
// hook. The producer asks here; tappable options appear inline; the deck builds
// on the canvas to the right.
// Scripts/docs get parsed, images get staged, and ANY other file is attached as-is.
const ALL_ACCEPT = "*/*";

export function ChatPanel({ iv }: { iv: Interview }) {
  const [draft, setDraft] = useState("");
  // Images pasted/dropped/picked but NOT sent — held as chips IN the composer (like Claude),
  // so the director can add a prompt and send both together. They never touch the chat until Send.
  const [staged, setStaged] = useState<{ id: string; file: File; name: string; url: string }[]>([]);
  const stagedSeq = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const stageImages = (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    setStaged((prev) => [
      ...prev,
      ...imgs.map((file) => ({ id: `s${stagedSeq.current++}`, file, name: file.name, url: URL.createObjectURL(file) })),
    ]);
  };

  const removeStaged = (id: string) => {
    setStaged((prev) => {
      const hit = prev.find((s) => s.id === id);
      if (hit) URL.revokeObjectURL(hit.url);
      return prev.filter((s) => s.id !== id);
    });
  };
  // The slide the director currently has open in the workshop — passed to the deck
  // agent as the default target so "this slide" / "add an image" resolve correctly.
  const workshop = useWorkshopOptional();
  const selectedSlideId = workshop?.slide?.id;

  // Open the file picker filtered to a specific type (set per option / the + button).
  const openPicker = (accept: string) => {
    const el = fileRef.current;
    if (!el) return;
    el.accept = accept;
    el.click();
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [iv.messages, iv.thinking]);

  const send = async () => {
    const value = draft.trim();
    if ((!value && staged.length === 0) || iv.thinking) return;
    const files = staged.map((s) => s.file);
    staged.forEach((s) => URL.revokeObjectURL(s.url));
    setStaged([]);
    setDraft("");
    // Queue each staged image (shows it in the chat + queues for the turn) — no agent call yet.
    for (const f of files) await iv.uploadFile(f, selectedSlideId, true);
    if (value) {
      iv.sendText(value, selectedSlideId);
    } else if (files.length) {
      // Image-only send (director gave no prompt) → let the agent react to the queued image.
      iv.sendText(
        files.length > 1 ? "Use these reference images as visual direction." : "Use this reference image as visual direction.",
        selectedSlideId,
      );
    }
  };

  const pending = [...iv.questions].reverse().find((q) => q.answer === undefined);
  const options = pending?.options ?? [];
  const isCards = pending?.inputType === "cards";

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-1/40">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border-glass px-3 py-3">
        <Link
          href={projectRoutes.dashboard()}
          title="Back to dashboard"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-text-dim hover:bg-surface-2 hover:text-text-primary"
        >
          <BackIcon />
        </Link>
        <PaletteIcon />
        <span className="flex-1 truncate text-sm font-medium text-text-primary">{iv.projectName}</span>
        <Link
          href={projectRoutes.newProject()}
          title="Create a new pitch deck"
          className="flex shrink-0 items-center gap-1 rounded-lg border border-border-glass px-2 py-1 text-xs text-text-muted transition-colors hover:border-accent-neon/40 hover:text-text-primary"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New
        </Link>
      </div>

      {iv.offline && (
        <div className="mx-3 mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Producer service unreachable — running offline. Your answers are still saved.
        </div>
      )}

      {/* Message log */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
        {iv.messages.map((m) => (
          <MessageView key={m.id} message={m} />
        ))}
        {/* Start state: labelled context options (only before the conversation gets going). */}
        {iv.messages.length <= 1 && options.length === 0 && !iv.thinking && (
          <ContextOptions onDescribe={() => textareaRef.current?.focus()} />
        )}
        {iv.thinking && <Thinking />}
      </div>

      {/* Inline tappable options for the current question */}
      {options.length > 0 && (
        <div className="px-3 pb-1">
          <div className={isCards ? "grid grid-cols-1 gap-2 sm:grid-cols-2" : "flex flex-wrap gap-2"}>
            {options.map((o, i) => (
              <button
                key={i}
                type="button"
                onClick={() => iv.chooseOption(o)}
                className={
                  isCards
                    ? `rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                        o.selected
                          ? "border-accent-neon bg-accent-neon/10 text-text-primary"
                          : "border-border-glass bg-surface-2/60 text-text-muted hover:border-accent-neon/40 hover:text-text-primary"
                      }`
                    : `rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                        o.selected
                          ? "border-accent-neon bg-accent-neon/15 text-accent-neon"
                          : "border-border-glass bg-surface-2/60 text-text-muted hover:border-accent-neon/40 hover:text-text-primary"
                      }`
                }
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Brief strength — tells the director how close they are to a strong deck. */}
      {iv.draftSlides.length === 0 && <BriefStrength iv={iv} />}

      {/* Composer */}
      <div className="px-3 pb-3 pt-1">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="*/*"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            // Images stage as chips (send with a prompt); docs/scripts process immediately.
            stageImages(files.filter((f) => f.type.startsWith("image/")));
            files.filter((f) => !f.type.startsWith("image/")).forEach((f) => void iv.uploadFile(f, selectedSlideId));
            e.currentTarget.value = "";
          }}
        />
        <div
          className="rounded-2xl border border-white/15 bg-surface-2/80 p-3 shadow-lg shadow-black/20 transition-colors focus-within:border-accent-neon/50"
          onDragOver={(e) => {
            if (Array.from(e.dataTransfer?.items ?? []).some((it) => it.kind === "file")) e.preventDefault();
          }}
          onDrop={(e) => {
            const imgs = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
            if (imgs.length) {
              e.preventDefault();
              stageImages(imgs); // chip in the composer — sent on Send
            }
          }}
        >
          {/* Staged image chips (pasted/dropped, not yet sent) */}
          {staged.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {staged.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-lg border border-white/15 bg-surface-3/70 py-1 pl-1 pr-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt="" className="h-6 w-6 rounded object-cover" />
                  <span className="max-w-[130px] truncate text-xs text-text-muted">{s.name}</span>
                  <button
                    type="button"
                    onClick={() => removeStaged(s.id)}
                    aria-label="Remove"
                    className="text-text-dim transition-colors hover:text-text-primary"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            // Paste an image straight from the clipboard. Text paste is untouched (we only
            // intercept when the clipboard actually contains image files).
            onPaste={(e) => {
              const imgs = Array.from(e.clipboardData?.items ?? [])
                .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
                .map((it) => it.getAsFile())
                .filter((f): f is File => !!f);
              if (imgs.length) {
                e.preventDefault();
                stageImages(imgs); // chip in the composer — sent on Send
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={3}
            placeholder={options.length ? "…or type your own answer" : "Paste a logline, story idea, or script summary…"}
            className="w-full resize-none bg-transparent px-2 py-1 text-sm text-text-primary placeholder:text-text-muted/70 focus:outline-none"
          />
          <div className="flex items-center justify-between pt-1.5">
            <IconButton
              title="Attach files — scripts, reference images, mood boards, themes"
              onClick={() => openPicker(ALL_ACCEPT)}
            >
              <PlusIcon />
            </IconButton>
            <button
              onClick={() => void send()}
              disabled={(!draft.trim() && staged.length === 0) || iv.thinking}
              title="Send"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-neon text-zinc-950 shadow-[0_0_16px_rgba(248,201,164,0.35)] transition-all hover:bg-accent-neon-dim active:scale-95 disabled:cursor-not-allowed disabled:bg-accent-neon/30 disabled:shadow-none"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContextOptions({ onDescribe }: { onDescribe: () => void }) {
  return (
    <div className="animate-intake-fade-in pt-3">
      {/* Primary action — the single, obvious place to start. */}
      <button
        type="button"
        onClick={onDescribe}
        className="group flex w-full items-center justify-between gap-3 rounded-xl border border-accent-neon/50 bg-accent-neon/10 px-4 py-3.5 text-left transition-all hover:border-accent-neon hover:bg-accent-neon/15 active:scale-[0.99]"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-neon text-zinc-950">
            <PencilIcon />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-text-primary">Describe your film idea</span>
            <span className="block text-xs text-text-muted">Type a logline or a paragraph to begin</span>
          </span>
        </span>
        <ArrowIcon className="shrink-0 text-accent-neon transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}

// How fully the brief is specified — drives the "Brief strength" guidance so the
// director knows what to add next before generating questions.
function BriefStrength({ iv }: { iv: Interview }) {
  const f = iv.form;
  const signals = [
    (f.title ?? "").trim(),
    ((f.logline ?? "").trim() || (f.synopsis ?? "").trim()),
    (f.genreBlend ?? "").trim(),
    (f.targetAudience ?? "").trim(),
    (f.visualAesthetic ?? "").trim(),
  ].filter(Boolean).length + (iv.referenceImages.length > 0 ? 1 : 0);

  const level = signals >= 4 ? "Strong" : signals >= 2 ? "Medium" : "Low";
  const hint =
    level === "Strong"
      ? "Ready to generate questions."
      : level === "Medium"
        ? "Getting there — add genre, audience, or visual references to sharpen it."
        : "Add a story idea, genre, and visual references to improve it.";
  const tone =
    level === "Strong"
      ? "text-accent-neon"
      : level === "Medium"
        ? "text-amber-300"
        : "text-text-muted";
  const filled = Math.min(6, signals);

  return (
    <div className="mx-3 mb-1 rounded-xl border border-border-glass bg-surface-2/40 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          Brief strength
        </span>
        <span className={`text-xs font-semibold ${tone}`}>{level}</span>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < filled
                ? level === "Strong"
                  ? "bg-accent-neon"
                  : level === "Medium"
                    ? "bg-amber-400/70"
                    : "bg-text-dim"
                : "bg-surface-3"
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-text-dim">{hint}</p>
    </div>
  );
}

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function MessageView({ message }: { message: ChatMessage }) {
  if (message.role === "user") return <UserBubble text={message.text} />;
  if (message.role === "assistant") return <Assistant text={message.text} />;
  if (message.role === "attachment")
    return <AttachmentCard name={message.name} previewUrl={message.previewUrl} note={message.note} />;
  return <ToolRow label={message.label} detail={message.detail} />;
}

function AttachmentCard({ name, previewUrl, note }: { name: string; previewUrl?: string; note?: string }) {
  // An image → show the ACTUAL image, nothing else. Anything without a preview (a document, or
  // a reference whose thumbnail couldn't be made) → the compact file card.
  if (previewUrl) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%] overflow-hidden rounded-2xl rounded-tr-sm border border-border-glass">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={name}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            className="block w-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] overflow-hidden rounded-2xl rounded-tr-sm border border-border-glass bg-surface-3/60">
        <div className="flex items-center gap-2 px-3 py-2">
          <PaperclipIcon />
          <div className="min-w-0">
            <p className="truncate text-sm text-text-primary">{name}</p>
            {note && <p className="text-[11px] text-text-dim">{note}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function PaperclipIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 text-text-dim">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] rounded-2xl rounded-tr-sm bg-surface-3/70 px-3.5 py-2 text-sm leading-relaxed text-text-primary">
        {text}
      </div>
    </div>
  );
}

function Assistant({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-neon/15 text-[11px] font-bold text-accent-neon">
        P
      </span>
      <p className="max-w-[90%] text-sm leading-relaxed text-text-muted">{text}</p>
    </div>
  );
}

function ToolRow({ label, detail }: { label: string; detail: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-border-glass bg-surface-2/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-muted hover:bg-surface-2/70"
      >
        <SparkIcon className="text-accent-neon" />
        <span className="flex-1">{label}</span>
        <ChevronDown className={`text-text-dim transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-1 border-t border-border-glass px-3 py-2 pl-9 font-mono text-xs text-text-dim">
          {detail.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-neon/15 text-[11px] font-bold text-accent-neon">
        P
      </span>
      <div className="flex items-center gap-2 rounded-full bg-surface-2/60 px-3 py-2">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-neon/70 border-t-transparent" />
        <span className="text-xs text-text-muted">Thinking…</span>
      </div>
    </div>
  );
}

function IconButton({ title, onClick, children }: { title: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      type="button"
      className="flex h-8 w-8 items-center justify-center rounded-lg text-text-dim hover:bg-surface-3/60 hover:text-text-primary"
    >
      {children}
    </button>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SparkIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-text-dim">
      <circle cx="13.5" cy="6.5" r="1.2" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r="1.2" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r="1.2" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r="1.2" fill="currentColor" />
      <path d="M12 22a10 10 0 1 1 0-20c5.5 0 10 4 10 9 0 3-2.5 4-4 4h-2a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
