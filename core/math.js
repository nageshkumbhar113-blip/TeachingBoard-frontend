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

  function _doRender(el) {
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

  return { renderElement };
})();

window.MATH = MATH;
