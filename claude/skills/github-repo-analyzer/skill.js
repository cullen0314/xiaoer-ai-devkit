#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const IGNORE_NAMES = new Set([
  '.git', 'node_modules', 'dist', 'build', '.next', 'coverage',
  '.idea', '.vscode', '.DS_Store', 'target', 'out', '__pycache__',
  '.pytest_cache', '.mypy_cache', '.tox', 'vendor', '.gradle'
]);

const README_CANDIDATES = ['README.md', 'readme.md', 'README', 'README.rst', 'README.txt'];

const CONFIG_CANDIDATES = [
  'package.json', 'pyproject.toml', 'setup.py', 'setup.cfg',
  'pom.xml', 'build.gradle', 'Cargo.toml', 'go.mod',
  'Gemfile', 'composer.json', 'Makefile', 'Dockerfile'
];

const DOC_KEY_FILES = ['README.md', 'readme.md', 'index.md', 'getting-started.md',
  'quickstart.md', 'overview.md', 'introduction.md', 'guide.md'];

const SUPPLEMENT_DOCS = [
  'CHANGELOG.md', 'CONTRIBUTING.md', 'ARCHITECTURE.md', 'API.md',
  'USAGE.md', 'GUIDE.md', 'DEVELOPMENT.md', 'DEPLOY.md'
];

// 常见入口文件候选
const ENTRY_CANDIDATES = [
  'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js',
  'src/app.ts', 'src/app.js', 'lib/index.js', 'lib/index.ts',
  'app.js', 'app.ts', 'main.js', 'main.ts', 'index.js', 'index.ts',
  'src/cli.ts', 'src/cli.js', 'cli.js', 'cli.ts',
  'src/index.py', 'src/main.py', 'app.py', 'main.py',
  'src/lib.rs', 'src/main.rs'
];

// --- 参数解析 ---

function parseArgs() {
  const args = process.argv.slice(2);
  const mode = args[0];
  if (mode === '--clone') return { mode: 'clone', url: args[1] };
  if (mode === '--preview') return { mode: 'preview', repoPath: args[1] };
  if (mode === '--generate') return { mode: 'generate', outputDir: args[1], repoName: args[2] };
  return { mode: null };
}

// --- 仓库克隆 ---

function extractRepoName(url) {
  const cleaned = url.replace(/\.git$/, '').replace(/\/$/, '');
  return cleaned.split('/').pop();
}

async function cloneRepo(url) {
  const repoName = extractRepoName(url);
  const tmpDir = path.join('/tmp', 'github-repo-analyzer', repoName);

  // 如果已存在则先清理
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(path.dirname(tmpDir), { recursive: true });

  execSync(`git clone --depth 1 "${url}" "${tmpDir}"`, { stdio: 'pipe' });
  return tmpDir;
}

// --- 目录树构建 ---

async function buildTree(rootPath, currentPath = rootPath, depth = 0, maxDepth = 3) {
  if (depth > maxDepth) return [];

  const entries = await fs.readdir(currentPath, { withFileTypes: true }).catch(() => []);
  const filtered = entries
    .filter(e => !IGNORE_NAMES.has(e.name) && !e.name.startsWith('.'))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, depth === 0 ? 15 : 10);

  const lines = [];
  for (const entry of filtered) {
    const prefix = '  '.repeat(depth);
    const suffix = entry.isDirectory() ? '/' : '';
    lines.push(`${prefix}- ${entry.name}${suffix}`);
    if (entry.isDirectory() && depth < maxDepth) {
      const childLines = await buildTree(rootPath, path.join(currentPath, entry.name), depth + 1, maxDepth);
      lines.push(...childLines);
    }
  }
  return lines;
}

// --- 文件读取工具 ---

async function readFileIfExists(filePath, maxBytes = 50000) {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return null;
    const content = await fs.readFile(filePath, 'utf8');
    return content.length > maxBytes ? content.slice(0, maxBytes) + '\n... (内容截断)' : content;
  } catch {
    return null;
  }
}

async function findAndReadFile(dir, candidates) {
  for (const name of candidates) {
    const content = await readFileIfExists(path.join(dir, name));
    if (content) return { name, content };
  }
  return null;
}

// --- 配置文件采集 ---

async function collectConfigs(repoPath) {
  const configs = {};
  for (const name of CONFIG_CANDIDATES) {
    const content = await readFileIfExists(path.join(repoPath, name), 10000);
    if (content) configs[name] = content;
  }
  return configs;
}

// --- docs 目录采集（增强版：支持子目录、更多文件） ---

async function collectDocs(repoPath) {
  const docsDir = path.join(repoPath, 'docs');
  const stat = await fs.stat(docsDir).catch(() => null);
  if (!stat || !stat.isDirectory()) return null;

  const entries = await fs.readdir(docsDir, { withFileTypes: true }).catch(() => []);
  const docExtensions = ['.md', '.mdx', '.rst', '.txt'];
  const mdFiles = entries.filter(e => e.isFile() && docExtensions.some(ext => e.name.endsWith(ext))).map(e => e.name);
  const subDirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name);

  // 优先读取关键文档
  const keyDocs = [];
  for (const keyName of DOC_KEY_FILES) {
    if (mdFiles.includes(keyName) && keyDocs.length < 8) {
      const content = await readFileIfExists(path.join(docsDir, keyName), 20000);
      if (content) keyDocs.push({ name: keyName, content });
    }
  }

  // 补充非关键但存在的文档，凑满 8 个
  const keySet = new Set(DOC_KEY_FILES);
  for (const name of mdFiles) {
    if (keyDocs.length >= 8) break;
    if (!keySet.has(name)) {
      const content = await readFileIfExists(path.join(docsDir, name), 20000);
      if (content) keyDocs.push({ name, content });
    }
  }

  // 扫描子目录（如 docs/guides/、docs/api/），每个子目录最多读 3 个文件
  const subDirDocs = {};
  for (const dir of subDirs.slice(0, 5)) {
    const subEntries = await fs.readdir(path.join(docsDir, dir)).catch(() => []);
    const subMdFiles = subEntries.filter(f => docExtensions.some(ext => f.endsWith(ext)));
    const docs = [];
    for (const f of subMdFiles.slice(0, 3)) {
      const content = await readFileIfExists(path.join(docsDir, dir, f), 15000);
      if (content) docs.push({ name: f, content });
    }
    if (docs.length > 0) subDirDocs[dir] = docs;
  }

  return { fileList: mdFiles.slice(0, 30), subDirs, keyDocs, subDirDocs };
}

// --- examples 目录采集（增强版：读取内容） ---

async function collectExamples(repoPath) {
  for (const dirName of ['examples', 'example']) {
    const exDir = path.join(repoPath, dirName);
    const stat = await fs.stat(exDir).catch(() => null);
    if (stat && stat.isDirectory()) {
      const entries = await fs.readdir(exDir, { withFileTypes: true }).catch(() => []);
      const files = entries.filter(f => f.isFile() && !f.name.startsWith('.')).map(e => e.name);
      const dirs = entries.filter(f => f.isDirectory() && !f.name.startsWith('.')).map(e => e.name);

      // 读取前 3 个示例文件的实际内容
      const keyExamples = [];
      for (const name of files.slice(0, 3)) {
        const content = await readFileIfExists(path.join(exDir, name), 15000);
        if (content) keyExamples.push({ name, content });
      }

      // 如果是子目录结构的示例（如 examples/basic/），读取每个子目录的入口文件
      const dirExamples = [];
      for (const dir of dirs.slice(0, 3)) {
        const subEntries = await fs.readdir(path.join(exDir, dir)).catch(() => []);
        // 找入口文件：README > index > main > app
        const entryNames = ['README.md', 'index.js', 'index.ts', 'main.js', 'main.ts', 'main.py', 'app.js', 'app.py'];
        for (const entry of entryNames) {
          if (subEntries.includes(entry)) {
            const content = await readFileIfExists(path.join(exDir, dir, entry), 15000);
            if (content) {
              dirExamples.push({ dir, name: entry, content });
              break;
            }
          }
        }
      }

      return { fileList: files.slice(0, 20), dirList: dirs.slice(0, 10), keyExamples, dirExamples };
    }
  }
  return null;
}

// --- 核心源码入口采集 ---

async function collectEntryPoints(repoPath, configs) {
  const entries = [];

  // 1. 从 package.json 推断入口
  if (configs['package.json']) {
    try {
      const pkg = JSON.parse(configs['package.json']);
      const candidates = [pkg.main, pkg.module, ...(pkg.bin ? (typeof pkg.bin === 'string' ? [pkg.bin] : Object.values(pkg.bin)) : [])].filter(Boolean);
      for (const entry of candidates.slice(0, 3)) {
        const content = await readFileIfExists(path.join(repoPath, entry), 30000);
        if (content) entries.push({ source: 'package.json', file: entry, content });
      }
    } catch {}
  }

  // 2. 从 pyproject.toml 推断入口
  if (configs['pyproject.toml']) {
    const scriptMatch = configs['pyproject.toml'].match(/\[(?:tool\.poetry\.)?scripts\]\s*\n([\s\S]*?)(?:\n\[|$)/);
    if (scriptMatch) {
      const moduleMatch = scriptMatch[1].match(/=\s*"([^":]+)/);
      if (moduleMatch) {
        const modulePath = moduleMatch[1].replace(/\./g, '/') + '.py';
        const content = await readFileIfExists(path.join(repoPath, modulePath), 30000);
        if (content) entries.push({ source: 'pyproject.toml', file: modulePath, content });
      }
    }
  }

  // 3. 如果配置文件没推断出来，用候选列表兜底
  if (entries.length === 0) {
    for (const candidate of ENTRY_CANDIDATES) {
      const content = await readFileIfExists(path.join(repoPath, candidate), 30000);
      if (content) {
        entries.push({ source: 'fallback', file: candidate, content });
        if (entries.length >= 2) break;
      }
    }
  }

  return entries.length > 0 ? entries : null;
}

// --- 补充文档采集（CHANGELOG、CONTRIBUTING 等） ---

async function collectSupplementDocs(repoPath) {
  const docs = {};
  for (const name of SUPPLEMENT_DOCS) {
    // CHANGELOG 只读前 50 行
    if (name.startsWith('CHANGELOG')) {
      const content = await readFileIfExists(path.join(repoPath, name), 50000);
      if (content) {
        const lines = content.split('\n');
        docs[name] = lines.slice(0, 50).join('\n') + (lines.length > 50 ? '\n... (仅展示前 50 行)' : '');
      }
    } else {
      const content = await readFileIfExists(path.join(repoPath, name), 20000);
      if (content) docs[name] = content;
    }
    // 尝试不带 .md 的版本
    if (!docs[name]) {
      const nameNoExt = name.replace('.md', '');
      const content = await readFileIfExists(path.join(repoPath, nameNoExt), 20000);
      if (content) docs[nameNoExt] = content;
    }
  }
  return Object.keys(docs).length > 0 ? docs : null;
}

// --- GitHub Actions 采集 ---

async function collectCI(repoPath) {
  const workflowDir = path.join(repoPath, '.github', 'workflows');
  const stat = await fs.stat(workflowDir).catch(() => null);
  if (!stat || !stat.isDirectory()) return null;

  const entries = await fs.readdir(workflowDir).catch(() => []);
  const yamlFiles = entries.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));

  // 读取主要工作流文件（最多 3 个）
  const workflows = [];
  for (const name of yamlFiles.slice(0, 3)) {
    const content = await readFileIfExists(path.join(workflowDir, name), 10000);
    if (content) workflows.push({ name, content });
  }

  return { fileList: yamlFiles, workflows };
}

// --- GitHub 元信息 ---

function fetchGitHubMeta(repoPath) {
  try {
    // 从 git remote 提取 owner/repo
    const remoteUrl = execSync('git remote get-url origin', { cwd: repoPath, stdio: 'pipe' }).toString().trim();
    const match = remoteUrl.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
    if (!match) return null;

    const ownerRepo = `${match[1]}/${match[2]}`;
    const raw = execSync(`gh api repos/${ownerRepo} --jq '{stargazers_count,forks_count,license: .license.spdx_id,language,topics,open_issues_count,updated_at,description,homepage}'`, { stdio: 'pipe' }).toString().trim();
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// --- 预览 ---

async function preview(repoPath) {
  const resolvedPath = path.resolve(repoPath);
  const stat = await fs.stat(resolvedPath).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`仓库目录不存在: ${resolvedPath}`);
  }

  const repoName = path.basename(resolvedPath);
  const readme = await findAndReadFile(resolvedPath, README_CANDIDATES);
  const tree = await buildTree(resolvedPath);
  const configs = await collectConfigs(resolvedPath);
  const docs = await collectDocs(resolvedPath);
  const examples = await collectExamples(resolvedPath);
  const meta = fetchGitHubMeta(resolvedPath);
  const entryPoints = await collectEntryPoints(resolvedPath, configs);
  const supplementDocs = await collectSupplementDocs(resolvedPath);
  const ci = await collectCI(resolvedPath);

  const result = {
    repoName,
    repoPath: resolvedPath,
    readme: readme ? { name: readme.name, content: readme.content } : null,
    tree: tree.join('\n'),
    configs,
    entryPoints,
    docs,
    supplementDocs,
    examples,
    ci,
    meta
  };

  console.log(JSON.stringify(result, null, 2));
}

// --- 生成 ---

async function generate(outputDir, repoName) {
  const resolvedDir = path.resolve(outputDir);
  await fs.mkdir(resolvedDir, { recursive: true });

  // 从 stdin 读取 MD 内容
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const content = Buffer.concat(chunks).toString('utf8');

  const filePath = path.join(resolvedDir, `${repoName}.md`);
  await fs.writeFile(filePath, content, 'utf8');
  console.log(`已生成: ${filePath}`);
}

// --- 主入口 ---

async function main() {
  const { mode, url, repoPath, outputDir, repoName } = parseArgs();

  if (mode === 'clone') {
    const localPath = await cloneRepo(url);
    console.log(localPath);
  } else if (mode === 'preview') {
    await preview(repoPath);
  } else if (mode === 'generate') {
    await generate(outputDir, repoName);
  } else {
    console.error('用法: node skill.js [--clone <url> | --preview <path> | --generate <dir> <name>]');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`错误: ${err.message}`);
  process.exit(1);
});
