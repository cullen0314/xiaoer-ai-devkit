---
name: evaluate-tech-seo
description: Evaluate a website's technical SEO quality from a public URL, optional codebase, and optional Google Search Console data. Use when auditing crawling, indexability, sitemap, robots, canonical URLs, metadata, structured data, hreflang, rendering, performance risks, redirects, or SEO monitoring.
---

# Evaluate Technical SEO

Perform a read-only, evidence-based technical SEO audit. Do not modify code, DNS, robots, sitemaps, Search Console, or production configuration unless the user separately asks and confirms a change plan.

## Inputs and modes

Require a public site URL. Accept an optional codebase path and optional access to Google Search Console (GSC).

| Mode | Inputs | Scope |
| --- | --- | --- |
| Public | URL | HTTP, redirects, robots, sitemap, rendered head, canonical, hreflang, JSON-LD, public crawl risks |
| Code-aware | URL + codebase | Public checks plus route inventory, metadata generation, index directives, localization, SSR/CSR and asset-loading risks |
| Verified | URL + codebase optional + GSC | Above plus indexing, Google-selected canonical, crawl errors, search performance and field CWV |

State the chosen mode and missing inputs at the start. Never claim an unknown item is healthy.

## Workflow

1. Establish scope: primary host, target locale(s), critical URLs, codebase availability, and GSC availability.
2. Collect public evidence. Run `scripts/collect-public-seo.mjs` for the root URL and critical URLs, or use equivalent read-only checks. Read `references/audit-checklist.md` before classifying findings.
3. If a codebase is supplied, inventory public and private routes; inspect robots, sitemap, middleware/redirects, layouts, metadata generation, locale routing, structured-data components, and major above-the-fold assets. Prefer `rg` for targeted searches.
4. If GSC is available, use it read-only. Inspect Sitemap status, Pages/Video indexing, URL Inspection for critical pages, Performance, and Core Web Vitals. A newly verified property showing “Processing data” is a data-availability state, not a site error.
5. Apply the evidence standard in `references/evidence-standard.md`. Distinguish observed facts, code-derived risks, GSC-verified facts, and unknowns.
6. Prioritize with the checklist, then write the result using `references/report-template.md`.

## Mandatory checks

Cover all eight modules unless evidence is unavailable:

1. Crawl access: status codes, redirect chains, robots, login walls, `noindex`, and anonymous access to page resources.
2. Indexing and canonicalization: canonical target, duplicate URL variants, canonical/OG/sitemap/final URL agreement, and redirect permanence.
3. Discovery: sitemap availability, sitemap URL quality, route-to-sitemap gaps, and internal links to critical pages.
4. Metadata and semantics: unique title, description, H1, language consistency, title-template duplication, and social metadata.
5. Structured data: valid, visible-content-aligned JSON-LD; identify applicable schema without promising rich results.
6. Internationalization: `html lang`, hreflang, x-default, locale URL behavior, localized metadata, and translated visible content.
7. Rendering and performance: SSR/CSR visibility, large images/video/font/third-party-script risks, then field or lab evidence when available.
8. Monitoring: GSC verification, sitemap submission, URL Inspection, analytics, conversion events, and CWV measurement.

## Severity

- **P0** — Prevents intended pages from crawling/indexing, sends Google to invalid/thin/redirecting sitemap URLs, creates severe canonical or redirect errors, or exposes private pages to indexing.
- **P1** — Weakens relevance, language targeting, metadata quality, structured understanding, internal discovery, or produces material but non-blocking performance risk.
- **P2** — Quality, maintainability, social sharing, or measurement improvements that require validation before prioritization.

Apply a health-score ceiling when a P0 exists. Do not use an unqualified 0–100 score as a substitute for evidence.

## Code-aware rules

When code is available, explicitly look for:

- sitemap entries whose route is a placeholder, redirect, error, login page, or thin page;
- global title templates combined with page titles that already contain the brand;
- private/auth/admin/dashboard routes missing explicit robots policy;
- locale pages that share untranslated titles, descriptions, H1s, or body copy;
- canonical generation that differs from sitemap, Open Graph URL, redirect target, or locale URL;
- legacy aliases using temporary or multi-hop redirects;
- hard-coded model/product claims that differ from the active product configuration;
- `preload="auto"`, eager video, oversized images, remote media, fonts, and third-party scripts above the fold.

Treat source-code evidence as a risk until it is corroborated by the deployed response where deployment behavior can differ.

## Output rules

Use the report template. Every finding must include: priority, evidence, impact, smallest safe remediation, and validation method. Put all unavailable GSC/CrUX/log data in **Unknowns**, not in the issue list.

For a change request after the audit, create a separate implementation plan with files, impact, and validation; wait for the user's confirmation before editing.

