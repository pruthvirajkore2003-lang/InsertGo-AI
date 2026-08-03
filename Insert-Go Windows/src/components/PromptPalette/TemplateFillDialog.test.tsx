import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Template } from "@/types";
import { TemplateFillDialog } from "./TemplateFillDialog";

vi.mock("@/services/clipboard", () => ({
  readClipboard: vi.fn().mockResolvedValue("CLIP"),
}));

function tpl(body: string): Template {
  return { id: "t1", name: "Test", category: "Custom", body };
}

describe("TemplateFillDialog", () => {
  it("renders a field per command, fills them, and expands with clipboard", async () => {
    const onInsert = vi.fn();
    render(
      <TemplateFillDialog
        template={tpl(
          "Make it {formmenu: default=short; long}. Extra: {formtext: name=extra}. {formtoggle: name=Add note; default=no}Note: important.{endformtoggle} {clipboard}"
        )}
        onInsert={onInsert}
        onCancel={() => {}}
      />
    );

    // Clipboard read happens inside the fill flow; wait for the preview.
    await screen.findByText("CLIP");

    // SearchableSelect: open the combobox, then pick the option (a change
    // event only edits the filter query, never the selection).
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.mouseDown(screen.getByRole("option", { name: "long" }));
    fireEvent.change(screen.getByLabelText("extra"), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("checkbox")); // turn the toggle on

    fireEvent.click(screen.getByText("Insert"));

    expect(onInsert).toHaveBeenCalledTimes(1);
    const out = onInsert.mock.calls[0][0] as string;
    expect(out).toBe("Make it long. Extra: hello. Note: important. CLIP");
    expect(out).not.toMatch(/\{(form|clipboard|endform)/);
  });

  it("joins multi-select choices with ', ' in author order", () => {
    const onInsert = vi.fn();
    render(
      <TemplateFillDialog
        template={tpl("Tone: {formmenu: default=Pro; Casual; Formal; multiple=yes}")}
        onInsert={onInsert}
        onCancel={() => {}}
      />
    );

    // Pro is preselected (default); add Formal.
    fireEvent.click(screen.getByLabelText("Formal"));
    fireEvent.click(screen.getByText("Insert"));

    expect(onInsert).toHaveBeenCalledWith("Tone: Pro, Formal");
  });

  it("fires onCancel from the Cancel button", () => {
    const onCancel = vi.fn();
    render(
      <TemplateFillDialog
        template={tpl("Just {formtext: name=x}")}
        onInsert={() => {}}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
