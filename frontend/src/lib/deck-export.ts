// Shared client-side deck export: capture each rendered slide and assemble a PDF / PPTX / PNG zip.
// Export libraries load on demand from a CDN, so the app needs no extra npm dependency.

export const SLIDE_W = 1280;
export const SLIDE_H = 720;

const CDN = {
  // html-to-image renders through the browser's own engine (SVG foreignObject), so modern CSS
  // like Tailwind v4's oklch()/oklab() colours works — html2canvas 1.4.1 crashes on them.
  htmlToImage: "https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js",
  jspdf: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  // pptxgenjs isn't reliably on cdnjs — use jsDelivr's canonical dist bundle (exposes PptxGenJS).
  pptxgen: "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js",
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

/** Replace every <img> src with a same-origin data URI so html2canvas can't taint the canvas.
 *  (Cross-origin images — even CORS-enabled — taint if the browser cached a non-CORS copy.) */
async function inlineImages(el: HTMLElement): Promise<void> {
  const imgs = Array.from(el.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith("data:")) return;
      try {
        const res = await fetch(src, { mode: "cors", cache: "reload" });
        const blob = await res.blob();
        const dataUrl: string = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result as string);
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
        img.src = dataUrl;
        img.removeAttribute("srcset");
      } catch {
        /* leave the original src — worst case that one image is blank in the export */
      }
    }),
  );
  // Wait for the swapped data-URI images to (re)load before capturing.
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
}

export async function captureSlide(el: HTMLElement): Promise<HTMLCanvasElement> {
  await loadScript(CDN.htmlToImage);
  await inlineImages(el); // convert cross-origin images to data URIs first (prevents taint)
  const htmlToImage = (window as AnyWin).htmlToImage;
  return htmlToImage.toCanvas(el, {
    pixelRatio: 2,
    width: SLIDE_W,
    height: SLIDE_H,
    backgroundColor: "#0a0a0c",
    cacheBust: true,
    // Custom display fonts (e.g. Canela) 404 in dev; don't let a font fetch abort the whole capture.
    skipFonts: false,
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
