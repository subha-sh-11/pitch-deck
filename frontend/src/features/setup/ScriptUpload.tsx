"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { mockExtractScript } from "@/lib/mock/mock-script-extract";
import { useSetupWizard } from "./SetupWizardContext";

export function ScriptUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const { updateForm, setExtractedSummary, setScriptUploaded, extractedSummary } =
    useSetupWizard();

  async function handleFile(file: File) {
    setAnalyzing(true);
    try {
      const { data, summary } = await mockExtractScript(file.name);
      updateForm(data);
      setExtractedSummary(summary);
      setScriptUploaded(true);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="mb-8 rounded-2xl border border-dashed border-accent-gold/30 bg-surface-2/40 p-6">
      <h3 className="text-sm font-semibold text-text-primary">Upload script (optional)</h3>
      <p className="mt-1 text-sm text-text-muted">
        PDF, DOCX, or FDX — we&apos;ll extract title, logline, genre, synopsis, characters,
        themes, tone, and more.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.fdx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={analyzing}
          onClick={() => inputRef.current?.click()}
        >
          {analyzing ? "Analyzing script…" : "Choose file"}
        </Button>
        {extractedSummary && (
          <span className="text-xs text-text-dim self-center">
            Loaded: {extractedSummary.fileName}
          </span>
        )}
      </div>

      {extractedSummary && (
        <div className="mt-4 rounded-xl border border-border-glass bg-surface-1 p-4">
          <p className="mb-3 text-xs uppercase tracking-wider text-accent-gold">
            Extracted from script
          </p>
          <div className="flex flex-wrap gap-2">
            {extractedSummary.fields.map((field) => (
              <span
                key={field.label}
                className="rounded-full border border-border-glass bg-surface-2 px-3 py-1 text-xs text-text-muted"
                title={field.value}
              >
                <span className="text-text-dim">{field.label}:</span>{" "}
                {field.value.length > 40 ? `${field.value.slice(0, 40)}…` : field.value}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
