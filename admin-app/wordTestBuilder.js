/* ════════════════════════════════════════════════════════════
   wordTestBuilder.js — Admin Word Test Creator
   Wizard: Batch → Subject → Stats → Question Config → Generate
         → Preview → Save Draft / Publish
   Global: WORD_TEST_BUILDER
════════════════════════════════════════════════════════════ */

const WORD_TEST_BUILDER = (() => {
  const $  = id => document.getElementById(id);
  const _esc = s => String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  // ── State ─────────────────────────────────────────────────────
  let _batch         = '';
  let _subject       = '';
  let _stats         = null;
  let _previewData   = null;  // { title, questions, warnings }
  let _editingTestId = null;
  let _currentView   = 'list'; // 'list' | 'create' | 'preview' | 'results'

  // Question type labels + default counts (for the config UI)
  const TYPE_META = {
    listen_pick_picture:  { label: 'Listen → Pick Picture',   icon: '🖼️',  defaultCount: 5 },
    listen_choose_word:   { label: 'Listen → Choose Word',    icon: '🔤',  defaultCount: 5 },
    listen_meaning_mr:    { label: 'Listen → Meaning (MR)',   icon: '📖',  defaultCount: 5 },
    listen_meaning_en:    { label: 'Listen → Meaning (EN)',   icon: '📗',  defaultCount: 5 },
    listen_spelling:      { label: 'Listen → Spelling',       icon: '✍️',  defaultCount: 5 },
    listen_type_word:     { label: 'Listen → Type Word',      icon: '⌨️',  defaultCount: 3 },
    listen_pick_colour:   { label: 'Listen → Pick Colour',    icon: '🎨',  defaultCount: 5 },
    listen_pick_alphabet: { label: 'Listen → Pick Letter',    icon: '🔡',  defaultCount: 5 },
    listen_pick_number:   { label: 'Listen → Pick Number',    icon: '🔢',  defaultCount: 5 },
    word_meaning_mr:      { label: 'Word → Meaning (MR)',     icon: '📝',  defaultCount: 5 },
  };

  // ── Helpers ───────────────────────────────────────────────────

  function _show(id)   { const el = $(id); if (el) el.classList.remove('hidden'); }
  function _hide(id)   { const el = $(id); if (el) el.classList.add('hidden'); }
  function _setText(id, t) { const el = $(id); if (el) el.textContent = t ?? ''; }

  function _showMsg(id, msg, isErr = false) {
    const el = $(id);
    if (!el) return;
    el.textContent  = msg;
    el.className    = isErr ? 'wt-msg wt-msg-err' : 'wt-msg wt-msg-ok';
    el.classList.remove('hidden');
  }

  function _setView(view) {
    _currentView = view;
    ['wt-list-view','wt-create-view','wt-preview-view','wt-results-view'].forEach(id => _hide(id));
    _show(`wt-${view}-view`);
  }

  // ── List View ─────────────────────────────────────────────────

  async function _loadList() {
    _setView('list');
    const listEl = $('wt-test-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="wt-loading">Loading...</div>';

    try {
      const res   = await API.listAdminWordTests(_batch, _subject);
      const tests = res.tests || [];

      if (!tests.length) {
        listEl.innerHTML = '<p class="empty-hint">No word tests yet. Create one!</p>';
        return;
      }

      listEl.innerHTML = '';
      tests.forEach(t => listEl.appendChild(_makeTestCard(t)));
    } catch(e) {
      listEl.innerHTML = `<p class="wt-err">⚠️ ${_esc(e.message)}</p>`;
    }
  }

  function _makeTestCard(t) {
    const card = document.createElement('div');
    card.className = 'wt-test-card';
    const statusClass = t.status === 'published' ? 'wt-badge-pub' : 'wt-badge-draft';
    const statusLabel = t.status === 'published' ? '🟢 Published' : '📝 Draft';
    const date = t.published_at
      ? new Date(t.published_at).toLocaleDateString('en-IN')
      : new Date(t.created_at).toLocaleDateString('en-IN');

    card.innerHTML = `
      <div class="wt-card-info">
        <div class="wt-card-title">${_esc(t.title)}</div>
        <div class="wt-card-meta">
          <span class="wt-badge ${statusClass}">${statusLabel}</span>
          <span>${_esc(t.batch)} / ${_esc(t.subject)}</span>
          <span>${t.total_questions} Qs</span>
          <span>${date}</span>
        </div>
      </div>
      <div class="wt-card-actions">
        ${t.status === 'draft'
          ? `<button class="admin-btn-primary admin-btn-sm" data-action="publish" data-id="${_esc(t.test_id)}">Publish</button>`
          : `<button class="admin-btn-secondary admin-btn-sm" data-action="unpublish" data-id="${_esc(t.test_id)}">Unpublish</button>`
        }
        <button class="admin-btn-secondary admin-btn-sm" data-action="results" data-id="${_esc(t.test_id)}">Results</button>
        ${t.status === 'draft'
          ? `<button class="admin-btn-secondary admin-btn-sm wt-btn-danger" data-action="delete" data-id="${_esc(t.test_id)}">Delete</button>`
          : ''
        }
      </div>`;

    card.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => _onCardAction(btn.dataset.action, btn.dataset.id));
    });
    return card;
  }

  async function _onCardAction(action, testId) {
    if (action === 'publish') {
      if (!confirm('Publish this test? Students will see it immediately.')) return;
      try { await API.publishWordTest(testId); await _loadList(); }
      catch(e) { alert('Error: ' + e.message); }
    } else if (action === 'unpublish') {
      if (!confirm('Unpublish this test?')) return;
      try { await API.unpublishWordTest(testId); await _loadList(); }
      catch(e) { alert('Error: ' + e.message); }
    } else if (action === 'delete') {
      if (!confirm('Delete this draft? This cannot be undone.')) return;
      try { await API.deleteWordTest(testId); await _loadList(); }
      catch(e) { alert('Error: ' + e.message); }
    } else if (action === 'results') {
      await _showResults(testId);
    }
  }

  // ── Results View ──────────────────────────────────────────────

  async function _showResults(testId) {
    _setView('results');
    const bodyEl = $('wt-results-body');
    if (!bodyEl) return;
    bodyEl.innerHTML = '<div class="wt-loading">Loading results...</div>';

    try {
      const res = await API.getWordTestResults(testId);
      _setText('wt-results-title', res.test?.title || 'Test Results');
      _setText('wt-results-summary',
        `${res.attempt_count} attempts · Avg ${res.avg_percent}% · Pass rate ${res.pass_rate}%`);

      if (!res.attempts?.length) {
        bodyEl.innerHTML = '<p class="empty-hint">No attempts yet.</p>';
        return;
      }

      bodyEl.innerHTML = `
        <table class="wt-results-table">
          <thead><tr><th>Student</th><th>Score</th><th>Result</th><th>Date</th></tr></thead>
          <tbody>${res.attempts.map(a => `
            <tr>
              <td>${_esc(a.student_code)}</td>
              <td>${a.score} / ${a.total} (${Math.round(a.score/a.total*100)}%)</td>
              <td class="${a.passed ? 'wt-pass' : 'wt-fail'}">${a.passed ? '✅ Passed' : '❌ Failed'}</td>
              <td>${new Date(a.submitted_at).toLocaleDateString('en-IN')}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    } catch(e) {
      bodyEl.innerHTML = `<p class="wt-err">⚠️ ${_esc(e.message)}</p>`;
    }
  }

  // ── Create View — Step 1: Batch + Subject ─────────────────────

  function _openCreate() {
    _editingTestId = null;
    _previewData   = null;
    _batch         = '';
    _subject       = '';
    _stats         = null;

    _setView('create');
    _hide('wt-stats-section');
    _hide('wt-type-config-section');
    _hide('wt-generate-btn-row');

    const batchSel = $('wt-batch-sel');
    const subjSel  = $('wt-subject-sel');
    if (batchSel) batchSel.value = '';
    if (subjSel)  { subjSel.innerHTML = '<option value="">Select Subject</option>'; subjSel.disabled = true; }

    _populateBatchDropdown();
  }

  async function _populateBatchDropdown() {
    const sel = $('wt-batch-sel');
    if (!sel) return;
    try {
      const batches = await DB.getAllBatches();
      sel.innerHTML = '<option value="">Select Batch</option>';
      batches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.name; opt.textContent = b.name;
        sel.appendChild(opt);
      });
    } catch { /* keep default */ }
  }

  async function _onBatchChange(batchVal) {
    _batch   = batchVal;
    _subject = '';
    _stats   = null;
    _hide('wt-stats-section');
    _hide('wt-type-config-section');
    _hide('wt-generate-btn-row');

    const subjSel = $('wt-subject-sel');
    if (!subjSel) return;
    subjSel.innerHTML = '<option value="">Select Subject</option>';
    subjSel.disabled  = true;

    if (!_batch) return;
    try {
      const subjects = await DB.getBatchSubjects(_batch);
      subjects.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name; opt.textContent = s.name;
        subjSel.appendChild(opt);
      });
      subjSel.disabled = false;
    } catch { /* keep default */ }
  }

  async function _onSubjectChange(subjVal) {
    _subject = subjVal;
    _stats   = null;
    _hide('wt-stats-section');
    _hide('wt-type-config-section');
    _hide('wt-generate-btn-row');

    if (!_batch || !_subject) return;
    await _loadStats();
  }

  // ── Create View — Step 2: Stats ───────────────────────────────

  async function _loadStats() {
    const statsEl = $('wt-stats-body');
    if (!statsEl) return;

    _show('wt-stats-section');
    statsEl.innerHTML = '<div class="wt-loading">Checking word bank...</div>';

    try {
      _stats = await API.fetchWordTestStats(_batch, _subject);
      _renderStats(_stats);
      _renderTypeConfig(_stats);
      _show('wt-type-config-section');
      _show('wt-generate-btn-row');
    } catch(e) {
      statsEl.innerHTML = `<p class="wt-err">⚠️ ${_esc(e.message)}</p>`;
    }
  }

  function _renderStats(stats) {
    const el = $('wt-stats-body');
    if (!el) return;

    const warn = stats.missing_enrichment_count > 0
      ? `<div class="wt-stats-warn">⚠️ ${stats.missing_enrichment_count} words have no meaning or image. Consider enriching them.</div>`
      : '';

    el.innerHTML = `
      <div class="wt-stats-grid">
        <div class="wt-stat-chip">📚 Total<br><strong>${stats.total}</strong></div>
        <div class="wt-stat-chip">🖼️ With Image<br><strong>${stats.with_image}</strong></div>
        <div class="wt-stat-chip">😀 With Emoji<br><strong>${stats.with_emoji}</strong></div>
        <div class="wt-stat-chip">📖 Meaning MR<br><strong>${stats.with_meaning_mr}</strong></div>
        <div class="wt-stat-chip">📗 Meaning EN<br><strong>${stats.with_meaning_en}</strong></div>
      </div>
      ${warn}`;
  }

  // ── Create View — Step 3: Question Type Config ────────────────

  function _renderTypeConfig(stats) {
    const el = $('wt-type-config-list');
    if (!el) return;
    el.innerHTML = '';

    Object.entries(TYPE_META).forEach(([type, meta]) => {
      const ts = stats.type_stats?.[type];
      const feasible = ts?.feasible ?? false;
      const maxQ     = ts?.max_questions ?? 0;

      const row = document.createElement('div');
      row.className = `wt-type-row ${feasible ? '' : 'wt-type-row-disabled'}`;
      row.innerHTML = `
        <label class="wt-type-toggle">
          <input type="checkbox" class="wt-type-check" data-type="${_esc(type)}"
            ${feasible ? '' : 'disabled'}
            title="${feasible ? '' : 'Not enough words in bank'}" />
          <span class="wt-type-icon">${meta.icon}</span>
          <span class="wt-type-label">${_esc(meta.label)}</span>
        </label>
        <div class="wt-type-right">
          ${feasible
            ? `<span class="wt-type-max">max ${maxQ}</span>
               <input type="number" class="wt-type-count admin-input short" data-type="${_esc(type)}"
                 value="${Math.min(meta.defaultCount, maxQ)}" min="1" max="${maxQ}" />`
            : `<span class="wt-type-na">⚠️ Need ${ts?.min_required ?? '?'} words</span>`
          }
        </div>`;
      el.appendChild(row);
    });
  }

  function _getQuestionConfigs() {
    const configs = [];
    document.querySelectorAll('.wt-type-check:checked').forEach(chk => {
      const type  = chk.dataset.type;
      const countEl = document.querySelector(`.wt-type-count[data-type="${type}"]`);
      const count = countEl ? Math.max(1, parseInt(countEl.value) || 1) : 1;
      configs.push({ type, count });
    });
    return configs;
  }

  // ── Create View — Step 4: Generate + Preview ──────────────────

  async function _generate() {
    const titleInput = $('wt-title-input');
    const title = String(titleInput?.value || '').trim();
    if (!title) { alert('Test title द्या.'); titleInput?.focus(); return; }

    const configs = _getQuestionConfigs();
    if (!configs.length) { alert('किमान एक question type select करा.'); return; }

    const genBtn = $('wt-btn-generate');
    if (genBtn) { genBtn.disabled = true; genBtn.textContent = 'Generating...'; }

    try {
      const res = await API.generateWordTestPreview(_batch, _subject, title, configs);
      _previewData = { title, questions: res.questions, warnings: res.warnings || [] };
      _showPreview();
    } catch(e) {
      alert('Generate failed: ' + e.message);
    } finally {
      if (genBtn) { genBtn.disabled = false; genBtn.textContent = '⚡ Generate Preview'; }
    }
  }

  // ── Preview View ──────────────────────────────────────────────

  function _showPreview() {
    _setView('preview');
    const el = $('wt-preview-list');
    if (!el || !_previewData) return;

    _setText('wt-preview-title', _previewData.title);
    _setText('wt-preview-count', `${_previewData.questions.length} questions`);

    // Show any generation warnings
    const warnEl = $('wt-preview-warnings');
    if (warnEl) {
      if (_previewData.warnings.length) {
        warnEl.innerHTML = _previewData.warnings.map(w => `<div class="wt-warn-item">⚠️ ${_esc(w)}</div>`).join('');
        _show('wt-preview-warnings');
      } else {
        _hide('wt-preview-warnings');
      }
    }

    el.innerHTML = '';
    _previewData.questions.forEach((q, i) => el.appendChild(_makePreviewCard(q, i)));
  }

  function _makePreviewCard(q, idx) {
    const card = document.createElement('div');
    card.className = 'wt-preview-card';

    const optionsHtml = q.option_type === 'typing'
      ? '<div class="wt-opt-typing">⌨️ Student types answer</div>'
      : (q.options || []).map(o => `
          <div class="wt-opt ${o.is_correct ? 'wt-opt-correct' : ''}">
            <span class="wt-opt-id">${_esc(o.id)}</span>
            ${o.image_url
              ? `<img src="${_esc(o.image_url)}" class="wt-opt-img" alt="${_esc(o.text)}" />`
              : o.emoji_svg
                ? `<img src="${_esc(o.emoji_svg)}" class="wt-opt-emoji" alt="${_esc(o.emoji)}" />`
                : o.colour
                  ? `<span class="wt-opt-colour" style="background:${_esc(o.colour)}"></span><span>${_esc(o.text)}</span>`
                  : `<span>${_esc(o.text)}</span>`
            }
            ${o.is_correct ? ' ✅' : ''}
          </div>`).join('');

    card.innerHTML = `
      <div class="wt-preview-card-header">
        <span class="wt-q-num">Q${idx + 1}</span>
        <span class="wt-q-type">${_esc(q.question_label)}</span>
        ${q.audio ? '<span class="wt-q-audio">🔊 ' + _esc(q.audio_word) + '</span>' : ''}
      </div>
      <div class="wt-q-template">${_esc(q.question_template)}</div>
      <div class="wt-opts-grid wt-opts-${q.option_type}">${optionsHtml}</div>`;

    return card;
  }

  // ── Save + Publish ────────────────────────────────────────────

  async function _saveDraft() {
    if (!_previewData) return;
    const saveBtn = $('wt-btn-save-draft');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

    try {
      const res = await API.saveWordTestDraft(
        _batch, _subject, _previewData.title, _previewData.questions
      );
      alert(`✅ Draft saved! Test ID: ${res.test_id}`);
      await _loadList();
    } catch(e) {
      alert('Save failed: ' + e.message);
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Save Draft'; }
    }
  }

  async function _saveAndPublish() {
    if (!_previewData) return;
    if (!confirm(`Publish "${_previewData.title}"? Students will see it immediately.`)) return;
    const pubBtn = $('wt-btn-publish');
    if (pubBtn) { pubBtn.disabled = true; pubBtn.textContent = 'Publishing...'; }

    try {
      const draftRes = await API.saveWordTestDraft(
        _batch, _subject, _previewData.title, _previewData.questions
      );
      await API.publishWordTest(draftRes.test_id);
      alert('✅ Test published!');
      await _loadList();
    } catch(e) {
      alert('Publish failed: ' + e.message);
    } finally {
      if (pubBtn) { pubBtn.disabled = false; pubBtn.textContent = '🚀 Publish Now'; }
    }
  }

  // ── Init ──────────────────────────────────────────────────────

  function init() {
    // List view buttons
    $('wt-btn-create')?.addEventListener('click', _openCreate);
    $('wt-list-batch-sel')?.addEventListener('change', async e => {
      _batch = e.target.value;
      _subject = '';
      const subSel = $('wt-list-subject-sel');
      if (subSel) { subSel.innerHTML = '<option value="">All Subjects</option>'; subSel.disabled = true; }
      if (_batch) {
        try {
          const subjects = await DB.getBatchSubjects(_batch);
          subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.name; opt.textContent = s.name;
            subSel?.appendChild(opt);
          });
          if (subSel) subSel.disabled = false;
        } catch {}
      }
      await _loadList();
    });
    $('wt-list-subject-sel')?.addEventListener('change', async e => {
      _subject = e.target.value;
      await _loadList();
    });
    $('wt-btn-refresh-list')?.addEventListener('click', _loadList);

    // Create view
    $('wt-batch-sel')?.addEventListener('change', e => _onBatchChange(e.target.value));
    $('wt-subject-sel')?.addEventListener('change', e => _onSubjectChange(e.target.value));
    $('wt-btn-generate')?.addEventListener('click', _generate);
    $('wt-btn-back-to-list')?.addEventListener('click', _loadList);

    // Preview view
    $('wt-btn-save-draft')?.addEventListener('click', _saveDraft);
    $('wt-btn-publish')?.addEventListener('click', _saveAndPublish);
    $('wt-btn-back-to-create')?.addEventListener('click', () => _setView('create'));

    // Results view
    $('wt-btn-results-back')?.addEventListener('click', _loadList);
  }

  // Called by admin-shell.js when this tab is activated
  async function onTabActivated() {
    await _loadList();
    const listBatchSel = $('wt-list-batch-sel');
    if (listBatchSel && listBatchSel.options.length <= 1) {
      try {
        const batches = await DB.getAllBatches();
        batches.forEach(b => {
          const opt = document.createElement('option');
          opt.value = b.name; opt.textContent = b.name;
          listBatchSel.appendChild(opt);
        });
      } catch {}
    }
  }

  return { init, onTabActivated };
})();

window.WORD_TEST_BUILDER = WORD_TEST_BUILDER;
document.addEventListener('DOMContentLoaded', () => WORD_TEST_BUILDER.init());
