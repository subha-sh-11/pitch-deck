"use client";

/**
 * Data-driven deck export (no DOM screenshotting — that proved unreliable with cross-origin
 * images and container-query layouts). Each slide is rebuilt directly in the PDF/PPTX:
 * the generated image full-bleed, a legibility scrim, then the slide's text drawn as real
 * vector text — so the PPTX is genuinely editable and nothing comes out blank.
 */
import jsPDF from "jspdf";
import PptxGenJS from "pptxgenjs";
import { formatSlidePreviewBlocks } from "@/features/preview/format-slide-content";
import type { DesignDirection } from "@/types/design";
import type { Slide } from "@/types/slide";

export type ExportFormat = "pdf" | "pptx";

export function deckFileName(slides: Slide[]): string {
  const cover = slides.find((s) => s.slideType === "cover");
  const raw = cover?.content?.heading?.trim() || "pitch-deck";
  return (
    raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) ||
    "pitch-deck"
  );
}

// ── Theme helpers (mirror SlideRenderer's palette → accent/text logic) ──────────────
function byUsage(dd: DesignDirection | undefined, kw: string): string | undefined {
  return dd?.palette?.find((c) => (c.usage ?? "").toLowerCase().includes(kw))?.hex;
}
function accentHex(dd?: DesignDirection): string {
  return (
    byUsage(dd, "accent") ??
    byUsage(dd, "highlight") ??
    dd?.palette?.[Math.min(2, (dd.palette.length || 1) - 1)]?.hex ??
    "#C99A3D"
  );
}
const hex = (c: string) => c.replace("#", "").slice(0, 6).padStart(6, "0");

// ── Per-slide text model ────────────────────────────────────────────────────────────
interface SlideText {
  title: string;
  blocks: { label: string; value: string }[];
}
function slideText(slide: Slide): SlideText {
  const title = (slide.content.heading || "").trim();
  const blocks = formatSlidePreviewBlocks(slide).filter(
    (b) => b.value && b.label.toLowerCase() !== "title",
  );
  return { title, blocks };
}

/** Fetch an asset image as a data URL (JPEG/PNG only; SVG placeholders are skipped). */
async function imageDataUrl(url?: string): Promise<{ data: string; fmt: "JPEG" | "PNG" } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors", cache: "no-cache" });
    const blob = await res.blob();
    if (blob.type.includes("svg") || (!blob.type.includes("jpeg") && !blob.type.includes("png"))) {
      return null; // can't embed SVG/other → fall back to a dark ground
    }
    const data = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    return { data, fmt: blob.type.includes("png") ? "PNG" : "JPEG" };
  } catch {
    return null;
  }
}

// ── PDF (points; 16:9 = 960×540) ──────────────────────────────────────────────────────
const PDF_W = 960;
const PDF_H = 540;

async function buildPdf(
  slides: Slide[],
  design: DesignDirection | undefined,
  fileName: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: [PDF_W, PDF_H] });
  const accent = accentHex(design);
  const [ar, ag, ab] = [0, 2, 4].map((i) => parseInt(hex(accent).slice(i, i + 2), 16));

  for (let i = 0; i < slides.length; i++) {
    if (i > 0) pdf.addPage([PDF_W, PDF_H], "landscape");
    const img = await imageDataUrl(slides[i].content.imageUrl);
    // Ground
    pdf.setFillColor(10, 10, 12);
    pdf.rect(0, 0, PDF_W, PDF_H, "F");
    if (img) pdf.addImage(img.data, img.fmt, 0, 0, PDF_W, PDF_H, undefined, "FAST");
    // Uniform full-bleed scrim for legibility (no hard edge / seam).
    pdf.setFillColor(0, 0, 0);
    pdf.setGState(new (pdf as unknown as { GState: new (o: object) => unknown }).GState({ opacity: 0.45 }));
    pdf.rect(0, 0, PDF_W, PDF_H, "F");
    pdf.setGState(new (pdf as unknown as { GState: new (o: object) => unknown }).GState({ opacity: 1 }));

    const { title, blocks } = slideText(slides[i]);
    const x = PDF_W * 0.07;
    const maxW = PDF_W * 0.5;
    let y = PDF_H * 0.26;

    if (title) {
      pdf.setTextColor(ar, ag, ab);
      pdf.setFont("times", "bold");
      pdf.setFontSize(28);
      for (const line of pdf.splitTextToSize(title, maxW)) {
        pdf.text(line, x, y);
        y += 32;
      }
      y += 8;
    }
    for (const b of blocks) {
      if (y > PDF_H - 40) break;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(ar, ag, ab);
      pdf.text(b.label.toUpperCase(), x, y);
      y += 14;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(220, 224, 230);
      for (const line of pdf.splitTextToSize(b.value, maxW)) {
        if (y > PDF_H - 28) break;
        pdf.text(line, x, y);
        y += 14;
      }
      y += 10;
    }
    onProgress?.(i + 1, slides.length);
  }
  pdf.save(`${fileName}.pdf`);
}

// ── PPTX (inches; 16:9 = 13.333×7.5) ───────────────────────────────────────────────────
const IN_W = 13.333;
const IN_H = 7.5;

async function buildPptx(
  slides: Slide[],
  design: DesignDirection | undefined,
  fileName: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "PD169", width: IN_W, height: IN_H });
  pptx.layout = "PD169";
  const accent = hex(accentHex(design));

  for (let i = 0; i < slides.length; i++) {
    const s = pptx.addSlide();
    s.background = { color: "0A0A0C" };
    const img = await imageDataUrl(slides[i].content.imageUrl);
    if (img) s.addImage({ data: img.data, x: 0, y: 0, w: IN_W, h: IN_H });
    // Uniform full-bleed scrim for legibility (no hard edge / seam).
    s.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: IN_W, h: IN_H,
      fill: { color: "000000", transparency: 55 },
    });

    const { title, blocks } = slideText(slides[i]);
    const tx = 0.9;
    const tw = IN_W * 0.5;
    let y = 1.4;
    if (title) {
      s.addText(title, {
        x: tx, y, w: tw, h: 1, fontSize: 30, bold: true, color: accent,
        fontFace: "Georgia", align: "left", valign: "top",
      });
      y += 0.5 + 0.32 * Math.ceil(title.length / 26);
    }
    // Editable text boxes — one per block (label + value).
    for (const b of blocks) {
      if (y > IN_H - 0.6) break;
      const h = Math.min(2, 0.3 + 0.22 * Math.ceil(b.value.length / 60));
      s.addText(
        [
          { text: `${b.label.toUpperCase()}\n`, options: { bold: true, color: accent, fontSize: 11 } },
          { text: b.value, options: { color: "DCE0E6", fontSize: 12 } },
        ],
        { x: tx, y, w: tw, h, align: "left", valign: "top" },
      );
      y += h + 0.12;
    }
    onProgress?.(i + 1, slides.length);
  }
  await pptx.writeFile({ fileName: `${fileName}.pptx` });
}

/** Download the deck in the requested format. */
export async function exportDeck(
  format: ExportFormat,
  slides: Slide[],
  design: DesignDirection | undefined,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (!slides.length) return;
  const fileName = deckFileName(slides);
  if (format === "pdf") await buildPdf(slides, design, fileName, onProgress);
  else await buildPptx(slides, design, fileName, onProgress);
}
