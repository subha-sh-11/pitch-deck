import { mockIntakeDefaults } from "./mock-deck";
import type { ExtractedScriptSummary } from "@/types/setup";
import type { IntakeFormData } from "@/types/workflow";

const EXTRACT_DELAY_MS = 1800;

export function mockExtractScript(fileName: string): Promise<{
  data: Partial<IntakeFormData>;
  summary: ExtractedScriptSummary;
}> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const data: Partial<IntakeFormData> = {
        ...mockIntakeDefaults,
        visualAesthetic:
          mockIntakeDefaults.visualMood || mockIntakeDefaults.visualAesthetic,
      };
      const summary: ExtractedScriptSummary = {
        fileName,
        fields: [
          { label: "Title", value: data.title ?? "" },
          { label: "Logline", value: data.logline ?? "" },
          { label: "Genre", value: data.genreBlend ?? "" },
          { label: "Synopsis", value: (data.synopsis ?? "").slice(0, 100) + "…" },
          { label: "Characters", value: data.mainCharacters ?? "" },
          { label: "Themes", value: data.themes ?? "" },
          { label: "Tone", value: data.tone ?? "" },
          { label: "USPs", value: (data.usp ?? "").slice(0, 80) + "…" },
          { label: "Target Audience", value: data.targetAudience ?? "" },
          { label: "Visual Mood", value: data.visualMood ?? "" },
          {
            label: "Key Scenes",
            value: data.keyScenes ?? "",
          },
        ],
      };
      resolve({ data, summary });
    }, EXTRACT_DELAY_MS);
  });
}
