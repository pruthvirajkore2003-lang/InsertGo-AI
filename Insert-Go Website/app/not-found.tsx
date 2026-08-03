import type { Metadata } from "next";
import Link from "next/link";
import { GlowBackdrop } from "@/components/PageHero";
import { FadeUp } from "@/components/Reveal";
import { DownloadButton, GhostButton } from "@/components/Buttons";

export const metadata: Metadata = {
  title: "Page not found",
  // A 404 has nothing to rank for, and indexing it splits authority off the
  // real pages.
  robots: { index: false, follow: true },
};

/** The routes a lost visitor actually wants — not a sitemap dump. */
const exits = [
  { href: "/features", label: "Features", desc: "What InsertGo does" },
  { href: "/how-it-works", label: "How it works", desc: "The three-step loop" },
  { href: "/pricing", label: "Pricing", desc: "Plans and credit packs" },
  { href: "/faq", label: "FAQ", desc: "Answers to the common questions" },
];

export default function NotFound() {
  return (
    <main className="relative overflow-hidden">
      <GlowBackdrop />

      <section className="relative px-6 pt-40 pb-14 text-center">
        <FadeUp>
          <p className="mb-4 text-xs font-medium tracking-[0.16em] text-brand uppercase">
            404
          </p>
        </FadeUp>
        <FadeUp delay={0.06}>
          <h1 className="mx-auto max-w-[720px] font-serif text-[clamp(36px,5.5vw,60px)] leading-[1.08] font-semibold tracking-[-0.03em] text-ink">
            That page isn&apos;t here
          </h1>
        </FadeUp>
        <FadeUp delay={0.12}>
          <p className="mx-auto mt-6 max-w-[520px] text-lg leading-relaxed text-muted">
            The link may be out of date, or the address has a typo. Everything
            below still works.
          </p>
        </FadeUp>
        <FadeUp delay={0.18}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <DownloadButton>Download for Windows</DownloadButton>
            <GhostButton href="/">Back to home</GhostButton>
          </div>
        </FadeUp>
      </section>

      <section className="mx-auto max-w-[880px] px-6 pb-[110px]">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          {exits.map((e, i) => (
            <FadeUp key={e.href} delay={0.24 + i * 0.06}>
              <Link
                href={e.href}
                className="glass-card flex h-full flex-col gap-1.5 p-6 transition-transform duration-300 ease-standard hover:-translate-y-1"
              >
                <span className="font-serif text-[17px] font-semibold text-ink">
                  {e.label}
                </span>
                <span className="text-sm leading-relaxed text-muted">
                  {e.desc}
                </span>
              </Link>
            </FadeUp>
          ))}
        </div>
        <p className="mt-10 text-center text-[15px] text-muted">
          Still stuck?{" "}
          <Link
            href="/contact"
            className="font-medium text-brand no-underline hover:underline"
          >
            Tell us what you were looking for
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
