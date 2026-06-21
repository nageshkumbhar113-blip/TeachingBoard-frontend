/* ════════════════════════════════════════
   teacherDashboard.js — Teacher Dashboard
   Tabs: Students | Analytics | Notifications
   Global: TEACHER_DASHBOARD
════════════════════════════════════════ */

const TEACHER_DASHBOARD = (() => {
  const $ = id => document.getElementById(id);

  let _students            = [];
  let _selectedStudentCode = null;
  let _analyticsLoaded     = false;
  let _activeTab           = 'students';
  let _notifMode           = null;   // 'batch' | 'individual'
  let _notifStudentCode    = null;   // for individual mode

  // ── Init ──────────────────────────────────────────────────────────────────────

  function init() {
    $('td-back-btn')?.addEventListener('click', _handleBack);
    $('td-refresh-btn')?.addEventListener('click', _handleRefresh);

    document.querySelectorAll('[data-tdtab]').forEach(btn => {
      btn.addEventListener('click', () => _switchTab(btn.dataset.tdtab));
    });

    // Batch notification button (Notifications tab)
    $('td-send-batch-btn')?.addEventListener('click', () => _openModal('batch'));

    // Per-student parent notify button (Student detail view)
    $('td-notify-parent-btn')?.addEventListener('click', () => {
      if (_selectedStudentCode) _openModal('individual', _selectedStudentCode);
    });

    // Modal actions
    $('td-modal-cancel')?.addEventListener('click', _closeModal);
    $('td-modal-send')?.addEventListener('click', _handleSend);
    $('td-notif-modal')?.addEventListener('click', e => {
      if (e.target === $('td-notif-modal')) _closeModal();
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
    $('td-tab-notifications')?.classList.toggle('hidden', tab !== 'notifications');
    $('td-tab-vocab')?.classList.toggle('hidden', tab !== 'vocab');

    if (tab === 'analytics') {
      $('td-back-btn')?.classList.add('hidden');
      $('td-detail-name').textContent = 'Teacher Dashboard';
      if (!_analyticsLoaded) _loadAnalytics();
    }

    if (tab === 'notifications') {
      $('td-back-btn')?.classList.add('hidden');
      $('td-detail-name').textContent = 'Teacher Dashboard';
      _loadAllNotifHistory();
    }

    if (tab === 'vocab') {
      $('td-back-btn')?.classList.add('hidden');
      $('td-detail-name').textContent = 'Vocab Scores';
      _initVocabTab();
    }

    if (tab === 'students') {
      // Restore correct header state
      if (_selectedStudentCode) {
        const student = _students.find(s => s.student_code === _selectedStudentCode);
        if (student && $('td-detail-name')) $('td-detail-name').textContent = student.name;
        $('td-back-btn')?.classList.remove('hidden');
      }
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
    } else if (_activeTab === 'notifications') {
      _loadAllNotifHistory();
    } else if (_activeTab === 'vocab') {
      _loadVocabScores();
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

    // Hide notification history until button clicked
    $('td-notify-history')?.classList.add('hidden');
    const histList = $('td-notify-history-list');
    if (histList) histList.innerHTML = '';

    const attEl = $('td-attempts-list');
    if (!attEl) return;
    attEl.innerHTML = '<p class="td-hint">Loading...</p>';

    try {
      const attempts = await API.fetchStudentAttemptsForTeacher(studentCode);
      if (!attempts.length) {
        attEl.innerHTML = '<p class="td-hint">कोणतेही test attempts नाहीत.</p>';
      } else {
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
      }
    } catch (err) {
      attEl.innerHTML = `<p class="td-hint">${_esc(err.message || 'Failed to load attempts')}</p>`;
    }

    // Wire notify-history toggle button (re-wire after each detail open)
    const notifyBtn = $('td-notify-parent-btn');
    if (notifyBtn) {
      const newBtn = notifyBtn.cloneNode(true);
      notifyBtn.replaceWith(newBtn);
      newBtn.addEventListener('click', () => _openModal('individual', studentCode));
    }

    // Load + show notification history for this student
    _loadStudentNotifHistory(studentCode);
  }

  async function _loadStudentNotifHistory(studentCode) {
    const histSection = $('td-notify-history');
    const histList    = $('td-notify-history-list');
    if (!histSection || !histList) return;

    histList.innerHTML = '<p class="td-hint td-hint-sm">Loading...</p>';
    histSection.classList.remove('hidden');

    try {
      const records = await API.fetchTeacherNotificationHistory(studentCode);
      if (!records.length) {
        histList.innerHTML = '<p class="td-hint td-hint-sm">या student च्या parent ला अजून कोणतीही notification पाठवली नाही.</p>';
        return;
      }
      histList.innerHTML = records.map(n => _renderNotifRow(n)).join('');
    } catch (err) {
      histList.innerHTML = `<p class="td-hint td-hint-sm">${_esc(err.message || 'History load failed')}</p>`;
    }
  }

  // ── Notifications tab ─────────────────────────────────────────────────────────

  async function _loadAllNotifHistory() {
    const el = $('td-notif-history-all');
    if (!el) return;
    el.innerHTML = '<p class="td-hint td-hint-sm">Loading...</p>';

    try {
      const records = await API.fetchTeacherNotificationHistory();
      if (!records.length) {
        el.innerHTML = '<p class="td-hint td-hint-sm">अजून कोणतीही notification पाठवली नाही.</p>';
        return;
      }
      el.innerHTML = records.map(n => _renderNotifRow(n)).join('');
    } catch (err) {
      el.innerHTML = `<p class="td-hint td-hint-sm">${_esc(err.message || 'History load failed')}</p>`;
    }
  }

  function _renderNotifRow(n) {
    const date = new Date(n.sent_at).toLocaleString('mr-IN', { dateStyle: 'medium', timeStyle: 'short' });
    const tag  = n.type === 'batch'
      ? `<span class="td-notif-tag td-notif-tag-batch">Batch: ${_esc(n.batch || '—')}</span>`
      : `<span class="td-notif-tag td-notif-tag-individual">Individual: ${_esc(n.student_code || '—')}</span>`;
    return `<div class="td-notif-row">
      <div class="td-notif-row-top">
        ${tag}
        <span class="td-notif-date">${_esc(date)}</span>
      </div>
      <div class="td-notif-title">${_esc(n.title)}</div>
      <div class="td-notif-body">${_esc(n.body)}</div>
      <div class="td-notif-recipients">${n.recipient_count} parent(s) ला पाठवले</div>
    </div>`;
  }

  // ── Notification modal ────────────────────────────────────────────────────────

  function _openModal(mode, studentCode) {
    _notifMode        = mode;
    _notifStudentCode = studentCode || null;

    const batchRow   = $('td-modal-batch-row');
    const studentRow = $('td-modal-student-row');
    const titleEl    = $('td-modal-title');
    const titleInput = $('td-modal-title-input');
    const bodyInput  = $('td-modal-body-input');
    const errorEl    = $('td-modal-error');
    const sendBtn    = $('td-modal-send');

    if (titleEl)    titleEl.textContent = mode === 'batch' ? 'Batch Notification पाठवा' : 'Parent ला Notify करा';
    if (titleInput) titleInput.value = '';
    if (bodyInput)  bodyInput.value  = '';
    if (errorEl)    { errorEl.textContent = ''; errorEl.classList.add('hidden'); }
    if (sendBtn)    sendBtn.disabled = false;

    if (mode === 'batch') {
      batchRow?.classList.remove('hidden');
      studentRow?.classList.add('hidden');
      _populateBatchSelect();
    } else {
      batchRow?.classList.add('hidden');
      studentRow?.classList.remove('hidden');
      const student = _students.find(s => s.student_code === studentCode);
      const nameEl  = $('td-modal-student-name');
      if (nameEl) nameEl.textContent = student ? `${student.name} (${studentCode})` : studentCode;
    }

    $('td-notif-modal')?.classList.remove('hidden');
    $('td-modal-title-input')?.focus();
  }

  function _closeModal() {
    $('td-notif-modal')?.classList.add('hidden');
    _notifMode        = null;
    _notifStudentCode = null;
  }

  function _populateBatchSelect() {
    const sel = $('td-modal-batch');
    if (!sel) return;

    // Collect unique batches from assigned students
    const batches = [...new Set(
      _students.flatMap(s => Array.isArray(s.assigned_batches) ? s.assigned_batches : [])
    )].sort();

    if (!batches.length) {
      sel.innerHTML = '<option value="">— कोणताही batch नाही —</option>';
      return;
    }
    sel.innerHTML = batches.map(b => `<option value="${_esc(b)}">${_esc(b)}</option>`).join('');
  }

  async function _handleSend() {
    const sendBtn    = $('td-modal-send');
    const errorEl   = $('td-modal-error');
    const titleInput = $('td-modal-title-input');
    const bodyInput  = $('td-modal-body-input');

    const title = (titleInput?.value || '').trim();
    const body  = (bodyInput?.value  || '').trim();

    const showError = msg => {
      if (errorEl) { errorEl.textContent = msg; errorEl.classList.remove('hidden'); }
    };

    if (!title) return showError('Title आवश्यक आहे.');
    if (!body)  return showError('Message आवश्यक आहे.');

    let payload;
    if (_notifMode === 'batch') {
      const batch = ($('td-modal-batch')?.value || '').trim();
      if (!batch) return showError('Batch निवडा.');
      payload = { type: 'batch', batch, title, body };
    } else {
      if (!_notifStudentCode) return showError('Student आढळला नाही.');
      payload = { type: 'individual', student_code: _notifStudentCode, title, body };
    }

    if (sendBtn) sendBtn.disabled = true;
    if (errorEl) errorEl.classList.add('hidden');

    try {
      const res = await API.sendTeacherNotification(payload);
      const count = res?.recipient_count ?? 0;
      _closeModal();
      window.toast?.(`${count} parent(s) ला notification पाठवली!`, 'success');

      // Refresh relevant history
      if (_notifMode === 'individual' && _notifStudentCode) {
        _loadStudentNotifHistory(_notifStudentCode);
      }
      if (_activeTab === 'notifications') {
        _loadAllNotifHistory();
      }
    } catch (err) {
      showError(err.message || 'Notification पाठवता आली नाही. पुन्हा प्रयत्न करा.');
      if (sendBtn) sendBtn.disabled = false;
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

  // ── Vocab Scores Tab ─────────────────────────────────────────────────────────

  let _vocabTabInited = false;

  function _initVocabTab() {
    if (_vocabTabInited) { _populateVocabBatchSel(); return; }
    _vocabTabInited = true;

    $('td-vocab-load-btn')?.addEventListener('click', _loadVocabScores);
    $('td-vocab-batch-sel')?.addEventListener('change', async () => {
      const batch = $('td-vocab-batch-sel')?.value || '';
      if (window.DB?.getSubjectsByBatch) {
        const subjects = await DB.getSubjectsByBatch(batch).catch(() => []);
        const sel = $('td-vocab-subject-sel');
        if (sel) {
          sel.innerHTML = '<option value="">All Subjects</option>';
          subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.name; opt.textContent = s.name;
            sel.appendChild(opt);
          });
        }
      }
    });
    _populateVocabBatchSel();
  }

  async function _populateVocabBatchSel() {
    if (!window.DB?.getAllBatches) return;
    const batches = await DB.getAllBatches().catch(() => []);
    const sel = $('td-vocab-batch-sel');
    if (!sel) return;
    sel.innerHTML = '<option value="">All Batches</option>';
    batches.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.name; opt.textContent = `${b.icon || ''} ${b.name}`.trim();
      sel.appendChild(opt);
    });
  }

  async function _loadVocabScores() {
    const listEl = $('td-vocab-scores-list');
    if (!listEl) return;
    listEl.innerHTML = '<p class="td-hint td-hint-sm">Loading...</p>';

    const batch   = $('td-vocab-batch-sel')?.value   || '';
    const subject = $('td-vocab-subject-sel')?.value || '';

    try {
      const scores = await API.fetchTeacherVocabScores({ batch, subject });
      if (!scores.length) {
        listEl.innerHTML = '<p class="td-hint td-hint-sm">No vocab attempts found.</p>';
        return;
      }

      listEl.innerHTML = scores.map(s => {
        const bars = [
          { label: 'Listen',   pct: s.avg_listen   },
          { label: 'Meaning',  pct: s.avg_meaning  },
          { label: 'Picture',  pct: s.avg_picture  },
          { label: 'Spelling', pct: s.avg_spelling },
        ];
        const barsHtml = bars.map(b => `
          <div class="vocab-score-row">
            <span class="vocab-score-label">${b.label}</span>
            <div class="vocab-score-track">
              <div class="vocab-score-fill ${b.pct >= 70 ? 'vocab-fill-good' : b.pct >= 40 ? 'vocab-fill-avg' : 'vocab-fill-low'}"
                   style="width:${b.pct}%"></div>
            </div>
            <span class="vocab-score-pct">${b.pct}%</span>
          </div>`).join('');

        const tests = s.tests_available != null
          ? `${s.tests_completed} / ${s.tests_available} tests`
          : `${s.tests_completed} tests`;

        return `<div class="td-student-card vocab-score-card-item">
          <div class="td-student-info">
            <span class="td-student-name">${_esc(s.student_name || s.student_code)}</span>
            <span class="td-student-code">${_esc(s.student_code)} — ${tests}</span>
          </div>
          <div class="vocab-bars">${barsHtml}</div>
        </div>`;
      }).join('');
    } catch (err) {
      listEl.innerHTML = `<p class="td-hint td-hint-sm">${_esc(err.message)}</p>`;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { init, loadDashboard, openStudent: _openStudentDetail };
})();

window.TEACHER_DASHBOARD = TEACHER_DASHBOARD;
