/* ════════════════════════════════════════
   importManager.js — Admin > Classes > "Import from another batch"
   Copies Notes, Exercises, MCQ questions, Tests and PDF notes of one
   batch/subject into another. Server: TeachingBoard-backend
   /api/admin/import (preview → run → undo).
════════════════════════════════════════ */

(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t = 'info') => (typeof APP !== 'undefined' && APP?.toast) ? APP.toast(m, t) : console.log(m);

  const TYPE_LABELS = { notes: '📓 Notes', exercises: '📄 Exercises', mcq: '❓ MCQ', quizzes: '📝 Tests', pdf: '📎 PDF Notes' };

  let _batches = [];
  let _loaded = false;
  let _previewOk = false;
  let _busy = false;

  // ── cascading Board → Medium → Batch → Subject pickers ─────────────────────
  const sides = {
    src: { board: 'imp-src-board', medium: 'imp-src-medium', batch: 'imp-src-batch', subject: 'imp-src-subject' },
    tgt: { board: 'imp-tgt-board', medium: 'imp-tgt-medium', batch: 'imp-tgt-batch', subject: 'imp-tgt-subject' },
  };

  function _fill(sel, items, placeholder, keepValue) {
    if (!sel) return;
    const prev = keepValue ? sel.value : '';
    sel.innerHTML = `<option value="">${esc(placeholder)}</option>` +
      items.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    if (prev && items.includes(prev)) sel.value = prev;
  }

  function _filteredBatches(side) {
    const board = $(sides[side].board)?.value || '';
    const medium = $(sides[side].medium)?.value || '';
    return _batches.filter(b => (!board || b.board === board) && (!medium || b.medium === medium));
  }

  function _refreshBatchOptions(side) {
    _fill($(sides[side].batch), _filteredBatches(side).map(b => b.name), 'Select batch...', true);
    _refreshSubjectOptions(side);
  }

  function _refreshSubjectOptions(side) {
    const name = $(sides[side].batch)?.value || '';
    const batch = _batches.find(b => b.name === name);
    const sel = $(sides[side].subject);
    const subjects = batch?.subjects || [];
    if (side === 'tgt') {
      sel.innerHTML = '<option value="">Select subject...</option>' +
        subjects.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('') +
        '<option value="__new__">➕ New subject...</option>';
      _toggleNewSubject();
    } else {
      _fill(sel, subjects, 'Select subject...', true);
    }
  }

  function _toggleNewSubject() {
    const isNew = $('imp-tgt-subject')?.value === '__new__';
    $('imp-tgt-new-subject')?.classList.toggle('hidden', !isNew);
  }

  function _targetSubjectName() {
    const v = $('imp-tgt-subject')?.value || '';
    return v === '__new__' ? ($('imp-tgt-new-subject')?.value || '').trim() : v;
  }

  // ── source chapters + optional target-chapter mapping ───────────────────────
  let _srcChapters = [];
  let _tgtChapterNames = [];

  async function _loadSourceChapters() {
    const batch = $('imp-src-batch')?.value || '';
    const subject = $('imp-src-subject')?.value || '';
    const host = $('imp-chapters');
    _resetPreview();
    _srcChapters = [];
    if (!host) return;
    if (!batch || !subject) { host.innerHTML = '<p class="empty-hint">Select the source batch and subject.</p>'; return; }
    host.innerHTML = '<p class="empty-hint">Loading…</p>';
    try {
      _srcChapters = await API.fetchImportChapters(batch, subject);
    } catch (err) {
      host.innerHTML = `<p class="empty-hint">${esc(err.message || 'Could not load chapters')}</p>`;
      return;
    }
    await _loadTargetChapters();
    _renderChapters();
  }

  async function _loadTargetChapters() {
    _tgtChapterNames = [];
    const batch = $('imp-tgt-batch')?.value || '';
    const subject = _targetSubjectName();
    if (!batch || !subject || $('imp-tgt-subject')?.value === '__new__') return;
    try {
      _tgtChapterNames = (await API.fetchChapterOrder(batch, subject)).map(c => c.name);
    } catch { /* mapping dropdowns just stay empty */ }
  }

  function _renderChapters() {
    const host = $('imp-chapters');
    if (!host) return;
    if (!_srcChapters.length) { host.innerHTML = '<p class="empty-hint">No content found in this subject.</p>'; return; }
    const mapOptions = '<option value="">→ same name / new</option>' +
      _tgtChapterNames.map(n => `<option value="${esc(n)}">→ ${esc(n)}</option>`).join('');
    host.innerHTML = `
      <label class="imp-chapter-row imp-chapter-all"><input type="checkbox" id="imp-chapter-all" checked /> <strong>All chapters (${_srcChapters.length})</strong></label>
      ${_srcChapters.map((c, i) => `
        <div class="imp-chapter-row">
          <label><input type="checkbox" class="imp-chapter-cb" data-i="${i}" checked /> ${esc(c.name)}</label>
          <span class="imp-chips">${Object.entries(c.counts).filter(([, n]) => n > 0).map(([k, n]) => `<span>${TYPE_LABELS[k]} ${n}</span>`).join('') || '<span>—</span>'}</span>
          ${_tgtChapterNames.length ? `<select class="admin-select imp-map" data-i="${i}" aria-label="Target chapter">${mapOptions}</select>` : ''}
        </div>`).join('')}`;
    $('imp-chapter-all')?.addEventListener('change', e => {
      host.querySelectorAll('.imp-chapter-cb').forEach(cb => { cb.checked = e.target.checked; });
      _resetPreview();
    });
    host.querySelectorAll('.imp-chapter-cb, .imp-map').forEach(el => el.addEventListener('change', _resetPreview));
  }

  // ── request body from the form ──────────────────────────────────────────────
  function _buildRequest() {
    const source = { batch: $('imp-src-batch')?.value || '', subject: $('imp-src-subject')?.value || '' };
    const target = { batch: $('imp-tgt-batch')?.value || '', subject: _targetSubjectName() };
    if (!source.batch || !source.subject) throw new Error('Select the source batch and subject');
    if (!target.batch || !target.subject) throw new Error('Select the target batch and subject');
    const types = [...document.querySelectorAll('.imp-type:checked')].map(cb => cb.value);
    if (!types.length) throw new Error('Select at least one type (Notes/Exercises/...)');

    const checked = [...document.querySelectorAll('.imp-chapter-cb')].filter(cb => cb.checked).map(cb => Number(cb.dataset.i));
    if (!checked.length) throw new Error('Select at least one chapter');
    const chapters = checked.length === _srcChapters.length ? [] : checked.map(i => _srcChapters[i].name);
    const chapterMap = {};
    document.querySelectorAll('.imp-map').forEach(sel => {
      if (sel.value) chapterMap[_srcChapters[Number(sel.dataset.i)].name] = sel.value;
    });
    return { source, target, types, chapters, chapterMap, asDraft: !!$('imp-draft')?.checked };
  }

  // ── preview → run ───────────────────────────────────────────────────────────
  function _resetPreview() {
    _previewOk = false;
    if ($('imp-run-btn')) $('imp-run-btn').disabled = true;
    if ($('imp-preview-out')) $('imp-preview-out').innerHTML = '';
  }

  function _setBusy(on) {
    _busy = on;
    ['imp-preview-btn', 'imp-run-btn'].forEach(id => { const b = $(id); if (b) b.disabled = on || (id === 'imp-run-btn' && !_previewOk); });
  }

  async function _preview() {
    if (_busy) return;
    let req;
    try { req = _buildRequest(); } catch (err) { toast(err.message, 'error'); return; }
    _setBusy(true);
    $('imp-preview-out').innerHTML = '<p class="empty-hint">Checking...</p>';
    try {
      const d = await API.previewImport(req);
      const fresh = Object.values(d.totals).reduce((s, t) => s + t.fresh, 0);
      const dup = Object.values(d.totals).reduce((s, t) => s + t.duplicate, 0);
      const rows = d.chapters.map(c => {
        const cells = Object.entries(c.counts).filter(([, n]) => n.total > 0)
          .map(([k, n]) => `${TYPE_LABELS[k]} <strong>${n.fresh}</strong>${n.duplicate ? ` <small>(+${n.duplicate} already there)</small>` : ''}`).join(' · ') || '—';
        return `<div class="imp-prev-row"><div><strong>${esc(c.name)}</strong> ${c.target_is_new ? '<span class="imp-new">new chapter</span>' : `<span class="imp-existing">→ ${esc(c.target_name)}</span>`}</div><div>${cells}</div></div>`;
      }).join('');
      $('imp-preview-out').innerHTML = `
        <div class="imp-summary">
          <strong>${fresh}</strong> new items will be imported${dup ? ` · ${dup} already there (skipped)` : ''}
          ${d.mixed_quizzes_skipped ? ` · ${d.mixed_quizzes_skipped} mixed test skipped (spans several chapters)` : ''}
          ${!d.target_subject_exists ? '<div class="imp-note">ℹ️ This subject does not exist in the target yet and will be created.</div>' : ''}
          ${d.target_has_chapters ? '<div class="imp-note">ℹ️ The target subject already has chapters. New chapters will be added at the end.</div>' : ''}
        </div>${rows}`;
      _previewOk = fresh > 0;
      if (!fresh) toast('Nothing new to import', 'info');
    } catch (err) {
      $('imp-preview-out').innerHTML = `<p class="empty-hint">${esc(err.message || 'Preview failed')}</p>`;
    } finally {
      _setBusy(false);
    }
  }

  async function _run() {
    if (_busy || !_previewOk) return;
    let req;
    try { req = _buildRequest(); } catch (err) { toast(err.message, 'error'); return; }
    if (!await APP.confirmAsync(`Import into "${req.target.batch} / ${req.target.subject}"? (You can undo it afterwards)`)) return;
    _setBusy(true);
    try {
      const d = await API.runImport(req);
      const line = Object.entries(d.results).filter(([, r]) => r.created || r.skipped)
        .map(([k, r]) => `${TYPE_LABELS[k]}: ${r.created} new${r.skipped ? `, ${r.skipped} skipped` : ''}`).join(' · ');
      $('imp-preview-out').innerHTML = `<div class="imp-summary imp-done">✅ Import complete: ${esc(line)}
        <div><button class="admin-btn-secondary" id="imp-undo-now" type="button">↩️ Undo this import</button></div></div>`;
      $('imp-undo-now')?.addEventListener('click', () => _undo(d.job_id));
      _previewOk = false;
      toast('✅ Import complete', 'success');
      await _loadJobs();
    } catch (err) {
      toast(`Import failed: ${err.message}`, 'error');
      await _loadJobs();
    } finally {
      _setBusy(false);
    }
  }

  async function _undo(jobId) {
    if (!await APP.confirmAsync('Undo this import? (Only the items created by this import will be deleted)')) return;
    try {
      const d = await API.undoImport(jobId);
      const n = Object.values(d.deleted).reduce((s, v) => s + v, 0);
      toast(`↩️ Undone: ${n} items removed`, 'success');
      _resetPreview();
      await _loadJobs();
    } catch (err) {
      toast(`Undo failed: ${err.message}`, 'error');
    }
  }

  async function _loadJobs() {
    const host = $('imp-jobs');
    if (!host) return;
    try {
      const jobs = await API.fetchImportJobs();
      if (!jobs.length) { host.innerHTML = '<p class="empty-hint">No imports yet.</p>'; return; }
      host.innerHTML = '';
      jobs.forEach(j => {
        const made = Object.entries(j.results || {}).filter(([k, r]) => TYPE_LABELS[k] && r?.created)
          .map(([k, r]) => `${TYPE_LABELS[k]} ${r.created}`).join(' · ') || '—';
        const row = document.createElement('div');
        row.className = 'batch-admin-item';
        row.innerHTML = `
          <div class="student-card-info">
            <div class="batch-admin-name">${esc(j.source?.batch)} / ${esc(j.source?.subject)} → ${esc(j.target?.batch)} / ${esc(j.target?.subject)}</div>
            <div class="student-meta-row"><span>${esc(new Date(j.created_at).toLocaleString())}</span><span>${made}</span>${j.as_draft ? '<span>Draft</span>' : ''}${j.undone ? '<span>↩️ Undone</span>' : ''}${j.results?.error ? '<span>⚠️ Partial</span>' : ''}</div>
          </div>
          ${j.undone ? '' : '<button class="admin-btn-secondary" data-undo type="button">↩️ Undo</button>'}`;
        row.querySelector('[data-undo]')?.addEventListener('click', () => _undo(j.job_id));
        host.appendChild(row);
      });
    } catch (err) {
      host.innerHTML = `<p class="empty-hint">${esc(err.message || 'Could not load imports')}</p>`;
    }
  }

  // ── wiring ──────────────────────────────────────────────────────────────────
  function _bindSide(side) {
    const s = sides[side];
    const others = [s.board, s.medium];
    others.forEach(id => $(id)?.addEventListener('change', () => { _refreshBatchOptions(side); _onChanged(side); }));
    $(s.batch)?.addEventListener('change', () => { _refreshSubjectOptions(side); _onChanged(side); });
    $(s.subject)?.addEventListener('change', () => { if (side === 'tgt') _toggleNewSubject(); _onChanged(side); });
  }

  async function _onChanged(side) {
    if (side === 'src') await _loadSourceChapters();
    else { _resetPreview(); await _loadTargetChapters(); _renderChapters(); }
  }

  async function _ensureLoaded() {
    if (_loaded || !$('imp-src-batch')) return;
    try {
      _batches = await API.fetchCatalogBatches();
    } catch (err) {
      toast(`Could not load batches: ${err.message}`, 'error');
      return;
    }
    _loaded = true;
    const boards = [...new Set(_batches.map(b => b.board).filter(Boolean))].sort();
    const mediums = [...new Set(_batches.map(b => b.medium).filter(Boolean))].sort();
    ['src', 'tgt'].forEach(side => {
      _fill($(sides[side].board), boards, 'All boards');
      _fill($(sides[side].medium), mediums, 'All mediums');
      _refreshBatchOptions(side);
    });
    await _loadJobs();
  }

  function init() {
    if (!$('imp-src-batch')) return;
    ['src', 'tgt'].forEach(_bindSide);
    $('imp-tgt-new-subject')?.addEventListener('input', () => { _resetPreview(); });
    $('imp-tgt-new-subject')?.addEventListener('change', async () => { await _loadTargetChapters(); _renderChapters(); });
    document.querySelectorAll('.imp-type, #imp-draft').forEach(el => el.addEventListener('change', _resetPreview));
    $('imp-preview-btn')?.addEventListener('click', _preview);
    $('imp-run-btn')?.addEventListener('click', _run);
    $('imp-refresh-jobs')?.addEventListener('click', _loadJobs);
    // Batches are fetched the first time the Classes tab is opened (admin is logged in by then).
    document.querySelector('button.atab[data-tab="classes"]')?.addEventListener('click', _ensureLoaded);
    document.querySelectorAll('.abn-drawer-item[data-tab="classes"]').forEach(el => el.addEventListener('click', _ensureLoaded));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
