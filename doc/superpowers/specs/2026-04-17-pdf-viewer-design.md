# PDF 查看功能设计文档

**需求编号**: 需求002
**日期**: 2026-04-17
**状态**: 待实现

---

## 1. 概述

在页面右侧添加 PDF 教材预览区域，用户可查看对应课本的 PDF 内容。

---

## 2. 布局调整

### 2.1 整体布局

```
┌─────────────────────────────────────────────────┐
│  Header (全宽) - 不变                            │
├─────────────────────────────────────────────────┤
│  Book info + Course selection (全宽) - 不变       │
├───────────────────────────┬─────────────────────┤
│  Player controls          │                     │
│  (宽度50%)               │   PDF Viewer        │
├───────────────────────────┤   (宽度50%)        │
│  Lyrics/Content area     │                     │
│  (宽度50%)               │                     │
└───────────────────────────┴─────────────────────┘
```

### 2.2 现有区域调整

- **Header**: 保持不变，全宽显示
- **Book info + Course selection**: 保持不变，全宽显示
- **Player controls**: 宽度改为 50%，居左显示
- **Lyrics/Content area**: 宽度改为 50%，居左显示

### 2.3 新增区域

- **PDF Viewer**: 新增区域，宽度 50%，居右显示

---

## 3. 功能描述

### 3.1 PDF 加载逻辑

1. 用户选择课本时，根据选择的课本加载对应的 PDF 文件
2. PDF 文件映射关系：
   - NCE1 English Book → pdf/新概念[第1 册].pdf
   - NCE2 English Book → pdf/新概念[第2 册].pdf
   - NCE3 English Book → pdf/新概念[第3 册].pdf
   - NCE4 English Book → pdf/新概念[第4 册].pdf

### 3.2 PDF 交互

- PDF 区域可滚动翻页
- 用户自行翻阅查找对应课程内容
- 不做页码与课程的自动对应

---

## 4. 技术实现

### 4.1 PDF 渲染库

使用 pdf.js 库，通过 CDN 引入：
```
https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
https://cdnjs.cloudflare.com.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js
```

### 4.2 文件结构

```
NCE-main/
├── pdf/
│   ├── 新概念[第1 册].pdf
│   ├── 新概念[第2 册].pdf
│   ├── 新概念[第3 册].pdf
│   └── 新概念[第4 册].pdf
├── index.html      # 添加 PDF 容器
├── css/style.css   # 添加布局样式
└── js/main.js     # 添加 PDF 加载逻辑
```

### 4.3 HTML 结构

在 index.html 的 container 内添加 PDF 容器：

```html
<div class="container">
  <!-- 左侧：Unit列表（桌面端） -->
  <aside class="unit-list desktop-only">
    ...
  </aside>

  <!-- 中间：课本选择 + 播放器和歌词 -->
  <div class="player-column">
    ...
  </div>

  <!-- 新增：右侧 PDF 预览区 -->
  <aside class="pdf-viewer desktop-only">
    <div id="pdfContainer"></div>
  </aside>
</div>
```

### 4.4 CSS 样式

```css
.container {
  display: flex;
  gap: 8px;
}

.unit-list {
  width: 200px;
  flex-shrink: 0;
}

.player-column {
  flex: 1;
  min-width: 0;
}

.pdf-viewer {
  width: 50%;
  background: var(--paper);
  border-radius: var(--radius-md);
  overflow: hidden;
}

#pdfContainer {
  width: 100%;
  height: 100%;
}

#pdfContainer canvas {
  width: 100% !important;
  height: auto !important;
}
```

### 4.5 JavaScript 逻辑

在 `ReadingSystem` 类中添加：

```javascript
class ReadingSystem {
  constructor() {
    // 现有代码...

    // PDF 相关
    this.pdfDoc = null;
    this.pdfRenderer = null;
  }

  // 切换课本时加载对应 PDF
  async applyBookChange(bookKey) {
    // 现有代码...

    // 加载 PDF
    await this.loadPDF(bookKey);
  }

  // 加载 PDF 文件
  async loadPDF(bookKey) {
    const pdfPath = this.getPDFPath(bookKey);
    // 使用 pdf.js 加载 PDF
  }

  // 获取 PDF 路径
  getPDFPath(bookKey) {
    const pdfMap = {
      'NCE1': 'pdf/新概念[第1 册].pdf',
      'NCE2': 'pdf/新概念[第2 册].pdf',
      'NCE3': 'pdf/新概念[第3 册].pdf',
      'NCE4': 'pdf/新概念[第4 册].pdf'
    };
    return pdfMap[bookKey] || null;
  }
}
```

---

## 5. 文件变更

- `index.html`: 添加 PDF 容器，引入 pdf.js CDN
- `css/style.css`: 调整 `.container` 布局，添加 `.pdf-viewer` 样式
- `js/main.js`: 添加 PDF 加载和渲染逻辑

---

## 6. 注意事项

- 保持与现有代码风格一致
- PDF 区域响应式设计，移动端可能需要隐藏或调整
- PDF 文件作为静态资源，需要部署到服务器
