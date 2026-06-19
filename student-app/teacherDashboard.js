/* ════════════════════════════════════════
   teacherDashboard.js — Teacher Dashboard
   Tabs: Students | Analytics
   Global: TEACHER_DASHBOARD
════════════════════════════════════════ */

const TEACHER_DASHBOARD = (() => {
  const $ = id => document.getElementById(id);

  let _students            = [];
  let _selectedStudentCode = null;
  let _analyticsLoaded     = false;
  let _activeTab           = 'students';

  // ── Init ──────────────────────────────────────────────────────────────────────

  function init() {
    $('td-back-btn')?.addEventListener('click', _handleBack);
    $('td-refresh-btn')?.addEventListener('click', _handleRefresh);

    document.querySelectorAll('[data-tdtab]').forEach(btn => {
      btn.addEventListener('click', () => _switchTab(btn.dataset.tdtab));
    });
  }

  // ── Tab switching ─────────────────────────────────────────────────────────────

  function _switchTab(tab) {
    _activeTab = tab;
    document.querySelectorAll('[data-tdtab]').forEach(b => {
      const active = b.dataset.tdtab === tab;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });
    $('td-tab-students')?.classList.toggle('hidden', tab !== 'students');
    $('td-tab-analytics')?.classList.toggle('hidden', tab !== 'analytics');

    // Hide back button on Analytics tab (it belongs to student detail)
    if (tab === 'analytics') {
      $('td-back-btn')?.classList.add('hidden');
      $('td-detail-name').textContent = 'Teacher Dashboard';
      if (!_analyticsLoaded) _loadAnalytics();
    }
  }

  function _handleBack() {
    if (_activeTab === 'students' && _selectedStudentCode) {
      _showStudentList();
    }
  }

  function _handleRefresh() {
    if (_activeTab === 'analytics') {
      _analyticsLoaded = false;
      _loadAnalytics();
    } else {
      loadDashboard();
    }
  }

  // ── Load students ─────────────────────────────────────────────────────────────

  async function loadDashboard() {
    const wrapEl = $('td-student-list');
    if (wrapEl) wrapEl.innerHTML = '<p class="td-hint">Loading...</p>';
    _showStudentList();

    try {
      _students = await API.fetchTeacherStudents();
    } catch (err) {
      if (wrapEl) wrapEl.innerHTML = `<p class="td-hint">${_esc(err.message || 'Failed to load')}</p>`;
      return;
    }
    _renderStudentList();
  }

  // ── Student List ──────────────────────────────────────────────────────────────

  function _showStudentList() {
    $('td-student-list-view')?.classList.remove('hidden');
    $('td-student-detail-view')?.classList.add('hidden');
    $('td-back-btn')?.classList.add('hidden');
    $('td-detail-name').textContent = 'Teacher Dashboard';
    _selectedStudentCode = null;
  }

  function _renderStudentList() {
    const listEl = $('td-student-list');
    if (!listEl) return;

    if (!_students.length) {
      listEl.innerHTML = '<p class="td-hint">कोणतेही assigned students नाहीत.<br>Admin ला assign करायला सांगा.</p>';
      return;
    }

    listEl.innerHTML = _students.map(s => {
      const lastDate  = s.last_attempt
        ? new Date(s.last_attempt).toLocaleDateString('mr-IN')
        : '—';
      const avg       = s.avg_score_pct ?? 0;
      const avgClass  = avg >= 70 ? 'td-score-good' : avg >= 40 ? 'td-score-avg' : 'td-score-low';
      return `<div class="td-student-card" role="button" tabindex="0" data-code="${_esc(s.student_code)}">
        <div class="td-student-info">
          <span class="td-student-name">${_esc(s.name)}</span>
          <span class="td-student-code">${_esc(s.student_code)}</span>
          ${s.school_name ? `<span class="td-student-school">${_esc(s.school_name)}</span>` : ''}
        </div>
        <div class="td-student-stats">
          <span class="td-stat"><strong>${s.total_attempts}</strong><small>Tests</small></span>
          <span class="td-stat ${avgClass}"><strong>${avg}%</strong><small>Avg</small></span>
          <span class="td-stat"><small>${lastDate}</small></span>
        </div>
        <span class="td-arrow">›</span>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.td-student-card').forEach(card => {
      const open = () => _openStudentDetail(card.dataset.code);
      card.addEventListener('click', open);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });
    });
  }

  // ── Student Detail ────────────────────────────────────────────────────────────

  async function _openStudentDetail(studentCode) {
    _selectedStudentCode = studentCode;
    const student = _students.find(s => s.student_code === studentCode);

    $('td-student-list-view')?.classList.add('hidden');
    $('td-student-detail-view')?.classList.remove('hidden');
    $('td-back-btn')?.classList.remove('hidden');
    if ($('td-detail-name') && student) $('td-detail-name').textContent = student.name;

    const attEl = $('td-attempts-list');
    if (!attEl) return;
    attEl.innerHTML = '<p class="td-hint">Loading...</p>';

    try {
      const attempts = await API.fetchStudentAttemptsForTeacher(studentCode);
      if (!attempts.length) {
        attEl.innerHTML = '<p class="td-hint">कोणतेही test attempts नाहीत.</p>';
        return;
      }
      attEl.innerHTML = attempts.map(a => {
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
      attEl.innerHTML = `<p class="td-hint">${_esc(err.message || 'Failed to load attempts')}</p>`;
    }
  }

  // ── Analytics ─────────────────────────────────────────────────────────────────

  async function _loadAnalytics() {
    const container = $('td-analytics-content');
    if (!container) return;
    container.innerHTML = '<p class="td-hint">Loading analytics...</p>';

    try {
      const [weekly, monthly, weak, strong, ranking] = await Promise.all([
        API.fetchTeacherWeekly(),
        API.fetchTeacherMonthly(),
        API.fetchTeacherWeakTopics(),
        API.fetchTeacherStrongTopics(),
        API.fetchTeacherRanking(),
      ]);
      _analyticsLoaded = true;
      _renderAnalytics(container, { weekly, monthly, weak, strong, ranking });
    } catch (err) {
      container.innerHTML = `<p class="td-hint">${_esc(err.message || 'Analytics load failed')}</p>`;
    }
  }

  function _renderAnalytics(container, { weekly, monthly, weak, strong, ranking }) {
    container.innerHTML = `
      <div class="td-analytics-section">
        <div class="td-analytics-header">
          <span class="td-analytics-icon">📅</span>
          <h3 class="td-analytics-title">Weekly Progress</h3>
          <span class="td-analytics-sub">last 7 days</span>
        </div>
        ${_buildBarChart(weekly, 'date', 'count', 'avg_pct', 'label')}
      </div>

      <div class="td-analytics-section">
        <div class="td-analytics-header">
          <span class="td-analytics-icon">📆</span>
          <h3 class="td-analytics-title">Monthly Progress</h3>
          <span class="td-analytics-sub">last 4 weeks</span>
        </div>
        ${_buildBarChart(monthly, 'week_of', 'count', 'avg_pct', 'label')}
      </div>

      <div class="td-analytics-section">
        <div class="td-analytics-header">
          <span class="td-analytics-icon">🔴</span>
          <h3 class="td-analytics-title">Weak Topics</h3>
          <span class="td-analytics-sub">highest wrong %</span>
        </div>
        ${_buildTopicList(weak, 'wrong_pct', 'weak')}
      </div>

      <div class="td-analytics-section">
        <div class="td-analytics-header">
          <span class="td-analytics-icon">🟢</span>
          <h3 class="td-analytics-title">Strong Topics</h3>
          <span class="td-analytics-sub">highest correct %</span>
        </div>
        ${_buildTopicList(strong, 'correct_pct', 'strong')}
      </div>

      <div class="td-analytics-section">
        <div class="td-analytics-header">
          <span class="td-analytics-icon">🏆</span>
          <h3 class="td-analytics-title">Student Ranking</h3>
          <span class="td-analytics-sub">by avg score</span>
        </div>
        ${_buildRanking(ranking)}
      </div>
    `;
  }

  // ── Chart builders ────────────────────────────────────────────────────────────

  function _buildBarChart(data, dateKey, countKey, pctKey, labelKey) {
    if (!data.length) return '<p class="td-hint td-hint-sm">अजून कोणतेही attempts नाहीत.</p>';

    const maxCount = Math.max(...data.map(d => d[countKey]), 1);

    return `<div class="td-bar-chart" aria-label="Bar chart">
      ${data.map(d => {
        const count  = d[countKey] || 0;
        const pct    = d[pctKey]   || 0;
        const height = Math.round((count / maxCount) * 100);
        const barCls = pct >= 70 ? 'td-bar-good' : pct >= 40 ? 'td-bar-avg' : count === 0 ? 'td-bar-empty' : 'td-bar-low';
        return `<div class="td-bar-item" aria-label="${_esc(String(d[labelKey] || d[dateKey]))}: ${count} tests, ${pct}% avg">
          <span class="td-bar-count">${count > 0 ? count : ''}</span>
          <div class="td-bar-track">
            <div class="td-bar ${barCls}" style="height:${height}%"></div>
          </div>
          <span class="td-bar-label">${_esc(String(d[labelKey] || d[dateKey]))}</span>
          ${count > 0 ? `<span class="td-bar-pct">${pct}%</span>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  }

  function _buildTopicList(data, pctKey, type) {
    if (!data.length) return '<p class="td-hint td-hint-sm">पुरेसा data नाही.</p>';

    const maxPct = Math.max(...data.map(d => d[pctKey]), 1);
    const barCls = type === 'weak' ? 'td-topic-bar-weak' : 'td-topic-bar-strong';

    return `<div class="td-topic-list">
      ${data.map((d, i) => {
        const pct = d[pctKey] || 0;
        const width = Math.round((pct / 100) * 100);
        return `<div class="td-topic-row">
          <span class="td-topic-rank">${i + 1}</span>
          <div class="td-topic-info">
            <span class="td-topic-name">${_esc(d.subject || '—')}</span>
            <div class="td-topic-track">
              <div class="td-topic-bar ${barCls}" style="width:${width}%"></div>
            </div>
          </div>
          <span class="td-topic-pct">${pct}%</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  function _buildRanking(data) {
    if (!data.length) return '<p class="td-hint td-hint-sm">पुरेसा data नाही.</p>';

    const medals = ['🥇', '🥈', '🥉'];

    return `<div class="td-ranking-list">
      ${data.map((d, i) => {
        const medal   = medals[i] || `${i + 1}.`;
        const pct     = d.avg_pct || 0;
        const pctCls  = pct >= 70 ? 'td-score-good' : pct >= 40 ? 'td-score-avg' : 'td-score-low';
        return `<div class="td-ranking-row">
          <span class="td-rank-medal">${medal}</span>
          <div class="td-rank-info">
            <span class="td-rank-name">${_esc(d.name || d.student_code)}</span>
            <span class="td-rank-code">${_esc(d.student_code)}</span>
          </div>
          <div class="td-rank-right">
            <span class="td-rank-pct ${pctCls}">${pct}%</span>
            <span class="td-rank-attempts">${d.total_attempts} tests</span>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { init, loadDashboard };
})();

window.TEACHER_DASHBOARD = TEACHER_DASHBOARD;
