import { defaultLocale, type Locale } from "@/i18n-config";
import { HOTKEYS } from "@/lib/constants/hotkeys";
import { plans } from "@/lib/pricing";

export const SITE_URL = "https://insertgo.com";
/** Origin plus the default locale. Every *page* URL now carries a locale
 *  segment, so a bare `${SITE_URL}/download` is a redirect, not a document.
 *  Entities that are the same in every language — the product, its offers —
 *  anchor on the default locale rather than pretending to be locale-free. */
export const DEFAULT_LOCALE_URL = `${SITE_URL}/${defaultLocale}`;
export const CONTENT_UPDATED = "2026-08-18";

/** Stable @id anchors. The Organization and WebSite nodes are emitted once per
 *  document by app/layout.tsx, so page graphs reference them instead of
 *  restating them. */
export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const SOFTWARE_ID = `${SITE_URL}/#software`;

export type FaqItem = {
  question: string;
  answer: string;
};

export type BreadcrumbItem = {
  name: string;
  href: string;
};

export type HowToStepItem = {
  name: string;
  text: string;
};

function questionNodes(items: FaqItem[]) {
  return items.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: {
      "@type": "Answer",
      text: answer,
    },
  }));
}

export function faqSchema(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questionNodes(items),
  };
}

function breadcrumbNodes(items: BreadcrumbItem[], locale: Locale) {
  return items.map(({ name, href }, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name,
    // `href` is written locale-free at every call site, exactly like a
    // `<Link href>`, so the crumb trail follows the page it describes.
    item: `${SITE_URL}/${locale}${href === "/" ? "" : href}`,
  }));
}

export function breadcrumbSchema(items: BreadcrumbItem[], locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbNodes(items, locale),
  };
}

/** Price range read off the real catalogue in lib/pricing.ts rather than
 *  restated here, so the entity an answer engine quotes for "how much is
 *  InsertGo AI" cannot drift from the pricing page. These are the same display
 *  prices /pricing renders; lib/dodo.ts stays authoritative for what is
 *  charged. A bare `price: "0"` was true of the free tier and silently wrong
 *  about the other two. */
const usdPrices = plans.map((plan) => plan.price.USD);

const offersNode = {
  "@type": "AggregateOffer",
  offerCount: plans.length,
  lowPrice: Math.min(...usdPrices).toFixed(2),
  highPrice: Math.max(...usdPrices).toFixed(2),
  priceCurrency: "USD",
  url: `${DEFAULT_LOCALE_URL}/pricing`,
};

/** The product entity, without @context so it can be embedded in a @graph. */
const softwareApplicationNode = {
  "@type": "SoftwareApplication",
  "@id": SOFTWARE_ID,
  name: "InsertGo AI",
  alternateName: "InsertGo",
  applicationCategory: "ProductivityApplication",
  applicationSubCategory: "AI prompt assistant",
  operatingSystem: "Windows 10, Windows 11",
  url: DEFAULT_LOCALE_URL,
  downloadUrl: `${DEFAULT_LOCALE_URL}/download`,
  softwareHelp: {
    "@type": "CreativeWork",
    url: `${DEFAULT_LOCALE_URL}/how-it-works`,
  },
  description:
    "Floating, always-on-top AI prompt assistant for Windows with global hotkeys, reusable dynamic prompt templates, and direct text insertion into the previously active app.",
  featureList: [
    "Global keyboard shortcuts",
    "Direct AI text insertion",
    "Dynamic prompt templates with form fields",
    "Selection-based AI actions",
    "Managed AI with no API key setup",
    "Local prompt and settings storage",
  ],
  offers: offersNode,
  publisher: {
    "@type": "Organization",
    "@id": ORG_ID,
    name: "InsertGo AI",
    url: SITE_URL,
  },
};

// `softwareApplicationSchema` — the standalone, @context-carrying copy of the
// node above — is gone. The homepage was its only caller and now takes the
// node through pageGraph(); keeping the export around is an invitation to
// re-emit the product entity as an orphan a second time on the same document.

/** The insert workflow, in the product's own terms. Shared by every page that
 *  claims "hotkey to cursor" so the HowTo steps can never drift apart. */
export const HOTKEY_WORKFLOW_STEPS: HowToStepItem[] = [
  {
    name: "Press the global hotkey",
    text: `${HOTKEYS.primary.label} records the Windows app that currently has focus and opens InsertGo above it.`,
  },
  {
    name: "Run a saved prompt",
    text: "Pick a template from the prompt library. Form commands ({formtext}, {formparagraph}, {formmenu}, {formtoggle}, {clipboard}) collect the values that change before the AI call.",
  },
  {
    name: "Review the generated text",
    text: "The managed InsertGo relay returns the result in the floating window, where it can be edited or discarded before anything is written.",
  },
  {
    name: "Insert at the cursor",
    text: "InsertGo hides, restores the captured window, verifies it is foreground, pastes at the cursor, then restores the clipboard value you had before.",
  },
];

export type ArticleInput = {
  /** Defaults to "BlogPosting"; use "Article" for non-blog pillar pages. */
  type?: "BlogPosting" | "Article";
  headline: string;
  description: string;
  datePublished: string;
  dateModified?: string;
  /** Subjects the piece covers, beyond the product itself. */
  keywords?: string[];
};

export type PageGraphInput = {
  /** The language this document is served in. Everything below that names a
   *  page URL is built from it, so the graph a French page emits addresses the
   *  French URLs — a graph that self-identified as the English page would fight
   *  the canonical in the same `<head>`. */
  locale: Locale;
  /** Route path, leading slash, no trailing slash, and locale-FREE. `""`
   *  addresses the root,
   *  which resolves to SITE_URL — not `"/"`, which would canonicalise the
   *  homepage one character away from every other node that names it. */
  path: string;
  name: string;
  description: string;
  breadcrumbs: BreadcrumbItem[];
  faqs?: FaqItem[];
  howTo?: {
    name: string;
    description: string;
    totalTime?: string;
    steps: HowToStepItem[];
  };
  /** Editorial layer for pillar and blog pages. Authorship and publisher
   *  resolve to the Organization node app/layout.tsx already emits, so the
   *  article joins the site graph instead of restating an unlinked publisher
   *  of its own. */
  article?: ArticleInput;
};

/**
 * One nested Schema.org graph per landing page: WebPage (+FAQPage when the page
 * carries an FAQ), the SoftwareApplication it is about, its BreadcrumbList, and
 * an optional HowTo — all cross-referenced by @id rather than duplicated.
 */
export function pageGraph({
  locale,
  path,
  name,
  description,
  breadcrumbs,
  faqs,
  howTo,
  article,
}: PageGraphInput) {
  const url = `${SITE_URL}/${locale}${path}`;
  const pageId = `${url}#webpage`;
  const breadcrumbId = `${url}#breadcrumb`;

  const page: Record<string, unknown> = {
    "@type": faqs?.length ? ["WebPage", "FAQPage"] : "WebPage",
    "@id": pageId,
    url,
    name,
    description,
    inLanguage: locale,
    dateModified: CONTENT_UPDATED,
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": SOFTWARE_ID },
    breadcrumb: { "@id": breadcrumbId },
  };
  if (faqs?.length) page.mainEntity = questionNodes(faqs);

  const graph: object[] = [
    page,
    softwareApplicationNode,
    {
      "@type": "BreadcrumbList",
      "@id": breadcrumbId,
      itemListElement: breadcrumbNodes(breadcrumbs, locale),
    },
  ];

  if (howTo) {
    graph.push({
      "@type": "HowTo",
      "@id": `${url}#howto`,
      name: howTo.name,
      description: howTo.description,
      ...(howTo.totalTime ? { totalTime: howTo.totalTime } : {}),
      tool: { "@type": "HowToTool", name: "InsertGo AI for Windows" },
      mainEntityOfPage: { "@id": pageId },
      step: howTo.steps.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: step.name,
        text: step.text,
        url: `${url}#step-${index + 1}`,
      })),
    });
  }

  if (article) {
    graph.push({
      "@type": article.type ?? "BlogPosting",
      "@id": `${url}#article`,
      headline: article.headline,
      description: article.description,
      datePublished: article.datePublished,
      dateModified: article.dateModified ?? article.datePublished,
      inLanguage: locale,
      author: { "@id": ORG_ID },
      publisher: { "@id": ORG_ID },
      isPartOf: { "@id": WEBSITE_ID },
      about: { "@id": SOFTWARE_ID },
      mainEntityOfPage: { "@id": pageId },
      ...(article.keywords?.length ? { keywords: article.keywords } : {}),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}
