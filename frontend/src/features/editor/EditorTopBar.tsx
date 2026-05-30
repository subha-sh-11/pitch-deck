"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { getProjectById } from "@/lib/mock/mock-projects";
import { projectRoutes } from "@/lib/routes";

interface EditorTopBarProps {
  projectId: string;
  onReview: () => void;
  onExport: (format: "PDF" | "PPTX") => void;
}

export function EditorTopBar({ projectId, onReview, onExport }: EditorTopBarProps) {
  const project = getProjectById(projectId);
  const [exportOpen, setExportOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function handleExport(format: "PDF" | "PPTX") {
    onExport(format);
    setMessage(`Mock ${format} export generated.`);
    setExportOpen(false);
    setTimeout(() => setMessage(null), 3000);
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-glass bg-surface-1 px-4">
      <div className="flex items-center gap-4">
        <Link
          href={projectRoutes.dashboard()}
          className="font-display text-sm font-semibold text-text-primary hover:text-accent-gold"
        >
          Pitch Deck Studio
        </Link>
        <span className="text-text-dim">|</span>
        <span className="text-sm text-text-muted">{project.title}</span>
      </div>

      <div className="flex items-center gap-2">
        {message && (
          <span className="mr-2 text-xs text-accent-gold">{message}</span>
        )}
        <Button variant="ghost" size="sm" onClick={onReview}>
          Review
        </Button>
        <div className="relative">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setExportOpen(!exportOpen)}
          >
            Export
          </Button>
          {exportOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-xl border border-border-glass bg-surface-2 py-1 shadow-xl">
              <button
                type="button"
                className="block w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-surface-3"
                onClick={() => handleExport("PDF")}
              >
                Export PDF
              </button>
              <button
                type="button"
                className="block w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-surface-3"
                onClick={() => handleExport("PPTX")}
              >
                Export PPTX
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
