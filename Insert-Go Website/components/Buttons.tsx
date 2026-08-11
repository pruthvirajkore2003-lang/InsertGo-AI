import Link from "next/link";
import type { ReactNode } from "react";
import { WindowsLogo } from "./icons/WindowsLogo";

export function DownloadButton({
  children = "Download for Windows — free",
  iconSize = 18,
}: {
  children?: ReactNode;
  iconSize?: number;
}) {
  return (
    <Link
      href="/download"
      className="inline-flex h-12 items-center gap-2.5 rounded-btn bg-accent-primary px-7 text-base font-medium text-on-accent shadow-cta transition-[transform,background-color,box-shadow] duration-200 ease-standard hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-cta-hover active:translate-y-0 active:scale-[0.97] active:shadow-cta-sm active:duration-75"
    >
      <WindowsLogo size={iconSize} />
      {children}
    </Link>
  );
}

export function GhostButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="glass-chip inline-flex h-12 items-center gap-2.5 rounded-btn px-7 text-base font-medium text-ink transition-[background-color,border-color,transform] duration-200 ease-standard hover:bg-surface-hover active:scale-[0.97] active:duration-75"
    >
      {children}
    </Link>
  );
}
