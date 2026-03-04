#!/usr/bin/env node
/**
 * 飞书文档转Markdown Skill脚本 (Node.js版)
 *
 * 此脚本作为 Claude Code Skills 的实现，用于将飞书文档转换为 Markdown 格式。
 * 使用 Node.js 实现，完全依赖 Claude Code 内置环境，无需用户额外安装。
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { URL } = require('url');
const { getUserAccessToken } = require('./feishu-token-manager');

// 使用内置公共应用凭证
const APP_ID = 'cli_a9af30aa13395cb5';
const APP_SECRET = 'UUdRNKo0cH7nk2QgxBbwec6jTLSk4Wj5';

/**
 * 获取access_token（仅使用用户身份）
 *
 * @param {string} appId - 飞书应用 ID
 * @param {string} appSecret - 飞书应用密钥
 * @returns {Promise<{token: string, type: 'user'}>} access_token和类型
 */
async function getAccessToken(appId, appSecret) {
  // 尝试获取用户token
  try {
    const userToken = await getUserAccessToken(appId, appSecret);
    if (userToken) {
      console.log('🔑 使用用户身份访问');
      return { token: userToken, type: 'user' };
    }
  } catch (error) {
    // 用户token获取失败，抛出简化的错误信息
    console.error('🔄 授权已过期，需要重新授权');
    throw new Error('AUTH_EXPIRED');
  }

  // 如果返回了空token
  throw new Error('用户授权失败，请运行 feishu-auth.js 进行授权');
}

/**
 * 从 URL 提取 token 和类型
 *
 * @param {string} url - 飞书文档URL
 * @returns {{token: string, objType: string}} token 和文档类型
 */
function extractTokenFromUrl(url) {
  // 清理URL（移除末尾的#号等）
  const cleanUrl = url.split('#')[0].trim();

  try {
    const parsedUrl = new URL(cleanUrl);
    const pathParts = parsedUrl.pathname.split('/').filter(p => p);

    if (!pathParts.length) {
      throw new Error('URL路径为空');
    }

    // 知识库节点：https://summerfarm.feishu.cn/wiki/IQdywe11Gi437gkMgpScEyxtnld
    if (parsedUrl.hostname.includes('feishu') && pathParts[0] === 'wiki' && pathParts.length >= 2) {
      return { token: pathParts[1], objType: 'wiki' };
    }

    // 旧版文档：https://sample.feishu.cn/docs/2olt0Ts4Mds7j7iqzdwrqEUnO7q
    if (pathParts[0] === 'docs' && pathParts.length >= 2) {
      return { token: pathParts[1], objType: 'doc' };
    }

    // 新版文档：https://sample.feishu.cn/docx/UXEAd6cRUoj5pexJZr0cdwaFnpd
    if (pathParts[0] === 'docx' && pathParts.length >= 2) {
      return { token: pathParts[1], objType: 'docx' };
    }

    throw new Error(`无法从URL中提取token，请检查URL格式: ${url}`);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`无效的URL格式: ${url}`);
    }
    throw error;
  }
}

/**
 * 获取节点信息
 *
 * @param {string} accessToken - tenant_access_token
 * @param {string} token - 从URL中提取的token
 * @param {string} objType - 文档类型 (wiki/doc/docx)
 * @returns {Promise<Object>} 节点信息
 */
async function getNodeInfo(accessToken, token, objType) {
  try {
    const response = await axios.get(
      'https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node',
      {
        params: {
          obj_type: objType,
          token: token
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 10000
      }
    );

    if (response.data.code === 0) {
      const nodeInfo = response.data.data?.node;
      if (nodeInfo) {
        return nodeInfo;
      } else {
        throw new Error('响应中未找到节点信息');
      }
    } else {
      throw new Error(`获取节点信息失败: ${response.data.msg}`);
    }
  } catch (error) {
    if (error.response) {
      throw new Error(`请求失败: ${error.response.status} - ${error.response.statusText}`);
    } else if (error.request) {
      throw new Error(`请求失败: 网络错误`);
    } else {
      throw new Error(`请求失败: ${error.message}`);
    }
  }
}

/**
 * 获取文档的所有块内容
 *
 * @param {string} accessToken - tenant_access_token
 * @param {string} objToken - 文档的obj_token
 * @returns {Promise<Object>} 文档块数据
 */
async function getDocumentBlocks(accessToken, objToken) {
  try {
    const response = await axios.get(
      `https://open.feishu.cn/open-apis/docx/v1/documents/${objToken}/blocks`,
      {
        params: {
          document_revision_id: -1,  // -1表示最新版本
          page_size: 500  // 获取500个块
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 30000
      }
    );

    if (response.data.code === 0) {
      return response.data;
    } else {
      throw new Error(`获取文档块失败: ${response.data.msg} (code: ${response.data.code})`);
    }
  } catch (error) {
    if (error.response) {
      const errorData = error.response.data ? JSON.stringify(error.response.data) : '';
      throw new Error(`请求失败: ${error.response.status} - ${error.response.statusText}\n详情: ${errorData}`);
    } else if (error.request) {
      throw new Error(`请求失败: 网络错误`);
    } else {
      throw new Error(`请求失败: ${error.message}`);
    }
  }
}

/**
 * 下载图片并转换为base64
 *
 * @param {string} accessToken - tenant_access_token
 * @param {string} imageToken - 图片的token
 * @returns {Promise<{base64: string, mimeType: string}>} base64编码的图片数据和MIME类型
 */
async function downloadImageAsBase64(accessToken, imageToken) {
  try {
    const response = await axios.get(
      `https://open.feishu.cn/open-apis/drive/v1/medias/${imageToken}/download`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );

    // 获取内容类型
    const contentType = response.headers['content-type'] || 'image/png';

    // 转换为base64
    const base64 = Buffer.from(response.data).toString('base64');

    return {
      base64: base64,
      mimeType: contentType
    };
  } catch (error) {
    // 下载失败时返回null，不中断整个流程
    console.error(`⚠️  图片下载失败 (token: ${imageToken}): ${error.message}`);
    return null;
  }
}

/**
 * 从 elements 数组中提取文本内容
 *
 * @param {Array} elements - 元素数组
 * @returns {string} 提取的文本内容
 */
function extractTextFromElements(elements) {
  if (!elements || !Array.isArray(elements)) {
    return '';
  }

  const textParts = [];

  for (const element of elements) {
    if (!element || typeof element !== 'object') {
      continue;
    }

    // 处理text_run元素
    if (element.text_run && typeof element.text_run === 'object') {
      const content = element.text_run.content || '';
      if (content) {
        textParts.push(content);
      }
    }

    // 处理mention_doc元素（文档引用）
    if (element.mention_doc && typeof element.mention_doc === 'object') {
      const title = element.mention_doc.title || '';
      if (title) {
        textParts.push(`[${title}]`);
      }
    }
  }

  return textParts.join('');
}

/**
 * 从块中提取文本内容
 *
 * @param {Object} block - 单个块数据
 * @param {Object} options - 可选配置
 * @param {boolean} options.withImages - 是否包含图片
 * @param {string} options.accessToken - access token（用于下载图片）
 * @returns {Promise<string>} 提取的文本内容
 */
async function extractTextFromBlock(block, options = {}) {
  const { withImages = false, accessToken = null } = options;
  const blockType = block.block_type;

  // 处理页面标题（block_type=1）
  if (blockType === 1) {
    const pageData = block.page || {};
    if (pageData) {
      return extractTextFromElements(pageData.elements || []);
    }
  }

  // 处理标题2（block_type=4）
  if (blockType === 4) {
    const headingData = block.heading2 || {};
    if (headingData) {
      return extractTextFromElements(headingData.elements || []);
    }
  }

  // 处理标题3（block_type=5）
  if (blockType === 5) {
    const headingData = block.heading3 || {};
    if (headingData) {
      return extractTextFromElements(headingData.elements || []);
    }
  }

  // 处理文本块（block_type=2）
  if (blockType === 2) {
    const textData = block.text || {};
    if (textData) {
      return extractTextFromElements(textData.elements || []);
    }
  }

  // 处理代码块（block_type=14）
  if (blockType === 14) {
    const codeData = block.code || {};
    if (codeData) {
      return extractTextFromElements(codeData.elements || []);
    }
  }

  // 处理有序列表（block_type=13）
  if (blockType === 13) {
    const orderedData = block.ordered || {};
    if (orderedData) {
      return extractTextFromElements(orderedData.elements || []);
    }
  }

  // 处理无序列表（block_type=12）
  if (blockType === 12) {
    const bulletData = block.bullet || {};
    if (bulletData) {
      return extractTextFromElements(bulletData.elements || []);
    }
  }

  // 处理图片（block_type=27）
  if (blockType === 27) {
    if (withImages && accessToken) {
      // 尝试下载图片并转换为base64
      const imageData = block.image || {};
      const imageToken = imageData.token;

      if (imageToken) {
        const imageResult = await downloadImageAsBase64(accessToken, imageToken);
        if (imageResult) {
          // 返回base64格式的图片（Claude支持的格式）
          return `![image](data:${imageResult.mimeType};base64,${imageResult.base64})`;
        }
      }
    }
    // 默认返回占位符
    return '[图片]';
  }

  // 处理分割线（block_type=22）
  if (blockType === 22) {
    return '---';
  }

  // 处理插件块（block_type=40）- 如流程图等
  if (blockType === 40) {
    const addOns = block.add_ons || {};
    if (addOns) {
      // 尝试提取Mermaid图表数据
      const record = addOns.record || '';
      if (record) {
        try {
          const recordData = JSON.parse(record);
          const mermaidData = recordData.data || '';
          if (mermaidData) {
            return `\`\`\`mermaid\n${mermaidData}\n\`\`\``;
          }
        } catch (e) {
          // 解析失败，返回占位符
        }
      }
      return '[图表]';
    }
  }

  return '';
}

/**
 * 解析文档块内容为Markdown格式
 *
 * @param {Object} blocksData - 文档块数据
 * @param {Object} options - 可选配置
 * @param {boolean} options.withImages - 是否包含图片
 * @param {string} options.accessToken - access token（用于下载图片）
 * @returns {Promise<string>} 解析后的Markdown内容
 */
async function parseBlocksContent(blocksData, options = {}) {
  const { withImages = false, accessToken = null } = options;

  if (!blocksData || !blocksData.data) {
    return '无内容';
  }

  const items = blocksData.data.items || [];
  if (!items.length) {
    return '无内容块';
  }

  const contentParts = [];
  let lastBlockType = null;

  for (const item of items) {
    const blockType = item.block_type;
    const blockText = await extractTextFromBlock(item, { withImages, accessToken });

    if (!blockText) {
      continue;
    }

    // 根据块类型添加Markdown格式
    switch (blockType) {
      case 1:  // 页面标题
        contentParts.push(`# ${blockText}`);
        break;
      case 3:  // 标题1
        contentParts.push(`# ${blockText}`);
        break;
      case 4:  // 标题2
        contentParts.push(`## ${blockText}`);
        break;
      case 5:  // 标题3
        contentParts.push(`### ${blockText}`);
        break;
      case 2:  // 文本段落
        contentParts.push(blockText);
        break;
      case 13: // 有序列表
        contentParts.push(`1. ${blockText}`);
        break;
      case 12: // 无序列表
        contentParts.push(`- ${blockText}`);
        break;
      case 14: // 代码块
        {
          const codeData = item.code || {};
          const language = codeData.style?.language;
          const langMap = {
            49: 'python',
            56: 'sql',
            1: 'text'
          };
          const codeLang = langMap[language] || '';
          contentParts.push(`\`\`\`${codeLang}\n${blockText}\n\`\`\``);
        }
        break;
      case 40: // Mermaid图表
        contentParts.push(blockText);
        break;
      case 27: // 图片
        contentParts.push(blockText);
        break;
      case 22: // 分割线
        contentParts.push('---');
        break;
      default:
        contentParts.push(blockText);
    }

    lastBlockType = blockType;
  }

  // 添加适当的空行分隔
  const formattedParts = [];
  for (let i = 0; i < contentParts.length; i++) {
    const part = contentParts[i];
    formattedParts.push(part);

    // 在标题、代码块、图表后添加空行
    if (i < contentParts.length - 1) {
      const currentPart = part.trim();

      // 如果当前部分是标题或代码块，添加空行
      if (currentPart.startsWith('#') ||
        currentPart.startsWith('```') ||
        currentPart.includes('```mermaid') ||
        currentPart === '---') {
        formattedParts.push('');
      }
    }
  }

  return formattedParts.join('\n');
}

/**
 * 处理飞书文档并转换为Markdown
 *
 * @param {string} url - 飞书文档URL
 * @param {string} appId - 飞书应用ID
 * @param {string} appSecret - 飞书应用密钥
 * @param {Object} options - 可选配置
 * @param {boolean} options.noSave - 是否不保存文件，只返回内容
 * @param {boolean} options.withImages - 是否包含图片（需要多模态模型支持）
 * @returns {Promise<{success: boolean, output: string, title: string, error: string}>}
 */
async function processFeishuDocument(url, appId, appSecret, options = {}) {
  const { noSave = false, withImages = false } = options;
  try {
    // 1. 从URL提取token和类型
    const { token, objType } = extractTokenFromUrl(url);
    console.log('📄 正在解析 URL...');

    // 2. 获取access_token（优先用户身份）
    const { token: accessToken, type: tokenType } = await getAccessToken(appId, appSecret);

    let objToken = token;
    let title = '未知标题';

    // 3. 对于wiki类型，需要获取节点信息；对于docx类型，直接使用token作为objToken
    if (objType === 'wiki') {
      console.log('📋 正在获取文档信息...');
      const nodeInfo = await getNodeInfo(accessToken, token, objType);
      objToken = nodeInfo.obj_token;
      title = nodeInfo.title || '未知标题';

      if (!objToken) {
        throw new Error('节点信息中未找到obj_token');
      }
    } else {
      // 对于docx类型，token就是objToken
      console.log('📋 文档类型: docx，直接使用token...');
    }

    console.log(`   文档标题: ${title}`);

    // 4. 获取文档块内容
    console.log('📦 正在获取文档内容...');
    const blocksData = await getDocumentBlocks(accessToken, objToken);

    // 5. 解析内容
    if (withImages) {
      console.log('🖼️  图片读取已启用（适用于多模态模型）');
    }
    const content = await parseBlocksContent(blocksData, { withImages, accessToken });

    if (noSave) {
      // 不保存模式：只打印内容到stdout
      console.log(content);
      return {
        success: true,
        output: content,
        title: title,
        error: ''
      };
    } else {
      // 默认模式：保存文件
      // 先保存原始JSON数据到文件
      const jsonOutputFile = `${title.replace(/ /g, '_')}_raw.json`;
      await fs.writeFile(jsonOutputFile, JSON.stringify(blocksData, null, 2), 'utf8');

      // 保存解析后的内容到Markdown文件
      const outputFile = `${title.replace(/ /g, '_')}_content.md`;
      await fs.writeFile(outputFile, content, 'utf8');

      // 直接打印文件内容
      console.log('\n' + '#'.repeat(10) + ` ${outputFile}文件的内容: ` + '#'.repeat(10));
      console.log(content);
      console.log('#'.repeat(10) + ' Markdown内容已经展示完毕 ' + '#'.repeat(10) + '\n');

      const successMsg = `文档已成功转换并保存到以下文件：\n1. 原始JSON数据: ${jsonOutputFile}\n2. Markdown内容: ${outputFile}`;
      console.log(successMsg);

      return {
        success: true,
        output: successMsg,
        title: title,
        error: ''
      };
    }
  } catch (error) {
    const errorMsg = `处理过程中发生错误: ${error.message}`;
    console.error(`❌ ${errorMsg}`);
    return {
      success: false,
      output: '',
      error: errorMsg
    };
  }
}

/**
 * 解析命令行参数
 * @returns {{url: string|null, noSave: boolean, withImages: boolean}}
 */
function parseArguments() {
  const args = process.argv.slice(2);
  let url = null;
  let noSave = false;
  let withImages = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--no-save') {
      noSave = true;
    } else if (args[i] === '--with-images') {
      withImages = true;
    } else if (!url && !args[i].startsWith('--')) {
      url = args[i];
    }
  }

  return { url, noSave, withImages };
}

/**
 * 主函数
 */
async function main() {
  // 解析命令行参数
  const { url, noSave, withImages } = parseArguments();

  // 检查命令行参数
  if (!url) {
    console.error('用法: node skill.js [--no-save] [--with-images] <飞书URL>');
    console.error('示例: node skill.js https://summerfarm.feishu.cn/wiki/IQdywe11Gi437gkMgpScEyxtnld');
    console.error('      node skill.js --no-save https://summerfarm.feishu.cn/wiki/IQdywe11Gi437gkMgpScEyxtnld');
    console.error('      node skill.js --with-images https://summerfarm.feishu.cn/wiki/IQdywe11Gi437gkMgpScEyxtnld');
    process.exit(1);
  }

  // 检查应用配置
  if (!APP_ID || !APP_SECRET) {
    console.error('错误：飞书应用配置异常，请检查应用权限设置。');
    process.exit(1);
  }

  // 处理文档
  const result = await processFeishuDocument(url, APP_ID, APP_SECRET, { noSave, withImages });

  if (!result.success) {
    process.exit(1);
  }
}

// 主入口
if (require.main === module) {
  main().catch(error => {
    console.error(`❌ 未预期的错误: ${error.message}`);
    process.exit(1);
  });
}

// 导出函数供测试使用
module.exports = {
  processFeishuDocument,
  extractTokenFromUrl,
  getNodeInfo,
  getDocumentBlocks,
  parseBlocksContent
};
