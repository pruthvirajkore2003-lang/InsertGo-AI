---
title: InsertGo SEO/AEO research and content ownership
updated: 2026-07-24
owner: InsertGo.AI
---

# InsertGo SEO/AEO research and content ownership

## Research conclusions

1. Raycast is no longer a Mac-only competitor. Raycast ships a Windows 10+ beta and now supports Windows AI Chat, AI Commands, selected-text replacement, snippets, and Dynamic Placeholders. InsertGo should compete as a **focused AI prompt workflow**, not as the only Raycast-like tool available on Windows.
2. AI Blaze remains a useful adjacent comparison. Its documented workflow is Chrome-extension-first: webpage context, browser text insertion, saved prompts, and shared prompt folders. InsertGo's defensible contrast is native Windows reach, focus verification, clipboard restoration, and local prompt storage.
3. Search results for the proposed exact-match phrases are sparse and inconsistent. This supports intent-led long-tail pages, but it does **not** validate the supplied volume or difficulty numbers. Treat those metrics as directional until checked in Google Ads Keyword Planner, Ahrefs/Semrush, and Google Search Console.
4. Google stopped showing FAQ rich results in May 2026. `FAQPage` remains valid Schema.org markup and may help non-Google consumers understand visible Q&A, but it must not be sold as a Google rich-result tactic.
5. Google software-app rich results require a real rating or review in addition to the app name and offer. InsertGo should not invent either. Current `SoftwareApplication` markup is entity data, not a promise of a rich result.

## Page ownership

| URL | Primary intent | Primary query | Supporting queries |
| --- | --- | --- | --- |
| `/` | Product/category | floating AI prompt assistant Windows | What is InsertGo AI; Spotlight for AI prompts |
| `/alternatives/raycast-windows` | Comparison/alternative | Raycast alternative for Windows AI prompts | AI Blaze Windows alternative |
| `/features/auto-text-insert` | Feature/how-to | AI text auto-insert desktop | global hotkey AI prompt manager; text selection floating AI tool |
| `/features/prompt-library` | Feature/solution | AI prompt library software | dynamic AI prompt templates with form fields |
| `/features/desktop-assistant` | Category hub | Windows desktop AI assistant | AI desktop overlay app; AI writing software for Windows |
| `/blog/windows-ai-productivity-guide` | Informational pillar | system-wide AI writing assistant | how floating AI assistants work; AI productivity tools desktop |

## Cannibalization rules

- Homepage owns **floating AI prompt assistant**. Desktop-assistant hub uses **Windows desktop AI assistant** and links back to product core.
- Raycast and Spotlight comparison intent stays on one page. Do not add a separate Spotlight landing page.
- Auto-insert page owns selection-floater and global-hotkey utility subsections. Do not split those into thin pages without Search Console evidence.
- Prompt-library page owns all form-command documentation and AEO answers. Feature hub summarizes and links.
- Blog guide explains architecture and evaluation. It should not become another product landing page.

## Answer-engine format

- Put a 35–55 word direct answer immediately below each main question heading.
- Keep the same answer visible in page content and structured data.
- Prefer real HTML tables, ordered steps, code examples, descriptive headings, and stable anchor links.
- State product limits and fallback behavior. Answer engines are more likely to trust precise, falsifiable text than absolute marketing claims.
- Date competitor comparisons and link official sources.

## Structured-data plan

- Global: `Organization` + `WebSite`.
- Homepage: `SoftwareApplication` + visible `FAQPage`.
- Feature how-to pages: `HowTo` + `FAQPage` + `BreadcrumbList`.
- Comparison page: visible `FAQPage` + `BreadcrumbList`.
- Pillar guide: `BlogPosting` + visible `FAQPage` + `BreadcrumbList`.
- No fake ratings, testimonials, reviews, usage counts, or performance claims.

## Measurement

Use a 90-day baseline after indexing:

1. Submit `/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
2. Inspect all six owner URLs after deployment.
3. Group Search Console queries by page-owner cluster, not exact keyword only.
4. Track impressions, clicks, average position, and download-page visits from each owner URL.
5. Watch for two pages gaining impressions for the same intent. Consolidate copy and internal anchors before creating more pages.
6. Review the Raycast comparison monthly while its Windows product remains beta.

## Primary sources checked

- Raycast Windows quickstart: https://manual.raycast.com/quickstart
- Raycast AI Commands: https://manual.raycast.com/ai/ai-commands
- Raycast Dynamic Placeholders: https://manual.raycast.com/dynamic-placeholders
- Raycast Windows changelog: https://www.raycast.com/changelog/windows
- AI Blaze quickstart: https://blaze.today/aiblaze/docs/quickstart/
- AI Blaze dynamic prompts: https://blaze.today/aiblaze/
- Google SoftwareApplication structured data: https://developers.google.com/search/docs/appearance/structured-data/software-app
- Google FAQ rich-result change: https://developers.google.com/search/updates
- Google sitemap guidance: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google title guidance: https://developers.google.com/search/docs/appearance/title-link
