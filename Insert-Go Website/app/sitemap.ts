import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date("2026-07-24");
  const updatedPaths = new Set([
    "",
    "/features",
    "/features/auto-text-insert",
    "/features/prompt-library",
    "/features/desktop-assistant",
    "/alternatives/raycast-windows",
    "/blog/windows-ai-productivity-guide",
    "/download",
    "/faq",
  ]);

  return [
    "",
    "/features",
    "/features/auto-text-insert",
    "/features/prompt-library",
    "/features/desktop-assistant",
    "/alternatives/raycast-windows",
    "/blog/windows-ai-productivity-guide",
    "/how-it-works",
    "/pricing",
    "/download",
    "/faq",
    "/contact",
    "/terms",
    "/privacy",
  ].map((path) => ({
    url: `https://insertgo.ai${path}`,
    ...(updatedPaths.has(path) ? { lastModified: updated } : {}),
  }));
}
