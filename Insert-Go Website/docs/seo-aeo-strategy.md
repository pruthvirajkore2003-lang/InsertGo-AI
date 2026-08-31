---
title: InsertGo SEO/AEO research and content ownership
updated: 2026-08-23
owner: InsertGo AI
---

# InsertGo SEO/AEO research and content ownership

## Research conclusions

1. Raycast is no longer a Mac-only competitor. Raycast ships a Windows 10+ beta and now supports Windows AI Chat, AI Commands, selected-text replacement, snippets, and Dynamic Placeholders. InsertGo should compete as a **focused AI prompt workflow**, not as the only Raycast-like tool available on Windows.
2. AI Blaze remains a useful adjacent comparison. Its documented workflow is Chrome-extension-first: webpage context, browser text insertion, saved prompts, and shared prompt folders. InsertGo's defensible contrast is native Windows reach, focus verification, clipboard restoration, and local prompt storage.
3. Search results for the proposed exact-match phrases are sparse and inconsistent. This supports intent-led long-tail pages, but it does **not** validate the supplied volume or difficulty numbers. Treat those metrics as directional until checked in Google Ads Keyword Planner, Ahrefs/Semrush, and Google Search Console.
4. Google stopped showing FAQ rich results in May 2026. `FAQPage` remains valid Schema.org markup and may help non-Google consumers understand visible Q&A, but it must not be sold as a Google rich-result tactic.
5. Google software-app rich results require a real rating or review in addition to the app name and offer. InsertGo should not invent either. Current `SoftwareApplication` markup is entity data, not a promise of a rich result.

## Page ownership

Every route in `app/sitemap.ts` is accounted for below, either in the table or
in the exclusions beneath it. A route missing from both is a route nobody has
decided the intent of, which is how two pages end up answering one query: the
2026-08-23 audit found ten of the sixteen content routes absent from this
table, `/how-it-works` among them — the page every other route links to as the
workflow authority.

An em dash in **Primary query** is deliberate: that page owns no head term and
must not be given one. Hubs and aggregates earn their place by summarizing and
linking, and a hub that competes with its own children is the most common way
this table gets violated.

| URL | Primary intent | Primary query | Supporting queries |
| --- | --- | --- | --- |
| `/` | Product/category | vibe coding prompt writing | floating AI prompt assistant Windows; What is InsertGo AI; how to write better prompts for vibe coding |
| `/features` | Feature hub | — summarizes and links | InsertGo features |
| `/features/auto-text-insert` | Feature/how-to | AI text auto-insert desktop | global hotkey AI prompt manager; text selection floating AI tool |
| `/features/prompt-library` | Feature/solution | AI prompt library software | dynamic AI prompt templates with form fields |
| `/features/desktop-assistant` | Category hub | Windows desktop AI assistant | AI desktop overlay app; AI writing software for Windows |
| `/features/ai-text-expander` | Feature/comparison | AI text expander for Windows | AI text expander vs static text expander |
| `/use-cases/developers` | Use case | AI prompts in VS Code and Windows Terminal | AI assistant for JetBrains IDEs; terminal AI prompt tool |
| `/use-cases/customer-support` | Use case | AI canned responses for Outlook and Zendesk | AI support reply templates; helpdesk macro alternative |
| `/alternatives/raycast-windows` | Comparison/alternative | Raycast alternative for Windows AI prompts | AI Blaze Windows alternative |
| `/alternatives/text-blaze-windows` | Comparison/alternative | Text Blaze alternative for Windows | Text Blaze AI outside Chrome |
| `/alternatives/textexpander-windows` | Comparison/alternative | TextExpander alternative for Windows | TextExpander AI fill-ins |
| `/alternatives/windows-copilot` | Comparison/alternative | Windows Copilot alternative | Copilot alternative for reusable prompts |
| `/blog/windows-ai-productivity-guide` | Informational pillar | system-wide AI writing assistant | how floating AI assistants work; AI productivity tools desktop |
| `/how-it-works` | Mechanism walkthrough | — owns the mechanism, not the head term | focus handoff; clipboard restore; what happens after the hotkey |
| `/faq` | Question aggregate | — long-tail product questions only | does InsertGo work on Mac; which apps does it work with |
| `/download` | Transactional | download InsertGo for Windows | InsertGo installer Windows 11 |
| `/pricing` | Transactional | InsertGo pricing | InsertGo free plan; AI credit packs |
| `/cancel` | Transactional/policy | cancel InsertGo subscription | InsertGo refund policy |

`/contact` is a support surface, `/terms` and `/privacy` are legal text, and
`/account`, `/account/privacy`, `/consent`, `/desktop/authorize` and `/login`
carry `noindex`. None of them owns a query.

The six original rows came from keyword research. The rows added on 2026-08-23
were read off what each page already targets — its h1, title and direct-answer
heading — not off Search Console data. Treat them as the intent each page is
*built* for, and correct them once real query data exists (see conclusion 3).

## Cannibalization rules

- Homepage owns **vibe coding prompt writing** and **floating AI prompt assistant**. Desktop-assistant hub uses **Windows desktop AI assistant** and links back to product core.
- The homepage owns the *practice* — what vibe coding prompt writing is, and how to structure the instruction. `/use-cases/developers` keeps the *tooling* query (VS Code, Windows Terminal, JetBrains) and the concrete templates. The homepage links down to it and must not grow a template gallery of its own.
- Raycast and Spotlight comparison intent stays on one page. Do not add a separate Spotlight landing page.
- Auto-insert page owns selection-floater and global-hotkey utility subsections. Do not split those into thin pages without Search Console evidence.
- Prompt-library page owns all form-command documentation and AEO answers. Feature hub summarizes and links. This includes `/features/ai-text-expander`, which carried a fuller command reference than the owner page until 2026-08-23 — a rule is only worth writing down if you check the pages that quietly break it.
- Blog guide explains architecture and evaluation. It should not become another product landing page.
- Homepage FAQ items may state InsertGo's own position on a competitor, but the dated side-by-side belongs on the `/alternatives/*` page that owns that query. One sentence plus an internal link, never a full comparison.
- `/how-it-works` owns the mechanism — focus capture, foreground verification, clipboard restore — and deliberately does not phrase its direct answer as "how do you insert AI text into a Windows app". That query belongs to `/features/auto-text-insert`.
- Generic category tables (`/`, `/features/desktop-assistant`, both use-case pages) compare InsertGo to a *class* of tool and need no date or source. Any table naming a real product does, and lives on an `/alternatives/*` page.

## The "free" modifier

`free` is a query modifier with its own intent, not a decoration: *free AI
prompt assistant Windows*, *free AI text expander*, *free alternative to
TextExpander*, *free Raycast alternative Windows*. It is carried in the title
tag only where the page's own primary query survives intact in front of it —
`Free Text Blaze Alternative for Windows` keeps the exact phrase the table
assigns that page; `Free Raycast Alternative for Windows` would not, so Raycast
carries the modifier in its description instead.

Rules that keep it honest, because a `free` claim is a consumer-facing one:

- Only pages a free user can actually act on carry it: `/`, `/download`,
  `/pricing`, the feature and alternatives pages, both use cases. `/how-it-works`
  and the blog pillar are mechanism and explainer pages and get nothing.
- Every allowance is read from `TIER_DAILY_CREDITS`, never retyped. `/faq`
  carried `5`, `50` and `150` as prose until 2026-08-31 — three claims that
  would have survived a tier change unchanged.
- Prices stay on `/pricing`. A description may say "free plan" and "no credit
  card"; it may not restate a paid amount that `lib/pricing.ts` owns.
- "Free forever" is the Free tier, which is real ($0, `per: "forever"`). Do not
  write "free trial" for it anywhere: `/login` already says "7-day free trial
  included", which describes something else and should be reconciled.
- Max one `free` in a title and one in a description. Two is stuffing, and the
  second one displaces a differentiator.

## Answer-engine format

- Put a 40–55 word direct answer immediately below each main question heading, inside the first third of the document. `/` and `/features` carried none until 2026-08-27 — they were the two highest-value pages on the site and the only two content routes without one, because the capsule was treated as a long-tail-page device rather than the page-level default.
- Keep the same answer visible in page content and structured data. The way to guarantee it is one exported string used by both, not two copies a reviewer compares by eye.
- Quantify with numbers already enforced somewhere in the repo — daily credits from `TIER_DAILY_CREDITS`, hotkeys from `HOTKEYS`, plan prices from `lib/pricing.ts`. A number retyped into prose is a claim with nothing behind it the moment the constant moves.
- Prefer real HTML tables, ordered steps, code examples, descriptive headings, and stable anchor links.
- State product limits and fallback behavior. Answer engines are more likely to trust precise, falsifiable text than absolute marketing claims.
- Date competitor comparisons and link official sources.

## Structured-data plan

Everything below is emitted by `pageGraph()` in `lib/seo.ts`, which nests the
nodes into one `@graph` and cross-references them by `@id`. Do not hand-write a
standalone node on a page: `/faq` did that until 2026-08-23 and its eleven
answers sat in the index as an orphan, linked to neither the `WebSite` nor the
product entity.

- Global: `Organization` + `WebSite` (once per document, from `app/layout.tsx`).
- Homepage: `WebPage` + `SoftwareApplication` + visible `FAQPage` + `BreadcrumbList`. Until 2026-08-27 it emitted a bare `SoftwareApplication` and a bare `FAQPage` as two standalone scripts, with no `WebPage` node at all — the exact orphan shape recorded on `/faq` above, left in place on the page the rest of the site links up to. The rule is not "hubs and long-tail pages use `pageGraph()`"; it is every page.
- `pageGraph({ path: "" })` is how the root is addressed: it resolves to `SITE_URL` with no trailing slash, matching the canonical and the `url` on the product node.
- Feature how-to pages: `HowTo` + `FAQPage` + `BreadcrumbList`.
- Comparison page: visible `FAQPage` + `BreadcrumbList`.
- Pillar guide: `BlogPosting` + visible `FAQPage` + `BreadcrumbList`, via `pageGraph({ article })`. The `article` layer references `ORG_ID` for both author and publisher instead of restating an Organization the document already declares.
- `SoftwareApplication.offers` is an `AggregateOffer` derived from `lib/pricing.ts`, not a literal. The hardcoded `price: "0"` it replaced was true of the free tier and silently wrong about Plus and Pro, which is worse than no offer at all when the question being answered is "how much does it cost".
- Hub, walkthrough and transactional pages (`/features`, `/how-it-works`, `/download`, `/pricing`, `/faq`): `WebPage` + `BreadcrumbList` at minimum. A page named by another node — `downloadUrl`, `offers.url`, `softwareHelp`, a child's breadcrumb — must publish a node of its own to receive the reference.
- Anything a `HowTo` numbers must be an `<ol>` in the document with matching `#step-N` anchors. A step sequence built from `<div>`s is not an ordered list to a parser.
- **Marked-up content must be in the server HTML.** Not "on the page after a click" — in the response. The `/faq` accordion mounted only the open panel, so ten of eleven declared answers did not exist for a crawler. Collapse with `<details>` or CSS, never by unmounting.
- No fake ratings, testimonials, reviews, usage counts, or performance claims. This extends to prose: an h1 asserting a completion time, or a CTA asserting an install duration, is a performance claim with nothing measuring it.

## Indexation rules

- Canonicals and `og:url` resolve from `SITE_URL`, not the request host. A host-derived `metadataBase` makes every preview deployment self-canonical and puts a second indexable copy of the site in front of Google. Local development is the only exception.
- `robots.txt` `Disallow` stops the fetch, not the listing. Every private surface needs `robots: { index: false }` in its own metadata as well.
- Titles are budgeted against the ` — InsertGo AI` template appended by the root layout: keep the page's own title at or under ~46 characters. Descriptions at or under ~158.

## Measurement

Use a 90-day baseline after indexing:

1. Submit `/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
2. Inspect every owner URL in the table above after deployment — eighteen, not the original six.
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
