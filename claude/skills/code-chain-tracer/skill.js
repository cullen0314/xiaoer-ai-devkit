#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// --- 配置 ---

const MAX_FILES = 5000;
const MAX_FILE_SIZE = 200 * 1024; // 200KB
const JAVA_SRC_DIRS = ['src/main/java'];

const IGNORE_DIRS = new Set([
  '.git', 'node_modules', 'target', 'build', 'dist', '.idea', '.vscode',
  'test', 'tests', 'src/test', '__pycache__', '.gradle'
]);

// --- 工具函数 ---

function collectJavaFiles(rootPath) {
  const files = [];
  const srcDirs = JAVA_SRC_DIRS.map(d => path.join(rootPath, d)).filter(d => {
    try { return fs.statSync(d).isDirectory(); } catch { return false; }
  });

  // 如果标准 src/main/java 不存在，fallback 到项目根目录
  const searchRoots = srcDirs.length > 0 ? srcDirs : [rootPath];

  function walk(dir) {
    if (files.length >= MAX_FILES) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (files.length >= MAX_FILES) return;
      if (IGNORE_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.java')) {
        files.push(fullPath);
      }
    }
  }

  for (const root of searchRoots) walk(root);
  return files;
}

function readFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_FILE_SIZE) return null;
    return fs.readFileSync(filePath, 'utf8');
  } catch { return null; }
}

function relativePath(fullPath, rootPath) {
  return path.relative(rootPath, fullPath);
}

// --- 扫描器 ---

// 1. Controller 扫描：@XxxMapping + 方法
function scanControllers(files, rootPath) {
  const results = [];
  // 类级别的 @RequestMapping
  const classPathRegex = /@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/;
  // 方法级别的 Mapping
  const methodMappingRegex = /@(Get|Post|Put|Delete|Patch|Request)Mapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?["']([^"']+)["']/;
  // 方法签名
  const methodSigRegex = /(?:public|protected|private)\s+\S+\s+(\w+)\s*\(/;

  for (const file of files) {
    const content = readFile(file);
    if (!content) continue;
    // 检查是否是 Controller
    if (!/@(?:Rest)?Controller/.test(content)) continue;

    const classPathMatch = content.match(classPathRegex);
    const classPath = classPathMatch ? classPathMatch[1] : '';
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const mappingMatch = lines[i].match(methodMappingRegex);
      if (!mappingMatch) continue;

      const httpMethod = mappingMatch[1].toUpperCase();
      const methodPath = mappingMatch[2];
      const fullApiPath = (classPath + methodPath).replace(/\/\//g, '/');

      // 找方法名（往下找最近的方法签名）
      let methodName = '';
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const sigMatch = lines[j].match(methodSigRegex);
        if (sigMatch) { methodName = sigMatch[1]; break; }
      }

      // 提取类名
      const classMatch = content.match(/class\s+(\w+)/);
      const className = classMatch ? classMatch[1] : '';

      results.push({
        path: fullApiPath,
        httpMethod: httpMethod === 'REQUEST' ? 'ALL' : httpMethod,
        class: className,
        method: methodName,
        file: relativePath(file, rootPath),
        line: i + 1
      });
    }
  }
  return results;
}

// 2. MQ Consumer 扫描：@MqOrderlyListener / @MqListener / @RocketMQMessageListener
function scanMqConsumers(files, rootPath) {
  const results = [];
  const listenerRegex = /@(?:MqOrderlyListener|MqListener|RocketMQMessageListener)\s*\(/;
  const topicRegex = /topic\s*=\s*["']([^"']+)["']/;
  const tagRegex = /tag\s*=\s*["']([^"']+)["']/;
  const consumerGroupRegex = /consumerGroup\s*=\s*(?:["']([^"']+)["']|(\w+[\w.]*\w))/;
  const extendsRegex = /extends\s+AbstractMqListener\s*<\s*([\w<>,\s]+)\s*>/;
  const maxReconsumeRegex = /maxReconsumeTimes\s*=\s*(\d+)/;

  for (const file of files) {
    const content = readFile(file);
    if (!content) continue;
    if (!listenerRegex.test(content)) continue;

    const topicMatch = content.match(topicRegex);
    const tagMatch = content.match(tagRegex);
    const groupMatch = content.match(consumerGroupRegex);
    const extendsMatch = content.match(extendsRegex);
    const maxReconsumeMatch = content.match(maxReconsumeRegex);
    const classMatch = content.match(/class\s+(\w+)/);

    if (topicMatch) {
      results.push({
        topic: topicMatch[1],
        tag: tagMatch ? tagMatch[1] : '*',
        consumerGroup: groupMatch ? (groupMatch[1] || groupMatch[2]) : '',
        class: classMatch ? classMatch[1] : '',
        method: 'process',
        msgType: extendsMatch ? extendsMatch[1].trim() : '',
        maxReconsumeTimes: maxReconsumeMatch ? parseInt(maxReconsumeMatch[1]) : -1,
        file: relativePath(file, rootPath)
      });
    }
  }
  return results;
}

// 3. MQ Producer 调用点扫描
function scanMqProducers(files, rootPath) {
  const results = [];
  const sendRegex = /(\w+)\s*\.\s*(send|asyncSend|sendOneWay)\s*\(\s*(\w+)\s*,\s*(\w+)/;

  for (const file of files) {
    const content = readFile(file);
    if (!content) continue;
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(sendRegex);
      if (match) {
        results.push({
          producer: match[1],
          sendMethod: match[2],
          topicConstant: match[3],
          tagConstant: match[4],
          file: relativePath(file, rootPath),
          line: i + 1
        });
      }
    }
  }
  return results;
}

// 4. 常量定义扫描
function scanConstants(files, rootPath) {
  const constants = {};
  // 匹配 static final String 或 final String 常量
  const constRegex = /(?:static\s+)?(?:final\s+)?String\s+(\w+)\s*=\s*["']([^"']+)["']/g;
  // 也匹配 int/Integer 常量
  const intConstRegex = /(?:static\s+)?(?:final\s+)?(?:int|Integer)\s+(\w+)\s*=\s*(\d+)/g;

  for (const file of files) {
    const content = readFile(file);
    if (!content) continue;

    let match;
    while ((match = constRegex.exec(content)) !== null) {
      constants[match[1]] = {
        value: match[2],
        file: relativePath(file, rootPath)
      };
    }
    constRegex.lastIndex = 0;

    while ((match = intConstRegex.exec(content)) !== null) {
      constants[match[1]] = {
        value: match[2],
        file: relativePath(file, rootPath)
      };
    }
    intConstRegex.lastIndex = 0;
  }
  return constants;
}

// 5. Dubbo Facade 扫描
function scanDubboFacades(files, rootPath) {
  const results = [];
  const dubboRefRegex = /@DubboReference/;
  const fieldRegex = /(?:private|protected)\s+([\w<>,\s]+?)\s+(\w+)\s*;/;

  for (const file of files) {
    const content = readFile(file);
    if (!content) continue;
    if (!dubboRefRegex.test(content)) continue;

    const classMatch = content.match(/class\s+(\w+)/);
    const className = classMatch ? classMatch[1] : '';
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (!dubboRefRegex.test(lines[i])) continue;
      // 下一行是字段声明
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const fieldMatch = lines[j].match(fieldRegex);
        if (fieldMatch) {
          results.push({
            interface: fieldMatch[1].trim(),
            field: fieldMatch[2],
            facadeClass: className,
            file: relativePath(file, rootPath),
            line: j + 1
          });
          break;
        }
      }
    }
  }
  return results;
}

// 6. Spring EventListener 扫描
function scanEventListeners(files, rootPath) {
  const results = [];
  const listenerRegex = /@EventListener/;
  const methodRegex = /(?:public|protected|private)\s+\w+\s+(\w+)\s*\(\s*([\w<>]+)\s+\w+/;

  for (const file of files) {
    const content = readFile(file);
    if (!content) continue;
    if (!listenerRegex.test(content)) continue;

    const classMatch = content.match(/class\s+(\w+)/);
    const className = classMatch ? classMatch[1] : '';
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (!listenerRegex.test(lines[i])) continue;
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const methodMatch = lines[j].match(methodRegex);
        if (methodMatch) {
          results.push({
            eventType: methodMatch[2],
            class: className,
            method: methodMatch[1],
            file: relativePath(file, rootPath),
            line: j + 1
          });
          break;
        }
      }
    }
  }
  return results;
}

// 7. 定时任务扫描
function scanScheduledJobs(files, rootPath) {
  const results = [];
  // XianMu / SchedulerX
  const xianmuRegex = /extends\s+XianMuJavaProcessorV2/;
  // 标准 @Scheduled
  const scheduledRegex = /@Scheduled\s*\(/;
  // XXL-Job
  const xxlRegex = /@XxlJob\s*\(\s*["']([^"']+)["']/;

  for (const file of files) {
    const content = readFile(file);
    if (!content) continue;

    const classMatch = content.match(/class\s+(\w+)/);
    const className = classMatch ? classMatch[1] : '';

    if (xianmuRegex.test(content)) {
      results.push({
        type: 'XianMu/SchedulerX',
        class: className,
        file: relativePath(file, rootPath)
      });
    }

    if (scheduledRegex.test(content)) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (scheduledRegex.test(lines[i])) {
          const methodSig = lines.slice(i + 1, i + 4).join(' ');
          const methodMatch = methodSig.match(/(?:public|protected|private)\s+\w+\s+(\w+)\s*\(/);
          results.push({
            type: '@Scheduled',
            class: className,
            method: methodMatch ? methodMatch[1] : '',
            file: relativePath(file, rootPath),
            line: i + 1
          });
        }
      }
    }

    const xxlMatch = content.match(xxlRegex);
    if (xxlMatch) {
      results.push({
        type: 'XXL-Job',
        class: className,
        jobHandler: xxlMatch[1],
        file: relativePath(file, rootPath)
      });
    }
  }
  return results;
}

// --- 常量解析 ---

function resolveConstant(constantName, constants) {
  // 直接匹配
  if (constants[constantName]) {
    return constants[constantName];
  }
  // 带类名前缀：XxxConstants.STOCK_TASK → STOCK_TASK
  const parts = constantName.split('.');
  if (parts.length === 2) {
    return constants[parts[1]] || null;
  }
  return null;
}

// --- 主入口 ---

function parseArgs() {
  const args = process.argv.slice(2);
  const mode = args[0];
  if (mode === '--scan') return { mode: 'scan', projectPath: args[1] };
  if (mode === '--resolve-constant') return { mode: 'resolve', projectPath: args[1], constantName: args[2] };
  return { mode: null };
}

function main() {
  const { mode, projectPath, constantName } = parseArgs();

  if (!mode || !projectPath) {
    console.error('用法: node skill.js [--scan <path> | --resolve-constant <path> <name>]');
    process.exit(1);
  }

  const resolvedPath = path.resolve(projectPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`项目目录不存在: ${resolvedPath}`);
    process.exit(1);
  }

  console.error(`扫描项目: ${resolvedPath}`);
  const javaFiles = collectJavaFiles(resolvedPath);
  console.error(`找到 ${javaFiles.length} 个 Java 文件`);

  if (mode === 'scan') {
    const result = {
      projectPath: resolvedPath,
      fileCount: javaFiles.length,
      controllers: scanControllers(javaFiles, resolvedPath),
      mqConsumers: scanMqConsumers(javaFiles, resolvedPath),
      mqProducers: scanMqProducers(javaFiles, resolvedPath),
      constants: scanConstants(javaFiles, resolvedPath),
      dubboFacades: scanDubboFacades(javaFiles, resolvedPath),
      eventListeners: scanEventListeners(javaFiles, resolvedPath),
      scheduledJobs: scanScheduledJobs(javaFiles, resolvedPath)
    };

    console.error(`扫描完成: ${result.controllers.length} controllers, ${result.mqConsumers.length} consumers, ${result.mqProducers.length} producers, ${Object.keys(result.constants).length} constants, ${result.dubboFacades.length} dubbo facades, ${result.eventListeners.length} event listeners, ${result.scheduledJobs.length} jobs`);
    console.log(JSON.stringify(result, null, 2));
  } else if (mode === 'resolve') {
    const constants = scanConstants(javaFiles, resolvedPath);
    const resolved = resolveConstant(constantName, constants);
    if (resolved) {
      console.log(JSON.stringify(resolved));
    } else {
      console.error(`未找到常量: ${constantName}`);
      process.exit(1);
    }
  }
}

main();
