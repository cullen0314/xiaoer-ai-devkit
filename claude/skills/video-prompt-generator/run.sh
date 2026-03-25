#!/bin/bash
# video-prompt-generator Skill 轻量入口脚本
# 用法: bash run.sh "用户的视频创意需求"

set -e

if [ $# -lt 1 ]; then
  cat >&2 <<'EOF'
用法:
  bash run.sh "请帮我生成一个 15 秒咖啡广告视频 prompt，风格高级，适合小红书"

说明:
  - 本脚本用于生成视频提示词的结构化草案
  - 负责 prompt 组织，不负责直接生成视频文件
EOF
  exit 1
fi

USER_INPUT="$*"
ESCAPED_INPUT=${USER_INPUT//__USER_INPUT__/[invalid input]}

cat <<'SKILL_OUTPUT' | sed "s|__USER_INPUT__|${ESCAPED_INPUT}|g"
## 视频提示词结果

### 1. 中文摘要
基于你的需求，已整理出一版可直接继续优化或投喂视频模型的视频提示词草案。

### 2. 需求理解
- 原始需求：__USER_INPUT__
- 输出目标：生成一条结构化视频 prompt
- 默认定位：通用视频生成平台可用版本

### 3. 结构化中文描述
- 主题：请根据用户需求提炼视频主题
- 主体：请识别主要人物 / 产品 / 场景主体
- 场景：请补全核心场景与环境
- 风格：请明确视觉风格、色调、参考方向
- 镜头：请补充镜头语言与运动方式
- 光影/氛围：请补充时间、光线、情绪氛围
- 时长：请根据需求补充合适时长
- 平台：如未指定，默认通用

### 4. 英文视频 Prompt

```text
Create a video based on this request: __USER_INPUT__
Focus on clear subject, scene, visual style, camera movement, lighting mood, and platform-ready cinematic prompt structure.
```

### 5. 可选增强建议
- 如需分镜，可继续补充“请拆成 3 个镜头 / 5 个镜头”
- 如需平台适配，可继续指定 Sora / Runway / Kling / Pika / Veo
- 如需文案，可继续补充“加旁白 / 字幕 / slogan”
SKILL_OUTPUT
