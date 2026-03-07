# Checkpoint 命令

在工作流中创建或验证检查点。

## 用法

`/checkpoint [create|verify|list] [name]`

## 创建检查点

创建检查点时：

1. 运行 `/verify quick` 确保当前状态干净
2. 使用检查点名称创建 git stash 或 commit
3. 记录检查点到 `.claude/checkpoints.log`：

```bash
echo "$(date +%Y-%m-%d-%H:%M) | $CHECKPOINT_NAME | $(git rev-parse --short HEAD)" >> .claude/checkpoints.log
```

4. 报告检查点已创建

## 验证检查点

对照检查点验证时：

1. 从日志读取检查点
2. 比较当前状态与检查点：
   - 自检查点以来添加的文件
   - 自检查点以来修改的文件
   - 现在的测试通过率 vs 当时
   - 现在的覆盖率 vs 当时

3. 报告：
```
检查点比较: $NAME
============================
文件变更: X
测试: +Y 通过 / -Z 失败
覆盖率: +X% / -Y%
构建: [通过/失败]
```

## 列出检查点

显示所有检查点，包含：
- 名称
- 时间戳
- Git SHA
- 状态（当前、落后、领先）

## 工作流

典型的检查点流程：

```
[开始] --> /checkpoint create "功能开始"
   |
[实现] --> /checkpoint create "核心完成"
   |
[测试] --> /checkpoint verify "核心完成"
   |
[重构] --> /checkpoint create "重构完成"
   |
[PR] --> /checkpoint verify "功能开始"
```

## 参数

$ARGUMENTS:
- `create <name>` - 创建命名检查点
- `verify <name>` - 对照命名检查点验证
- `list` - 显示所有检查点
- `clear` - 移除旧检查点（保留最近 5 个）
