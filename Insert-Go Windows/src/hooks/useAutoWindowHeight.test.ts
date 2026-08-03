import { describe, expect, it } from "vitest";
import {
  computeTargetHeight,
  MIN_HEIGHT,
  MAX_HEIGHT,
} from "./useAutoWindowHeight";

describe("computeTargetHeight", () => {
  it("clamps tiny content to the minimum", () => {
    expect(computeTargetHeight(50, 40)).toBe(MIN_HEIGHT);
  });

  it("clamps huge content to the maximum", () => {
    expect(computeTargetHeight(2000, 40)).toBe(MAX_HEIGHT);
  });

  it("rounds fractional content + chrome up to whole px", () => {
    expect(computeTargetHeight(300.4, 47.5)).toBe(348);
  });

  it("honors per-window clamp overrides (selfloater)", () => {
    expect(computeTargetHeight(50, 20, 160, 640)).toBe(160);
    expect(computeTargetHeight(2000, 90, 160, 640)).toBe(640);
  });
});
