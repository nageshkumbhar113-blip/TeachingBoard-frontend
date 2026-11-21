/* ════════════════════════════════════════
   sch7En.js — 7वी शिष्यवृत्ती (UPS, पूर्वीची 8वी): English (पेपर 2, प्रश्न 1–25)
   for Admin › Create Quiz › 🎓 शिष्यवृत्ती. Built from the 8th papers 2021–2026 and the first 7th UPS paper (April 2026):
   clock time, tenses, parts of speech, notice / advertisement, opposites, phrases, similes, passage with web diagram,
   punctuation, word grid, riddles, jumbled sentences, comparison, dialogue, modals, direct–indirect speech, adjectives,
   voice, homophones, spelling.
   No AI: tense / voice / speech / comparison forms are built by rules; passages, notices and dialogues are our own.
   Banks are in S.LANG7_B so 📚 साठा can grow them.
════════════════════════════════════════ */
(function (root) {
  'use strict';
  const S = root.SCH; if (!S || !S.LANG_B) return;
  const T = S.T, B4 = S.LANG_B, LG = S.LANG;

  function mk(R, o) {
    const A = String(o.a), ws = [];
    o.w.forEach(v => { if (v == null) return; const s = String(v); if (s && s !== A && !ws.includes(s)) ws.push(s); });
    if (ws.length < 3) return null;
    const opts = R.shuffle([A, ...R.shuffle(ws).slice(0, 3)]);
    return { q: o.q, fig: o.fig || '', sfig: '', options: { A: opts[0], B: opts[1], C: opts[2], D: opts[3] }, answer: 'ABCD'[opts.indexOf(A)], steps: o.steps || [] };
  }
  const def = (key, name, gen) => { T[key] = { name, gen: (R, L) => gen(R, L || 2) }; };
  const vt = (R, Lv, order) => { const n = order.length, a = Lv === 1 ? 0 : Lv === 2 ? Math.floor(n / 3) : Math.floor(n / 2), b = Lv === 1 ? Math.max(0, Math.ceil(n / 2) - 1) : n - 1; return order[R.ri(a, b)]; };
  const pickN = (R, arr, n) => R.shuffle(arr.slice()).slice(0, n);
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const B7 = () => S.LANG7_B;
  // fill-in bank entry: [sentence with ____, answer, [wrong, wrong, wrong]]
  const fillQ = (R, bank, head) => { const [s, a, w] = R.pick(B7()[bank]); return mk(R, { q: `${head}\n${s}`, a, w: R.shuffle(w), steps: [s.replace(/_{3,}/, a)] }); };

  /* ───────────── Clock time ───────────── */
  const NW = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'], MW = { 5: 'five', 10: 'ten', 20: 'twenty', 25: 'twenty-five' };
  const hr = h => ((h - 1 + 12) % 12) + 1;
  const phrase = (h, m) => m === 0 ? `${NW[h]} o'clock` : m === 15 ? `quarter past ${NW[h]}` : m === 30 ? `half past ${NW[h]}` : m === 45 ? `quarter to ${NW[hr(h + 1)]}` : m < 30 ? `${MW[m]} past ${NW[h]}` : `${MW[60 - m]} to ${NW[hr(h + 1)]}`;
  const tm = (h, m) => `${h}:${String(m).padStart(2, '0')}`;
  const CTX = [['Rahul', 'What time does the train leave?', 'Station master', 'It leaves at'], ['Mother', 'When does your school start?', 'Minu', 'It starts at'], ['Ajay', 'What time does the film begin?', 'Ticket clerk', 'It begins at'], ['Grandpa', 'When does the shop open?', 'Shopkeeper', 'It opens at']];
  def('e7Clock', 'Clock time', (R, Lv) => {
    const h = R.ri(1, 12), m = R.pick(Lv === 1 ? [15, 30, 45, 0] : [15, 30, 45, 5, 10, 20, 25, 35, 40, 50, 55]), p = phrase(h, m);
    const wr = [tm(hr(h + 1), m), tm(h, (60 - m) % 60), tm(hr(h + 1), (60 - m) % 60), tm(hr(h - 1), m)].filter(x => x !== tm(h, m));
    if (vt(R, Lv, [1, 2]) === 1) { const [a, q, b, s] = R.pick(CTX);
      return mk(R, { q: `Read the dialogue and choose the correct clock time for the words in quotes.\n${a}: ${q}\n${b}: ${s} “${p}”.`, a: tm(h, m), w: wr, steps: [m > 30 ? `"${MW[60 - m] || 'quarter'} to ${NW[hr(h + 1)]}" = ${60 - m} minutes before ${hr(h + 1)}` : `"${p}"`, `= ${tm(h, m)}`] }); }
    return mk(R, { q: `How do we say the time ${tm(h, m)} in words?`, a: p, w: [phrase(hr(h + 1), m), phrase(h, (60 - m) % 60 || 30), phrase(hr(h - 1), m), m === 0 ? `half past ${NW[h]}` : `${NW[h]} o'clock`].filter(x => x !== p), steps: [`${tm(h, m)} = ${p}`] });
  });

  /* ───────────── Tenses (12) ───────────── */
  const VB = [['play', 'plays', 'played', 'played', 'playing', 'cricket'], ['write', 'writes', 'wrote', 'written', 'writing', 'a letter'], ['eat', 'eats', 'ate', 'eaten', 'eating', 'a mango'], ['sing', 'sings', 'sang', 'sung', 'singing', 'a song'],
    ['draw', 'draws', 'drew', 'drawn', 'drawing', 'a picture'], ['make', 'makes', 'made', 'made', 'making', 'a kite'], ['clean', 'cleans', 'cleaned', 'cleaned', 'cleaning', 'the room'], ['watch', 'watches', 'watched', 'watched', 'watching', 'a cartoon'],
    ['finish', 'finishes', 'finished', 'finished', 'finishing', 'the homework'], ['build', 'builds', 'built', 'built', 'building', 'a sandcastle'], ['plant', 'plants', 'planted', 'planted', 'planting', 'trees'], ['cook', 'cooks', 'cooked', 'cooked', 'cooking', 'dinner']];
  const SB = [['Ravi', 's'], ['My sister', 's'], ['She', 's'], ['He', 's'], ['They', 'p'], ['We', 'p'], ['The children', 'p'], ['I', 'i']];
  const TN = ['Simple present', 'Present continuous', 'Present perfect', 'Present perfect continuous', 'Simple past', 'Past continuous', 'Past perfect', 'Past perfect continuous', 'Simple future', 'Future continuous', 'Future perfect', 'Future perfect continuous'];
  function vform([b, s, pa, pp, ing], st, i) {
    const be = { s: 'is', p: 'are', i: 'am' }[st], was = st === 'p' ? 'were' : 'was', hv = st === 's' ? 'has' : 'have';
    return [st === 's' ? s : b, `${be} ${ing}`, `${hv} ${pp}`, `${hv} been ${ing}`, pa, `${was} ${ing}`, `had ${pp}`, `had been ${ing}`, `will ${b}`, `will be ${ing}`, `will have ${pp}`, `will have been ${ing}`][i];
  }
  const tnear = i => { const t = Math.floor(i / 4), a = i % 4; return [...[0, 1, 2, 3].filter(x => x !== a).map(x => t * 4 + x), ...[0, 1, 2].filter(x => x !== t).map(x => x * 4 + a)]; };
  def('e7Tense', 'Tenses', (R, Lv) => {
    const v = R.pick(VB), [sj, st] = R.pick(SB), i = Lv === 1 ? R.pick([0, 1, 4, 5, 8]) : Lv === 2 ? R.pick([0, 1, 2, 4, 5, 6, 8, 9]) : R.ri(0, 11), f = vform(v, st, i);
    if (vt(R, Lv, [1, 2]) === 1) return mk(R, { q: `Find the tense of the verb in quotes.\n${sj} “${f}” ${v[5]}.`, a: `${TN[i]} tense`, w: R.shuffle(tnear(i)).map(k => `${TN[k]} tense`), steps: [`“${f}” → ${TN[i]} tense`] });
    return mk(R, { q: `Complete the sentence using the correct form of the verb in the ${TN[i].toLowerCase()} tense.\n${sj} ________ ${v[5]}.`, a: f, w: R.shuffle(tnear(i)).map(k => vform(v, st, k)), steps: [`${TN[i]}: ${sj} ${f} ${v[5]}.`] });
  });

  /* ───────────── Voice ───────────── */
  const AS = [['Ravi', 's', 'Ravi'], ['The teacher', 's', 'the teacher'], ['My mother', 's', 'my mother'], ['The children', 'p', 'the children'], ['She', 's', 'her'], ['They', 'p', 'them'], ['I', 'i', 'me'], ['We', 'p', 'us'], ['He', 's', 'him']];
  const OV = [['write', 'writes', 'wrote', 'written', 'writing', 'a letter', 's'], ['draw', 'draws', 'drew', 'drawn', 'drawing', 'a picture', 's'], ['sing', 'sings', 'sang', 'sung', 'singing', 'a song', 's'], ['clean', 'cleans', 'cleaned', 'cleaned', 'cleaning', 'the room', 's'],
    ['plant', 'plants', 'planted', 'planted', 'planting', 'trees', 'p'], ['catch', 'catches', 'caught', 'caught', 'catching', 'the ball', 's'], ['build', 'builds', 'built', 'built', 'building', 'a house', 's'], ['break', 'breaks', 'broke', 'broken', 'breaking', 'the glass', 's'],
    ['make', 'makes', 'made', 'made', 'making', 'kites', 'p'], ['wash', 'washes', 'washed', 'washed', 'washing', 'the clothes', 'p'], ['eat', 'eats', 'ate', 'eaten', 'eating', 'mangoes', 'p'], ['win', 'wins', 'won', 'won', 'winning', 'the prize', 's'], ['open', 'opens', 'opened', 'opened', 'opening', 'the door', 's']];
  const VT = [[0, 'is', 'are'], [4, 'was', 'were'], [8, 'will be', 'will be'], [1, 'is being', 'are being'], [2, 'has been', 'have been'], [5, 'was being', 'were being']];
  def('e7Voice', 'Active and passive voice', (R, Lv) => {
    const [sj, st, ag] = R.pick(AS), v = R.pick(OV), k = R.ri(0, Lv === 1 ? 2 : 5), [ti, a1, a2] = VT[k], n = v[6] === 'p' ? 1 : 0, aux = n ? a2 : a1;
    const act = `${sj} ${vform(v, st, ti)} ${v[5]}.`, pas = (x, p) => `${cap(v[5])} ${x} ${p} by ${ag}.`, ans = pas(aux, v[3]);
    const w = [...VT.filter((_, j) => j !== k).map(t => pas(t[1 + n], v[3])), pas(aux, v[2] !== v[3] ? v[2] : v[4]), pas(n ? a1 : a2, v[3])];
    return mk(R, { q: `Choose the correct passive voice of the sentence.\n${act}`, a: ans, w: R.shuffle(w), steps: [`${TN[ti]} tense → passive: ${aux} + past participle (${v[3]})`, `Object "${v[5]}" becomes the subject; "${sj}" → by ${ag}`, ans] });
  });

  /* ───────────── Direct and indirect speech ───────────── */
  const PPL = [['Ram', 'm'], ['Renu', 'f'], ['Amit', 'm'], ['Neha', 'f'], ['Rohan', 'm'], ['Sita', 'f'], ['Sameer', 'm'], ['Priya', 'f']];
  function speech(R, g, lg) {
    const he = g === 'm' ? 'he' : 'she', his = g === 'm' ? 'his' : 'her', lo = lg === 'm' ? 'him' : 'her', t = R.ri(0, 5);
    const adj = R.pick(['happy', 'tired', 'hungry', 'busy', 'ready']), ob = R.pick(['mangoes', 'cricket', 'music']);
    return [
      [`I am ${adj}.`, `was ${adj}`, [`is ${adj}`, `had ${adj}`, `am ${adj}`, `have ${adj}`]],
      [`I like ${ob}.`, `liked ${ob}`, [`likes ${ob}`, `like ${ob}`, `had like ${ob}`, `is liking ${ob}`]],
      ['I am reading a book.', 'was reading a book', ['is reading a book', 'am reading a book', 'read a book', 'has reading a book']],
      ['I will help you.', `would help ${lo}`, [`will help ${lo}`, 'would help you', `will helped ${lo}`, `would helping ${lo}`]],
      ['I can swim.', 'could swim', ['can swim', 'could swam', 'can swam', 'could swimming']],
      ['I have finished my work.', `had finished ${his} work`, [`has finished ${his} work`, 'had finished my work', `have finished ${his} work`, `had finish ${his} work`]],
    ][t].concat([he]);
  }
  def('e7Speech', 'Direct and indirect speech', (R, Lv) => {
    const [a, b] = pickN(R, PPL, 2), [dir, ok, bad, he] = speech(R, a[1], b[1]);
    const why = ['Reporting verb in the past → am / is → was, like → liked, will → would, can → could, have → had', `"I" → ${he}, "my" → ${he === 'he' ? 'his' : 'her'}, "you" → ${b[1] === 'm' ? 'him' : 'her'}`];
    if (vt(R, Lv, [1, 2]) === 1) return mk(R, { q: `Complete the sentence using the correct alternative.\nDirect speech: ${a[0]} said to ${b[0]}, “${dir}”\nIndirect speech: ${a[0]} told ${b[0]} that ${he} ________.`, a: ok, w: R.shuffle(bad), steps: [...why, `${a[0]} told ${b[0]} that ${he} ${ok}.`] });
    const full = x => `${a[0]} told ${b[0]} that ${x}.`;
    return mk(R, { q: `Choose the correct indirect speech.\n${a[0]} said to ${b[0]}, “${dir}”`, a: full(`${he} ${ok}`), w: [full(`${he} ${bad[0]}`), full(`I ${ok}`), full(`${he} ${bad[1]}`), `${a[0]} told ${b[0]} that “${dir}”`], steps: [...why, full(`${he} ${ok}`)] });
  });

  /* ───────────── Degrees of comparison ───────────── */
  const FACTS = [['Mount Everest', 'high', 'higher', 'highest', 'mountain in the world'], ['The Nile', 'long', 'longer', 'longest', 'river in the world'], ['The cheetah', 'fast', 'faster', 'fastest', 'land animal'],
    ['Jupiter', 'big', 'bigger', 'biggest', 'planet in the solar system'], ['The blue whale', 'large', 'larger', 'largest', 'animal on the earth'], ['Ravi', 'tall', 'taller', 'tallest', 'boy in our class'], ['This book', 'interesting', 'more interesting', 'most interesting', 'book in the library']];
  const OBJ = [['Tree', 'tall', 'taller', 'short', 'shorter'], ['Pencil', 'long', 'longer', 'short', 'shorter'], ['Balloon', 'big', 'bigger', 'small', 'smaller']];
  function cmpFig(kind, a, b) {
    const SF = 'font-family="Nirmala UI, Arial, sans-serif" font-size="14" font-weight="700" text-anchor="middle"';
    let s = '';
    if (kind === 'Tree') [[80, a, 'A'], [190, b, 'B']].forEach(([x, h, l]) => { s += `<rect x="${x - 6}" y="${150 - h * 0.35}" width="12" height="${h * 0.35}" fill="#8b5a2b"/><polygon points="${x - 32},${150 - h * 0.3} ${x + 32},${150 - h * 0.3} ${x},${150 - h}" fill="#4caf50" stroke="#2e7d32"/><text x="${x}" y="168" ${SF}>${l}</text>`; });
    if (kind === 'Pencil') [[40, a, 'A'], [100, b, 'B']].forEach(([y, L, l]) => { s += `<text x="16" y="${y + 6}" ${SF}>${l}</text><rect x="30" y="${y - 9}" width="${L}" height="18" fill="#facc15" stroke="#a16207"/><polygon points="${30 + L},${y - 9} ${30 + L + 22},${y} ${30 + L},${y + 9}" fill="#fde68a" stroke="#a16207"/>`; });
    if (kind === 'Balloon') [[80, a, 'A'], [190, b, 'B']].forEach(([x, r, l]) => { s += `<line x1="${x}" y1="${80 + r / 2}" x2="${x}" y2="150" stroke="#555"/><ellipse cx="${x}" cy="${80 - r / 2 + r / 2}" rx="${r / 2}" ry="${r / 1.7}" fill="#f87171" stroke="#b91c1c"/><text x="${x}" y="168" ${SF}>${l}</text>`; });
    return `<svg class="qfig" viewBox="0 0 270 175" width="270" height="175" xmlns="http://www.w3.org/2000/svg">${kind === 'Tree' ? '<line x1="10" y1="150" x2="260" y2="150" stroke="#222" stroke-width="2"/>' : ''}${s}</svg>`;
  }
  def('e7Degree', 'Degrees of comparison', (R, Lv) => {
    if (vt(R, Lv, [1, 2]) === 1) {
      const [K, p, c, op, oc] = R.pick(OBJ), eq = R.r() < 0.2, big = K === 'Pencil' ? [190, 110] : K === 'Tree' ? [130, 80] : [70, 42], sw = R.r() < 0.5, [ha, hb] = eq ? [big[0], big[0]] : sw ? [big[1], big[0]] : big;
      const A = `${K} A`, Bn = `${K} B`, aSmall = ha < hb;
      const T_ = eq ? [`${A} is as ${p} as ${Bn}.`] : aSmall ? [`${A} is not as ${p} as ${Bn}.`, `${Bn} is ${c} than ${A}.`, `${A} is ${oc} than ${Bn}.`] : [`${A} is ${c} than ${Bn}.`, `${Bn} is not as ${p} as ${A}.`, `${Bn} is ${oc} than ${A}.`];
      const F_ = eq ? [`${A} is ${c} than ${Bn}.`, `${Bn} is ${c} than ${A}.`, `${A} is not as ${p} as ${Bn}.`, `${A} is ${oc} than ${Bn}.`] : aSmall ? [`${A} is as ${p} as ${Bn}.`, `${A} is ${c} than ${Bn}.`, `${Bn} is not as ${p} as ${A}.`, `${Bn} is ${oc} than ${A}.`] : [`${A} is as ${p} as ${Bn}.`, `${Bn} is ${c} than ${A}.`, `${A} is not as ${p} as ${Bn}.`, `${A} is ${oc} than ${Bn}.`];
      const a = R.pick(T_);
      return mk(R, { fig: cmpFig(K, ha, hb), q: 'Look at the picture and choose the correct comparison.', a, w: R.shuffle(F_), steps: [eq ? `Both are of the same size → "as ${p} as"` : `${aSmall ? A : Bn} is smaller in size`, a] });
    }
    const [s, p, c, sp, cl] = R.pick(FACTS), ch = cl.split(' ')[0];
    if (R.r() < 0.5) {
      const ans = `${s} is the ${sp} ${cl}.`, bad = sp.startsWith('most') ? `the ${p}est` : `the most ${p}`;
      return mk(R, { q: `Choose the superlative degree of the sentence.\nNo other ${cl.replace(ch, ch)} is as ${p} as ${s.replace(/^The /, 'the ')}.`, a: ans, w: [`${s} is the ${c} ${cl}.`, `${s} is ${bad} ${cl}.`, `${s} is ${sp} than any other ${cl}.`, `${s} is as ${p} as the ${cl}.`], steps: [`Positive → superlative: "the ${sp}"`, ans] });
    }
    const ans = `${s} is ${c} than any other ${cl}.`;
    return mk(R, { q: `Choose the comparative degree of the sentence.\n${s} is the ${sp} ${cl}.`, a: ans, w: [`${s} is ${sp} than any other ${cl}.`, `${s} is ${c} than other ${cl}.`, `${s} is as ${p} as any other ${cl}.`, `${s} is the ${c} of all.`], steps: [`Superlative → comparative: "${c} than any other …"`, ans] });
  });

  /* ───────────── Word grid ───────────── */
  const GRIDW = { days: ['SUNDAY', 'MONDAY', 'FRIDAY', 'TUESDAY'], months: ['MAY', 'JUNE', 'JULY', 'MARCH', 'APRIL', 'AUGUST'], colours: ['RED', 'BLUE', 'GREEN', 'PINK', 'BLACK', 'WHITE', 'ORANGE'], animals: ['LION', 'TIGER', 'HORSE', 'ZEBRA', 'CAMEL', 'MONKEY'] };
  const CN = { days: 'days', months: 'months', colours: 'colours', animals: 'animals' };
  function gridFig(g) {
    const n = g.length, c = 30; let s = '';
    g.forEach((row, i) => row.forEach((ch, j) => { s += `<rect x="${j * c + 1}" y="${i * c + 1}" width="${c}" height="${c}" fill="#fff" stroke="#333"/><text x="${j * c + 16}" y="${i * c + 22}" font-family="Arial, sans-serif" font-size="16" text-anchor="middle">${ch}</text>`; }));
    return `<svg class="qfig" viewBox="0 0 ${n * c + 2} ${n * c + 2}" width="${n * c + 2}" height="${n * c + 2}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
  }
  def('e7Grid', 'Find words in the grid', (R, Lv) => {
    const cat = R.pick(Object.keys(GRIDW)), list = GRIDW[cat], n = 7, [w1, w2] = pickN(R, list, 2), AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const g = Array.from({ length: n }, () => Array.from({ length: n }, () => AZ[R.ri(0, 25)]));
    const r1 = R.ri(0, n - 1), c1 = R.ri(0, n - w1.length); [...w1].forEach((ch, k) => { g[r1][c1 + k] = ch; });
    let placed = false;
    for (let t = 0; t < 40 && !placed; t++) {
      const down = Lv > 1 && R.r() < 0.5, r = down ? R.ri(0, n - w2.length) : R.ri(0, n - 1), c = down ? R.ri(0, n - 1) : R.ri(0, n - w2.length);
      const cells = [...w2].map((ch, k) => [down ? r + k : r, down ? c : c + k, ch]);
      if (cells.some(([y, x, ch]) => y === r1 && x >= c1 && x < c1 + w1.length && g[y][x] !== ch)) continue;
      cells.forEach(([y, x, ch]) => { g[y][x] = ch; }); placed = true;
    }
    if (!placed) return null;
    const lines = [...g.map(r => r.join('')), ...g[0].map((_, j) => g.map(r => r[j]).join(''))], has = w => lines.some(l => l.includes(w));
    if (list.some(w => w !== w1 && w !== w2 && has(w))) return null;
    const tc = w => cap(w.toLowerCase()), ans = `${tc(w1)} – ${tc(w2)}`, others = list.filter(w => w !== w1 && w !== w2);
    const wr = [...others.map(o => `${tc(w1)} – ${tc(o)}`), ...others.map(o => `${tc(o)} – ${tc(w2)}`)];
    return mk(R, { fig: gridFig(g), q: `Find out the names of 2 ${CN[cat]} from the grid and choose the correct option.`, a: ans, w: R.shuffle(wr), steps: [`${w1}: row ${r1 + 1}`, `${w2} is also in the grid`, ans] });
  });

  /* ───────────── Banks ───────────── */
  const POS = [['The bank is next to the post office.', 'next', 'preposition'], ['We will meet next week.', 'next', 'adjective'], ['What did you do next?', 'next', 'adverb'], ['He runs fast.', 'fast', 'adverb'], ['This is a fast train.', 'fast', 'adjective'],
    ['She sings well.', 'well', 'adverb'], ['They dug a deep well.', 'well', 'noun'], ['Please light the lamp.', 'light', 'verb'], ['This box is very light.', 'light', 'adjective'], ['Switch on the light.', 'light', 'noun'],
    ['Wow! What a lovely garden!', 'Wow', 'interjection'], ['I was tired, but I finished the work.', 'but', 'conjunction'], ['He came after the bell rang.', 'after', 'conjunction'], ['We played after lunch.', 'after', 'preposition'],
    ['They are my best friends.', 'They', 'pronoun'], ['Honesty is the best policy.', 'Honesty', 'noun'], ['The old man walked slowly.', 'slowly', 'adverb'], ['The old man walked slowly.', 'old', 'adjective'], ['Birds fly in the sky.', 'fly', 'verb'],
    ['A fly sat on the cake.', 'fly', 'noun'], ['Alas! He failed again.', 'Alas', 'interjection'], ['She works hard.', 'hard', 'adverb'], ['This stone is hard.', 'hard', 'adjective'], ['The cat jumped over the wall.', 'over', 'preposition'],
    ['Either Ravi or Sita will sing.', 'or', 'conjunction'], ['She herself cooked the food.', 'herself', 'pronoun'], ['Rahul practises the flute daily.', 'daily', 'adverb'], ['I read a daily newspaper.', 'daily', 'adjective'],
    ['We water the plants every morning.', 'water', 'verb'], ['Please give me some water.', 'water', 'noun']];
  const POSN = ['noun', 'pronoun', 'adjective', 'verb', 'adverb', 'preposition', 'conjunction', 'interjection'];
  const POSWHY = { noun: 'names a person, place, thing or quality', pronoun: 'is used in place of a noun', adjective: 'tells more about a noun', verb: 'shows an action', adverb: 'tells how / when / where an action happens', preposition: 'shows the relation of a noun with another word', conjunction: 'joins words or sentences', interjection: 'shows a sudden feeling' };
  const PHRASE = [['The firemen soon ____ the fire.', 'put out', ['put on', 'put up', 'put off']], ['Please ____ the fan before you leave the room.', 'switch off', ['switch on', 'take after', 'look after']],
    ['I am ____ my lost pen. Have you seen it?', 'looking for', ['looking after', 'looking up', 'looking into']], ['Our school bus ____ on the way, so we were late.', 'broke down', ['broke up', 'broke into', 'broke out']],
    ['The match was ____ because of heavy rain.', 'called off', ['called on', 'called for', 'called in']], ['My grandfather ____ smoking ten years ago.', 'gave up', ['gave in', 'gave away', 'gave out']],
    ['Nurses ____ the patients in the hospital.', 'look after', ['look for', 'look into', 'look up']], ['He went to Pune in ____ a good job.', 'search of', ['spite of', 'front of', 'place of']],
    ['The team won the match ____ the bad weather.', 'in spite of', ['in place of', 'in front of', 'in case of']], ['Rohit was absent ____ fever.', 'because of', ['in spite of', 'in front of', 'instead of']],
    ['Our country has ____ natural resources.', 'plenty of', ['afraid of', 'welfare of', 'proud of']], ['Many people work for the ____ the poor.', 'welfare of', ['plenty of', 'afraid of', 'fond of']],
    ['The thief ran away when he ____ the police.', 'caught sight of', ['took care of', 'made fun of', 'got rid of']], ['Please ____ your little brother while I am out.', 'take care of', ['make fun of', 'get rid of', 'run out of']],
    ['We have ____ sugar. Please buy some.', 'run out of', ['taken care of', 'made fun of', 'caught sight of']], ['Wash your hands to ____ germs.', 'get rid of', ['take care of', 'run out of', 'look forward to']],
    ['I am ____ meeting my cousins in the holidays.', 'looking forward to', ['getting rid of', 'running out of', 'making fun of']], ['The aeroplane ____ at 7 a.m.', 'took off', ['took after', 'took in', 'took up']],
    ['Riya ____ her mother; she has the same smile.', 'takes after', ['takes off', 'takes in', 'takes over']], ['Can you ____ the meaning of this word in the dictionary?', 'look up', ['look after', 'look out', 'look down']]];
  const SIMILE = [['as slow as a snail', 'My little brother takes an hour to finish his breakfast. He is ____.'], ['as busy as a bee', 'Mother works from morning till night without rest. She is ____.'],
    ['as brave as a lion', 'The soldier fought the enemy without any fear. He was ____.'], ['as proud as a peacock', 'After winning the prize, Rohan showed it to everyone again and again. He was ____.'],
    ['as cunning as a fox', 'The trickster fooled the whole village with clever lies. He was ____.'], ['as light as a feather', 'This new school bag weighs almost nothing. It is ____.'],
    ['as white as snow', 'The new uniform was very clean and bright. It was ____.'], ['as black as coal', 'The night sky had no moon and no stars. It was ____.'],
    ['as cool as a cucumber', 'Even when the exam paper was very difficult, Anu stayed calm. She was ____.'], ['as quiet as a mouse', 'The baby was sleeping, so Raju moved about without making any noise. He was ____.'],
    ['as sweet as honey', 'Grandmother always speaks very lovingly. Her words are ____.'], ['as hungry as a wolf', 'After playing football for three hours, Sameer ate six chapatis. He was ____.'],
    ['as wise as an owl', 'Our old neighbour gives the best advice to everyone. He is ____.'], ['as strong as an ox', 'The farmer lifts a heavy sack of grain easily. He is ____.'],
    ['as cold as ice', 'In winter the water in the earthen pot is ____.'], ['as fresh as a daisy', 'After a good night’s sleep, Neha woke up full of energy. She felt ____.'], ['as gentle as a lamb', 'Our big dog never hurts anyone; children play with it happily. It is ____.']];
  const HOMO = [['The ____ rises in the east.', 'sun', ['son', 'sum', 'soon']], ['We ____ the match by two goals.', 'won', ['one', 'own', 'wan']], ['I can ____ the birds singing.', 'hear', ['here', 'hair', 'heir']],
    ['Please come ____ and sit with me.', 'here', ['hear', 'hare', 'heir']], ['The children forgot ____ books at home.', 'their', ['there', 'they’re', 'thier']], ['A ____ has seven days.', 'week', ['weak', 'wick', 'wake']],
    ['May I have a ____ of cake?', 'piece', ['peace', 'peas', 'pace']], ['The strong wind ____ the papers away.', 'blew', ['blue', 'blow', 'bloo']], ['The ship sailed on the ____.', 'sea', ['see', 'sae', 'say']],
    ['The bus ____ from Pune to Mumbai is ₹ 300.', 'fare', ['fair', 'fire', 'far']], ['She ____ the ball to her friend.', 'threw', ['through', 'thrown', 'throw']], ['Please ____ for me at the gate.', 'wait', ['weight', 'white', 'wade']],
    ['Do you ____ the answer to this question?', 'know', ['no', 'now', 'knew']], ['I ____ a letter to my uncle yesterday.', 'wrote', ['rote', 'rot', 'write']], ['There is a ____ in my sock.', 'hole', ['whole', 'hall', 'howl']],
    ['He ate the ____ pizza by himself.', 'whole', ['hole', 'hall', 'wall']], ['The king’s ____ lasted for forty years.', 'reign', ['rain', 'rein', 'ran']], ['Sita has long black ____.', 'hair', ['hare', 'here', 'hear']],
    ['The ____ ran fast but lost the race to the tortoise.', 'hare', ['hair', 'here', 'hear']], ['We must not ____ water.', 'waste', ['waist', 'west', 'wiste']], ['She wore a belt round her ____.', 'waist', ['waste', 'west', 'wait']]];
  const MODAL = [['You ____ not touch the electric wire. It is dangerous.', 'must', ['would', 'could', 'need']], ['____ I come in, sir?', 'May', ['Must', 'Should', 'Would']],
    ['My grandmother is eighty, but she ____ still read without glasses.', 'can', ['must', 'should', 'shall']], ['When I was five years old, I ____ ride a bicycle.', 'could', ['can', 'must', 'shall']],
    ['We ____ respect our elders.', 'should', ['might', 'could', 'may']], ['Look at the dark clouds! It ____ rain soon.', 'may', ['must not', 'need not', 'should not']],
    ['You ____ wear a helmet while riding a bike. It is the law.', 'must', ['might', 'need not', 'could']], ['____ you please pass me the salt?', 'Could', ['Must', 'Should', 'Need']],
    ['You look tired. You ____ take some rest.', 'should', ['must not', 'cannot', 'need not']], ['I ____ finish this work by tomorrow; I promise.', 'will', ['may', 'might', 'would']]];
  const DLG = [['“Where did you get this shell?” asked Mohan.\n“I ____ it on the beach,” said Ravi.\n“Wow! It is beautiful,” replied Mohan.', 'found', ['lost', 'threw', 'sold']],
    ['“Why are you late?” asked the teacher.\n“Sorry, ma’am. I ____ the bus,” said Neha.', 'missed', ['caught', 'drove', 'bought']], ['“Shall we go for a picnic on Sunday?” asked Asha.\n“That’s a ____ idea!” said Meena.', 'great', ['sad', 'late', 'lazy']],
    ['“Can I borrow your pencil?” asked Sunil.\n“____. Here it is,” said Raju.', 'Sure', ['Sorry', 'Goodbye', 'Never']], ['“Thank you for your help,” said the old lady.\n“You are ____,” replied Amit.', 'welcome', ['sorry', 'late', 'angry']],
    ['“What is the matter with you?” asked the doctor.\n“I have a bad ____, doctor,” said Sachin.', 'cold', ['shirt', 'kite', 'book']], ['“How was the match?” asked Father.\n“We ____ it by five runs!” shouted Raj happily.', 'won', ['lost', 'left', 'sold']]];
  const SLOGAN = [['Save water, save ____.', 'life', ['money', 'time', 'shoes']], ['Trees are our friends; let us ____ them.', 'protect', ['cut', 'burn', 'sell']], ['Health is ____.', 'wealth', ['weakness', 'waste', 'worry']],
    ['Say no to ____ bags.', 'plastic', ['cloth', 'jute', 'paper']], ['Each one, ____ one.', 'teach', ['beat', 'eat', 'cheat']], ['Don’t be a fool, ____ fuel.', 'save', ['waste', 'buy', 'burn']],
    ['Cleanliness is next to ____.', 'godliness', ['laziness', 'sadness', 'business']], ['Speed thrills but ____.', 'kills', ['fills', 'pays', 'plays']], ['Water is precious; don’t ____ it.', 'waste', ['save', 'store', 'drink']],
    ['Walk to school and keep the air ____.', 'clean', ['dirty', 'smoky', 'hot']]];
  const RIDDLE7 = [['I have keys but open no locks. I help you type letters. What am I?', 'a keyboard', ['a door', 'a box', 'a piano']], ['The more you take, the more you leave behind. What are they?', 'footsteps', ['coins', 'books', 'apples']],
    ['I am full of holes, but I can still hold water. What am I?', 'a sponge', ['a bucket', 'a net', 'a stone']], ['I have a neck but no head. What am I?', 'a bottle', ['a giraffe', 'a pencil', 'a pen']],
    ['I fly without wings and cry without eyes. What am I?', 'a cloud', ['a bird', 'a kite', 'a baby']], ['I am tall when I am young and short when I am old. What am I?', 'a candle', ['a tree', 'a boy', 'a bottle']],
    ['What has a thumb and four fingers but is not alive?', 'a glove', ['a hand', 'a clock', 'a comb']], ['I have many pages but I am not a tree. I tell stories. What am I?', 'a book', ['a leaf', 'a box', 'a bag']]];
  const JUMBLE7 = ['We were playing in the garden.', 'My father reads the newspaper every morning.', 'The children are flying kites on the terrace.', 'She has finished her homework.', 'They went to the zoo last Sunday.',
    'Our teacher told us an interesting story.', 'The farmer is working in his field.', 'I will visit my grandparents tomorrow.', 'Birds build their nests in trees.', 'Please close the door quietly.'];
  const ADJ7 = ['Ravi bought a {red}, {shiny} bicycle.', 'The {little} girl wore a {lovely} {pink} frock.', 'We saw {tall} trees and {green} fields.', 'The {old} farmer has {two} {strong} bullocks.',
    'A {wise} king ruled the {small} kingdom.', 'She gave me a {sweet}, {juicy} mango.', 'The {brave} soldier saved the {frightened} children.', 'He lives in a {big} {white} house near the river.',
    'My {younger} brother has a {black} puppy with {soft} fur.', 'Grandpa told us an {interesting} story.', 'The {four} {happy} children played {merry} games.', 'The {hot} tea was served in {small} {blue} cups.'];
  const PUNCT7 = ['Ravi’s bag is on the table.', 'Where are you going?', 'We bought apples, bananas, grapes and oranges.', 'Wow! What a lovely painting!', '“I am happy,” said Renu.',
    'Mumbai is the capital of Maharashtra.', 'Mr. Joshi teaches us English.', 'The children’s park is closed today.', 'Can you help me, please?', 'It’s raining heavily.', 'Sunita and I live in Nashik.'];
  const OPP7 = [['alike', 'different'], ['ancient', 'modern'], ['accept', 'refuse'], ['victory', 'defeat'], ['arrival', 'departure'], ['generous', 'mean'], ['borrow', 'lend'], ['punish', 'reward'], ['increase', 'decrease'],
    ['maximum', 'minimum'], ['rough', 'smooth'], ['success', 'failure'], ['guilty', 'innocent'], ['permanent', 'temporary'], ['import', 'export'], ['superior', 'inferior'], ['natural', 'artificial'], ['polite', 'rude'],
    ['careful', 'careless'], ['include', 'exclude'], ['entrance', 'exit'], ['praise', 'blame'], ['ascend', 'descend'], ['cruel', 'kind'], ['fresh', 'stale'], ['deep', 'shallow'], ['tame', 'wild'], ['freedom', 'slavery']];
  const PREFIX = [['possible', 'im'], ['polite', 'im'], ['patient', 'im'], ['perfect', 'im'], ['honest', 'dis'], ['agree', 'dis'], ['obey', 'dis'], ['like', 'dis'], ['appear', 'dis'], ['happy', 'un'], ['kind', 'un'], ['able', 'un'],
    ['tidy', 'un'], ['fair', 'un'], ['known', 'un'], ['correct', 'in'], ['complete', 'in'], ['visible', 'in'], ['active', 'in'], ['regular', 'ir'], ['responsible', 'ir'], ['legal', 'il'], ['literate', 'il'], ['logical', 'il']];
  const SPELL7_EN = ['necessary', 'separate', 'government', 'environment', 'knowledge', 'experience', 'restaurant', 'neighbour', 'committee', 'pronunciation', 'definitely', 'occasion', 'guarantee', 'independence',
    'temperature', 'tomorrow', 'address', 'beginning', 'believe', 'receive', 'achieve', 'science', 'scissors', 'island', 'calendar', 'grammar', 'February', 'Wednesday', 'vegetable', 'beautiful'];

  def('e7POS', 'Parts of speech', (R, Lv) => {
    const P = B7().POS, [s, w, p] = R.pick(P), same = P.filter(x => x[1] === w && x[2] !== p).map(x => x[2]);
    return mk(R, { q: `Which part of speech is the word ‘${w}’ in the given sentence?\n${s}`, a: p, w: [...new Set([...same, ...R.shuffle(POSN)])].filter(x => x !== p).slice(0, 3), steps: [`Here ‘${w}’ ${POSWHY[p]}`, `So it is ${/^[aeiou]/.test(p) ? 'an' : 'a'} ${p}.`] });
  });
  def('e7Phrase', 'Phrases and phrasal verbs', (R) => fillQ(R, 'PHRASE', 'Choose the correct phrase and complete the sentence.'));
  def('e7Simile', 'Similes (as … as)', (R, Lv) => {
    const SM = B7().SIMILE, i = R.ri(0, SM.length - 1), [sm, ctx] = SM[i];
    if (Lv === 3 && R.r() < 0.4) { const ad = sm.split(' ')[1], noun = sm.split(' as ')[1]; return mk(R, { q: `Complete the simile.\nas ________ as ${noun}`, a: ad, w: R.shuffle(SM.filter((_, j) => j !== i).map(x => x[0].split(' ')[1])), steps: [sm] }); }
    return mk(R, { q: `Choose the correct option and complete the sentence.\n${ctx}`, a: sm, w: R.shuffle(SM.filter((_, j) => j !== i).map(x => x[0])), steps: [ctx.replace('____', sm)] });
  });
  def('e7Homo', 'Homophones', (R) => fillQ(R, 'HOMO', 'Choose the correct word to fill in the blank.'));
  def('e7Modal', 'Modal auxiliaries', (R) => fillQ(R, 'MODAL', 'Choose the correct modal auxiliary for the sentence.'));
  def('e7Dialog', 'Complete the dialogue', (R) => fillQ(R, 'DLG', 'Choose the correct option and complete the dialogue.'));
  def('e7Slogan', 'Complete the slogan', (R) => fillQ(R, 'SLOGAN', 'Complete the following slogan.'));
  def('e7Riddle', 'Riddles', (R, Lv) => {
    if (Lv === 1 && R.r() < 0.5) { const RD = B4.RIDDLE, i = R.ri(0, RD.length - 1); return mk(R, { q: `Choose the correct answer for the riddle.\n${RD[i][0]}`, a: RD[i][1], w: R.shuffle(RD.filter((_, j) => j !== i).map(x => x[1])), steps: [`${RD[i][1]}`] }); }
    const [q, a, w] = R.pick(B7().RIDDLE7); return mk(R, { q: `Choose the correct answer for the riddle.\n${q}`, a, w: R.shuffle(w), steps: [`Answer: ${a}`] });
  });
  def('e7Jumble', 'Make a meaningful sentence', (R) => {
    const s = R.pick(B7().JUMBLE7), words = s.replace(/[.?!]$/, '').split(' '), low = words.map((w, i) => i === 0 && w !== 'I' ? w.toLowerCase() : w);
    const shown = R.shuffle(low.slice()).join(' / '), aux = ['were', 'are', 'has', 'is', 'will', 'was'].find(x => low.includes(x)), w = [];
    if (aux) { const rest = low.filter(x => x !== aux); w.push(`${cap(aux)} ${rest.join(' ')}?`); }
    w.push(cap(low.slice(1).join(' ')) + '.'); w.push(cap(low.slice(0, -1).join(' ')) + '.');
    const mix = low.slice(); for (let k = 0; k < 3; k++) { const a = R.ri(0, mix.length - 1), b = R.ri(0, mix.length - 1); [mix[a], mix[b]] = [mix[b], mix[a]]; } w.push(cap(mix.join(' ')) + '.');
    return mk(R, { q: `Choose the correct alternative to frame a meaningful statement.\n${shown}`, a: s, w, steps: ['Subject + verb + object + place / time', s] });
  });
  def('e7Adj', 'Count the adjectives', (R) => {
    const s = R.pick(B7().ADJ7), adj = [...s.matchAll(/\{(.+?)\}/g)].map(m => m[1]), n = adj.length, plain = s.replace(/[{}]/g, '');
    return mk(R, { q: `How many adjectives are there in the following sentence?\n${plain}`, a: String(n), w: [n + 1, n - 1, n + 2, n - 2].filter(x => x >= 0).map(String), steps: [`Adjectives: ${adj.join(', ')}`, `Total = ${n}`] });
  });
  // wrong copies of a correctly punctuated sentence
  function unpunct(s, R) {
    const out = new Set();
    if (/’/.test(s)) { out.add(s.replace(/’/, '')); out.add(s.replace(/’s/, 's’')); }
    if (/,/.test(s)) { out.add(s.replace(/,/g, '')); out.add(s.replace(/, /, ' ').replace(/ and/, ', and,')); }
    if (/\?$/.test(s)) { out.add(s.replace(/\?$/, '.')); out.add(s.replace(/\?$/, '!')); }
    if (/!/.test(s)) { out.add(s.replace(/!/g, '.')); out.add(s.replace(/!/, '?')); }
    if (/“/.test(s)) { out.add(s.replace(/[“”]/g, '')); out.add(s.replace('“', '').replace(',”', '”,')); }
    const caps = s.split(' ').map((w, i) => i > 0 && /^[A-Z][a-z]/.test(w) ? w.toLowerCase() : w).join(' '); out.add(caps);
    out.add(s[0].toLowerCase() + s.slice(1)); if (/\.$/.test(s)) out.add(s.replace(/\.$/, '?'));
    out.delete(s); return R.shuffle([...out]);
  }
  def('e7Punct', 'Punctuation', (R, Lv) => {
    if (vt(R, Lv, [1, 2]) === 1) { const E = B4.ENDS, i = R.ri(0, E.length - 1), [s, m] = E[i], sym = (m.match(/\((.)\)/) || [])[1];
      if (sym) return mk(R, { q: `Complete the sentence with the correct punctuation mark.\n${s}`, a: sym, w: ['?', '!', '.', ',', '“ ”'].filter(x => x !== sym), steps: [`${s}${sym} — ${m}`] }); }
    const s = R.pick(B7().PUNCT7);
    return mk(R, { q: 'Which sentence is correctly punctuated?', a: s, w: unpunct(s, R), steps: [`Correct: ${s}`] });
  });
  def('e7Opp', 'Opposites (words and prefixes)', (R, Lv) => {
    if (vt(R, Lv, [1, 2]) === 2) { const [w, p] = R.pick(B7().PREFIX), PF = ['un', 'dis', 'im', 'in', 'ir', 'il'];
      return mk(R, { q: `Choose the correct opposite of ‘${w}’ formed by adding a prefix.`, a: p + w, w: R.shuffle(PF.filter(x => x !== p)).map(x => x + w), steps: [`${w} → ${p}${w}`] }); }
    const O = [...B7().OPP7, ...(Lv === 1 ? B4.OPP : [])], i = R.ri(0, O.length - 1), rev = R.r() < 0.4, [w, a] = rev ? [O[i][1], O[i][0]] : O[i];
    return mk(R, { q: `Choose the correct opposite of the word ‘${w}’.`, a, w: R.shuffle(O.filter((_, j) => j !== i).map(p => rev ? p[0] : p[1])), steps: [`${w} × ${a}`] });
  });
  def('e7Spell', 'Spelling', (R) => {
    const P = [...B7().SPELL7_EN, ...B4.SPELL_EN], [a, ...rest] = pickN(R, P.filter(w => LG.misEn(w, R).length), 4), w = rest.map(x => LG.misEn(x, R)[0]);
    return mk(R, { q: 'Choose the word with the correct spelling.', a, w, steps: [`Correct: ${a}`, ...rest.map((x, k) => `${w[k]} ✘ → ${x} ✔`)] });
  });

  /* ───────────── Passages, notices, conversations (our own) ───────────── */
  const EN7_PASS = [
    [`A. P. J. Abdul Kalam was born in Rameswaram, a small town in Tamil Nadu. His family was not rich, so as a young boy he sold newspapers to help his father. He loved to watch birds flying over the sea and dreamt of flying one day. He studied hard and became a great scientist. He worked on India’s rockets and missiles, so people called him the ‘Missile Man of India’. Later, he became the eleventh President of India. Even as President, he loved to meet children. He always told them, “Dream big and work hard to make your dreams come true.”`, [
      ['Where was Abdul Kalam born?', 'In Rameswaram', ['In Chennai', 'In Delhi', 'In Mumbai'], '“…born in Rameswaram, a small town in Tamil Nadu.”'],
      ['Why did young Kalam sell newspapers?', 'To help his father', ['To buy toys', 'To become famous', 'To meet children'], '“…he sold newspapers to help his father.”'],
      ['What did people call him?', 'The Missile Man of India', ['The Father of the Nation', 'The Iron Man of India', 'The Nightingale of India'], '“…people called him the ‘Missile Man of India’.”'],
      ['Which word in the passage means ‘a person who studies science’?', 'scientist', ['President', 'newspaper', 'missile'], 'scientist'],
      ['What advice did Kalam give to children?', 'Dream big and work hard', ['Sell newspapers', 'Watch birds every day', 'Become President'], '“Dream big and work hard…”']]],
    [`Our body is like a machine. To keep it working well, we need a balanced diet, regular exercise and enough sleep. A balanced diet has cereals, pulses, fruits, vegetables and milk. We should drink plenty of water every day. Junk food like chips and cold drinks tastes good, but it harms our body. Playing outdoor games such as kabaddi, kho-kho and football keeps us fit and active. Above all, we must sleep for at least eight hours every night.`, [
      ['Our body is compared to ________.', 'a machine', ['a tree', 'a house', 'a river'], '“Our body is like a machine.”'],
      ['Complete the web diagram: Outdoor games → kabaddi, kho-kho, ?', 'football', ['chess', 'carrom', 'ludo'], '“…kabaddi, kho-kho and football…”'],
      ['What harms our body?', 'Junk food', ['Fruits', 'Milk', 'Water'], '“Junk food like chips and cold drinks… harms our body.”'],
      ['How long should we sleep every night?', 'At least eight hours', ['Four hours', 'Six hours', 'Twelve hours'], '“…sleep for at least eight hours every night.”'],
      ['Which word in the passage means ‘healthy and strong’?', 'fit', ['plenty', 'junk', 'machine'], '“…keeps us fit and active.”']]],
    [`Meera was walking home from school when she saw a brown wallet lying near the bus stop. Inside, there was some money, a photograph and a card with an address. Meera did not keep the money. With her mother, she went to the address written on the card. An old man opened the door. When he saw his wallet, his eyes filled with tears of joy. “This wallet has my pension money for the whole month,” he said. He thanked Meera and blessed her. Meera felt proud and happy.`, [
      ['Where did Meera find the wallet?', 'Near the bus stop', ['In her school', 'In the market', 'In her house'], '“…lying near the bus stop.”'],
      ['Which of these was NOT in the wallet?', 'A key', ['Some money', 'A photograph', 'A card'], 'money, a photograph and a card — no key'],
      ['Who went with Meera to the old man’s house?', 'Her mother', ['Her teacher', 'Her friend', 'Her brother'], '“With her mother, she went…”'],
      ['‘His eyes filled with tears of joy’ means the old man was ________.', 'very happy', ['very sad', 'very angry', 'very sleepy'], 'tears of joy = great happiness'],
      ['Which quality of Meera does the passage show?', 'Honesty', ['Laziness', 'Anger', 'Greed'], 'She returned the money — honesty']]],
  ];
  const EN7_AD = [
    [`NOTICE
SUNRISE HIGH SCHOOL, NASHIK                    12 August
TREE PLANTATION DRIVE
Our Eco Club will plant trees on the school ground on Saturday, 16 August, from 8 a.m. to 11 a.m.
• Every student should bring one sapling.
• Wear your sports uniform.
• Bring a water bottle and a cap.
Secretary, Eco Club`, [
      ['What is the notice about?', 'A tree plantation drive', ['A sports day', 'A school trip', 'A drawing competition'], 'TREE PLANTATION DRIVE'],
      ['What should every student bring?', 'One sapling', ['A football', 'A notebook', 'An umbrella'], '“Every student should bring one sapling.”'],
      ['What should the students wear?', 'Sports uniform', ['Raincoat', 'Party dress', 'Night dress'], '“Wear your sports uniform.”'],
      ['Who has written the notice?', 'The Secretary, Eco Club', ['The Principal', 'The Sports Teacher', 'A parent'], 'Secretary, Eco Club'],
      ['On which day will the programme be held?', 'Saturday', ['Monday', 'Friday', 'Sunday'], 'Saturday, 16 August']]],
    [`★ LEARN TO SWIM ★
Aqua Star Swimming Club, Kolhapur
For children from 8 to 14 years
1 May to 31 May  •  6 a.m. to 8 a.m.
Trained coaches  •  Clean pool  •  Certificate at the end
Fees: ₹ 1500 only
Hurry! Only 40 seats. Register at the club office.`, [
      ['For which age group is the swimming class?', '8 to 14 years', ['5 to 8 years', '14 to 18 years', 'All ages'], '“For children from 8 to 14 years”'],
      ['How long will the class go on?', 'One month', ['One week', 'Two months', 'One year'], '1 May to 31 May'],
      ['How much are the fees?', '₹ 1500', ['₹ 150', '₹ 1000', '₹ 5000'], 'Fees: ₹ 1500 only'],
      ['Which of these is NOT mentioned in the advertisement?', 'Free transport', ['Trained coaches', 'Clean pool', 'Certificate'], 'Free transport is not mentioned'],
      ['How many seats are there?', '40', ['14', '15', '100'], '“Only 40 seats.”']]],
  ];
  const EN7_DIALOG = [
    [`Rohan : Good morning, sir. May I come in?
Teacher : Yes, come in. Why are you late today?
Rohan : Sorry, sir. My bicycle had a flat tyre, so I had to walk to school.
Teacher : That’s all right. Next time, start a little early.
Rohan : Yes, sir. Thank you.`, [
      ['Why was Rohan late?', 'His bicycle had a flat tyre', ['He woke up late', 'He missed the bus', 'He was ill'], '“My bicycle had a flat tyre…”'],
      ['How did Rohan come to school?', 'On foot', ['By bus', 'By bicycle', 'By car'], '“…I had to walk to school.”'],
      ['What did the teacher advise Rohan?', 'To start a little early', ['To buy a new bicycle', 'To come by bus', 'To stay at home'], '“Next time, start a little early.”'],
      ['‘May I come in?’ is a sentence asking for ________.', 'permission', ['an order', 'a reason', 'an apology'], '“May I…” asks for permission']]],
  ];
  const HEADE = { e7Passage: 'Read the passage and choose the correct option.', e7Ad: 'Read the notice / advertisement carefully and choose the correct option.', e7Conv: 'Read the conversation and choose the correct option.' };
  const passType = (key, name, bank) => def(key, name, (R) => {
    const [text, qs] = R.pick(B7()[bank]), [q, a, w, why] = R.pick(qs);
    return mk(R, { q: `${HEADE[key]}\n\n${text}\n\nQuestion: ${q}`, a, w: R.shuffle(w), steps: [why] });
  });
  passType('e7Passage', 'Passage', 'EN7_PASS');
  passType('e7Ad', 'Notice / advertisement', 'EN7_AD');
  passType('e7Conv', 'Conversation', 'EN7_DIALOG');

  /* ───────────── lessons, weights, banks ───────────── */
  S.LANG7_B = Object.assign(S.LANG7_B || {}, { POS, PHRASE, SIMILE, HOMO, MODAL, DLG, SLOGAN, RIDDLE7, JUMBLE7, ADJ7, PUNCT7, OPP7, PREFIX, SPELL7_EN, EN7_PASS, EN7_AD, EN7_DIALOG });
  const G = S.GROUPS[7] || {};
  G['English'] = [
    ['Passage, notice, conversation', ['e7Passage', 'e7Ad', 'e7Conv']],
    ['Grammar: tenses, voice, speech', ['e7Tense', 'e7Voice', 'e7Speech', 'e7Modal', 'e7Degree']],
    ['Grammar: parts of speech, punctuation', ['e7POS', 'e7Adj', 'e7Punct', 'e7Jumble']],
    ['Words and phrases', ['e7Opp', 'e7Phrase', 'e7Simile', 'e7Homo', 'e7Spell']],
    ['Everyday English and puzzles', ['e7Clock', 'e7Dialog', 'e7Slogan', 'e7Riddle', 'e7Grid']],
  ];
  // subjects in paper order: पेपर 1 (मराठी, गणित), पेपर 2 (English, बुद्धिमत्ता)
  S.GROUPS[7] = Object.fromEntries(['मराठी', 'गणित', 'English', 'बुद्धिमत्ता'].filter(k => G[k]).map(k => [k, G[k]]).concat(Object.entries(G).filter(([k]) => !['मराठी', 'गणित', 'English', 'बुद्धिमत्ता'].includes(k))));
  Object.assign(S.WEIGHT, { e7Passage: 3, e7Ad: 2, e7Conv: 1, e7Tense: 2, e7Voice: 1, e7Speech: 1, e7Modal: 1, e7Degree: 1, e7POS: 1, e7Adj: 1, e7Punct: 1, e7Jumble: 1,
    e7Opp: 1, e7Phrase: 1, e7Simile: 1, e7Homo: 1, e7Spell: 1, e7Clock: 1, e7Dialog: 1, e7Slogan: 1, e7Riddle: 1, e7Grid: 1 });
})(this);
