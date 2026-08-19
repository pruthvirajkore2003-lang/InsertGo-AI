import { HOTKEYS } from "@/lib/constants/hotkeys";

export const SITE_URL = "https://insertgo.ai";
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

function breadcrumbNodes(items: BreadcrumbItem[]) {
  return items.map(({ name, href }, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name,
    item: `${SITE_URL}${href}`,
  }));
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbNodes(items),
  };
}

/** The product entity, without @context so it can be embedded in a @graph. */
const softwareApplicationNode = {
  "@type": "SoftwareApplication",
  "@id": SOFTWARE_ID,
  name: "InsertGo.AI",
  alternateName: "InsertGo",
  applicationCategory: "ProductivityApplication",
  applicationSubCategory: "AI prompt assistant",
  operatingSystem: "Windows 10, Windows 11",
  url: SITE_URL,
  downloadUrl: `${SITE_URL}/download`,
  softwareHelp: { "@type": "CreativeWork", url: `${SITE_URL}/how-it-works` },
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
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    url: `${SITE_URL}/pricing`,
  },
  publisher: {
    "@type": "Organization",
    "@id": ORG_ID,
    name: "InsertGo.AI",
    url: SITE_URL,
  },
};

export const softwareApplicationSchema = {
  "@context": "https://schema.org",
  ...softwareApplicationNode,
};

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

export type PageGraphInput = {
  /** Route path, leading slash, no trailing slash. */
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
};

/**
 * One nested Schema.org graph per landing page: WebPage (+FAQPage when the page
 * carries an FAQ), the SoftwareApplication it is about, its BreadcrumbList, and
 * an optional HowTo — all cross-referenced by @id rather than duplicated.
 */
export function pageGraph({
  path,
  name,
  description,
  breadcrumbs,
  faqs,
  howTo,
}: PageGraphInput) {
  const url = `${SITE_URL}${path}`;
  const pageId = `${url}#webpage`;
  const breadcrumbId = `${url}#breadcrumb`;

  const page: Record<string, unknown> = {
    "@type": faqs?.length ? ["WebPage", "FAQPage"] : "WebPage",
    "@id": pageId,
    url,
    name,
    description,
    inLanguage: "en",
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
      itemListElement: breadcrumbNodes(breadcrumbs),
    },
  ];

  if (howTo) {
    graph.push({
      "@type": "HowTo",
      "@id": `${url}#howto`,
      name: howTo.name,
      description: howTo.description,
      ...(howTo.totalTime ? { totalTime: howTo.totalTime } : {}),
      tool: { "@type": "HowToTool", name: "InsertGo.AI for Windows" },
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

  return { "@context": "https://schema.org", "@graph": graph };
}
