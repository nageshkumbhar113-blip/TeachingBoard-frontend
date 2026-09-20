/* ════════════════════════════════════════
   core/math.js — KaTeX math renderer
   Usage: MATH.renderElement(domElement)
   Convention in question text:
     Inline : $x^2 + y^2$
     Display: $$\frac{a}{b}$$
════════════════════════════════════════ */

const MATH = (() => {
  const DELIMITERS = [
    { left: '$$',   right: '$$',   display: true  },
    { left: '\\[',  right: '\\]',  display: true  },
    { left: '$',    right: '$',    display: false },
    { left: '\\(',  right: '\\)',  display: false },
  ];

  // Fill-in-the-blank boxes. Authors may write "[[ ]]" (preferred) or the underscore forms that
  // AI-generated questions use: \text{___} / \_\_\_ . KaTeX rejects an underscore in \text{}
  // (that is what showed raw red LaTeX in Exercise), so every form becomes an empty box.
  const _BLANK_RE = /\[\[\s*([sl]?)\s*\]\]/g;
  const _UNDERSCORE_RE = /\\text\{\s*_{2,}\s*\}|(?:\\_){2,}/g;
  const _box = size => `\\boxed{\\phantom{${size === 's' ? '00' : size === 'l' ? '00000000' : '0000'}}}`;

  function normalizeBlankText(s) {
    const str = String(s ?? '');
    if (!/\[\[|_/.test(str)) return str;
    const inMath = t => t.replace(_UNDERSCORE_RE, _box()).replace(_BLANK_RE, (_m, z) => _box(z));
    const outMath = t => t.replace(_BLANK_RE, (_m, z) => `$${_box(z)}$`);
    const mathRe = /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g;
    let out = '', last = 0, m;
    while ((m = mathRe.exec(str))) {
      out += outMath(str.slice(last, m.index)) + inMath(m[0]);
      last = m.index + m[0].length;
    }
    return out + outMath(str.slice(last));
  }

  function normalizeBlanks(el) {
    if (!el || !document.createTreeWalker) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => { const v = normalizeBlankText(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; });
  }

  function _doRender(el) {
    normalizeBlanks(el);
    renderMathInElement(el, {
      delimiters:   DELIMITERS,
      throwOnError: false,
      output:       'html',
    });
  }

  // Render math inside a DOM element.
  // Retries up to 3 times if KaTeX hasn't loaded yet.
  function renderElement(el, _attempt) {
    if (!el) return;
    if (!window.renderMathInElement) {
      if ((_attempt || 0) < 3) {
        setTimeout(() => renderElement(el, (_attempt || 0) + 1), 400);
      }
      return;
    }
    try { _doRender(el); }
    catch (e) { console.warn('KaTeX render error:', e.message); }
  }

  return { renderElement, normalizeBlanks, normalizeBlankText };
})();

window.MATH = MATH;
