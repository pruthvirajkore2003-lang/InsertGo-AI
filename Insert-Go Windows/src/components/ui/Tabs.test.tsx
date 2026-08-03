/**
 * APG tabs contract: roles, roving tabindex, automatic activation on arrow
 * navigation with wrap-around, Home/End.
 */
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TabPanel, Tabs, type TabDef } from "./Tabs";

const TABS: TabDef[] = [
  { id: "one", label: "One", icon: "fa-1" },
  { id: "two", label: "Two", icon: "fa-2" },
  { id: "three", label: "Three", icon: "fa-3" },
];

function Harness() {
  const [value, setValue] = useState("one");
  return (
    <>
      <Tabs
        tabs={TABS}
        value={value}
        onChange={setValue}
        aria-label="Demo tabs"
        idBase="demo"
      />
      {TABS.map(
        (t) =>
          value === t.id && (
            <TabPanel key={t.id} idBase="demo" id={t.id}>
              panel {t.label}
            </TabPanel>
          )
      )}
    </>
  );
}

describe("Tabs", () => {
  it("renders tablist/tab/tabpanel roles wired with aria attributes", () => {
    render(<Harness />);
    expect(
      screen.getByRole("tablist", { name: "Demo tabs" })
    ).toBeInTheDocument();

    const one = screen.getByRole("tab", { name: "One" });
    expect(one).toHaveAttribute("aria-selected", "true");
    expect(one).toHaveAttribute("aria-controls", "demo-panel-one");

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("id", "demo-panel-one");
    expect(panel).toHaveAttribute("aria-labelledby", "demo-tab-one");
    expect(panel).toHaveTextContent("panel One");
  });

  it("keeps only the active tab in the Tab order (roving tabindex)", () => {
    render(<Harness />);
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute(
      "tabindex",
      "0"
    );
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute(
      "tabindex",
      "-1"
    );
    expect(screen.getByRole("tab", { name: "Three" })).toHaveAttribute(
      "tabindex",
      "-1"
    );
  });

  it("ArrowRight moves focus and activates the next tab (automatic activation)", () => {
    render(<Harness />);
    const list = screen.getByRole("tablist");
    fireEvent.keyDown(list, { key: "ArrowRight" });

    const two = screen.getByRole("tab", { name: "Two" });
    expect(two).toHaveAttribute("aria-selected", "true");
    expect(two).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("panel Two");
  });

  it("wraps: ArrowLeft from the first tab lands on the last", () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Three" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("panel Three");
  });

  it("Home/End jump to the first/last tab", () => {
    render(<Harness />);
    const list = screen.getByRole("tablist");
    fireEvent.keyDown(list, { key: "End" });
    expect(screen.getByRole("tab", { name: "Three" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    fireEvent.keyDown(list, { key: "Home" });
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("click activates a tab", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("tab", { name: "Two" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("panel Two");
  });
});
