/* ════════════════════════════════════════
   shopPoster.js — QR poster for a guide / book shop (docs/PLAN_shop_partners.md)
   Drawn on the phone (no server work): the QR opens the free test with the
   shop's code. Sizes: A5 / A4 / A3 posters, or 8 stickers on an A4 sheet.
   Used by Admin > Partners > Shops and by shop.html.
════════════════════════════════════════ */

window.SHOP_POSTER = (() => {
  const SITE = 'https://nkseduorbit.in';
  const QRCODE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  // PDF keeps the real paper size, so a xerox / print shop prints it right;
  // JPEG is small for WhatsApp; PNG is the sharpest picture.
  const FORMATS = {
    pdf:  'PDF (print साठी best)',
    jpeg: 'JPEG (WhatsApp / Status साठी)',
    png:  'PNG (सगळ्यात स्पष्ट picture)',
  };
  const SIZES = {
    A5: { label: 'A5 (लहान, counter वर)', mm: [148, 210] },
    A4: { label: 'A4 (नेहमीचा)', mm: [210, 297] },
    A3: { label: 'A3 (मोठा, भिंतीवर)', mm: [297, 420] },
    STICKERS: { label: 'Stickers (A4 वर 8, guide मध्ये चिकटवायला)', mm: [210, 297] },
  };
  const FONT = '"Baloo 2", "Noto Sans Devanagari", sans-serif';

  const freeLink = code => `${SITE}/student-app/?free=1&shop=${encodeURIComponent(code)}`;
  const appLink = code => `${SITE}/get-app.html?teacher=${encodeURIComponent(code)}`;

  const _loading = {};
  function _loadScript(src, ready) {
    if (ready()) return Promise.resolve();
    if (!_loading[src]) {
      _loading[src] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src; s.async = true;
        s.onload = () => (ready() ? resolve() : reject(new Error('library missing')));
        s.onerror = () => { delete _loading[src]; reject(new Error('library did not load')); };
        document.head.appendChild(s);
      });
    }
    return _loading[src];
  }
  const _loadQR = () => _loadScript(QRCODE_CDN, () => !!window.QRCode);

  async function _qrCanvas(text, px) {
    await _loadQR();
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(box);
    try {
      // eslint-disable-next-line no-new
      new window.QRCode(box, { text, width: px, height: px, colorDark: '#1b1340', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
      const c = box.querySelector('canvas');
      if (!c) throw new Error('QR not drawn');
      return c;
    } finally { box.remove(); }
  }

  function _round(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function _fit(g, text, maxW, weight, px) {
    let size = px;
    do { g.font = `${weight} ${size}px ${FONT}`; size -= 2; } while (g.measureText(text).width > maxW && size > 12);
  }

  // One poster laid out on a 1000 × 1414 grid (A-series ratio), scaled by `k`.
  async function _drawPoster(g, shop, x0, y0, k) {
    const W = 1000 * k, H = 1414 * k;
    const X = v => x0 + v * k, Y = v => y0 + v * k, S = v => v * k;
    const bg = g.createLinearGradient(X(0), Y(0), X(1000), Y(1414));
    bg.addColorStop(0, '#ff7a18'); bg.addColorStop(.45, '#ff3d77'); bg.addColorStop(1, '#7b2ff7');
    g.fillStyle = bg; g.fillRect(x0, y0, W, H);
    // confetti
    const cols = ['#ffc83d', '#ffffff', '#38bdf8', '#2a0f5c'];
    for (let i = 0; i < 46; i++) {
      g.save(); g.globalAlpha = .35; g.fillStyle = cols[i % cols.length];
      g.translate(X((i * 173) % 1000), Y((i * 271) % 1414)); g.rotate(i);
      g.fillRect(S(-10), S(-4), S(20), S(8)); g.restore();
    }
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#fff';
    g.font = `800 ${S(46)}px ${FONT}`; g.fillText('NKs EduOrbit', X(500), Y(92));
    // FREE TEST ribbon
    g.fillStyle = '#ffc83d'; _round(g, X(200), Y(125), S(600), S(120), S(60)); g.fill();
    g.fillStyle = '#3b1d00'; g.font = `800 ${S(84)}px ${FONT}`; g.fillText('📝 FREE TEST', X(500), Y(216));
    g.fillStyle = '#fff';
    _fit(g, 'तुमच्या मुलाची तयारी किती? 🎯', S(900), 800, S(64)); g.fillText('तुमच्या मुलाची तयारी किती? 🎯', X(500), Y(330));
    g.font = `700 ${S(40)}px ${FONT}`; g.fillText('Test द्या · लगेच Result · Rank बघा 🏆', X(500), Y(392));
    // QR card
    g.fillStyle = '#fff'; _round(g, X(220), Y(430), S(560), S(600), S(40)); g.fill();
    const qr = await _qrCanvas(freeLink(shop.code), Math.round(S(470)));
    g.imageSmoothingEnabled = false;
    g.drawImage(qr, X(265), Y(470), S(470), S(470));
    g.fillStyle = '#ff3d77'; g.font = `800 ${S(40)}px ${FONT}`; g.fillText('📱 Scan करा — Login नको', X(500), Y(1005));
    // points
    g.fillStyle = '#fff'; g.textAlign = 'left';
    const pts = ['✅ 4थी पासून पुढे + स्पर्धा परीक्षा', '✅ Notes, सराव आणि Tests — Free', '🏆 दर आठवड्याला Free महा-Test'];
    pts.forEach((t, i) => { _fit(g, t, S(800), 700, S(42)); g.fillText(t, X(110), Y(1100 + i * 62)); });
    // shop ribbon
    g.textAlign = 'center';
    g.fillStyle = 'rgba(27,19,64,.82)'; _round(g, X(60), Y(1268), S(880), S(120), S(28)); g.fill();
    g.fillStyle = '#ffc83d';
    const name = `🏪 ${shop.shop_name}${shop.area ? ', ' + shop.area : ''}`;
    _fit(g, name, S(840), 800, S(46)); g.fillText(name, X(500), Y(1318));
    g.fillStyle = '#fff'; g.font = `700 ${S(30)}px ${FONT}`;
    g.fillText(`App मध्ये register करताना code: ${shop.code}`, X(500), Y(1366));
  }

  async function _drawSticker(g, shop, x0, y0, w, h) {
    const k = w / 500;
    const S = v => v * k;
    g.fillStyle = '#fff'; g.fillRect(x0, y0, w, h);
    const bg = g.createLinearGradient(x0, y0, x0 + w, y0);
    bg.addColorStop(0, '#ff7a18'); bg.addColorStop(.5, '#ff3d77'); bg.addColorStop(1, '#7b2ff7');
    g.fillStyle = bg; g.fillRect(x0, y0, w, S(70));
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `800 ${S(40)}px ${FONT}`;
    g.fillText('📝 FREE TEST', x0 + w / 2, y0 + S(50));
    const q = Math.min(S(250), h - S(200));
    const qr = await _qrCanvas(freeLink(shop.code), Math.round(q));
    g.imageSmoothingEnabled = false;
    g.drawImage(qr, x0 + (w - q) / 2, y0 + S(85), q, q);
    g.fillStyle = '#1b1340'; g.font = `800 ${S(28)}px ${FONT}`;
    g.fillText('Scan करा · Result · Rank 🏆', x0 + w / 2, y0 + S(85) + q + S(38));
    _fit(g, shop.shop_name, w - S(30), 700, S(26));
    g.fillStyle = '#ff3d77'; g.fillText(shop.shop_name, x0 + w / 2, y0 + S(85) + q + S(74));
    g.strokeStyle = '#cbd5e1'; g.setLineDash([S(8), S(6)]); g.lineWidth = S(2);
    g.strokeRect(x0 + S(2), y0 + S(2), w - S(4), h - S(4)); g.setLineDash([]);
  }

  // shop = { code, shop_name, area }; size = A5 | A4 | A3 | STICKERS
  async function draw(shop, size = 'A4') {
    if (!SIZES[size]) size = 'A4';
    await document.fonts?.ready;
    const scale = { A5: 1.24, A4: 1.75, A3: 2.48, STICKERS: 1.75 }[size];   // ~150 dpi print
    const cv = document.createElement('canvas');
    cv.width = Math.round(1000 * scale); cv.height = Math.round(1414 * scale);
    const g = cv.getContext('2d');
    if (size !== 'STICKERS') {
      await _drawPoster(g, shop, 0, 0, scale);
    } else {
      g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
      const cw = cv.width / 2, ch = cv.height / 4;
      for (let i = 0; i < 8; i++) await _drawSticker(g, shop, (i % 2) * cw, Math.floor(i / 2) * ch, cw, ch);
    }
    return cv;
  }

  const _file = (shop, size, ext = 'png') => `poster-${shop.code}-${size}.${ext === 'jpeg' ? 'jpg' : ext}`;

  async function _pdf(cv, size) {
    await _loadScript(JSPDF_CDN, () => !!window.jspdf?.jsPDF);
    const [w, h] = (SIZES[size] || SIZES.A4).mm;
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: [w, h], orientation: 'portrait', compress: true });
    doc.addImage(cv.toDataURL('image/jpeg', .95), 'JPEG', 0, 0, w, h);
    return doc.output('blob');
  }

  // format: pdf | jpeg | png
  async function download(shop, size, format = 'pdf') {
    if (!FORMATS[format]) format = 'pdf';
    const cv = await draw(shop, size);
    const blob = format === 'pdf'
      ? await _pdf(cv, size)
      : await new Promise(r => cv.toBlob(r, format === 'jpeg' ? 'image/jpeg' : 'image/png', .92));
    if (!blob) throw new Error('no file');
    const name = _file(shop, size, format);
    if (window.FILE_EXPORT?.saveAndShare) return window.FILE_EXPORT.saveAndShare(blob, name);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // Prints at the real paper size (browser print dialog → printer or "Save as PDF").
  async function print(shop, size) {
    const cv = await draw(shop, size);
    const url = cv.toDataURL('image/png');
    const paper = size === 'STICKERS' ? 'A4' : size;
    const [w, h] = SIZES[size]?.mm || SIZES.A4.mm;
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${_file(shop, size)}</title>
      <style>@page{size:${paper} portrait;margin:0}html,body{margin:0;padding:0}
      img{display:block;width:${w}mm;height:${h}mm;object-fit:contain}</style></head>
      <body><img src="${url}" alt=""></body></html>`);
    doc.close();
    await new Promise(r => { const img = doc.querySelector('img'); if (img.complete) r(); else img.onload = r; });
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 60000);
  }

  return { SIZES, FORMATS, draw, download, print, freeLink, appLink };
})();
