import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Support",
  // Was 61 characters, short enough that Google rewrites it from page text.
  description:
    "Contact the InsertGo AI team about installation, billing, cancellations, refunds, privacy requests, or sales. We reply within one business day.",
  openGraph: {
    title: "Contact Support",
    description:
      "Installation, billing, cancellations, refunds and privacy requests — answered within one business day.",
    url: "/contact",
    type: "article",
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
