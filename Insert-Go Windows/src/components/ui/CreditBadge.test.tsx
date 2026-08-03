import { describe, expect, it } from "vitest";
import { creditTier } from "./CreditBadge";

describe("creditTier", () => {
  it("colors the total balance: >10 green, 1–10 amber, 0 red", () => {
    expect(creditTier(155)).toBe("green"); // pro daily + add-on headroom
    expect(creditTier(11)).toBe("green");
    expect(creditTier(10)).toBe("amber");
    expect(creditTier(1)).toBe("amber");
    expect(creditTier(0)).toBe("red");
    expect(creditTier(-1)).toBe("red"); // defensive: server ledger drift
  });
});
