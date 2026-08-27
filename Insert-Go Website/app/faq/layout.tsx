import type { Metadata } from "next";
import { JsonLd } from "@/components/SeoContent";
import { pageGraph } from "@/lib/seo";
import { faqs } from "./faqs";

const DESCRIPTION =
  "Answers to common questions about InsertGo.AI — app compatibility, how AI text insertion works, hotkeys, privacy, models, and the free plan.";

export const metadata: Metadata = {
  title: "Windows AI Prompt Assistant FAQ",
  description: DESCRIPTION,
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "Windows AI Prompt Assistant FAQ",
    description:
      "How InsertGo inserts AI text into any Windows app, which apps it supports, what it sends to the relay, and what the free plan includes.",
    url: "/faq",
    type: "article",
  },
};

/**
 * `pageGraph` rather than a bare `faqSchema`: the standalone FAQPage node this
 * page used to emit carried no @id and referenced nothing, so eleven answers
 * sat in the index as an orphan with no link to the WebSite, the product
 * entity or the site hierarchy. Every other landing page publishes the nested
 * graph; this one is the page answer engines are most likely to quote.
 *
 * `JsonLd` rather than a local `<script dangerouslySetInnerHTML>`: JSON.stringify
 * does not escape `<`, so a `</script>` inside any answer would close the element
 * early and everything after it would parse as HTML. That escape lives in exactly
 * one place (components/SeoContent), and the schema shape in lib/seo — this file
 * should own neither.
 */
export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={pageGraph({
          path: "/faq",
          name: "InsertGo.AI frequently asked questions",
          description: DESCRIPTION,
          breadcrumbs: [
            { name: "Home", href: "/" },
            { name: "FAQ", href: "/faq" },
          ],
          faqs: faqs.map(([question, answer]) => ({ question, answer })),
        })}
      />
      {children}
    </>
  );
}
