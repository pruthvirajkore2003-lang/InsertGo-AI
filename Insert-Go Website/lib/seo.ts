export const SITE_URL = "https://insertgo.ai";
export const CONTENT_UPDATED = "2026-07-24";

export type FaqItem = {
  question: string;
  answer: string;
};

export type BreadcrumbItem = {
  name: string;
  href: string;
};

export function faqSchema(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer,
      },
    })),
  };
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(({ name, href }, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name,
      item: `${SITE_URL}${href}`,
    })),
  };
}

export const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#software`,
  name: "InsertGo.AI",
  alternateName: "InsertGo",
  applicationCategory: "ProductivityApplication",
  applicationSubCategory: "AI prompt assistant",
  operatingSystem: "Windows 10, Windows 11",
  url: SITE_URL,
  downloadUrl: `${SITE_URL}/download`,
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
    name: "InsertGo.AI",
    url: SITE_URL,
  },
};
