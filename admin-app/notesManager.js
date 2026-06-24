/* global API, DB, APP */
'use strict';

const NOTES_MANAGER = (() => {
  const $ = id => document.getElementById(id);

  // ── State ────────────────────────────────────────────────────────────────
  let _batch   = '';
  let _subject = '';

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                           .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function _show(id) { const el = $(id); if (el) el.classList.remove('hidden'); }
  function _hide(id) { const el = $(id); if (el) el.classList.add('hidden'); }
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
  async function _populateBatches(selId) {
    const sel = $(selId);
    if (!sel) return;
    sel.innerHTML = '<option value="">All Batches</option>';
    try {
      const batches = await DB.getAllBatches();
      batches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.name; opt.textContent = b.name;
        sel.appendChild(opt);
      });
    } catch (_) {}
  }

  async function _populateSubjects(selId, batch) {
    const sel = $(selId);
    if (!sel) return;
    sel.innerHTML = '<option value="">All Subjects</option>';
    if (!batch) { sel.disabled = true; return; }
    try {
      const subs = await DB.getSubjectsByBatch(batch);
      subs.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name; opt.textContent = s.name;
        sel.appendChild(opt);
      });
      sel.disabled = false;
    } catch (_) { sel.disabled = true; }
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
    _populateBatches('nm-upload-batch');
    $('nm-upload-subject').innerHTML  = '<option value="">Select Subject</option>';
    $('nm-upload-subject').disabled   = true;
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

    // Warning for files over 3 MB
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
    const fileInput    = $('nm-upload-file');
    const progressBar  = $('nm-upload-progress');
    const progressWrap = $('nm-progress-wrap');

    const title   = titleInput?.value.trim()  || '';
    const batch   = batchSel?.value           || '';
    const subject = subjectSel?.value         || '';
    const file    = fileInput?.files[0];

    if (!title)   { APP.toast('Title is required', 'error');   return; }
    if (!batch)   { APP.toast('Select a Batch', 'error');      return; }
    if (!subject) { APP.toast('Select a Subject', 'error');    return; }
    if (!file)    { APP.toast('Choose a PDF file', 'error');   return; }

    // Read file as base64
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
      await API.uploadNote({ title, batch, subject, data: dataUrl });
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

  // ── Notes list ────────────────────────────────────────────────────────────
  async function _loadNotes() {
    const listEl = $('nm-notes-list');
    if (!listEl) return;
    listEl.innerHTML = '<p class="nm-loading">Loading…</p>';

    let result;
    try {
      result = await API.fetchAdminNotes({ batch: _batch, subject: _subject });
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
            ${_esc(n.batch)} / ${_esc(n.subject)}
            &nbsp;•&nbsp; ${_fmtSize(n.file_size_bytes)}
            &nbsp;•&nbsp; ${_fmtDate(n.created_at)}
            &nbsp;•&nbsp; ${n.view_count ?? 0} views
          </div>
        </div>
        <button class="admin-btn-danger admin-btn-sm nm-delete-btn"
                data-id="${_esc(n.note_id)}"
                data-title="${_esc(n.title)}">🗑️ Delete</button>
      </div>
    `).join('');

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
    _loadNotes();
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    // Filter dropdowns
    await _populateBatches('nm-filter-batch');
    $('nm-filter-batch')?.addEventListener('change', async e => {
      await _populateSubjects('nm-filter-subject', e.target.value);
      _applyFilter();
    });
    $('nm-filter-subject')?.addEventListener('change', _applyFilter);
    $('nm-filter-btn')?.addEventListener('click', _applyFilter);

    // Upload form
    $('nm-upload-btn')?.addEventListener('click', _showUploadForm);
    $('nm-upload-cancel')?.addEventListener('click', _hideUploadForm);
    $('nm-upload-do')?.addEventListener('click', _doUpload);
    $('nm-upload-file')?.addEventListener('change', _onFileChange);

    $('nm-upload-batch')?.addEventListener('change', async e => {
      await _populateSubjects('nm-upload-subject', e.target.value);
    });

    _loadNotes();
  }

  return { init };
})();

window.NOTES_MANAGER = NOTES_MANAGER;
