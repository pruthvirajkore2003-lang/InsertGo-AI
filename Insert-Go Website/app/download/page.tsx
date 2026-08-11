import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { LinearWindows } from "@/components/icons/LinearWindows";
import { WindowsLogo } from "@/components/icons/WindowsLogo";
import { LinearKey } from "@/components/icons/LinearKey";
import { LinearKeyboard } from "@/components/icons/LinearKeyboard";
import { Reveal, FadeUp } from "@/components/Reveal";
import { GlowBackdrop } from "@/components/PageHero";
import { HOTKEYS } from "@/lib/constants/hotkeys";

export const metadata: Metadata = {
  title: "Download InsertGo for Windows",
  description:
    "Download InsertGo for Windows 10 & 11. One small installer, under a minute to set up. Free forever with 5 AI credits a day — no API key, no credit card.",
  alternates: { canonical: "/download" },
};

const install = [
  {
    num: "01",
    icon: LinearWindows,
    tile: "var(--color-tile-sand)",
    title: "Run the installer",
    desc: "Download InsertGo-Setup.exe and run it. No admin rights required — it installs per-user in seconds.",
  },
  {
    num: "02",
    icon: LinearKey,
    tile: "var(--color-tile-sky)",
    title: "Sign in via browser",
    desc: "The app opens this site in your browser to sign you in — approve the code it shows and your session transfers back automatically.",
  },
  {
    num: "03",
    icon: LinearKeyboard,
    tile: "var(--color-tile-stone)",
    title: `Press ${HOTKEYS.primary.label}`,
    desc: `That's it. The overlay is now one keystroke away in every application on your PC — or press ${HOTKEYS.improve.label} to rewrite the field you are typing in without opening it.`,
  },
];

const reqs = [
  { k: "Operating system", v: "Windows 10 (1903+) or Windows 11" },
  { k: "Architecture", v: "64-bit (x64 / ARM64)" },
  { k: "Memory", v: "4 GB RAM minimum" },
  { k: "Disk space", v: "60 MB" },
  { k: "Network", v: "Internet connection for AI requests" },
];

const changelog = [
  {
    tag: "new",
    tile: "var(--color-tile-sand)",
    text: "Inline Improve — rewrite the focused text field without opening the palette.",
  },
  {
    tag: "new",
    tile: "var(--color-tile-sand)",
    text: "Selection actions — review contextual AI skills beside highlighted text.",
  },
  {
    tag: "improved",
    tile: "var(--color-tile-mist)",
    text: "Managed AI — no API key to configure; the app stores only your session token.",
  },
  {
    tag: "fixed",
    tile: "var(--color-tile-stone)",
    text: "Failed focus verification now falls back to a clear manual-paste path.",
  },
];

// Wispr Flow–style gate: the page stays public, but the installer link is
// tied to a signed-in account. Signed-out visitors are sent to /login first.
// Split out and suspended so the session lookup (a Postgres round-trip) never
// blocks the rest of the page from streaming.
async function DownloadCta() {
  const session = await auth.api.getSession({ headers: await headers() });
  const downloadUrl = process.env.NEXT_PUBLIC_DOWNLOAD_URL_WINDOWS;

  return (
    <div className="flex min-h-[132px] flex-col items-center gap-4">
        {!session ? (
          <>
            <Link
              href={`/login?next=${encodeURIComponent("/download")}`}
              className="inline-flex animate-glow-cta items-center gap-3 rounded-full bg-terracotta px-9 py-[18px] text-lg font-medium text-on-accent transition-transform duration-200 hover:-translate-y-0.5"
            >
              <WindowsLogo size={20} />
              Sign in to download
            </Link>
            <span className="text-[13px] text-muted">
              Your download is tied to your InsertGo account — sign in (or
              create one in seconds) and we&apos;ll bring you right back
              here.
            </span>
          </>
        ) : downloadUrl ? (
          <>
            <a
              href={downloadUrl}
              download
              rel="noopener noreferrer"
              className="inline-flex animate-glow-cta items-center gap-3 rounded-full bg-terracotta px-9 py-[18px] text-lg font-medium text-on-accent transition-transform duration-200 hover:-translate-y-0.5"
            >
              <WindowsLogo size={20} />
              Download InsertGo-Setup.exe
            </a>
            <span className="text-[13px] text-muted">
              Version 2.4.1 · 14 MB · Windows 10 &amp; 11 (64-bit) · Signed
              installer · Sign in to the app as{" "}
              <strong className="break-all text-ink-soft">
                {session.user.email}
              </strong>
            </span>
          </>
        ) : (
          <>
            <span className="inline-flex cursor-not-allowed items-center gap-3 rounded-full bg-terracotta/50 px-9 py-[18px] text-lg font-medium text-on-accent">
              <WindowsLogo size={20} />
              Windows build coming soon
            </span>
            <span className="text-[13px] text-muted">
              We&apos;re putting the finishing touches on the installer —
              check back shortly.
            </span>
          </>
        )}
    </div>
  );
}

export default function DownloadPage() {
  return (
    <main className="relative overflow-hidden">
      <GlowBackdrop />

      <section className="relative px-6 pt-40 pb-[60px] text-center">
        <FadeUp>
          <p className="mb-4 text-xs font-medium tracking-[0.16em] text-brand uppercase">
            Download
          </p>
        </FadeUp>
        <FadeUp delay={0.06}>
          <h1 className="mx-auto max-w-[760px] font-serif text-[clamp(40px,6vw,68px)] leading-[1.08] font-semibold tracking-[-0.03em] text-ink">
            Get InsertGo.AI for Windows
          </h1>
        </FadeUp>
        <FadeUp delay={0.12}>
          <p className="mx-auto mt-6 max-w-[520px] text-lg leading-relaxed text-muted">
            One small installer. Under a minute to set up. Free forever with 5
            AI credits a day — no API key, no credit card.
          </p>
        </FadeUp>
        <FadeUp delay={0.18}>
          <div className="mt-[38px] flex flex-col items-center gap-4">
            <Suspense
              fallback={
                <div className="min-h-[132px]" aria-hidden="true" />
              }
            >
              <DownloadCta />
            </Suspense>
          </div>
        </FadeUp>
      </section>

      <section id="install" className="mx-auto max-w-[1000px] px-6 py-[60px]">
        <Reveal className="mb-12 text-center">
          <h2 className="m-0 font-serif text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.02em] text-ink">
            Up and running in three steps
          </h2>
        </Reveal>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[18px]">
          {install.map((s, i) => (
            <Reveal key={s.num} delay={i * 0.1}>
              <div className="glass-card flex h-full flex-col gap-3 p-7">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-ink"
                  style={{ background: s.tile }}
                >
                  <s.icon size={22} />
                </span>
                <div className="flex items-center gap-2.5">
                  <span className="text-[13px] font-medium text-brand">
                    {s.num}
                  </span>
                  <h3 className="m-0 font-serif text-[19px] font-semibold text-ink">
                    {s.title}
                  </h3>
                </div>
                <p className="m-0 text-[15px] leading-relaxed text-muted">
                  {s.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-8 text-center">
          <p className="m-0 text-[14px] text-muted">
            When the desktop app opens, click{" "}
            <strong className="text-ink-soft">Sign in with browser</strong> — it
            brings you back to this site to approve, then hands you straight
            back to the app with the account you just signed in with.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1000px] px-6 py-[50px]">
        <Reveal>
          <div className="glass-panel grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-8 p-[clamp(28px,4vw,44px)]">
            <div>
              <h2 className="mt-0 mb-[18px] font-serif text-[21px] font-semibold text-ink">
                System requirements
              </h2>
              <div className="flex flex-col gap-3">
                {reqs.map((r) => (
                  <div
                    key={r.k}
                    className="flex justify-between gap-4 border-b border-line pb-2.5"
                  >
                    <span className="text-sm text-muted">{r.k}</span>
                    <span className="text-right text-sm font-medium text-ink-soft">
                      {r.v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="mt-0 mb-[18px] font-serif text-[21px] font-semibold text-ink">
                Current highlights
              </h2>
              <div className="flex flex-col gap-3.5">
                {changelog.map((c, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span
                      className="mt-px shrink-0 rounded-[5px] px-2 py-0.5 text-[11px] font-medium text-ink"
                      style={{ background: c.tile }}
                    >
                      {c.tag}
                    </span>
                    <span className="text-sm leading-[1.55] text-ink-soft">
                      {c.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="px-6 pt-[60px] pb-[110px] text-center">
        <Reveal>
          <p className="m-0 text-[15px] text-muted">
            Not sure yet? See{" "}
            <Link
              href="/how-it-works"
              className="font-medium text-brand no-underline hover:underline"
            >
              how it works
            </Link>{" "}
            or browse the{" "}
            <Link
              href="/faq"
              className="font-medium text-brand no-underline hover:underline"
            >
              FAQ
            </Link>
            .
          </p>
        </Reveal>
      </section>
    </main>
  );
}
