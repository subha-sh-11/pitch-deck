"use client";

import { useState } from "react";
import { SectionCard } from "@/components/layout/SectionCard";
import { Button } from "@/components/ui/Button";
import { mockExportHistory, mockQualityReview } from "@/lib/mock/mock-deck";
import { getProjectById } from "@/lib/mock/mock-projects";

interface ExportPanelProps {
  projectId: string;
}

export function ExportPanel({ projectId }: ExportPanelProps) {
  const project = getProjectById(projectId);
  const [message, setMessage] = useState<string | null>(null);

  function handleExport(format: string) {
    setMessage(`Mock ${format} export generated. Real export will be connected later.`);
    setTimeout(() => setMessage(null), 4000);
  }

  return (
    <div className="space-y-8">
      {message && (
        <div className="rounded-xl border border-accent-gold/30 bg-accent-gold/10 px-4 py-3 text-sm text-accent-gold">
          {message}
        </div>
      )}

      <SectionCard title="Deck Summary">
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div><dt className="text-text-dim">Project</dt><dd className="text-text-primary">{project.title}</dd></div>
          <div><dt className="text-text-dim">Slides</dt><dd className="text-text-primary">16</dd></div>
          <div><dt className="text-text-dim">Format</dt><dd className="text-text-primary">16:9</dd></div>
          <div><dt className="text-text-dim">Status</dt><dd className="text-text-primary">Ready for export</dd></div>
          <div><dt className="text-text-dim">Last reviewed</dt><dd className="text-text-primary">{mockQualityReview.overallReadiness}%</dd></div>
        </dl>
      </SectionCard>

      <div className="grid gap-6 md:grid-cols-3">
        <SectionCard title="PDF Export">
          <p className="mb-4 text-sm text-text-muted">
            Best for sharing with producers, investors, and studios.
          </p>
          <Button onClick={() => handleExport("PDF")} className="w-full">
            Export PDF
          </Button>
        </SectionCard>
        <SectionCard title="PowerPoint Export">
          <p className="mb-4 text-sm text-text-muted">
            Best for editable pitch conversations and last-minute changes.
          </p>
          <Button onClick={() => handleExport("PPTX")} variant="secondary" className="w-full">
            Export PPTX
          </Button>
        </SectionCard>
        <SectionCard title="Shareable Preview">
          <p className="mb-4 text-sm text-text-muted">
            Coming soon: hosted deck link for controlled sharing.
          </p>
          <Button disabled className="w-full opacity-50">
            Coming Soon
          </Button>
        </SectionCard>
      </div>

      <SectionCard title="Export History">
        <ul className="space-y-2">
          {mockExportHistory.map((file) => (
            <li key={file} className="text-sm text-text-muted">{file}</li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
