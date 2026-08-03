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
