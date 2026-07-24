"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  applyDeckDesign,
  createSlide as apiCreateSlide,
  deleteSlide as apiDeleteSlide,
  generateDeck,
  getDeck,
  getProject,
  pollJob,
  prepareDeck,
  regenerateSlide as apiRegenerateSlide,
  reorderSlides as apiReorderSlides,
  saveIntake,
  updateSlide,
  type SlideMetaInput,
} from "@/lib/api";
import { buildSlideFromOutline, renumberSlides } from "@/lib/build-slides";
import { DEFAULT_SLIDE_APPEARANCE } from "@/lib/slide-appearance";
import { ADDABLE_SLIDE_TYPES } from "@/lib/regenerate-slide";
import { FALLBACK_DESIGN, withAccent } from "@/lib/deck-themes";
import type { ColorToken, DesignDirection } from "@/types/design";
import type { ProjectStatus } from "@/types/project";
import type { Slide, SlideAppearance, SlideComment, SlideContent, SlideType } from "@/types/slide";
import {
  EMPTY_INTAKE_FORM,
  type ExtractedScriptSummary,
  type GenerationStatus,
  type SetupStepId,
  type SetupWizardState,
} from "@/types/setup";
import type { IntakeFormData } from "@/types/workflow";

const STORAGE_PREFIX = "pitch-deck-setup-";

// Lifecycle stages at which a generated deck exists. Earlier stages
// (intake/questions/story_analysis/outline) have no deck yet, so requesting one
// returns an expected 404 — we skip the fetch entirely to avoid the noise.
const DECK_BEARING_STATUSES: ReadonlySet<ProjectStatus> = new Set<ProjectStatus>([
  "content",
  "design",
  "editor",
  "review",
  "export",
  "completed",
]);

const DEFAULT_STATE: SetupWizardState = {
  formData: EMPTY_INTAKE_FORM,
  completedSteps: [],
  selectedTemplateId: null,
  scriptUploaded: false,
  extractedSummary: null,
  draftSlides: [],
  contentApproved: false,
  generationStatus: "idle",
};

const isBackendSlide = (id: string) => !id.startsWith("local-");

/** Sync state of editor changes against the backend. */
export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SetupWizardContextValue extends SetupWizardState {
  projectId: string;
  designDirection: DesignDirection | null;
  generationProgress: number;
  generationError: string | null;
  saveStatus: SaveStatus;
  updateForm: (patch: Partial<IntakeFormData>) => void;
  completeStep: (step: SetupStepId) => void;
  isStepComplete: (step: SetupStepId) => boolean;
  setSelectedTemplate: (templateId: string) => void;
  setExtractedSummary: (summary: ExtractedScriptSummary | null) => void;
  setScriptUploaded: (value: boolean) => void;
  initDraftSlides: () => void;
  prepareDraftSlides: () => Promise<void>;
  replaceDraftSlide: (slide: Slide) => void;
  updateDraftSlide: (id: string, patch: Partial<SlideContent> & { title?: string }) => void;
  /** Undo the last slide-editing change (Ctrl+Z). */
  undo: () => void;
  canUndo: boolean;
  /** Re-apply the last undone change (Ctrl+Shift+Z). */
  redo: () => void;
  canRedo: boolean;
  /** Restore the whole deck (slides + optionally design) to a snapshot, PERSISTING the
   *  restore: content diffs are saved, agent-added slides deleted, agent-deleted slides
   *  re-created, order re-synced. Used by the chat agent's undo. */
  restoreDeckSnapshot: (slides: Slide[], design?: DesignDirection | null) => void;
  updateDraftSlideMeta: (
    id: string,
    patch: Partial<Pick<Slide, "speakerNotes" | "comments" | "transition" | "title">> & {
      appearance?: Partial<SlideAppearance>;
    },
  ) => void;
  addSlideComment: (id: string, text: string) => void;
  deleteDraftSlide: (id: string) => boolean;
  /** Slides the user removed — a recycle bin, newest first. */
  removedSlides: Slide[];
  /** Restore a removed slide from the recycle bin back into the deck. */
  restoreSlide: (id: string) => void;
  insertDraftSlideAfter: (
    index: number,
    slideType: SlideType,
    init?: { title?: string; contentBrief?: string; pointCount?: number; generate?: boolean },
  ) => void | Promise<void>;
  duplicateDraftSlide: (index: number) => void;
  moveDraftSlide: (index: number, direction: "up" | "down") => void;
  /** Move a slide from one position to another (filmstrip drag-and-drop). */
  reorderDraftSlide: (from: number, to: number) => void;
  regenerateDraftSlide: (id: string, instruction?: string, referenceImage?: { mediaType: string; data: string }) => Promise<void>;
  regenerateAllDraftSlides: (opts?: { keepLook?: boolean }) => Promise<void>;
  /** Archived previous decks (newest first) — captured before every (re)build. */
  deckHistory: Slide[][];
  /** Deck-wide design changes that render instantly (the canvas reads designDirection). */
  applyAccent: (hex: string) => void;
  applyThemePalette: (palette: ColorToken[]) => void;
  applyDisplayFont: (font: string) => void;
  /** Choose a full visual-system candidate (preview now, apply deck-wide at/after build). */
  chooseDesign: (design: DesignDirection) => void;
  setGenerationStatus: (status: GenerationStatus) => void;
  approveContent: () => void;
  getEditorSlides: () => Slide[];
}

const SetupWizardContext = createContext<SetupWizardContextValue | null>(null);

function loadState(projectId: string): SetupWizardState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(`${STORAGE_PREFIX}${projectId}`) ??
      sessionStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SetupWizardState;
    return { ...DEFAULT_STATE, ...parsed, formData: { ...EMPTY_INTAKE_FORM, ...parsed.formData } };
  } catch {
    return null;
  }
}

function saveState(projectId: string, state: SetupWizardState) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${projectId}`, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export function SetupWizardProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  // Seed synchronously from storage (lazy initializer) so we never setState in an effect just
  // to hydrate — SSR-safe because loadState returns null when there's no window.
  const [state, setState] = useState<SetupWizardState>(() => loadState(projectId) ?? DEFAULT_STATE);
  const [designDirection, setDesignDirection] = useState<DesignDirection | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [hydrated, setHydrated] = useState(false);

  const stateRef = useRef<SetupWizardState>(state);
  const generatingRef = useRef(false);
  // A visual-system candidate the director picked before building — applied to the deck once
  // it's prepared so generation + rendering use it.
  const selectedDesignRef = useRef<DesignDirection | null>(null);
  // Mirror of designDirection for callbacks that must both update AND persist the design.
  const designDirectionRef = useRef<DesignDirection | null>(null);
  useEffect(() => {
    designDirectionRef.current = designDirection;
  }, [designDirection]);
  // Mirror the latest state into a ref for callbacks/async work — in an effect, not during
  // render (refs must not be written while rendering).
  useEffect(() => {
    stateRef.current = state;
  });

  // ── Undo stack (Ctrl+Z) — snapshots of draftSlides taken BEFORE each slide-editing mutation. ──
  const undoStackRef = useRef<Slide[][]>([]);
  const redoStackRef = useRef<Slide[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const pushUndo = useCallback(() => {
    const cur = stateRef.current.draftSlides;
    const stack = undoStackRef.current;
    // A fresh edit invalidates anything that was undone before it.
    redoStackRef.current = [];
    setCanRedo(false);
    if (stack[stack.length - 1] === cur) return; // this exact state is already on top
    stack.push(cur);
    if (stack.length > 80) stack.shift();
    setCanUndo(true);
  }, []);
  const undo = useCallback(() => {
    const prev = undoStackRef.current.pop();
    setCanUndo(undoStackRef.current.length > 0);
    if (prev) {
      redoStackRef.current.push(stateRef.current.draftSlides);
      setCanRedo(true);
      setState((s) => ({ ...s, draftSlides: prev }));
    }
  }, []);
  const redo = useCallback(() => {
    const next = redoStackRef.current.pop();
    setCanRedo(redoStackRef.current.length > 0);
    if (next) {
      undoStackRef.current.push(stateRef.current.draftSlides);
      setCanUndo(true);
      setState((s) => ({ ...s, draftSlides: next }));
    }
  }, []);

  // ── Save tracking: every backend write goes through trackSave so the UI can
  // show saving / saved / error instead of silently losing edits. ──
  const pendingSavesRef = useRef(0);
  const trackSave = useCallback((p: Promise<unknown>) => {
    pendingSavesRef.current += 1;
    setSaveStatus("saving");
    p.then(() => {
      pendingSavesRef.current -= 1;
      if (pendingSavesRef.current <= 0) setSaveStatus("saved");
    }).catch(() => {
      pendingSavesRef.current -= 1;
      setSaveStatus("error");
    });
  }, []);

  // Debounced per-slide meta saves (notes typing etc. → one PATCH, not one per keystroke).
  const metaTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const metaQueueRef = useRef(new Map<string, SlideMetaInput & { title?: string }>());
  const queueMetaSave = useCallback(
    (id: string, patch: SlideMetaInput & { title?: string }) => {
      if (!isBackendSlide(id)) return;
      metaQueueRef.current.set(id, { ...(metaQueueRef.current.get(id) ?? {}), ...patch });
      const existing = metaTimersRef.current.get(id);
      if (existing) clearTimeout(existing);
      metaTimersRef.current.set(
        id,
        setTimeout(() => {
          metaTimersRef.current.delete(id);
          const queued = metaQueueRef.current.get(id);
          metaQueueRef.current.delete(id);
          if (!queued) return;
          const { title, ...meta } = queued;
          trackSave(
            updateSlide(id, {
              ...(title !== undefined ? { title } : {}),
              ...(Object.keys(meta).length > 0 ? { meta } : {}),
            }),
          );
        }, 600),
      );
    },
    [trackSave],
  );

  // Debounced slide-order sync: rapid up/down moves collapse into one reorder call.
  const reorderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueReorder = useCallback(() => {
    if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current);
    reorderTimerRef.current = setTimeout(() => {
      reorderTimerRef.current = null;
      const ids = stateRef.current.draftSlides.map((s) => s.id).filter(isBackendSlide);
      if (ids.length > 0) trackSave(apiReorderSlides(projectId, ids));
    }, 800);
  }, [projectId, trackSave]);

  useEffect(() => {
    const metaTimers = metaTimersRef.current;
    return () => {
      metaTimers.forEach((t) => clearTimeout(t));
      if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current);
    };
  }, []);

  // Hydrate: sessionStorage (transient wizard state) + backend (intake + deck).
  // The backend deck is the source of truth for slides now that edits persist.
  useEffect(() => {
    let cancelled = false;
    // State is already seeded from storage via the lazy initializer; we only re-read here to
    // decide whether the backend intake should override it.
    const saved = loadState(projectId);
    (async () => {
      let deckMayExist = false;
      try {
        const project = await getProject(projectId);
        deckMayExist = DECK_BEARING_STATUSES.has(project.status);
        if (!cancelled && project.intakeForm && (!saved || !saved.formData.title)) {
          setState((prev) => ({
            ...prev,
            formData: { ...EMPTY_INTAKE_FORM, ...project.intakeForm },
          }));
        }
      } catch {
        /* unknown project */
      }
      // Only fetch the deck once generation has produced one. Fetching earlier
      // would hit the backend's expected "No deck generated yet" 404.
      if (deckMayExist) {
        try {
          const deck = await getDeck(projectId);
          if (!cancelled && deck) {
            setDesignDirection(deck.designDirection ?? null);
            if (deck.slides?.length) {
              setState((prev) => ({
                ...prev,
                draftSlides: deck.slides,
                generationStatus: "ready",
                // A persisted deck means content exists — keep the editor
                // reachable from any browser, not just the one that built it.
                contentApproved: true,
              }));
            }
          }
        } catch {
          /* no deck yet */
        }
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Persist the working state to sessionStorage after hydration.
  useEffect(() => {
    if (hydrated) saveState(projectId, state);
  }, [projectId, state, hydrated]);

  const updateForm = useCallback((patch: Partial<IntakeFormData>) => {
    setState((prev) => ({ ...prev, formData: { ...prev.formData, ...patch } }));
  }, []);

  const completeStep = useCallback(
    (step: SetupStepId) => {
      setState((prev) =>
        prev.completedSteps.includes(step)
          ? prev
          : { ...prev, completedSteps: [...prev.completedSteps, step] },
      );
      // Persist intake to the backend at each gate.
      void saveIntake(projectId, stateRef.current.formData).catch(() => {});
    },
    [projectId],
  );

  const isStepComplete = useCallback(
    (step: SetupStepId) => state.completedSteps.includes(step),
    [state.completedSteps],
  );

  const setSelectedTemplate = useCallback((templateId: string) => {
    setState((prev) => ({ ...prev, selectedTemplateId: templateId }));
  }, []);

  const setExtractedSummary = useCallback((summary: ExtractedScriptSummary | null) => {
    setState((prev) => ({ ...prev, extractedSummary: summary }));
  }, []);

  const setScriptUploaded = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, scriptUploaded: value }));
  }, []);

  // ── Deck history — every time a generation REPLACES the deck (Build, Rebuild, or a style-change
  // rebuild), the outgoing deck is archived here first so it's never lost, whatever the trigger.
  // Newest first; kept in-memory for the session (full decks are too big for localStorage).
  const [deckHistory, setDeckHistory] = useState<Slide[][]>([]);
  // Recycle bin for removed slides (newest first), mirrored into a ref for callbacks.
  const [removedSlides, setRemovedSlides] = useState<Slide[]>([]);
  const removedRef = useRef<Slide[]>([]);
  useEffect(() => {
    removedRef.current = removedSlides;
  }, [removedSlides]);
  const pushDeckHistory = useCallback(() => {
    const current = stateRef.current.draftSlides.filter((s) => s.generated);
    if (current.length) setDeckHistory((h) => [current, ...h].slice(0, 10));
  }, []);

  /** Backend generation: design + content + images, then load the deck.
   *  `keepLook`: same-look rebuild — the backend reuses the current design system and
   *  regenerates only copy, pacing and art. */
  const runGeneration = useCallback(async (opts?: { keepLook?: boolean }) => {
    if (generatingRef.current) return;
    pushDeckHistory(); // archive the current deck before it's overwritten
    generatingRef.current = true;
    setGenerationError(null);
    setGenerationProgress(0);
    setState((prev) => ({ ...prev, generationStatus: "generating" }));
    try {
      const job = await generateDeck(
        projectId,
        stateRef.current.selectedTemplateId ?? undefined,
        true,
        opts?.keepLook ?? false,
      );
      const final = await pollJob(job, { onProgress: (j) => setGenerationProgress(j.progress) });
      if (final.status === "failed") throw new Error(final.error ?? "Generation failed");
      const deck = await getDeck(projectId);
      setDesignDirection(deck.designDirection ?? null);
      setState((prev) => ({
        ...prev,
        draftSlides: deck.slides ?? [],
        generationStatus: "ready",
      }));
    } catch (err) {
      setGenerationError((err as Error).message);
      setState((prev) => ({ ...prev, generationStatus: "idle" }));
    } finally {
      generatingRef.current = false;
    }
  }, [projectId, pushDeckHistory]);

  const initDraftSlides = useCallback(() => {
    if (stateRef.current.draftSlides.length > 0 || generatingRef.current) return;
    void runGeneration();
  }, [runGeneration]);

  /** Workshop step 1: analysis + design + outline → empty slide shells (no batch generation). */
  const prepareDraftSlides = useCallback(async () => {
    if (generatingRef.current) return;
    pushDeckHistory(); // archive the current deck before this (re)build wipes it
    generatingRef.current = true;
    setGenerationError(null);
    setGenerationProgress(0);
    setState((prev) => ({ ...prev, draftSlides: [], generationStatus: "generating" }));
    try {
      const job = await prepareDeck(projectId, stateRef.current.selectedTemplateId ?? undefined);
      const final = await pollJob(job, { onProgress: (j) => setGenerationProgress(j.progress) });
      if (final.status === "failed") throw new Error(final.error ?? "Preparation failed");
      const deck = await getDeck(projectId);
      // If the director chose a visual system before building, apply it deck-wide so every
      // slide (and its generation) uses that look instead of the auto-selected register.
      const chosen = selectedDesignRef.current;
      if (chosen) {
        await applyDeckDesign(projectId, chosen).catch(() => {});
      }
      setDesignDirection(chosen ?? deck.designDirection ?? null);
      setState((prev) => ({
        ...prev,
        draftSlides: deck.slides ?? [],
        generationStatus: "ready",
      }));
    } catch (err) {
      setGenerationError((err as Error).message);
      setState((prev) => ({ ...prev, generationStatus: "idle" }));
    } finally {
      generatingRef.current = false;
    }
  }, [projectId, pushDeckHistory]);

  /** Workshop: adopt a freshly (re)generated slide from the backend (local merge only). */
  const replaceDraftSlide = useCallback((slide: Slide) => {
    pushUndo();
    setState((prev) => ({
      ...prev,
      draftSlides: prev.draftSlides.map((s) => (s.id === slide.id ? { ...s, ...slide } : s)),
    }));
  }, [pushUndo]);

  const regenerateAllDraftSlides = useCallback(async (opts?: { keepLook?: boolean }) => {
    pushDeckHistory(); // archive before clearing (runGeneration would see an empty deck otherwise)
    setState((prev) => ({ ...prev, draftSlides: [] }));
    await runGeneration(opts);
  }, [runGeneration, pushDeckHistory]);

  const updateDraftSlide = useCallback(
    (id: string, patch: Partial<SlideContent> & { title?: string }) => {
      // Don't snapshot the internal version-history write itself (avoids a useless undo step).
      if (!("versions" in patch)) pushUndo();
      const { title, ...contentPatch } = patch;
      setState((prev) => ({
        ...prev,
        draftSlides: prev.draftSlides.map((s) =>
          s.id === id
            ? { ...s, title: title ?? s.title, content: { ...s.content, ...contentPatch } }
            : s,
        ),
      }));
      if (isBackendSlide(id)) {
        trackSave(
          updateSlide(id, {
            ...(title !== undefined ? { title } : {}),
            content: contentPatch as SlideContent,
          }),
        );
      }
    },
    [trackSave, pushUndo],
  );

  const updateDraftSlideMeta = useCallback(
    (
      id: string,
      patch: Partial<Pick<Slide, "speakerNotes" | "comments" | "transition" | "title">> & {
        appearance?: Partial<SlideAppearance>;
      },
    ) => {
      // Compute the merged appearance up front so we persist the full object,
      // not just the partial patch (the backend stores appearance atomically).
      const current = stateRef.current.draftSlides.find((s) => s.id === id);
      const nextAppearance = patch.appearance
        ? { ...(current?.appearance ?? DEFAULT_SLIDE_APPEARANCE), ...patch.appearance }
        : undefined;
      setState((prev) => ({
        ...prev,
        draftSlides: prev.draftSlides.map((s) =>
          s.id === id
            ? {
                ...s,
                ...patch,
                appearance: patch.appearance
                  ? { ...(s.appearance ?? DEFAULT_SLIDE_APPEARANCE), ...patch.appearance }
                  : s.appearance,
              }
            : s,
        ),
      }));
      // Persist everything the editor can change (debounced per slide).
      const metaPatch: SlideMetaInput & { title?: string } = {};
      if (patch.title !== undefined) metaPatch.title = patch.title;
      if (patch.speakerNotes !== undefined) metaPatch.speakerNotes = patch.speakerNotes;
      if (patch.transition !== undefined) metaPatch.transition = patch.transition;
      if (patch.comments !== undefined) metaPatch.comments = patch.comments;
      if (nextAppearance) metaPatch.appearance = nextAppearance;
      if (Object.keys(metaPatch).length > 0) queueMetaSave(id, metaPatch);
    },
    [queueMetaSave],
  );

  const addSlideComment = useCallback(
    (id: string, text: string) => {
      const comment: SlideComment = {
        id: `comment-${Date.now()}`,
        author: "You",
        text,
        createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      const current = stateRef.current.draftSlides.find((s) => s.id === id);
      const nextComments = [...(current?.comments ?? []), comment];
      setState((prev) => ({
        ...prev,
        draftSlides: prev.draftSlides.map((s) =>
          s.id === id ? { ...s, comments: [...(s.comments ?? []), comment] } : s,
        ),
      }));
      queueMetaSave(id, { comments: nextComments });
    },
    [queueMetaSave],
  );

  const deleteDraftSlide = useCallback(
    (id: string): boolean => {
      const slide = stateRef.current.draftSlides.find((s) => s.id === id);
      let deleted = false;
      setState((prev) => {
        if (prev.draftSlides.length <= 1) return prev;
        deleted = true;
        return {
          ...prev,
          draftSlides: renumberSlides(prev.draftSlides.filter((s) => s.id !== id)),
        };
      });
      if (deleted) {
        // Archive to the recycle bin so the user can restore it, then remove from the backend.
        if (slide) setRemovedSlides((r) => [slide, ...r].slice(0, 30));
        if (isBackendSlide(id)) trackSave(apiDeleteSlide(id));
      }
      return deleted;
    },
    [trackSave],
  );

  const restoreSlide = useCallback((id: string) => {
    const slide = removedRef.current.find((s) => s.id === id);
    if (!slide) return;
    // Re-insert as a fresh client-side slide (like duplicate) at the end of the deck.
    const clone: Slide = structuredClone(slide);
    clone.id = `local-restored-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    clone.comments = [];
    setState((st) => ({ ...st, draftSlides: renumberSlides([...st.draftSlides, clone]) }));
    setRemovedSlides((r) => r.filter((s) => s.id !== id));
  }, []);

  const regenerateDraftSlide = useCallback(async (
    id: string,
    instruction?: string,
    referenceImage?: { mediaType: string; data: string },
  ) => {
    if (!isBackendSlide(id)) return;
    try {
      // A chat instruction ("add guns and roses, realistic") drives both the writer and the
      // image prompt; a referenceImage triggers true image-to-image style transfer.
      const job = await apiRegenerateSlide(
        id,
        instruction || referenceImage
          ? {
              withImage: true,
              ...(instruction ? { instructions: instruction, imageInstruction: instruction } : {}),
              ...(referenceImage ? { referenceImage } : {}),
            }
          : undefined,
      );
      const final = await pollJob(job);
      const updated = final.result as Slide | undefined;
      if (updated?.id) {
        // merge: keep client-only fields (appearance/comments/notes/transition)
        setState((prev) => ({
          ...prev,
          draftSlides: prev.draftSlides.map((s) => (s.id === id ? { ...s, ...updated } : s)),
        }));
      }
    } catch {
      /* keep existing slide */
    }
  }, []);

  const insertDraftSlideAfter = useCallback(
    (
      index: number,
      slideType: SlideType,
      init?: { title?: string; contentBrief?: string; pointCount?: number; generate?: boolean },
    ): void | Promise<void> => {
      const meta =
        ADDABLE_SLIDE_TYPES.find((t) => t.slideType === slideType) ??
        ADDABLE_SLIDE_TYPES[ADDABLE_SLIDE_TYPES.length - 1];
      const newSlide = buildSlideFromOutline(meta, stateRef.current.formData, index + 2);
      // The director's request rides on the slide itself: their title, and their contentBrief
      // as the slide's PURPOSE — the content agent composes this slide's copy from it.
      if (init?.title?.trim()) newSlide.title = init.title.trim();
      if (init?.contentBrief?.trim()) {
        newSlide.purpose = [
          init.contentBrief.trim(),
          init.pointCount ? `Present it as exactly ${init.pointCount} points.` : "",
        ].filter(Boolean).join(" ");
      }
      // optimistic local id; swapped for the backend id once the create lands
      const localId = `local-${newSlide.id}`;
      newSlide.id = localId;
      setState((prev) => {
        const next = [...prev.draftSlides];
        next.splice(index + 1, 0, newSlide);
        return { ...prev, draftSlides: renumberSlides(next) };
      });
      // Persist: create the slide on the backend, then adopt its real id so
      // subsequent edits to it also persist.
      const created = apiCreateSlide(projectId, {
        slideType,
        slideNumber: index + 2,
        title: newSlide.title,
        purpose: newSlide.purpose,
        content: newSlide.content,
        layout: newSlide.layout,
      }).then((saved) => {
        setState((prev) => ({
          ...prev,
          draftSlides: prev.draftSlides.map((s) =>
            s.id === localId ? { ...s, id: saved.id } : s,
          ),
        }));
        // Make sure the server's order matches what the editor shows.
        queueReorder();
        return saved.id;
      });
      trackSave(created);
      // Agent-added slides with a content brief generate immediately — the director asked
      // for a slide ABOUT something, so deliver a written slide, not an empty shell.
      if (init?.generate) {
        return created
          .then(async (realId) => {
            await regenerateDraftSlide(realId);
            setState((prev) => ({
              ...prev,
              draftSlides: prev.draftSlides.map((s) =>
                s.id === realId ? { ...s, generated: true } : s,
              ),
            }));
          })
          .catch(() => {
            /* the shell still exists; the director can hit Generate */
          });
      }
    },
    [projectId, trackSave, queueReorder, regenerateDraftSlide],
  );

  const duplicateDraftSlide = useCallback((index: number) => {
    setState((prev) => {
      const src = prev.draftSlides[index];
      if (!src) return prev;
      // Deep clone so the copy carries the image, text edits, and free text boxes,
      // while staying fully independent. Client-only id (not persisted to the backend).
      const clone: Slide = structuredClone(src);
      clone.id = `local-dup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      clone.comments = [];
      const next = [...prev.draftSlides];
      next.splice(index + 1, 0, clone);
      return { ...prev, draftSlides: renumberSlides(next) };
    });
  }, []);

  const moveDraftSlide = useCallback(
    (index: number, direction: "up" | "down") => {
      setState((prev) => {
        const target = direction === "up" ? index - 1 : index + 1;
        if (target < 0 || target >= prev.draftSlides.length) return prev;
        const next = [...prev.draftSlides];
        const [item] = next.splice(index, 1);
        next.splice(target, 0, item);
        return { ...prev, draftSlides: renumberSlides(next) };
      });
      queueReorder();
    },
    [queueReorder],
  );

  const reorderDraftSlide = useCallback(
    (from: number, to: number) => {
      setState((prev) => {
        const len = prev.draftSlides.length;
        if (from === to || from < 0 || from >= len || to < 0 || to >= len) return prev;
        const next = [...prev.draftSlides];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return { ...prev, draftSlides: renumberSlides(next) };
      });
      queueReorder();
    },
    [queueReorder],
  );

  // Restore the deck to a snapshot (the chat agent's undo) — unlike the local Ctrl+Z stack,
  // this PERSISTS the restore so the backend matches what the user sees again.
  const restoreDeckSnapshot = useCallback(
    (snapshot: Slide[], design?: DesignDirection | null) => {
      const current = stateRef.current.draftSlides;
      const curById = new Map(current.map((s) => [s.id, s]));
      const snapIds = new Set(snapshot.map((s) => s.id));

      // 1. Slides created since the snapshot → drop their backend rows.
      for (const s of current) {
        if (!snapIds.has(s.id) && isBackendSlide(s.id)) trackSave(apiDeleteSlide(s.id));
      }

      // 2. Rebuild the deck from the snapshot. Backend slides whose rows were deleted since
      //    get a fresh local id now and a re-created row below (their old id is dead).
      const recreates: { localId: string; slide: Slide }[] = [];
      const restored = snapshot.map((s) => {
        if (curById.has(s.id) || !isBackendSlide(s.id)) return s;
        const clone: Slide = structuredClone(s);
        clone.id = `local-undo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        recreates.push({ localId: clone.id, slide: s });
        return clone;
      });
      setState((prev) => ({ ...prev, draftSlides: renumberSlides(restored) }));

      // 3. Persist restored content/title/appearance on surviving backend slides.
      for (const s of restored) {
        const cur = curById.get(s.id);
        if (!cur || !isBackendSlide(s.id)) continue;
        if (cur.title !== s.title || JSON.stringify(cur.content) !== JSON.stringify(s.content)) {
          trackSave(updateSlide(s.id, { title: s.title, content: s.content }));
        }
        if (JSON.stringify(cur.appearance) !== JSON.stringify(s.appearance)) {
          queueMetaSave(s.id, { appearance: s.appearance ?? DEFAULT_SLIDE_APPEARANCE });
        }
      }

      // 4. Re-create rows for slides the agent deleted, then adopt their new ids.
      for (const { localId, slide } of recreates) {
        trackSave(
          apiCreateSlide(projectId, {
            slideType: slide.slideType,
            slideNumber: slide.slideNumber,
            title: slide.title,
            purpose: slide.purpose,
            content: slide.content,
            layout: slide.layout,
          }).then((saved) => {
            setState((prev) => ({
              ...prev,
              draftSlides: prev.draftSlides.map((x) => (x.id === localId ? { ...x, id: saved.id } : x)),
            }));
            queueReorder();
          }),
        );
      }
      queueReorder();

      // 5. Design (colours/fonts) — restore and persist like chooseDesign does.
      if (design !== undefined) {
        setDesignDirection(design);
        if (design && stateRef.current.draftSlides.some((s) => isBackendSlide(s.id))) {
          void applyDeckDesign(projectId, design).catch(() => {});
        }
      }
    },
    [projectId, trackSave, queueMetaSave, queueReorder],
  );

  // Deck-wide design changes from the agent — update designDirection so every rendered slide
  // (workshop canvas + thumbnails + preview) reflects them immediately, AND persist to the
  // deck like chooseDesign does. Without the persist these edits were client-state only: the
  // chat said "recoloured" but a reload (or a server-side export) showed the old design.
  const applyDesignChange = useCallback(
    (patch: (d: DesignDirection) => DesignDirection) => {
      const next = patch(designDirectionRef.current ?? FALLBACK_DESIGN);
      setDesignDirection(next);
      if (stateRef.current.draftSlides.some((s) => isBackendSlide(s.id))) {
        void applyDeckDesign(projectId, next).catch(() => {});
      }
    },
    [projectId],
  );
  const applyAccent = useCallback((hex: string) => {
    applyDesignChange((d) => withAccent(d, hex));
  }, [applyDesignChange]);
  const applyThemePalette = useCallback((palette: ColorToken[]) => {
    applyDesignChange((d) => ({ ...d, palette }));
  }, [applyDesignChange]);
  const applyDisplayFont = useCallback((font: string) => {
    applyDesignChange((d) => ({ ...d, fonts: { display: font, body: d.fonts?.body } }));
  }, [applyDesignChange]);

  // Director picked a visual-system candidate — preview it instantly, remember it for build, and
  // persist to the deck if one already exists.
  const chooseDesign = useCallback(
    (design: DesignDirection) => {
      selectedDesignRef.current = design;
      setDesignDirection(design);
      if (stateRef.current.draftSlides.some((s) => isBackendSlide(s.id))) {
        void applyDeckDesign(projectId, design).catch(() => {});
      }
    },
    [projectId],
  );

  const setGenerationStatus = useCallback((status: GenerationStatus) => {
    setState((prev) => ({ ...prev, generationStatus: status }));
  }, []);

  const approveContent = useCallback(() => {
    setState((prev) => ({ ...prev, contentApproved: true, generationStatus: "ready" }));
  }, []);

  const getEditorSlides = useCallback((): Slide[] => stateRef.current.draftSlides, []);

  const value = useMemo(
    () => ({
      ...state,
      projectId,
      designDirection,
      generationProgress,
      generationError,
      saveStatus,
      updateForm,
      completeStep,
      isStepComplete,
      setSelectedTemplate,
      setExtractedSummary,
      setScriptUploaded,
      initDraftSlides,
      prepareDraftSlides,
      replaceDraftSlide,
      updateDraftSlide,
      undo,
      canUndo,
      redo,
      canRedo,
      restoreDeckSnapshot,
      updateDraftSlideMeta,
      addSlideComment,
      deleteDraftSlide,
      insertDraftSlideAfter,
      duplicateDraftSlide,
      moveDraftSlide,
      reorderDraftSlide,
      regenerateDraftSlide,
      regenerateAllDraftSlides,
      deckHistory,
      removedSlides,
      restoreSlide,
      applyAccent,
      applyThemePalette,
      applyDisplayFont,
      chooseDesign,
      setGenerationStatus,
      approveContent,
      getEditorSlides,
    }),
    [
      state, projectId, designDirection, generationProgress, generationError, saveStatus,
      updateForm, completeStep, isStepComplete, setSelectedTemplate, setExtractedSummary,
      setScriptUploaded, initDraftSlides, prepareDraftSlides, replaceDraftSlide,
      updateDraftSlide, undo, canUndo, redo, canRedo, restoreDeckSnapshot, updateDraftSlideMeta,
      addSlideComment, deleteDraftSlide, insertDraftSlideAfter, duplicateDraftSlide, moveDraftSlide,
      reorderDraftSlide,
      regenerateDraftSlide, regenerateAllDraftSlides, deckHistory, removedSlides, restoreSlide,
      applyAccent, applyThemePalette,
      applyDisplayFont, chooseDesign, setGenerationStatus, approveContent,
      getEditorSlides,
    ],
  );

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-text-muted">
        Loading…
      </div>
    );
  }

  return (
    <SetupWizardContext.Provider value={value}>{children}</SetupWizardContext.Provider>
  );
}

export function useSetupWizard() {
  const ctx = useContext(SetupWizardContext);
  if (!ctx) {
    throw new Error("useSetupWizard must be used within SetupWizardProvider");
  }
  return ctx;
}
