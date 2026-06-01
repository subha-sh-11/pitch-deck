"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { WorkflowActionBar } from "@/components/layout/WorkflowActionBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { projectRoutes } from "@/lib/routes";
import { useSetupWizard } from "./SetupWizardContext";

interface PitchStepProps {
  projectId: string;
}

export function PitchStep({ projectId }: PitchStepProps) {
  const router = useRouter();
  const { formData, updateForm, completeStep, isStepComplete } = useSetupWizard();

  useEffect(() => {
    if (!isStepComplete("body")) {
      router.replace(projectRoutes.setupBody(projectId));
    }
  }, [isStepComplete, projectId, router]);

  if (!isStepComplete("body")) {
    return null;
  }

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    completeStep("pitch");
    router.push(projectRoutes.templates(projectId));
  }

  return (
    <>
      <WorkflowActionBar
        left={
          <Button type="button" variant="ghost" href={projectRoutes.setupBody(projectId)}>
            ← Back
          </Button>
        }
        right={
          <Button type="submit" form="pitch-form">
            Choose presentation template →
          </Button>
        }
      />
      <PageHeader
        title="Pitch Strength"
        subtitle="Position your project for producers, investors, studios, or OTT platforms. Visual style will be recommended when you choose a template."
      />
      <form id="pitch-form" onSubmit={handleContinue} className="space-y-6">
        <Textarea
          label="USP / Unique Selling Points"
          value={formData.usp}
          onChange={(e) => updateForm({ usp: e.target.value })}
          rows={3}
        />
        <Textarea
          label="Show Cross / Comparable Films"
          value={formData.showCross}
          onChange={(e) => updateForm({ showCross: e.target.value })}
          rows={2}
        />
        <Textarea
          label="Target Audience"
          value={formData.targetAudience}
          onChange={(e) => updateForm({ targetAudience: e.target.value })}
          rows={2}
        />
        <Textarea
          label="Release Fit"
          value={formData.releaseFit}
          onChange={(e) => updateForm({ releaseFit: e.target.value })}
          rows={2}
        />
      </form>
    </>
  );
}
