import type { DeckOutlineItem } from "./deck";
import type { DesignDirection } from "./design";

export interface PitchTemplate {
  id: string;
  name: string;
  description: string;
  slideCount: number;
  slideOutline: DeckOutlineItem[];
  designDirection: DesignDirection;
  matchTags: string[];
}
