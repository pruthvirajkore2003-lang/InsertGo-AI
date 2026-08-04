import { Fragment } from "react";
import Link from "next/link";
import { LinearWindows } from "./icons/LinearWindows";
import { HOTKEYS } from "@/lib/constants/hotkeys";

const productLinks = [
  { label: "Features", href: "/features" },
  { label: "Auto text insert", href: "/features/auto-text-insert" },
  { label: "Prompt library", href: "/features/prompt-library" },
  { label: "Desktop assistant", href: "/features/desktop-assistant" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Download", href: "/download" },
];

const learnLinks = [
  { label: "Windows AI guide", href: "/blog/windows-ai-productivity-guide" },
  { label: "InsertGo vs Raycast", href: "/alternatives/raycast-windows" },
  { label: "FAQ", href: "/faq" },
];

const supportLinks = [
  { label: "Contact", href: "/contact" },
  { label: "Release notes", href: "/download" },
];

export function SiteFooter() {
  return (
    <footer className="glass-band relative overflow-hidden px-6 pt-[72px] pb-9">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[220px] left-1/2 h-[420px] w-[900px] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(47,107,255,0.18), transparent 72%)",
        }}
      />
      <div className="relative mx-auto grid max-w-[1080px] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-12">
        <div className="flex max-w-[300px] flex-col gap-3.5">
          <Link href="/" className="flex items-center gap-2.5 text-cream">
            {/* Logo mark, tinted brand cobalt via mask over a #2F6BFF fill
                (see SiteNav). Decorative — the adjacent wordmark names the link. */}
            <img
              src="/main-logo.png"
              alt=""
              className="block h-[26px] w-[26px] shrink-0 [filter:drop-shadow(0_0_5px_rgba(255,255,255,0.3))_drop-shadow(0_0_14px_rgba(47,107,255,0.5))]"
            />
            <span className="font-serif text-[17px] font-semibold">
              InsertGo<span className="text-accent-primary">.AI</span>
            </span>
          </Link>
          <p className="text-sm leading-relaxed text-muted">
            Summon AI anywhere on Windows. Press a hotkey, ask anything, and
            the answer lands right where you&apos;re working.
          </p>
          <div className="flex items-center gap-1.5">
            {HOTKEYS.primary.keys.map((k, i) => (
              <Fragment key={k}>
                {i > 0 && <span className="text-xs text-muted">+</span>}
                <span className="glass-chip rounded-md px-[9px] py-1 text-xs font-medium text-on-accent">
                  {k}
                </span>
              </Fragment>
            ))}
          </div>
        </div>

        <nav aria-label="Product" className="flex flex-col gap-3">
          <span className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
            Product
          </span>
          {productLinks.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-sm text-muted transition-colors duration-200 hover:text-accent-primary"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <nav aria-label="Learn" className="flex flex-col gap-3">
          <span className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
            Learn
          </span>
          {learnLinks.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-sm text-muted transition-colors duration-200 hover:text-accent-primary"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <nav aria-label="Support" className="flex flex-col gap-3">
          <span className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
            Support
          </span>
          {supportLinks.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-sm text-muted transition-colors duration-200 hover:text-accent-primary"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
            Get started
          </span>
          <Link
            href="/download"
            className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-terracotta px-[22px] py-3 text-sm font-medium text-on-accent transition-transform duration-200 hover:-translate-y-px"
          >
            <LinearWindows size={16} />
            Download for Windows
          </Link>
          <span className="text-xs text-muted">
            Free · Windows 10 &amp; 11 · 14 MB
          </span>
        </div>
      </div>

      <div className="relative mx-auto mt-14 flex max-w-[1080px] flex-wrap justify-between gap-3 border-t border-line pt-6">
        <span className="text-[13px] text-muted">
          © 2026 InsertGo.AI — All rights reserved.
        </span>
        <span className="text-[13px] text-muted">
          Built exclusively for Windows.
        </span>
      </div>
    </footer>
  );
}
