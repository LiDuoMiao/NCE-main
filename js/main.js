// Author: Qim
// Blog: https://ichochy.com
// Email: Qim.it@icloud.com
// FileName: iReader:main.js
// Update: 2025/12/5 19:41
// Copyright (c) 2025.

const DEFAULT_BOOK_KEY = 'NCE1';
const PLAY_MODE_STORAGE_KEY = 'playMode';
const BOOK_SELECTION_STORAGE_KEY = 'selectedBookKey';

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));


class ReadingSystem {
  constructor() {
    this.state = {
      books: [],
      units: [],
      bookPath: '',
      bookKey: '',
      currentLyrics: [],
      currentLyricIndex: -1,
      currentUnitIndex: -1,
      playMode: 'single',
      singlePlayEndTime: null,
      playbackRate: 1.0,
      translationMode: 'show',
      availableSpeeds: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0],
      savedPlayTime: 0,
      isProgressDragging: false,
      currentTab: 'pdf',
      currentNotes: null
    };

    // PDF 相关
    this.pdfDoc = null;
    this.pdfCache = new Map();
    this.currentPDF = null;
    this.currentPDFContainer = null;
    this.currentRenderedPage = 0;
    this.isRendering = false;

    this.dom = {
      audioPlayer: qs('#audioPlayer'),
      lyricsDisplay: qs('#lyricsDisplay'),
      lyricsContainer: qs('.lyrics-container'),
      bookName: qs('#bookName'),
      bookLevel: qs('#bookLevel'),
      unitList: qs('#unitListContainer'),
      playModeBtn: qs('#playModeBtn'),
      playPauseBtn: qs('#playPauseBtn'),
      progressBar: qs('#progressBar'),
      currentTime: qs('#currentTime'),
      duration: qs('#duration'),
      speedBtn: qs('#speedBtn'),
      speedText: qs('#speedText'),
      bookCover: qs('#bookCover'),
      unitSelect: qs('#unitSelect'),
      bookSelects: qsa('.book-select'),
      prevUnitBtn: qs('#prevUnitBtn'),
      nextUnitBtn: qs('#nextUnitBtn'),
      toggleTranslationBtn: qs('#toggleTranslationBtn'),
      wordPopup: qs('#wordPopup'),
      wordPopupOverlay: qs('#wordPopupOverlay'),
      wordPopupClose: qs('#wordPopupClose'),
      viewTabs: qsa('.tab-btn'),
      pdfContainer: qs('#pdfContainer'),
      notesContainer: qs('#notesContainer')
    };

    this.lyricLineEls = [];
    this.unitSelectBound = false;
    this.unitListBound = false;
    this.bookSelectsBound = false;
    this.lyricsBound = false;
    this.lrcCache = new Map();
    this.audioPreload = new Map();
    // 翻译缓存，避免重复翻译相同内容
    this.translateCache = new Map();

    this.init();
  }

  async init() {
    await this.loadBooks();
    await this.applyBookFromHash();
    this.bindEvents();
    this.loadPlayModePreference();
    this.updatePlayModeUI();
    this.loadTranslationPreference();
    this.updateTranslationToggle();
    await this.loadUnitFromStorage();
  }

  async loadBooks() {
    if (this.state.books.length) return this.state.books;
    try {
      const response = await fetch('data.json');
      const data = await response.json();
      this.state.books = Array.isArray(data.books) ? data.books : [];
    } catch (error) {
      console.error('加载课本数据失败:', error);
      this.state.books = [];
    }
    return this.state.books;
  }

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

  // 加载 PDF 文件
  async loadPDF(bookKey) {
    const pdfContainer = qs('#pdfContainer');
    if (!pdfContainer) return;

    const pdfPath = this.getPDFPath(bookKey);

    if (!pdfPath) {
      pdfContainer.innerHTML = '<div class="pdf-placeholder">未找到对应教材</div>';
      return;
    }

    // 移除之前的滚动监听
    if (this.pdfScrollHandler) {
      pdfContainer.removeEventListener('scroll', this.pdfScrollHandler);
    }

    // 显示加载状态
    pdfContainer.innerHTML = '<div class="pdf-placeholder">加载教材中...</div>';

    try {
      // 检查缓存
      let pdf;
      if (this.pdfCache.has(pdfPath)) {
        pdf = this.pdfCache.get(pdfPath);
      } else {
        // 加载 PDF
        const loadingTask = pdfjsLib.getDocument(pdfPath);
        pdf = await loadingTask.promise;
        // 缓存
        this.pdfCache.set(pdfPath, pdf);
      }

      // 保存当前 PDF 和容器引用
      this.currentPDF = pdf;
      this.currentPDFContainer = pdfContainer;
      this.currentRenderedPage = 0;

      // 初始渲染前几页
      await this.renderMorePages();

      // 添加滚动监听
      this.pdfScrollHandler = () => {
        if (this.isRendering) return;
        const { scrollTop, scrollHeight, clientHeight } = pdfContainer;
        if (scrollTop + clientHeight >= scrollHeight - 100) {
          this.renderMorePages();
        }
      };
      pdfContainer.addEventListener('scroll', this.pdfScrollHandler);
    } catch (error) {
      console.error('PDF 加载失败:', error);
      pdfContainer.innerHTML = '<div class="pdf-placeholder">教材加载失败</div>';
    }
  }

  // 渲染更多页面
  async renderMorePages() {
    if (!this.currentPDF || !this.currentPDFContainer || this.isRendering) return;

    const container = this.currentPDFContainer;
    const pdf = this.currentPDF;
    const pageSize = 10; // 每次加载10页
    const startPage = this.currentRenderedPage + 1;
    const endPage = Math.min(startPage + pageSize - 1, pdf.numPages);

    if (startPage > pdf.numPages) return;

    this.isRendering = true;

    try {
      for (let i = startPage; i <= endPage; i++) {
        const page = await pdf.getPage(i);
        const scale = container.clientWidth / page.getViewport({ scale: 1 }).width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const context = canvas.getContext('2d');
        await page.render({ canvasContext: context, viewport }).promise;

        // 在加载提示之前插入
        const placeholder = container.querySelector('.pdf-placeholder');
        if (placeholder) {
          container.insertBefore(canvas, placeholder);
        } else {
          container.appendChild(canvas);
        }
      }

      this.currentRenderedPage = endPage;

      // 更新或移除加载提示
      let placeholder = container.querySelector('.pdf-placeholder');
      if (endPage >= pdf.numPages) {
        if (placeholder) placeholder.remove();
      } else {
        if (!placeholder) {
          placeholder = document.createElement('div');
          placeholder.className = 'pdf-placeholder';
          container.appendChild(placeholder);
        }
        placeholder.textContent = `共 ${pdf.numPages} 页，已加载 ${endPage} 页，滚动加载更多...`;
      }
    } catch (error) {
      console.error('渲染 PDF 页失败:', error);
    }

    this.isRendering = false;
  }

  resolveBookByKey(bookKey) {
    if (!this.state.books.length) return null;
    const exact = this.state.books.find((book) => book && book.key === bookKey);
    if (exact && exact.bookPath) return exact;
    const fallback = this.state.books.find((book) => book && book.key === DEFAULT_BOOK_KEY);
    if (fallback && fallback.bookPath) return fallback;
    return this.state.books.find((book) => book && book.bookPath) || null;
  }

  async applyBookFromHash() {
    const keyFromHash = location.hash.slice(1).trim();
    const storedBookKey = this.loadBookPreference();
    const initialBookKey = keyFromHash || storedBookKey || DEFAULT_BOOK_KEY;
    await this.applyBookChange(initialBookKey);
  }

  loadBookPreference() {
    return localStorage.getItem(BOOK_SELECTION_STORAGE_KEY)?.trim() || '';
  }

  persistBookPreference(bookKey) {
    if (!bookKey) return;
    localStorage.setItem(BOOK_SELECTION_STORAGE_KEY, bookKey);
  }

  async applyBookChange(bookKey) {
    await this.loadBooks();
    const resolved = this.resolveBookByKey(bookKey);

    if (!resolved || !resolved.bookPath) {
      this.state.bookPath = '';
      this.state.bookKey = '';
      this.renderEmptyState('未找到可用课本数据');
      return;
    }

    this.state.bookKey = resolved.key || bookKey;
    this.state.bookPath = resolved.bookPath.trim();
    this.persistBookPreference(this.state.bookKey);

    this.updateBookSelects();
    await this.loadBookConfig();
    this.renderUnitList();
    this.renderUnitSelect();
    this.resetUnitListScroll();

    // 加载 PDF
    await this.loadPDF(bookKey);
  }

  renderEmptyState(message) {
    if (this.dom.lyricsDisplay) {
      this.dom.lyricsDisplay.innerHTML = `<p class="placeholder">${message}</p>`;
    }
    if (this.dom.unitList) {
      this.dom.unitList.innerHTML = '';
    }
    this.resetUnitListScroll();
  }

  resetUnitListScroll() {
    const scrollContainer = this.dom.unitList?.closest('.unit-list');
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
  }

  async loadBookConfig() {
    if (!this.state.bookPath) {
      this.renderEmptyState('未找到可用课本数据');
      return;
    }

    try {
      const response = await fetch(`${this.state.bookPath}/book.json`);
      const data = await response.json();

      this.state.units = data.units.map((unit, index) => ({
        ...unit,
        id: index + 1,
        title: unit.title,
        audio: `${this.state.bookPath}/${unit.filename}.mp3`,
        lrc: `${this.state.bookPath}/${unit.filename}.lrc`
      }));

      if (this.dom.bookName) {
        this.dom.bookName.textContent = `《${data.bookName}》`;
      }
      if (this.dom.bookLevel) {
        this.dom.bookLevel.textContent = `${data.bookLevel}`;
      }
      if (this.dom.bookCover && data.bookCover) {
        this.dom.bookCover.src = `${this.state.bookPath}/${data.bookCover}`;
      }
      this.lrcCache.clear();
      this.audioPreload.clear();
    } catch (error) {
      console.error('加载课件配置失败:', error);
      this.renderEmptyState(`课件配置加载失败，请检查 ${this.state.bookPath}/book.json 文件`);
    }
  }

  updateBookSelects() {
    if (!this.dom.bookSelects.length || !this.state.books.length) return;

    const options = this.state.books
      .filter((book) => book && book.key && book.title && book.bookPath)
      .map((book) => `<option value="${book.key}">${book.title}</option>`)
      .join('');

    this.dom.bookSelects.forEach((select) => {
      select.innerHTML = `${options}`;
      if (this.state.bookKey) {
        select.value = this.state.bookKey;
      }
    });
  }

  renderUnitList() {
    if (!this.dom.unitList) return;

    this.dom.unitList.innerHTML = this.state.units
      .map(
        (unit, index) => `
      <div class="unit-item" data-unit-index="${index}" tabindex="0" role="button" aria-label="打开 ${unit.title}">
        <h3>${unit.title}</h3>
      </div>
    `
      )
      .join('');
  }

  renderUnitSelect() {
    if (!this.dom.unitSelect) return;

    const options = this.state.units
      .map((unit, index) => `<option value="${index}">${unit.title}</option>`)
      .join('');

    this.dom.unitSelect.innerHTML = `${options}`;
  }

  async loadUnitFromStorage() {
    if (!this.state.units.length) return;

    const stored = localStorage.getItem(`${this.state.bookPath}/currentUnitIndex`);
    const parsed = stored ? parseInt(stored) : 0;
    const safeIndex = Number.isFinite(parsed)
      ? clamp(parsed, 0, this.state.units.length - 1)
      : 0;

    await this.loadUnitByIndex(safeIndex, { shouldScrollUnitIntoView: true });
  }

  async loadUnitByIndex(unitIndex, options = {}) {
    const { shouldScrollUnitIntoView = false } = options;

    this.state.currentUnitIndex = unitIndex;
    localStorage.setItem(`${this.state.bookPath}/currentUnitIndex`, unitIndex);

    const unit = this.state.units[unitIndex];
    if (!unit) return;

    this.resetPlayer();
    this.updateActiveUnit(unitIndex, { shouldScrollUnitIntoView });
    this.updateNavigationButtons();

    try {
      let lrcText = this.lrcCache.get(unit.lrc);
      if (!lrcText) {
        const response = await fetch(unit.lrc);
        lrcText = await response.text();
        this.lrcCache.set(unit.lrc, lrcText);
      }
      this.state.currentLyrics = LRCParser.parse(lrcText);
      this.renderLyrics();
    } catch (error) {
      console.error('加载歌词失败:', error);
      if (this.dom.lyricsDisplay) {
        this.dom.lyricsDisplay.innerHTML = '<p class="placeholder">加载失败</p>';
      }
    }

    if (this.dom.audioPlayer) {
      this.setPlayButtonDisabled(true);
      this.dom.audioPlayer.src = unit.audio;
      this.dom.audioPlayer.load();
    }

    this.loadPlayTime();
    this.loadSavedSpeed();
    this.prefetchUnit(unitIndex + 1);

    // 在 loadUnitByIndex 方法末尾，当前单元变化时重置笔记
    if (this.state.currentTab === 'notes') {
      this.loadNotes();
    }
  }

  resetPlayer() {
    if (this.dom.audioPlayer) {
      this.dom.audioPlayer.pause();
      this.dom.audioPlayer.currentTime = 0;
    }

    this.setPlayButtonDisabled(true);

    if (this.dom.progressBar) this.dom.progressBar.style.setProperty('--progress', '0%');
    if (this.dom.currentTime) this.dom.currentTime.textContent = '0:00';
    if (this.dom.duration) this.dom.duration.textContent = '0:00';

    this.updatePlayButton();
    this.state.currentLyricIndex = -1;
    this.state.singlePlayEndTime = null;
  }

  updateActiveUnit(unitIndex, options = {}) {
    const { shouldScrollUnitIntoView = false } = options;

    if (this.dom.unitList) {
      let activeItem = null;

      this.dom.unitList.querySelectorAll('.unit-item').forEach((item, index) => {
        if (index === unitIndex) {
          item.classList.add('active');
          activeItem = item;
        } else {
          item.classList.remove('active');
        }
      });

      if (activeItem && shouldScrollUnitIntoView) {
        activeItem.scrollIntoView({ block: 'center', inline: 'nearest' });
      }
    }

    if (this.dom.unitSelect) {
      this.dom.unitSelect.value = unitIndex;
    }
  }

  renderLyrics() {
    if (!this.dom.lyricsDisplay) return;

    if (this.dom.lyricsContainer) {
      this.dom.lyricsContainer.scrollTop = 0;
    }

    if (!this.state.currentLyrics.length) {
      this.dom.lyricsDisplay.innerHTML = '<p class="placeholder">没有歌词数据</p>';
      return;
    }

    this.dom.lyricsDisplay.innerHTML = this.state.currentLyrics
      .map(
        (lyric, index) => `
      <div class="lyric-line" data-index="${index}" data-time="${lyric.time}" tabindex="0" role="button" aria-label="播放第 ${index + 1} 句">
        <div class="lyric-content">
          <div class="lyric-text">${this.wrapWordsWithSpan(lyric.english)}</div>
          ${lyric.chinese ? `<div class="lyric-translation">${lyric.chinese}</div>` : ''}
        </div>
        <button class="lyric-play-btn" data-index="${index}" data-time="${lyric.time}" aria-label="播放第 ${index + 1} 句">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
      </div>
    `
      )
      .join('');

    this.lyricLineEls = qsa('.lyric-line', this.dom.lyricsDisplay);
    this.state.currentLyricIndex = -1;
  }

  wrapWordsWithSpan(text) {
    if (!text) return '';
    return text
      .split(/(\s+)/)
      .map(part => {
        if (part.trim() === '') return part;
        const word = part.trim().replace(/[^a-zA-Z]/g, '');
        return `<span class="word" data-word="${word.toLowerCase()}">${part}</span>`;
      })
      .join('');
  }

  handleLyricActivate(line) {
    const index = parseInt(line.dataset.index);
    const time = parseFloat(line.dataset.time);
    this.playLyricAtIndex(index, time);
    this.persistPlayTime(time);
  }

  playLyricAtIndex(index, time) {
    if (!this.dom.audioPlayer) return;

    this.dom.audioPlayer.currentTime = time;

    if (this.state.playMode === 'single') {
      const nextLyric = this.state.currentLyrics[index + 1];
      this.state.singlePlayEndTime = nextLyric ? nextLyric.time : this.dom.audioPlayer.duration;
    } else {
      this.state.singlePlayEndTime = null;
    }

    this.dom.audioPlayer.play();
  }

  persistPlayTime(time) {
    localStorage.setItem(`${this.state.bookPath}/${this.state.currentUnitIndex}/playTime`, time);
  }

  checkSinglePlayEnd() {
    if (this.state.playMode !== 'single' || this.state.singlePlayEndTime === null || !this.dom.audioPlayer) {
      return;
    }

    const currentTime = this.dom.audioPlayer.currentTime;
    if (currentTime >= this.state.singlePlayEndTime && this.state.singlePlayEndTime !== this.dom.audioPlayer.duration) {
      this.dom.audioPlayer.pause();
      this.dom.audioPlayer.currentTime = this.state.singlePlayEndTime - 0.01;
      this.state.singlePlayEndTime = null;
    }
  }

  updateProgress() {
    if (!this.dom.progressBar || !this.dom.audioPlayer) return;

    if (this.dom.audioPlayer.duration && !this.state.isProgressDragging) {
      const percent = (this.dom.audioPlayer.currentTime / this.dom.audioPlayer.duration) * 100;
      this.dom.progressBar.style.setProperty('--progress', `${percent}%`);
      if (this.dom.currentTime) {
        this.dom.currentTime.textContent = this.formatTime(this.dom.audioPlayer.currentTime);
      }
    }
  }

  updateDuration() {
    if (!this.dom.audioPlayer) return;

    if (this.dom.duration) {
      this.dom.duration.textContent = this.formatTime(this.dom.audioPlayer.duration);
    }
    if (this.state.savedPlayTime > 0 && this.dom.audioPlayer.duration) {
      this.dom.audioPlayer.currentTime = Math.min(this.state.savedPlayTime, this.dom.audioPlayer.duration - 0.1);
      this.state.savedPlayTime = 0;
      this.updateProgress();
    }
  }

  updatePlayButton() {
    if (!this.dom.playPauseBtn || !this.dom.audioPlayer) return;

    if (this.dom.audioPlayer.paused) {
      this.dom.playPauseBtn.classList.remove('playing');
    } else {
      this.dom.playPauseBtn.classList.add('playing');
    }
  }

  setPlayButtonDisabled(disabled) {
    if (!this.dom.playPauseBtn) return;
    this.dom.playPauseBtn.disabled = disabled;
    this.dom.playPauseBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  }

  formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  cyclePlaybackSpeed() {
    const currentIndex = this.state.availableSpeeds.indexOf(this.state.playbackRate);
    const nextIndex = (currentIndex + 1) % this.state.availableSpeeds.length;
    this.state.playbackRate = this.state.availableSpeeds[nextIndex];

    if (this.dom.audioPlayer) {
      this.dom.audioPlayer.playbackRate = this.state.playbackRate;
    }

    this.updateSpeedButton();
    localStorage.setItem('playbackRate', this.state.playbackRate);
  }

  updateSpeedButton() {
    if (!this.dom.speedText || !this.dom.speedBtn) return;

    this.dom.speedText.textContent = `${this.state.playbackRate}x`;

    if (this.state.playbackRate !== 1.0) {
      this.dom.speedBtn.classList.add('active');
    } else {
      this.dom.speedBtn.classList.remove('active');
    }
  }

  loadPlayTime() {
    const time = localStorage.getItem(`${this.state.bookPath}/${this.state.currentUnitIndex}/playTime`);
    if (time) {
      const parsed = parseFloat(time);
      if (Number.isFinite(parsed)) {
        this.state.savedPlayTime = parsed;
      }
    }
  }

  loadSavedSpeed() {
    const savedSpeed = localStorage.getItem('playbackRate');
    if (savedSpeed) {
      const parsed = parseFloat(savedSpeed);
      if (!Number.isFinite(parsed)) return;
      this.state.playbackRate = parsed;
      if (this.dom.audioPlayer) {
        this.dom.audioPlayer.playbackRate = this.state.playbackRate;
      }
      this.updateSpeedButton();
    }
  }

  updateNavigationButtons() {
    if (this.dom.prevUnitBtn) {
      this.dom.prevUnitBtn.disabled = this.state.currentUnitIndex <= 0;
    }

    if (this.dom.nextUnitBtn) {
      this.dom.nextUnitBtn.disabled = this.state.currentUnitIndex >= this.state.units.length - 1;
    }
  }

  loadPreviousUnit() {
    if (this.state.currentUnitIndex > 0) {
      this.loadUnitByIndex(this.state.currentUnitIndex - 1);
    }
  }

  loadNextUnit() {
    if (this.state.currentUnitIndex < this.state.units.length - 1) {
      this.loadUnitByIndex(this.state.currentUnitIndex + 1);
    }
  }

  togglePlayMode() {
    this.state.playMode = this.state.playMode === 'single' ? 'continuous' : 'single';
    localStorage.setItem(PLAY_MODE_STORAGE_KEY, this.state.playMode);
    this.updatePlayModeUI();
  }

  updatePlayModeUI() {
    if (!this.dom.playModeBtn) return;

    if (this.state.playMode === 'single') {
      this.dom.playModeBtn.title = '单句点读';
      this.dom.playModeBtn.setAttribute('aria-label', '单句点读');
      this.dom.playModeBtn.setAttribute('aria-pressed', 'false');
      this.dom.playModeBtn.dataset.mode = 'single';
      this.dom.playModeBtn.classList.remove('continuous-mode');
    } else {
      this.dom.playModeBtn.title = '连续点读';
      this.dom.playModeBtn.setAttribute('aria-label', '连续点读');
      this.dom.playModeBtn.setAttribute('aria-pressed', 'true');
      this.dom.playModeBtn.dataset.mode = 'continuous';
      this.dom.playModeBtn.classList.add('continuous-mode');
    }
  }

  loadPlayModePreference() {
    const storedMode = localStorage.getItem(PLAY_MODE_STORAGE_KEY);
    if (storedMode === 'single' || storedMode === 'continuous') {
      this.state.playMode = storedMode;
    }
  }

  handleAudioEnded() {
    if (this.state.playMode === 'continuous') {
      this.playNextLyric();
    }
  }

  playNextLyric() {
    const nextIndex = this.state.currentLyricIndex + 1;
    if (nextIndex < this.state.currentLyrics.length && this.dom.audioPlayer) {
      const nextLyric = this.state.currentLyrics[nextIndex];
      this.dom.audioPlayer.currentTime = nextLyric.time;
      this.dom.audioPlayer.play();
    }
  }

  updateLyricHighlight() {
    if (!this.lyricLineEls.length || !this.dom.audioPlayer) return;

    const currentTime = this.dom.audioPlayer.currentTime;
    let newIndex = -1;
    for (let i = this.state.currentLyrics.length - 1; i >= 0; i--) {
      if (currentTime >= this.state.currentLyrics[i].time) {
        newIndex = i;
        break;
      }
    }

    if (newIndex === this.state.currentLyricIndex) return;

    if (this.state.currentLyricIndex >= 0 && this.lyricLineEls[this.state.currentLyricIndex]) {
      this.lyricLineEls[this.state.currentLyricIndex].classList.remove('active');
      this.lyricLineEls[this.state.currentLyricIndex].classList.remove('pulse');
    }

    this.state.currentLyricIndex = newIndex;

    if (newIndex >= 0) {
      const activeLine = this.lyricLineEls[newIndex];
      if (activeLine) {
        activeLine.classList.add('active');
        activeLine.classList.add('pulse');
        if (this.shouldScrollLyricIntoView(activeLine)) {
          activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }

  prefetchUnit(unitIndex) {
    const unit = this.state.units[unitIndex];
    if (!unit) return;

    if (unit.lrc && !this.lrcCache.has(unit.lrc)) {
      fetch(unit.lrc)
        .then((response) => response.text())
        .then((text) => this.lrcCache.set(unit.lrc, text))
        .catch(() => {});
    }

    if (unit.audio && !this.audioPreload.has(unit.audio)) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = unit.audio;
      this.audioPreload.set(unit.audio, audio);
    }
  }

  shouldScrollLyricIntoView(activeLine) {
    if (!this.dom.lyricsContainer) return true;
    const containerRect = this.dom.lyricsContainer.getBoundingClientRect();
    const lineRect = activeLine.getBoundingClientRect();
    const topThreshold = containerRect.top + containerRect.height * 0.22;
    const bottomThreshold = containerRect.bottom - containerRect.height * 0.22;
    return lineRect.top < topThreshold || lineRect.bottom > bottomThreshold;
  }

  bindEvents() {
    this.bindBookSelects();
    this.bindUnitList();
    this.bindUnitSelect();
    this.bindLyrics();
    this.bindPlayerControls();
    this.bindNavigation();
    this.bindTranslationToggle();
    this.bindWordPopupEvents();
    this.bindTabSwitching();

    // 笔记区域的单词点击
    document.addEventListener('click', (event) => {
      if (event.target.classList.contains('word')) {
        const word = event.target.dataset.word;
        if (word) {
          this.handleWordClick(event.target, word);
        }
      }
    });

    window.addEventListener('hashchange', () => {
      const newKey = location.hash.slice(1).trim() || DEFAULT_BOOK_KEY;
      if (newKey === this.state.bookKey) return;
      this.applyBookChange(newKey).then(() => this.loadUnitFromStorage());
    });
  }

  bindWordPopupEvents() {
    // 关闭按钮
    if (this.dom.wordPopupClose) {
      this.dom.wordPopupClose.addEventListener('click', () => {
        this.hideWordPopup();
      });
    }

    // 点击遮罩层关闭
    if (this.dom.wordPopupOverlay) {
      this.dom.wordPopupOverlay.addEventListener('click', () => {
        this.hideWordPopup();
      });
    }

    // ESC 键关闭
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.dom.wordPopup && !this.dom.wordPopup.hidden) {
        this.hideWordPopup();
      }
    });

    // 发音按钮
    const pronBtns = document.querySelectorAll('.pron-btn');
    pronBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const word = this.dom.wordPopup?.querySelector('.popup-word')?.textContent;
        const lang = btn.dataset.lang;
        if (word && lang) {
          this.playPronunciation(word, lang);
        }
      });
    });
  }

  bindTabSwitching() {
    this.dom.viewTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });
  }

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

  wrapWords(text) {
    // 将英文单词包裹为<span class="word">单词</span>
    return text.replace(/\b([a-zA-Z]+)\b/g, '<span class="word" data-word="$1">$1</span>');
  }

  bindTranslationToggle() {
    if (!this.dom.toggleTranslationBtn) return;
    this.dom.toggleTranslationBtn.addEventListener('click', () => {
      const modes = ['show', 'hide', 'blur'];
      const currentIndex = modes.indexOf(this.state.translationMode);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % modes.length;
      this.state.translationMode = modes[nextIndex];
      localStorage.setItem('translationMode', this.state.translationMode);
      this.updateTranslationToggle();
    });
  }

  loadTranslationPreference() {
    const storedMode = localStorage.getItem('translationMode');
    if (storedMode === 'show' || storedMode === 'hide' || storedMode === 'blur') {
      this.state.translationMode = storedMode;
    }
  }

  updateTranslationToggle() {
    if (!this.dom.toggleTranslationBtn) return;
    const mode = this.state.translationMode;
    document.body.classList.toggle('hide-translation', mode === 'hide');
    document.body.classList.toggle('blur-translation', mode === 'blur');

    if (mode === 'show') {
      this.dom.toggleTranslationBtn.textContent = '中';
      this.dom.toggleTranslationBtn.setAttribute('aria-pressed', 'true');
      this.dom.toggleTranslationBtn.setAttribute('aria-label', '翻译显示');
    } else if (mode === 'blur') {
      this.dom.toggleTranslationBtn.textContent = '模';
      this.dom.toggleTranslationBtn.setAttribute('aria-pressed', 'mixed');
      this.dom.toggleTranslationBtn.setAttribute('aria-label', '翻译模糊显示');
    } else {
      this.dom.toggleTranslationBtn.textContent = '英';
      this.dom.toggleTranslationBtn.setAttribute('aria-pressed', 'false');
      this.dom.toggleTranslationBtn.setAttribute('aria-label', '仅显示英文');
    }
  }

  bindBookSelects() {
    if (this.bookSelectsBound || !this.dom.bookSelects.length) return;
    this.bookSelectsBound = true;

    this.dom.bookSelects.forEach((select) => {
      select.addEventListener('change', (event) => {
        const target = event.target;
        if (!target.value) return;
        if (location.hash.slice(1) === target.value) return;
        location.hash = target.value;
      });
    });
  }

  bindUnitList() {
    if (this.unitListBound || !this.dom.unitList) return;
    this.unitListBound = true;

    this.dom.unitList.addEventListener('click', (event) => {
      const item = event.target.closest('.unit-item');
      if (!item) return;
      const unitIndex = parseInt(item.dataset.unitIndex);
      this.loadUnitByIndex(unitIndex);
    });

    this.dom.unitList.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const item = event.target.closest('.unit-item');
      if (!item) return;
      event.preventDefault();
      const unitIndex = parseInt(item.dataset.unitIndex);
      this.loadUnitByIndex(unitIndex);
    });
  }

  bindUnitSelect() {
    if (this.unitSelectBound || !this.dom.unitSelect) return;
    this.unitSelectBound = true;

    this.dom.unitSelect.addEventListener('change', (event) => {
      const unitIndex = parseInt(event.target.value);
      if (unitIndex >= 0) {
        this.loadUnitByIndex(unitIndex);
      }
    });
  }

  bindLyrics() {
    if (this.lyricsBound || !this.dom.lyricsDisplay) return;
    this.lyricsBound = true;

    // 播放按钮点击事件
    this.dom.lyricsDisplay.addEventListener('click', (event) => {
      const playBtn = event.target.closest('.lyric-play-btn');
      if (playBtn) {
        event.stopPropagation();
        const index = parseInt(playBtn.dataset.index);
        const time = parseFloat(playBtn.dataset.time);
        this.playLyricAtIndex(index, time);
        this.persistPlayTime(time);
        return;
      }

      // 单词点击事件
      const wordEl = event.target.closest('.word');
      if (wordEl) {
        event.stopPropagation();
        const word = wordEl.dataset.word;
        this.showWordPopup(word);
        return;
      }

      // 行点击事件
      const line = event.target.closest('.lyric-line');
      if (!line) return;
      this.handleLyricActivate(line);
    });

    this.dom.lyricsDisplay.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const line = event.target.closest('.lyric-line');
      if (!line) return;
      event.preventDefault();
      this.handleLyricActivate(line);
    });
  }

  showWordPopup(word) {
    const popup = qs('#wordPopup');
    const overlay = qs('#wordPopupOverlay');
    if (!popup) return;

    // 显示加载状态
    const wordEl = popup.querySelector('.popup-word');
    const phoneticEl = popup.querySelector('.popup-phonetic');
    const posEl = popup.querySelector('.popup-pos');
    const meaningEl = popup.querySelector('.popup-meaning');
    const examplesEl = popup.querySelector('.popup-examples');

    if (wordEl) wordEl.textContent = word;
    if (phoneticEl) phoneticEl.textContent = '加载中...';
    if (posEl) posEl.textContent = '';
    if (meaningEl) meaningEl.textContent = '加载翻译...';
    if (examplesEl) examplesEl.innerHTML = '';

    popup.hidden = false;
    if (overlay) overlay.hidden = false;

    // 调用 MyMemory API 获取翻译
    this.fetchTranslation(word);
  }

  // POS 中文映射
  static POS_LABELS = {
    'noun': '名',
    'verb': '动',
    'adjective': '形',
    'adverb': '副',
    'pronoun': '代',
    'preposition': '介',
    'conjunction': '连',
    'interjection': '叹',
    'determiner': '冠',
    'phrase': '短语'
  };

  // 简化词性标签
  getPosLabel(pos) {
    return ReadingSystem.POS_LABELS[pos.toLowerCase()] || pos;
  }

  // 获取完整的词性标签
  getPosFullLabel(pos) {
    const labels = {
      'noun': '名词',
      'verb': '动词',
      'adjective': '形容词',
      'adverb': '副词',
      'pronoun': '代词',
      'preposition': '介词',
      'conjunction': '连词',
      'interjection': '感叹词',
      'determiner': '限定词',
      'phrase': '短语'
    };
    return labels[pos.toLowerCase()] || pos;
  }

  // 使用 LibreTranslate API 翻译短句为中文（带缓存）
  async translateToChinese(text) {
    if (!text || !text.trim()) return Promise.resolve('');

    // 检查缓存
    if (this.translateCache.has(text)) {
      return this.translateCache.get(text);
    }

    try {
      const response = await fetch('http://localhost:5001/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: 'en',
          target: 'zh'
        })
      });
      if (!response.ok) return null;
      const data = await response.json();
      const result = data.translatedText || null;

      // 存入缓存
      if (result) {
        this.translateCache.set(text, result);
      }

      return result;
    } catch (e) {
      // 忽略错误
    }
    return null;
  }

  // 使用 LibreTranslate API 翻译单词并获取 alternatives
  async translateWordWithAlternatives(word) {
    try {
      const response = await fetch('http://localhost:5001/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: word,
          source: 'en',
          target: 'zh',
          alternatives: 5
        })
      });
      if (!response.ok) return null;
      const data = await response.json();
      return {
        translatedText: data.translatedText || '',
        alternatives: data.alternatives || []
      };
    } catch (e) {
      // 忽略错误
    }
    return null;
  }

  async fetchTranslation(word) {
    const popup = qs('#wordPopup');
    if (!popup) return;

    const phoneticEl = popup.querySelector('.popup-phonetic');
    const posEl = popup.querySelector('.popup-pos');
    const meaningEl = popup.querySelector('.popup-meaning');
    const examplesEl = popup.querySelector('.popup-examples');
    const alternativesEl = popup.querySelector('.popup-alternatives');

    // 先清空所有内容，避免缓存问题
    if (phoneticEl) phoneticEl.innerHTML = '';
    if (posEl) posEl.textContent = '';
    if (meaningEl) meaningEl.innerHTML = '';
    if (examplesEl) examplesEl.innerHTML = '';
    if (alternativesEl) alternativesEl.innerHTML = '';

    // 显示加载状态
    if (phoneticEl) phoneticEl.innerHTML = '<span class="loading-text">加载中...</span>';
    if (meaningEl) meaningEl.innerHTML = '<span class="loading-text">加载翻译...</span>';

    try {
      // 并行调用两个主 API
      const [dictResponse, wordTranslateResult] = await Promise.all([
        fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`),
        this.translateWordWithAlternatives(word)
      ]);

      let ukPhonetic = '';
      let usPhonetic = '';
      let pos = '';
      let examples = [];
      let wordTranslation = '';
      let wordAlternatives = [];

      // 按词性分组的中文释义
      let meaningsByPos = {};
      let posKeys = [];

      // 解析 Free Dictionary API 响应
      if (dictResponse.ok) {
        const dictData = await dictResponse.json();
        console.log('Free Dictionary API 响应:', JSON.stringify(dictData, null, 2));
        if (dictData && dictData.length > 0) {
          const entry = dictData[0];

          // 获取各语言的音标
          if (entry.phonetics && entry.phonetics.length > 0) {
            entry.phonetics.forEach(ph => {
              if (ph.text) {
                if (ph.text.includes('UK') || ph.text.includes('/kə/')) {
                  ukPhonetic = ph.text;
                } else if (ph.text.includes('US') || ph.text.includes('/kə/')) {
                  usPhonetic = ph.text;
                }
              }
            });
            if (!ukPhonetic || !usPhonetic) {
              const ph = entry.phonetics.find(p => p.text);
              if (ph && ph.text) {
                if (!ukPhonetic) ukPhonetic = ph.text;
                if (!usPhonetic) usPhonetic = ph.text;
              }
            }
          }

          if (!ukPhonetic && entry.phonetic) ukPhonetic = entry.phonetic;
          if (!usPhonetic && entry.phonetic) usPhonetic = entry.phonetic;

          // 收集词性和释义，并按 POS 分组
          if (entry.meanings) {
            entry.meanings.forEach(meaning => {
              const posText = meaning.partOfSpeech;
              if (!meaningsByPos[posText]) {
                meaningsByPos[posText] = [];
              }
              meaning.definitions.forEach(def => {
                meaningsByPos[posText].push({
                  definition: def.definition,
                  chineseDefinition: null,
                  example: def.example || '',
                  chineseExample: null
                });
              });
            });
          }

          // 设置词性标签
          posKeys = Object.keys(meaningsByPos);
          if (posKeys.length > 0) {
            pos = posKeys.map(p => `${this.getPosLabel(p)} (${p})`).join(' | ');
          }

          // 收集例句
          examples = [];
          posKeys.forEach(p => {
            meaningsByPos[p].forEach(m => {
              if (m.example) {
                examples.push(m.example);
              }
            });
          });
          examples = examples.slice(0, 3);

          // 限制每个 POS 只翻译前 2 个定义
          const MAX_DEFS_PER_POS = 2;
          for (const posKey of posKeys) {
            meaningsByPos[posKey] = meaningsByPos[posKey].slice(0, MAX_DEFS_PER_POS);
          }
        }
      }

      // 解析 LibreTranslate API 响应（单词中文翻译）
      if (wordTranslateResult) {
        console.log('LibreTranslate API 响应 (单词翻译):', JSON.stringify(wordTranslateResult, null, 2));
        wordTranslation = wordTranslateResult.translatedText || '';
        wordAlternatives = wordTranslateResult.alternatives || [];
      }

      // ========== 第一阶段：立即显示已获取的内容 ==========
      // 显示音标
      if (phoneticEl) {
        phoneticEl.innerHTML = `
          <span class="pron-item">
            <span class="pron-label">EN</span>
            <button class="pron-btn" data-lang="uk" data-word="${word}" title="英式发音">🔊</button>
            <span class="pron-phonetic">${ukPhonetic || '/' + word + '/'}</span>
          </span>
          <span class="pron-item">
            <span class="pron-label">US</span>
            <button class="pron-btn" data-lang="us" data-word="${word}" title="美式发音">🔊</button>
            <span class="pron-phonetic">${usPhonetic || '/' + word + '/'}</span>
          </span>
        `;
      }

      // 显示 alternatives
      if (alternativesEl) {
        if (wordAlternatives && wordAlternatives.length > 0) {
          alternativesEl.innerHTML = `<div class="alternatives-list">${wordAlternatives.join(' | ')}</div>`;
        } else {
          alternativesEl.innerHTML = '';
        }
      }

      // 显示英文释义（不等待中文翻译）
      if (posEl) posEl.textContent = '';
      if (meaningEl) {
        meaningEl.innerHTML = this.buildEnglishMeaningsHTML(word, wordTranslation, meaningsByPos, posKeys);
      }
      if (examplesEl) examplesEl.innerHTML = '';

      // 重新绑定发音按钮事件
      const pronBtns = popup.querySelectorAll('.pron-btn');
      pronBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const w = btn.dataset.word;
          const lang = btn.dataset.lang;
          if (w && lang) {
            this.playPronunciation(w, lang);
          }
        });
      });

      // ========== 第二阶段：后台翻译，完成后更新中文释义 ==========
      this.translateAndUpdateMeanings(word, meaningsByPos, posKeys, wordTranslation);

    } catch (error) {
      console.error('翻译 API 调用失败:', error);
      if (meaningEl) meaningEl.textContent = '网络错误，请检查网络连接';
    }
  }

  // 构建英文释义HTML（不含中文，用于第一阶段显示）
  buildEnglishMeaningsHTML(word, wordTranslation, meaningsByPos, posKeys) {
    if (Object.keys(meaningsByPos).length > 0) {
      const groupedMeanings = [];
      posKeys.forEach(posKey => {
        const defs = meaningsByPos[posKey];
        const firstDef = defs[0];
        const posFull = this.getPosFullLabel(posKey);
        const englishDef = firstDef?.definition || '';
        const englishExample = firstDef?.example || '';

        let html = `<div class="pos-group">`;
        html += `<div class="pos-label">${posFull} (${posKey})</div>`;
        html += `<div class="pos-english">英文释义：${englishDef || wordTranslation || ''}</div>`;
        if (englishExample) {
          html += `<div class="pos-example">例句：${englishExample}</div>`;
        }
        html += `<div class="pos-chinese loading">中文：加载中...</div>`;
        html += `</div>`;
        groupedMeanings.push(html);
      });
      return groupedMeanings.join('');
    } else if (wordTranslation) {
      return `<div class="pos-group"><div class="pos-chinese loading">中文：${wordTranslation}</div></div>`;
    } else {
      return '<div class="pos-group">未找到翻译</div>';
    }
  }

  // 后台翻译释义，完成后更新UI
  async translateAndUpdateMeanings(word, meaningsByPos, posKeys, wordTranslation) {
    const popup = qs('#wordPopup');
    if (!popup) return;

    const meaningEl = popup.querySelector('.popup-meaning');

    // 收集所有待翻译文本
    const textsToTranslate = [];
    const textMappings = [];

    for (const posKey of posKeys) {
      for (const def of meaningsByPos[posKey]) {
        if (def.definition) {
          textsToTranslate.push(def.definition);
          textMappings.push({ def, field: 'chineseDefinition' });
        } else {
          textsToTranslate.push('');
          textMappings.push({ def, field: 'chineseDefinition', isEmpty: true });
        }
        if (def.example) {
          textsToTranslate.push(def.example);
          textMappings.push({ def, field: 'chineseExample' });
        } else if (def.definition) {
          textsToTranslate.push('');
          textMappings.push({ def, field: 'chineseExample', isEmpty: true });
        }
      }
    }

    // 过滤空文本，只保留有效翻译任务
    const validMappings = textMappings.filter((m, i) => textsToTranslate[i] !== '');

    try {
      // 一次翻译所有文本
      const combinedText = textsToTranslate.join('\n');
      const translatedResult = await this.translateToChinese(combinedText);

      console.log('翻译结果:', translatedResult);

      // 拆分结果并写回
      if (translatedResult) {
        const translatedParts = translatedResult.split('\n');
        let validIndex = 0;
        translatedParts.forEach((t, i) => {
          if (textMappings[i] && !textMappings[i].isEmpty) {
            textMappings[i].def[textMappings[i].field] = t;
          }
        });
      }

      // ========== 第三阶段：用翻译结果更新UI ==========
      if (Object.keys(meaningsByPos).length > 0) {
        const groupedMeanings = [];
        posKeys.forEach(posKey => {
          const defs = meaningsByPos[posKey];
          const firstDef = defs[0];
          const posFull = this.getPosFullLabel(posKey);

          const chineseWord = firstDef?.chineseDefinition || wordTranslation || '';
          const englishDef = firstDef?.definition || '';
          const chineseExample = firstDef?.chineseExample || '';
          const englishExample = firstDef?.example || '';

          let html = `<div class="pos-group">`;
          html += `<div class="pos-label">${posFull} (${posKey})</div>`;
          html += `<div class="pos-chinese">中文：${chineseWord}</div>`;
          html += `<div class="pos-english">英文释义：${englishDef}</div>`;
          if (englishExample) {
            html += `<div class="pos-example">例句：${englishExample}</div>`;
            if (chineseExample) {
              html += `<div class="pos-trans">翻译：${chineseExample}</div>`;
            }
          }
          html += `</div>`;
          groupedMeanings.push(html);
        });
        if (meaningEl) meaningEl.innerHTML = groupedMeanings.join('');
      } else if (wordTranslation) {
        if (meaningEl) meaningEl.innerHTML = `<div class="pos-group"><div class="pos-chinese">中文：${wordTranslation}</div></div>`;
      }
    } catch (error) {
      console.error('释义翻译失败:', error);
      // 翻译失败时显示英文释义
      if (meaningEl) {
        meaningEl.innerHTML = this.buildEnglishMeaningsHTML(word, wordTranslation, meaningsByPos, posKeys).replace('加载中...', '翻译失败');
      }
    }
  }

  playPronunciation(word, lang) {
    // 使用 Free Dictionary API 的音频
    const audioUrl = lang === 'uk'
      ? `https://api.dictionaryapi.dev/media/pronunciations/en/${word}-uk.mp3`
      : `https://api.dictionaryapi.dev/media/pronunciations/en/${word}-us.ogg`;

    const audio = new Audio(audioUrl);
    audio.play().catch(() => {
      // 如果失败，使用 Web Speech API
      this.playWithSpeechSynthesis(word, lang === 'uk' ? 'en-GB' : 'en-US');
    });
  }

  playWithSpeechSynthesis(word, lang) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = lang;
      utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    }
  }

  hideWordPopup() {
    const popup = qs('#wordPopup');
    const overlay = qs('#wordPopupOverlay');
    if (popup) popup.hidden = true;
    if (overlay) overlay.hidden = true;
  }

  handleWordClick(element, word) {
    this.showWordPopup(word);
  }

  bindPlayerControls() {
    if (
      !this.dom.playPauseBtn ||
      !this.dom.speedBtn ||
      !this.dom.progressBar ||
      !this.dom.audioPlayer ||
      !this.dom.playModeBtn
    ) {
      return;
    }

    this.dom.playPauseBtn.addEventListener('click', () => {
      if (this.dom.audioPlayer.paused) {
        this.dom.audioPlayer.play();
      } else {
        this.dom.audioPlayer.pause();
      }
    });

    this.dom.speedBtn.addEventListener('click', () => {
      this.cyclePlaybackSpeed();
    });

    const seekByClientX = (clientX) => {
      if (!this.dom.audioPlayer.duration) return;
      const rect = this.dom.progressBar.getBoundingClientRect();
      const percent = clamp((clientX - rect.left) / rect.width, 0, 1);
      this.dom.audioPlayer.currentTime = percent * this.dom.audioPlayer.duration;
    };

    this.dom.progressBar.addEventListener('click', (event) => {
      seekByClientX(event.clientX);
    });

    this.dom.progressBar.addEventListener('pointerdown', (event) => {
      this.state.isProgressDragging = true;
      this.dom.progressBar.classList.add('dragging');
      this.dom.progressBar.setPointerCapture(event.pointerId);
      seekByClientX(event.clientX);
    });

    this.dom.progressBar.addEventListener('pointermove', (event) => {
      if (!this.state.isProgressDragging) return;
      seekByClientX(event.clientX);
    });

    this.dom.progressBar.addEventListener('pointerup', (event) => {
      this.state.isProgressDragging = false;
      this.dom.progressBar.classList.remove('dragging');
      this.dom.progressBar.releasePointerCapture(event.pointerId);
    });

    this.dom.progressBar.addEventListener('pointercancel', () => {
      this.state.isProgressDragging = false;
      this.dom.progressBar.classList.remove('dragging');
    });

    this.dom.progressBar.addEventListener('pointerleave', () => {
      this.state.isProgressDragging = false;
      this.dom.progressBar.classList.remove('dragging');
    });

    this.dom.playModeBtn.addEventListener('click', () => {
      this.togglePlayMode();
    });

    this.dom.audioPlayer.addEventListener('timeupdate', () => {
      this.checkSinglePlayEnd();
      this.updateLyricHighlight();
      this.updateProgress();
    });

    this.dom.audioPlayer.addEventListener('loadedmetadata', () => {
      this.updateDuration();
    });

    this.dom.audioPlayer.addEventListener('canplay', () => {
      this.setPlayButtonDisabled(false);
    });

    this.dom.audioPlayer.addEventListener('loadstart', () => {
      this.setPlayButtonDisabled(true);
    });

    this.dom.audioPlayer.addEventListener('ended', () => {
      this.handleAudioEnded();
      this.updatePlayButton();
    });

    this.dom.audioPlayer.addEventListener('play', () => {
      this.updatePlayButton();
    });

    this.dom.audioPlayer.addEventListener('pause', () => {
      this.state.singlePlayEndTime = null;
      this.updatePlayButton();
    });

    this.dom.audioPlayer.addEventListener('error', () => {
      this.setPlayButtonDisabled(true);
    });
  }

  bindNavigation() {
    if (this.dom.prevUnitBtn) {
      this.dom.prevUnitBtn.addEventListener('click', () => {
        this.loadPreviousUnit();
      });
    }

    if (this.dom.nextUnitBtn) {
      this.dom.nextUnitBtn.addEventListener('click', () => {
        this.loadNextUnit();
      });
    }
  }
}

// 初始化系统
document.addEventListener('DOMContentLoaded', () => {
  new ReadingSystem();
  initThemeToggle();
  initSupportModal();
});

// 主题切换功能
function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
  if (!themeToggle) return;

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || (!savedTheme && prefersDark.matches)) {
    document.body.classList.add('dark-theme');
  }

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    themeToggle.style.transform = 'rotate(360deg)';
    setTimeout(() => {
      themeToggle.style.transform = '';
    }, 300);
  });

  prefersDark.addEventListener('change', (event) => {
    if (!localStorage.getItem('theme')) {
      if (event.matches) {
        document.body.classList.add('dark-theme');
      } else {
        document.body.classList.remove('dark-theme');
      }
    }
  });
}

function initSupportModal() {
  const supportBtn = document.getElementById('supportBtn');
  const supportModal = document.getElementById('supportModal');
  const supportCloseBtn = document.getElementById('supportCloseBtn');

  if (!supportBtn || !supportModal || !supportCloseBtn) {
    return;
  }

  const openModal = () => {
    supportModal.classList.add('open');
    supportModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    supportModal.classList.remove('open');
    supportModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  supportBtn.addEventListener('click', openModal);
  supportCloseBtn.addEventListener('click', closeModal);

  supportModal.addEventListener('click', (event) => {
    if (event.target === supportModal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && supportModal.classList.contains('open')) {
      closeModal();
    }
  });
}



// LRC 解析器
class LRCParser {
  static parse(lrcText) {
    const lines = lrcText.split('\n');
    const lyrics = [];

    for (const line of lines) {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.+)/);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const milliseconds = parseInt(match[3]);
        const time = minutes * 60 + seconds + milliseconds / 1000 - 0.5;

        // 分割英文和中文（使用 | 分隔符）
        const text = match[4].trim();
        const parts = text.split('|').map((p) => p.trim());

        lyrics.push({
          time,
          english: parts[0] || '',
          chinese: parts[1] || '',
          fullText: text
        });
      }
    }

    return lyrics.sort((a, b) => a.time - b.time);
  }
}
