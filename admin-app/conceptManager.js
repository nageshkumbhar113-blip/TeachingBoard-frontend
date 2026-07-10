/* global API, DB, APP, I18N */
'use strict';

const CONCEPT_MANAGER = (() => {
  const $ = id => document.getElementById(id);
  const _esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  // Escapes HTML, then turns **bold** (as pasted straight from ChatGPT) into
  // <strong> — the preview should render markdown emphasis, not literal asterisks.
  const _richText = s => _esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

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
  let _exerciseQuestions = [];

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
      <div class="editor-section cm-autofill-section">
        <h3>🤖 Auto-fill from ChatGPT</h3>
        <p class="cm-autofill-hint">ChatGPT चा संपूर्ण output इथे paste करा — Title, Learning Outcomes, Content, Short Notes, Revision Box, Formula, Exam Tips, Exam Tags, Difficulty सगळं आपोआप भरेल.</p>
        <textarea id="cm-autofill-input" class="form-input cm-autofill-textarea" rows="6" placeholder="ChatGPT चा संपूर्ण मजकूर इथे paste करा..."></textarea>
        <div class="cm-autofill-actions">
          <button type="button" id="cm-autofill-btn" class="btn btn-primary">✨ Auto-fill करा</button>
          <button type="button" id="cm-copy-format-btn" class="btn btn-secondary">📋 Copy Format (ChatGPT साठी)</button>
        </div>
      </div>

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
        <h3>📝 Exercise</h3>
        <p class="cm-autofill-hint">Question + Answer + Marks एकत्र पेस्ट करा, आपोआप वेगळे होतील — किंवा खाली मॅन्युअली एक-एक जोडा. हेच प्रश्न पुढे "Make Question Paper" मध्ये वापरता येतील.</p>
        ${_currentConcept._id ? '' : '<p class="cm-autofill-hint" style="color:var(--accent,#e16b13)">आधी "Save Draft" करा, मग Exercise प्रश्न जोडता येतील.</p>'}
        <textarea id="cm-exercise-autofill-input" class="cm-autofill-textarea" placeholder="Q1. गुरुत्वाकर्षण बल म्हणजे काय?
Ans: दोन वस्तूंमधील एकमेकांना आकर्षित करणारे बल.
Marks: 2

Q2. मुक्तपतन म्हणजे काय?
Ans: फक्त गुरुत्वाकर्षण बलाच्या प्रभावाखाली वस्तूचे पडणे.
Marks: 1" ${_currentConcept._id ? '' : 'disabled'}></textarea>
        <div class="cm-autofill-actions">
          <button type="button" id="cm-exercise-autofill-btn" class="btn btn-small" ${_currentConcept._id ? '' : 'disabled'}>✨ Auto-fill Exercise</button>
          <button type="button" id="cm-exercise-manual-btn" class="btn btn-small" ${_currentConcept._id ? '' : 'disabled'}>+ मॅन्युअली प्रश्न जोडा</button>
          <button type="button" id="cm-exercise-copy-format-btn" class="btn btn-small">📋 Copy Format (ChatGPT/Claude साठी)</button>
        </div>
        <div id="cm-exercise-manual-form"></div>
        <div id="cm-exercise-list" class="items-list" style="margin-top:10px"></div>
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
    $('cm-exercise-autofill-btn')?.addEventListener('click', () => _runExerciseAutoFill());
    $('cm-exercise-manual-btn')?.addEventListener('click', () => _showExerciseManualForm());
    $('cm-exercise-copy-format-btn')?.addEventListener('click', () => _copyExerciseFormat());
    if (_currentConcept._id) _loadExerciseQuestions();
    $('cm-add-para-btn')?.addEventListener('click', () => _addBlock('paragraph'));
    $('cm-add-image-btn')?.addEventListener('click', () => _addBlock('image'));
    $('cm-autofill-btn')?.addEventListener('click', () => _runAutoFill());
    $('cm-copy-format-btn')?.addEventListener('click', () => _copyPromptFormat());

    // Title/language/difficulty aren't read until Save is pressed — wire a
    // blur/change autosave so these aren't lost either if the admin navigates
    // away mid-edit.
    $('cm-title-en')?.addEventListener('blur', () => {
      _currentConcept.title.english = _getValue('cm-title-en').trim();
      _autoSaveDraft();
    });
    $('cm-title-mr')?.addEventListener('blur', () => {
      _currentConcept.title.marathi = _getValue('cm-title-mr').trim();
      _autoSaveDraft();
    });
    document.querySelectorAll('input[name="language"]').forEach(el => {
      el.addEventListener('change', () => {
        _currentConcept.language = el.value;
        _autoSaveDraft();
      });
    });
    $('cm-difficulty')?.addEventListener('change', () => {
      _currentConcept.difficulty = _getValue('cm-difficulty');
      _autoSaveDraft();
    });

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
    _autoSaveDraft();
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
      if (block.type === 'paragraph') return `<p class="cm-pv-paragraph">${_richText(block.data?.text || '')}</p>`;
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

  function _renderLearningOutcomesPreviewHtml(concept) {
    const outcomes = concept.learningOutcomes?.english || [];
    if (!outcomes.length) return '';
    return `
      <div class="cm-pv-section">
        <h3 class="cm-pv-section-title">📚 Learning Outcomes</h3>
        <ul class="cm-pv-list">${outcomes.map(o => `<li>${_richText(o)}</li>`).join('')}</ul>
      </div>`;
  }

  // Same "everything on one screen" layout as the student notes viewer's
  // Read mode (Short Notes, Revision Box, Exam Tags) — the admin preview
  // should show what students will actually see.
  function _renderPreviewSectionsHtml(concept) {
    let html = '';

    const shortNotes = concept.shortNotes?.english || [];
    if (shortNotes.length) {
      html += `
        <div class="cm-pv-section">
          <h3 class="cm-pv-section-title">🔑 Key Points</h3>
          <ul class="cm-pv-list cm-pv-key-points">${shortNotes.map(n => `<li>${_richText(n)}</li>`).join('')}</ul>
        </div>`;
    }

    const revisionBox = concept.revisionBox?.english || {};
    const revSections = [
      { key: 'remember', icon: '🧠', label: 'Remember' },
      { key: 'mistakes', icon: '❌', label: 'Mistakes to Avoid' },
      { key: 'formulas', icon: '📐', label: 'Formulas' },
      { key: 'examTips', icon: '⭐', label: 'Exam Tips' },
    ];
    const revHtml = revSections
      .filter(({ key }) => (revisionBox[key] || []).length)
      .map(({ key, icon, label }) => `
        <div class="cm-pv-rev-section cm-pv-rev-${key}">
          <h4>${icon} ${label}</h4>
          <ul class="cm-pv-list">${revisionBox[key].map(i => `<li>${_richText(i)}</li>`).join('')}</ul>
        </div>`)
      .join('');
    if (revHtml) {
      html += `<div class="cm-pv-section"><h3 class="cm-pv-section-title">📦 Revision Box</h3><div class="cm-pv-rev-box">${revHtml}</div></div>`;
    }

    const examTags = concept.examTags || [];
    if (examTags.length) {
      html += `
        <div class="cm-pv-section">
          <h3 class="cm-pv-section-title">🏷️ Exam Tags</h3>
          <div class="cm-pv-tags">${examTags.map(t => `<span class="cm-pv-tag">${_esc(t)}</span>`).join('')}</div>
        </div>`;
    }

    return html;
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
          ${_renderLearningOutcomesPreviewHtml(concept)}
          <div class="cm-pv-section">
            <h3 class="cm-pv-section-title">📚 Content</h3>
            ${blocks.length ? _renderBlocksHtml(blocks) : '<p class="cm-blocks-empty">No content yet.</p>'}
          </div>
          ${_renderPreviewSectionsHtml(concept)}
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

  const RECENT_TAGS_KEY = 'cm_recent_exam_tags';

  function _getRecentTags() {
    try { return JSON.parse(localStorage.getItem(RECENT_TAGS_KEY) || '[]'); }
    catch { return []; }
  }

  function _rememberTag(tag) {
    const recent = _getRecentTags().filter(t => t !== tag);
    recent.unshift(tag);
    localStorage.setItem(RECENT_TAGS_KEY, JSON.stringify(recent.slice(0, 20)));
  }

  function _renderExamTags() {
    const container = $('cm-exam-tags-inline');
    if (!container) return;

    const selected = _currentConcept.examTags || [];
    const suggestions = _getRecentTags().filter(t => !selected.includes(t)).slice(0, 10);

    container.innerHTML = `
      <div class="cm-tag-chips" id="cm-tag-chips">
        ${selected.map(tag => `
          <span class="cm-tag-chip">
            ${_esc(tag)}
            <button type="button" class="cm-tag-remove" onclick="CONCEPT_MANAGER._removeExamTag('${_esc(tag)}')" aria-label="Remove tag">✕</button>
          </span>
        `).join('')}
      </div>
      <div class="cm-tag-input-row">
        <input type="text" id="cm-tag-input" class="admin-input" placeholder="Tag टाईप करा आणि Enter दाबा...">
        <button type="button" id="cm-tag-add-btn" class="admin-btn-secondary">+ Add</button>
      </div>
      ${suggestions.length ? `
        <div class="cm-tag-suggestions">
          ${suggestions.map(tag => `
            <button type="button" class="cm-tag-suggestion" onclick="CONCEPT_MANAGER._addExamTag('${_esc(tag)}')">+ ${_esc(tag)}</button>
          `).join('')}
        </div>
      ` : ''}
    `;

    const input = $('cm-tag-input');
    const addFromInput = () => {
      const val = input.value.trim();
      if (val) _addExamTag(val);
      input.value = '';
      input.focus();
    };
    $('cm-tag-add-btn')?.addEventListener('click', addFromInput);
    input?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addFromInput(); }
    });
  }

  function _addExamTag(tag) {
    const clean = String(tag || '').trim();
    if (!clean) return;
    if (!_currentConcept.examTags.includes(clean)) {
      _currentConcept.examTags.push(clean);
      _rememberTag(clean);
    }
    _renderExamTags();
    _autoSaveDraft();
  }

  function _removeExamTag(tag) {
    _currentConcept.examTags = _currentConcept.examTags.filter(t => t !== tag);
    _renderExamTags();
    _autoSaveDraft();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // AUTO-FILL FROM PASTED TEXT (ChatGPT-formatted note → all fields at once)
  // ════════════════════════════════════════════════════════════════════════════

  // Header lines are short and consist of little besides the keyword itself
  // (plus emoji/symbol decoration) — anchoring on "only non-letters around the
  // keyword" tells a real section header apart from the keyword merely
  // appearing inside a sentence elsewhere (e.g. a content line that mentions
  // "remember" in passing shouldn't reset the parser's current section).
  const _headerOnly = word => new RegExp(`^[^\\p{L}\\p{N}]*${word}[^\\p{L}\\p{N}]*$`, 'iu');

  const _AUTOFILL_SECTIONS = [
    ['title',      /title\s*\(marathi\)/i],
    ['learning',   /learning outcomes/i],
    ['content',    /content\s*\(description\)/i],
    ['shortNotes', /short notes/i],
    ['remember',   _headerOnly('remember')],
    ['mistakes',   /mistakes to avoid/i],
    ['formula',    _headerOnly('formula')],
    ['examTips',   /exam tips/i],
    ['quickRev',   /quick revision/i],
    ['examTags',   /exam tags/i],
    ['difficulty', /difficulty level/i],
  ];

  // Best-effort line-by-line parser for the fixed ChatGPT template (section
  // headers like "🎯 Learning Outcomes" / "📦 Revision Box" / "🏷️ Exam Tags")
  // — not general NLP, just matches the exact structure the admin's prompt
  // (see _copyPromptFormat) asks ChatGPT to always produce.
  function _parseAutoFillText(raw) {
    const lines = String(raw || '').replace(/\r\n/g, '\n').split('\n');
    const result = {
      titleMarathi: '', titleEnglish: '',
      outcomes: [], contentParagraphs: [],
      shortNotes: [], remember: [], mistakes: [], formulas: [], examTips: [],
      examTags: [], difficulty: '',
    };

    let section = 'none';
    let buffer = [];

    const flushContent = () => {
      const text = buffer.join('\n').trim();
      buffer = [];
      if (!text) return;
      text.split(/\n\s*\n/).forEach(p => {
        const t = p.trim();
        if (t) result.contentParagraphs.push(t);
      });
    };

    const captureTitle = line => {
      result.titleMarathi = line;
      const m = line.match(/\(([^)]+)\)\s*$/);
      if (m) result.titleEnglish = m[1].trim();
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // Divider line only — doesn't hold content itself, children sections follow.
      if (/revision box/i.test(line)) continue;

      const matched = _AUTOFILL_SECTIONS.find(([, re]) => re.test(line));
      if (matched) {
        if (section === 'content') flushContent();
        section = matched[0];
        buffer = [];
        continue;
      }

      if (section === 'none') {
        if (line && !result.titleMarathi) captureTitle(line);
        continue;
      }
      if (section === 'title') {
        if (line) captureTitle(line);
        continue;
      }
      if (section === 'content') {
        buffer.push(rawLine); // keep blank lines — they mark paragraph breaks
        continue;
      }
      if (!line) continue;

      switch (section) {
        case 'learning':   result.outcomes.push(line); break;
        case 'shortNotes': result.shortNotes.push(line); break;
        case 'remember':   result.remember.push(line); break;
        case 'mistakes':   result.mistakes.push(line); break;
        case 'formula':    result.formulas.push(line); break;
        case 'examTips':   result.examTips.push(line); break;
        case 'quickRev':   result.shortNotes.push(line); break;
        case 'examTags': {
          const tag = line.replace(/^[^\p{L}\p{N}]+/u, '').trim();
          if (tag) result.examTags.push(tag);
          break;
        }
        case 'difficulty':
          if (/easy|🟢/i.test(line)) result.difficulty = 'easy';
          else if (/medium|🟡/i.test(line)) result.difficulty = 'medium';
          else if (/hard|🔴/i.test(line)) result.difficulty = 'hard';
          break;
      }
    }
    if (section === 'content') flushContent();

    return result;
  }

  function _applyAutoFillResult(parsed) {
    if (!_currentConcept) return;

    if (parsed.titleMarathi) {
      _currentConcept.title.marathi = parsed.titleMarathi;
      if ($('cm-title-mr')) $('cm-title-mr').value = parsed.titleMarathi;
    }
    if (parsed.titleEnglish) {
      _currentConcept.title.english = parsed.titleEnglish;
      if ($('cm-title-en')) $('cm-title-en').value = parsed.titleEnglish;
    }

    if (parsed.outcomes.length) {
      _currentConcept.learningOutcomes.english = parsed.outcomes;
      _renderLearningOutcomes();
    }

    if (parsed.contentParagraphs.length) {
      _blocks().length = 0;
      parsed.contentParagraphs.forEach(text => _blocks().push({ type: 'paragraph', data: { text } }));
      _renderContentBlocks();
    }

    if (parsed.shortNotes.length) {
      _currentConcept.shortNotes.english = parsed.shortNotes;
      _renderShortNotes();
    }

    if (parsed.remember.length || parsed.mistakes.length || parsed.formulas.length || parsed.examTips.length) {
      const box = _currentConcept.revisionBox.english;
      if (parsed.remember.length) box.remember = parsed.remember;
      if (parsed.mistakes.length) box.mistakes = parsed.mistakes;
      if (parsed.formulas.length) box.formulas = parsed.formulas;
      if (parsed.examTips.length) box.examTips = parsed.examTips;
      _renderRevisionBox();
    }

    if (parsed.examTags.length) {
      parsed.examTags.forEach(tag => {
        if (!_currentConcept.examTags.includes(tag)) _currentConcept.examTags.push(tag);
        _rememberTag(tag);
      });
      _renderExamTags();
    }

    if (parsed.difficulty) {
      _currentConcept.difficulty = parsed.difficulty;
      if ($('cm-difficulty')) $('cm-difficulty').value = parsed.difficulty;
    }

    _autoSaveDraft();
    APP.toast('Auto-fill झालं — सगळे fields एकदा तपासा', 'success');
  }

  function _runAutoFill() {
    const input = $('cm-autofill-input');
    if (!input || !input.value.trim()) {
      APP.toast('आधी मजकूर paste करा', 'error');
      return;
    }
    _applyAutoFillResult(_parseAutoFillText(input.value));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EXERCISE — Q&A bank tied to this concept (feeds the Paper Builder later)
  // ════════════════════════════════════════════════════════════════════════════

  // Splits pasted text into "Q<n>. ... Ans: ... Marks: <n>" blocks. Not a
  // general parser — matches the exact template shown in the textarea
  // placeholder, same philosophy as _parseAutoFillText above.
  function _parseExerciseText(raw) {
    const text = String(raw || '').replace(/\r\n/g, '\n');
    const blocks = text.split(/(?=^\s*Q(?:uestion)?\s*\d+\s*[.):])/im).map(b => b.trim()).filter(Boolean);
    const parsed = [];
    for (const block of blocks) {
      const qMatch = block.match(/^Q(?:uestion)?\s*\d+\s*[.):]\s*([\s\S]*?)(?=\n\s*(?:Ans(?:wer)?)\s*[:.]|$)/i);
      const aMatch = block.match(/(?:Ans(?:wer)?)\s*[:.]\s*([\s\S]*?)(?=\n\s*Marks?\s*[:.]|$)/i);
      const mMatch = block.match(/Marks?\s*[:.]\s*(\d)/i);
      const question = qMatch ? qMatch[1].trim() : '';
      const answer   = aMatch ? aMatch[1].trim() : '';
      const marks    = mMatch ? Math.min(5, Math.max(1, parseInt(mMatch[1], 10))) : 1;
      if (question && answer) parsed.push({ question, answer, marks });
    }
    return parsed;
  }

  function _norm(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }

  async function _loadExerciseQuestions() {
    if (!_currentConcept?._id) { _exerciseQuestions = []; _renderExerciseList(); return; }
    try {
      _exerciseQuestions = await API.fetchAdminSlsQuestions({ conceptId: _currentConcept._id, status: '' });
    } catch (err) {
      console.warn('load exercise questions failed', err);
      _exerciseQuestions = [];
    }
    _renderExerciseList();
  }

  function _renderExerciseList() {
    const list = $('cm-exercise-list');
    if (!list) return;
    if (!_exerciseQuestions.length) {
      list.innerHTML = '<p class="empty-hint">अजून Exercise प्रश्न नाहीत.</p>';
      return;
    }
    list.innerHTML = _exerciseQuestions.map((q, i) => `
      <div class="cm-qitem" data-id="${_esc(q._id)}">
        <div class="cm-qitem-top">
          <b>प्रश्न ${i + 1}</b>
          <span class="cm-marks-chip">${q.marks} marks</span>
        </div>
        <div class="cm-qtext">${_richText(q.questionText?.marathi || q.questionText?.english || '')}</div>
        <div class="cm-atext">${_richText(q.answerText?.marathi || q.answerText?.english || '')}</div>
        <div class="cm-qactions">
          <button type="button" class="btn btn-small cm-exercise-edit-btn" data-id="${_esc(q._id)}">✏️ Edit</button>
          <button type="button" class="btn btn-small cm-exercise-delete-btn" data-id="${_esc(q._id)}">🗑 Delete</button>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('.cm-exercise-edit-btn').forEach(btn =>
      btn.addEventListener('click', () => _showExerciseManualForm(btn.dataset.id)));
    list.querySelectorAll('.cm-exercise-delete-btn').forEach(btn =>
      btn.addEventListener('click', () => _deleteExerciseQuestion(btn.dataset.id)));
  }

  async function _runExerciseAutoFill() {
    if (!_currentConcept?._id) {
      APP.toast('आधी "Save Draft" करा', 'error');
      return;
    }
    const input = $('cm-exercise-autofill-input');
    if (!input || !input.value.trim()) {
      APP.toast('आधी मजकूर paste करा', 'error');
      return;
    }
    const parsed = _parseExerciseText(input.value);
    if (!parsed.length) {
      APP.toast('कुठलाही प्रश्न ओळखता आला नाही — format तपासा', 'error');
      return;
    }

    const existingNorm = new Set(_exerciseQuestions.map(q => _norm(q.questionText?.marathi || q.questionText?.english)));
    let created = 0, skipped = 0;
    for (const item of parsed) {
      if (existingNorm.has(_norm(item.question))) { skipped++; continue; }
      try {
        await API.createAdminSlsQuestion({
          conceptId: _currentConcept._id,
          chapterId: _chapterId,
          subjectId: _subject,
          batchId: _batch,
          questionText: { english: item.question, marathi: item.question },
          answerText: { english: item.answer, marathi: item.answer },
          marks: item.marks,
          questionType: 'short_answer',
          difficulty: 'medium',
          status: 'published',
        });
        existingNorm.add(_norm(item.question));
        created++;
      } catch (err) {
        console.warn('create exercise question failed', err);
      }
    }

    input.value = '';
    await _loadExerciseQuestions();
    if (skipped) {
      APP.toast(`${created} प्रश्न जोडले, ${skipped} आधीच होते (duplicate वगळले)`, 'info');
    } else {
      APP.toast(`✅ ${created} प्रश्न जोडले`, 'success');
    }
  }

  function _showExerciseManualForm(editId = null) {
    const existing = editId ? _exerciseQuestions.find(q => q._id === editId) : null;
    const host = $('cm-exercise-manual-form');
    if (!host) return;
    host.innerHTML = `
      <div class="cm-qitem" style="margin-top:10px">
        <label class="form-label">Question</label>
        <textarea id="cm-ex-question" class="form-input" rows="2">${_esc(existing?.questionText?.marathi || existing?.questionText?.english || '')}</textarea>
        <label class="form-label">Answer</label>
        <textarea id="cm-ex-answer" class="form-input" rows="2">${_esc(existing?.answerText?.marathi || existing?.answerText?.english || '')}</textarea>
        <label class="form-label">Marks</label>
        <select id="cm-ex-marks" class="form-input">
          ${[1,2,3,4,5].map(m => `<option value="${m}" ${existing?.marks === m ? 'selected' : ''}>${m} ${m === 1 ? 'Mark' : 'Marks'}</option>`).join('')}
        </select>
        <div class="cm-qactions" style="margin-top:8px">
          <button type="button" id="cm-ex-save-btn" class="btn btn-small btn-primary">💾 Save</button>
          <button type="button" id="cm-ex-cancel-btn" class="btn btn-small">Cancel</button>
        </div>
      </div>
    `;
    $('cm-ex-save-btn')?.addEventListener('click', () => _saveExerciseManual(editId));
    $('cm-ex-cancel-btn')?.addEventListener('click', () => { host.innerHTML = ''; });
  }

  async function _saveExerciseManual(editId) {
    const question = $('cm-ex-question')?.value.trim() || '';
    const answer   = $('cm-ex-answer')?.value.trim() || '';
    const marks    = parseInt($('cm-ex-marks')?.value, 10) || 1;
    if (!question || !answer) {
      APP.toast('Question आणि Answer दोन्ही लागतील', 'error');
      return;
    }

    if (!editId) {
      const existingNorm = new Set(_exerciseQuestions.map(q => _norm(q.questionText?.marathi || q.questionText?.english)));
      if (existingNorm.has(_norm(question))) {
        APP.toast('हा प्रश्न आधीच जोडलेला आहे', 'info');
        return;
      }
    }

    try {
      const payload = {
        questionText: { english: question, marathi: question },
        answerText: { english: answer, marathi: answer },
        marks,
      };
      if (editId) {
        await API.updateAdminSlsQuestion(editId, payload);
      } else {
        await API.createAdminSlsQuestion({
          ...payload,
          conceptId: _currentConcept._id,
          chapterId: _chapterId,
          subjectId: _subject,
          batchId: _batch,
          questionType: 'short_answer',
          difficulty: 'medium',
          status: 'published',
        });
      }
      $('cm-exercise-manual-form').innerHTML = '';
      await _loadExerciseQuestions();
      APP.toast('✅ Saved', 'success');
    } catch (err) {
      APP.toast(err?.message || 'Save अयशस्वी', 'error');
    }
  }

  async function _deleteExerciseQuestion(id) {
    if (!await APP.confirmAsync('हा Exercise प्रश्न delete करायचा?')) return;
    try {
      await API.deleteAdminSlsQuestion(id);
      await _loadExerciseQuestions();
      APP.toast('Deleted', 'success');
    } catch (err) {
      APP.toast(err?.message || 'Delete अयशस्वी', 'error');
    }
  }

  const CHATGPT_FORMAT_PROMPT = `Ya format made mala note dya (Marathi madhe), exact hech section headings ani emoji vaparun, ekahi section skip na karta:

Title (Marathi)
[चॅप्टरचे शीर्षक] (English translation)

🎯 Learning Outcomes
✅ ...
✅ ...

📚 Content (Description)
[परिच्छेद, ठळक शब्दांसाठी **bold** वापरा, महत्त्वाच्या मुद्द्यांसाठी वेगळी ओळ]

📝 Short Notes
📌 ...
📌 ...

📦 Revision Box
🧠 Remember
✅ ...
❌ Mistakes to Avoid
❌ ...

📐 Formula
[मुख्य सूत्र]
[उप-मुद्दे]

🎯 Exam Tips
⭐ ...

🏷️ Exam Tags
☑️ ...

⭐ Difficulty Level
🟢 Easy / 🟡 Medium / 🔴 Hard`;

  function _copyPromptFormat() {
    navigator.clipboard?.writeText(CHATGPT_FORMAT_PROMPT)
      .then(() => APP.toast('Prompt copy झाला — ChatGPT ला paste करा', 'success'))
      .catch(() => APP.toast('Copy करता आलं नाही', 'error'));
  }

  const EXERCISE_FORMAT_PROMPT = `Ya note वरून सराव प्रश्न (Exercise) तयार कर, Marathi मध्ये, exact ह्याच format मध्ये — एकही ओळ इकडे-तिकडे न करता, प्रत्येक प्रश्नानंतर एक रिकामी ओळ सोड:

Q1. [प्रश्न]
Ans: [उत्तर]
Marks: [1 ते 5 मधला आकडा]

Q2. [प्रश्न]
Ans: [उत्तर]
Marks: [1 ते 5 मधला आकडा]

...अशा पद्धतीने १ mark, २ marks, ३ marks, ४ marks, ५ marks — प्रत्येक प्रकारचे किमान १-२ प्रश्न बनव, वेगवेगळ्या अडचण पातळीचे (सोपे/मध्यम/कठीण मिसळून). खालील note चा मजकूर आधार म्हणून वापर:

[इथे तुमच्या note चा मजकूर paste करा]`;

  function _copyExerciseFormat() {
    navigator.clipboard?.writeText(EXERCISE_FORMAT_PROMPT)
      .then(() => APP.toast('Prompt copy झाला — ChatGPT/Claude ला paste करा', 'success'))
      .catch(() => APP.toast('Copy करता आलं नाही', 'error'));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // UPDATE HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  function _updateLearningOutcome(idx, value) {
    if (_currentConcept && _currentConcept.learningOutcomes.english) {
      _currentConcept.learningOutcomes.english[idx] = value;
      _autoSaveDraft();
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
      _autoSaveDraft();
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
      _autoSaveDraft();
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

  let _autoSaveTimer = null;

  // Silent, debounced draft save — used after tag/field edits so nothing is
  // lost if the admin navigates away without pressing "Save Draft" (no toast,
  // no chapter-list refresh, since those would be disruptive mid-edit).
  function _autoSaveDraft() {
    if (!_currentConcept || !_currentConcept.title?.english?.trim()) return;
    clearTimeout(_autoSaveTimer);
    _autoSaveTimer = setTimeout(async () => {
      try {
        const body = { ..._currentConcept, changesSummary: 'Auto-saved draft' };
        _currentConcept = _currentConcept._id
          ? await API.updateAdminConcept(_currentConcept._id, body)
          : await API.createAdminConcept(body);
      } catch (err) {
        console.warn('Auto-save draft failed:', err.message);
      }
    }, 800);
  }

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
    _addExamTag,
    _removeExamTag,
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
