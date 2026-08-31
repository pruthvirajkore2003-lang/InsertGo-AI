import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Point-of-sale disclosure guard for the pricing page.
 *
 * Read as SOURCE TEXT, like `lib/legalCopy.test.ts`, and for the same reason:
 * this page is a client component and the project has no DOM test setup, but
 * the property that matters is structural, not visual — is the automatic
 * renewal disclosed NEXT TO the button, and is every figure on the page the
 * one USD catalogue price, stated as tax-exclusive?
 *
 * Both are statutory, and both fail silently. Cal. Bus. & Prof. Code §17602
 * makes a charge taken without an auto-renewal disclosure "in visual
 * proximity" to the consent request an unconditional gift to the consumer, and
 * a price that quietly grows at checkout is drip pricing. Neither shows up as
 * a broken build — a footer note and a proximate one look identical to a
 * linter.
 */

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const PLANS = read("./PricingPlans.tsx");
const ACCOUNT = read("../../account/page.tsx");

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
      PLANS.indexOf("/** Per-credit unit price"),
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

describe("tax disclosure", () => {
  it("says on the page that the prices exclude tax", () => {
    // Dodo's products are tax-exclusive and its hosted checkout adds the
    // buyer's regional tax, so a price shown with no such note is a figure
    // that grows at checkout — drip pricing.
    expect(PLANS).toContain("exclude tax");
    expect(PLANS).toContain("plus tax");
  });

  it("never claims prices are tax-inclusive, because they are not", () => {
    // A comforting "inclusive of all taxes" would be a false statement about
    // money, which is worse than the drip it papers over.
    expect(PLANS.toLowerCase()).not.toContain("inclusive of all taxes");
  });

  it("carries no GST arithmetic — there is no second currency to itemise", () => {
    expect(PLANS).not.toContain("GST_RATE");
    expect(PLANS).not.toContain("gstNote");
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

describe("currency display is USD, single and non-switchable", () => {
  it("renders no manual currency toggle anywhere", () => {
    // The display currency must match what checkout will charge, so there is
    // no selector to game: no toggle component, no import of one.
    expect(PLANS).not.toContain("CurrencySelector");
    expect(() => read("./CurrencySelector.tsx")).toThrow();
  });

  it("never reads or writes a currency cookie", () => {
    // A cookie is user-editable text; a currency the visitor can set is a
    // price the visitor can display at will. Detection is geo-header only,
    // with the client timezone fallback below.
    expect(PLANS).not.toMatch(/ig_currency|CURRENCY_COOKIE|writeCurrencyCookie/);
  });

  it("renders USD and nothing else", () => {
    // One symbol, one column. A rupee sign or an INR branch anywhere on this
    // page is a price the checkout will not charge.
    expect(PLANS).toContain('const SYMBOL: Record<Currency, string> = { USD: "$" }');
    expect(PLANS).not.toContain("₹");
    expect(PLANS).not.toContain("INR");
  });

  it("renders every figure, including the renewal terms, from the catalogue", () => {
    // The failure this guards is a half-switched page: a card price and a
    // renewal disclosure quoting different numbers.
    expect(PLANS).toContain("<RenewalTerms amount={p.price[currency]} currency={currency} />");
    expect(PLANS).toContain("{money(p.price[currency], currency)}");
    expect(PLANS).toContain("{money(pack.price[currency], currency)}");
  });

  it("never re-derives the currency on the client", () => {
    // Deriving money from Intl/navigator during render is a React 19
    // hydration mismatch on the price itself; with one currency there is also
    // nothing to derive.
    expect(PLANS).not.toContain("detectClientCurrency");
    expect(PLANS).not.toMatch(/useState<Currency>/);
    expect(PLANS).not.toContain("geoResolved");
  });
});

describe("the checkout country is never client-supplied", () => {
  const ROUTE = read("../../api/billing/checkout/route.ts");

  it("reads the billing country from the edge header, not the body or cookie", () => {
    // Dodo prices per billing country. A country the shopper can set is a
    // price the shopper can set — no client-controlled value may reach it.
    expect(ROUTE).toContain("country: countryFromHeaders(req.headers)");
    // `b` is the parsed request body — no field of it may reach the gateway
    // beyond the catalog selector already validated above.
    expect(ROUTE).not.toMatch(/\bb\.country\b/);
    expect(ROUTE).not.toMatch(/\bcookies\(\)/);
    expect(ROUTE).not.toMatch(/CURRENCY_COOKIE|parseCurrency/);
  });
});
