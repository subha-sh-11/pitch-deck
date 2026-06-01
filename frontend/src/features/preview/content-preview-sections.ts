import { mockIntakeDefaults } from "@/lib/mock/mock-deck";
import type { IntakeFormData } from "@/types/workflow";

export type ContentPreviewSectionId =
  | "identity"
  | "story"
  | "characters"
  | "pitch"
  | "visual";

export interface ContentPreviewField {
  key: keyof IntakeFormData;
  label: string;
  multiline?: boolean;
  placeholder?: string;
}

export interface ContentPreviewSection {
  id: ContentPreviewSectionId;
  label: string;
  description: string;
  fields: ContentPreviewField[];
}

export const CONTENT_PREVIEW_SECTIONS: ContentPreviewSection[] = [
  {
    id: "identity",
    label: "Project Identity",
    description: "Core identity extracted from your setup and script.",
    fields: [
      { key: "title", label: "Title" },
      { key: "tagline", label: "Tagline" },
      { key: "logline", label: "Logline", multiline: true },
      { key: "genreBlend", label: "Genre Blend", multiline: true },
      { key: "tone", label: "Tone", multiline: true },
    ],
  },
  {
    id: "story",
    label: "Story Summary",
    description: "Narrative foundation for the deck.",
    fields: [
      { key: "synopsis", label: "Synopsis", multiline: true },
      { key: "storyWorld", label: "Story World", multiline: true },
      {
        key: "keyScenes",
        label: "Key Locations",
        multiline: true,
        placeholder: "Rooftop, apartment community, water tank…",
      },
    ],
  },
  {
    id: "characters",
    label: "Characters",
    description: "Who drives the story and how they connect.",
    fields: [
      { key: "mainCharacters", label: "Main Characters", multiline: true },
      {
        key: "characterDynamics",
        label: "Character Relationship Dynamics",
        multiline: true,
      },
    ],
  },
  {
    id: "pitch",
    label: "Pitch Positioning",
    description: "How the project is positioned for buyers and partners.",
    fields: [
      { key: "usp", label: "USP / Unique Selling Points", multiline: true },
      { key: "showCross", label: "Show Cross / Comparable Films", multiline: true },
      { key: "targetAudience", label: "Target Audience", multiline: true },
      { key: "releaseFit", label: "Release Fit", multiline: true },
    ],
  },
  {
    id: "visual",
    label: "Visual Direction",
    description: "Look and feel that will inform slide design.",
    fields: [
      { key: "visualAesthetic", label: "Visual Aesthetic", multiline: true },
      { key: "colorPalette", label: "Color Palette Direction", multiline: true },
      { key: "textureStyle", label: "Texture / Background Style", multiline: true },
      { key: "designDirection", label: "Initial Design Direction", multiline: true },
    ],
  },
];

const SECTION_REGENERATE_KEYS: Record<
  ContentPreviewSectionId,
  (keyof IntakeFormData)[]
> = {
  identity: ["title", "tagline", "logline", "genreBlend", "tone"],
  story: ["synopsis", "storyWorld", "keyScenes"],
  characters: ["mainCharacters", "characterDynamics"],
  pitch: ["usp", "showCross", "targetAudience", "releaseFit"],
  visual: ["visualAesthetic", "colorPalette", "textureStyle", "designDirection"],
};

export function getSectionRegeneratePatch(
  sectionId: ContentPreviewSectionId,
): Partial<IntakeFormData> {
  const keys = SECTION_REGENERATE_KEYS[sectionId];
  const patch: Partial<IntakeFormData> = {};
  for (const key of keys) {
    patch[key] = mockIntakeDefaults[key];
  }
  return patch;
}

export function enrichVisualFromTemplate(
  form: IntakeFormData,
  templatePalette: string,
  templateMood: string,
  templateVisualStyle: string[],
): Partial<IntakeFormData> {
  const patch: Partial<IntakeFormData> = {};
  if (!form.colorPalette.trim()) {
    patch.colorPalette = templatePalette;
  }
  if (!form.visualAesthetic.trim()) {
    patch.visualAesthetic = templateVisualStyle.join(", ");
  }
  if (!form.designDirection.trim()) {
    patch.designDirection = templateMood;
  }
  if (!form.textureStyle.trim()) {
    patch.textureStyle = "Textured backgrounds, subtle film grain, cinematic negative space";
  }
  return patch;
}
