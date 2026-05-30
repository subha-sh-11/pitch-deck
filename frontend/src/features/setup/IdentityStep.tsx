"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { projectRoutes } from "@/lib/routes";
import { ScriptUpload } from "./ScriptUpload";
import { useSetupWizard } from "./SetupWizardContext";

interface IdentityStepProps {
  projectId: string;
}

export function IdentityStep({ projectId }: IdentityStepProps) {
  const router = useRouter();
  const { formData, updateForm, completeStep } = useSetupWizard();

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title.trim() || !formData.logline.trim()) return;
    completeStep("identity");
    router.push(projectRoutes.setupBody(projectId));
  }

  return (
    <>
      <PageHeader
        title="Story Identity"
        subtitle="Define the core identity of your project. Complete this section before moving to Story Body."
      />
      <ScriptUpload />
      <form onSubmit={handleContinue} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Input
            label="Title"
            value={formData.title}
            onChange={(e) => updateForm({ title: e.target.value })}
            placeholder="The Tank"
            required
          />
          <Input
            label="Tagline"
            value={formData.tagline}
            onChange={(e) => updateForm({ tagline: e.target.value })}
            placeholder="A Devil On The Roof"
          />
        </div>
        <Textarea
          label="Logline"
          value={formData.logline}
          onChange={(e) => updateForm({ logline: e.target.value })}
          rows={3}
          required
        />
        <Textarea
          label="Genre Blend"
          value={formData.genreBlend}
          onChange={(e) => updateForm({ genreBlend: e.target.value })}
          rows={2}
          placeholder="Survival Thriller + Suspense Drama + Childhood Comedy"
        />
        <Textarea
          label="Tone"
          value={formData.tone}
          onChange={(e) => updateForm({ tone: e.target.value })}
          rows={2}
          placeholder="Dark, emotional, claustrophobic, urgent"
        />
        <div className="flex justify-end">
          <Button type="submit">Continue to Story Body</Button>
        </div>
      </form>
    </>
  );
}
