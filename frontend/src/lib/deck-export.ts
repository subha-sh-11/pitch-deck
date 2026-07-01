// Shared client-side deck export: capture each rendered slide and assemble a PDF / PPTX / PNG zip.
// Export libraries load on demand from a CDN, so the app needs no extra npm dependency.

export const SLIDE_W = 1280;
export const SLIDE_H = 720;

const CDN = {
  html2canvas: "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  jspdf: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  pptxgen: "https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.js",
  jszip: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWin = any;

export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-x="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.x = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

/** Resolve once every <img> inside the container has loaded (or errored), plus a short settle. */
export async function waitForImages(container: HTMLElement): Promise<void> {
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.addEventListener("load", () => res(), { once: true });
            img.addEventListener("error", () => res(), { once: true });
          }),
    ),
  );
  await new Promise((r) => setTimeout(r, 120));
}

export async function captureSlide(el: HTMLElement): Promise<HTMLCanvasElement> {
  await loadScript(CDN.html2canvas);
  const html2canvas = (window as AnyWin).html2canvas;
  return html2canvas(el, {
    useCORS: true,
    backgroundColor: "#0a0a0c",
    scale: 2,
    width: SLIDE_W,
    height: SLIDE_H,
    windowWidth: SLIDE_W,
    windowHeight: SLIDE_H,
  });
}

type OnProgress = (done: number, total: number) => void;

export async function exportPDF(els: HTMLElement[], fileName: string, onProgress?: OnProgress) {
  await loadScript(CDN.jspdf);
  const { jsPDF } = (window as AnyWin).jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [SLIDE_W, SLIDE_H] });
  for (let i = 0; i < els.length; i++) {
    onProgress?.(i + 1, els.length);
    const data = (await captureSlide(els[i])).toDataURL("image/jpeg", 0.92);
    if (i > 0) pdf.addPage([SLIDE_W, SLIDE_H], "landscape");
    pdf.addImage(data, "JPEG", 0, 0, SLIDE_W, SLIDE_H);
  }
  pdf.save(`${fileName}.pdf`);
}

export async function exportPPTX(els: HTMLElement[], fileName: string, onProgress?: OnProgress) {
  await loadScript(CDN.pptxgen);
  const Pptx = (window as AnyWin).PptxGenJS;
  const pptx = new Pptx();
  pptx.defineLayout({ name: "DECK", width: 13.333, height: 7.5 });
  pptx.layout = "DECK";
  for (let i = 0; i < els.length; i++) {
    onProgress?.(i + 1, els.length);
    const data = (await captureSlide(els[i])).toDataURL("image/jpeg", 0.92);
    pptx.addSlide().addImage({ data, x: 0, y: 0, w: 13.333, h: 7.5 });
  }
  await pptx.writeFile({ fileName: `${fileName}.pptx` });
}

export async function exportPNGZip(els: HTMLElement[], fileName: string, onProgress?: OnProgress) {
  await loadScript(CDN.jszip);
  const zip = new (window as AnyWin).JSZip();
  for (let i = 0; i < els.length; i++) {
    onProgress?.(i + 1, els.length);
    const canvas = await captureSlide(els[i]);
    const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b as Blob), "image/png"));
    zip.file(`slide-${String(i + 1).padStart(2, "0")}.png`, blob);
  }
  const out: Blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(out);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}-slides.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/** A filesystem-safe base name from the deck's first heading. */
export function deckFileName(firstHeading?: string): string {
  return (
    String(firstHeading || "pitch-deck")
      .replace(/[^\w-]+/g, "_")
      .slice(0, 60) || "pitch-deck"
  );
}
