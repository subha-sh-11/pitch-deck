"use client";

import { useEffect, useRef, useState } from "react";
import type { InterviewSection } from "@/lib/api";
import {
  clearReferenceDeck,
  getProject,
  saveIntake,
  uploadReferenceDeck,
  type ReferenceDeck,
} from "@/lib/api/projects";
import type { IntakeFormData } from "@/types/workflow";
import type { Interview } from "./useInterview";

type FieldStatus = "confirmed" | "suggested" | "skipped";

// Visual-style presets. Picking one steers the whole deck's look — the generated imagery
// especially (cinematic film key art by default; anime / cartoon / 3D otherwise). The keyword
// is folded into `genreBlend`, which the backend reads to switch the render medium.
const STYLE_OPTIONS: { label: string; kw: string }[] = [
  { label: "Cinematic", kw: "" },
  { label: "Anime", kw: "anime" },
  { label: "Cartoon", kw: "cartoon" },
  { label: "3D Animation", kw: "3d animation" },
  { label: "Comic book", kw: "comic book" },
];
const STYLE_KWS = STYLE_OPTIONS.map((o) => o.kw).filter(Boolean);

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
  ["supportingCharacters", "Supporting characters"],
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
  ["directorVision", "Director's vision"],
  ["budget", "Budget & the ask"],
  ["productionStatus", "Production status"],
  ["distribution", "Distribution & marketing"],
  ["keyScenes", "Key scenes"],
  ["deckLength", "Deck length"],
  ["deliveryFormat", "Delivery format"],
];

export function DesignBrief({ iv, projectId }: { iv: Interview; projectId: string }) {
  const form = iv.form as unknown as FormShape;

  // Which visual-style keyword (if any) is active in the genre blend.
  const genreLower = (form.genreBlend ?? "").toLowerCase();
  const activeStyle = STYLE_KWS.find((kw) => genreLower.includes(kw)) ?? "";
  const setStyle = (kw: string) => {
    let base = form.genreBlend ?? "";
    for (const k of STYLE_KWS) base = base.replace(new RegExp(`\\s*[+,]?\\s*${k}`, "ig"), "");
    base = base.replace(/\s*[+,]\s*$/, "").trim();
    const next = kw ? (base ? `${base} + ${kw}` : kw) : base;
    iv.editField("genreBlend", next);
    // Persist immediately so a later Build/Rebuild uses the chosen style.
    void saveIntake(projectId, { ...(iv.form as IntakeFormData), genreBlend: next }).catch(() => {});
  };
  const sections = iv.sections;
  const [sel, setSel] = useState<Record<string, string[]>>({});

  // Reference deck: the director can upload an existing .pptx; the generated deck then
  // mirrors its slide structure and visual style (handled in the generation pipeline).
  const [reference, setReference] = useState<ReferenceDeck | null>(null);
  const [refBusy, setRefBusy] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);
  const refInput = useRef<HTMLInputElement>(null);

  // Hydrate any reference already saved on the project.
  useEffect(() => {
    getProject(projectId)
      .then((p) => setReference(p.referenceDeck ?? null))
      .catch(() => {});
  }, [projectId]);

  const handleReferenceUpload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pptx")) {
      setRefError("Only PowerPoint .pptx files are supported. Export your deck as .pptx and retry.");
      return;
    }
    setRefBusy(true);
    setRefError(null);
    try {
      setReference(await uploadReferenceDeck(projectId, file));
    } catch (e) {
      setRefError((e as Error)?.message || "Couldn't read that deck — make sure it's a valid .pptx.");
    } finally {
      setRefBusy(false);
      if (refInput.current) refInput.current.value = "";
    }
  };

  const handleReferenceRemove = async () => {
    setRefBusy(true);
    try {
      await clearReferenceDeck(projectId);
      setReference(null);
      setRefError(null);
    } catch {
      /* keep the chip; the next upload overwrites it anyway */
    } finally {
      setRefBusy(false);
    }
  };

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

  // Default selection for a set of sections, from the current form values or the agent's
  // pre-selected options.
  const buildSel = (secs: InterviewSection[]): Record<string, string[]> => {
    const init: Record<string, string[]> = {};
    for (const s of secs) {
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
    return init;
  };

  // Re-seed local selection whenever the agent sends a new set of sections — applied during
  // render (the documented "adjust state when input changes" pattern), not in an effect.
  const sectionsSig = sections.map((s) => s.id).join("|");
  const [seenSig, setSeenSig] = useState<string | null>(null);
  if (sectionsSig !== seenSig) {
    setSeenSig(sectionsSig);
    setSel(buildSel(sections));
  }

  // Auto-commit the agent's pre-selected suggestion for any still-empty field, so accepted
  // defaults count as answered and never get re-asked. This writes to the shared brief (an
  // external store), which is exactly what effects are for.
  useEffect(() => {
    const init = buildSel(sections);
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

  // Open questions minus anything the user chose to skip.
  const visibleSections = sections.filter((s) => !s.field || !skipped.has(s.field));
  // Fields with an open follow-up question right now — kept OUT of the summary so a
  // field is never shown twice (settled fields → summary, still-being-asked → questions).
  const openFields = new Set(
    visibleSections.map((s) => s.field).filter((f): f is string => !!f),
  );
  // Everything captured so far (non-empty brief fields that aren't an open question),
  // for the running summary.
  const captured = CAPTURED_FIELDS.filter(
    ([f]) => (form[f] ?? "").trim().length > 0 && !openFields.has(f),
  ).map(([field, label]) => ({ field, label, value: form[field] }));
  // Empty + not skipped → "still to add"; skipped → its own group.
  const pending = CAPTURED_FIELDS.filter(
    ([f]) => !(form[f] ?? "").trim().length && !skipped.has(f),
  ).map(([field, label]) => ({ field, label }));
  const skippedList = CAPTURED_FIELDS.filter(([f]) => skipped.has(f)).map(([, label]) => label);

  // Truly empty: nothing captured and no open questions yet. The placeholder was removed —
  // show the "thinking" state while the agent works, otherwise render nothing.
  if (!visibleSections.length && !captured.length) {
    if (!iv.thinking) return null;
    return (
      <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-8 text-center">
        {/* Signature warm halo — the one branded flourish on the empty canvas. */}
        <div className="intake-halo pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
        <div className="relative flex flex-col items-center gap-3">
          <SparklesIcon />
          <p className="text-sm text-text-muted">Thinking through your story…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-8 py-10 lg:px-10">
        <h1 className="font-display text-3xl font-medium tracking-tight text-text-primary">
          Let&apos;s shape the {iv.projectName} deck
        </h1>
        <p className="mt-1.5 text-sm text-text-muted">
          {captured.length > 0 && visibleSections.length
            ? "Here’s everything I pulled from your story — review and edit it, then answer a few follow-ups below to sharpen the deck."
            : visibleSections.length
              ? "A few questions at a time — tap an answer, type your own, then Continue."
              : "Everything I’ve captured so far — edit anything, or hit Build deck above."}
        </p>

        {/* Visual style — steers the whole deck's look (esp. the generated imagery). */}
        {captured.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">
              Visual style
            </h2>
            <p className="mt-1 text-xs text-text-dim">
              Cinematic by default. Pick an animated style and the whole deck — especially the
              generated art — is rendered that way.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STYLE_OPTIONS.map((o) => (
                <Chip key={o.label} label={o.label} selected={o.kw === activeStyle} onClick={() => setStyle(o.kw)} />
              ))}
            </div>
          </div>
        )}

        {/* Extracted summary — shown as soon as we've captured anything (e.g. right
            after a script upload), and kept visible while follow-up questions are open
            below it. Editable. */}
        {captured.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">
                {visibleSections.length ? "Story summary — review & edit" : "Your pitch brief — review & edit"}
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

        {/* Reference deck — mimic an existing .pptx's structure + look */}
        {!visibleSections.length && (
          <div className="mt-7">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">
              Reference deck (optional)
            </h2>
            <p className="mt-1 text-xs text-text-muted">
              Upload a PowerPoint <span className="text-text-primary">.pptx</span> and I&apos;ll match its
              slide structure and visual style when building your deck.
            </p>
            <input
              ref={refInput}
              type="file"
              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              className="hidden"
              onChange={(e) => void handleReferenceUpload(e.target.files?.[0])}
            />
            {reference ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-accent-neon/40 bg-accent-neon/5 px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm text-text-primary">{reference.fileName}</div>
                  <div className="mt-0.5 text-xs text-text-dim">
                    {reference.slideCount} slides
                    {reference.colors?.length ? ` · ${reference.colors.length} colours` : ""}
                    {reference.fonts?.length ? ` · ${reference.fonts.slice(0, 2).join(", ")}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {reference.colors?.length > 0 && (
                    <div className="flex overflow-hidden rounded-md border border-border-glass">
                      {reference.colors.slice(0, 5).map((c, i) => (
                        <span key={i} className="h-5 w-5" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleReferenceRemove()}
                    disabled={refBusy}
                    className="text-[11px] text-text-dim transition-colors hover:text-text-primary disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => refInput.current?.click()}
                disabled={refBusy}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-glass bg-surface-2/40 px-4 py-3 text-sm text-text-muted transition-colors hover:border-accent-neon/40 hover:text-text-primary disabled:opacity-50"
              >
                {refBusy ? "Reading deck…" : "↑ Upload reference .pptx"}
              </button>
            )}
            {refError && <p className="mt-2 text-xs text-red-400/90">{refError}</p>}
          </div>
        )}

        {/* Assumptions the system made (distinct from confirmed answers) */}
        {iv.assumptions.length > 0 && (
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
              {pending.map(({ field, label }) => (
                <button
                  key={field}
                  type="button"
                  disabled={iv.thinking}
                  title={`Ask the producer to suggest ${label.toLowerCase()} for your story`}
                  onClick={() =>
                    iv.sendText(
                      `Let's fill in the ${label.toLowerCase()} — suggest options grounded in my story and I'll pick.`,
                    )
                  }
                  className="rounded-full border border-border-glass bg-surface-2/40 px-2.5 py-1 text-xs text-text-dim transition-colors hover:border-accent-neon/50 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  + {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-text-muted">
              Tap one and I’ll suggest options — or tell me in the chat, or just build with what you have.
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
          <div className="mt-9">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">
              {captured.length > 0 ? "Follow-up questions" : "A few questions"}
            </h2>
            {captured.length > 0 && (
              <p className="mt-1 text-xs text-text-dim">
                Pulled from the analysis to sharpen the deck — tap an answer or type your own. All optional;
                build whenever you’re ready.
              </p>
            )}
          </div>
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
              {s.help && <p className="mt-0.5 text-xs text-text-muted">{s.help}</p>}

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
  "Director's vision",
  "Distribution & marketing",
  "Production status",
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
  // Multi-line when the label is known-long OR the value itself carries structure (pasted
  // paragraphs / numbered lists) — a paste must never collapse into a one-line input.
  const multiline = LONG_LABELS.has(label) || value.includes("\n") || value.length > 90;
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
          // Size to the content's real shape: explicit newlines count as lines, so a pasted
          // numbered list or multi-paragraph synopsis shows as provided instead of collapsing.
          rows={Math.min(
            14,
            Math.max(2, value.split("\n").length, Math.ceil((value.length || 1) / 56)),
          )}
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
