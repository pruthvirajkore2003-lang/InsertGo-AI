import Link from "@/components/Link";
import { FadeUp } from "@/components/Reveal";
import { GlowBackdrop } from "@/components/PageHero";
import { DownloadButton, GhostButton } from "@/components/Buttons";
import { AdUnit } from "@/components/ads/AdUnit";
import { Breadcrumbs } from "@/components/SeoContent";
import { FaqAccordion } from "./FaqAccordion";

export default function FAQPage() {
  return (
    <main className="relative overflow-hidden">
      <GlowBackdrop />
      {/* The BreadcrumbList in layout.tsx now describes a trail the page
          actually renders, as every other landing page does. */}
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "FAQ", href: "/faq" },
        ]}
      />

      <section className="relative px-6 pt-4 pb-6 text-center sm:pt-6 sm:pb-8">
        <FadeUp>
          <p className="mb-4 text-xs font-medium tracking-[0.16em] text-brand uppercase">
            FAQ
          </p>
        </FadeUp>
        <FadeUp delay={0.06}>
          <h1 className="mx-auto max-w-[700px] font-serif text-[clamp(40px,6vw,64px)] leading-[1.08] font-semibold tracking-[-0.03em] text-ink">
            Questions, answered
          </h1>
        </FadeUp>
        <FadeUp delay={0.12}>
          <p className="mx-auto mt-[22px] max-w-[480px] text-[17px] leading-relaxed text-muted">
            Everything people ask before their first hotkey press. Can&apos;t
            find yours?{" "}
            <Link
              href="/contact"
              className="font-medium text-brand no-underline hover:underline"
            >
              Contact us
            </Link>
            .
          </p>
        </FadeUp>
      </section>

      <FadeUp delay={0.18}>
        <section className="mx-auto max-w-[760px] px-6 pt-2 pb-[90px] sm:pt-4">
          <FaqAccordion />
        </section>
      </FadeUp>

      <AdUnit className="pb-12" />

      <section className="px-6 pt-5 pb-[110px] text-center">
        <h2 className="m-0 font-serif text-[clamp(26px,3.5vw,36px)] font-semibold tracking-[-0.02em] text-ink">
          Still curious? Just try it.
        </h2>
        <div className="mt-7 flex flex-wrap justify-center gap-3.5">
          <DownloadButton />
          <GhostButton href="/contact">Ask us anything</GhostButton>
        </div>
      </section>
    </main>
  );
}
