"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DeckEditor } from "@/components/editor/DeckEditor";
import { useSetupWizard } from "@/features/setup/SetupWizardContext";
import { mockDesignDirection } from "@/lib/mock/mock-deck";
import { projectRoutes } from "@/lib/routes";

interface SlideEditorWorkspaceProps {
  projectId: string;
}

export function SlideEditorWorkspace({ projectId }: SlideEditorWorkspaceProps) {
  const router = useRouter();
  const {
    draftSlides,
    contentApproved,
    selectedTemplateId,
    deleteDraftSlide,
    insertDraftSlideAfter,
    moveDraftSlide,
    regenerateDraftSlide,
    updateDraftSlide,
    updateDraftSlideMeta,
    addSlideComment,
  } = useSetupWizard();

  useEffect(() => {
    if (!contentApproved) {
      if (selectedTemplateId) {
        router.replace(projectRoutes.preview(projectId));
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
      designDirection={mockDesignDirection}
      onDeleteSlide={deleteDraftSlide}
      onInsertAfter={insertDraftSlideAfter}
      onMoveSlide={moveDraftSlide}
      onRegenerateSlide={regenerateDraftSlide}
      onUpdateSlide={updateDraftSlide}
      onUpdateSlideMeta={updateDraftSlideMeta}
      onAddComment={addSlideComment}
    />
  );
}
