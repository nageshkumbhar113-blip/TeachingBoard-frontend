/* ════════════════════════════════════════
   mp4fix.js — Ad Studio's recordings → an ordinary MP4
   Global: MP4FIX   (also require()-able, for tests)

   Chrome's MediaRecorder writes a "fragmented" MP4: the length is 0 in the header and the frames come in
   small pieces. Some phone players then show the video small / wrong, can't seek, or show 0:00. This turns it
   into a normal MP4 (one index at the front, the real length, "fast start"), without re-encoding: the same
   video and sound bytes, only re-arranged. If anything is unexpected the original is kept.
════════════════════════════════════════ */
(function (root) {
  const u32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  const i32 = (b, o) => (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
  const u64 = (b, o) => u32(b, o) * 4294967296 + u32(b, o + 4);
  const type = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

  // the boxes inside [start, end): { type, start, size, body }
  function boxes(b, start, end) {
    const out = [];
    for (let p = start; p + 8 <= end;) {
      let size = u32(b, p), hl = 8;
      if (size === 1) { size = u64(b, p + 8); hl = 16; } else if (size === 0) size = end - p;
      if (size < hl || p + size > end) break;
      out.push({ type: type(b, p + 4), start: p, size, body: p + hl, end: p + size });
      p += size;
    }
    return out;
  }
  const child = (b, box, t) => boxes(b, box.body, box.end).find(x => x.type === t);
  const path = (b, box, ...ts) => ts.reduce((x, t) => x && child(b, x, t), box);

  // ── writing ──
  function W() { this.parts = []; this.len = 0; }
  W.prototype.bytes = function (a) { this.parts.push(a); this.len += a.length; return this; };
  W.prototype.u8 = function (v) { return this.bytes(Uint8Array.of(v & 255)); };
  W.prototype.u16 = function (v) { return this.bytes(Uint8Array.of((v >>> 8) & 255, v & 255)); };
  W.prototype.u32 = function (v) { return this.bytes(Uint8Array.of((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255)); };
  W.prototype.str = function (s) { return this.bytes(Uint8Array.from([...s].map(c => c.charCodeAt(0)))); };
  W.prototype.done = function () { const o = new Uint8Array(this.len); let p = 0; for (const a of this.parts) { o.set(a, p); p += a.length; } return o; };
  function box(t, ...kids) { const w = new W(); const body = kids.reduce((n, k) => n + k.length, 0); w.u32(8 + body).str(t); kids.forEach(k => w.bytes(k)); return w.done(); }
  const full = (t, v, f, body) => box(t, new W().u8(v).u8(f >> 16).u16(f & 0xffff).bytes(body).done());

  function fix(input) {
    // a plain Uint8Array (Node's Buffer.slice would share memory, and its .buffer starts elsewhere)
    const b = input instanceof Uint8Array && input.constructor === Uint8Array ? input : new Uint8Array(input);
    const top = boxes(b, 0, b.length);
    const moov = top.find(x => x.type === 'moov');
    if (!moov || !top.some(x => x.type === 'moof')) return null;   // not fragmented: nothing to do

    // tracks: id, timescale, handler, the boxes we copy, trex defaults
    const trex = {};
    const mvex = child(b, moov, 'mvex');
    if (mvex) for (const t of boxes(b, mvex.body, mvex.end).filter(x => x.type === 'trex')) {
      const o = t.body + 4; trex[u32(b, o)] = { dur: u32(b, o + 8), size: u32(b, o + 12), flags: u32(b, o + 16) };
    }
    const tracks = boxes(b, moov.body, moov.end).filter(x => x.type === 'trak').map(tr => {
      const tkhd = child(b, tr, 'tkhd'), mdhd = path(b, tr, 'mdia', 'mdhd'), hdlr = path(b, tr, 'mdia', 'hdlr');
      const minf = path(b, tr, 'mdia', 'minf'), stsd = path(b, minf, 'stbl', 'stsd');
      const v1 = b[tkhd.body] === 1, id = u32(b, tkhd.body + (v1 ? 20 : 12));
      const m1 = b[mdhd.body] === 1, ts = u32(b, mdhd.body + (m1 ? 20 : 12));
      const handler = type(b, hdlr.body + 8);
      const keep = t => { const x = child(b, minf, t); return x ? b.slice(x.start, x.end) : null; };
      return { id, ts, handler, tkhd: b.slice(tkhd.start, tkhd.end), hdlr: b.slice(hdlr.start, hdlr.end), mdhd: b.slice(mdhd.start, mdhd.end),
        vmhd: keep('vmhd'), smhd: keep('smhd'), dinf: keep('dinf'), stsd: b.slice(stsd.start, stsd.end), samples: [], first: null };
    });
    const byId = new Map(tracks.map(t => [t.id, t]));

    // every fragment's samples: where they are, size, duration, key frame, composition offset
    for (const moof of top.filter(x => x.type === 'moof')) {
      for (const traf of boxes(b, moof.body, moof.end).filter(x => x.type === 'traf')) {
        const tfhd = child(b, traf, 'tfhd'), tfdt = child(b, traf, 'tfdt');
        const ff = u32(b, tfhd.body) & 0xffffff, id = u32(b, tfhd.body + 4), tr = byId.get(id), d = trex[id] || { dur: 0, size: 0, flags: 0 };
        if (!tr) return null;
        let p = tfhd.body + 8, base = moof.start, dDur = d.dur, dSize = d.size, dFlags = d.flags;
        if (ff & 0x1) { base = u64(b, p); p += 8; }
        if (ff & 0x2) p += 4;
        if (ff & 0x8) { dDur = u32(b, p); p += 4; }
        if (ff & 0x10) { dSize = u32(b, p); p += 4; }
        if (ff & 0x20) { dFlags = u32(b, p); p += 4; }
        let t = tfdt ? (b[tfdt.body] === 1 ? u64(b, tfdt.body + 4) : u32(b, tfdt.body + 4)) : null;
        if (tr.first === null && t !== null) tr.first = t;
        for (const trun of boxes(b, traf.body, traf.end).filter(x => x.type === 'trun')) {
          const v = b[trun.body], rf = u32(b, trun.body) & 0xffffff, n = u32(b, trun.body + 4);
          let q = trun.body + 8, off = base, firstFlags = null;
          if (rf & 0x1) { off = base + i32(b, q); q += 4; }
          if (rf & 0x4) { firstFlags = u32(b, q); q += 4; }
          for (let i = 0; i < n; i++) {
            const dur = rf & 0x100 ? u32(b, (q += 4) - 4) : dDur;
            const size = rf & 0x200 ? u32(b, (q += 4) - 4) : dSize;
            let flags = rf & 0x400 ? u32(b, (q += 4) - 4) : dFlags;
            if (i === 0 && firstFlags !== null) flags = firstFlags;
            const cto = rf & 0x800 ? (v === 1 ? i32(b, (q += 4) - 4) : u32(b, (q += 4) - 4)) : 0;
            if (off + size > b.length) return null;
            tr.samples.push({ off, size, dur, sync: !(flags & 0x10000), cto });
            off += size;
          }
        }
        void t;
      }
    }
    if (!tracks.length || tracks.some(t => !t.samples.length)) return null;

    // the new file: ftyp · moov (index) · mdat (the same samples, in the old order)
    const order = tracks.flatMap(t => t.samples.map(s => ({ t, s }))).sort((x, y) => x.s.off - y.s.off);
    const MOVIE_TS = 1000;
    const durOf = t => t.samples.reduce((n, s) => n + s.dur, 0);
    const movieDur = Math.max(...tracks.map(t => Math.round(((t.first || 0) + durOf(t)) * MOVIE_TS / t.ts)));
    const ftyp = box('ftyp', new W().str('isom').u32(512).str('isomiso2avc1mp41').done());

    function trak(t, chunkOff) {
      const n = t.samples.length, dur = durOf(t);
      // stts: runs of equal durations
      const stts = new W(); const runs = [];
      for (const s of t.samples) { const r = runs[runs.length - 1]; if (r && r[1] === s.dur) r[0]++; else runs.push([1, s.dur]); }
      stts.u32(runs.length); runs.forEach(([c, d]) => stts.u32(c).u32(d));
      const stsz = new W().u32(0).u32(n); t.samples.forEach(s => stsz.u32(s.size));
      const stco = new W().u32(n); chunkOff.forEach(o => stco.u32(o));
      const stsc = new W().u32(1).u32(1).u32(1).u32(1);   // one sample per chunk
      const kids = [t.stsd, full('stts', 0, 0, stts.done()), full('stsc', 0, 0, stsc.done()), full('stsz', 0, 0, stsz.done()), full('stco', 0, 0, stco.done())];
      if (t.handler === 'vide' && t.samples.some(s => !s.sync)) { const ss = new W(); const k = t.samples.map((s, i) => s.sync ? i + 1 : 0).filter(Boolean); ss.u32(k.length); k.forEach(i => ss.u32(i)); kids.push(full('stss', 0, 0, ss.done())); }
      if (t.samples.some(s => s.cto)) { const c = new W(); const r2 = []; for (const s of t.samples) { const r = r2[r2.length - 1]; if (r && r[1] === s.cto) r[0]++; else r2.push([1, s.cto]); } c.u32(r2.length); r2.forEach(([k, o]) => c.u32(k).u32(o >>> 0)); kids.push(full('ctts', t.samples.some(s => s.cto < 0) ? 1 : 0, 0, c.done())); }
      const stbl = box('stbl', ...kids);
      const minf = box('minf', ...[t.vmhd, t.smhd, t.dinf].filter(Boolean), stbl);
      // mdhd / tkhd with the real length (version 0)
      const mdhd = t.mdhd.slice(); const m1 = mdhd[8] === 1;
      if (m1) { /* 64-bit: write the low 32 bits of the duration */ const o = 8 + 4 + 8 + 8 + 4; mdhd.set([0, 0, 0, 0], o); new DataView(mdhd.buffer).setUint32(o + 4, dur); }
      else new DataView(mdhd.buffer).setUint32(8 + 4 + 4 + 4 + 4, dur);
      const mdia = box('mdia', mdhd, t.hdlr, minf);
      const tkhd = t.tkhd.slice(); const tv = tkhd[8] === 1, tdur = Math.round(((t.first || 0) + dur) * MOVIE_TS / t.ts);
      tkhd[11] = tkhd[11] | 0x3;   // enabled + in movie
      if (tv) { tkhd.set([0, 0, 0, 0], 8 + 4 + 8 + 8 + 4 + 4); new DataView(tkhd.buffer).setUint32(8 + 4 + 8 + 8 + 4 + 4 + 4, tdur); }   // (a recording leaves the 64-bit length "unknown" = all ones) else new DataView(tkhd.buffer).setUint32(8 + 4 + 4 + 4 + 4 + 4, tdur);
      // a track that starts a little after 0 (sound vs picture): an empty edit first, so the two stay in sync
      const kidsT = [tkhd];
      if (t.first) {
        const e = new W().u32(2).u32(Math.round(t.first * MOVIE_TS / t.ts)).u32(0xffffffff).u32(0x00010000).u32(Math.round(dur * MOVIE_TS / t.ts)).u32(0).u32(0x00010000);
        kidsT.push(box('edts', full('elst', 0, 0, e.done())));
      }
      return box('trak', ...kidsT, mdia);
    }
    function moovFor(offsets) {
      const mvhd = new W().u32(0).u32(0).u32(MOVIE_TS).u32(movieDur).u32(0x00010000).u16(0x0100).u16(0).u32(0).u32(0)
        .u32(0x00010000).u32(0).u32(0).u32(0).u32(0x00010000).u32(0).u32(0).u32(0).u32(0x40000000)
        .u32(0).u32(0).u32(0).u32(0).u32(0).u32(0).u32(Math.max(...tracks.map(t => t.id)) + 1).done();
      return box('moov', full('mvhd', 0, 0, mvhd), ...tracks.map(t => trak(t, offsets.get(t))));
    }
    // the index size does not depend on the offsets' values: build it once with zeros to know where mdat starts
    const zero = new Map(tracks.map(t => [t, t.samples.map(() => 0)]));
    const head = ftyp.length + moovFor(zero).length;
    const mdatBody = order.reduce((n, x) => n + x.s.size, 0);
    if (head + 8 + mdatBody > 0xffffffff) return null;
    const offsets = new Map(tracks.map(t => [t, []])), idx = new Map(tracks.map(t => [t, 0]));
    let pos = head + 8;
    for (const { t, s } of order) { offsets.get(t)[idx.get(t)] = pos; idx.set(t, idx.get(t) + 1); pos += s.size; }
    // samples were collected per track in file order, so each track's offsets are in its own sample order
    const moovBox = moovFor(offsets);
    const out = new Uint8Array(head + 8 + mdatBody);
    out.set(ftyp, 0); out.set(moovBox, ftyp.length);
    new DataView(out.buffer).setUint32(head, 8 + mdatBody); out.set([0x6d, 0x64, 0x61, 0x74], head + 4);
    let w = head + 8;
    for (const { s } of order) { out.set(b.subarray(s.off, s.off + s.size), w); w += s.size; }
    return { bytes: out, seconds: movieDur / MOVIE_TS, tracks: tracks.map(t => ({ handler: t.handler, samples: t.samples.length })) };
  }

  // Blob in → Blob out (the original when it can't be fixed)
  async function fixBlob(blob) {
    try {
      const r = fix(new Uint8Array(await blob.arrayBuffer()));
      return r ? new Blob([r.bytes], { type: 'video/mp4' }) : blob;
    } catch (err) { console.warn('[mp4fix]', err?.message); return blob; }
  }

  const api = { fix, fixBlob, boxes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MP4FIX = api;
})(typeof window !== 'undefined' ? window : null);
