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
  generateDeck,
  getDeck,
  getProject,
  pollJob,
  regenerateSlide as apiRegenerateSlide,
  saveIntake,
  updateSlide,
} from "@/lib/api";
import { buildSlideFromOutline, renumberSlides } from "@/lib/build-slides";
import { DEFAULT_SLIDE_APPEARANCE } from "@/lib/slide-appearance";
import { ADDABLE_SLIDE_TYPES } from "@/lib/regenerate-slide";
import type { DesignDirection } from "@/types/design";
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

interface SetupWizardContextValue extends SetupWizardState {
  projectId: string;
  designDirection: DesignDirection | null;
  generationProgress: number;
  generationError: string | null;
  updateForm: (patch: Partial<IntakeFormData>) => void;
  completeStep: (step: SetupStepId) => void;
  isStepComplete: (step: SetupStepId) => boolean;
  setSelectedTemplate: (templateId: string) => void;
  setExtractedSummary: (summary: ExtractedScriptSummary | null) => void;
  setScriptUploaded: (value: boolean) => void;
  initDraftSlides: () => void;
  updateDraftSlide: (id: string, patch: Partial<SlideContent> & { title?: string }) => void;
  updateDraftSlideMeta: (
    id: string,
    patch: Partial<Pick<Slide, "speakerNotes" | "comments" | "transition" | "title">> & {
      appearance?: Partial<SlideAppearance>;
    },
  ) => void;
  addSlideComment: (id: string, text: string) => void;
  deleteDraftSlide: (id: string) => boolean;
  insertDraftSlideAfter: (index: number, slideType: SlideType) => void;
  duplicateDraftSlide: (index: number) => void;
  moveDraftSlide: (index: number, direction: "up" | "down") => void;
  regenerateDraftSlide: (id: string) => Promise<void>;
  regenerateAllDraftSlides: () => Promise<void>;
  setGenerationStatus: (status: GenerationStatus) => void;
  approveContent: () => void;
  getEditorSlides: () => Slide[];
}

const SetupWizardContext = createContext<SetupWizardContextValue | null>(null);

function loadState(projectId: string): SetupWizardState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SetupWizardState;
    return { ...DEFAULT_STATE, ...parsed, formData: { ...EMPTY_INTAKE_FORM, ...parsed.formData } };
  } catch {
    return null;
  }
}

function saveState(projectId: string, state: SetupWizardState) {
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${projectId}`, JSON.stringify(state));
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
  const [state, setState] = useState<SetupWizardState>(DEFAULT_STATE);
  const [designDirection, setDesignDirection] = useState<DesignDirection | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const stateRef = useRef<SetupWizardState>(DEFAULT_STATE);
  const generatingRef = useRef(false);
  stateRef.current = state;

  // Hydrate: sessionStorage (working copy w/ appearance/comments) + backend (intake + deck).
  useEffect(() => {
    let cancelled = false;
    const saved = loadState(projectId);
    if (saved) setState(saved);
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
            if (deck.slides?.length && (!saved || saved.draftSlides.length === 0)) {
              setState((prev) => ({
                ...prev,
                draftSlides: deck.slides,
                generationStatus: "ready",
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

  /** Backend generation: design + content + images, then load the deck. */
  const runGeneration = useCallback(async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGenerationError(null);
    setGenerationProgress(0);
    setState((prev) => ({ ...prev, generationStatus: "generating" }));
    try {
      const job = await generateDeck(
        projectId,
        stateRef.current.selectedTemplateId ?? undefined,
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
  }, [projectId]);

  const initDraftSlides = useCallback(() => {
    if (stateRef.current.draftSlides.length > 0 || generatingRef.current) return;
    void runGeneration();
  }, [runGeneration]);

  const regenerateAllDraftSlides = useCallback(async () => {
    setState((prev) => ({ ...prev, draftSlides: [] }));
    await runGeneration();
  }, [runGeneration]);

  const updateDraftSlide = useCallback(
    (id: string, patch: Partial<SlideContent> & { title?: string }) => {
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
        void updateSlide(id, {
          ...(title !== undefined ? { title } : {}),
          content: contentPatch as SlideContent,
        }).catch(() => {});
      }
    },
    [],
  );

  const updateDraftSlideMeta = useCallback(
    (
      id: string,
      patch: Partial<Pick<Slide, "speakerNotes" | "comments" | "transition" | "title">> & {
        appearance?: Partial<SlideAppearance>;
      },
    ) => {
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
      // Title is the only meta field the backend persists.
      if (patch.title !== undefined && isBackendSlide(id)) {
        void updateSlide(id, { title: patch.title }).catch(() => {});
      }
    },
    [],
  );

  const addSlideComment = useCallback((id: string, text: string) => {
    const comment: SlideComment = {
      id: `comment-${Date.now()}`,
      author: "You",
      text,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setState((prev) => ({
      ...prev,
      draftSlides: prev.draftSlides.map((s) =>
        s.id === id ? { ...s, comments: [...(s.comments ?? []), comment] } : s,
      ),
    }));
  }, []);

  const deleteDraftSlide = useCallback((id: string): boolean => {
    let deleted = false;
    setState((prev) => {
      if (prev.draftSlides.length <= 1) return prev;
      deleted = true;
      return { ...prev, draftSlides: renumberSlides(prev.draftSlides.filter((s) => s.id !== id)) };
    });
    return deleted;
  }, []);

  const insertDraftSlideAfter = useCallback((index: number, slideType: SlideType) => {
    setState((prev) => {
      const meta =
        ADDABLE_SLIDE_TYPES.find((t) => t.slideType === slideType) ??
        ADDABLE_SLIDE_TYPES[ADDABLE_SLIDE_TYPES.length - 1];
      const newSlide = buildSlideFromOutline(meta, prev.formData, index + 2);
      // mark as a client-only slide so we don't issue backend updates for it
      newSlide.id = `local-${newSlide.id}`;
      const next = [...prev.draftSlides];
      next.splice(index + 1, 0, newSlide);
      return { ...prev, draftSlides: renumberSlides(next) };
    });
  }, []);

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

  const moveDraftSlide = useCallback((index: number, direction: "up" | "down") => {
    setState((prev) => {
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= prev.draftSlides.length) return prev;
      const next = [...prev.draftSlides];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return { ...prev, draftSlides: renumberSlides(next) };
    });
  }, []);

  const regenerateDraftSlide = useCallback(async (id: string) => {
    if (!isBackendSlide(id)) return;
    try {
      const job = await apiRegenerateSlide(id);
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
      updateForm,
      completeStep,
      isStepComplete,
      setSelectedTemplate,
      setExtractedSummary,
      setScriptUploaded,
      initDraftSlides,
      updateDraftSlide,
      updateDraftSlideMeta,
      addSlideComment,
      deleteDraftSlide,
      insertDraftSlideAfter,
      duplicateDraftSlide,
      moveDraftSlide,
      regenerateDraftSlide,
      regenerateAllDraftSlides,
      setGenerationStatus,
      approveContent,
      getEditorSlides,
    }),
    [
      state, projectId, designDirection, generationProgress, generationError, updateForm,
      completeStep, isStepComplete, setSelectedTemplate, setExtractedSummary, setScriptUploaded,
      initDraftSlides, updateDraftSlide, updateDraftSlideMeta, addSlideComment, deleteDraftSlide,
      insertDraftSlideAfter, duplicateDraftSlide, moveDraftSlide, regenerateDraftSlide, regenerateAllDraftSlides,
      setGenerationStatus, approveContent, getEditorSlides,
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
