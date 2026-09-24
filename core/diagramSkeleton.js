/* ════════════════════════════════════════
   diagramSkeleton.js — draws the EMPTY diagram a student must fill in (tree diagram, flow chart,
   web/spider map) from a small JSON description, so no image has to be uploaded.
   Global: DIAGRAM_SKELETON.html(diagram) -> HTML string (inline styles only, so it prints in the
   PDF and shows in the student/admin views alike).

   diagram = { kind: 'tree' | 'flow', levels: [ { label, boxes: ['', 'Given text', ...], lines?: true } ] }
           | { kind: 'web', center: 'hibiscus flower', boxes: ['blooms ...', 'smiles ...', ...] }
   A box with '' is an empty box to fill in; text is printed inside it. lines:true prints "1. ______"
   answer lines instead of boxes (the "Example" row of a tree diagram).
════════════════════════════════════════ */

const DIAGRAM_SKELETON = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BOX = 'border:1.5px solid #222;min-height:30px;min-width:96px;padding:4px 8px;box-sizing:border-box;text-align:center;font-size:13px;display:flex;align-items:center;justify-content:center;background:#fff;color:#111';
  const box = t => `<div style="${BOX}">${esc(t)}</div>`;
  const line = i => `<div style="border-bottom:1.5px solid #222;min-width:110px;min-height:24px;font-size:13px;text-align:left;color:#111">${i}.</div>`;
  const arrow = c => `<div style="text-align:center;font-size:18px;line-height:1.1;color:#222">${c}</div>`;

  function _tree(levels) {
    return levels.map((lv, i) => `
      ${i ? arrow('&#8595;&#xFE0E;') : ''}
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:78px;flex:none;font-size:12px;color:#333">&bull; ${esc(lv.label || '')}</div>
        <div style="flex:1;display:flex;justify-content:space-around;gap:10px">
          ${(lv.boxes || ['']).map((t, j) => lv.lines ? line(j + 1) : box(t)).join('')}
        </div>
      </div>`).join('');
  }

  function _web(d) {
    const b = d.boxes || [];
    if (b.length === 4) {
      const cell = x => `<div style="display:flex;justify-content:center">${x}</div>`;
      const arr = c => `<div style="display:flex;align-items:center;justify-content:center">${arrow(c)}</div>`;
      return `<div style="display:grid;grid-template-columns:1fr 34px 1.1fr 34px 1fr;gap:6px 0;align-items:center">
        ${cell(box(b[0]))}${arr('&#8598;')}<div></div>${arr('&#8599;')}${cell(box(b[1]))}
        <div></div><div></div>${cell(box(d.center || ''))}<div></div><div></div>
        ${cell(box(b[2]))}${arr('&#8601;')}<div></div>${arr('&#8600;')}${cell(box(b[3]))}
      </div>`;
    }
    return `<div style="display:flex;justify-content:center">${box(d.center || '')}</div>${arrow('&#8595;&#xFE0E;')}
      <div style="display:flex;justify-content:space-around;gap:10px">${b.map(t => box(t)).join('')}</div>`;
  }

  function html(d) {
    if (!d || typeof d !== 'object') return '';
    const inner = d.kind === 'web' ? _web(d) : _tree(Array.isArray(d.levels) ? d.levels : []);
    if (!inner.trim()) return '';
    return `<div class="pp-atom" style="margin:10px 0;padding:8px 6px;font-family:Arial,sans-serif">${inner}</div>`;
  }

  return { html };
})();

if (typeof window !== 'undefined') window.DIAGRAM_SKELETON = DIAGRAM_SKELETON;
