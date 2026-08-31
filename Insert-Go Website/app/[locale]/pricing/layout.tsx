import type { Metadata } from "next";
import { JsonLd } from "@/components/SeoContent";
import { toLocale } from "@/i18n-config";
import { pageGraph } from "@/lib/seo";

const DESCRIPTION =
  "InsertGo pricing: 5 free AI credits a day forever, Plus with 50 a day, Pro with 150, plus non-expiring add-on credit packs. Managed AI — no API key to set up.";

export const metadata: Metadata = {
  title: "Pricing — Free, Plus and Pro Plans",
  description: DESCRIPTION,
  openGraph: {
    title: "Pricing — Free, Plus and Pro Plans",
    description:
      "5 AI credits a day free forever, 50 on Plus, 150 on Pro, and add-on credit packs that never expire.",
    url: "/pricing",
    type: "article",
  },
};

/**
 * The page the SoftwareApplication node's `offers.url` already points at, with
 * no node of its own to receive the reference. `pageGraph` supplies the WebPage
 * and the breadcrumb; the Offer itself stays on the product entity in
 * lib/seo.ts rather than being restated here, so there is exactly one price
 * claim in the graph.
 */
export default async function PricingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = toLocale((await params).locale);
  return (
    <>
      <JsonLd
        data={pageGraph({
          locale,
          path: "/pricing",
          name: "InsertGo AI pricing",
          description: DESCRIPTION,
          breadcrumbs: [
            { name: "Home", href: "/" },
            { name: "Pricing", href: "/pricing" },
          ],
        })}
      />
      {children}
    </>
  );
}
