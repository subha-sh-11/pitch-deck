"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { projectRoutes } from "@/lib/routes";
import type { ChatMessage, Interview } from "./useInterview";

// The left conversation rail (narrow). All state lives in the shared interview
// hook. The producer asks here; tappable options appear inline; the deck builds
// on the canvas to the right.
export function ChatPanel({ iv }: { iv: Interview }) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [iv.messages, iv.thinking]);

  const send = () => {
    const value = draft.trim();
    if (!value || iv.thinking) return;
    setDraft("");
    iv.sendText(value);
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
        <span className="truncate text-sm font-medium text-text-primary">{iv.projectName}</span>
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
          accept=".pdf,.docx,.fdx,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void iv.uploadFile(f);
            e.currentTarget.value = "";
          }}
        />
        <div className="rounded-2xl border border-border-glass bg-surface-2/50 p-2.5">
          <textarea
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
            <IconButton title="Attach a script" onClick={() => fileRef.current?.click()}>
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

function MessageView({ message }: { message: ChatMessage }) {
  if (message.role === "user") return <UserBubble text={message.text} />;
  if (message.role === "assistant") return <Assistant text={message.text} />;
  return <ToolRow label={message.label} detail={message.detail} />;
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
