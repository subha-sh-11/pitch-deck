import type { Deck } from "@/types/deck";
import type { Slide, SlideContent, SlideStatus } from "@/types/slide";
import { apiFetch } from "./client";

export const getDeck = (projectId: string) =>
  apiFetch<Deck>(`/projects/${projectId}/deck`);

export interface SlideUpdateInput {
  title?: string;
  content?: Partial<SlideContent>;
  status?: SlideStatus;
}

export const updateSlide = (slideId: string, data: SlideUpdateInput) =>
  apiFetch<Slide>(`/slides/${slideId}`, { method: "PATCH", body: JSON.stringify(data) });
