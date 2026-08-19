import Link from "next/link";
import type { ReactNode } from "react";
import { DownloadButton, GhostButton } from "./Buttons";
import type { BreadcrumbItem, FaqItem } from "@/lib/seo";

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mx-auto max-w-[1080px] px-6 pt-32 text-sm text-muted"
    >
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <li key={item.href} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden>/</span>}
            {index === items.length - 1 ? (
              <span aria-current="page" className="text-ink-soft">
                {item.name}
              </span>
            ) : (
              <Link href={item.href} className="hover:text-ink">
                {item.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function DirectAnswer({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="glass-panel mx-auto max-w-[900px] p-[clamp(24px,4vw,40px)]">
      <h2 className="m-0 font-serif text-[clamp(25px,3vw,34px)] font-semibold tracking-[-0.02em] text-ink">
        {title}
      </h2>
      <p className="mt-4 mb-0 max-w-[780px] text-[17px] leading-[1.7] text-ink-soft">
        {children}
      </p>
    </div>
  );
}

export function FaqBlocks({ items }: { items: FaqItem[] }) {
  return (
    <div className="grid gap-[18px] md:grid-cols-2">
      {items.map(({ question, answer }) => (
        <article key={question} className="glass-card p-7">
          <h3 className="m-0 font-serif text-xl font-semibold leading-snug text-ink">
            {question}
          </h3>
          <p className="mt-3 mb-0 text-[15px] leading-[1.7] text-muted">
            {answer}
          </p>
        </article>
      ))}
    </div>
  );
}

export function SeoCta({
  title,
  body,
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  body: string;
  secondaryHref: string;
  secondaryLabel: string;
}) {
  return (
    <section className="px-6 pt-[60px] pb-[110px] text-center">
      <div className="glass-panel mx-auto max-w-[900px] px-7 py-14">
        <h2 className="m-0 font-serif text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.02em] text-ink">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-[580px] text-base leading-relaxed text-muted">
          {body}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3.5">
          <DownloadButton />
          <GhostButton href={secondaryHref}>{secondaryLabel}</GhostButton>
        </div>
      </div>
    </section>
  );
}

export type ComparisonRow = {
  criterion: string;
  /** left column — always InsertGo */
  ours: string;
  /** right column — the compared product */
  theirs: string;
};

export function ComparisonTable({
  caption,
  theirs,
  rows,
}: {
  caption: string;
  theirs: string;
  rows: ComparisonRow[];
}) {
  return (
    <div className="glass-panel overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="p-5 text-sm font-semibold text-ink">
              Decision
            </th>
            <th scope="col" className="p-5 text-sm font-semibold text-ink">
              InsertGo
            </th>
            <th scope="col" className="p-5 text-sm font-semibold text-ink">
              {theirs}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.criterion} className="border-b border-line last:border-0">
              <th
                scope="row"
                className="w-[20%] p-5 align-top text-sm font-semibold text-ink-soft"
              >
                {row.criterion}
              </th>
              <td className="w-[40%] p-5 align-top text-sm leading-relaxed text-muted">
                {row.ours}
              </td>
              <td className="w-[40%] p-5 align-top text-sm leading-relaxed text-muted">
                {row.theirs}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "Sources checked" block — every comparison claim on a page points at the
 *  vendor doc it came from, so a reviewer can re-verify without trusting us. */
export function SourceNote({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto max-w-[900px] px-6 pb-8">
      <div className="glass-card p-7 text-sm leading-relaxed text-muted">
        <h2 className="mt-0 font-serif text-xl font-semibold text-ink">
          Sources checked
        </h2>
        <p className="mb-0">{children}</p>
      </div>
    </section>
  );
}

/** Renders the same steps a page passes to `pageGraph({ howTo })`. The ids
 *  match the `#step-N` fragments in the HowToStep urls, so every schema step
 *  resolves to real text on the page. */
export function HowToSteps({
  steps,
}: {
  steps: { name: string; text: string }[];
}) {
  return (
    <ol className="grid gap-[18px] md:grid-cols-2">
      {steps.map((step, index) => (
        <li id={`step-${index + 1}`} key={step.name} className="scroll-mt-28">
          <article className="glass-card flex h-full gap-4 p-7">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-ink">
              {index + 1}
            </span>
            <div>
              <h3 className="m-0 font-serif text-xl font-semibold text-ink">
                {step.name}
              </h3>
              <p className="mt-2 mb-0 text-[15px] leading-relaxed text-muted">
                {step.text}
              </p>
            </div>
          </article>
        </li>
      ))}
    </ol>
  );
}
