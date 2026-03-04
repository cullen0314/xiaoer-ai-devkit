#!/usr/bin/env node
/**
 * 飞书OAuth授权脚本 - 一键授权
 *
 * 使用方式：node feishu-auth.js
 *
 * 功能：
 * 1. 启动本地HTTP服务器监听回调
 * 2. 自动打开浏览器跳转到飞书授权页面
 * 3. 用户授权后自动获取并保存token
 */

const http = require('http');
const url = require('url');
const axios = require('axios');
const { saveUserToken } = require('./feishu-token-manager');
const { exec } = require('child_process');
const { platform } = require('os');

// 飞书应用配置 (使用内置公共应用凭证)
const APP_ID = 'cli_a9af30aa13395cb5';
const APP_SECRET = 'UUdRNKo0cH7nk2QgxBbwec6jTLSk4Wj5';

// 回调地址配置（需要在飞书应用后台配置）
const REDIRECT_URI = 'http://localhost:3000/callback';
const PORT = 3000;

/**
 * 跨平台打开浏览器
 *
 * @param {string} url - 要打开的URL
 */
function openBrowser(url) {
  const os = platform();
  let command;

  switch (os) {
    case 'darwin': // macOS
      command = `open "${url}"`;
      break;
    case 'win32': // Windows
      command = `start "" "${url}"`;
      break;
    default: // Linux等
      command = `xdg-open "${url}"`;
      break;
  }

  exec(command, (error) => {
    if (error) {
      console.error('无法自动打开浏览器，请手动访问以下URL：');
      console.error(url);
    }
  });
}

/**
 * 生成授权URL
 *
 * @returns {string} 授权URL
 */
function generateAuthUrl() {
  const params = new URLSearchParams({
    app_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'wiki:wiki:readonly docx:document drive:drive drive:file drive:file:upload', // 请求的权限范围：wiki读取 + 文档读写 + 云空间完整权限
    state: Math.random().toString(36).substring(7) // 防CSRF攻击
  });

  return `https://open.feishu.cn/open-apis/authen/v1/authorize?${params.toString()}`;
}

/**
 * 使用授权码交换access_token
 *
 * @param {string} code - 授权码
 * @returns {Promise<Object>} token数据
 */
async function exchangeCodeForToken(code) {
  try {
    const response = await axios.post(
      'https://open.feishu.cn/open-apis/authen/v1/access_token',
      {
        grant_type: 'authorization_code',
        code: code,
        app_id: APP_ID,
        app_secret: APP_SECRET
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.error('飞书API响应:', JSON.stringify(response.data, null, 2));

    if (response.data.code === 0) {
      return {
        access_token: response.data.data.access_token,
        refresh_token: response.data.data.refresh_token,
        expires_in: response.data.data.expires_in
      };
    } else {
      throw new Error(`获取token失败: ${response.data.msg} (code: ${response.data.code})`);
    }
  } catch (error) {
    if (error.response) {
      console.error('错误响应:', JSON.stringify(error.response.data, null, 2));
      throw new Error(`请求失败: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * 启动HTTP服务器监听回调
 */
async function startAuthServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const parsedUrl = url.parse(req.url, true);

      if (parsedUrl.pathname === '/callback') {
        const code = parsedUrl.query.code;
        const error = parsedUrl.query.error;

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>授权失败</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .error { color: red; }
              </style>
            </head>
            <body>
              <h1 class="error">❌ 授权失败</h1>
              <p>错误信息: ${error}</p>
              <p>请关闭此窗口并重试</p>
            </body>
            </html>
          `);

          server.close();
          reject(new Error(`授权失败: ${error}`));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('缺少授权码');
          server.close();
          reject(new Error('缺少授权码'));
          return;
        }

        try {
          console.log('🔄 正在交换授权码...');
          const tokenData = await exchangeCodeForToken(code);

          console.log('💾 正在保存token...');
          await saveUserToken(tokenData);

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>授权成功</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .success { color: green; }
              </style>
            </head>
            <body>
              <h1 class="success">✅ 授权成功！</h1>
              <p>您可以关闭此窗口了</p>
              <p>现在可以使用飞书文档读写功能</p>
            </body>
            </html>
          `);

          server.close();
          resolve(tokenData);
        } catch (error) {
          console.error(`❌ 获取token失败: ${error.message}`);

          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>获取Token失败</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .error { color: red; }
              </style>
            </head>
            <body>
              <h1 class="error">❌ 获取Token失败</h1>
              <p>${error.message}</p>
              <p>请关闭此窗口并重试</p>
            </body>
            </html>
          `);

          server.close();
          reject(error);
        }
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(PORT, () => {
      console.log(`🚀 授权服务器已启动: http://localhost:${PORT}`);
    });

    server.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * 主函数
 */
async function main() {
  console.log('='.repeat(60));
  console.log('飞书OAuth授权工具');
  console.log('='.repeat(60));
  console.log('');

  try {
    // 1. 启动本地服务器
    console.log('📡 正在启动授权服务器...');
    const serverPromise = startAuthServer();

    // 2. 等待1秒确保服务器启动
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. 生成授权URL并打开浏览器
    const authUrl = generateAuthUrl();
    console.log('🌐 正在打开浏览器...');
    console.log(`授权URL: ${authUrl}`);
    console.log('');
    console.log('⏳ 等待授权...');
    console.log('   请在浏览器中完成授权操作');
    console.log('');

    openBrowser(authUrl);

    // 4. 等待授权完成
    await serverPromise;

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ 授权完成！');
    console.log('='.repeat(60));
    console.log('');
    console.log('现在您可以使用以下功能：');
    console.log('  • 读取飞书文档（包括私有文档）');
    console.log('  • 创建和编辑飞书文档');
    console.log('');
    console.log('Token会自动管理，无需手动配置');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ 授权失败');
    console.error('='.repeat(60));
    console.error(`错误: ${error.message}`);
    console.error('');
    console.error('常见问题：');
    console.error('  1. 确保在飞书应用后台配置了回调地址:');
    console.error(`     ${REDIRECT_URI}`);
    console.error('  2. 确保应用已启用OAuth功能');
    console.error('  3. 确保端口 ${PORT} 未被占用');
    console.error('');

    process.exit(1);
  }
}

// 主入口
if (require.main === module) {
  main();
}

/**
 * 执行完整的授权流程（可被其他模块调用）
 *
 * @returns {Promise<Object>} token数据
 */
async function runAuthFlow() {
  console.log('');
  console.log('🔐 需要重新授权飞书账号...');
  console.log('');

  // 1. 启动本地服务器
  console.log('📡 正在启动授权服务器...');
  const serverPromise = startAuthServer();

  // 2. 等待1秒确保服务器启动
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 3. 生成授权URL并打开浏览器
  const authUrl = generateAuthUrl();
  console.log('🌐 正在打开浏览器...');
  console.log(`授权URL: ${authUrl}`);
  console.log('');
  console.log('⏳ 等待授权...');
  console.log('   请在浏览器中完成授权操作');
  console.log('');

  openBrowser(authUrl);

  // 4. 等待授权完成
  const tokenData = await serverPromise;

  console.log('');
  console.log('✅ 授权成功！');
  console.log('');

  return tokenData;
}

module.exports = {
  generateAuthUrl,
  exchangeCodeForToken,
  startAuthServer,
  runAuthFlow
};
