"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  extractScript,
  finalizeInterview,
  interview,
  type InterviewAsk,
  type InterviewAssumption,
  type InterviewBrief,
  type InterviewHistoryTurn,
  type InterviewOption,
  type InterviewPillars,
  type InterviewResult,
} from "@/lib/api";
import { projectRoutes } from "@/lib/routes";
import { EMPTY_INTAKE_FORM } from "@/types/setup";
import type { IntakeFormData } from "@/types/workflow";
import { useSetupWizard } from "./SetupWizardContext";

interface ChatIntakeProps {
  projectId: string;
}

type ChatMessage = { id: string; role: "ai" | "user"; text: string };

const PILLAR_FIELDS = new Set(["title", "logline", "synopsis"]);

const OPENING =
  "Hi — I'm your pitch producer. Tell me about your film, in a sentence or a paragraph, " +
  "however it lives in your head. Paste a logline or synopsis, or drop a script — I'll pull out " +
  "everything I need and build the deck.";

const PILLAR_QUESTIONS: Record<string, string> = {
  title: "Let's begin — what's your film called?",
  logline: "Great. Give me the one-line hook — who's it about and what do they face?",
  synopsis: "Perfect. Now paste or type your synopsis — as much or as little as you have.",
};

const PLACEHOLDER_BY_FIELD: Record<string, string> = {
  title: "Your film's title…",
  logline: "One line — who is it about and what do they face?",
  synopsis: "Paste or type your synopsis…",
};

function localTurn(pillars: InterviewPillars, brief: InterviewBrief | null): InterviewResult {
  for (const f of ["title", "logline", "synopsis"] as const) {
    if (!(pillars[f] ?? "").trim()) {
      return {
        brief: brief ?? {},
        assumptions: [],
        message: PILLAR_QUESTIONS[f],
        ask: { field: f, inputType: "free_text", options: [], allowFreeText: true },
        ready: false,
        missingRequired: [f],
      };
    }
  }
  const base: InterviewBrief = {
    title: { value: pillars.title ?? "", method: "extract", confidence: 0.85 },
    logline: { value: pillars.logline ?? "", method: "extract", confidence: 0.85 },
    synopsis: { value: pillars.synopsis ?? "", method: "extract", confidence: 0.85 },
  };
  return {
    brief: { ...(brief ?? {}), ...base },
    assumptions: [
      { field: "pitchPurpose", label: "Pitching to OTT / streaming buyers", value: "ott" },
      { field: "language", label: "Telugu, pan-India", value: "Telugu, pan-India" },
    ],
    message: "Got your essentials — I'll infer the rest and build a first draft you can refine.",
    ask: { field: null, inputType: "none", options: [], allowFreeText: false },
    ready: true,
    missingRequired: [],
  };
}

function strValue(cell: unknown): string | undefined {
  const v = (cell as { value?: unknown } | undefined)?.value;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.join(", ");
  return undefined;
}

function pillarsFromBrief(brief: InterviewBrief | null, prev: InterviewPillars): InterviewPillars {
  const b = brief ?? {};
  return {
    ...prev,
    title: strValue(b.title) ?? prev.title,
    logline: strValue(b.logline) ?? prev.logline,
    synopsis: strValue(b.synopsis) ?? prev.synopsis,
  };
}

function deriveTitle(text: string): string {
  const words = text.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean).slice(0, 5);
  if (!words.length) return "Untitled Project";
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

// Guarantee the three pillars are non-empty before we build — derive from each other
// (and invent a title) so a deck is never generated hollow.
function ensurePillars(brief: InterviewBrief | null): InterviewBrief {
  const b: InterviewBrief = { ...(brief ?? {}) };
  const get = (f: string) => (strValue(b[f]) ?? "").trim();
  let title = get("title");
  let logline = get("logline");
  let synopsis = get("synopsis");
  if (!logline) logline = synopsis;
  if (!synopsis) synopsis = logline;
  if (!title) title = deriveTitle(logline || synopsis || "Untitled Project");
  b.title = { value: title, method: b.title?.method ?? "infer", confidence: 0.7 };
  if (logline) b.logline = { value: logline, method: b.logline?.method ?? "extract", confidence: 0.8 };
  if (synopsis) b.synopsis = { value: synopsis, method: b.synopsis?.method ?? "extract", confidence: 0.8 };
  return b;
}

function briefToForm(brief: InterviewBrief): Partial<IntakeFormData> {
  const out: Record<string, string> = {};
  const allowed = new Set(Object.keys(EMPTY_INTAKE_FORM));
  for (const [k, cell] of Object.entries(brief ?? {})) {
    if (!allowed.has(k)) continue;
    const v = strValue(cell);
    out[k] = v ?? "";
  }
  return out as Partial<IntakeFormData>;
}

let _mid = 0;
const nextId = () => `m-${_mid++}`;

export function ChatIntake({ projectId }: ChatIntakeProps) {
  const router = useRouter();
  const { updateForm, completeStep } = useSetupWizard();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<InterviewHistoryTurn[]>([]);
  const [pillars, setPillars] = useState<InterviewPillars>({});
  const [brief, setBrief] = useState<InterviewBrief | null>(null);
  const [ask, setAsk] = useState<InterviewAsk | null>(null);
  const [assumptions, setAssumptions] = useState<InterviewAssumption[]>([]);
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [draft, setDraft] = useState("");
  const [building, setBuilding] = useState(false);
  const [offline, setOffline] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking, ready]);

  const applyResult = useCallback((res: InterviewResult, baseHistory: InterviewHistoryTurn[]) => {
    setMessages((m) => [...m, { id: nextId(), role: "ai", text: res.message }]);
    setHistory([
      ...baseHistory,
      { role: "assistant", text: res.message, askedQuestion: res.ask.inputType !== "none" },
    ]);
    setBrief(res.brief);
    updateForm(briefToForm(res.brief)); // keep the live preview in sync each turn
    setPillars((prev) => pillarsFromBrief(res.brief, prev));
    setAssumptions(res.assumptions ?? []);
    setAsk(res.ask);
    setReady(res.ready);
  }, [updateForm]);

  const advance = useCallback(
    async (h: InterviewHistoryTurn[], p: InterviewPillars, b: InterviewBrief | null) => {
      setThinking(true);
      let res: InterviewResult;
      try {
        res = await interview(projectId, { history: h, pillars: p, brief: b });
        setOffline(false);
      } catch {
        res = localTurn(p, b);
        setOffline(true);
      }
      setThinking(false);
      applyResult(res, h);
    },
    [projectId, applyResult],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setMessages([{ id: nextId(), role: "ai", text: OPENING }]);
    setAsk({ field: null, inputType: "free_text", options: [], allowFreeText: true });
  }, []);

  const submitAnswer = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value || thinking) return;
      setDraft("");
      setMessages((m) => [...m, { id: nextId(), role: "user", text: value }]);
      const nextPillars =
        ask?.field && PILLAR_FIELDS.has(ask.field)
          ? { ...pillars, [ask.field]: value }
          : pillars;
      const nextHistory: InterviewHistoryTurn[] = [...history, { role: "user", text: value }];
      setPillars(nextPillars);
      setHistory(nextHistory);
      setAsk(null);
      void advance(nextHistory, nextPillars, brief);
    },
    [ask, pillars, history, brief, thinking, advance],
  );

  const chooseOption = useCallback(
    (opt: InterviewOption) => submitAnswer(opt.label),
    [submitAnswer],
  );

  const onFile = useCallback(
    async (file: File) => {
      if (thinking) return;
      setMessages((m) => [...m, { id: nextId(), role: "user", text: `📎 ${file.name}` }]);
      setThinking(true);
      try {
        const res = await extractScript(projectId, file);
        const f = res.form;
        const nextPillars: InterviewPillars = {
          ...pillars,
          title: f.title || pillars.title,
          logline: f.logline || pillars.logline,
          synopsis: f.synopsis || pillars.synopsis,
        };
        const nextHistory: InterviewHistoryTurn[] = [
          ...history,
          { role: "user", text: `(uploaded script: ${res.fileName})` },
        ];
        setPillars(nextPillars);
        setHistory(nextHistory);
        setThinking(false);
        await advance(nextHistory, nextPillars, brief);
      } catch {
        setThinking(false);
        setMessages((m) => [
          ...m,
          {
            id: nextId(),
            role: "ai",
            text: "I couldn't read that file. Try a PDF, DOCX, FDX, or TXT — or just tell me about it.",
          },
        ]);
      }
    },
    [projectId, pillars, history, brief, thinking, advance],
  );

  const editBriefField = useCallback((field: string, value: string) => {
    setBrief((prev) => ({
      ...(prev ?? {}),
      [field]: {
        value,
        method: (prev?.[field]?.method as string) ?? "extract",
        confidence: 0.9,
      },
    }));
  }, []);

  const editAssumption = useCallback((field: string, value: string) => {
    setAssumptions((prev) =>
      prev.map((a) => (a.field === field ? { ...a, value, label: value } : a)),
    );
    editBriefField(field, value);
  }, [editBriefField]);

  const buildDeck = useCallback(async () => {
    if (building) return;
    setBuilding(true);
    const safe = ensurePillars(brief);
    setBrief(safe);
    updateForm(briefToForm(safe));
    try {
      await finalizeInterview(projectId, safe);
    } catch {
      /* sessionStorage + completeStep below still carry the intake */
    }
    completeStep("identity");
    completeStep("body");
    completeStep("pitch");
    router.push(projectRoutes.templates(projectId));
  }, [brief, building, projectId, updateForm, completeStep, router]);

  const briefStr = (field: string) => (strValue(brief?.[field]) ?? "").trim();

  const showComposer = !ready && !!ask && ask.inputType !== "none";
  const isChips = ask?.inputType === "chips" || ask?.inputType === "cards";
  const placeholder = isChips
    ? "…or type your own"
    : ask?.field && PLACEHOLDER_BY_FIELD[ask.field]
      ? PLACEHOLDER_BY_FIELD[ask.field]
      : "Tell me about your film — a sentence or a paragraph…";

  return (
    <div className="flex h-full w-full flex-col">
      {offline && (
        <div className="mb-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Couldn&apos;t reach the AI — running in basic mode. Start the backend (and restart it so the
          new <code className="text-amber-200">/interview</code> route loads).
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-1 py-4">
        {messages.map((m) =>
          m.role === "ai" ? (
            <div key={m.id} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-neon/15 text-xs font-bold text-accent-neon">
                P
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border-glass bg-surface-2 px-4 py-2.5 text-sm leading-relaxed text-text-primary">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-accent-neon/10 px-4 py-2.5 text-sm leading-relaxed text-text-primary">
                {m.text}
              </div>
            </div>
          ),
        )}

        {thinking && (
          <div className="flex items-center gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-neon/15 text-xs font-bold text-accent-neon">
              P
            </div>
            <div className="flex gap-1 rounded-2xl rounded-tl-sm border border-border-glass bg-surface-2 px-4 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-dim [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-dim [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-dim" />
            </div>
          </div>
        )}

        {ready && (
          <div className="space-y-4 rounded-2xl border border-border-glass bg-surface-2/60 p-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-dim">
                What I understood — edit anything
              </p>
              <div className="space-y-2">
                <EditableField label="Title" value={briefStr("title")} onSave={(v) => editBriefField("title", v)} />
                <EditableField label="Logline" value={briefStr("logline")} multiline onSave={(v) => editBriefField("logline", v)} />
                <EditableField label="Synopsis" value={briefStr("synopsis")} multiline onSave={(v) => editBriefField("synopsis", v)} />
                {briefStr("mainCharacters") && (
                  <EditableField label="Characters" value={briefStr("mainCharacters")} multiline onSave={(v) => editBriefField("mainCharacters", v)} />
                )}
                {briefStr("genreBlend") && (
                  <EditableField label="Genre" value={briefStr("genreBlend")} onSave={(v) => editBriefField("genreBlend", v)} />
                )}
                {briefStr("tone") && (
                  <EditableField label="Tone" value={briefStr("tone")} onSave={(v) => editBriefField("tone", v)} />
                )}
              </div>
            </div>

            {assumptions.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-dim">
                  Assumptions — tap to change
                </p>
                <div className="flex flex-wrap gap-2">
                  {assumptions.map((a) => (
                    <AssumptionChip key={a.field} assumption={a} onSave={(v) => editAssumption(a.field, v)} />
                  ))}
                </div>
              </div>
            )}

            <Button onClick={buildDeck} disabled={building} className="w-full">
              {building ? "Building your deck…" : "Build my deck →"}
            </Button>
          </div>
        )}
      </div>

      {showComposer && (
        <div className="border-t border-border-glass pt-3">
          {isChips && (
            <div className="mb-2 flex flex-wrap gap-2">
              {ask!.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => chooseOption(opt)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                    opt.selected
                      ? "border-accent-neon/60 bg-accent-neon/15 text-accent-neon"
                      : "border-border-glass bg-surface-2 text-text-muted hover:border-accent-neon/40 hover:text-text-primary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {(!isChips || ask!.allowFreeText) && (
            <div className="flex items-end gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.fdx,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                  e.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                title="Attach a script"
                onClick={() => fileRef.current?.click()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border-glass bg-surface-2 text-text-muted hover:text-text-primary"
              >
                📎
              </button>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitAnswer(draft);
                  }
                }}
                rows={1}
                placeholder={placeholder}
                className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-border-glass bg-surface-2 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-dim focus:border-accent-neon/50 focus:outline-none"
              />
              <Button onClick={() => submitAnswer(draft)} disabled={!draft.trim() || thinking}>
                Send
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditableField({
  label,
  value,
  multiline,
  onSave,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);

  if (editing) {
    return (
      <div className="rounded-lg border border-accent-neon/40 bg-surface-3/40 p-2">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-dim">
          {label}
        </span>
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
        <div className="mt-1 flex gap-2">
          <button
            onClick={() => {
              onSave(v.trim());
              setEditing(false);
            }}
            className="text-xs font-medium text-accent-neon"
          >
            Save
          </button>
          <button
            onClick={() => {
              setV(value);
              setEditing(false);
            }}
            className="text-xs text-text-dim"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        setV(value);
        setEditing(true);
      }}
      className="flex w-full items-start gap-2 rounded-lg border border-border-glass bg-surface-3/30 p-2 text-left hover:border-accent-neon/30"
    >
      <span className="mt-0.5 w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-text-dim">
        {label}
      </span>
      <span className={`flex-1 text-sm ${value ? "text-text-primary" : "text-text-dim"}`}>
        {value || "— tap to add"}
      </span>
      <span className="text-text-dim">✎</span>
    </button>
  );
}

function AssumptionChip({
  assumption,
  onSave,
}: {
  assumption: InterviewAssumption;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(assumption.value ?? assumption.label));

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-accent-neon/50 bg-surface-2 px-2 py-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSave(value.trim() || assumption.label);
              setEditing(false);
            }
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-40 bg-transparent text-xs text-text-primary focus:outline-none"
        />
        <button
          onClick={() => {
            onSave(value.trim() || assumption.label);
            setEditing(false);
          }}
          className="text-xs text-accent-neon"
        >
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
      {assumption.label}
      <span className="text-text-dim">✎</span>
    </button>
  );
}
