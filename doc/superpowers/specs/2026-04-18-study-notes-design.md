# 设计文档：学习笔记功能

**需求编号**: 需求003
**日期**: 2026-04-18
**状态**: 待实现

---

## 1. 概述

在页面右侧 PDF 区域顶部添加两个可切换的标签：`课本` 和 `学习笔记`。用户点击标签可切换显示内容，点击"学习笔记"时显示当前课程的 AI 生成学习笔记，笔记内容与左侧课程选择联动。

---

## 2. 页面结构调整

### 2.1 右侧区域结构

```
┌─────────────────────────────────────────────────┐
│  Header                                          │
├─────────────────────────────────────────────────┤
│  Book info + Course selection                    │
├───────────────────────────┬─────────────────────┤
│  Player controls          │  [课本] [学习笔记]   │
│  音频播放控制区            ├─────────────────────┤
│                           │                     │
│  ─────────────────────    │   PDF Viewer        │
│                           │        或           │
│  双语歌词/对话显示区       │   学习笔记内容       │
│  (左侧)                   │   (根据标签切换)     │
│                           │                     │
└───────────────────────────┴─────────────────────┘
```

### 2.2 标签切换逻辑

- 默认显示"课本"（即 PDF 内容）
- 点击"学习笔记" → 右侧切换为笔记内容
- 左侧选不同的课 → 右侧笔记内容也跟着变（按下标对应）
- 点击"课本" → 切回 PDF 显示

---

## 3. 笔记文件格式

### 3.1 文件位置

```
notes/
├── NCE1/
│   ├── 001-002.json    (Lesson 1)
│   ├── 003-004.json    (Lesson 2)
│   └── ...
├── NCE2/
├── NCE3/
└── NCE4/
```

### 3.2 JSON 格式

```json
{
  "book": "NCE1",
  "lesson": "001-002",
  "title": "Lesson 1",
  "vocabulary": [
    {
      "word": "excuse",
      "phonetic": "/ɪkˈskjuːz/",
      "meanings": [
        {
          "pos": "verb",
          "meaning": "原谅；宽恕",
          "usage": "用于请求原谅或引起注意"
        },
        {
          "pos": "noun",
          "meaning": "借口；理由",
          "usage": "为某种行为给出的解释"
        }
      ]
    }
  ],
  "phrases": [
    {
      "phrase": "excuse me",
      "usage": "用于引起他人注意、请求让路、或者在打扰别人之前",
      "examples": [
        {
          "en": "Excuse me, is this seat taken?",
          "zh": "打扰一下，这个座位有人吗？"
        }
      ]
    }
  ],
  "grammar": [
    {
      "title": "一般疑问句 (Yes/No Question)",
      "definition": "可以用 yes 或 no 回答的句子",
      "structure": "Is/Are/Am + 主语 + ...?",
      "usage": "用于询问某物是否属于某人",
      "examples": [
        {
          "en": "Is this your handbag?",
          "zh": "这是你的手提包吗？"
        }
      ]
    }
  ],
  "sentencePatterns": [
    {
      "pattern": "Is this your + 名词?",
      "original": {
        "en": "Is this your handbag?",
        "zh": "这是你的手提包吗？"
      },
      "imitations": [
        {
          "en": "Is this your pen?",
          "zh": "这是你的钢笔吗？"
        }
      ]
    }
  ]
}
```

### 3.3 内容数量要求

- **核心词汇**：最多 15 个（不设下限，AI 根据内容自适应）
- **重点短语**：最多 10 个（不设下限，AI 根据内容自适应）
- **语法讲解**：根据内容适量选取 1-3 个
- **句型仿写**：根据内容适量选取 2-4 个

---

## 4. 前端实现

### 4.1 标签组件 HTML

```html
<div class="view-tabs">
  <button class="tab-btn active" data-tab="pdf">课本</button>
  <button class="tab-btn" data-tab="notes">学习笔记</button>
</div>
<div id="pdfContainer" class="pdf-container"></div>
<div id="notesContainer" class="notes-container" hidden></div>
```

### 4.2 笔记内容渲染

- 按下标从 `notes/NCE{1,2,3,4}/` 目录加载对应 JSON 文件
- 渲染时单词用 `<span class="word">` 包裹，支持点击查词典
- 复用车已有的 `showWordPopup()` 等词典功能

### 4.3 文件变更

- `index.html`: 添加标签 HTML 结构
- `css/style.css`: 添加标签样式、笔记内容样式
- `js/main.js`: `ReadingSystem` 类
  - 新增 `switchTab()` 方法
  - 新增 `loadNotes()` 方法
  - 新增 `renderNotes()` 方法
  - 修改 `loadUnitByIndex()` 联动笔记加载

---

## 5. 笔记生成脚本

### 5.1 脚本位置

```
scripts/
└── generate_notes.py
```

### 5.2 脚本功能

1. 读取 `transcript/新概念英语第{1,2,3,4}册/*.lrc`
2. 跳过前5行元信息，从第6行开始提取英文内容
3. 调用 MiniMax API 生成学习笔记
4. 输出到 `notes/NCE{1,2,3,4}/001-002.json`

### 5.3 MiniMax API 配置

- Base URL: `https://api.minimaxi.com/v1`
- Model: `MiniMax-M2.7`
- API Key: `sk-cp-dUkHwmO0K4GwT4M_hYgXtUgzvmH2M1-bHjmfqUnHRHto8IVLSnXj3VBxmoJOPlC0nYcUBV3CgkNXRX-6GlblhSlIMr3mVARFsLcLC_HQzSa-IhDop06FYG4`

### 5.4 LRC 解析规则

- 前5行：元信息（跳过）
- 第6行：课名标题（如 `Lesson 1`）
- 第7行起：课文正文内容
- 格式：`[mm:ss.xx]文本内容`

### 5.5 AI Prompt 模板

```
你是一个英语学习助手。请根据以下课文内容，生成学习笔记，格式为JSON。

课文内容：
{text}

笔记格式（必须是有效JSON）：
{{
  "book": "NCE1",
  "lesson": "001-002",
  "title": "Lesson 1",
  "vocabulary": [
    {{
      "word": "单词",
      "phonetic": "/音标/",
      "meanings": [
        {{
          "pos": "词性",
          "meaning": "中文意思",
          "usage": "用法说明"
        }}
      ]
    }}
  ],
  "phrases": [
    {{
      "phrase": "短语",
      "usage": "用法说明",
      "examples": [
        {{"en": "例句英文", "zh": "例句中文"}}
      ]
    }}
  ],
  "grammar": [
    {{
      "title": "语法点名称",
      "definition": "定义",
      "structure": "结构",
      "usage": "用法",
      "examples": [
        {{"en": "例句英文", "zh": "例句中文"}}
      ]
    }}
  ],
  "sentencePatterns": [
    {{
      "pattern": "句型",
      "original": {{"en": "原文英文", "zh": "原文中文"}},
      "imitations": [
        {{"en": "仿写英文", "zh": "仿写中文"}}
      ]
    }}
  ]
}}

要求：
1. vocabulary：选取课文中最核心的词汇，最多15个，根据内容自适应
2. phrases：选取最重要的短语，最多10个，根据内容自适应
3. grammar：选取1-3个重点语法点
4. sentencePatterns：选取2-4个重点句型
5. 所有例句要有中英文对照
6. 只返回JSON，不要其他内容
```

---

## 6. 课程与笔记文件对应关系

使用**下标/索引**对应，而非标题匹配：

```
左侧课程列表[0] → notes/NCE1/001-002.json
左侧课程列表[1] → notes/NCE1/003-004.json
左侧课程列表[2] → notes/NCE1/005-006.json
...
```

---

## 7. 实现步骤

### Phase 1: 笔记生成脚本
1. 创建 `scripts/generate_notes.py`
2. 实现 LRC 解析功能
3. 实现 MiniMax API 调用
4. 生成所有课程的笔记 JSON 文件

### Phase 2: 前端标签切换
1. 在 PDF 区域顶部添加标签组件
2. 实现标签切换逻辑
3. 实现笔记内容渲染

### Phase 3: 笔记内单词点击
1. 笔记渲染时包裹单词
2. 复用现有查词典功能
