/* ═══════════════════════════════════════════════════════════════
   core/tour.js — the app tour: the screen dims, only the next button is lit,
   and a moving hand 👆 shows where to tap, with one short Marathi line.
   • the first time Home opens: course → (scroll) subject → lesson → its screen
   • the first time each page opens: Notes, Exercise, Test — once each
   Seen tours are remembered on this phone; Profile › "🎓 Tour पुन्हा पाहा" shows them again.
   Every step has "Skip"; nothing blocks the app (the lit button works as usual).
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const KEY = k => `tour_done_${k}`;
  const seen = k => { try { return localStorage.getItem(KEY(k)) === '1'; } catch { return false; } };
  const mark = k => { try { localStorage.setItem(KEY(k), '1'); } catch { /* private mode: shown again next time */ } };

  // the tours (selectors of the student app)
  const TOURS = {
    home: [
      { sel: '#batch-grid .batch-card', text: '👋 हा तुमचा course. त्यावर tap करा.', wait: 'tap' },
      { sel: '#subject-grid .subject-card', text: 'खाली scroll करा 👇 इथे सगळे विषय आहेत. एक विषय निवडा.', wait: 'tap', scroll: true },
      { sel: '#chapter-list .chapter-item', text: 'आता धडा निवडा.', wait: 'tap', scroll: true },
      { sel: '#chapter-hub-grid', text: 'इथून सुरू करा: 📒 Notes, ✍️ स्वाध्याय उत्तरं किंवा 📝 Test.', wait: 'next' },
      { sel: null, text: '🎉 झालं! कधीही अडलं तर ❓ मदत बटण दाबा.', wait: 'next' },
    ],
    notes: [
      { sel: '#nv-container', text: '📒 धड्याच्या Notes. वर-खाली scroll करून वाचा.', wait: 'next' },
      { sel: '#nv-next-btn', text: 'हा भाग झाला की पुढचा भाग ▶', wait: 'next' },
    ],
    exercise: [
      { sel: '.ev-reveal-btn', text: 'आधी स्वतः उत्तर लिहा, मग "उत्तर दाखवा" दाबून तपासा. ✍️', wait: 'next', scroll: true },
    ],
    'test-player': [
      { sel: '#tp-options-grid', text: 'योग्य पर्याय निवडा. लगेच कळेल बरोबर की चूक.', wait: 'next' },
      { sel: '#tp-next', text: 'पुढचा प्रश्न ▶ शेवटी result आणि क्रमांक.', wait: 'next' },
    ],
  };

  let _running = null;   // { key, i, cleanup }

  const CSS = `
.tour-spot { position: fixed; z-index: 100000; border-radius: 14px; pointer-events: none; box-shadow: 0 0 0 9999px rgba(10, 12, 24, .58);
  outline: 3px solid #ffe45c; outline-offset: 2px; transition: top .3s ease, left .3s ease, width .3s ease, height .3s ease; }
.tour-spot.tour-none { box-shadow: 0 0 0 9999px rgba(10, 12, 24, .58); outline: 0; width: 0; height: 0; }
.tour-hand { position: fixed; z-index: 100002; font-size: 40px; line-height: 1; pointer-events: none; filter: drop-shadow(0 3px 6px rgba(0,0,0,.35));
  animation: tour-tap 1.2s ease-in-out infinite; transition: top .3s ease, left .3s ease; }
.tour-hand.tour-swipe { animation: tour-swipe 1.6s ease-in-out infinite; }
@keyframes tour-tap { 0%, 100% { transform: translate(0, 0) scale(1); } 45% { transform: translate(-4px, -10px) scale(.9); } 55% { transform: translate(-4px, -10px) scale(.82); } }
@keyframes tour-swipe { 0% { transform: translateY(30px); opacity: 0; } 20% { opacity: 1; } 80% { transform: translateY(-40px); opacity: 1; } 100% { transform: translateY(-50px); opacity: 0; } }
.tour-bubble { position: fixed; z-index: 100003; left: 50%; transform: translateX(-50%); width: min(340px, calc(100vw - 32px)); box-sizing: border-box;
  background: #fff; color: #17203a; border-radius: 16px; padding: 14px 16px 12px; box-shadow: 0 12px 36px rgba(0,0,0,.28); font-size: 15px; line-height: 1.45; }
.tour-bubble p { margin: 0 0 10px; font-weight: 600; }
.tour-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.tour-dots { font-size: 12px; color: #6b7280; }
.tour-btn { border: 0; border-radius: 10px; padding: 8px 14px; font-weight: 800; font-size: 14px; cursor: pointer; }
.tour-next { background: linear-gradient(135deg, #ff7a18, #e8365d); color: #fff; }
.tour-skip { background: transparent; color: #6b7280; padding-inline: 6px; }
.tour-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
/* a popup of the free part (the name + number sheet, result, offer) opens over the test: the tour steps aside */
body:has(.gx-layer:not(.gx-leaving)) .tour-spot, body:has(.gx-layer:not(.gx-leaving)) .tour-hand, body:has(.gx-layer:not(.gx-leaving)) .tour-bubble { display: none; }
@media (prefers-reduced-motion: reduce) { .tour-hand, .tour-hand.tour-swipe { animation: none; } .tour-spot, .tour-hand { transition: none; } }
`;
  function css() {
    if (document.getElementById('tour-style')) return;
    const st = document.createElement('style'); st.id = 'tour-style'; st.textContent = CSS; document.head.appendChild(st);
  }

  const visible = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  async function waitFor(sel, ms = 8000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const el = [...document.querySelectorAll(sel)].find(visible);
      if (el) return el;
      await new Promise(r => setTimeout(r, 250));
    }
    return null;
  }
  // another popup (the free part's welcome, a sheet) is up: the tour waits
  const busy = () => !!document.querySelector('.gx-layer:not(.gx-leaving), .td-dialog, #profile-settings-overlay, .update-sheet:not(.hidden)');

  function stop(finished) {
    if (!_running) return;
    const { key, cleanup } = _running;
    cleanup();
    _running = null;
    if (finished !== false) mark(key);
  }

  async function show(key, i) {
    const steps = TOURS[key];
    if (!_running || _running.key !== key) return;
    if (i >= steps.length) { stop(true); return; }
    const step = steps[i];
    _running.i = i;
    _running.cleanup();
    let el = null;
    if (step.sel) {
      el = await waitFor(step.sel, step.wait === 'tap' && i > 0 ? 12000 : 8000);
      if (!_running || _running.key !== key) return;
      if (!el) { stop(true); return; }          // the screen is not as expected: end quietly
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await new Promise(r => setTimeout(r, 380));
    }
    const nodes = [];
    const add = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; document.body.appendChild(d); nodes.push(d); return d; };
    const spot = add('tour-spot' + (el ? '' : ' tour-none'));
    const hand = el ? add('tour-hand' + (step.scroll && i > 0 ? ' tour-swipe' : ''), '👆') : null;
    const bubble = add('tour-bubble', `<p>${step.text}</p><div class="tour-row"><button type="button" class="tour-btn tour-skip">Skip</button>
      <span class="tour-dots">${i + 1} / ${steps.length}</span>${step.wait === 'next' ? `<button type="button" class="tour-btn tour-next">${i === steps.length - 1 ? 'झालं ✓' : 'पुढे →'}</button>` : '<span></span>'}</div>`);
    bubble.setAttribute('role', 'dialog'); bubble.setAttribute('aria-live', 'polite');
    const place = () => {
      if (!el) { spot.style.cssText = 'left:50%;top:50%'; bubble.style.top = '40%'; return; }
      const r = el.getBoundingClientRect(), pad = 6;
      Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
      if (hand) Object.assign(hand.style, { left: `${Math.min(window.innerWidth - 48, r.left + r.width / 2 - 10)}px`, top: `${Math.min(window.innerHeight - 52, r.top + Math.min(r.height * 0.6, 60))}px` });
      const below = r.bottom + 150 < window.innerHeight;
      bubble.style.top = below ? `${Math.min(window.innerHeight - 140, r.bottom + 18)}px` : `${Math.max(12, r.top - 130)}px`;
    };
    place();
    const onMove = () => place();
    window.addEventListener('resize', onMove); window.addEventListener('scroll', onMove, true);
    const next = () => show(key, i + 1);
    const onTap = () => setTimeout(next, 350);
    if (step.wait === 'tap' && el) el.addEventListener('click', onTap, { once: true });
    bubble.querySelector('.tour-skip').onclick = () => stop(true);
    bubble.querySelector('.tour-next')?.addEventListener('click', next);
    bubble.querySelector('.tour-next')?.focus?.({ preventScroll: true });
    _running.cleanup = () => {
      nodes.forEach(n => n.remove());
      window.removeEventListener('resize', onMove); window.removeEventListener('scroll', onMove, true);
      if (el) el.removeEventListener('click', onTap);
    };
  }

  async function start(key, { force = false } = {}) {
    if (!TOURS[key] || (!force && seen(key)) || _running) return;
    css();
    // wait (up to ~20 s) for other popups to close and the first step's button to be there
    for (let t = 0; t < 40 && busy(); t++) await new Promise(r => setTimeout(r, 500));
    if (busy() || _running || (!force && seen(key))) return;   // (marked done while it waited, e.g. by the free part)
    _running = { key, i: 0, cleanup: () => {} };
    show(key, 0);
  }

  // the app calls this on every screen change
  function onScreen(name) {
    if (_running && _running.key !== 'home') stop(false);   // a page tour ends when its page is left (shown again next time)
    if (name === 'home') { setTimeout(() => start('home'), 1500); return; }
    // the website's free test: no tour over it — its clock runs (30 s a question) and the free part has its own guide
    if (name === 'test-player' && window.GUEST?.isActive?.()) return;
    if (TOURS[name] && !(_running && _running.key === 'home')) setTimeout(() => start(name), 900);
  }

  // Profile › "🎓 Tour पुन्हा पाहा"
  function reset() { Object.keys(TOURS).forEach(k => { try { localStorage.removeItem(KEY(k)); } catch { /* */ } }); }

  // a tour that must not come any more on this phone (the free part's sheet came over the test)
  function done(key) { mark(key); if (_running && _running.key === key) stop(true); }

  window.TOUR = { start, onScreen, reset, stop, done };
})();
