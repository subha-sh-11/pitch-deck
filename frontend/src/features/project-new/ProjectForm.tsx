"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SectionCard } from "@/components/layout/SectionCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { projectRoutes } from "@/lib/routes";
import { createProject } from "@/lib/api";
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
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const genreBlend = String(fd.get("genreBlend") ?? "");
    const primary = String(fd.get("genre") ?? "");
    const genres = Array.from(
      new Set(
        [primary, ...genreBlend.split(/[+,&]/).map((g) => g.trim())].filter(Boolean),
      ),
    );
    try {
      const project = await createProject({
        title: String(fd.get("title") ?? "").trim(),
        projectType: (fd.get("projectType") as ProjectType) || undefined,
        pitchPurpose: (fd.get("pitchPurpose") as PitchPurpose) || undefined,
        storyStage: (fd.get("storyStage") as StoryStage) || undefined,
        language: String(fd.get("language") ?? "") || undefined,
        genres,
      });
      router.push(projectRoutes.setupIdentity(project.id));
    } catch (err) {
      setError((err as Error).message ?? "Could not create project");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} autoComplete="off" className="space-y-8">
      <SectionCard title="Project Identity" description="Define what you're pitching and why.">
        <div className="grid gap-6 md:grid-cols-2">
          <Input label="Project Title" name="title" placeholder="The Tank" autoComplete="off" required />
          <Select
            label="Project Type"
            name="projectType"
            options={PROJECT_TYPES}
            defaultValue="feature_film"
          />
          <Select
            label="Pitch Purpose"
            name="pitchPurpose"
            options={PITCH_PURPOSES}
            defaultValue="investor"
          />
          <Select
            label="Story Stage"
            name="storyStage"
            options={STORY_STAGES}
            defaultValue="synopsis_ready"
          />
        </div>
      </SectionCard>

      <SectionCard title="Market & Genre" description="Language and genre positioning for your pitch.">
        <div className="grid gap-6 md:grid-cols-2">
          <Input
            label="Language / Market"
            name="language"
            placeholder="e.g. Telugu, Hindi, Pan-India, Global Indie"
            autoComplete="off"
          />
          <Input label="Primary Genre" name="genre" placeholder="e.g. Crime Drama" autoComplete="off" />
          <div className="md:col-span-2">
            <Input
              label="Genre Blend"
              name="genreBlend"
              placeholder="e.g. Crime + Comedy + Drama"
              autoComplete="off"
            />
          </div>
        </div>
      </SectionCard>

      {error && (
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

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
