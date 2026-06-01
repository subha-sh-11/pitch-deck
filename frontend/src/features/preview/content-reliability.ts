import type { Slide } from "@/types/slide";
import { slideContentToText } from "./slide-content-utils";

export type ContentReliabilityStatus = "reliable" | "needs_review" | "weak";

export interface ContentReliabilityCheck {
  label: string;
  pass: boolean;
}

export interface ContentReliabilityResult {
  status: ContentReliabilityStatus;
  score: number;
  headline: string;
  summary: string;
  checks: ContentReliabilityCheck[];
  aiSuggestion?: string;
}

const PLACEHOLDER_PATTERN = /^[A-Z]{4,8}$|^(test|lorem|xxx|asdf|zfdgvd)$/i;

function isPlaceholderText(text: string): boolean {
  const t = text.trim();
  if (t.length < 3) return true;
  if (PLACEHOLDER_PATTERN.test(t)) return true;
  if (!/[a-z]/i.test(t) && t.length < 12) return true;
  return false;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function assessSlideContentReliability(slide: Slide): ContentReliabilityResult {
  const heading = slide.content.heading?.trim() ?? "";
  const bodyText = slideContentToText(slide.content);
  const purpose = slide.purpose?.trim() ?? "";

  const checks: ContentReliabilityCheck[] = [
    {
      label: "Heading is clear and meaningful",
      pass: heading.length >= 2 && !isPlaceholderText(heading),
    },
    {
      label: "Body copy is present",
      pass: bodyText.trim().length >= 20,
    },
    {
      label: "Enough detail for this slide type",
      pass: wordCount(bodyText) >= 8 || (slide.content.bullets?.length ?? 0) >= 2,
    },
    {
      label: "Aligns with slide purpose",
      pass:
        purpose.length > 0 &&
        (bodyText.length > 0 || heading.length > 0) &&
        !bodyText.toLowerCase().includes("untitled"),
    },
  ];

  const passed = checks.filter((c) => c.pass).length;
  const score = Math.round((passed / checks.length) * 100);

  const finding = mockFindingForSlide(slide.title);

  let status: ContentReliabilityStatus = "reliable";
  let headline = "Content looks reliable";
  let summary =
    "This slide's copy matches your story and is ready for deck generation.";
  let aiSuggestion: string | undefined;

  if (score < 50 || !checks[0].pass) {
    status = "weak";
    headline = "Content needs attention";
    summary =
      "Heading or body may be missing, placeholder text, or off-topic. Edit or regenerate with AI.";
    aiSuggestion =
      finding?.suggestion ??
      `Regenerate ${slide.title} so the copy clearly supports: ${purpose}`;
  } else if (score < 100 || finding?.status === "needs_work" || finding?.status === "needs_detail") {
    status = "needs_review";
    headline = "Review recommended";
    summary =
      finding?.suggestion ??
      "Copy is usable but could be sharper for investors. Consider a quick edit or AI regenerate.";
    aiSuggestion = `Strengthen ${slide.title} for pitch clarity while keeping: ${purpose}`;
  }

  return { status, score, headline, summary, checks, aiSuggestion };
}

function mockFindingForSlide(title: string) {
  const findings = [
    { slideTitle: "Logline", status: "strong", suggestion: "The hook is clear and immediately visual." },
    { slideTitle: "Synopsis", status: "needs_work", suggestion: "Reduce text density for better pitch readability." },
    { slideTitle: "USP", status: "strong", suggestion: "Low-budget high-impact angle is clear." },
    { slideTitle: "Unique Selling Points", status: "strong", suggestion: "Low-budget high-impact angle is clear." },
    { slideTitle: "Budget", status: "needs_detail", suggestion: "Add approximate production range and feasibility points." },
    { slideTitle: "Budget & Production Scale", status: "needs_detail", suggestion: "Add approximate production range and feasibility points." },
    { slideTitle: "Visual Aesthetic", status: "strong", suggestion: "Visual language is consistent with the story." },
    { slideTitle: "Cover", status: "needs_work", suggestion: "Ensure title and logline match your film identity." },
  ];
  return findings.find((f) => f.slideTitle === title);
}

export function countReliabilitySummary(slides: Slide[]) {
  let reliable = 0;
  let needsReview = 0;
  let weak = 0;
  for (const slide of slides) {
    const r = assessSlideContentReliability(slide);
    if (r.status === "reliable") reliable++;
    else if (r.status === "needs_review") needsReview++;
    else weak++;
  }
  return { reliable, needsReview, weak, total: slides.length };
}
