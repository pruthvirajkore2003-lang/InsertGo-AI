import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/** Authenticated surfaces and the API stay out of every index. */
const DISALLOW = ["/api/", "/account", "/desktop", "/login"];

/** Answer-engine crawlers, named explicitly. Several of these (Google-Extended,
 *  Applebot-Extended) are opt-out-only tokens: they change nothing unless a
 *  robots file mentions them, so listing them is how the site says yes. */
const AI_AGENTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
  "meta-externalagent",
  "cohere-ai",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: AI_AGENTS, allow: "/", disallow: DISALLOW },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
