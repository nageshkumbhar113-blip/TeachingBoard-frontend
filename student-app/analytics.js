/* ════════════════════════════════════════
   analytics.js — Test Analytics Dashboard
   Tabs: Overview · Performance · History · Subjects · Weak Qs
   Global: ANALYTICS
════════════════════════════════════════ */

const ANALYTICS = (() => {
  const $ = id => document.getElementById(id);
  const _safeAvg = (sum, count) => count ? Math.round(sum / count) : 0;

  function _filterAttemptsForProfile(attempts, profile) {
    if (!Array.isArray(attempts)) return [];
    if (!profile) return [];

    const studentCode = String(profile.student_code || '').trim().toUpperCase();
    const studentName = String(profile.name || '').trim();
    return attempts.filter(attempt => {
      const attemptCode = String(attempt.student_code || '').trim().toUpperCase();
      if (studentCode && attemptCode) return attemptCode === studentCode;
      return studentName && String(attempt.student_name || '').trim() === studentName;
    });
  }

  function _buildAttemptStats(attempts) {
    if (!attempts.length) return { total: 0, avgPercent: 0, bestPercent: 0, totalTime: 0 };
    const total = attempts.length;
    return {
      total,
      avgPercent: Math.round(attempts.reduce((sum, attempt) => sum + (attempt.percent || 0), 0) / total),
      bestPercent: Math.max(...attempts.map(attempt => attempt.percent || 0)),
      totalTime: attempts.reduce((sum, attempt) => sum + (attempt.time_taken || 0), 0),
    };
  }

  // ════════════════════════
  // STATE
  // ════════════════════════

  let _activeTab = 'overview';
  let _data      = { attempts: [], stats: {}, weakQs: [], allQs: [] };

  const TABS = [
    { id: 'overview',    label: '📈 Overview'    },
    { id: 'performance', label: '🎯 Performance' },
    { id: 'history',     label: '📋 History'     },
    { id: 'subjects',    label: '📚 Subjects'    },
    { id: 'weak',        label: '⚠️ Weak Qs'    },
  ];

  // ════════════════════════
  // OPEN
  // ════════════════════════

  async function open() {
    APP.showScreen('analytics');
    APP.setBreadcrumb('Analytics');
    await _loadData();
    _renderShell();
    _renderTab(_activeTab);
  }

  async function _loadData() {
    const [attempts, weakQs, allQs, profile] = await Promise.all([
      DB.getAllAttempts(),
      DB.getWeakQuestions(),
      DB.getAllQuestions(),
      DB.getSetting('student_profile', null).catch(() => null),
    ]);
    const visibleAttempts = _filterAttemptsForProfile(attempts, profile);
    _data = { attempts: visibleAttempts, stats: _buildAttemptStats(visibleAttempts), weakQs, allQs };
  }

  // ════════════════════════
  // SHELL / TABS
  // ════════════════════════

  function _renderShell() {
    const root = $('analytics-root');
    if (!root) return;

    root.innerHTML = `
      <div class="an-header">
        <button class="an-back-btn" id="an-back">← Back</button>
        <h2 class="an-title">📊 Analytics</h2>
      </div>
      <nav class="an-tabs" id="an-tab-bar" role="tablist">
        ${TABS.map(t => `
          <button class="an-tab${_activeTab === t.id ? ' active' : ''}"
                  data-tab="${t.id}" role="tab"
                  aria-selected="${_activeTab === t.id}">${t.label}</button>
        `).join('')}
      </nav>
      <div class="an-body" id="an-tab-body"></div>
    `;

    $('an-back').addEventListener('click', () => { APP.showScreen('home'); APP.loadHome(); });

    $('an-tab-bar').addEventListener('click', e => {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      _activeTab = btn.dataset.tab;
      $('an-tab-bar').querySelectorAll('.an-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === _activeTab);
        b.setAttribute('aria-selected', b.dataset.tab === _activeTab);
      });
      _renderTab(_activeTab);
    });
  }

  function _renderTab(tab) {
    switch (tab) {
      case 'overview':    return _renderOverview();
      case 'performance': return _renderPerformance();
      case 'history':     return _renderHistory();
      case 'subjects':    return _renderSubjects();
      case 'weak':        return _renderWeakQs();
    }
  }

  // ════════════════════════
  // TAB: OVERVIEW
  // ════════════════════════

  function _renderOverview() {
    const body = $('an-tab-body');
    if (!body) return;
    const { attempts, stats } = _data;

    if (!attempts.length) {
      body.innerHTML = _emptyState('📊', 'No test attempts yet.',
        'Take a quiz to see your analytics here.');
      return;
    }

    const totalTime = attempts.reduce((s, a) => s + (a.time_taken || 0), 0);
    const best      = attempts.length ? Math.max(...attempts.map(a => a.percent || 0)) : 0;
    const latest    = attempts[0];
    const passCount = attempts.filter(a => (a.percent || 0) >= 50).length;

    const kpis = [
      { label: 'Total Attempts', value: attempts.length,              icon: '🎯' },
      { label: 'Avg Score',      value: `${stats.avgPercent || 0}%`,  icon: '📊' },
      { label: 'Best Score',     value: `${best}%`,                   icon: '🏆' },
      { label: 'Study Time',     value: _fmtTime(totalTime),          icon: '⏱️' },
      { label: 'Passed',         value: `${passCount}/${attempts.length}`, icon: '✅' },
    ];

    // Trend: last 10 attempts, oldest → newest — bars start at 0 for CSS transition
    const trend = attempts.slice(0, 10).reverse();
    const trendHtml = trend.length >= 2 ? `
      <div class="an-trend-section">
        <p class="an-section-title">📈 Score Trend (last ${trend.length} attempts)</p>
        <div class="an-trend-chart">
          ${trend.map((a, i) => {
            const pct   = a.percent || 0;
            const level = pct >= 70 ? 'high' : pct >= 40 ? 'mid' : 'low';
            return `
              <div class="an-trend-col" title="${_esc(a.quiz_title || 'Quiz')} · ${pct}%">
                <div class="an-trend-bar-wrap">
                  <div class="an-trend-bar ${level}" style="height:0%" data-pct="${pct}"></div>
                </div>
                <div class="an-trend-label">${i + 1}</div>
              </div>`;
          }).join('')}
        </div>
      </div>
    ` : '';

    const latestHtml = latest ? `
      <div class="an-latest">
        <p class="an-section-title">🕒 Latest Attempt</p>
        <div class="an-latest-card">
          <div class="an-latest-quiz">${_esc(latest.quiz_title || 'Quiz')}</div>
          <div class="an-latest-meta">
            ${latest.subject ? `<span>${_esc(latest.subject)}</span>` : ''}
            ${latest.mode    ? `<span class="an-mode-badge an-mode-${latest.mode}">${latest.mode}</span>` : ''}
            <span>${_fmtDate(latest.date)}</span>
          </div>
          <div class="an-latest-score">
            <span class="an-score-big">${latest.percent || 0}%</span>
            <span class="an-score-detail">${latest.score ?? 0} / ${latest.max_score ?? 0} pts</span>
          </div>
          <div class="an-latest-breakdown">
            <span class="an-stat-chip correct">✓ ${latest.correct  ?? 0}</span>
            <span class="an-stat-chip wrong">✗ ${latest.wrong    ?? 0}</span>
            <span class="an-stat-chip skip">→ ${latest.skipped   ?? 0}</span>
            <span class="an-stat-chip time">⏱ ${_fmtTime(latest.time_taken)}</span>
          </div>
        </div>
      </div>
    ` : '';

    body.innerHTML = `
      <div class="an-kpi-grid">
        ${kpis.map(k => `
          <div class="an-kpi-card">
            <div class="an-kpi-icon">${k.icon}</div>
            <div class="an-kpi-value">${k.value}</div>
            <div class="an-kpi-label">${k.label}</div>
          </div>
        `).join('')}
      </div>
      ${trendHtml}
      ${latestHtml}
    `;

    // Animate bars after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        body.querySelectorAll('.an-trend-bar').forEach(b => {
          b.style.height = b.dataset.pct + '%';
        });
      });
    });
  }

  // ════════════════════════
  // TAB: PERFORMANCE
  // ════════════════════════

  function _renderPerformance() {
    const body = $('an-tab-body');
    if (!body) return;
    const { attempts, allQs } = _data;

    if (!attempts.length) {
      body.innerHTML = _emptyState('🎯', 'No attempts yet.',
        'Complete some quizzes to see performance breakdown.');
      return;
    }

    const qMap = new Map(allQs.map(q => [q.q_id, q]));

    // Aggregate per-question answer data
    const byDiff = {
      easy:   { correct: 0, total: 0 },
      medium: { correct: 0, total: 0 },
      hard:   { correct: 0, total: 0 },
    };
    const byType = {
      mcq: { correct: 0, total: 0 },
      tf:  { correct: 0, total: 0 },
      fib: { correct: 0, total: 0 },
    };
    let totalAnswered = 0;
    let totalTimeMs   = 0;

    attempts.forEach(a => {
      (a.answers || []).forEach(ans => {
        if (ans.given === null) return;   // skipped — exclude from type/diff stats
        const q = qMap.get(ans.q_id);
        totalAnswered++;
        totalTimeMs += ans.time_ms || 0;

        const diff = q?.difficulty || 'medium';
        if (byDiff[diff]) {
          byDiff[diff].total++;
          if (ans.correct) byDiff[diff].correct++;
        }

        const type = q?.type || 'mcq';
        if (byType[type]) {
          byType[type].total++;
          if (ans.correct) byType[type].correct++;
        }
      });
    });

    const passCount    = attempts.filter(a => (a.percent || 0) >= 50).length;
    const passRate     = attempts.length ? Math.round((passCount / attempts.length) * 100) : 0;
    const avgTimeSec   = totalAnswered > 0
      ? Math.round(totalTimeMs / totalAnswered / 1000)
      : 0;

    // Summary stats row
    const summaryHtml = `
      <div class="an-perf-summary">
        <div class="an-perf-stat-card">
          <div class="an-perf-stat-val ${passRate >= 70 ? 'high' : passRate >= 40 ? 'mid' : 'low'}">${passRate}%</div>
          <div class="an-perf-stat-lbl">Pass Rate</div>
          <div class="an-perf-stat-sub">${passCount} / ${attempts.length} passed (≥50%)</div>
        </div>
        <div class="an-perf-stat-card">
          <div class="an-perf-stat-val">${_fmtTime(avgTimeSec)}</div>
          <div class="an-perf-stat-lbl">Avg per Question</div>
          <div class="an-perf-stat-sub">${totalAnswered} questions answered</div>
        </div>
      </div>
    `;

    // Bar chart helper
    const makeBarRows = (map, labelMap) => Object.entries(map)
      .filter(([, v]) => v.total > 0)
      .map(([key, { correct, total }]) => {
        const acc   = Math.round((correct / total) * 100);
        const level = acc >= 70 ? 'high' : acc >= 40 ? 'mid' : 'low';
        return `
          <div class="an-perf-bar-row">
            <div class="an-perf-bar-label">${labelMap[key] || key}</div>
            <div class="an-ch-bar-wrap">
              <div class="an-ch-bar ${level}" style="width:0%" data-pct="${acc}"></div>
            </div>
            <div class="an-perf-bar-stat">
              <span class="an-ch-avg ${level}">${acc}%</span>
              <span class="an-ch-meta">${correct}/${total}</span>
            </div>
          </div>
        `;
      }).join('') || '<p class="an-perf-none">No data yet</p>';

    const diffHtml = makeBarRows(byDiff, {
      easy: '🟢 Easy', medium: '🟡 Medium', hard: '🔴 Hard',
    });
    const typeHtml = makeBarRows(byType, {
      mcq: '🔘 MCQ', tf: '🔀 True/False', fib: '✏️ Fill in Blank',
    });

    // Quiz-level pass/fail table (last 10)
    const recentRows = attempts.slice(0, 10).map(a => {
      const passed = (a.percent || 0) >= 50;
      return `
        <div class="an-quiz-perf-row">
          <span class="an-quiz-perf-icon">${passed ? '✅' : '❌'}</span>
          <div class="an-quiz-perf-name">${_esc(a.quiz_title || 'Quiz')}</div>
          <div class="an-quiz-perf-right">
            <span class="an-hist-pct ${(a.percent || 0) >= 70 ? 'high' : (a.percent || 0) >= 40 ? 'mid' : 'low'}">${a.percent || 0}%</span>
            <span class="an-ch-meta">${_fmtDate(a.date)}</span>
          </div>
        </div>
      `;
    }).join('');

    body.innerHTML = `
      ${summaryHtml}

      <div class="an-perf-section">
        <p class="an-section-title">📊 Accuracy by Difficulty</p>
        <div class="an-perf-bars">${diffHtml}</div>
      </div>

      <div class="an-perf-section">
        <p class="an-section-title">🔘 Accuracy by Question Type</p>
        <div class="an-perf-bars">${typeHtml}</div>
      </div>

      <div class="an-perf-section">
        <p class="an-section-title">📋 Recent Quizzes (pass/fail)</p>
        <div class="an-quiz-perf-list">${recentRows}</div>
      </div>
    `;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        body.querySelectorAll('.an-ch-bar[data-pct]').forEach(b => {
          b.style.width = b.dataset.pct + '%';
        });
      });
    });
  }

  // ════════════════════════
  // TAB: HISTORY
  // ════════════════════════

  function _renderHistory() {
    const body = $('an-tab-body');
    if (!body) return;
    const { attempts } = _data;

    if (!attempts.length) {
      body.innerHTML = _emptyState('📋', 'No attempts yet.');
      return;
    }

    const rows = attempts.map((a, idx) => {
      const pct   = a.percent || 0;
      const level = pct >= 70 ? 'high' : pct >= 40 ? 'mid' : 'low';
      return `
        <div class="an-hist-row" data-idx="${idx}">
          <div class="an-hist-main">
            <div class="an-hist-title">${_esc(a.quiz_title || 'Quiz')}</div>
            <div class="an-hist-meta">
              ${a.subject ? `<span>${_esc(a.subject)}</span>` : ''}
              ${a.chapter ? `<span>${_esc(a.chapter)}</span>` : ''}
              <span class="an-mode-badge an-mode-${a.mode || 'practice'}">${a.mode || 'practice'}</span>
              <span>${_fmtDate(a.date)}</span>
            </div>
          </div>
          <div class="an-hist-score">
            <span class="an-hist-pct ${level}">${pct}%</span>
            <span class="an-hist-pts">${a.score ?? 0}/${a.max_score ?? 0}</span>
          </div>
          <div class="an-hist-chips">
            <span class="an-stat-chip correct">✓${a.correct  ?? 0}</span>
            <span class="an-stat-chip wrong">✗${a.wrong    ?? 0}</span>
            <span class="an-stat-chip skip">→${a.skipped   ?? 0}</span>
            <span class="an-stat-chip time">⏱${_fmtTime(a.time_taken)}</span>
          </div>
          <button class="an-del-btn" data-idx="${idx}" title="Delete this attempt" aria-label="Delete attempt">🗑</button>
        </div>
      `;
    }).join('');

    body.innerHTML = `
      <div class="an-hist-header">
        <span class="an-hist-count">${attempts.length} attempt${attempts.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="an-hist-list" id="an-hist-list">${rows}</div>
    `;

    body.addEventListener('click', async e => {
      const btn = e.target.closest('.an-del-btn');
      if (!btn) return;
      const idx     = parseInt(btn.dataset.idx, 10);
      const attempt = _data.attempts[idx];
      if (!attempt) return;

      const confirmed = confirm(`Delete attempt "${attempt.quiz_title || 'Quiz'}"?`);
      if (!confirmed) return;

      try {
        const db = await DB.open();
        const tx = db.transaction('test_attempts', 'readwrite');
        tx.objectStore('test_attempts').delete(attempt.attempt_id);
        await new Promise((res, rej) => {
          tx.oncomplete = res;
          tx.onerror    = () => rej(tx.error);
        });
        _data.attempts.splice(idx, 1);
        APP.toast('Attempt deleted', 'info');
        _renderHistory();
      } catch {
        APP.toast('Could not delete attempt', 'error');
      }
    }, { once: true });
  }

  // ════════════════════════
  // TAB: SUBJECTS
  // ════════════════════════

  function _renderSubjects() {
    const body = $('an-tab-body');
    if (!body) return;
    const { attempts } = _data;

    if (!attempts.length) {
      body.innerHTML = _emptyState('📚', 'No attempts yet.');
      return;
    }

    // Group by subject → chapter
    const subjectMap = {};
    attempts.forEach(a => {
      const sub = a.subject || 'Unknown';
      const ch  = a.chapter || '—';
      if (!subjectMap[sub]) subjectMap[sub] = {};
      if (!subjectMap[sub][ch]) subjectMap[sub][ch] = { total: 0, sumPct: 0, best: 0 };
      const entry = subjectMap[sub][ch];
      entry.total++;
      entry.sumPct += a.percent || 0;
      entry.best    = Math.max(entry.best, a.percent || 0);
    });

    const sectionsHtml = Object.entries(subjectMap).map(([sub, chapters]) => {
      const allAttempts = Object.values(chapters).reduce((s, c) => s + c.total,  0);
      const allPct      = Object.values(chapters).reduce((s, c) => s + c.sumPct, 0);
      const subAvg      = allAttempts ? Math.round(allPct / allAttempts) : 0;

      const chRows = Object.entries(chapters).map(([ch, { total, sumPct, best }]) => {
      const avg   = _safeAvg(sumPct, total);
        const level = avg >= 70 ? 'high' : avg >= 40 ? 'mid' : 'low';
        return `
          <div class="an-ch-row">
            <div class="an-ch-name">${_esc(ch)}</div>
            <div class="an-ch-bar-wrap">
              <div class="an-ch-bar ${level}" style="width:0%" data-pct="${avg}"></div>
            </div>
            <div class="an-ch-stats">
              <span class="an-ch-avg ${level}">${avg}%</span>
              <span class="an-ch-meta">best ${best}% · ${total} attempt${total !== 1 ? 's' : ''}</span>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="an-sub-section">
          <div class="an-sub-header">
            <span class="an-sub-name">${_esc(sub)}</span>
            <span class="an-sub-avg">Avg: ${subAvg}%</span>
          </div>
          <div class="an-ch-list">${chRows}</div>
        </div>
      `;
    }).join('');

    body.innerHTML = `<div class="an-subjects-wrap">${sectionsHtml}</div>`;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        body.querySelectorAll('.an-ch-bar[data-pct]').forEach(b => {
          b.style.width = b.dataset.pct + '%';
        });
      });
    });
  }

  // ════════════════════════
  // TAB: WEAK QUESTIONS
  // ════════════════════════

  function _renderWeakQs() {
    const body = $('an-tab-body');
    if (!body) return;
    const { weakQs, allQs, attempts } = _data;

    // Build per-question stats from attempt history
    const qStats = {};
    attempts.forEach(a => {
      (a.answers || []).forEach(ans => {
        if (!qStats[ans.q_id]) qStats[ans.q_id] = { correct: 0, wrong: 0, skip: 0 };
        if (ans.correct)              qStats[ans.q_id].correct++;
        else if (ans.given !== null)  qStats[ans.q_id].wrong++;
        else                          qStats[ans.q_id].skip++;
      });
    });

    const qMap     = new Map(allQs.map(q => [q.q_id, q]));
    const seenIds  = new Set();
    const pool     = [];

    weakQs.forEach(q => {
      if (!seenIds.has(q.q_id)) { pool.push(q); seenIds.add(q.q_id); }
    });

    Object.entries(qStats).forEach(([qid, st]) => {
      if (st.wrong > 0 && !seenIds.has(qid) && qMap.get(qid)) {
        pool.push(qMap.get(qid));
        seenIds.add(qid);
      }
    });

    pool.sort((a, b) => {
      const wa = (qStats[a.q_id]?.wrong || 0) + (a.wrong_count || 0);
      const wb = (qStats[b.q_id]?.wrong || 0) + (b.wrong_count || 0);
      return wb - wa;
    });

    if (!pool.length) {
      body.innerHTML = _emptyState('🎉', 'No weak questions found!',
        'Keep it up — take more tests to track accuracy per question.');
      return;
    }

    const rows = pool.slice(0, 50).map((q, i) => {
      const st    = qStats[q.q_id] || { correct: 0, wrong: 0, skip: 0 };
      const total = st.correct + st.wrong;
      const acc   = total > 0 ? Math.round((st.correct / total) * 100) : 0;
      const level = acc >= 70 ? 'high' : acc >= 40 ? 'mid' : 'low';

      return `
        <div class="an-weak-row">
          <div class="an-weak-num">${i + 1}</div>
          <div class="an-weak-body">
            <div class="an-weak-q">${_esc((q.question || '').slice(0, 120))}${(q.question?.length || 0) > 120 ? '…' : ''}</div>
            <div class="an-weak-meta">
              ${q.subject    ? `<span>${_esc(q.subject)}</span>`                                   : ''}
              ${q.chapter    ? `<span>${_esc(q.chapter)}</span>`                                   : ''}
              <span class="qb-badge ${q.difficulty || 'medium'}">${q.difficulty || 'med'}</span>
              <span class="qb-badge">${(q.type || 'mcq').toUpperCase()}</span>
              ${q.flagged    ? `<span class="an-flagged-badge">🚩 Flagged</span>`                  : ''}
            </div>
          </div>
          <div class="an-weak-stats">
            <span class="an-acc-badge ${level}">${acc}%</span>
            <div class="an-weak-chips">
              <span class="an-stat-chip correct">✓${st.correct}</span>
              <span class="an-stat-chip wrong">✗${st.wrong}</span>
            </div>
            <button class="an-flag-btn ${q.flagged ? 'flagged' : ''}"
                    data-qid="${_esc(q.q_id)}"
                    title="${q.flagged ? 'Remove flag' : 'Flag for revision'}"
                    aria-label="${q.flagged ? 'Remove flag' : 'Flag for revision'}">
              ${q.flagged ? '🚩' : '🏴'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    body.innerHTML = `
      <div class="an-weak-header">
        <span>${pool.length} weak question${pool.length !== 1 ? 's' : ''} identified</span>
      </div>
      <div class="an-weak-list" id="an-weak-list">${rows}</div>
    `;

    // Flag toggle handler
    body.querySelector('#an-weak-list')?.addEventListener('click', async e => {
      const btn = e.target.closest('.an-flag-btn');
      if (!btn) return;
      const qid = btn.dataset.qid;
      const q   = allQs.find(x => x.q_id === qid);
      if (!q) return;

      try {
        await DB.saveQuestion({ ...q, flagged: !q.flagged });
        q.flagged = !q.flagged;
        APP.toast(q.flagged ? '🚩 Flagged for revision' : 'Flag removed', 'info');
        _renderWeakQs();
      } catch {
        APP.toast('Could not update question', 'error');
      }
    });
  }

  // ════════════════════════
  // HELPERS
  // ════════════════════════

  function _emptyState(icon, msg, sub = '') {
    return `
      <div class="an-empty">
        <div class="an-empty-icon">${icon}</div>
        <p>${_esc(msg)}</p>
        ${sub ? `<p style="opacity:.6;font-size:.85rem">${_esc(sub)}</p>` : ''}
      </div>
    `;
  }

  function _fmtTime(sec) {
    if (!sec) return '0s';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function _fmtDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: '2-digit',
      });
    } catch { return iso.slice(0, 10); }
  }

  function _esc(val) {
    return String(val || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ════════════════════════
  // INIT
  // ════════════════════════

  function init() {
    // No persistent DOM — shell is rendered fresh on open()
  }

  // ════════════════════════
  // PUBLIC API
  // ════════════════════════

  return { init, open };
})();

window.ANALYTICS = ANALYTICS;
