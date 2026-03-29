#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

const README_CANDIDATES = ['README.md', 'readme.md', 'README'];
const IGNORE_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
  '.idea',
  '.vscode',
  '.DS_Store',
  'target',
  'out'
]);

function parseArguments() {
  const args = process.argv.slice(2);
  let mode = null;
  let force = false;
  let repoPath = null;

  for (const arg of args) {
    if (arg === '--preview') {
      mode = 'preview';
      continue;
    }
    if (arg === '--generate') {
      mode = 'generate';
      continue;
    }
    if (arg === '--force') {
      force = true;
      continue;
    }
    if (!arg.startsWith('--') && !repoPath) {
      repoPath = arg;
    }
  }

  return { mode, force, repoPath };
}

async function assertDirectory(repoPath) {
  const resolvedPath = path.resolve(repoPath);
  const stat = await fs.stat(resolvedPath).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`仓库目录不存在或不可访问: ${resolvedPath}`);
  }
  return resolvedPath;
}

async function findReadme(repoPath) {
  for (const candidate of README_CANDIDATES) {
    const candidatePath = path.join(repoPath, candidate);
    const stat = await fs.stat(candidatePath).catch(() => null);
    if (stat && stat.isFile()) {
      return candidatePath;
    }
  }
  return null;
}

async function buildTree(rootPath, currentPath = rootPath, depth = 0, maxDepth = 2) {
  if (depth > maxDepth) {
    return [];
  }

  const entries = await fs.readdir(currentPath, { withFileTypes: true }).catch(() => []);
  const filtered = entries
    .filter((entry) => !IGNORE_NAMES.has(entry.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, depth === 0 ? 12 : 10);

  const lines = [];
  for (const entry of filtered) {
    const prefix = '  '.repeat(depth);
    const suffix = entry.isDirectory() ? '/' : '';
    lines.push(`${prefix}- ${entry.name}${suffix}`);

    if (entry.isDirectory() && depth < maxDepth) {
      const childPath = path.join(currentPath, entry.name);
      const childLines = await buildTree(rootPath, childPath, depth + 1, maxDepth);
      lines.push(...childLines);
    }
  }

  return lines;
}

function stripCodeFences(content) {
  return content.replace(/```[\s\S]*?```/g, '').trim();
}

function normalizeLines(content) {
  return stripCodeFences(content)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function pickTitle(lines, repoName) {
  const heading = lines.find((line) => line.startsWith('# '));
  if (heading) {
    return heading.replace(/^#\s+/, '').trim();
  }
  return repoName;
}

function pickTagline(lines) {
  const plain = lines.find((line) => !line.startsWith('#') && !line.startsWith('![') && !line.startsWith('>'));
  return plain || '一个面向开发者的开源项目。';
}

function pickBulletItems(lines, limit = 4) {
  return lines
    .filter((line) => /^[-*+]\s+/.test(line))
    .map((line) => line.replace(/^[-*+]\s+/, '').trim())
    .slice(0, limit);
}

function pickNumberedItems(lines, limit = 3) {
  return lines
    .filter((line) => /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^\d+\.\s+/, '').trim())
    .slice(0, limit);
}

function inferProjectSummary(lines, repoName) {
  const title = pickTitle(lines, repoName);
  const tagline = pickTagline(lines);
  const bullets = pickBulletItems(lines);
  const numbered = pickNumberedItems(lines);

  return {
    title,
    tagline,
    bullets,
    numbered,
    hasEnoughContent: lines.length >= 8
  };
}

function detectKeyDirs(treeLines) {
  const keyNames = ['src/', 'app/', 'packages/', 'examples/', 'example/', 'scripts/', 'bin/', 'config/', 'docs/', 'test/', 'tests/'];
  const matched = [];

  for (const line of treeLines) {
    const trimmed = line.trim().replace(/^-\s+/, '');
    if (keyNames.includes(trimmed)) {
      matched.push(trimmed);
    }
  }

  return matched.slice(0, 6);
}

function generatePreview({ repoPath, readmePath, treeLines, summary }) {
  const keyDirs = detectKeyDirs(treeLines);
  const readmeStatus = readmePath ? `已找到：${path.basename(readmePath)}` : '未找到 README';

  return `## 生成预览\n\n### 1. 输入识别结果\n- 仓库路径：${repoPath}\n- README：${readmeStatus}\n- 目录结构：已提取轻量目录树\n- docs 深读：未执行\n\n### 2. 项目理解摘要\n- 项目名：${summary.title}\n- 一句话理解：${summary.tagline}\n- README 完整度：${summary.hasEnoughContent ? '中等及以上，可生成正式内容' : '内容偏少，生成结果会偏概览'}\n- 重点目录：${keyDirs.length ? keyDirs.join('、') : '暂无明显关键目录'}\n\n### 3. 将生成的文件\n- README.zh-CN.md\n  - 侧重：项目定位、核心能力、使用说明、结构概览\n- PROJECT_GUIDE.zh-CN.md\n  - 侧重：仓库结构理解、重点目录导读、推荐阅读路径\n\n### 4. 已知边界\n- 仅基于 README 与目录结构整理\n- 不主动深读 docs/\n- 不做源码级深度分析\n- 不补充 README 未明确提供的事实\n\n### 5. 目录结构摘要\n\n\`\`\`text\n${treeLines.join('\n') || '- （目录为空）'}\n\`\`\`\n\n请确认是否继续生成。`;
}

function buildStructureOverview(treeLines) {
  const topLevel = treeLines
    .filter((line) => !line.startsWith('  '))
    .map((line) => line.replace(/^-\s+/, '').trim())
    .slice(0, 8);

  if (!topLevel.length) {
    return ['- 当前仓库目录较精简，建议优先从 README 与入口目录开始阅读。'];
  }

  return topLevel.map((item) => `- \`${item}\`：建议结合目录名理解其职责。`);
}

function buildReadingSuggestions(keyDirs, readmePath) {
  const suggestions = [];
  if (readmePath) {
    suggestions.push('- 先完整阅读原 README，确认项目定位、安装方式与使用入口。');
  }
  if (keyDirs.includes('examples/') || keyDirs.includes('example/')) {
    suggestions.push('- 若想快速理解用法，优先查看 examples 相关目录。');
  }
  if (keyDirs.includes('src/') || keyDirs.includes('app/')) {
    suggestions.push('- 若想理解核心实现，可继续查看 src 或 app 目录中的入口文件。');
  }
  if (keyDirs.includes('packages/')) {
    suggestions.push('- 若这是多包仓库，建议先理解 packages 目录下各子包职责。');
  }
  if (!suggestions.length) {
    suggestions.push('- 建议先从 README，再到顶层主要目录逐步阅读。');
  }
  return suggestions;
}

function createChineseReadme({ summary, treeLines, repoName, readmePath }) {
  const structure = buildStructureOverview(treeLines);
  const suggestions = buildReadingSuggestions(detectKeyDirs(treeLines), readmePath);
  const abilities = summary.bullets.length
    ? summary.bullets.map((item) => `- ${item}`)
    : ['- 具体能力请以原 README 中的功能说明为准。'];
  const usage = summary.numbered.length
    ? summary.numbered.map((item, index) => `${index + 1}. ${item}`)
    : ['1. 请优先参考原 README 中的安装与运行说明。'];

  return `# ${summary.title || repoName}\n\n> ${summary.tagline}\n\n## 项目简介\n\n该项目基于原始 README 与仓库目录结构整理，目标是帮助中文开发者更快理解项目定位、主要用途与阅读入口。\n\n## 核心能力\n\n${abilities.join('\n')}\n\n## 适用场景\n\n- 适合希望快速了解项目用途、结构与阅读顺序的开发者。\n- 适合在正式阅读源码前先建立整体认识。\n\n## 快速开始\n\n${usage.join('\n')}\n\n## 项目结构概览\n\n${structure.join('\n')}\n\n## 阅读建议\n\n${suggestions.join('\n')}\n\n## 补充说明\n\n- 本文基于仓库中的 README 与目录结构整理。\n- 为避免误导，未主动深读 docs 与源码细节。\n- 若需完整信息，请以原 README 与项目源码为准。\n`;
}

function createProjectGuide({ summary, treeLines, repoName, readmePath }) {
  const keyDirs = detectKeyDirs(treeLines);
  const readingSuggestions = buildReadingSuggestions(keyDirs, readmePath);
  const keyDirLines = keyDirs.length
    ? keyDirs.map((item) => `- \`${item}\`：建议优先查看，理解项目主要组成部分。`)
    : ['- 当前未识别出明显的标准关键目录，建议从顶层目录逐步阅读。'];

  return `# 项目导读\n\n## 1. 这个项目是做什么的\n\n- 项目名：${summary.title || repoName}\n- 一句话理解：${summary.tagline}\n- 该项目更适合作为首次接触时的整体认知入口，而不是替代官方完整文档。\n\n## 2. 仓库可以怎么理解\n\n该仓库的理解方式，建议采用“先 README、再顶层目录、最后关键模块”的顺序。这样可以先建立整体认识，再进入细节。\n\n## 3. 重点目录导读\n\n${keyDirLines.join('\n')}\n\n## 4. 推荐阅读路径\n\n${readingSuggestions.join('\n')}\n\n## 5. 目录结构摘要\n\n\`\`\`text\n${treeLines.join('\n') || '- （目录为空）'}\n\`\`\`\n\n## 6. 边界说明\n\n- 本导读仅基于 README 与目录结构生成。\n- 未主动深读 docs、示例文档或源码实现细节。\n- 若需要深入理解架构与调用链，建议继续阅读源码与官方文档。\n`;
}

async function ensureWritableTargets(repoPath, force) {
  const targets = [
    path.join(repoPath, 'README.zh-CN.md'),
    path.join(repoPath, 'PROJECT_GUIDE.zh-CN.md')
  ];

  if (force) {
    return targets;
  }

  for (const filePath of targets) {
    const stat = await fs.stat(filePath).catch(() => null);
    if (stat && stat.isFile()) {
      throw new Error(`目标文件已存在，请确认后使用 --force 覆盖: ${filePath}`);
    }
  }

  return targets;
}

async function main() {
  const { mode, force, repoPath } = parseArguments();

  if (!mode || !repoPath) {
    console.error('用法: node skill.js [--preview|--generate] [--force] <repo_path>');
    process.exit(1);
  }

  const resolvedRepoPath = await assertDirectory(repoPath);
  const readmePath = await findReadme(resolvedRepoPath);
  const repoName = path.basename(resolvedRepoPath);
  const readmeContent = readmePath ? await fs.readFile(readmePath, 'utf8') : '';
  const treeLines = await buildTree(resolvedRepoPath);
  const lines = normalizeLines(readmeContent);
  const summary = inferProjectSummary(lines, repoName);

  if (mode === 'preview') {
    console.log(generatePreview({
      repoPath: resolvedRepoPath,
      readmePath,
      treeLines,
      summary
    }));
    return;
  }

  if (!readmePath) {
    throw new Error('当前仓库未找到 README，默认只允许预览，不直接生成正式文件。');
  }

  const [readmeZhPath, guidePath] = await ensureWritableTargets(resolvedRepoPath, force);
  const readmeZh = createChineseReadme({ summary, treeLines, repoName, readmePath });
  const guide = createProjectGuide({ summary, treeLines, repoName, readmePath });

  await fs.writeFile(readmeZhPath, readmeZh, 'utf8');
  await fs.writeFile(guidePath, guide, 'utf8');

  console.log(`已生成以下文件：\n- ${readmeZhPath}\n- ${guidePath}\n\n结果摘要：\n- 中文 README：已完成\n- 项目导读：已完成\n- 输入边界：README + 目录结构\n- docs 深读：未执行`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`错误：${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  parseArguments,
  findReadme,
  buildTree,
  normalizeLines,
  inferProjectSummary,
  createChineseReadme,
  createProjectGuide
};
