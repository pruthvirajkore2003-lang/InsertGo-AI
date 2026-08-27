import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Point-of-sale disclosure guard for the pricing page.
 *
 * Read as SOURCE TEXT, like `lib/legalCopy.test.ts`, and for the same reason:
 * this page is a client component and the project has no DOM test setup, but
 * the property that matters is structural, not visual — is the automatic
 * renewal disclosed NEXT TO the button, and is the INR price shown with the
 * tax that will actually be charged on top of it?
 *
 * Both are statutory, and both fail silently. Cal. Bus. & Prof. Code §17602
 * makes a charge taken without an auto-renewal disclosure "in visual
 * proximity" to the consent request an unconditional gift to the consumer; the
 * CCPA's 2023 dark-pattern guidelines treat a rupee price that grows at
 * checkout as drip pricing. Neither shows up as a broken build — a footer note
 * and a proximate one look identical to a linter.
 */

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const PLANS = read("./PricingPlans.tsx");
const ACCOUNT = read("../account/page.tsx");

describe("auto-renewal disclosure (California ARL / FTC ROSCA)", () => {
  it("renders the renewal terms with the subscribe button, not in a footer", () => {
    // The component exists...
    expect(PLANS).toContain("function RenewalTerms(");
    // ...and EVERY subscribe button carries one within the same JSX block —
    // the "visual proximity" limb. Measured as a bounded window after each
    // checkout call rather than a fixed slice of the file, so the pairing
    // survives the card being restructured (it has been, for tier-aware
    // states) while a move to the page footer still fails: a footer sits
    // thousands of characters and several closing tags away.
    const calls = [
      ...PLANS.matchAll(/checkout\(p\.tier!, \{ tier: p\.tier! \}\)/g),
    ];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      const proximate = PLANS.slice(call.index, call.index + 1400);
      expect(proximate).toContain("<RenewalTerms");
      // Nothing may close the card out from under the disclosure first.
      expect(proximate.slice(0, proximate.indexOf("<RenewalTerms"))).not.toContain(
        "</motion.div>",
      );
    }
  });

  it("never re-sells the tier a signed-in visitor already pays for", () => {
    // A "Get Plus" button on a Plus subscriber's card is an invitation to buy
    // a second subscription. The active card offers account management only —
    // and drops the pre-purchase renewal terms with the request for consent
    // they belong to (ActivePlanNote covers the live one instead).
    const start = PLANS.indexOf("{isCurrentPlan && p.tier ? (");
    expect(start).toBeGreaterThan(-1);
    const branch = PLANS.slice(
      start,
      PLANS.indexOf(") : isCurrentPlan || isIncluded ? (", start),
    );
    expect(branch).toContain('href="/account"');
    expect(branch).not.toContain("checkout(");
    expect(branch).not.toContain("<RenewalTerms");
  });

  it("keeps the live renewal and its one-click cancel on the active card", () => {
    // §17602(c) is measured from wherever the subscriber is standing, and on
    // this page that is their own plan card.
    expect(PLANS).toContain("function ActivePlanNote(");
    const note = PLANS.slice(
      PLANS.indexOf("function ActivePlanNote("),
      PLANS.indexOf("/** Cents read naturally"),
    );
    // Whitespace-normalised: this copy is JSX prose, so where it wraps is the
    // formatter's business, not the disclosure's.
    const flat = note.replace(/\s+/g, " ");
    expect(flat).toContain("renews automatically each month until you cancel");
    expect(flat).toContain("Cancel anytime online in Account settings");
    expect(note).toContain('href="/account"');
  });

  it("states the amount, the cadence, and that it continues until cancelled", () => {
    expect(PLANS).toContain("authorize a recurring charge");
    expect(PLANS).toContain("every month until you cancel");
    expect(PLANS).toContain("Cancel anytime online in Account settings");
  });

  it("says plainly that credit packs do not renew", () => {
    // Silence here is what lets "recurring" read as the page-wide default.
    expect(PLANS).toContain("Not a subscription");
  });
});

describe("Indian tax disclosure (CCPA 2023 dark-pattern guidelines)", () => {
  it("itemises GST and the resulting total for INR shoppers", () => {
    expect(PLANS).toContain("const GST_RATE = 0.18");
    expect(PLANS).toContain("function gstNote(");
    expect(PLANS).toContain("% GST = ₹");
  });

  it("never claims prices are tax-inclusive, because they are not", () => {
    // Dodo's products are tax-exclusive; a comforting "inclusive of all taxes"
    // would be a false statement about money, which is worse than the drip.
    expect(PLANS.toLowerCase()).not.toContain("inclusive of all taxes");
  });
});

describe("self-service cancellation is reachable", () => {
  it("puts the cancel control on the account page itself", () => {
    // Steps-to-cancel is measured from where the user already is. Behind one
    // more "manage billing" hop is a different, worse number.
    expect(ACCOUNT).toContain("<CancelSubscription");
    expect(ACCOUNT).toContain('from "./CancelSubscription"');
  });
});

describe("currency selection is honest and reversible", () => {
  const SELECTOR = read("./CurrencySelector.tsx");

  it("puts the toggle above the prices it governs", () => {
    // Geolocation is a guess. A visitor it guessed wrong for needs the fix
    // before they read a price, not in a footer after they have.
    const at = PLANS.indexOf("<CurrencySelector");
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(PLANS.indexOf("{plans.map("));
  });

  it("says the toggle changes the display, not the charge", () => {
    // Dodo localises the real charge from the shopper's billing country, so a
    // ₹ column picked by someone billed in dollars must not read as a promise
    // to charge rupees. Unqualified, that is a misleading price.
    const flat = SELECTOR.replace(/\s+/g, " ");
    expect(flat).toContain("Display currency.");
    expect(flat).toContain("Checkout charges in the currency of your billing country.");
    expect(SELECTOR).toContain('aria-describedby="currency-note"');
  });

  it("keeps the control keyboard-operable and labelled", () => {
    // Real radios, so arrow keys, one tab stop and the announced position come
    // from the platform instead of hand-rolled aria-checked that can drift.
    expect(SELECTOR).toContain('type="radio"');
    expect(SELECTOR).toContain('name="display-currency"');
    expect(SELECTOR).toContain("<legend");
    expect(SELECTOR).toContain("peer-focus-visible:ring-2");
  });

  it("recomputes every price and tax note from the live selection", () => {
    // The failure this guards is a half-switched page: rupee prices under a
    // dollar GST note, or a renewal disclosure quoting the other column.
    expect(PLANS).toContain("const [currency, setCurrency] = useState<Currency>");
    expect(PLANS).toContain("<RenewalTerms amount={p.price[currency]} currency={currency} />");
    expect(PLANS).toContain('{currency === "INR" && p.price.INR > 0 && (');
  });

  it("detects on the client only after hydration, and only as a fallback", () => {
    // Reading Intl/navigator during render is how a page server-rendered as
    // ₹499 hydrates as $7.99 — a React 19 mismatch on the money itself.
    const effect = PLANS.slice(
      PLANS.indexOf("useEffect(() => {"),
      PLANS.indexOf("const chooseCurrency"),
    );
    expect(effect).toContain("detectClientCurrency()");
    expect(effect).toContain("if (geoResolved) return;");
    expect(PLANS).not.toMatch(/useState<Currency>\(detectClientCurrency/);
  });
});

describe("the checkout country is never client-supplied", () => {
  const ROUTE = read("../api/billing/checkout/route.ts");

  it("reads the billing country from the edge header, not the body or cookie", () => {
    // Dodo prices per billing country. A country the shopper can set is a
    // price the shopper can set — the display cookie must not reach it.
    expect(ROUTE).toContain("country: countryFromHeaders(req.headers)");
    // `b` is the parsed request body — no field of it may reach the gateway
    // beyond the catalog selector already validated above.
    expect(ROUTE).not.toMatch(/\bb\.country\b/);
    expect(ROUTE).not.toMatch(/\bcookies\(\)/);
    expect(ROUTE).not.toMatch(/CURRENCY_COOKIE|parseCurrency/);
  });
});
