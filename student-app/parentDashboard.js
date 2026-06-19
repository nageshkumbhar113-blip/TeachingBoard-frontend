/* ════════════════════════════════════════
   parentDashboard.js — Parent Dashboard
   Global: PARENT_DASHBOARD
════════════════════════════════════════ */

const PARENT_DASHBOARD = (() => {
  const $ = id => document.getElementById(id);

  let _children = [];

  // ── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    $('pd-back-btn')?.addEventListener('click', _showChildList);
    $('pd-refresh-btn')?.addEventListener('click', loadDashboard);
  }

  // ── Load ─────────────────────────────────────────────────────────────────────

  async function loadDashboard() {
    const wrapEl = $('pd-content');
    if (!wrapEl) return;
    wrapEl.innerHTML = '<p class="td-hint">Loading...</p>';
    _showChildList();

    try {
      _children = await API.fetchParentChildren();
    } catch (err) {
      wrapEl.innerHTML = `<p class="td-hint">${_esc(err.message || 'Failed to load children')}</p>`;
      return;
    }

    _renderChildList();
  }

  // ── Child List ───────────────────────────────────────────────────────────────

  function _showChildList() {
    const listEl    = $('pd-child-list-view');
    const detailEl  = $('pd-child-detail-view');
    if (listEl)   listEl.classList.remove('hidden');
    if (detailEl) detailEl.classList.add('hidden');
    const backBtn = $('pd-back-btn');
    if (backBtn)  backBtn.classList.add('hidden');
  }

  function _renderChildList() {
    const listEl = $('pd-child-list');
    if (!listEl) return;

    if (!_children.length) {
      listEl.innerHTML = '<p class="td-hint">कोणतेही मुले जोडलेले नाहीत.<br>Admin ला सांगा.</p>';
      return;
    }

    listEl.innerHTML = _children.map(c => {
      const lastDate = c.last_attempt
        ? new Date(c.last_attempt).toLocaleDateString('mr-IN')
        : '—';
      const avg = c.avg_score_pct ?? 0;
      const avgClass = avg >= 70 ? 'td-score-good' : avg >= 40 ? 'td-score-avg' : 'td-score-low';
      return `<div class="td-student-card" role="button" tabindex="0" data-code="${_esc(c.student_code)}">
        <div class="td-student-info">
          <span class="td-student-name">${_esc(c.name)}</span>
          <span class="td-student-code">${_esc(c.student_code)}</span>
          ${c.school_name ? `<span class="td-student-school">${_esc(c.school_name)}</span>` : ''}
        </div>
        <div class="td-student-stats">
          <span class="td-stat"><strong>${c.total_attempts}</strong><small>Tests</small></span>
          <span class="td-stat ${avgClass}"><strong>${avg}%</strong><small>Avg</small></span>
          <span class="td-stat"><small>${lastDate}</small></span>
        </div>
        <span class="td-arrow">›</span>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.td-student-card').forEach(card => {
      const handler = () => _openChildDetail(card.dataset.code);
      card.addEventListener('click', handler);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') handler(); });
    });
  }

  // ── Child Detail ─────────────────────────────────────────────────────────────

  async function _openChildDetail(studentCode) {
    const child = _children.find(c => c.student_code === studentCode);

    const listEl   = $('pd-child-list-view');
    const detailEl = $('pd-child-detail-view');
    if (listEl)   listEl.classList.add('hidden');
    if (detailEl) detailEl.classList.remove('hidden');

    const backBtn = $('pd-back-btn');
    if (backBtn)  backBtn.classList.remove('hidden');

    const nameEl = $('pd-detail-name');
    if (nameEl && child) nameEl.textContent = child.name + ' चे Attempts';

    const attemptsEl = $('pd-attempts-list');
    if (!attemptsEl) return;
    attemptsEl.innerHTML = '<p class="td-hint">Loading...</p>';

    try {
      const attempts = await API.fetchChildAttempts(studentCode);

      const sugEl = $('pd-suggestions');
      if (sugEl) sugEl.innerHTML = attempts.length ? _buildSuggestions(attempts) : '';

      if (!attempts.length) {
        attemptsEl.innerHTML = '<p class="td-hint">कोणतेही test attempts नाहीत.</p>';
        return;
      }
      attemptsEl.innerHTML = attempts.map(a => {
        const pct  = a.total_questions > 0 ? Math.round((a.score / a.total_questions) * 100) : 0;
        const cls  = pct >= 70 ? 'td-score-good' : pct >= 40 ? 'td-score-avg' : 'td-score-low';
        const date = new Date(a.submitted_at).toLocaleString('mr-IN', { dateStyle: 'medium', timeStyle: 'short' });
        return `<div class="td-attempt-row">
          <div class="td-attempt-meta">
            <span class="td-attempt-title">${_esc(a.quiz_title || a.quiz_id)}</span>
            <span class="td-attempt-date">${_esc(date)}</span>
          </div>
          <div class="td-attempt-score ${cls}">${a.score}/${a.total_questions} (${pct}%)</div>
        </div>`;
      }).join('');
    } catch (err) {
      const sugEl = $('pd-suggestions');
      if (sugEl) sugEl.innerHTML = '';
      attemptsEl.innerHTML = `<p class="td-hint">${_esc(err.message || 'Failed to load attempts')}</p>`;
    }
  }

  // ── Study Report ─────────────────────────────────────────────────────────────

  function _buildSuggestions(attempts) {
    const subMap = {};
    attempts.forEach(a => {
      const key = a.subject || a.quiz_title || 'General';
      if (!subMap[key]) subMap[key] = { total: 0, correct: 0 };
      subMap[key].total   += a.total_questions || 0;
      subMap[key].correct += a.score || 0;
    });

    const overallTotal   = attempts.reduce((s, a) => s + (a.total_questions || 0), 0);
    const overallCorrect = attempts.reduce((s, a) => s + (a.score || 0), 0);
    const overallPct     = overallTotal > 0 ? Math.round((overallCorrect / overallTotal) * 100) : 0;
    const overallCls     = overallPct >= 70 ? 'td-score-good' : overallPct >= 40 ? 'td-score-avg' : 'td-score-low';

    const rows = Object.entries(subMap).map(([sub, d]) => {
      const pct = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0;
      const cls = pct >= 70 ? 'td-score-good' : pct >= 40 ? 'td-score-avg' : 'td-score-low';
      const tag = pct >= 70
        ? '🌟 Excellent work!'
        : pct >= 40
        ? '📈 Keep improving'
        : '⚠️ Needs more practice';
      return `<div class="pd-sug-row">
        <span class="pd-sug-subject">${_esc(sub)}</span>
        <span class="pd-sug-pct ${cls}">${pct}%</span>
        <span class="pd-sug-tag">${tag}</span>
      </div>`;
    }).join('');

    return `<div class="pd-sug-card">
      <div class="pd-sug-header">📊 Study Report</div>
      ${rows}
      <div class="pd-sug-overall">
        ${attempts.length} test${attempts.length !== 1 ? 's' : ''} completed &nbsp;·&nbsp;
        Overall average: <span class="${overallCls}">${overallPct}%</span>
      </div>
    </div>`;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { init, loadDashboard };
})();

window.PARENT_DASHBOARD = PARENT_DASHBOARD;
