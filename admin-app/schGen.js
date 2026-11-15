/* ════════════════════════════════════════
   schGen.js — शिष्यवृत्ती (गणित / बुद्धिमत्ता) questions for Admin › Create Quiz
   No AI: every type is a template built from the 2020–2024 papers; numbers change
   every time, the answer and the step-by-step उकल are computed by code, wrong options
   come from common mistakes. Figures are drawn as SVG and saved as PNG pictures.
   Figure-reasoning types reuse figureGen.js (FIGGEN) at a 4th-standard level.
   Same flow as figureGen.js: "+ जोडा" → local bank + server bank → active section.
   Globals: QGen (engine), SCH (templates), SCHGEN (panel)
════════════════════════════════════════ */
// Question engine without AI: templates (maths, reasoning) + fact banks (GK, Marathi), exam profiles.
// Every answer is computed by code; wrong options come from common mistakes.
(function (root) {
  'use strict';

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function tools(seed) {
    const r = rng(seed);
    const R = {
      r,
      ri: (a, b, s = 1) => a + s * Math.floor(r() * (Math.floor((b - a) / s) + 1)),
      pick: arr => arr[Math.floor(r() * arr.length)],
      shuffle: arr => { const x = arr.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; },
    };
    return R;
  }
  const gcd = (a, b) => b ? gcd(b, a % b) : a;

  // o: { a, w:[...], fmt?, num?, q, steps }
  function mk(R, o) {
    const fmt = o.fmt || (v => String(v));
    const A = fmt(o.a);
    const ws = [];
    const add = v => {
      if (v === undefined || v === null) return;
      if (typeof v === 'number' && (!isFinite(v) || v <= 0 || v !== Math.round(v))) return;
      const s = fmt(v);
      if (s !== A && !ws.includes(s)) ws.push(s);
    };
    o.w.forEach(add);
    if (typeof o.a === 'number') {
      for (let k = 1; ws.length < 3 && k < 50; k++) [o.a + k, o.a - k].forEach(v => ws.length < 3 && add(v));
    }
    if (ws.length < 3) return null;
    const opts = R.shuffle([A, ...ws.slice(0, 3)]);
    return { q: o.q, options: { A: opts[0], B: opts[1], C: opts[2], D: opts[3] }, answer: 'ABCD'[opts.indexOf(A)], steps: o.steps || [] };
  }
  const rs = v => '₹' + v, pc = v => v + '%';

  // ---------- maths ----------
  const T = {};
  T.percent = { name: 'शेकडेवारी', gen(R, L) {
    if (L === 1) {
      const p = R.pick([10, 20, 25, 50]), n = 100 * R.ri(1, 9), a = p * n / 100;
      return mk(R, { q: `${n} चे ${p}% किती?`, a, w: [n - a, p * n / 10, a + p], steps: [`${p}% म्हणजे ${p}/100`, `${n} × ${p} ÷ 100 = ${a}`] });
    }
    if (L === 2) {
      const p = R.ri(5, 95, 5), n = 20 * R.ri(3, 30), x = p * n / 100;
      if (R.r() < 0.5) return mk(R, { q: `${n} चे ${p}% किती?`, a: x, w: [n - x, x + 10, p * n / 10], steps: [`${n} × ${p} ÷ 100 = ${x}`] });
      return mk(R, { q: `${x} ही संख्या ${n} च्या किती टक्के आहे?`, a: p, fmt: pc, w: [100 - p, p + 10, p - 5], steps: [`टक्के = ${x} × 100 ÷ ${n}`, `= ${p}%`] });
    }
    const n = 100 * R.ri(2, 20), x = 10 * R.ri(1, 4), y = 10 * R.ri(1, 4);
    const mid = n * (100 + x) / 100, a = mid * (100 - y) / 100;
    return mk(R, { q: `एका वस्तूची किंमत ₹${n} आहे. ती आधी ${x}% वाढली आणि नंतर ${y}% कमी झाली. आता किंमत किती?`, a, fmt: rs,
      w: [n * (100 + x - y) / 100, mid, n * (100 - y) / 100],
      steps: [`${x}% वाढ: ${n} × ${100 + x} ÷ 100 = ₹${mid}`, `${y}% घट: ${mid} × ${100 - y} ÷ 100 = ₹${a}`, `(सरळ ${x}−${y} टक्के करणं चूक — दुसरी टक्केवारी नव्या किमतीवर)`] });
  } };

  T.si = { name: 'सरळव्याज', gen(R, L) {
    if (L === 3) {
      const P = 500 * R.ri(2, 20), Rt = R.ri(4, 12), Tm = R.ri(2, 5), I = P * Rt * Tm / 100;
      return mk(R, { q: `₹${P} रकमेवर ${Tm} वर्षांत ₹${I} सरळव्याज मिळाले. व्याजाचा दर दरसाल किती?`, a: Rt, fmt: pc, w: [Rt + 1, Rt * Tm, Rt - 1],
        steps: ['दर = I × 100 ÷ (P × T)', `= ${I} × 100 ÷ (${P} × ${Tm})`, `= ${Rt}%`] });
    }
    const P = L === 1 ? 1000 * R.ri(1, 10) : 500 * R.ri(2, 20), Rt = L === 1 ? R.pick([5, 10]) : R.ri(4, 12), Tm = L === 1 ? R.ri(2, 4) : R.ri(2, 5);
    const I = P * Rt * Tm / 100;
    if (L === 2 && R.r() < 0.5)
      return mk(R, { q: `₹${P} रकमेवर दरसाल ${Rt}% दराने ${Tm} वर्षांनी रास (मुद्दल + व्याज) किती होईल?`, a: P + I, fmt: rs, w: [I, P + P * Rt / 100, P + 2 * I],
        steps: [`व्याज = ${P} × ${Rt} × ${Tm} ÷ 100 = ₹${I}`, `रास = ${P} + ${I} = ₹${P + I}`] });
    return mk(R, { q: `₹${P} रकमेवर दरसाल ${Rt}% दराने ${Tm} वर्षांचे सरळव्याज किती?`, a: I, fmt: rs, w: [P + I, P * Rt / 100, P * Rt * Tm],
      steps: ['सरळव्याज = P × R × T ÷ 100', `= ${P} × ${Rt} × ${Tm} ÷ 100`, `= ₹${I}`] });
  } };

  T.profit = { name: 'नफा-तोटा', gen(R, L) {
    if (L === 1) {
      const CP = R.ri(100, 900, 50), pr = R.ri(20, 200, 10), SP = CP + pr;
      return mk(R, { q: `एक वस्तू ₹${CP} ला घेऊन ₹${SP} ला विकली. नफा किती?`, a: pr, fmt: rs, w: [pr + 10, 2 * pr, CP], steps: [`नफा = विक्री − खरेदी = ${SP} − ${CP} = ₹${pr}`] });
    }
    if (L === 2) {
      const CP = 100 * R.ri(2, 20), p = R.ri(5, 40, 5), SP = CP * (100 + p) / 100;
      return mk(R, { q: `₹${CP} ला घेतलेली वस्तू ₹${SP} ला विकली. शेकडा नफा किती?`, a: p, fmt: pc, w: [p + 5, 2 * p, p - 5],
        steps: [`नफा = ${SP} − ${CP} = ₹${SP - CP}`, `शेकडा नफा = ${SP - CP} × 100 ÷ ${CP} = ${p}%`, '(टक्के नेहमी खरेदी किमतीवर)'] });
    }
    const CP = 100 * R.ri(2, 30), l = R.ri(5, 30, 5), SP = CP * (100 - l) / 100;
    return mk(R, { q: `₹${CP} ला घेतलेली वस्तू ${l}% तोट्याने विकली. विक्री किंमत किती?`, a: SP, fmt: rs, w: [CP * (100 + l) / 100, CP * l / 100, CP - l],
      steps: [`तोटा = ${CP} × ${l} ÷ 100 = ₹${CP * l / 100}`, `विक्री = ${CP} − ${CP * l / 100} = ₹${SP}`] });
  } };

  T.avg = { name: 'सरासरी', gen(R, L) {
    if (L === 1) {
      for (let t = 0; t < 20; t++) {
        const avg = R.ri(10, 60), nums = [0, 1, 2, 3].map(() => avg + R.ri(-9, 9)), last = 5 * avg - nums.reduce((s, x) => s + x, 0);
        if (last <= 0) continue;
        nums.push(last);
        return mk(R, { q: `${nums.join(', ')} यांची सरासरी किती?`, a: avg, w: [avg + 2, avg - 2, avg + 5], steps: [`बेरीज = ${5 * avg}`, `सरासरी = ${5 * avg} ÷ 5 = ${avg}`] });
      }
      return null;
    }
    if (L === 2) {
      const n = R.ri(5, 8), A = R.ri(20, 60), B = A + R.pick([-3, -2, -1, 1, 2, 3]), x = n * A - (n - 1) * B;
      if (x <= 0) return null;
      return mk(R, { q: `${n} संख्यांची सरासरी ${A} आहे. त्यातील एक संख्या वगळल्यास उरलेल्यांची सरासरी ${B} होते. वगळलेली संख्या कोणती?`, a: x, w: [x + n, A + B, x - n],
        steps: [`सर्वांची बेरीज = ${n} × ${A} = ${n * A}`, `उरलेल्या ${n - 1} ची बेरीज = ${n - 1} × ${B} = ${(n - 1) * B}`, `वगळलेली = ${n * A} − ${(n - 1) * B} = ${x}`] });
    }
    const n = R.ri(20, 40), A = R.ri(10, 15), a = A + n + 1;
    return mk(R, { q: `वर्गातील ${n} विद्यार्थ्यांचे सरासरी वय ${A} वर्षे आहे. शिक्षकाचे वय मिळवल्यास सरासरी 1 वर्षाने वाढते. शिक्षकाचे वय किती?`, a, w: [A + n, a + 1, n + 1],
      steps: [`विद्यार्थ्यांची बेरीज = ${n} × ${A} = ${n * A}`, `नवी बेरीज = ${n + 1} × ${A + 1} = ${(n + 1) * (A + 1)}`, `शिक्षक = ${(n + 1) * (A + 1)} − ${n * A} = ${a}`] });
  } };

  T.lcm = { name: 'ल.सा.वि. / म.सा.वि.', gen(R, L) {
    let m, n;
    do { m = R.ri(2, L === 1 ? 6 : 9); n = R.ri(2, L === 1 ? 6 : 9); } while (m === n || gcd(m, n) !== 1);
    const h = L === 1 ? R.ri(2, 9) : R.ri(4, 15), a = h * m, b = h * n, l = h * m * n;
    if (L === 3) {
      return mk(R, { q: `दोन संख्यांचा गुणाकार ${a * b} आहे आणि त्यांचा म.सा.वि. ${h} आहे. त्यांचा ल.सा.वि. किती?`, a: l, w: [a * b * h, 2 * l, a * b / 2],
        steps: ['गुणाकार = म.सा.वि. × ल.सा.वि.', `ल.सा.वि. = ${a * b} ÷ ${h} = ${l}`] });
    }
    if (R.r() < 0.5)
      return mk(R, { q: `${a} आणि ${b} यांचा म.सा.वि. किती?`, a: h, w: [2 * h, m * n, h + 1], steps: [`${a} = ${h} × ${m}`, `${b} = ${h} × ${n}`, `सामाईक मोठा विभाजक = ${h}`] });
    return mk(R, { q: `${a} आणि ${b} यांचा ल.सा.वि. किती?`, a: l, w: [a * b, h, 2 * l], steps: [`म.सा.वि. = ${h}`, `ल.सा.वि. = ${a} × ${b} ÷ ${h} = ${l}`] });
  } };

  T.speed = { name: 'वेग-अंतर-वेळ', gen(R, L) {
    const km = v => v + ' किमी';
    if (L === 1) {
      const v = R.ri(20, 80, 5), t = R.ri(2, 6), d = v * t;
      return mk(R, { q: `एक वाहन ताशी ${v} किमी वेगाने ${t} तास धावले. त्याने किती अंतर कापले?`, a: d, fmt: km, w: [d + v, d - v, v + t], steps: [`अंतर = वेग × वेळ = ${v} × ${t} = ${d} किमी`] });
    }
    if (L === 2) {
      const v = 18 * R.ri(1, 6), ms = v * 5 / 18;
      return mk(R, { q: `ताशी ${v} किमी हा वेग मीटर प्रति सेकंदात किती?`, a: ms, fmt: x => x + ' मी/से', w: [ms + 5, 2 * ms, v * 18 / 5], steps: [`किमी/तास → मी/से: × 5/18`, `${v} × 5 ÷ 18 = ${ms} मी/से`] });
    }
    const t = R.ri(8, 30), ms = 5 * R.ri(2, 8), v = ms * 18 / 5, len = ms * t;
    return mk(R, { q: `${len} मीटर लांबीची आगगाडी ताशी ${v} किमी वेगाने धावते. ती एका खांबाला किती सेकंदात ओलांडेल?`, a: t, fmt: x => x + ' सेकंद', w: [t + 2, 2 * t, t - 2],
      steps: [`वेग = ${v} × 5 ÷ 18 = ${ms} मी/से`, `वेळ = लांबी ÷ वेग = ${len} ÷ ${ms} = ${t} सेकंद`] });
  } };

  T.work = { name: 'काम-वेळ', minL: 2, gen(R) {
    const [a, b] = R.pick([[12, 24], [10, 15], [20, 30], [6, 12], [4, 12], [3, 6], [30, 60], [12, 36], [18, 36], [24, 8], [15, 30], [20, 5]]);
    const d = a * b / (a + b);
    return mk(R, { q: `अ एक काम ${a} दिवसांत आणि ब तेच काम ${b} दिवसांत पूर्ण करतो. दोघे मिळून ते काम किती दिवसांत पूर्ण करतील?`, a: d, fmt: x => x + ' दिवस', w: [a + b, (a + b) / 2, Math.abs(a - b)],
      steps: [`एका दिवसाचे काम = 1/${a} + 1/${b} = ${a + b}/${a * b}`, `दिवस = ${a * b} ÷ ${a + b} = ${d}`] });
  } };

  T.rect = { name: 'क्षेत्रफळ-परिमिती', gen(R, L) {
    const l = R.ri(6, 25), b = R.ri(2, l - 1), sq = v => v + ' चौ.मी.', m = v => v + ' मी';
    if (L === 1) return mk(R, { q: `एका आयताची लांबी ${l} मी आणि रुंदी ${b} मी आहे. त्याचे क्षेत्रफळ किती?`, a: l * b, fmt: sq, w: [2 * (l + b), l + b, l * b + l], steps: [`क्षेत्रफळ = लांबी × रुंदी = ${l} × ${b} = ${l * b} चौ.मी.`] });
    if (L === 2) return mk(R, { q: `एका आयताचे क्षेत्रफळ ${l * b} चौ.मी. आणि लांबी ${l} मी आहे. त्याची परिमिती किती?`, a: 2 * (l + b), fmt: m, w: [l + b, 2 * l + b, l * b],
      steps: [`रुंदी = ${l * b} ÷ ${l} = ${b} मी`, `परिमिती = 2 × (${l} + ${b}) = ${2 * (l + b)} मी`] });
    const P = 2 * (l + b);
    return mk(R, { q: `एका आयताची परिमिती ${P} मी आणि लांबी ${l} मी आहे. त्याचे क्षेत्रफळ किती?`, a: l * b, fmt: sq, w: [P * l, l * (P - l), l * (P / 2)],
      steps: [`रुंदी = ${P} ÷ 2 − ${l} = ${b} मी`, `क्षेत्रफळ = ${l} × ${b} = ${l * b} चौ.मी.`] });
  } };

  // ---------- reasoning ----------
  T.series = { name: 'संख्या मालिका', gen(R, L) {
    const ask = (terms, a, w, steps) => mk(R, { q: `मालिकेतील पुढील संख्या कोणती?  ${terms.join(', ')}, ?`, a, w, steps });
    if (L === 1) {
      const a = R.ri(2, 20), d = R.ri(2, 9), t = [0, 1, 2, 3, 4].map(i => a + i * d), ans = a + 5 * d;
      return ask(t, ans, [ans + d, ans - 1, ans + 1], [`प्रत्येक वेळी +${d}`, `${t[4]} + ${d} = ${ans}`]);
    }
    if (L === 2) {
      if (R.r() < 0.5) {
        const a = R.ri(2, 15), d = R.ri(1, 5), k = R.ri(1, 3), t = [a];
        for (let i = 0; i < 5; i++) t.push(t[i] + d + i * k);
        const ans = t.pop();
        return ask(t, ans, [ans + k, ans - k, t[4] + d + 3 * k], [`फरक: ${t.slice(1).map((x, i) => '+' + (x - t[i])).join(', ')} — दर वेळी ${k} ने वाढतो`, `पुढचा फरक +${ans - t[4]} → ${ans}`]);
      }
      const a = R.ri(2, 5), r = R.pick([2, 3]), t = [0, 1, 2, 3, 4].map(i => a * r ** i), ans = a * r ** 5;
      return ask(t, ans, [t[4] + r, ans + t[4], ans - a], [`प्रत्येक वेळी × ${r}`, `${t[4]} × ${r} = ${ans}`]);
    }
    const kind = R.ri(0, 2);
    if (kind === 0) {
      const s = R.ri(2, 6), c = R.pick([-1, 1, 2]), f = i => (s + i) ** 2 + c, t = [0, 1, 2, 3, 4].map(f), ans = f(5);
      return ask(t, ans, [ans + 1, ans - 1, f(6)], [`${s}², ${s + 1}², ${s + 2}²… ${c > 0 ? '+' : '−'} ${Math.abs(c)}`, `${s + 5}² ${c > 0 ? '+' : '−'} ${Math.abs(c)} = ${ans}`]);
    }
    if (kind === 1) {
      const s = R.ri(1, 4), t = [0, 1, 2, 3, 4].map(i => (s + i) ** 3), ans = (s + 5) ** 3;
      return ask(t, ans, [ans + 1, (s + 5) ** 2, ans - (s + 5)], [`घन संख्या: ${s}³, ${s + 1}³ …`, `${s + 5}³ = ${ans}`]);
    }
    const a = R.ri(1, 6), add = R.ri(1, 5), t = [a];
    for (let i = 0; i < 5; i++) t.push(i % 2 === 0 ? t[i] * 2 : t[i] + add);
    const ans = t.pop();
    return ask(t, ans, [t[4] + add, ans + add, t[4] * 2 + add], [`आलटून-पालटून: × 2, + ${add}`, `${t[4]} ${t.length % 2 === 1 ? '× 2' : '+ ' + add} = ${ans}`]);
  } };

  const AB = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', ch = i => AB[((i % 26) + 26) % 26];
  T.letters = { name: 'अक्षर मालिका', gen(R, L) {
    const ask = (t, a, w, steps) => mk(R, { q: `मालिकेतील पुढील पद कोणते?  ${t.join(', ')}, ?`, a, w, steps });
    if (L === 1) {
      const k = R.ri(1, 3), s = R.ri(0, 25 - 5 * k), t = [0, 1, 2, 3].map(i => AB[s + i * k]), p = s + 4 * k;
      return ask(t, AB[p], [ch(p + 1), ch(p - 1), ch(p + k + 1)], [`प्रत्येक वेळी ${k} अक्षरं पुढे`, `${t[3]} + ${k} = ${AB[p]}`]);
    }
    if (L === 2) {
      const s = R.ri(0, 13), pos = [0, 1, 3, 6].map(x => s + x), p = s + 10;
      return ask(pos.map(i => AB[i]), AB[p], [ch(p + 1), ch(p - 1), ch(p + 2)], ['अंतर +1, +2, +3, … वाढत जाते', `${AB[s + 6]} + 4 = ${AB[p]}`]);
    }
    const i0 = R.ri(0, 8), pair = i => AB[i0 + i] + AB[25 - i0 - i], t = [0, 1, 2].map(pair);
    return ask(t, pair(3), [AB[i0 + 3] + AB[25 - i0 - 2], AB[i0 + 4] + AB[25 - i0 - 3], AB[i0 + 3] + AB[25 - i0 - 4]], ['पहिलं अक्षर पुढे (A→B→C), दुसरं उलट (Z→Y→X)', `→ ${pair(3)}`]);
  } };

  T.code = { name: 'सांकेतिक भाषा', gen(R, L) {
    const words = ['CAT', 'DOG', 'SUN', 'PEN', 'BOOK', 'TREE', 'FISH', 'LAMP', 'STAR', 'MILK', 'RAIN', 'BALL', 'GOLD', 'NOTE'];
    const [w1, w2] = R.shuffle(words);
    const sh = (w, k) => w.split('').map(c => ch(AB.indexOf(c) + k)).join(''), rev = w => w.split('').reverse().join('');
    const k = L === 1 ? R.pick([1, 2]) : L === 2 ? R.pick([-1, -2, 3]) : 1;
    const enc = w => L === 3 ? rev(sh(w, k)) : sh(w, k);
    const ks = (k > 0 ? '+' : '') + k;
    return mk(R, { q: `एका सांकेतिक भाषेत ${w1} हा शब्द ${enc(w1)} असा लिहितात. तर ${w2} कसा लिहाल?`, a: enc(w2),
      w: L === 3 ? [sh(w2, k), rev(sh(w2, k + 1)), rev(w2)] : [sh(w2, k + 1), sh(w2, k === 1 ? -1 : k - 1), rev(sh(w2, k))],
      steps: L === 3 ? [`प्रत्येक अक्षर +1 आणि शब्द उलटा`, `${w2} → ${sh(w2, 1)} → ${enc(w2)}`] : [`प्रत्येक अक्षर ${ks}`, `${w2} → ${enc(w2)}`] });
  } };

  const DAYS = ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
  const MON = ['जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून', 'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'];
  T.calendar = { name: 'दिनदर्शिका', gen(R, L) {
    const d = R.ri(0, 6);
    if (L === 1) {
      const N = R.ri(10, 100), a = (d + N) % 7;
      return mk(R, { q: `आज ${DAYS[d]} आहे. ${N} दिवसांनंतर कोणता वार असेल?`, a: DAYS[a], w: [DAYS[(a + 1) % 7], DAYS[(a + 6) % 7], DAYS[(a + 2) % 7]],
        steps: [`${N} ÷ 7 → बाकी ${N % 7}`, `${DAYS[d]} + ${N % 7} दिवस = ${DAYS[a]}`] });
    }
    const leap = L === 3, len = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const m1 = R.ri(0, 5), m2 = R.ri(m1 + 1, 11), d1 = R.ri(1, len[m1]), d2 = R.ri(1, len[m2]);
    const doy = (m, dd) => len.slice(0, m).reduce((s, x) => s + x, 0) + dd, N = doy(m2, d2) - doy(m1, d1), a = (d + N) % 7;
    return mk(R, { q: `एका ${leap ? 'लीप' : 'साध्या (लीप नसलेल्या)'} वर्षी ${d1} ${MON[m1]} रोजी ${DAYS[d]} होता. तर त्याच वर्षी ${d2} ${MON[m2]} रोजी कोणता वार असेल?`,
      a: DAYS[a], w: [DAYS[(a + 1) % 7], DAYS[(a + 6) % 7], DAYS[(a + 2) % 7]],
      steps: [`मधले दिवस = ${N}${m1 <= 1 && m2 >= 2 ? ` (फेब्रुवारी ${len[1]} दिवस)` : ''}`, `${N} ÷ 7 → बाकी ${N % 7}`, `${DAYS[d]} + ${N % 7} = ${DAYS[a]}`] });
  } };

  T.age = { name: 'वय', gen(R, L) {
    const yr = v => v + ' वर्षे';
    if (L === 1) {
      const s = R.ri(5, 15), g = R.ri(20, 32), y = R.ri(2, 10);
      return mk(R, { q: `आई मुलापेक्षा ${g} वर्षांनी मोठी आहे. मुलाचे आजचे वय ${s} वर्षे आहे. ${y} वर्षांनंतर आईचे वय किती असेल?`, a: s + g + y, fmt: yr, w: [s + g, g + y, s + g + 2 * y],
        steps: [`आईचे आजचे वय = ${s} + ${g} = ${s + g}`, `${y} वर्षांनंतर = ${s + g} + ${y} = ${s + g + y}`] });
    }
    if (L === 2) {
      const [p, q] = R.pick([[3, 5], [2, 3], [4, 7], [5, 6], [3, 4], [5, 7]]), k = R.ri(3, 8), S = (p + q) * k;
      return mk(R, { q: `राम आणि श्याम यांच्या आजच्या वयांचे गुणोत्तर ${p}:${q} आहे. त्यांच्या वयांची बेरीज ${S} वर्षे आहे. श्यामचे वय किती?`, a: q * k, fmt: yr, w: [p * k, q * k + q, S / 2],
        steps: [`एकूण भाग = ${p} + ${q} = ${p + q}`, `एक भाग = ${S} ÷ ${p + q} = ${k}`, `श्याम = ${q} × ${k} = ${q * k}`] });
    }
    const m = R.ri(2, 4), b = R.ri(3, 10), y = R.ri(3, 8), S = (m + 1) * b + 2 * y, A = m * b + y;
    return mk(R, { q: `${y} वर्षांपूर्वी रामचे वय श्यामच्या वयाच्या ${m} पट होते. आज दोघांच्या वयांची बेरीज ${S} वर्षे आहे. रामचे आजचे वय किती?`, a: A, fmt: yr, w: [m * b, b + y, m * (b + y)],
      steps: [`${y} वर्षांपूर्वीची बेरीज = ${S} − 2 × ${y} = ${S - 2 * y}`, `तेव्हा श्याम = ${S - 2 * y} ÷ ${m + 1} = ${b}, राम = ${m} × ${b} = ${m * b}`, `रामचे आजचे वय = ${m * b} + ${y} = ${A}`] });
  } };

  // ---------- fact banks (sample — real banks are filled per exam) ----------
  const GK = [
    ['महाराष्ट्र राज्याची स्थापना कधी झाली?', '1 मे 1960', ['15 ऑगस्ट 1947', '26 जानेवारी 1950', '1 नोव्हेंबर 1956']],
    ['महाराष्ट्राचे पहिले मुख्यमंत्री कोण?', 'यशवंतराव चव्हाण', ['वसंतराव नाईक', 'शंकरराव चव्हाण', 'मारोतराव कन्नमवार']],
    ['महाराष्ट्रातील सर्वोच्च शिखर कोणते?', 'कळसूबाई', ['साल्हेर', 'महाबळेश्वर', 'तोरणा']],
    ['महाराष्ट्राची उपराजधानी कोणती?', 'नागपूर', ['पुणे', 'नाशिक', 'कोल्हापूर']],
    ['महाराष्ट्राचा राज्य प्राणी कोणता?', 'शेकरू', ['वाघ', 'हरीण', 'हत्ती']],
    ['महाराष्ट्राचा राज्य पक्षी कोणता?', 'हरियाल', ['मोर', 'पोपट', 'सारस']],
    ['महाराष्ट्राचे राज्य फूल कोणते?', 'ताम्हण', ['कमळ', 'गुलाब', 'झेंडू']],
    ['भारताचे पहिले राष्ट्रपती कोण?', 'डॉ. राजेंद्र प्रसाद', ['डॉ. सर्वपल्ली राधाकृष्णन', 'डॉ. झाकीर हुसेन', 'पं. जवाहरलाल नेहरू']],
    ['भारतीय संविधान कधी अंमलात आले?', '26 जानेवारी 1950', ['15 ऑगस्ट 1947', '26 नोव्हेंबर 1949', '1 मे 1960']],
    ['भारतीय संविधानाचे शिल्पकार कोणास म्हणतात?', 'डॉ. बाबासाहेब आंबेडकर', ['पं. जवाहरलाल नेहरू', 'सरदार वल्लभभाई पटेल', 'डॉ. राजेंद्र प्रसाद']],
    ['महाराष्ट्रातील सर्वात लांब नदी कोणती?', 'गोदावरी', ['कृष्णा', 'भीमा', 'तापी']],
    ['सध्या महाराष्ट्रात किती जिल्हे आहेत?', '36', ['35', '34', '38']],
    ['सह्याद्री पर्वताला दुसरे कोणते नाव आहे?', 'पश्चिम घाट', ['पूर्व घाट', 'सातपुडा', 'अरवली']],
    ['छत्रपती शिवाजी महाराजांचा राज्याभिषेक कोणत्या किल्ल्यावर झाला?', 'रायगड', ['शिवनेरी', 'प्रतापगड', 'सिंहगड']],
    ['छत्रपती शिवाजी महाराजांचा जन्म कोणत्या किल्ल्यावर झाला?', 'शिवनेरी', ['रायगड', 'राजगड', 'तोरणा']],
  ];
  const SYN = [['पाणी', 'जल'], ['सूर्य', 'रवी'], ['चंद्र', 'शशी'], ['घर', 'सदन'], ['डोळा', 'नयन'], ['आई', 'माता'], ['पृथ्वी', 'धरणी'], ['झाड', 'वृक्ष']];
  const ANT = [['दिवस', 'रात्र'], ['सुख', 'दुःख'], ['खरे', 'खोटे'], ['आशा', 'निराशा'], ['स्तुती', 'निंदा'], ['जय', 'पराजय'], ['आरंभ', 'शेवट'], ['ज्ञानी', 'अज्ञानी']];

  function factPool() {
    const pool = [];
    GK.forEach(([q, a, w]) => pool.push({ sec: 'gk', name: 'सामान्य ज्ञान', mk: R => mk(R, { q, a, w, steps: [`उत्तर: ${a}`] }) }));
    SYN.forEach(([x, y], i) => pool.push({ sec: 'mr', name: 'समानार्थी शब्द', mk: R => mk(R, { q: `'${x}' या शब्दाचा समानार्थी शब्द कोणता?`, a: y, w: R.shuffle(SYN.filter((_, j) => j !== i).map(p => p[1])), steps: [`${x} = ${y}`] }) }));
    ANT.forEach(([x, y], i) => pool.push({ sec: 'mr', name: 'विरुद्धार्थी शब्द', mk: R => mk(R, { q: `'${x}' या शब्दाचा विरुद्धार्थी शब्द कोणता?`, a: y, w: R.shuffle([...ANT.filter((_, j) => j !== i).map(p => p[1]), ...SYN.map(p => p[1])]), steps: [`${x} × ${y}`] }) }));
    return pool;
  }

  // ---------- exam profiles (sample counts — to be replaced after studying real papers) ----------
  const EXAMS = {
    police: { name: 'पोलीस भरती', note: 'सोपे–मध्यम, जलद गणित', mix: [0.55, 0.35, 0.10], neg: 0,
      sections: [
        { name: 'अंकगणित', n: 5, topics: ['percent', 'si', 'profit', 'avg', 'speed', 'rect', 'lcm'] },
        { name: 'बुद्धिमत्ता', n: 5, topics: ['series', 'letters', 'code', 'calendar', 'age'] },
        { name: 'मराठी व्याकरण', n: 5, facts: 'mr' },
        { name: 'सामान्य ज्ञान', n: 5, facts: 'gk' }] },
    talathi: { name: 'तलाठी भरती', note: 'मध्यम, थोडे कठीण', mix: [0.2, 0.5, 0.3], neg: 0,
      sections: [
        { name: 'अंकगणित', n: 5, topics: ['percent', 'si', 'profit', 'avg', 'work', 'speed', 'lcm', 'rect'] },
        { name: 'बुद्धिमत्ता', n: 5, topics: ['series', 'letters', 'code', 'calendar', 'age'] },
        { name: 'मराठी व्याकरण', n: 5, facts: 'mr' },
        { name: 'सामान्य ज्ञान', n: 5, facts: 'gk' }] },
    nmms: { name: '8वी NMMS', note: 'मध्यम–कठीण, विचार करायला लावणारे', mix: [0.1, 0.4, 0.5], neg: 0,
      sections: [
        { name: 'बुद्धिमत्ता (MAT)', n: 10, topics: ['series', 'letters', 'code', 'calendar', 'age'] },
        { name: 'गणित (SAT)', n: 10, topics: ['percent', 'lcm', 'si', 'profit', 'avg', 'work', 'speed', 'rect'] }] },
  };

  function paper(examKey, opts = {}) {
    const ex = EXAMS[examKey], seed = opts.seed || (Date.now() % 1e9), R = tools(seed);
    const levelOf = () => {
      if (opts.level) return opts.level;
      const x = R.r(); return x < ex.mix[0] ? 1 : x < ex.mix[0] + ex.mix[1] ? 2 : 3;
    };
    const facts = R.shuffle(factPool()), seen = new Set(), out = [];
    for (const s of ex.sections) {
      const qs = [];
      if (s.facts) {
        for (const f of facts) { if (qs.length >= s.n) break; if (f.sec !== s.facts) continue; const q = f.mk(R); if (q && !seen.has(q.q)) { seen.add(q.q); qs.push({ ...q, topic: f.name, level: 1 }); } }
      } else {
        let order = R.shuffle(s.topics);
        for (let i = 0, tries = 0; qs.length < s.n && tries < 200; tries++) {
          const key = order[i % order.length]; i++;
          const t = T[key]; let L = levelOf(); if (t.minL && L < t.minL) L = t.minL;
          const q = t.gen(R, L);
          if (q && !seen.has(q.q)) { seen.add(q.q); qs.push({ ...q, topic: t.name, level: L }); }
        }
      }
      out.push({ name: s.name, questions: qs });
    }
    return { exam: ex.name, note: ex.note, seed, sections: out };
  }

  const api = { paper, EXAMS, TEMPLATES: T, tools };
  if (typeof module !== 'undefined') module.exports = api; else root.QGen = api;
})(this);

// Scholarship (4th / 7th) question types, built from the 2020–2024 papers. No AI: answers computed by code.
(function (root) {
  'use strict';
  const G = (typeof module !== 'undefined') ? require('./engine.js') : root.QGen;
  const T0 = G.TEMPLATES;

  function mk(R, o) {
    const fmt = o.fmt || (v => String(v));
    const A = fmt(o.a), ws = [];
    const add = v => {
      if (v === undefined || v === null || (typeof v === 'number' && (!isFinite(v) || v <= 0 || v !== Math.round(v)))) return;
      const s = fmt(v); if (s !== A && !ws.includes(s) && !/NaN|undefined/.test(s)) ws.push(s);
    };
    o.w.forEach(add);
    if (typeof o.a === 'number') for (let k = 1; ws.length < 3 && k < 60; k++) [o.a + k, o.a - k].forEach(v => ws.length < 3 && add(v));
    if (ws.length < 3) return null;
    const opts = R.shuffle([A, ...ws.slice(0, 3)]);
    return { q: o.q, fig: o.fig || '', sfig: o.sfig || '', options: { A: opts[0], B: opts[1], C: opts[2], D: opts[3] }, answer: 'ABCD'[opts.indexOf(A)], steps: o.steps || [] };
  }
  const nf = v => (Math.abs(v) >= 10000 ? v.toLocaleString('en-IN') : String(v));
  const rs = v => '₹' + nf(v);
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const frac = (p, q) => { const g = gcd(p, q); p /= g; q /= g; return q === 1 ? String(p) : `${p}/${q}`; };
  const W = ['शून्य', 'एक', 'दोन', 'तीन', 'चार', 'पाच', 'सहा', 'सात', 'आठ', 'नऊ', 'दहा', 'अकरा', 'बारा', 'तेरा', 'चौदा', 'पंधरा', 'सोळा', 'सतरा', 'अठरा', 'एकोणीस', 'वीस', 'एकवीस', 'बावीस', 'तेवीस', 'चोवीस', 'पंचवीस', 'सव्वीस', 'सत्तावीस', 'अठ्ठावीस', 'एकोणतीस', 'तीस'];
  const DAYS = ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
  const AB = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const T = {};
  // old templates with the grade folded into the level (7th = one step harder)
  const wrap = (key, name) => ({ name, gen: (R, L, g7) => { const t = T0[key]; let l = Math.min(3, L + (g7 ? 1 : 0)); if (t.minL && l < t.minL) l = t.minL; return t.gen(R, l); } });

  // ═════════════ गणित ═════════════
  T.sawa = { name: 'सव्वा / साडे / पावणे', gen(R, L, g7) {
    const unit = (g7 || L > 1) && R.r() < 0.5 ? 'लाख' : 'हजार', m = unit === 'हजार' ? 1000 : 100000;
    const n = R.ri(3, 30), kind = R.pick(['सव्वा', 'साडे', 'पावणे']);
    const val = kind === 'सव्वा' ? n * m + m / 4 : kind === 'साडे' ? n * m + m / 2 : n * m - m / 4;
    const ph = `${kind} ${W[n]} ${unit}`;
    const why = kind === 'सव्वा' ? `सव्वा = ${W[n]} ${unit} + पाव (${nf(m / 4)})` : kind === 'साडे' ? `साडे = ${W[n]} ${unit} + अर्धा (${nf(m / 2)})` : `पावणे = ${W[n]} ${unit} − पाव (${nf(m / 4)})`;
    if (L === 1 && !g7) return mk(R, { q: `"${ph}" ही संख्या अंकांत कशी लिहाल?`, a: val, fmt: nf,
      w: [n * m + m / 4, n * m + m / 2, n * m + 3 * m / 4, n * m - m / 4, (n - 1) * m + m / 4], steps: [why, `= ${nf(val)}`] });
    if (unit === 'हजार') return mk(R, { q: `"${ph}" या संख्येतून किती वजा केल्यास लहानात लहान चार अंकी सम संख्या मिळेल?`, a: val - 1000, fmt: nf,
      w: [val - 1001, val - 999, (kind === 'पावणे' ? n * m + 3 * m / 4 : n * m - m / 4) - 1000, val - 100], steps: [why, `= ${nf(val)}`, 'लहानात लहान चार अंकी सम संख्या = 1000', `${nf(val)} − 1000 = ${nf(val - 1000)}`] });
    const k = R.ri(2, 9), v2 = k * m + m / 4;
    return mk(R, { q: `"${ph}" आणि "सव्वा ${W[k]} लाख" यांची बेरीज किती?`, a: val + v2, fmt: nf,
      w: [val + v2 + m / 4, val + v2 - m / 2, val + k * m, val + v2 + m], steps: [why, `= ${nf(val)}`, `सव्वा ${W[k]} लाख = ${nf(v2)}`, `बेरीज = ${nf(val + v2)}`] });
  } };

  const PLACE = ['एकक', 'दशक', 'शतक', 'हजार', 'दशहजार', 'लाख', 'दशलाख'];
  T.place = { name: 'स्थानिक किंमत', gen(R, L, g7) {
    const len = Math.min(7, 4 + L + (g7 ? 1 : 0));
    const ds = R.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, len);
    if (ds[0] === 0) [ds[0], ds[1]] = [ds[1], ds[0]];
    const N = +ds.join(''), p = R.ri(1, len - 1), d = ds[len - 1 - p];
    if (d === 0) return null;
    const a = d * 10 ** p;
    return mk(R, { q: `${nf(N)} या संख्येतील ${d} ची स्थानिक किंमत किती?`, a, fmt: nf, w: [d * 10 ** (p + 1), d * 10 ** (p - 1), d, d * 10 ** (p + 2)],
      steps: [`${d} हा ${PLACE[p]} स्थानी आहे`, `स्थानिक किंमत = ${d} × ${nf(10 ** p)} = ${nf(a)}`, `(${d} ही दर्शनी किंमत)`] });
  } };

  T.extremes = { name: 'लहानात लहान / मोठ्यात मोठी संख्या', gen(R, L, g7) {
    const top = 3 + L + (g7 ? 1 : 0);
    const D = { 'लहानात लहान विषम': k => 10 ** (k - 1) + 1, 'मोठ्यात मोठी सम': k => 10 ** k - 2, 'लहानात लहान सम': k => 10 ** (k - 1), 'मोठ्यात मोठी विषम': k => 10 ** k - 1 };
    const names = Object.keys(D), d1 = R.pick(names), d2 = R.pick(names.filter(x => x !== d1));
    const k1 = R.ri(2, top), k2 = R.ri(2, top);
    const a = D[d1](k1), b = D[d2](k2), ans = Math.abs(a - b);
    if (ans === 0) return null;
    return mk(R, { q: `${W[k1]} अंकी ${d1} संख्या आणि ${W[k2]} अंकी ${d2} संख्या यांतील फरक किती?`, a: ans, fmt: nf, w: [a + b, ans + 2, ans - 2, ans + 10],
      steps: [`${W[k1]} अंकी ${d1} = ${nf(a)}`, `${W[k2]} अंकी ${d2} = ${nf(b)}`, `फरक = ${nf(ans)}`] });
  } };

  function perms(a) { if (a.length <= 1) return [a]; const o = []; a.forEach((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).forEach(p => o.push([x, ...p]))); return o; }
  T.digits = { name: 'दिलेल्या अंकांपासून संख्या', gen(R, L, g7) {
    const n = Math.min(6, 4 + L + (g7 ? 1 : 0) - 1);
    const ds = R.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, n - 1).concat([0]);
    if (!ds.some(x => x % 2) || !ds.some(x => x && x % 2 === 0)) return null;
    const all = perms(ds).filter(p => p[0] !== 0).map(p => +p.join(''));
    const big = R.r() < 0.5, odd = R.r() < 0.5;
    const pick = arr => (big ? Math.max(...arr) : Math.min(...arr));
    const same = all.filter(x => x % 2 === (odd ? 1 : 0)), other = all.filter(x => x % 2 === (odd ? 0 : 1));
    const a = pick(same), rest = same.filter(x => x !== a);
    const desc = `${big ? 'मोठ्यात मोठी' : 'लहानात लहान'} ${odd ? 'विषम' : 'सम'}`;
    return mk(R, { q: `${R.shuffle(ds).join(', ')} यांपैकी प्रत्येक अंक एकदाच वापरून ${W[n]} अंकी ${desc} संख्या कोणती?`, a, w: [pick(all), pick(other), pick(rest)],
      steps: [odd ? 'विषम संख्येच्या एकक स्थानी विषम अंक हवा' : 'सम संख्येच्या एकक स्थानी सम अंक (0 सुद्धा) हवा', big ? 'उरलेले अंक मोठ्याकडून लहानाकडे' : 'उरलेले अंक लहानाकडून मोठ्याकडे (सुरुवातीला 0 नाही)', `उत्तर: ${a}`] });
  } };

  const roman = n => { const v = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [x, r] of v) while (n >= x) { s += r; n -= x; } return s; };
  T.roman = { name: 'रोमन अंक', gen(R, L, g7) {
    const top = [0, 40, 100, 1000][Math.min(3, L + (g7 ? 1 : 0))], n = R.ri(4, top);
    return mk(R, { q: `${n} ही संख्या रोमन अंकांत कशी लिहाल?`, a: roman(n), w: [roman(n + 1), roman(n - 1), roman(n + 10), roman(n + 5)],
      steps: ['I=1, V=5, X=10, L=50, C=100, D=500, M=1000', 'लहान अंक मोठ्याच्या आधी आला की वजा (IV=4, IX=9, XL=40)', `${n} = ${roman(n)}`] });
  } };

  T.count = { name: 'डझन / ग्रोस / रीम', gen(R, L, g7) {
    if (L === 1 && !g7) {
      const a = R.ri(2, 9), b = R.ri(1, 5);
      return mk(R, { q: `${a} डझन + ${b} ग्रोस = किती डझन?`, a: a + 12 * b, w: [a + b, a * 12 + b * 144, a + 144 * b, a + 12 * b + 12], steps: ['1 ग्रोस = 12 डझन', `${b} ग्रोस = ${12 * b} डझन`, `${a} + ${12 * b} = ${a + 12 * b} डझन`] });
    }
    const a = R.ri(1, 5), b = R.ri(1, Math.floor(a * 480 / 144) - 1 || 1), left = a * 480 - b * 144;
    if (left <= 0) return null;
    return mk(R, { q: `${a} रीम कागदांपैकी ${b} ग्रोस कागद वापरले. तर किती डझन कागद शिल्लक राहिले?`, a: left / 12, w: [left, (a * 480 + b * 144) / 12, 40 * a - b, (a * 500 - b * 144) / 12],
      steps: ['1 रीम = 480 कागद, 1 ग्रोस = 144, 1 डझन = 12', `${a} × 480 − ${b} × 144 = ${left} कागद`, `${left} ÷ 12 = ${left / 12} डझन`] });
  } };

  T.measure = { name: 'कि.ग्रॅ.–ग्रॅ., ली.–मिली, किमी–मी', gen(R, L, g7) {
    const U = R.pick([['कि.ग्रॅ.', 'ग्रॅ.'], ['लीटर', 'मिली'], ['किमी', 'मी']]);
    const st = L === 1 ? 50 : L === 2 ? 10 : 5;
    const x = R.ri(2, 60) * 1000 + R.ri(1, 19) * st * 10 % 1000, y = R.ri(1, 30) * 1000 + R.ri(1, 19) * st * 10 % 1000;
    const add = R.r() < 0.5, big = Math.max(x, y), sm = Math.min(x, y), ans = add ? x + y : big - sm;
    if (ans <= 0) return null;
    const dec = g7 && L >= 2;
    const fmt = v => dec ? `${(v / 1000).toFixed(3)} ${U[0]}` : `${Math.floor(v / 1000)} ${U[0]} ${v % 1000} ${U[1]}`;
    const f2 = v => `${Math.floor(v / 1000)} ${U[0]} ${v % 1000} ${U[1]}`;
    const [p, q] = add ? [x, y] : [big, sm];
    return mk(R, { q: `${f2(p)} ${add ? '+' : '−'} ${f2(q)} = किती?`, a: ans, fmt, w: [ans + 1000, ans - 100, ans + 100, ans - 1000],
      steps: [`सगळे ${U[1]} मध्ये: ${p} ${add ? '+' : '−'} ${q} = ${ans} ${U[1]}`, `1000 ${U[1]} = 1 ${U[0]} → ${fmt(ans)}`] });
  } };

  T.fracAdd = { name: 'अपूर्णांकांची बेरीज', gen(R, L, g7) {
    const l = Math.min(3, L + (g7 ? 1 : 0));
    if (l === 1) {
      const b = R.ri(3, 12), a = R.ri(1, b - 1), c = R.ri(1, b - 1);
      return mk(R, { q: `${a}/${b} + ${c}/${b} = ?`, a: frac(a + c, b), w: [frac(a + c, 2 * b), frac(a + c + 1, b), frac(a * c, b), frac(a + c, b + 1)], steps: ['छेद सारखे → फक्त अंश मिळवा', `${a} + ${c} = ${a + c}`, `= ${frac(a + c, b)}`] });
    }
    const b = R.ri(2, 9), d = R.ri(2, 9); if (b === d) return null;
    const a = R.ri(1, b - 1), c = R.ri(1, d - 1), p = a * d + c * b, q = b * d;
    if (l === 2) return mk(R, { q: `${a}/${b} + ${c}/${d} = ?`, a: frac(p, q), w: [frac(a + c, b + d), frac(a + c, b * d), frac(p, b + d), frac(p + 1, q)], steps: [`छेद सारखे करा: ${a}/${b} = ${a * d}/${q}, ${c}/${d} = ${c * b}/${q}`, `${a * d} + ${c * b} = ${p}`, `= ${frac(p, q)}`] });
    const e = R.ri(2, 8), f = R.ri(1, e - 1), P = p * e + f * q, Q = q * e;
    return mk(R, { q: `${a}/${b} + ${c}/${d} + ${f}/${e} = ?`, a: frac(P, Q), w: [frac(a + c + f, b + d + e), frac(P + Q / gcd(P, Q), Q), frac(p, q), frac(P, Q * 2)], steps: [`सामाईक छेद ${Q}`, `अंशांची बेरीज = ${P}`, `= ${frac(P, Q)}`] });
  } };

  T.fracOf = { name: 'संख्येची अपूर्णांक पट', gen(R, L, g7) {
    const b = R.ri(2, 9 + (g7 ? 3 : 0)), a = R.ri(1, b - 1), n = b * R.ri(2, 12); if (gcd(a, b) !== 1) return null;
    return mk(R, { q: `${n} ची ${a}/${b} पट किती?`, a: n * a / b, w: [n / b, n * a, n - n * a / b, n * a / b + a], steps: [`${n} ÷ ${b} = ${n / b}`, `${n / b} × ${a} = ${n * a / b}`], sfig: b <= 12 ? sfFracBar(n, a, b) : '' });
  } };

  T.fracOrder = { name: 'अपूर्णांकांची तुलना', gen(R, L, g7) {
    const l = Math.min(3, L + (g7 ? 1 : 0)), big = R.r() < 0.5, fs = [];
    if (l === 1) { const q = R.ri(5, 12); R.shuffle([...Array(q - 1).keys()].map(x => x + 1)).slice(0, 4).forEach(p => fs.push([p, q])); }
    else if (l === 2) { const p = R.ri(1, 5); R.shuffle([...Array(10).keys()].map(x => x + p + 1)).slice(0, 4).forEach(q => fs.push([p, q])); }
    else { const seen = new Set(); for (let t = 0; fs.length < 4 && t < 50; t++) { const q = R.ri(3, 12), p = R.ri(1, q - 1), v = (p / q).toFixed(6); if (!seen.has(v)) { seen.add(v); fs.push([p, q]); } } }
    if (fs.length < 4) return null;
    const val = f => f[0] / f[1], best = fs.reduce((x, y) => ((big ? val(y) > val(x) : val(y) < val(x)) ? y : x));
    const s = f => `${f[0]}/${f[1]}`;
    return mk(R, { q: `खालीलपैकी सर्वांत ${big ? 'मोठा' : 'लहान'} अपूर्णांक कोणता?`, a: s(best), w: fs.filter(f => f !== best).map(s),
      steps: [l === 1 ? `छेद सारखे → ज्याचा अंश ${big ? 'मोठा' : 'लहान'} तो ${big ? 'मोठा' : 'लहान'}` : l === 2 ? `अंश सारखे → ज्याचा छेद ${big ? 'लहान' : 'मोठा'} तो ${big ? 'मोठा' : 'लहान'}` : 'तिरकस गुणाकार करून तुलना करा', `उत्तर: ${s(best)}`] });
  } };

  const pl = (d, other) => [`₹${nf(Math.abs(d))} ${d > 0 ? 'नफा' : 'तोटा'}`, other];
  T.profit2 = { name: 'नफा-तोटा (व्यवहार)', gen(R, L, g7) {
    const l = Math.min(3, L + (g7 ? 1 : 0)); const lab = d => `₹${nf(Math.abs(d))} ${d > 0 ? 'नफा' : 'तोटा'}`, flip = d => `₹${nf(Math.abs(d))} ${d > 0 ? 'तोटा' : 'नफा'}`;
    if (l === 1) {
      const CP = R.ri(10, 60) * 50, SP = CP + R.pick([-1, 1]) * R.ri(2, 20) * 10, d = SP - CP;
      return mk(R, { q: `${nf(CP)} रुपयांना घेतलेली वस्तू ${nf(SP)} रुपयांना विकली. नफा झाला की तोटा, आणि किती?`, a: lab(d), w: [flip(d), lab(d + 50 * Math.sign(d)), lab(2 * d)], steps: [`विक्री ${nf(SP)}, खरेदी ${nf(CP)}`, d > 0 ? `विक्री जास्त → ₹${nf(d)} नफा` : `विक्री कमी → ₹${nf(-d)} तोटा`] });
    }
    if (l === 2) {
      const CP = R.ri(20, 400) * 100, E = R.ri(5, 60) * 50, SP = CP + E + R.pick([-1, 1]) * R.ri(2, 40) * 50, d = SP - CP - E;
      return mk(R, { q: `एकाने जुनी गाडी ${nf(CP)} रुपयांना घेतली, दुरुस्तीसाठी ${nf(E)} रुपये खर्च केले आणि ती ${nf(SP)} रुपयांना विकली. नफा की तोटा, किती?`, a: lab(d), w: [flip(d), lab(SP - CP), lab(d + E * Math.sign(d)), lab(2 * d), flip(SP - CP)],
        steps: [`एकूण खर्च = ${nf(CP)} + ${nf(E)} = ${nf(CP + E)}`, `${nf(SP)} − ${nf(CP + E)} → ${d > 0 ? 'विक्री जास्त → ₹' + nf(d) + ' नफा' : 'विक्री कमी → ₹' + nf(-d) + ' तोटा'}`] });
    }
    const dz = R.ri(5, 40), r = R.ri(4, 12) * 10, s = R.ri(3, 24), p = R.ri(4, 15), cost = dz * r, rev = (12 * dz - s) * p, d = rev - cost;
    if (!d) return null;
    return mk(R, { q: `विक्रेत्याने ₹${r} डझन या दराने ${dz} डझन संत्री घेतली. त्यातील ${s} संत्री खराब झाली. उरलेली सर्व ₹${p} ला एक या दराने विकली. नफा की तोटा, किती?`, a: lab(d), w: [flip(d), lab(12 * dz * p - cost), lab(2 * d), lab(d + 10 * Math.sign(d)), flip(12 * dz * p - cost)],
      steps: [`खरेदी = ${dz} × ${r} = ₹${nf(cost)}`, `उरलेली संत्री = ${12 * dz} − ${s} = ${12 * dz - s}`, `विक्री = ${12 * dz - s} × ${p} = ₹${nf(rev)}`, `${nf(rev)} − ${nf(cost)} → ${d > 0 ? '₹' + nf(d) + ' नफा' : '₹' + nf(-d) + ' तोटा'}`] });
  } };

  T.pct = { name: 'शेकडेवारी (उरलेले / एकूण)', gen(R, L, g7) {
    const l = Math.min(3, L + (g7 ? 1 : 0));
    if (l < 3) {
      const N = 100 * R.ri(2, 20), p = R.ri(1, 19) * (l === 1 ? 5 : 1) * (l === 1 ? 1 : 4) % 96 + 2, girls = N * p / 100;
      if (girls !== Math.round(girls)) return null;
      return mk(R, { q: `एका शाळेत ${nf(N)} विद्यार्थी आहेत. त्यापैकी ${p}% मुली आहेत. तर मुलगे किती?`, a: N - girls, w: [girls, N - p, 100 - p], steps: [`मुलगे = ${100 - p}%`, `${nf(N)} × ${100 - p} ÷ 100 = ${nf(N - girls)}`] });
    }
    const N1 = 20 * R.ri(3, 15), N2 = 20 * R.ri(3, 15), p1 = 5 * R.ri(6, 14), p2 = 5 * R.ri(6, 14), g1 = N1 * p1 / 100, g2 = N2 * p2 / 100;
    return mk(R, { q: `एका शाळेत ${N1} पैकी ${p1}% मुली आहेत आणि त्याच गावातील दुसऱ्या शाळेत ${N2} पैकी ${p2}% मुली आहेत. तर दोन्ही शाळांत मिळून किती मुली?`, a: g1 + g2, w: [(N1 + N2) * (p1 + p2) / 200, N1 + N2 - g1 - g2, g1 + g2 + 10],
      steps: [`${N1} × ${p1} ÷ 100 = ${g1}`, `${N2} × ${p2} ÷ 100 = ${g2}`, `एकूण = ${g1 + g2}`] });
  } };

  T.unitary = { name: 'एकक पद्धत', gen(R, L, g7) {
    const items = R.pick(['आंब्याच्या पेट्यांची', 'वह्यांची', 'खुर्च्यांची', 'तांदळाच्या पिशव्यांची']);
    const a = R.ri(3, 20 + (g7 ? 20 : 0)), u = R.ri(5, 60 + L * 100) * (L > 1 ? 5 : 1), b = R.ri(2, 30); if (a === b) return null;
    return mk(R, { q: `${a} ${items} किंमत ₹${nf(a * u)} आहे. तर अशा ${b} ${items} किंमत किती?`, a: b * u, fmt: rs, w: [a * u + b, b * u + u, u, a * u * b],
      steps: [`एकाची किंमत = ${nf(a * u)} ÷ ${a} = ₹${u}`, `${b} × ${u} = ₹${nf(b * u)}`] });
  } };

  T.notes = { name: 'नोटा बदलणे', gen(R, L, g7) {
    const kinds = R.shuffle([500, 200, 100, 50]).slice(0, L + 1 > 3 ? 3 : L + 1);
    const cnt = kinds.map(() => R.ri(1, 4)), total = kinds.reduce((s, k, i) => s + k * cnt[i], 0);
    const D = R.pick([10, 20, 50].filter(d => total % d === 0 && d < Math.min(...kinds)));
    if (!D) return null;
    return mk(R, { q: `${kinds.map((k, i) => `₹${k} च्या ${cnt[i]}`).join(', ')} नोटा देऊन त्याऐवजी ₹${D} च्या नोटा घेतल्या. तर ₹${D} च्या किती नोटा मिळतील?`, a: total / D, w: [total, total / D + kinds.length, cnt.reduce((a, b) => a + b, 0) * 2],
      steps: [`एकूण रक्कम = ${kinds.map((k, i) => `${k}×${cnt[i]}`).join(' + ')} = ₹${total}`, `${total} ÷ ${D} = ${total / D} नोटा`] });
  } };

  const hm = (h, m) => `${h} तास ${m} मिनिटे`;
  T.time = { name: 'वेळ: तास-मिनिटे', gen(R, L, g7) {
    const l = Math.min(3, L + (g7 ? 1 : 0));
    if (l < 3) {
      const add = l === 1 || R.r() < 0.5, h1 = R.ri(2, 12), m1 = R.ri(5, 55), h2 = R.ri(1, h1 - 1 || 1), m2 = R.ri(5, 55);
      if (add) { const t = (h1 + h2) * 60 + m1 + m2; if (m1 + m2 < 60) return null;
        return mk(R, { q: `${hm(h1, m1)} + ${hm(h2, m2)} = किती?`, a: hm(Math.floor(t / 60), t % 60), w: [hm(h1 + h2, m1 + m2), hm(Math.floor(t / 60) + 1, t % 60), hm(Math.floor(t / 60), (t % 60 + 10) % 60)], steps: [`मिनिटे: ${m1} + ${m2} = ${m1 + m2} = 1 तास ${m1 + m2 - 60} मिनिटे`, `तास: ${h1} + ${h2} + 1 = ${Math.floor(t / 60)}`] }); }
      const t = h1 * 60 + m1 - h2 * 60 - m2; if (m1 >= m2 || t <= 0) return null;
      return mk(R, { q: `${hm(h1, m1)} − ${hm(h2, m2)} = किती?`, a: hm(Math.floor(t / 60), t % 60), w: [hm(h1 - h2, m2 - m1), hm(Math.floor(t / 60), m1 + 60 - m2 + 10), hm(Math.floor(t / 60) + 1, t % 60)], steps: [`${m1} मधून ${m2} जात नाहीत → 1 तास (60 मि) उसना`, `${m1 + 60} − ${m2} = ${t % 60} मि, ${h1 - 1} − ${h2} = ${Math.floor(t / 60)} तास`] });
    }
    const s = R.ri(5, 11) * 60 + R.pick([0, 10, 15, 20, 30, 40, 45]), d = R.ri(2, 6) * 60 + R.pick([15, 20, 35, 40, 50]), e = s + d;
    const c = v => `${String(Math.floor(v / 60) % 24).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
    return mk(R, { q: `एक बस सकाळी ${c(s)} वाजता निघाली. प्रवासाला ${hm(Math.floor(d / 60), d % 60)} लागली. तर बस किती वाजता पोहोचली? (24 तासांचे घड्याळ)`, a: c(e), w: [c(e + 60), c(e - 10), c(e - 12 * 60 + 24 * 60), c(e + 10)],
      steps: [`${c(s)} + ${hm(Math.floor(d / 60), d % 60)}`, `= ${c(e)}`] });
  } };

  T.cal5 = { name: 'महिन्यात 5 वेळा येणारे वार', gen(R, L, g7) {
    const n = L === 1 && !g7 ? 31 : R.pick([30, 31]), d = R.ri(8, 28), w = R.ri(0, 6), w1 = ((w - (d - 1)) % 7 + 7) % 7;
    const k = n - 28, set = s => [...Array(k).keys()].map(i => DAYS[(s + i) % 7]).join(', ');
    return mk(R, { q: `एका ${n} दिवसांच्या महिन्यात ${d} तारखेला ${DAYS[w]} आहे. तर त्या महिन्यात कोणते वार 5 वेळा येतील?`, a: set(w1), w: [set(w1 + 1), set(w1 + 6), set(w1 + 2), set(w)],
      steps: [`${d} − 1 = ${d - 1} दिवस मागे → 1 तारखेला ${DAYS[w1]}`, `28 दिवसांत प्रत्येक वार 4 वेळा; उरलेले ${k} दिवस (29${k > 2 ? ', 30, 31' : ', 30'}) 1 तारखेपासूनचे वार`, `→ ${set(w1)}`] });
  } };

  const divs = n => [...Array(n).keys()].map(x => x + 1).filter(x => n % x === 0);
  T.divisors = { name: 'विभाजक', gen(R, L, g7) {
    const N = R.pick(L === 1 && !g7 ? [12, 15, 18, 20, 24, 28, 30, 36] : [36, 40, 45, 48, 60, 72, 84, 90, 96, 100]), ds = divs(N);
    if (R.r() < 0.5) return mk(R, { q: `${N} चे एकूण विभाजक किती?`, a: ds.length, w: [ds.length - 2, ds.length + 1, ds.length - 1], steps: [`${N} चे विभाजक: ${ds.join(', ')}`, `एकूण ${ds.length}`] });
    const s = ds.reduce((a, b) => a + b, 0);
    return mk(R, { q: `${N} च्या सर्व विभाजकांची बेरीज किती?`, a: s, w: [s - N, s - 1, s + N / 2], steps: [`${N} चे विभाजक: ${ds.join(', ')}`, `बेरीज = ${s}`] });
  } };

  const RULE = { 2: 'एकक स्थानी 0, 2, 4, 6, 8', 3: 'अंकांची बेरीज 3 ने विभाज्य', 4: 'शेवटच्या दोन अंकांची संख्या 4 ने विभाज्य', 5: 'एकक स्थानी 0 किंवा 5', 6: '2 ने आणि 3 ने दोन्हीने विभाज्य', 9: 'अंकांची बेरीज 9 ने विभाज्य' };
  T.divisible = { name: 'विभाज्यतेच्या कसोट्या', gen(R, L, g7) {
    const k = R.pick(L === 1 && !g7 ? [2, 3, 5] : [3, 4, 6, 9]), lo = 1000, hi = g7 ? 999999 : 99999;
    let yes = 0; const no = [];
    for (let t = 0; t < 200 && (!yes || no.length < 3); t++) { const x = R.ri(lo, hi); if (x % k === 0) { if (!yes) yes = x; } else if (no.length < 3 && !no.includes(x)) no.push(x); }
    if (!yes || no.length < 3) return null;
    const ds = String(yes).split('').reduce((s, c) => s + +c, 0);
    return mk(R, { q: `खालीलपैकी कोणत्या संख्येला ${k} ने निःशेष भाग जातो?`, a: nf(yes), w: no.map(nf), steps: [`कसोटी: ${RULE[k]}`, k === 3 || k === 9 || k === 6 ? `${yes}: अंकांची बेरीज = ${ds}` : `${yes} कसोटीत बसते`] });
  } };

  T.fence = { name: 'चौरस: परिमिती व कुंपण', gen(R, L, g7) {
    const s = R.ri(5, 30), A = s * s;
    if (L === 1 && !g7) return mk(R, { q: `एका चौरसाकृती बागेचे क्षेत्रफळ ${A} चौ.मी. आहे. तर तिची परिमिती किती?`, a: 4 * s, fmt: v => v + ' मी', w: [2 * s, s, A / 2 === Math.round(A / 2) ? A / 2 : A + 1], steps: [`बाजू = √${A} = ${s} मी`, `परिमिती = 4 × ${s} = ${4 * s} मी`] });
    const n = R.ri(2, 4), r = R.ri(2, 10) * 10;
    return mk(R, { q: `${A} चौ.मी. क्षेत्रफळ असलेल्या चौरसाकृती बागेला ${W[n]} पदरी कुंपण घालायचे आहे. तारेचा दर ₹${r} प्रति मीटर असेल तर खर्च किती?`, a: 4 * s * n * r, fmt: rs, w: [4 * s * r, A * n * r, s * n * r, 4 * s * n * r + r],
      steps: [`बाजू = √${A} = ${s} मी`, `परिमिती = ${4 * s} मी`, `${n} पदरी तार = ${4 * s} × ${n} = ${4 * s * n} मी`, `खर्च = ${4 * s * n} × ${r} = ₹${nf(4 * s * n * r)}`] });
  } };

  const SOL = { 'घन': { 'कडा': 12, 'पृष्ठे': 6, 'शिरोबिंदू': 8 }, 'इष्टिकाचिती': { 'कडा': 12, 'पृष्ठे': 6, 'शिरोबिंदू': 8 } };
  T.solids = { name: 'घन व इष्टिकाचिती', gen(R) {
    const sh = R.pick(Object.keys(SOL)), [p1, p2] = R.shuffle(['कडा', 'पृष्ठे', 'शिरोबिंदू']).slice(0, 2), a = SOL[sh][p1], b = SOL[sh][p2], sum = R.r() < 0.5;
    const ans = sum ? a + b : Math.abs(a - b);
    return mk(R, { q: `${sh === 'घन' ? 'घनाच्या' : 'इष्टिकाचितीच्या'} ${p1} आणि ${p2} यांची ${sum ? 'बेरीज' : 'वजाबाकी (फरक)'} किती?`, a: ans, w: [20, 18, 14, 6, 4, 2, 26].filter(x => x !== ans),
      steps: ['घन व इष्टिकाचिती: पृष्ठे 6, कडा 12, शिरोबिंदू 8', `${a} ${sum ? '+' : '−'} ${b} = ${ans}`] });
  } };

  T.circle = { name: 'वर्तुळ: त्रिज्या, व्यास, जीवा', gen(R) {
    const r = R.ri(2, 15), c = R.ri(1, 2 * r - 1);
    return mk(R, { q: `एका वर्तुळाची त्रिज्या ${r} सेमी आहे आणि त्याची एक जीवा ${c} सेमी आहे. तर सर्वांत मोठ्या जीवेची लांबी किती?`, a: 2 * r, fmt: v => v + ' सेमी', w: [r, c, r + c, 2 * c],
      steps: ['सर्वांत मोठी जीवा = व्यास', `व्यास = 2 × त्रिज्या = 2 × ${r} = ${2 * r} सेमी`] });
  } };

  const PICT = [['खेळ', ['क्रिकेट', 'कबड्डी', 'खो-खो', 'फुटबॉल', 'हॉकी'], 'face', 'विद्यार्थी'], ['वाद्य', ['तबला', 'हार्मोनियम', 'बासरी', 'गिटार'], 'face', 'विद्यार्थी'], ['शाळा', ['ज्ञानदा विद्यालय', 'विद्यानिकेतन', 'जि.प. शाळा', 'साधना विद्यालय'], 'tree', 'झाडे'], ['रेशनकार्ड', ['पांढरे', 'पिवळे', 'केशरी'], 'house', 'घरे']];
  const FONT = 'font-family="Nirmala UI, Noto Sans Devanagari, Mangal, Arial, sans-serif"';
  const ICON = { face: (x, y) => `<circle cx="${x}" cy="${y}" r="9" fill="#ffd54f" stroke="#222" stroke-width="1.3"/><circle cx="${x - 3}" cy="${y - 2}" r="1.3" fill="#222"/><circle cx="${x + 3}" cy="${y - 2}" r="1.3" fill="#222"/><path d="M${x - 4},${y + 3} Q${x},${y + 7} ${x + 4},${y + 3}" fill="none" stroke="#222" stroke-width="1.3"/>`,
    tree: (x, y) => `<rect x="${x - 2}" y="${y + 2}" width="4" height="8" fill="#8d6e63"/><circle cx="${x}" cy="${y - 2}" r="8" fill="#43a047" stroke="#1b5e20" stroke-width="1"/>`,
    house: (x, y) => `<rect x="${x - 7}" y="${y - 1}" width="14" height="10" fill="#ffcc80" stroke="#222" stroke-width="1.2"/><path d="M${x - 9},${y} L${x},${y - 9} L${x + 9},${y} Z" fill="#e57373" stroke="#222" stroke-width="1.2"/>` };
  function pictoSvg(title, cats, icon, what, n, sc) {
    const LW = 130, RH = 30, IW = 24, cols = Math.max(...n), W = LW + cols * IW + 20, H = (cats.length + 1) * RH + 40;
    let b = `<rect x="1" y="1" width="${W - 2}" height="${(cats.length + 1) * RH}" fill="#fff" stroke="#222" stroke-width="1.5"/><line x1="${LW}" y1="1" x2="${LW}" y2="${(cats.length + 1) * RH + 1}" stroke="#222" stroke-width="1.5"/>`;
    b += `<text x="${LW / 2}" y="${RH / 2 + 5}" font-size="14" font-weight="700" text-anchor="middle" ${FONT}>${title}</text><text x="${LW + (W - LW) / 2}" y="${RH / 2 + 5}" font-size="14" font-weight="700" text-anchor="middle" ${FONT}>${what}</text>`;
    cats.forEach((c, i) => { const y = (i + 1) * RH; b += `<line x1="1" y1="${y}" x2="${W - 1}" y2="${y}" stroke="#222" stroke-width="1"/><text x="8" y="${y + RH / 2 + 5}" font-size="13" ${FONT}>${c}</text>`;
      for (let k = 0; k < n[i]; k++) b += ICON[icon](LW + 14 + k * IW, y + RH / 2); });
    const sy = (cats.length + 1) * RH + 24;
    b += `<text x="4" y="${sy}" font-size="13" ${FONT}>प्रमाण: 1</text>${ICON[icon](72, sy - 5)}<text x="86" y="${sy}" font-size="13" ${FONT}>= ${sc} ${what}</text>`;
    return svg(W, H, b);
  }
  T.picto = { name: 'चित्रालेख', gen(R, L, g7) {
    const [title, cats, icon, what] = R.pick(PICT), sc = R.pick(L === 1 && !g7 ? [5, 10] : [10, 20, 25, 50, 100]);
    const n = cats.map(() => R.ri(1, 7)), fig = pictoSvg(title, cats, icon, what, n, sc);
    const kind = R.ri(0, 2), i = R.ri(0, cats.length - 1); let j = R.ri(0, cats.length - 1); if (j === i) j = (i + 1) % cats.length;
    if (kind === 0) return mk(R, { fig, q: `चित्रालेखानुसार "${cats[i]}" (${title}) या ओळीत किती ${what} आहेत?`, a: n[i] * sc, w: [n[i], (n[i] + 1) * sc, (n[i] - 1) * sc], steps: [`${n[i]} चित्रे × ${sc} = ${n[i] * sc}`] });
    if (kind === 1) { const t = n.reduce((a, b) => a + b, 0) * sc; return mk(R, { fig, q: `एकूण ${what} किती?`, a: t, w: [t / sc, t + sc, t - sc], steps: [`एकूण चित्रे = ${n.reduce((a, b) => a + b, 0)}`, `× ${sc} = ${t}`] }); }
    if (n[i] === n[j]) return null;
    const d = Math.abs(n[i] - n[j]) * sc;
    return mk(R, { fig, q: `${cats[i]} आणि ${cats[j]} यांच्या संख्येत फरक किती?`, a: d, w: [d / sc, (n[i] + n[j]) * sc, d + sc], steps: [`चित्रांचा फरक = ${Math.abs(n[i] - n[j])}`, `× ${sc} = ${d}`] });
  } };

  T.si = wrap('si', 'सरळव्याज');
  T.lcm = wrap('lcm', 'ल.सा.वि. / म.सा.वि.');
  T.rect = wrap('rect', 'आयत: क्षेत्रफळ-परिमिती');

  // ═════════════ बुद्धिमत्ता ═════════════
  T.series = wrap('series', 'संख्या मालिका');
  T.letters = wrap('letters', 'अक्षर मालिका');
  T.code = wrap('code', 'सांकेतिक भाषा: अक्षरे सरकवणे');
  T.calendar = wrap('calendar', 'दिनदर्शिका');
  T.age = wrap('age', 'वय');

  T.wrongTerm = { name: 'मालिकेतील चुकीचे पद', gen(R, L, g7) {
    const l = Math.min(3, L + (g7 ? 1 : 0)), n = 7; let t = [], rule = '';
    if (l === 1) { const a = R.ri(2, 20), d = R.ri(2, 9); t = [...Array(n).keys()].map(i => a + i * d); rule = `प्रत्येक वेळी +${d}`; }
    else if (l === 2) { const a = R.ri(2, 15), d = R.ri(1, 4), k = R.ri(1, 3); t = [a]; for (let i = 1; i < n; i++) t.push(t[i - 1] + d + (i - 1) * k); rule = `फरक दर वेळी ${k} ने वाढतो (+${d}, +${d + k}, …)`; }
    else { const s = R.ri(2, 6), c = R.pick([0, 1, -1]); t = [...Array(n).keys()].map(i => (s + i) ** 2 + c); rule = `${s}², ${s + 1}², …${c ? (c > 0 ? ' + 1' : ' − 1') : ''}`; }
    const i = R.ri(1, n - 2), good = t[i], bad = good + R.pick([-3, -2, -1, 1, 2, 3]);
    if (t.includes(bad) || bad <= 0) return null;
    const shown = t.slice(); shown[i] = bad;
    const others = R.shuffle(shown.filter((x, k) => k !== i)).slice(0, 3);
    return mk(R, { q: `खालील संख्यामालिकेतील चुकीचे पद ओळखा.  ${shown.join(', ')}`, a: bad, w: others, steps: [rule, `${bad} च्या जागी ${good} हवे`] });
  } };

  const WORDS = ['CAT', 'DOG', 'SUN', 'PEN', 'BAT', 'CAP', 'TOP', 'BUS', 'HEN', 'COW', 'RAT', 'BED', 'JAM', 'FAN'];
  const pos = c => AB.indexOf(c) + 1;
  T.numCode = { name: 'सांकेतिक भाषा: अक्षरांचे क्रमांक', gen(R, L, g7) {
    const [w1, w2] = R.shuffle(WORDS), rev = (L === 3 || g7) && R.r() < 0.5;
    const enc = (w, k = 0, r = rev) => w.split('').map(c => (r ? 27 - pos(c) : pos(c)) + k).join('');
    return mk(R, { q: `एका सांकेतिक भाषेत ${w1} = ${enc(w1)} असे लिहितात. तर ${w2} = ?`, a: enc(w2), w: [enc(w2, 1), enc(w2, 0, !rev), enc(w2.split('').reverse().join('')), enc(w2, -1)],
      steps: [rev ? 'प्रत्येक अक्षराचा उलट क्रमांक (Z=1, Y=2 … A=26)' : 'प्रत्येक अक्षराचा वर्णमालेतील क्रमांक (A=1 … Z=26)', `${w2} → ${w2.split('').map(c => `${c}=${rev ? 27 - pos(c) : pos(c)}`).join(', ')}`] });
  } };

  const NAMEF = [['माणूस', 'सर्वांत बुद्धिमान प्राणी'], ['उंट', 'वाळवंटातील जहाज'], ['शेकरू', 'महाराष्ट्राचा राज्यप्राणी'], ['वाघ', 'भारताचा राष्ट्रीय प्राणी'], ['गाय', 'हंबरणारा प्राणी'], ['घोडा', 'तबेल्यात राहणारा प्राणी']];
  const ANI = ['उंदीर', 'मांजर', 'गाढव', 'कुत्रा', 'हरीण', 'ससा', 'हत्ती', 'सिंह', 'बैल', 'माकड'];
  const OBL = { 'उंदीर': 'उंदराला', 'मांजर': 'मांजराला', 'गाढव': 'गाढवाला', 'कुत्रा': 'कुत्र्याला', 'हरीण': 'हरणाला', 'ससा': 'सशाला', 'हत्ती': 'हत्तीला', 'सिंह': 'सिंहाला', 'बैल': 'बैलाला', 'माकड': 'माकडाला', 'माणूस': 'माणसाला', 'उंट': 'उंटाला', 'शेकरू': 'शेकराला', 'वाघ': 'वाघाला', 'गाय': 'गायीला', 'घोडा': 'घोड्याला' };
  T.naming = { name: 'नाव बदलले तर…', gen(R) {
    const [A, fact] = R.pick(NAMEF), pool = R.shuffle(ANI.concat(NAMEF.map(x => x[0])).filter(x => x !== A)).slice(0, 4);
    const k = R.ri(0, 3), chain = pool.slice(); chain.splice(k, 0, A); // A is never last
    const pairs = chain.slice(0, -1).map((x, i) => `${OBL[x] || x + 'ला'} ${chain[i + 1]}`).join(', ');
    const ans = chain[k + 1];
    return mk(R, { q: `${pairs} असे म्हटले, तर ${fact} कोणाला म्हणावे?`, a: ans, w: [A, chain[k + 2], k > 0 ? chain[k - 1] : chain[chain.length - 1], chain[0]].filter(Boolean),
      steps: [`${fact} = ${A}`, `${OBL[A] || A + 'ला'} ${ans} म्हटले → उत्तर ${ans}`] });
  } };

  const DIR = ['उत्तर', 'ईशान्य', 'पूर्व', 'आग्नेय', 'दक्षिण', 'नैर्ऋत्य', 'पश्चिम', 'वायव्य'];
  const PEOPLE = ['रशीद', 'प्रणव', 'जॉन', 'अहमद', 'विजय', 'सोहम'];
  T.direction = { name: 'दिशा: वळणे', gen(R, L, g7) {
    const l = Math.min(3, L + (g7 ? 1 : 0)), s = l === 1 ? R.pick([0, 2, 4, 6]) : R.ri(0, 7), who = R.pick(PEOPLE);
    const turns = [...Array(R.ri(1, 3)).keys()].map(() => ({ r: R.r() < 0.5, d: l === 3 && R.r() < 0.5 ? 135 : 90 }));
    let f = s; turns.forEach(t => { f += (t.r ? 1 : -1) * t.d / 45; }); f = ((f % 8) + 8) % 8;
    const tt = t => `${t.r ? 'उजवीकडे' : 'डावीकडे'} ${t.d === 90 ? 'काटकोनात' : '135 अंशात'}`;
    const same = turns.every(t => t.r === turns[0].r && t.d === turns[0].d);
    const how = same ? `${tt(turns[0])} ${turns.length === 1 ? 'एकदा' : W[turns.length] + ' वेळा'} वळला` : turns.map((t, i) => (i ? 'नंतर ' : 'आधी ') + tt(t)).join(', ') + ' वळला';
    const hand = l >= 2 && R.r() < 0.5, ans = hand ? (f + 2) % 8 : f;
    return mk(R, { q: `${who} ${DIR[s]} दिशेकडे तोंड करून उभा आहे. तो ${how}. तर आता ${hand ? 'त्याच्या उजव्या हाताकडे कोणती दिशा असेल?' : 'त्याचे तोंड कोणत्या दिशेला असेल?'}`, a: DIR[ans], w: [DIR[(ans + 4) % 8], DIR[(ans + 2) % 8], DIR[(ans + 6) % 8], DIR[(ans + 1) % 8]],
      steps: ['उजवीकडे = घड्याळाच्या दिशेने, काटकोन = 90°', `शेवटी तोंड ${DIR[f]} कडे`, hand ? `उजवा हात = तोंडापासून 90° उजवीकडे → ${DIR[ans]}` : `उत्तर: ${DIR[ans]}`], sfig: sfCompass(DIR, s, f, hand ? ans : null) });
  } };

  T.distance = { name: 'दिशा: अंतर', gen(R) {
    const rot = R.ri(0, 3), D4 = ['उत्तर', 'पूर्व', 'दक्षिण', 'पश्चिम'].map((_, i, a) => a[(i + rot) % 4]);
    const a = R.ri(8, 30), c = R.ri(2, a - 2), b = R.ri(3, 20), who = R.pick(PEOPLE);
    return mk(R, { q: `${who} आधी ${D4[3]}ेला ${a} किमी गेला, नंतर ${D4[2]}ेला ${b} किमी, नंतर ${D4[1]}ेला ${c} किमी आणि शेवटी ${D4[0]}ेला ${b} किमी जाऊन थांबला. तर तो मूळ ठिकाणापासून किती किमी अंतरावर आहे?`.replace(/उत्तरेला/g, 'उत्तरेला').replace(/पूर्वेला/g, 'पूर्वेला'), a: a - c, fmt: v => v + ' किमी', w: [a + c, a + 2 * b + c, b, a],
      steps: [`${D4[2]} ${b} आणि ${D4[0]} ${b} एकमेकांना रद्द करतात`, `${D4[3]} ${a} − ${D4[1]} ${c} = ${a - c} किमी`], sfig: sfDistance([[D4[3], a], [D4[2], b], [D4[1], c], [D4[0], b]], a - c) });
  } };

  T.rank = { name: 'रांगेतील क्रमांक', gen(R, L, g7) {
    const l = Math.min(3, L + (g7 ? 1 : 0)), a = R.ri(5, 30), b = R.ri(5, 30), who = R.pick(PEOPLE);
    if (l === 1) return mk(R, { q: `एका रांगेत ${who} पुढून ${a} वा आणि मागून ${b} वा आहे. तर रांगेत एकूण किती मुले आहेत?`, a: a + b - 1, w: [a + b, a + b + 1, a + b - 2], steps: [`एकूण = ${a} + ${b} − 1 (${who} दोनदा मोजला)`, `= ${a + b - 1}`], sfig: sfRank(a, b, who) });
    if (l === 2) { const N = a + b; return mk(R, { q: `${N} मुलांच्या रांगेत ${who} पुढून ${a} वा आहे. तर मागून तो कितवा?`, a: N - a + 1, w: [N - a, N - a + 2, a], steps: [`मागून = ${N} − ${a} + 1 = ${N - a + 1}`], sfig: sfRank(a, N - a + 1, who) }); }
    const N = a + b - 1, c = R.ri(1, N); if (c === a) return null;
    return mk(R, { q: `एका रांगेत ${who} पुढून ${a} वा आणि मागून ${b} वा आहे. त्याच रांगेत सोहम पुढून ${c} वा आहे. तर सोहम मागून कितवा?`, a: N - c + 1, w: [N - c, N - c + 2, a + b - c], steps: [`एकूण = ${a} + ${b} − 1 = ${N}`, `सोहम मागून = ${N} − ${c} + 1 = ${N - c + 1}`] });
  } };

  T.compare = { name: 'तुलना (उंच / ठेंगणा)', gen(R) {
    const ord = R.shuffle(['अजय', 'रमेश', 'सदू', 'विजय']), tallQ = R.r() < 0.5;
    const st = R.shuffle([0, 1, 2]).map(i => `${ord[i]} ${ord[i + 1]}पेक्षा उंच आहे`);
    const ans = tallQ ? ord[0] : ord[3];
    return mk(R, { q: `${st.join('. ')}. तर सर्वांत ${tallQ ? 'उंच' : 'ठेंगणा'} कोण?`, a: ans, w: ord.filter(x => x !== ans), steps: [`क्रम (उंच → ठेंगणा): ${ord.join(' > ')}`], sfig: sfHeights(ord) });
  } };

  T.ageSum = { name: 'वयांची बेरीज', gen(R) {
    const k = R.ri(2, 4), y = R.ri(2, 8), z = R.ri(2, 8), S = R.ri(5 * k, 20 * k), ans = S + k * (y + z);
    const nm = R.shuffle(['कविता', 'मनिषा', 'सुवर्णा', 'अजय', 'सुनील', 'राहुल']).slice(0, k).join(', ');
    return mk(R, { q: `${y} वर्षांपूर्वी ${nm} यांच्या वयांची बेरीज ${S} वर्षे होती. तर ${z} वर्षांनंतर त्यांच्या वयांची बेरीज किती असेल?`, a: ans, fmt: v => v + ' वर्षे', w: [S + y + z, S + k * z, S + k * y, ans + k],
      steps: [`प्रत्येकाचे वय ${y} + ${z} = ${y + z} वर्षांनी वाढते`, `${k} जण → ${k} × ${y + z} = ${k * (y + z)}`, `${S} + ${k * (y + z)} = ${ans}`] });
  } };

  T.alpha = { name: 'वर्णमालेतील स्थान', gen(R, L, g7) {
    const l = Math.min(3, L + (g7 ? 1 : 0));
    if (l === 1) { const p = R.ri(3, 24); return mk(R, { q: `इंग्रजी वर्णमालेत (A ते Z) डावीकडून ${p} वे अक्षर कोणते?`, a: AB[p - 1], w: [AB[p], AB[p - 2], AB[26 - p]], steps: [`A=1 … ${AB[p - 1]}=${p}`], sfig: sfLetters(AB.split(''), null, p - 1) }); }
    const p = R.ri(5, 22), q = R.ri(2, 6), fromR = l === 3;
    const i = fromR ? 26 - p - q : p - 1 + q; if (i < 0 || i > 25) return null;
    return mk(R, { q: `इंग्रजी वर्णमालेत (A ते Z) ${fromR ? 'उजवीकडून' : 'डावीकडून'} ${p} व्या अक्षराच्या ${fromR ? 'डावीकडील' : 'उजवीकडील'} ${q} वे अक्षर कोणते?`, a: AB[i], w: [AB[i + 1], AB[i - 1], AB[25 - i]].filter(Boolean).concat([AB[(i + 2) % 26]]),
      steps: [fromR ? `उजवीकडून ${p} वे = ${AB[26 - p]}` : `डावीकडून ${p} वे = ${AB[p - 1]}`, `${fromR ? 'डावीकडे' : 'उजवीकडे'} ${q} → ${AB[i]}`], sfig: sfLetters(AB.split(''), fromR ? 26 - p : p - 1, i) });
  } };

  const LONG = ['EXTRAORDINARY', 'ADJECTIVE', 'INTELLIGENCE', 'BEAUTIFUL', 'MAHARASHTRA', 'SCHOLARSHIP', 'EDUCATION', 'COMPUTER', 'KNOWLEDGE', 'PLAYGROUND'];
  T.wordPos = { name: 'शब्दातील अक्षराचे स्थान', gen(R) {
    const w = R.pick(LONG), once = [...w].map((c, i) => [c, i]).filter(([c]) => w.indexOf(c) === w.lastIndexOf(c));
    if (!once.length) return null;
    const [c, i] = R.pick(once), right = R.r() < 0.5, k = R.ri(2, 4), j = right ? i + k : i - k;
    if (j < 0 || j >= w.length) return null;
    const pool = [...new Set(w)].filter(x => x !== w[j]);
    return mk(R, { q: `'${w}' या शब्दात '${c}' या अक्षराच्या ${right ? 'उजवीकडील' : 'डावीकडील'} ${k} वे अक्षर कोणते?`, a: w[j], w: [w[j + 1], w[j - 1], ...R.shuffle(pool)].filter(x => x && x !== w[j]),
      steps: [`${c} हे ${i + 1} वे अक्षर`, `${right ? '+' : '−'}${k} → ${j + 1} वे = ${w[j]}`], sfig: sfLetters(w.split(''), i, j) });
  } };

  T.digitCount = { name: 'मालिकेत अटीनुसार मोजणी', gen(R) {
    const a = R.ri(1, 9), b = R.ri(1, 9), c = R.ri(1, 9); if (a === b || b === c || a === c) return null;
    const seq = [...Array(R.ri(22, 28)).keys()].map(() => R.pick([a, b, c, a, b, R.ri(1, 9)]));
    let n = 0; for (let i = 1; i < seq.length; i++) if (seq[i] === b && seq[i - 1] === a && seq[i + 1] !== c) n++;
    if (n < 2) return null;
    return mk(R, { q: `खालील संख्यामालिकेत '${b}' च्या लगेच आधी '${a}' आहे, पण '${b}' च्या लगेच नंतर '${c}' नाही, असे किती वेळा झाले आहे?  ${seq.join(' ')}`, a: n, w: [n + 1, n - 1, n + 2], fmt: v => v + ' वेळा',
      steps: [`'${a} ${b}' जोड्या शोधा`, `त्यानंतर '${c}' आलेल्या वगळा`, `उत्तर: ${n}`] });
  } };

  const RULES = [['a × b', (a, b) => a * b], ['a + b', (a, b) => a + b], ['a² + b', (a, b) => a * a + b], ['(a + b) × 2', (a, b) => (a + b) * 2], ['a × b − a', (a, b) => a * b - a], ['a² + b²', (a, b) => a * a + b * b]];
  T.matrix = { name: 'अंकांचे कोडे (तक्ता)', gen(R, L, g7) {
    const [rn, f] = R.pick(RULES.slice(0, 2 + L + (g7 ? 1 : 0))), rows = [0, 1, 2].map(() => [R.ri(2, 9), R.ri(2, 9)]);
    const vals = rows.map(([a, b]) => f(a, b)), [a, b] = rows[2], ans = vals[2];
    let gb = ''; rows.forEach((r, i) => [r[0], r[1], i === 2 ? '?' : vals[i]].forEach((v, j) => { gb += `<rect x="${2 + j * 56}" y="${2 + i * 40}" width="56" height="40" fill="#fff" stroke="#222" stroke-width="2"/><text x="${30 + j * 56}" y="${28 + i * 40}" font-size="18" font-weight="700" text-anchor="middle" font-family="Arial">${v}</text>`; }));
    const fig = svg(172, 124, gb);
    return mk(R, { fig, q: 'तक्त्यातील प्रश्नचिन्हाच्या जागी कोणती संख्या येईल?', a: ans, w: RULES.map(([, g]) => g(a, b)).filter(v => v !== ans).concat([ans + 1]), steps: [`नियम: तिसरी संख्या = ${rn}`, `${a}, ${b} → ${ans}`] });
  } };

  const FUN = [['x²', x => x * x], ['x³', x => x ** 3], ['x² + 1', x => x * x + 1], ['x² − 1', x => x * x - 1], ['2x + 1', x => 2 * x + 1], ['x × (x + 1)', x => x * (x + 1)]];
  T.analogy = { name: 'संख्या सहसंबंध', gen(R) {
    const a = R.ri(2, 9), b = R.ri(2, 9); if (a === b) return null;
    const [fn, f] = R.pick(FUN), ok = FUN.filter(([, g]) => g(a) !== f(a)).map(([, g]) => g(b)).filter(v => v !== f(b));
    return mk(R, { q: `${a} : ${f(a)} :: ${b} : ?`, a: f(b), w: ok, steps: [`नियम: ${fn}`, `${b} → ${f(b)}`] });
  } };

  const PROP = [['वर्ग संख्या', x => Number.isInteger(Math.sqrt(x)), 4, 400], ['मूळ संख्या', x => x > 1 && divs(x).length === 2, 11, 97], ['7 च्या पटीतील', x => x % 7 === 0, 14, 140], ['अंकांची बेरीज 9 असलेली', x => String(x).split('').reduce((s, c) => s + +c, 0) === 9, 18, 900]];
  T.odd = { name: 'गटात न बसणारी संख्या', gen(R) {
    const [pn, p, lo, hi] = R.pick(PROP), yes = [], no = [];
    for (let t = 0; t < 4000 && (yes.length < 3 || !no.length); t++) { const x = R.ri(lo, hi); if (p(x)) { if (yes.length < 3 && !yes.includes(x)) yes.push(x); } else if (!no.length && x % 2 === yes[0] % 2) no.push(x); }
    if (yes.length < 3 || !no.length) return null;
    return mk(R, { q: 'गटात न बसणारी संख्या ओळखा.', a: no[0], w: yes, steps: [`बाकीच्या सर्व ${pn} आहेत`, `${no[0]} ही ${pn} नाही`] });
  } };

  // ═════════════ आकृतीवाले प्रश्न (SVG code काढतो) ═════════════
  const svg = (w, h, body) => `<svg class="qfig" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  const INK = 'stroke="#222" stroke-width="2"', SH = 'fill="#9aa5b1"';

  T.shadePct = { name: 'आकृती: रेखांकित भागाची शेकडेवारी', gen(R, L, g7) {
    const [r, c] = R.pick(L === 1 && !g7 ? [[2, 5], [4, 5], [5, 2]] : [[4, 5], [5, 5], [5, 4], [2, 5]]), N = r * c, k = R.ri(1, N - 1), pct = k * 100 / N;
    if (pct !== Math.round(pct)) return null;
    const on = new Set(R.shuffle([...Array(N).keys()]).slice(0, k)), s = 36;
    let b = ''; for (let i = 0; i < N; i++) { const x = (i % c) * s + 2, y = Math.floor(i / c) * s + 2; b += `<rect x="${x}" y="${y}" width="${s}" height="${s}" ${on.has(i) ? SH : 'fill="#fff"'} ${INK}/>`; }
    return mk(R, { fig: svg(c * s + 4, r * s + 4, b), q: 'आकृतीतील रेखांकित भागाची शेकडेवारी किती?', a: pct, fmt: v => v + '%', w: [100 - pct, k, pct + (100 / N)], steps: [`एकूण भाग = ${N}, रेखांकित = ${k}`, `${k}/${N} × 100 = ${pct}%`] });
  } };

  const sector = (cx, cy, rr, a0, a1, fill) => { const p = a => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)].map(v => v.toFixed(1)).join(','); return `<path d="M${cx},${cy} L${p(a0)} A${rr},${rr} 0 0,1 ${p(a1)} Z" fill="${fill}" stroke="#222" stroke-width="2"/>`; };
  T.circleFrac = { name: 'आकृती: रेखांकित भागाचा सममूल्य अपूर्णांक', gen(R) {
    const n = R.pick([4, 6, 8, 10, 12]), k = R.ri(1, n - 1), m = R.ri(2, 4), on = new Set(R.shuffle([...Array(n).keys()]).slice(0, k));
    let b = ''; for (let i = 0; i < n; i++) b += sector(80, 80, 72, -Math.PI / 2 + i * 2 * Math.PI / n, -Math.PI / 2 + (i + 1) * 2 * Math.PI / n, on.has(i) ? '#9aa5b1' : '#fff');
    if (2 * k === n) return null;
    return mk(R, { fig: svg(160, 160, b), q: 'आकृतीतील रेखांकित भागाचा सममूल्य अपूर्णांक कोणता?', a: `${k * m}/${n * m}`, w: [`${(n - k) * m}/${n * m}`, `${k * m}/${(n - k) * m}`, `${(k + 1) * m}/${n * m}`, `${k * m}/${(n + 1) * m}`],
      steps: [`एकूण ${n} समान भाग, रेखांकित ${k} → ${k}/${n}`, `अंश व छेद दोन्हीला ${m} ने गुणले → ${k * m}/${n * m}`] });
  } };

  T.gridPerim = { name: 'आकृती: चौरसांच्या आकृतीची परिमिती', gen(R, L, g7) {
    const n = R.ri(5, 8 + L), cells = [[0, 0]], has = (x, y) => cells.some(c => c[0] === x && c[1] === y);
    for (let t = 0; cells.length < n && t < 200; t++) { const [x, y] = R.pick(cells), [dx, dy] = R.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]); if (!has(x + dx, y + dy) && Math.abs(x + dx) < 4 && Math.abs(y + dy) < 3) cells.push([x + dx, y + dy]); }
    let adj = 0; cells.forEach(([x, y]) => { if (has(x + 1, y)) adj++; if (has(x, y + 1)) adj++; });
    const side = L === 1 && !g7 ? 1 : R.pick([1, 2, 3]), per = (4 * cells.length - 2 * adj) * side;
    const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1])), s = 34;
    const b = cells.map(([x, y]) => `<rect x="${(x - mx) * s + 2}" y="${(y - my) * s + 2}" width="${s}" height="${s}" fill="#fff" ${INK}/>`).join('');
    const wd = (Math.max(...cells.map(c => c[0])) - mx + 1) * s + 4, ht = (Math.max(...cells.map(c => c[1])) - my + 1) * s + 4;
    return mk(R, { fig: svg(wd, ht, b), q: `आकृतीतील प्रत्येक चौरसाची बाजू ${side} सेमी आहे. तर आकृतीची परिमिती किती?`, a: per, fmt: v => v + ' सेमी', w: [cells.length * side, per + 2 * side, per - 2 * side, 4 * cells.length * side],
      steps: [`बाहेरच्या कडा मोजा: ${per / side} कडा`, `${per / side} × ${side} = ${per} सेमी`, `(आतल्या रेषा परिमितीत मोजत नाहीत)`] });
  } };

  const clockSvg = (h, m) => { let b = '<circle cx="80" cy="80" r="72" fill="#fff" stroke="#222" stroke-width="3"/>';
    for (let i = 1; i <= 12; i++) { const a = i * Math.PI / 6 - Math.PI / 2; b += `<text x="${(80 + 58 * Math.cos(a)).toFixed(1)}" y="${(85 + 58 * Math.sin(a)).toFixed(1)}" font-size="14" text-anchor="middle" font-family="Arial">${i}</text>`; }
    const ha = ((h % 12) + m / 60) * Math.PI / 6 - Math.PI / 2, ma = m * Math.PI / 30 - Math.PI / 2;
    b += `<line x1="80" y1="80" x2="${(80 + 36 * Math.cos(ha)).toFixed(1)}" y2="${(80 + 36 * Math.sin(ha)).toFixed(1)}" stroke="#222" stroke-width="5" stroke-linecap="round"/>`;
    b += `<line x1="80" y1="80" x2="${(80 + 56 * Math.cos(ma)).toFixed(1)}" y2="${(80 + 56 * Math.sin(ma)).toFixed(1)}" stroke="#222" stroke-width="3" stroke-linecap="round"/><circle cx="80" cy="80" r="4"/>`;
    return svg(160, 160, b); };
  const tm = (h, m) => `${h}:${String(m).padStart(2, '0')}`;
  T.clock = { name: 'आकृती: घड्याळ', gen(R, L, g7) {
    const h = R.ri(1, 12), m = L === 1 && !g7 ? R.pick([0, 15, 30, 45]) : R.ri(1, 11) * 5, nh = (h % 12) + 1;
    if (L === 3 || (g7 && L === 2)) { const add = R.pick([25, 40, 55, 75, 95]), t = (h * 60 + m + add), H = Math.floor(t / 60) % 12 || 12, M = t % 60;
      return mk(R, { fig: clockSvg(h, m), q: `घड्याळात दाखवलेल्या वेळेनंतर ${add} मिनिटांनी किती वाजतील?`, a: tm(H, M), w: [tm(H % 12 + 1, M), tm(H, (M + 5) % 60), tm(h, (m + add) % 60), tm((H + 10) % 12 + 1, M)], steps: [`घड्याळात ${tm(h, m)}`, `+ ${add} मिनिटे = ${tm(H, M)}`], sfig: clockSvg(H, M) }); }
    const sw = m % 5 === 0 && m / 5 >= 1 && m / 5 <= 12 ? tm(m / 5, (h % 12) * 5) : tm(nh, m);
    return mk(R, { fig: clockSvg(h, m), q: 'घड्याळात किती वाजले आहेत?', a: tm(h, m), w: [sw, tm(nh, m), tm(h, (60 - m) % 60 || 30), tm(h === 1 ? 12 : h - 1, m)],
      steps: ['लहान काटा = तास, मोठा काटा = मिनिटे', `मोठा काटा ${m / 5 || 12} वर → ${m} मिनिटे`, `उत्तर: ${tm(h, m)}`] });
  } };

  T.venn = { name: 'वेन आकृती', gen(R) {
    const lab = R.pick([['क्रिकेट', 'कबड्डी', 'हॉकी'], ['नृत्य', 'नाट्य', 'वादन'], ['गायक', 'संगीतकार', 'नट']]);
    const v = { a: R.ri(5, 30), b: R.ri(5, 30), c: R.ri(5, 30), ab: R.ri(2, 20), ac: R.ri(2, 20), bc: R.ri(2, 20), abc: R.ri(2, 30) };
    const C = [[95, 85], [165, 85], [130, 145]], at = [['a', 70, 70], ['b', 190, 70], ['c', 130, 185], ['ab', 130, 62], ['ac', 92, 135], ['bc', 168, 135], ['abc', 130, 108]];
    let b = C.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="62" fill="none" stroke="#222" stroke-width="2"/>`).join('');
    b += `<text x="40" y="22" font-size="13" font-family="Arial">${lab[0]}</text><text x="200" y="22" font-size="13" font-family="Arial">${lab[1]}</text><text x="210" y="205" font-size="13" font-family="Arial">${lab[2]}</text>`;
    b += at.map(([k, x, y]) => `<text x="${x}" y="${y}" font-size="15" font-weight="700" text-anchor="middle" font-family="Arial">${v[k]}</text>`).join('');
    const kind = R.ri(0, 3);
    const Q = [[`किमान दोन प्रकारांत असणाऱ्यांची संख्या किती?`, v.ab + v.ac + v.bc + v.abc, 'दोन किंवा तीन वर्तुळांच्या सामाईक भागांची बेरीज'],
      [`फक्त एकाच प्रकारात असणाऱ्यांची संख्या किती?`, v.a + v.b + v.c, 'फक्त एका वर्तुळात असलेल्या भागांची बेरीज'],
      [`तिन्ही प्रकारांत असणाऱ्यांची संख्या किती?`, v.abc, 'तिन्ही वर्तुळांचा मधला भाग'],
      [`"${lab[0]}" या वर्तुळात असणाऱ्यांची एकूण संख्या किती?`, v.a + v.ab + v.ac + v.abc, `${lab[0]} वर्तुळातील सर्व भागांची बेरीज`]][kind];
    return mk(R, { fig: svg(260, 215, b), q: Q[0], a: Q[1], w: [v.ab + v.ac + v.bc, v.a + v.b + v.c + v.abc, v.abc + v.ab, Q[1] + v.abc], steps: [Q[2], `= ${Q[1]}`] });
  } };

  T.speed = wrap('speed', 'वेग-अंतर-वेळ');
  T.avg = wrap('avg', 'सरासरी');
  T.percent = wrap('percent', 'शेकडेवारी');

  // ═════════════ 2022–23 papers शी जुळवल्यावर राहिलेले प्रकार ═════════════
  const lak = (a, b, c, d) => [a ? `${W[a]} लक्ष` : '', b ? `${W[b]} हजार` : '', c ? `${W[c]}शे` : '', d ? W[d] : ''].filter(Boolean).join(' ');
  T.words = { name: 'अक्षरी संख्या → अंक', gen(R, L) {
    const a = R.ri(1, 9), b = L === 1 ? 0 : R.ri(1, 30), c = R.ri(0, 9), d = R.ri(1, 30), N = a * 100000 + b * 1000 + c * 100 + d;
    return mk(R, { q: `"${lak(a, b, c, d)}" ही संख्या अंकांत कशी लिहाल?`, a: N, fmt: nf, w: [a * 1000000 + b * 1000 + c * 100 + d, a * 10000 + b * 1000 + c * 100 + d, a * 100000 + b * 100 + c * 10 + d, a * 100000 + b * 1000 + d],
      steps: [`${W[a]} लक्ष = ${nf(a * 100000)}`, b ? `${W[b]} हजार = ${nf(b * 1000)}` : 'हजार स्थानी 0', `${c ? W[c] + 'शे = ' + c * 100 : 'शतक स्थानी 0'}, ${W[d]} = ${d}`, `एकूण = ${nf(N)}`] });
  } };
  T.numErr = { name: 'संख्या लिहिताना झालेली चूक', gen(R) {
    const a = R.ri(2, 9), b = R.ri(1, 9), ok = a * 100000 + b, extra = R.r() < 0.5, bad = extra ? a * 1000000 + b : a * 10000 + b, who = R.pick(['समीर', 'ईश्वर', 'प्रणव', 'सोहम']);
    const d = Math.abs(bad - ok);
    return mk(R, { q: `"${W[a]} लक्ष ${W[b]}" ही संख्या अंकांत लिहिताना ${who}ने चुकून ${bad} अशी लिहिली. तर त्याचे उत्तर किती फरकाने चुकले?`, a: d, fmt: nf, w: [bad, ok, extra ? d / 10 : d * 10, d + b],
      steps: [`बरोबर संख्या = ${nf(ok)}`, `लिहिलेली = ${nf(bad)} (${extra ? 'एक शून्य जास्त' : 'एक शून्य कमी'})`, `फरक = ${nf(d)}`] });
  } };
  T.countDigit = { name: 'ठरावीक अंक असलेल्या संख्या', gen(R) {
    const d = R.ri(1, 9), occ = R.r() < 0.5;
    let has = 0, times = 0; for (let x = 10; x <= 99; x++) { const s = String(x); if (s.includes(d)) has++; times += s.split('').filter(c => +c === d).length; }
    const a = occ ? times : has;
    return mk(R, { q: occ ? `10 ते 99 या सर्व दोन अंकी संख्या लिहिल्यास ${d} हा अंक एकूण किती वेळा लिहावा लागेल?` : `दोन अंकी संख्यांपैकी ${d} हा अंक असलेल्या संख्या किती?`, a, w: [occ ? has : times, a + 1, a - 1, 20],
      steps: [`दशक स्थानी ${d}: ${d}0 ते ${d}9 → 10 संख्या`, `एकक स्थानी ${d}: 9 संख्या (${d}${d} दोनदा मोजली जाते)`, occ ? `अंक लिहिले = 10 + 9 = ${times}` : `संख्या = 10 + 9 − 1 = ${has}`] });
  } };
  T.multNth = { name: 'पट (n वी संख्या)', gen(R, L) {
    const k = R.ri(11, 49), n = R.ri(3, 9), even = L > 1 && k % 2 === 1 && R.r() < 0.6, a = even ? 2 * k * n : k * n;
    return mk(R, { q: even ? `${k} ने विभाज्य असलेल्या सम संख्या चढत्या क्रमाने लावल्यास ${n} व्या स्थानावर कोणती संख्या येईल?` : `${k} ने विभाज्य असलेल्या संख्या चढत्या क्रमाने मांडल्यास ${n} व्या स्थानावर कोणती संख्या येईल?`, a, w: [k * n, k * (n + 1), k * (n - 1), 2 * k * (n - 1)].filter(x => x !== a),
      steps: even ? [`${k} च्या सम पटी = ${2 * k}, ${4 * k}, ${6 * k}…`, `${n} वी = ${2 * k} × ${n} = ${a}`] : [`${k} च्या पटी: ${k}, ${2 * k}, ${3 * k}…`, `${n} वी = ${k} × ${n} = ${a}`] });
  } };
  T.orderDiff = { name: 'चढता / उतरता क्रम', gen(R) {
    const base = R.ri(20, 89) * 1000, xs = []; while (xs.length < 5) { const x = base + R.ri(0, 2999); if (!xs.includes(x)) xs.push(x); }
    const desc = R.r() < 0.5, s = xs.slice().sort((a, b) => (desc ? b - a : a - b)), i = R.ri(0, 1), j = R.ri(3, 4), a = s[i] + s[j];
    return mk(R, { q: `${xs.join(', ')} या संख्या ${desc ? 'उतरत्या' : 'चढत्या'} क्रमाने लावल्यास ${i + 1} ली/री व ${j + 1} वी संख्या यांची बेरीज किती?`, a, fmt: nf, w: [s[i] + s[j - 1], s[i + 1] + s[j], s[0] + s[4], s[1] + s[3]].filter(x => x !== a),
      steps: [`${desc ? 'उतरता' : 'चढता'} क्रम: ${s.join(', ')}`, `${s[i]} + ${s[j]} = ${nf(a)}`] });
  } };
  T.bodmas = { name: 'कंसाचा नियम (BODMAS)', gen(R) {
    if (R.r() < 0.5) { const b = R.ri(2, 9), k = R.ri(2, 9), a = b * k, c = R.ri(2, 9), d = R.ri(2, 9), ans = k + c * d;
      return mk(R, { q: `सोडवा: ${a} ÷ ${b} + ${c} × ${d} = ?`, a: ans, w: [(k + c) * d, k + c + d, a / b + c + d * 2, ans + d], steps: ['आधी भागाकार व गुणाकार, मग बेरीज', `${a} ÷ ${b} = ${k}, ${c} × ${d} = ${c * d}`, `${k} + ${c * d} = ${ans}`] }); }
    const b = R.ri(2, 6), c = R.ri(2, 6), a = b * c + R.ri(5, 30), d = R.ri(2, 15), ans = a - b * c + d;
    return mk(R, { q: `सोडवा: ${a} − ${b} × ${c} + ${d} = ?`, a: ans, w: [(a - b) * c + d, a - b * (c + d), a - b * c - d, ans + c], steps: ['आधी गुणाकार', `${b} × ${c} = ${b * c}`, `${a} − ${b * c} + ${d} = ${ans}`] });
  } };
  T.missing = { name: 'गाळलेली संख्या', gen(R) {
    const a = R.ri(20000, 90000), b = R.ri(10000, 60000), add = R.r() < 0.5;
    if (add) return mk(R, { q: `${a} + □ = ${a + b} तर □ मध्ये कोणती संख्या येईल?`, a: b, w: [b + 10, b - 100, b + 1000, b + 6], steps: [`□ = ${a + b} − ${a} = ${b}`] });
    const big = a + b;
    return mk(R, { q: `${big} − □ = ${b} तर □ मध्ये कोणती संख्या येईल?`, a, w: [a + 10, a - 100, a + 1000, big + b], steps: [`□ = ${big} − ${b} = ${a}`] });
  } };
  T.divRem = { name: 'भाज्य, भाजक, भागाकार, बाकी', gen(R) {
    const d = R.ri(12, 120), q = R.ri(20, 999), r = R.ri(1, d - 1), N = d * q + r;
    if (R.r() < 0.5) return mk(R, { q: `भाजक = ${d}, भागाकार = ${q}, बाकी = ${r} असेल तर भाज्य किती?`, a: N, w: [d * q, d * q - r, d * (q + r), N + d], steps: ['भाज्य = भाजक × भागाकार + बाकी', `${d} × ${q} + ${r} = ${N}`] });
    if (q > 120) return null;
    return mk(R, { q: `${N} या संख्येला कितीने भागले असता भागाकार ${q} व बाकी ${r} उरेल?`, a: d, w: [d + 10, d - 10, d + 5, d - 5], steps: [`${N} − ${r} = ${N - r}`, `${N - r} ÷ ${q} = ${d}`] });
  } };
  T.crypt = { name: 'अंक-कोडे (★ च्या जागी अंक)', gen(R) {
    for (let t = 0; t < 30; t++) {
      const a = R.ri(12, 98), m = R.ri(3, 9), p = a * m, as = String(a), ps = String(p);
      const dgs = [...as].filter(c => ps.includes(c)); if (!dgs.length) continue;
      const d = R.pick(dgs), A = as.replace(d, '★'), P = ps.split(d).join('★');
      const sols = [...Array(10).keys()].filter(x => { const aa = +A.replace('★', x), pp = +P.split('★').join(x); return A.replace('★', x)[0] !== '0' && aa * m === pp; });
      if (sols.length !== 1) continue;
      return mk(R, { q: `${A} × ${m} = ${P}. या गुणाकारात ★ च्या जागी सगळीकडे एकच अंक आहे. तो अंक कोणता?`, a: +d, w: [(+d + 1) % 10, (+d + 2) % 10, (+d + 9) % 10, (+d + 5) % 10].map(x => x || 10).filter(x => x !== 10),
        steps: [`★ = ${d} ठेवून पाहा`, `${a} × ${m} = ${p} ✔`] });
    } return null;
  } };
  const TRUE = ['कोणत्याही संख्येला शून्याने गुणल्यास गुणाकार शून्य येतो.', 'कोणत्याही संख्येला 1 ने भागल्यास भागाकार तीच संख्या येते.', 'त्रिकोणाच्या तिन्ही कोनांची बेरीज 180° असते.', 'चौकोनाच्या चारही कोनांची बेरीज 360° असते.', 'आयताचा प्रत्येक कोन काटकोन असतो.', '2 ही एकमेव सम मूळ संख्या आहे.', 'वर्तुळाचा व्यास त्रिज्येच्या दुप्पट असतो.', 'दोन विषम संख्यांचा गुणाकार विषम संख्या असतो.', 'विक्री किंमत − खरेदी किंमत = नफा (विक्री जास्त असल्यास).', '25% = 25/100'];
  const FALSE = [['कोणत्याही संख्येला शून्याने गुणल्यास गुणाकार तीच संख्या येते.', 'शून्याने गुणल्यास गुणाकार शून्य येतो.'], ['त्रिकोणाच्या सर्व कोनांची बेरीज एका काटकोनाएवढी असते.', 'बेरीज 180° म्हणजे दोन काटकोन.'], ['चौरसाच्या चारही कोनांची बेरीज 180° असते.', 'ती 360° असते.'], ['खरेदी किंमत + विक्री किंमत = तोटा', 'तोटा = खरेदी − विक्री.'], ['25% = 25/1000', '25% = 25/100.'], ['दोन विषम संख्यांचा गुणाकार सम संख्या असतो.', 'विषम × विषम = विषम.'], ['1 ही मूळ संख्या आहे.', '1 ला एकच विभाजक, ती मूळ नाही.'], ['वर्तुळाची त्रिज्या व्यासाच्या दुप्पट असते.', 'व्यास त्रिज्येच्या दुप्पट.'], ['कोणत्याही मूळ संख्येला दोनपेक्षा जास्त विभाजक असतात.', 'मूळ संख्येला फक्त 2 विभाजक.'], ['0.68 = 6.8%', '0.68 = 68%.']];
  T.stmt = { name: 'बरोबर / चुकीचे विधान', gen(R) {
    const askWrong = R.r() < 0.5, f = R.pick(FALSE), t = R.pick(TRUE);
    if (askWrong) return mk(R, { q: 'खालीलपैकी अयोग्य (चुकीचे) विधान कोणते?', a: f[0], w: R.shuffle(TRUE).slice(0, 3), steps: [`"${f[0]}" चूक: ${f[1]}`] });
    return mk(R, { q: 'खालीलपैकी अचूक (बरोबर) विधान कोणते?', a: t, w: R.shuffle(FALSE).slice(0, 3).map(x => x[0]), steps: [`"${t}" बरोबर`, 'बाकीची तिन्ही विधाने चुकीची'] });
  } };
  T.fracMissing = { name: 'अपूर्णांक: गाळलेला अंश', gen(R) {
    const b = R.ri(3, 9), d = R.ri(3, 9); if (b === d || gcd(b, d) !== 1) return null;
    const a = R.ri(1, b - 1), x = R.ri(1, d - 1), num = a * d + x * b;
    return mk(R, { q: `${a}/${b} + □/${d} = ${num}/${b * d} तर □ मध्ये कोणती संख्या येईल?`, a: x, w: [x + 1, x - 1, num - a, x + 2], steps: [`${a}/${b} = ${a * d}/${b * d}`, `${num} − ${a * d} = ${num - a * d} = □ × ${b}`, `□ = ${x}`] });
  } };
  T.mixed = { name: 'पूर्णांकयुक्त अपूर्णांक', gen(R) {
    const q = R.ri(2, 9), w = R.ri(2, 20), r = R.ri(1, q - 1), p = w * q + r, m = (a, b, c) => `${a} ${b}/${c}`;
    if (R.r() < 0.5) return mk(R, { q: `${p}/${q} या अपूर्णांकाचे पूर्णांकयुक्त अपूर्णांकात रूपांतर करा.`, a: m(w, r, q), w: [m(w, q, r), m(q, r, w), m(w, r + q, q), m(w - 1, r, q)], steps: [`${p} ÷ ${q} = भागाकार ${w}, बाकी ${r}`, `= ${m(w, r, q)}`] });
    return mk(R, { q: `${m(w, r, q)} हा अपूर्णांक साध्या रूपात कसा लिहाल?`, a: `${p}/${q}`, w: [`${w * r + q}/${q}`, `${w + r}/${q}`, `${p}/${w}`, `${p + 1}/${q}`], steps: [`${w} × ${q} + ${r} = ${p}`, `= ${p}/${q}`] });
  } };
  T.fracTimes = { name: 'अपूर्णांक किती वेळा मिळवला', gen(R) {
    const b = R.ri(2, 6), a = R.ri(1, b - 1), N = R.ri(2, 5); if ((N * b) % a) return null;
    const k = N * b / a; if (k < 3) return null;
    return mk(R, { q: `${a}/${b} या अपूर्णांकात ${a}/${b} किती वेळा मिळवल्यास बेरीज ${N} येईल?`, a: k - 1, w: [k, k - 2, k + 1], steps: [`${N} ÷ ${a}/${b} = ${k} वेळा ${a}/${b}`, `एक ${a}/${b} आधीच आहे → ${k} − 1 = ${k - 1}`] });
  } };
  const dfx = (v, n = 3) => (v / 10 ** n).toFixed(n);
  T.decCompare = { name: 'दशांश: तुलना', gen(R) {
    const xs = []; for (let t = 0; xs.length < 4 && t < 50; t++) { const v = R.ri(50, 999), dp = R.pick([2, 3]); const s = dp === 2 ? (Math.round(v / 10) / 100).toFixed(2) : (v / 1000).toFixed(3); if (!xs.some(y => +y === +s)) xs.push(s); }
    if (xs.length < 4) return null;
    const big = R.r() < 0.5, best = xs.reduce((a, b) => ((big ? +b > +a : +b < +a) ? b : a));
    return mk(R, { q: `खालीलपैकी सर्वांत ${big ? 'मोठी' : 'लहान'} संख्या कोणती?`, a: best, w: xs.filter(x => x !== best), steps: ['सगळ्या संख्यांना 3 दशांश स्थळे करा', xs.map(x => (+x).toFixed(3)).join(', '), `सर्वांत ${big ? 'मोठी' : 'लहान'} = ${best}`] });
  } };
  T.decOrder = { name: 'दशांश: क्रम व फरक', gen(R) {
    const w = R.ri(1, 9), xs = []; while (xs.length < 4) { const v = w * 1000 + R.ri(10, 499); if (!xs.includes(v)) xs.push(v); }
    const s = xs.slice().sort((a, b) => a - b), d = s[3] - s[0];
    return mk(R, { q: `${xs.map(x => dfx(x)).join(', ')} या संख्या चढत्या क्रमाने मांडल्यास पहिली व शेवटची संख्या यांतील फरक किती?`, a: d, fmt: v => dfx(v), w: [s[3] - s[1], s[2] - s[0], d + 10, d + 100], steps: [`चढता क्रम: ${s.map(x => dfx(x)).join(', ')}`, `${dfx(s[3])} − ${dfx(s[0])} = ${dfx(d)}`] });
  } };
  T.decExpand = { name: 'दशांश: विस्तारित रूप', gen(R) {
    const t = R.ri(1, 9), u = R.ri(0, 9), te = R.ri(1, 9), h = R.ri(1, 9); if (te === h) return null;
    const parts = R.shuffle([`${t} दशक`, `${u} एकक`, `${te} दशांश`, `${h} शतांश`]);
    return mk(R, { q: `${parts.join(' + ')} = ?`, a: `${t}${u}.${te}${h}`, w: [`${t}${u}.${h}${te}`, `${t}${u}${te}.${h}`, `${t}${u}${te}${h}`, `${t}.${u}${te}${h}`], steps: ['दशक-एकक बिंदूच्या आधी, दशांश-शतांश बिंदूनंतर', `= ${t}${u}.${te}${h}`] });
  } };
  T.decAddSub = { name: 'दशांश: बेरीज-वजाबाकी', gen(R) {
    const a = R.ri(10000, 49999), b = R.ri(1001, 9999), sub = R.r() < 0.5;
    if (sub) return mk(R, { q: `दोन संख्यांची बेरीज ${dfx(a, 2)} आहे. एक संख्या ${dfx(b)} असेल तर दुसरी संख्या कोणती?`, a: a * 10 - b, fmt: v => dfx(v), w: [a * 10 + b, a * 10 - b * 10, a * 10 - Math.floor(b / 10), a * 10 - b + 1000], steps: ['दशांश स्थळे सारखी करा', `${dfx(a * 10)} − ${dfx(b)} = ${dfx(a * 10 - b)}`] });
    return mk(R, { q: `${dfx(a, 2)} + ${dfx(b)} = ?`, a: a * 10 + b, fmt: v => dfx(v), w: [a * 10 + b * 10, a + b, a * 10 + Math.floor(b / 10), a * 10 + b + 100], steps: ['दशांश बिंदू एकाखाली एक ठेवा', `${dfx(a * 10)} + ${dfx(b)} = ${dfx(a * 10 + b)}`] });
  } };
  const rp = v => `₹${(v / 100).toFixed(2)}`;
  T.rupee = { name: 'रुपये-पैसे', gen(R) {
    if (R.r() < 0.4) { const r = R.ri(10, 99), p = R.ri(1, 9); return mk(R, { q: `${W[Math.min(r, 30)] && r <= 30 ? W[r] : r} रुपये ${W[p]} पैसे ही रक्कम दशांशात कशी लिहाल?`, a: `₹${r}.0${p}`, w: [`₹${r}.${p}`, `₹${r}.${p}0`, `₹${r}.00${p}`], steps: ['100 पैसे = 1 रुपया', `${p} पैसे = 0.0${p} रुपया → ₹${r}.0${p}`] }); }
    const p1 = R.ri(5, 25) * 100 + R.pick([25, 50, 75]), n1 = R.ri(2, 5), p2 = R.ri(2, 9) * 100 + R.pick([25, 50, 75]), n2 = R.ri(2, 6), t = p1 * n1 + p2 * n2;
    return mk(R, { q: `${rp(p1)} या दराने ${n1} पेन आणि ${rp(p2)} या दराने ${n2} पेन्सिली घेतल्या. एकूण किती रुपये खर्च झाले?`, a: t, fmt: rp, w: [p1 + p2, p1 * n2 + p2 * n1, t + 100, t - 25], steps: [`${n1} × ${rp(p1)} = ${rp(p1 * n1)}`, `${n2} × ${rp(p2)} = ${rp(p2 * n2)}`, `एकूण = ${rp(t)}`] });
  } };
  T.unitMul = { name: 'मापन: गुणाकार-भागाकार', gen(R) {
    if (R.r() < 0.5) { const cap = R.pick([100, 125, 200, 250, 500]), L = R.ri(1, 10), n = L * 1000 / cap;
      return mk(R, { q: `एका बाटलीत ${cap} मिली सुवासिक तेल मावते. ${L} लीटर तेल भरण्यासाठी किती बाटल्या लागतील?`, a: n, w: [n * 2, L * cap / 10, n + 2, n - 2], steps: [`${L} लीटर = ${L * 1000} मिली`, `${L * 1000} ÷ ${cap} = ${n}`] }); }
    const kg = R.ri(2, 20), g = R.ri(1, 9) * 100, n = R.ri(3, 12), tot = (kg * 1000 + g) * n;
    const f = v => (v % 1000 ? `${Math.floor(v / 1000)} कि.ग्रॅ. ${v % 1000} ग्रॅ.` : `${v / 1000} कि.ग्रॅ.`);
    return mk(R, { q: `एका डब्यात ${kg} कि.ग्रॅ. ${g} ग्रॅ. तांदूळ मावतो. तर ${n} डब्यांत किती तांदूळ मावेल?`, a: tot, fmt: f, w: [kg * n * 1000 + g, tot * 10, tot - 1000, tot + 1000], steps: [`${kg} कि.ग्रॅ. ${g} ग्रॅ. = ${kg * 1000 + g} ग्रॅ.`, `× ${n} = ${tot} ग्रॅ. = ${f(tot)}`] });
  } };
  const PRE = [['किलो', 3], ['हेक्टो', 2], ['डेका', 1], ['', 0], ['डेसि', -1], ['सेंटि', -2], ['मिलि', -3]];
  T.prefix = { name: 'किलो, हेक्टो, डेसि…', gen(R) {
    const U = R.pick(['मीटर', 'ग्रॅम', 'लीटर']), st = () => { const i = R.ri(0, 5), j = R.ri(i + 1, Math.min(6, i + 3)); return [i, j]; };
    const sTxt = ([i, j], bad) => `1 ${PRE[i][0]}${U} = ${10 ** (PRE[i][1] - PRE[j][1]) * (bad ? 10 : 1)} ${PRE[j][0]}${U}`;
    const seen = new Set(), goods = []; for (let t = 0; goods.length < 3 && t < 40; t++) { const p = st(), s = sTxt(p); if (!seen.has(s)) { seen.add(s); goods.push(s); } }
    const bp = st(), bad = sTxt(bp, true); if (goods.length < 3 || seen.has(bad)) return null;
    return mk(R, { q: 'खालीलपैकी चुकीचा पर्याय निवडा.', a: bad, w: goods, steps: ['किलो = 1000, हेक्टो = 100, डेका = 10, डेसि = 1/10, सेंटि = 1/100, मिलि = 1/1000', `बरोबर: ${sTxt(bp)}`] });
  } };
  T.thick = { name: 'जाडी / उंची', gen(R) {
    const dz = R.ri(2, 15), t = R.pick([2, 5, 10]), h = dz * 12 * t; if (h % 10) return null;
    return mk(R, { q: `${dz} डझन वह्यांचा एक गठ्ठा बांधला. एका वहीची जाडी ${t} मिमी आहे. तर गठ्ठ्याची उंची किती सेमी?`, a: h / 10, fmt: v => v + ' सेमी', w: [h, dz * t, h / 100 === Math.round(h / 100) ? h / 100 : h / 10 + 12, h / 10 + dz], steps: [`वह्या = ${dz} × 12 = ${dz * 12}`, `उंची = ${dz * 12} × ${t} = ${h} मिमी`, `${h} मिमी = ${h / 10} सेमी`] });
  } };
  const TWIN = [[3, 5], [5, 7], [11, 13], [17, 19], [29, 31], [41, 43], [59, 61], [71, 73]];
  T.primePair = { name: 'जोडमूळ, सहमूळ संख्या', gen(R) {
    const tw = R.shuffle(TWIN), ev = 2 * R.ri(10, 45), pr = s => `${s[0]}, ${s[1]}`;
    if (R.r() < 0.5) { const nb = [ev, ev + R.pick([2, 4, 6])];
      return mk(R, { q: 'खालीलपैकी कोणती जोडी जोडमूळही नाही व सहमूळही नाही?', a: pr(nb), w: tw.slice(0, 3).map(pr), steps: [`${nb[0]} व ${nb[1]} दोन्ही सम → 2 हा सामाईक विभाजक → सहमूळ नाहीत`, 'बाकीच्या जोड्या जोडमूळ (फरक 2 असलेल्या मूळ संख्या)'] }); }
    const co = R.pick([[8, 9], [14, 15], [25, 27], [16, 21], [9, 10]]), cp = R.pick([[13, 17], [19, 23], [37, 41]]);
    return mk(R, { q: 'खालीलपैकी जोडमूळ संख्यांची जोडी कोणती?', a: pr(tw[0]), w: [pr(co), pr(cp), pr([ev, ev + 2])], steps: ['जोडमूळ = फरक 2 असलेल्या दोन मूळ संख्या', `${pr(tw[0])} ✔`] });
  } };
  const isP = x => x > 1 && divs(x).length === 2;
  T.primeCount = { name: 'मूळ व संयुक्त संख्या मोजणे', gen(R) {
    const N = R.pick([20, 30, 40, 50, 100]), p = [...Array(N).keys()].map(x => x + 1).filter(isP).length, comp = N - p - 1, askC = R.r() < 0.5;
    return mk(R, { q: `1 ते ${N} या संख्यांमध्ये किती ${askC ? 'संयुक्त' : 'मूळ'} संख्या आहेत?`, a: askC ? comp : p, w: askC ? [N - p, p, comp - 1] : [comp, p + 1, p - 1], steps: [`1 ते ${N} मध्ये मूळ संख्या ${p}`, '1 ही मूळही नाही, संयुक्तही नाही', `संयुक्त = ${N} − ${p} − 1 = ${comp}`] });
  } };
  T.squareCount = { name: 'वर्गसंख्या', gen(R) {
    const ds = R.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3).sort(), sq = [...Array(9).keys()].map(x => (x + 1) ** 2).filter(v => String(v).split('').some(c => ds.includes(+c)));
    return mk(R, { q: `${ds.join(', ')} यांपैकी किमान एक अंक असलेल्या एक अंकी व दोन अंकी वर्गसंख्या किती?`, a: sq.length, w: [sq.length + 1, sq.length - 1, 9], steps: ['1 ते 99 मधील वर्गसंख्या: 1, 4, 9, 16, 25, 36, 49, 64, 81', `यांपैकी ${ds.join(', ')} असलेल्या: ${sq.join(', ')}`, `एकूण ${sq.length}`] });
  } };
  T.si2 = { name: 'सरळव्याज: वर्षे, मुद्दल', gen(R) {
    const k = R.ri(0, 2);
    if (k === 0) { const r = R.pick([4, 5, 8, 10, 20, 25]); return mk(R, { q: `₹${R.ri(2, 9) * 1000} रक्कम दरसाल ${r}% सरळव्याजाने किती वर्षांत दुप्पट होईल?`, a: 100 / r, fmt: v => v + ' वर्षे', w: [200 / r, r, 50 / r === Math.round(50 / r) ? 50 / r : 100 / r + 2, 100 / r + 5], steps: ['दुप्पट होणे = व्याज मुद्दलाएवढे', `${r}% दराने 100% व्याज → 100 ÷ ${r} = ${100 / r} वर्षे`] }); }
    if (k === 1) { const P = R.ri(4, 40) * 500, r = R.ri(3, 10), t = R.ri(2, 5), I = P * r * t / 100; if (I !== Math.round(I)) return null;
      return mk(R, { q: `दरसाल ${r}% दराने ${t} वर्षांनी ₹${nf(I)} सरळव्याज मिळाले. तर मुद्दल किती?`, a: P, fmt: rs, w: [P + 1000, I * 100 / r, P / 2, P + I], steps: ['मुद्दल = व्याज × 100 ÷ (दर × वर्षे)', `${I} × 100 ÷ (${r} × ${t}) = ₹${nf(P)}`] }); }
    const r1 = R.ri(6, 12), r2 = r1 - R.pick([1, 2]), P = R.ri(2, 20) * 5000, d = P * (r1 - r2) / 100;
    return mk(R, { q: `रमेश व सुधा यांनी एका वर्षासाठी सारखी रक्कम ठेवली. रमेशला दरसाल ${r1}% व सुधाला ${r2}% व्याज मिळाले. रमेशला ₹${nf(d)} जास्त मिळाले, तर प्रत्येकाने किती रक्कम ठेवली?`, a: P, fmt: rs, w: [P * 2, P / 2, d * 100, P + d], steps: [`दरांतील फरक = ${r1 - r2}%`, `${r1 - r2}% म्हणजे ₹${nf(d)}`, `100% = ${nf(d)} × 100 ÷ ${r1 - r2} = ₹${nf(P)}`] });
  } };
  T.trees = { name: 'झाडे लावणे / तार कापणे', gen(R) {
    if (R.r() < 0.5) { const g = R.pick([2, 4, 5, 10]), Lk = g * R.ri(5, 25), both = R.r() < 0.6, n = (Lk / g + 1) * (both ? 2 : 1);
      return mk(R, { q: `${Lk} किमी लांबीच्या रस्त्यावर ${both ? 'दुतर्फा' : 'एका बाजूला'} दर ${g} किमी अंतरावर एक झाड (सुरुवात व शेवट धरून) लावायचे आहे. एकूण किती झाडे लागतील?`, a: n, w: [Lk / g * (both ? 2 : 1), (Lk / g + 1) * (both ? 1 : 2), Lk / g, n + 2], steps: [`एका बाजूला: ${Lk} ÷ ${g} + 1 = ${Lk / g + 1}`, both ? `दुतर्फा: × 2 = ${n}` : `उत्तर ${n}`], sfig: sfPosts(Lk / g, g, 'किमी', both) }); }
    const c = R.ri(3, 11), each = R.ri(5, 70), L = each * (c + 1);
    return mk(R, { q: `${L} मीटर लांब तार ${c} ठिकाणी कापून तिचे समान तुकडे केले. तर प्रत्येक तुकड्याची लांबी किती?`, a: each, fmt: v => v + ' मी', w: [L % c === 0 ? L / c : each + 7, each - 1, L % (c + 2) === 0 ? L / (c + 2) : each + 3, each + 5], steps: [`${c} ठिकाणी कापले → ${c + 1} तुकडे`, `${L} ÷ ${c + 1} = ${each} मी`], sfig: sfCuts(c, each) });
  } };
  T.serial = { name: 'नोटांचे अनुक्रमांक', gen(R) {
    const k = R.ri(4, 15), cnt = 5 * k, A = R.ri(10000, 89999), B = A + cnt - 1;
    return mk(R, { q: `एका बंडलात ${A} क्रमांकापासून ${B} क्रमांकापर्यंत ₹100 च्या नोटा आहेत. त्याऐवजी ₹500 च्या नोटा घेतल्यास किती नोटा मिळतील?`, a: k, w: [cnt, k - 1, cnt - 1, k + 1], steps: [`नोटा = ${B} − ${A} + 1 = ${cnt}`, `रक्कम = ₹${cnt * 100}`, `${cnt * 100} ÷ 500 = ${k}`] });
  } };
  T.cancel = { name: 'रक्कम कपात (%)', gen(R) {
    const X = R.ri(200, 900) * 10, p = R.pick([10, 20, 25, 30, 40, 50]), loss = X * p / 100;
    if (loss !== Math.round(loss)) return null;
    return mk(R, { q: `स्वराने ₹${nf(X)} चे आगाऊ तिकीट काढले. ते रद्द केल्यावर ${p}% रक्कम कापून उरलेली रक्कम परत मिळाली. तर तिचे किती नुकसान झाले?`, a: loss, fmt: rs, w: [X - loss, X * p / 1000 === Math.round(X * p / 1000) ? X * p / 1000 : loss + 200, loss + 100, loss - 100], steps: [`नुकसान = कापलेली रक्कम`, `${nf(X)} × ${p} ÷ 100 = ₹${nf(loss)}`] });
  } };
  T.expr = { name: 'अक्षरी पदावली', gen(R) {
    const a = R.ri(2, 9), b = R.ri(2, 9); if (a === b) return null;
    return mk(R, { q: `चंदूने एका तासाला 'क्ष' अक्षरे या प्रमाणे ${a} तास व अलीने एका तासाला 'म' अक्षरे या प्रमाणे ${b} तास टंकलेखन केले. दोघांनी मिळून किती अक्षरांचे टंकलेखन केले?`, a: `${a}क्ष + ${b}म`, w: [`${a}क्ष × ${b}म`, `${b}म − ${a}क्ष`, `${a}म + ${b}क्ष`], steps: [`चंदू: ${a} × क्ष = ${a}क्ष`, `अली: ${b} × म = ${b}म`, `एकूण = ${a}क्ष + ${b}म`] });
  } };
  T.star = { name: 'आकृती: शिरोबिंदू मोजणे', gen(R) {
    const n = R.ri(4, 8), pts = [];
    for (let i = 0; i < 2 * n; i++) { const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? 32 : 70; pts.push(`${(80 + r * Math.cos(a)).toFixed(1)},${(80 + r * Math.sin(a)).toFixed(1)}`); }
    return mk(R, { fig: svg(160, 160, `<polygon points="${pts.join(' ')}" fill="#fff" stroke="#222" stroke-width="2"/>`), q: 'दिलेल्या आकृतीला किती शिरोबिंदू आहेत?', a: 2 * n, w: [n, 2 * n + 1, 2 * n - 1, 2 * n + 2], steps: [`बाहेरची टोके ${n} + आतली कोपरे ${n}`, `= ${2 * n}`] });
  } };
  T.tiling = { name: 'क्षेत्रफळ व खर्च', gen(R) {
    const l = R.ri(6, 20), b = R.ri(3, l - 1), r = R.ri(2, 9) * 10;
    if (R.r() < 0.5) return mk(R, { q: `एका आयताकृती वर्गखोलीची लांबी ${l} मी व रुंदी ${b} मी आहे. फरशी बसवण्यासाठी ₹${r} प्रति चौ.मी. दराने किती खर्च येईल?`, a: l * b * r, fmt: rs, w: [2 * (l + b) * r, (l + b) * r, l * b, l * b * r + r], steps: [`क्षेत्रफळ = ${l} × ${b} = ${l * b} चौ.मी.`, `× ₹${r} = ₹${nf(l * b * r)}`], sfig: sfRect(l, b, `${l} × ${b} = ${l * b} चौ.मी.`) });
    const cost = l * b * r;
    return mk(R, { q: `एका आयताकृती भिंतीला रंग देण्यासाठी ₹${r} प्रति चौ.मी. दराने ₹${nf(cost)} खर्च येतो. भिंतीची लांबी ${l} मी असल्यास रुंदी किती?`, a: b, fmt: v => v + ' मी', w: [cost / r, b + 2, b + 1, l], steps: [`क्षेत्रफळ = ${nf(cost)} ÷ ${r} = ${l * b} चौ.मी.`, `रुंदी = ${l * b} ÷ ${l} = ${b} मी`], sfig: sfRect(l, b, `क्षेत्रफळ ${l * b} चौ.मी.`) });
  } };


  // ═════════════ बुद्धिमत्ता: शब्दांवरचे व तर्काचे प्रश्न (4थी पातळी) ═════════════
  const REL = [ // [संबंध, जोड्या]
    ['व्यक्ती → कामाचे ठिकाण', [['डॉक्टर', 'दवाखाना'], ['शिक्षक', 'शाळा'], ['शेतकरी', 'शेत'], ['वकील', 'न्यायालय'], ['पुजारी', 'मंदिर'], ['विक्रेता', 'दुकान'], ['कामगार', 'कारखाना'], ['वैमानिक', 'विमान']]],
    ['प्राणी → राहण्याची जागा', [['पक्षी', 'घरटे'], ['घोडा', 'तबेला'], ['गाय', 'गोठा'], ['सिंह', 'गुहा'], ['मधमाशी', 'पोळे'], ['उंदीर', 'बीळ'], ['माणूस', 'घर'], ['कोळी', 'जाळे']]],
    ['प्राणी → त्याचा आवाज', [['गाय', 'हंबरणे'], ['घोडा', 'खिंकाळणे'], ['सिंह', 'गर्जना'], ['कुत्रा', 'भुंकणे'], ['हत्ती', 'चीत्कार'], ['कावळा', 'कावकाव']]],
    ['प्राणी → त्याचे पिल्लू', [['गाय', 'वासरू'], ['घोडा', 'शिंगरू'], ['शेळी', 'करडू'], ['म्हैस', 'रेडकू'], ['हरीण', 'पाडस'], ['कोंबडी', 'पिल्लू']]],
    ['व्यक्ती → वापरण्याचे साधन', [['शिंपी', 'सुई'], ['सुतार', 'करवत'], ['शेतकरी', 'नांगर'], ['चित्रकार', 'कुंचला'], ['न्हावी', 'वस्तरा'], ['माळी', 'खुरपे'], ['लेखक', 'लेखणी']]],
    ['अवयव → त्याचे काम', [['डोळे', 'पाहणे'], ['कान', 'ऐकणे'], ['नाक', 'वास घेणे'], ['जीभ', 'चव घेणे'], ['पाय', 'चालणे'], ['दात', 'चावणे']]],
    ['पदार्थ → कशापासून बनतो', [['लोणी', 'दूध'], ['कपडा', 'धागा'], ['साखर', 'ऊस'], ['कागद', 'लाकूड'], ['तेल', 'शेंगदाणे'], ['पोळी', 'कणीक']]],
    ['विरुद्ध अर्थ', [['उंच', 'ठेंगणा'], ['जाड', 'बारीक'], ['सुरुवात', 'शेवट'], ['जय', 'पराजय'], ['आळशी', 'उद्योगी'], ['श्रीमंत', 'गरीब'], ['प्रकाश', 'अंधार']]],
    ['राशी → तिचे एकक', [['लांबी', 'मीटर'], ['वस्तुमान', 'किलोग्रॅम'], ['वेळ', 'सेकंद'], ['धारकता', 'लीटर'], ['तापमान', 'अंश सेल्सिअस']]],
  ];
  T.wordAnalogy = { name: 'शब्द सहसंबंध', gen(R) {
    const [rel, pairs] = R.pick(REL), [p1, p2] = R.shuffle(pairs);
    const others = pairs.filter(p => p !== p1 && p !== p2).map(p => p[1]).filter(x => x !== p2[1] && x !== p1[1]);
    return mk(R, { q: `${p1[0]} : ${p1[1]} :: ${p2[0]} : ?`, a: p2[1], w: R.shuffle(others),
      steps: [`संबंध: ${rel} (${p1[0]} → ${p1[1]})`, `तसेच ${p2[0]} → ${p2[1]}`] });
  } };

  const CAT = [
    ['फळे', ['आंबा', 'पेरू', 'केळे', 'संत्रे', 'चिकू', 'डाळिंब', 'पपई', 'सफरचंद']],
    ['भाज्या', ['वांगी', 'भेंडी', 'कोबी', 'बटाटा', 'गाजर', 'मेथी', 'पालक']],
    ['पाळीव प्राणी', ['गाय', 'म्हैस', 'शेळी', 'कुत्रा', 'मांजर', 'घोडा']],
    ['जंगली प्राणी', ['वाघ', 'सिंह', 'लांडगा', 'कोल्हा', 'अस्वल', 'चित्ता']],
    ['पक्षी', ['कावळा', 'चिमणी', 'पोपट', 'मोर', 'कबूतर', 'घार']],
    ['वाद्ये', ['तबला', 'ढोलकी', 'बासरी', 'सतार', 'हार्मोनियम', 'वीणा']],
    ['फुले', ['गुलाब', 'मोगरा', 'जाई', 'झेंडू', 'कमळ', 'सूर्यफूल']],
    ['ग्रह', ['बुध', 'शुक्र', 'मंगळ', 'गुरू', 'शनी', 'पृथ्वी']],
    ['वाहने', ['बस', 'रिक्षा', 'सायकल', 'मोटार', 'ट्रक', 'रेल्वे']],
    ['धातू', ['लोखंड', 'तांबे', 'सोने', 'चांदी', 'ॲल्युमिनियम']],
    ['महिने', ['जानेवारी', 'मार्च', 'मे', 'जुलै', 'ऑगस्ट', 'डिसेंबर']],
    ['रंग', ['लाल', 'निळा', 'पिवळा', 'हिरवा', 'जांभळा', 'पांढरा']],
  ];
  // groups that must never be mixed (the odd one would not be clearly odd)
  const NOMIX = { 'पाळीव प्राणी': ['जंगली प्राणी'], 'जंगली प्राणी': ['पाळीव प्राणी'], 'फळे': ['भाज्या'], 'भाज्या': ['फळे'] };
  T.wordOdd = { name: 'गटात न बसणारा शब्द', gen(R, L) {
    const [cn, items] = R.pick(CAT), near = L > 1 && NOMIX[cn] ? NOMIX[cn] : [];
    const pool = CAT.filter(c => c[0] !== cn && (near.length ? near.includes(c[0]) : !(NOMIX[cn] || []).includes(c[0])));
    const [on, oitems] = R.pick(pool), odd = R.pick(oitems.filter(x => !items.includes(x)));
    if (!odd) return null;
    return mk(R, { q: 'गटात न बसणारा शब्द ओळखा.', a: odd, w: R.shuffle(items).slice(0, 3), steps: [`बाकीचे सर्व ${cn} आहेत`, `${odd} हे "${on}" या गटात येते`] });
  } };

  T.letterOdd = { name: 'गटात न बसणारा अक्षरगट', gen(R, L) {
    const k = L === 1 ? R.ri(1, 2) : R.ri(1, 3), len = L === 3 ? 4 : 3, span = k * (len - 1) + 1;
    const starts = R.shuffle([...Array(25 - span).keys()]).slice(0, 4);
    const grp = (s, bump) => [...Array(len).keys()].map(i => AB[s + i * k + (bump && i === len - 1 ? 1 : 0)]).join('');
    const odd = grp(starts[0], true);
    return mk(R, { q: 'गटात न बसणारा अक्षरगट ओळखा.', a: odd, w: starts.slice(1).map(s => grp(s, false)),
      steps: [`बाकीच्या गटांत पुढचे अक्षर ${k === 1 ? 'लगेच पुढचे' : k + ' जागा पुढे'} आहे (+${k})`, `${odd} मध्ये शेवटचे अक्षर +${k + 1} आहे`] });
  } };

  T.letterAnalogy = { name: 'अक्षर सहसंबंध', gen(R, L) {
    const m = R.ri(1, L === 1 ? 3 : 6), g = R.ri(1, 3), len = L === 3 ? 3 : 2;
    const grp = s => [...Array(len).keys()].map(i => AB[s + i * g]).join('');
    const top = 25 - g * (len - 1) - m - 1, a = R.ri(0, top), c = R.ri(0, top); if (a === c) return null;
    const sh = (s, d) => s.split('').map(ch => AB[(AB.indexOf(ch) + d + 26) % 26]).join('');
    const A1 = grp(a), C1 = grp(c), ans = sh(C1, m);
    return mk(R, { q: `${A1} : ${sh(A1, m)} :: ${C1} : ?`, a: ans, w: [sh(C1, m + 1), sh(C1, m - 1 || m + 2), ans.split('').reverse().join(''), sh(C1, -m)],
      steps: [`${A1} मधील प्रत्येक अक्षर ${m} जागा पुढे → ${sh(A1, m)}`, `${C1} → ${ans}`] });
  } };

  // नातेसंबंध: {m} = मुलगा, {f} = मुलगी, {m2} दुसरा मुलगा
  const RELQ = [
    ['{m}च्या वडिलांची बहीण ही {m}ची कोण?', 'आत्या', ['मावशी', 'मामी', 'काकू'], 'वडिलांची बहीण = आत्या'],
    ['{m}च्या आईचा भाऊ हा {m}चा कोण?', 'मामा', ['काका', 'आजोबा', 'मेव्हणा'], 'आईचा भाऊ = मामा'],
    ['{m}च्या वडिलांचा भाऊ हा {m}चा कोण?', 'काका', ['मामा', 'आजोबा', 'मेव्हणा'], 'वडिलांचा भाऊ = काका'],
    ['{f}च्या आईची बहीण ही {f}ची कोण?', 'मावशी', ['आत्या', 'मामी', 'काकू'], 'आईची बहीण = मावशी'],
    ['{f}च्या मामाची पत्नी ही {f}ची कोण?', 'मामी', ['मावशी', 'आत्या', 'काकू'], 'मामाची पत्नी = मामी'],
    ['{m}च्या काकांची पत्नी ही {m}ची कोण?', 'काकू', ['मामी', 'आत्या', 'मावशी'], 'काकांची पत्नी = काकू'],
    ['{m}च्या वडिलांचे वडील हे {m}चे कोण?', 'आजोबा', ['काका', 'पणजोबा', 'मामा'], 'वडिलांचे वडील = आजोबा'],
    ['{f}च्या आईची आई ही {f}ची कोण?', 'आजी', ['मावशी', 'पणजी', 'मामी'], 'आईची आई = आजी'],
    ['{m}च्या आजोबांचा (वडिलांच्या वडिलांचा) एकुलता एक मुलगा हा {m}चा कोण?', 'वडील', ['काका', 'भाऊ', 'मामा'], 'आजोबांचा एकुलता एक मुलगा = {m}चे वडीलच'],
    ['{m} म्हणतो, "माझ्या वडिलांच्या एकुलत्या एका मुलाचा मुलगा" हा {m}चा कोण?', 'मुलगा', ['भाऊ', 'पुतण्या', 'नातू'], 'वडिलांचा एकुलता एक मुलगा = {m} स्वतः', '{m}चा मुलगा = मुलगा'],
    ['{m}ची आई ही {f}च्या वडिलांची बहीण आहे. तर {f} ही {m}ची कोण?', 'मामेबहीण', ['आतेबहीण', 'मावसबहीण', 'चुलतबहीण'], '{f}चे वडील = {m}च्या आईचा भाऊ = {m}चे मामा', 'मामाची मुलगी = मामेबहीण'],
    ['{m}चे वडील आणि {m2}चे वडील सख्खे भाऊ आहेत. तर {m2} हा {m}चा कोण?', 'चुलतभाऊ', ['मामेभाऊ', 'आतेभाऊ', 'मावसभाऊ'], 'काकांचा मुलगा = चुलतभाऊ'],
    ['{m}ची आई आणि {m2}ची आई सख्ख्या बहिणी आहेत. तर {m2} हा {m}चा कोण?', 'मावसभाऊ', ['चुलतभाऊ', 'आतेभाऊ', 'मामेभाऊ'], 'मावशीचा मुलगा = मावसभाऊ'],
    ['{m}चे वडील हे {m2}च्या आईचे भाऊ आहेत. तर {m2} हा {m}चा कोण?', 'आतेभाऊ', ['मामेभाऊ', 'चुलतभाऊ', 'मावसभाऊ'], '{m2}ची आई = {m}च्या वडिलांची बहीण = {m}ची आत्या', 'आत्याचा मुलगा = आतेभाऊ'],
    ['{m}च्या भावाचा मुलगा हा {m}चा कोण?', 'पुतण्या', ['भाचा', 'नातू', 'मुलगा'], 'भावाचा मुलगा = पुतण्या'],
    ['{f}च्या बहिणीचा मुलगा हा {f}चा कोण?', 'भाचा', ['पुतण्या', 'नातू', 'मेव्हणा'], 'बहिणीचा मुलगा = भाचा'],
    ['{m}च्या मुलाचा मुलगा हा {m}चा कोण?', 'नातू', ['पुतण्या', 'भाचा', 'पणतू'], 'मुलाचा मुलगा = नातू'],
    ['एका मुलाकडे बोट दाखवून {f} म्हणाली, "याची आई माझ्या आईची एकुलती एक मुलगी आहे." तर तो मुलगा {f}चा कोण?', 'मुलगा', ['भाऊ', 'भाचा', 'पुतण्या'], 'आईची एकुलती एक मुलगी = {f} स्वतः', 'म्हणजे मुलाची आई {f} → तो {f}चा मुलगा'],
    ['एका स्त्रीकडे बोट दाखवून {m} म्हणाला, "ही माझ्या आजोबांच्या एकुलत्या एका मुलाची पत्नी आहे." तर ती स्त्री {m}ची कोण?', 'आई', ['काकू', 'आजी', 'मावशी'], 'आजोबांचा एकुलता एक मुलगा = {m}चे वडील', 'वडिलांची पत्नी = आई'],
  ];
  const GIRLS = ['सीमा', 'पूजा', 'स्नेहा', 'कविता', 'मीना', 'रिया'];
  T.relation = { name: 'नातेसंबंध', gen(R) {
    const [q, a, w, ...st] = R.pick(RELQ), [m, m2] = R.shuffle(PEOPLE), f = R.pick(GIRLS);
    const fill = s => s.replace(/\{m2\}/g, m2).replace(/\{m\}/g, m).replace(/\{f\}/g, f);
    return mk(R, { q: fill(q), a, w, steps: st.map(fill) });
  } };

  // बैठक व्यवस्था: एका रांगेत उत्तरेकडे तोंड (डावीकडून उजवीकडे)
  const SEAT = ['अमर', 'बबन', 'चेतन', 'दीपक', 'ईश्वर', 'फारूक'];
  const permsOf = a => a.length < 2 ? [a] : a.flatMap((x, i) => permsOf(a.slice(0, i).concat(a.slice(i + 1))).map(p => [x, ...p]));
  T.seating = { name: 'बैठक व्यवस्था (रांग)', gen(R, L) {
    const n = L === 1 ? 4 : 5, names = R.shuffle(SEAT).slice(0, n), sol = R.shuffle(names), all = permsOf(names);
    const P = (p, x) => p.indexOf(x);
    const C = [];
    for (const x of names) for (const y of names) if (x !== y) {
      C.push([`${x} हा ${y}च्या लगेच डावीकडे आहे`, p => P(p, x) === P(p, y) - 1]);
      C.push([`${x} हा ${y}च्या डावीकडे (कुठेतरी) आहे`, p => P(p, x) < P(p, y)]);
      if (x < y) C.push([`${x} आणि ${y} यांच्यामध्ये फक्त एक जण आहे`, p => Math.abs(P(p, x) - P(p, y)) === 2]);
      if (x < y) C.push([`${x} आणि ${y} शेजारी बसले आहेत`, p => Math.abs(P(p, x) - P(p, y)) === 1]);
    }
    for (const x of names) {
      C.push([`${x} डाव्या टोकाला आहे`, p => P(p, x) === 0]);
      C.push([`${x} एका टोकाला आहे`, p => P(p, x) === 0 || P(p, x) === n - 1]);
      C.push([`${x} कोणत्याही टोकाला नाही`, p => P(p, x) > 0 && P(p, x) < n - 1]);
    }
    let clues = R.shuffle(C.filter(([, f]) => f(sol))), cand = all, used = [];
    for (const c of clues) { const nx = cand.filter(c[1]); if (nx.length < cand.length) { used.push(c); cand = nx; } if (cand.length === 1) break; }
    if (cand.length !== 1) return null;
    for (let i = used.length - 1; i >= 0; i--) { const rest = used.filter((_, j) => j !== i); if (all.filter(p => rest.every(c => c[1](p))).length === 1) used = rest; }
    if (used.length > 5) return null;
    const kind = R.ri(0, 2), x = R.pick(names), i = sol.indexOf(x);
    let q, a;
    if (kind === 0 && n === 5) { q = 'तर मध्यभागी कोण बसला आहे?'; a = sol[2]; }
    else if (kind === 1 && i < n - 1) { q = `तर ${x}च्या लगेच उजवीकडे कोण आहे?`; a = sol[i + 1]; }
    else { q = 'तर उजव्या टोकाला कोण आहे?'; a = sol[n - 1]; }
    return mk(R, { q: `${names.join(', ')} हे ${W[n]} मित्र एका रांगेत उत्तरेकडे तोंड करून बसले आहेत. ${R.shuffle(used).map(c => c[0]).join('. ')}. ${q}`, a, w: names.filter(y => y !== a),
      steps: ['माहितीप्रमाणे एक-एक जागा ठरवा (डावीकडून उजवीकडे)', `रांग: ${sol.join(' – ')}`, `उत्तर: ${a}`], sfig: sfRow(sol, a) });
  } };

  // वर्तनविषयक (योग्य कृती ओळखा)
  const BEH = [
    ['शाळेत जाताना रस्त्यावर एक पैशांचे पाकीट पडलेले दिसले. तुम्ही काय कराल?', 'ते शिक्षकांकडे किंवा पोलिसांकडे जमा कराल', ['ते घरी घेऊन जाल', 'त्यातील पैसे मित्रांना वाटाल', 'दुर्लक्ष करून पुढे जाल']],
    ['वर्गातील तुमचा मित्र आजारी असल्याने आठ दिवस शाळेत येऊ शकला नाही. तुम्ही काय कराल?', 'त्याला झालेला अभ्यास वही देऊन समजावून सांगाल', ['त्याची चेष्टा कराल', 'त्याच्याशी बोलणे बंद कराल', 'त्याची तक्रार शिक्षकांकडे कराल']],
    ['एक अंध व्यक्ती रस्ता ओलांडण्यासाठी थांबली आहे. तुम्ही काय कराल?', 'त्यांचा हात धरून सावकाश रस्ता ओलांडण्यास मदत कराल', ['त्यांच्याकडे पाहत उभे राहाल', 'घाईने पुढे निघून जाल', 'त्यांना दुसऱ्याला मदत मागायला सांगाल']],
    ['परीक्षेत शेजारी बसलेला मित्र तुम्हाला उत्तर विचारतो. तुम्ही काय कराल?', 'परीक्षेनंतर त्याला अभ्यासात मदत करीन असे सांगाल', ['त्याला उत्तर सांगाल', 'तुमची उत्तरपत्रिका दाखवाल', 'त्याच्याशी मोठ्याने भांडाल']],
    ['शाळेतील नळ सुरू राहून पाणी वाया जात आहे. तुम्ही काय कराल?', 'लगेच नळ बंद कराल', ['कोणीतरी बंद करेल म्हणून दुर्लक्ष कराल', 'मित्रांना पाहायला बोलवाल', 'नळाखाली हात धुवत बसाल']],
    ['शाळेच्या आवारात कागद, कचरा पडलेला दिसला. तुम्ही काय कराल?', 'तो उचलून कचराकुंडीत टाकाल', ['तसाच राहू द्याल', 'शिपायाची वाट पाहाल', 'तो दुसऱ्या बाजूला ढकलाल']],
    ['खेळताना तुमच्याकडून चुकून मित्राची वस्तू तुटली. तुम्ही काय कराल?', 'खरे सांगून त्याची माफी मागाल', ['ती लपवून ठेवाल', 'दुसऱ्याने तोडली असे सांगाल', 'काहीच बोलणार नाही']],
    ['वर्गात नवीन विद्यार्थी आला आहे, तो कोणाशीच बोलत नाही. तुम्ही काय कराल?', 'त्याच्याशी ओळख करून मैत्री कराल', ['त्याच्याकडे दुर्लक्ष कराल', 'त्याला चिडवाल', 'तो बोलेपर्यंत थांबाल']],
    ['बसमध्ये तुम्ही बसलेले आहात आणि एक वृद्ध व्यक्ती उभी आहे. तुम्ही काय कराल?', 'उठून त्यांना बसायला जागा द्याल', ['खिडकीबाहेर पाहत बसाल', 'झोपेचे सोंग घ्याल', 'त्यांना दुसरी जागा शोधायला सांगाल']],
    ['एक अनोळखी माणूस खाऊ देऊन तुम्हाला सोबत चल म्हणतो. तुम्ही काय कराल?', 'नकार देऊन लगेच शिक्षकांना किंवा घरच्यांना सांगाल', ['खाऊ घेऊन त्याच्यासोबत जाल', 'फक्त खाऊ घ्याल', 'मित्रालाही सोबत न्याल']],
    ['खेळाच्या सामन्यात तुमचा संघ हरला. तुम्ही काय कराल?', 'जिंकलेल्या संघाचे अभिनंदन कराल', ['पंचांशी भांडाल', 'रागावून खेळ सोडून द्याल', 'जिंकलेल्या संघाला चिडवाल']],
    ['घराजवळ एका ठिकाणी आग लागलेली दिसली. तुम्ही काय कराल?', 'मोठ्यांना सांगून अग्निशमन दलाला (101) कळवाल', ['आग पाहत उभे राहाल', 'स्वतः आगीत जाऊन पाहाल', 'घरी जाऊन लपून बसाल']],
    ['शाळेतील झाडांना कोणी पाणी घालत नाही, ती सुकत आहेत. तुम्ही काय कराल?', 'मित्रांसोबत रोज पाणी घालायचे ठरवाल', ['झाडे सुकू द्याल', 'झाडांच्या फांद्या तोडाल', 'फक्त शिक्षकांना दोष द्याल']],
    ['रस्त्यावर एक जखमी पक्षी दिसला. तुम्ही काय कराल?', 'मोठ्यांच्या मदतीने त्याला सुरक्षित जागी नेऊन उपचार कराल', ['त्याला दगड माराल', 'त्याच्याकडे दुर्लक्ष कराल', 'त्याला पकडून पिंजऱ्यात ठेवाल']],
    ['तुमच्या मित्राला गणितातील एक उदाहरण समजत नाही. तुम्ही काय कराल?', 'त्याला उदाहरण समजावून सांगाल', ['त्याला "तुला काही येत नाही" म्हणाल', 'त्याची वही घेऊन ते सोडवून द्याल', 'त्याला दुसऱ्याकडे जायला सांगाल']],
    ['दुकानदाराने चुकून तुम्हाला ₹10 जास्त परत दिले. तुम्ही काय कराल?', 'जास्तीचे ₹10 दुकानदाराला परत कराल', ['ते पैसे खाऊसाठी वापराल', 'काहीच न बोलता घरी जाल', 'मित्रांना सांगून हसाल']],
  ];
  T.behaviour = { name: 'वर्तनविषयक प्रश्न', gen(R) {
    const [q, a, w] = R.pick(BEH);
    return mk(R, { q, a, w, steps: [`योग्य वर्तन: ${a}`, 'प्रामाणिकपणा, मदत, सुरक्षितता आणि जबाबदारी दाखवणारी कृती निवडा'] });
  } };


  // ═════════════ उकलीतील आकृती (solution figures, SVG) — drawn from the same numbers as the answer ═════════════
  const SF = 'font-family="Nirmala UI, Noto Sans Devanagari, Mangal, Arial, sans-serif"';
  const T_ = (x, y, t, o = '') => `<text x="${x}" y="${y}" ${SF}${/font-size=/.test(o) ? '' : ' font-size="13"'} text-anchor="middle" ${o}>${t}</text>`;
  const ARROWDEF = '<defs><marker id="sa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#e16b13"/></marker><marker id="sb" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#15803d"/></marker><marker id="sg" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#9aa5b1"/></marker></defs>';
  const VEC = { 'उत्तर': [0, -1], 'पूर्व': [1, 0], 'दक्षिण': [0, 1], 'पश्चिम': [-1, 0] };
  // path on a grid: every leg with its length, start, end and the straight distance
  function sfDistance(legs, ans) {
    let x = 0, y = 0; const pts = [[0, 0]];
    for (const [d, k] of legs) { x += VEC[d][0] * k; y += VEC[d][1] * k; pts.push([x, y]); }
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    const W = 340, H = 260, pad = 62, sx = (W - 2 * pad) / Math.max(1, Math.max(...xs) - Math.min(...xs)), sy = (H - 2 * pad) / Math.max(1, Math.max(...ys) - Math.min(...ys)), k = Math.min(sx, sy);
    const P = ([a, b]) => [pad + (a - Math.min(...xs)) * k, pad + (b - Math.min(...ys)) * k];
    const PP = pts.map(P), cx = PP.reduce((t, q) => t + q[0], 0) / PP.length, cy = PP.reduce((t, q) => t + q[1], 0) / PP.length;
    let o = ARROWDEF;
    for (let i = 0; i < legs.length; i++) {
      const [x1, y1] = PP[i], [x2, y2] = PP[i + 1];
      o += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#e16b13" stroke-width="3" marker-end="url(#sa)"/>`;
      // the length on the outer side of each leg, so labels never sit on the path
      let mx = (x1 + x2) / 2, my = (y1 + y2) / 2; const horiz = Math.abs(y1 - y2) < 1;
      // the walk ends on this leg: put its length on the part before the end point
      const [ex0, ey0] = PP[PP.length - 1];
      if (i === 0 && !horiz && Math.abs(ex0 - x1) < 1 && (ey0 - y1) * (ey0 - y2) < 0) my = (y1 + ey0) / 2;
      if (i === 0 && horiz && Math.abs(ey0 - y1) < 1 && (ex0 - x1) * (ex0 - x2) < 0) mx = (x1 + ex0) / 2;
      if (horiz) o += T_(mx, my <= cy ? my - 9 : my + 20, `${legs[i][1]} किमी`, 'font-weight="700"');
      else o += `<text x="${mx <= cx ? mx - 8 : mx + 8}" y="${my + 4}" ${SF} font-size="13" font-weight="700" text-anchor="${mx <= cx ? 'end' : 'start'}">${legs[i][1]} किमी</text>`;
    }
    const [sx0, sy0] = PP[0], [ex, ey] = PP[PP.length - 1];
    o += `<line x1="${sx0}" y1="${sy0}" x2="${ex}" y2="${ey}" stroke="#15803d" stroke-width="2.5" stroke-dasharray="6 4"/>`;
    const side = (px, py) => (px <= cx ? { x: px - 10, a: 'end' } : { x: px + 10, a: 'start' });
    const st = side(sx0, sy0), en = side(ex, ey);
    o += `<circle cx="${sx0}" cy="${sy0}" r="6" fill="#1e3a8a"/><text x="${st.x}" y="${sy0 + (sy0 >= cy ? 18 : -10)}" ${SF} font-size="13" fill="#1e3a8a" text-anchor="${st.a}">सुरुवात</text>`;
    o += `<circle cx="${ex}" cy="${ey}" r="6" fill="#15803d"/><text x="${en.x}" y="${ey + (ey >= cy ? 18 : -10)}" ${SF} font-size="13" fill="#15803d" font-weight="700" text-anchor="${en.a}">शेवट</text>`;
    o += `<rect x="6" y="${H - 30}" width="${W - 12}" height="24" rx="8" fill="#e4f4e9"/>` + T_(W / 2, H - 13, `सुरुवात ते शेवट (हिरवी रेषा) = ${ans} किमी`, 'font-weight="700" fill="#15803d"');
    o += `<g transform="translate(${W - 20} 34)"><line x1="0" y1="14" x2="0" y2="-8" stroke="#111" stroke-width="2" marker-end="url(#sa)"/>${T_(0, 28, 'उत्तर', 'font-size="11"')}</g>`;
    return svg(W, H, o);
  }
  // compass: where the face was, where it is now (and the right hand when asked)
  function sfCompass(dirNames, start, end, hand) {
    const W = 260, H = 300, c = 130, r = 92;
    let o = ARROWDEF + `<circle cx="${c}" cy="${c}" r="${r + 18}" fill="#fff7ef" stroke="#e7c9a9"/>`;
    dirNames.forEach((d, i) => { const a = (-90 + i * 45) * Math.PI / 180; o += T_((c + (r + 2) * Math.cos(a)).toFixed(1), (c + 5 + (r + 2) * Math.sin(a)).toFixed(1), d, i % 2 ? 'font-size="11" fill="#666"' : 'font-weight="700"'); });
    const arm = (i, col, mk, len = 62) => { const a = (-90 + i * 45) * Math.PI / 180; return `<line x1="${c}" y1="${c}" x2="${(c + len * Math.cos(a)).toFixed(1)}" y2="${(c + len * Math.sin(a)).toFixed(1)}" stroke="${col}" stroke-width="4" marker-end="url(#${mk})"/>`; };
    o += arm(start, '#9aa5b1', 'sg', 50) + arm(end, '#e16b13', 'sa');
    if (hand != null) o += arm(hand, '#15803d', 'sb', 70);
    o += `<circle cx="${c}" cy="${c}" r="6" fill="#111"/>`;
    o += `<text x="8" y="${H - 24}" ${SF} font-size="12" fill="#666">राखाडी: सुरुवातीचं तोंड</text><text x="8" y="${H - 8}" ${SF} font-size="12" fill="#e16b13">नारिंगी: आता तोंड${hand != null ? ' · हिरवा: उजवा हात' : ''}</text>`;
    return svg(W, H, o);
  }
  // a queue: front block, the child, back block
  function sfRank(front, back, who) {
    const W = 320, H = 120;
    let o = `${T_(24, 20, 'पुढे', 'font-weight="700"')}${T_(W - 24, 20, 'मागे', 'font-weight="700"')}`;
    o += `<rect x="10" y="34" width="110" height="40" rx="8" fill="#e8eef7" stroke="#1e3a8a"/>${T_(65, 59, `${front - 1} मुले`)}`;
    o += `<rect x="130" y="30" width="60" height="48" rx="8" fill="#e16b13"/>${T_(160, 59, who, 'fill="#fff" font-weight="700"')}`;
    o += `<rect x="200" y="34" width="110" height="40" rx="8" fill="#e8eef7" stroke="#1e3a8a"/>${T_(255, 59, `${back - 1} मुले`)}`;
    o += T_(160, 100, `पुढून ${front} वा · मागून ${back} वा · एकूण ${front - 1} + 1 + ${back - 1} = ${front + back - 1}`, 'font-size="12"');
    return svg(W, H + 10, o);
  }
  // tallest → shortest
  function sfHeights(order) {
    const W = 300, H = 170, n = order.length;
    let o = '';
    order.forEach((nm, i) => { const h = 120 - i * 24, x = 20 + i * (W - 40) / n; o += `<rect x="${x}" y="${140 - h}" width="${(W - 40) / n - 14}" height="${h}" rx="6" fill="${i === 0 ? '#e16b13' : i === n - 1 ? '#1e3a8a' : '#9aa5b1'}"/>${T_(x + ((W - 40) / n - 14) / 2, 160, nm, 'font-weight="700"')}`; });
    return svg(W, H + 6, o);
  }
  // seats left → right, facing north
  function sfRow(names, mark) {
    const n = names.length, bw = 58, W = n * (bw + 8) + 16, H = 110;
    let o = T_(W / 2, 16, '↑ उत्तरेकडे तोंड', 'font-size="12" fill="#666"');
    names.forEach((nm, i) => { const x = 12 + i * (bw + 8); o += `<rect x="${x}" y="28" width="${bw}" height="44" rx="8" fill="${nm === mark ? '#e16b13' : '#e8eef7'}" stroke="#1e3a8a"/>${T_(x + bw / 2, 55, nm, nm === mark ? 'fill="#fff" font-weight="700"' : 'font-weight="700"')}${T_(x + bw / 2, 92, i + 1, 'font-size="11" fill="#666"')}`; });
    o += T_(W / 2, 106, 'डावीकडून → उजवीकडे', 'font-size="11" fill="#666"');
    return svg(W, H + 4, o);
  }
  // A–Z strip: the starting letter and the answer
  function sfLetters(letters, from, to) {
    const n = letters.length, bw = 22, W = n * bw + 8, H = 78;
    let o = '';
    for (let i = 0; i < n; i++) { const x = 4 + i * bw, col = i === to ? '#15803d' : i === from ? '#e16b13' : '#fff'; o += `<rect x="${x}" y="20" width="${bw - 2}" height="26" fill="${col}" stroke="#555"/>${T_(x + bw / 2 - 1, 38, letters[i], `font-weight="700" ${i === to || i === from ? 'fill="#fff"' : ''}`)}${T_(x + bw / 2 - 1, 62, i + 1, 'font-size="10" fill="#666"')}`; }
    if (from != null && from !== to) { const x1 = 4 + from * bw + bw / 2, x2 = 4 + to * bw + bw / 2; o += ARROWDEF + `<path d="M${x1} 18 Q${(x1 + x2) / 2} 0 ${x2} 18" fill="none" stroke="#15803d" stroke-width="2" marker-end="url(#sb)"/>`; }
    return svg(W, H, o);
  }
  // bar model: n split into b equal parts, a of them taken
  function sfFracBar(n, a, b) {
    const W = 300, H = 90, pw = (W - 20) / b;
    let o = '';
    for (let i = 0; i < b; i++) o += `<rect x="${10 + i * pw}" y="24" width="${pw}" height="34" fill="${i < a ? '#f59e0b' : '#fff'}" stroke="#333"/>${T_(10 + i * pw + pw / 2, 46, n / b, 'font-weight="700" font-size="12"')}`;
    o += T_(W / 2, 16, `${n} चे ${b} समान भाग · प्रत्येक ${n / b}`, 'font-size="12"') + T_(W / 2, 80, `${a} भाग = ${a} × ${n / b} = ${n * a / b}`, 'font-weight="700" fill="#b45309"');
    return svg(W, H, o);
  }
  // posts along a road (first and last counted) / a wire cut in c places
  function sfPosts(gaps, gap, unit, both) {
    const W = 320, H = 96, show = Math.min(gaps, 8), step = (W - 40) / show;
    let o = `<line x1="20" y1="50" x2="${W - 20}" y2="50" stroke="#555" stroke-width="3"/>`;
    for (let i = 0; i <= show; i++) { const x = 20 + i * step; o += `<circle cx="${x}" cy="40" r="7" fill="#15803d"/><rect x="${x - 1.5}" y="44" width="3" height="10" fill="#7c4a1e"/>`; if (i < show) o += T_(x + step / 2, 72, gaps > show && i === show - 2 ? '…' : `${gap} ${unit}`, 'font-size="11"'); }
    o += T_(W / 2, 92, `${gaps} अंतरे → ${gaps + 1} झाडे${both ? ` · दुतर्फा × 2 = ${(gaps + 1) * 2}` : ''}`, 'font-weight="700"');
    return svg(W, H + 4, o);
  }
  function sfCuts(cuts, each) {
    const W = 320, H = 86, pieces = cuts + 1, show = Math.min(pieces, 9), pw = (W - 40) / show;
    let o = '';
    for (let i = 0; i < show; i++) o += `<rect x="${20 + i * pw}" y="30" width="${pw - 4}" height="12" rx="3" fill="#9aa5b1"/>${i < show - 1 ? `<text x="${20 + (i + 1) * pw - 2}" y="26" font-size="13" text-anchor="middle">✂</text>` : ''}`;
    o += T_(W / 2, 64, `${cuts} ठिकाणी कापले → ${pieces} तुकडे · प्रत्येक ${each} मी`, 'font-weight="700"');
    return svg(W, H, o);
  }
  // a room / wall with its sides
  function sfRect(l, b, inner) {
    const W = 280, H = 190, k = Math.min(200 / l, 120 / b), w = l * k, h = b * k, x = (W - w) / 2, y = 24;
    return svg(W, H, `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff7ef" stroke="#e16b13" stroke-width="3"/>${T_(W / 2, y - 6, `लांबी ${l} मी`, 'font-weight="700"')}<text x="${x - 6}" y="${y + h / 2}" ${SF} font-size="13" text-anchor="end" font-weight="700">${b} मी</text>${T_(W / 2, y + h / 2 + 5, inner, 'font-weight="700" fill="#b45309"')}`);
  }

  // lessons per standard (draft — the real build takes the chapter list from the batch)
  // 4थी शिष्यवृत्ती: प्रकरणे (2020–2024 च्या papers मधून)
  const GROUPS = {
    4: {
      'गणित': [
        ['संख्याज्ञान', ['words', 'sawa', 'place', 'extremes', 'digits', 'numErr', 'countDigit', 'orderDiff', 'roman']],
        ['मूलभूत क्रिया', ['bodmas', 'missing', 'divRem', 'crypt', 'stmt']],
        ['अपूर्णांक', ['fracAdd', 'fracMissing', 'fracOf', 'fracOrder', 'mixed', 'fracTimes', 'circleFrac', 'shadePct']],
        ['दशांश अपूर्णांक', ['decCompare', 'decOrder', 'decExpand', 'decAddSub', 'rupee']],
        ['मापन', ['count', 'measure', 'unitMul', 'prefix', 'thick']],
        ['विभाज्यता, मूळ संख्या', ['divisors', 'divisible', 'multNth', 'primePair', 'primeCount', 'squareCount']],
        ['नफा-तोटा, शेकडेवारी, व्याज', ['profit2', 'pct', 'cancel', 'si', 'si2']],
        ['व्यवहारी उदाहरणे', ['unitary', 'notes', 'serial', 'trees', 'expr']],
        ['वेळ व दिनदर्शिका', ['time', 'clock', 'cal5', 'calendar']],
        ['भूमिती, परिमिती, क्षेत्रफळ', ['gridPerim', 'tiling', 'fence', 'solids', 'circle', 'star']],
        ['माहितीचे वाचन', ['picto']],
      ],
      'बुद्धिमत्ता': [
        ['मालिका (संख्या, अक्षर, आकृती)', ['series', 'wrongTerm', 'letters', 'f:series']],
        ['सांकेतिक भाषा', ['code', 'numCode', 'naming']],
        ['दिशा, क्रम व बैठक व्यवस्था', ['direction', 'distance', 'rank', 'compare', 'seating']],
        ['नातेसंबंध', ['relation']],
        ['दिनदर्शिका व वय', ['calendar', 'age', 'ageSum']],
        ['अक्षर-अंक मोजणी', ['alpha', 'wordPos', 'digitCount']],
        ['सहसंबंध', ['wordAnalogy', 'analogy', 'letterAnalogy', 'f:analogy']],
        ['वर्गीकरण (गटात न बसणारे)', ['wordOdd', 'odd', 'letterOdd', 'f:odd']],
        ['वेन आकृती', ['venn', 'f:vennrel']],
        ['आरशातील व पाण्यातील प्रतिमा', ['f:mirror', 'f:water', 'f:textmirror']],
        ['अपूर्ण व लपलेली आकृती', ['f:complete', 'f:embed']],
        ['आकृती मोजणी व अंकांचे कोडे', ['f:count', 'matrix', 'f:numfig']],
        ['कागदाची घडी, कापणी व घन', ['f:fold', 'f:cut', 'f:cube']],
        ['वर्तनविषयक प्रश्न', ['behaviour']],
      ],

    },
  };
  // how often a type showed up in the 2020–2024 papers (weights for a full 50-question section)
  const WEIGHT = { words: 2, numErr: 1, countDigit: 1, orderDiff: 2, multNth: 1, bodmas: 2, missing: 2, divRem: 1, crypt: 1, stmt: 2, fracMissing: 1, mixed: 1, fracTimes: 1, decCompare: 1, decOrder: 1, decExpand: 1, decAddSub: 1, rupee: 1, unitMul: 2, prefix: 1, thick: 1, primePair: 1, primeCount: 1, squareCount: 1, si2: 2, trees: 1, serial: 1, cancel: 1, expr: 1, star: 1, tiling: 1, sawa: 2, place: 1, extremes: 2, digits: 1, roman: 1, count: 2, measure: 3, fracAdd: 2, fracOf: 1, fracOrder: 2, circleFrac: 1, shadePct: 2, profit2: 4, si: 3, pct: 2, percent: 2, unitary: 2, notes: 2, time: 2, clock: 1, cal5: 2, speed: 2, avg: 1, divisors: 2, divisible: 2, lcm: 2, rect: 2, fence: 2, gridPerim: 2, solids: 2, circle: 1, picto: 2,
    series: 3, wrongTerm: 2, letters: 2, code: 2, numCode: 2, naming: 1, direction: 2, distance: 1, rank: 2, compare: 1, calendar: 2, age: 1, ageSum: 1, alpha: 1, wordPos: 1, digitCount: 1, analogy: 2, odd: 2, matrix: 2, venn: 1, seating: 1, relation: 2, wordAnalogy: 2, letterAnalogy: 1, wordOdd: 2, letterOdd: 1, behaviour: 2,
    'f:series': 2, 'f:analogy': 1, 'f:odd': 2, 'f:vennrel': 1, 'f:mirror': 2, 'f:water': 1, 'f:textmirror': 1, 'f:complete': 1, 'f:embed': 2, 'f:count': 2, 'f:numfig': 1, 'f:fold': 1, 'f:cut': 1, 'f:cube': 1 };

  function make(key, L, g7, R) { const t = T[key]; for (let i = 0; i < 40; i++) { const q = t.gen(R, L, g7); if (q) return { key, L, topic: t.name, ...q }; } return null; }
  const api = { T, GROUPS, WEIGHT, make, tools: G.tools };
  if (typeof module !== 'undefined') module.exports = api; else root.SCH = api;
})(this);


/* ════════════════ Admin panel (Create Quiz › step 2 › "🎓 शिष्यवृत्ती प्रश्न") ════════════════
   परीक्षा → विषय → प्रकरणे → प्रकार → पातळी → तयार करा → + जोडा. Figure-reasoning types ("f:…")
   come from FIGGEN (figureGen.js) at a 4th-standard level; everything else from SCH above. */
const SCHGEN = (() => {
  const S = window.SCH, OPTL = ['A', 'B', 'C', 'D'], LEVELS = ['easy', 'medium', 'hard'], LVN = ['सोपी', 'मध्यम', 'कठीण'];
  const EXAMS = [{ id: '4', name: '4थी शिष्यवृत्ती (पूर्वीची 5वी)', tag: 'sch4' }];
  // FIGGEN has 3 levels made for 8th (NMMS). 4th: सोपी / मध्यम → its easy, कठीण → its medium.
  const FIG_LEVEL = [0, 0, 1];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const isFig = k => k.startsWith('f:');
  const figType = k => window.FIGGEN?.TYPES.find(t => t.id === k.slice(2));
  const typeName = k => isFig(k) ? (figType(k)?.nm || k) : (S.T[k]?.name || k);
  const groupsOf = (exam, sub) => S.GROUPS[exam][sub];
  const lessonOf = (exam, sub, key) => (groupsOf(exam, sub).find(([, ks]) => ks.includes(key)) || [''])[0];

  // one question of a type; L = 1..3
  function makeOne(exam, sub, key, L, R) {
    const lesson = lessonOf(exam, sub, key);
    if (isFig(key)) {
      const t = figType(key); if (!t || !t.fn) return null;
      const q = window.FIGGEN.make(t, FIG_LEVEL[L - 1]);
      return q ? { src: 'fig', key, L, lesson, q } : null;
    }
    const q = S.make(key, L, false, R);
    return q ? { src: 'sch', key, L, lesson, q } : null;
  }
  const ansIdx = it => it.src === 'fig' ? it.q.ans : OPTL.indexOf(it.q.answer);
  function moveAnswer(it, to) {
    const from = ansIdx(it); if (from === to) return;
    const q = it.q;
    if (it.src === 'sch') { const o = { ...q.options }; [o[OPTL[from]], o[OPTL[to]]] = [o[OPTL[to]], o[OPTL[from]]]; q.options = o; q.answer = OPTL[to]; return; }
    const sw = a => { if (!a) return a; const b = a.slice(); [b[from], b[to]] = [b[to], b[from]]; return b; };
    q.opts = sw(q.opts); q.raw = sw(q.raw); q.why = sw(q.why); q.note = sw(q.note); q.ans = to;
  }
  // correct answers spread evenly over A–D (never "mostly one letter")
  function balanceAnswers(items) {
    let slots = [];
    while (slots.length < items.length) slots.push(...shuffle([0, 1, 2, 3]));
    slots = shuffle(slots.slice(0, items.length));
    items.forEach((it, i) => moveAnswer(it, slots[i]));
  }
  // [[key, n], …]: evenly, or by how often each type came in the 2020–2024 papers
  function plan(keys, total, weighted) {
    const w = keys.map(k => weighted ? (S.WEIGHT[k] || 1) : 1), sum = w.reduce((a, b) => a + b, 0);
    const raw = w.map(x => x * total / sum), n = raw.map(Math.floor);
    let left = total - n.reduce((a, b) => a + b, 0);
    raw.map((x, i) => [x - n[i] + Math.random() * 1e-6, i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { n[i]++; left--; } });
    return keys.map((k, i) => [k, n[i]]).filter(([, c]) => c > 0);
  }
  function generate(exam, sub, keys, total, level, weighted) {
    const R = S.tools(Math.floor(Math.random() * 1e9)), out = [], seen = new Set();
    const lv = () => level === 3 ? 1 + Math.floor(Math.random() * 3) : level + 1;
    for (const [k, c] of plan(shuffle(keys), total, weighted)) {
      for (let i = 0, tries = 0; i < c && tries < c * 15; tries++) {
        const it = makeOne(exam, sub, k, lv(), R); if (!it) continue;
        const sig = it.src === 'sch' ? it.q.q + it.q.fig : it.q.q + it.q.opts.join('');
        if (seen.has(sig)) continue;
        seen.add(sig); out.push(it); i++;
      }
    }
    // some types have few distinct questions (fact banks): fill the rest from the other chosen types
    for (let tries = 0; out.length < total && tries < total * 20; tries++) {
      const it = makeOne(exam, sub, keys[Math.floor(Math.random() * keys.length)], lv(), R); if (!it) continue;
      const sig = it.src === 'sch' ? it.q.q + it.q.fig : it.q.q + it.q.opts.join('');
      if (!seen.has(sig)) { seen.add(sig); out.push(it); }
    }
    const order = shuffle(out);
    balanceAnswers(order);
    return order;
  }

  // ── saved as the question's "explanation" (student app shows it in 💡) ──
  const explText = q => `उत्तर: ${q.answer}) ${q.options[q.answer]}\n\n**उत्तर कसं आलं**\n` + q.steps.map((x, i) => `${i + 1}. ${x}`).join('\n');
  // inline SVG figure → PNG (white background, 2× for sharp lines)
  async function svgToPng(svg, scale = 2) {
    const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/); if (!m) return null;
    const w = +m[1], h = +m[2], P = 8;
    const src = svg.replace(' class="qfig"', '').replace(/ width="[\d.]+" height="[\d.]+"/, ` width="${w * scale}" height="${h * scale}"`);
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src); await img.decode();
    const cv = document.createElement('canvas'); cv.width = Math.ceil((w + 2 * P) * scale); cv.height = Math.ceil((h + 2 * P) * scale);
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, P * scale, P * scale, w * scale, h * scale);
    return cv.toDataURL('image/png');
  }
  // generator items → question-bank records (no q_id yet; DB.saveQuestion gives one)
  async function toBankQuestions(items, meta, onProgress) {
    const tag = (EXAMS.find(e => e.id === meta.exam) || EXAMS[0]).tag;
    const sch = items.filter(it => it.src === 'sch'), fig = items.filter(it => it.src === 'fig');
    // question pictures and उकल pictures (the solution drawn: path, compass, queue, bar model…)
    const png = new Map(), spng = new Map(), withFig = sch.filter(it => it.q.fig || it.q.sfig);
    for (let i = 0; i < withFig.length; i++) {
      const it = withFig[i];
      if (it.q.fig) png.set(it, await svgToPng(it.q.fig));
      if (it.q.sfig) spng.set(it, await svgToPng(it.q.sfig));
      onProgress?.('draw', i + 1, withFig.length);
    }
    const figRecs = fig.length ? await window.FIGGEN.toBankQuestions(fig.map(it => it.q), { ...meta, level: 1 }, onProgress) : [];
    const urls = png.size || spng.size ? await window.FIGGEN.uploadAll([...png.values(), ...spng.values()], (a, b) => onProgress?.('upload', a, b)) : new Map();
    let k = 0;
    return items.map(it => {
      const base = { difficulty: LEVELS[it.L - 1] || 'medium', batch: meta.batch || '', subject: meta.subject || '', chapter: meta.chapter || it.lesson };
      if (it.src === 'fig') { const r = figRecs[k++]; return { ...r, ...base, tags: [...(r.tags || []), 'qgen', tag] }; }
      const q = it.q;
      return { ...base, question: q.q, image: png.has(it) ? urls.get(png.get(it)) || null : null, type: 'mcq', tags: ['qgen', tag, it.key],
        options: { ...q.options }, option_images: { A: null, B: null, C: null, D: null }, answer: q.answer,
        // "🖼 <url>" on its own line: the app draws it as a picture under the उकल
        explanation: explText(q) + (spng.has(it) && urls.get(spng.get(it)) ? `

🖼 ${urls.get(spng.get(it))}` : '') };
    });
  }

  function _css() {
    if (document.getElementById('schgen-css')) return;
    const st = document.createElement('style'); st.id = 'schgen-css';
    st.textContent = `
.sg-panel{display:flex;flex-direction:column;gap:10px}
.sg-lab{font-size:.75rem;font-weight:700;color:var(--text2);margin:0 0 4px}
.sg-chips{display:flex;flex-wrap:wrap;gap:5px}
.sg-chip{border:1px solid var(--border);background:var(--bg3);color:var(--text2);border-radius:20px;padding:4px 10px;font:inherit;font-size:.75rem;font-weight:600;cursor:pointer}
.sg-chip[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff}
.sg-chip.sm{font-size:.7rem;padding:3px 8px}
.sg-row{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}
.sg-list{display:flex;flex-direction:column;gap:8px;max-height:560px;overflow-y:auto;padding-right:2px}
.sg-card{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--bg3);display:flex;flex-direction:column;gap:6px;min-width:0}
.sg-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.sg-tag{font-size:.7rem;font-weight:700;background:var(--accent);color:#fff;border-radius:6px;padding:1px 7px}
.sg-lv{font-size:.7rem;color:var(--text2)}
.sg-sp{flex:1}
.sg-q{margin:0;font-size:.9rem;line-height:1.55;white-space:pre-line}
.sg-fig{background:#fff;color:#111;border-radius:8px;padding:6px;align-self:flex-start;max-width:100%;overflow-x:auto}
.sg-fig svg{display:block;max-width:100%;height:auto}
.sg-opts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}
.sg-opt{font-size:.82rem;border:1.5px solid var(--border);border-radius:6px;padding:2px 8px}
.sg-opt.ans{border-color:#15803d;background:rgba(21,128,61,.14);font-weight:700}
.sg-steps{font-size:.78rem;color:var(--text2);margin:0;padding-left:1.2em}
.sg-status{font-size:.78rem;color:var(--text2)}
.sg-mini{background:#fff;color:#111;border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:5px;overflow-x:auto}
.sg-mini .tile{width:52px;height:52px;background:#fff;border:1px solid #222;display:flex;align-items:center;justify-content:center;flex:none}
.sg-mini .tile svg{width:100%;height:100%;display:block}
.sg-mini .tile.big{width:96px;height:96px}.sg-mini .tile.wtile{width:110px;height:33px}.sg-mini .tile.vtile{width:70px;height:56px}.sg-mini .tile.htile{width:30px;height:60px}.sg-mini .tile.wtile2{width:60px;height:30px}
.sg-mini .tile.qm{font:700 28px Georgia,serif;color:#111}
.sg-mini .qrow{display:flex;align-items:center;gap:3px}.sg-mini .qcol{display:flex;flex-direction:column;align-items:center;gap:3px}
.sg-mini .sep{font-weight:700}
.sg-mini .mirror.v{width:8px;align-self:stretch;border-left:2px solid #111;background:repeating-linear-gradient(-45deg,#111 0 1px,transparent 1px 4px)}
.sg-mini .mirror.h{height:8px;width:52px;border-top:2px solid #111;background:repeating-linear-gradient(-45deg,#111 0 1px,transparent 1px 4px)}
.sg-mini .wide svg{width:min(var(--w),230px);height:auto;display:block}
.sg-fopts{display:flex;gap:5px;flex-wrap:wrap}
.sg-fopt{display:flex;flex-direction:column;align-items:center;font-size:.8rem;border:1.5px solid transparent;border-radius:6px;padding:2px}
.sg-fopt.ans{border-color:#15803d;background:#e3f5e8}
.sg-fopt small{font-weight:700;color:#555}`;
    document.head.appendChild(st);
  }
  const strip = s => String(s).replace(/<[^>]+>/g, '');
  function _cardHTML(it, i) {
    const head = `<div class="sg-head"><span class="sg-tag">${esc(typeName(it.key))}</span><span class="sg-lv">${esc(it.lesson)} · ${LVN[it.L - 1]}${it.src === 'fig' || it.q.fig ? ' · 🖼 आकृती' : ''}</span><span class="sg-sp"></span>
      <button type="button" class="admin-btn-secondary" data-sg-re="${i}" title="हा प्रश्न बदला" aria-label="हा प्रश्न बदला">🔄</button>
      <button type="button" class="admin-btn-primary" data-sg-add="${i}">+ जोडा</button></div>`;
    const q = it.q;
    if (it.src === 'fig') {
      return `<div class="sg-card">${head}<p class="sg-q">${esc(window.FIGGEN.questionText(q))}</p><div class="sg-mini">${q.q || ''}<div class="sg-fopts">${q.opts.map((o, j) => `<span class="sg-fopt${j === q.ans ? ' ans' : ''}">${o}<small>${OPTL[j]}</small></span>`).join('')}</div></div>
        <ol class="sg-steps">${q.steps.map(s => `<li>${esc(strip(s))}</li>`).join('')}</ol></div>`;
    }
    return `<div class="sg-card">${head}<p class="sg-q">${esc(q.q)}</p>${q.fig ? `<div class="sg-fig">${q.fig}</div>` : ''}
      <div class="sg-opts">${OPTL.map(k => `<span class="sg-opt${k === q.answer ? ' ans' : ''}">${k}) ${esc(q.options[k])}</span>`).join('')}</div>
      <ol class="sg-steps">${q.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>${q.sfig ? `<div class="sg-fig" title="उकलीतील आकृती">${q.sfig}</div>` : ''}</div>`;
  }

  // host: element to fill. opts.onAdd(items, meta, progress) → Promise (saves them and puts them in the quiz)
  function mountPanel(host, opts = {}) {
    _css();
    const subjects = ex => Object.keys(S.GROUPS[ex]);
    const st = { exam: EXAMS[0].id, sub: subjects(EXAMS[0].id)[0], lessons: new Set(), types: new Set(), level: 3, count: 20, items: [], busy: false };
    const okKey = k => !isFig(k) || !!figType(k)?.fn;
    const selectAll = () => { const g = groupsOf(st.exam, st.sub); st.lessons = new Set(g.map(x => x[0])); st.types = new Set(g.flatMap(x => x[1]).filter(okKey)); };
    selectAll();
    const selKeys = () => groupsOf(st.exam, st.sub).filter(([l]) => st.lessons.has(l)).flatMap(([, ks]) => ks).filter(k => st.types.has(k) && okKey(k));
    const nQ = () => st.items.length;
    function render(status = '') {
      const G = groupsOf(st.exam, st.sub), allOn = G.every(([l]) => st.lessons.has(l));
      host.innerHTML = `<div class="sg-panel">
        <div class="sg-row">
          <label class="sg-lab">परीक्षा<br><select class="admin-select" id="sg-exam">${EXAMS.map(e => `<option value="${e.id}"${e.id === st.exam ? ' selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
          <div><p class="sg-lab">विषय</p><div class="sg-chips">${subjects(st.exam).map(s => `<button type="button" class="sg-chip" aria-pressed="${s === st.sub}" data-sg-sub="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>
        </div>
        <div><p class="sg-lab">प्रकरणे (${G.filter(([l]) => st.lessons.has(l)).length}/${G.length})</p><div class="sg-chips">
          <button type="button" class="sg-chip" aria-pressed="${allOn}" data-sg-all="1">सर्व प्रकरणे</button>
          ${G.map(([l]) => `<button type="button" class="sg-chip" aria-pressed="${st.lessons.has(l)}" data-sg-lesson="${esc(l)}">${esc(l)}</button>`).join('')}</div></div>
        <div><p class="sg-lab">प्रश्नांचे प्रकार (निवडलेल्या प्रकरणांतील; 🖼 = आकृती)</p><div class="sg-chips">
          ${G.filter(([l]) => st.lessons.has(l)).flatMap(([, ks]) => ks).filter(okKey).map(k => `<button type="button" class="sg-chip sm" aria-pressed="${st.types.has(k)}" data-sg-type="${k}">${esc(typeName(k))}${isFig(k) || /^आकृती/.test(typeName(k)) || ['picto', 'venn', 'matrix', 'clock'].includes(k) ? ' 🖼' : ''}</button>`).join('')}</div></div>
        <div class="sg-row">
          <label class="sg-lab">पातळी<br><select class="admin-select" id="sg-level">${[...LVN, 'मिश्र (paper सारखी)'].map((x, i) => `<option value="${i}"${i === st.level ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
          <label class="sg-lab">प्रश्न<br><select class="admin-select" id="sg-count">${[5, 10, 20, 25, 50].map(x => `<option${x === st.count ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
          <button type="button" class="admin-btn-primary" id="sg-go">🎲 तयार करा</button>
          <button type="button" class="admin-btn-secondary" id="sg-paper" title="निवडलेल्या प्रकारांतून, 2020–2024 च्या papers मध्ये जितक्या वेळा आले त्या प्रमाणात">📄 Paper सारखे 50</button>
          ${nQ() ? `<button type="button" class="admin-btn-secondary" id="sg-addall">+ सगळे जोडा (${nQ()})</button>` : ''}
        </div>
        <p class="sg-status" id="sg-status">${status || (nQ() ? 'बरोबर उत्तर हिरव्या चौकटीत, खाली उकल. "+ जोडा" केल्यावर प्रश्न चालू Section मध्ये आणि प्रश्न-बँकेत जातात; उकल student ला 💡 मध्ये दिसते.' : 'प्रकरणे, पातळी आणि संख्या निवडून "🎲 तयार करा". उत्तर code मोजतं (AI नाही), दर वेळी नवे आकडे.')}</p>
        <div class="sg-list">${st.items.map(_cardHTML).join('')}</div></div>`;
    }
    async function add(items) {
      if (st.busy || !items.length) return;
      st.busy = true;
      host.querySelectorAll('button,select').forEach(b => { b.disabled = true; });
      const stat = host.querySelector('#sg-status');
      try {
        await opts.onAdd(items, { exam: st.exam }, (stage, a, b) => { if (stat) stat.textContent = stage === 'draw' ? `⏳ आकृत्या तयार होत आहेत… ${a}/${b}` : stage === 'upload' ? `⏳ चित्रं upload होत आहेत… ${a}/${b}` : '⏳ प्रश्न save होत आहेत…'; });
        st.items = st.items.filter(it => !items.includes(it));
        render(`✅ ${items.length} प्रश्न जोडले.`);
      } catch (err) {
        render(`⚠️ जोडता आले नाहीत: ${err?.message || err}. Internet तपासून पुन्हा "+ जोडा" करा.`);
      } finally { st.busy = false; }
    }
    const readSel = () => { st.level = +host.querySelector('#sg-level').value; st.count = +host.querySelector('#sg-count').value; };
    function run(total, weighted) {
      const keys = selKeys();
      if (!keys.length) { render('⚠️ किमान एक प्रकार निवडा.'); return; }
      st.items = generate(st.exam, st.sub, keys, total, st.level, weighted);
      render(st.items.length < total ? `${st.items.length} प्रश्न तयार झाले (काही प्रकारांत एवढेच वेगळे प्रश्न बनतात).` : '');
    }
    host.addEventListener('click', e => {
      if (st.busy) return;
      const t = e.target.closest('button'); if (!t || !host.contains(t)) return;
      const d = t.dataset;
      if (d.sgSub) { if (d.sgSub !== st.sub) { st.sub = d.sgSub; st.items = []; selectAll(); render(); } return; }
      if (d.sgAll) { const G = groupsOf(st.exam, st.sub); if (G.every(([l]) => st.lessons.has(l))) { st.lessons = new Set([G[0][0]]); st.types = new Set(G[0][1].filter(okKey)); } else selectAll(); render(); return; }
      if (d.sgLesson) {
        const l = d.sgLesson, ks = groupsOf(st.exam, st.sub).find(x => x[0] === l)[1].filter(okKey);
        if (st.lessons.has(l)) { if (st.lessons.size > 1) { st.lessons.delete(l); ks.forEach(k => st.types.delete(k)); } }
        else { st.lessons.add(l); ks.forEach(k => st.types.add(k)); }
        render(); return;
      }
      if (d.sgType) { const k = d.sgType; if (st.types.has(k)) { if (selKeys().length > 1) st.types.delete(k); } else st.types.add(k); t.setAttribute('aria-pressed', st.types.has(k)); return; }
      if (t.id === 'sg-go') { readSel(); run(st.count, false); return; }
      if (t.id === 'sg-paper') { readSel(); run(50, true); return; }
      if (t.id === 'sg-addall') { add(st.items.slice()); return; }
      if (d.sgAdd) { add([st.items[+d.sgAdd]]); return; }
      if (d.sgRe) {
        const i = +d.sgRe, old = st.items[i], to = ansIdx(old), R = S.tools(Math.floor(Math.random() * 1e9));
        for (let k = 0; k < 20; k++) {
          const nx = makeOne(st.exam, st.sub, old.key, old.L, R);
          if (nx && !(nx.src === 'sch' && st.items.some(x => x.src === 'sch' && x.q.q === nx.q.q && x.q.fig === nx.q.fig))) { moveAnswer(nx, to); st.items[i] = nx; break; }
        }
        render();
      }
    });
    host.addEventListener('change', e => {
      if (e.target.id === 'sg-level') st.level = +e.target.value;
      if (e.target.id === 'sg-count') st.count = +e.target.value;
      if (e.target.id === 'sg-exam') { st.exam = e.target.value; st.sub = subjects(st.exam)[0]; st.items = []; selectAll(); render(); }
    });
    render();
  }
  return { EXAMS, GROUPS: S.GROUPS, generate, plan, balanceAnswers, explText, svgToPng, toBankQuestions, mountPanel };
})();
window.SCHGEN = SCHGEN;
