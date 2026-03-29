#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const TurndownService = require('turndown');
const { gfm } = require('turndown-plugin-gfm');

function parseArguments() {
  const args = process.argv.slice(2);
  let mode = null;
  let output = null;
  let name = null;
  let bilingual = false;
  let force = false;
  let sourceOnly = false;
  let url = null;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--preview') {
      mode = 'preview';
      continue;
    }
    if (arg === '--generate') {
      mode = 'generate';
      continue;
    }
    if (arg === '--output') {
      output = args[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === '--name') {
      name = args[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === '--bilingual') {
      bilingual = true;
      continue;
    }
    if (arg === '--force') {
      force = true;
      continue;
    }
    if (arg === '--source-only') {
      sourceOnly = true;
      continue;
    }
    if (!arg.startsWith('--') && !url) {
      url = arg;
    }
  }

  return { mode, output, name, bilingual, force, sourceOnly, url };
}

function assertValidInput({ mode, output, name, url }) {
  if (!mode || !url) {
    throw new Error('用法: node skill.js [--preview|--generate] [--output <path>] [--name <slug>] [--bilingual] [--force] [--source-only] <url>');
  }

  if (mode !== 'preview' && mode !== 'generate') {
    throw new Error('模式错误：只支持 --preview 或 --generate');
  }

  if (output === '') {
    throw new Error('参数错误：--output 不能为空');
  }

  if (name === '') {
    throw new Error('参数错误：--name 不能为空');
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    throw new Error(`无效的 URL：${url}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`暂不支持的协议：${parsed.protocol}`);
  }

  return parsed.toString();
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'web-doc';
}

function deriveSlug(title, finalUrl, explicitName) {
  if (explicitName) {
    return slugify(explicitName);
  }

  const titleSlug = slugify(title || '');
  if (titleSlug && titleSlug !== 'web-doc') {
    return titleSlug;
  }

  try {
    const parsed = new URL(finalUrl);
    const segments = parsed.pathname.split('/').filter(Boolean).slice(-2);
    const pathSlug = slugify(segments.join('-'));
    if (pathSlug && pathSlug !== 'web-doc') {
      return pathSlug;
    }
  } catch (_) {
    // ignore
  }

  return 'web-doc';
}

function buildOutputPath(output, slug, bilingual) {
  if (output) {
    return path.resolve(output);
  }
  const fileName = bilingual ? `${slug}.bilingual.zh-CN.md` : `${slug}.zh-CN.md`;
  return path.resolve(process.cwd(), fileName);
}

async function ensureWritableTarget(targetPath, force) {
  const parentDir = path.dirname(targetPath);
  const parentStat = await fs.stat(parentDir).catch(() => null);
  if (!parentStat || !parentStat.isDirectory()) {
    throw new Error(`输出目录不存在：${parentDir}`);
  }

  const stat = await fs.stat(targetPath).catch(() => null);
  if (stat && stat.isFile() && !force) {
    throw new Error(`目标文件已存在，请确认后使用 --force 覆盖：${targetPath}`);
  }
}

async function fetchHtml(url) {
  try {
    const response = await axios.get(url, {
      timeout: 30000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; web-doc-zh/1.0; +https://claude.ai)'
      },
      responseType: 'text'
    });

    return {
      finalUrl: response.request?.res?.responseUrl || url,
      html: response.data,
      contentType: response.headers['content-type'] || ''
    };
  } catch (error) {
    if (error.response) {
      throw new Error(`网页请求失败：${error.response.status} ${error.response.statusText}`);
    }
    if (error.request) {
      throw new Error('网页请求失败：网络错误或请求超时');
    }
    throw new Error(`网页请求失败：${error.message}`);
  }
}

function removeNoise(document) {
  const selectors = [
    'nav',
    'header',
    'footer',
    'aside',
    '[role="navigation"]',
    '[role="complementary"]',
    '.sidebar',
    '.toc',
    '.table-of-contents',
    '.breadcrumbs',
    '.pagination',
    '.feedback-link'
  ];

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => node.remove());
  });
}

function fallbackArticle(document) {
  const candidates = [
    document.querySelector('article'),
    document.querySelector('main'),
    document.querySelector('[role="main"]'),
    document.body
  ].filter(Boolean);

  for (const candidate of candidates) {
    const text = candidate.textContent.replace(/\s+/g, ' ').trim();
    if (text.length >= 300) {
      return {
        title: document.title || 'Untitled Document',
        content: candidate.innerHTML,
        textContent: text,
        byline: null,
        excerpt: ''
      };
    }
  }

  return null;
}

function extractArticle(html, sourceUrl) {
  const dom = new JSDOM(html, { url: sourceUrl });
  const { document } = dom.window;
  removeNoise(document);

  const readerDom = new JSDOM(document.documentElement.outerHTML, { url: sourceUrl });
  const article = new Readability(readerDom.window.document).parse() || fallbackArticle(document);

  if (!article || !article.content) {
    throw new Error('正文抽取失败：未识别到可用正文，页面可能依赖登录态或动态渲染');
  }

  const plainText = (article.textContent || '').replace(/\s+/g, ' ').trim();
  if (plainText.length < 200) {
    throw new Error('正文抽取结果过短：页面可能不是标准文档页，或依赖动态渲染');
  }

  return {
    title: article.title || document.title || 'Untitled Document',
    html: article.content,
    excerpt: article.excerpt || plainText.slice(0, 180),
    textLength: plainText.length
  };
}

function createTurndownService() {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '_'
  });

  service.use(gfm);
  service.keep(['table']);
  service.addRule('pre-preserve', {
    filter: ['pre'],
    replacement(content, node) {
      const codeNode = node.querySelector('code');
      const className = codeNode?.getAttribute('class') || '';
      const language = className.replace(/^language-/, '').split(' ').find(Boolean) || '';
      const text = codeNode ? codeNode.textContent : node.textContent;
      return `\n\n\`\`\`${language}\n${(text || '').replace(/\n$/, '')}\n\`\`\`\n\n`;
    }
  });
  service.addRule('anchor-preserve', {
    filter(node) {
      return node.nodeName === 'A' && !!node.getAttribute('href');
    },
    replacement(content, node) {
      const href = node.getAttribute('href');
      const text = (content || href || '').trim();
      return href ? `[${text}](${href})` : text;
    }
  });

  return service;
}

function normalizeMarkdown(markdown) {
  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function convertHtmlToMarkdown(html) {
  const service = createTurndownService();
  return normalizeMarkdown(service.turndown(html));
}

function buildPreview({ title, originalUrl, finalUrl, slug, markdown, textLength }) {
  const preview = markdown.split('\n').slice(0, 30).join('\n');
  return `## 抽取预览\n\n### 1. 输入识别结果\n- 原始 URL：${originalUrl}\n- 最终 URL：${finalUrl}\n- 页面标题：${title}\n- 建议文件名：${slug}.zh-CN.md\n- 正文长度：${textLength} 字符\n\n### 2. 正文节选\n\n\`\`\`markdown\n${preview}\n\`\`\`\n\n### 3. 已知边界\n- 当前结果基于静态 HTML 正文抽取\n- 若内容异常偏少，页面可能依赖登录态或动态渲染\n- 预览阶段不写任何文件\n\n请确认是否继续生成。`;
}

function buildGenerateOutput({ title, originalUrl, finalUrl, slug, outputPath, markdown, bilingual, sourceOnly }) {
  const modeLabel = sourceOnly ? '英文源稿模式' : bilingual ? '双语生成模式' : '中文生成模式';
  return `## 文档源稿\n\n### 1. 元信息\n- 模式：${modeLabel}\n- 原始 URL：${originalUrl}\n- 最终 URL：${finalUrl}\n- 页面标题：${title}\n- 建议输出路径：${outputPath}\n\n### 2. 供 Claude 写文件使用的字段\nOUTPUT_PATH=${outputPath}\nOUTPUT_MODE=${bilingual ? 'bilingual' : 'zh'}\nTITLE=${title}\nSOURCE_URL=${finalUrl}\nSLUG=${slug}\n\n### 3. 英文 Markdown 正文\n\n\`\`\`markdown\n${markdown}\n\`\`\``;
}

async function writeSourceOnly(targetPath, markdown) {
  await fs.writeFile(targetPath, markdown, 'utf8');
}

async function main() {
  const args = parseArguments();
  const normalizedUrl = assertValidInput(args);
  const { finalUrl, html, contentType } = await fetchHtml(normalizedUrl);

  if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    throw new Error(`暂不支持的内容类型：${contentType}`);
  }

  const article = extractArticle(html, finalUrl);
  const markdown = convertHtmlToMarkdown(article.html);
  const slug = deriveSlug(article.title, finalUrl, args.name);
  const outputPath = buildOutputPath(args.output, slug, args.bilingual);

  if (args.mode === 'preview') {
    console.log(buildPreview({
      title: article.title,
      originalUrl: normalizedUrl,
      finalUrl,
      slug,
      markdown,
      textLength: article.textLength
    }));
    return;
  }

  if (args.sourceOnly) {
    await ensureWritableTarget(outputPath, args.force);
    await writeSourceOnly(outputPath, markdown);
    console.log(`已输出英文 Markdown 源稿：\n- ${outputPath}`);
    return;
  }

  await ensureWritableTarget(outputPath, args.force);

  console.log(buildGenerateOutput({
    title: article.title,
    originalUrl: normalizedUrl,
    finalUrl,
    slug,
    outputPath,
    markdown,
    bilingual: args.bilingual,
    sourceOnly: args.sourceOnly
  }));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`错误：${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  parseArguments,
  assertValidInput,
  slugify,
  deriveSlug,
  buildOutputPath,
  fetchHtml,
  extractArticle,
  convertHtmlToMarkdown,
  buildPreview
};
