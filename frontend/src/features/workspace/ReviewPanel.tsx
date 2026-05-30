"use client";

import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/layout/SectionCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { mockQualityReview } from "@/lib/mock/mock-deck";
import { projectRoutes } from "@/lib/routes";

interface ReviewPanelProps {
  projectId: string;
}

const statusVariant = {
  strong: "success" as const,
  needs_work: "warning" as const,
  needs_detail: "warning" as const,
};

const statusLabel = {
  strong: "Strong",
  needs_work: "Needs tightening",
  needs_detail: "Needs detail",
};

export function ReviewPanel({ projectId }: ReviewPanelProps) {
  const router = useRouter();
  const data = mockQualityReview;

  const scores = [
    { label: "Overall Deck Readiness", value: data.overallReadiness },
    { label: "Content Clarity", value: data.contentClarity },
    { label: "Visual Consistency", value: data.visualConsistency },
    { label: "Investor Readiness", value: data.investorReadiness },
    { label: "Export Readiness", value: data.exportReadiness },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {scores.map((score) => (
          <SectionCard key={score.label} title={score.label}>
            <p className="font-display text-3xl font-semibold text-accent-gold">
              {score.value}%
            </p>
          </SectionCard>
        ))}
      </div>

      <SectionCard title="Slide-wise Suggestions">
        <div className="space-y-4">
          {data.findings.map((finding) => (
            <div
              key={finding.slideTitle}
              className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border-glass p-4"
            >
              <div>
                <h4 className="font-medium text-text-primary">{finding.slideTitle}</h4>
                <p className="mt-1 text-sm text-text-muted">{finding.suggestion}</p>
              </div>
              <Badge variant={statusVariant[finding.status]}>
                {statusLabel[finding.status]}
              </Badge>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="flex flex-wrap justify-end gap-4">
        <Button variant="secondary" href={projectRoutes.editor(projectId)}>
          Back to Editor
        </Button>
        <Button onClick={() => router.push(projectRoutes.export(projectId))}>
          Go to Export
        </Button>
      </div>
    </div>
  );
}
