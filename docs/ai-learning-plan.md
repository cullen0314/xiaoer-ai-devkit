# AI应用开发学习计划（2个月）

> 目标：应付后端岗位AI面试 + 具备开发command/skill/agent能力
> 时间：每周20小时 × 8周 = 160小时
> 背景：后端开发，用过LLM API，RAG/Agent听说过但没用过

---

## 学习路径

```
1. Prompt 基础
   ↓
2. 调用 LLM API（OpenAI/Claude/国产）
   ↓
3. RAG（向量数据库 + 检索增强）
   ↓
4. Agent（工具调用 + 规划 + 执行）
   ↓
5. 编排框架（LangChain / CrewAI / LangGraph）
   ↓
6. 实战：写 command / skill / agent
```

**横贯全程的基础知识：**
- 向量数据库/Embedding：RAG的基础
- JSON/工具定义：Agent的基础

---

## 第1-2周：Prompt + LLM API（30小时）

| 内容 | 时间 | 目标 |
|------|------|------|
| Prompt 工程基础 | 10h | 掌握常用模式（角色设定、思维链、few-shot） |
| 调用 OpenAI/Claude API | 10h | 能用代码调用，理解参数（temperature、tokens等） |
| 小实战：做个对话工具 | 10h | 一个命令行或简单Web的AI助手 |

**面试准备：** 能说出Prompt的常用技巧，能解释API的核心参数

---

## 第3-4周：RAG + 向量数据库（40小时）

| 内容 | 时间 | 目标 |
|------|------|------|
| Embedding + 向量概念 | 10h | 理解文本向量化、相似度搜索 |
| 向量数据库（Chroma/Qdrant） | 15h | 能存、能检索 |
| RAG 完整流程 | 15h | 文档切分 → 向量化 → 检索 → 喂给LLM |

**面试准备：** 能画出RAG架构图，能解释为什么需要RAG

---

## 第5-6周：Agent + 编排框架（40小时）

| 内容 | 时间 | 目标 |
|------|------|------|
| Agent 核心概念 | 10h | 工具调用、规划、ReAct循环 |
| LangChain 或 CrewAI 二选一 | 20h | 跑通官方教程，做个小demo |
| 小实战：做个Agent工具 | 10h | 比如AI搜索、AI代码解释器 |

**面试准备：** 能解释Agent和RAG的区别，能说清楚工具调用原理

---

## 第7-8周：Claude Code技能开发 + 面试冲刺（50小时）

| 内容 | 时间 | 目标 |
|------|------|------|
| 研究 Claude Code 技能体系 | 10h | 搞懂 command/skill/agent 的写法 |
| 写一个简单 command | 10h | 选你熟悉的场景 |
| 写一个简单 agent | 15h | 比如代码审查、文档生成 |
| 面试准备：刷题 + 背概念 | 15h | 整理常见面试问题，练回答 |

---

## 每周时间分配建议（20小时）

| 类型 | 时间 | 说明 |
|------|------|------|
| 学习新知识（看教程/文档） | 8h | 周中晚上 2h × 4天 |
| 动手写代码 | 8h | 周末 2天 × 4h |
| 复盘总结 | 4h | 周末晚上整理笔记 |

---

## 推荐学习资源

| 知识点 | 资源 |
|--------|------|
| Prompt | [OpenAI Prompt Engineering Guide](https://github.com/openai/openai-cookbook/blob/main/examples/technique_to_improve_reliability/guide_prompt_engineering.md) |
| LLM API | 官方文档（OpenAI / Anthropic / 智谱/通义） |
| RAG | [LangChain RAG教程](https://python.langchain.com/docs/tutorials/rag/) |
| Agent | [CrewAI Examples](https://github.com/crewAIInc/crewAI-examples) |
| 向量数据库 | Chroma 或 Qdrant 官方文档 |

---

## 本周任务（第1周）

| 任务 | 时间 |
|------|------|
| 读一篇Prompt工程教程 | 2h |
| 用Python调一次OpenAI或Claude的API | 2h |
| 想一个你想要的小工具（比如AI代码解释器） | 2h |

---

## 面试必会概念清单

- [ ] Prompt 工程常用技巧（CoT、Few-shot、角色设定）
- [ ] LLM API 核心参数（temperature、top_p、max_tokens）
- [ ] Embedding 和向量相似度
- [ ] RAG 架构和作用
- [ ] Agent vs RAG 的区别
- [ ] 工具调用（Function Calling）原理
- [ ] LangChain/CrewAI 核心概念
- [ ] 向量数据库基本原理

---

*生成时间：2026-03-13*
*对话来源：thinking-mentor 技能*
