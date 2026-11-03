/* ════════════════════════════════════════
   figureImport.js — Admin › Import › "📄 PDF मधून आकृती प्रश्न"
   A PDF / photo of figure questions is opened in the browser only (never
   uploaded or stored). Each question (question figure + 4 option boxes) is
   cut out; the answer is read from the option number printed in green, or
   suggested for mirror / water-image questions, or tapped by the admin.
   Only the cut pieces are uploaded; questions go to the question bank and,
   if asked, straight into Create Quiz.
   Global: FIGIMPORT
════════════════════════════════════════ */

const FIGIMPORT = (() => {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// ════════════════════════ importer ════════════════════════
const PW=1200;
let pdfReady=null;
function loadPdfJs(){
  if(pdfReady)return pdfReady;
  pdfReady=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload=()=>{pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';res();};s.onerror=rej;document.head.appendChild(s);});
  return pdfReady;
}
const median=a=>{const s=a.slice().sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
const bbox=L=>({x0:Math.min(...L.map(c=>c.x0)),y0:Math.min(...L.map(c=>c.y0)),x1:Math.max(...L.map(c=>c.x1)),y1:Math.max(...L.map(c=>c.y1))});
const inside=(c,f,m=0)=>c.x0>=f.x0-m&&c.y0>=f.y0-m&&c.x1<=f.x1+m&&c.y1<=f.y1+m;

function analyzePage(cv,txt){
  const W=cv.width,Hh=cv.height,N=W*Hh;
  const data=cv.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,Hh).data;
  const bin=new Uint8Array(N);for(let i=0,p=0;i<N;i++,p+=4)bin[i]=(data[p]+data[p+1]+data[p+2])<600?1:0;
  // connected components (8-neighbour)
  const lab=new Int32Array(N),st=new Int32Array(N),comps=[];
  for(let i=0;i<N;i++){
    if(!bin[i]||lab[i])continue;const id=comps.length+1;let sp=0;st[sp++]=i;lab[i]=id;let x0=W,y0=Hh,x1=0,y1=0,n=0;
    while(sp){const q=st[--sp],x=q%W,y=(q-x)/W;n++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
      for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=Hh)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;const r=yy*W+xx;if(bin[r]&&!lab[r]){lab[r]=id;st[sp++]=r;}}}}
    comps.push({id,x0,y0,x1,y1,n,w:x1-x0+1,h:y1-y0+1});
  }
  // a frame = component whose four sides are (almost) fully drawn
  const cov=(c,side)=>{let hit=0,tot=0;const t=4;
    if(side<2){const ys=side===0?c.y0:c.y1-t+1;for(let x=c.x0;x<=c.x1;x++){tot++;for(let y=ys;y<ys+t;y++)if(lab[y*W+x]===c.id){hit++;break;}}}
    else{const xs=side===2?c.x0:c.x1-t+1;for(let y=c.y0;y<=c.y1;y++){tot++;for(let x=xs;x<xs+t;x++)if(lab[y*W+x]===c.id){hit++;break;}}}
    return hit/tot;};
  let frames=comps.filter(c=>c.w>=0.06*W&&c.h>=0.05*W&&c.w<=0.48*W&&c.h<=0.4*Hh&&c.n/(c.w*c.h)<0.5&&[0,1,2,3].every(s=>cov(c,s)>=0.8));
  frames=frames.filter(f=>!frames.some(g=>g!==f&&inside(f,g)));
  const allFrames=frames.slice();
  // rows of frames
  frames.sort((a,b)=>(a.y0+a.y1)-(b.y0+b.y1));
  let rows=[];
  for(const f of frames){const cy=(f.y0+f.y1)/2;const r=rows.find(r=>Math.abs(r.cy-cy)<0.35*Math.min(r.h,f.h));if(r)r.f.push(f);else rows.push({cy,h:f.h,f:[f]});}
  for(const r of rows){r.f.sort((a,b)=>a.x0-b.x0);const mw=median(r.f.map(f=>f.w)),mh=median(r.f.map(f=>f.h));
    r.f=r.f.filter(f=>Math.abs(f.w-mw)<0.3*mw&&Math.abs(f.h-mh)<0.3*mh);Object.assign(r,bbox(r.f));r.bh=mh;r.bw=mw;}
  rows=rows.filter(r=>r.f.length).sort((a,b)=>a.y0-b.y0);
  const big=c=>(c.h>=0.045*W||(c.w>=0.045*W&&c.h>=0.04*W))&&c.w<0.6*W;
  const isQRow=r=>{const fs=r.f;let col=0;
    for(let i=0;i<fs.length-1;i++){const g0=fs[i].x1,g1=fs[i+1].x0;col+=comps.filter(c=>c.x0>g0&&c.x1<g1&&c.y0>r.y0&&c.y1<r.y1&&c.w<0.03*W&&c.h<0.03*W&&c.w>=3&&c.h>=3).length;}
    if(col>=4)return true;
    const last=fs[fs.length-1];const inn=comps.filter(c=>c.id!==last.id&&inside(c,last,-4)&&c.n>6);
    if(inn.length===0)return true;
    if(inn.length===1){const a=inn[0];   // "?" drawn as one piece: wide hook on top, thin neck, wider dot at the bottom
      if(a.h>0.35*(last.y1-last.y0)&&a.w<0.5*(last.x1-last.x0)){const wid=y=>{let l=-1,r=-1;for(let x=a.x0;x<=a.x1;x++)if(lab[y*W+x]===a.id){if(l<0)l=x;r=x;}return l<0?0:r-l+1;};
        let neck=1e9,dot=0,top=0;for(let y=a.y0;y<=a.y1;y++){const t=(y-a.y0)/a.h,w=wid(y);if(t<0.25)top=Math.max(top,w);else if(t>=0.6&&t<0.85)neck=Math.min(neck,w);else if(t>=0.85)dot=Math.max(dot,w);}
        if(top>0.7*a.w&&dot>1.3*neck)return true;}}
    if(inn.length===2){const [a,b]=inn.slice().sort((p,q)=>q.n-p.n);
      if(b.y0>a.y0+0.6*a.h&&Math.abs((b.x0+b.x1)/2-(a.x0+a.x1)/2)<a.w*0.6&&a.h>0.2*(last.y1-last.y0)&&b.w<a.w*0.7)return true;}
    return false;};
  // 32×32 darkness grid of a frame's inside, slightly blurred, for "which option is the mirror image"
  const G=28;
  const grid=f=>{ // content inside the frame (frame line itself left out), scaled into a square keeping its shape
    const fx0=f.x0+4,fy0=f.y0+4,fx1=f.x1-4,fy1=f.y1-4;let cx0=1e9,cy0=1e9,cx1=-1,cy1=-1;
    for(let y=fy0;y<=fy1;y++)for(let x=fx0;x<=fx1;x++){const i=y*W+x;if(bin[i]&&lab[i]!==f.id){if(x<cx0)cx0=x;if(x>cx1)cx1=x;if(y<cy0)cy0=y;if(y>cy1)cy1=y;}}
    const g=new Float32Array(G*G);if(cx1<0)return g;
    const side=Math.max(cx1-cx0,cy1-cy0)+1,ox=cx0-(side-(cx1-cx0+1))/2,oy=cy0-(side-(cy1-cy0+1))/2;
    for(let gy=0;gy<G;gy++)for(let gx=0;gx<G;gx++){let s=0,c=0;const xa=Math.floor(ox+gx*side/G),xb=Math.floor(ox+(gx+1)*side/G),ya=Math.floor(oy+gy*side/G),yb=Math.floor(oy+(gy+1)*side/G);
      for(let y=ya;y<=yb;y++)for(let x=xa;x<=xb;x++){if(x<fx0||x>fx1||y<fy0||y>fy1){c++;continue;}const i=y*W+x;s+=bin[i]&&lab[i]!==f.id?1:0;c++;}g[gy*G+gx]=c?s/c:0;}
    for(let p=0;p<3;p++){const o=new Float32Array(G*G);for(let y=0;y<G;y++)for(let x=0;x<G;x++){let s=0,c=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const yy=y+dy,xx=x+dx;if(yy>=0&&yy<G&&xx>=0&&xx<G){s+=g[yy*G+xx];c++;}}o[y*G+x]=s/c;}g.set(o);}
    let m=0;for(const v of g)m=Math.max(m,v);if(m>0)for(let i=0;i<g.length;i++)g[i]/=m;
    return g;};
  const flip=(g,d)=>{const o=new Float32Array(G*G);for(let y=0;y<G;y++)for(let x=0;x<G;x++)o[y*G+x]=d==='H'?g[y*G+(G-1-x)]:g[(G-1-y)*G+x];return o;};
  const dist=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=Math.abs(a[i]-b[i]);return s;};

  const qs=[];let bandTop=0;
  for(let ri=0;ri<rows.length;ri++){
    const r=rows[ri],c=r.f.length;
    if(c>=5){
      const qf=r.f[0],o1=r.f[1],op=r.f.slice(1,5);
      const gap=comps.filter(k=>k.x0>=qf.x1-2&&k.x1<=o1.x0+2&&k.y1>r.y0&&k.y0<r.y1);
      const below=comps.filter(k=>k.y0>=qf.y1-2&&k.y1<=qf.y1+0.45*(qf.y1-qf.y0)&&k.x0>=qf.x0-0.25*(qf.x1-qf.x0)&&k.x1<=qf.x1+0.25*(qf.x1-qf.x0));
      let dir=null,why='';
      const noMirror=/अपूर्ण|पूर्ण कर|complete/i.test(txt);
      if(noMirror){}
      else if(gap.some(k=>k.h>0.6*(qf.y1-qf.y0)&&k.w>=0.008*W)||gap.length>=6){dir='H';why='उजवीकडे आरसा';}
      else if(below.some(k=>k.w>0.6*(qf.x1-qf.x0))||below.length>=6){dir='V';why='खाली आरसा/पाणी';}
      else if(/water|पाण्या/i.test(txt)){dir='V';why='पाण्यातील प्रतिमा';}
      else if(/mirror|आरस/i.test(txt)){dir='H';why='आरसा';}
      let sug=null;
      if(dir){const qg=flip(grid(qf),dir);const ds=op.map(f=>dist(qg,grid(f)));const s=ds.map((d,i)=>[d,i]).sort((a,b)=>a[0]-b[0]);
        sug={i:s[0][1],conf:Math.max(0,1-s[0][0]/s[1][0]),why};}
      qs.push({kind:'प्रश्न + 4 पर्याय एका ओळीत',q:qf,opts:op,sug});bandTop=r.y1;continue;
    }
    if(c!==4)continue;
    const n=rows[ri+1];
    const leftLabel=row=>comps.some(k=>k.x1<row.x0-2&&k.x0>row.x0-0.12*W&&k.y0>=row.y0-6&&k.y1<=row.y1+6&&k.h<0.05*W&&k.w<0.08*W&&k.n>15);
    if(n&&n.f.length===4&&n.y0-r.y1<1.8*r.bh&&(isQRow(r)||(leftLabel(r)&&!leftLabel(n)))){qs.push({kind:'प्रश्न-ओळ + उत्तर-ओळ',q:bbox(r.f),opts:n.f});bandTop=n.y1;ri++;continue;}
    const top=Math.max(bandTop,r.y0-2.6*r.bh),lim=r.x1+0.02*W;
    const parts=comps.filter(k=>big(k)&&!r.f.some(f=>inside(k,f,2))&&k.x1<=lim&&k.x0>=0.02*W&&
      ((k.y0>=top&&k.y1<=r.y0+4)||(k.y0>=r.y0-6&&k.y1<=r.y1+6&&k.x1<r.f[0].x0)));
    let sug=null;const lf=allFrames.find(f=>f.x1<r.f[0].x0&&f.y1>r.y0&&f.y0<r.y1);
    const dir=/अपूर्ण|पूर्ण कर|complete/i.test(txt)?null:/water|पाण्या/i.test(txt)?'V':/mirror|आरस/i.test(txt)?'H':null;
    if(lf&&dir){const qg=flip(grid(lf),dir);const s=r.f.map((f,i)=>[dist(qg,grid(f)),i]).sort((a,b)=>a[0]-b[0]);sug={i:s[0][1],conf:Math.max(0,1-s[0][0]/s[1][0]),why:dir==='V'?'पाण्यातील प्रतिमा':'आरसा'};}
    qs.push({kind:parts.length?'वरची आकृती + 4 पर्याय':'फक्त 4 पर्याय (विसंगत प्रकार)',q:parts.length?bbox(parts):null,opts:r.f,sug});bandTop=r.y1;
  }
  // बरोबर पर्यायाचा क्रमांक हिरव्या रंगात रंगवला असेल तर तेच उत्तर
  const isG=p=>{const r=data[p],g=data[p+1],b=data[p+2];return g>100&&g>r+40&&g>b+40;};
  for(const q of qs){const sc=q.opts.map(f=>{const h=f.y1-f.y0;let c=0;for(let y=Math.max(0,f.y0-3);y<Math.min(Hh,f.y1+Math.round(0.5*h));y++)for(let x=Math.max(0,f.x0-3);x<Math.min(W,f.x1+3);x++)if(isG((y*W+x)*4))c++;return c;});
    const best=Math.max(...sc),i=sc.indexOf(best),second=Math.max(...sc.filter((_,k)=>k!==i));if(best>=12&&second<best*0.3)q.green=i;}
  // the same question printed twice (NMMS: Marathi page + English page) is kept once
  for(const q of qs){const sig=q.opts.map(grid);q.dup=SEEN.some(o=>{let d=0;for(let i=0;i<4;i++)d+=dist(o[i],sig[i]);return d/(4*G*G)<0.03;});if(!q.dup)SEEN.push(sig);}
  return qs.filter(q=>!q.dup);
}
let SEEN=[];
function crop(cv,b,pad=6,maxW=520){
  const x0=Math.max(0,b.x0-pad),y0=Math.max(0,b.y0-pad),x1=Math.min(cv.width,b.x1+pad+1),y1=Math.min(cv.height,b.y1+pad+1);
  const w=x1-x0,h=y1-y0,s=Math.min(1,maxW/w);const c=document.createElement('canvas');c.width=Math.round(w*s);c.height=Math.round(h*s);
  const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(cv,x0,y0,w,h,0,0,c.width,c.height);return c.toDataURL('image/png');
}

  // ════════════════════════ admin Import tab ════════════════════════
  const OPTL = ['A', 'B', 'C', 'D'];
  const GENERIC = 'प्रश्न आकृतीचे निरीक्षण करून योग्य उत्तर आकृती निवडा.';
  const KINDS = [['auto', 'Auto (PDF मधील शब्दांवरून)'], ['mirror', 'आरशातील प्रतिमा'], ['water', 'पाण्यातील प्रतिमा'], ['series', 'क्रमानुसार आकृती'], ['analogy', 'सहसंबंध'],
    ['odd', 'विसंगत आकृती'], ['complete', 'अपूर्ण आकृती'], ['fold', 'कागदाची घडी'], ['cut', 'घडी व कापणी'], ['transp', 'पारदर्शक कागद'], ['embed', 'लपलेली आकृती'],
    ['cube', 'घन / फासे'], ['textmirror', 'अक्षर-अंक प्रतिमा'], ['other', 'इतर']];
  const kindName = id => (KINDS.find(k => k[0] === id) || KINDS[KINDS.length - 1])[1];
  function guessKind(t) {
    t = String(t || '');
    if (/water|पाण्या/i.test(t)) return 'water';
    if (/mirror|आरस/i.test(t)) return 'mirror';
    if (/odd|विसंगत/i.test(t)) return 'odd';
    if (/transparent|पारदर्शक/i.test(t)) return 'transp';
    if (/cut|कापल|कापणी/i.test(t)) return 'cut';
    if (/fold|घडी/i.test(t)) return 'fold';
    if (/incomplete|अपूर्ण/i.test(t)) return 'complete';
    if (/relationship|सहसंबंध|संबंध/i.test(t)) return 'analogy';
    if (/embedded|hidden|लपलेली/i.test(t)) return 'embed';
    if (/cube|घन|फास/i.test(t)) return 'cube';
    if (/series|definite way|क्रम/i.test(t)) return 'series';
    return 'other';
  }
  const dirFor = id => (window.FIGGEN?.DIR?.[id]) || GENERIC;
  const S = { items: [], busy: false };
  let host = null;

  function _css() {
    if (document.getElementById('figimp-css')) return;
    const st = document.createElement('style'); st.id = 'figimp-css';
    st.textContent = `
.fi-row{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin:8px 0}
.fi-lab{font-size:.75rem;font-weight:700;color:var(--text2)}
.fi-sum{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;font-size:.82rem;font-weight:600}
.fi-sum span{border:1px solid var(--border);border-radius:8px;padding:3px 9px;background:var(--bg3)}
.fi-list{display:flex;flex-direction:column;gap:10px}
.fi-card{border:1px solid var(--border);border-radius:10px;padding:10px;background:var(--bg3)}
.fi-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px;font-size:.8rem}
.fi-sp{flex:1}
.fi-qimg{max-width:100%;max-height:220px;background:#fff;border:1px solid var(--border);border-radius:6px;display:block;margin-bottom:6px}
.fi-opts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;max-width:520px}
.fi-opt{border:2px solid var(--border);border-radius:8px;background:#fff;padding:4px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;font:inherit;color:#111}
.fi-opt img{width:100%;height:auto;display:block}
.fi-opt b{font-size:.8rem}
.fi-opt.ans{border-color:#15803d;background:#e3f5e8}
.fi-opt.sug{border-color:#2563eb;border-style:dashed}
.fi-badge{font-size:.72rem;font-weight:700;border-radius:6px;padding:1px 7px;background:#e3f5e8;color:#15803d}
.fi-badge.warn{background:#fdebe2;color:#c2410c}
.fi-save{border-top:1px solid var(--border);margin-top:12px;padding-top:10px}`;
    document.head.appendChild(st);
  }
  const summary = () => {
    const n = S.items.length, g = S.items.filter(x => x.how === 'green').length, s = S.items.filter(x => x.how === 'sug').length, miss = S.items.filter(x => x.ans == null).length;
    return `<span>❓ प्रश्न: ${n}</span><span>✅ हिरव्या खुणेवरून उत्तर: ${g}</span><span>🤖 सुचवलेलं: ${s}</span>${miss ? `<span style="color:#c2410c">⚠️ उत्तर बाकी: ${miss}</span>` : ''}`;
  };
  function cardHTML(it, i) {
    const badge = it.ans == null ? '<span class="fi-badge warn">उत्तर निवडा</span>'
      : it.how === 'green' ? `<span class="fi-badge">✅ उत्तर ${OPTL[it.ans]}: PDF मधील हिरव्या खुणेवरून</span>`
      : it.how === 'sug' ? `<span class="fi-badge">🤖 सुचवलेलं ${OPTL[it.ans]} (${it.conf}%) · बरोबर नसेल तर दुसरा tap करा</span>`
      : `<span class="fi-badge">उत्तर ${OPTL[it.ans]}</span>`;
    return `<div class="fi-card" data-i="${i}"><div class="fi-head"><b>प्रश्न ${i + 1}</b><span>${esc(it.src)} · पान ${it.page}</span>
      <select class="admin-select" data-fi-kind="${i}" aria-label="प्रकार">${KINDS.slice(1).map(([k, n]) => `<option value="${k}"${k === it.kind ? ' selected' : ''}>${n}</option>`).join('')}</select>
      ${badge}<span class="fi-sp"></span><button type="button" class="admin-btn-secondary" data-fi-del="${i}">✖ काढा</button></div>
      ${it.qImg ? `<img class="fi-qimg" alt="प्रश्न आकृती" src="${it.qImg}">` : '<p class="fi-lab">प्रश्न-आकृती नाही (विसंगत प्रकार)</p>'}
      <div class="fi-opts">${it.oImg.map((src, j) => `<button type="button" class="fi-opt${it.ans === j ? (it.how === 'sug' ? ' ans sug' : ' ans') : ''}" data-fi-opt="${i}:${j}"><img alt="पर्याय ${OPTL[j]}" src="${src}"><b>${OPTL[j]}</b></button>`).join('')}</div></div>`;
  }
  function render(msg = '') {
    if (!host) return;
    host.querySelector('#fi-sum').innerHTML = S.items.length ? summary() : '';
    host.querySelector('#fi-list').innerHTML = S.items.map(cardHTML).join('');
    host.querySelector('#fi-save').hidden = !S.items.length;
    if (msg) host.querySelector('#fi-prog').textContent = msg;
  }
  function addPage(cv, txt, src, page) {
    const fileKind = host.querySelector('#fi-kind').value;
    for (const q of analyzePage(cv, txt)) {
      const sugOk = q.sug && q.sug.conf > 0.1;
      const ans = q.green != null ? q.green : sugOk ? q.sug.i : null;
      S.items.push({
        src, page,
        kind: fileKind === 'auto' ? guessKind(txt) : fileKind,
        qImg: q.q ? crop(cv, q.q, 6, q.kind.startsWith('प्रश्न +') ? 300 : 700) : null,
        oImg: q.opts.map(f => crop(cv, f, 3, 260)),
        ans, how: q.green != null ? 'green' : sugOk ? 'sug' : null, conf: sugOk ? Math.round(q.sug.conf * 100) : 0,
      });
    }
  }
  async function readFiles(files) {
    S.items = []; SEEN = []; render('');
    const prog = host.querySelector('#fi-prog');
    prog.textContent = '⏳ उघडत आहे…';
    for (const f of files) {
      try {
        if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') {
          await loadPdfJs();
          const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
          const texts = [];
          for (let p = 1; p <= doc.numPages; p++) { try { texts.push((await (await doc.getPage(p)).getTextContent()).items.map(i => i.str).join(' ')); } catch { texts.push(''); } }
          for (let p = 1; p <= doc.numPages; p++) {
            prog.textContent = `⏳ ${f.name}: पान ${p} / ${doc.numPages}`;
            const page = await doc.getPage(p); const vp = page.getViewport({ scale: PW / page.getViewport({ scale: 1 }).width });
            const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
            const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
            addPage(cv, texts[p - 1] + ' ' + (texts[p] || '') + ' ' + f.name, f.name, p);
            await new Promise(r => setTimeout(r, 0));
          }
          doc.destroy?.();
        } else {
          prog.textContent = `⏳ ${f.name}`;
          const url = URL.createObjectURL(f); const img = new Image(); img.src = url; await img.decode();
          const cv = document.createElement('canvas'); cv.width = PW; cv.height = Math.round(img.naturalHeight * PW / img.naturalWidth);
          const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0, cv.width, cv.height);
          URL.revokeObjectURL(url);
          addPage(cv, f.name, f.name, 1);
        }
      } catch (err) { APP.toast(`${f.name}: उघडता आली नाही (${err?.message || err})`, 'error'); }
    }
    render(S.items.length ? '✅ झालं. उत्तरं तपासा; नको ते "✖ काढा". मूळ file कुठेही save झाली नाही.' : 'या file मध्ये चौकटीतले आकृती-प्रश्न सापडले नाहीत.');
  }
  async function fillSelect(sel, values, ph) { sel.innerHTML = `<option value="">${ph}</option>` + values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join(''); }
  async function refreshTopic() {
    const b = host.querySelector('#fi-batch').value, s = host.querySelector('#fi-subject');
    const subs = b ? (await DB.getSubjectsByBatch(b)).map(x => x.name) : [];
    const keepS = s.value; await fillSelect(s, subs, 'Select Subject'); if (subs.includes(keepS)) s.value = keepS;
    const c = host.querySelector('#fi-chapter');
    const chs = b && s.value ? (await DB.getChaptersByBatchSubject(b, s.value)).map(x => x.name) : [];
    const keepC = c.value; await fillSelect(c, chs, 'Select Chapter'); if (chs.includes(keepC)) c.value = keepC;
  }
  async function save(openQuiz) {
    if (S.busy) return;
    const miss = S.items.findIndex(x => x.ans == null);
    if (miss >= 0) { APP.toast(`प्रश्न ${miss + 1} चं उत्तर निवडा`, 'error'); host.querySelector(`.fi-card[data-i="${miss}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const batch = host.querySelector('#fi-batch').value, subject = host.querySelector('#fi-subject').value, chapter = host.querySelector('#fi-chapter').value;
    if (!batch || !subject || !chapter) { APP.toast('Class, Subject आणि Chapter निवडा', 'error'); return; }
    S.busy = true; host.querySelectorAll('#fi-save button').forEach(b => { b.disabled = true; });
    const prog = host.querySelector('#fi-prog');
    try {
      const map = await FIGGEN.uploadAll(S.items.flatMap(x => [x.qImg, ...x.oImg]), (a, b) => { prog.textContent = `⏳ चित्रं upload होत आहेत… ${a}/${b}`; });
      const diff = host.querySelector('#fi-diff').value;
      const records = S.items.map(x => ({
        question: dirFor(x.kind), image: x.qImg ? map.get(x.qImg) : null, type: 'mcq', difficulty: diff,
        batch, subject, chapter, tags: ['reasoning', 'pdf', x.kind],
        options: { A: '', B: '', C: '', D: '' },
        option_images: { A: map.get(x.oImg[0]), B: map.get(x.oImg[1]), C: map.get(x.oImg[2]), D: map.get(x.oImg[3]) },
        answer: OPTL[x.ans], explanation: `उत्तर: ${OPTL[x.ans]}`,
      }));
      prog.textContent = '⏳ प्रश्न save होत आहेत…';
      let saved = await DB.saveQuestionsBatch(records);
      try {
        for (let i = 0; i < saved.length; i += 50) await API.bulkSaveQuestions(saved.slice(i, i + 50));
        saved = await DB.saveQuestionsBatch(saved.map(q => ({ ...q, bank_synced: true })));
      } catch (err) { APP.toast(`प्रश्न-बँकेत (server) आत्ता save झाले नाहीत; quiz Publish करताना होतील. (${err?.message || 'offline'})`, 'info'); }
      const n = saved.length;
      S.items = []; render(`✅ ${n} प्रश्न प्रश्न-बँकेत ${batch} › ${subject} › ${chapter} मध्ये save झाले.`);
      APP.toast(`✅ ${n} आकृती प्रश्न save झाले`, 'success');
      if (openQuiz && window.TEST_BUILDER) TEST_BUILDER.open(null, { batch, subject, chapter, q_ids: saved.map(q => q.q_id) });
    } catch (err) {
      APP.toast(`Save झाले नाहीत: ${err?.message || err}`, 'error'); prog.textContent = '⚠️ Save झाले नाहीत. Internet तपासून पुन्हा करा.';
    } finally { S.busy = false; host.querySelectorAll('#fi-save button').forEach(b => { b.disabled = false; }); }
  }
  async function mount(el) {
    if (!el || el.dataset.mounted) return;
    el.dataset.mounted = '1'; host = el; _css();
    el.innerHTML = `<h3 class="admin-section-title">📄 PDF मधून आकृती प्रश्न</h3>
      <p class="import-hint">PDF बनवताना प्रत्येक प्रश्नाच्या <b>बरोबर पर्यायाचा क्रमांक हिरव्या रंगात</b> ठेवा, म्हणजे upload होताच उत्तर आपोआप घेतलं जातं. हिरवी खूण नसेल तर आरसा/पाणी प्रकारात 🤖 सुचवलं जातं, नाहीतर पर्याय tap करा.<br>🔒 मूळ PDF/चित्र कुठेही save होत नाही; save होतात ती फक्त कापलेली प्रश्न-चित्रं.</p>
      <div class="fi-row">
        <label class="fi-lab">PDF / PNG / JPG<br><input type="file" id="fi-file" accept=".pdf,image/*" multiple></label>
        <label class="fi-lab">प्रश्नांचा प्रकार (सूचना-वाक्यासाठी)<br><select class="admin-select" id="fi-kind">${KINDS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
      </div>
      <p class="fi-lab" id="fi-prog" aria-live="polite"></p>
      <div class="fi-sum" id="fi-sum"></div>
      <div class="fi-list" id="fi-list"></div>
      <div class="fi-save" id="fi-save" hidden>
        <p class="fi-lab">हे प्रश्न कुठे ठेवायचे?</p>
        <div class="fi-row">
          <select class="admin-select" id="fi-batch" aria-label="Class"><option value="">Select Class</option></select>
          <select class="admin-select" id="fi-subject" aria-label="Subject"><option value="">Select Subject</option></select>
          <select class="admin-select" id="fi-chapter" aria-label="Chapter"><option value="">Select Chapter</option></select>
          <select class="admin-select" id="fi-diff" aria-label="Level"><option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="hard">Hard</option></select>
        </div>
        <div class="fi-row">
          <button type="button" class="admin-btn-primary" id="fi-quiz">➕ Create Quiz मध्ये पाठवा</button>
          <button type="button" class="admin-btn-secondary" id="fi-bank">💾 फक्त प्रश्न-बँकेत save करा</button>
        </div>
        <p class="import-hint">प्रश्न-बँकेतले प्रश्न Create Quiz, Paper Builder आणि महा-Test मध्ये आधीच्या प्रश्नांसारखेच वापरता येतात.</p>
      </div>`;
    const batches = await DB.getAllBatches();
    el.querySelector('#fi-batch').innerHTML = '<option value="">Select Class</option>' + batches.map(b => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('');
    el.querySelector('#fi-file').addEventListener('change', e => { const files = [...e.target.files]; e.target.value = ''; if (files.length) readFiles(files); });
    el.querySelector('#fi-batch').addEventListener('change', refreshTopic);
    el.querySelector('#fi-subject').addEventListener('change', refreshTopic);
    el.querySelector('#fi-quiz').addEventListener('click', () => save(true));
    el.querySelector('#fi-bank').addEventListener('click', () => save(false));
    el.addEventListener('click', e => {
      const o = e.target.closest('[data-fi-opt]');
      if (o) { const [i, j] = o.dataset.fiOpt.split(':').map(Number); S.items[i].ans = j; S.items[i].how = 'pick'; render(); return; }
      const d = e.target.closest('[data-fi-del]');
      if (d) { S.items.splice(+d.dataset.fiDel, 1); render(); }
    });
    el.addEventListener('change', e => { const k = e.target.closest('[data-fi-kind]'); if (k) S.items[+k.dataset.fiKind].kind = k.value; });
  }
  // filled the first time the Import tab is opened (the local DB is ready by then)
  document.addEventListener('click', e => {
    if (e.target.closest('[data-tab="import"]')) setTimeout(() => mount(document.getElementById('fig-import-host')).catch(() => {}), 0);
  });
  return { mount, guessKind, _analyze: (cv, t) => analyzePage(cv, t) };
})();

window.FIGIMPORT = FIGIMPORT;
