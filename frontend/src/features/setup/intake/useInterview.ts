"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  extractScript,
  finalizeInterview,
  getInterviewState,
  getProject,
  interview,
  pollJob,
  saveInterviewState,
  uploadReferenceDeck,
  workshopSlideImage,
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
import { deckCommand, deckCommandErrorText, honestDeckCommandText, type DeckCommandImage } from "@/lib/api/deck";
import { applyDeckActions, describeDeckAction, type DeckActionHandlers } from "@/lib/apply-deck-actions";
import { EMPTY_INTAKE_FORM, type GenerationStatus } from "@/types/setup";
import type { IntakeFormData } from "@/types/workflow";
import type { Slide } from "@/types/slide";
import type { DesignDirection } from "@/types/design";
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

/** One uploaded inspiration reference shown in the visual-direction gallery. */
export interface ReferenceImage {
  id: string;
  name: string;
  previewUrl: string;
}

const PILLARS = ["title", "logline", "synopsis"] as const;

// How many inspiration references the director can collect under "Choose Your Visual Direction".
const MAX_REFERENCES = 10;

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

// The agent occasionally invents a near-miss field name ("director" instead of "creativeTeam").
// Without a mapping those values silently vanish from the right-side brief — the user hears
// "added it" in chat but sees nothing. Route the common strays to their real field.
const BRIEF_KEY_ALIASES: Record<string, keyof IntakeFormData> = {
  director: "creativeTeam", directorprofile: "creativeTeam", directorinfo: "creativeTeam",
  directorbio: "creativeTeam", team: "creativeTeam", cast: "creativeTeam", crew: "creativeTeam",
  talent: "creativeTeam",
  genre: "genreBlend", genres: "genreBlend",
  audience: "targetAudience", market: "targetAudience",
  comparables: "showCross", comps: "showCross",
  vision: "directorVision", directorsvision: "directorVision",
  statement: "directorStatement", directorsstatement: "directorStatement",
  world: "storyWorld", setting: "storyWorld",
  characters: "mainCharacters", protagonist: "mainCharacters",
  moodboard: "moodBoard", budgetask: "budget", ask: "budget",
  production: "productionStatus", timeline: "productionStatus",
  marketing: "distribution",
};

function briefToForm(brief: InterviewBrief): Partial<IntakeFormData> {
  const allowed = new Set(Object.keys(EMPTY_INTAKE_FORM));
  const out: Record<string, string> = {};
  const entries = Object.entries(brief ?? {});
  // Direct fields first, then aliases — an alias must never clobber a directly-named field.
  for (const [k, cell] of entries) {
    const v = strValue(cell);
    if (v && allowed.has(k)) out[k] = v;
  }
  for (const [k, cell] of entries) {
    if (allowed.has(k)) continue;
    const v = strValue(cell);
    const alias = BRIEF_KEY_ALIASES[k.toLowerCase().replace(/[^a-z]/g, "")];
    if (v && alias && !out[alias]) out[alias] = v;
  }
  return out as Partial<IntakeFormData>;
}

/** "creativeTeam" → "Creative team" — for the captured-fields card in the chat. */
function fieldLabel(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1").toLowerCase().trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
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

// A small (≈360px) JPEG data-URI thumbnail for the chat bubble. Tiny enough to persist in
// localStorage and survive reloads (unlike a blob URL, and without the full image's bulk).
async function makeThumb(file: File, max = 360): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("unreadable image"));
      el.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    return "";
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
  sendText: (text: string, selectedSlideId?: string) => void;
  chooseOption: (opt: InterviewOption) => void;
  uploadFile: (file: File, selectedSlideId?: string, stage?: boolean) => void;
  referenceImages: ReferenceImage[];
  addReferenceImages: (files: File[]) => void;
  removeReferenceImage: (id: string) => void;
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
    prepareDraftSlides,
    approveContent,
    draftSlides,
    designDirection: ctxDesign,
    generationStatus,
    generationProgress,
    updateDraftSlide,
    updateDraftSlideMeta,
    deleteDraftSlide,
    insertDraftSlideAfter,
    moveDraftSlide,
    regenerateDraftSlide,
    replaceDraftSlide,
    applyAccent,
    applyThemePalette,
    applyDisplayFont,
    restoreDeckSnapshot,
  } = useSetupWizard();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questions, setQuestions] = useState<AskedQuestion[]>([]);
  const [sections, setSections] = useState<InterviewSection[]>([]);
  const [assumptions, setAssumptions] = useState<InterviewAssumption[]>([]);
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [offline, setOffline] = useState(false);
  const [building, setBuilding] = useState(false);
  // The deck's design lives in the shared wizard context (the canvas reads it), so agent
  // colour/theme/font changes flow through that single source and render instantly.
  const designDirection = ctxDesign;
  const [projectName, setProjectName] = useState("project");

  const history = useRef<InterviewHistoryTurn[]>([]);
  const brief = useRef<InterviewBrief | null>(null);
  // Chat undo: deck snapshots taken before each mutating agent batch (newest last, cap 10).
  const agentUndoStack = useRef<{ slides: Slide[]; design: DesignDirection | null }[]>([]);
  // Reference images waiting to be shown to the agent on the next turn (sent once, then cleared —
  // the agent folds what it saw into the brief, so the analysis persists as text).
  const pendingImages = useRef<InterviewImage[]>([]);
  // The visual-direction reference library shown in the Questions tab. Kept here (not in the
  // persisted wizard state) because base64 thumbnails would blow the localStorage quota; the
  // names live on the brief's `visualReferences` field and the agent's analysis persists there.
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const referenceImagesRef = useRef<ReferenceImage[]>([]);
  useEffect(() => {
    referenceImagesRef.current = referenceImages;
  }, [referenceImages]);
  const started = useRef(false);
  const storageKey = `pitch-interview-${projectId}`;

  const formRef = useRef(formData);
  useEffect(() => {
    formRef.current = formData;
  }, [formData]);

  // Mirror `thinking` into a ref so async handlers (e.g. reference uploads) can avoid firing a
  // second interview turn while one is already in flight.
  const thinkingRef = useRef(thinking);
  useEffect(() => {
    thinkingRef.current = thinking;
  }, [thinking]);

  const pillarsNow = useCallback((): InterviewPillars => {
    const v = formRef.current;
    return { title: v.title, logline: v.logline, synopsis: v.synopsis };
  }, []);

  const applyResult = useCallback(
    (res: InterviewResult, baseHistory: InterviewHistoryTurn[]) => {
      // What did this turn actually capture? Diff the MAPPED form (what the right panel
      // shows) before vs after, and show it as a review card — so the director always sees
      // exactly what was extracted and can immediately correct anything that's off.
      const prevForm = briefToForm(brief.current ?? {});
      const newForm = briefToForm(res.brief ?? {});
      const captured = Object.entries(newForm)
        .filter(([k, v]) => v && v !== prevForm[k as keyof IntakeFormData])
        .map(([k, v]) => {
          const val = String(v);
          return `${fieldLabel(k)}: ${val.length > 110 ? `${val.slice(0, 110)}…` : val}`;
        });
      brief.current = res.brief;
      setSections(res.sections ?? []);
      updateForm(newForm);
      setAssumptions(res.assumptions ?? []);
      setReady(res.ready);
      if (captured.length > 0) {
        setMessages((m) => [
          ...m,
          {
            id: nextId(),
            role: "tool",
            label: `Captured ${captured.length} ${captured.length === 1 ? "detail" : "details"} — review on the right`,
            detail: captured,
          },
        ]);
      }
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

  // Restore a saved conversation. localStorage is the fast local mirror; the server copy
  // (projects.interview_state) is the durable one shared across browsers/devices — whichever
  // was saved most recently wins. One-time hydration guarded by started.current.
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    type SavedConvo = {
      savedAt?: number;
      messages?: ChatMessage[];
      sections?: InterviewSection[];
      assumptions?: InterviewAssumption[];
      ready?: boolean;
      brief?: InterviewBrief | null;
      history?: InterviewHistoryTurn[];
    };
    const restore = (sv: SavedConvo) => {
      setMessages(sv.messages ?? []);
      setSections(sv.sections ?? []);
      setAssumptions(sv.assumptions ?? []);
      setReady(!!sv.ready);
      brief.current = sv.brief ?? null;
      history.current = sv.history ?? [];
    };
    const greet = () => {
      // Don't generate anything yet — wait for the director to describe the film.
      // The agent generates the tailored brief only in response to what they say (like Claude).
      const greetingId = nextId();
      setMessages([
        {
          id: greetingId,
          role: "assistant",
          text:
            "Start by describing your film idea, uploading a script, or adding visual references. " +
            "I'll turn it into a structured pitch-deck brief.",
        },
      ]);
      // Personalise with what the director already entered on the project-creation form
      // (title / genre / language). Only swap the text while the conversation hasn't begun.
      void getProject(projectId)
        .then((p) => {
          if (history.current.length > 0 || !p.title) return;
          const context = [...(p.genres ?? []), p.language].filter(Boolean).join(" · ");
          const text =
            `We're shaping “${p.title}”${context ? ` (${context})` : ""} — I have what you entered ` +
            "at setup. Describe the story, paste a synopsis, upload a script, or add visual " +
            "references and I'll build the pitch brief from there.";
          setMessages((m) =>
            m.map((msg) => (msg.id === greetingId && msg.role === "assistant" ? { ...msg, text } : msg)),
          );
        })
        .catch(() => {});
    };

    let local: SavedConvo | null = null;
    try {
      // localStorage is the fast mirror; fall back to a legacy sessionStorage save once.
      const raw = localStorage.getItem(storageKey) ?? sessionStorage.getItem(storageKey);
      if (raw) local = JSON.parse(raw) as SavedConvo;
    } catch {
      /* ignore */
    }
    if (local?.messages?.length) restore(local); // instant paint from the local mirror
    void getInterviewState(projectId)
      .then(({ state }) => {
        const server = state as SavedConvo | null;
        const serverNewer =
          !!server?.messages?.length && (server.savedAt ?? 0) > (local?.savedAt ?? 0);
        if (serverNewer) {
          // The conversation continued on another device — its copy wins.
          restore(server as SavedConvo);
        } else if (!local?.messages?.length && !server?.messages?.length) {
          greet();
        }
      })
      .catch(() => {
        if (!local?.messages?.length) greet();
      });
  }, [storageKey, projectId]);
  // Persist on every change: localStorage immediately (fast local mirror), the server
  // debounced (durable, cross-device). savedAt lets the two sides pick the newer copy.
  const serverSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    try {
      // Keep small data-URI thumbnails so images survive a reload, but drop dead blob: URLs
      // (they break) and any oversized preview (would blow the storage quota).
      const slimMessages = messages.map((m) => {
        if (m.role !== "attachment" || !m.previewUrl) return m;
        if (m.previewUrl.startsWith("blob:") || m.previewUrl.length > 80_000) {
          return { ...m, previewUrl: undefined };
        }
        return m;
      });
      const payload = {
        savedAt: Date.now(),
        messages: slimMessages,
        sections,
        assumptions,
        ready,
        brief: brief.current,
        history: history.current,
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
      // Only push real conversations (not the bare greeting), debounced against bursts.
      if (messages.length > 1) {
        if (serverSaveTimer.current) clearTimeout(serverSaveTimer.current);
        serverSaveTimer.current = setTimeout(() => {
          void saveInterviewState(projectId, payload).catch(() => {});
        }, 2000);
      }
    } catch {
      /* ignore quota */
    }
  }, [messages, sections, assumptions, ready, storageKey, projectId]);
  useEffect(
    () => () => {
      if (serverSaveTimer.current) clearTimeout(serverSaveTimer.current);
    },
    [],
  );

  // After the deck is built, the chat BECOMES the deck-editing agent: each message → slide_edit
  // agent → structured actions applied live. Colour/theme actions are instant; content via mutations.
  // Generate (or replace) just the image on a slide, then adopt the backend's updated slide.
  const generateSlideImage = useCallback(
    async (id: string, imagePrompt?: string) => {
      try {
        const job = await workshopSlideImage(id, imagePrompt);
        const final = await pollJob(job);
        if (final.status === "failed") return;
        const res = final.result as { slide?: Slide; ok?: boolean } | Slide | undefined;
        const updated = (res as { slide?: Slide })?.slide ?? (res as Slide | undefined);
        // Mark generated so the workshop canvas renders the image instead of the shell.
        if (updated?.id) replaceDraftSlide({ ...updated, generated: true });
      } catch {
        /* keep existing image */
      }
    },
    [replaceDraftSlide],
  );

  const runDeckCommand = useCallback(
    async (value: string, selectedSlideId?: string, images?: DeckCommandImage[]) => {
      // The conversation BEFORE this instruction — sent so the agent can resolve follow-ups
      // (a bare "9th" answering its own "which slide?") instead of re-guessing from scratch.
      const priorHistory = history.current
        .slice(-8)
        .map((t) => ({ role: t.role, text: t.text ?? "" }));
      setMessages((m) => [...m, { id: nextId(), role: "user", text: value }]);
      // Track deck-editing turns in the persistent history too, so conversations
      // started from the Slides tab survive reloads and stay in the agent's context.
      history.current = [...history.current, { role: "user", text: value }];
      setThinking(true);
      try {
        const slim = draftSlides.map((s) => ({
          id: s.id,
          slideNumber: s.slideNumber,
          slideType: s.slideType,
          title: s.title,
          content: s.content,
        }));
        const res = await deckCommand(projectId, value, slim, priorHistory, selectedSlideId, images);
        // Chat undo: an undo_last with nothing on the stack must not narrate a restore that
        // can't happen — drop it and answer honestly.
        let actions = res.actions;
        if (actions.some((a) => a.op === "undo_last") && agentUndoStack.current.length === 0) {
          actions = actions.filter((a) => a.op !== "undo_last");
          if (actions.length === 0) {
            const text = "There's nothing to undo yet — I haven't changed the deck in this session.";
            setMessages((m) => [...m, { id: nextId(), role: "assistant", text }]);
            history.current = [...history.current, { role: "assistant", text }];
            return;
          }
        }
        // Snapshot the deck BEFORE a mutating batch so "undo" can restore it exactly.
        if (actions.some((a) => a.op !== "undo_last")) {
          agentUndoStack.current.push({
            slides: structuredClone(draftSlides),
            design: designDirection ? structuredClone(designDirection) : null,
          });
          if (agentUndoStack.current.length > 10) agentUndoStack.current.shift();
        }
        const handlers: DeckActionHandlers = {
          slides: draftSlides,
          onUpdateSlide: updateDraftSlide,
          onMoveSlide: moveDraftSlide,
          onInsertAfter: insertDraftSlideAfter,
          onDeleteSlide: deleteDraftSlide,
          onRegenerateSlide: regenerateDraftSlide,
          onGenerateImage: generateSlideImage,
          onSetAppearance: (id, patch) => updateDraftSlideMeta(id, { appearance: patch }),
          onSetAccent: applyAccent,
          onSetTheme: applyThemePalette,
          onSetFont: applyDisplayFont,
          onUndoLast: () => {
            const snap = agentUndoStack.current.pop();
            if (snap) restoreDeckSnapshot(snap.slides, snap.design);
          },
        };
        // Narrate the work as live tool steps (the way Claude/ChatGPT show their tool use):
        // each action appears in the chat, ticks over while running, and ✓s when done.
        if (actions.length > 0) {
          const labels = actions.map((a) => describeDeckAction(a, draftSlides));
          const toolId = nextId();
          const renderDetail = (upTo: number, runningIdx: number | null) =>
            labels.map((l, j) =>
              j < upTo ? `✓ ${l}` : j === runningIdx ? `⏳ ${l}…` : `• ${l}`,
            );
          setMessages((m) => [
            ...m,
            {
              id: toolId,
              role: "tool",
              label: `Editing the deck — ${labels.length} ${labels.length === 1 ? "step" : "steps"}`,
              detail: renderDetail(0, 0),
            },
          ]);
          const patchTool = (patch: { label?: string; detail: string[] }) =>
            setMessages((m) =>
              m.map((msg) => (msg.id === toolId && msg.role === "tool" ? { ...msg, ...patch } : msg)),
            );
          await applyDeckActions(actions, handlers, (i, phase) =>
            patchTool({ detail: phase === "start" ? renderDetail(i, i) : renderDetail(i + 1, null) }),
          );
          patchTool({
            label: `Edited the deck — ${labels.length} ${labels.length === 1 ? "change" : "changes"} applied`,
            detail: labels.map((l) => `✓ ${l}`),
          });
        }
        // Report honestly: only echo the agent's confirmation when its changes actually
        // applied; otherwise say so instead of relaying a fabricated "Done".
        const text = honestDeckCommandText(res);
        setMessages((m) => [...m, { id: nextId(), role: "assistant", text }]);
        history.current = [...history.current, { role: "assistant", text }];
      } catch (err) {
        setMessages((m) => [
          ...m,
          { id: nextId(), role: "assistant", text: deckCommandErrorText(err) },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [
      projectId, draftSlides, designDirection, updateDraftSlide, updateDraftSlideMeta,
      moveDraftSlide, insertDraftSlideAfter, deleteDraftSlide, regenerateDraftSlide,
      generateSlideImage, applyAccent, applyThemePalette, applyDisplayFont, restoreDeckSnapshot,
    ],
  );

  const submitAnswer = useCallback(
    (text: string, selectedSlideId?: string) => {
      const value = text.trim();
      if (!value || thinking) return;
      // Once the deck exists, the chat edits the deck instead of running intake. Any image the
      // director staged (pasted/dropped) rides along on this turn as visual direction.
      if (draftSlides.length > 0) {
        const imgs = pendingImages.current.length ? [...pendingImages.current] : undefined;
        pendingImages.current = [];
        void runDeckCommand(value, selectedSlideId, imgs);
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
    async (file: File, selectedSlideId?: string, stage = false) => {
      if (thinking) return;
      const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|avif)$/i.test(file.name);
      const isDeck = /\.pptx$/i.test(file.name) || file.type.includes("presentationml");
      const isDoc = !isDeck
        && (/\.(pdf|docx|fdx|txt|md|rtf)$/i.test(file.name) || /pdf|word|officedocument|text/.test(file.type));

      // Reference DECK (.pptx) → parsed + persisted on the project; generation mirrors its
      // slide structure and visual style. (Must be checked before isDoc — pptx MIME also
      // matches "officedocument", which would wrongly send it to the script parser.)
      if (isDeck) {
        setMessages((m) => [...m, { id: nextId(), role: "attachment", name: file.name, note: "Reference deck" }]);
        const toolId = nextId();
        setMessages((m) => [...m, { id: toolId, role: "tool", label: `Reading ${file.name}`, detail: ["parsing slides, fonts, colours…"] }]);
        try {
          const ref = await uploadReferenceDeck(projectId, file);
          setMessages((m) =>
            m.map((msg) =>
              msg.id === toolId && msg.role === "tool"
                ? {
                    ...msg,
                    label: `Reference deck loaded — ${ref.slideCount} slides`,
                    detail: [
                      `structure: ${ref.slides.slice(0, 6).map((s) => s.title || "untitled").join(" → ")}${ref.slides.length > 6 ? " → …" : ""}`,
                      ...(ref.colors.length ? [`palette: ${ref.colors.slice(0, 5).join(", ")}`] : []),
                      ...(ref.fonts.length ? [`fonts: ${ref.fonts.slice(0, 3).join(", ")}`] : []),
                    ],
                  }
                : msg,
            ),
          );
          setMessages((m) => [
            ...m,
            {
              id: nextId(),
              role: "assistant",
              text: `Got your reference deck — I'll follow its ${ref.slideCount}-slide structure and take visual cues from it when we build.`,
            },
          ]);
          history.current = [
            ...history.current,
            { role: "user", text: `(uploaded a reference deck: ${file.name}, ${ref.slideCount} slides)` },
          ];
        } catch {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === toolId && msg.role === "tool"
                ? { ...msg, label: `Couldn't read ${file.name}`, detail: ["make sure it's a valid .pptx"] }
                : msg,
            ),
          );
        }
        return;
      }

      // Images / inspiration boards / references → the agent SEES them: encode, then either
      // fold into the intake brief (pre-build) or hand to the deck agent to adapt the look (post-build).
      if (isImage) {
        try {
          const [encoded, thumb] = await Promise.all([encodeReferenceImage(file), makeThumb(file)]);
          // Small self-contained data-URI thumbnail — shows the ACTUAL image and persists across
          // reloads (a blob URL would break; the full base64 would blow the storage quota).
          setMessages((m) => [
            ...m,
            {
              id: nextId(),
              role: "attachment",
              name: file.name,
              previewUrl: thumb || undefined,
              note: "Reference image",
            },
          ]);
          // Queue the image for the next turn (pre-build → the producer folds it into the brief;
          // post-build → it's visual direction for the deck).
          pendingImages.current = [...pendingImages.current, encoded].slice(-4);
          if (draftSlides.length === 0) {
            const cur = (formRef.current.visualReferences || "").trim();
            updateForm({ visualReferences: cur ? `${cur}, ${file.name}` : file.name });
          }
          // STAGE mode (paste / drop): hold the image and WAIT — the director types a prompt and
          // hits Send; the staged image rides along on that turn. Don't fire the agent now.
          // Applies whether or not the deck exists.
          if (stage) return;
          if (draftSlides.length > 0) {
            const imgs = pendingImages.current.length ? [...pendingImages.current] : [encoded];
            pendingImages.current = [];
            await runDeckCommand(
              `Use this reference image as visual direction${selectedSlideId ? " for the slide I have open" : " for the deck"}.`,
              selectedSlideId,
              imgs,
            );
            return;
          }
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
    [thinking, projectId, updateForm, advance, pillarsNow, draftSlides, runDeckCommand],
  );

  // ── Visual-direction reference library ──────────────────────────────────
  // Collect up to MAX_REFERENCES inspiration images. They feed the producer the same way a
  // single chat-dropped image does (encoded → pendingImages → the agent analyses them and folds
  // the look into the brief), but they also live in a persistent gallery the director can browse.
  const addReferenceImages = useCallback(
    async (files: File[]) => {
      const images = files.filter(
        (f) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|avif)$/i.test(f.name),
      );
      if (!images.length) return;
      const room = MAX_REFERENCES - referenceImagesRef.current.length;
      if (room <= 0) return;
      const accepted = images.slice(0, room);

      // Show the thumbnails immediately (object URLs revoked on remove / unmount).
      const entries: ReferenceImage[] = accepted.map((file) => ({
        id: nextId(),
        name: file.name,
        previewUrl: URL.createObjectURL(file),
      }));
      setReferenceImages((prev) => [...prev, ...entries].slice(0, MAX_REFERENCES));

      // Keep the reference set as text on the brief so it survives reloads even though the
      // thumbnails themselves don't.
      const names = accepted.map((f) => f.name);
      const cur = (formRef.current.visualReferences || "").trim();
      updateForm({ visualReferences: [cur, ...names].filter(Boolean).join(", ") });

      // Encode and hand to the producer so it analyses the references for inspiration.
      try {
        const encoded = await Promise.all(accepted.map(encodeReferenceImage));
        pendingImages.current = [...pendingImages.current, ...encoded].slice(-MAX_REFERENCES);
        // Only run a turn now if the agent is idle; otherwise the images ride along on the
        // next turn (they stay queued in pendingImages until delivered).
        if (!thinkingRef.current) {
          const baseHistory = [
            ...history.current,
            {
              role: "user" as const,
              text: `(shared ${accepted.length} reference image${
                accepted.length > 1 ? "s" : ""
              } for visual inspiration: ${names.join(", ")})`,
            },
          ];
          history.current = baseHistory;
          await advance(baseHistory, pillarsNow());
        }
      } catch {
        /* the gallery still shows the references even if encoding/analysis fails */
      }
    },
    [updateForm, advance, pillarsNow],
  );

  const removeReferenceImage = useCallback((id: string) => {
    setReferenceImages((prev) => {
      const hit = prev.find((r) => r.id === id);
      if (hit) URL.revokeObjectURL(hit.previewUrl);
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  // Release any object URLs still held when the studio unmounts.
  useEffect(
    () => () => {
      referenceImagesRef.current.forEach((r) => URL.revokeObjectURL(r.previewUrl));
    },
    [],
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
    // Workshop flow: architect the outline as empty slide shells; the director then
    // generates, refines, and approves each slide individually in the Slides tab.
    void prepareDraftSlides();
    setBuilding(false);
  }, [building, projectId, updateForm, completeStep, approveContent, prepareDraftSlides]);

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
    referenceImages,
    addReferenceImages,
    removeReferenceImage,
    editAssumption,
    editField,
    build,
    nextRound,
  };
}
