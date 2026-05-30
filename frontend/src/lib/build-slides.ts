import type { PitchTemplate } from "@/types/template";
import type { Slide, SlideContent, SlideType } from "@/types/slide";
import type { IntakeFormData } from "@/types/workflow";

export function contentForSlideType(
  slideType: SlideType,
  form: IntakeFormData,
): SlideContent {
  switch (slideType) {
    case "cover":
      return {
        heading: form.title.toUpperCase() || "UNTITLED",
        subheading: form.tagline,
        body: form.logline,
      };
    case "logline":
      return { heading: "Logline", body: form.logline };
    case "genre_blend":
      return {
        heading: "Genre Blend",
        items: form.genreBlend
          .split(/[+,&]/)
          .map((g) => g.trim())
          .filter(Boolean)
          .slice(0, 3)
          .map((title) => ({
            title,
            description: form.tone,
          })),
      };
    case "synopsis":
      return { heading: "Synopsis", body: form.synopsis };
    case "story_world":
      return { heading: "Story World", body: form.storyWorld };
    case "character":
    case "supporting_characters":
      return {
        heading: slideType === "character" ? "Main Characters" : "Supporting Characters",
        characters: form.mainCharacters
          .split(/[.;]/)
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 3)
          .map((line) => {
            const parts = line.split("—").map((p) => p.trim());
            return {
              name: parts[0] || "Character",
              role: parts[1] || "Lead",
              description: parts[2] || form.characterDynamics,
            };
          }),
      };
    case "usp":
      return {
        heading: "USP",
        bullets: form.usp
          .split(/[.;]/)
          .map((b) => b.trim())
          .filter(Boolean)
          .slice(0, 5),
      };
    case "show_cross":
      return {
        heading: "Show Cross",
        comps: form.showCross
          .split(/[,×x]/)
          .map((c) => c.trim())
          .filter(Boolean)
          .slice(0, 3)
          .map((title) => ({ title, note: form.targetAudience })),
      };
    case "visual_aesthetic":
      return {
        heading: "Visual Aesthetic",
        body: form.visualAesthetic || form.designDirection,
        moodBlocks: [
          { label: "Concrete", color: "#2A2A2A" },
          { label: "Moss", color: "#3F5F4A" },
          { label: "Rust", color: "#8A4B2A" },
          { label: "Gold", color: "#E2B15C" },
        ],
      };
    case "target_audience":
      return {
        heading: "Target Audience",
        items: [
          { title: "Primary", description: form.targetAudience },
          { title: "Release", description: form.releaseFit },
        ],
      };
    case "budget":
      return {
        heading: "Budget & Production Scale",
        body: "Contained production positioned for strong ROI. Scale aligned with story scope and single-location design.",
      };
    case "market_potential":
      return {
        heading: "Market Potential",
        bullets: [
          form.releaseFit,
          "Regional OTT with pan-India subtitle appeal",
          "Festival craft positioning available",
        ].filter(Boolean),
      };
    case "directors_vision":
      return {
        heading: "Director's Vision",
        body: form.designDirection || form.synopsis,
      };
    case "team":
      return {
        heading: "Team & Production Status",
        body: "Development stage. Key creative attachments in progress.",
      };
    case "contact":
      return {
        heading: "Let's Talk",
        subheading: form.title,
        body: "Ready for producer and investor conversations.",
      };
    default:
      return { heading: "Slide", body: form.synopsis };
  }
}

export function buildSlidesFromTemplate(
  template: PitchTemplate,
  form: IntakeFormData,
): Slide[] {
  const enrichedForm: IntakeFormData = {
    ...form,
    visualAesthetic:
      form.visualAesthetic || template.designDirection.visualStyle.join(", "),
    designDirection: template.designDirection.rationale,
  };

  return template.slideOutline.map((outline, index) =>
    buildSlideFromOutline(outline, enrichedForm, index + 1),
  );
}

export function buildSlideFromOutline(
  outline: {
    slideType: SlideType;
    title: string;
    purpose: string;
  },
  form: IntakeFormData,
  slideNumber: number,
  id?: string,
): Slide {
  return {
    id: id ?? `slide-${slideNumber}-${outline.slideType}-${Date.now()}`,
    slideNumber,
    slideType: outline.slideType,
    title: outline.title,
    purpose: outline.purpose,
    content: contentForSlideType(outline.slideType, form),
    layout: { template: outline.slideType, layoutType: "auto" },
    status: "draft",
  };
}

export function renumberSlides(slides: Slide[]): Slide[] {
  return slides.map((s, i) => ({ ...s, slideNumber: i + 1 }));
}
