"use client";

import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/layout/SectionCard";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { mockIntakeAnalysis } from "@/lib/mock/mock-deck";
import { projectRoutes } from "@/lib/routes";

interface QuestionsPanelProps {
  projectId: string;
}

export function QuestionsPanel({ projectId }: QuestionsPanelProps) {
  const router = useRouter();
  const data = mockIntakeAnalysis;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
          <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#1a1a1f" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="#e2b15c"
              strokeWidth="8"
              strokeDasharray={`${data.completenessScore * 2.64} 264`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute text-xl font-semibold text-accent-gold">
            {data.completenessScore}%
          </span>
        </div>
        <div>
          <h3 className="font-semibold text-text-primary">Completeness Score</h3>
          <p className="text-sm text-text-muted">
            The system reviewed your story input and found pitch-critical gaps.
          </p>
        </div>
      </div>

      <SectionCard title="Detected Story Signals">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.detectedSignals.map((signal) => (
            <div key={signal.label} className="rounded-xl bg-surface-2 p-4">
              <p className="text-xs text-text-dim">{signal.label}</p>
              <p className="mt-1 text-sm font-medium text-text-primary">{signal.value}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Missing Details">
        <ul className="space-y-2">
          {data.missingDetails.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-text-muted">
              <span className="text-accent-rust">!</span>
              {item}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Smart Follow-up Questions">
        <div className="space-y-6">
          {data.followUpQuestions.map((q, i) => (
            <div key={q.question}>
              <p className="mb-2 text-sm font-medium text-text-primary">
                {i + 1}. {q.question}
              </p>
              <Textarea placeholder={q.placeholder} rows={2} />
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button onClick={() => router.push(projectRoutes.storyAnalysis(projectId))}>
          Continue to Story Analysis
        </Button>
      </div>
    </div>
  );
}
