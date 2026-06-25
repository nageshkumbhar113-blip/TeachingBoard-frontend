/* ════════════════════════════════════════
   parentDashboard.js — Parent Dashboard
   Global: PARENT_DASHBOARD
════════════════════════════════════════ */

const PARENT_DASHBOARD = (() => {
  const $ = id => document.getElementById(id);

  let _children    = [];
  let _activeTab   = 'analytics'; // 'analytics' | 'fee'
  let _activeCode  = null;

  // ── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    $('pd-back-btn')?.addEventListener('click', _showChildList);
    $('pd-refresh-btn')?.addEventListener('click', () => {
      if (_activeCode) _openChildDetail(_activeCode);
      else loadDashboard();
    });
  }

  // ── Load ─────────────────────────────────────────────────────────────────────

  async function loadDashboard() {
    if (!$('pd-content')) return;
    _activeCode = null;
    _showChildList();

    const listEl = $('pd-child-list');
    if (listEl) listEl.innerHTML = '<p class="td-hint">Loading...</p>';

    try {
      _children = await API.fetchParentChildren();
    } catch (err) {
      if (listEl) listEl.innerHTML = `<p class="td-hint">${_esc(err.message || 'Failed to load children')}</p>`;
      return;
    }

    _renderChildList();
  }

  // ── Child List ───────────────────────────────────────────────────────────────

  function _showChildList() {
    _activeCode = null;
    const listEl   = $('pd-child-list-view');
    const detailEl = $('pd-child-detail-view');
    if (listEl)   listEl.classList.remove('hidden');
    if (detailEl) detailEl.classList.add('hidden');
    const titleEl = $('pd-detail-name');
    if (titleEl) titleEl.textContent = 'Parent Dashboard';
    $('pd-back-btn')?.classList.add('hidden');
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
      const avg      = c.avg_score_pct ?? 0;
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
    _activeCode = studentCode;
    const child = _children.find(c => c.student_code === studentCode);

    $('pd-child-list-view')?.classList.add('hidden');
    $('pd-child-detail-view')?.classList.remove('hidden');
    $('pd-back-btn')?.classList.remove('hidden');

    const titleEl = $('pd-detail-name');
    if (titleEl) titleEl.textContent = (child?.name || studentCode) + ' चे Dashboard';

    // Render tab bar
    const detailEl = $('pd-child-detail-view');
    if (detailEl) {
      detailEl.innerHTML = `
        <div class="pd-tabs">
          <button class="pd-tab${_activeTab === 'analytics' ? ' active' : ''}" data-tab="analytics">📊 Analytics</button>
          <button class="pd-tab${_activeTab === 'fee'       ? ' active' : ''}" data-tab="fee">💰 Fee</button>
        </div>
        <div id="pd-tab-body"></div>`;

      detailEl.querySelectorAll('.pd-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          _activeTab = btn.dataset.tab;
          detailEl.querySelectorAll('.pd-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === _activeTab));
          _loadTab(studentCode);
        });
      });
    }

    _loadTab(studentCode);
  }

  function _loadTab(studentCode) {
    if (_activeTab === 'analytics') _loadAnalytics(studentCode);
    else                            _loadFee(studentCode);
  }

  // ── Analytics Tab ────────────────────────────────────────────────────────────

  async function _loadAnalytics(studentCode) {
    const body = $('pd-tab-body');
    if (!body) return;
    body.innerHTML = '<p class="td-hint">Loading...</p>';

    try {
      const attempts = await API.fetchChildAttempts(studentCode);
      if (!attempts.length) {
        body.innerHTML = '<p class="td-hint">कोणतेही test attempts नाहीत.</p>';
        return;
      }

      body.innerHTML = _buildAnalytics(attempts);
    } catch (err) {
      body.innerHTML = `<p class="td-hint" style="color:var(--error)">${_esc(err.message || 'Failed to load')}</p>`;
    }
  }

  function _buildAnalytics(attempts) {
    // Overall stats
    const totalTests  = attempts.length;
    const totalQ      = attempts.reduce((s, a) => s + (a.total_questions || 0), 0);
    const totalScore  = attempts.reduce((s, a) => s + (a.score || 0), 0);
    const overallPct  = totalQ > 0 ? Math.round((totalScore / totalQ) * 100) : 0;
    const overallCls  = overallPct >= 70 ? 'td-score-good' : overallPct >= 40 ? 'td-score-avg' : 'td-score-low';

    // Subject breakdown
    const subMap = {};
    attempts.forEach(a => {
      const key = a.subject || 'General';
      if (!subMap[key]) subMap[key] = { total: 0, correct: 0, count: 0 };
      subMap[key].total   += a.total_questions || 0;
      subMap[key].correct += a.score || 0;
      subMap[key].count   += 1;
    });

    const subRows = Object.entries(subMap).map(([sub, d]) => {
      const pct = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0;
      const cls = pct >= 70 ? 'td-score-good' : pct >= 40 ? 'td-score-avg' : 'td-score-low';
      const tag = pct >= 70 ? '🌟 Excellent' : pct >= 40 ? '📈 Improving' : '⚠️ Needs Practice';
      return `<div class="pd-sug-row">
        <span class="pd-sug-subject">${_esc(sub)}</span>
        <span class="pd-sug-pct ${cls}">${pct}%</span>
        <span class="pd-sug-tag">${tag}</span>
      </div>`;
    }).join('');

    // Recent attempts (latest 10)
    const recentRows = attempts.slice(0, 10).map(a => {
      const pct  = a.total_questions > 0 ? Math.round((a.score / a.total_questions) * 100) : 0;
      const cls  = pct >= 70 ? 'td-score-good' : pct >= 40 ? 'td-score-avg' : 'td-score-low';
      const date = new Date(a.submitted_at).toLocaleString('mr-IN', { dateStyle: 'short', timeStyle: 'short' });
      return `<div class="td-attempt-row">
        <div class="td-attempt-meta">
          <span class="td-attempt-title">${_esc(a.quiz_title || a.quiz_id)}</span>
          <span class="td-attempt-date">${_esc(date)}</span>
        </div>
        <div class="td-attempt-score ${cls}">${a.score}/${a.total_questions} (${pct}%)</div>
      </div>`;
    }).join('');

    return `
      <div class="pd-overview-chips">
        <div class="pd-chip">
          <strong>${totalTests}</strong>
          <small>Tests दिले</small>
        </div>
        <div class="pd-chip ${overallCls}">
          <strong>${overallPct}%</strong>
          <small>Overall Avg</small>
        </div>
        <div class="pd-chip">
          <strong>${totalScore}/${totalQ}</strong>
          <small>Total Score</small>
        </div>
      </div>

      <div class="pd-sug-card">
        <div class="pd-sug-header">📚 Subject-wise Performance</div>
        ${subRows || '<p class="td-hint" style="margin:4px 0">Data नाही</p>'}
      </div>

      <div class="pd-section-title">🕐 अलीकडील Tests</div>
      ${recentRows}`;
  }

  // ── Fee Tab ───────────────────────────────────────────────────────────────────

  async function _loadFee(studentCode) {
    const body = $('pd-tab-body');
    if (!body) return;
    body.innerHTML = '<p class="td-hint">Loading...</p>';

    try {
      const records = await API.fetchChildFee(studentCode);
      if (!records.length) {
        body.innerHTML = '<p class="td-hint">कोणतीही fee entry नाही.<br>Admin / Teacher ला सांगा.</p>';
        return;
      }
      body.innerHTML = records.map(_buildFeeCard).join('');
    } catch (err) {
      body.innerHTML = `<p class="td-hint" style="color:var(--error)">${_esc(err.message || 'Failed to load fee')}</p>`;
    }
  }

  function _buildFeeCard(r) {
    const remaining = r.total_amount - r.paid_amount;
    const pct       = r.total_amount > 0 ? Math.round((r.paid_amount / r.total_amount) * 100) : 0;
    const statusIcon = r.status === 'paid' ? '✅' : r.status === 'partial' ? '🟡' : '🔴';
    const statusText = r.status === 'paid' ? 'पूर्ण भरली' : r.status === 'partial' ? 'अंशतः भरली' : 'बाकी आहे';
    const dueDate    = r.due_date ? new Date(r.due_date).toLocaleDateString('mr-IN') : '—';

    const nextInstallRow = (r.status !== 'paid' && r.next_installment_amount > 0)
      ? `<div class="pd-fee-next">
           📅 पुढची Installment: <strong>₹${r.next_installment_amount}</strong>
           ${r.next_installment_date ? ' — ' + new Date(r.next_installment_date).toLocaleDateString('mr-IN') : ''}
         </div>`
      : '';

    const payHistory = r.payments?.length
      ? `<details class="fee-payment-history">
           <summary>Payment History (${r.payments.length})</summary>
           ${r.payments.map(p => {
             const d = new Date(p.paid_at).toLocaleDateString('mr-IN');
             return `<div class="fee-pay-hist-row">₹${p.amount} · ${_modeLabel(p.payment_mode)} — ${d}${p.note ? ' · ' + _esc(p.note) : ''}</div>`;
           }).join('')}
         </details>`
      : '';

    return `<div class="pd-fee-card">
      <div class="pd-fee-header">
        <span class="pd-fee-label">${statusIcon} ${_esc(r.label || 'Fee')}</span>
        <span class="pd-fee-badge pd-fee-${r.status}">${statusText}</span>
      </div>
      <div class="pd-fee-due">Due Date: ${dueDate}</div>

      <div class="pd-fee-amounts">
        <div class="pd-fee-amt-row">
          <span>एकूण फी</span>
          <strong>₹${r.total_amount}</strong>
        </div>
        <div class="pd-fee-amt-row">
          <span>भरलेली</span>
          <strong style="color:var(--success,#22c55e)">₹${r.paid_amount}</strong>
        </div>
        <div class="pd-fee-amt-row">
          <span>बाकी</span>
          <strong style="color:var(--error,#ef4444)">₹${remaining}</strong>
        </div>
      </div>

      <div class="fee-progress-wrap" style="margin:8px 0 4px">
        <div class="fee-progress-bar" style="width:${pct}%"></div>
      </div>
      <div style="font-size:0.75rem;color:var(--text2);text-align:right;margin-bottom:6px">${pct}% भरली</div>

      ${nextInstallRow}
      ${payHistory}
    </div>`;
  }

  function _modeLabel(mode) {
    return { cash: '💵 Cash', online: '🌐 Online', upi: '📱 UPI', cheque: '🏦 Cheque' }[mode] || mode || '—';
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { init, loadDashboard };
})();

window.PARENT_DASHBOARD = PARENT_DASHBOARD;
