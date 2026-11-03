/* ════════════════════════════════════════
   penOverlay.js — Board Mode pen + Whiteboard / Blackboard
   Global: PEN_BOARD

   Only in Board Mode (body.mode-board), only on MCQ practice (screen-quiz),
   an exercise's questions (screen-exercise) and an open note (screen-notes,
   taken part by part). Never in tests / महा-Test.
   A yellow ✏️ button opens:
     ⬜ / ⬛ board — the app is covered, the open question comes along as a
        card ("Show answer" hides the answer until tapped); the writing is kept
        per question while the app stays open; 💾 makes one picture
        (question + board) for Share / Save (core/fileExport.js).
     ✍️ on the app itself — transparent glass, cleared when closed.
   Tools: 👆 select + move / copy / remove a figure, 🎨 fill a closed area,
   pen (pressure), highlighter, eraser (part / whole line / box /
   free-hand area / all), laser, shapes (straight + bendable curve line,
   arrow, circle, rectangle, triangle, X-Y axes), text, compass, ruler,
   set square, protractor (pen near an edge draws straight), paper:
   blank / ruled / grid / graph (1 cm = 40 px), pages.
   Reads the question from the screen (DOM + QUIZ.getQuestions); the only
   app call it makes is QUIZ.next/prevQuestion for the board's ◀ ▶ on MCQ.
   Phone Back closes it through APP.handleBack's popup rule (#pb-root is a
   full-screen fixed layer; a "tap outside" click on it closes the top part).
════════════════════════════════════════ */

const PEN_BOARD = (() => {
  const $ = id => document.getElementById(id);
  const _esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const _rich = s => _esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  const _sleep = ms => new Promise(r => setTimeout(r, ms));
  const _seen = el => !!el && el.getClientRects().length > 0 && !el.classList.contains('hidden');

  const PAL = [['#1b1f29', '#f3f3ec'], ['#1f5fd1', '#8ec5ff'], ['#d32f2f', '#ff8a80'], ['#17803a', '#a6e3a1'], ['#e07000', '#ffcc66'], ['#7b3fc4', '#d9b8ff'], ['#8a4f1d', '#f2c6a0'], ['#008b8b', '#7fe6dd']];
  const HL = ['rgba(255,214,0,.4)', 'rgba(0,230,118,.34)', 'rgba(255,64,129,.32)', 'rgba(64,160,255,.34)'];
  const WID = [2.5, 5, 10];
  const CM = 40;                       // 40 px = 1 cm (ruler, graph paper, readouts)
  const S = { tool: 'pen', c: 0, h: 0, w: 1, dark: false, bg: 'blank', shape: 'line', er: 'brush', sub: null, lastBoard: 'white' };
  const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const cmTxt = d => (d / CM).toFixed(1) + ' cm';
  let penSeen = false;

  // ── where the question comes from ──────────────────────
  let _lastCard = null;
  const SRC_EX = {
    kind: 'ex',
    cards() { return [...($('ev-questions-list')?.querySelectorAll('.ev-qcard') || [])]; },
    count() { return this.cards().length; },
    index() {
      const cs = this.cards();
      const i = cs.indexOf(_lastCard);
      if (i >= 0) return i;
      let best = 0, bd = Infinity;
      cs.forEach((c, k) => { const r = c.getBoundingClientRect(); const d = r.bottom < 60 || r.top > innerHeight ? 1e6 + Math.abs(r.top) : Math.abs(r.top - 120); if (d < bd) { bd = d; best = k; } });
      return best;
    },
    item(i) {
      const c = this.cards()[i];
      if (!c) return null;
      const cl = c.cloneNode(true);
      cl.querySelectorAll('.ev-reveal-btn, .ev-atext, button, .ev-qnum').forEach(e => e.remove());
      const ans = [...c.querySelectorAll('.ev-atext')].map(e => e.innerHTML).join('<hr>');
      const title = $('ev-questions-title')?.textContent || '';
      return { id: 'ex:' + (c.dataset.id || title + '#' + i), label: (c.querySelector('.ev-qnum')?.textContent || `Q${i + 1}`).replace(/\.$/, ''), title, html: cl.innerHTML, ans, ex: '' };
    },
    async go(i) { return i; },
    onClose(i) {
      const c = this.cards()[i]; if (!c) return;
      _lastCard = c;
      c.scrollIntoView({ block: 'center' });
      c.classList.add('ev-qcard-highlight'); setTimeout(() => c.classList.remove('ev-qcard-highlight'), 2000);
    },
  };
  const SRC_QUIZ = {
    kind: 'mcq',
    qs() { return window.QUIZ?.getQuestions?.() || []; },
    count() { return this.qs().length; },
    index() { const n = parseInt(($('q-number')?.textContent || '').replace(/\D/g, ''), 10); return Math.max(0, (n || 1) - 1); },
    item(i) {
      const q = this.qs()[i]; if (!q) return null;
      const live = i === this.index(), type = q.type || 'mcq';
      let html = `<div>${_rich(q.question)}</div>`;
      const img = $('q-image');
      if (live && img?.src && !$('q-image-wrap')?.classList.contains('hidden')) html += `<img class="pb-qimg" src="${_esc(img.src)}" alt="">`;
      let opts = null, ans = '';
      if (type === 'mcq') {
        const btns = live ? [...($('options-grid')?.querySelectorAll('.option-btn') || [])] : [];
        // the app's own option markup gets Board Mode's big circles; keep only the words / picture
        opts = btns.map(b => ({ k: b.dataset.key, h: `<b>${_esc(b.dataset.key)})</b> ${b.querySelector('.option-text')?.innerHTML || ''}${b.querySelector('.option-media')?.innerHTML || ''}` }));
        const a = opts.find(o => o.k === q.answer);
        ans = a ? a.h : `<b>${_esc(q.answer)}</b>`;
      } else if (type === 'tf') { opts = [{ k: 'True', h: '✅ True' }, { k: 'False', h: '❌ False' }]; ans = _esc(q.answer); }
      else ans = _esc(Array.isArray(q.answer) ? q.answer.join(', ') : (typeof q.answer === 'object' ? JSON.stringify(q.answer) : q.answer));
      const sess = window.QUIZ?.getSession?.() || {};
      return { id: 'q:' + (q.q_id || i), label: `Q${i + 1}`, title: [sess.subject, sess.chapter].filter(Boolean).join(' › '), html, opts, ansKey: q.answer, ans, ex: q.explanation ? _rich(q.explanation) : '' };
    },
    async go(i) {
      const cur = this.index();
      if (i === cur) return cur;
      if (i > cur) { if (cur >= this.count() - 1) return cur; window.QUIZ.nextQuestion(); } else window.QUIZ.prevQuestion();
      for (let t = 0; t < 30 && this.index() === cur; t++) await _sleep(50);
      await _sleep(150);   // option pictures / maths finish drawing
      return this.index();
    },
    onClose() {},
  };
  // A note is long: the board takes it part by part (each heading of the note text starts a
  // part; Learning Outcomes, Key Points, Formulas and each Quick Revision box are parts too).
  let _noteParts = null, _noteKey = '';
  const SRC_NOTE = {
    kind: 'note',
    parts() {
      const root = $('nv-content'), title = root?.querySelector('.nv-title');
      if (!title) return [];
      const key = title.textContent + '|' + root.childElementCount + '|' + root.textContent.length;
      if (_noteParts && _noteKey === key && _noteParts.every(p => p.els[0].isConnected)) return _noteParts;
      const out = [], has = el => el.textContent.trim() || el.querySelector('img, table');
      const units = node => {
        for (const el of node.children) {
          if (el.matches('.nv-header, #nv-videos-btn, .nv-attachments, button')) continue;
          if (el.matches('.nv-mode-read, .nv-mode-exam')) { units(el); continue; }
          if (el.matches('.nv-revision-box')) { for (const sec of el.querySelectorAll('.nv-revision-section')) if (has(sec)) out.push({ els: [sec] }); continue; }
          if (el.matches('.nv-content-body')) {
            let group = [], len = 0;
            for (const b of el.children) {
              const t = b.textContent.length;
              if (group.length && (/^H[1-6]$/.test(b.tagName) || len + t > 900)) { out.push({ els: group }); group = []; len = 0; }
              if (has(b)) { group.push(b); len += t; }
            }
            if (group.length) out.push({ els: group });
            continue;
          }
          if (has(el)) out.push({ els: [el] });
        }
      };
      units(root);
      _noteParts = out; _noteKey = key;
      return out;
    },
    count() { return this.parts().length; },
    index() {
      let best = 0, bd = Infinity;
      this.parts().forEach((p, k) => { const r = p.els[0].getBoundingClientRect(); const d = r.bottom < 60 || r.top > innerHeight ? 1e6 + Math.abs(r.top) : Math.abs(r.top - 120); if (d < bd) { bd = d; best = k; } });
      return best;
    },
    item(i) {
      const p = this.parts()[i]; if (!p) return null;
      const title = $('nv-content')?.querySelector('.nv-title')?.textContent.trim() || 'Notes';
      const cl = document.createElement('div');
      p.els.forEach(e => cl.appendChild(e.cloneNode(true)));
      cl.querySelectorAll('button, input').forEach(e => e.remove());
      return { id: 'note:' + title + '#' + i, label: `Part ${i + 1}`, title, html: cl.innerHTML, ans: '', ex: '' };
    },
    async go(i) { return i; },
    onClose(i) { this.parts()[i]?.els[0].scrollIntoView({ block: 'start' }); },
  };
  function _source() {
    const b = document.body;
    if (!b.classList.contains('mode-board')) return null;
    if (window.TEST_PLAYER?.isExamRunning?.()) return null;
    if (_seen($('screen-quiz')) && SRC_QUIZ.count()) return SRC_QUIZ;
    const sec = $('ev-questions-section');
    if (_seen($('screen-exercise')) && sec && sec.style.display !== 'none' && SRC_EX.count()) return SRC_EX;
    if (_seen($('screen-notes')) && SRC_NOTE.count()) return SRC_NOTE;
    return null;
  }

  // ── drawing ─────────────────────────────────────────────
  function _curveCtrl(s) { return [2 * s.h[0] - (s.a[0] + s.b[0]) / 2, 2 * s.h[1] - (s.a[1] + s.b[1]) / 2]; }
  function _axesLen(s) { return Math.max(CM, Math.round(Math.max(Math.abs(s.b[0] - s.a[0]), Math.abs(s.b[1] - s.a[1])) / CM) * CM); }
  function shapePath(x, s) {
    if (s.t === 'arc') {
      if (Math.abs(s.a1 - s.a0) >= Math.PI * 2) { x.moveTo(s.o[0] + s.r, s.o[1]); x.arc(s.o[0], s.o[1], s.r, 0, Math.PI * 2); }
      else { x.moveTo(s.o[0] + s.r * Math.cos(s.a0), s.o[1] + s.r * Math.sin(s.a0)); x.arc(s.o[0], s.o[1], s.r, s.a0, s.a1, s.a1 < s.a0); }
      return;
    }
    const [ax, ay] = s.a, [bx, by] = s.b;
    if (s.k === 'line' || s.k === 'arrow') {
      x.moveTo(ax, ay); x.lineTo(bx, by);
      if (s.k === 'arrow') { const g = Math.atan2(by - ay, bx - ax), l = 12 + s.w * 2; for (const d of [-0.45, 0.45]) { x.moveTo(bx, by); x.lineTo(bx - l * Math.cos(g + d), by - l * Math.sin(g + d)); } }
    } else if (s.k === 'curve') { const c = _curveCtrl(s); x.moveTo(ax, ay); x.quadraticCurveTo(c[0], c[1], bx, by); }
    else if (s.k === 'circle') { const r = dist(s.a, s.b); x.moveTo(ax + r, ay); x.arc(ax, ay, r, 0, Math.PI * 2); }
    else if (s.k === 'rect') x.rect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
    else if (s.k === 'tri') { x.moveTo((ax + bx) / 2, ay); x.lineTo(ax, by); x.lineTo(bx, by); x.closePath(); }
    else if (s.k === 'axes') {
      const L = _axesLen(s);
      x.moveTo(ax - L, ay); x.lineTo(ax + L, ay); x.moveTo(ax, ay - L); x.lineTo(ax, ay + L);
      for (const [ex, ey, g] of [[ax + L, ay, 0], [ax - L, ay, Math.PI], [ax, ay - L, -Math.PI / 2], [ax, ay + L, Math.PI / 2]])
        for (const d of [-0.45, 0.45]) { x.moveTo(ex, ey); x.lineTo(ex - 10 * Math.cos(g + d), ey - 10 * Math.sin(g + d)); }
      for (let i = CM; i < L; i += CM) { x.moveTo(ax + i, ay - 4); x.lineTo(ax + i, ay + 4); x.moveTo(ax - i, ay - 4); x.lineTo(ax - i, ay + 4); x.moveTo(ax - 4, ay - i); x.lineTo(ax + 4, ay - i); x.moveTo(ax - 4, ay + i); x.lineTo(ax + 4, ay + i); }
    }
  }
  function drawStroke(x, s, dark) {
    if (s.t === 'clr' || s.t === 'del') return;
    x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
    if (s.t === 'cut') {
      x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000';
      x.beginPath(); s.poly.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.fill();
      x.restore(); return;
    }
    let col;
    if (s.t === 'er') { x.globalCompositeOperation = 'destination-out'; col = '#000'; }
    else if (s.t === 'hl') col = HL[s.c];
    else col = PAL[s.c][dark ? 1 : 0];
    x.strokeStyle = col; x.fillStyle = col;
    if (s.t === 'txt') {
      x.font = `600 ${s.fs}px Mukta, "Nirmala UI", "Noto Sans Devanagari", sans-serif`; x.textBaseline = 'top';
      s.s.split('\n').forEach((ln, i) => x.fillText(ln, s.x + 5, s.y + i * s.fs * 1.25));
      x.restore(); return;
    }
    if (s.t === 'shape' || s.t === 'arc') {
      x.lineWidth = s.w; x.beginPath(); shapePath(x, s); x.stroke();
      if (s.k === 'axes') {
        const [ax, ay] = s.a, L = _axesLen(s);
        x.font = '600 12px Mukta, sans-serif'; x.textAlign = 'center';
        x.fillText('X', ax + L - 4, ay - 12); x.fillText("X'", ax - L + 6, ay - 12); x.fillText('Y', ax + 14, ay - L + 8); x.fillText("Y'", ax + 14, ay + L - 2); x.fillText('O', ax - 10, ay + 16);
        for (let i = CM, n = 1; i < L; i += CM, n++) { x.fillText(n, ax + i, ay + 17); x.fillText(-n, ax - i, ay + 17); x.fillText(n, ax - 14, ay - i + 4); x.fillText(-n, ax - 16, ay + i + 4); }
      }
      x.restore(); return;
    }
    const P = s.p;
    if (!P?.length) { x.restore(); return; }
    if (P.length === 1) { x.beginPath(); x.arc(P[0][0], P[0][1], s.w / 2, 0, 7); x.fill(); x.restore(); return; }
    if (s.pr && s.t === 'pen') {
      for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i]; x.lineWidth = s.w * (0.35 + b[2] * 1.3); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
    } else {
      x.lineWidth = s.w; x.beginPath(); x.moveTo(P[0][0], P[0][1]);
      for (let i = 1; i < P.length - 1; i++) { const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2; x.quadraticCurveTo(P[i][0], P[i][1], mx, my); }
      const L = P[P.length - 1]; x.lineTo(L[0], L[1]); x.stroke();
    }
    x.restore();
  }
  function label(x, t, p) {
    x.save(); x.font = '600 13px Mukta, sans-serif';
    const w = x.measureText(t).width + 14;
    x.fillStyle = 'rgba(20,26,40,.88)'; x.fillRect(p[0] + 14, p[1] - 30, w, 22);
    x.fillStyle = '#fff'; x.textBaseline = 'middle'; x.fillText(t, p[0] + 21, p[1] - 19); x.restore();
  }
  // points along a stroke, for "✂️ Remove a whole line / shape"
  function samples(s) {
    const lerp = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
    if (s.t === 'pen' || s.t === 'hl') return s.p;
    if (s.t === 'txt') { const w = Math.max(...s.s.split('\n').map(l => l.length)) * s.fs * 0.55, h = s.s.split('\n').length * s.fs * 1.25; return [[s.x, s.y], [s.x + w, s.y], [s.x + w, s.y + h], [s.x, s.y + h], [s.x, s.y]]; }
    if (s.t === 'arc') { const n = 40, out = []; for (let i = 0; i <= n; i++) { const g = s.a0 + (s.a1 - s.a0) * i / n; out.push([s.o[0] + s.r * Math.cos(g), s.o[1] + s.r * Math.sin(g)]); } return out; }
    if (s.t !== 'shape') return [];
    const [ax, ay] = s.a, [bx, by] = s.b;
    if (s.k === 'line' || s.k === 'arrow') return lerp(s.a, s.b, 20);
    if (s.k === 'curve') { const c = _curveCtrl(s), out = []; for (let i = 0; i <= 30; i++) { const t = i / 30, u = 1 - t; out.push([u * u * ax + 2 * u * t * c[0] + t * t * bx, u * u * ay + 2 * u * t * c[1] + t * t * by]); } return out; }
    if (s.k === 'circle') { const r = dist(s.a, s.b), out = []; for (let i = 0; i <= 48; i++) { const g = i / 48 * Math.PI * 2; out.push([ax + r * Math.cos(g), ay + r * Math.sin(g)]); } return out; }
    if (s.k === 'rect') return [[ax, ay], [bx, ay], [bx, by], [ax, by], [ax, ay]];
    if (s.k === 'tri') return [[(ax + bx) / 2, ay], [ax, by], [bx, by], [(ax + bx) / 2, ay]];
    if (s.k === 'axes') { const L = _axesLen(s); return [...lerp([ax - L, ay], [ax + L, ay], 20), ...lerp([ax, ay - L], [ax, ay + L], 20)]; }
    return [];
  }
  function segDist(p, a, b) { const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy; let t = L2 ? ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy)); }
  function hits(s, p, r) {
    if (s.t === 'fill') { const lx = Math.floor(p[0] - s.x), ly = Math.floor(p[1] - s.y); return lx >= 0 && ly >= 0 && lx < s.w && ly < s.h && s.md[ly * s.w + lx] > 0; }
    const P = samples(s); if (!P.length) return false;
    if (P.length === 1) return dist(P[0], p) < r + (s.w || 0) / 2;
    const rr = r + (s.w || 0) / 2;
    if (s.t === 'txt') { const xs = P.map(q => q[0]), ys = P.map(q => q[1]); return p[0] > Math.min(...xs) - r && p[0] < Math.max(...xs) + r && p[1] > Math.min(...ys) - r && p[1] < Math.max(...ys) + r; }
    for (let i = 1; i < P.length; i++) if (segDist(p, P[i - 1], P[i]) < rr) return true;
    return false;
  }

  // where a drawing now sits = its own coordinates through a matrix [a, b, c, d, e, f]
  // (canvas transform order) built from its moves / resizes / turns
  const M_ID = [1, 0, 0, 1, 0, 0];
  const mMul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
  const mApply = (M, q) => [M[0] * q[0] + M[2] * q[1] + M[4], M[1] * q[0] + M[3] * q[1] + M[5]];
  const mInv = M => { const det = M[0] * M[3] - M[1] * M[2], a = M[3] / det, b = -M[1] / det, c = -M[2] / det, d = M[0] / det; return [a, b, c, d, -(a * M[4] + c * M[5]), -(b * M[4] + d * M[5])]; };
  const mMove = (dx, dy) => [1, 0, 0, 1, dx, dy];
  // grow by f and turn by g (radians) around (cx, cy)
  const mAround = (cx, cy, f, g) => { const co = Math.cos(g) * f, si = Math.sin(g) * f; return [co, si, -si, co, cx - co * cx + si * cy, cy - si * cx - co * cy]; };

  // points every ~4 px along a drawing, where it sits now
  function _pts(D) {
    const P = samples(D.s), out = [];
    for (let i = 0; i < P.length; i++) {
      const q = mApply(D.m, P[i]);
      if (i) { const r = out[out.length - 1], n = Math.min(40, Math.floor(dist(r, q) / 4)); for (let k = 1; k < n; k++) out.push([r[0] + (q[0] - r[0]) * k / n, r[1] + (q[1] - r[1]) * k / n]); }
      out.push(q);
    }
    return out;
  }
  // the colour stops a few px short of the line's middle: look around the point
  function _inFill(F, q, r) {
    F.mi = F.mi || mInv(F.m);
    for (const dx of [-r, 0, r]) for (const dy of [-r, 0, r]) if (hits(F.s, mApply(F.mi, [q[0] + dx, q[1] + dy]), 0)) return true;
    return false;
  }
  // do two drawings touch? (a fill touches the lines it was filled against)
  function _joined(A, B) {
    const g = 6, ab = [A.b[0] - g, A.b[1] - g, A.b[2] + g, A.b[3] + g];
    if (!_meets(ab, B.b)) return false;
    const fa = A.s.t === 'fill', fb = B.s.t === 'fill';
    if (fa && fb) return false;
    if (A.s.t === 'txt' || B.s.t === 'txt') return true;
    if (fa || fb) { const F = fa ? A : B, L = fa ? B : A; const r = (L.s.w || 0) / 2 + 4; return _pts(L).some(q => _inFill(F, q, r)); }
    const pa = _pts(A), pb = _pts(B), lim = ((A.s.w || 0) + (B.s.w || 0)) / 2 + 4;
    for (const q of pa) for (let k = 1; k < pb.length; k++) if (segDist(q, pb[k - 1], pb[k]) < lim) return true;
    if (pb.length === 1) return pa.some(q => dist(q, pb[0]) < lim);
    return false;
  }

  // box around a stroke in its own coordinates: [x0, y0, x1, y1]
  function bbox(s) {
    if (s.t === 'fill') return [s.x, s.y, s.x + s.w, s.y + s.h];
    let pts, pad = (s.w || 0) / 2 + 3;
    if (s.t === 'cut') pts = s.poly;
    else if (s.t === 'er') pts = s.p;
    else if (s.t === 'shape' && s.k === 'axes') { const L = _axesLen(s) + 24; pts = [[s.a[0] - L, s.a[1] - L], [s.a[0] + L, s.a[1] + L]]; }
    else pts = samples(s);
    if (!pts?.length) return [0, 0, 0, 0];
    if (s.t === 'shape' && s.k === 'arrow') pad += 12 + s.w * 2;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of pts) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
  }
  // a box through a matrix -> the upright box around it
  const _boxAt = (b, M) => {
    const P = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].map(q => mApply(M, q)), xs = P.map(q => q[0]), ys = P.map(q => q[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  };
  const _meets = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  // 🎨 a filled area: an alpha mask (1 px = 1 CSS px) coloured on demand
  function fillCanvas(s, dark) {
    const k = dark ? 1 : 0, key = s.c + ':' + k;
    s._fc = s._fc || {};
    if (!s._fc[key]) {
      const c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
      const x = c.getContext('2d'); x.drawImage(s.mask, 0, 0);
      x.globalCompositeOperation = 'source-in'; x.fillStyle = PAL[s.c][k]; x.fillRect(0, 0, s.w, s.h);
      s._fc[key] = c;
    }
    return s._fc[key];
  }
  function drawAny(x, s, dark) {
    if (s.t === 'fill') { x.save(); x.globalAlpha = 0.85; x.drawImage(fillCanvas(s, dark), s.x, s.y); x.restore(); return; }
    drawStroke(x, s, dark);
  }
  // grow a 0/1 pixel map by r pixels (square), in two passes
  function dilate(src, W, H, r) {
    const tmp = new Uint8Array(W * H), out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      const row = y * W; let cnt = 0;
      for (let x = 0; x < Math.min(r, W); x++) cnt += src[row + x];
      for (let x = 0; x < W; x++) { if (x + r < W) cnt += src[row + x + r]; if (x - r - 1 >= 0) cnt -= src[row + x - r - 1]; tmp[row + x] = cnt > 0 ? 1 : 0; }
    }
    for (let x = 0; x < W; x++) {
      let cnt = 0;
      for (let y = 0; y < Math.min(r, H); y++) cnt += tmp[y * W + x];
      for (let y = 0; y < H; y++) { if (y + r < H) cnt += tmp[(y + r) * W + x]; if (y - r - 1 >= 0) cnt -= tmp[(y - r - 1) * W + x]; out[y * W + x] = cnt > 0 ? 1 : 0; }
    }
    return out;
  }

  // ── maths instruments (inside the board paper, so they scroll with it) ──
  const INST = { ruler: null, sq: null, pro: null };
  function instDef(k, paperW) {
    if (k === 'ruler') {
      const n = Math.max(5, Math.min(15, Math.floor((paperW - 70) / CM))), L = n * CM + 20;
      let t = '';
      for (let i = 0; i <= n * 10; i++) { const x = 10 + i * 4, h = i % 10 === 0 ? 18 : i % 5 === 0 ? 12 : 7; t += `<line x1="${x}" y1="0" x2="${x}" y2="${h}"/>`; if (i % 10 === 0) t += `<text x="${x}" y="32">${i / 10}</text>`; }
      return { piv: [10, 0], knob: [L - 16, 46], edges: [[[0, 0], [L, 0]]],
        svg: `<svg width="${L}" height="64"><rect width="${L}" height="64" rx="4" class="ib"/><g class="tk">${t}</g><text x="34" y="54" class="cmtx">cm</text><circle class="knob" cx="${L - 16}" cy="46" r="12"/><text x="${L - 16}" y="51" class="kn">⟳</text></svg>` };
    }
    if (k === 'sq') {
      const L = 280; let t = '';
      for (let i = 0; i <= 60; i++) { const v = 10 + i * 4, h = i % 10 === 0 ? 14 : i % 5 === 0 ? 9 : 5; t += `<line x1="${v}" y1="0" x2="${v}" y2="${h}"/><line x1="0" y1="${v}" x2="${h}" y2="${v}"/>`; if (i % 10 === 0 && i) t += `<text x="${v}" y="26">${i / 10}</text><text x="22" y="${v + 4}">${i / 10}</text>`; }
      return { piv: [0, 0], knob: [150, 60], edges: [[[0, 0], [L, 0]], [[0, 0], [0, L]], [[L, 0], [0, L]]],
        svg: `<svg width="${L}" height="${L}"><polygon points="0,0 ${L},0 0,${L}" class="ib sq"/><polygon points="58,58 ${L - 110},58 58,${L - 110}" fill="rgba(255,255,255,.25)" stroke="rgba(20,70,130,.4)"/><g class="tk">${t}</g><circle class="knob" cx="150" cy="60" r="12"/><text x="150" y="65" class="kn">⟳</text></svg>` };
    }
    const R = 170, cx = R + 10, cy = R + 10; let t = '';
    for (let d = 0; d <= 180; d++) {
      const g = d * Math.PI / 180, c = Math.cos(g), s = Math.sin(g), h = d % 10 === 0 ? 16 : d % 5 === 0 ? 10 : 5;
      t += `<line x1="${(cx + R * c).toFixed(1)}" y1="${(cy - R * s).toFixed(1)}" x2="${(cx + (R - h) * c).toFixed(1)}" y2="${(cy - (R - h) * s).toFixed(1)}"/>`;
      if (d % 10 === 0) t += `<text x="${(cx + (R - 28) * c).toFixed(1)}" y="${(cy - (R - 28) * s + 4).toFixed(1)}">${d}</text><text x="${(cx + (R - 46) * c).toFixed(1)}" y="${(cy - (R - 46) * s + 4).toFixed(1)}" style="font-size:9px;opacity:.7">${180 - d}</text>`;
    }
    return { piv: [cx, cy], knob: [2 * R - 4, cy + 18], edges: [[[10, cy], [2 * R + 10, cy]]],
      svg: `<svg width="${2 * R + 20}" height="${R + 40}"><path d="M10 ${cy} A${R} ${R} 0 0 1 ${2 * R + 10} ${cy} L${2 * R + 10} ${cy + 30} L10 ${cy + 30} Z" class="ib pro"/><g class="tk">${t}<line x1="${cx}" y1="${cy - 10}" x2="${cx}" y2="${cy + 10}"/><line x1="${cx - 10}" y1="${cy}" x2="${cx + 10}" y2="${cy}"/></g><circle class="knob" cx="${2 * R - 4}" cy="${cy + 18}" r="11"/><text x="${2 * R - 4}" y="${cy + 23}" class="kn">⟳</text></svg>` };
  }
  function instWorld(I, l) { const c = Math.cos(I.r), s = Math.sin(I.r), dx = l[0] - I.piv[0], dy = l[1] - I.piv[1]; return [I.x + c * dx - s * dy, I.y + s * dx + c * dy]; }
  function placeInst(I) { I.el.style.transform = `translate(${I.x}px,${I.y}px) rotate(${I.r}rad) translate(${-I.piv[0]}px,${-I.piv[1]}px)`; }
  function paperPt(e) { const r = $('pb-paper').getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function toggleInst(k) {
    if (INST[k]) { INST[k].el.remove(); INST[k] = null; return; }
    const sc = $('pb-scroll'), w = sc.clientWidth, vh = sc.clientHeight, top = sc.scrollTop;
    const I = instDef(k, w);
    Object.assign(I, k === 'ruler' ? { x: 40, y: top + vh * 0.7 } : k === 'sq' ? { x: Math.max(20, w - 320), y: top + 80 } : { x: Math.max(190, w * 0.45), y: top + vh * 0.5 }, { r: 0 });
    I.el = document.createElement('div'); I.el.className = 'pb-inst'; I.el.innerHTML = I.svg;
    $('pb-paper').appendChild(I.el); placeInst(I); INST[k] = I;
    I.el.addEventListener('pointerdown', e => {
      e.stopPropagation(); e.preventDefault();
      const knob = e.target.closest('.knob'), P0 = paperPt(e), st = { x: I.x, y: I.y };
      I.el.setPointerCapture(e.pointerId);
      const base = Math.atan2(I.knob[1] - I.piv[1], I.knob[0] - I.piv[0]);
      const mv = ev => {
        const p = paperPt(ev);
        if (knob) {
          let deg = (Math.atan2(p[1] - I.y, p[0] - I.x) - base) * 180 / Math.PI;
          deg = ((deg % 360) + 360) % 360;
          const near = Math.round(deg / 15) * 15; if (Math.abs(near - deg) < 2.5) deg = near;
          I.r = deg * Math.PI / 180; _toast(`Rotated: ${Math.round(deg) % 360}°`);
        } else { I.x = st.x + p[0] - P0[0]; I.y = st.y + p[1] - P0[1]; }
        placeInst(I);
      };
      const end = () => { I.el.removeEventListener('pointermove', mv); I.el.removeEventListener('pointerup', end); I.el.removeEventListener('pointercancel', end); };
      I.el.addEventListener('pointermove', mv); I.el.addEventListener('pointerup', end); I.el.addEventListener('pointercancel', end);
    });
  }
  function removeInsts() { for (const k of Object.keys(INST)) if (INST[k]) toggleInst(k); }
  // a pen stroke that starts next to a ruler / set-square / protractor edge is drawn straight along it
  function nearEdge(p) {
    let best = null, bd = 22;
    for (const I of Object.values(INST)) {
      if (!I) continue;
      for (const [la, lb] of I.edges) {
        const a = instWorld(I, la), b = instWorld(I, lb), vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy;
        const t = ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2;
        if (t < 0 || t > 1) continue;
        const d = Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy));
        if (d < bd) { bd = d; best = [a, b]; }
      }
    }
    return best;
  }
  function proj(p, [a, b]) { const vx = b[0] - a[0], vy = b[1] - a[1]; let t = ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy); t = Math.max(0, Math.min(1, t)); return [a[0] + t * vx, a[1] + t * vy, p[2] ?? 0.5]; }

  // ── a writing surface (the board, or the glass over the app) ──
  // strokes is an append-only log (so ↶ is just "drop the last record"):
  //   drawings — pen / hl / shape / arc / txt / fill
  //   'clr' wipes what came before, 'del' hides drawings, 'mv' moves drawings, 'xf' resizes /
  //   turns them (m = matrix), 'sty' changes colour / thickness / text size,
  //   'er' / 'cut' rub out; each one keeps the drawings it touched (tg: [index, matrix of that
  //   drawing then]), so a rubbed-out part moves, grows and turns with its figure.
  class Surface {
    constructor(scroller, paper, base, live, isBoard) {
      Object.assign(this, { scroller, paper, base, live, isBoard });
      this.strokes = []; this.redo = []; this.pages = 1; this.cur = null; this.laser = []; this.lp = null; this.cmp = null; this.edit = -1;
      this.sel = []; this.drag = null; this.dpr = 1;
      this._bind();
    }
    dark() { return this.isBoard ? S.dark : !document.body.classList.contains('theme-board-light'); }
    ctx(c) { return c.getContext('2d'); }
    size() {
      const w = this.scroller.clientWidth, vh = this.scroller.clientHeight;
      if (!w || !vh) return;
      const h = this.isBoard ? vh * this.pages : vh;
      this.paper.style.height = h + 'px';
      const d = this.dpr = Math.min(2, window.devicePixelRatio || 1);
      for (const c of [this.base, this.live]) { c.width = Math.round(w * d); c.height = Math.round(h * d); c.style.width = w + 'px'; c.style.height = h + 'px'; this.ctx(c).setTransform(d, 0, 0, d, 0, 0); }
      if (this.isBoard) {
        this.paper.querySelectorAll('.pb-pg').forEach(e => e.remove());
        for (let i = 1; i < this.pages; i++) { const g = document.createElement('div'); g.className = 'pb-pg'; g.style.top = (i * vh) + 'px'; g.innerHTML = `<span>Page ${i + 1}</span>`; this.paper.appendChild(g); }
      }
      this.redraw(); this.guide();
    }
    state() {
      let from = 0;
      this.strokes.forEach((s, i) => { if (s.t === 'clr') from = i + 1; });
      const gone = new Set(), mat = new Map(), sty = new Map(), ers = new Map(), vis = [];
      const by = (k, M) => mat.set(k, mMul(M, mat.get(k) || M_ID));
      for (let i = from; i < this.strokes.length; i++) {
        const s = this.strokes[i];
        if (s.t === 'del') s.ids.forEach(k => gone.add(k));
        else if (s.t === 'mv') s.ids.forEach(k => by(k, mMove(s.dx, s.dy)));
        else if (s.t === 'xf') s.ids.forEach(k => by(k, s.m));
        else if (s.t === 'sty') s.ch.forEach(([k, o]) => sty.set(k, { ...(sty.get(k) || {}), ...o }));
        else if (s.t === 'er' || s.t === 'cut') (s.tg || []).forEach(([k, m]) => { if (!ers.has(k)) ers.set(k, []); ers.get(k).push([s, m]); });
        else vis.push(i);
      }
      return { vis: vis.filter(i => !gone.has(i)), mat, sty, ers };
    }
    matOf(st, i) { return st.mat.get(i) || M_ID; }
    styled(st, i) { const o = st.sty.get(i), s = this.strokes[i]; return o ? { ...s, ...o } : s; }
    // fills first (they sit under the lines), then the rest in the order drawn
    render(x, opt = {}) {
      const st = opt.st || this.state(), dark = this.dark();
      const order = [...st.vis.filter(i => this.strokes[i].t === 'fill'), ...st.vis.filter(i => this.strokes[i].t !== 'fill')];
      for (const i of order) {
        if (opt.skip?.has(i) || (opt.only && !opt.only.has(i))) continue;
        const s = this.styled(st, i);
        if (opt.noFill && s.t === 'fill') continue;
        const M = opt.dx || opt.dy ? mMul(mMove(opt.dx || 0, opt.dy || 0), this.matOf(st, i)) : this.matOf(st, i);
        const el = st.ers.get(i);
        if (!el) { x.save(); x.transform(...M); drawAny(x, s, dark); x.restore(); continue; }
        const b = bbox(s), w = Math.ceil(b[2] - b[0]) + 2, h = Math.ceil(b[3] - b[1]) + 2;
        if (w <= 2 || h <= 2) continue;
        const d = this.dpr, sc = this._scratch || (this._scratch = document.createElement('canvas'));
        sc.width = Math.ceil(w * d); sc.height = Math.ceil(h * d);
        const y = sc.getContext('2d'); y.setTransform(d, 0, 0, d, 0, 0); y.translate(-b[0], -b[1]);
        drawAny(y, s, dark);
        for (const [e, m] of el) { y.save(); y.transform(...mInv(m)); drawStroke(y, e, dark); y.restore(); }
        x.save(); x.transform(...M); x.drawImage(sc, b[0], b[1], w, h); x.restore();
      }
    }
    redraw(opt) { const x = this.ctx(this.base); x.clearRect(0, 0, 1e5, 1e5); this.render(x, opt); }
    visible() { return this.state().vis; }
    hasInk() { return this.visible().length > 0; }
    clearLive() { this.ctx(this.live).clearRect(0, 0, 1e5, 1e5); }
    _reset() { this.edit = -1; this.sel = []; this.drag = null; this.cmp = null; }
    // records pushed together (a ⧉ copy) share a grp and go back / come back as one step
    undo() {
      if (!this.strokes.length) { _toast('Nothing to undo'); return; }
      const step = [this.strokes.pop()], g = step[0].grp;
      while (g && this.strokes.length && this.strokes[this.strokes.length - 1].grp === g) step.unshift(this.strokes.pop());
      this.redo.push(step); this._reset(); this.redraw(); this.clearLive(); this.guide(); _changed(); _selBar();
    }
    redoOne() { if (!this.redo.length) return; this.strokes.push(...this.redo.pop()); this._reset(); this.redraw(); this.clearLive(); this.guide(); _changed(); _selBar(); }
    clear() { if (!this.hasInk()) return; this.strokes.push({ t: 'clr' }); this.redo = []; this._reset(); this.redraw(); this.clearLive(); _changed(); _selBar(); _toast('Board cleared — ↶ brings it back'); }
    push(s) { this.strokes.push(s); this.redo = []; _changed(); }
    commit(s) { this.push(s); if (s.t === 'fill') this.redraw(); else drawAny(this.ctx(this.base), s, this.dark()); }
    // a rub-out keeps every drawing whose box it meets
    _rubOut(e) {
      const st = this.state(), eb = bbox(e);
      e.tg = st.vis.filter(i => _meets(_boxAt(bbox(this.strokes[i]), this.matOf(st, i)), eb)).map(i => [i, this.matOf(st, i)]);
      this.push(e); this.redraw();
    }
    // ── 👆 select / move ──
    selBox(st = this.state()) {
      let b = null;
      for (const i of this.sel) { const q = _boxAt(bbox(this.strokes[i]), this.matOf(st, i)); b = b ? [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[2]), Math.max(b[3], q[3])] : q; }
      return b;
    }
    // the whole figure under the finger: every drawing joined to it — lines that touch,
    // colour filled between them — so a coloured figure moves as one piece
    _pick(p) {
      const st = this.state();
      const hit = [...st.vis].reverse().find(i => hits(this.strokes[i], mApply(mInv(this.matOf(st, i)), p), 10));
      if (hit == null) return [];
      const info = new Map(st.vis.map(i => { const s = this.strokes[i], m = this.matOf(st, i); return [i, { s, m, b: _boxAt(bbox(s), m) }]; }));
      const out = new Set([hit]), todo = [hit];
      while (todo.length) {
        const i = todo.pop(), A = info.get(i);
        for (const [j, B] of info) if (!out.has(j) && _joined(A, B)) { out.add(j); todo.push(j); }
      }
      return [...out].sort((a, b) => a - b);
    }
    _dragStart(p) {
      this.drag = { p0: p, dx: 0, dy: 0, set: new Set(this.sel) };
      this.redraw({ skip: this.drag.set });
      this._dragPaint();
    }
    _dragPaint() {
      const dg = this.drag; this.clearLive();
      const x = this.ctx(this.live); this.render(x, { only: dg.set, dx: dg.dx, dy: dg.dy });
      const b = this.selBox(); if (b) this._selRect(x, [b[0] + dg.dx, b[1] + dg.dy, b[2] + dg.dx, b[3] + dg.dy]);
    }
    _selRect(x, b, note) {
      x.save(); x.setLineDash([6, 5]); x.strokeStyle = '#3b6cff'; x.lineWidth = 1.5;
      x.strokeRect(b[0] - 4, b[1] - 4, b[2] - b[0] + 8, b[3] - b[1] + 8); x.restore();
      if (note) label(x, note, [b[0] - 18, b[1] + 6]);
    }
    // ➕ ➖ ⟲ ⟳ around the middle of the selection
    transformSel(f, deg) {
      if (!this.sel.length) return;
      const b = this.selBox(), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      this.push({ t: 'xf', ids: [...this.sel], m: mAround(cx, cy, f, deg * Math.PI / 180) });
      this.redraw(); this.clearLive(); this.guide();
    }
    // a colour / thickness tapped while something is selected changes it
    styleSel(o) {
      if (!this.sel.length) return;
      const ch = [];
      for (const i of this.sel) {
        const t = this.strokes[i].t;
        if ('c' in o && t !== 'hl') ch.push([i, { c: o.c }]);
        if ('w' in o) {
          if (t === 'txt') ch.push([i, { fs: [18, 26, 38][o.w] }]);
          else if (t === 'hl') ch.push([i, { w: WID[o.w] * 4 }]);
          else if (t !== 'fill') ch.push([i, { w: WID[o.w] }]);
        }
      }
      if (!ch.length) return;
      this.push({ t: 'sty', ch });
      this.redraw(); this.clearLive(); this.guide();
    }
    deleteSel() { if (!this.sel.length) return; this.push({ t: 'del', ids: [...this.sel] }); this.sel = []; this.cmp = null; this.redraw(); this.clearLive(); this.guide(); }
    copySel() {
      if (!this.sel.length) return;
      const st = this.state(), made = [], grp = 'c' + Date.now();
      for (const i of this.sel) {
        this.strokes.push({ ...this.strokes[i], grp }); const k = this.strokes.length - 1; made.push(k);
        this.strokes.push({ t: 'xf', ids: [k], m: mMul(mMove(24, 24), this.matOf(st, i)), grp });
        if (st.sty.has(i)) this.strokes.push({ t: 'sty', ch: [[k, st.sty.get(i)]], grp });
        // the rubbed-out bits go along with the copy
        for (const [e, m] of st.ers.get(i) || []) this.strokes.push({ ...e, tg: [[k, m]], grp });
      }
      this.redo = []; _changed();
      this.sel = made; this.redraw(); this.clearLive(); this.guide();
      _toast('⧉ Copy made — drag it where you want');
    }
    // ── 🎨 fill the closed area under the finger (lines with gaps up to ~4 px still hold) ──
    // only the part of the board on screen is searched, so a board with many pages fills as fast as one
    _fillAt(p) {
      const W = Math.round(parseFloat(this.base.style.width)), full = Math.round(parseFloat(this.base.style.height));
      const top = this.isBoard ? Math.max(0, Math.floor(this.scroller.scrollTop)) : 0;
      const H = Math.min(full - top, Math.round(this.scroller.clientHeight) || full);
      const sx = Math.floor(p[0]), sy = Math.floor(p[1]) - top;
      if (!W || H <= 0 || sx < 0 || sy < 0 || sx >= W || sy >= H) return;
      const ink = document.createElement('canvas'); ink.width = W; ink.height = H;
      const ix = ink.getContext('2d'); ix.translate(0, -top);
      this.render(ix, { noFill: true });
      const a = ink.getContext('2d').getImageData(0, 0, W, H).data, N = W * H;
      let wall = new Uint8Array(N);
      for (let i = 0; i < N; i++) wall[i] = a[i * 4 + 3] > 60 ? 1 : 0;
      wall = dilate(wall, W, H, 2);
      if (wall[sy * W + sx]) { _toast('🎨 Tap the empty space inside a shape, not on a line'); return; }
      const reg = new Uint8Array(N), stack = [sx, sy];
      let x0 = sx, x1 = sx, y0 = sy, y1 = sy, count = 0, edge = false;
      const free = i => !wall[i] && !reg[i];
      while (stack.length) {
        const y = stack.pop(); let x = stack.pop();
        while (x > 0 && free(y * W + x - 1)) x--;
        let up = false, dn = false;
        for (; x < W && free(y * W + x); x++) {
          reg[y * W + x] = 1; count++;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          if (x === 0 || x === W - 1 || y === 0 || y === H - 1) edge = true;
          if (y > 0) { const f = free((y - 1) * W + x); if (f && !up) { stack.push(x, y - 1); up = true; } else if (!f) up = false; }
          if (y < H - 1) { const f = free((y + 1) * W + x); if (f && !dn) { stack.push(x, y + 1); dn = true; } else if (!f) dn = false; }
        }
      }
      if (edge && count > N * 0.35) { _toast('🎨 This area is not closed — close the shape first'); return; }
      // grow it a little so the colour reaches under the lines (no white rim)
      const pad = 4, bx = Math.max(0, x0 - pad), by = Math.max(0, y0 - pad), bw = Math.min(W, x1 + pad + 1) - bx, bh = Math.min(H, y1 + pad + 1) - by;
      const sub = new Uint8Array(bw * bh);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) sub[y * bw + x] = reg[(y + by) * W + x + bx];
      const md = dilate(sub, bw, bh, 3);
      const mask = document.createElement('canvas'); mask.width = bw; mask.height = bh;
      const mx = mask.getContext('2d'), im = mx.createImageData(bw, bh);
      for (let i = 0; i < md.length; i++) if (md[i]) { im.data[i * 4 + 3] = 255; }
      mx.putImageData(im, 0, 0);
      this.commit({ t: 'fill', c: S.c, x: bx, y: by + top, w: bw, h: bh, mask, md, _fc: {} });
    }
    // compass once set (faint circle + radius), the bend handle of a curve line, the selection
    guide() {
      const x = this.ctx(this.live);
      if (S.tool === 'compass' && this.cmp) {
        const { o, r } = this.cmp;
        x.save(); x.setLineDash([6, 6]); x.strokeStyle = 'rgba(59,108,255,.55)'; x.lineWidth = 1.5;
        x.beginPath(); x.arc(o[0], o[1], r, 0, Math.PI * 2); x.stroke();
        x.beginPath(); x.moveTo(o[0], o[1]); x.lineTo(o[0] + r, o[1]); x.stroke(); x.setLineDash([]);
        x.fillStyle = '#3b6cff'; x.beginPath(); x.arc(o[0], o[1], 4, 0, 7); x.fill(); x.restore();
        label(x, 'r = ' + cmTxt(r), [o[0] + r / 2 - 30, o[1]]);
      }
      const e = this.strokes[this.edit];
      if (S.tool === 'shape' && e && e.k === 'curve') {
        x.save(); x.fillStyle = '#ffb300'; x.strokeStyle = '#1d1400'; x.lineWidth = 2;
        x.beginPath(); x.arc(e.h[0], e.h[1], 11, 0, 7); x.fill(); x.stroke(); x.restore();
        label(x, 'Drag the yellow dot to bend', e.h);
      }
      if (S.tool === 'sel' && this.sel.length && !this.drag) { const b = this.selBox(); if (b) this._selRect(x, b, 'Press inside and drag to move'); }
    }
    _pt(e) { const r = this.paper.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5]; }
    _text(p) {
      const inp = document.createElement('textarea'), fs = [18, 26, 38][S.w], dark = this.dark();
      inp.className = 'pb-txin'; inp.style.left = p[0] + 'px'; inp.style.top = (p[1] - fs * 0.6) + 'px';
      inp.style.fontSize = fs + 'px'; inp.style.color = PAL[S.c][dark ? 1 : 0]; inp.rows = 1;
      inp.placeholder = 'Type here…';
      this.paper.appendChild(inp); inp.focus();
      const done = () => { const v = inp.value.trim(); inp.remove(); if (v) this.commit({ t: 'txt', x: p[0], y: p[1] - fs * 0.6 + 1, s: v, c: S.c, fs }); };
      inp.addEventListener('blur', done, { once: true });
      inp.addEventListener('input', () => { inp.rows = Math.max(1, inp.value.split('\n').length); });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); inp.blur(); } if (e.key === 'Escape') { inp.value = ''; inp.blur(); } });
    }
    _wipeAt(p) {
      const r = WID[S.w] * 2.5, del = this.cur, st = this.state();
      let any = false;
      for (const i of st.vis) { if (!del.ids.includes(i) && hits(this.strokes[i], mApply(mInv(this.matOf(st, i)), p), r)) { del.ids.push(i); any = true; } }
      if (any) { if (!del.pushed) { this.strokes.push(del); del.pushed = true; this.redo = []; } this.redraw(); }
    }
    _bind() {
      const L = this.live;
      L.addEventListener('pointerdown', e => {
        if (e.pointerType === 'pen' && !penSeen) { penSeen = true; _toast('Stylus found: while drawing, a finger only scrolls'); }
        _closeSub();
        // with a stylus in use a resting hand must not draw, so a finger scrolls — but a finger still
        // selects / moves figures and fills colour
        if (S.tool === 'hand' || (penSeen && e.pointerType === 'touch' && S.tool !== 'sel' && S.tool !== 'fill')) { L.setPointerCapture(e.pointerId); this.pan = { y: e.clientY, st: this.scroller.scrollTop }; return; }
        e.preventDefault();
        const p = this._pt(e);
        if (S.tool === 'txt') { this._text(p); return; }
        if (S.tool === 'fill') { this._fillAt(p); return; }
        L.setPointerCapture(e.pointerId);
        if (S.tool === 'laser') { this.laserOn = true; this.lp = p; this.laser.push([p[0], p[1], performance.now()]); this._laserLoop(); return; }
        if (S.tool === 'sel') {
          const b = this.sel.length && this.selBox();
          if (b && p[0] > b[0] - 10 && p[0] < b[2] + 10 && p[1] > b[1] - 10 && p[1] < b[3] + 10) { this._dragStart(p); return; }
          this.sel = this._pick(p);
          if (this.sel.length) { this._dragStart(p); return; }
          this.cur = { t: 'band', a: p, b: p }; this._paint(); return;
        }
        const ed = this.strokes[this.edit];
        if (S.tool === 'shape' && ed && ed.k === 'curve' && dist(p, ed.h) < 22) { this.bend = ed; return; }
        this.edit = -1;
        if (S.tool === 'compass') {
          // press on the ring = draw the arc; at the centre = a new radius; anywhere else = put the
          // compass there (drag = new radius, a plain tap = same radius at the new centre)
          const c = this.cmp, onRing = c && Math.abs(dist(p, c.o) - c.r) < Math.max(28, c.r * 0.25);
          if (onRing && dist(p, c.o) >= 16) { const g = Math.atan2(p[1] - c.o[1], p[0] - c.o[0]); this.cur = { t: 'arc', o: c.o, r: c.r, a0: g, a1: g, last: g, c: S.c, w: WID[S.w] }; }
          else this.cur = { t: 'cset', o: p, b: p, keep: c && dist(p, c.o) >= 16 ? c.r : 0 };
          this._paint(); return;
        }
        if (S.tool === 'shape') { this.cur = { t: 'shape', k: S.shape, a: p, b: p, c: S.c, w: WID[S.w] }; this._paint(); return; }
        if (S.tool === 'er' && S.er === 'stroke') { this.cur = { t: 'del', ids: [] }; this._wipeAt(p); this._cursor(p); return; }
        if (S.tool === 'er' && (S.er === 'rect' || S.er === 'lasso')) { this.cur = { t: 'sel', k: S.er, a: p, b: p, p: [p] }; this._paint(); return; }
        this.cur = { t: S.tool, c: S.tool === 'hl' ? S.h : S.c, w: S.tool === 'er' ? WID[S.w] * 5 : S.tool === 'hl' ? WID[S.w] * 4 : WID[S.w], pr: e.pointerType === 'pen', p: [p] };
        if (this.isBoard && (S.tool === 'pen' || S.tool === 'hl')) { const edge = nearEdge(p); if (edge) { this.cur.snap = edge; this.cur.p = [proj(p, edge)]; } }
        this._paint();
      });
      L.addEventListener('pointermove', e => {
        if (this.pan) { this.scroller.scrollTop = this.pan.st - (e.clientY - this.pan.y); return; }
        const p = this._pt(e);
        if (this.laserOn) { this.lp = p; this.laser.push([p[0], p[1], performance.now()]); return; }
        if (this.bend) { this.bend.h = [p[0], p[1]]; this.redraw(); this.clearLive(); this.guide(); return; }
        if (this.drag) { this.drag.dx = p[0] - this.drag.p0[0]; this.drag.dy = p[1] - this.drag.p0[1]; this._dragPaint(); return; }
        const s = this.cur;
        if (!s) { if (S.tool === 'er' && e.pointerType !== 'touch') this._cursor(p); return; }
        if (s.t === 'del') { this._wipeAt(p); this._cursor(p); return; }
        if (s.t === 'cset' || s.t === 'shape' || s.t === 'band') s.b = p;
        else if (s.t === 'sel') { s.b = p; s.p.push(p); }
        else if (s.t === 'arc') { const g = Math.atan2(p[1] - s.o[1], p[0] - s.o[0]); let d = g - s.last; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; s.a1 += d; s.last = g; }
        else if (s.snap) s.p = [s.p[0], proj(p, s.snap)];
        else { const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : []; for (const ce of (evs.length ? evs : [e])) s.p.push(this._pt(ce)); }
        this._paint();
      });
      const up = () => {
        if (this.pan) { this.pan = null; return; }
        if (this.bend) { this.bend = null; this.redo = []; _changed(); return; }
        if (this.drag) {
          const { dx, dy } = this.drag; this.drag = null;
          if (Math.abs(dx) + Math.abs(dy) > 1) this.push({ t: 'mv', ids: [...this.sel], dx, dy });
          this.redraw(); this.clearLive(); this.guide(); _selBar(); return;
        }
        this.laserOn = false;
        const s = this.cur; if (!s) return; this.cur = null;
        this.clearLive();
        if (s.t === 'band') {
          const bx = [Math.min(s.a[0], s.b[0]), Math.min(s.a[1], s.b[1]), Math.max(s.a[0], s.b[0]), Math.max(s.a[1], s.b[1])], st = this.state();
          this.sel = st.vis.filter(i => { const q = _boxAt(bbox(this.strokes[i]), this.matOf(st, i)), cx = (q[0] + q[2]) / 2, cy = (q[1] + q[3]) / 2; return cx > bx[0] && cx < bx[2] && cy > bx[1] && cy < bx[3]; });
          if (!this.sel.length) _toast('👆 Tap a figure, or drag a box around it');
          this.guide(); _selBar(); return;
        }
        if (s.t === 'cset') {
          const r = dist(s.o, s.b);
          if (r > 8) { this.cmp = { o: s.o, r }; _toast(`Radius ${cmTxt(r)} set — now press on the dotted ring and turn`); }
          else if (s.keep) { this.cmp = { o: s.o, r: s.keep }; _toast(`Compass moved (radius ${cmTxt(s.keep)}) — press on the dotted ring and turn`); }
          else _toast('Compass: press the centre and drag out');
          this.guide(); return;
        }
        if (s.t === 'del') { if (s.pushed) { delete s.pushed; _changed(); } return; }
        if (s.t === 'sel') {
          const poly = s.k === 'rect' ? [[s.a[0], s.a[1]], [s.b[0], s.a[1]], [s.b[0], s.b[1]], [s.a[0], s.b[1]]] : s.p.map(q => [q[0], q[1]]);
          const xs = poly.map(q => q[0]), ys = poly.map(q => q[1]);
          if (Math.max(...xs) - Math.min(...xs) < 6 || Math.max(...ys) - Math.min(...ys) < 6) return;
          this._rubOut({ t: 'cut', poly }); return;
        }
        if (s.t === 'shape' && dist(s.a, s.b) < 4) { this.guide(); return; }
        if (s.t === 'arc' && Math.abs(s.a1 - s.a0) < 0.02) { this.guide(); return; }
        if (s.t === 'er') { this._rubOut(s); return; }
        if (s.t === 'shape' && s.k === 'curve') { s.h = [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2]; this.commit(s); this.edit = this.strokes.length - 1; this.guide(); return; }
        this.commit(s); this.guide();
      };
      L.addEventListener('pointerup', up); L.addEventListener('pointercancel', up);
      L.addEventListener('pointerleave', () => { if (S.tool === 'er' && !this.cur) { this.clearLive(); this.guide(); } });
    }
    _paint() {
      const s = this.cur, dark = this.dark();
      if (s.t === 'er') { const n = s.p.length; drawStroke(this.ctx(this.base), { ...s, p: s.p.slice(Math.max(0, n - 2)) }, dark); this._cursor(s.p[n - 1]); return; }
      this.clearLive();
      const x = this.ctx(this.live);
      if (s.t === 'band') {
        x.save(); x.setLineDash([6, 5]); x.strokeStyle = '#3b6cff'; x.lineWidth = 1.5; x.fillStyle = 'rgba(59,108,255,.08)';
        x.beginPath(); x.rect(Math.min(s.a[0], s.b[0]), Math.min(s.a[1], s.b[1]), Math.abs(s.b[0] - s.a[0]), Math.abs(s.b[1] - s.a[1])); x.fill(); x.stroke(); x.restore(); return;
      }
      if (s.t === 'sel') {
        x.save(); x.setLineDash([7, 5]); x.strokeStyle = '#e53935'; x.lineWidth = 2; x.fillStyle = 'rgba(229,57,53,.12)';
        x.beginPath();
        if (s.k === 'rect') x.rect(Math.min(s.a[0], s.b[0]), Math.min(s.a[1], s.b[1]), Math.abs(s.b[0] - s.a[0]), Math.abs(s.b[1] - s.a[1]));
        else { s.p.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.closePath(); }
        x.fill(); x.stroke(); x.restore(); return;
      }
      if (s.t === 'cset') {
        const r = dist(s.o, s.b);
        x.save(); x.setLineDash([6, 6]); x.strokeStyle = 'rgba(59,108,255,.7)'; x.lineWidth = 1.5;
        x.beginPath(); x.arc(s.o[0], s.o[1], r, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
        x.beginPath(); x.moveTo(s.o[0], s.o[1]); x.lineTo(s.b[0], s.b[1]); x.stroke();
        x.fillStyle = '#3b6cff'; x.beginPath(); x.arc(s.o[0], s.o[1], 4, 0, 7); x.fill(); x.restore();
        label(x, 'Radius ' + cmTxt(r), s.b); return;
      }
      this.guide();
      if (s.t === 'shape' && s.k === 'curve') drawStroke(x, { ...s, h: [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2] }, dark);
      else drawStroke(x, s, dark);
      if (s.t === 'shape') {
        const d = dist(s.a, s.b);
        const t = s.k === 'circle' ? 'r = ' + cmTxt(d) : s.k === 'rect' ? `${cmTxt(Math.abs(s.b[0] - s.a[0]))} × ${cmTxt(Math.abs(s.b[1] - s.a[1]))}` : s.k === 'tri' || s.k === 'axes' ? '' : cmTxt(d) + `, ${Math.round((360 - Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]) * 180 / Math.PI) % 360)}°`;
        if (t) label(x, t, s.b);
      }
      if (s.snap && s.p.length > 1) label(x, cmTxt(dist(s.p[0], s.p[1])), s.p[1]);
    }
    _cursor(p) { this.clearLive(); this.guide(); const x = this.ctx(this.live); x.beginPath(); x.arc(p[0], p[1], WID[S.w] * 2.5, 0, 7); x.strokeStyle = S.er === 'stroke' ? 'rgba(229,57,53,.9)' : 'rgba(128,128,128,.9)'; x.lineWidth = 1.5; x.stroke(); }
    _laserLoop() {
      if (this._lz) return; this._lz = true;
      const step = () => {
        const now = performance.now();
        if (this.laserOn && this.lp) this.laser.push([this.lp[0], this.lp[1], now]);
        this.laser = this.laser.filter(q => now - q[2] < 900);
        this.clearLive();
        const x = this.ctx(this.live); x.save(); x.lineCap = 'round'; x.strokeStyle = '#ff2d2d'; x.shadowColor = '#ff2d2d'; x.shadowBlur = 12;
        for (let i = 1; i < this.laser.length; i++) { const a = this.laser[i - 1], b = this.laser[i], age = (now - b[2]) / 900; x.globalAlpha = 1 - age; x.lineWidth = 6 * (1 - age) + 1; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
        if (this.laserOn && this.lp) { x.globalAlpha = 1; x.shadowBlur = 16; x.fillStyle = '#fff'; x.beginPath(); x.arc(this.lp[0], this.lp[1], 4, 0, 7); x.fill(); }
        x.restore();
        if (this.laser.length || this.laserOn) requestAnimationFrame(step); else { this._lz = false; this.clearLive(); }
      };
      requestAnimationFrame(step);
    }
  }

  // ── UI ─────────────────────────────────────────────────
  const CSS = `
#pb-fab[hidden],#pb-fabmenu[hidden],#pb-root[hidden],#pb-root [hidden]{display:none!important}
#pb-fab{position:fixed;right:max(18px,env(safe-area-inset-right,0px));bottom:calc(96px + env(safe-area-inset-bottom,0px));z-index:900;width:64px;height:64px;border-radius:50%;border:0;cursor:pointer;font-size:1.7rem;background:#ffb300;color:#1d1400;box-shadow:0 10px 26px rgba(0,0,0,.4)}
#pb-fabmenu{position:fixed;right:max(18px,env(safe-area-inset-right,0px));bottom:calc(170px + env(safe-area-inset-bottom,0px));z-index:901;display:grid;gap:8px;min-width:260px;padding:10px;border-radius:16px;background:#161c2a;border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 40px rgba(0,0,0,.45);color:#eef3ff;font-size:16px}
#pb-fabmenu .hd{font-size:.8rem;opacity:.7;padding:0 4px}
#pb-fabmenu button{font:inherit;text-align:left;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:inherit;cursor:pointer}
#pb-root{position:fixed;inset:0;z-index:9800;font-size:16px;line-height:1.45;user-select:none;-webkit-user-select:none}
#pb-root canvas{position:absolute;left:0;top:0;display:block}
#pb-root .pb-live{touch-action:none;cursor:crosshair}
#pb-root.pb-hand .pb-live{cursor:grab}
#pb-ov{position:absolute;inset:0;box-shadow:inset 0 0 0 3px #ffb300}
#pb-ovpaper{position:absolute;inset:0}
.pb-ovbar{position:absolute;top:calc(8px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);z-index:3;display:flex;gap:8px;align-items:center;padding:5px 6px 5px 12px;border-radius:99px;background:#ffb300;color:#1d1400;font-weight:700;font-size:.85rem;white-space:nowrap;max-width:calc(100% - 20px)}
.pb-ovbar span{overflow:hidden;text-overflow:ellipsis}
.pb-ovbar button{font:inherit;border:0;border-radius:99px;padding:4px 12px;background:#1d1400;color:#ffb300;cursor:pointer}
.pb-txin{position:absolute;z-index:3;min-width:180px;min-height:1.6em;resize:none;border:1.5px dashed #3b6cff;border-radius:6px;background:rgba(59,108,255,.06);font-family:Mukta,"Nirmala UI",sans-serif;font-weight:600;line-height:1.25;padding:0 4px;outline:none;user-select:text;-webkit-user-select:text}
#pb-bd{position:absolute;inset:0;background:#fbfcfd;color:#17202c;--rl:rgba(40,80,140,.16);--gb:rgba(20,130,90,.38);--gf:rgba(20,130,90,.13)}
#pb-bd.black{background:radial-gradient(ellipse at 50% 40%,#25302b,#19211e 70%,#141a17);color:#eef2ea;--rl:rgba(255,255,255,.1);--gb:rgba(150,235,195,.3);--gf:rgba(150,235,195,.09)}
.pb-top{position:absolute;top:0;left:0;right:0;z-index:5;display:flex;gap:6px;align-items:center;padding:calc(8px + env(safe-area-inset-top,0px)) max(10px,env(safe-area-inset-right,0px)) 8px max(10px,env(safe-area-inset-left,0px));overflow-x:auto;white-space:nowrap;background:rgba(240,243,248,.94);border-bottom:1px solid #dde3ec}
#pb-bd.black .pb-top{background:rgba(10,14,12,.65);border-color:rgba(255,255,255,.1)}
.pb-top button{font:inherit;font-size:.95rem;border-radius:10px;padding:6px 12px;cursor:pointer;border:1px solid #cfd7e3;background:#fff;color:#17202c;flex:none}
#pb-bd.black .pb-top button{border-color:rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#eef2ea}
.pb-top button:disabled{opacity:.4;cursor:default}
.pb-top .sp{flex:1 0 8px}
.pb-top .qn{font-weight:700;font-size:.95rem;padding:0 4px;flex:none}
.pb-top .pb-x{font-weight:700}
#pb-scroll{position:absolute;top:calc(52px + env(safe-area-inset-top,0px));left:0;right:0;bottom:0;overflow-y:auto;overflow-x:hidden}
#pb-paper{position:relative;width:100%;overflow:hidden}
#pb-paper.bg-ruled{background-image:repeating-linear-gradient(to bottom,transparent 0 39px,var(--rl) 39px 40px)}
#pb-paper.bg-grid{background-image:linear-gradient(var(--rl) 1px,transparent 1px),linear-gradient(90deg,var(--rl) 1px,transparent 1px);background-size:32px 32px}
#pb-paper.bg-graph{background-image:linear-gradient(var(--gb) 1px,transparent 1px),linear-gradient(90deg,var(--gb) 1px,transparent 1px),linear-gradient(var(--gf) 1px,transparent 1px),linear-gradient(90deg,var(--gf) 1px,transparent 1px);background-size:40px 40px,40px 40px,8px 8px,8px 8px}
.pb-pg{position:absolute;left:0;right:0;border-top:2px dashed rgba(120,130,150,.35);pointer-events:none}
.pb-pg span{position:absolute;right:10px;top:4px;font-size:.75rem;opacity:.55}
.pb-inst{position:absolute;left:0;top:0;transform-origin:0 0;z-index:2;touch-action:none;cursor:move;filter:drop-shadow(0 4px 10px rgba(0,0,0,.18))}
.pb-inst svg{display:block;overflow:visible}
.pb-inst .ib{fill:rgba(255,224,110,.6);stroke:rgba(120,90,0,.65);stroke-width:1}
.pb-inst .ib.sq{fill:rgba(120,190,255,.42);stroke:rgba(20,70,130,.65)}
.pb-inst .ib.pro{fill:rgba(255,255,255,.62);stroke:rgba(20,40,70,.6)}
.pb-inst .tk line{stroke:#2b2410;stroke-width:1}
.pb-inst .tk text,.pb-inst .cmtx{fill:#2b2410;font:600 11px Mukta,sans-serif;text-anchor:middle}
.pb-inst .knob{fill:#3b6cff;cursor:grab}
.pb-inst .kn{fill:#fff;font:700 13px sans-serif;text-anchor:middle;pointer-events:none}
#pb-q{position:absolute;z-index:4;left:14px;top:calc(66px + env(safe-area-inset-top,0px));width:min(440px,calc(100% - 28px));border-radius:14px;background:#fff;border:1px solid #d9e0ea;box-shadow:0 10px 30px rgba(20,40,80,.14);color:#17202c}
#pb-bd.black #pb-q{background:rgba(22,30,27,.9);border-color:rgba(255,255,255,.18);color:#eef2ea;box-shadow:0 10px 30px rgba(0,0,0,.35)}
.pb-qh{display:flex;align-items:center;gap:4px;padding:6px 6px 6px 12px;border-bottom:1px solid rgba(128,140,160,.25);cursor:move;touch-action:none}
.pb-qh b{font-size:.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pb-qh .grow{flex:1}
.pb-qh button{font:inherit;font-size:.8rem;border:0;background:rgba(128,140,160,.14);color:inherit;border-radius:8px;padding:3px 9px;cursor:pointer;flex:none}
.pb-qb{padding:10px 14px 12px;max-height:48vh;overflow:auto}
.pb-qb img{max-width:100%;height:auto;border-radius:8px}
#pb-q.wide{width:min(820px,calc(100% - 28px))}
#pb-q.wide .pb-qb{max-height:68vh}
.pb-qtext *:not(img):not(svg):not(path){color:inherit!important;background:transparent!important;border-color:rgba(128,140,160,.35)!important;box-shadow:none!important}
.pb-qtext h1,.pb-qtext h2,.pb-qtext h3,.pb-qtext h4{font-size:1.15em;margin:.3em 0}
.pb-qtext ul,.pb-qtext ol{padding-left:1.3em;margin:.3em 0}
.pb-qtext table{border-collapse:collapse}.pb-qtext td,.pb-qtext th{border:1px solid rgba(128,140,160,.45);padding:3px 6px}
.pb-qb .cm-marks-chip{font-size:.75em}
.pb-qo{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:4px}
.pb-qo li{padding:4px 8px;border-radius:8px;border:1px solid rgba(128,140,160,.25)}
.pb-qo li.ok{background:rgba(46,204,113,.2);border-color:#2ecc71}
.pb-qo .option-media img{max-height:90px}
.pb-ans{font:inherit;margin-top:10px;border-radius:10px;padding:6px 12px;cursor:pointer;border:1px solid #2ecc71;background:rgba(46,204,113,.12);color:inherit;font-weight:700}
.pb-a{margin-top:8px;padding:8px 10px;border-radius:10px;background:rgba(46,204,113,.12)}
.pb-a .hidden{display:block!important}
.pb-ex{margin-top:6px;font-size:.94em}
#pb-chip{position:absolute;z-index:4;left:14px;top:calc(64px + env(safe-area-inset-top,0px));font:inherit;font-weight:700;border-radius:99px;padding:6px 14px;border:1px solid #cfd7e3;background:#fff;color:#17202c;cursor:pointer}
#pb-bd.black #pb-chip{background:rgba(22,30,27,.9);border-color:rgba(255,255,255,.2);color:#eef2ea}
#pb-tools{position:absolute;z-index:50;left:50%;bottom:calc(12px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);max-width:calc(100% - 20px);display:flex;align-items:center;gap:4px;padding:6px 8px;border-radius:18px;background:#161c2a;border:1px solid rgba(255,255,255,.14);box-shadow:0 14px 34px rgba(0,0,0,.4);overflow-x:auto;color:#eef3ff}
#pb-tools .t{font:inherit;flex:none;min-width:44px;height:44px;border-radius:12px;border:0;background:transparent;color:inherit;font-size:1.25rem;cursor:pointer;padding:0 6px}
#pb-tools .t[aria-pressed="true"]{background:#3b6cff}
#pb-tools .t.open{box-shadow:inset 0 0 0 2px #ffb300}
#pb-tools .sep{flex:none;width:1px;height:28px;background:rgba(255,255,255,.16);margin:0 4px}
#pb-tools .dot{flex:none;width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,.25);cursor:pointer;padding:0}
#pb-tools .dot[aria-pressed="true"]{border-color:#fff;box-shadow:0 0 0 2px #3b6cff}
#pb-tools .wd{flex:none;width:36px;height:36px;border-radius:10px;border:0;background:transparent;cursor:pointer;display:grid;place-items:center}
#pb-tools .wd i{display:block;border-radius:50%;background:#eef3ff}
#pb-tools .wd[aria-pressed="true"]{background:rgba(255,255,255,.14)}
#pb-tools .t.warn{background:#c62828;font-size:.85rem;font-weight:700;padding:0 10px}
#pb-sub{position:absolute;z-index:51;left:50%;bottom:calc(76px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:max-content;max-width:calc(100% - 20px);display:flex;flex-wrap:wrap;justify-content:center;gap:6px;padding:8px;border-radius:16px;background:#1d2436;border:1px solid rgba(255,255,255,.16);box-shadow:0 14px 34px rgba(0,0,0,.4);color:#eef3ff}
#pb-sub .hd{width:100%;text-align:center;font-size:.8rem;opacity:.75}
#pb-sub button{font:inherit;font-size:.92rem;border-radius:10px;padding:7px 11px;cursor:pointer;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:inherit}
#pb-sub button[aria-pressed="true"]{background:#3b6cff;border-color:#3b6cff}
#pb-sub button.warn{background:#c62828;border-color:#c62828;font-weight:700}
#pb-sh{position:fixed;inset:0;z-index:9810;background:rgba(5,8,14,.72);display:grid;place-items:center;padding:14px}
.pb-shbox{width:min(600px,100%);max-height:100%;display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:16px;background:#161c2a;border:1px solid rgba(255,255,255,.14);color:#eef3ff}
.pb-shhd{display:flex;justify-content:space-between;align-items:center}
.pb-shhd button{font:inherit;border:0;border-radius:8px;background:rgba(255,255,255,.1);color:inherit;padding:3px 12px;cursor:pointer}
.pb-shimg{min-height:0;overflow:auto;border-radius:10px;background:#0b0f18;flex:1}
.pb-shimg img{display:block;width:100%;height:auto}
.pb-shrow{display:flex;flex-wrap:wrap;gap:8px}
.pb-shrow button{font:inherit;flex:1 1 160px;border-radius:12px;padding:10px;cursor:pointer;border:1px solid #1f8f4e;background:#1f8f4e;color:#fff;font-weight:700}
.pb-shopt{font-size:.92rem;display:flex;gap:8px;align-items:center}
.pb-shbox small{opacity:.72}
#pb-toast{position:absolute;z-index:70;left:50%;top:calc(62px + env(safe-area-inset-top,0px));transform:translate(-50%,-10px);opacity:0;pointer-events:none;padding:7px 16px;border-radius:99px;background:#101522;color:#fff;font-size:.9rem;transition:.2s;white-space:nowrap;max-width:calc(100% - 20px);overflow:hidden;text-overflow:ellipsis;border:1px solid rgba(255,255,255,.18)}
#pb-toast.on{opacity:1;transform:translate(-50%,0)}
@media (prefers-reduced-motion:reduce){#pb-toast{transition:none}}
`;
  const HTML = `
<div id="pb-ov" hidden>
  <div class="pb-ovbar"><span>✍️ Writing on the screen — the app is paused</span><button type="button" id="pb-ov-close">✕ Close</button></div>
  <div id="pb-ovpaper"><canvas id="pb-ovbase"></canvas><canvas id="pb-ovlive" class="pb-live"></canvas></div>
</div>
<div id="pb-bd" hidden>
  <div class="pb-top">
    <button type="button" class="pb-x" id="pb-close">✕ Close</button>
    <button type="button" id="pb-prev" aria-label="Previous">◀</button>
    <span class="qn" id="pb-qn"></span>
    <button type="button" id="pb-next">Next ▶</button>
    <span class="sp"></span>
    <button type="button" id="pb-theme"></button>
    <button type="button" id="pb-bg"></button>
    <button type="button" id="pb-page">＋ Page</button>
    <button type="button" id="pb-save">💾 Save / Share</button>
  </div>
  <div id="pb-scroll"><div id="pb-paper"><canvas id="pb-base"></canvas><canvas id="pb-live" class="pb-live"></canvas></div></div>
  <div id="pb-q"></div>
  <button type="button" id="pb-chip" hidden>📌 Show question</button>
</div>
<div id="pb-sh" hidden>
  <div class="pb-shbox">
    <div class="pb-shhd"><b>💾 Board picture</b><button type="button" id="pb-sh-close" aria-label="Close">✕</button></div>
    <div class="pb-shimg"><img id="pb-sh-img" alt="Board picture"></div>
    <label class="pb-shopt"><input type="checkbox" id="pb-sh-q" checked> Put the question (and the answer, if shown) on top</label>
    <div class="pb-shrow"><button type="button" id="pb-sh-go">📤 Share / Save</button></div>
    <small id="pb-sh-msg">Pick WhatsApp, Drive, Files… from the list.</small>
  </div>
</div>
<div id="pb-sub" hidden></div>
<div id="pb-tools" hidden></div>
<div id="pb-toast" role="status"></div>`;

  let board = null, over = null, active = null, src = null;
  const mem = new Map();
  const B = { idx: 0, item: null, fs: 17, ans: false, min: false, busy: false };
  const SHAPES = [['line', '／', 'Straight line'], ['curve', '⌒', 'Curved line'], ['arrow', '➝', 'Arrow'], ['circle', '◯', 'Circle'], ['rect', '▭', 'Rectangle'], ['tri', '△', 'Triangle'], ['axes', '✚', 'X-Y axes']];
  const ERASERS = [['brush', '🧽', 'Rub out a part'], ['stroke', '✂️', 'Remove a whole line / shape'], ['rect', '⬚', 'Rub out inside a box'], ['lasso', '➰', 'Rub out inside a free-hand loop']];
  const TOOLS = [['hand', '✋', 'Scroll the page'], ['sel', '👆', 'Select & move'], ['pen', '✏️', 'Pen'], ['hl', '🖍️', 'Highlighter'], ['fill', '🎨', 'Fill colour'], ['er', '🧽', 'Eraser'], ['laser', '🔴', 'Laser'], ['shape', '🔷', 'Lines & shapes'], ['txt', '🔤', 'Text'], ['compass', '🧭', 'Compass']];
  let clrArm = 0;

  function _toast(t) { const el = $('pb-toast'); if (!el) return; el.textContent = t; el.classList.add('on'); clearTimeout(_toast._t); _toast._t = setTimeout(() => el.classList.remove('on'), 1800); }
  function _changed() { if (active === board) _saveCur(); }

  function _build() {
    if ($('pb-root')) return;
    const st = document.createElement('style'); st.id = 'pb-style'; st.textContent = CSS; document.head.appendChild(st);
    const root = document.createElement('div'); root.id = 'pb-root'; root.hidden = true; root.innerHTML = HTML;
    document.body.appendChild(root);
    board = new Surface($('pb-scroll'), $('pb-paper'), $('pb-base'), $('pb-live'), true);
    over = new Surface($('pb-ov'), $('pb-ovpaper'), $('pb-ovbase'), $('pb-ovlive'), false);
    // APP.handleBack "taps outside" the top full-screen layer: close the topmost part
    root.addEventListener('click', e => { if (e.target === root) _backOne(); });
    $('pb-tools').addEventListener('click', _onTools);
    $('pb-sub').addEventListener('click', _onSub);
    $('pb-ov-close').addEventListener('click', _closeAll);
    $('pb-close').addEventListener('click', _closeAll);
    $('pb-next').addEventListener('click', () => _step(1));
    $('pb-prev').addEventListener('click', () => _step(-1));
    $('pb-theme').addEventListener('click', () => { S.dark = !S.dark; S.lastBoard = S.dark ? 'black' : 'white'; _paintBoard(); board.redraw(); _renderTools(); });
    $('pb-bg').addEventListener('click', () => { S.bg = { blank: 'ruled', ruled: 'grid', grid: 'graph', graph: 'blank' }[S.bg]; _paintBoard(); _saveCur(); _renderSub(); });
    $('pb-page').addEventListener('click', () => {
      if (board.pages >= 10) { _toast('10 pages is the limit for one question'); return; }
      board.pages++; board.size(); _saveCur();
      $('pb-scroll').scrollTo({ top: (board.pages - 1) * $('pb-scroll').clientHeight, behavior: 'smooth' });
      _toast(`Page ${board.pages} — scroll with ✋ or the wheel`);
    });
    $('pb-save').addEventListener('click', _openShare);
    $('pb-sh-close').addEventListener('click', () => { $('pb-sh').hidden = true; });
    $('pb-sh').addEventListener('click', e => { if (e.target === $('pb-sh')) $('pb-sh').hidden = true; });
    $('pb-sh-q').addEventListener('change', () => _refreshShare());
    $('pb-sh-go').addEventListener('click', _doShare);
    $('pb-q').addEventListener('click', _onCard);
    $('pb-q').addEventListener('pointerdown', _dragCard);
    $('pb-chip').addEventListener('click', () => { B.min = false; _renderCard(); });
    document.addEventListener('keydown', e => {
      if (!active || /^(TEXTAREA|INPUT)$/.test(e.target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? active.redoOne() : active.undo(); }
      if (S.tool === 'sel' && active.sel.length && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); active.deleteSel(); _selBar(); }
      if (S.tool === 'sel' && active.sel.length && e.key === 'Escape') { active.sel = []; active.clearLive(); active.guide(); _selBar(); }
    });
    new ResizeObserver(() => { if (!$('pb-bd').hidden) board.size(); if (!$('pb-ov').hidden) over.size(); }).observe(root);
  }
  // (the share sheet is its own fixed layer above, so Back closes it alone)
  function _backOne() {
    if (!$('pb-sh').hidden) { $('pb-sh').hidden = true; return; }
    _closeAll();
  }

  // ── tool pill + its menus ──
  function _renderTools() {
    const dark = active ? active.dark() : true, onBoard = active === board;
    const cols = S.tool === 'hl' ? HL.map((c, i) => `<button type="button" class="dot" data-h="${i}" aria-pressed="${S.h === i}" style="background:${c.replace(/[\d.]+\)$/, '1)')}" aria-label="Colour ${i + 1}"></button>`).join('')
      : PAL.map((c, i) => `<button type="button" class="dot" data-c="${i}" aria-pressed="${S.c === i}" style="background:${c[dark ? 1 : 0]}" aria-label="Colour ${i + 1}"></button>`).join('');
    const selOn = S.tool === 'sel' && active?.sel.length > 0;
    const showCols = !['hand', 'laser', 'er', 'sel'].includes(S.tool) || selOn, showW = (!['hand', 'laser', 'sel', 'fill'].includes(S.tool) && !(S.tool === 'er' && (S.er === 'rect' || S.er === 'lasso'))) || selOn;
    const icon = t => t === 'shape' && S.tool === 'shape' ? SHAPES.find(s => s[0] === S.shape)[1] : t === 'er' ? ERASERS.find(s => s[0] === S.er)[1] : TOOLS.find(s => s[0] === t)[1];
    $('pb-tools').innerHTML =
      TOOLS.filter(t => onBoard || (t[0] !== 'hand' && t[0] !== 'compass')).map(t => `<button type="button" class="t ${S.sub === t[0] ? 'open' : ''}" data-tool="${t[0]}" aria-pressed="${S.tool === t[0]}" title="${t[2]}" aria-label="${t[2]}">${icon(t[0])}</button>`).join('') +
      (onBoard ? `<button type="button" class="t ${S.sub === 'geo' ? 'open' : ''}" data-geo="1" aria-pressed="${Object.values(INST).some(Boolean)}" title="Maths tools" aria-label="Maths tools">📐</button>` : '') +
      (showCols ? `<span class="sep"></span>${cols}` : '') +
      (showW ? `<span class="sep"></span>` + WID.map((w, i) => `<button type="button" class="wd" data-w="${i}" aria-pressed="${S.w === i}" aria-label="Thickness ${i + 1}"><i style="width:${4 + i * 5}px;height:${4 + i * 5}px"></i></button>`).join('') : '') +
      `<span class="sep"></span><button type="button" class="t" data-act="undo" title="Undo" aria-label="Undo">↶</button><button type="button" class="t" data-act="redo" title="Redo" aria-label="Redo">↷</button>` +
      `<button type="button" class="t ${clrArm ? 'warn' : ''}" data-act="clr" title="Clear all">${clrArm ? 'Tap again = clear all' : '🗑️'}</button>`;
    $('pb-root').classList.toggle('pb-hand', S.tool === 'hand');
  }
  function _renderSub() {
    const el = $('pb-sub');
    if (!S.sub || !active) { el.hidden = true; return; }
    el.hidden = false;
    if (S.sub === 'selbar') {
      const n = active.sel.length;
      el.innerHTML = `<div class="hd">${n} selected — press inside and drag to move · tap a colour / thickness below to change it</div><button type="button" data-sel="big">➕ Bigger</button><button type="button" data-sel="small">➖ Smaller</button><button type="button" data-sel="left">⟲ Turn</button><button type="button" data-sel="right">⟳ Turn</button><button type="button" data-sel="copy">⧉ Copy</button><button type="button" data-sel="del">🗑️ Delete</button><button type="button" data-sel="none">✕ Deselect</button>`;
    } else if (S.sub === 'shape') el.innerHTML = '<div class="hd">Pick one, then drag on the board (curved line: drag the yellow dot to bend it)</div>' + SHAPES.map(s => `<button type="button" data-shape="${s[0]}" aria-pressed="${S.shape === s[0]}">${s[1]} ${s[2]}</button>`).join('');
    else if (S.sub === 'er') el.innerHTML = '<div class="hd">Which eraser?</div>' + ERASERS.map(s => `<button type="button" data-er="${s[0]}" aria-pressed="${S.er === s[0]}">${s[1]} ${s[2]}</button>`).join('') +
      `<button type="button" data-er="all" class="${clrArm ? 'warn' : ''}">${clrArm ? 'Tap again = clear all' : '🗑️ Clear all'}</button>`;
    else el.innerHTML = '<div class="hd">Maths tools — drag to move, turn with the blue ⟳; pen along an edge = straight line</div>' +
      `<button type="button" data-inst="ruler" aria-pressed="${!!INST.ruler}">📏 Ruler</button><button type="button" data-inst="sq" aria-pressed="${!!INST.sq}">📐 Set square</button><button type="button" data-inst="pro" aria-pressed="${!!INST.pro}">◠ Protractor</button>` +
      `<button type="button" data-tool="compass" aria-pressed="${S.tool === 'compass'}">🧭 Compass</button><button type="button" data-bg="graph" aria-pressed="${S.bg === 'graph'}">📈 Graph paper</button>`;
  }
  function _closeSub() { if (S.sub) { S.sub = null; _renderSub(); _renderTools(); } }
  // the small bar for a selection (⧉ copy / 🗑️ remove) shows while something is selected
  function _selBar() {
    if (!active) return;
    const want = S.tool === 'sel' && active.sel.length > 0;
    if (want) S.sub = 'selbar'; else if (S.sub === 'selbar') S.sub = null;
    _renderSub(); _renderTools();
  }
  function _pickTool(t) {
    S.tool = t;
    if (t === 'laser') _toast('🔴 Laser: point — the line fades by itself');
    if (t === 'compass') { if (active) active.cmp = null; _toast('🧭 Press the centre and drag out = radius'); }
    if (t === 'txt') _toast('🔤 Tap where you want to type');
    if (t === 'sel') _toast('👆 Tap a figure (or drag a box around it), then drag to move');
    if (t === 'fill') _toast('🎨 Pick a colour, then tap inside a closed shape');
    if (active) { if (t !== 'shape') active.edit = -1; if (t !== 'sel') active.sel = []; active.clearLive(); active.guide(); }
  }
  function _armClear() {
    if (!clrArm) { clrArm = 1; setTimeout(() => { if (clrArm) { clrArm = 0; _renderTools(); _renderSub(); } }, 2500); return false; }
    clrArm = 0; return true;
  }
  function _onTools(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tool) {
      const t = b.dataset.tool;
      S.sub = (t === 'shape' || t === 'er') ? (S.sub === t ? null : t) : null;
      _pickTool(t);
    }
    if (b.dataset.geo) S.sub = S.sub === 'geo' ? null : 'geo';
    if (b.dataset.c) { S.c = +b.dataset.c; if (S.tool === 'sel') active?.styleSel({ c: S.c }); }
    if (b.dataset.h) S.h = +b.dataset.h;
    if (b.dataset.w) { S.w = +b.dataset.w; if (S.tool === 'sel') active?.styleSel({ w: S.w }); }
    const a = b.dataset.act;
    if (a === 'undo') active.undo();
    if (a === 'redo') active.redoOne();
    if (a === 'clr' && _armClear()) active.clear();
    _renderTools(); _renderSub();
  }
  function _onSub(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.shape) { S.shape = b.dataset.shape; _pickTool('shape'); S.sub = null; }
    if (b.dataset.er) {
      if (b.dataset.er === 'all') { if (!_armClear()) { _renderSub(); return; } active.clear(); S.sub = null; }
      else { S.er = b.dataset.er; _pickTool('er'); S.sub = null; if (S.er === 'stroke') _toast('✂️ Any line / shape you touch goes completely'); if (S.er === 'rect') _toast('⬚ Drag a box — everything inside is rubbed out'); if (S.er === 'lasso') _toast('➰ Draw a loop — everything inside is rubbed out'); }
    }
    if (b.dataset.sel) {
      if (b.dataset.sel === 'big') active.transformSel(1.15, 0);
      if (b.dataset.sel === 'small') active.transformSel(1 / 1.15, 0);
      if (b.dataset.sel === 'left') active.transformSel(1, -15);
      if (b.dataset.sel === 'right') active.transformSel(1, 15);
      if (b.dataset.sel === 'copy') active.copySel();
      if (b.dataset.sel === 'del') active.deleteSel();
      if (b.dataset.sel === 'none') { active.sel = []; active.clearLive(); active.guide(); }
      _selBar(); return;
    }
    if (b.dataset.inst) toggleInst(b.dataset.inst);
    if (b.dataset.tool) { _pickTool(b.dataset.tool); S.sub = null; }
    if (b.dataset.bg) { S.bg = S.bg === 'graph' ? 'blank' : 'graph'; _paintBoard(); _saveCur(); }
    _renderTools(); _renderSub();
  }

  // ── open / close ──
  function _showRoot() { $('pb-root').hidden = false; $('pb-fab').hidden = true; $('pb-fabmenu').hidden = true; $('pb-tools').hidden = false; }
  function openOverlay() {
    _build(); _showRoot();
    $('pb-ov').hidden = false; $('pb-bd').hidden = true; active = over;
    if (S.tool === 'hand' || S.tool === 'compass') S.tool = 'pen';
    over.strokes = []; over.redo = []; over.edit = -1; over.sel = []; over.size();
    _renderTools(); _renderSub();
    _toast('Write on the app — this is cleared when you close');
  }
  async function openBoard(kind) {
    const s = _source(); if (!s) return;
    _build(); src = s;
    S.dark = (kind || S.lastBoard) === 'black'; S.lastBoard = S.dark ? 'black' : 'white';
    B.idx = s.index(); B.min = false; B.wide = s.kind === 'note';
    _showRoot(); $('pb-bd').hidden = false; $('pb-ov').hidden = true; active = board;
    if (S.tool === 'laser' || S.tool === 'er') S.tool = 'pen';
    _loadQ();
  }
  function _closeAll() {
    if (!$('pb-root') || $('pb-root').hidden) return;
    if (active === board) { _saveCur(); src?.onClose(B.idx); }
    $('pb-root').hidden = true; $('pb-sh').hidden = true; S.sub = null; clrArm = 0;
    removeInsts(); active = null; src = null;
    _refreshFab();
  }

  // ── the question on the board ──
  // the writing of the last MEM_KEEP questions stays (oldest let go first), so a long class
  // never fills a cheap phone's memory
  const MEM_KEEP = 20;
  function _saveCur() {
    if (!B.item || active !== board) return;
    mem.delete(B.item.id);
    mem.set(B.item.id, { strokes: board.strokes, pages: board.pages, bg: S.bg });
    while (mem.size > MEM_KEEP) mem.delete(mem.keys().next().value);
  }
  function _loadQ() {
    B.item = src.item(B.idx);
    if (!B.item) { _closeAll(); return; }
    const m = mem.get(B.item.id);
    board.strokes = m ? m.strokes : []; board.redo = []; board.pages = m ? m.pages : 1; board.cmp = null; board.edit = -1; board.sel = [];
    S.bg = m ? m.bg : 'blank';
    B.ans = false;
    $('pb-scroll').scrollTop = 0;
    _paintBoard(); board.size(); _renderCard(); _renderTools(); _renderSub();
  }
  async function _step(d) {
    if (B.busy) return;
    const n = src.count(), to = B.idx + d;
    if (to < 0 || to >= n) return;
    B.busy = true; _saveCur();
    try { B.idx = await src.go(to); } finally { B.busy = false; }
    _loadQ();
  }
  function _paintBoard() {
    $('pb-bd').classList.toggle('black', S.dark);
    $('pb-theme').textContent = S.dark ? '⬜ Whiteboard' : '⬛ Blackboard';
    $('pb-paper').className = S.bg === 'blank' ? '' : 'bg-' + S.bg;
    $('pb-bg').textContent = '📄 Paper: ' + ({ blank: 'Plain', ruled: 'Ruled', grid: 'Grid', graph: 'Graph' })[S.bg];
    const n = src.count();
    $('pb-qn').textContent = `${({ mcq: 'MCQ', ex: 'Question', note: 'Part' })[src.kind]} ${B.idx + 1} / ${n}`;
    $('pb-next').textContent = src.kind === 'note' ? 'Next part ▶' : 'Next question ▶';
    $('pb-prev').disabled = B.idx <= 0;
    $('pb-next').disabled = B.idx >= n - 1;
  }
  function _renderCard() {
    const q = B.item;
    $('pb-q').hidden = B.min; $('pb-chip').hidden = !B.min;
    $('pb-q').classList.toggle('wide', !!B.wide);
    $('pb-q').innerHTML = `
      <div class="pb-qh"><b>${_esc(q.label)}${q.title ? ' · ' + _esc(q.title) : ''}</b><span class="grow"></span>
        <button type="button" data-a="wide" aria-label="Bigger / smaller card">${B.wide ? '⤡' : '⤢'}</button><button type="button" data-a="fs-" aria-label="Smaller text">A−</button><button type="button" data-a="fs+" aria-label="Bigger text">A+</button><button type="button" data-a="min" aria-label="Hide the card">—</button></div>
      <div class="pb-qb" style="font-size:${B.fs}px">
        <div class="pb-qtext">${q.html}</div>
        ${q.opts?.length ? `<ol class="pb-qo">${q.opts.map(o => `<li class="${B.ans && o.k === q.ansKey ? 'ok' : ''}">${o.h}</li>`).join('')}</ol>` : ''}
        ${q.ans || q.ex ? `<button type="button" class="pb-ans" data-a="ans">${B.ans ? '🙈 Hide answer' : '✅ Show answer'}</button>` : ''}
        ${B.ans ? `<div class="pb-a">${q.opts?.length ? `<b>Answer:</b> ${q.ans}` : q.ans}${q.ex ? `<div class="pb-ex">💡 ${q.ex}</div>` : ''}</div>` : ''}
      </div>`;
    window.MATH?.renderElement?.($('pb-q'));
  }
  function _onCard(e) {
    const a = e.target.closest('button')?.dataset.a; if (!a) return;
    if (a === 'ans') B.ans = !B.ans;
    if (a === 'fs+') B.fs = Math.min(32, B.fs + 2);
    if (a === 'fs-') B.fs = Math.max(13, B.fs - 2);
    if (a === 'min') B.min = true;
    if (a === 'wide') B.wide = !B.wide;
    _renderCard();
  }
  function _dragCard(e) {
    const h = e.target.closest('.pb-qh'); if (!h || e.target.closest('button')) return;
    const card = $('pb-q'), box = $('pb-bd').getBoundingClientRect(), r = card.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    h.setPointerCapture(e.pointerId);
    const mv = ev => {
      card.style.left = Math.max(0, Math.min(box.width - r.width, ev.clientX - box.left - dx)) + 'px';
      card.style.top = Math.max(50, Math.min(box.height - 40, ev.clientY - box.top - dy)) + 'px';
    };
    const end = () => { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', end); h.removeEventListener('pointercancel', end); };
    h.addEventListener('pointermove', mv); h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  }

  // ── 💾 one picture: question on top + the whole board (all pages) ──
  function _cardText() {
    const q = B.item, box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;font:600 20px Mukta,sans-serif;white-space:normal';
    box.innerHTML = `<div>${q.html}</div>` + (q.opts?.length ? q.opts.map(o => `<div>${o.h}</div>`).join('') : '');
    box.querySelectorAll('.katex-mathml, img, button, script, style').forEach(e => e.remove());
    document.body.appendChild(box);
    const lines = box.innerText.split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    box.innerHTML = B.ans ? `<div>${q.ans}</div>${q.ex ? `<div>${q.ex}</div>` : ''}` : '';
    box.querySelectorAll('.katex-mathml, img, button').forEach(e => e.remove());
    const ans = box.innerText.split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    box.remove();
    return { lines, ans };
  }
  function _wrap(x, text, maxW) {
    const out = []; let line = '';
    for (const w of text.split(' ')) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
    if (line) out.push(line);
    return out;
  }
  function _picture(withQ) {
    const W = board.base.clientWidth, H = board.base.clientHeight, d = 2;
    const cv = document.createElement('canvas'), x = cv.getContext('2d');
    const ink = S.dark ? '#eef2ea' : '#17202c', paper = S.dark ? '#1b2420' : '#fbfcfd';
    const rows = [];
    if (withQ) {
      const t = _cardText();
      rows.push({ t: B.item.label + (B.item.title ? '  ·  ' + B.item.title : ''), f: '700 15px Mukta, sans-serif', h: 24, o: .65 });
      x.font = '600 20px Mukta, sans-serif';
      t.lines.forEach(l => _wrap(x, l, W - 48).forEach(s => rows.push({ t: s, f: '600 20px Mukta, sans-serif', h: 30 })));
      if (t.ans.length) { x.font = '600 17px Mukta, sans-serif'; ['Answer: ' + t.ans[0], ...t.ans.slice(1)].forEach(l => _wrap(x, l, W - 48).forEach(s => rows.push({ t: s, f: '600 17px Mukta, sans-serif', h: 26, c: S.dark ? '#a6e3a1' : '#17803a' }))); }
      if (/<img/i.test(B.item.html)) rows.push({ t: '(see the question picture in the app)', f: '500 14px Mukta, sans-serif', h: 22, o: .6 });
    }
    const band = withQ ? rows.reduce((s, l) => s + l.h, 0) + 32 : 0, foot = 30;
    cv.width = W * d; cv.height = (band + H + foot) * d; x.scale(d, d);
    x.fillStyle = paper; x.fillRect(0, 0, W, band + H + foot);
    x.save(); x.translate(0, band);
    const line = (c, x1, y1, x2, y2) => { x.strokeStyle = c; x.lineWidth = 1; x.beginPath(); x.moveTo(x1, y1 + .5); x.lineTo(x2, y2 + .5); x.stroke(); };
    const rl = S.dark ? 'rgba(255,255,255,.1)' : 'rgba(40,80,140,.16)';
    if (S.bg === 'ruled') for (let y = 39; y < H; y += 40) line(rl, 0, y, W, y);
    if (S.bg === 'grid') { for (let y = 0; y < H; y += 32) line(rl, 0, y, W, y); for (let v = 0; v < W; v += 32) line(rl, v, 0, v, H); }
    if (S.bg === 'graph') {
      const gf = S.dark ? 'rgba(150,235,195,.09)' : 'rgba(20,130,90,.13)', gb = S.dark ? 'rgba(150,235,195,.3)' : 'rgba(20,130,90,.38)';
      for (let y = 0; y < H; y += 8) line(y % 40 ? gf : gb, 0, y, W, y);
      for (let v = 0; v < W; v += 8) line(v % 40 ? gf : gb, v, 0, v, H);
    }
    x.drawImage(board.base, 0, 0, W, H);
    x.restore();
    if (withQ) {
      x.fillStyle = S.dark ? 'rgba(255,255,255,.05)' : '#f1f4f9'; x.fillRect(0, 0, W, band);
      x.fillStyle = S.dark ? 'rgba(255,255,255,.18)' : '#d9e0ea'; x.fillRect(0, band - 1, W, 1);
      let y = 18; x.textBaseline = 'top';
      for (const l of rows) { x.font = l.f; x.globalAlpha = l.o || 1; x.fillStyle = l.c || ink; x.fillText(l.t, 24, y); y += l.h; }
      x.globalAlpha = 1;
    }
    x.font = '600 12px Mukta, sans-serif'; x.fillStyle = ink; x.globalAlpha = .5; x.textBaseline = 'middle';
    x.fillText('TeachingBoard • ' + new Date().toLocaleDateString('en-IN'), 24, band + H + foot / 2);
    x.globalAlpha = 1;
    return cv;
  }
  function _refreshShare() { _shareCanvas = _picture($('pb-sh-q').checked); $('pb-sh-img').src = _shareCanvas.toDataURL('image/png'); }
  let _shareCanvas = null;
  function _openShare() { _saveCur(); _closeSub(); _refreshShare(); $('pb-sh-msg').textContent = 'Pick WhatsApp, Drive, Files… from the list.'; $('pb-sh').hidden = false; }
  async function _doShare() {
    const cv = _shareCanvas; if (!cv) return;
    const msg = $('pb-sh-msg'); msg.textContent = '⏳ Getting it ready…';
    try {
      const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      const name = `board-${(B.item?.label || 'q').replace(/[^\w-]+/g, '')}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}.png`;
      await window.FILE_EXPORT.saveAndShare(blob, name);
      msg.textContent = '✅ Done';
    } catch (err) {
      console.warn('board share failed', err);
      msg.textContent = 'Could not share — please try again';
    }
  }

  // ── the ✏️ button: only in Board Mode, on MCQ practice / exercise questions ──
  function _refreshFab() {
    const fab = $('pb-fab'); if (!fab) return;
    const open = $('pb-root') && !$('pb-root').hidden;
    const ok = !open && !!_source();
    fab.hidden = !ok;
    if (!ok) $('pb-fabmenu').hidden = true;
  }
  let _fabTick = 0;
  function _queueFab() { if (_fabTick) return; _fabTick = requestAnimationFrame(() => { _fabTick = 0; _refreshFab(); }); }
  function init() {
    if ($('pb-fab')) return;
    const fab = document.createElement('button');
    fab.type = 'button'; fab.id = 'pb-fab'; fab.hidden = true; fab.textContent = '✏️'; fab.setAttribute('aria-label', 'Pen / Board');
    const menu = document.createElement('div'); menu.id = 'pb-fabmenu'; menu.hidden = true;
    menu.innerHTML = `<div class="hd" id="pb-fabhd"></div>
      <button type="button" data-open="white">⬜ Whiteboard</button>
      <button type="button" data-open="black">⬛ Blackboard</button>
      <button type="button" data-open="over">✍️ Write on the app (see-through)</button>`;
    if (!$('pb-style')) { const st = document.createElement('style'); st.id = 'pb-style'; st.textContent = CSS; document.head.appendChild(st); }
    document.body.append(fab, menu);
    fab.addEventListener('click', () => {
      const s = _source(); if (!s) return;
      menu.hidden = !menu.hidden;
      const it = s.item(s.index());
      $('pb-fabhd').textContent = `Opens with the current one: ${it?.label || ''}`;
    });
    menu.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      menu.hidden = true;
      if (b.dataset.open === 'over') openOverlay(); else openBoard(b.dataset.open);
    });
    document.addEventListener('pointerdown', e => {
      if (!menu.hidden && !e.target.closest('#pb-fabmenu, #pb-fab')) menu.hidden = true;
      const card = e.target.closest?.('#ev-questions-list .ev-qcard'); if (card) _lastCard = card;
    }, true);
    const mo = new MutationObserver(_queueFab);
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const wrap = $('screens-wrap'); if (wrap) mo.observe(wrap, { attributes: true, subtree: true, attributeFilter: ['class', 'style'], childList: true });
    _refreshFab();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  return { init, openBoard, openOverlay, close: _closeAll, isOpen: () => !!$('pb-root') && !$('pb-root').hidden, __test: { source: () => _source()?.kind || null, mem: () => mem, board: () => board, S } };
})();

window.PEN_BOARD = PEN_BOARD;
