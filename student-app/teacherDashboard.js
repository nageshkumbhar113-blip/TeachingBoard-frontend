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
    $('td-tab-fee')?.classList.toggle('hidden', tab !== 'fee');

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

    if (tab === 'fee') {
      $('td-back-btn')?.classList.add('hidden');
      $('td-detail-name').textContent = 'Fee Management';
      _initFeeTab();
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
    } else if (_activeTab === 'fee') {
      _loadFeeConfigs();
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

  // ══════════════════════════════════════════════════════════════
  // FEE TAB
  // ══════════════════════════════════════════════════════════════

  let _feeConfigs      = [];
  let _activeFeeConfig = null;

  function _initFeeTab() {
    $('td-fee-create-btn')?.addEventListener('click', _openFeeCreateModal);
    $('td-fee-back-btn')?.addEventListener('click', _showFeeList);
    _loadFeeConfigs();
  }

  async function _loadFeeConfigs() {
    const listEl = $('td-fee-configs-list');
    if (!listEl) return;
    listEl.innerHTML = '<p class="td-hint td-hint-sm">Loading...</p>';
    try {
      const res = await API.listFeeConfigs();
      _feeConfigs = res.configs || [];
      _renderFeeConfigs();
    } catch (err) {
      listEl.innerHTML = `<p class="td-hint td-hint-sm" style="color:var(--error)">Error: ${_esc(err.message)}</p>`;
    }
  }

  function _renderFeeConfigs() {
    const listEl = $('td-fee-configs-list');
    if (!listEl) return;
    if (!_feeConfigs.length) {
      listEl.innerHTML = '<p class="td-hint td-hint-sm">कोणतीही Fee Config नाही. "नवीन Fee तयार करा" वर क्लिक करा.</p>';
      return;
    }
    listEl.innerHTML = _feeConfigs.map(c => {
      const s          = c.stats || {};
      const pct        = s.total_expected > 0 ? Math.round(s.total_collected / s.total_expected * 100) : 0;
      const statusCls  = c.status === 'closed' ? 'fee-status-closed' : 'fee-status-active';
      const daysLeft   = _feeDaysLeft(c.due_date);
      const dueBadge   = c.status === 'active'
        ? (daysLeft < 0 ? `<span class="fee-badge fee-badge-overdue">Overdue ${Math.abs(daysLeft)}d</span>`
          : daysLeft <= 3 ? `<span class="fee-badge fee-badge-urgent">Due in ${daysLeft}d</span>`
          : `<span class="fee-badge fee-badge-ok">Due ${_fmtFeeDate(c.due_date)}</span>`)
        : `<span class="fee-badge fee-badge-closed">Closed</span>`;

      return `<div class="td-student-card fee-config-card" data-id="${_esc(c.fee_config_id)}">
        <div class="fee-card-header">
          <div>
            <div class="td-student-name">${_esc(c.label)}</div>
            <div class="td-student-code">${_esc(c.batch)} · ${_esc(c.fee_type)} · ₹${s.total_expected || 0}</div>
          </div>
          <span class="${statusCls}">${c.status === 'active' ? 'Active' : 'Closed'}</span>
        </div>
        <div class="fee-card-stats">
          <div class="fee-stat"><span class="fee-stat-val">₹${s.total_collected || 0}</span><span class="fee-stat-lbl">Collected</span></div>
          <div class="fee-stat"><span class="fee-stat-val" style="color:var(--error)">₹${s.total_remaining || 0}</span><span class="fee-stat-lbl">Remaining</span></div>
          <div class="fee-stat"><span class="fee-stat-val">${pct}%</span><span class="fee-stat-lbl">Done</span></div>
        </div>
        <div class="fee-card-footer">
          ${dueBadge}
          <span class="fee-student-count">👨‍🎓 ${s.total_students || 0} students · 🟢${s.paid_count || 0} 🟡${s.partial_count || 0} 🔴${s.pending_count || 0}</span>
        </div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.fee-config-card').forEach(card => {
      card.addEventListener('click', () => _openFeeRecords(card.dataset.id));
    });
  }

  async function _openFeeRecords(feeConfigId) {
    const recordsView = $('td-fee-records-view');
    const listView    = $('td-fee-list-view');
    if (!recordsView || !listView) return;

    listView.classList.add('hidden');
    recordsView.classList.remove('hidden');

    const titleEl = $('td-fee-records-title');
    const statsEl = $('td-fee-stats-bar');
    const studEl  = $('td-fee-students-list');

    if (studEl) studEl.innerHTML = '<p class="td-hint td-hint-sm">Loading...</p>';

    try {
      const res = await API.getFeeRecords(feeConfigId);
      _activeFeeConfig = res.config;
      const records = res.records || [];

      if (titleEl) titleEl.textContent = res.config?.label || '';

      const totalExpected  = records.reduce((s, r) => s + r.total_amount, 0);
      const totalCollected = records.reduce((s, r) => s + r.paid_amount, 0);
      const totalRemaining = totalExpected - totalCollected;
      const pct            = totalExpected > 0 ? Math.round(totalCollected / totalExpected * 100) : 0;

      if (statsEl) {
        statsEl.innerHTML = `
          <div class="fee-stats-bar">
            <div class="fee-stat-chip">💰 Total<br><strong>₹${totalExpected}</strong></div>
            <div class="fee-stat-chip" style="color:var(--success,#27ae60)">✅ Collected<br><strong>₹${totalCollected}</strong></div>
            <div class="fee-stat-chip" style="color:var(--error)">⏳ Remaining<br><strong>₹${totalRemaining}</strong></div>
            <div class="fee-stat-chip">📊 Done<br><strong>${pct}%</strong></div>
          </div>
          <div class="fee-action-row">
            ${res.config?.status === 'active' ? `<button class="td-send-notif-btn" id="td-fee-update-date-btn" style="font-size:0.8rem">📅 Due Date बदला</button>` : ''}
            ${res.config?.status === 'active' ? `<button class="td-send-notif-btn" id="td-fee-close-btn" style="font-size:0.8rem;background:var(--surface2,#eee);color:var(--text1)">🔒 Close करा</button>` : ''}
          </div>`;

        $('td-fee-update-date-btn')?.addEventListener('click', () => _openUpdateDueDateModal(feeConfigId));
        $('td-fee-close-btn')?.addEventListener('click', () => _closeFeeConfig(feeConfigId));
      }

      if (studEl) {
        if (!records.length) {
          studEl.innerHTML = '<p class="td-hint td-hint-sm">कोणतेही records नाहीत.</p>';
          return;
        }
        studEl.innerHTML = records.map(r => {
          const statusIcon = r.status === 'paid' ? '🟢' : r.status === 'partial' ? '🟡' : '🔴';
          const canPay     = res.config?.status === 'active' && r.status !== 'paid';
          return `<div class="td-student-card fee-record-card">
            <div class="fee-record-header">
              <span>${statusIcon} <strong>${_esc(r.student_name)}</strong></span>
              <span class="td-student-code">${_esc(r.student_code)}</span>
            </div>
            <div class="fee-record-amounts">
              <span>Total: <strong>₹${r.total_amount}</strong></span>
              <span style="color:var(--success,#27ae60)">Paid: <strong>₹${r.paid_amount}</strong></span>
              <span style="color:var(--error)">Due: <strong>₹${r.remaining_amount}</strong></span>
            </div>
            ${canPay ? `<div class="fee-pay-row">
              <input class="admin-input fee-pay-input" type="number" placeholder="₹ Amount" min="1" id="fee-pay-${_esc(r.fee_record_id)}">
              <input class="admin-input" type="text" placeholder="Note (optional)" id="fee-note-${_esc(r.fee_record_id)}" style="flex:1">
              <button class="admin-btn-primary fee-pay-btn" data-rid="${_esc(r.fee_record_id)}" style="flex-shrink:0">✔ Add</button>
            </div>` : ''}
            ${r.payments?.length ? `<details class="fee-payment-history"><summary>Payment History (${r.payments.length})</summary>
              ${r.payments.map(p => `<div class="fee-pay-hist-row">₹${p.amount} — ${_fmtFeeDate(p.paid_at)}${p.note ? ' · ' + _esc(p.note) : ''}</div>`).join('')}
            </details>` : ''}
          </div>`;
        }).join('');

        studEl.querySelectorAll('.fee-pay-btn').forEach(btn => {
          btn.addEventListener('click', () => _addFeePayment(btn.dataset.rid, feeConfigId));
        });
      }
    } catch (err) {
      if (studEl) studEl.innerHTML = `<p class="td-hint td-hint-sm" style="color:var(--error)">Error: ${_esc(err.message)}</p>`;
    }
  }

  async function _addFeePayment(feeRecordId, feeConfigId) {
    const amtEl  = $(`fee-pay-${feeRecordId}`);
    const noteEl = $(`fee-note-${feeRecordId}`);
    const amount = Number(amtEl?.value || 0);
    if (!amount || amount <= 0) { APP?.toast?.('Amount टाका', 'error'); return; }

    try {
      const res = await API.addFeePayment(feeRecordId, { amount, note: noteEl?.value || '' });
      APP?.toast?.(res.message || '✅ Payment added', 'success');
      _openFeeRecords(feeConfigId);
    } catch (err) {
      APP?.toast?.('Payment failed: ' + err.message, 'error');
    }
  }

  function _showFeeList() {
    $('td-fee-records-view')?.classList.add('hidden');
    $('td-fee-list-view')?.classList.remove('hidden');
    _activeFeeConfig = null;
    _loadFeeConfigs();
  }

  async function _closeFeeConfig(feeConfigId) {
    if (!confirm('हे fee config बंद करायचे? Reminders थांबतील.')) return;
    try {
      await API.closeFeeConfig(feeConfigId);
      APP?.toast?.('Fee config बंद झाली.', 'success');
      _showFeeList();
    } catch (err) {
      APP?.toast?.(err.message, 'error');
    }
  }

  function _openUpdateDueDateModal(feeConfigId) {
    const newDate = prompt('नवीन Due Date टाका (YYYY-MM-DD):');
    if (!newDate) return;
    API.updateFeeDueDate(feeConfigId, newDate)
      .then(() => { APP?.toast?.('Due date updated! Reminders restart होतील.', 'success'); _openFeeRecords(feeConfigId); })
      .catch(err => APP?.toast?.(err.message, 'error'));
  }

  function _openFeeCreateModal() {
    const batches = [...new Set(_students.map(s => s.batch || s.assigned_batches?.[0]).filter(Boolean))];
    const batchOpts = batches.map(b => `<option value="${_esc(b)}">${_esc(b)}</option>`).join('');
    const typeOpts  = ['tuition','exam','activity','other'].map(t =>
      `<option value="${t}">${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('');
    const today = new Date().toISOString().split('T')[0];

    const overlay = document.createElement('div');
    overlay.className = 'td-modal-backdrop';
    overlay.innerHTML = `
      <div class="td-modal">
        <h3 class="td-modal-title">💰 नवीन Fee Config</h3>
        <div class="td-modal-field">
          <label class="td-modal-label">Batch</label>
          <select id="fc-batch" class="td-modal-select">${batchOpts}</select>
        </div>
        <div class="td-modal-field">
          <label class="td-modal-label">Fee Type</label>
          <select id="fc-type" class="td-modal-select">${typeOpts}</select>
        </div>
        <div class="td-modal-field">
          <label class="td-modal-label">Label (e.g. June Tuition 2026)</label>
          <input id="fc-label" class="td-modal-input" placeholder="Fee चे नाव">
        </div>
        <div class="td-modal-field">
          <label class="td-modal-label">Amount per Student (₹)</label>
          <input id="fc-amount" class="td-modal-input" type="number" min="1" placeholder="5000">
        </div>
        <div class="td-modal-field">
          <label class="td-modal-label">Due Date</label>
          <input id="fc-due-date" class="td-modal-input" type="date" value="${today}">
        </div>
        <div class="td-modal-actions">
          <button id="fc-cancel" class="admin-btn-secondary">Cancel</button>
          <button id="fc-submit" class="admin-btn-primary">✅ Create</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#fc-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#fc-submit').addEventListener('click', async () => {
      const batch        = overlay.querySelector('#fc-batch').value;
      const fee_type     = overlay.querySelector('#fc-type').value;
      const label        = overlay.querySelector('#fc-label').value.trim();
      const total_amount = Number(overlay.querySelector('#fc-amount').value);
      const due_date     = overlay.querySelector('#fc-due-date').value;

      if (!label)              { APP?.toast?.('Label टाका', 'error'); return; }
      if (!total_amount || total_amount < 1) { APP?.toast?.('Amount टाका', 'error'); return; }
      if (!due_date)           { APP?.toast?.('Due Date टाका', 'error'); return; }

      overlay.querySelector('#fc-submit').disabled = true;
      overlay.querySelector('#fc-submit').textContent = 'Creating...';
      try {
        const res = await API.createFeeConfig({ batch, fee_type, label, total_amount, due_date });
        APP?.toast?.(`✅ ${res.student_count} students साठी Fee तयार झाली!`, 'success');
        overlay.remove();
        _loadFeeConfigs();
      } catch (err) {
        APP?.toast?.(err.message, 'error');
        overlay.querySelector('#fc-submit').disabled = false;
        overlay.querySelector('#fc-submit').textContent = '✅ Create';
      }
    });
  }

  function _fmtFeeDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
  }

  function _feeDaysLeft(dueDate) {
    const due   = new Date(dueDate); due.setHours(0,0,0,0);
    const today = new Date();        today.setHours(0,0,0,0);
    return Math.floor((due - today) / 86400000);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { init, loadDashboard, openStudent: _openStudentDetail };
})();

window.TEACHER_DASHBOARD = TEACHER_DASHBOARD;
