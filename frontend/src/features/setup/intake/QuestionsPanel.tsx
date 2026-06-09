"use client";

import { useState } from "react";
import type { InterviewOption } from "@/lib/api";
import type { AskedQuestion, Interview } from "./useInterview";

// ── The "Questions" artifact ──────────────────────────────────────────────
// Everything here is driven by the conversational agent: each question is one
// the producer asked this turn, with its own tappable options. Nothing is
// predetermined. Answered questions settle into a read-only summary; the
// pending one stays interactive; when the agent is ready, the brief it built
// is shown for a final edit before building the deck.

export function QuestionsPanel({ iv }: { iv: Interview }) {
  let pendingIndex = -1;
  for (let i = iv.questions.length - 1; i >= 0; i--) {
    if (iv.questions[i].answer === undefined) {
      pendingIndex = i;
      break;
    }
  }
  const canBuild =
    iv.ready ||
    ((iv.form.title ?? "").trim().length > 0 &&
      ((iv.form.logline ?? "").trim() || (iv.form.synopsis ?? "").trim()).length > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-8 py-12 lg:px-12">
          <h1 className="font-display text-4xl font-medium tracking-tight text-text-primary">
            Let&apos;s scope your pitch deck
          </h1>
          <p className="mt-2 text-sm text-text-dim">
            The producer asks one thing at a time — tap an answer, type your own, or talk on the left.
          </p>

          {/* The agent's questions, in the order it asked them */}
          <div className="mt-10 space-y-9">
            {iv.questions.map((q, i) => (
              <QuestionBlock
                key={q.id}
                question={q}
                active={i === pendingIndex}
                onAnswer={iv.sendText}
                onChoose={iv.chooseOption}
              />
            ))}

            {iv.thinking && <ThinkingBlock />}

            {iv.questions.length === 0 && !iv.thinking && (
              <p className="text-sm text-text-dim">The producer is getting ready…</p>
            )}
          </div>

          {/* Once the brief is complete, show what was understood for a last edit */}
          {iv.ready && (
            <div className="mt-12 border-t border-border-glass pt-8">
              <h2 className="text-[17px] font-semibold text-text-primary">Here&apos;s what I understood</h2>
              <p className="mt-1 text-sm text-text-dim">Edit anything before we build.</p>
              <div className="mt-4 space-y-2.5">
                <SummaryField iv={iv} field="title" label="Title" />
                <SummaryField iv={iv} field="logline" label="Logline" multiline />
                <SummaryField iv={iv} field="synopsis" label="Synopsis" multiline />
                <SummaryField iv={iv} field="genreBlend" label="Genre" />
                <SummaryField iv={iv} field="tone" label="Tone" />
                <SummaryField iv={iv} field="targetAudience" label="Audience" />
                <SummaryField iv={iv} field="visualAesthetic" label="Visual" />
              </div>

              {iv.assumptions.length > 0 && (
                <div className="mt-6">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-dim">
                    Assumptions — tap to change
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {iv.assumptions.map((a) => (
                      <AssumptionChip
                        key={a.field}
                        label={a.label}
                        onSave={(v) => iv.editAssumption(a.field, v)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="flex items-center justify-end gap-4 border-t border-border-glass bg-surface-0/80 px-8 py-4 backdrop-blur lg:px-12">
        <span className="text-sm text-text-dim">
          {iv.ready ? "Ready when you are" : canBuild ? "Answer more, or build now" : "Answer the producer to continue"}
        </span>
        <button
          type="button"
          disabled={!canBuild || iv.building}
          onClick={() => void iv.build()}
          className="rounded-full bg-accent-neon px-6 py-2.5 text-sm font-semibold text-zinc-950 shadow-[0_0_20px_rgba(34,211,238,0.25)] transition-colors hover:bg-accent-neon-dim disabled:cursor-not-allowed disabled:bg-accent-neon/30 disabled:text-zinc-950/70 disabled:shadow-none"
        >
          {iv.building ? "Building…" : "Build my deck →"}
        </button>
      </footer>
    </div>
  );
}

function QuestionBlock({
  question,
  active,
  onAnswer,
  onChoose,
}: {
  question: AskedQuestion;
  active: boolean;
  onAnswer: (text: string) => void;
  onChoose: (opt: InterviewOption) => void;
}) {
  const [text, setText] = useState("");
  const answered = question.answer !== undefined;
  const isCards = question.inputType === "cards";
  const showOptions = active && question.options.length > 0;
  const showFreeText =
    active && (question.inputType === "free_text" || question.allowFreeText);

  return (
    <section className={answered ? "opacity-70" : ""}>
      <h2 className="text-[17px] font-semibold text-text-primary">{question.prompt}</h2>

      {answered ? (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent-neon/40 bg-accent-neon/10 px-4 py-1.5 text-sm text-accent-neon">
          {question.answer}
        </div>
      ) : (
        <>
          {showOptions && (
            <div className={`mt-4 ${isCards ? "grid grid-cols-1 gap-2.5 sm:grid-cols-3" : "flex flex-wrap gap-2.5"}`}>
              {question.options.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onChoose(opt)}
                  className={
                    isCards
                      ? `rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                          opt.selected
                            ? "border-accent-neon bg-accent-neon/10 text-text-primary"
                            : "border-border-glass bg-surface-2/60 text-text-muted hover:border-accent-neon/40 hover:text-text-primary"
                        }`
                      : `rounded-full border px-4 py-2 text-sm transition-colors ${
                          opt.selected
                            ? "border-accent-neon bg-accent-neon/15 text-accent-neon"
                            : "border-border-glass bg-surface-2/60 text-text-muted hover:border-accent-neon/40 hover:text-text-primary"
                        }`
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {showFreeText && (
            <div className="relative mt-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (text.trim()) {
                      onAnswer(text);
                      setText("");
                    }
                  }
                }}
                rows={question.inputType === "free_text" ? 3 : 1}
                placeholder={question.options.length ? "…or type your own" : "Your answer…"}
                className="w-full resize-y rounded-2xl border border-border-glass bg-surface-2/60 px-4 py-3 pr-20 text-[15px] leading-relaxed text-text-primary placeholder:text-text-dim focus:border-accent-neon/60 focus:outline-none focus:ring-1 focus:ring-accent-neon/30"
              />
              <button
                type="button"
                disabled={!text.trim()}
                onClick={() => {
                  if (text.trim()) {
                    onAnswer(text);
                    setText("");
                  }
                }}
                className="absolute bottom-3 right-3 rounded-lg bg-accent-neon px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-accent-neon-dim disabled:bg-accent-neon/30"
              >
                Send
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ThinkingBlock() {
  return (
    <div className="flex items-center gap-1.5 text-text-dim">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-dim [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-dim [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-dim" />
      <span className="ml-2 text-sm">thinking through your story…</span>
    </div>
  );
}

function SummaryField({
  iv,
  field,
  label,
  multiline,
}: {
  iv: Interview;
  field: string;
  label: string;
  multiline?: boolean;
}) {
  const value = (iv.form as unknown as Record<string, string>)[field] ?? "";
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  if (!value && !editing) return null;

  if (editing) {
    return (
      <div className="rounded-lg border border-accent-neon/40 bg-surface-2/40 p-2.5">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-dim">{label}</span>
        {multiline ? (
          <textarea
            autoFocus
            value={v}
            onChange={(e) => setV(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-md bg-transparent text-sm text-text-primary focus:outline-none"
          />
        ) : (
          <input
            autoFocus
            value={v}
            onChange={(e) => setV(e.target.value)}
            className="w-full bg-transparent text-sm text-text-primary focus:outline-none"
          />
        )}
        <div className="mt-1 flex gap-3">
          <button onClick={() => { iv.editField(field, v.trim()); setEditing(false); }} className="text-xs font-medium text-accent-neon">
            Save
          </button>
          <button onClick={() => { setV(value); setEditing(false); }} className="text-xs text-text-dim">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setV(value); setEditing(true); }}
      className="flex w-full items-start gap-2 rounded-lg border border-border-glass bg-surface-2/30 p-2.5 text-left hover:border-accent-neon/30"
    >
      <span className="mt-0.5 w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-text-dim">{label}</span>
      <span className="flex-1 text-sm text-text-primary">{value}</span>
      <span className="text-text-dim">✎</span>
    </button>
  );
}

function AssumptionChip({ label, onSave }: { label: string; onSave: (value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-accent-neon/50 bg-surface-2 px-2 py-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { onSave(value.trim() || label); setEditing(false); }
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-40 bg-transparent text-xs text-text-primary focus:outline-none"
        />
        <button onClick={() => { onSave(value.trim() || label); setEditing(false); }} className="text-xs text-accent-neon">
          ✓
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1.5 rounded-full border border-border-glass bg-surface-2 px-3 py-1 text-xs text-text-muted hover:border-accent-neon/40 hover:text-text-primary"
    >
      {label}
      <span className="text-text-dim">✎</span>
    </button>
  );
}
