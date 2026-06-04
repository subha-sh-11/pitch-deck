"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ApiError, extractScript } from "@/lib/api";
import type { IntakeFormData } from "@/types/workflow";
import { useSetupWizard } from "./SetupWizardContext";

// Friendly labels for the intake keys we may auto-fill.
const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  tagline: "Tagline",
  logline: "Logline",
  genreBlend: "Genre Blend",
  tone: "Tone",
  synopsis: "Synopsis",
  storyWorld: "Story World",
  mainCharacters: "Main Characters",
  characterDynamics: "Character Dynamics",
  usp: "USP",
  showCross: "Show Cross",
  targetAudience: "Target Audience",
  releaseFit: "Release Fit",
  visualAesthetic: "Visual Aesthetic",
  colorPalette: "Color Palette",
  textureStyle: "Texture Style",
  designDirection: "Design Direction",
  themes: "Themes",
  keyScenes: "Key Scenes",
  visualMood: "Visual Mood",
};

const labelFor = (key: string) => FIELD_LABELS[key] ?? key;

export function ScriptUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { projectId, updateForm, setExtractedSummary, setScriptUploaded, extractedSummary } =
    useSetupWizard();
  const [status, setStatus] = useState<"idle" | "extracting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setStatus("extracting");
    setError(null);
    try {
      const result = await extractScript(projectId, file);

      // Only overwrite fields the extractor actually populated — never blank out
      // anything the user may have already typed.
      const patch: Partial<IntakeFormData> = {};
      for (const [key, value] of Object.entries(result.form)) {
        if (typeof value === "string" && value.trim()) {
          patch[key as keyof IntakeFormData] = value;
        }
      }
      updateForm(patch);

      setScriptUploaded(true);
      setExtractedSummary({
        fileName: result.fileName,
        fields: result.filledFields.map((key) => ({
          label: labelFor(key),
          value: String(result.form[key] ?? ""),
        })),
      });
      setStatus(result.filledFields.length > 0 ? "done" : "error");
      if (result.filledFields.length === 0) {
        setError("No fields could be extracted. Please fill them in manually below.");
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Could not process this file. Please try again.";
      setError(message);
      setStatus("error");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const extracting = status === "extracting";

  return (
    <div className="mb-8 rounded-2xl border border-dashed border-accent-neon/30 bg-surface-2/40 p-6">
      <h3 className="text-sm font-semibold text-text-primary">Upload script (optional)</h3>
      <p className="mt-1 text-sm text-text-muted">
        PDF, DOCX, FDX, or TXT. We&apos;ll read it and auto-fill the fields below for you to
        review before continuing.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.fdx,.txt"
        className="hidden"
        disabled={extracting}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={extracting}
          onClick={() => inputRef.current?.click()}
        >
          {extracting ? "Extracting…" : "Choose file"}
        </Button>

        {extracting && (
          <span className="flex items-center gap-2 text-xs text-text-muted">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent-neon/30 border-t-accent-neon" />
            Reading your script and filling the form…
          </span>
        )}

        {!extracting && extractedSummary && status === "done" && (
          <span className="text-xs text-accent-neon">
            ✓ Auto-filled {extractedSummary.fields.length} field
            {extractedSummary.fields.length === 1 ? "" : "s"} from{" "}
            <span className="text-text-dim">{extractedSummary.fileName}</span>
          </span>
        )}

        {!extracting && error && (
          <span className="text-xs text-red-400">{error}</span>
        )}
      </div>

      {!extracting && status === "done" && extractedSummary && extractedSummary.fields.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {extractedSummary.fields.map((field) => (
            <div
              key={field.label}
              className="rounded-lg border border-white/[0.06] bg-surface-2/60 px-3 py-2"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-accent-neon">
                {field.label}
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{field.value}</p>
            </div>
          ))}
          <p className="sm:col-span-2 text-xs text-text-dim">
            Review and edit anything below, then continue to the next section.
          </p>
        </div>
      )}
    </div>
  );
}
