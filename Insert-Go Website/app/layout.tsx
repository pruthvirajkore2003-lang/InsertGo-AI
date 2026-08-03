import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { JsonLd } from "@/components/SeoContent";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-fraunces",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const rawHost =
    requestHeaders.get("x-forwarded-host")?.split(",")[0].trim() ??
    requestHeaders.get("host") ??
    "insertgo.ai";
  const host = /^[a-z0-9.-]+(?::\d+)?$/i.test(rawHost)
    ? rawHost
    : "insertgo.ai";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const rawProtocol =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim() ??
    (isLocal ? "http" : "https");
  const protocol = rawProtocol === "http" || rawProtocol === "https"
    ? rawProtocol
    : "https";
  const origin = `${protocol}://${host}`;
  const socialImage = {
    url: `${origin}/og.png`,
    width: 1731,
    height: 909,
    alt: "InsertGo.AI — AI prompts. Inserted anywhere. Windows 10 and 11.",
  };

  return {
    metadataBase: new URL(origin),
    applicationName: "InsertGo.AI",
    title: {
      default: "InsertGo.AI — Floating AI Prompt Assistant for Windows",
      template: "%s — InsertGo.AI",
    },
    description:
      "Open a floating AI prompt assistant in any Windows app with one hotkey. Run dynamic prompt templates, improve selected text, and insert AI output back at your cursor.",
    category: "productivity",
    openGraph: {
      title: "InsertGo.AI — Floating AI Prompt Assistant for Windows",
      description:
        "One global hotkey for reusable AI prompts, selected-text actions, and direct insertion across Windows apps.",
      url: origin,
      siteName: "InsertGo.AI",
      locale: "en_US",
      type: "website",
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title: "InsertGo.AI — Floating AI Prompt Assistant for Windows",
      description:
        "Reusable prompts and AI text insertion across your Windows desktop.",
      images: [socialImage.url],
    },
  };
}

const siteLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://insertgo.ai/#organization",
      name: "InsertGo.AI",
      alternateName: "InsertGo",
      url: "https://insertgo.ai",
      logo: {
        "@type": "ImageObject",
        url: "https://insertgo.ai/main-logo.png",
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://insertgo.ai/#website",
      name: "InsertGo.AI",
      alternateName: "InsertGo",
      url: "https://insertgo.ai",
      publisher: {
        "@id": "https://insertgo.ai/#organization",
      },
      inLanguage: "en",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={fraunces.variable}>
      <body>
        <JsonLd data={siteLd} />
        {/* Keyboard users otherwise tab through the whole nav on every page.
            Off-screen until focused, then it lands on the fixed pill's line. */}
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <SiteNav />
        {/* tabIndex -1 so the skip link can actually move focus here; without
            it the browser scrolls but focus stays on the link. */}
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
