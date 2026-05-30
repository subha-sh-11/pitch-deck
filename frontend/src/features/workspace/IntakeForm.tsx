"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SectionCard } from "@/components/layout/SectionCard";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { mockIntakeDefaults } from "@/lib/mock/mock-deck";
import { projectRoutes } from "@/lib/routes";

interface IntakeFormProps {
  projectId: string;
}

export function IntakeForm({ projectId }: IntakeFormProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const d = mockIntakeDefaults;

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-8">
      {saved && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">
          Draft saved
        </div>
      )}

      <SectionCard
        title="Story Identity"
        description="Define the core identity of the project before the AI builds the pitch structure."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <Textarea label="Title" defaultValue={d.title} rows={1} className="min-h-0" />
          <Textarea label="Tagline" defaultValue={d.tagline} rows={1} className="min-h-0" />
          <div className="md:col-span-2">
            <Textarea label="Logline" defaultValue={d.logline} rows={3} />
          </div>
          <Textarea label="Genre Blend" defaultValue={d.genreBlend} rows={2} />
          <Textarea label="Tone" defaultValue={d.tone} rows={2} />
        </div>
      </SectionCard>

      <SectionCard
        title="Story Body"
        description="Describe the emotional, narrative, and character foundation of the project."
      >
        <div className="space-y-6">
          <Textarea label="Synopsis" defaultValue={d.synopsis} rows={5} />
          <Textarea label="Story World" defaultValue={d.storyWorld} rows={3} />
          <Textarea label="Main Characters" defaultValue={d.mainCharacters} rows={3} />
          <Textarea label="Character Relationship Dynamics" defaultValue={d.characterDynamics} rows={3} />
        </div>
      </SectionCard>

      <SectionCard
        title="Pitch Strength"
        description="Help the AI position the project for producers, investors, studios, or OTT platforms."
      >
        <div className="space-y-6">
          <Textarea label="USP / Unique Selling Points" defaultValue={d.usp} rows={3} />
          <Textarea label="Show Cross / Comparable Films" defaultValue={d.showCross} rows={2} />
          <Textarea label="Target Audience" defaultValue={d.targetAudience} rows={2} />
          <Textarea label="Release Fit" defaultValue={d.releaseFit} rows={2} />
        </div>
      </SectionCard>

      <SectionCard
        title="Visual Direction"
        description="Guide the deck's cinematic mood, typography, colors, imagery, and layout feel."
      >
        <div className="space-y-6">
          <Textarea label="Visual Aesthetic" defaultValue={d.visualAesthetic} rows={3} />
          <Textarea label="Color Palette Direction" defaultValue={d.colorPalette} rows={2} />
          <Textarea label="Texture / Background Style" defaultValue={d.textureStyle} rows={2} />
          <Textarea label="Initial Design Direction" defaultValue={d.designDirection} rows={3} />
        </div>
      </SectionCard>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="secondary" onClick={handleSave}>
          Save Draft
        </Button>
        <Button onClick={() => router.push(projectRoutes.questions(projectId))}>
          Analyze Intake
        </Button>
      </div>
    </div>
  );
}
