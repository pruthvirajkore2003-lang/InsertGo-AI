/**
 * Dodo Payments — automated product, webhook, and env setup.
 *
 * Creates the InsertGo product catalog (Plus subscription, Pro subscription,
 * and 4 credit packs) and a webhook endpoint on the Dodo Payments test
 * environment, then prints the env vars to paste into .env.local.
 *
 * Prerequisites:
 *   1. Get your API key from https://app.dodopayments.com → Developer → API Keys
 *   2. Set DODO_API_KEY in your shell:
 *        $env:DODO_API_KEY = "your_test_api_key_here"
 *   3. Run:
 *        npx tsx scripts/setup-dodo.ts
 *
 * The script is idempotent: it skips creating products/webhooks that already
 * exist (matched by name/url). Safe to re-run.
 */

const API_KEY = process.env.DODO_API_KEY;
if (!API_KEY) {
  console.error(
    "\n❌ DODO_API_KEY not set.\n\n" +
    "Get your test API key from:\n" +
    "  https://app.dodopayments.com → Developer → API Keys\n\n" +
    "Then set it:\n" +
    '  $env:DODO_API_KEY = "your_key_here"\n'
  );
  process.exit(1);
}

// Use test environment by default
const BASE = process.env.DODO_ENV === "live"
  ? "https://live.dodopayments.com"
  : "https://test.dodopayments.com";

const SITE_URL = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://insertgo.com";

// ── Helpers ─────────────────────────────────────────────────────────────────

async function dodoFetch(path: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...((opts.headers as Record<string, string>) ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Dodo API ${opts.method ?? "GET"} ${path} → ${res.status}: ${body}`);
  }
  return res.json().catch(() => null);
}

async function listAll<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let pageNumber = 0;
  while (true) {
    const sep = path.includes("?") ? "&" : "?";
    const data = await dodoFetch(`${path}${sep}page_number=${pageNumber}&page_size=100`);
    if (!data || !Array.isArray(data.items ?? data)) break;
    const arr = data.items ?? data;
    items.push(...arr);
    if (arr.length < 100) break;
    pageNumber++;
  }
  return items;
}

// ── Product definitions (matching lib/pricing.ts and lib/dodo.ts) ───────────

type ProductDef = {
  envKey: string;
  name: string;
  description: string;
  price: any;
  taxCategory: string;
};

const PRODUCTS: ProductDef[] = [
  // Subscriptions
  {
    envKey: "DODO_PRODUCT_ID_PLUS",
    name: "InsertGo Plus",
    description: "50 daily credits, interaction history, inline prompt optimization. $7.99/mo.",
    price: {
      type: "recurring_price",
      currency: "USD",
      price: 799,  // cents
      discount: 0,
      purchasing_power_parity: true,
      payment_frequency_count: 1,
      payment_frequency_interval: "Month",
      subscription_period_count: 1,
      subscription_period_interval: "Month",
      tax_inclusive: false,
    },
    taxCategory: "saas",
  },
  {
    envKey: "DODO_PRODUCT_ID_PRO",
    name: "InsertGo Pro",
    description: "150 daily credits, high-volume capacity, priority support. $14.99/mo.",
    price: {
      type: "recurring_price",
      currency: "USD",
      price: 1499,  // cents
      discount: 0,
      purchasing_power_parity: true,
      payment_frequency_count: 1,
      payment_frequency_interval: "Month",
      subscription_period_count: 1,
      subscription_period_interval: "Month",
      tax_inclusive: false,
    },
    taxCategory: "saas",
  },
  // Credit packs (one-time)
  {
    envKey: "DODO_PRODUCT_ID_PACK_50",
    name: "InsertGo 50 Credits",
    description: "One-time pack of 50 add-on credits (never expire).",
    price: {
      type: "one_time_price",
      currency: "USD",
      price: 199,  // $1.99
      discount: 0,
      purchasing_power_parity: true,
      tax_inclusive: false,
    },
    taxCategory: "saas",
  },
  {
    envKey: "DODO_PRODUCT_ID_PACK_150",
    name: "InsertGo 150 Credits",
    description: "One-time pack of 150 add-on credits (never expire).",
    price: {
      type: "one_time_price",
      currency: "USD",
      price: 399,  // $3.99
      discount: 0,
      purchasing_power_parity: true,
      tax_inclusive: false,
    },
    taxCategory: "saas",
  },
  {
    envKey: "DODO_PRODUCT_ID_PACK_350",
    name: "InsertGo 350 Credits",
    description: "One-time pack of 350 add-on credits (never expire).",
    price: {
      type: "one_time_price",
      currency: "USD",
      price: 599,  // $5.99
      discount: 0,
      purchasing_power_parity: true,
      tax_inclusive: false,
    },
    taxCategory: "saas",
  },
  {
    envKey: "DODO_PRODUCT_ID_PACK_500",
    name: "InsertGo 500 Credits",
    description: "One-time pack of 500 add-on credits (never expire).",
    price: {
      type: "one_time_price",
      currency: "USD",
      price: 799,  // $7.99
      discount: 0,
      purchasing_power_parity: true,
      tax_inclusive: false,
    },
    taxCategory: "saas",
  },
];

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔧 Dodo Payments setup (${BASE})\n`);

  // ── 1. Create or find products ──────────────────────────────────────────

  console.log("📦 Checking existing products...");
  const existing = await listAll<any>("/products");
  const existingByName = new Map(existing.map((p: any) => [p.name, p]));

  const envLines: Record<string, string> = {};

  for (const def of PRODUCTS) {
    const found = existingByName.get(def.name);
    if (found) {
      console.log(`   ✓ ${def.name} already exists → ${found.product_id}`);
      envLines[def.envKey] = found.product_id;
      continue;
    }

    console.log(`   + Creating ${def.name}...`);
    const product = await dodoFetch("/products", {
      method: "POST",
      body: JSON.stringify({
        name: def.name,
        description: def.description,
        price: def.price,
        tax_category: def.taxCategory,
      }),
    });
    console.log(`   ✓ Created → ${product.product_id}`);
    envLines[def.envKey] = product.product_id;
  }

  // ── 2. Create or find webhook ───────────────────────────────────────────

  const webhookUrl = `${SITE_URL}/api/billing/webhook`;
  console.log(`\n🪝 Setting up webhook → ${webhookUrl}`);

  const webhooks = await listAll<any>("/webhooks");
  let webhook = webhooks.find((w: any) => w.url === webhookUrl);
  let webhookSecret: string;

  if (webhook) {
    console.log(`   ✓ Webhook already exists → ${webhook.id}`);
    // Retrieve the secret
    const secretRes = await dodoFetch(`/webhooks/${webhook.id}/secret`);
    webhookSecret = secretRes.secret;

    // Ensure filter_types are correct
    const requiredEvents = [
      "subscription.active",
      "subscription.renewed",
      "subscription.plan_changed",
      "subscription.cancelled",
      "subscription.expired",
      "subscription.failed",
      "subscription.on_hold",
      "payment.succeeded",
    ];
    const currentFilters = webhook.filter_types ?? [];
    const missingEvents = requiredEvents.filter((e) => !currentFilters.includes(e));
    if (missingEvents.length > 0) {
      console.log(`   ↻ Updating filter_types to include: ${missingEvents.join(", ")}`);
      await dodoFetch(`/webhooks/${webhook.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          filter_types: [...new Set([...currentFilters, ...requiredEvents])],
        }),
      });
      console.log(`   ✓ Filter types updated`);
    }
  } else {
    console.log("   + Creating webhook...");
    webhook = await dodoFetch("/webhooks", {
      method: "POST",
      body: JSON.stringify({
        url: webhookUrl,
        description: "InsertGo billing — subscription and payment events",
        filter_types: [
          "subscription.active",
          "subscription.renewed",
          "subscription.plan_changed",
          "subscription.cancelled",
          "subscription.expired",
          "subscription.failed",
          "subscription.on_hold",
          "payment.succeeded",
        ],
      }),
    });
    console.log(`   ✓ Created → ${webhook.id}`);
    const secretRes = await dodoFetch(`/webhooks/${webhook.id}/secret`);
    webhookSecret = secretRes.secret;
  }

  // ── 3. Print env block ──────────────────────────────────────────────────

  console.log("\n" + "═".repeat(72));
  console.log("  ✅  Copy the following into your .env.local file:");
  console.log("═".repeat(72) + "\n");

  console.log(`# ── Payments (Dodo Payments, Merchant of Record) ───────`);
  console.log(`DODO_API_KEY=${API_KEY}`);
  console.log(`DODO_WEBHOOK_SECRET=${webhookSecret}`);
  for (const def of PRODUCTS) {
    console.log(`${def.envKey}=${envLines[def.envKey]}`);
  }
  console.log(`DODO_ENV=test`);

  console.log("\n" + "═".repeat(72));
  console.log("  🔑  Webhook ID: " + webhook.id);
  console.log("  🌐  Webhook URL: " + webhookUrl);
  console.log("  📋  Subscribed events: subscription.*, payment.succeeded");
  console.log("═".repeat(72) + "\n");

  console.log("⚠️  Remember:");
  console.log("   • Switch DODO_ENV=live and use live API keys for production");
  console.log("   • Re-create products in the live environment (test ≠ live)");
  console.log("   • Never commit .env.local to git\n");
}

main().catch((e) => {
  console.error("\n❌ Setup failed:", e.message ?? e);
  process.exit(1);
});
