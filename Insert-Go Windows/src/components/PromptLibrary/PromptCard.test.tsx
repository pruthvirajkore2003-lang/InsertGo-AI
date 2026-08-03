import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Prompt } from "@/types";
import { PromptCard } from "./PromptCard";

const prompt: Prompt = {
  id: "1",
  title: "Summarize",
  body: "Summarize this",
  tags: ["writing", "research"],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("PromptCard", () => {
  it("renders title and tags", () => {
    render(<PromptCard prompt={prompt} onUse={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("Summarize")).toBeInTheDocument();
    expect(screen.getByText("writing · research")).toBeInTheDocument();
  });

  it("fires onUse and onDelete with the right args", () => {
    const onUse = vi.fn();
    const onDelete = vi.fn();
    render(
      <PromptCard prompt={prompt} onUse={onUse} onDelete={onDelete} />
    );
    fireEvent.click(screen.getByText("Use"));
    fireEvent.click(screen.getByText("Delete"));
    expect(onUse).toHaveBeenCalledWith(prompt);
    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
