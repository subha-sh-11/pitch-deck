"use client";

import { useEffect, useRef, useState } from "react";
import type { InterviewSection } from "@/lib/api";
import type { Interview } from "./useInterview";

type FieldStatus = "confirmed" | "suggested" | "skipped";

// Renders the LLM-GENERATED questionnaire (iv.sections), a few questions per round.
// Nothing is hardcoded: the agent reasons about THIS film and asks 3-4 questions at a
// time. Tapping updates the shared brief (no LLM round-trip); "Continue" asks the agent
// for the next round.

type FormShape = Record<string, string>;

// Ordered, human-labelled brief fields shown in the "Captured so far" summary.
const CAPTURED_FIELDS: [field: string, label: string][] = [
  ["title", "Title"],
  ["tagline", "Tagline"],
  ["logline", "Logline"],
  ["format", "Format"],
  ["genreBlend", "Genre"],
  ["tone", "Tone"],
  ["themes", "Themes"],
  ["synopsis", "Synopsis"],
  ["mainCharacters", "Main characters"],
  ["characterDynamics", "Character dynamics"],
  ["storyWorld", "Setting & world"],
  ["whyNow", "Why now"],
  ["visualMood", "Visual mood"],
  ["visualAesthetic", "Visual style"],
  ["moodBoard", "Mood-board material"],
  ["visualReferences", "Visual references"],
  ["colorPalette", "Colour palette"],
  ["textureStyle", "Type / texture"],
  ["showCross", "Comparables"],
  ["usp", "Unique selling point"],
  ["targetAudience", "Audience & market"],
  ["pitchingTo", "Pitching to"],
  ["releaseFit", "Release fit"],
  ["creativeTeam", "Creative team & talent"],
  ["directorStatement", "Director's statement"],
  ["budget", "Budget & the ask"],
  ["productionStatus", "Production status"],
  ["distribution", "Distribution & marketing"],
  ["keyScenes", "Key scenes"],
  ["deckLength", "Deck length"],
  ["deliveryFormat", "Delivery format"],
];

export function DesignBrief({ iv }: { iv: Interview }) {
  const form = iv.form as unknown as FormShape;
  const sections = iv.sections;
  const [sel, setSel] = useState<Record<string, string[]>>({});

  // Status tracking: which fields the user actively confirmed, skipped, or just changed.
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [recent, setRecent] = useState<Set<string>>(() => new Set());
  const recentTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const flagRecent = (field: string) => {
    setRecent((p) => new Set(p).add(field));
    clearTimeout(recentTimers.current[field]);
    recentTimers.current[field] = setTimeout(
      () => setRecent((p) => {
        const n = new Set(p);
        n.delete(field);
        return n;
      }),
      2600,
    );
  };
  const markTouched = (field: string) => {
    setTouched((p) => new Set(p).add(field));
    setSkipped((p) => {
      if (!p.has(field)) return p;
      const n = new Set(p);
      n.delete(field);
      return n;
    });
    flagRecent(field);
  };
  const skipField = (field: string) => setSkipped((p) => new Set(p).add(field));

  const statusOf = (field?: string | null): FieldStatus | null => {
    if (!field) return null;
    if (skipped.has(field)) return "skipped";
    if (touched.has(field)) return "confirmed";
    if ((form[field] ?? "").trim()) return "suggested";
    return null;
  };

  useEffect(() => {
    const init: Record<string, string[]> = {};
    for (const s of sections) {
      if (s.kind === "chips" || s.kind === "multi" || s.kind === "swatches") {
        const fromForm =
          s.field && s.field in form
            ? (form[s.field] ?? "").split(",").map((x) => x.trim()).filter(Boolean)
            : [];
        const fromOpts = (s.options ?? []).filter((o) => o.selected).map((o) => o.value ?? o.label);
        init[s.id] = fromForm.length ? fromForm : fromOpts;
      } else if (s.kind === "slider") {
        init[s.id] = [String(s.value ?? Math.round(((s.min ?? 8) + (s.max ?? 20)) / 2))];
      }
    }
    setSel(init);
    // Auto-commit the agent's pre-selected suggestion for any field that's still
    // empty, so accepted defaults count as answered and never get re-asked.
    for (const s of sections) {
      if (!s.field || (form[s.field] ?? "").trim()) continue;
      const def =
        (init[s.id] ?? []).join(", ") || (s.kind === "textarea" ? String(s.value ?? "") : "");
      if (def) iv.editField(s.field, def);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  const choose = (s: InterviewSection, val: string, multi: boolean) => {
    const cur = sel[s.id] ?? [];
    const next = multi ? (cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val]) : [val];
    setSel((p) => ({ ...p, [s.id]: next }));
    if (s.field) {
      iv.editField(s.field, next.join(", "));
      markTouched(s.field);
    }
  };

  const isSel = (s: InterviewSection, val: string) => (sel[s.id] ?? []).includes(val);

  // Everything captured so far (non-empty brief fields), for the running summary.
  const captured = CAPTURED_FIELDS.filter(([f]) => (form[f] ?? "").trim().length > 0).map(
    ([field, label]) => ({ field, label, value: form[field] }),
  );
  // Open questions minus anything the user chose to skip.
  const visibleSections = sections.filter((s) => !s.field || !skipped.has(s.field));
  // Empty + not skipped → "still to add"; skipped → its own group.
  const pending = CAPTURED_FIELDS.filter(
    ([f]) => !(form[f] ?? "").trim().length && !skipped.has(f),
  ).map(([, label]) => label);
  const skippedList = CAPTURED_FIELDS.filter(([f]) => skipped.has(f)).map(([, label]) => label);

  // Truly empty: nothing captured and no open questions yet.
  if (!visibleSections.length && !captured.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <SparklesIcon />
        {iv.thinking ? (
          <p className="text-sm text-text-dim">Thinking through your story…</p>
        ) : (
          <>
            <p className="font-display text-2xl text-text-muted">Your design brief appears here</p>
            <p className="max-w-sm text-sm text-text-dim">
              Tell me about your film on the left — e.g.{" "}
              <em>“a Telugu survival thriller about three kids trapped in a flooding tank”</em> — and
              I’ll ask a few smart questions to shape it.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-8 py-10 lg:px-10">
        <h1 className="font-display text-3xl font-medium tracking-tight text-text-primary">
          Let&apos;s shape the {iv.projectName} deck
        </h1>
        <p className="mt-1.5 text-sm text-text-dim">
          {visibleSections.length
            ? "A few questions at a time — tap an answer, type your own, then Continue."
            : "Everything I’ve captured so far — edit anything, or hit Build deck above."}
        </p>

        {/* Final summary — shown ONLY at the end (no open questions left), editable */}
        {captured.length > 0 && !visibleSections.length && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">
                Your pitch brief — review &amp; edit
              </h2>
              <button
                type="button"
                onClick={() => iv.nextRound()}
                disabled={iv.thinking}
                className="rounded-full border border-border-glass px-3 py-1 text-[11px] text-text-dim transition-colors hover:border-accent-neon/40 hover:text-text-primary disabled:opacity-50"
              >
                {iv.thinking ? "Re-analyzing…" : "↻ Re-analyze"}
              </button>
            </div>
            <div className="mt-3 space-y-2.5">
              {captured.map((c) => (
                <CapturedField
                  key={c.field}
                  label={c.label}
                  value={c.value}
                  status={statusOf(c.field)}
                  highlight={recent.has(c.field)}
                  onChange={(v) => {
                    iv.editField(c.field, v);
                    markTouched(c.field);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Assumptions the system made (distinct from confirmed answers) */}
        {!visibleSections.length && iv.assumptions.length > 0 && (
          <div className="mt-7">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-400/80">
              Assumptions I made
            </h2>
            <ul className="mt-2 space-y-1">
              {iv.assumptions.map((a) => (
                <li key={a.field} className="text-sm text-text-muted">
                  • {a.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Still pending / not yet provided */}
        {!visibleSections.length && pending.length > 0 && (
          <div className="mt-7">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">
              Still to add (optional)
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {pending.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-border-glass bg-surface-2/40 px-2.5 py-1 text-xs text-text-dim"
                >
                  {label}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-text-dim">
              Tell me any of these on the left and I’ll fold them in — or just build with what you have.
            </p>
          </div>
        )}

        {/* Intentionally skipped */}
        {!visibleSections.length && skippedList.length > 0 && (
          <div className="mt-7">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">
              Skipped
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {skippedList.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-dashed border-border-glass px-2.5 py-1 text-xs text-text-dim/70 line-through"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {iv.ready && !visibleSections.length && (
          <p className="mt-8 rounded-xl border border-accent-neon/30 bg-accent-neon/5 px-4 py-3 text-sm text-text-muted">
            Everything’s set from your side — hit <span className="text-text-primary">Build deck</span>{" "}
            above, or tell me more on the left to refine.
          </p>
        )}

        {visibleSections.length > 0 && (
          <h2 className="mt-9 text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">
            Open questions
          </h2>
        )}

        <div className="mt-3 space-y-8">
          {visibleSections.map((s) => (
            <section key={s.id} className="rounded-xl">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-text-primary">{s.title}</h2>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill status={statusOf(s.field)} />
                  {s.field && (
                    <button
                      type="button"
                      onClick={() => skipField(s.field!)}
                      className="text-[11px] text-text-dim transition-colors hover:text-text-muted"
                    >
                      Skip
                    </button>
                  )}
                </div>
              </div>
              {s.help && <p className="mt-0.5 text-xs text-text-dim">{s.help}</p>}

              {s.kind === "textarea" && (
                <textarea
                  value={(s.field && s.field in form ? form[s.field] : (s.value as string)) ?? ""}
                  onChange={(e) => {
                    if (!s.field) return;
                    iv.editField(s.field, e.target.value);
                    markTouched(s.field);
                  }}
                  rows={4}
                  placeholder="Tell me the story…"
                  className="mt-3 w-full resize-none rounded-xl border border-border-glass bg-surface-2/50 px-4 py-3 text-sm leading-relaxed text-text-primary placeholder:text-text-dim focus:border-accent-neon/50 focus:outline-none"
                />
              )}

              {(s.kind === "chips" || s.kind === "multi") && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(s.options ?? []).map((o) => {
                    const val = o.value ?? o.label;
                    return <Chip key={val} label={o.label} selected={isSel(s, val)} onClick={() => choose(s, val, s.kind === "multi")} />;
                  })}
                  <OtherChip onAdd={(v) => choose(s, v, s.kind === "multi")} />
                </div>
              )}

              {s.kind === "swatches" && (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(s.options ?? []).map((o) => {
                    const val = o.value ?? o.label;
                    const selected = isSel(s, val);
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => choose(s, val, false)}
                        className={`overflow-hidden rounded-xl border text-left transition-all ${
                          selected ? "border-accent-neon ring-2 ring-accent-neon/30" : "border-border-glass hover:border-accent-neon/40"
                        }`}
                      >
                        <div className="flex h-9">
                          {(o.colors ?? ["#222", "#444", "#888", "#ccc"]).map((c, i) => (
                            <span key={i} className="flex-1" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                        <span className="block px-2.5 py-1.5 text-xs text-text-muted">{o.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {s.kind === "slider" && (
                <div className="mt-4 flex items-center gap-4">
                  <input
                    type="range"
                    min={s.min ?? 8}
                    max={s.max ?? 20}
                    value={Number(sel[s.id]?.[0] ?? s.value ?? 14)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSel((p) => ({ ...p, [s.id]: [v] }));
                      iv.editField(s.field ?? s.id, v);
                      markTouched(s.field ?? s.id);
                    }}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface-3 accent-accent-neon"
                  />
                  <span className="w-8 text-right text-sm text-text-primary">{sel[s.id]?.[0] ?? s.value ?? 14}</span>
                </div>
              )}
            </section>
          ))}
        </div>

        {visibleSections.length > 0 && (
          <div className="mt-9 flex items-center gap-3 border-t border-border-glass pt-6">
            <button
              type="button"
              onClick={() => iv.nextRound()}
              disabled={iv.thinking}
              className="rounded-full border border-accent-neon/50 bg-accent-neon/10 px-5 py-2 text-sm font-medium text-accent-neon transition-colors hover:bg-accent-neon/20 disabled:opacity-50"
            >
              {iv.thinking ? "Thinking…" : "Continue →"}
            </button>
            <span className="text-xs text-text-dim">or tell me more on the left</span>
          </div>
        )}
        <div className="h-8" />
      </div>
    </div>
  );
}

// Labels whose values tend to be long → render a multi-line editor.
const LONG_LABELS = new Set([
  "Logline",
  "Synopsis",
  "Main characters",
  "Character dynamics",
  "Unique selling point",
  "Setting & world",
  "Key scenes",
  "Themes",
  "Visual mood",
  "Comparables",
  "Creative team & talent",
  "Director's statement",
  "Budget & the ask",
  "Visual references",
]);

const STATUS_STYLES: Record<FieldStatus, { label: string; cls: string }> = {
  confirmed: { label: "Confirmed", cls: "text-accent-neon border-accent-neon/40 bg-accent-neon/10" },
  suggested: { label: "Suggested", cls: "text-amber-300 border-amber-400/30 bg-amber-400/10" },
  skipped: { label: "Skipped", cls: "text-text-dim border-border-glass bg-surface-2/40" },
};

function StatusPill({ status }: { status: FieldStatus | null }) {
  // "Suggested" is intentionally not shown — the agent's suggestion is already
  // reflected by the highlighted chips / pre-filled value, so a badge is redundant.
  if (!status || status === "suggested") return null;
  const s = STATUS_STYLES[status];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide ${s.cls}`}>
      {s.label}
    </span>
  );
}

function CapturedField({
  label,
  value,
  onChange,
  status,
  highlight,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  status?: FieldStatus | null;
  highlight?: boolean;
}) {
  const multiline = LONG_LABELS.has(label);
  return (
    <div
      className={`rounded-xl border bg-surface-2/40 px-3.5 py-2.5 transition-colors ${
        highlight ? "border-accent-neon/50 ring-1 ring-accent-neon/30" : "border-border-glass"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-dim">{label}</div>
        <StatusPill status={status ?? null} />
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={Math.min(6, Math.max(2, Math.ceil((value.length || 1) / 56)))}
          className="mt-1 w-full resize-none bg-transparent text-sm leading-relaxed text-text-primary focus:outline-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-0.5 w-full bg-transparent text-sm text-text-primary focus:outline-none"
        />
      )}
    </div>
  );
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
        selected
          ? "border-accent-neon bg-accent-neon/15 text-accent-neon"
          : "border-border-glass bg-surface-2/60 text-text-muted hover:border-accent-neon/40 hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}

function OtherChip({ onAdd }: { onAdd: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-dashed border-border-glass px-3.5 py-1.5 text-sm text-text-dim hover:border-accent-neon/40 hover:text-text-primary"
      >
        Other…
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent-neon/50 bg-surface-2 px-2 py-1">
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && v.trim()) { onAdd(v.trim()); setV(""); setOpen(false); }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="type & enter"
        className="w-28 bg-transparent text-xs text-text-primary placeholder:text-text-dim focus:outline-none"
      />
    </span>
  );
}

function SparklesIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" className="text-text-dim">
      <path d="M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" />
    </svg>
  );
}
