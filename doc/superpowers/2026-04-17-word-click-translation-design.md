# 设计文档：单词点击翻译功能

**需求编号**: 需求001
**日期**: 2026-04-17
**状态**: 待用户确认

---

## 1. 概述

在双语歌词区实现单词点击翻译功能。用户点击任意英文单词后，在屏幕中央弹出词典风格的翻译弹窗。

---

## 2. 页面结构调整

### 2.1 歌词行结构调整

**现状**: 每行歌词是一个 `.lyric-line` 容器，包含英文和中文两部分。

**调整后**:
```
.lyric-line
├── .lyric-content
│   ├── .lyric-text (英文，可点击单词)
│   └── .lyric-translation (中文)
└── .lyric-play-btn (播放按钮，右侧)
```

**具体改动**:
- 英文文本 `.lyric-text` 内容每个单词用 `<span class="word" data-word="xxx">xxx</span>` 包裹
- 每行右侧添加播放按钮 `.lyric-play-btn`
- 调整 CSS 布局，使播放按钮靠右对齐

### 2.2 播放按钮样式

- 图标：喇叭/扬声器 SVG 图标
- 位置：该行歌词右侧垂直居中
- 尺寸：与歌词行高匹配，约 24x24px
- 状态：hover 时显示不同颜色

---

## 3. 弹窗设计

### 3.1 弹窗结构

```html
<div id="wordPopup" class="word-popup" hidden>
  <div class="popup-header">
    <span class="popup-word">word</span>
    <button class="popup-close">×</button>
  </div>
  <div class="popup-phonetic">/wɜːd/</div>
  <div class="popup-pronunciation">
    <button class="pron-btn" data-lang="en">🔊 EN</button>
    <button class="pron-btn" data-lang="us">🔊 US</button>
  </div>
  <div class="popup-pos">noun</div>
  <div class="popup-meaning">释义内容</div>
  <div class="popup-examples">
    <div class="example">例句1</div>
    <div class="example">例句2</div>
    <div class="example">例句3</div>
  </div>
</div>
```

### 3.2 弹窗样式

- **位置**: 固定定位，屏幕正中央
- **宽度**: 320px
- **背景**: 与页面卡片样式一致（#fff 或 dark-theme 下深色）
- **圆角**: 12px
- **阴影**: 与页面其他弹窗一致
- **内边距**: 20px

---

## 4. 事件绑定

### 4.1 播放按钮点击事件
- 事件目标: `.lyric-play-btn`
- 触发行为: 调用 `playLyricAtIndex(index, time)` 播放对应句子
- 事件.stopPropagation() 阻止冒泡

### 4.2 单词点击事件
- 事件目标: `.word`
- 触发行为: 显示翻译弹窗
- 事件.stopPropagation() 阻止冒泡

### 4.3 弹窗关闭事件
- 点击关闭按钮: 隐藏弹窗
- 点击弹窗外部: 隐藏弹窗
- ESC 键: 隐藏弹窗

---

## 5. 实现步骤（分步）

### Step 1: 页面结构调整 ✅
- 修改 `renderLyrics()` 方法，生成新的 HTML 结构
- 添加 `.lyric-play-btn` 按钮
- 英文单词用 `<span>` 包裹

### Step 2: CSS 样式 ✅
- 添加播放按钮样式
- 添加弹窗样式

### Step 3: 事件绑定 ✅
- 绑定播放按钮点击事件
- 绑定单词点击事件
- 实现弹窗显示/隐藏逻辑

### Step 4: 弹窗内容（测试数据） ✅
- 先用静态测试数据验证 UI
- 弹窗显示单词、音标、释义等

### Step 5: MyMemory 翻译 API 集成 ✅
- 调用 MyMemory API 获取真实翻译结果
- API: `https://api.mymemory.translated.net/get?q={word}&langpair=en|zh-CN`
- 无需 API Key

---

## 5.1 MyMemory API 集成

### API 调用
```
GET https://api.mymemory.translated.net/get?q={word}&langpair=en|zh-CN
```

### 响应格式
```json
{
  "responseData": {
    "translatedText": "翻译结果"
  },
  "responseStatus": 200
}
```

### 弹窗数据来源
1. **单词**: 直接使用点击的单词
2. **音标**: 使用 Forvo API 或简化为显示原文
3. **发音**: 使用 Forvo API（免费语音发音）
   - EN: `https://audio.forvo.com/audios/mp3/{word}_en.mp3`
   - US: `https://audio.forvo.com/audios/mp3/{word}_us.mp3`
4. **释义**: 来自 MyMemory API
5. **例句**: 来自 MyMemory API（limit 3）

---

## 6. 文件变更

- `js/main.js`: 修改 `ReadingSystem` 类
  - `renderLyrics()` 方法
  - 新增 `bindLyricPlayButtons()` 方法
  - 新增 `handleWordClick()` 方法
  - 新增 `showWordPopup()` / `hideWordPopup()` 方法

- `css/style.css`: 新增样式
  - `.lyric-line` 布局调整
  - `.lyric-play-btn` 样式
  - `.word-popup` 弹窗样式

---

## 7. 注意事项

- 保持与现有代码风格一致
- 不影响现有播放功能和翻译显示切换功能
- 响应式设计，移动端友好
