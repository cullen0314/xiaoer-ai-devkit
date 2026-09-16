#!/usr/bin/env node

/**
 * Read-only public SEO snapshot.
 * Usage: node collect-public-seo.mjs https://example.com [additional-url ...]
 */

const inputs = process.argv.slice(2);
if (inputs.length === 0) {
  console.error("Usage: node collect-public-seo.mjs https://example.com [additional-url ...]");
  process.exit(1);
}

const USER_AGENT = "evaluate-tech-seo/1.0 (+read-only public audit)";
const MAX_REDIRECTS = 10;
const HEAD_LIMIT = 1_500_000;

function normaliseUrl(value) {
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error(`Only http(s) URLs are supported: ${value}`);
  }
  url.hash = "";
  return url;
}

function absoluteUrl(value, base) {
  try {
    return new URL(value, base).href;
  } catch {
    return value;
  }
}

function matchOne(html, pattern) {
  return html.match(pattern)?.[1]?.trim() || null;
}

function attr(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return tag.match(new RegExp(`\\b${escaped}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] || null;
}

function collectHead(html, baseUrl) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || html.slice(0, HEAD_LIMIT);
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  const scripts = [...head.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

  const alternates = links
    .filter((tag) => (attr(tag, "rel") || "").toLowerCase().split(/\s+/).includes("alternate"))
    .map((tag) => ({ hreflang: attr(tag, "hreflang"), href: absoluteUrl(attr(tag, "href") || "", baseUrl) }))
    .filter((item) => item.hreflang && item.href);
  const canonicalTag = links.find((tag) => (attr(tag, "rel") || "").toLowerCase().split(/\s+/).includes("canonical"));
  const schemaTypes = [];
  for (const script of scripts) {
    try {
      const json = JSON.parse(script[1]);
      const entries = Array.isArray(json) ? json : [json];
      for (const entry of entries) {
        const graph = entry?.["@graph"] || [entry];
        for (const node of graph) {
          const type = node?.["@type"];
          if (Array.isArray(type)) schemaTypes.push(...type);
          else if (typeof type === "string") schemaTypes.push(type);
        }
      }
    } catch {
      schemaTypes.push("INVALID_JSON_LD");
    }
  }

  const meta = (key, value) => metas.find((tag) => (attr(tag, key) || "").toLowerCase() === value)?.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] || null;
  return {
    title: matchOne(head, /<title\b[^>]*>([\s\S]*?)<\/title>/i)?.replace(/\s+/g, " ") || null,
    description: meta("name", "description"),
    robots: meta("name", "robots"),
    canonical: canonicalTag ? absoluteUrl(attr(canonicalTag, "href") || "", baseUrl) : null,
    ogUrl: meta("property", "og:url"),
    ogTitle: meta("property", "og:title"),
    hreflang: alternates,
    jsonLdTypes: [...new Set(schemaTypes)],
  };
}

async function requestWithChain(input) {
  let current = normaliseUrl(input);
  const chain = [];
  for (let count = 0; count <= MAX_REDIRECTS; count += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.1" },
    });
    const location = response.headers.get("location");
    chain.push({ url: current.href, status: response.status, location: location ? absoluteUrl(location, current.href) : null });
    if (response.status >= 300 && response.status < 400 && location) {
      current = normaliseUrl(absoluteUrl(location, current.href));
      continue;
    }
    const text = (await response.text()).slice(0, HEAD_LIMIT);
    return { chain, finalUrl: current.href, status: response.status, headers: Object.fromEntries(response.headers), body: text };
  }
  throw new Error(`Redirect limit exceeded for ${input}`);
}

async function snapshotPage(url) {
  const response = await requestWithChain(url);
  return {
    requestedUrl: normaliseUrl(url).href,
    redirectChain: response.chain,
    finalUrl: response.finalUrl,
    status: response.status,
    contentType: response.headers["content-type"] || null,
    ...collectHead(response.body, response.finalUrl),
  };
}

function discoverSitemaps(robotsBody, origin) {
  const fromRobots = [...robotsBody.matchAll(/^\s*sitemap:\s*(\S+)\s*$/gim)].map((match) => absoluteUrl(match[1], origin));
  return [...new Set([...fromRobots, new URL("/sitemap.xml", origin).href])];
}

async function snapshotSitemap(url) {
  const response = await requestWithChain(url);
  const urls = [...response.body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => match[1].trim());
  return { requestedUrl: url, redirectChain: response.chain, finalUrl: response.finalUrl, status: response.status, urlCount: urls.length, sampleUrls: urls.slice(0, 25) };
}

async function main() {
  const root = normaliseUrl(inputs[0]);
  const origin = root.origin;
  const robots = await requestWithChain(new URL("/robots.txt", origin).href);
  const sitemapUrls = discoverSitemaps(robots.body, origin);
  const pages = [];
  for (const input of inputs) {
    try {
      pages.push(await snapshotPage(input));
    } catch (error) {
      pages.push({ requestedUrl: input, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const sitemaps = [];
  for (const url of sitemapUrls) {
    try {
      sitemaps.push(await snapshotSitemap(url));
    } catch (error) {
      sitemaps.push({ requestedUrl: url, error: error instanceof Error ? error.message : String(error) });
    }
  }
  console.log(JSON.stringify({
    collectedAt: new Date().toISOString(),
    root: origin,
    robots: {
      requestedUrl: new URL("/robots.txt", origin).href,
      redirectChain: robots.chain,
      finalUrl: robots.finalUrl,
      status: robots.status,
      body: robots.body.slice(0, 20_000),
    },
    sitemaps,
    pages,
    limitations: [
      "A public 200 response or sitemap entry does not prove Google indexing.",
      "This script identifies code and asset risk signals but does not measure Core Web Vitals.",
      "Use Google Search Console URL Inspection and reports for indexing, Google-selected canonical, search performance, and field CWV.",
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
