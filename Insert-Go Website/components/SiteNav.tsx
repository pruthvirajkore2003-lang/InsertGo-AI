"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAppShortcuts } from "@/hooks/useAppShortcuts";
import { useSession } from "@/lib/auth-client";
import { LinearWindows } from "./icons/LinearWindows";

const links = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/features" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

export function SiteNav() {
  const pathname = usePathname();
  // Signed-in visitors had no route to /account anywhere in the chrome — the
  // nav offered "Sign in" whether or not they already were. The slot below
  // keeps a fixed width and only fades in once the session resolves, so the
  // swap never shifts the layout around it.
  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(false);
  const [condensed, setCondensed] = useState(false);
  const linksRef = useRef<HTMLDivElement>(null);
  // One pill that travels between links, instead of a pill per link popping in
  // and out. Position is measured, not guessed — labels are text, so their
  // widths change with the font that actually loads and with the locale.
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);

  useEffect(() => {
    const row = linksRef.current;
    if (!row) return;
    const measure = () => {
      const active = row.querySelector<HTMLElement>('[data-active="true"]');
      setPill(active ? { x: active.offsetLeft, w: active.offsetWidth } : null);
    };
    measure();
    // font swap and viewport changes both move the target
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  }, [pathname]);

  // Apple's nav doesn't fade in — it *condenses*. At the top of the page it
  // floats wide and nearly clear; past the fold it tightens, frosts, and
  // drops a shadow so body copy scrolling underneath stays readable.
  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // close the mobile menu whenever navigation happens
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useAppShortcuts({
    onClose: open
      ? () => {
          setOpen(false);
        }
      : undefined,
  });

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[500] flex flex-col items-center px-5 py-4">
      <nav
        data-condensed={condensed}
        className="nav-shell animate-nav-enter ease-apple pointer-events-auto flex w-full max-w-[1000px] items-center justify-between gap-4 rounded-full py-2 pr-2 pl-4"
      >
        <Link href="/" className="flex items-center gap-2.5 text-ink">
          {/* Logo mark, tinted brand cobalt: the white silhouette PNG is used
              as a mask over a #2F6BFF fill (bg-brand), so no color-approximating
              filter chain is needed. Decorative — the adjacent wordmark names
              the link. */}
          <img
            src="/main-logo.png"
            alt="InsertGo Logo"
            className="block h-[26px] w-[26px] shrink-0 transition-transform duration-500 hover:rotate-[360deg] [filter:drop-shadow(0_0_5px_rgba(255,255,255,0.35))_drop-shadow(0_0_14px_rgba(47,107,255,0.55))]"
          />
          <span className="font-serif text-[17px] font-semibold tracking-[-0.01em]">
            InsertGo<span className="text-brand">.AI</span>
          </span>
        </Link>

        <div
          ref={linksRef}
          className="relative hidden items-center gap-0.5 min-[901px]:flex"
        >
          {/* mounted only once measured, so it appears in place rather than
              sliding in from the left on first paint */}
          {pill && (
            <span
              aria-hidden
              className="ease-apple pointer-events-none absolute top-0 left-0 h-full rounded-full bg-white/[0.11] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] transition-[transform,width] duration-[420ms]"
              style={{ transform: `translateX(${pill.x}px)`, width: pill.w }}
            />
          )}
          {links.map((l) => {
            const active =
              pathname === l.href ||
              (l.href !== "/" && pathname.startsWith(`${l.href}/`));
            return (
              <Link
                key={l.href}
                href={l.href}
                data-active={active}
                className={`ease-apple relative rounded-full px-[13px] py-2 text-sm font-medium whitespace-nowrap transition-colors duration-300 ${
                  active ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`ease-apple hidden min-w-[76px] justify-end transition-opacity duration-300 sm:flex ${
              isPending ? "opacity-0" : "opacity-100"
            }`}
          >
            {session ? (
              <Link
                href="/account"
                aria-current={pathname === "/account" ? "page" : undefined}
                title={session.user.email}
                className="ease-apple inline-flex items-center gap-2 rounded-full py-[7px] pr-4 pl-[7px] text-sm font-medium whitespace-nowrap text-muted transition-colors duration-300 hover:bg-white/[0.06] hover:text-ink"
              >
                <span
                  aria-hidden
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-brand/25 text-[12px] font-semibold text-ink"
                >
                  {(session.user.name || session.user.email)
                    .charAt(0)
                    .toUpperCase()}
                </span>
                Account
              </Link>
            ) : (
              <Link
                href="/login"
                className="ease-apple inline-flex items-center rounded-full px-4 py-[11px] text-sm font-medium whitespace-nowrap text-muted transition-colors duration-300 hover:text-ink"
              >
                Sign in
              </Link>
            )}
          </div>
          <Link
            href="/download"
            className="ease-apple inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-[11px] text-sm font-medium whitespace-nowrap text-on-accent transition-all duration-300 hover:-translate-y-px hover:shadow-cta-sm active:translate-y-0 active:scale-[0.97] active:duration-75"
          >
            <LinearWindows size={16} />
            <span className="hidden sm:inline">Download for Windows</span>
            <span className="sm:hidden">Download</span>
          </Link>

          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="ease-apple flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-ink transition-[background-color,transform] duration-300 hover:bg-white/5 active:scale-95 active:duration-75 min-[901px]:hidden"
          >
            <span className="relative block h-3 w-[18px]">
              <span
                className={`absolute left-0 top-0 h-[2px] w-full rounded-full bg-current transition-transform duration-200 ${
                  open ? "translate-y-[5px] rotate-45" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-[5px] h-[2px] w-full rounded-full bg-current transition-opacity duration-200 ${
                  open ? "opacity-0" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-[10px] h-[2px] w-full rounded-full bg-current transition-transform duration-200 ${
                  open ? "-translate-y-[5px] -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </div>
      </nav>

      <div
        aria-hidden={!open}
        className={`glass-floating mt-2 w-full max-w-[1000px] rounded-3xl p-2 transition-[opacity,transform,visibility] duration-[260ms] ease-standard min-[901px]:hidden ${
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none invisible -translate-y-2 opacity-0"
        }`}
      >
        {links.map((l) => {
          const active =
            pathname === l.href ||
            (l.href !== "/" && pathname.startsWith(`${l.href}/`));
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`ease-apple block rounded-2xl px-4 py-3 text-[15px] font-medium transition-colors duration-300 ${
                active
                  ? "bg-surface-hover text-ink"
                  : "text-muted hover:bg-surface hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          );
        })}

        {/* The desktop rail's account slot has no room on mobile, so it lands
            here instead of being dropped — same destination either way. */}
        {!isPending && (
          <Link
            href={session ? "/account" : "/login"}
            onClick={() => setOpen(false)}
            className="ease-apple mt-1 block rounded-2xl border-t border-line px-4 py-3 text-[15px] font-medium text-muted transition-colors duration-300 hover:bg-surface hover:text-ink"
          >
            {session ? "Account" : "Sign in"}
          </Link>
        )}
      </div>
    </div>
  );
}
