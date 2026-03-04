#!/usr/bin/env node
/**
 * 飞书Token管理模块 - 跨平台兼容
 *
 * 提供用户身份token的存储、读取、刷新功能
 * 支持 Windows、macOS、Linux
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// 跨平台获取用户主目录
function getHomeDir() {
  // os.homedir() 在所有平台都能正确返回用户目录
  // Windows: C:\Users\username
  // macOS: /Users/username
  // Linux: /home/username
  return os.homedir();
}

// 获取凭证文件路径
function getCredentialsPath() {
  const homeDir = getHomeDir();
  const feishuDir = path.join(homeDir, '.feishu');
  const credentialsFile = path.join(feishuDir, 'credentials.json');
  return { feishuDir, credentialsFile };
}

/**
 * 确保.feishu目录存在
 */
async function ensureFeishuDir() {
  const { feishuDir } = getCredentialsPath();
  try {
    await fs.access(feishuDir);
  } catch (error) {
    // 目录不存在，创建它
    await fs.mkdir(feishuDir, { recursive: true });
  }
}

/**
 * 保存用户token到本地文件
 *
 * @param {Object} tokenData - token数据
 * @param {string} tokenData.access_token - 访问token
 * @param {string} tokenData.refresh_token - 刷新token
 * @param {number} tokenData.expires_in - 过期时间（秒）
 */
async function saveUserToken(tokenData) {
  await ensureFeishuDir();

  const { credentialsFile } = getCredentialsPath();

  const credentials = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: Date.now() + (tokenData.expires_in * 1000), // 转换为毫秒时间戳
    created_at: Date.now()
  };

  await fs.writeFile(credentialsFile, JSON.stringify(credentials, null, 2), 'utf8');
  console.log(`✅ Token已保存到: ${credentialsFile}`);
}

/**
 * 从本地文件读取用户token
 *
 * @returns {Promise<Object|null>} token数据或null
 */
async function loadUserToken() {
  const { credentialsFile } = getCredentialsPath();

  try {
    const content = await fs.readFile(credentialsFile, 'utf8');
    const credentials = JSON.parse(content);
    return credentials;
  } catch (error) {
    // 文件不存在或读取失败
    return null;
  }
}

/**
 * 检查token是否过期
 *
 * @param {Object} tokenData - token数据
 * @returns {boolean} 是否过期
 */
function isTokenExpired(tokenData) {
  if (!tokenData || !tokenData.expires_at) {
    return true;
  }

  // 提前5分钟判定为过期，避免边界情况
  const bufferTime = 5 * 60 * 1000; // 5分钟
  return Date.now() >= (tokenData.expires_at - bufferTime);
}

/**
 * 获取app_access_token（应用级别token）
 *
 * @param {string} appId - 应用ID
 * @param {string} appSecret - 应用密钥
 * @returns {Promise<string>} app_access_token
 */
async function getAppAccessToken(appId, appSecret) {
  const axios = require('axios');

  try {
    const response = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
      {
        app_id: appId,
        app_secret: appSecret
      },
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.code === 0) {
      return response.data.app_access_token;
    } else {
      throw new Error(`获取app_access_token失败: ${response.data.msg}`);
    }
  } catch (error) {
    if (error.response) {
      throw new Error(`获取app_access_token失败: ${error.response.data?.msg || error.response.statusText}`);
    }
    throw error;
  }
}

/**
 * 使用refresh_token刷新access_token
 *
 * @param {string} refreshToken - 刷新token
 * @param {string} appId - 应用ID
 * @param {string} appSecret - 应用密钥
 * @returns {Promise<Object>} 新的token数据
 */
async function refreshAccessToken(refreshToken, appId, appSecret) {
  const axios = require('axios');

  try {
    // 第一步：获取 app_access_token
    const appAccessToken = await getAppAccessToken(appId, appSecret);

    // 第二步：使用 app_access_token 刷新用户 token
    const response = await axios.post(
      'https://open.feishu.cn/open-apis/authen/v1/refresh_access_token',
      {
        app_access_token: appAccessToken,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      },
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.code === 0) {
      const newTokenData = {
        access_token: response.data.data.access_token,
        refresh_token: response.data.data.refresh_token,
        expires_in: response.data.data.expires_in
      };

      // 保存新token
      await saveUserToken(newTokenData);

      return newTokenData;
    } else {
      throw new Error(`刷新token失败: ${response.data.msg}`);
    }
  } catch (error) {
    if (error.response) {
      throw new Error(`刷新token失败: ${error.response.data?.msg || error.response.statusText}`);
    }
    throw error;
  }
}

/**
 * 获取有效的用户access_token（自动处理刷新和重新授权）
 *
 * @param {string} appId - 应用ID
 * @param {string} appSecret - 应用密钥
 * @param {boolean} autoReauth - 当refresh_token失效时是否自动触发重新授权，默认true
 * @returns {Promise<string|null>} access_token或null（如果授权失败）
 */
async function getUserAccessToken(appId, appSecret, autoReauth = true) {
  const tokenData = await loadUserToken();

  if (!tokenData) {
    // 没有保存的token
    if (autoReauth) {
      console.log('📭 未找到已保存的授权信息，需要进行授权...');
      return await triggerReauth();
    }
    return null;
  }

  // 检查是否过期
  if (isTokenExpired(tokenData)) {
    console.log('🔄 Token已过期，正在刷新...');
    try {
      const newTokenData = await refreshAccessToken(tokenData.refresh_token, appId, appSecret);
      return newTokenData.access_token;
    } catch (error) {
      console.error(`❌ Token刷新失败: ${error.message}`);

      // refresh_token也失效了，需要重新授权
      if (autoReauth) {
        console.log('🔄 Refresh Token已失效，需要重新授权...');
        return await triggerReauth();
      }

      console.error('请重新运行授权: node feishu-auth.js');
      return null;
    }
  }

  return tokenData.access_token;
}

/**
 * 触发重新授权流程
 *
 * @returns {Promise<string|null>} 新的access_token或null
 */
async function triggerReauth() {
  try {
    // 动态引入授权模块（避免循环依赖）
    const { runAuthFlow } = require('./feishu-auth');
    const tokenData = await runAuthFlow();
    return tokenData.access_token;
  } catch (error) {
    console.error(`❌ 自动授权失败: ${error.message}`);
    return null;
  }
}

/**
 * 清除本地保存的token
 */
async function clearUserToken() {
  const { credentialsFile } = getCredentialsPath();

  try {
    await fs.unlink(credentialsFile);
    console.log('✅ Token已清除');
  } catch (error) {
    // 文件不存在，忽略错误
  }
}

/**
 * 获取凭证文件信息（用于调试）
 */
async function getTokenInfo() {
  const { credentialsFile } = getCredentialsPath();
  const tokenData = await loadUserToken();

  if (!tokenData) {
    return {
      exists: false,
      path: credentialsFile
    };
  }

  return {
    exists: true,
    path: credentialsFile,
    expired: isTokenExpired(tokenData),
    expires_at: new Date(tokenData.expires_at).toLocaleString(),
    created_at: new Date(tokenData.created_at).toLocaleString()
  };
}

module.exports = {
  saveUserToken,
  loadUserToken,
  isTokenExpired,
  refreshAccessToken,
  getUserAccessToken,
  clearUserToken,
  getTokenInfo,
  getCredentialsPath
};
