import type { Metadata } from "next";
import { Suspense } from "react";
import { Fraunces } from "next/font/google";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { JsonLd } from "@/components/SeoContent";
import { SITE_URL } from "@/lib/seo";
import {
  defaultLocale,
  isIndexedLocale,
  localeFromPathname,
  ogLocale,
  type Locale,
} from "@/i18n-config";
import { getDictionary } from "@/lib/i18n";
import { AdSenseScript } from "@/components/ads/AdSenseScript";
import { ConsentMode } from "@/components/analytics/ConsentMode";
import { ConsentSync } from "@/components/analytics/ConsentSync";
import { GoogleTag } from "@/components/analytics/GoogleTag";
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import { PostHogPageview } from "@/components/providers/PostHogPageview";
import { WebVitalsReporter } from "@/components/providers/WebVitalsReporter";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-fraunces",
  display: "swap",
});

/**
 * The language this document is actually WRITTEN in — the path's locale only
 * when that locale's copy is translated (INDEXED_LOCALES), and the default
 * otherwise.
 *
 * `/fr/pricing` renders English copy today, so reporting `fr` would misstate
 * the document language to a screen reader (WCAG 3.1.1) and to Google, which
 * reads language from content. It drives `<html lang>`, `og:locale` and the
 * nav dictionary together, so a half-translated page — French chrome over
 * English prose — cannot happen either.
 */
function documentLocale(pathname: string | null): Locale {
  const requested = localeFromPathname(pathname);
  return isIndexedLocale(requested) ? requested : defaultLocale;
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const locale = documentLocale(requestHeaders.get("x-pathname"));
  const rawHost =
    requestHeaders.get("x-forwarded-host")?.split(",")[0].trim() ??
    requestHeaders.get("host") ??
    "insertgo.com";
  const host = /^[a-z0-9.-]+(?::\d+)?$/i.test(rawHost)
    ? rawHost
    : "insertgo.com";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const rawProtocol =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim() ??
    (isLocal ? "http" : "https");
  const protocol = rawProtocol === "http" || rawProtocol === "https"
    ? rawProtocol
    : "https";
  // Canonicals and og:url have to name the production host, not whichever host
  // served the request. A preview deployment (*.vercel.app) or an alias domain
  // would otherwise self-canonicalize, and Google would see two indexable
  // copies of every page competing with each other. Local dev keeps the
  // request origin so relative asset URLs still resolve against the dev server.
  const origin = isLocal ? `${protocol}://${host}` : SITE_URL;
  const socialImage = {
    url: `${origin}/og.png`,
    width: 1731,
    height: 909,
    alt: "InsertGo AI — AI prompts. Inserted anywhere. Windows 10 and 11.",
  };

  return {
    metadataBase: new URL(origin),
    applicationName: "InsertGo AI",
    title: {
      default: "InsertGo AI — Vibe Coding Prompt Assistant for Windows",
      template: "%s — InsertGo AI",
    },
    description:
      "Free floating prompt assistant for Windows: write, refine, and reuse vibe coding prompts, then insert AI text at your cursor. 5 credits a day, no credit card.",
    category: "productivity",
    openGraph: {
      title: "InsertGo AI — Vibe Coding Prompt Assistant for Windows",
      description:
        "One global hotkey to write, reuse, and insert vibe coding prompts across editors, terminals, and browsers on Windows. Free plan, no credit card.",
      url: origin,
      siteName: "InsertGo AI",
      locale: ogLocale[locale],
      type: "website",
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title: "InsertGo AI — Vibe Coding Prompt Assistant for Windows",
      description:
        "Reusable vibe coding prompt templates, selected-text actions, and AI text insertion across your Windows desktop.",
      images: [socialImage.url],
    },
  };
}

const siteLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://insertgo.com/#organization",
      name: "InsertGo AI",
      alternateName: "InsertGo",
      url: "https://insertgo.com",
      logo: {
        "@type": "ImageObject",
        url: "https://insertgo.com/main-logo.png",
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://insertgo.com/#website",
      name: "InsertGo AI",
      alternateName: "InsertGo",
      url: "https://insertgo.com",
      publisher: {
        "@id": "https://insertgo.com/#organization",
      },
      inLanguage: "en",
    },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The <html> element is only rendered here, so `lang` cannot come from
  // app/[locale]'s params — it comes from the path middleware stamped. This is
  // also the one place that resolves the dictionary, because the chrome below
  // sits outside the [locale] segment (it wraps /login and /account too).
  const locale = documentLocale((await headers()).get("x-pathname"));
  const t = getDictionary(locale);

  return (
    <html lang={locale} className={fraunces.variable}>
      {/* Consent Mode v2 defaults, as a direct child of <html> — Next's
          documented placement for `beforeInteractive`, and the one that puts
          the tag in <head> ahead of every bundle. The ORDER relative to the
          two loaders below is the whole control: a default that lands after a
          tag has already run is not a default. */}
      <ConsentMode />
      <body>
        <JsonLd data={siteLd} />
        <GoogleTag />
        <AdSenseScript />
        {/* Keyboard users otherwise tab through the whole nav on every page.
            Off-screen until focused, then it lands on the fixed pill's line. */}
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <PostHogProvider>
          <SiteNav t={t.nav} />
          {/* tabIndex -1 so the skip link can actually move focus here; without
              it the browser scrolls but focus stays on the link. */}
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
          <SiteFooter />
          {/* useSearchParams opts its subtree out of static rendering, so the
              pageview reporter is suspended on its own rather than taking the
              page with it. */}
          <Suspense fallback={null}>
            <PostHogPageview />
          </Suspense>
          <ConsentSync />
          <WebVitalsReporter />
        </PostHogProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
