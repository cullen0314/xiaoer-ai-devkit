# 视频比例与时长参考

本文档包含常见的视频比例、时长规格和技术参数。

---

## 画面比例

| 比例 | 名称 | 英文 | 用途 | 像素尺寸示例 |
|------|------|------|------|--------------|
| **16:9** | 横屏/宽屏 | Widescreen, Landscape | YouTube、电影、电视 | 1920x1080, 3840x2160 |
| **9:16** | 竖屏 | Portrait, Vertical | TikTok、Reels、Shorts | 1080x1920, 1440x2560 |
| **1:1** | 正方形 | Square | Instagram帖子 | 1080x1080, 2048x2048 |
| **4:3** | 标准比例 | Standard, Full screen | 传统电视、老电影 | 1440x1080, 640x480 |
| **2.35:1** | 超宽银幕 | Anamorphic, Cinemascope | 电影宽银幕 | 3840x1634 |
| **2.39:1** | 电影宽屏 | Widescreen cinematic | 现代电影 | 4096x1716 |
| **21:9** | 超宽屏 | Ultrawide | 显示器、电影感视频 | 3440x1440 |

---

## 分辨率规格

| 分辨率 | 名称 | 英文 | 用途 |
|--------|------|------|------|
| **480p** | 标清 | SD | 老式视频 |
| **720p** | 高清 | HD | 基础高清视频 |
| **1080p** | 全高清 | Full HD, FHD | 标准高清视频 |
| **1440p** | 2K | 2K, QHD | 高端显示器 |
| **2160p** | 4K | 4K, UHD | 专业视频制作 |
| **4320p** | 8K | 8K | 顶级专业制作 |

---

## 时长规格

| 时长 | 用途 | 平台支持 |
|------|------|----------|
| **5-15秒** | 短视频 | TikTok、Reels、Shorts |
| **15-60秒** | 短视频 | TikTok、Reels、Shorts |
| **1-3分钟** | 中视频 | YouTube、B站 |
| **3-10分钟** | 长视频 | YouTube、B站 |
| **10-30分钟** | 长视频 | YouTube、纪录片 |
| **30分钟+** | 超长视频 | 电影、剧集 |

---

## 平台规格参考

| 平台 | 推荐比例 | 推荐分辨率 | 最大时长 |
|------|----------|------------|----------|
| **Sora** | 16:9, 9:16 | 1080p | ~60秒 |
| **Runway Gen-3** | 16:9 | 1080p | ~18秒 |
| **Pika** | 16:9, 9:16, 1:1 | 1080p | ~4秒基础可延长 |
| **Kling** | 16:9 | 1080p | ~10秒 |
| **Veo** | 16:9 | 1080p+ | ~8秒 |
| **TikTok** | 9:16 | 1080x1920 | 3分钟 |
| **YouTube** | 16:9 | 3840x2160 | 无限制 |
| **Instagram Reels** | 9:16 | 1080x1920 | 90秒 |

---

## 帧率规格

| 帧率 | 名称 | 英文 | 效果 |
|------|------|------|------|
| **24fps** | 电影帧率 | Cinema standard | 电影质感 |
| **25fps** | PAL电视 | PAL TV | 欧洲电视标准 |
| **30fps** | 标准视频 | Standard video | 普通视频 |
| **60fps** | 高帧率 | High frame rate | 流畅、运动感强 |
| **120fps+** | 升格拍摄 | Slow motion capable | 用于慢动作 |

---

## 提示词中的描述方式

### 比例描述
```
 widescreen 16:9 aspect ratio
 vertical 9:16 aspect ratio for mobile
 square 1:1 aspect ratio
 cinematic ultrawide 2.35:1 aspect ratio
```

### 时长描述
```
 5-second video clip
 10-second continuous shot
 looping 3-second animation
```

### 运动描述
```
 slow motion at 60fps
 smooth 30fps animation
 cinematic 24fps film look
```

### 组合示例
```
16:9 widescreen cinematic video, 10 seconds long,
24fps film look, slow motion segments at 60fps
```

---

## 使用建议

1. **根据平台选择比例**：短视频用9:16，长视频用16:9
2. **考虑时长限制**：各平台生成工具有时长上限
3. **帧率影响效果**：24fps电影感，60fps适合运动场景
4. **在提示词末尾指定**：比例和时长通常放在提示词最后

### 提示词示例
```
Aerial shot of a mountain range at sunrise, 16:9 widescreen,
10 seconds long, cinematic 24fps, golden hour lighting,
epic scale, high contrast
```
