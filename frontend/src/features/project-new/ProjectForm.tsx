"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SectionCard } from "@/components/layout/SectionCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { projectRoutes } from "@/lib/routes";
import { MOCK_PROJECT_ID } from "@/lib/mock/mock-projects";
import type { PitchPurpose, ProjectType, StoryStage } from "@/types/project";

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: "feature_film", label: "Feature Film" },
  { value: "web_series", label: "Web Series" },
  { value: "short_film", label: "Short Film" },
  { value: "documentary", label: "Documentary" },
  { value: "pilot", label: "Pilot" },
  { value: "other", label: "Other" },
];

const PITCH_PURPOSES: { value: PitchPurpose; label: string }[] = [
  { value: "investor", label: "Investor Pitch" },
  { value: "ott", label: "OTT / Streaming Pitch" },
  { value: "studio", label: "Studio Pitch" },
  { value: "producer", label: "Producer Pitch" },
  { value: "festival", label: "Festival Pitch" },
  { value: "cast_crew", label: "Cast / Crew Attachment" },
  { value: "internal", label: "Internal Development" },
];

const STORY_STAGES: { value: StoryStage; label: string }[] = [
  { value: "raw_idea", label: "Raw Idea" },
  { value: "one_line", label: "One Line" },
  { value: "synopsis_ready", label: "Synopsis Ready" },
  { value: "partial_script", label: "Partial Script" },
  { value: "full_script", label: "Full Script" },
  { value: "pilot_shot", label: "Pilot Shot" },
  { value: "partially_shot", label: "Partially Shot" },
  { value: "completed", label: "Completed Project" },
];

export function ProjectForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    router.push(projectRoutes.setupIdentity(MOCK_PROJECT_ID));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <SectionCard title="Project Identity" description="Define what you're pitching and why.">
        <div className="grid gap-6 md:grid-cols-2">
          <Input label="Project Title" name="title" placeholder="The Tank" required />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-primary">Project Type</label>
            <select
              name="projectType"
              className="w-full rounded-xl border border-border-glass bg-surface-2 px-4 py-2.5 text-sm text-text-primary focus:border-accent-neon/50 focus:outline-none"
              defaultValue="feature_film"
            >
              {PROJECT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-primary">Pitch Purpose</label>
            <select
              name="pitchPurpose"
              className="w-full rounded-xl border border-border-glass bg-surface-2 px-4 py-2.5 text-sm text-text-primary focus:border-accent-neon/50 focus:outline-none"
              defaultValue="investor"
            >
              {PITCH_PURPOSES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-primary">Story Stage</label>
            <select
              name="storyStage"
              className="w-full rounded-xl border border-border-glass bg-surface-2 px-4 py-2.5 text-sm text-text-primary focus:border-accent-neon/50 focus:outline-none"
              defaultValue="synopsis_ready"
            >
              {STORY_STAGES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Market & Genre" description="Language and genre positioning for your pitch.">
        <div className="grid gap-6 md:grid-cols-2">
          <Input
            label="Language / Market"
            name="language"
            placeholder="Telugu, Hindi, Pan-India, Global Indie"
            defaultValue="Telugu"
          />
          <Input label="Primary Genre" name="genre" placeholder="Survival Thriller" />
          <div className="md:col-span-2">
            <Input
              label="Genre Blend"
              name="genreBlend"
              placeholder="Survival Thriller + Suspense Drama + Childhood Comedy"
            />
          </div>
        </div>
      </SectionCard>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="ghost" href={projectRoutes.dashboard()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Start Intake"}
        </Button>
      </div>
    </form>
  );
}
