import type { DesignDirection } from "./design";
import type { Slide, SlideType } from "./slide";
import type { QualityReview } from "./workflow";

export type DeckStatus =
  | "draft"
  | "outline_pending"
  | "content_pending"
  | "design_pending"
  | "ready"
  | "exported";

export interface DeckOutlineItem {
  slideNumber: number;
  title: string;
  purpose: string;
  required: boolean;
  slideType: SlideType;
}

export interface Deck {
  id: string;
  projectId: string;
  slideCount: number;
  status: DeckStatus;
  slides: Slide[];
  designDirection: DesignDirection;
  /** Structural QA over the finished deck (backend quality-review pass). */
  qualityReview?: QualityReview | null;
}
