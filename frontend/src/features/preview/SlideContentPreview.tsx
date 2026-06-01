"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useSetupWizard } from "@/features/setup/SetupWizardContext";
import { projectRoutes } from "@/lib/routes";
import type { SlideContent } from "@/types/slide";
import { DeckSlideIndex } from "./DeckSlideIndex";
import { GeneratingOverlay } from "./GeneratingOverlay";
import { PreviewCinematicBackground } from "./PreviewCinematicBackground";
import { SlideContentDetailPanel } from "./SlideContentDetailPanel";
import { getSelectedSlide } from "./slide-content-utils";

const GENERATE_DELAY_MS = 2500;

interface SlideContentPreviewProps {
  projectId: string;
}

export function SlideContentPreview({ projectId }: SlideContentPreviewProps) {
  const router = useRouter();
  const {
    draftSlides,
    selectedTemplateId,
    isStepComplete,
    initDraftSlides,
    updateDraftSlide,
    regenerateDraftSlide,
    setGenerationStatus,
    approveContent,
    generationStatus,
  } = useSetupWizard();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!isStepComplete("pitch")) {
      router.replace(projectRoutes.setupPitch(projectId));
    }
  }, [isStepComplete, projectId, router]);

  useEffect(() => {
    if (!selectedTemplateId) {
      router.replace(projectRoutes.templates(projectId));
      return;
    }
    if (draftSlides.length === 0) {
      initDraftSlides();
    }
  }, [selectedTemplateId, draftSlides.length, initDraftSlides, projectId, router]);

  useEffect(() => {
    if (draftSlides.length > 0 && !selectedId) {
      setSelectedId(draftSlides[0].id);
    }
  }, [draftSlides, selectedId]);

  const selected = getSelectedSlide(draftSlides, selectedId);

  async function handleRegenerateSlide() {
    if (!selected) return;
    setRegeneratingId(selected.id);
    await regenerateDraftSlide(selected.id);
    setRegeneratingId(null);
  }

  function handleSaveSlideContent(patch: Partial<SlideContent>) {
    if (!selected) return;
    updateDraftSlide(selected.id, patch);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  }

  async function handleStartGenerate() {
    if (draftSlides.length === 0) initDraftSlides();
    setGenerationStatus("generating");
    await new Promise((r) => setTimeout(r, GENERATE_DELAY_MS));
    approveContent();
    router.push(projectRoutes.editor(projectId));
  }

  if (!isStepComplete("pitch") || !selectedTemplateId) {
    return null;
  }

  if (draftSlides.length === 0 || !selected) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-zinc-500">
        Preparing slide content…
      </div>
    );
  }

  return (
    <>
      {generationStatus === "generating" && <GeneratingOverlay />}

      <div className="preview-studio-root preview-page-refined flex min-h-0 flex-1 flex-col">
        <PreviewCinematicBackground />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <header className="mb-5 flex shrink-0 flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
              <Button
                variant="ghost"
                size="sm"
                href={projectRoutes.templates(projectId)}
                className="-ml-2 text-zinc-500"
              >
                ← Templates
              </Button>
              <h1 className="font-display text-xl font-semibold text-zinc-100 md:text-2xl">
                Slide Content Preview
              </h1>
            </div>
            <Button
              size="sm"
              className="preview-generate-btn shrink-0"
              onClick={() => void handleStartGenerate()}
            >
              Start Generate →
            </Button>
          </header>

          <p className="mb-5 max-w-2xl text-sm text-zinc-500">
            Review copy for each slide before the deck is built. Select a slide to
            read or edit.
          </p>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[200px_1fr] lg:gap-5">
            <aside className="min-h-[280px] lg:min-h-0 lg:max-h-[calc(100vh-140px)]">
              <DeckSlideIndex
                slides={draftSlides}
                selectedId={selected.id}
                onSelect={setSelectedId}
              />
            </aside>

            <div className="min-h-[400px] lg:min-h-0 lg:max-h-[calc(100vh-140px)]">
              <SlideContentDetailPanel
                slide={selected}
                slideKey={selected.id}
                totalSlides={draftSlides.length}
                onSave={handleSaveSlideContent}
                onRegenerate={() => void handleRegenerateSlide()}
                regenerating={regeneratingId === selected.id}
                savedFlash={savedFlash}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
