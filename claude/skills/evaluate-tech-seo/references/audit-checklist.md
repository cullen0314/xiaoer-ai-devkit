# Technical SEO audit checklist

## 1. Crawl access

Check root and critical URLs with anonymous requests.

- Final response is intended 200, or one permanent redirect to the intended canonical URL.
- `robots.txt` is reachable and does not block intended public URLs or essential CSS/JS/media.
- Public content does not require a session, client-only click, or blocked resource to be understood.
- Login, account, admin, checkout-success, search, preview and other non-search pages have a deliberate indexing policy.

P0 examples: public pages blocked by robots, indexable page returns 4xx/5xx, sitemap URL redirects to login, private data page can be indexed.

## 2. Indexing and canonicalization

- Every intended indexable page has one self-referential canonical.
- Canonical target returns 200 and matches the preferred protocol, host, slash, locale and path.
- HTTP, www/non-www, root/default-locale and legacy URLs converge in one hop where practical.
- Open Graph `og:url`, sitemap URL and final canonical URL agree.
- Query, filter, pagination and duplicate variants have intentional policies.

P0 examples: canonical points to an unrelated page, wrong host, 4xx/5xx, or a large class of duplicates competes with canonical URLs.

## 3. Discovery and sitemap quality

- `robots.txt` advertises sitemap URL(s) when appropriate.
- Sitemap is reachable, parseable, and contains fully qualified canonical URLs only.
- Every sitemap URL resolves to a meaningful intended page; exclude placeholders, redirects, noindex, errors, login pages and thin pages.
- Important public routes have crawlable internal links.
- `lastmod` is used only when it reflects a meaningful update. Do not score `priority` or `changefreq`; Google may ignore them.

P0 examples: sitemap unavailable, contains widespread broken/redirect/noindex URLs, or omits core public URLs without a deliberate alternative discovery path.

## 4. Metadata and document semantics

- `<title>` is concise, unique, descriptive and not duplicated by a parent title template.
- Description describes the specific page, not a generic inherited site description.
- One clear, language-matched H1 represents the page intent.
- Open Graph/Twitter title, description, image and URL represent the same canonical page.
- Do not treat `<meta name="keywords">` as a ranking signal.

P1 examples: title template duplicates brand, pricing page inherits generic homepage description, no H1, or social URL differs from canonical.

## 5. Structured data

- Extract every JSON-LD script and identify its types.
- Verify fields against visible page content and actual business facts.
- Use only appropriate types, such as `WebSite`, `Organization`, `SoftwareApplication`, `BreadcrumbList`, `Product`, or `FAQPage` when justified.
- Do not claim rich-result eligibility or ranking lift merely because schema exists.

P1 examples: misleading prices/reviews, schema contradicts visible content, or sitewide schema incorrectly describes every page as the same product.

## 6. Internationalization

- `html lang`, URL prefix/domain, canonical and hreflang agree.
- Each localized page has reciprocal hreflang entries and x-default when the URL model requires it.
- Title, description, H1 and substantive visible text use the target locale.
- Default-locale redirects are stable and do not override an explicitly requested locale.

P1 examples: `/zh` URL has English metadata and body, canonical points to `/en`, or hreflang points to pages that redirect/error.

## 7. Rendering and performance

- Determine whether important text and links are present in server HTML or rely on client rendering.
- Flag high-risk assets: autoplay/preloaded hero video, excessive images, render-blocking fonts, third-party scripts and layout-shifting media.
- Use PageSpeed Insights, CrUX, GSC Core Web Vitals, or hosting analytics for measured LCP/INP/CLS. Code alone identifies risk only.

P1/P2 examples: client-only main content, very large hero media, or missing image dimensions. Do not assign a CWV failure without measured evidence.

## 8. Monitoring and conversion evidence

- Confirm the correct GSC property is verified.
- Confirm sitemap submission and processing status.
- Use URL Inspection to check critical canonical URLs.
- Review Pages, Videos, Performance and Core Web Vitals reports after data becomes available.
- Confirm analytics and funnel events for organic landing → signup → activation → purchase when conversion analysis is in scope.

Unknown examples: a newly verified GSC property that reports “Processing data”; field CWV without CrUX/GSC data; rankings without GSC data.

