/* global API, DB, APP, I18N */
'use strict';

const CONCEPT_MANAGER = (() => {
  const $ = id => document.getElementById(id);
  const _esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  // ════════════════════════════════════════════════════════════════════════════
  // STATE
  // ════════════════════════════════════════════════════════════════════════════

  let _batch = '';
  let _subject = '';
  let _chapter = '';
  let _chapterId = '';
  let _currentConcept = null;
  let _concepts = [];
  let _editorInstance = null;
  let _initialized = false;

  // ════════════════════════════════════════════════════════════════════════════
  // UI HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  function _show(id) {
    const el = $(id);
    if (el) el.classList.remove('hidden');
  }

  function _hide(id) {
    const el = $(id);
    if (el) el.classList.add('hidden');
  }

  function _setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text ?? '';
  }

  function _setValue(id, value) {
    const el = $(id);
    if (el) el.value = value ?? '';
  }

  function _getValue(id) {
    const el = $(id);
    return el ? el.value : '';
  }

  // ════════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ════════════════════════════════════════════════════════════════════════════

  async function init() {
    if (_initialized) return;
    _initialized = true;

    _setupEventListeners();
    _populateBatches();
  }

  function _setupEventListeners() {
    // Batch/Subject/Chapter dropdowns
    $('cm-batch-sel')?.addEventListener('change', e => _onBatchChange(e.target.value));
    $('cm-subject-sel')?.addEventListener('change', e => _onSubjectChange(e.target.value));
    $('cm-chapter-sel')?.addEventListener('change', e => _onChapterChange(e.target.value));

    // Concept CRUD buttons
    $('cm-new-btn')?.addEventListener('click', () => _createNewConcept());
    $('cm-save-btn')?.addEventListener('click', () => _saveConcept());
    $('cm-publish-btn')?.addEventListener('click', () => _publishConcept());
    $('cm-delete-btn')?.addEventListener('click', () => _deleteConcept());
    $('cm-cancel-btn')?.addEventListener('click', () => _cancelEdit());

    // Attachment buttons
    $('cm-add-attachment-btn')?.addEventListener('click', () => $('cm-attachment-upload')?.click());
    $('cm-attachment-upload')?.addEventListener('change', e => _handleAttachmentUpload(e));

    // Short notes
    $('cm-add-note-btn')?.addEventListener('click', () => _addShortNote());

    // Revision box
    $('cm-add-remember-btn')?.addEventListener('click', () => _addRevisionItem('remember'));
    $('cm-add-mistake-btn')?.addEventListener('click', () => _addRevisionItem('mistakes'));
    $('cm-add-formula-btn')?.addEventListener('click', () => _addRevisionItem('formulas'));
    $('cm-add-tip-btn')?.addEventListener('click', () => _addRevisionItem('examTips'));

    // Auto-translate
    $('cm-translate-btn')?.addEventListener('click', () => _autoTranslate());

    // Exam tags
    _setupExamTagsCheckboxes();
  }

  // Deterministic chapterId — same logical chapter always maps to the same
  // id, regardless of which admin device/session created it locally.
  function _makeChapterId(batch, subject, chapter) {
    const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '-');
    return `${norm(batch)}::${norm(subject)}::${norm(chapter)}`;
  }

  // "Std 8" -> 8, "8th" -> 8, "BASIC"/"Live Server" (no digits) -> null
  function _parseStandard(batch) {
    const m = String(batch || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DROPDOWNS
  // ════════════════════════════════════════════════════════════════════════════

  async function _populateBatches() {
    const sel = $('cm-batch-sel');
    if (!sel) return;

    try {
      const batches = await DB.getAllBatches();
      sel.innerHTML = '<option value="">Select Batch</option>';
      batches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.name;
        opt.textContent = b.name;
        sel.appendChild(opt);
      });
    } catch (err) {
      console.error('Failed to load batches:', err);
      APP.toast('Failed to load batches', 'error');
    }
  }

  async function _onBatchChange(batch) {
    _batch = batch;
    _subject = '';
    _chapter = '';
    _chapterId = '';
    _concepts = [];
    _currentConcept = null;

    const subjectSel = $('cm-subject-sel');
    subjectSel.innerHTML = '<option value="">Select Subject</option>';
    subjectSel.disabled = true;
    $('cm-chapter-sel').innerHTML = '<option value="">Select Chapter</option>';
    $('cm-chapter-sel').disabled = true;
    _renderConceptsList([]);
    _hideEditor();

    if (!batch) return;

    try {
      const subs = await DB.getSubjectsByBatch(batch);
      subs.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = s.name;
        subjectSel.appendChild(opt);
      });
      // Re-enable now that real options exist — the HTML starts these
      // selects `disabled` (nothing to pick before a batch is chosen), but
      // nothing was ever re-enabling them, so subject/chapter pickers never
      // opened on Android even though the options were populated correctly.
      subjectSel.disabled = false;
    } catch (err) {
      console.error('Failed to load subjects:', err);
    }
  }

  async function _onSubjectChange(subject) {
    _subject = subject;
    _chapter = '';
    _chapterId = '';
    _concepts = [];
    _currentConcept = null;

    const chapterSel = $('cm-chapter-sel');
    chapterSel.innerHTML = '<option value="">Select Chapter</option>';
    chapterSel.disabled = true;
    _renderConceptsList([]);
    _hideEditor();

    if (!_batch || !subject) return;

    try {
      const chapters = await DB.getChaptersByBatchSubject(_batch, subject);
      chapters.forEach(ch => {
        const opt = document.createElement('option');
        // Stable, deterministic chapterId (not the local auto-increment id —
        // that's per-device/session and would orphan concepts on reinstall
        // or when a different admin device creates the "same" chapter).
        opt.value = _makeChapterId(_batch, subject, ch.name);
        opt.textContent = ch.name;
        opt.dataset.name = ch.name;
        chapterSel.appendChild(opt);
      });
      chapterSel.disabled = false;
    } catch (err) {
      console.error('Failed to load chapters:', err);
    }
  }

  async function _onChapterChange(chapterId) {
    _chapterId = chapterId;
    _concepts = [];
    _currentConcept = null;
    _hideEditor();

    const sel = $('cm-chapter-sel');
    _chapter = sel.options[sel.selectedIndex]?.dataset.name || '';

    if (!chapterId) {
      _renderConceptsList([]);
      return;
    }

    try {
      // Empty status = no filter (admin sees draft + published + archived).
      _concepts = await API.fetchAdminChapterConcepts(chapterId, '');
      _renderConceptsList(_concepts);
    } catch (err) {
      console.error('Failed to load concepts:', err);
      APP.toast('Failed to load concepts', 'error');
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CONCEPTS LIST
  // ════════════════════════════════════════════════════════════════════════════

  function _renderConceptsList(concepts) {
    const list = $('cm-concepts-list');
    if (!list) return;

    if (!concepts.length) {
      list.innerHTML = '<div class="empty-state">No concepts yet. Create one to begin.</div>';
      return;
    }

    list.innerHTML = concepts.map(c => `
      <div class="concept-item" data-id="${c._id}">
        <div class="concept-info">
          <h4>${_esc(c.title.english)}</h4>
          <p class="concept-meta">
            Order #${c.order} •
            <span class="status-badge status-${c.status}">${c.status}</span>
          </p>
        </div>
        <div class="concept-actions">
          <button class="btn-icon" title="Edit" onclick="CONCEPT_MANAGER.editConcept('${c._id}')">✏️</button>
          <button class="btn-icon" title="Delete" onclick="CONCEPT_MANAGER.deleteConcept('${c._id}')">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CREATE / EDIT CONCEPT
  // ════════════════════════════════════════════════════════════════════════════

  function _createNewConcept() {
    if (!_chapterId) {
      APP.toast('Please select a chapter first', 'info');
      return;
    }

    _currentConcept = {
      _id: null,
      chapterId: _chapterId,
      language: 'english',
      title: { english: '', marathi: '' },
      learningOutcomes: { english: [], marathi: [] },
      description: { english: { blocks: [] }, marathi: { blocks: [] } },
      shortNotes: { english: [], marathi: [] },
      revisionBox: {
        english: { remember: [], mistakes: [], formulas: [], examTips: [] },
        marathi: { remember: [], mistakes: [], formulas: [], examTips: [] }
      },
      attachments: [],
      examTags: [],
      difficulty: 'easy',
      status: 'draft',
      // Ties this concept to the SAME batch/subject/chapter taxonomy as
      // quizzes/words/tests, so the student "Notes" chapter list (grouped
      // by aiContext) actually reflects what was picked here.
      aiContext: {
        board: 'CBSE',
        standard: _parseStandard(_batch),
        medium: 'english',
        subject: _subject,
        chapter: _chapter
      }
    };

    _showEditor();
    _renderEditor();
  }

  async function editConcept(conceptId) {
    try {
      _currentConcept = await API.fetchAdminConcept(conceptId);
      _showEditor();
      _renderEditor();
    } catch (err) {
      console.error('Failed to edit concept:', err);
      APP.toast('Failed to load concept', 'error');
    }
  }

  function _renderEditor() {
    const concept = _currentConcept;
    const editor = $('cm-editor-form');
    if (!editor) return;

    editor.innerHTML = `
      <div class="editor-header">
        <div class="form-group">
          <label>Title (English) *</label>
          <input type="text" id="cm-title-en" value="${_esc(concept.title.english)}" placeholder="Enter concept title" class="form-input">
        </div>
        <div class="form-group">
          <label>Title (Marathi)</label>
          <input type="text" id="cm-title-mr" value="${_esc(concept.title.marathi)}" placeholder="शीर्षक (मराठी)" class="form-input">
        </div>
      </div>

      <div class="editor-section">
        <h3>Language Type</h3>
        <div class="radio-group">
          <label><input type="radio" name="language" value="english" ${concept.language === 'english' ? 'checked' : ''}> English Only</label>
          <label><input type="radio" name="language" value="marathi" ${concept.language === 'marathi' ? 'checked' : ''}> Marathi Only</label>
          <label><input type="radio" name="language" value="bilingual" ${concept.language === 'bilingual' ? 'checked' : ''}> Bilingual</label>
        </div>
      </div>

      <div class="editor-section">
        <h3>Learning Outcomes</h3>
        <div id="cm-outcomes-list" class="items-list"></div>
        <button type="button" id="cm-add-outcome-btn" class="btn btn-small">+ Add Outcome</button>
      </div>

      <div class="editor-section">
        <h3>Content (Description)</h3>
        <div id="cm-blocks-list" class="cm-blocks-list"></div>
        <div class="cm-blocks-add-row">
          <button type="button" id="cm-add-para-btn" class="btn btn-small">+ Add Paragraph</button>
          <button type="button" id="cm-add-image-btn" class="btn btn-small">+ Add Image</button>
        </div>
      </div>

      <div class="editor-section">
        <h3>Short Notes</h3>
        <div id="cm-short-notes-list" class="items-list"></div>
        <button type="button" id="cm-add-note-btn-inline" class="btn btn-small">+ Add Note</button>
      </div>

      <div class="editor-section">
        <h3>Revision Box</h3>
        <div class="revision-subsection">
          <h4>Remember</h4>
          <div id="cm-remember-list" class="items-list"></div>
          <button type="button" id="cm-add-remember-btn-inline" class="btn btn-small">+ Add Item</button>
        </div>
        <div class="revision-subsection">
          <h4>Mistakes to Avoid</h4>
          <div id="cm-mistakes-list" class="items-list"></div>
          <button type="button" id="cm-add-mistake-btn-inline" class="btn btn-small">+ Add Item</button>
        </div>
        <div class="revision-subsection">
          <h4>Formulas</h4>
          <div id="cm-formulas-list" class="items-list"></div>
          <button type="button" id="cm-add-formula-btn-inline" class="btn btn-small">+ Add Item</button>
        </div>
        <div class="revision-subsection">
          <h4>Exam Tips</h4>
          <div id="cm-tips-list" class="items-list"></div>
          <button type="button" id="cm-add-tip-btn-inline" class="btn btn-small">+ Add Item</button>
        </div>
      </div>

      <div class="editor-section">
        <h3>Attachments</h3>
        <div id="cm-attachments-list-inline" class="items-list"></div>
        <button type="button" id="cm-add-attachment-btn-inline" class="btn btn-small">+ Add Attachment</button>
        <input type="file" id="cm-attachment-upload-inline" style="display:none" multiple>
      </div>

      <div class="editor-section">
        <h3>Exam Tags</h3>
        <div id="cm-exam-tags-inline" class="tags-checkboxes"></div>
      </div>

      <div class="editor-section">
        <h3>Difficulty Level</h3>
        <select id="cm-difficulty" class="form-input">
          <option value="easy" ${concept.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
          <option value="medium" ${concept.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
          <option value="hard" ${concept.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
        </select>
      </div>

      <div class="editor-actions">
        <button type="button" id="cm-preview-btn" class="btn btn-secondary">👁 Preview</button>
        <button type="button" id="cm-save-draft-btn" class="btn btn-secondary">Save Draft</button>
        <button type="button" id="cm-publish-btn-inline" class="btn btn-primary">Publish</button>
        <button type="button" id="cm-cancel-btn-inline" class="btn btn-tertiary">Cancel</button>
      </div>
    `;

    _renderLearningOutcomes();
    _renderShortNotes();
    _renderRevisionBox();
    _renderAttachments();
    _renderExamTags();

    $('cm-add-outcome-btn')?.addEventListener('click', () => _addLearningOutcome());
    $('cm-add-note-btn-inline')?.addEventListener('click', () => _addShortNote());
    $('cm-add-remember-btn-inline')?.addEventListener('click', () => _addRevisionItem('remember'));
    $('cm-add-mistake-btn-inline')?.addEventListener('click', () => _addRevisionItem('mistakes'));
    $('cm-add-formula-btn-inline')?.addEventListener('click', () => _addRevisionItem('formulas'));
    $('cm-add-tip-btn-inline')?.addEventListener('click', () => _addRevisionItem('examTips'));
    $('cm-add-attachment-btn-inline')?.addEventListener('click', () => $('cm-attachment-upload-inline')?.click());
    $('cm-attachment-upload-inline')?.addEventListener('change', e => _handleAttachmentUpload(e));
    $('cm-save-draft-btn')?.addEventListener('click', () => _saveConcept(false));
    $('cm-publish-btn-inline')?.addEventListener('click', () => _saveConcept(true));
    $('cm-cancel-btn-inline')?.addEventListener('click', () => _cancelEdit());
    $('cm-preview-btn')?.addEventListener('click', () => _previewConcept());
    $('cm-add-para-btn')?.addEventListener('click', () => _addBlock('paragraph'));
    $('cm-add-image-btn')?.addEventListener('click', () => _addBlock('image'));

    _renderContentBlocks();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CONTENT BLOCKS (description.english.blocks) — paragraph + image, with
  // reordering and an image size control so a note can look like a textbook
  // page (image → caption → body text), not a single flat text field.
  // ════════════════════════════════════════════════════════════════════════════

  function _blocks() {
    if (!_currentConcept.description) _currentConcept.description = { english: { blocks: [] }, marathi: { blocks: [] } };
    if (!_currentConcept.description.english) _currentConcept.description.english = { blocks: [] };
    if (!Array.isArray(_currentConcept.description.english.blocks)) _currentConcept.description.english.blocks = [];
    return _currentConcept.description.english.blocks;
  }

  function _renderContentBlocks() {
    const list = $('cm-blocks-list');
    if (!list) return;
    const blocks = _blocks();

    if (!blocks.length) {
      list.innerHTML = '<p class="cm-blocks-empty">No content blocks yet — add a paragraph or image below.</p>';
      return;
    }

    list.innerHTML = blocks.map((block, idx) => {
      const moveUp   = idx > 0 ? '' : 'disabled';
      const moveDown = idx < blocks.length - 1 ? '' : 'disabled';
      const controls = `
        <div class="cm-block-controls">
          <button type="button" class="btn-icon" ${moveUp} onclick="CONCEPT_MANAGER._moveBlock(${idx},-1)" title="Move up">↑</button>
          <button type="button" class="btn-icon" ${moveDown} onclick="CONCEPT_MANAGER._moveBlock(${idx},1)" title="Move down">↓</button>
          <button type="button" class="btn-icon" onclick="CONCEPT_MANAGER._removeBlock(${idx})" title="Delete">✕</button>
        </div>`;

      if (block.type === 'image') {
        const url = block.data?.url || '';
        const size = block.data?.size || 'medium';
        return `
          <div class="cm-block cm-block-image">
            <div class="cm-block-head"><span class="cm-block-label">🖼️ Image</span>${controls}</div>
            <div class="cm-block-image-row">
              <div class="cm-block-image-preview">${url ? `<img src="${_esc(url)}" alt="">` : '<span class="cm-no-image">No image</span>'}</div>
              <div class="cm-block-image-fields">
                <input type="text" class="form-input" placeholder="Image URL" value="${_esc(url)}"
                       onchange="CONCEPT_MANAGER._updateBlockImageUrl(${idx}, this.value)">
                <button type="button" class="btn btn-small" onclick="document.getElementById('cm-img-upload-${idx}').click()">⬆ Upload</button>
                <input type="file" id="cm-img-upload-${idx}" accept="image/*" style="display:none"
                       onchange="CONCEPT_MANAGER._uploadBlockImage(${idx}, this.files[0])">
                <input type="text" class="form-input" placeholder="Caption" value="${_esc(block.data?.caption || '')}"
                       onchange="CONCEPT_MANAGER._updateBlockField(${idx}, 'caption', this.value)">
                <label class="cm-size-label">Size:
                  <select class="form-input" onchange="CONCEPT_MANAGER._updateBlockField(${idx}, 'size', this.value)">
                    <option value="small"  ${size === 'small'  ? 'selected' : ''}>Small</option>
                    <option value="medium" ${size === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="large"  ${size === 'large'  ? 'selected' : ''}>Large (full width)</option>
                  </select>
                </label>
              </div>
            </div>
          </div>`;
      }

      // paragraph (default)
      return `
        <div class="cm-block cm-block-paragraph">
          <div class="cm-block-head"><span class="cm-block-label">📝 Paragraph</span>${controls}</div>
          <textarea class="form-input" rows="3" placeholder="Enter paragraph text"
                    onchange="CONCEPT_MANAGER._updateBlockField(${idx}, 'text', this.value)">${_esc(block.data?.text || '')}</textarea>
        </div>`;
    }).join('');
  }

  function _addBlock(type) {
    const blocks = _blocks();
    blocks.push(type === 'image' ? { type: 'image', data: { url: '', caption: '', size: 'medium' } } : { type: 'paragraph', data: { text: '' } });
    _renderContentBlocks();
  }

  function _moveBlock(idx, dir) {
    const blocks = _blocks();
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    [blocks[idx], blocks[target]] = [blocks[target], blocks[idx]];
    _renderContentBlocks();
  }

  function _removeBlock(idx) {
    _blocks().splice(idx, 1);
    _renderContentBlocks();
  }

  function _updateBlockField(idx, field, value) {
    const block = _blocks()[idx];
    if (block) block.data[field] = value;
  }

  function _updateBlockImageUrl(idx, value) {
    _updateBlockField(idx, 'url', value);
    _renderContentBlocks();
  }

  async function _uploadBlockImage(idx, file) {
    if (!file) return;
    try {
      const dataUrl = await _fileToDataUrl(file);
      const result = await API.uploadWordImage(dataUrl);
      _updateBlockField(idx, 'url', result?.url || result?.data?.url || '');
      _renderContentBlocks();
    } catch (err) {
      APP.toast(err?.message || 'Image upload failed', 'error');
    }
  }

  function _fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PREVIEW — renders the note the same way the student app would, so admin
  // can check image sizing/order before publishing.
  // ════════════════════════════════════════════════════════════════════════════

  const _sizeWidth = { small: '40%', medium: '70%', large: '100%' };

  function _renderBlocksHtml(blocks) {
    return blocks.map(block => {
      if (block.type === 'paragraph') return `<p class="cm-pv-paragraph">${_esc(block.data?.text || '')}</p>`;
      if (block.type === 'image') {
        const width = _sizeWidth[block.data?.size] || _sizeWidth.medium;
        return `
          <figure class="cm-pv-figure">
            <img src="${_esc(block.data?.url || '')}" alt="" style="width:${width}">
            ${block.data?.caption ? `<figcaption>${_esc(block.data.caption)}</figcaption>` : ''}
          </figure>`;
      }
      return '';
    }).join('');
  }

  function _previewConcept() {
    const concept = _currentConcept;
    const titleEn = _getValue('cm-title-en').trim() || concept.title?.english || '';
    const blocks = _blocks();

    const overlay = document.createElement('div');
    overlay.className = 'cm-preview-overlay';
    overlay.innerHTML = `
      <div class="cm-preview-card">
        <div class="cm-preview-header">
          <h2>${_esc(titleEn)}</h2>
          <button type="button" class="btn-icon" id="cm-preview-close">✕</button>
        </div>
        <div class="cm-preview-body">
          ${blocks.length ? _renderBlocksHtml(blocks) : '<p class="cm-blocks-empty">No content yet.</p>'}
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#cm-preview-close')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LEARNING OUTCOMES
  // ════════════════════════════════════════════════════════════════════════════

  function _renderLearningOutcomes() {
    const list = $('cm-outcomes-list');
    if (!list) return;

    const items = _currentConcept.learningOutcomes.english || [];
    list.innerHTML = items.map((item, idx) => `
      <div class="list-item">
        <input type="text" value="${_esc(item)}" placeholder="Enter outcome" class="form-input"
               onchange="CONCEPT_MANAGER._updateLearningOutcome(${idx}, this.value)">
        <button type="button" class="btn-icon" onclick="CONCEPT_MANAGER._removeLearningOutcome(${idx})">✕</button>
      </div>
    `).join('');
  }

  function _addLearningOutcome() {
    if (!_currentConcept) return;
    if (!_currentConcept.learningOutcomes.english) _currentConcept.learningOutcomes.english = [];
    _currentConcept.learningOutcomes.english.push('');
    _renderLearningOutcomes();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SHORT NOTES
  // ════════════════════════════════════════════════════════════════════════════

  function _renderShortNotes() {
    const list = $('cm-short-notes-list');
    if (!list) return;

    const items = _currentConcept.shortNotes.english || [];
    list.innerHTML = items.map((item, idx) => `
      <div class="list-item">
        <input type="text" value="${_esc(item)}" placeholder="Enter short note" class="form-input"
               onchange="CONCEPT_MANAGER._updateShortNote(${idx}, this.value)">
        <button type="button" class="btn-icon" onclick="CONCEPT_MANAGER._removeShortNote(${idx})">✕</button>
      </div>
    `).join('');
  }

  function _addShortNote() {
    if (!_currentConcept) return;
    if (!_currentConcept.shortNotes.english) _currentConcept.shortNotes.english = [];
    _currentConcept.shortNotes.english.push('');
    _renderShortNotes();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // REVISION BOX
  // ════════════════════════════════════════════════════════════════════════════

  function _renderRevisionBox() {
    const box = _currentConcept.revisionBox.english;
    if (!box) return;

    const _renderList = (type, items) => items.map((item, idx) => `
      <div class="list-item">
        <input type="text" value="${_esc(item)}" placeholder="Enter ${type}" class="form-input"
               onchange="CONCEPT_MANAGER._updateRevisionItem('${type}', ${idx}, this.value)">
        <button type="button" class="btn-icon" onclick="CONCEPT_MANAGER._removeRevisionItem('${type}', ${idx})">✕</button>
      </div>
    `).join('');

    $('cm-remember-list').innerHTML = _renderList('remember', box.remember || []);
    $('cm-mistakes-list').innerHTML = _renderList('mistakes', box.mistakes || []);
    $('cm-formulas-list').innerHTML = _renderList('formulas', box.formulas || []);
    $('cm-tips-list').innerHTML = _renderList('examTips', box.examTips || []);
  }

  function _addRevisionItem(type) {
    if (!_currentConcept.revisionBox.english[type]) {
      _currentConcept.revisionBox.english[type] = [];
    }
    _currentConcept.revisionBox.english[type].push('');
    _renderRevisionBox();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ATTACHMENTS
  // ════════════════════════════════════════════════════════════════════════════

  function _renderAttachments() {
    const list = $('cm-attachments-list-inline');
    if (!list) return;

    const items = _currentConcept.attachments || [];
    list.innerHTML = items.map((att, idx) => `
      <div class="list-item">
        <div class="attachment-info">
          <span>${_esc(att.title)}</span>
          <small>(${att.type})</small>
        </div>
        <button type="button" class="btn-icon" onclick="CONCEPT_MANAGER._removeAttachment(${idx})">✕</button>
      </div>
    `).join('');
  }

  function _handleAttachmentUpload(e) {
    const files = e.target.files;
    if (!files || !files.length) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const type = file.type.startsWith('application/pdf') ? 'pdf' :
                   file.type.startsWith('image/') ? 'image' :
                   file.type.startsWith('audio/') ? 'audio' :
                   file.type.startsWith('video/') ? 'video' : 'external_link';

      _currentConcept.attachments.push({
        type,
        title: file.name,
        url: URL.createObjectURL(file),
        fileSize: file.size
      });
    }

    _renderAttachments();
    e.target.value = '';
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EXAM TAGS
  // ════════════════════════════════════════════════════════════════════════════

  function _renderExamTags() {
    const container = $('cm-exam-tags-inline');
    if (!container) return;

    const tags = ['board_exam', 'important', 'repeated', 'numerical', 'theory', 'diagram', 'viva', 'mcq'];
    const selected = _currentConcept.examTags || [];

    container.innerHTML = tags.map(tag => {
      const label = {
        board_exam: '📋 Board Exam',
        important: '⭐ Important',
        repeated: '🔄 Repeated',
        numerical: '🔢 Numerical',
        theory: '📚 Theory',
        diagram: '🖼️ Diagram',
        viva: '🗣️ Viva',
        mcq: '❓ MCQ'
      }[tag];

      return `
        <label class="checkbox-label">
          <input type="checkbox" value="${tag}" ${selected.includes(tag) ? 'checked' : ''}
                 onchange="CONCEPT_MANAGER._toggleExamTag('${tag}', this.checked)">
          ${label}
        </label>
      `;
    }).join('');
  }

  function _toggleExamTag(tag, checked) {
    if (checked) {
      if (!_currentConcept.examTags.includes(tag)) {
        _currentConcept.examTags.push(tag);
      }
    } else {
      _currentConcept.examTags = _currentConcept.examTags.filter(t => t !== tag);
    }
  }

  function _setupExamTagsCheckboxes() {
    // Setup initially - handled in _renderExamTags
  }

  // ════════════════════════════════════════════════════════════════════════════
  // UPDATE HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  function _updateLearningOutcome(idx, value) {
    if (_currentConcept && _currentConcept.learningOutcomes.english) {
      _currentConcept.learningOutcomes.english[idx] = value;
    }
  }

  function _removeLearningOutcome(idx) {
    if (_currentConcept && _currentConcept.learningOutcomes.english) {
      _currentConcept.learningOutcomes.english.splice(idx, 1);
      _renderLearningOutcomes();
    }
  }

  function _updateShortNote(idx, value) {
    if (_currentConcept && _currentConcept.shortNotes.english) {
      _currentConcept.shortNotes.english[idx] = value;
    }
  }

  function _removeShortNote(idx) {
    if (_currentConcept && _currentConcept.shortNotes.english) {
      _currentConcept.shortNotes.english.splice(idx, 1);
      _renderShortNotes();
    }
  }

  function _updateRevisionItem(type, idx, value) {
    if (_currentConcept && _currentConcept.revisionBox.english && _currentConcept.revisionBox.english[type]) {
      _currentConcept.revisionBox.english[type][idx] = value;
    }
  }

  function _removeRevisionItem(type, idx) {
    if (_currentConcept && _currentConcept.revisionBox.english && _currentConcept.revisionBox.english[type]) {
      _currentConcept.revisionBox.english[type].splice(idx, 1);
      _renderRevisionBox();
    }
  }

  function _removeAttachment(idx) {
    if (_currentConcept && _currentConcept.attachments) {
      _currentConcept.attachments.splice(idx, 1);
      _renderAttachments();
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SAVE / PUBLISH / DELETE
  // ════════════════════════════════════════════════════════════════════════════

  async function _saveConcept(publish = false) {
    if (!_currentConcept) return;

    const titleEn = _getValue('cm-title-en').trim();
    if (!titleEn) {
      APP.toast('Title (English) is required', 'error');
      return;
    }

    _currentConcept.title.english = titleEn;
    _currentConcept.title.marathi = _getValue('cm-title-mr').trim();
    _currentConcept.language = document.querySelector('input[name="language"]:checked')?.value || 'english';
    _currentConcept.difficulty = _getValue('cm-difficulty') || 'easy';

    // description.english.blocks is kept live-updated by the block editor
    // (_addBlock/_updateBlockField/etc.) — nothing to sync here.

    try {
      const body = { ..._currentConcept, changesSummary: publish ? 'Published' : 'Draft saved' };
      _currentConcept = _currentConcept._id
        ? await API.updateAdminConcept(_currentConcept._id, body)
        : await API.createAdminConcept(body);

      if (publish) {
        await _publishConceptActual();
      }

      APP.toast(publish ? 'Concept published!' : 'Concept saved!', 'success');
      _onChapterChange(_chapterId);
    } catch (err) {
      console.error('Save failed:', err);
      APP.toast(`Error: ${err.message}`, 'error');
    }
  }

  async function _publishConcept() {
    if (!_currentConcept || !_currentConcept._id) {
      APP.toast('Save concept first before publishing', 'info');
      return;
    }
    await _saveConcept(true);
  }

  async function _publishConceptActual() {
    if (!_currentConcept || !_currentConcept._id) return;

    try {
      _currentConcept = await API.publishAdminConcept(_currentConcept._id);
    } catch (err) {
      console.error('Publish failed:', err);
    }
  }

  async function _deleteConcept(conceptId = null) {
    const id = conceptId || _currentConcept?._id;
    if (!id) return;

    // Android WebView: native confirm()/prompt() are broken — must use APP.confirmAsync.
    if (!(await APP.confirmAsync('Are you sure you want to delete this concept? This cannot be undone.'))) {
      return;
    }

    try {
      await API.deleteAdminConcept(id);
      APP.toast('Concept deleted', 'success');
      _cancelEdit();
      _onChapterChange(_chapterId);
    } catch (err) {
      console.error('Delete failed:', err);
      APP.toast(`Error: ${err.message}`, 'error');
    }
  }

  async function _autoTranslate() {
    if (!_currentConcept || !_currentConcept._id) {
      APP.toast('Save concept first before translating', 'info');
      return;
    }

    try {
      _currentConcept = await API.translateAdminConcept(_currentConcept._id);
      _renderEditor();
      APP.toast('Content marked for Marathi translation', 'success');
    } catch (err) {
      console.error('Translation failed:', err);
      APP.toast(`Error: ${err.message}`, 'error');
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // UI STATE
  // ════════════════════════════════════════════════════════════════════════════

  function _showEditor() {
    _show('cm-editor-container');
    _hide('cm-concepts-list');
  }

  function _hideEditor() {
    _hide('cm-editor-container');
    _show('cm-concepts-list');
  }

  function _cancelEdit() {
    _currentConcept = null;
    _hideEditor();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ════════════════════════════════════════════════════════════════════════════

  return {
    init,
    editConcept,
    deleteConcept: _deleteConcept,
    _updateLearningOutcome,
    _removeLearningOutcome,
    _updateShortNote,
    _removeShortNote,
    _updateRevisionItem,
    _removeRevisionItem,
    _removeAttachment,
    _toggleExamTag,
    _moveBlock,
    _removeBlock,
    _updateBlockField,
    _updateBlockImageUrl,
    _uploadBlockImage
  };
})();

// Expose globally so inline onclick handlers (CONCEPT_MANAGER.editConcept /
// .deleteConcept) work — a top-level const is not visible to inline handlers.
window.CONCEPT_MANAGER = CONCEPT_MANAGER;
