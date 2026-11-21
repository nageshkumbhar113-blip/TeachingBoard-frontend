/* ════════════════════════════════════════
   adminSubtabs.js — sub-tabs inside the big admin tabs (owner 2026-11-21: "khup khali scroll karava lagto").
   A bar of chips at the top of a tab; a chip shows only its own sections. Nothing inside a section changes:
   the sections are only hidden (class ast-off), never moved or rebuilt, so every form, button and loader works as before.
   • the last chip used in a tab opens next time (this device)
   • safety: if any code scrolls to or focuses something in a hidden section, its chip opens first
   • Sync: 🏆 महा-Test and 📝 रोजचे पेपर share one form; the chip sets the form's kind and shows only that kind's list
   Global: ADMIN_SUBTABS { show(tab, id), current(tab) }
════════════════════════════════════════ */
(function () {
  'use strict';
  // sel: CSS selectors inside the tab; { h3: 'text' } = the .pa-section whose <h3> starts with that text
  const CFG = {
    sync: [
      { id: 'weekly', label: '🏆 महा-Test', sel: ['[aria-label="Weekly test"]'], kind: 'weekly' },
      { id: 'daily', label: '📝 रोजचे पेपर', sel: ['[aria-label="Weekly test"]'], kind: 'daily' },
      { id: 'dates', label: '📅 परीक्षेच्या तारखा', sel: ['[aria-label="Exam dates"]'] },
      { id: 'funnel', label: '📈 Funnel व Leads', sel: ['[aria-label="Free funnel and leads"]'] },
      { id: 'free', label: '🎁 Free Test व सूट', sel: ['[aria-label="Free test link"]', '#offer-settings'] },
      { id: 'links', label: '🔗 Links', sel: ['[aria-label="Quick Links Share"]'] },
      { id: 'tech', label: '🔧 Technical', sel: ['[aria-label="Share Server URL"]', '[aria-label="QR Code Transfer"]', '[aria-label="REST API Status"]'] },
    ],
    teachers: [
      { id: 'list', label: '👩‍🏫 Teachers (नवीन / बदला / यादी)', sel: ['[aria-label="Add / Edit Teacher"]', '#pending-teachers-section', '[aria-label="Teacher List"]'] },
      { id: 'quota', label: '📄 Paper Builder limits', sel: ['[aria-label="Paper Builder quota"]'] },
      { id: 'demo', label: '🎯 Ad demo settings', sel: ['#tdemo-cfg'] },
    ],
    students: [
      { id: 'list', label: '👨‍🎓 Students (नवीन / बदला / यादी)', sel: ['[aria-label="Student Access Management"]', '#pending-requests-section', '[aria-label="Student List"]'] },
      { id: 'import', label: '📥 एकदम अनेक (Import)', sel: ['#student-import-section'] },
    ],
    import: [
      { id: 'fig', label: '🖼 PDF मधून आकृती प्रश्न', sel: ['#fig-import-host'] },
      { id: 'csv', label: '📊 CSV', sel: ['[aria-label="CSV Import"]'] },
      { id: 'bulk', label: '📋 Bulk Paste', sel: ['[aria-label="Bulk Paste"]'] },
      { id: 'zip', label: '📦 ZIP', sel: ['[aria-label="ZIP Bundle Import"]'] },
      { id: 'export', label: '📤 Export', sel: ['[aria-label="Export"]'] },
    ],
    classes: [
      { id: 'list', label: '🏫 Classes', sel: ['#batch-admin-list'] },
      { id: 'subjects', label: '📚 Subjects', sel: ['[aria-label="Manage Subjects"]'] },
      { id: 'chapters', label: '📖 Chapters', sel: ['[aria-label="Manage Chapters"]'] },
      { id: 'copy', label: '📥 दुसऱ्या class मधून', sel: ['[aria-label="Import content from another batch"]'] },
    ],
    partners: [
      { id: 'shops', label: '🏪 Shops', sel: ['#sh-section'] },
      { id: 'settings', label: '⚙️ Settings व Prizes', sel: [{ h3: 'Settings' }] },
      { id: 'refs', label: '👥 Referrals', sel: [{ h3: 'Student referrals' }] },
      { id: 'prizes', label: '🎁 Prize requests', sel: [{ h3: 'Prize requests' }] },
      { id: 'lines', label: '🧾 Commission lines', sel: [{ h3: 'Commission lines' }] },
    ],
  };
  const CSS = `.ast-bar{display:flex;gap:6px;overflow-x:auto;padding:4px 2px 10px;margin:0 0 6px;scrollbar-width:thin;-webkit-overflow-scrolling:touch}
.ast-chip{flex:none;border:1.5px solid var(--border,#d0d0d0);background:var(--bg3,#f4f4f4);color:var(--text,#222);border-radius:20px;padding:8px 14px;font:inherit;font-size:.92rem;font-weight:700;cursor:pointer;white-space:nowrap}
.ast-chip[aria-selected="true"]{background:var(--accent,#6d3cf0);border-color:var(--accent,#6d3cf0);color:#fff}
.ast-chip:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
.ast-off{display:none !important}
#atab-sync[data-ast-kind] .wka-mode[aria-label="किती वेळा"]{display:none}
#atab-sync[data-ast-kind="daily"] #wk-schedules > [data-kind="weekly"],#atab-sync[data-ast-kind="weekly"] #wk-schedules > [data-kind="daily"],
#atab-sync[data-ast-kind="daily"] #wk-events > [data-kind="weekly"],#atab-sync[data-ast-kind="weekly"] #wk-events > [data-kind="daily"]{display:none}`;
  const mem = (k, v) => { try { if (v === undefined) return localStorage.getItem('ast_' + k) || ''; localStorage.setItem('ast_' + k, v); } catch { return ''; } };
  const state = {};   // tab → { cur, subs: [{ id, els }] }

  function find(panel, s) {
    if (typeof s === 'string') return [...panel.querySelectorAll(s)];
    return [...panel.querySelectorAll('.pa-section')].filter(sec => [...sec.querySelectorAll('h3')].some(h => h.textContent.trim().startsWith(s.h3)));
  }

  function init() {
    if (!document.getElementById('ast-css')) { const st = document.createElement('style'); st.id = 'ast-css'; st.textContent = CSS; document.head.appendChild(st); }
    for (const [tab, subs] of Object.entries(CFG)) {
      const panel = document.getElementById('atab-' + tab); if (!panel || panel.dataset.ast) continue;
      const list = subs.map(s => ({ ...s, els: s.sel.flatMap(x => find(panel, x)) }));
      if (list.some(s => !s.els.length)) { console.warn('subtabs: a section is missing in', tab, list.filter(s => !s.els.length).map(s => s.id)); continue; }   // never hide half a tab
      list.forEach(s => s.els.forEach(el => { el.dataset.astTab = tab; el.dataset.astSubs = ((el.dataset.astSubs || '') + ' ' + s.id).trim(); }));
      const bar = document.createElement('div'); bar.className = 'ast-bar'; bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', 'उप-विभाग');
      bar.innerHTML = list.map(s => `<button type="button" class="ast-chip" role="tab" data-ast="${s.id}" aria-selected="false">${s.label}</button>`).join('');
      const head = panel.querySelector(':scope > .admin-page-header') || panel.querySelector(':scope > .pa-wrap > h2');
      if (head) head.after(bar); else panel.prepend(bar);
      bar.addEventListener('click', e => { const b = e.target.closest('[data-ast]'); if (b) show(tab, b.dataset.ast, true); });
      bar.addEventListener('keydown', e => {
        if (!/^Arrow(Left|Right)$/.test(e.key)) return;
        const bs = [...bar.querySelectorAll('[data-ast]')], i = bs.indexOf(document.activeElement); if (i < 0) return;
        const n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length]; n.focus(); n.click();
      });
      panel.dataset.ast = '1';
      state[tab] = { cur: '', subs: list, bar, panel };
      const saved = mem(tab);
      show(tab, list.some(s => s.id === saved) ? saved : list[0].id);
      // the tab opened (sidebar, bottom bar or More): apply the chip again
      let was = panel.classList.contains('hidden');
      new MutationObserver(() => { const h = panel.classList.contains('hidden'); if (was && !h) show(tab, state[tab].cur); was = h; }).observe(panel, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function show(tab, id, byUser) {
    const st = state[tab]; if (!st) return;
    const sub = st.subs.find(s => s.id === id) || st.subs[0];
    st.cur = sub.id; mem(tab, sub.id);
    st.subs.forEach(s => s.els.forEach(el => el.classList.toggle('ast-off', !el.dataset.astSubs.split(' ').includes(sub.id))));
    st.bar.querySelectorAll('[data-ast]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.ast === sub.id)));
    st.bar.querySelector(`[data-ast="${sub.id}"]`)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    // the form's kind is set only while the tab is open (admin.js has bound its handlers by then)
    if (tab === 'sync' && !st.panel.classList.contains('hidden')) syncKind(st.panel, sub.kind);
    if (byUser) st.panel.querySelector('.ast-bar')?.scrollIntoView?.({ block: 'nearest' });
  }

  // महा-Test / रोजचे पेपर: one form (radio wk-kind); the chip sets the kind
  function syncKind(panel, kind) {
    if (!kind) { delete panel.dataset.astKind; return; }
    panel.dataset.astKind = kind;
    const h4 = document.getElementById('wk-events')?.previousElementSibling;
    if (h4 && h4.tagName === 'H4') h4.textContent = kind === 'daily' ? '📋 झालेले / येणारे रोजचे पेपर' : '📋 झालेले / येणारे महा-Test';
    const radios = [...document.querySelectorAll('input[name="wk-kind"]')], cur = radios.find(r => r.checked)?.value || 'weekly';
    if (cur === kind) return;
    const r = radios.find(x => x.value === kind); if (!r) return;
    radios.forEach(x => { x.checked = x === r; });
    // an open schedule of the other kind must not turn into this kind: start a new form
    const editing = /बदल/.test(document.getElementById('btn-wk-save')?.textContent || '');
    if (editing) document.getElementById('btn-wk-new')?.click();
    r.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // safety net: code that scrolls to / focuses a hidden section opens its chip first
  function reveal(el) {
    const sec = el && el.closest && el.closest('.ast-off[data-ast-tab]'); if (!sec) return;
    show(sec.dataset.astTab, sec.dataset.astSubs.split(' ')[0]);
  }
  const _siv = Element.prototype.scrollIntoView, _foc = HTMLElement.prototype.focus;
  Element.prototype.scrollIntoView = function (...a) { try { reveal(this); } catch { /* */ } return _siv.apply(this, a); };
  HTMLElement.prototype.focus = function (...a) { try { reveal(this); } catch { /* */ } return _foc.apply(this, a); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.ADMIN_SUBTABS = { show, current: tab => state[tab]?.cur || '', init };
})();
