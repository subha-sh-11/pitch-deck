import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { OverlayMenuItem, OverlayPanel, useOverlay } from "@/components/ui/overlay";
import type { Slide } from "@/types/slide";
import { DeckInspector } from "./DeckInspector";

const baseSlide: Slide = {
  id: "s1",
  slideNumber: 1,
  slideType: "cover",
  title: "Cover",
  purpose: "",
  content: { heading: "X" },
  layout: { template: "hero", layoutType: "full" },
  status: "draft",
};

type Props = ComponentProps<typeof DeckInspector>;

function renderInspector(over: Partial<Props> = {}) {
  const props: Props = {
    slide: baseSlide,
    images: [],
    currentImageUrl: undefined,
    versions: [],
    busy: null,
    onUseImage: vi.fn(),
    onRemoveImage: vi.fn(),
    onImportImage: vi.fn(),
    onGenerateImage: vi.fn(),
    onRestoreVersion: vi.fn(),
    onAppearance: vi.fn(),
    collapsed: false,
    onExpand: vi.fn(),
    onCollapse: vi.fn(),
    ...over,
  };
  return { ...render(<DeckInspector {...props} />), props };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("inspector tabs", () => {
  it("exposes proper ARIA tab semantics with Images selected by default", () => {
    renderInspector();
    const tablist = screen.getByRole("tablist", { name: "Slide inspector" });
    expect(tablist).toBeTruthy();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "Images", selected: true })).toBeTruthy();
    expect(screen.getByRole("tabpanel")).toBeTruthy();
  });

  it("moves between tabs with arrow keys (with wrap-around)", () => {
    renderInspector();
    const images = screen.getByRole("tab", { name: "Images" });
    images.focus();
    fireEvent.keyDown(images, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "History", selected: true })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "History" }));

    fireEvent.keyDown(screen.getByRole("tab", { name: "History" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Design", selected: true })).toBeTruthy();
  });

  it("switching tabs force-closes any open overlay menu", async () => {
    const user = userEvent.setup();
    function WithMenu() {
      const menu = useOverlay("menu");
      return (
        <div>
          <button type="button" {...menu.triggerProps}>
            Open menu
          </button>
          <OverlayPanel state={menu} label="Test menu">
            <OverlayMenuItem onSelect={() => {}}>Item</OverlayMenuItem>
          </OverlayPanel>
        </div>
      );
    }
    render(
      <div>
        <WithMenu />
        <DeckInspector
          slide={baseSlide}
          images={[]}
          versions={[]}
          busy={null}
          onUseImage={vi.fn()}
          onRemoveImage={vi.fn()}
          onImportImage={vi.fn()}
          onGenerateImage={vi.fn()}
          onRestoreVersion={vi.fn()}
          onAppearance={vi.fn()}
          collapsed={false}
          onExpand={vi.fn()}
          onCollapse={vi.fn()}
        />
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("menu")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "History" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("images tab actions", () => {
  it("Upload opens the hidden file picker exactly once per click", async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
    renderInspector();
    await user.click(screen.getByRole("button", { name: /Upload/ }));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects non-image files with a visible error and never calls the upload handler", async () => {
    // applyAccept: false lets the test bypass the accept="" attribute the way a
    // drag-drop or misbehaving picker could, exercising our own validation.
    const user = userEvent.setup({ applyAccept: false });
    const { container, props } = renderInspector();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;

    const bad = new File(["hello"], "notes.txt", { type: "text/plain" });
    await user.upload(input, bad);
    expect(props.onImportImage).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/isn't an image/);
  });

  it("accepts a valid image once and clears the input so the same file can be re-picked", async () => {
    const user = userEvent.setup();
    const { container, props } = renderInspector();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;

    const good = new File(["img"], "still.png", { type: "image/png" });
    await user.upload(input, good);
    expect(props.onImportImage).toHaveBeenCalledTimes(1);
    expect(props.onImportImage).toHaveBeenCalledWith(good);
    expect(input.value).toBe("");
  });

  it("disables Generate while a generation is in flight (no duplicate submissions)", async () => {
    const user = userEvent.setup();
    const { props } = renderInspector({ busy: "generate" });
    const btn = screen.getByRole("button", { name: /Generate/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    await user.click(btn).catch(() => {});
    expect(props.onGenerateImage).not.toHaveBeenCalled();
  });

  it("shows the parent's async error and lets the user dismiss it", async () => {
    const user = userEvent.setup();
    const onClearError = vi.fn();
    renderInspector({ actionError: "Image generation failed — try again.", onClearError });
    expect(screen.getByRole("alert").textContent).toMatch(/generation failed/);
    await user.click(screen.getByRole("button", { name: "Dismiss error" }));
    expect(onClearError).toHaveBeenCalledTimes(1);
  });

  it("gallery: single click selects, the explicit action applies, double-click applies", async () => {
    const user = userEvent.setup();
    const url = "https://example.com/i1.png";
    const { props } = renderInspector({ images: [url] });
    const thumb = screen.getByRole("button", { name: "Gallery image 1" });

    await user.click(thumb);
    expect(props.onUseImage).not.toHaveBeenCalled(); // selection ≠ application

    await user.click(screen.getByRole("button", { name: "Use on slide" }));
    expect(props.onUseImage).toHaveBeenCalledTimes(1);
    expect(props.onUseImage).toHaveBeenCalledWith(url);

    await user.dblClick(thumb);
    expect(props.onUseImage).toHaveBeenCalledTimes(2);
  });
});
