import type { DeckOutlineItem } from "@/types/deck";
import { apiFetch } from "./client";

/** Template catalog entry from the backend (design is generated per-project, not bundled). */
export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  slideCount: number;
  matchTags: string[];
  slideOutline: DeckOutlineItem[];
}

export const listTemplates = () => apiFetch<TemplateSummary[]>("/templates");
