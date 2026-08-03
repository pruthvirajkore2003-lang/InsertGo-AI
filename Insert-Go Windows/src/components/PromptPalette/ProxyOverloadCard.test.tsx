import { describe, expect, it } from "vitest";
import { isOverloadError } from "./ProxyOverloadCard";

describe("isOverloadError", () => {
  it("matches the relay's capacity 503, verbatim as aiProviders.ts throws it", () => {
    expect(
      isOverloadError(
        'Error: Provider "Backend Proxy": service is temporarily overloaded ' +
          "(not your key or quota) - tried 3 times, please retry in a minute."
      )
    ).toBe(true);
  });

  it("leaves actionable provider errors on the plain error line", () => {
    expect(isOverloadError('Provider "Backend Proxy": 402 out of credits')).toBe(
      false
    );
    expect(isOverloadError("You must be logged in to use the AI assistant.")).toBe(
      false
    );
    expect(isOverloadError(null)).toBe(false);
    expect(isOverloadError(undefined)).toBe(false);
  });
});
