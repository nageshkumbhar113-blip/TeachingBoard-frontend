/* global API, DB, APP, I18N */
'use strict';

const NOTES_VIEWER = (() => {
  const $ = id => document.getElementById(id);
  const _esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // Escapes HTML, then turns **bold** (as pasted straight from ChatGPT) into
  // <strong> so admin-written emphasis actually shows up bold/colored for
  // students instead of the literal asterisks.
  const _richText = s => _esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // ════════════════════════════════════════════════════════════════════════════
  // STATE
  // ════════════════════════════════════════════════════════════════════════════

  let state = {
    chapters: [],
    currentChapter: null,
    currentConcept: null,
    concepts: [],
    language: localStorage.getItem('nv_language') || 'english',
    studyMode: localStorage.getItem('nv_study_mode') || 'read',
    studentCode: null,
    initialized: false
  };

  // ════════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ════════════════════════════════════════════════════════════════════════════

  async function init() {
    if (state.initialized) return;
    state.initialized = true;

    try {
      const profile = await API.getStudentProfile();
      state.studentCode = profile?.student_code;

      _setupEventListeners();
      await _loadChapters();
      _renderUI();
    } catch (err) {
      console.error('Failed to init notes viewer:', err);
      APP.toast('Failed to load notes viewer', 'error');
    }
  }

  function _setupEventListeners() {
    $('nv-lang-en')?.addEventListener('click', () => _setLanguage('english'));
    $('nv-lang-mr')?.addEventListener('click', () => _setLanguage('marathi'));

    $('nv-mode-read')?.addEventListener('click', () => _setStudyMode('read'));
    $('nv-mode-exam')?.addEventListener('click', () => _setStudyMode('exam'));
    $('nv-mode-revision')?.addEventListener('click', () => _setStudyMode('revision'));

    $('nv-search-input')?.addEventListener('input', e => _searchConcepts(e.target.value));
    $('nv-back-btn')?.addEventListener('click', () => _goBack());
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LOAD CHAPTERS
  // ════════════════════════════════════════════════════════════════════════════

  function _applyChapters(chapters) {
    state.chapters = chapters.map(ch => ({
      chapter_id: ch.chapterId,
      name: ch.chapter || '',
      batch: [ch.standard ? `Std ${ch.standard}` : '', ch.subject].filter(Boolean).join(' · '),
      subject: ch.subject || '',
      conceptCount: ch.conceptCount || 0,
    }));
  }

  // Cache-first, background-refresh, offline-clear-error — mirrors the
  // already-proven testPlayer.js:_resolveQuizForStart() pattern. Content is
  // encrypted at rest (core/crypto.js via core/db.js) so a previously-read
  // chapter/concept stays readable offline without storing plaintext admin
  // content in the open on the device.
  async function _loadChapters() {
    try {
      const cached = await DB.getCachedChapters().catch(() => null);
      if (cached) {
        _applyChapters(cached);
        if (navigator.onLine) SYNC.refreshSlsChapters().catch(() => {});
        return;
      }
      if (navigator.onLine) {
        // Chapters come from the server (SLS concept library), not the local
        // quiz question-bank cache — the two are unrelated data sets.
        const chapters = await API.fetchSlsChapters();
        await DB.saveChaptersCache(chapters).catch(() => {});
        _applyChapters(chapters);
        return;
      }
      state.chapters = [];
      APP.toast('Internet नाही — Chapters आधी एकदा online पाहा.', 'error');
    } catch (err) {
      console.error('Failed to load chapters:', err);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LOAD CONCEPTS FOR CHAPTER
  // ════════════════════════════════════════════════════════════════════════════

  async function _loadConcepts(chapterId) {
    try {
      const cached = await DB.getCachedConcepts(chapterId).catch(() => null);
      if (cached) {
        state.concepts = cached;
        state.currentChapter = state.chapters.find(ch => ch.chapter_id === chapterId);
        if (navigator.onLine) SYNC.refreshSlsConcepts(chapterId).catch(() => {});
        return;
      }
      if (navigator.onLine) {
        state.concepts = await API.fetchSlsConcepts(chapterId);
        await DB.saveConceptsCache(chapterId, state.concepts).catch(() => {});
        state.currentChapter = state.chapters.find(ch => ch.chapter_id === chapterId);
        return;
      }
      state.concepts = [];
      APP.toast('Internet नाही — हे Chapter आधी एकदा online पाहा.', 'error');
    } catch (err) {
      console.error('Failed to load concepts:', err);
      APP.toast('Failed to load concepts', 'error');
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SEARCH CONCEPTS
  // ════════════════════════════════════════════════════════════════════════════

  async function _searchConcepts(query) {
    if (!query || query.length < 2) {
      _renderConceptsList(state.concepts);
      return;
    }
    // Search isn't cached (full-text search over the whole corpus isn't
    // something the offline cache is set up to serve) — make the offline
    // failure explicit instead of a silent console warning.
    if (!navigator.onLine) {
      APP.toast('Search साठी Internet लागतो', 'error');
      return;
    }

    try {
      _renderConceptsList(await API.searchSlsConcepts(query));
    } catch (err) {
      console.error('Search failed:', err);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW CONCEPT
  // ════════════════════════════════════════════════════════════════════════════

  async function viewConcept(conceptId) {
    try {
      const cached = await DB.getCachedConcept(conceptId).catch(() => null);
      if (cached) {
        state.currentConcept = cached;
        if (navigator.onLine) SYNC.refreshSlsConcept(conceptId).catch(() => {});
      } else if (navigator.onLine) {
        state.currentConcept = await API.fetchSlsConcept(conceptId);
        await DB.saveConceptCache(state.currentConcept).catch(() => {});
      } else {
        APP.toast('Internet नाही — ही Note आधी एकदा online उघडा.', 'error');
        return;
      }

      // _renderUI() redraws the toolbar (Back button + mode selector) and
      // clears #nv-content for hasCurrentConcept — without this, the
      // toolbar stays stuck on whatever it looked like before the concept
      // loaded, so the Back button never appears and students get stuck
      // on the note with no way out except leaving the whole Notes tab.
      _renderUI();
      _updateProgress('reading');
      _renderConcept();
    } catch (err) {
      console.error('Failed to load concept:', err);
      APP.toast('Failed to load concept', 'error');
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER CONCEPT BY STUDY MODE
  // ════════════════════════════════════════════════════════════════════════════

  function _renderConcept() {
    const concept = state.currentConcept;
    if (!concept) return;

    const lang = state.language;
    const mode = state.studyMode;
    const container = $('nv-content');
    if (!container) return;

    let html = '';

    // Header with title and language toggle
    html += `
      <div class="nv-header">
        <div class="nv-title-section">
          <h2 class="nv-title">${_esc(concept.title[lang])}</h2>
          <div class="nv-meta">
            ${concept.examTags?.map(tag => `<span class="nv-tag nv-tag-${tag}">${_tagLabel(tag)}</span>`).join('')}
          </div>
        </div>
        <div class="nv-controls">
          <button class="nv-btn-icon ${lang === 'english' ? 'active' : ''}" id="nv-lang-en-btn" title="English">🇬🇧</button>
          <button class="nv-btn-icon ${lang === 'marathi' ? 'active' : ''}" id="nv-lang-mr-btn" title="मराठी">🇮🇳</button>
          <button class="nv-btn-icon" id="nv-bookmark-btn" title="Bookmark">🔖</button>
        </div>
      </div>
    `;

    // Content based on study mode
    if (mode === 'read') {
      html += _renderReadMode(concept, lang);
    } else if (mode === 'exam') {
      html += _renderExamMode(concept, lang);
    } else if (mode === 'revision') {
      html += _renderRevisionMode(concept, lang);
    }

    container.innerHTML = html;

    // Setup event listeners
    $('nv-lang-en-btn')?.addEventListener('click', () => _setLanguage('english'));
    $('nv-lang-mr-btn')?.addEventListener('click', () => _setLanguage('marathi'));
    $('nv-bookmark-btn')?.addEventListener('click', () => _toggleBookmark());
  }

  function _renderReadMode(concept, lang) {
    const outcomes = concept.learningOutcomes?.[lang] || [];
    const blocks = concept.description?.[lang]?.blocks || [];

    let html = '<div class="nv-mode-read">';

    if (outcomes.length > 0) {
      html += '<div class="nv-section nv-outcomes">';
      html += '<h3 class="nv-section-title">📚 Learning Outcomes</h3>';
      html += '<ul>';
      outcomes.forEach(o => {
        html += `<li>${_richText(o)}</li>`;
      });
      html += '</ul></div>';
    }

    html += '<div class="nv-section nv-content-body">';
    html += _renderEditorJSBlocks(blocks);
    html += '</div>';

    // Read mode is the default landing view, so it shows everything the
    // admin filled in (Short Notes, Revision Box, Formula, Exam Tips) —
    // students shouldn't have to know to switch modes to see them. The
    // 🎯/⚡ mode buttons still work as focused, filtered views for anyone
    // who wants just the exam-prep or quick-revision subset.
    html += _renderExamMode(concept, lang);
    html += _renderRevisionMode(concept, lang);

    if (concept.attachments?.length > 0) {
      html += _renderAttachments(concept.attachments, lang);
    }

    html += '</div>';
    return html;
  }

  function _renderExamMode(concept, lang) {
    const notes = concept.shortNotes?.[lang] || [];
    const formulas = concept.revisionBox?.[lang]?.formulas || [];

    let html = '<div class="nv-mode-exam">';

    if (notes.length > 0) {
      html += '<div class="nv-section nv-key-points">';
      html += '<h3 class="nv-section-title">🔑 Key Points</h3>';
      html += '<ul>';
      notes.forEach(note => {
        html += `<li>${_richText(note)}</li>`;
      });
      html += '</ul></div>';
    }

    if (formulas.length > 0) {
      html += '<div class="nv-section nv-formulas">';
      html += '<h3 class="nv-section-title">📋 Important Formulas</h3>';
      html += '<div class="nv-formula-list">';
      formulas.forEach(f => {
        html += `<div class="nv-formula"><code>${_esc(f)}</code></div>`;
      });
      html += '</div></div>';
    }

    html += '</div>';
    return html;
  }

  function _renderRevisionMode(concept, lang) {
    const box = concept.revisionBox?.[lang] || {};

    let html = '<div class="nv-mode-revision nv-revision-box">';
    html += '<h3 class="nv-section-title">⚡ Quick Revision</h3>';

    const sections = [
      { key: 'remember', icon: '🔑', label: 'Remember' },
      { key: 'mistakes', icon: '❌', label: 'Mistakes to Avoid' },
      { key: 'formulas', icon: '📐', label: 'Formulas' },
      { key: 'examTips', icon: '💡', label: 'Exam Tips' }
    ];

    sections.forEach(({ key, icon, label }) => {
      const items = box[key] || [];
      if (items.length > 0) {
        html += `
          <div class="nv-revision-section nv-revision-${key}">
            <h4>${icon} ${label}</h4>
            <ul>
              ${items.map(item => `<li>${_richText(item)}</li>`).join('')}
            </ul>
          </div>
        `;
      }
    });

    html += '</div>';
    return html;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EDITORJS BLOCKS RENDERING
  // ════════════════════════════════════════════════════════════════════════════

  function _renderEditorJSBlocks(blocks) {
    if (!Array.isArray(blocks)) return '';

    return blocks.map(block => {
      switch (block.type) {
        case 'paragraph':
          return `<p class="nv-paragraph">${_richText(block.data?.text || '')}</p>`;

        case 'heading':
          const level = Math.min(Math.max(block.data?.level || 2, 1), 6);
          return `<h${level} class="nv-heading">${_esc(block.data?.text || '')}</h${level}>`;

        case 'image':
          const sizeWidth = { small: '40%', medium: '70%', large: '100%' }[block.data?.size] || '70%';
          return `
            <figure class="nv-figure">
              <img src="${_esc(block.data?.url || '')}" alt="${_esc(block.data?.caption || '')}" class="nv-image" style="width:${sizeWidth}">
              ${block.data?.caption ? `<figcaption>${_esc(block.data.caption)}</figcaption>` : ''}
            </figure>
          `;

        case 'table':
          const rows = (block.data?.content || [])
            .map(row => `<tr>${row.map(cell => `<td>${_esc(cell)}</td>`).join('')}</tr>`)
            .join('');
          return `<table class="nv-table"><tbody>${rows}</tbody></table>`;

        case 'note_box':
          return `<div class="nv-note-box nv-note-info">${_richText(block.data?.text || '')}</div>`;

        case 'warning_box':
          return `<div class="nv-note-box nv-note-warning">${_richText(block.data?.text || '')}</div>`;

        case 'quote':
          return `
            <blockquote class="nv-quote">
              <p>${_richText(block.data?.text || '')}</p>
              ${block.data?.caption ? `<footer>— ${_esc(block.data.caption)}</footer>` : ''}
            </blockquote>
          `;

        case 'checklist':
          const items = (block.data?.items || [])
            .map(item => `<li><input type="checkbox" ${item.checked ? 'checked' : ''} disabled> ${_esc(item.text)}</li>`)
            .join('');
          return `<ul class="nv-checklist">${items}</ul>`;

        case 'divider':
          return '<hr class="nv-divider">';

        default:
          return '';
      }
    }).join('');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ATTACHMENTS
  // ════════════════════════════════════════════════════════════════════════════

  function _renderAttachments(attachments, lang) {
    if (!attachments?.length) return '';

    let html = '<div class="nv-section nv-attachments">';
    html += '<h3 class="nv-section-title">📎 Resources</h3>';
    html += '<div class="nv-attachment-list">';

    attachments.forEach(att => {
      const icon = {
        pdf: '📄',
        image: '🖼️',
        audio: '🔊',
        video: '🎬',
        external_link: '🔗'
      }[att.type] || '📎';

      html += `
        <a href="${_esc(att.url)}" target="_blank" class="nv-attachment-item" title="${_esc(att.title)}">
          <span class="nv-att-icon">${icon}</span>
          <span class="nv-att-title">${_esc(att.title)}</span>
        </a>
      `;
    });

    html += '</div></div>';
    return html;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER UI
  // ════════════════════════════════════════════════════════════════════════════

  function _renderUI() {
    const container = $('nv-container');
    if (!container) return;

    const hasCurrentConcept = !!state.currentConcept;
    // Chapter picked but no concept open yet -> viewing that chapter's
    // concept list, one level below the top chapters grid.
    const hasCurrentChapter = !hasCurrentConcept && !!state.currentChapter;
    const showBack = hasCurrentConcept || hasCurrentChapter;

    container.innerHTML = `
      <!-- Header with controls -->
      <div class="nv-toolbar">
        <div class="nv-toolbar-left">
          ${showBack ? `<button class="nv-btn-back" id="nv-back-btn">← Back</button>` : ''}
        </div>
        <div class="nv-toolbar-center">
          <h1 class="nv-app-title">${state.currentChapter ? _esc(state.currentChapter.name) : '📚 Study Notes'}</h1>
        </div>
        <div class="nv-toolbar-right">
          ${hasCurrentConcept ? `
            <div class="nv-mode-selector">
              <button class="nv-mode-btn ${state.studyMode === 'read' ? 'active' : ''}" id="nv-mode-read" title="Full Content">📖</button>
              <button class="nv-mode-btn ${state.studyMode === 'exam' ? 'active' : ''}" id="nv-mode-exam" title="Exam Prep">🎯</button>
              <button class="nv-mode-btn ${state.studyMode === 'revision' ? 'active' : ''}" id="nv-mode-revision" title="Quick Revision">⚡</button>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Search (only at the top chapters/concepts list, not inside a chapter or a note) -->
      ${!hasCurrentConcept && !hasCurrentChapter ? `
        <div class="nv-search-bar">
          <input type="text" id="nv-search-input" class="nv-search-input" placeholder="Search concepts...">
        </div>
      ` : ''}

      <!-- Main content area — concept/chapter views fill #nv-content themselves
           right after this render (see viewConcept/selectChapter) -->
      <div id="nv-content" class="nv-content">
        ${hasCurrentConcept || hasCurrentChapter ? '' : _renderChaptersList()}
      </div>
    `;

    // Reattach event listeners
    _setupEventListeners();
  }

  function _renderChaptersList() {
    if (!state.chapters?.length) {
      return '<div class="nv-empty-state">No chapters available yet.</div>';
    }

    return `
      <div class="nv-chapters-grid">
        ${state.chapters.map(ch => `
          <div class="nv-chapter-card" onclick="NOTES_VIEWER.selectChapter('${ch.chapter_id}')">
            <div class="nv-chapter-name">${_esc(ch.name)}</div>
            <div class="nv-chapter-batch">${_esc(ch.batch)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  async function selectChapter(chapterId) {
    await _loadConcepts(chapterId);
    _renderUI();
    _showConceptsList();
  }

  // Opens straight into a specific batch/subject/chapter's notes — used by
  // the home screen's Chapter Hub. Notes chapters come from a different
  // (SLS) source than the quiz-content batch/subject/chapter data, so they
  // don't share IDs — matched here by subject + chapter name instead. If
  // this chapter has no notes yet, shows a clear empty state rather than
  // silently falling back to whatever chapter was open before.
  async function openChapter(batch, subject, chapter) {
    await init();
    const match = state.chapters.find(c => c.subject === subject && c.name === chapter);
    if (match) {
      await selectChapter(match.chapter_id);
      return;
    }
    state.currentChapter = null;
    state.currentConcept = null;
    _renderUI();
    const container = $('nv-content');
    if (container) container.innerHTML = '<div class="nv-empty-state">या प्रकरणासाठी अजून Notes उपलब्ध नाहीत.</div>';
  }

  function _showConceptsList() {
    const container = $('nv-content');
    if (!container) return;

    if (!state.concepts?.length) {
      container.innerHTML = '<div class="nv-empty-state">No concepts in this chapter yet.</div>';
      return;
    }

    _renderConceptsList(state.concepts);
  }

  function _renderConceptsList(concepts) {
    const container = $('nv-content');
    if (!container) return;

    if (!concepts?.length) {
      container.innerHTML = '<div class="nv-empty-state">No concepts found.</div>';
      return;
    }

    container.innerHTML = `
      <div class="nv-concepts-list">
        ${concepts.map(c => `
          <div class="nv-concept-item" onclick="NOTES_VIEWER.viewConcept('${c._id}')">
            <div class="nv-concept-cover">${_conceptCoverEmoji(c)}</div>
            <div class="nv-concept-body">
              <div class="nv-concept-title">${_esc(c.title?.english || c.title)}</div>
              <div class="nv-concept-meta">
                ${c.difficulty ? `<span class="nv-difficulty nv-diff-${c.difficulty}">${c.difficulty}</span>` : ''}
                ${c.examTags?.slice(0, 1).map(tag => `<span class="nv-tag">${_tagLabel(tag)}</span>`).join('')}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // One level at a time: a note open -> back to this chapter's concept list
  // (student can tap the next concept); a chapter's concept list showing ->
  // back to the top chapters grid. Previously this always cleared
  // currentChapter too, so leaving a note skipped straight past the concept
  // list to the chapters grid.
  function _goBack() {
    if (state.currentConcept) {
      state.currentConcept = null;
      _renderUI();
      _showConceptsList();
      return;
    }
    _showChapterList();
  }

  function _showChapterList() {
    state.currentConcept = null;
    state.currentChapter = null;
    _renderUI();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STUDY MODE & LANGUAGE
  // ════════════════════════════════════════════════════════════════════════════

  function _setLanguage(lang) {
    state.language = lang;
    localStorage.setItem('nv_language', lang);
    _renderConcept();
  }

  function _setStudyMode(mode) {
    state.studyMode = mode;
    localStorage.setItem('nv_study_mode', mode);
    _renderConcept();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PROGRESS & BOOKMARKS
  // ════════════════════════════════════════════════════════════════════════════

  async function _updateProgress(status) {
    if (!state.currentConcept || !state.studentCode) return;

    try {
      // Progress endpoint would be added in future
      console.log(`Progress: ${state.studentCode} - ${state.currentConcept._id} - ${status}`);
    } catch (err) {
      console.error('Failed to update progress:', err);
    }
  }

  async function _toggleBookmark() {
    if (!state.currentConcept || !state.studentCode) return;

    try {
      // Bookmark endpoint would be added in future
      APP.toast('Concept bookmarked!', 'success');
    } catch (err) {
      console.error('Failed to bookmark:', err);
      APP.toast('Failed to bookmark', 'error');
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  // Cover "art" for a book-shelf style concept card — picked from the exam
  // tag (diagram/numerical/etc.) since concepts don't carry a cover image.
  function _conceptCoverEmoji(concept) {
    const tagEmoji = {
      diagram: '🖼️', numerical: '🔢', theory: '📖',
      board_exam: '📋', important: '⭐', repeated: '🔄', mcq: '❓', viva: '🗣️',
    };
    const tag = (concept.examTags || []).find(t => tagEmoji[t]);
    return tagEmoji[tag] || '📘';
  }

  function _tagLabel(tag) {
    const labels = {
      board_exam: '📋 Board Exam',
      important: '⭐ Important',
      repeated: '🔄 Repeated',
      numerical: '🔢 Numerical',
      theory: '📚 Theory',
      diagram: '🖼️ Diagram',
      viva: '🗣️ Viva',
      mcq: '❓ MCQ'
    };
    return labels[tag] || tag;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ════════════════════════════════════════════════════════════════════════════

  return {
    init,
    viewConcept,
    selectChapter,
    openChapter
  };
})();

// Expose globally so inline onclick handlers (NOTES_VIEWER.selectChapter / .viewConcept)
// and the Notes tab wiring can reach it — top-level const is NOT visible to inline handlers.
window.NOTES_VIEWER = NOTES_VIEWER;
