#!/usr/bin/env node
/**
 * 飞书文档写入工具
 *
 * 功能：根据Markdown内容创建飞书文档
 * 技术实现：使用飞书文件导入API
 *
 * 使用方式：
 *   node skill.js --title "文档标题" --markdown "Markdown内容"
 *
 * 流程：
 *   1. 保存Markdown到本地临时文件（容错）
 *   2. 上传文件到飞书云盘
 *   3. 创建文档导入任务
 *   4. 轮询任务状态直到完成
 *   5. 返回文档链接
 *
 * 容错机制：
 *   - 上传失败：保留本地文件，提示用户手动上传
 *   - 导入失败：保留本地文件，提示用户手动上传
 *   - 超时：保留本地文件，提示用户稍后查看
 */

const lark = require("@larksuiteoapi/node-sdk");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getUserAccessToken } = require("./feishu-token-manager");

// 使用内置公共应用凭证
const APP_ID = "cli_a9af30aa13395cb5";
const APP_SECRET = "UUdRNKo0cH7nk2QgxBbwec6jTLSk4Wj5";

// 配置飞书SDK客户端
const client = new lark.Client({
  appId: APP_ID,
  appSecret: APP_SECRET,
  disableTokenCache: false, // 启用SDK自动token管理
});

/**
 * 获取访问令牌（使用用户身份，自动触发授权）
 *
 * @returns {Promise<{token: string, type: 'user'}>}
 *          token: 用户token
 *          type: 令牌类型
 * @throws {Error} 获取token失败时抛出异常
 */
async function getAccessToken() {
  // 获取用户token（会自动处理刷新和重新授权）
  const userToken = await getUserAccessToken(APP_ID, APP_SECRET, true);

  if (userToken) {
    console.error("🔑 使用用户身份创建文档（文档将归属到您名下）");
    return { token: userToken, type: "user" };
  }

  // 如果获取失败（用户取消授权等情况）
  throw new Error("无法获取用户授权，请重试");
}

/**
 * 计算文件SHA256校验和
 *
 * @param {Buffer} fileBuffer - 文件内容
 * @returns {string} SHA256十六进制字符串
 */
function calculateSHA256(fileBuffer) {
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

/**
 * 上传文件到飞书云盘
 *
 * @param {string|null} token - 访问令牌（null表示使用SDK自动管理的应用token）
 * @param {string} filePath - 本地文件路径
 * @param {string} fileName - 上传后的文件名
 * @returns {Promise<string>} 飞书文件token
 * @throws {Error} 上传失败时抛出异常
 */
async function uploadFile(token, filePath, fileName) {
  try {
    console.error(`📤 正在上传文件: ${fileName}`);

    // 读取文件信息
    const fileStats = fs.statSync(filePath);
    const fileSize = fileStats.size;

    // 创建文件流（飞书SDK需要流式数据）
    const fileStream = fs.createReadStream(filePath);

    // 构造上传请求（不使用checksum参数）
    const requestConfig = {
      data: {
        file_name: fileName,
        parent_type: "explorer",
        parent_node: "", // 空字符串表示上传到个人空间根目录
        size: fileSize,
        file: fileStream, // 使用文件流而不是Buffer
      },
    };

    // 根据token类型选择认证方式
    let response;
    if (token) {
      // 使用用户token
      response = await client.drive.v1.file.uploadAll(
        requestConfig,
        lark.withUserAccessToken(token)
      );
    } else {
      // 使用应用token（SDK自动管理）
      response = await client.drive.v1.file.uploadAll(requestConfig);
    }

    // 检查响应
    // 飞书SDK的响应可能有不同的结构，优先检查data中是否有file_token
    const fileToken = response.data?.file_token || response.file_token;

    if (!fileToken) {
      throw new Error(
        `上传失败，未返回file_token: ${JSON.stringify(response)}`
      );
    }

    console.error(`✅ 文件上传成功，file_token: ${fileToken}`);
    return fileToken;
  } catch (error) {
    // 处理上传错误
    if (error.response) {
      const errData = error.response.data;
      throw new Error(
        `上传文件失败: ${errData.msg || JSON.stringify(errData)}`
      );
    }
    throw new Error(`上传文件失败: ${error.message}`);
  }
}

/**
 * 创建文档导入任务
 *
 * @param {string|null} token - 访问令牌
 * @param {string} fileToken - 上传后的文件token
 * @param {string} fileName - 文档名称
 * @returns {Promise<string>} 导入任务ticket（用于查询任务状态）
 * @throws {Error} 创建任务失败时抛出异常
 */
async function createImportTask(token, fileToken, fileName) {
  try {
    console.error("📝 正在创建文档导入任务...");

    // 使用axios直接调用API（不使用SDK）
    const response = await axios.post(
      "https://open.feishu.cn/open-apis/drive/v1/import_tasks",
      {
        file_extension: "md", // 文件扩展名
        file_token: fileToken, // 上传的文件token
        type: "docx", // 导入为飞书文档类型
        file_name: fileName, // 文档名称
        point: {
          mount_type: 1, // 挂载类型：1表示云空间
          mount_key: "", // 空字符串表示根目录
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    // 检查响应
    if (response.data.code === 0) {
      const ticket = response.data.data.ticket;
      console.error(`✅ 导入任务创建成功，ticket: ${ticket}`);
      return ticket;
    } else {
      throw new Error(
        `创建失败: ${response.data.msg} (code: ${response.data.code})`
      );
    }
  } catch (error) {
    // 处理创建任务错误
    if (error.response) {
      const errData = error.response.data;
      throw new Error(
        `创建导入任务失败: ${errData.msg || JSON.stringify(errData)}`
      );
    }
    throw new Error(`创建导入任务失败: ${error.message}`);
  }
}

/**
 * 查询导入任务状态
 *
 * @param {string|null} token - 访问令牌
 * @param {string} ticket - 任务ticket
 * @returns {Promise<Object>} 任务结果
 *   - status: 任务状态（0:成功, 1:处理中, 2:失败）
 *   - token: 文档token（成功时返回）
 *   - url: 文档URL（成功时返回）
 *   - errorMsg: 错误信息（失败时返回）
 * @throws {Error} 查询失败时抛出异常
 */
async function getImportTaskStatus(token, ticket) {
  try {
    // 使用axios直接调用API（不使用SDK）
    const response = await axios.get(
      `https://open.feishu.cn/open-apis/drive/v1/import_tasks/${ticket}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    // 检查响应
    if (response.data.code === 0) {
      const result = response.data.data.result;

      // 输出完整响应用于调试（仅在失败或成功时）
      if (result.job_status === 0 || result.job_status === 2) {
        console.error(`🔍 完整响应: ${JSON.stringify(response.data, null, 2)}`);
      }

      return {
        status: result.job_status, // 0:成功, 1:处理中, 2:失败
        token: result.token, // 文档token
        url: result.url, // 文档URL
        errorMsg: result.job_error_msg, // 错误信息
        extra: result.extra, // 额外信息
        type: result.type, // 文档类型
      };
    } else {
      throw new Error(
        `查询失败: ${response.data.msg} (code: ${response.data.code})`
      );
    }
  } catch (error) {
    // 处理查询错误
    if (error.response) {
      const errData = error.response.data;
      throw new Error(
        `查询任务失败: ${errData.msg || JSON.stringify(errData)}`
      );
    }
    throw new Error(`查询任务失败: ${error.message}`);
  }
}

/**
 * 轮询导入任务直到完成或超时
 *
 * @param {string|null} token - 访问令牌
 * @param {string} ticket - 任务ticket
 * @param {number} maxWaitSeconds - 最大等待时间（秒），默认30秒
 * @returns {Promise<Object>} 任务最终结果
 * @throws {Error} 任务失败或超时时抛出异常
 */
async function pollImportTask(token, ticket, maxWaitSeconds = 30) {
  console.error(`⏳ 等待文档导入完成（最多等待${maxWaitSeconds}秒）...`);

  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;
  let attempts = 0;

  while (Date.now() - startTime < maxWaitMs) {
    attempts++;

    try {
      // 查询任务状态
      const result = await getImportTaskStatus(token, ticket);

      // 输出调试信息（仅在第一次或每3次）
      if (attempts === 1 || attempts % 3 === 0) {
        console.error(`📊 任务状态: ${JSON.stringify(result)}`);
      }

      if (result.status === 0) {
        // 成功
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        console.error(`✅ 文档导入成功！（耗时 ${elapsedSeconds} 秒）`);
        return result;
      } else if (result.status === 2) {
        // status=2可能是失败，也可能是任务刚创建还未开始处理
        // 只有在超过5秒后仍然是status=2才认为是真正失败
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        if (elapsedSeconds >= 5 && result.errorMsg) {
          // 5秒后仍失败，且有错误消息，认为是真正失败
          const extraInfo =
            result.extra && result.extra.length > 0
              ? ` | 额外信息: ${JSON.stringify(result.extra)}`
              : "";
          throw new Error(`文档导入失败: ${result.errorMsg}${extraInfo}`);
        }
        // 否则继续等待
        if (attempts % 3 === 0) {
          console.error(`⏳ 任务处理中... (已等待 ${elapsedSeconds} 秒)`);
        }
      }

      // 处理中，显示进度提示
      if (attempts % 3 === 0) {
        console.error(`⏳ 仍在处理中... (已查询 ${attempts} 次)`);
      }

      // 等待1秒后重试
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      throw error;
    }
  }

  // 超时
  throw new Error(
    `文档导入超时（超过${maxWaitSeconds}秒），任务可能仍在后台处理中，请稍后在飞书中查看`
  );
}

/**
 * 保存Markdown内容到本地临时文件
 *
 * @param {string} markdown - Markdown内容
 * @param {string} title - 文档标题（用于生成文件名）
 * @returns {string} 临时文件的完整路径
 */
function saveMarkdownToTempFile(markdown, title) {
  const timestamp = Date.now();
  // 清理标题，只保留中英文数字，其他字符替换为下划线
  const safeTitle = title
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_")
    .substring(0, 50);
  const fileName = `feishu_doc_${safeTitle}_${timestamp}.md`;
  const tempDir = "/tmp";
  const filePath = path.join(tempDir, fileName);

  fs.writeFileSync(filePath, markdown, "utf-8");
  console.error(`📁 Markdown内容已保存到本地: ${filePath}`);

  return filePath;
}

/**
 * 主处理函数：创建飞书文档
 *
 * @param {string} title - 文档标题
 * @param {string} markdownContent - Markdown内容
 * @param {string|null} sourceFile - 源文件路径（--file模式下直接使用，无需备份）
 */
async function createFeishuDocument(title, markdownContent, sourceFile = null) {
  let tempFilePath = null;
  let filePath = null;

  try {
    // 步骤1: 确定上传文件路径
    if (sourceFile) {
      // --file 模式：直接使用原始文件，无需备份到 /tmp
      filePath = sourceFile;
      console.error(`📁 使用原始文件: ${filePath}`);
    } else {
      // --markdown 模式：保存到临时文件（容错）
      tempFilePath = saveMarkdownToTempFile(markdownContent, title);
      filePath = tempFilePath;
    }

    // 步骤2: 获取访问令牌
    console.error("🔑 正在获取访问令牌...");
    const { token, type } = await getAccessToken();

    // 步骤3: 上传文件到飞书云盘
    const fileToken = await uploadFile(token, filePath, `${title}.md`);

    // 等待2秒，确保文件上传完全生效
    console.error("⏳ 等待文件上传生效...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 步骤4: 创建文档导入任务
    // 注意：file_name 不要包含扩展名，扩展名由 file_extension 指定
    const ticket = await createImportTask(token, fileToken, title);

    // 步骤5: 轮询任务状态直到完成
    const result = await pollImportTask(token, ticket, 30);

    // 步骤6: 成功，输出结果
    const documentUrl =
      result.url || `https://summerfarm.feishu.cn/docx/${result.token}`;

    console.error("");
    console.error("✅ 飞书文档创建成功！");

    // --markdown 模式下，上传成功后删除临时文件
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.error(`🗑️  已清理临时文件: ${tempFilePath}`);
      } catch (e) {
        console.error(`⚠️  清理临时文件失败: ${e.message}`);
      }
    }

    console.error("");

    // 构建结果对象（成功时不再输出 localFile，因为已删除）
    const resultObj = {
      success: true,
      documentId: result.token,
      documentUrl: documentUrl,
      title: title,
    };

    // 输出JSON格式结果（供Claude Code命令捕获）
    console.log(JSON.stringify(resultObj));
  } catch (error) {
    // 失败处理
    console.error("");
    console.error(`❌ 文档创建失败: ${error.message}`);
    console.error("");

    // 仅在 --markdown 模式下（有临时文件）提供手动上传指引
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      console.error("💡 本地Markdown文件已保存，您可以手动上传到飞书:");
      console.error(`   📁 文件路径: ${tempFilePath}`);
      console.error("");
      console.error("   📤 手动上传步骤:");
      console.error("   1. 打开飞书客户端或网页版");
      console.error('   2. 进入"云文档"');
      console.error('   3. 点击"上传"按钮');
      console.error("   4. 选择上述Markdown文件");
      console.error("   5. 飞书会自动将Markdown转换为文档格式");
      console.error("");
    } else if (sourceFile) {
      // --file 模式下，提示用户原始文件位置
      console.error("💡 您可以手动上传原始文件到飞书:");
      console.error(`   📁 文件路径: ${sourceFile}`);
      console.error("");
    }

    // 构建错误结果对象
    const errorObj = {
      success: false,
      error: error.message,
    };

    // 仅在 --markdown 模式下输出 localFile
    if (tempFilePath) {
      errorObj.localFile = tempFilePath;
    }

    // 输出JSON格式错误结果
    console.log(JSON.stringify(errorObj));

    process.exit(1);
  }
}

/**
 * 解析命令行参数
 *
 * @returns {{title: string, markdown: string, sourceFile: string|null}} 解析后的参数
 *   - sourceFile: 如果使用 --file 模式，返回原始文件路径；否则为 null
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let title = "";
  let markdown = "";
  let file = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--title" && i + 1 < args.length) {
      title = args[i + 1];
      i++;
    } else if (args[i] === "--markdown" && i + 1 < args.length) {
      markdown = args[i + 1];
      i++;
    } else if (args[i] === "--file" && i + 1 < args.length) {
      file = args[i + 1];
      i++;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
飞书文档写入工具

使用方法:
  node skill.js --title "文档标题" --file "/path/to/file.md"    (推荐)
  node skill.js --title "文档标题" --markdown "Markdown内容"

参数说明:
  --title      文档标题（必填）
  --file       本地 Markdown 文件路径（推荐，与 --markdown 二选一）
  --markdown   Markdown 格式的内容（与 --file 二选一）
  --help, -h   显示此帮助信息

使用示例:
  node skill.js --title "技术方案" --file "/tmp/design.md"
  node skill.js --title "技术方案" --markdown "# 标题\\n\\n这是内容"

技术特点:
  ✅ 使用飞书文件导入API
  ✅ 失败时保留本地Markdown文件
  ✅ 支持用户身份和应用身份
  ✅ 自动轮询等待导入完成
      `);
      process.exit(0);
    }
  }

  // 如果指定了 --file 参数，读取文件内容并记录源文件路径
  if (file) {
    if (!fs.existsSync(file)) {
      console.error(`❌ 错误: 文件不存在: ${file}`);
      process.exit(1);
    }
    markdown = fs.readFileSync(file, "utf-8");
    console.error(`📄 已读取文件: ${file}`);
    return { title, markdown, sourceFile: file };
  }

  return { title, markdown, sourceFile: null };
}

// ============ 主入口 ============
(async () => {
  const { title, markdown, sourceFile } = parseArgs();

  // 参数校验
  if (!title || !markdown) {
    console.error("❌ 错误: 缺少必要参数");
    console.error("");
    console.error("使用方法:");
    console.error(
      '  node skill.js --title "文档标题" --file "/path/to/file.md"  (推荐)'
    );
    console.error(
      '  node skill.js --title "文档标题" --markdown "Markdown内容"'
    );
    console.error("");
    console.error("使用 --help 查看详细帮助");
    process.exit(1);
  }

  // 执行文档创建
  await createFeishuDocument(title, markdown, sourceFile);
})();
