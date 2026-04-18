# 学习笔记功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在页面右侧区域添加课本/学习笔记标签切换功能，并生成所有课程的学习笔记JSON文件

**Architecture:**
- Phase 1: Python脚本读取LRC文件，调用MiniMax API生成学习笔记JSON
- Phase 2: 前端添加标签切换组件，复用PDF区域容器，渲染笔记内容
- Phase 3: 笔记内单词复用现有查词典功能

**Tech Stack:** Python (脚本) + 原生JavaScript (前端) + pdf.js (已有)

---

## 文件结构

```
NCE-main/
├── scripts/
│   └── generate_notes.py          # 新建：笔记生成脚本
├── notes/                          # 新建：生成的笔记JSON
│   ├── NCE1/
│   │   ├── 001-002.json
│   │   └── ...
│   ├── NCE2/
│   ├── NCE3/
│   └── NCE4/
├── index.html                      # 修改：添加标签组件
├── css/style.css                   # 修改：添加标签和笔记样式
└── js/main.js                     # 修改：添加标签切换和笔记渲染
```

---

## Phase 1: 笔记生成脚本

### Task 1: 创建笔记生成脚本

**Files:**
- Create: `scripts/generate_notes.py`

**LRC文件样本：**
```
[al:新概念英语（一）]
[ar:MP3 同步字幕版（美音）]
[ti:Excuse Me!]
[00:01.00]新概念英语学习软件：http://www.tysoft.net/
[00:02.77]
[00:00.61]Lesson 1
[00:02.71]Excuse me!
[00:05.61]Listen to the tape then answer this question.
...
```

- [ ] **Step 1: 创建脚本文件**

```bash
mkdir -p scripts notes
touch scripts/generate_notes.py
```

- [ ] **Step 2: 编写脚本基础结构**

```python
#!/usr/bin/env python3
"""
学习笔记生成脚本
读取transcript目录下的LRC文件，调用MiniMax API生成学习笔记
"""

import os
import re
import json
import time
from pathlib import Path
from openai import OpenAI

# MiniMax API配置
API_KEY = "sk-cp-dUkHwmO0K4GwT4M_hYgXtUgzvmH2M1-bHjmfqUnHRHto8IVLSnXj3VBxmoJOPlC0nYcUBV3CgkNXRX-6GlblhSlIMr3mVARFsLcLC_HQzSa-IhDop06FYG4"
BASE_URL = "https://api.minimaxi.com/v1"
MODEL = "MiniMax-M2.7"

# LRC解析配置
SKIP_LINES = 5  # 跳过前5行元信息

def parse_lrc(lrc_path):
    """解析LRC文件，返回英文内容"""
    with open(lrc_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 跳过前5行，从第6行开始提取
    content_lines = lines[SKIP_LINES:]

    english_text = []
    for line in content_lines:
        # 匹配 [mm:ss.xx]文本内容 格式
        match = re.match(r'\[\d{2}:\d{2}\.\d{2}\](.+)', line)
        if match:
            text = match.group(1).strip()
            if text and not text.startswith('Lesson'):
                english_text.append(text)

    return ' '.join(english_text)

def generate_notes(text, book, lesson):
    """调用MiniMax API生成学习笔记"""
    client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

    prompt = f"""你是一个英语学习助手。请根据以下课文内容，生成学习笔记，格式为JSON。

课文内容：
{text}

笔记格式（必须是有效JSON）：
{{
  "book": "{book}",
  "lesson": "{lesson}",
  "title": "Lesson X",
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
"""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=1.0
    )

    result = response.choices[0].message.content
    # 提取JSON（去掉可能的markdown代码块）
    if result.startswith('```'):
        result = re.sub(r'^```.*?\n', '', result)
        result = re.sub(r'\n?```$', '', result)

    return json.loads(result)

def main():
    base_dir = Path(__file__).parent.parent
    transcript_dir = base_dir / "transcript"
    notes_dir = base_dir / "notes"

    # 书册映射
    book_map = {
        "新概念英语第1册": ("NCE1", "001-002"),
        "新概念英语第2册": ("NCE2", "01"),
        "新概念英语第3册": ("NCE3", "01"),
        "新概念英语第4册": ("NCE4", "01"),
    }

    for book_dir in transcript_dir.iterdir():
        if not book_dir.is_dir():
            continue

        book_name = book_dir.name
        if book_name not in book_map:
            continue

        book_key, lesson_prefix = book_map[book_name]
        book_notes_dir = notes_dir / book_key
        book_notes_dir.mkdir(parents=True, exist_ok=True)

        lrc_files = sorted(book_dir.glob("*.lrc"))
        print(f"处理 {book_name}: {len(lrc_files)} 个文件")

        for i, lrc_file in enumerate(lrc_files):
            # 从文件名提取课次编号
            filename = lrc_file.stem  # e.g. "001-002－Excuse Me"
            parts = filename.split('－')
            lesson_key = parts[0]  # "001-002"

            notes_file = book_notes_dir / f"{lesson_key}.json"

            print(f"  处理: {lrc_file.name} -> {notes_file.name}")

            # 解析LRC
            text = parse_lrc(lrc_file)

            # 生成笔记
            notes = generate_notes(text, book_key, lesson_key)

            # 保存
            with open(notes_file, 'w', encoding='utf-8') as f:
                json.dump(notes, f, ensure_ascii=False, indent=2)

            # 避免API限流
            time.sleep(1)

if __name__ == "__main__":
    main()
```

- [ ] **Step 3: 运行脚本生成测试（先测试1个文件）**

```bash
cd /Users/libin/Desktop/ClaudeProject/NCE-main
python3 scripts/generate_notes.py
```

- [ ] **Step 4: 提交脚本**

```bash
git add scripts/generate_notes.py notes/
git commit -m "feat: 添加学习笔记生成脚本"
```

---

## Phase 2: 前端标签切换

### Task 2: 修改HTML添加标签组件

**Files:**
- Modify: `index.html:206-210`

**现状：**
```html
<aside class="pdf-viewer desktop-only">
    <div id="pdfContainer">
        <div class="pdf-placeholder">选择一个课本开始学习...</div>
    </div>
</aside>
```

- [ ] **Step 1: 添加标签和笔记容器**

```html
<aside class="pdf-viewer desktop-only">
    <!-- 标签切换 -->
    <div class="view-tabs">
        <button class="tab-btn active" data-tab="pdf">课本</button>
        <button class="tab-btn" data-tab="notes">学习笔记</button>
    </div>
    <!-- PDF容器 -->
    <div id="pdfContainer" class="content-container">
        <div class="pdf-placeholder">选择一个课本开始学习...</div>
    </div>
    <!-- 笔记容器 -->
    <div id="notesContainer" class="content-container notes-container" hidden>
        <div class="notes-placeholder">选择一个课程查看学习笔记...</div>
    </div>
</aside>
```

- [ ] **Step 2: 提交HTML修改**

```bash
git add index.html
git commit -m "feat: 添加课本/笔记标签切换组件"
```

---

### Task 3: 添加CSS样式

**Files:**
- Modify: `css/style.css` (在文件末尾添加)

- [ ] **Step 1: 添加标签样式**

```css
/* 标签切换样式 */
.view-tabs {
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    background: var(--glass);
    border-bottom: 1px solid var(--border);
}

.tab-btn {
    padding: 6px 16px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--paper-2);
    color: var(--ink-2);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
}

.tab-btn:hover {
    background: var(--accent-3);
    border-color: var(--accent-1);
}

.tab-btn.active {
    background: var(--accent-1);
    color: #ffffff;
    border-color: var(--accent-1);
}

.content-container {
    flex: 1;
    overflow-y: auto;
}

/* 笔记容器 */
.notes-container {
    padding: 16px;
}

.notes-placeholder {
    text-align: center;
    color: var(--ink-3);
    font-size: 14px;
    padding: 40px 20px;
}

/* 笔记内容样式 */
.notes-section {
    margin-bottom: 24px;
}

.notes-section-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--accent-1);
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 2px solid var(--accent-3);
}

/* 词汇项 */
.vocab-item {
    margin-bottom: 16px;
    padding: 12px;
    background: var(--paper-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
}

.vocab-word {
    font-size: 18px;
    font-weight: 700;
    color: var(--ink-1);
    font-family: var(--font-display);
}

.vocab-phonetic {
    font-size: 13px;
    color: var(--ink-2);
    font-family: var(--font-mono);
    margin-left: 8px;
}

.vocab-meanings {
    margin-top: 8px;
}

.vocab-meaning {
    margin-bottom: 6px;
}

.vocab-pos {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    color: var(--accent-1);
    background: var(--accent-3);
    padding: 2px 6px;
    border-radius: 4px;
    margin-right: 6px;
}

.vocab-meaning-text {
    font-size: 14px;
    color: var(--ink-1);
}

.vocab-usage {
    font-size: 12px;
    color: var(--ink-3);
    margin-top: 4px;
}

/* 短语项 */
.phrase-item {
    margin-bottom: 14px;
    padding: 12px;
    background: var(--paper-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
}

.phrase-text {
    font-size: 16px;
    font-weight: 600;
    color: var(--accent-1);
    font-family: var(--font-display);
}

.phrase-usage {
    font-size: 13px;
    color: var(--ink-2);
    margin: 6px 0;
}

.phrase-example {
    font-size: 13px;
    color: var(--ink-1);
    margin: 4px 0;
    padding-left: 12px;
    border-left: 3px solid var(--accent-3);
}

/* 语法项 */
.grammar-item {
    margin-bottom: 16px;
    padding: 14px;
    background: var(--paper-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
}

.grammar-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--ink-1);
    margin-bottom: 8px;
}

.grammar-detail {
    font-size: 13px;
    color: var(--ink-2);
    margin: 4px 0;
}

.grammar-examples {
    margin-top: 8px;
}

/* 句型仿写项 */
.pattern-item {
    margin-bottom: 16px;
    padding: 14px;
    background: var(--paper-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
}

.pattern-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--accent-1);
    margin-bottom: 8px;
    font-family: var(--font-mono);
}

.pattern-original {
    font-size: 14px;
    color: var(--ink-1);
    margin: 6px 0;
    padding: 8px;
    background: var(--paper-3);
    border-radius: 6px;
}

.pattern-imitation {
    font-size: 13px;
    color: var(--ink-2);
    margin: 6px 0;
    padding-left: 12px;
    border-left: 3px solid var(--teal);
}
```

- [ ] **Step 2: 提交CSS修改**

```bash
git add css/style.css
git commit -m "feat: 添加标签和笔记内容样式"
```

---

### Task 4: 修改JS添加标签切换逻辑

**Files:**
- Modify: `js/main.js`

**需要修改的位置：**
1. `dom` 对象中添加标签和笔记容器引用
2. `state` 对象中添加当前标签状态
3. `init()` 中初始化标签切换
4. `bindEvents()` 中绑定标签点击事件
5. 新增 `switchTab()` 方法
6. 新增 `loadNotes()` 方法
7. 新增 `renderNotes()` 方法
8. 修改 `loadUnitByIndex()` 联动加载笔记

- [ ] **Step 1: 在dom对象中添加新引用（在wordPopup后添加）**

```javascript
dom = {
    // ... existing dom entries ...
    wordPopup: qs('#wordPopup'),
    wordPopupOverlay: qs('#wordPopupOverlay'),
    wordPopupClose: qs('#wordPopupClose'),
    // 新增
    viewTabs: qsa('.tab-btn'),
    pdfContainer: qs('#pdfContainer'),
    notesContainer: qs('#notesContainer')
}
```

- [ ] **Step 2: 在state对象中添加当前标签状态**

```javascript
state = {
    // ... existing state ...
    currentTab: 'pdf',  // 'pdf' 或 'notes'
    currentNotes: null   // 当前笔记JSON数据
}
```

- [ ] **Step 3: 在bindEvents方法末尾添加标签切换绑定**

```javascript
bindEvents() {
    // ... existing event bindings ...
    this.bindTabSwitching();
}
```

- [ ] **Step 4: 添加bindTabSwitching方法**

```javascript
bindTabSwitching() {
    this.dom.viewTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            this.switchTab(tab);
        });
    });
}
```

- [ ] **Step 5: 添加switchTab方法**

```javascript
switchTab(tab) {
    // 更新按钮状态
    this.dom.viewTabs.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // 更新容器显示
    if (tab === 'pdf') {
        this.dom.pdfContainer.hidden = false;
        this.dom.notesContainer.hidden = true;
    } else {
        this.dom.pdfContainer.hidden = true;
        this.dom.notesContainer.hidden = false;
        // 如果笔记未加载，则加载
        if (!this.state.currentNotes) {
            this.loadNotes();
        }
    }

    this.state.currentTab = tab;
}
```

- [ ] **Step 6: 添加loadNotes方法**

```javascript
async loadNotes() {
    const notesContainer = this.dom.notesContainer;

    // 根据当前课本和课程下标构建笔记文件路径
    const bookKeyMap = {
        'NCE1': 'NCE1',
        'NCE2': 'NCE2',
        'NCE3': 'NCE3',
        'NCE4': 'NCE4',
        'NCE1(85)': 'NCE1',
        'NCE2(85)': 'NCE2',
        'NCE3(85)': 'NCE3',
        'NCE4(85)': 'NCE4'
    };

    const bookKey = bookKeyMap[this.state.bookKey] || this.state.bookKey;
    const unit = this.state.units[this.state.currentUnitIndex];
    if (!unit) return;

    // 从unit.title或filename提取课次编号
    // 例如 filename可能是 "001-002" 或 "01"
    let lessonKey = '001';
    if (unit.filename) {
        const match = unit.filename.match(/(\d{3}-\d{3}|\d{2})/);
        if (match) {
            lessonKey = match[1];
        }
    }

    const notesPath = `notes/${bookKey}/${lessonKey}.json`;

    try {
        notesContainer.innerHTML = '<div class="notes-placeholder">加载笔记中...</div>';
        const response = await fetch(notesPath);
        if (!response.ok) {
            throw new Error('笔记加载失败');
        }
        const notes = await response.json();
        this.state.currentNotes = notes;
        this.renderNotes(notes);
    } catch (error) {
        console.error('加载笔记失败:', error);
        notesContainer.innerHTML = '<div class="notes-placeholder">暂无笔记内容</div>';
    }
}
```

- [ ] **Step 7: 添加renderNotes方法（单词用word类包裹）**

```javascript
renderNotes(notes) {
    const notesContainer = this.dom.notesContainer;

    let html = '';

    // 渲染核心词汇
    if (notes.vocabulary && notes.vocabulary.length) {
        html += '<div class="notes-section">';
        html += '<h3 class="notes-section-title">核心词汇</h3>';
        notes.vocabulary.forEach(vocab => {
            html += '<div class="vocab-item">';
            html += `<span class="vocab-word">${this.wrapWords(vocab.word)}</span>`;
            if (vocab.phonetic) {
                html += `<span class="vocab-phonetic">${vocab.phonetic}</span>`;
            }
            html += '<div class="vocab-meanings">';
            vocab.meanings.forEach(m => {
                html += '<div class="vocab-meaning">';
                html += `<span class="vocab-pos">${m.pos}</span>`;
                html += `<span class="vocab-meaning-text">${m.meaning}</span>`;
                if (m.usage) {
                    html += `<div class="vocab-usage">${m.usage}</div>`;
                }
                html += '</div>';
            });
            html += '</div></div>';
        });
        html += '</div>';
    }

    // 渲染重点短语
    if (notes.phrases && notes.phrases.length) {
        html += '<div class="notes-section">';
        html += '<h3 class="notes-section-title">重点短语</h3>';
        notes.phrases.forEach(phrase => {
            html += '<div class="phrase-item">';
            html += `<div class="phrase-text">${this.wrapWords(phrase.phrase)}</div>`;
            if (phrase.usage) {
                html += `<div class="phrase-usage">${phrase.usage}</div>`;
            }
            if (phrase.examples) {
                phrase.examples.forEach(ex => {
                    html += `<div class="phrase-example">${this.wrapWords(ex.en)} - ${ex.zh}</div>`;
                });
            }
            html += '</div>';
        });
        html += '</div>';
    }

    // 渲染语法讲解
    if (notes.grammar && notes.grammar.length) {
        html += '<div class="notes-section">';
        html += '<h3 class="notes-section-title">语法讲解</h3>';
        notes.grammar.forEach(g => {
            html += '<div class="grammar-item">';
            html += `<div class="grammar-title">${g.title}</div>`;
            if (g.definition) {
                html += `<div class="grammar-detail"><strong>定义：</strong>${g.definition}</div>`;
            }
            if (g.structure) {
                html += `<div class="grammar-detail"><strong>结构：</strong>${g.structure}</div>`;
            }
            if (g.usage) {
                html += `<div class="grammar-detail"><strong>用法：</strong>${g.usage}</div>`;
            }
            if (g.examples) {
                html += '<div class="grammar-examples">';
                g.examples.forEach(ex => {
                    html += `<div class="phrase-example">${this.wrapWords(ex.en)} - ${ex.zh}</div>`;
                });
                html += '</div>';
            }
            html += '</div>';
        });
        html += '</div>';
    }

    // 渲染句型仿写
    if (notes.sentencePatterns && notes.sentencePatterns.length) {
        html += '<div class="notes-section">';
        html += '<h3 class="notes-section-title">句型仿写</h3>';
        notes.sentencePatterns.forEach(p => {
            html += '<div class="pattern-item">';
            html += `<div class="pattern-title">${p.pattern}</div>`;
            if (p.original) {
                html += `<div class="pattern-original">原文：${this.wrapWords(p.original.en)} - ${p.original.zh}</div>`;
            }
            if (p.imitations) {
                p.imitations.forEach((im, i) => {
                    html += `<div class="pattern-imitation">仿写${i+1}：${this.wrapWords(im.en)} - ${im.zh}</div>`;
                });
            }
            html += '</div>';
        });
        html += '</div>';
    }

    notesContainer.innerHTML = html;
}
```

- [ ] **Step 8: 添加wrapWords辅助方法（将英文单词包裹为可点击span）**

```javascript
wrapWords(text) {
    // 将英文单词包裹为<span class="word">单词</span>
    return text.replace(/\b([a-zA-Z]+)\b/g, '<span class="word" data-word="$1">$1</span>');
}
```

- [ ] **Step 9: 在loadUnitByIndex方法末尾添加笔记联动加载**

```javascript
// 在 loadUnitByIndex 方法末尾，当前单元变化时重置笔记
if (this.state.currentTab === 'notes') {
    this.loadNotes();
}
```

- [ ] **Step 10: 提交JS修改**

```bash
git add js/main.js
git commit -m "feat: 添加学习笔记标签切换和渲染功能"
```

---

## Phase 3: 笔记内单词查词典

### Task 5: 绑定笔记区域的单词点击事件

**Files:**
- Modify: `js/main.js`

笔记区域的单词点击复用车已有的 `handleWordClick` 功能。

- [ ] **Step 1: 在bindLyrics方法中添加笔记区域的单词事件绑定**

在 `bindLyrics()` 方法末尾添加：

```javascript
// 笔记区域的单词点击
document.addEventListener('click', (event) => {
    if (event.target.classList.contains('word')) {
        const word = event.target.dataset.word;
        if (word) {
            this.handleWordClick(event.target, word);
        }
    }
});
```

- [ ] **Step 2: 提交修改**

```bash
git add js/main.js
git commit -m "feat: 笔记区域单词点击查词典"
```

---

## 验证检查清单

- [ ] 脚本能成功生成所有课程的笔记JSON文件
- [ ] 标签切换正常（课本/学习笔记）
- [ ] 切换到笔记标签时显示对应课程的笔记
- [ ] 切换课程后笔记内容跟着变化
- [ ] 笔记内的单词点击能弹出词典
- [ ] 页面样式与原有风格一致
- [ ] 移动端显示正常

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-18-study-notes-implementation.md`**

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
