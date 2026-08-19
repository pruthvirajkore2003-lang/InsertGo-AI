import type { MetadataRoute } from "next";
import { CONTENT_UPDATED, SITE_URL } from "@/lib/seo";

/** Editorial routes: they carry a lastModified stamped from CONTENT_UPDATED,
 *  which is the same date the pages print as "Reviewed". */
const CONTENT_PATHS = [
  "",
  "/features",
  "/features/ai-text-expander",
  "/features/auto-text-insert",
  "/features/prompt-library",
  "/features/desktop-assistant",
  "/use-cases/developers",
  "/use-cases/customer-support",
  "/alternatives/raycast-windows",
  "/alternatives/text-blaze-windows",
  "/alternatives/textexpander-windows",
  "/alternatives/windows-copilot",
  "/blog/windows-ai-productivity-guide",
  "/how-it-works",
  "/download",
  "/faq",
];

/** Transactional and legal routes — no editorial date to claim. */
const OTHER_PATHS = [
  "/pricing",
  "/contact",
  "/cancel",
  "/terms",
  "/privacy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(CONTENT_UPDATED);

  return [
    ...CONTENT_PATHS.map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified,
    })),
    ...OTHER_PATHS.map((path) => ({ url: `${SITE_URL}${path}` })),
  ];
}
