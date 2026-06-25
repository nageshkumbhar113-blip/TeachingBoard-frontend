/* ════════════════════════════════════════════════════════════════
   wordTestInsights.js — Client-side Word Test Insight Engine
   Computes skill-level insights + renders cards for Student & Parent views.
   No network calls. Works offline. Pure rule-based logic.
════════════════════════════════════════════════════════════════ */
'use strict';

const WORD_TEST_INSIGHTS = (() => {

  // ── Thresholds ────────────────────────────────────────────────────────────
  const T = { critical: 40, weak: 60, good: 80 };

  function _level(pct) {
    if (pct === null || pct === undefined) return null;
    if (pct < T.critical) return 'critical';
    if (pct < T.weak)     return 'weak';
    if (pct < T.good)     return 'good';
    return 'excellent';
  }

  // ── Advice map (Marathi + English + action tip) ───────────────────────────
  const SKILL_LABEL = {
    listening:  { en: 'Listening',  mr: 'ऐकणे',         icon: '🎧' },
    vocabulary: { en: 'Vocabulary', mr: 'शब्दांचा अर्थ', icon: '📖' },
    spelling:   { en: 'Spelling',   mr: 'स्पेलिंग',      icon: '✏️'  },
  };

  const ADVICE = {
    listening: {
      critical:  { mr: 'शब्द ऐकताना नीट लक्ष द्या.',       action: 'रोज 10 मिनिटे flashcard audio ऐका.' },
      weak:      { mr: 'Listening practice वाढवा.',          action: 'Word Bank मधून शब्द ऐका आणि repeat करा.' },
      good:      { mr: 'Listening चांगले आहे.',              action: 'नवीन sets try करा.' },
      excellent: { mr: 'Listening excellent! 🌟',             action: null },
    },
    vocabulary: {
      critical:  { mr: 'शब्दांचे अर्थ माहीत नाहीत.',        action: 'रोज 5 नवीन शब्दांचे अर्थ वाचा.' },
      weak:      { mr: 'Vocabulary practice करा.',            action: 'Flashcard mode मध्ये meaning practice करा.' },
      good:      { mr: 'Vocabulary ठीक आहे.',                action: 'कठीण शब्दांवर focus करा.' },
      excellent: { mr: 'Vocabulary excellent! 🌟',             action: null },
    },
    spelling: {
      critical:  { mr: 'Spelling खूप कमकुवत आहे.',          action: 'रोज झोपण्यापूर्वी 5 शब्द वहीत लिहा.' },
      weak:      { mr: 'Spelling सुधारणे गरजेचे.',           action: 'Spelling test mode मध्ये practice करा.' },
      good:      { mr: 'Spelling ठीक आहे.',                  action: 'Difficult words वर practice करा.' },
      excellent: { mr: 'Spelling excellent! 🌟',               action: null },
    },
  };

  const LEVEL_BADGE = {
    critical:  { label: 'कमकुवत',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
    weak:      { label: 'सुधारणा',    color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
    good:      { label: 'ठीक',        color: '#eab308', bg: 'rgba(234,179,8,0.12)'   },
    excellent: { label: 'उत्तम',      color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  };

  // ── Compute ───────────────────────────────────────────────────────────────
  function compute(analytics) {
    const sections    = analytics.sections    || {};
    const recentTests = analytics.recent_tests || [];
    const weakWords   = analytics.weak_words   || [];
    const insights    = [];

    // 1. Per-skill cards
    for (const skill of ['listening', 'vocabulary', 'spelling']) {
      const data = sections[skill];
      if (!data || data.avg === null || data.attempts_with_data === 0) continue;
      const level  = _level(data.avg);
      const advice = ADVICE[skill]?.[level] || {};
      insights.push({
        type:   'skill',
        skill,
        pct:    data.avg,
        level,
        label:  SKILL_LABEL[skill],
        badge:  LEVEL_BADGE[level],
        mr:     advice.mr,
        action: advice.action,
      });
    }

    // 2. Priority action — pick the weakest skill that still needs work (< 60%)
    const needsWork = insights
      .filter(i => i.type === 'skill' && i.pct < T.weak)
      .sort((a, b) => a.pct - b.pct);
    if (needsWork.length) {
      insights.unshift({
        type:   'priority',
        skill:  needsWork[0].skill,
        pct:    needsWork[0].pct,
        label:  needsWork[0].label,
        badge:  needsWork[0].badge,
        action: needsWork[0].action,
      });
    }

    // 3. Trend from last 3 test percents (oldest → newest)
    const recent3 = recentTests.slice(0, 3).reverse();
    if (recent3.length >= 2) {
      const delta = recent3[recent3.length - 1].percent - recent3[0].percent;
      insights.push({
        type:      'trend',
        direction: delta > 3 ? 'up' : delta < -3 ? 'down' : 'stable',
        delta:     Math.abs(Math.round(delta)),
      });
    }

    // 4. Top 3 weak words to practice
    if (weakWords.length) {
      insights.push({ type: 'weak_words', words: weakWords.slice(0, 3) });
    }

    return insights;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function _bar(pct) {
    const lvl   = _level(pct);
    const badge = lvl ? LEVEL_BADGE[lvl] : { color: '#64748b', bg: 'rgba(100,116,139,0.1)' };
    return `
      <div class="wti-skill-row">
        <div class="wti-skill-left">
          <span class="wti-skill-icon">${SKILL_LABEL[pct._skill]?.icon || ''}</span>
          <span class="wti-skill-name">${SKILL_LABEL[pct._skill]?.mr || ''}</span>
        </div>
        <div class="wti-bar-wrap">
          <div class="wti-bar" style="width:${pct}%;background:${badge.color}" data-pct="${pct}"></div>
        </div>
        <span class="wti-skill-pct" style="color:${badge.color}">${pct}%</span>
        <span class="wti-badge" style="color:${badge.color};background:${badge.bg}">${badge.label}</span>
      </div>`;
  }

  function _skillBars(skills) {
    return skills.filter(i => i.type === 'skill').map(i => {
      const badge = LEVEL_BADGE[i.level];
      return `
        <div class="wti-skill-row">
          <div class="wti-skill-left">
            <span class="wti-skill-icon">${i.label.icon}</span>
            <span class="wti-skill-name">${i.label.mr}</span>
          </div>
          <div class="wti-bar-wrap">
            <div class="wti-bar" style="width:0%;background:${badge.color}" data-pct="${i.pct}"></div>
          </div>
          <span class="wti-skill-pct" style="color:${badge.color}">${i.pct}%</span>
          <span class="wti-badge" style="color:${badge.color};background:${badge.bg}">${badge.label}</span>
        </div>`;
    }).join('');
  }

  // ── Render: Student Insights Card ─────────────────────────────────────────
  function renderInsightsCard(insights, container) {
    if (!container) return;
    const skillInsights = insights.filter(i => i.type === 'skill');
    const priority      = insights.find(i => i.type === 'priority');
    const trend         = insights.find(i => i.type === 'trend');
    const weakWords     = insights.find(i => i.type === 'weak_words');

    const trendHtml = trend ? (() => {
      const map = {
        up:     { icon: '📈', text: 'मागील tests मध्ये सुधारणा होत आहे!', color: '#22c55e' },
        down:   { icon: '📉', text: 'मागील tests मध्ये घट झाली आहे.',      color: '#ef4444' },
        stable: { icon: '➡️', text: 'Score स्थिर आहे.',                     color: '#94a3b8' },
      };
      const t = map[trend.direction];
      return `<div class="wti-trend" style="color:${t.color}">${t.icon} ${_esc(t.text)}</div>`;
    })() : '';

    const priorityHtml = priority ? `
      <div class="wti-priority">
        <div class="wti-priority-title">⚠️ ${_esc(priority.label.mr)} कमकुवत आहे — ${priority.pct}%</div>
        ${priority.action ? `<div class="wti-priority-action">💡 ${_esc(priority.action)}</div>` : ''}
      </div>` : '';

    const weakHtml = weakWords ? `
      <div class="wti-weak-words">
        <span class="wti-weak-label">🔤 Practice करा:</span>
        ${weakWords.words.map(w => `<span class="wti-word-chip">${_esc(w.word)}</span>`).join('')}
      </div>` : '';

    container.innerHTML = `
      <div class="wti-card">
        <div class="wti-card-title">🤖 Smart Insights</div>
        ${priorityHtml}
        <div class="wti-skills">${_skillBars(skillInsights)}</div>
        ${trendHtml}
        ${weakHtml}
      </div>`;

    // Animate skill bars after paint
    requestAnimationFrame(() => requestAnimationFrame(() => {
      container.querySelectorAll('.wti-bar').forEach(b => {
        b.style.width = b.dataset.pct + '%';
      });
    }));
  }

  // ── Render: Parent Simplified Card ────────────────────────────────────────
  function renderParentCard(insights, analytics, container) {
    if (!container) return;
    const skillInsights = insights.filter(i => i.type === 'skill');
    const priority      = insights.find(i => i.type === 'priority');
    const weakWords     = insights.find(i => i.type === 'weak_words');
    const summary       = analytics.summary || {};

    const skillRows = skillInsights.map(i => {
      const badge = LEVEL_BADGE[i.level];
      return `
        <div class="wti-parent-row">
          <span>${i.label.icon} ${_esc(i.label.mr)}</span>
          <span class="wti-parent-badge" style="color:${badge.color};background:${badge.bg}">
            ${badge.label}
          </span>
        </div>`;
    }).join('');

    const actionHtml = priority && priority.action ? `
      <div class="wti-parent-action">
        <div class="wti-parent-action-title">💡 घरी काय करावे:</div>
        <div class="wti-parent-action-text">${_esc(priority.action)}</div>
      </div>` : '';

    const weakHtml = weakWords ? `
      <div class="wti-parent-weak">
        <span style="font-size:0.82rem;color:var(--text2)">हे शब्द practice करा: </span>
        ${weakWords.words.map(w => `<span class="wti-word-chip">${_esc(w.word)}</span>`).join('')}
      </div>` : '';

    container.innerHTML = `
      <div class="wti-parent-card">
        <div class="wti-parent-header">
          <span class="wti-parent-title">📊 प्रगती — Word Tests</span>
          ${summary.attempts ? `<span class="wti-parent-meta">${summary.attempts} tests · ${summary.avg_percent}% avg</span>` : ''}
        </div>
        <div class="wti-parent-skills">${skillRows}</div>
        ${actionHtml}
        ${weakHtml}
      </div>`;
  }

  return { compute, renderInsightsCard, renderParentCard };
})();

window.WORD_TEST_INSIGHTS = WORD_TEST_INSIGHTS;
