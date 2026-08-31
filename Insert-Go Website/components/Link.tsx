"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { localeFromPathname, localizeHref } from "@/i18n-config";

/**
 * `next/link` that carries the active locale.
 *
 * Every internal href in this codebase is written locale-free (`/pricing`), and
 * this is the one place that turns it into `/fr/pricing`. The alternative —
 * letting middleware redirect each of them — would make every internal link a
 * 307, which costs a round trip per click and hands crawlers a site whose
 * internal graph points exclusively at redirects.
 *
 * A client component because the locale comes from `usePathname()`: server
 * components deep in the tree have no `params`, and threading one through every
 * button and card is the churn this wrapper exists to avoid. `next/link` is a
 * client component already, so this adds a function, not a boundary.
 *
 * Non-localized routes (`/account`, `/api/…`) and external hrefs pass through
 * untouched — see `localizeHref`.
 */
export default function Link({ href, ...rest }: ComponentProps<typeof NextLink>) {
  const locale = localeFromPathname(usePathname());
  return (
    <NextLink
      href={typeof href === "string" ? localizeHref(href, locale) : href}
      {...rest}
    />
  );
}
