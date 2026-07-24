import type { ReactNode } from "react";

interface SplitLayoutProps {
  imageUrl?: string;
  /** Side the image sits on (default "right"). */
  imageSide?: "left" | "right";
  /** Inset the image as a bordered, shadowed block instead of filling its half. */
  framed?: boolean;
  /** The slide's text content, placed in the opposite half. */
  children: ReactNode;
}

/**
 * Two-column composition: the slide's image on one side, its text on the other. Rendered INSIDE
 * SlideFrame (which supplies the base background + editing layers), so it sits over the deck's
 * theme ground. `framed` turns the image into an inset, bordered block (a "framed photo").
 */
export function SplitLayout({ imageUrl, imageSide = "right", framed = false, children }: SplitLayoutProps) {
  const imagePanel = (
    <div className={`relative h-full w-1/2 shrink-0 ${framed ? "p-[5%]" : ""}`}>
      {imageUrl ? (
        <div
          className={`relative h-full w-full overflow-hidden ${
            framed ? "rounded-lg border border-white/15 shadow-2xl" : ""
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        </div>
      ) : (
        <div
          className="h-full w-full"
          style={{
            background: "color-mix(in srgb, var(--slide-accent,#caa86a) 12%, var(--slide-bg,#0a0a0c))",
          }}
        />
      )}
    </div>
  );
  const textPanel = (
    <div className="flex h-full w-1/2 flex-col justify-center p-[calc(8%_+_var(--slide-pad-delta,0%))]">
      {children}
    </div>
  );

  return (
    <div className="absolute inset-0 flex">
      {imageSide === "left" ? (
        <>
          {imagePanel}
          {textPanel}
        </>
      ) : (
        <>
          {textPanel}
          {imagePanel}
        </>
      )}
    </div>
  );
}
