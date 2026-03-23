# MySQL 执行器 Skill

安全地执行 MySQL 数据库查询的 Claude Code Skill。

## 功能特性

- ✅ 支持多数据源连接
- ✅ 每次启动先选择目标数据库
- ✅ 支持 SELECT、SHOW 查询（自动执行）
- ✅ 支持 INSERT/UPDATE 操作（需要用户确认）
- ❌ 禁止 DELETE、DROP、TRUNCATE 等高危操作
- ❌ 禁止 ALTER TABLE、CREATE TABLE 等 DDL 操作
- 🔧 自动检测并安装 MySQL 客户端
- 📊 支持表格和 Markdown 格式输出
- 🔍 自动扫描 Spring Boot 项目中的数据库配置

## 安装

此 Skill 已内置在项目中，无需额外安装。首次运行时会自动检测并安装 MySQL 客户端。

## 使用方法

### 基本用法

```bash
bash ~/.claude/skills/mysql-executor/run.sh "SQL 语句" [选项]
```

### 选项

- `--markdown`: 使用 Markdown 格式输出查询结果（默认，适合 AI 读取，节省 Token）
- `--table`: 使用表格格式输出查询结果（适合人类阅读）
- `--project-dir`: 指定项目目录，用于扫描 Spring Boot 数据源配置

### 使用示例

**查询数据（默认使用 Markdown）：**

```bash
bash ~/.claude/skills/mysql-executor/run.sh "SELECT * FROM users LIMIT 10"
```

启动后会先展示数据源列表，例如：

```text
请选择要连接的数据库：

1) 默认库
   数据库: xianmudb
   地址: mysql-xm.summerfarm.net:3308
   用户: dev2
   来源: builtin-default

2) 离线库
   数据库: xianmu_offline_db
   地址: mysql-8.summerfarm.net:3307
   用户: dev
   来源: builtin-offline
```

**使用表格格式输出（适合人类阅读）：**

```bash
bash ~/.claude/skills/mysql-executor/run.sh --table "SELECT * FROM users LIMIT 10"
```

**指定项目目录并扫描项目数据源：**

```bash
bash ~/.claude/skills/mysql-executor/run.sh --project-dir /path/to/project "SELECT * FROM users LIMIT 10"
```

**更新数据（需要确认）：**

```bash
bash ~/.claude/skills/mysql-executor/run.sh "UPDATE users SET status = 1 WHERE id = 100"
```

输出示例：
```text
请选择要连接的数据库：
...

✅ 已选择数据源: 离线库
📍 目标数据库: xianmu_offline_db @ mysql-8.summerfarm.net:3307

⚠️  警告: 即将执行以下 SQL 语句：

UPDATE users SET status = 1 WHERE id = 100

目标数据库: xianmu_offline_db @ mysql-8.summerfarm.net:3307
数据源名称: 离线库

此操作将修改数据库数据，是否继续？(输入 yes 确认)
```

## 安全限制

### 允许的操作

| 操作类型 | 确认要求 | 说明 |
|---------|---------|------|
| SELECT  | 无需确认 | 查询数据，只读操作 |
| SHOW    | 无需确认 | 查看元数据或状态 |
| INSERT  | 需要确认 | 插入新数据 |
| UPDATE  | 需要确认 | 更新现有数据 |

### 禁止的操作

| 操作类型 | 禁止原因 |
|---------|---------|
| DELETE  | 高危操作，可能导致数据丢失 |
| DROP    | 高危操作，会删除表或数据库 |
| TRUNCATE | 高危操作，会清空表数据 |
| ALTER TABLE | DDL 操作，会修改表结构 |
| CREATE TABLE | DDL 操作，会创建新表 |

## 数据库连接配置

脚本会在每次启动时展示候选数据源，候选项来源包括：

### 内置数据源

1. **默认库**
   - 主机: `mysql-xm.summerfarm.net`
   - 端口: `3308`
   - 数据库: `xianmudb`
   - 用户名: `dev2`

2. **离线库**
   - 主机: `mysql-8.summerfarm.net`
   - 端口: `3307`
   - 数据库: `xianmu_offline_db`
   - 用户名: `dev`

### 项目自动扫描数据源

脚本会在指定项目目录中按以下优先级扫描 Spring Boot 配置：

1. `application-dev2.yml`
2. `application-dev.yml`
3. `application.yml`

支持识别的配置键包括：
- `spring.datasource.url`
- `spring.datasource.druid.url`
- `spring.datasource.dynamic.datasource.master.url`

## 自动安装

脚本会自动检测并安装 MySQL 客户端：

- **macOS**: 使用 Homebrew 安装 `mysql-client`
- **Ubuntu/Debian**: 使用 `apt-get` 安装 `mysql-client`
- **CentOS/RHEL**: 使用 `yum` 安装 `mysql`

## 在 Claude Code 中使用

当用户请求执行 SQL 时，直接调用脚本：

```text
用户：查询用户表中状态为活跃的用户

Claude：我会帮你查询活跃用户。
[执行] bash ~/.claude/skills/mysql-executor/run.sh "SELECT * FROM users WHERE status = 'active' LIMIT 20"
```

```text
用户：将用户 ID 为 123 的状态更新为已验证

Claude：我会更新该用户状态，需要您先选择数据库并确认后执行。
[执行] bash ~/.claude/skills/mysql-executor/run.sh "UPDATE users SET status = 'verified' WHERE id = 123"
```

## 注意事项

1. **使用 LIMIT**: 建议在 SELECT 查询中使用 LIMIT 限制结果数量
2. **启动先选库**: 每次启动都会展示数据源列表，需先选择目标数据库
3. **确认机制**: INSERT/UPDATE 操作会提示确认，输入 `yes` 后才会执行
4. **安全优先**: 所有高危操作都会被拒绝，无法绕过
5. **字符编码**: 默认使用 UTF-8 编码，支持中文

## 故障排除

### MySQL 客户端安装失败

如果自动安装失败，请手动安装：

**macOS:**
```bash
brew install mysql-client
export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install mysql-client
```

**CentOS/RHEL:**
```bash
sudo yum install mysql
```

### 连接失败

检查网络连接和数据库服务器状态：
```bash
telnet mysql-xm.summerfarm.net 3308
```

也可以检查离线库连通性：
```bash
telnet mysql-8.summerfarm.net 3307
```

## 许可证

内部使用工具，仅限项目团队使用。
