# 飞书文档读取 Skill 入口脚本 (PowerShell版)
# 自动检测并安装 Node.js 依赖

$ErrorActionPreference = "Stop"

# ==================== 配置区 ====================
$SCRIPT_DIR = $PSScriptRoot

# ==================== 依赖检查 ====================
# 检查 Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "❌ 错误：未找到 Node.js，请先安装 Node.js"
    exit 1
}

# ==================== 依赖安装 ====================
# 自动安装 npm 依赖（检测 node_modules 是否存在）
if (-not (Test-Path "$SCRIPT_DIR\node_modules")) {
    Write-Host "📦 首次运行，正在安装依赖..."
    Push-Location $SCRIPT_DIR
    try {
        # 使用 cmd /c 运行 npm 以避免 PowerShell 中的一些执行问题
        cmd /c "npm install --silent"
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed"
        }
        Write-Host "✅ 依赖安装完成"
    }
    catch {
        Write-Error "❌ 依赖安装失败，请手动运行：cd $SCRIPT_DIR; npm install"
        Pop-Location
        exit 1
    }
    Pop-Location
}

# ==================== 参数检查 ====================
if ($args.Count -lt 1) {
    Write-Host "用法: .\run.ps1 [--no-save] [--with-images] <飞书URL>"
    Write-Host ""
    Write-Host "参数说明:"
    Write-Host "  --no-save      不保存文件，只输出 Markdown 内容"
    Write-Host "  --with-images  包含图片（需要多模态模型支持）"
    Write-Host ""
    Write-Host "示例:"
    Write-Host "  .\run.ps1 'https://xxx.feishu.cn/wiki/xxx'"
    Write-Host "  .\run.ps1 --no-save 'https://xxx.feishu.cn/wiki/xxx'"
    exit 1
}

# ==================== 运行脚本 ====================
# 检查是否存在Token文件，如果不存在则提示将打开浏览器
$TokenPath = Join-Path $HOME ".feishu\credentials.json"
if (-not (Test-Path $TokenPath)) {
    Write-Host "ℹ️  检测到首次使用（或Token不存在），即将打开浏览器进行飞书授权..."
    Write-Host "   请在弹出的浏览器窗口中点击确认授权。"
    Write-Host ""
}

# 执行 Node.js 脚本，传递所有参数
# 使用 node 直接执行
$nodeArgs = @("$SCRIPT_DIR\skill.js") + $args
& node $nodeArgs
