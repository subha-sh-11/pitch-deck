"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { projectRoutes } from "@/lib/routes";
import type { ChatMessage, Interview } from "./useInterview";
import { useWorkshopOptional } from "./workshop";

// The left conversation rail (narrow). All state lives in the shared interview
// hook. The producer asks here; tappable options appear inline; the deck builds
// on the canvas to the right.
const ALL_ACCEPT = ".pdf,.docx,.fdx,.txt,.md,.rtf,image/*";

export function ChatPanel({ iv }: { iv: Interview }) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  const send = () => {
    const value = draft.trim();
    if (!value || iv.thinking) return;
    setDraft("");
    iv.sendText(value, selectedSlideId);
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
          <ContextOptions onPick={openPicker} onDescribe={() => textareaRef.current?.focus()} />
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

      {/* Composer */}
      <div className="px-3 pb-3 pt-1">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.docx,.fdx,.txt,.md,.rtf,image/*"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            files.forEach((f) => void iv.uploadFile(f, selectedSlideId));
            e.currentTarget.value = "";
          }}
        />
        <div className="rounded-2xl border border-border-glass bg-surface-2/50 p-2.5">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder={options.length ? "…or type your own answer" : "Describe your film, or answer the producer…"}
            className="w-full resize-none bg-transparent px-2 py-1 text-sm text-text-primary placeholder:text-text-dim focus:outline-none"
          />
          <div className="flex items-center justify-between pt-1">
            <IconButton
              title="Attach files — scripts, reference images, mood boards, themes"
              onClick={() => openPicker(ALL_ACCEPT)}
            >
              <PlusIcon />
            </IconButton>
            <button
              onClick={send}
              disabled={!draft.trim() || iv.thinking}
              title="Send"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-neon text-zinc-950 transition-colors hover:bg-accent-neon-dim disabled:bg-accent-neon/30"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContextOptions({
  onPick,
  onDescribe,
}: {
  onPick: (accept: string) => void;
  onDescribe: () => void;
}) {
  const items: { label: string; desc: string; tint: string; icon: ReactNode; onClick: () => void }[] = [
    {
      label: "Upload script",
      desc: "PDF · DOCX · FDX · TXT — I'll pull the story",
      tint: "bg-amber-500/15 text-amber-300",
      icon: <DocIcon />,
      onClick: () => onPick(".pdf,.docx,.fdx,.txt,.md,.rtf"),
    },
    {
      label: "Reference images",
      desc: "Stills, key art, locations",
      tint: "bg-emerald-500/15 text-emerald-300",
      icon: <ImgIcon />,
      onClick: () => onPick("image/*"),
    },
    {
      label: "Mood board / themes",
      desc: "Looks & palettes to echo",
      tint: "bg-fuchsia-500/15 text-fuchsia-300",
      icon: <SwatchIcon />,
      onClick: () => onPick("image/*"),
    },
    {
      label: "Describe your film",
      desc: "Type a logline or a paragraph",
      tint: "bg-sky-500/15 text-sky-300",
      icon: <PencilIcon />,
      onClick: onDescribe,
    },
  ];
  return (
    <div className="space-y-2 pt-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-dim">
        Start with context
      </p>
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          onClick={it.onClick}
          className="flex w-full items-center gap-3 rounded-xl border border-border-glass bg-surface-2/50 px-3 py-2.5 text-left transition-colors hover:border-accent-neon/40 hover:bg-surface-2"
        >
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${it.tint}`}>
            {it.icon}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-text-primary">{it.label}</span>
            <span className="block truncate text-[11px] text-text-dim">{it.desc}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h6" />
    </svg>
  );
}
function ImgIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}
function SwatchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="13.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="10.5" r="2.5" />
      <circle cx="8.5" cy="7.5" r="2.5" />
      <circle cx="6.5" cy="12.5" r="2.5" />
      <path d="M12 22a10 10 0 1 1 0-20" />
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
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] overflow-hidden rounded-2xl rounded-tr-sm border border-border-glass bg-surface-3/60">
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={name} className="max-h-40 w-full object-cover" />
        )}
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
      <div className="flex gap-1 rounded-full bg-surface-2/60 px-3 py-2.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-dim [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-dim [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-dim" />
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
