import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CREDIT_PACKS,
  dodoProductId,
  eventTimestampSeconds,
  extractUserRef,
  packCreditsForEvent,
  packCreditsReversedForEvent,
  tierForProductId,
  tierForSubscriptionEvent,
  verifyWebhookSignature,
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
    expect(tierForSubscriptionEvent("subscription.on_hold", {})).toBe("free");
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
