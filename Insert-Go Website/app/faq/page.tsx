import Link from "next/link";
import { FadeUp } from "@/components/Reveal";
import { GlowBackdrop } from "@/components/PageHero";
import { DownloadButton, GhostButton } from "@/components/Buttons";
import { FaqAccordion } from "./FaqAccordion";

export default function FAQPage() {
  return (
    <main className="relative overflow-hidden">
      <GlowBackdrop />

      <section className="relative px-6 pt-40 pb-10 text-center">
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
        <section className="mx-auto max-w-[760px] px-6 pt-10 pb-[90px]">
          <FaqAccordion />
        </section>
      </FadeUp>

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
