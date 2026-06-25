/* global API, DB, APP */
'use strict';

const NOTES_MANAGER = (() => {
  const $ = id => document.getElementById(id);

  // ── State ────────────────────────────────────────────────────────────────
  let _batch   = '';
  let _subject = '';
  let _chapter = '';
  let _initialized = false;
  let _editNoteId  = null;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                           .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function _show(id) { const el = $(id); if (el) { el.classList.remove('hidden'); } }
  function _hide(id) { const el = $(id); if (el) { el.classList.add('hidden');    } }
  function _setText(id, t) { const el = $(id); if (el) el.textContent = t; }

  function _fmtSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024)        return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function _fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // ── Dropdowns ─────────────────────────────────────────────────────────────
  async function _populateSubjects(selId, batch, resetChapterId) {
    const sel = $(selId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Select Subject</option>';
    if (!batch) { sel.disabled = true; if (resetChapterId) _resetChapter(resetChapterId); return; }
    try {
      const subs = await DB.getSubjectsByBatch(batch);
      subs.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name; opt.textContent = s.name;
        sel.appendChild(opt);
      });
      sel.disabled = subs.length === 0;
    } catch (_) { sel.disabled = true; }
  }

  async function _populateChapters(selId, batch, subject) {
    const sel = $(selId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Select Chapter</option>';
    if (!batch || !subject) { sel.disabled = true; return; }
    try {
      const chapters = await DB.getChaptersByBatchSubject(batch, subject);
      chapters.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name; opt.textContent = c.name;
        sel.appendChild(opt);
      });
      sel.disabled = chapters.length === 0;
    } catch (_) { sel.disabled = true; }
  }

  function _resetChapter(selId) {
    const sel = $(selId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Select Chapter</option>';
    sel.disabled = true;
  }

  // ── Upload form ───────────────────────────────────────────────────────────
  function _showUploadForm() {
    _show('nm-upload-form');
    _hide('nm-upload-btn');
    $('nm-upload-title').value  = '';
    $('nm-upload-file').value   = '';
    _setText('nm-file-name', 'No file chosen');
    _setText('nm-upload-warning', '');
    _hide('nm-upload-warning');
    _hide('nm-progress-wrap');
    $('nm-upload-progress').value = 0;
    _setText('nm-progress-label', '');
    // batch is pre-populated by admin.js; reset subject/chapter
    if ($('nm-upload-batch')) $('nm-upload-batch').value = '';
    $('nm-upload-subject').innerHTML = '<option value="">Select Subject</option>';
    $('nm-upload-subject').disabled  = true;
    _resetChapter('nm-upload-chapter');
  }

  function _hideUploadForm() {
    _hide('nm-upload-form');
    _show('nm-upload-btn');
  }

  function _onFileChange(e) {
    const file = e.target.files[0];
    if (!file) { _setText('nm-file-name', 'No file chosen'); return; }
    _setText('nm-file-name', file.name);

    if (file.type !== 'application/pdf') {
      APP.toast('Only PDF files are allowed', 'error');
      e.target.value = '';
      _setText('nm-file-name', 'No file chosen');
      return;
    }

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 10) {
      APP.toast('File too large — max 10 MB', 'error');
      e.target.value = '';
      _setText('nm-file-name', 'No file chosen');
      return;
    }

    const warnEl = $('nm-upload-warning');
    if (sizeMB > 3) {
      warnEl.textContent = `⚠️ ${sizeMB.toFixed(1)} MB — For better performance, compress at ilovepdf.com before uploading.`;
      _show('nm-upload-warning');
    } else {
      _hide('nm-upload-warning');
    }
  }

  async function _doUpload() {
    const titleInput   = $('nm-upload-title');
    const batchSel     = $('nm-upload-batch');
    const subjectSel   = $('nm-upload-subject');
    const chapterSel   = $('nm-upload-chapter');
    const fileInput    = $('nm-upload-file');
    const progressBar  = $('nm-upload-progress');

    const title   = titleInput?.value.trim()  || '';
    const batch   = batchSel?.value           || '';
    const subject = subjectSel?.value         || '';
    const chapter = chapterSel?.value         || '';
    const file    = fileInput?.files[0];

    if (!title)   { APP.toast('Title is required', 'error');   return; }
    if (!batch)   { APP.toast('Select a Batch', 'error');      return; }
    if (!subject) { APP.toast('Select a Subject', 'error');    return; }
    if (!file)    { APP.toast('Choose a PDF file', 'error');   return; }

    _show('nm-progress-wrap');
    _setText('nm-progress-label', 'Reading file…');
    progressBar.value = 10;

    let dataUrl;
    try {
      dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } catch (_) {
      APP.toast('Could not read file', 'error');
      _hide('nm-progress-wrap');
      return;
    }

    _setText('nm-progress-label', 'Uploading to Cloudinary…');
    progressBar.value = 30;

    try {
      await API.uploadNote({ title, batch, subject, chapter, data: dataUrl });
      progressBar.value = 100;
      _setText('nm-progress-label', 'Uploaded!');
      APP.toast('Note uploaded successfully', 'success');
      setTimeout(() => {
        _hideUploadForm();
        _loadNotes();
      }, 600);
    } catch (e) {
      APP.toast('Upload failed: ' + (e.message || 'Unknown error'), 'error');
      _hide('nm-progress-wrap');
    }
  }

  // ── Edit modal ────────────────────────────────────────────────────────────
  async function _openEditModal(note) {
    _editNoteId = note.note_id;
    const overlay = $('nm-edit-overlay');
    if (!overlay) return;

    $('nm-edit-title').value = note.title || '';
    _hide('nm-edit-error');

    // Populate batch (admin.js pre-populated nm-upload-batch; mirror those options into edit selects)
    const uploadBatch = $('nm-upload-batch');
    const editBatch   = $('nm-edit-batch');
    if (uploadBatch && editBatch) {
      editBatch.innerHTML = uploadBatch.innerHTML;
      editBatch.value     = note.batch || '';
    }

    await _populateSubjects('nm-edit-subject', note.batch, 'nm-edit-chapter');
    if ($('nm-edit-subject')) $('nm-edit-subject').value = note.subject || '';

    await _populateChapters('nm-edit-chapter', note.batch, note.subject);
    if ($('nm-edit-chapter')) $('nm-edit-chapter').value = note.chapter || '';

    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
  }

  function _closeEditModal() {
    const overlay = $('nm-edit-overlay');
    if (overlay) { overlay.classList.add('hidden'); overlay.style.display = ''; }
    _editNoteId = null;
  }

  async function _saveEdit() {
    if (!_editNoteId) return;
    const title   = $('nm-edit-title')?.value.trim()   || '';
    const batch   = $('nm-edit-batch')?.value           || '';
    const subject = $('nm-edit-subject')?.value         || '';
    const chapter = $('nm-edit-chapter')?.value         || '';
    const errEl   = $('nm-edit-error');

    if (!title)   { if (errEl) { errEl.textContent = 'Title required'; errEl.classList.remove('hidden'); } return; }
    if (!batch)   { if (errEl) { errEl.textContent = 'Select a batch'; errEl.classList.remove('hidden'); } return; }
    if (!subject) { if (errEl) { errEl.textContent = 'Select a subject'; errEl.classList.remove('hidden'); } return; }
    if (errEl) errEl.classList.add('hidden');

    const btn = $('nm-edit-save');
    if (btn) btn.disabled = true;
    try {
      await API.updateNote(_editNoteId, { title, batch, subject, chapter });
      APP.toast('Note updated', 'success');
      _closeEditModal();
      _loadNotes();
    } catch (e) {
      if (errEl) { errEl.textContent = e.message || 'Save failed'; errEl.classList.remove('hidden'); }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ── Notes list ────────────────────────────────────────────────────────────
  async function _loadNotes() {
    const listEl = $('nm-notes-list');
    if (!listEl) return;
    listEl.innerHTML = '<p class="nm-loading">Loading…</p>';

    let result;
    try {
      result = await API.fetchAdminNotes({ batch: _batch, subject: _subject, chapter: _chapter });
    } catch (e) {
      listEl.innerHTML = `<p class="nm-empty">Error loading notes: ${_esc(e.message)}</p>`;
      return;
    }

    const notes = result.notes || [];
    if (!notes.length) {
      listEl.innerHTML = '<p class="nm-empty">No notes yet. Click "+ Upload PDF" to add one.</p>';
      return;
    }

    listEl.innerHTML = notes.map(n => `
      <div class="nm-card">
        <div class="nm-card-info">
          <div class="nm-card-title">📄 ${_esc(n.title)}</div>
          <div class="nm-card-meta">
            ${_esc(n.batch)} / ${_esc(n.subject)}${n.chapter ? ' / ' + _esc(n.chapter) : ''}
            &nbsp;•&nbsp; ${_fmtSize(n.file_size_bytes)}
            &nbsp;•&nbsp; ${_fmtDate(n.created_at)}
            &nbsp;•&nbsp; ${n.view_count ?? 0} views
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="admin-btn-secondary admin-btn-sm nm-edit-btn"
                  data-id="${_esc(n.note_id)}"
                  data-title="${_esc(n.title)}"
                  data-batch="${_esc(n.batch)}"
                  data-subject="${_esc(n.subject)}"
                  data-chapter="${_esc(n.chapter || '')}">✏️ Edit</button>
          <button class="admin-btn-danger admin-btn-sm nm-delete-btn"
                  data-id="${_esc(n.note_id)}"
                  data-title="${_esc(n.title)}">🗑️ Del</button>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.nm-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => _openEditModal({
        note_id: btn.dataset.id,
        title:   btn.dataset.title,
        batch:   btn.dataset.batch,
        subject: btn.dataset.subject,
        chapter: btn.dataset.chapter,
      }));
    });

    listEl.querySelectorAll('.nm-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => _deleteNote(btn.dataset.id, btn.dataset.title));
    });
  }

  async function _deleteNote(noteId, title) {
    if (!confirm(`Delete note "${title}"?\n\nThis cannot be undone.`)) return;
    try {
      await API.deleteNote(noteId);
      APP.toast('Note deleted', 'success');
      _loadNotes();
    } catch (e) {
      APP.toast('Delete failed: ' + (e.message || ''), 'error');
    }
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  async function _applyFilter() {
    _batch   = $('nm-filter-batch')?.value   || '';
    _subject = $('nm-filter-subject')?.value || '';
    _chapter = $('nm-filter-chapter')?.value || '';
    _loadNotes();
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    if (!_initialized) {
      _initialized = true;

      // Filter: batch change → subjects → chapters
      $('nm-filter-batch')?.addEventListener('change', async e => {
        await _populateSubjects('nm-filter-subject', e.target.value, 'nm-filter-chapter');
        _resetChapter('nm-filter-chapter');
        _applyFilter();
      });
      $('nm-filter-subject')?.addEventListener('change', async e => {
        await _populateChapters('nm-filter-chapter', $('nm-filter-batch')?.value || '', e.target.value);
        _applyFilter();
      });
      $('nm-filter-chapter')?.addEventListener('change', _applyFilter);
      $('nm-filter-btn')?.addEventListener('click', _applyFilter);

      // Upload form
      $('nm-upload-btn')?.addEventListener('click', _showUploadForm);
      $('nm-upload-cancel')?.addEventListener('click', _hideUploadForm);
      $('nm-upload-do')?.addEventListener('click', _doUpload);
      $('nm-upload-file')?.addEventListener('change', _onFileChange);

      $('nm-upload-batch')?.addEventListener('change', async e => {
        await _populateSubjects('nm-upload-subject', e.target.value, 'nm-upload-chapter');
        _resetChapter('nm-upload-chapter');
      });
      $('nm-upload-subject')?.addEventListener('change', async e => {
        await _populateChapters('nm-upload-chapter', $('nm-upload-batch')?.value || '', e.target.value);
      });

      // Edit modal
      $('nm-edit-cancel')?.addEventListener('click', _closeEditModal);
      $('nm-edit-save')?.addEventListener('click', _saveEdit);
      $('nm-edit-overlay')?.addEventListener('click', e => {
        if (e.target === $('nm-edit-overlay')) _closeEditModal();
      });
      $('nm-edit-batch')?.addEventListener('change', async e => {
        await _populateSubjects('nm-edit-subject', e.target.value, 'nm-edit-chapter');
        _resetChapter('nm-edit-chapter');
      });
      $('nm-edit-subject')?.addEventListener('change', async e => {
        await _populateChapters('nm-edit-chapter', $('nm-edit-batch')?.value || '', e.target.value);
      });
    }

    _loadNotes();
  }

  return { init };
})();

window.NOTES_MANAGER = NOTES_MANAGER;
