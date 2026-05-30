import { buildSlideFromOutline, buildSlidesFromTemplate } from "@/lib/build-slides";
import { getTemplateById } from "@/lib/mock/mock-templates";
import type { Slide, SlideType } from "@/types/slide";
import type { IntakeFormData } from "@/types/workflow";

const REGENERATE_DELAY_MS = 1200;

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function regenerateSingleSlide(
  slide: Slide,
  formData: IntakeFormData,
  templateId: string,
): Promise<Slide> {
  await delay(REGENERATE_DELAY_MS);
  const template = getTemplateById(templateId);
  if (!template) return slide;

  const enrichedForm: IntakeFormData = {
    ...formData,
    visualAesthetic:
      formData.visualAesthetic ||
      template.designDirection.visualStyle.join(", "),
    designDirection: template.designDirection.rationale,
  };

  return buildSlideFromOutline(
    {
      slideType: slide.slideType,
      title: slide.title,
      purpose: slide.purpose,
    },
    enrichedForm,
    slide.slideNumber,
    slide.id,
  );
}

export async function regenerateAllSlides(
  formData: IntakeFormData,
  templateId: string,
): Promise<Slide[]> {
  await delay(REGENERATE_DELAY_MS * 2);
  const template = getTemplateById(templateId);
  if (!template) return [];
  return buildSlidesFromTemplate(template, formData);
}

export const ADDABLE_SLIDE_TYPES: {
  slideType: SlideType;
  title: string;
  purpose: string;
}[] = [
  { slideType: "cover", title: "Cover", purpose: "Title and tone." },
  { slideType: "logline", title: "Logline", purpose: "Story hook." },
  { slideType: "synopsis", title: "Synopsis", purpose: "Story journey." },
  { slideType: "character", title: "Characters", purpose: "Key characters." },
  { slideType: "usp", title: "USP", purpose: "Unique selling points." },
  { slideType: "show_cross", title: "Show Cross", purpose: "Comparable films." },
  { slideType: "visual_aesthetic", title: "Visual Aesthetic", purpose: "Mood and look." },
  { slideType: "target_audience", title: "Target Audience", purpose: "Audience fit." },
  { slideType: "generic", title: "Custom Slide", purpose: "Additional content." },
];
