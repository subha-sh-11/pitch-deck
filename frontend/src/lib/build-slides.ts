import { DEFAULT_SLIDE_APPEARANCE } from "@/lib/slide-appearance";
import type { PitchTemplate } from "@/types/template";
import type { Slide, SlideContent, SlideType } from "@/types/slide";
import type { IntakeFormData } from "@/types/workflow";

const DEFAULT_IMAGE_PROMPT =
  "A dark cinematic rooftop water tank, concrete texture, moss green stains, rust edges, water reflection, thin beam of light, survival thriller mood.";

export function contentForSlideType(
  slideType: SlideType,
  form: IntakeFormData,
): SlideContent {
  switch (slideType) {
    case "cover":
      return {
        heading: form.title.toUpperCase() || "UNTITLED",
        subheading: form.tagline,
        body: "A contained Telugu survival thriller about childhood friendship, parental fear, and a rooftop danger hiding in plain sight.",
        footer: "Written & Directed by Ashok Ram",
      };
    case "logline":
      return { heading: "Logline", body: form.logline };
    case "genre_blend": {
      const genres = form.genreBlend
        .split(/[+,&]/)
        .map((g) => g.trim())
        .filter(Boolean)
        .slice(0, 3);
      const descriptions = [
        "A race against rising water and disappearing air.",
        "Parents search helplessly while the truth stays above them.",
        "Mischief, friendship, and innocence make the danger hit harder.",
      ];
      return {
        heading: "Genre Blend",
        items: genres.map((title, i) => ({
          title,
          description: descriptions[i] ?? form.tone,
        })),
      };
    }
    case "synopsis":
      return {
        heading: "Synopsis",
        body: `${form.synopsis}\n\nWhile the city searches below, parents confront guilt, fear, and the emotional distance that made them miss what was right above them.`,
      };
    case "story_world":
      return {
        heading: "Story World",
        body: form.storyWorld,
        items: [
          { title: "Rooftop Water Tank", description: "The silent villain above the city" },
          { title: "Apartment Corridors", description: "Claustrophobic urban maze" },
          { title: "Family Homes", description: "Emotional anchor and guilt" },
          { title: "City Search", description: "Desperate scale, wrong direction" },
        ],
      };
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
        heading: "Unique Selling Points",
        bullets: [
          "Low-budget high-impact contained thriller",
          "Child heroes with immediate audience empathy",
          "Contained survival premise",
          "Strong family emotional payoff",
          "OTT-friendly survival tension",
        ],
      };
    case "show_cross":
      return {
        heading: "Show Cross",
        body: "Fall meets Helen with the emotional survival intensity of Manjummel Boys.",
        comps: form.showCross
          .split(/[,×x]/)
          .map((c) => c.trim())
          .filter(Boolean)
          .slice(0, 3)
          .map((title) => ({
            title,
            note:
              title.toLowerCase().includes("fall")
                ? "Vertigo dread and contained height tension."
                : title.toLowerCase().includes("helen")
                  ? "Parental search drama with ticking urgency."
                  : "Friendship under survival pressure.",
          })),
      };
    case "visual_aesthetic":
      return {
        heading: "Visual Aesthetic",
        body: form.visualAesthetic || form.designDirection,
        moodBlocks: [
          { label: "Concrete", color: "#2A2A2A" },
          { label: "Water", color: "#A9C6C7" },
          { label: "Rust", color: "#8A4B2A" },
          { label: "Moss Green", color: "#3F5F4A" },
          { label: "Narrow Light", color: "#67e8f9" },
          { label: "Rooftop Isolation", color: "#1a1a1f" },
        ],
      };
    case "target_audience":
      return {
        heading: "Target Audience",
        items: [
          { title: "Family Audience", description: "Emotional payoff with universal parental stakes" },
          { title: "Thriller Viewers", description: "Contained survival tension with escalating dread" },
          { title: "Telugu Urban Viewers", description: "Hyderabad apartment world with regional authenticity" },
          { title: "OTT Survival Drama", description: "Bingeable tension with strong emotional resolution" },
        ],
      };
    case "budget":
      return {
        heading: "Budget & Production Scale",
        body: "Estimated range: ₹8–15 crore. Single primary location (apartment + rooftop tank). 45–55 shooting days.",
        bullets: ["Single-location production", "Limited night exteriors", "Modular tank set build"],
      };
    case "market_potential":
      return {
        heading: "Market Potential",
        items: [
          { title: "Contained production scale", description: form.releaseFit },
          { title: "OTT-friendly tension", description: "Bingeable survival arc with emotional climax" },
          { title: "Strong emotional payoff", description: "Family reconciliation drives word-of-mouth" },
          { title: "Regional authenticity", description: "Telugu urban world with pan-India subtitle appeal" },
        ],
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
        subheading: `${form.title} — Feature Film Pitch Deck`,
        body: "director@thetankfilm.com · Ready for producer conversations.",
        footer: "Let's bring this story to screen.",
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
  const layoutTypes: Partial<Record<SlideType, string>> = {
    cover: "cinematic_cover",
    logline: "centered_statement",
    genre_blend: "three_column",
    synopsis: "split_image_text",
    story_world: "location_grid",
    character: "character_cards",
    usp: "grid",
    show_cross: "comp_cards",
    visual_aesthetic: "moodboard",
    target_audience: "segments",
    market_potential: "investor_cards",
    contact: "minimal",
  };

  return {
    id: id ?? `slide-${slideNumber}-${outline.slideType}-${Date.now()}`,
    slideNumber,
    slideType: outline.slideType,
    title: outline.title,
    purpose: outline.purpose,
    content: contentForSlideType(outline.slideType, form),
    layout: {
      template: outline.slideType,
      layoutType: layoutTypes[outline.slideType] ?? "auto",
    },
    status: "design_generated",
    imagePrompt: DEFAULT_IMAGE_PROMPT,
    appearance: { ...DEFAULT_SLIDE_APPEARANCE },
    speakerNotes: "",
    comments: [],
    transition: "Fade",
  };
}

export function renumberSlides(slides: Slide[]): Slide[] {
  return slides.map((s, i) => ({ ...s, slideNumber: i + 1 }));
}
