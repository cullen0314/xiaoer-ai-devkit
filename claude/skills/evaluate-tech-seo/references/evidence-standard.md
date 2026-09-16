# Evidence standard

## Evidence classes

| Class | Meaning | Examples |
| --- | --- | --- |
| Deployed fact | Observed from an anonymous live response or page source | 308 redirect, canonical tag, robots directive, sitemap entry |
| Code fact | Observed in the supplied codebase | Next.js metadata template, route guard, sitemap generator, video preload |
| GSC fact | Observed in Search Console | Indexed/not indexed, Google-selected canonical, crawl reason, performance query |
| Measured performance | Observed from PSI, CrUX, GSC CWV, RUM or hosting data | LCP/INP/CLS verdict |
| Unknown | Cannot be verified with supplied access | Search ranking, GSC status before data is ready, actual field CWV |

## Reporting rules

1. Cite the URL, response status, GSC report, screenshot date, or code file and line for every finding.
2. Phrase code-only findings as implementation risks when production has not been checked.
3. Do not infer indexing from sitemap presence, a page’s HTTP 200 response, or a canonical tag.
4. Do not infer performance pass/fail from source code alone.
5. Do not turn a recommendation into a defect without evidence of a violated technical requirement.
6. Report uncertainties separately; list the exact data or access needed to close each one.

## Minimum evidence by finding type

| Finding | Minimum evidence |
| --- | --- |
| Crawl block | Live robots/directive plus affected URL or code rule |
| Redirect issue | Full URL chain and final status |
| Canonical issue | Deployed canonical/OG/sitemap values, or code generation path |
| Thin sitemap URL | Sitemap entry plus deployed/body or route evidence |
| Locale inconsistency | Locale URL with metadata/body plus hreflang/canonical values |
| Indexing status | GSC URL Inspection or Pages report only |
| CWV verdict | PSI/CrUX/GSC/RUM only |

