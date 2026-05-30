"use client";

import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/layout/SectionCard";
import { Button } from "@/components/ui/Button";
import { mockStoryAnalysis } from "@/lib/mock/mock-deck";
import { projectRoutes } from "@/lib/routes";

interface StoryAnalysisPanelProps {
  projectId: string;
}

export function StoryAnalysisPanel({ projectId }: StoryAnalysisPanelProps) {
  const router = useRouter();
  const data = mockStoryAnalysis;

  const sections = [
    { title: "Core Theme", content: data.coreTheme },
    { title: "Emotional Core", content: data.emotionalCore },
    { title: "Story World", content: data.storyWorld },
    { title: "Commercial Angle", content: data.commercialAngle },
    { title: "Audience Promise", content: data.audiencePromise },
    { title: "Visual World", content: data.visualWorld },
    { title: "Pitch Positioning", content: data.pitchPositioning },
  ];

  return (
    <div className="space-y-8">
      <SectionCard title="Genre DNA">
        <div className="flex flex-wrap gap-2">
          {data.genreDna.map((g) => (
            <span
              key={g}
              className="rounded-full border border-accent-gold/30 bg-accent-gold/10 px-3 py-1 text-sm text-accent-gold"
            >
              {g}
            </span>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 md:grid-cols-2">
        {sections.map((section) => (
          <SectionCard key={section.title} title={section.title}>
            <p className="text-sm leading-relaxed text-text-muted">{section.content}</p>
          </SectionCard>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={() => router.push(projectRoutes.outline(projectId))}>
          Generate Deck Outline
        </Button>
      </div>
    </div>
  );
}
