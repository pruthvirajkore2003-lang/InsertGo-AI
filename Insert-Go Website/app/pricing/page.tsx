import Link from "next/link";
import { headers } from "next/headers";
import { Reveal, FadeUp } from "@/components/Reveal";
import { GlowBackdrop } from "@/components/PageHero";
import { PricingPlans, type Currency } from "./PricingPlans";

const notes = [
  {
    title: "Free credits daily",
    body: "Every account gets 5 credits a day, forever. No credit card required.",
  },
  {
    title: "Credits that keep",
    body: "Add-on packs never expire — daily credits are always spent first.",
  },
  {
    title: "Cancel anytime",
    body: "Downgrade to Free whenever you like — your templates stay on your machine.",
  },
  {
    title: "Questions?",
    body: null, // rendered with links below
  },
];

/**
 * Display currency from the CDN's IP geolocation header — Vercel and
 * Cloudflare both set one, and both work for signed-out visitors (an OAuth
 * profile carries no verified country, only an `en-US`-ish locale hint).
 * Anything missing, unknown ("XX"), or non-India falls back to USD. Display
 * only: Dodo is Merchant of Record and localizes the real charge from the
 * server-pinned product id, so this never touches /api/billing/checkout.
 */
async function detectCurrency(): Promise<Currency> {
  const h = await headers();
  const country = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? "";
  return country.trim().toUpperCase() === "IN" ? "INR" : "USD";
}

export default async function PricingPage() {
  const currency = await detectCurrency();

  return (
    <main className="relative overflow-hidden">
      <GlowBackdrop />

      <section className="relative px-6 pt-40 pb-[30px] text-center">
        <FadeUp>
          <p className="mb-4 text-xs font-medium tracking-[0.16em] text-brand uppercase">
            Pricing
          </p>
        </FadeUp>
        <FadeUp delay={0.06}>
          <h1 className="mx-auto max-w-[740px] font-serif text-[clamp(40px,6vw,68px)] leading-[1.08] font-semibold tracking-[-0.03em] text-ink">
            Start free. Upgrade when it sticks.
          </h1>
        </FadeUp>
        <FadeUp delay={0.12}>
          <p className="mx-auto mt-6 max-w-[540px] text-lg leading-relaxed text-muted">
            Every plan includes the full overlay, auto-insert, and universal
            app compatibility.
          </p>
        </FadeUp>
      </section>

      <PricingPlans currency={currency} />

      <section className="mx-auto max-w-[960px] px-6 pt-[50px] pb-[110px]">
        <Reveal>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-[18px]">
            {notes.map((n) => (
              <div
                key={n.title}
                className="glass-card p-[22px]"
              >
                <h3 className="mt-0 mb-2 font-serif text-base font-semibold text-ink">
                  {n.title}
                </h3>
                {n.body ? (
                  <p className="m-0 text-sm leading-relaxed text-muted">
                    {n.body}
                  </p>
                ) : (
                  <p className="m-0 text-sm leading-relaxed text-muted">
                    Check the{" "}
                    <Link
                      href="/faq"
                      className="font-medium text-brand no-underline hover:underline"
                    >
                      FAQ
                    </Link>{" "}
                    or{" "}
                    <Link
                      href="/contact"
                      className="font-medium text-brand no-underline hover:underline"
                    >
                      contact us
                    </Link>{" "}
                    — we reply within a day.
                  </p>
                )}
              </div>
            ))}
          </div>
        </Reveal>
      </section>
    </main>
  );
}
