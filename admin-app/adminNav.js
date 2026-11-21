/* ════════════════════════════════════════
   adminNav.js — the admin's ~30 tabs in 4 groups (owner 2026-11-21), in the sidebar and in the phone's "More" sheet.
   • the tab buttons are only moved into group boxes, never rebuilt: every listener and badge on them stays
   • a group opens / closes with its heading; the group of the open tab is always open; the state is remembered
   • a tab chosen from the phone's bottom bar or "More" sheet now opens exactly like the sidebar (same loaders:
     before, Sync / Students / Partners … opened from the phone without loading their data)
   • a tab that is in no group is put under "इतर", so nothing can disappear
════════════════════════════════════════ */
(function () {
  'use strict';
  const GROUPS = [
    { id: 'content', label: '📚 Content (प्रश्न, धडे, पुस्तके)', tabs: ['questions', 'tests', 'lessons', 'import', 'words', 'word-tests', 'concepts', 'exercise', 'passages', 'papers', 'books', 'banners'] },
    { id: 'people', label: '👥 Classes आणि लोक', tabs: ['classes', 'students', 'teachers', 'partners', 'help', 'crm'] },
    { id: 'growth', label: '📈 Test, Funnel आणि जाहिरात', tabs: ['sync', 'ads', 'site', 'notify', 'youtube-teachers', 'pricing'] },
    { id: 'system', label: '⚙️ System आणि हिशोब', tabs: ['versions', 'usage', 'settlement', 'settings'] },
  ];
  const TOP = ['dashboard'];
  const CSS = `.ang{display:flex;flex-direction:column;gap:var(--sp-1,4px)}
.ang-head{display:flex;align-items:center;gap:8px;width:100%;margin-top:8px;padding:8px 12px;border:0;border-radius:10px;background:transparent;color:var(--text2,#555);font:inherit;font-size:.78rem;font-weight:800;letter-spacing:.02em;text-transform:none;cursor:pointer;text-align:left}
.ang-head:hover{background:var(--surface2,var(--bg3,#f2f2f2))}
.ang-head:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
.ang-head .ang-car{margin-left:auto;transition:transform .2s}
.ang-head[aria-expanded="false"] .ang-car{transform:rotate(-90deg)}
.ang-body.ang-off{display:none}
.ang-n{font-weight:700;opacity:.7}
.adr-head{padding:12px 18px 4px;font-size:.78rem;font-weight:800;color:var(--text2,#666)}`;
  const mem = (k, v) => { try { if (v === undefined) return localStorage.getItem('ang_' + k); localStorage.setItem('ang_' + k, v); } catch { return null; } };
  let built = false;

  function build() {
    const nav = document.querySelector('nav.admin-tabs'); if (!nav || built) return;
    built = true;
    if (!document.getElementById('ang-css')) { const st = document.createElement('style'); st.id = 'ang-css'; st.textContent = CSS; document.head.appendChild(st); }
    const btn = t => nav.querySelector(`.atab[data-tab="${t}"]`);
    const all = [...nav.querySelectorAll('.atab')].map(b => b.dataset.tab);
    const grouped = new Set([...TOP, ...GROUPS.flatMap(g => g.tabs)]);
    const groups = GROUPS.concat([{ id: 'other', label: '📁 इतर', tabs: all.filter(t => !grouped.has(t)) }]).filter(g => g.tabs.some(btn));
    const activeTab = nav.querySelector('.atab.active')?.dataset.tab;
    for (const g of groups) {
      const head = document.createElement('button');
      head.type = 'button'; head.className = 'ang-head'; head.dataset.ang = g.id;
      const n = g.tabs.filter(btn).length;
      head.innerHTML = `<span>${g.label}</span> <span class="ang-n">${n}</span><span class="ang-car" aria-hidden="true">▾</span>`;
      const body = document.createElement('div'); body.className = 'ang ang-body'; body.id = 'ang-' + g.id; body.setAttribute('role', 'group'); body.setAttribute('aria-label', g.label);
      head.setAttribute('aria-controls', body.id);
      g.tabs.forEach(t => { const b = btn(t); if (b) body.appendChild(b); });
      nav.appendChild(head); nav.appendChild(body);
      const saved = mem(g.id), open = g.tabs.includes(activeTab) || (saved === null ? false : saved === '1');
      setOpen(head, body, open, false);
      head.addEventListener('click', () => setOpen(head, body, body.classList.contains('ang-off'), true));
    }
    // the group of the tab being opened is always open
    nav.addEventListener('click', e => { const b = e.target.closest('.atab'); if (b) openGroupOf(b.dataset.tab); });
    buildDrawer(groups);
    routePhoneNav();
  }
  function setOpen(head, body, open, save) {
    body.classList.toggle('ang-off', !open); head.setAttribute('aria-expanded', String(open));
    if (save) mem(head.dataset.ang, open ? '1' : '0');
  }
  function openGroupOf(tab) {
    const g = document.querySelector(`nav.admin-tabs .atab[data-tab="${tab}"]`)?.closest('.ang-body'); if (!g) return;
    const head = document.querySelector(`.ang-head[aria-controls="${g.id}"]`); if (head && g.classList.contains('ang-off')) setOpen(head, g, true, false);
  }

  // phone: the "More" sheet in the same groups, with any tab it was missing
  function buildDrawer(groups) {
    const dr = document.getElementById('admin-more-drawer'); if (!dr) return;
    const main = new Set([...document.querySelectorAll('#admin-bottom-nav .abn-tab')].map(b => b.dataset.tab));
    const item = t => {
      let it = dr.querySelector(`.abn-drawer-item[data-tab="${t}"]`);
      if (!it && !main.has(t)) {
        const sb = document.querySelector(`nav.admin-tabs .atab[data-tab="${t}"]`); if (!sb) return null;
        it = document.createElement('button'); it.type = 'button'; it.className = 'abn-drawer-item'; it.dataset.tab = t;
        it.innerHTML = `<span>${sb.querySelector('.atab-icon')?.textContent || '•'}</span> ${sb.querySelector('.atab-label')?.textContent || t}`;
      }
      return it;
    };
    for (const g of groups) {
      const its = g.tabs.map(item).filter(Boolean); if (!its.length) continue;
      const h = document.createElement('div'); h.className = 'adr-head'; h.textContent = g.label;
      dr.appendChild(h); its.forEach(x => dr.appendChild(x));
    }
  }

  // phone bottom bar / More sheet → the sidebar tab's own click (all its loaders run once)
  function routePhoneNav() {
    const open = t => { const b = document.querySelector(`nav.admin-tabs .atab[data-tab="${t}"]`); if (!b) return false; b.click(); return true; };
    document.getElementById('admin-more-drawer')?.addEventListener('click', e => {
      const it = e.target.closest('.abn-drawer-item'); if (!it || !open(it.dataset.tab)) return;
      e.stopPropagation();
      document.getElementById('admin-more-drawer')?.classList.add('hidden'); document.getElementById('admin-more-backdrop')?.classList.add('hidden');
      navigator.vibrate?.(6);
    }, true);
    document.getElementById('admin-bottom-nav')?.addEventListener('click', e => {
      const it = e.target.closest('.abn-tab'); if (!it || it.dataset.tab === '__more__' || !open(it.dataset.tab)) return;
      e.stopPropagation(); navigator.vibrate?.(6);
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
  window.ADMIN_NAV = { GROUPS, openGroupOf };
})();
