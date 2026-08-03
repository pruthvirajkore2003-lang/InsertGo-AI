import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ResizeHandles } from "./ResizeHandles";

describe("ResizeHandles", () => {
  it("renders nothing outside Tauri (jsdom has no __TAURI_INTERNALS__)", () => {
    const { container } = render(<ResizeHandles />);
    expect(container.querySelectorAll(".ig-resize").length).toBe(0);
  });
});
