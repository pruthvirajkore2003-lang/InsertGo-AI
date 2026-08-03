import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "InsertGo pricing: 5 free AI credits a day forever, Plus with 50 a day, Pro with 150, plus non-expiring add-on credit packs. Managed AI — no API key to set up.",
  alternates: { canonical: "/pricing" },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
