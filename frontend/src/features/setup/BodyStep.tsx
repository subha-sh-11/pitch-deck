"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { projectRoutes } from "@/lib/routes";
import { useSetupWizard } from "./SetupWizardContext";

interface BodyStepProps {
  projectId: string;
}

export function BodyStep({ projectId }: BodyStepProps) {
  const router = useRouter();
  const { formData, updateForm, completeStep, isStepComplete } = useSetupWizard();

  useEffect(() => {
    if (!isStepComplete("identity")) {
      router.replace(projectRoutes.setupIdentity(projectId));
    }
  }, [isStepComplete, projectId, router]);

  if (!isStepComplete("identity")) {
    return null;
  }

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.synopsis.trim()) return;
    completeStep("body");
    router.push(projectRoutes.setupPitch(projectId));
  }

  return (
    <>
      <PageHeader
        title="Story Body"
        subtitle="Describe the emotional, narrative, and character foundation of your project."
      />
      <form onSubmit={handleContinue} className="space-y-6">
        <Textarea
          label="Synopsis"
          value={formData.synopsis}
          onChange={(e) => updateForm({ synopsis: e.target.value })}
          rows={5}
          required
        />
        <Textarea
          label="Story World"
          value={formData.storyWorld}
          onChange={(e) => updateForm({ storyWorld: e.target.value })}
          rows={3}
        />
        <Textarea
          label="Main Characters"
          value={formData.mainCharacters}
          onChange={(e) => updateForm({ mainCharacters: e.target.value })}
          rows={3}
        />
        <Textarea
          label="Character Relationship Dynamics"
          value={formData.characterDynamics}
          onChange={(e) => updateForm({ characterDynamics: e.target.value })}
          rows={3}
        />
        <div className="flex justify-between gap-4">
          <Button
            type="button"
            variant="ghost"
            href={projectRoutes.setupIdentity(projectId)}
          >
            Back
          </Button>
          <Button type="submit">Continue to Pitch Strength</Button>
        </div>
      </form>
    </>
  );
}
