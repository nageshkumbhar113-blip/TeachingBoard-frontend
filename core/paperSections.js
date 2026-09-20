/* ════════════════════════════════════════
   paperSections.js — board-style paper structure for the Paper Builders
   Global: PAPER_SECTIONS
   Shared by admin-app/paperBuilder.js and student-app/teacherPaperBuilder.js.

   A "board-style" paper is split into sections such as
     Q.1 (A)  "Choose the correct alternative"        1 mark each, attempt all 4
     Q.2 (A)  "Complete the activities (any two)"     2 marks each, attempt any 2 of 3
   Section marks = attempt x marks each, and the paper total is the sum of the
   sections - never the sum of every printed question - so "any two of three" keeps
   the total right. This module owns the panel UI (header fields + sections table +
   live marks check) and the state; each builder only calls create()/mount() and
   asks it for payload()/summary().
════════════════════════════════════════ */

const PAPER_SECTIONS = (() => {
  const TEMPLATES = {
    ssc_algebra_40: {
      label: 'SSC Algebra Part I - 40 marks',
      sections: [
        { qNo: '1', part: 'A', instruction: 'Choose the correct alternative from given :', marksEach: 1, attempt: 4 },
        { qNo: '1', part: 'B', instruction: 'Solve the following subquestions :', marksEach: 1, attempt: 4 },
        { qNo: '2', part: 'A', instruction: 'Complete the following activities and rewrite it (any two) :', marksEach: 2, attempt: 2 },
        { qNo: '2', part: 'B', instruction: 'Solve the following subquestions (any four) :', marksEach: 2, attempt: 4 },
        { qNo: '3', part: 'A', instruction: 'Complete the following activity and rewrite it (any one) :', marksEach: 3, attempt: 1 },
        { qNo: '3', part: 'B', instruction: 'Solve the following subquestions (any two) :', marksEach: 3, attempt: 2 },
        { qNo: '4', part: '', instruction: 'Solve the following subquestions (any two) :', marksEach: 4, attempt: 2 },
        { qNo: '5', part: '', instruction: 'Solve the following subquestions (any one) :', marksEach: 3, attempt: 1 },
      ],
      header: {
        subjectLine: 'ALGEBRA - PART I',
        courseLine: '(REVISED COURSE)',
        timeText: 'Time : 2 Hours',
        notes: [
          'All questions are compulsory.',
          'Use of a calculator is not allowed.',
          'The numbers to the right of the questions indicate full marks.',
          'In case of MCQs [Q. No. 1(A)] only the first attempt will be evaluated and will be given credit.',
        ],
      },
    },
  };

  const DEFAULT_HEADER = () => ({
    paperCode: '',
    examLine: '',
    subjectLine: '',
    courseLine: '',
    timeText: 'Time : 2 Hours',
    notes: ['All questions are compulsory.', 'The numbers to the right of the questions indicate full marks.'],
    seatOnEveryPage: true,
    mcqLayout: 'list',
  });

  const _esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let _idCounter = 0;
  const _newId = () => `s${Date.now().toString(36)}${(_idCounter++).toString(36)}`;

  let _styled = false;
  function _injectStyle() {
    if (_styled) return;
    _styled = true;
    const st = document.createElement('style');
    st.textContent = `
      .pps-box { border: 1px solid rgba(128,128,128,.4); border-radius: 10px; padding: 10px 12px; margin: 10px 0; }
      .pps-toggle { display: flex; align-items: center; gap: 8px; font-weight: 700; cursor: pointer; }
      .pps-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin: 8px 0; }
      .pps-grid label, .pps-lbl { display: flex; flex-direction: column; font-size: 0.74rem; opacity: .85; gap: 3px; }
      .pps-in { width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(128,128,128,.45); background: rgba(128,128,128,.08); color: inherit; font: inherit; font-size: 0.85rem; }
      .pps-sec { border: 1px solid rgba(128,128,128,.35); border-radius: 8px; padding: 8px; margin: 8px 0; }
      .pps-sec.active { border-color: #f97316; box-shadow: 0 0 0 2px rgba(249,115,22,.25); }
      .pps-sec-row { display: grid; grid-template-columns: 52px 46px 1fr; gap: 6px; align-items: end; }
      .pps-sec-row2 { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 6px; font-size: 0.8rem; }
      .pps-sec-row2 .pps-in { width: 70px; }
      .pps-chip { padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(128,128,128,.4); font-size: 0.74rem; }
      .pps-chip.ok { background: rgba(16,185,129,.15); border-color: rgba(16,185,129,.5); }
      .pps-chip.bad { background: rgba(239,68,68,.15); border-color: rgba(239,68,68,.5); }
      .pps-btn { padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(128,128,128,.5); background: transparent; color: inherit; cursor: pointer; font-size: 0.8rem; }
      .pps-btn.pri { background: #f97316; border-color: #f97316; color: #fff; font-weight: 700; }
      .pps-sum { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-top: 6px; }
      .pps-sum th, .pps-sum td { padding: 3px 6px; border-bottom: 1px solid rgba(128,128,128,.25); text-align: right; }
      .pps-sum th:first-child, .pps-sum td:first-child { text-align: left; }
      .pps-total { margin-top: 8px; padding: 6px 10px; border-radius: 8px; font-weight: 700; display: flex; justify-content: space-between; }
      .pps-total.ok { background: rgba(16,185,129,.15); }
      .pps-total.bad { background: rgba(239,68,68,.15); }
      .pps-issue { font-size: 0.78rem; color: #ef4444; margin: 3px 0; }
      .pps-hint { font-size: 0.76rem; opacity: .75; margin: 4px 0; }
      .pps-list-head { font-weight: 700; font-size: 0.85rem; margin: 10px 0 4px; padding: 4px 8px; border-left: 3px solid #f97316; background: rgba(249,115,22,.08); }
      .pps-move { max-width: 110px; font-size: 0.75rem; padding: 2px 4px; border-radius: 6px; border: 1px solid rgba(128,128,128,.45); background: transparent; color: inherit; }
    `;
    document.head.appendChild(st);
  }

  function create({ getSelected, onChange, fetchByMarks, addQuestion, canFill, toast } = {}) {
    const state = { enabled: false, sections: [], activeId: null, header: DEFAULT_HEADER() };
    let root = null;
    const selected = () => (typeof getSelected === 'function' ? getSelected() : []) || [];
    const notify = () => { try { onChange?.(); } catch (e) { console.warn('paper sections onChange', e); } };

    function sectionMarks(s) { return (Number(s.attempt) || 0) * (Number(s.marksEach) || 0); }
    function label(s) { return `Q.${s.qNo || '?'}${s.part ? ` (${s.part})` : ''}`; }

    function summary() {
      const counts = new Map(state.sections.map(s => [s.id, 0]));
      let unassigned = 0;
      const mismatched = [];
      for (const q of selected()) {
        if (counts.has(q.sectionId)) {
          counts.set(q.sectionId, counts.get(q.sectionId) + 1);
          const sec = state.sections.find(s => s.id === q.sectionId);
          if (sec && Number(q.marks) !== Number(sec.marksEach)) mismatched.push({ section: label(sec), marks: q.marks, expected: sec.marksEach });
        } else unassigned++;
      }
      const rows = state.sections.map(s => ({
        id: s.id, label: label(s), count: counts.get(s.id), attempt: Number(s.attempt) || 0, marks: sectionMarks(s),
        short: counts.get(s.id) < (Number(s.attempt) || 0),
      }));
      const issues = [];
      if (!state.sections.length) issues.push('Add at least one section.');
      rows.filter(r => r.short).forEach(r => issues.push(`${r.label}: attempt ${r.attempt} but only ${r.count} question${r.count === 1 ? '' : 's'} added.`));
      if (unassigned) issues.push(`${unassigned} question${unassigned === 1 ? ' is' : 's are'} not in any section.`);
      state.sections.forEach(s => {
        if (!(Number(s.marksEach) > 0)) issues.push(`${label(s)}: marks per question must be above 0.`);
        if (!(Number(s.attempt) >= 1)) issues.push(`${label(s)}: attempt must be at least 1.`);
      });
      return { rows, total: rows.reduce((t, r) => t + r.marks, 0), unassigned, mismatched, issues };
    }

    function payload() {
      if (!state.enabled) return {};
      return {
        layout: 'board',
        sections: state.sections.map(s => ({ id: s.id, qNo: s.qNo, part: s.part, instruction: s.instruction, marksEach: Number(s.marksEach), attempt: Number(s.attempt) })),
        header: { ...state.header, notes: [...state.header.notes] },
      };
    }

    // ── rendering ────────────────────────────────────────────────────────────
    function render() {
      if (!root) return;
      _injectStyle();
      if (!state.enabled) {
        root.innerHTML = `<div class="pps-box"><label class="pps-toggle"><input type="checkbox" data-pps="toggle" /> Board-style paper (sections, "attempt any N", header)</label></div>`;
        root.querySelector('[data-pps="toggle"]').addEventListener('change', e => { setEnabled(e.target.checked); });
        return;
      }
      const h = state.header;
      root.innerHTML = `
        <div class="pps-box">
          <label class="pps-toggle"><input type="checkbox" data-pps="toggle" checked /> Board-style paper (sections, "attempt any N", header)</label>
          <div class="pps-grid">
            <label>Paper code<input class="pps-in" data-h="paperCode" value="${_esc(h.paperCode)}" placeholder="e.g. N 919" /></label>
            <label>Exam line<input class="pps-in" data-h="examLine" value="${_esc(h.examLine)}" placeholder="e.g. 2026 III 06 1100 -N 919- MATHEMATICS (71)" /></label>
            <label>Subject line<input class="pps-in" data-h="subjectLine" value="${_esc(h.subjectLine)}" placeholder="e.g. ALGEBRA - PART I (E)" /></label>
            <label>Course line<input class="pps-in" data-h="courseLine" value="${_esc(h.courseLine)}" placeholder="(REVISED COURSE)" /></label>
            <label>Time<input class="pps-in" data-h="timeText" value="${_esc(h.timeText)}" placeholder="Time : 2 Hours" /></label>
          </div>
          <label class="pps-lbl">Notes at the top (one per line)
            <textarea class="pps-in" data-h="notes" rows="3">${_esc(h.notes.join('\n'))}</textarea></label>
          <label class="pps-toggle" style="font-weight:400;margin-top:6px"><input type="checkbox" data-h="seatOnEveryPage" ${h.seatOnEveryPage ? 'checked' : ''} /> Repeat the seat number box on every page</label>
        </div>
        <div class="pps-box">
          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:space-between">
            <strong>Sections</strong>
            <span>
              <button type="button" class="pps-btn" data-pps="template">Load template: SSC Algebra 40 marks</button>
              <button type="button" class="pps-btn" data-pps="autofill">Auto-fill questions</button>
              <button type="button" class="pps-btn pri" data-pps="add">+ Add section</button>
            </span>
          </div>
          <p class="pps-hint">New questions go into the <b>active</b> section (highlighted). Pick a section, then add questions with the marks buttons.</p>
          <div data-pps="sections"></div>
        </div>
        <div class="pps-box" data-pps="summary"></div>`;

      root.querySelector('[data-pps="toggle"]').addEventListener('change', e => setEnabled(e.target.checked));
      root.querySelectorAll('[data-h]').forEach(el => {
        const key = el.dataset.h;
        const ev = el.type === 'checkbox' ? 'change' : 'input';
        el.addEventListener(ev, () => {
          if (key === 'notes') state.header.notes = el.value.split('\n').map(x => x.trim()).filter(Boolean);
          else if (key === 'seatOnEveryPage') state.header.seatOnEveryPage = el.checked;
          else state.header[key] = el.value;
          notify();
        });
      });
      root.querySelector('[data-pps="add"]').addEventListener('click', () => addSection());
      root.querySelector('[data-pps="autofill"]').addEventListener('click', e => autoFill(e.currentTarget));
      root.querySelector('[data-pps="template"]').addEventListener('click', () => loadTemplate('ssc_algebra_40'));
      renderSections();
      renderSummary();
    }

    function renderSections() {
      const host = root?.querySelector('[data-pps="sections"]');
      if (!host) return;
      const sum = summary();
      const byId = new Map(sum.rows.map(r => [r.id, r]));
      host.innerHTML = state.sections.length ? state.sections.map(s => {
        const r = byId.get(s.id);
        return `
          <div class="pps-sec ${s.id === state.activeId ? 'active' : ''}" data-sec="${s.id}">
            <div class="pps-sec-row">
              <label>Q. no<input class="pps-in" data-f="qNo" value="${_esc(s.qNo)}" /></label>
              <label>Part<input class="pps-in" data-f="part" value="${_esc(s.part)}" placeholder="A" /></label>
              <label>Instruction<input class="pps-in" data-f="instruction" value="${_esc(s.instruction)}" placeholder="e.g. Solve the following subquestions :" /></label>
            </div>
            <div class="pps-sec-row2">
              <label>Marks each <input class="pps-in" type="number" min="1" step="1" data-f="marksEach" value="${_esc(s.marksEach)}" /></label>
              <label>Attempt <input class="pps-in" type="number" min="1" step="1" data-f="attempt" value="${_esc(s.attempt)}" /></label>
              <span class="pps-chip ${r.short ? 'bad' : 'ok'}" data-role="count">${r.count} question${r.count === 1 ? '' : 's'} added</span>
              <span class="pps-chip" data-role="marks">= ${r.marks} marks</span>
              <button type="button" class="pps-btn" data-act="active">${s.id === state.activeId ? 'Active' : 'Use this section'}</button>
              <button type="button" class="pps-btn" data-act="up">Up</button>
              <button type="button" class="pps-btn" data-act="down">Down</button>
              <button type="button" class="pps-btn" data-act="remove">Remove</button>
            </div>
          </div>`;
      }).join('') : '<p class="pps-hint">No sections yet - add one, or load the template.</p>';

      host.querySelectorAll('[data-sec]').forEach(card => {
        const sec = state.sections.find(x => x.id === card.dataset.sec);
        card.querySelectorAll('[data-f]').forEach(inp => {
          inp.addEventListener('input', () => {
            const f = inp.dataset.f;
            sec[f] = (f === 'marksEach' || f === 'attempt') ? Number(inp.value) : inp.value;
            refreshLive();
            notify();
          });
        });
        card.querySelectorAll('[data-act]').forEach(btn => {
          btn.addEventListener('click', () => {
            const act = btn.dataset.act;
            const i = state.sections.findIndex(x => x.id === sec.id);
            if (act === 'active') state.activeId = sec.id;
            if (act === 'remove') {
              state.sections.splice(i, 1);
              selected().forEach(q => { if (q.sectionId === sec.id) q.sectionId = undefined; });
              if (state.activeId === sec.id) state.activeId = state.sections[0]?.id || null;
            }
            if (act === 'up' && i > 0) [state.sections[i - 1], state.sections[i]] = [state.sections[i], state.sections[i - 1]];
            if (act === 'down' && i < state.sections.length - 1) [state.sections[i + 1], state.sections[i]] = [state.sections[i], state.sections[i + 1]];
            renderSections();
            renderSummary();
            notify();
          });
        });
      });
    }

    // Update chips/summary without rebuilding the inputs (keeps typing focus).
    function refreshLive() {
      const sum = summary();
      root?.querySelectorAll('[data-sec]').forEach(card => {
        const r = sum.rows.find(x => x.id === card.dataset.sec);
        if (!r) return;
        const c = card.querySelector('[data-role="count"]');
        const m = card.querySelector('[data-role="marks"]');
        if (c) { c.textContent = `${r.count} question${r.count === 1 ? '' : 's'} added`; c.className = `pps-chip ${r.short ? 'bad' : 'ok'}`; }
        if (m) m.textContent = `= ${r.marks} marks`;
      });
      renderSummary(sum);
    }

    function renderSummary(sumIn) {
      const host = root?.querySelector('[data-pps="summary"]');
      if (!host) return;
      const sum = sumIn || summary();
      const ok = !sum.issues.length;
      host.innerHTML = `
        <strong>Marks check</strong>
        <table class="pps-sum"><tr><th>Section</th><th>Added</th><th>Attempt</th><th>Marks</th></tr>
          ${sum.rows.map(r => `<tr><td>${_esc(r.label)}</td><td>${r.count}</td><td>${r.attempt}</td><td>${r.marks}</td></tr>`).join('')}
        </table>
        <div class="pps-total ${ok ? 'ok' : 'bad'}"><span>Paper total</span><span>${sum.total} marks ${ok ? '&#10003;' : ''}</span></div>
        ${sum.issues.map(i => `<div class="pps-issue">${_esc(i)}</div>`).join('')}
        ${sum.mismatched.length ? `<div class="pps-hint">Note: ${sum.mismatched.length} question(s) have a different mark value than their section (marks are counted from the section).</div>` : ''}`;
    }

    // ── state changes ────────────────────────────────────────────────────────
    function setEnabled(on) {
      state.enabled = !!on;
      if (on && !state.sections.length) addSection({ silent: true });
      if (!on) selected().forEach(q => { q.sectionId = undefined; });
      render();
      notify();
    }

    function addSection({ silent } = {}) {
      const last = state.sections[state.sections.length - 1];
      const nextQ = last ? String((parseInt(last.qNo, 10) || state.sections.length) + 1) : '1';
      state.sections.push({ id: _newId(), qNo: nextQ, part: '', instruction: '', marksEach: 1, attempt: 1 });
      state.activeId = state.sections[state.sections.length - 1].id;
      if (!silent) { renderSections(); renderSummary(); notify(); }
    }

    function loadTemplate(key) {
      const t = TEMPLATES[key];
      if (!t) return;
      state.sections = t.sections.map(s => ({ id: _newId(), ...s }));
      state.activeId = state.sections[0].id;
      state.header = { ...DEFAULT_HEADER(), ...state.header, ...t.header, notes: [...t.header.notes] };
      selected().forEach(q => { q.sectionId = undefined; });
      render();
      notify();
    }

    // Fill every section up to its "attempt" count from the chosen chapters. Candidates come
    // least-used first (ties shuffled) and are spread round-robin across chapters.
    async function autoFill(btn) {
      const say = (m, kind) => { try { toast?.(m, kind); } catch { /* ignore */ } };
      if (!state.enabled || !state.sections.length) { say('Add sections first (or load a template)', 'error'); return; }
      if (typeof fetchByMarks !== 'function' || typeof addQuestion !== 'function') return;
      if (typeof canFill === 'function' && !canFill()) { say('Select the batch, subject and chapters first', 'error'); return; }
      const label0 = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Filling...'; }
      const keepActive = state.activeId;
      const pools = new Map();
      const used = new Set(selected().map(q => q._id));
      let added = 0;
      const missing = [];
      try {
        for (const sec of state.sections) {
          const have = selected().filter(q => q.sectionId === sec.id).length;
          const need = Math.max(0, (Number(sec.attempt) || 0) - have);
          if (!need) continue;
          const marks = Number(sec.marksEach);
          if (!pools.has(marks)) pools.set(marks, await fetchByMarks(marks));
          const byChapter = new Map();
          (pools.get(marks) || []).filter(c => !used.has(c._id)).forEach(c => {
            const k = String(c.chapterId || '');
            if (!byChapter.has(k)) byChapter.set(k, []);
            byChapter.get(k).push(c);
          });
          const lists = [...byChapter.values()].map(l => l.map(c => ({ c, r: Math.random() })).sort((a, b) => ((a.c.usageCount || 0) - (b.c.usageCount || 0)) || (a.r - b.r)).map(x => x.c));
          const picks = [];
          for (let i = 0; picks.length < need; i++) {
            let any = false;
            for (const l of lists) { if (i < l.length && picks.length < need) { picks.push(l[i]); any = true; } }
            if (!any) break;
          }
          state.activeId = sec.id;
          picks.forEach(c => { used.add(c._id); addQuestion(c); added++; });
          if (picks.length < need) missing.push(`${label(sec)}: ${need - picks.length} more ${marks}-mark question${need - picks.length === 1 ? '' : 's'} needed`);
        }
      } catch (err) {
        console.error('auto-fill failed', err);
        say('Auto-fill failed, please try again', 'error');
      } finally {
        state.activeId = state.sections.some(s => s.id === keepActive) ? keepActive : (state.sections[0] && state.sections[0].id);
        if (btn) { btn.disabled = false; btn.textContent = label0; }
        refresh();
        notify();
      }
      if (missing.length) say(`Added ${added}. Not enough questions: ${missing.join('; ')}`, 'info');
      else if (added) say(`Auto-filled ${added} question${added === 1 ? '' : 's'}`, 'success');
      else say('All sections already have enough questions', 'info');
    }

    // Called by the builder when a question is added: put it in the active section.
    function assign(q) {
      if (!state.enabled) { q.sectionId = undefined; return true; }
      if (!state.sections.length || !state.activeId) return false;
      q.sectionId = state.activeId;
      return true;
    }

    function optionsHtml(selectedId) {
      return state.sections.map(s => `<option value="${_esc(s.id)}" ${s.id === selectedId ? 'selected' : ''}>${_esc(label(s))}</option>`).join('');
    }

    function reset() {
      state.enabled = false;
      state.sections = [];
      state.activeId = null;
      state.header = DEFAULT_HEADER();
      render();
    }

    // After the builder changes its list, refresh the counts.
    function refresh() {
      if (!state.enabled || !root) return;
      renderSections();
      renderSummary();
    }

    return {
      mount(el) { root = el; render(); },
      isEnabled: () => state.enabled,
      getSections: () => state.sections,
      activeId: () => state.activeId,
      label: id => { const s = state.sections.find(x => x.id === id); return s ? label(s) : ''; },
      optionsHtml,
      assign,
      summary,
      payload,
      reset,
      refresh,
      autoFill,
    };
  }

  return { create, TEMPLATES };
})();

window.PAPER_SECTIONS = PAPER_SECTIONS;
