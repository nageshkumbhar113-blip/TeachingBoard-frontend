/* The exam pages' little animation (same look as the Admin › Ads videos), drawn in the
   visitor's browser from the page's own data — no video file anywhere.
   Starts only when the canvas is on screen, stops when it leaves (or the tab is hidden);
   "Reduce motion" → one still picture. Purely decorative: aria-hidden, the text is in the page. */
(function () {
  var cv = document.querySelector('canvas.promo[data-promo]');
  if (!cv || !cv.getContext) return;
  var d; try { d = JSON.parse(cv.getAttribute('data-promo')); } catch (e) { return; }
  var x = cv.getContext('2d'), W = 720, H = 720;
  var FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Devanagari",sans-serif';
  var still = false; try { still = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var logo = new Image(); logo.src = '/icons/icon-192.png';

  var days = null;
  if (d.date) { var t = new Date(d.date + 'T00:00:00'), n = new Date(); n.setHours(0, 0, 0, 0); days = Math.round((t - n) / 864e5); if (days <= 0) days = null; }

  // scenes: [name, ms]
  var S = [['title', 2600]];
  if (days) S.push(['days', 2800]);
  if (d.q && d.q.options && d.q.options.length === 4) S.push(['question', 7600]);
  S.push(['cta', 3000]);
  var TOTAL = S.reduce(function (t, s) { return t + s[1]; }, 0);

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function p(t, a, b) { return clamp((t - a) / (b - a)); }
  function outBack(v) { var c = 1.7; return 1 + (c + 1) * Math.pow(v - 1, 3) + c * Math.pow(v - 1, 2); }
  function outCubic(v) { return 1 - Math.pow(1 - v, 3); }
  function rr(X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
  function text(s, X, Y, px, color, w, maxW) {
    var size = px; x.font = (w || 800) + ' ' + size + 'px ' + FONT; x.fillStyle = color || '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    while (x.measureText(s).width > (maxW || 640) && size > 16) { size -= 2; x.font = (w || 800) + ' ' + size + 'px ' + FONT; }
    x.fillText(s, X, Y);
  }
  function wrap(s, X, Y, maxW, lh, px, color, w, maxLines) {
    x.font = (w || 700) + ' ' + px + 'px ' + FONT; x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle';
    var words = String(s || '').split(/\s+/), line = '', out = [];
    for (var i = 0; i < words.length; i++) {
      var tryL = line ? line + ' ' + words[i] : words[i];
      if (x.measureText(tryL).width > maxW && line) { out.push(line); line = words[i]; } else line = tryL;
    }
    if (line) out.push(line);
    if (out.length > maxLines) { out = out.slice(0, maxLines); out[maxLines - 1] += ' …'; }
    out.forEach(function (l, k) { x.fillText(l, X, Y + k * lh); });
    return out.length;
  }
  function bg(t) {
    var g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2a0e6b'); g.addColorStop(.55, '#5b21d6'); g.addColorStop(1, '#ff4d8d');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.save(); x.globalAlpha = .12; x.strokeStyle = '#fff'; x.lineWidth = 5;
    for (var i = 0; i < 7; i++) {
      var px = (i * 241 + t * .02 * (i % 2 ? 1 : -1)) % (W + 160) - 80, py = (i * 397 + t * .015) % (H + 160) - 80, s = 40 + (i % 3) * 22;
      x.save(); x.translate(px, py); x.rotate(t / 4000 + i);
      if (i % 3 === 0) { x.beginPath(); x.moveTo(0, -s); x.lineTo(s * .87, s / 2); x.lineTo(-s * .87, s / 2); x.closePath(); x.stroke(); }
      else if (i % 3 === 1) x.strokeRect(-s / 2, -s / 2, s, s); else { x.beginPath(); x.arc(0, 0, s / 2, 0, 7); x.stroke(); }
      x.restore();
    }
    x.restore();
    // the badge in the corner
    x.save(); x.globalAlpha = .95; x.fillStyle = '#fff'; rr(20, H - 74, 210, 54, 27); x.fill();
    if (logo.complete && logo.naturalWidth) x.drawImage(logo, 26, H - 69, 44, 44);
    text('NKs EduOrbit', 148, H - 46, 22, '#5b21d6', 800, 150); x.restore();
  }
  var SC = {
    title: function (lt) {
      var a = outBack(p(lt, 100, 800)), b = outBack(p(lt, 700, 1400));
      x.save(); x.translate(W / 2, 290); x.scale(a, a); text(d.name, 0, 0, 62, '#fff', 800, 640);
      if (d.cls) text('🎓 ' + d.cls, 0, 80, 34, '#ffd6e7', 700, 600); x.restore();
      if (d.benefit) { x.save(); x.translate(W / 2, 480); x.scale(b, b); x.fillStyle = '#ffc93c'; rr(-300, -48, 600, 96, 48); x.fill(); text('🏆 ' + d.benefit, 0, 2, 34, '#3b1d00', 800, 560); x.restore(); }
    },
    days: function (lt) {
      var start = Math.max(days + 40, 60), k = Math.round(start - (start - days) * outCubic(p(lt, 200, 1500)));
      text('⏰ ' + (d.dateLabel || d.name), W / 2, 200, 40, '#fff', 800, 620);
      var s = outBack(p(lt, 0, 500)); x.save(); x.translate(W / 2, 370); x.scale(s, s); text(String(k), 0, 0, 190, '#ffc93c', 800, 600); x.restore();
      text('दिवस बाकी', W / 2, 520, 56, '#fff', 800, 600);
    },
    question: function (lt) {
      var q = d.q, tapAt = 3800, tipAt = 5200;
      x.save(); x.fillStyle = '#fff'; rr(40, 100, 640, 580, 30); x.fill(); x.restore();
      var nL = wrap(q.q, W / 2, 150, 580, 38, 30, '#1d1640', 800, 3), top = 150 + nL * 38 + 6, tap = lt > tapAt;
      for (var i = 0; i < 4; i++) {
        var oy = top + i * 86, on = tap && i === q.answer;
        x.save(); x.fillStyle = on ? '#dcfce7' : '#faf8ff'; x.strokeStyle = on ? '#16a34a' : '#e2dcf7'; x.lineWidth = on ? 5 : 3; rr(70, oy, 580, 72, 18); x.fill(); x.stroke(); x.restore();
        text('ABCD'[i], 104, oy + 36, 26, on ? '#16a34a' : '#6d3cf0', 800);
        text(q.options[i], 380, oy + 36, 26, '#1d1640', 700, 470);
      }
      var fy = top + q.answer * 86 + 36, a = outCubic(p(lt, tapAt - 1300, tapAt - 150));
      if (lt > tapAt - 1500 && lt < tapAt + 600) { x.save(); x.font = '800 70px ' + FONT; x.textAlign = 'center'; x.fillText('👆', 640 + (560 - 640) * a, 760 + (fy + 20 - 760) * a); x.restore(); }
      var tp = outCubic(p(lt, tipAt, tipAt + 600));
      if (tp > 0) {
        x.save(); x.globalAlpha = tp; x.translate(0, (1 - tp) * 120);
        x.fillStyle = '#fff7d6'; x.strokeStyle = '#f59e0b'; x.lineWidth = 4; var ty = Math.min(545, top + 4 * 86 + 6); rr(60, ty, 600, 125, 22); x.fill(); x.stroke();
        wrap('💡 ' + (q.why || ('बरोबर उत्तर: ' + 'ABCD'[q.answer] + ') ' + q.options[q.answer])), W / 2, ty + 34, 560, 32, 25, '#5a3b00', 800, 3);
        x.restore();
      }
      text(tap ? 'बरोबर! ✅' : 'हा प्रश्न सोडवा', W / 2, 60, 34, '#fff', 800, 600);
    },
    cta: function (lt) {
      var s = outBack(p(lt, 0, 600));
      x.save(); x.translate(W / 2, 250); x.scale(s, s);
      x.fillStyle = '#fff'; rr(-80, -80, 160, 160, 36); x.fill();
      if (logo.complete && logo.naturalWidth) x.drawImage(logo, -68, -68, 136, 136);
      x.restore();
      text('NKs EduOrbit', W / 2, 390, 46, '#fff', 800, 600);
      var b = outBack(p(lt, 500, 1100)); x.save(); x.translate(W / 2, 510); x.scale(b, b);
      x.fillStyle = '#fff'; rr(-280, -50, 560, 100, 50); x.fill(); text(d.cta, 0, 2, 36, '#5b21d6', 800, 520); x.restore();
      text('Login नाही · लगेच Result', W / 2, 610, 28, '#ffd6e7', 700, 600);
    },
  };
  function frame(t) {
    var tt = t % TOTAL, at = 0;
    for (var i = 0; i < S.length; i++) { if (tt < at + S[i][1]) break; at += S[i][1]; }
    var sc = S[Math.min(i, S.length - 1)];
    bg(t); SC[sc[0]](tt - at);
  }
  if (still) {   // one picture: the question with its answer, or the call to action
    var draw = function () { bg(0); if (d.q && d.q.options && d.q.options.length === 4) SC.question(9000); else SC.cta(5000); };
    draw(); logo.onload = draw; return;
  }
  var raf = 0, t0 = 0, played = 0, on = false;
  function loop(now) { raf = requestAnimationFrame(loop); if (!t0) t0 = now - played; played = now - t0; frame(played); }
  function start() { if (on || document.hidden) return; on = true; t0 = 0; raf = requestAnimationFrame(loop); }
  function stop() { if (!on) return; on = false; cancelAnimationFrame(raf); }
  frame(0);
  var vis = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { vis = es[0].isIntersecting; vis ? start() : stop(); }, { threshold: .25 }).observe(cv);
  } else { vis = true; start(); }
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : vis && start(); });
})();
