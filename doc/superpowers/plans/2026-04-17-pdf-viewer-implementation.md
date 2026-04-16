# PDF 查看功能实现计划

> **Goal:** 在页面右侧添加 PDF 教材预览区域，用户可查看对应课本的 PDF 内容

> **Architecture:** 使用 pdf.js 库通过 CDN 引入，前端渲染 PDF。布局采用 flexbox，左侧保留现有播放器+歌词区域(50%)，右侧新增 PDF 预览区(50%)

> **Tech Stack:** pdf.js (CDN), HTML, CSS, JavaScript

---

## 文件结构

- Modify: `index.html` - 添加 PDF 容器，引入 pdf.js CDN
- Modify: `css/style.css` - 调整布局容器样式，添加 PDF viewer 样式
- Modify: `js/main.js` - 添加 PDF 加载、渲染、切换逻辑

---

## 实现步骤

### Task 1: 修改 index.html - 添加 PDF 容器和 CDN 引入

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 在 `<head>` 中引入 pdf.js CDN**

在 `<link rel="stylesheet" href="css/style.css" />` 之后添加：

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
  // 设置 pdf.js worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
</script>
```

- [ ] **Step 2: 在 container 内添加 PDF 容器**

在 `</div><!-- /container -->` 之前添加：

```html
<!-- 新增：右侧 PDF 预览区 -->
<aside class="pdf-viewer desktop-only">
  <div id="pdfContainer">
    <div class="pdf-placeholder">选择一个课本开始学习...</div>
  </div>
</aside>
```

- [ ] **Step 3: 提交**

```bash
git add index.html
git commit -m "feat: add pdf viewer container and pdf.js cdn"
```

---

### Task 2: 修改 css/style.css - 添加 PDF viewer 样式

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: 修改 .container 布局为 flex**

找到现有的 `.container` 样式（如有），替换为：

```css
.container {
  display: flex;
  gap: 8px;
  flex: 1;
  overflow: hidden;
}
```

- [ ] **Step 2: 添加 .player-column 宽度限制**

```css
.player-column {
  width: 50%;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

- [ ] **Step 3: 添加 .pdf-viewer 样式**

在文件末尾添加：

```css
/* PDF Viewer */
.pdf-viewer {
  width: 50%;
  flex-shrink: 0;
  background: var(--paper);
  border-radius: var(--radius-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

#pdfContainer {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  gap: 8px;
}

#pdfContainer canvas {
  max-width: 100%;
  height: auto !important;
  box-shadow: var(--shadow-sm);
}

.pdf-placeholder {
  color: var(--ink-3);
  text-align: center;
  padding: 40px 20px;
  font-size: 14px;
}

/* 移动端隐藏 PDF 区域 */
@media (max-width: 768px) {
  .pdf-viewer {
    display: none;
  }
  .player-column {
    width: 100%;
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add css/style.css
git commit -m "feat: add pdf viewer layout styles"
```

---

### Task 3: 修改 js/main.js - 添加 PDF 加载逻辑

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: 在构造函数中添加 PDF 相关属性**

在 `constructor()` 的 `this.state = {...}` 之后，`this.dom = {...}` 之前添加：

```javascript
// PDF 相关
this.pdfDoc = null;
this.pdfCache = new Map();
```

- [ ] **Step 2: 添加 getPDFPath 方法**

在 `loadBooks()` 方法之后添加：

```javascript
// 获取 PDF 路径
getPDFPath(bookKey) {
  const pdfMap = {
    'NCE1': 'pdf/新概念[第1 册].pdf',
    'NCE2': 'pdf/新概念[第2 册].pdf',
    'NCE3': 'pdf/新概念[第3 册].pdf',
    'NCE4': 'pdf/新概念[第4 册].pdf',
    'NCE1(85)': 'pdf/新概念[第1 册].pdf',
    'NCE2(85)': 'pdf/新概念[第2 册].pdf',
    'NCE3(85)': 'pdf/新概念[第3 册].pdf',
    'NCE4(85)': 'pdf/新概念[第4 册].pdf'
  };
  return pdfMap[bookKey] || null;
}
```

- [ ] **Step 3: 添加 loadPDF 方法**

```javascript
// 加载 PDF 文件
async loadPDF(bookKey) {
  const pdfContainer = qs('#pdfContainer');
  if (!pdfContainer) return;

  const pdfPath = this.getPDFPath(bookKey);

  if (!pdfPath) {
    pdfContainer.innerHTML = '<div class="pdf-placeholder">未找到对应教材</div>';
    return;
  }

  // 显示加载状态
  pdfContainer.innerHTML = '<div class="pdf-placeholder">加载教材中...</div>';

  try {
    // 检查缓存
    if (this.pdfCache.has(pdfPath)) {
      await this.renderPDF(this.pdfCache.get(pdfPath), pdfContainer);
      return;
    }

    // 加载 PDF
    const loadingTask = pdfjsLib.getDocument(pdfPath);
    const pdf = await loadingTask.promise;

    // 缓存
    this.pdfCache.set(pdfPath, pdf);

    await this.renderPDF(pdf, pdfContainer);
  } catch (error) {
    console.error('PDF 加载失败:', error);
    pdfContainer.innerHTML = '<div class="pdf-placeholder">教材加载失败</div>';
  }
}
```

- [ ] **Step 4: 添加 renderPDF 方法**

```javascript
// 渲染 PDF
async renderPDF(pdf, container) {
  container.innerHTML = '';

  // 只渲染前几页，避免一次性加载太多
  const maxPages = 5;
  const pagesToRender = Math.min(pdf.numPages, maxPages);

  for (let i = 1; i <= pagesToRender; i++) {
    const page = await pdf.getPage(i);
    const scale = container.clientWidth / page.getViewport({ scale: 1 }).width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext('2d');
    await page.render({ canvasContext: context, viewport }).promise;

    container.appendChild(canvas);
  }

  if (pdf.numPages > maxPages) {
    const moreDiv = document.createElement('div');
    moreDiv.className = 'pdf-placeholder';
    moreDiv.textContent = `共 ${pdf.numPages} 页，显示前 ${maxPages} 页，请滚动查看更多`;
    container.appendChild(moreDiv);
  }
}
```

- [ ] **Step 5: 在 applyBookChange 方法中调用 loadPDF**

找到 `applyBookChange` 方法，在方法末尾（`await this.loadUnitFromStorage()` 之后）添加：

```javascript
// 加载 PDF
await this.loadPDF(bookKey);
```

- [ ] **Step 6: 提交**

```bash
git add js/main.js
git commit -m "feat: add pdf loading and rendering logic"
```

---

### Task 4: 测试和验证

- [ ] **Step 1: 在浏览器中打开页面测试**

1. 选择 NCE1 课本
2. 确认右侧 PDF 区域显示教材内容
3. 切换到 NCE2，确认 PDF 切换
4. 测试移动端布局是否正常隐藏

- [ ] **Step 2: 最终提交**

```bash
git add -A
git commit -m "feat: complete pdf viewer feature"
```

---

## 自检清单

- [ ] Spec 覆盖：每个需求部分都有对应的任务实现
- [ ] 无占位符：没有 TBD、TODO、待实现等
- [ ] 类型一致：方法名、参数一致
- [ ] 文件路径正确：所有路径与实际项目结构匹配
