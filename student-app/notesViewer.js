/* global API, DB, APP, I18N */
'use strict';

const NOTES_VIEWER = (() => {
  const $ = id => document.getElementById(id);
  const _esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

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
      const user = await DB.getCurrentUser();
      state.studentCode = user?.student_code;

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
    $('nv-back-btn')?.addEventListener('click', () => _showChapterList());
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LOAD CHAPTERS
  // ════════════════════════════════════════════════════════════════════════════

  async function _loadChapters() {
    try {
      const batches = await DB.getBatchList();
      const allChapters = [];

      for (const batch of batches) {
        const subjects = await DB.getSubjectsByBatch(batch.batch_code);
        for (const subject of subjects) {
          const chapters = await DB.getChaptersByBatchAndSubject(batch.batch_code, subject.name);
          allChapters.push(...chapters.map(ch => ({
            ...ch,
            batch: batch.batch_code,
            subject: subject.name
          })));
        }
      }

      state.chapters = allChapters;
    } catch (err) {
      console.error('Failed to load chapters:', err);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LOAD CONCEPTS FOR CHAPTER
  // ════════════════════════════════════════════════════════════════════════════

  async function _loadConcepts(chapterId) {
    try {
      state.concepts = await API.fetchSlsConcepts(chapterId);
      state.currentChapter = state.chapters.find(ch => ch.chapter_id === chapterId);
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
      state.currentConcept = await API.fetchSlsConcept(conceptId);

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
        html += `<li>${_esc(o)}</li>`;
      });
      html += '</ul></div>';
    }

    html += '<div class="nv-section nv-content-body">';
    html += _renderEditorJSBlocks(blocks);
    html += '</div>';

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
        html += `<li>${_esc(note)}</li>`;
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
          <div class="nv-revision-section">
            <h4>${icon} ${label}</h4>
            <ul>
              ${items.map(item => `<li>${_esc(item)}</li>`).join('')}
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
          return `<p class="nv-paragraph">${_esc(block.data?.text || '')}</p>`;

        case 'heading':
          const level = Math.min(Math.max(block.data?.level || 2, 1), 6);
          return `<h${level} class="nv-heading">${_esc(block.data?.text || '')}</h${level}>`;

        case 'image':
          return `
            <figure class="nv-figure">
              <img src="${_esc(block.data?.url || '')}" alt="${_esc(block.data?.caption || '')}" class="nv-image">
              ${block.data?.caption ? `<figcaption>${_esc(block.data.caption)}</figcaption>` : ''}
            </figure>
          `;

        case 'table':
          const rows = (block.data?.content || [])
            .map(row => `<tr>${row.map(cell => `<td>${_esc(cell)}</td>`).join('')}</tr>`)
            .join('');
          return `<table class="nv-table"><tbody>${rows}</tbody></table>`;

        case 'note_box':
          return `<div class="nv-note-box nv-note-info">${_esc(block.data?.text || '')}</div>`;

        case 'warning_box':
          return `<div class="nv-note-box nv-note-warning">${_esc(block.data?.text || '')}</div>`;

        case 'quote':
          return `
            <blockquote class="nv-quote">
              <p>${_esc(block.data?.text || '')}</p>
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

    container.innerHTML = `
      <!-- Header with controls -->
      <div class="nv-toolbar">
        <div class="nv-toolbar-left">
          ${hasCurrentConcept ? `<button class="nv-btn-back" id="nv-back-btn">← Back</button>` : ''}
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

      <!-- Search (when showing chapters/concepts list) -->
      ${!hasCurrentConcept ? `
        <div class="nv-search-bar">
          <input type="text" id="nv-search-input" class="nv-search-input" placeholder="Search concepts...">
        </div>
      ` : ''}

      <!-- Main content area -->
      <div id="nv-content" class="nv-content">
        ${hasCurrentConcept ? '' : _renderChaptersList()}
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
    _showConceptsList();
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
            <div class="nv-concept-title">${_esc(c.title?.english || c.title)}</div>
            <div class="nv-concept-meta">
              ${c.difficulty ? `<span class="nv-difficulty nv-diff-${c.difficulty}">${c.difficulty}</span>` : ''}
              ${c.examTags?.slice(0, 2).map(tag => `<span class="nv-tag">${_tagLabel(tag)}</span>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
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
    selectChapter
  };
})();

// Expose globally so inline onclick handlers (NOTES_VIEWER.selectChapter / .viewConcept)
// and the Notes tab wiring can reach it — top-level const is NOT visible to inline handlers.
window.NOTES_VIEWER = NOTES_VIEWER;
