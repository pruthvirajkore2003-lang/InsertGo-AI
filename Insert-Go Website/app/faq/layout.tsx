import type { Metadata } from "next";
import { JsonLd } from "@/components/SeoContent";
import { faqSchema } from "@/lib/seo";
import { faqs } from "./faqs";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about InsertGo.AI — app compatibility, how AI text insertion works, hotkeys, privacy, models, and the free plan.",
  alternates: { canonical: "/faq" },
};

/**
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
        data={faqSchema(
          faqs.map(([question, answer]) => ({ question, answer })),
        )}
      />
      {children}
    </>
  );
}
