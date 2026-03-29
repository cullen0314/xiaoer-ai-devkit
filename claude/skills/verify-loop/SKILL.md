# verify-loop

自动验证循环 - 对已完成的代码工作进行验证，发现问题后自动修复并重新验证，直到全部通过或达到最大迭代次数。

## 触发时机

当用户说以下内容时触发：
- "验证一下"
- "检查代码有没有问题"
- "跑一下测试看看"
- "verify"
- "自动修复问题"
- "/verify-loop"

## 工作方式

此 Skill 会调用 `verify-loop` Agent 来执行验证循环。Agent 会：

1. 智能识别项目类型和验证命令（Java/Node.js/Python/Go/Rust）
2. 根据 git diff 智能缩小验证范围
3. 运行验证 → 发现问题 → 修复代码 → 重新验证
4. 最多迭代 3 轮，收敛检测避免无效重复
5. 输出透明的修复报告

## 使用示例

```bash
/verify-loop
/verify-loop --max-iterations 5
/verify-loop --full
/verify-loop --verify "npm test && npm run lint"
```

## 实现

调用 Agent 工具，使用 `verify-loop` Agent，参数传递给 Agent 的 $ARGUMENTS。
