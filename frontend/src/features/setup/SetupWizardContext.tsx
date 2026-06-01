"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  buildSlideFromOutline,
  buildSlidesFromTemplate,
  renumberSlides,
} from "@/lib/build-slides";
import { DEFAULT_SLIDE_APPEARANCE } from "@/lib/slide-appearance";
import {
  ADDABLE_SLIDE_TYPES,
  regenerateAllSlides,
  regenerateSingleSlide,
} from "@/lib/regenerate-slide";
import { getTemplateById } from "@/lib/mock/mock-templates";
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

interface SetupWizardContextValue extends SetupWizardState {
  projectId: string;
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
    patch: Partial<
      Pick<Slide, "speakerNotes" | "comments" | "transition" | "title">
    > & {
      appearance?: Partial<SlideAppearance>;
    },
  ) => void;
  addSlideComment: (id: string, text: string) => void;
  deleteDraftSlide: (id: string) => boolean;
  insertDraftSlideAfter: (index: number, slideType: SlideType) => void;
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
    return {
      ...DEFAULT_STATE,
      ...parsed,
      formData: { ...EMPTY_INTAKE_FORM, ...parsed.formData },
    };
  } catch {
    return null;
  }
}

function saveState(projectId: string, state: SetupWizardState) {
  sessionStorage.setItem(`${STORAGE_PREFIX}${projectId}`, JSON.stringify(state));
}

export function SetupWizardProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<SetupWizardState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadState(projectId);
    if (saved) setState(saved);
    setHydrated(true);
  }, [projectId]);

  useEffect(() => {
    if (hydrated) saveState(projectId, state);
  }, [projectId, state, hydrated]);

  const updateForm = useCallback((patch: Partial<IntakeFormData>) => {
    setState((prev) => ({
      ...prev,
      formData: { ...prev.formData, ...patch },
    }));
  }, []);

  const completeStep = useCallback((step: SetupStepId) => {
    setState((prev) => ({
      ...prev,
      completedSteps: prev.completedSteps.includes(step)
        ? prev.completedSteps
        : [...prev.completedSteps, step],
    }));
  }, []);

  const isStepComplete = useCallback(
    (step: SetupStepId) => state.completedSteps.includes(step),
    [state.completedSteps],
  );

  const setSelectedTemplate = useCallback((templateId: string) => {
    setState((prev) => ({ ...prev, selectedTemplateId: templateId }));
  }, []);

  const setExtractedSummary = useCallback(
    (summary: ExtractedScriptSummary | null) => {
      setState((prev) => ({ ...prev, extractedSummary: summary }));
    },
    [],
  );

  const setScriptUploaded = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, scriptUploaded: value }));
  }, []);

  const initDraftSlides = useCallback(() => {
    setState((prev) => {
      const template = prev.selectedTemplateId
        ? getTemplateById(prev.selectedTemplateId)
        : undefined;
      if (!template) return prev;
      const slides = buildSlidesFromTemplate(template, prev.formData);
      return { ...prev, draftSlides: slides };
    });
  }, []);

  const updateDraftSlide = useCallback(
    (id: string, patch: Partial<SlideContent> & { title?: string }) => {
      setState((prev) => ({
        ...prev,
        draftSlides: prev.draftSlides.map((s) => {
          if (s.id !== id) return s;
          const { title, ...contentPatch } = patch;
          return {
            ...s,
            title: title ?? s.title,
            content: { ...s.content, ...contentPatch },
          };
        }),
      }));
    },
    [],
  );

  const updateDraftSlideMeta = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<Slide, "speakerNotes" | "comments" | "transition" | "title">
      > & {
        appearance?: Partial<SlideAppearance>;
      },
    ) => {
      setState((prev) => ({
        ...prev,
        draftSlides: prev.draftSlides.map((s) => {
          if (s.id !== id) return s;
          return {
            ...s,
            ...patch,
            appearance: patch.appearance
              ? {
                  ...(s.appearance ?? DEFAULT_SLIDE_APPEARANCE),
                  ...patch.appearance,
                }
              : s.appearance,
          };
        }),
      }));
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
        s.id === id
          ? { ...s, comments: [...(s.comments ?? []), comment] }
          : s,
      ),
    }));
  }, []);

  const deleteDraftSlide = useCallback((id: string): boolean => {
    let deleted = false;
    setState((prev) => {
      if (prev.draftSlides.length <= 1) return prev;
      deleted = true;
      return {
        ...prev,
        draftSlides: renumberSlides(prev.draftSlides.filter((s) => s.id !== id)),
      };
    });
    return deleted;
  }, []);

  const insertDraftSlideAfter = useCallback(
    (index: number, slideType: SlideType) => {
      setState((prev) => {
        const meta =
          ADDABLE_SLIDE_TYPES.find((t) => t.slideType === slideType) ??
          ADDABLE_SLIDE_TYPES[ADDABLE_SLIDE_TYPES.length - 1];
        const enrichedForm = { ...prev.formData };
        const newSlide = buildSlideFromOutline(
          meta,
          enrichedForm,
          index + 2,
        );
        const next = [...prev.draftSlides];
        next.splice(index + 1, 0, newSlide);
        return { ...prev, draftSlides: renumberSlides(next) };
      });
    },
    [],
  );

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
    setState((prev) => {
      const templateId = prev.selectedTemplateId;
      const slide = prev.draftSlides.find((s) => s.id === id);
      if (!templateId || !slide) return prev;
      void regenerateSingleSlide(slide, prev.formData, templateId).then((updated) => {
        setState((p) => ({
          ...p,
          draftSlides: p.draftSlides.map((s) => (s.id === id ? updated : s)),
        }));
      });
      return prev;
    });
  }, []);

  const regenerateAllDraftSlides = useCallback(async () => {
    setState((prev) => {
      const templateId = prev.selectedTemplateId;
      if (!templateId) return prev;
      void regenerateAllSlides(prev.formData, templateId).then((slides) => {
        setState((p) => ({ ...p, draftSlides: slides }));
      });
      return prev;
    });
  }, []);

  const setGenerationStatus = useCallback((status: GenerationStatus) => {
    setState((prev) => ({ ...prev, generationStatus: status }));
  }, []);

  const approveContent = useCallback(() => {
    setState((prev) => ({
      ...prev,
      contentApproved: true,
      generationStatus: "ready",
    }));
  }, []);

  const getEditorSlides = useCallback((): Slide[] => {
    if (state.draftSlides.length > 0) {
      return state.draftSlides;
    }
    const template = state.selectedTemplateId
      ? getTemplateById(state.selectedTemplateId)
      : undefined;
    if (!template) return [];
    return buildSlidesFromTemplate(template, state.formData);
  }, [state.draftSlides, state.selectedTemplateId, state.formData]);

  const value = useMemo(
    () => ({
      ...state,
      projectId,
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
      moveDraftSlide,
      regenerateDraftSlide,
      regenerateAllDraftSlides,
      setGenerationStatus,
      approveContent,
      getEditorSlides,
    }),
    [
      state,
      projectId,
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
      moveDraftSlide,
      regenerateDraftSlide,
      regenerateAllDraftSlides,
      setGenerationStatus,
      approveContent,
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
    <SetupWizardContext.Provider value={value}>
      {children}
    </SetupWizardContext.Provider>
  );
}

export function useSetupWizard() {
  const ctx = useContext(SetupWizardContext);
  if (!ctx) {
    throw new Error("useSetupWizard must be used within SetupWizardProvider");
  }
  return ctx;
}
