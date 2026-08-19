import { describe, expect, it } from "vitest";

import { adsAllowedOn } from "./adPlacement";
import { parseConsent, serializeConsent, NO_CONSENT } from "./consentCookie";
import { inrPriceForItemKey } from "./pricing";

/**
 * The three decisions in the monetization layer that are not obvious by
 * inspection, and where being wrong is expensive rather than merely untidy:
 * where an ad may render, what the browser's consent mirror says, and what
 * value a conversion reports.
 */
describe("adsAllowedOn", () => {
  it("allows the public content routes ads are meant for", () => {
    for (const path of [
      "/blog",
      "/blog/windows-ai-productivity-guide",
      "/alternatives/raycast-windows",
      "/features/prompt-library",
      "/use-cases/developers",
      "/faq",
    ]) {
      expect(adsAllowedOn(path), path).toBe(true);
    }
  });

  it("keeps ads off every authenticated and transactional surface", () => {
    // /desktop/authorize is the one that matters most: it hands a desktop
    // client a live session, and a third-party iframe has no business there.
    for (const path of [
      "/",
      "/account",
      "/account/privacy",
      "/consent",
      "/login",
      "/desktop/authorize",
      "/pricing",
      "/download",
      "/contact",
    ]) {
      expect(adsAllowedOn(path), path).toBe(false);
    }
  });

  it("is an allowlist, not a prefix guess", () => {
    // A path that merely STARTS with an allowed segment is not that segment —
    // "/blogging-platform" would be a new public route nobody reviewed.
    expect(adsAllowedOn("/blogging-platform")).toBe(false);
    expect(adsAllowedOn("/faq-old")).toBe(false);
    expect(adsAllowedOn(null)).toBe(false);
    expect(adsAllowedOn("")).toBe(false);
  });
});

describe("consent cookie mirror", () => {
  it("defaults to denied when there is no cookie", () => {
    // A signed-out visitor never has one, and absence must never read as
    // consent — this is the value Consent Mode stays at for most traffic.
    expect(parseConsent(null)).toEqual(NO_CONSENT);
    expect(parseConsent("")).toEqual(NO_CONSENT);
  });

  it("round-trips each optional purpose independently", () => {
    expect(parseConsent(serializeConsent(["analytics"]))).toEqual({
      analytics: true,
      marketing: false,
    });
    expect(parseConsent(serializeConsent(["marketing"]))).toEqual({
      analytics: false,
      marketing: true,
    });
    expect(parseConsent(serializeConsent(["analytics", "marketing"]))).toEqual({
      analytics: true,
      marketing: true,
    });
  });

  it("ignores purposes that are not browser-facing", () => {
    // Required purposes have no place in a tag-consent cookie: they are not a
    // choice, and mirroring them would imply they were.
    expect(serializeConsent(["account", "billing", "ai_processing", "age_18_plus"])).toBe("");
  });

  it("never mistakes a substring for a grant", () => {
    expect(parseConsent("marketing")).toEqual({ analytics: false, marketing: true });
    expect(parseConsent("no_analytics")).toEqual(NO_CONSENT);
  });
});

describe("inrPriceForItemKey", () => {
  it("resolves catalogue prices for the keys checkout plants in the return URL", () => {
    expect(inrPriceForItemKey("plan:plus")).toBe(499);
    expect(inrPriceForItemKey("plan:pro")).toBe(999);
    expect(inrPriceForItemKey("pack:150")).toBe(249);
  });

  it("returns null for anything not in the catalogue", () => {
    // The key comes off a URL. A tampered one must report nothing rather than
    // invent a conversion value.
    expect(inrPriceForItemKey("plan:free")).toBe(null);
    expect(inrPriceForItemKey("pack:999999")).toBe(null);
    expect(inrPriceForItemKey("garbage")).toBe(null);
    expect(inrPriceForItemKey("")).toBe(null);
  });
});
