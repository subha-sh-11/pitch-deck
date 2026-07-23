"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, Interview } from "./useInterview";
import { useWorkshopOptional } from "./workshop";

// The left conversation rail (narrow). All state lives in the shared interview
// hook. The producer asks here; tappable options appear inline; the deck builds
// on the canvas to the right.
// Scripts/docs get parsed, images get staged, and ANY other file is attached as-is.
const ALL_ACCEPT = "*/*";

export function ChatPanel({
  iv,
  onCollapse,
  onReviewBrief,
}: {
  iv: Interview;
  /** Collapse the assistant rail (the panel-header button). */
  onCollapse?: () => void;
  /** Jump to the Brief tab — the Review action on captured-detail cards. */
  onReviewBrief?: () => void;
}) {
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

  // When the conversation turns to uploading references, make the attach button
  // impossible to miss: glow/pulse it for a few seconds so the director knows
  // exactly where uploads happen (the + below — there is no other upload spot).
  const [attachGlow, setAttachGlow] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect --
     Transient UI cue keyed off the latest assistant message: a timed glow with its own
     timeout cleanup. No cascading-render risk — it flips one boolean and clears itself. */
  useEffect(() => {
    const last = [...iv.messages].reverse().find((m) => m.role === "assistant");
    const text = last && "text" in last ? (last.text ?? "") : "";
    const invitesUpload =
      /\+ button|attach button/i.test(text) ||
      /(upload|attach|paste|drop|share|send)[^.!?]{0,60}(image|reference|still|poster|mood ?board|palette|inspiration|script|\.pptx|deck)/i.test(text);
    if (!invitesUpload) return;
    setAttachGlow(true);
    const t = setTimeout(() => setAttachGlow(false), 9000);
    return () => clearTimeout(t);
  }, [iv.messages]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Keep the composer hugging its content: grow with what's typed, but never balloon —
  // clamp between ~2 rows and a hard max (then it scrolls). Fixes the intermittent tall box.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 48), 160)}px`;
  }, [draft, staged.length]);

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
  // The Undo action only makes sense on the most recent edit card — earlier
  // batches are buried under later ones on the snapshot stack.
  const lastEditId = [...iv.messages].reverse().find((m) => m.role === "tool" && m.kind === "edit")?.id;

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-1/40">
      {/* Panel header — assistant-scoped only; app navigation lives in the global header. */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border-glass px-3">
        <SparkIcon className="shrink-0 text-accent-neon" />
        <span className="flex-1 truncate text-sm font-medium text-text-primary">AI Assistant</span>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Start a new chat? The conversation clears — your brief and deck stay as they are.")) {
              iv.resetConversation();
            }
          }}
          title="New chat — clears the conversation, keeps your brief and deck"
          className="flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-xs text-text-dim transition-colors hover:bg-surface-2 hover:text-text-primary"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New chat
        </button>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title="Collapse the assistant (Ctrl+\)"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-dim transition-colors hover:bg-surface-2 hover:text-text-primary"
          >
            <CollapseIcon />
          </button>
        )}
      </div>

      {iv.offline && (
        <div className="mx-3 mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Producer service unreachable — running offline. Your answers are still saved.
        </div>
      )}

      {/* Message log */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
        {iv.messages.map((m) => (
          <MessageView
            key={m.id}
            message={m}
            onReviewBrief={onReviewBrief}
            onUndo={
              m.role === "tool" && m.id === lastEditId && iv.canUndoAgent && !iv.thinking
                ? iv.undoAgentEdit
                : undefined
            }
          />
        ))}
        {/* Start state (only before the conversation gets going): before a deck exists,
            the single "describe your idea" entry point; after, slide-scoped prompts. */}
        {iv.messages.length <= 1 && options.length === 0 && !iv.thinking &&
          (iv.draftSlides.length > 0 ? (
            <SlidePrompts onPick={(p) => iv.sendText(p, selectedSlideId)} />
          ) : (
            <ContextOptions onDescribe={() => textareaRef.current?.focus()} />
          ))}
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
            rows={2}
            placeholder={options.length ? "…or type your own answer" : "Paste a logline, story idea, or script summary…"}
            className="max-h-40 w-full resize-none overflow-y-auto bg-transparent px-2 py-1 text-sm text-text-primary placeholder:text-text-muted/70 focus:outline-none"
          />
          <div className="flex items-center justify-between pt-1.5">
            <IconButton
              title="Attach files — scripts, reference images, mood boards, or a reference deck (.pptx) to match its structure and style"
              onClick={() => openPicker(ALL_ACCEPT)}
              glow={attachGlow}
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

// Once a deck exists the "describe your idea" card is stale — offer starting points
// scoped to the slide the director is looking at instead.
const SLIDE_PROMPTS = [
  "Simplify the text on this slide",
  "Swap this slide's image",
  "Try another layout for this slide",
  "Make this slide more cinematic",
];

function SlidePrompts({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="animate-intake-fade-in pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">
        Ask about this slide
      </p>
      <div className="flex flex-wrap gap-2">
        {SLIDE_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="rounded-full border border-border-glass bg-surface-2/60 px-3.5 py-1.5 text-sm text-text-muted transition-colors hover:border-accent-neon/40 hover:text-text-primary"
          >
            {p}
          </button>
        ))}
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

function MessageView({
  message,
  onReviewBrief,
  onUndo,
}: {
  message: ChatMessage;
  onReviewBrief?: () => void;
  onUndo?: () => void;
}) {
  if (message.role === "user") return <UserBubble text={message.text} />;
  if (message.role === "assistant") return <Assistant text={message.text} />;
  if (message.role === "attachment")
    return <AttachmentCard name={message.name} previewUrl={message.previewUrl} note={message.note} />;
  // Activity cards. `kind` is set on new messages; the label checks keep
  // conversations saved before `kind` existed rendering correctly.
  const isCapture = message.kind === "capture" || message.label.startsWith("Captured");
  return (
    <ToolRow
      label={message.label}
      detail={message.detail}
      tone={isCapture ? "check" : "spark"}
      action={
        isCapture && onReviewBrief
          ? { label: "Review", onClick: onReviewBrief, title: "Open the brief to check what was captured" }
          : onUndo
            ? { label: "Undo", onClick: onUndo, title: "Roll the deck back to before this change" }
            : undefined
      }
    />
  );
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
      <div className="max-w-[88%] whitespace-pre-line rounded-2xl rounded-tr-sm bg-surface-3/70 px-3.5 py-2 text-sm leading-relaxed text-text-primary">
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
      {/* pre-line: the producer structures list answers with newlines — keep them visible. */}
      <p className="max-w-[90%] whitespace-pre-line text-sm leading-relaxed text-text-muted">{text}</p>
    </div>
  );
}

function ToolRow({
  label,
  detail,
  tone = "spark",
  action,
}: {
  label: string;
  detail: string[];
  tone?: "spark" | "check";
  action?: { label: string; onClick: () => void; title?: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-border-glass bg-surface-2/40">
      <div className="flex w-full items-center gap-2 py-1.5 pl-3 pr-2">
        {tone === "check" ? <CheckCircleIcon className="shrink-0 text-emerald-400" /> : <SparkIcon className="shrink-0 text-accent-neon" />}
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left text-sm text-text-muted transition-colors hover:text-text-primary"
          title={open ? "Hide details" : "Show details"}
        >
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <ChevronDown className={`shrink-0 text-text-dim transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            title={action.title}
            className="shrink-0 rounded-md border border-border-glass px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:border-accent-neon/40 hover:text-text-primary"
          >
            {action.label}
          </button>
        )}
      </div>
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

function IconButton({ title, onClick, children, glow = false }: {
  title: string; onClick?: () => void; children: React.ReactNode;
  /** Pulse/glow the button — used to point the director at the attach button when the
   *  conversation is about uploading references. */
  glow?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      type="button"
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-text-dim hover:bg-surface-3/60 hover:text-text-primary ${
        glow
          ? "animate-pulse rounded-full text-accent-neon ring-2 ring-accent-neon/80 shadow-[0_0_14px_rgba(248,201,164,0.55)]"
          : ""
      }`}
    >
      {children}
    </button>
  );
}

function CollapseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d="M16 9l-3 3 3 3" />
    </svg>
  );
}

function CheckCircleIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
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
