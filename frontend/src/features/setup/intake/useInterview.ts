"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  extractScript,
  finalizeInterview,
  interview,
  type InterviewAssumption,
  type InterviewBrief,
  type InterviewHistoryTurn,
  type InterviewImage,
  type InterviewInputType,
  type InterviewSection,
  type InterviewOption,
  type InterviewPillars,
  type InterviewResult,
} from "@/lib/api";
import { deckCommand } from "@/lib/api/deck";
import { applyDeckActions, type DeckActionHandlers } from "@/lib/apply-deck-actions";
import { FALLBACK_DESIGN, withAccent } from "@/lib/deck-themes";
import { EMPTY_INTAKE_FORM, type GenerationStatus } from "@/types/setup";
import type { IntakeFormData } from "@/types/workflow";
import type { Slide } from "@/types/slide";
import type { ColorToken, DesignDirection } from "@/types/design";
import { useSetupWizard } from "../SetupWizardContext";

// ── Shared interview state ────────────────────────────────────────────────
// One source of truth for both the conversation rail and the Questions
// artifact. The backend intake_interview agent runs a CONFIRM -> CLARIFY ->
// SUGGEST loop: every turn it returns a single `message` (the question to
// show) and an `ask` (chips / cards / free-text). We render the chat from the
// messages and the artifact from the questions the agent has asked — nothing
// is predetermined here, the agent decides what to ask next.

export type ChatMessage =
  | { id: string; role: "assistant"; text: string }
  | { id: string; role: "user"; text: string }
  | { id: string; role: "tool"; label: string; detail: string[] }
  | { id: string; role: "attachment"; name: string; previewUrl?: string; note?: string };

export interface AskedQuestion {
  id: string;
  prompt: string;
  field: string | null;
  inputType: InterviewInputType;
  options: InterviewOption[];
  allowFreeText: boolean;
  answer?: string;
}

const PILLARS = ["title", "logline", "synopsis"] as const;

// Per-load random prefix so freshly-minted ids can never collide with ids
// restored from sessionStorage (which were minted in a previous page load).
let _id = 0;
const _idPrefix = Math.random().toString(36).slice(2, 8);
const nextId = () => `i-${_idPrefix}-${_id++}`;

function strValue(cell: unknown): string | undefined {
  const v = (cell as { value?: unknown } | undefined)?.value;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.join(", ");
  return undefined;
}

function briefToForm(brief: InterviewBrief): Partial<IntakeFormData> {
  const allowed = new Set(Object.keys(EMPTY_INTAKE_FORM));
  const out: Record<string, string> = {};
  for (const [k, cell] of Object.entries(brief ?? {})) {
    if (!allowed.has(k)) continue;
    const v = strValue(cell);
    if (v) out[k] = v;
  }
  return out as Partial<IntakeFormData>;
}

/** Downscale an image file to ≤1280px JPEG and return base64 (no data-URL prefix) for the vision model. */
async function encodeReferenceImage(file: File): Promise<InterviewImage> {
  const MAX_DIM = 1280;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("unreadable image"));
      el.src = url;
    });
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas context");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return { name: file.name, mediaType: "image/jpeg", data: dataUrl.split(",")[1] ?? "" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function deriveTitle(text: string): string {
  const words = text.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean).slice(0, 6);
  if (!words.length) return "Untitled Project";
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

// Guarantee the three pillars are non-empty before we build.
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

// Offline fallback: still generate the brief artifact — never interrogate in chat.
function defaultSections(synopsis: string): InterviewSection[] {
  return [
    { id: "synopsis", field: "synopsis", title: "What is it about?", help: "A logline or short synopsis — the more the better.", kind: "textarea", value: synopsis },
    { id: "genre", field: "genreBlend", title: "Genre / tone", kind: "multi",
      options: [{ label: "Drama", selected: true }, { label: "Thriller" }, { label: "Romance" }, { label: "Comedy" }, { label: "Action" }, { label: "Decide for me" }] },
    { id: "audience", field: "targetAudience", title: "Who is this deck FOR?", kind: "chips",
      options: [{ label: "Investors / financiers" }, { label: "Streaming platform", selected: true }, { label: "Festival / grant" }, { label: "Studio / distributor" }, { label: "Decide for me" }] },
    { id: "vibe", field: "visualAesthetic", title: "Visual vibe", kind: "chips",
      options: [{ label: "Cinematic & moody", selected: true }, { label: "Bright & romantic" }, { label: "Bold poster-style" }, { label: "Elegant & editorial" }, { label: "Decide for me" }] },
    { id: "palette", field: "colorPalette", title: "Colour direction", kind: "swatches",
      options: [
        { label: "Cinematic Noir", colors: ["#0B0B0D", "#1E1F22", "#B8862F", "#EDE7DA"], selected: true },
        { label: "Warm Romance", colors: ["#2A1A12", "#7A3B2E", "#E8B04B", "#F3E9DC"] },
        { label: "Bold Poster", colors: ["#0A0A0A", "#E11D48", "#FAFAFA", "#1D4ED8"] },
        { label: "Editorial Slate", colors: ["#101418", "#3C4A5A", "#9CA3AF", "#F5F5F4"] },
      ] },
    { id: "type", field: "textureStyle", title: "Type personality", kind: "chips",
      options: [{ label: "Big cinematic serif", selected: true }, { label: "Clean modern sans" }, { label: "Condensed poster" }, { label: "Decide for me" }] },
    { id: "slides", field: "slideCount", title: "Roughly how many slides?", kind: "slider", min: 8, max: 20, value: 14 },
  ];
}

function localTurn(pillars: InterviewPillars, brief: InterviewBrief | null): InterviewResult {
  const title = (pillars.title ?? "").trim();
  const base: InterviewBrief = {};
  if (title) base.title = { value: title, method: "extract", confidence: 0.8 };
  if ((pillars.logline ?? "").trim()) base.logline = { value: pillars.logline as string, method: "extract", confidence: 0.8 };
  if ((pillars.synopsis ?? "").trim()) base.synopsis = { value: pillars.synopsis as string, method: "extract", confidence: 0.8 };
  return {
    brief: { ...(brief ?? {}), ...base },
    sections: defaultSections(pillars.synopsis ?? ""),
    assumptions: [
      { field: "pitchPurpose", label: "Pitching to OTT / streaming buyers", value: "ott" },
      { field: "language", label: "Telugu, pan-India", value: "Telugu, pan-India" },
    ],
    message: `Here's a starting brief${title ? ` for ${title}` : ""} — tap to adjust on the right, or tell me more here.`,
    ask: { field: null, inputType: "none", options: [], allowFreeText: false },
    ready: true,
    missingRequired: [],
  };
}
export interface Interview {
  messages: ChatMessage[];
  questions: AskedQuestion[];
  sections: InterviewSection[];
  assumptions: InterviewAssumption[];
  form: IntakeFormData;
  ready: boolean;
  thinking: boolean;
  offline: boolean;
  building: boolean;
  draftSlides: Slide[];
  designDirection: DesignDirection | null;
  generationStatus: GenerationStatus;
  generationProgress: number;
  projectName: string;
  setProjectName: (name: string) => void;
  sendText: (text: string) => void;
  chooseOption: (opt: InterviewOption) => void;
  uploadFile: (file: File) => void;
  editAssumption: (field: string, value: string) => void;
  editField: (field: string, value: string) => void;
  build: () => Promise<void>;
  nextRound: () => void;
}

export function useInterview(projectId: string): Interview {
  const {
    formData,
    updateForm,
    completeStep,
    initDraftSlides,
    approveContent,
    draftSlides,
    designDirection: ctxDesign,
    generationStatus,
    generationProgress,
    updateDraftSlide,
    deleteDraftSlide,
    insertDraftSlideAfter,
    moveDraftSlide,
    regenerateDraftSlide,
  } = useSetupWizard();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questions, setQuestions] = useState<AskedQuestion[]>([]);
  const [sections, setSections] = useState<InterviewSection[]>([]);
  const [assumptions, setAssumptions] = useState<InterviewAssumption[]>([]);
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [offline, setOffline] = useState(false);
  const [building, setBuilding] = useState(false);
  // Agent-driven design override (instant, regen-free). Folded into the effective design below.
  const [designOverride, setDesignOverride] = useState<DesignDirection | null>(null);
  const designDirection = designOverride ?? ctxDesign;
  const [projectName, setProjectName] = useState("project");

  const history = useRef<InterviewHistoryTurn[]>([]);
  const brief = useRef<InterviewBrief | null>(null);
  // Reference images waiting to be shown to the agent on the next turn (sent once, then cleared —
  // the agent folds what it saw into the brief, so the analysis persists as text).
  const pendingImages = useRef<InterviewImage[]>([]);
  const started = useRef(false);
  const storageKey = `pitch-interview-${projectId}`;

  const formRef = useRef(formData);
  useEffect(() => {
    formRef.current = formData;
  }, [formData]);

  const pillarsNow = useCallback((): InterviewPillars => {
    const v = formRef.current;
    return { title: v.title, logline: v.logline, synopsis: v.synopsis };
  }, []);

  const applyResult = useCallback(
    (res: InterviewResult, baseHistory: InterviewHistoryTurn[]) => {
      brief.current = res.brief;
      setSections(res.sections ?? []);
      updateForm(briefToForm(res.brief));
      setAssumptions(res.assumptions ?? []);
      setReady(res.ready);
      if (res.message) {
        setMessages((m) => [...m, { id: nextId(), role: "assistant", text: res.message }]);
      }
      history.current = [
        ...baseHistory,
        { role: "assistant", text: res.message, askedQuestion: res.ask.inputType !== "none" },
      ];
      if (res.ask && res.ask.inputType !== "none") {
        setQuestions((q) => [
          ...q,
          {
            id: nextId(),
            prompt: res.message,
            field: res.ask.field,
            inputType: res.ask.inputType,
            options: res.ask.options ?? [],
            allowFreeText: res.ask.allowFreeText,
          },
        ]);
      }
    },
    [updateForm],
  );

  const advance = useCallback(
    async (h: InterviewHistoryTurn[], p: InterviewPillars) => {
      setThinking(true);
      const images = pendingImages.current.length ? [...pendingImages.current] : undefined;
      let res: InterviewResult;
      try {
        res = await interview(projectId, { history: h, pillars: p, brief: brief.current, images });
        setOffline(false);
        // Delivered to the agent — don't resend on later turns.
        if (images) pendingImages.current = [];
      } catch {
        res = localTurn(p, brief.current);
        setOffline(true);
      }
      setThinking(false);
      applyResult(res, h);
    },
    [projectId, applyResult],
  );

  // Restore a saved session, or kick off the first turn.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const sv = JSON.parse(raw);
        if (sv.messages?.length) {
          setMessages(sv.messages);
          setSections(sv.sections ?? []);
          setAssumptions(sv.assumptions ?? []);
          setReady(!!sv.ready);
          brief.current = sv.brief ?? null;
          history.current = sv.history ?? [];
          return;
        }
      }
    } catch {
      /* ignore */
    }
    // Don't generate anything yet — wait for the director to describe the film.
    // The agent generates the tailored brief only in response to what they say (like Claude).
    setMessages([
      {
        id: nextId(),
        role: "assistant",
        text:
          "Hi — I'm your pitch producer. Tell me about your film — a sentence, a paragraph, or " +
          "drop a script — and I'll generate a tailored design brief on the right.",
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist the session so navigating away and back doesn't lose the chat or brief.
  useEffect(() => {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ messages, sections, assumptions, ready, brief: brief.current, history: history.current }),
      );
    } catch {
      /* ignore quota */
    }
  }, [messages, sections, assumptions, ready, storageKey]);

  // Instant, regen-free design changes driven by the agent.
  const setAccent = useCallback(
    (hex: string) => setDesignOverride((p) => withAccent(p ?? ctxDesign ?? FALLBACK_DESIGN, hex)),
    [ctxDesign],
  );
  const setTheme = useCallback(
    (palette: ColorToken[]) => setDesignOverride((p) => ({ ...(p ?? ctxDesign ?? FALLBACK_DESIGN), palette })),
    [ctxDesign],
  );

  // After the deck is built, the chat BECOMES the deck-editing agent: each message → slide_edit
  // agent → structured actions applied live. Colour/theme actions are instant; content via mutations.
  const runDeckCommand = useCallback(
    async (value: string) => {
      setMessages((m) => [...m, { id: nextId(), role: "user", text: value }]);
      setThinking(true);
      try {
        const slim = draftSlides.map((s) => ({
          id: s.id,
          slideNumber: s.slideNumber,
          slideType: s.slideType,
          title: s.title,
          content: s.content,
        }));
        const res = await deckCommand(projectId, value, slim);
        const handlers: DeckActionHandlers = {
          slides: draftSlides,
          onUpdateSlide: updateDraftSlide,
          onMoveSlide: moveDraftSlide,
          onInsertAfter: insertDraftSlideAfter,
          onDeleteSlide: deleteDraftSlide,
          onRegenerateSlide: regenerateDraftSlide,
          onSetAccent: setAccent,
          onSetTheme: setTheme,
        };
        await applyDeckActions(res.actions, handlers);
        setMessages((m) => [...m, { id: nextId(), role: "assistant", text: res.message }]);
      } catch {
        setMessages((m) => [
          ...m,
          { id: nextId(), role: "assistant", text: "I couldn't reach the editing model — try again in a moment." },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [
      projectId, draftSlides, updateDraftSlide, moveDraftSlide, insertDraftSlideAfter,
      deleteDraftSlide, regenerateDraftSlide, setAccent, setTheme,
    ],
  );

  const submitAnswer = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value || thinking) return;
      // Once the deck exists, the chat edits the deck instead of running intake.
      if (draftSlides.length > 0) {
        void runDeckCommand(value);
        return;
      }
      // Attach the answer to the pending (last) question.
      setQuestions((qs) => {
        if (!qs.length) return qs;
        const last = qs[qs.length - 1];
        if (last.answer !== undefined) return qs;
        return qs.map((q, i) => (i === qs.length - 1 ? { ...q, answer: value } : q));
      });
      setMessages((m) => [...m, { id: nextId(), role: "user", text: value }]);

      const pending = questions[questions.length - 1];
      const pillars = { ...pillarsNow() };
      if (pending?.field) {
        if ((PILLARS as readonly string[]).includes(pending.field)) {
          pillars[pending.field as (typeof PILLARS)[number]] = value;
        }
        if (pending.field in EMPTY_INTAKE_FORM) {
          updateForm({ [pending.field]: value });
        }
      }
      const baseHistory = [...history.current, { role: "user" as const, text: value }];
      history.current = baseHistory;
      void advance(baseHistory, pillars);
    },
    [thinking, questions, pillarsNow, updateForm, advance, draftSlides, runDeckCommand],
  );

  const chooseOption = useCallback((opt: InterviewOption) => submitAnswer(opt.label), [submitAnswer]);

  const uploadFile = useCallback(
    async (file: File) => {
      if (thinking) return;
      const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|avif)$/i.test(file.name);
      const isDoc = /\.(pdf|docx|fdx|txt|md|rtf)$/i.test(file.name) || /pdf|word|officedocument|text/.test(file.type);

      // Images / inspiration boards / references → the agent SEES them: encode, attach to the
      // next interview turn, and let the model's real analysis drive the reply and the brief.
      if (isImage) {
        const previewUrl = URL.createObjectURL(file);
        setMessages((m) => [
          ...m,
          { id: nextId(), role: "attachment", name: file.name, previewUrl, note: "Reference image" },
        ]);
        const cur = (formRef.current.visualReferences || "").trim();
        updateForm({ visualReferences: cur ? `${cur}, ${file.name}` : file.name });
        try {
          const encoded = await encodeReferenceImage(file);
          pendingImages.current = [...pendingImages.current, encoded].slice(-4);
          const baseHistory = [
            ...history.current,
            { role: "user" as const, text: `(shared a reference image: ${file.name})` },
          ];
          history.current = baseHistory;
          await advance(baseHistory, pillarsNow());
        } catch {
          setMessages((m) => [
            ...m,
            { id: nextId(), role: "assistant", text: `I couldn't read ${file.name} — try a PNG or JPG and I'll fold it into the look.` },
          ]);
        }
        return;
      }

      // Scripts / treatments / docs → extract intake fields.
      if (isDoc) {
        setMessages((m) => [...m, { id: nextId(), role: "attachment", name: file.name, note: "Document" }]);
        const toolId = nextId();
        setMessages((m) => [...m, { id: toolId, role: "tool", label: `Reading ${file.name}`, detail: ["parsing document…"] }]);
        setThinking(true);
        try {
          const res = await extractScript(projectId, file);
          const f = (res.form ?? {}) as Partial<IntakeFormData>;
          const filled = Object.entries(f).filter(([, v]) => typeof v === "string" && v.trim()).map(([k]) => k);
          setMessages((m) =>
            m.map((msg) =>
              msg.id === toolId && msg.role === "tool"
                ? { ...msg, label: `Read ${res.fileName ?? file.name}`, detail: filled.length ? [`extracted: ${filled.join(", ")}`] : ["no fields found"] }
                : msg,
            ),
          );
          updateForm(f);
          const pillars: InterviewPillars = {
            title: f.title || formRef.current.title,
            logline: f.logline || formRef.current.logline,
            synopsis: f.synopsis || formRef.current.synopsis,
          };
          const baseHistory = [...history.current, { role: "user" as const, text: `(uploaded script: ${res.fileName ?? file.name})` }];
          history.current = baseHistory;
          setThinking(false);
          await advance(baseHistory, pillars);
        } catch {
          setThinking(false);
          setMessages((m) =>
            m.map((msg) =>
              msg.id === toolId && msg.role === "tool" ? { ...msg, label: `Couldn't read ${file.name}`, detail: ["try PDF, DOCX, FDX, or TXT"] } : msg,
            ),
          );
        }
        return;
      }

      // Anything else → just share it in the conversation.
      setMessages((m) => [...m, { id: nextId(), role: "attachment", name: file.name, note: "Attached" }]);
    },
    [thinking, projectId, updateForm, advance, pillarsNow],
  );

  const editAssumption = useCallback(
    (field: string, value: string) => {
      setAssumptions((prev) => prev.map((a) => (a.field === field ? { ...a, value, label: value } : a)));
      if (field in EMPTY_INTAKE_FORM) updateForm({ [field]: value });
      brief.current = {
        ...(brief.current ?? {}),
        [field]: { value, method: "ask", confidence: 0.9 },
      };
    },
    [updateForm],
  );

  const editField = useCallback(
    (field: string, value: string) => {
      if (field in EMPTY_INTAKE_FORM) updateForm({ [field]: value });
      brief.current = {
        ...(brief.current ?? {}),
        [field]: { value, method: "ask", confidence: 0.95 },
      };
    },
    [updateForm],
  );

  // Advance to the next round of questions without a chat message — the agent
  // re-analyses the (already updated) brief and asks the next 3-4 questions.
  const nextRound = useCallback(() => {
    if (thinking) return;
    const baseHistory = [...history.current, { role: "user" as const, text: "(answered the current questions)" }];
    history.current = baseHistory;
    void advance(baseHistory, pillarsNow());
  }, [thinking, advance, pillarsNow]);

  // Build deck — no intermediate pages. Finalise the brief, then kick off real generation
  // RIGHT HERE; the Preview tab renders the deck as it streams in (Cloud-Design style).
  const build = useCallback(async () => {
    if (building) return;
    setBuilding(true);
    const safe = ensurePillars(brief.current);
    brief.current = safe;
    updateForm(briefToForm(safe));
    try {
      await finalizeInterview(projectId, safe);
    } catch {
      /* sessionStorage + completeStep still carry the intake forward */
    }
    completeStep("identity");
    completeStep("body");
    completeStep("pitch");
    approveContent();
    initDraftSlides(); // backend recommends a template + generates content/images, streaming slides
    setBuilding(false);
  }, [building, projectId, updateForm, completeStep, approveContent, initDraftSlides]);

  return {
    messages,
    questions,
    sections,
    assumptions,
    form: formData,
    ready,
    thinking,
    offline,
    building,
    draftSlides,
    designDirection,
    generationStatus,
    generationProgress,
    projectName,
    setProjectName,
    sendText: submitAnswer,
    chooseOption,
    uploadFile,
    editAssumption,
    editField,
    build,
    nextRound,
  };
}
