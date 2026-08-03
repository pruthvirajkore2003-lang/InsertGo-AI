import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/account", "/desktop", "/login"],
    },
    sitemap: "https://insertgo.ai/sitemap.xml",
  };
}
