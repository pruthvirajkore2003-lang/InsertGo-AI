import Link from "next/link";
import { LinearHeadphone } from "@/components/icons/LinearHeadphone";
import { LinearPeople } from "@/components/icons/LinearPeople";
import { LinearMessageText } from "@/components/icons/LinearMessageText";
import { FadeUp } from "@/components/Reveal";
import { GlowBackdrop } from "@/components/PageHero";
import { ContactForm } from "./ContactForm";

const sideCards = [
  {
    icon: LinearHeadphone,
    tile: "var(--color-tile-sand)",
    title: "Support",
    body: (
      <>
        For install or account issues:
        <br />
        <span className="font-medium text-brand">support@insertgo.ai</span>
      </>
    ),
  },
  {
    icon: LinearPeople,
    tile: "var(--color-tile-sky)",
    title: "Teams & sales",
    body: (
      <>
        Rolling out InsertGo to a team?
        <br />
        <span className="font-medium text-brand">sales@insertgo.ai</span>
      </>
    ),
  },
  {
    icon: LinearMessageText,
    tile: "var(--color-tile-stone)",
    title: "Quick answers",
    body: (
      <>
        Most questions are already covered in the{" "}
        <Link
          href="/faq"
          className="font-medium text-brand no-underline hover:underline"
        >
          FAQ
        </Link>
        .
      </>
    ),
  },
];

export default function ContactPage() {
  return (
    <main className="relative overflow-hidden">
      <GlowBackdrop />

      <section className="relative px-6 pt-40 pb-10 text-center">
        <FadeUp>
          <p className="mb-4 text-xs font-medium tracking-[0.16em] text-brand uppercase">
            Contact
          </p>
        </FadeUp>
        <FadeUp delay={0.06}>
          <h1 className="mx-auto max-w-[700px] font-serif text-[clamp(40px,6vw,64px)] leading-[1.08] font-semibold tracking-[-0.03em] text-ink">
            Talk to a human
          </h1>
        </FadeUp>
        <FadeUp delay={0.12}>
          <p className="mx-auto mt-[22px] max-w-[480px] text-[17px] leading-relaxed text-muted">
            Bug reports, feature ideas, team plans, or just curiosity — we read
            everything and reply within one business day.
          </p>
        </FadeUp>
      </section>

      <FadeUp delay={0.18}>
        <section className="mx-auto max-w-[1000px] px-6 pt-10 pb-[110px]">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start gap-6">
            <div className="glass-panel p-[clamp(26px,4vw,40px)]">
              <ContactForm />
            </div>

            <div className="flex flex-col gap-[18px]">
              {sideCards.map((c) => (
                <div
                  key={c.title}
                  className="glass-card flex gap-3.5 p-6"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-ink"
                    style={{ background: c.tile }}
                  >
                    <c.icon size={20} />
                  </span>
                  <div>
                    <h3 className="mt-0 mb-1.5 font-serif text-base font-semibold text-ink">
                      {c.title}
                    </h3>
                    <p className="m-0 text-sm leading-relaxed text-muted">
                      {c.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeUp>
    </main>
  );
}
