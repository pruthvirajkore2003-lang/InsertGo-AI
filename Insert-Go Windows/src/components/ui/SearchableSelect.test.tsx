import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchableSelect } from "./SearchableSelect";

const opts = ["Alpha", "Beta", "Gamma"].map((v) => ({ value: v, label: v }));

function setup(value = "Alpha") {
  const onChange = vi.fn();
  render(
    <SearchableSelect id="sel" options={opts} value={value} onChange={onChange} />
  );
  return { onChange, input: screen.getByRole("combobox") };
}

describe("SearchableSelect", () => {
  it("filters case-insensitively and selects with Enter", async () => {
    const { onChange, input } = setup();
    await userEvent.type(input, "gam");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("Gamma");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("traverses with arrows, tracks aria-activedescendant, Escape closes", async () => {
    const { onChange, input } = setup();
    await userEvent.click(input); // opens, active = selected (Alpha)
    expect(input).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", "sel-opt-1");
    await userEvent.keyboard("{ArrowUp}{ArrowUp}"); // wraps to last
    expect(input).toHaveAttribute("aria-activedescendant", "sel-opt-2");
    await userEvent.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes on outside click without selecting", async () => {
    const { onChange, input } = setup();
    await userEvent.click(input);
    await userEvent.pointer({ keys: "[MouseLeft]", target: document.body });
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(onChange).not.toHaveBeenCalled();
  });
});
