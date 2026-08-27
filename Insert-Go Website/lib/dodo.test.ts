import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CREDIT_PACKS,
  cancelSubscription,
  clearsSubscriptionId,
  createCheckoutSession,
  dodoProductId,
  eventTimestampSeconds,
  extractUserRef,
  packCreditsForEvent,
  packCreditsReversedForEvent,
  subscriptionIdForEvent,
  tierForProductId,
  tierForSubscriptionEvent,
  verifyWebhookSignature,
  type DodoWebhookPayload,
} from "./dodo";

/** Build a valid Standard-Webhooks signature the way Dodo signs. */
function sign(opts: {
  id: string;
  timestamp: string;
  body: string;
  secret: string;
}): string {
  const raw = opts.secret.startsWith("whsec_")
    ? opts.secret.slice(6)
    : opts.secret;
  const key = Buffer.from(raw, "base64");
  const sig = createHmac("sha256", key)
    .update(`${opts.id}.${opts.timestamp}.${opts.body}`)
    .digest("base64");
  return `v1,${sig}`;
}

const SECRET = `whsec_${Buffer.from("test-secret-key-32-bytes-long!!!").toString("base64")}`;
const NOW = 1_750_000_000;

function validInput(overrides: Partial<Parameters<typeof verifyWebhookSignature>[0]> = {}) {
  const body = JSON.stringify({ type: "subscription.active" });
  const id = "msg_1";
  const timestamp = String(NOW);
  return {
    rawBody: body,
    webhookId: id,
    webhookTimestamp: timestamp,
    webhookSignature: sign({ id, timestamp, body, secret: SECRET }),
    secret: SECRET,
    nowSeconds: NOW,
    ...overrides,
  };
}

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed payload", () => {
    expect(verifyWebhookSignature(validInput())).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(
      verifyWebhookSignature(validInput({ rawBody: '{"type":"evil"}' })),
    ).toBe(false);
  });

  it("rejects a wrong secret", () => {
    expect(
      verifyWebhookSignature(
        validInput({
          secret: `whsec_${Buffer.from("another-secret").toString("base64")}`,
        }),
      ),
    ).toBe(false);
  });

  it("rejects a stale timestamp (replay window)", () => {
    expect(
      verifyWebhookSignature(validInput({ nowSeconds: NOW + 6 * 60 })),
    ).toBe(false);
  });

  it("rejects missing headers", () => {
    expect(verifyWebhookSignature(validInput({ webhookSignature: "" }))).toBe(
      false,
    );
    expect(verifyWebhookSignature(validInput({ webhookId: "" }))).toBe(false);
  });

  it("accepts when a rotated (multi-entry) header contains one valid signature", () => {
    const base = validInput();
    expect(
      verifyWebhookSignature({
        ...base,
        webhookSignature: `v1,${Buffer.from("garbage").toString("base64")} ${base.webhookSignature}`,
      }),
    ).toBe(true);
  });
});

describe("tierForSubscriptionEvent", () => {
  it("maps activation-family events to the metadata plan tier", () => {
    const pro = { data: { metadata: { planTier: "pro" } } };
    const plus = { data: { metadata: { planTier: "plus" } } };
    expect(tierForSubscriptionEvent("subscription.active", pro)).toBe("pro");
    expect(tierForSubscriptionEvent("subscription.renewed", plus)).toBe("plus");
    expect(tierForSubscriptionEvent("subscription.plan_changed", pro)).toBe(
      "pro",
    );
  });

  it("defaults activation without metadata to plus (least paid privilege)", () => {
    expect(tierForSubscriptionEvent("subscription.active", {})).toBe("plus");
    expect(
      tierForSubscriptionEvent("subscription.active", {
        data: { metadata: { planTier: "enterprise" } },
      }),
    ).toBe("plus");
  });

  it("maps termination-family events to free", () => {
    expect(tierForSubscriptionEvent("subscription.cancelled", {})).toBe("free");
    expect(tierForSubscriptionEvent("subscription.expired", {})).toBe("free");
    expect(tierForSubscriptionEvent("subscription.failed", {})).toBe("free");
    expect(tierForSubscriptionEvent("subscription.on_hold", {})).toBe("free");
  });

  it("demotes on termination even when the payload still carries a paid product", () => {
    vi.stubEnv("DODO_PRODUCT_ID_PRO", "prod_pro");
    // A cancellation event still names the plan being cancelled. Reading the
    // product id here (as the activation family does) would keep the tier the
    // user just gave up — the termination branch must ignore it entirely.
    expect(
      tierForSubscriptionEvent("subscription.cancelled", {
        data: { product_id: "prod_pro", metadata: { planTier: "pro" } },
      }),
    ).toBe("free");
    expect(
      tierForSubscriptionEvent("subscription.failed", {
        data: { product_id: "prod_pro" },
      }),
    ).toBe("free");
    vi.unstubAllEnvs();
  });

  it("ignores unrelated events", () => {
    expect(tierForSubscriptionEvent("payment.succeeded", {})).toBeNull();
    expect(tierForSubscriptionEvent("", {})).toBeNull();
  });

  describe("plan changes (product id beats stale checkout metadata)", () => {
    afterEach(() => vi.unstubAllEnvs());

    function withPlans() {
      vi.stubEnv("DODO_PRODUCT_ID_PLUS", "prod_plus");
      vi.stubEnv("DODO_PRODUCT_ID_PRO", "prod_pro");
    }

    it("upgrades on plan_changed even though metadata still says plus", () => {
      withPlans();
      // metadata.planTier is stamped at the ORIGINAL checkout and never
      // rewritten, so this is exactly what a portal upgrade delivers.
      expect(
        tierForSubscriptionEvent("subscription.plan_changed", {
          data: { product_id: "prod_pro", metadata: { planTier: "plus" } },
        }),
      ).toBe("pro");
    });

    it("downgrades on plan_changed even though metadata still says pro", () => {
      withPlans();
      expect(
        tierForSubscriptionEvent("subscription.plan_changed", {
          data: { product_id: "prod_plus", metadata: { planTier: "pro" } },
        }),
      ).toBe("plus");
    });

    it("reads the cart when the event carries no bare product_id", () => {
      withPlans();
      expect(
        tierForSubscriptionEvent("subscription.active", {
          data: { product_cart: [{ product_id: "prod_pro" }] },
        }),
      ).toBe("pro");
    });

    it("falls back to metadata for a product this app doesn't sell", () => {
      withPlans();
      expect(
        tierForSubscriptionEvent("subscription.active", {
          data: { product_id: "prod_someone_else", metadata: { planTier: "pro" } },
        }),
      ).toBe("pro");
    });

    it("never matches on unconfigured plan ids", () => {
      vi.stubEnv("DODO_PRODUCT_ID_PLUS", "");
      vi.stubEnv("DODO_PRODUCT_ID_PRO", "");
      expect(tierForProductId("")).toBeNull();
      expect(tierForProductId(undefined)).toBeNull();
      // An empty env must not turn every product id into a plan.
      expect(tierForProductId("prod_pro")).toBeNull();
    });
  });
});

describe("packCreditsReversedForEvent", () => {
  const refund = (packCredits: unknown) => ({ data: { metadata: { packCredits } } });

  it("claws back a valid pack on refund and lost dispute", () => {
    expect(packCreditsReversedForEvent("refund.succeeded", refund("150"))).toBe(150);
    expect(packCreditsReversedForEvent("dispute.lost", refund(500))).toBe(500);
  });

  it("ignores the purchase event and everything else", () => {
    expect(packCreditsReversedForEvent("payment.succeeded", refund("150"))).toBeNull();
    expect(packCreditsReversedForEvent("dispute.won", refund("150"))).toBeNull();
    expect(packCreditsReversedForEvent("", refund("150"))).toBeNull();
  });

  it("does not claw back on dispute.opened — no money has moved yet", () => {
    // A dispute is a claim, not an outcome. Reversing here would strip credits
    // from a user who then WINS the dispute, and `dispute.won` carries no
    // re-grant path — the loss would be silent and permanent.
    expect(packCreditsReversedForEvent("dispute.opened", refund("350"))).toBeNull();
    expect(tierForSubscriptionEvent("dispute.opened", refund("350"))).toBeNull();
    expect(packCreditsForEvent("dispute.opened", refund("350"))).toBeNull();
  });

  it("reverses nothing for an amount outside the catalog", () => {
    expect(packCreditsReversedForEvent("refund.succeeded", refund("999999"))).toBeNull();
    expect(packCreditsReversedForEvent("refund.succeeded", refund("abc"))).toBeNull();
    expect(packCreditsReversedForEvent("refund.succeeded", {})).toBeNull();
  });
});

describe("packCreditsForEvent", () => {
  it("grants only for payment.succeeded with a catalog pack size", () => {
    for (const pack of CREDIT_PACKS) {
      expect(
        packCreditsForEvent("payment.succeeded", {
          data: { metadata: { packCredits: String(pack.credits) } },
        }),
      ).toBe(pack.credits);
    }
  });

  it("rejects forged or off-catalog sizes and other events", () => {
    expect(
      packCreditsForEvent("payment.succeeded", {
        data: { metadata: { packCredits: "9999" } },
      }),
    ).toBeNull();
    expect(packCreditsForEvent("payment.succeeded", {})).toBeNull();
    expect(
      packCreditsForEvent("subscription.active", {
        data: { metadata: { packCredits: "50" } },
      }),
    ).toBeNull();
  });
});

describe("eventTimestampSeconds", () => {
  it("parses the ISO event time Dodo sends", () => {
    expect(eventTimestampSeconds({ timestamp: "2026-07-30T12:00:00.000Z" })).toBe(
      Date.UTC(2026, 6, 30, 12) / 1000,
    );
  });

  it("passes epoch seconds through", () => {
    expect(eventTimestampSeconds({ timestamp: NOW })).toBe(NOW);
  });

  it("returns null when absent or unparseable (write stays unguarded)", () => {
    expect(eventTimestampSeconds({})).toBeNull();
    expect(eventTimestampSeconds({ timestamp: "" })).toBeNull();
    expect(eventTimestampSeconds({ timestamp: "not-a-date" })).toBeNull();
    expect(eventTimestampSeconds({ timestamp: Number.NaN })).toBeNull();
  });
});

describe("dodoProductId", () => {
  it("returns null for off-catalog packs regardless of env", () => {
    expect(dodoProductId({ kind: "pack", credits: 42 })).toBeNull();
  });
});

describe("extractUserRef", () => {
  it("prefers metadata.userId over customer email", () => {
    expect(
      extractUserRef({
        data: {
          metadata: { userId: "u42" },
          customer: { email: "x@y.z" },
        },
      }),
    ).toEqual({ userId: "u42", email: "x@y.z" });
  });

  it("falls back to email when metadata is absent", () => {
    expect(
      extractUserRef({ data: { customer: { email: "x@y.z" } } }),
    ).toEqual({ userId: null, email: "x@y.z" });
  });

  it("returns nulls for an empty payload", () => {
    expect(extractUserRef({})).toEqual({ userId: null, email: null });
  });
});

describe("subscriptionIdForEvent", () => {
  // `as DodoWebhookPayload`: the malformed-id cases below are exactly the
  // shapes the type forbids and the gateway can still send, so the cast is the
  // point of the test, not a workaround for it.
  const withId = (type: string, subscription_id: unknown) =>
    ({ type, data: { subscription_id } }) as DodoWebhookPayload;

  it("reads the id from every activation event", () => {
    for (const t of [
      "subscription.active",
      "subscription.renewed",
      "subscription.plan_changed",
    ]) {
      expect(subscriptionIdForEvent(t, withId(t, "sub_1"))).toBe("sub_1");
    }
  });

  it("ignores terminations, so a cancelled id is never re-stored", () => {
    // The account page decides whether to offer Cancel from the stored id.
    // Re-storing it here would leave a Cancel button over a dead subscription.
    for (const t of [
      "subscription.cancelled",
      "subscription.expired",
      "subscription.failed",
      "subscription.on_hold",
      "payment.succeeded",
    ]) {
      expect(subscriptionIdForEvent(t, withId(t, "sub_1"))).toBeNull();
    }
  });

  it("rejects empty and non-string ids rather than storing them", () => {
    // `""` would look like a subscription to the cancel route and 404 at the
    // gateway — worse than null, which the route reports honestly.
    for (const bad of ["", null, undefined, 7, {}]) {
      expect(
        subscriptionIdForEvent("subscription.active", withId("subscription.active", bad)),
      ).toBeNull();
    }
  });
});

describe("createCheckoutSession billing country", () => {
  const fetchMock = vi.fn();

  const setup = () => {
    vi.stubEnv("DODO_API_KEY", "key");
    vi.stubEnv("DODO_PRODUCT_ID_PLUS", "prod_plus");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  };

  const body = () => JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string);

  const ok = () =>
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ checkout_url: "https://pay.example/c1" }), {
        status: 200,
      }),
    );

  const start = (country?: string | null) =>
    createCheckoutSession({
      userId: "u1",
      email: "a@b.co",
      name: "A",
      item: { kind: "plan", tier: "plus" },
      country,
    });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("pins the geolocated country so Dodo opens its localized checkout", async () => {
    setup();
    ok();
    await start("IN");
    expect(body().billing_address).toEqual({ country: "IN" });
    // The catalog selector is still the only thing that picks the product —
    // no amount, no currency, ever leaves this process.
    expect(body().product_cart).toEqual([
      { product_id: "prod_plus", quantity: 1 },
    ]);
    expect(JSON.stringify(body())).not.toMatch(/amount|price|currency/i);
  });

  it("sends no address at all when geolocation didn't resolve", async () => {
    setup();
    ok();
    await start(null);
    expect(body()).not.toHaveProperty("billing_address");
  });

  it("refuses anything that isn't an ISO-3166 alpha-2 code", async () => {
    // The route only ever passes an edge header, but this is the last gate
    // before a country — and therefore a localized price — reaches the
    // gateway. Junk must degrade to "no hint", never to a hint we invented.
    for (const bad of ["INDIA", "i", "", "IN;DROP", "  "]) {
      setup();
      ok();
      await start(bad);
      expect(body()).not.toHaveProperty("billing_address");
    }
  });

  it("retries without the address rather than failing the purchase", async () => {
    setup();
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 422 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ checkout_url: "https://pay.example/c2" }), {
          status: 200,
        }),
      );
    await expect(start("IN")).resolves.toEqual({
      url: "https://pay.example/c2",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(body()).not.toHaveProperty("billing_address");
  });
});

describe("cancelSubscription", () => {
  const fetchMock = vi.fn();

  const setup = () => {
    vi.stubEnv("DODO_API_KEY", "key");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  };

  const call = () => fetchMock.mock.calls.at(-1)!;
  const init = () => call()[1] as RequestInit;
  const body = () => JSON.parse(init().body as string);

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("asks Dodo to stop the NEXT renewal, never to terminate now", async () => {
    // The single load-bearing field of the whole cancellation flow. An
    // immediate `status: "cancelled"` would strip paid-for time the moment the
    // button is pressed — the webhook maps `subscription.cancelled` straight to
    // the free tier — which contradicts Terms §6/§7 and is worse for the
    // customer than the statute requires. Asserted here because every route
    // test mocks this function, so nothing else would catch the swap.
    setup();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    await cancelSubscription("sub_abc");

    expect(call()[0]).toBe("https://test.dodopayments.com/subscriptions/sub_abc");
    expect(init().method).toBe("PATCH");
    expect(body()).toEqual({ cancel_at_next_billing_date: true });
    expect(JSON.stringify(body())).not.toMatch(/status/i);
  });

  it("escapes the subscription id instead of pasting it into the path", async () => {
    setup();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    await cancelSubscription("sub/../subscriptions/sub_other");
    expect(call()[0]).toBe(
      "https://test.dodopayments.com/subscriptions/sub%2F..%2Fsubscriptions%2Fsub_other",
    );
  });

  it("throws on any non-2xx, so no caller records a cancellation that didn't happen", async () => {
    // Gateway-first ordering (app/api/billing/cancel) depends entirely on this
    // rejecting: a resolved promise over a failed cancel is a UI that says
    // "cancelled" while the card keeps being charged.
    for (const status of [400, 404, 429, 500]) {
      setup();
      fetchMock.mockResolvedValue(new Response("{}", { status }));
      await expect(cancelSubscription("sub_abc")).rejects.toThrow("cancel-failed");
    }
  });
});

describe("clearsSubscriptionId", () => {
  it("forgets the id only when the subscription is actually gone", () => {
    expect(clearsSubscriptionId("subscription.cancelled")).toBe(true);
    expect(clearsSubscriptionId("subscription.expired")).toBe(true);
    // Never activated — there is no live subscription to keep a handle on.
    expect(clearsSubscriptionId("subscription.failed")).toBe(true);
  });

  it("keeps the id through on_hold, which demotes but does not end anything", () => {
    // The trap: on_hold maps to the free tier like the terminations above, so
    // deriving this from "the tier went free" silently drops the id of a
    // subscription Dodo is still retrying — suspending the customer and
    // removing the only button that stops the charges.
    expect(tierForSubscriptionEvent("subscription.on_hold", {})).toBe("free");
    expect(clearsSubscriptionId("subscription.on_hold")).toBe(false);
  });

  it("leaves the id alone for activations and unrelated events", () => {
    for (const t of [
      "subscription.active",
      "subscription.renewed",
      "subscription.plan_changed",
      "payment.succeeded",
      "refund.succeeded",
      "",
    ]) {
      expect(clearsSubscriptionId(t)).toBe(false);
    }
  });
});
