import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { closeAllOverlays, OverlayMenuItem, OverlayPanel, useOverlay } from "./overlay";

function DemoMenu({ name, onPick = () => {} }: { name: string; onPick?: () => void }) {
  const menu = useOverlay("menu");
  return (
    <div>
      <button type="button" {...menu.triggerProps}>
        {name}
      </button>
      <OverlayPanel state={menu} label={`${name} menu`} className="p-1">
        <OverlayMenuItem onSelect={onPick}>{name} item</OverlayMenuItem>
      </OverlayPanel>
    </div>
  );
}

describe("overlay system", () => {
  it("opens on trigger click, wires aria, and closes on outside pointerdown", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <DemoMenu name="A" />
        <button type="button">outside</button>
      </div>,
    );
    const trigger = screen.getByRole("button", { name: "A" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await user.click(trigger);
    expect(screen.getByRole("menu", { name: "A menu" })).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).toBe(screen.getByRole("menu").id);

    fireEvent.pointerDown(screen.getByRole("button", { name: "outside" }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<DemoMenu name="A" />);
    const trigger = screen.getByRole("button", { name: "A" });
    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("selecting an item runs the action exactly once, closes, and restores focus", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<DemoMenu name="A" onPick={onPick} />);
    const trigger = screen.getByRole("button", { name: "A" });
    await user.click(trigger);

    await user.click(screen.getByRole("menuitem", { name: "A item" }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps at most one overlay open at a time", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <DemoMenu name="A" />
        <DemoMenu name="B" />
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "A" }));
    expect(screen.getByRole("menu", { name: "A menu" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "B" }));
    expect(screen.queryByRole("menu", { name: "A menu" })).toBeNull();
    expect(screen.getByRole("menu", { name: "B menu" })).toBeTruthy();
    expect(screen.getAllByRole("menu")).toHaveLength(1);
  });

  it("closeAllOverlays force-closes everything", async () => {
    const user = userEvent.setup();
    render(<DemoMenu name="A" />);
    await user.click(screen.getByRole("button", { name: "A" }));
    expect(screen.getByRole("menu")).toBeTruthy();

    act(() => closeAllOverlays());
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("moves focus into the panel on open so keyboard flow continues there", async () => {
    const user = userEvent.setup();
    render(<DemoMenu name="A" />);
    await user.click(screen.getByRole("button", { name: "A" }));
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "A item" }));
  });
});
