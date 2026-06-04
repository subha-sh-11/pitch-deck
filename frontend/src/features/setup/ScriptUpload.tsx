"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { useSetupWizard } from "./SetupWizardContext";

export function ScriptUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { setExtractedSummary, setScriptUploaded, extractedSummary } = useSetupWizard();

  function handleFile(file: File) {
    // Backend script ingestion (auto-extraction) is not wired yet — accept the file
    // and let the user fill the fields manually. No fabricated data is injected.
    setScriptUploaded(true);
    setExtractedSummary({ fileName: file.name, fields: [] });
  }

  return (
    <div className="mb-8 rounded-2xl border border-dashed border-accent-neon/30 bg-surface-2/40 p-6">
      <h3 className="text-sm font-semibold text-text-primary">Upload script (optional)</h3>
      <p className="mt-1 text-sm text-text-muted">
        PDF, DOCX, or FDX. Automatic extraction is coming soon — for now, please fill the
        fields below.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.fdx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          Choose file
        </Button>
        {extractedSummary && (
          <span className="text-xs text-text-dim self-center">
            Loaded: {extractedSummary.fileName}
          </span>
        )}
      </div>
    </div>
  );
}
