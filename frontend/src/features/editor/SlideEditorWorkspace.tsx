"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { DeckEditor } from "@/components/editor/DeckEditor";
import { useSetupWizard } from "@/features/setup/SetupWizardContext";
import { pollJob, workshopSlideImage } from "@/lib/api";
import { projectRoutes } from "@/lib/routes";
import type { DesignDirection } from "@/types/design";
import type { Slide } from "@/types/slide";

interface SlideEditorWorkspaceProps {
  projectId: string;
}

// Neutral fallback used only if the deck's design direction hasn't loaded yet.
const FALLBACK_DESIGN: DesignDirection = {
  mood: "Cinematic",
  cinematicTone: "Grounded, atmospheric",
  palette: [
    { name: "Deep Black", hex: "#0B0B0D" },
    { name: "Accent", hex: "#B8862F" },
    { name: "Text", hex: "#EDE7DA" },
  ],
  typography: {
    headings: "Display serif",
    body: "Humanist sans",
    accents: "Uppercase labels",
    treatment: "Minimal",
  },
  visualStyle: ["Cinematic"],
  backgroundStyle: "Dark textured",
  imageStyle: "Cinematic, realistic lighting",
  layoutStyle: "Asymmetric, generous negative space",
  rationale: "",
};

export function SlideEditorWorkspace({ projectId }: SlideEditorWorkspaceProps) {
  const router = useRouter();
  const {
    draftSlides,
    contentApproved,
    selectedTemplateId,
    designDirection,
    saveStatus,
    deleteDraftSlide,
    insertDraftSlideAfter,
    duplicateDraftSlide,
    moveDraftSlide,
    regenerateDraftSlide,
    updateDraftSlide,
    updateDraftSlideMeta,
    addSlideComment,
    replaceDraftSlide,
    applyAccent,
    applyThemePalette,
    applyDisplayFont,
  } = useSetupWizard();

  // Image-only regeneration for the AI assistant: generate, poll, adopt the updated slide.
  // Mirrors useInterview.generateSlideImage so both chat surfaces behave identically.
  const generateSlideImage = useCallback(
    async (id: string, imagePrompt?: string) => {
      try {
        const job = await workshopSlideImage(id, imagePrompt);
        const final = await pollJob(job);
        if (final.status === "failed") return;
        const res = final.result as { slide?: Slide; ok?: boolean } | Slide | undefined;
        const updated = (res as { slide?: Slide })?.slide ?? (res as Slide | undefined);
        if (updated?.id) replaceDraftSlide({ ...updated, generated: true });
      } catch {
        /* keep existing image */
      }
    },
    [replaceDraftSlide],
  );

  useEffect(() => {
    if (!contentApproved) {
      if (selectedTemplateId) {
        router.replace(projectRoutes.templates(projectId));
      } else {
        router.replace(projectRoutes.setupIdentity(projectId));
      }
    }
  }, [contentApproved, selectedTemplateId, projectId, router]);

  if (!contentApproved) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F0F0F3] text-[#5C5C66]">
        Redirecting…
      </div>
    );
  }

  if (draftSlides.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F0F0F3] text-[#5C5C66]">
        Preparing your deck…
      </div>
    );
  }

  return (
    <DeckEditor
      projectId={projectId}
      slides={draftSlides}
      designDirection={designDirection ?? FALLBACK_DESIGN}
      saveStatus={saveStatus}
      onDeleteSlide={deleteDraftSlide}
      onInsertAfter={insertDraftSlideAfter}
      onDuplicateSlide={duplicateDraftSlide}
      onMoveSlide={moveDraftSlide}
      onRegenerateSlide={regenerateDraftSlide}
      onUpdateSlide={updateDraftSlide}
      onUpdateSlideMeta={updateDraftSlideMeta}
      onAddComment={addSlideComment}
      onGenerateImage={generateSlideImage}
      onSetAccent={applyAccent}
      onSetTheme={applyThemePalette}
      onSetFont={applyDisplayFont}
    />
  );
}
