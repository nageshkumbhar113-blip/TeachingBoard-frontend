/* ════════════════════════════════════════
   figureGen.js — Reasoning (आकृती) questions for Admin › Create Quiz
   NMMS-style figure questions made in the browser: 17 types, 3 levels,
   each with "उत्तर कसं आलं", why every other option is wrong, and a युक्ती.
   Figures are drawn as SVG, turned into small PNGs and uploaded once; the
   question then lives in the normal question bank like any other question.
   Global: FIGGEN
════════════════════════════════════════ */

const FIGGEN = (() => {
// ════════════════════════ helpers ════════════════════════
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const md=(a,m)=>((a%m)+m)%m;
const f2=v=>Math.round(v*100)/100;
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// ════════════════════════ symbols ════════════════════════
const INK='#111';
const ST=(w=2)=>`stroke="${INK}" stroke-width="${w}" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"`;
const FA=f=>f?`fill="${INK}"`:'fill="#fff"';
const NF='fill="none"';
const poly=(n,r,start=-90)=>Array.from({length:n},(_,i)=>{const t=(start+360/n*i)*Math.PI/180;return `${f2(r*Math.cos(t))},${f2(r*Math.sin(t))}`;}).join(' ');
const STAR=Array.from({length:10},(_,i)=>{const t=(-90+36*i)*Math.PI/180,r=i%2?4.2:10.5;return `${f2(r*Math.cos(t))},${f2(r*Math.sin(t))}`;}).join(' ');
const md0=(a,m)=>((a%m)+m)%m;
// g = the moves (turn a°, then flip s) that leave a drawing looking the same. Two options that look
// alike are never both shown, so when unsure a symbol is given MORE symmetry here, never less.
const D=(n,mir)=>{const g=[];for(let k=0;k<n;k++){const a=Math.round(k*360/n);g.push([a,1]);if(mir==='v')g.push([a,-1]);if(mir==='h')g.push([md0(180+a,360),-1]);}return g;};
const DIAG=[[0,1],[90,-1]];
const pg=(pts,f)=>`<polygon points="${pts}" ${FA(f)} ${ST()}/>`;
const SYM={
  arrow:{g:D(1,'v'),fl:1,nm:'बाण',d:f=>`<path d="M0,-11 L8,-2 L2.5,-2 L2.5,11 L-2.5,11 L-2.5,-2 L-8,-2 Z" ${FA(f)} ${ST()}/>`},
  flag:{g:D(1),fl:1,nm:'झेंडा',d:f=>`<path d="M-6,11 L-6,-11" ${NF} ${ST()}/><path d="M-6,-11 L8,-6 L-6,-1 Z" ${FA(f)} ${ST()}/>`},
  L:{g:D(1),fl:0,nm:'L आकार',d:()=>`<path d="M-5,-11 L-5,10 L7,10" ${NF} ${ST(3)}/>`},
  tri:{g:D(3,'v'),fl:1,nm:'त्रिकोण',d:f=>pg(poly(3,10.5),f)},
  tdot:{g:D(1),fl:0,nm:'ठिपक्याचा त्रिकोण',d:()=>`${pg(poly(3,10.5),false)}<circle cx="-4.2" cy="2.4" r="2.3" fill="${INK}"/>`},
  halfc:{g:D(1,'h'),fl:0,nm:'अर्धे भरलेले वर्तुळ',d:()=>`<circle r="9" fill="#fff" ${ST()}/><path d="M0,-9 A9,9 0 0,0 0,9 Z" fill="${INK}"/>`},
  moon:{g:D(1,'h'),fl:0,nm:'चंद्रकोर',d:()=>`<path d="M5,-7.48 A9,9 0 1,0 5,7.48 A7.5,7.5 0 1,1 5,-7.48 Z" fill="${INK}"/>`},
  star:{g:D(5,'v'),fl:1,nm:'तारा',d:f=>pg(STAR,f)},
  circ:{g:'any',fl:1,nm:'वर्तुळ',d:f=>`<circle r="8" ${FA(f)} ${ST()}/>`},
  sq:{g:D(4,'v'),fl:1,nm:'चौरस',d:f=>`<rect x="-7.5" y="-7.5" width="15" height="15" ${FA(f)} ${ST()}/>`},
  heart:{g:D(1,'v'),fl:1,nm:'बदाम',d:f=>`<path d="M0,9 C-13,0 -9,-12 0,-4 C9,-12 13,0 0,9 Z" ${FA(f)} ${ST()}/>`},
  pent:{g:D(5,'v'),fl:1,nm:'पंचकोन',d:f=>pg(poly(5,9.5),f)},
  hex:{g:D(6,'v'),fl:1,nm:'षटकोन',d:f=>pg(poly(6,9,0),f)},
  oct:{g:D(8,'v'),fl:1,nm:'अष्टकोन',d:f=>pg(poly(8,9.5,22.5),f)},
  plus:{g:D(4,'v'),fl:1,nm:'अधिक चिन्ह (+)',d:f=>`<path d="M-3,-10 h6 v7 h7 v6 h-7 v7 h-6 v-7 h-7 v-6 h7 Z" ${FA(f)} ${ST()}/>`},
  dot:{g:'any',fl:0,nm:'ठिपका',d:()=>`<circle r="4" fill="${INK}"/>`},
  ell:{g:D(2,'v'),fl:1,nm:'लंबवर्तुळ',d:f=>`<ellipse rx="9.5" ry="5.5" ${FA(f)} ${ST()}/>`},
  S:{g:D(2),fl:0,nm:'"S" आकार',d:()=>`<path d="M7,-8 C2,-12 -7,-10 -6,-4 C-5,1 5,-1 6,4 C7,10 -2,12 -7,8" ${NF} ${ST()}/>`},
  rect:{g:D(2,'v'),fl:1,nm:'आयत',d:f=>`<rect x="-10" y="-5.5" width="20" height="11" ${FA(f)} ${ST()}/>`},
  rhom:{g:D(2,'v'),fl:1,nm:'समभुज चौकोन',d:f=>pg('0,-11 7,0 0,11 -7,0',f)},
  para:{g:D(2),fl:1,nm:'समांतरभुज चौकोन',d:f=>pg('-10,6 4,6 10,-6 -4,-6',f)},
  trap:{g:D(1,'v'),fl:1,nm:'समलंब चौकोन',d:f=>pg('-10,7 10,7 5,-7 -5,-7',f)},
  kite:{g:D(1,'v'),fl:1,nm:'पतंग आकार',d:f=>pg('0,-11 7,-3 0,11 -7,-3',f)},
  rtri:{g:DIAG,fl:1,nm:'काटकोन त्रिकोण',d:f=>pg('-9,9 9,9 -9,-9',f)},
  sector:{g:DIAG,fl:1,nm:'वर्तुळपाद',d:f=>`<path d="M-8,8 L-8,-8 A16,16 0 0,1 8,8 Z" ${FA(f)} ${ST()}/>`},
  semi:{g:D(1,'v'),fl:1,nm:'अर्धवर्तुळ',d:f=>`<path d="M-10,4 A10,10 0 0,1 10,4 Z" ${FA(f)} ${ST()}/>`},
  cyl:{g:D(1,'v'),fl:0,nm:'वृत्तचिती',d:()=>`<path d="M-8,-7 L-8,7 A8,3 0 0,0 8,7 L8,-7" fill="#fff" ${ST()}/><ellipse cy="-7" rx="8" ry="3" fill="#fff" ${ST()}/>`},
  cube:{g:D(3,'v'),fl:0,nm:'घन',d:()=>`${pg(poly(6,10.5),false)}<path d="M0,0 L0,10.5 M0,0 L-9.09,-5.25 M0,0 L9.09,-5.25" ${NF} ${ST()}/>`},
  cone:{g:D(1,'v'),fl:0,nm:'शंकू',d:()=>`<path d="M-8,6 L0,-11 L8,6" fill="#fff" ${ST()}/><ellipse cy="6" rx="8" ry="3" fill="#fff" ${ST()}/>`},
  sphere:{g:D(2,'v'),fl:0,nm:'गोल',d:()=>`<circle r="9.5" fill="#fff" ${ST()}/><ellipse rx="9.5" ry="3.2" ${NF} ${ST()}/>`},
  cross:{g:D(4,'v'),fl:0,nm:'गुणाकार चिन्ह (×)',d:()=>`<path d="M-7,-7 L7,7 M7,-7 L-7,7" ${NF} ${ST(3)}/>`},
  minus:{g:D(2,'v'),fl:0,nm:'वजाबाकी चिन्ह (−)',d:()=>`<path d="M-9,0 L9,0" ${NF} ${ST(3)}/>`},
  eq:{g:D(2,'v'),fl:0,nm:'बरोबर चिन्ह (=)',d:()=>`<path d="M-9,-4 L9,-4 M-9,4 L9,4" ${NF} ${ST(3)}/>`},
  div:{g:D(2,'v'),fl:0,nm:'भागाकार चिन्ह (÷)',d:()=>`<path d="M-9,0 L9,0" ${NF} ${ST(3)}/><circle cy="-6.5" r="2.2" fill="${INK}"/><circle cy="6.5" r="2.2" fill="${INK}"/>`},
  pct:{g:D(2),fl:0,nm:'टक्का चिन्ह (%)',d:()=>`<path d="M7,-10 L-7,10" ${NF} ${ST(2.5)}/><circle cx="-5" cy="-6" r="2.8" fill="#fff" ${ST()}/><circle cx="5" cy="6" r="2.8" fill="#fff" ${ST()}/>`},
  lt:{g:D(1,'h'),fl:0,nm:'लहान चिन्ह (<)',d:()=>`<path d="M8,-8 L-8,0 L8,8" ${NF} ${ST(3)}/>`},
  sqrt:{g:D(1),fl:0,nm:'वर्गमूळ चिन्ह (√)',d:()=>`<path d="M-11,2 L-7,0 L-2,10 L4,-10 L11,-10" ${NF} ${ST(2.5)}/>`},
  pi:{g:D(1,'v'),fl:0,nm:'π चिन्ह',d:()=>`<path d="M-9,-7 L9,-7 M-4,-7 L-4,9 M4,-7 L4,9" ${NF} ${ST(2.6)}/>`},
  inf:{g:D(2,'v'),fl:0,nm:'अनंत चिन्ह (∞)',d:()=>`<ellipse cx="-5" rx="5" ry="4" ${NF} ${ST(2.4)}/><ellipse cx="5" rx="5" ry="4" ${NF} ${ST(2.4)}/>`},
  neq:{g:D(2),fl:0,nm:'≠ चिन्ह',d:()=>`<path d="M-9,-4 L9,-4 M-9,4 L9,4 M5,-10 L-5,10" ${NF} ${ST(2.6)}/>`},
  pm:{g:D(1,'v'),fl:0,nm:'± चिन्ह',d:()=>`<path d="M-7,-3 L7,-3 M0,-10 L0,4 M-7,8 L7,8" ${NF} ${ST(2.6)}/>`},
  sigma:{g:D(1,'h'),fl:0,nm:'Σ चिन्ह',d:()=>`<path d="M8,-10 L-8,-10 L2,0 L-8,10 L8,10" ${NF} ${ST(2.6)}/>`},
};
const TXT=(ch,g)=>({g,fl:0,nm:`"${ch}"`,d:()=>`<text x="0" y="1" font-size="25" font-weight="700" font-family="Arial,Helvetica,sans-serif" text-anchor="middle" dominant-baseline="central" fill="${INK}">${ch}</text>`});
for(const ch of ['F','G','J','R','P','Q','2','4','5','7','9'])SYM[ch]=TXT(ch,D(1));
SYM.K=TXT('K',D(1,'h'));SYM.N=TXT('N',D(2));SYM.Z=TXT('Z',D(2));
const ASYM=['flag','L','tdot','halfc','moon','arrow','F','G','J','R','P','Q','2','4','5','7','9','K','para','rtri','sector','pct','lt','sqrt','neq','sigma','S'];
const SHAPES=['star','tri','heart','sq','circ','pent','plus','hex','oct','rect','rhom','trap','kite','semi','ell','cyl','cube','cone','sphere','cross','eq','div','pi','inf','pm'];
const symName=e=>(SYM[e.s].fl?(e.fill?'काळा ':'पोकळ '):'')+SYM[e.s].nm;

// ════════════════════════ figures & transforms ════════════════════════
// A figure is a list of elements in a W×W box: symbols {k:'sym',s,x,y,r,f,z,fill} or segments {k:'seg',x1,y1,x2,y2}.
const tH=(e,W=100)=>e.k==='seg'?{...e,x1:W-e.x1,x2:W-e.x2}:{...e,x:W-e.x,r:-e.r,f:-e.f};
const tV=(e,W=100)=>e.k==='seg'?{...e,y1:W-e.y1,y2:W-e.y2}:{...e,y:W-e.y,r:180-e.r,f:-e.f};
const rp=(x,y,a,c)=>{const t=a*Math.PI/180,dx=x-c,dy=y-c;return [c+dx*Math.cos(t)-dy*Math.sin(t),c+dx*Math.sin(t)+dy*Math.cos(t)];};
const tR=(e,a,W=100)=>{const c=W/2;if(e.k==='seg'){const [x1,y1]=rp(e.x1,e.y1,a,c),[x2,y2]=rp(e.x2,e.y2,a,c);return {...e,x1,y1,x2,y2};}const [x,y]=rp(e.x,e.y,a,c);return {...e,x,y,r:e.r+a};};
const H=(F,W)=>F.map(e=>tH(e,W)), V=(F,W)=>F.map(e=>tV(e,W)), R=(F,a,W)=>F.map(e=>tR(e,a,W));
const FILL=F=>F.map(e=>e.k==='sym'&&SYM[e.s].fl?{...e,fill:!e.fill}:e);
function kEl(e){
  if(e.k==='seg'){const p=[[Math.round(e.x1),Math.round(e.y1)],[Math.round(e.x2),Math.round(e.y2)]].map(String).sort();return 'g'+p.join('-');}
  const S=SYM[e.s],z=Math.round((e.z||1)*10),X=Math.round(e.x),Y=Math.round(e.y);
  if(S.g==='any')return [e.s,X,Y,'o',e.fill?1:0,z].join(',');
  let best=null;for(const [a,s] of S.g){const k=md(Math.round(e.r+e.f*a),360)+':'+(e.f*s);if(best===null||k<best)best=k;}
  return [e.s,X,Y,best,e.fill?1:0,z].join(',');
}
const fKey=F=>F.map(kEl).sort().join(';');
function rEl(e){
  if(e.k==='seg')return `<line x1="${f2(e.x1)}" y1="${f2(e.y1)}" x2="${f2(e.x2)}" y2="${f2(e.y2)}" ${ST(2)}/>`;
  return `<g transform="translate(${f2(e.x)} ${f2(e.y)}) rotate(${f2(e.r)}) scale(${f2(e.f*e.z)} ${f2(e.z)})">${SYM[e.s].d(e.fill)}</g>`;
}
const svg=(F,vb='0 0 100 100',extra='')=>`<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${extra}${F.map(rEl).join('')}</svg>`;
const tile=(F,vb,extra)=>`<div class="tile">${svg(F,vb,extra)}</div>`;
const QM='<div class="tile qm">?</div>';
const mkEl=(pool,x,y,o={})=>{const s=pick(pool),S=SYM[s];return {k:'sym',s,x,y,r:pick(o.rots||[0]),f:1,z:o.z??(0.95+Math.random()*0.2),fill:S.fl?Math.random()<0.5:false};};
function randFig(k,pool,o={}){
  const g=o.grid||[22,50,78];const all=[];for(const y of g)for(const x of g)if(!(o.noC&&x===50&&y===50))all.push([x,y]);
  const used=new Set();const out=[];
  for(const [x,y] of shuffle(all).slice(0,k)){let e;let t=0;do{e=mkEl(pool,x,y,o);t++;}while(used.has(e.s)&&t<20);used.add(e.s);out.push(e);}
  return out;
}
// ════════════════════════ generators ════════════════════════
const ROTS=[0,90,180,270];
// NMMS प्रश्नपत्रिकेतील सूचना (Marathi booklet wording)
const DIR={
  series:'खालील प्रत्येक प्रश्नात प्रश्न आकृत्या विशिष्ट क्रमाने बदलतात. त्याच क्रमाने प्रश्नचिन्हाच्या जागी दिलेल्या पर्यायांपैकी कोणती आकृती येईल ते ठरवा.',
  odd:'विसंगत आकृती ओळखा.',
  analogy:'पुढील प्रश्नात पहिल्या आकृतीचा दुसऱ्या आकृतीशी जसा संबंध आहे तसाच संबंध तिसऱ्या व चौथ्या आकृतीमध्ये आहे. तो संबंध शोधून प्रश्नचिन्हाच्या जागी योग्य पर्याय निवडा.',
  mirror:'आरसा प्रश्न आकृतीच्या उजव्या बाजूला उभा धरला आहे. प्रश्न आकृतीची योग्य आरशातील प्रतिमा दिलेल्या पर्यायांतून निवडा.',
  water:'प्रश्न आकृतीची योग्य पाण्यातील प्रतिमा दिलेल्या पर्यायांतून निवडा.',
  complete:'अपूर्ण आकृती पूर्ण होण्यासाठी योग्य पर्याय निवडा.',
  fold:'एका चौरसाकृती कागदाला बाणाच्या दिशेने घड्या घालून शेवटच्या आकृतीत दाखवल्याप्रमाणे छिद्रे पाडली आहेत. कागद पूर्ण उलगडल्यावर कसा दिसेल ते उत्तर आकृतींतून शोधा.',
  venn:'खालील वेन आकृतीचे निरीक्षण करून विचारलेल्या प्रश्नाचे योग्य उत्तर निवडा.',
  manora:'खालील संख्यांच्या मनोऱ्याचे निरीक्षण करून विचारलेल्या प्रश्नाचे उत्तर निवडा.',
};
// प्रत्येक प्रकारासाठी झटपट युक्ती
const TRICK={
  mirror:'उभ्या आरशात वर-खाली कधीच बदलत नाही. म्हणून आधी फक्त एवढं तपासा: जे चिन्ह वर आहे ते पर्यायातही वरच आहे का? ज्या पर्यायांत ते खाली गेलं ते लगेच बाद. मग उरलेल्यांत डावी-उजवी बाजू आणि अक्षरं/चिन्हं उलटी झाली का ते पाहा.',
  water:'पाण्यातील प्रतिमेत डावी-उजवी कधीच बदलत नाही. डावीकडचं चिन्ह पर्यायातही डावीकडेच आहे का ते आधी तपासा; नसेल तर तो पर्याय बाद. मग वर-खाली उलटलं का ते पाहा.',
  odd:'चिन्हं घड्याळाच्या दिशेने एकामागून एक वाचा. आकृती कितीही फिरवली तरी हा क्रम बदलत नाही; आरशासारखी उलटी केली की क्रम उलटा होतो. ज्या आकृतीचा क्रम बाकीच्यांपेक्षा वेगळा, ती विसंगत.',
  series:'सगळी आकृती एकदम पाहू नका. एका वेळी एकच चिन्ह घ्या आणि 1 → 2 → 3 मध्ये ते किती जागा किंवा किती अंश सरकतं ते मोजा. तोच नियम पुढच्या एका पायरीला लावा.',
  analogy:'पहिल्या जोडीतला बदल एका शब्दात सांगा: फिरवली? उलटली? संख्या वाढली? भरली? तोच एक बदल तिसऱ्या आकृतीला लावा. पर्यायांत "तिसरी आकृतीच" आणि "दुसरा बदल केलेली" आकृती हमखास असते, ती टाळा.',
  complete:'रेषा सलग असायला हव्यात. गायब भागाच्या कडेला शेजारच्या भागातील रेषा जिथे येऊन थांबतात, तिथूनच पर्यायातल्या रेषा सुरू व्हायला हव्यात. जुळत नसलेले पर्याय लगेच बाद करा.',
  fold:'आधी छिद्रं मोजा: 1 घडी = प्रत्येक छिद्र 2 वेळा, 2 घड्या = 4 वेळा. संख्या चुकलेले पर्याय लगेच बाद. मग घडीची रेषा आरसा मानून जागा आणि आकार तपासा. घड्या उलट्या क्रमाने उघडा: शेवटची घडी आधी.',
  venn:'"फक्त" = त्या एकाच आकृतीचा स्वतःचा भाग. "दोन्ही" = सामाईक भाग (तिसरा घ्यायचा की नाही ते प्रश्नात वाचा). "किमान दोन" = दोन-दोनचे सामाईक भाग + मधला भाग. आधी शब्द ओळखा, मग फक्त तेच भाग बेरीज करा.',
  manora:'n वी ओळ (1 + 2 + … + (n−1)) + 1 ने सुरू होते. एखाद्या संख्येच्या लगेच खाली डावीकडे = ती संख्या + तिच्या ओळीचा क्रमांक; खाली उजवीकडे = संख्या + ओळ क्रमांक + 1. (संख्या 2-2 ने वाढत असतील तर ओळ क्रमांक × 2.)',
};
const ROWN=['वर','मध्य','खाली'],COLN=['डावीकडे','मध्ये','उजवीकडे'];
const POSN=(x,y)=>{const r=y<36?0:y>64?2:1,c=x<36?0:x>64?2:1;if(r===1&&c===1)return 'मध्यभागी';if(r===1)return `${COLN[c]} मध्यभागी`;if(c===1)return `${ROWN[r]} मध्यभागी`;return `${ROWN[r]}-${COLN[c]}`;};
const EDGE=[[4,4],[96,4],[96,96],[4,96],[50,4],[96,50],[50,96],[4,50]];
function randSeg(){let a,b;do{a=pick(EDGE);b=pick(EDGE);}while(a===b||a[0]===b[0]&&(a[0]===4||a[0]===96)||a[1]===b[1]&&(a[1]===4||a[1]===96));return {k:'seg',x1:a[0],y1:a[1],x2:b[0],y2:b[1]};}
// correct first, then distinct distractors with the reason each one is wrong
function distinct(correct,cands){
  const seen=new Set([fKey(correct)]),figs=[correct],why=[null];
  for(const [c,r] of cands){if(figs.length===4)break;if(!c)continue;const k=fKey(c);if(!seen.has(k)){seen.add(k);figs.push(c);why.push(r);}}
  return figs.length===4?{figs,why}:null;
}
function numOpts(ans,cands){ // [value, reason] for number answers
  const seen=new Set([ans]),figs=[ans],why=[null];
  for(const [v,r] of cands){if(figs.length===4)break;if(v>0&&!seen.has(v)){seen.add(v);figs.push(v);why.push(r);}}
  return figs.length===4?{figs,why}:null;
}
function finish(o){ // o.figs[0] is the correct one
  const order=shuffle([0,1,2,3]);const render=o.render||(F=>tile(F));
  return {...o,opts:order.map(i=>render(o.figs[i])),raw:order.map(i=>o.figs[i]),why:order.map(i=>o.why[i]),note:o.note?order.map(i=>o.note[i]):null,ans:order.indexOf(0)};
}
const posOK=F=>new Set(F.filter(e=>e.k==='sym').map(e=>Math.round(e.x)+','+Math.round(e.y))).size===F.filter(e=>e.k==='sym').length;
const symIdx=F=>{const i=F.findIndex(e=>e.k==='sym'&&ASYM.includes(e.s));return i<0?F.findIndex(e=>e.k==='sym'):i;};

function gMirror(l,water){
  const pool=l===0?ASYM.concat(['star','tri','heart']):ASYM;
  const F=randFig([2,3,4][l],pool,{rots:l===2?[0,45,90,135,180,270]:ROTS});
  if(l>0&&Math.random()<0.5)F.push(randSeg());
  const A=water?V(F):H(F);
  const i=symIdx(F);const nm=symName(F[i]);
  const part=A.slice();part[i]={...A[i],r:F[i].r,f:F[i].f};
  const res=distinct(A,shuffle([
    [water?H(F):V(F),water?'ही आरशातील प्रतिमा आहे: डावी-उजवी बाजू उलटली. पाण्यात वर-खाली उलटायला हवं.':'ही पाण्यातील प्रतिमा आहे: वर-खाली उलटली. उभ्या आरशात वर-खाली बदलत नाही.'],
    [R(F,180),'ही आकृती फक्त 180° फिरवली आहे. प्रतिमेत आकृती फिरत नाही, उलटते.'],
    [F,'ही मूळ प्रश्न आकृतीच आहे, काहीच उलटलं नाही.'],
    [part,`चिन्हांच्या जागा बरोबर, पण ${nm} स्वतः उलटला नाही.`],
    [R(F,90),'ही आकृती 90° फिरवली आहे.']]));
  if(!res)return null;
  return finish({tid:water?'water':'mirror',lay:'row',q:tile(F),...res,
    steps:[water?'पाणी आकृतीच्या खाली आहे: जे वर आहे ते खाली जातं आणि जे खाली आहे ते वर. डावं-उजवं तसंच राहतं.':'आरसा उजवीकडे आहे: जे डावीकडे आहे ते उजवीकडे जातं आणि उजवीकडचं डावीकडे. वर-खाली तसंच राहतं.',
      `उदा. ${nm}: प्रश्न आकृतीत ${POSN(F[i].x,F[i].y)} → प्रतिमेत ${POSN(A[i].x,A[i].y)}, आणि तो स्वतःही ${water?'वर-खाली':'डावी-उजवी'} उलटतो.`,
      'सगळ्या चिन्हांसाठी हे जुळणारा एकच पर्याय आहे, तेच उत्तर.']});
}

function gOdd(l){
  const F=randFig(l?3:2,ASYM.concat(['star','heart','sq','tri','circ']),{rots:ROTS,noC:true});
  if(l===2)F.push(randSeg());
  const rotA=shuffle(ROTS);const rots=ROTS.map(a=>R(F,a));const keys=rots.map(fKey);
  if(new Set(keys).size<4)return null;
  if(l===0){
    const i=rnd(0,F.length-1);const other=pick(['star','heart','sq','tri','circ','arrow','flag','moon'].filter(s=>s!==F[i].s&&!F.some(e=>e.s===s)));
    const M=R(F.map((e,j)=>j===i?{...e,s:other}:e),pick(ROTS));
    if(keys.includes(fKey(M)))return null;
    const three=rotA.slice(0,3);
    return finish({tid:'odd',lay:'odd',q:'',figs:[M,...three.map(a=>R(F,a))],why:[null,...three.map(a=>`ही आकृती बाकीच्यांसारखीच आहे, फक्त ${a}° फिरवलेली.`)],
      steps:['चारही आकृत्यांत कोणती चिन्हं आहेत ते आधी मोजा.',`तीन आकृत्यांत ${symName(F[i])} आहे; उत्तरातल्या आकृतीत त्याच्या जागी ${SYM[other].nm} आहे.`,'बाकीच्या तीन एकाच आकृतीला फिरवून मिळतात.']});
  }
  const M=R(H(F),pick(ROTS));if(keys.includes(fKey(M)))return null;
  const syms=F.filter(e=>e.k==='sym');const first=syms[0].s;
  const order=G=>{const a=G.filter(e=>e.k==='sym').map(e=>[Math.atan2(e.y-50,e.x-50),e.s]).sort((p,q)=>p[0]-q[0]).map(p=>p[1]);const k=a.indexOf(first);return a.slice(k).concat(a.slice(0,k)).map(s=>SYM[s].nm).join(' → ');};
  const three=rotA.slice(0,3);
  return finish({tid:'odd',lay:'odd',q:'',figs:[M,...three.map(a=>R(F,a))],why:[null,...three.map(a=>`ही आकृती बाकीच्यांसारखीच आहे, फक्त ${a}° फिरवलेली.`)],
    note:[order(M),...three.map(a=>order(R(F,a)))].map(s=>`घड्याळाच्या दिशेने क्रम: ${s}`),
    steps:[`प्रत्येक आकृतीत ${SYM[first].nm} पासून सुरू करून चिन्हं घड्याळाच्या दिशेने वाचा (खाली प्रत्येक पर्यायाचा क्रम दिला आहे).`,
      'तीन आकृत्यांत क्रम एकच आहे, कारण त्या फिरवलेल्या आहेत. उत्तरातल्या आकृतीत क्रम उलटा आहे, म्हणजे ती आरशासारखी उलटी आहे.']});
}

const seriesQ=terms=>`<div class="qrow">${terms.map(t=>tile(t)).join('')}${QM}</div>`;
const dirName=a=>a>0?'घड्याळाच्या दिशेने':'घड्याळाच्या उलट दिशेने';
function gSerRot(l){
  const F=randFig(l?3:2,ASYM.concat(['star','dot','sq']),{rots:ROTS,noC:true,grid:[28,50,72]});
  if(l===2)F.push({k:'seg',x1:50,y1:50,x2:50,y2:12});
  const a=pick(l===0?[90,-90]:l===1?[90,-90,45,-45]:[45,-45,135,-135]);
  const terms=[0,1,2].map(i=>R(F,a*i));
  if(new Set(terms.map(fKey)).size<3)return null;
  const ans=R(F,3*a),A=Math.abs(a),dn=dirName(a);
  const res=distinct(ans,shuffle([[R(F,2*a),'ही तिसरी आकृतीच आहे, पुढे फिरवली नाही.'],[R(F,4*a),'ही एक पायरी जास्त फिरवली आहे.'],[H(ans),'फिरण्याचं प्रमाण बरोबर, पण आकृती आरशासारखी उलटी आहे. फिरवल्याने आकृती उलटत नाही.'],
    [R(F,3*a+180),'ही 180° जास्त फिरवली आहे.'],[R(F,-a),'ही उलट्या दिशेने फिरवली आहे.'],[V(ans),'ही वर-खाली उलटी आहे.']]));
  if(!res)return null;
  return finish({tid:'series',lay:'two',q:seriesQ(terms),...res,steps:[`1 → 2: संपूर्ण आकृती ${A}° ${dn} फिरली.`,`2 → 3: पुन्हा ${A}° ${dn}.`,`म्हणून 3 → ?: आणखी ${A}° ${dn} (पहिल्या आकृतीपासून एकूण ${3*A}°).`]});
}
// NMMS प्रकार: लहान चिन्हं चौकटीच्या कडेने (कोपरे + मधल्या जागा) ठराविक जागा सरकतात
const RING=[[20,20],[50,20],[80,20],[80,50],[80,80],[50,80],[20,80],[20,50]];
const RN=['वरचा डावा कोपरा','वरची मधली जागा','वरचा उजवा कोपरा','उजवी मधली जागा','खालचा उजवा कोपरा','खालची मधली जागा','खालचा डावा कोपरा','डावी मधली जागा'];
function gSerRing(l){
  const m=l===0?2:3;const pool=shuffle(['ell','tri','S','circ','arrow','star','sq','tdot','flag','moon']);
  const ds=l===0?[1,-1,2]:l===1?[1,-1,2,-2]:[1,-1,2,-2,3,-3];
  const els=Array.from({length:m},(_,i)=>({p:rnd(0,7),d:pick(ds),rr:l===2&&i===0?pick([90,-90]):0,base:{...mkEl([pool[i]],0,0,{rots:[0],z:0.75}),fill:false}}));
  const term=(t,alt)=>els.map((E,i)=>{const d=alt&&alt.i===i?alt.d:E.d;const c=RING[md(E.p+d*t,8)];return {...E.base,x:c[0],y:c[1],r:E.base.r+E.rr*t};});
  for(let t=0;t<=4;t++)if(!posOK(term(t)))return null;
  const ans=term(3);const alt=term(3,{i:0,d:-els[0].d});
  const sw=ans.map((e,i)=>i===0?{...e,x:ans[1].x,y:ans[1].y}:i===1?{...e,x:ans[0].x,y:ans[0].y}:e);
  const n0=symName(els[0].base),n1=symName(els[1].base);
  const res=distinct(ans,shuffle([[term(2),'ही तिसरी आकृतीच आहे; पुढची पायरी केलीच नाही.'],[term(4),'ही एक पायरी जास्त पुढे गेली आहे.'],[posOK(alt)?alt:null,`${n0} उलट्या दिशेने सरकला आहे.`],[sw,`${n0} आणि ${n1} यांच्या जागा अदलाबदल झाल्या आहेत.`],[term(1),'ही दुसरी आकृतीच आहे.']]));
  if(!res)return null;
  const steps=els.map(E=>{const P=t=>RN[md(E.p+E.d*t,8)];return `${symName(E.base)}: ${P(0)} → ${P(1)} → ${P(2)}, म्हणजे दर वेळी ${Math.abs(E.d)} जागा ${dirName(E.d)}${E.rr?` आणि ${Math.abs(E.rr)}° फिरतो`:''}. ⇒ पुढे ${P(3)}.`;});
  return finish({tid:'series',lay:'two',q:seriesQ([0,1,2].map(t=>term(t))),...res,steps:steps.concat(['प्रत्येक चिन्हाची पुढची जागा जुळणारा पर्याय म्हणजे उत्तर.'])});
}
const CNT=[[50,50],[24,24],[76,76],[76,24],[24,76],[50,24],[50,76],[24,50],[76,50]];
function gSerCount(l){
  const st=l===2?2:1;const n0=rnd(1,9-4*st);
  const s=pick(['dot','star','tri','circ','sq','heart']);const fill=SYM[s].fl?Math.random()<0.5:false;
  const lay=(n,sym=s)=>CNT.slice(0,n).map(([x,y])=>({k:'sym',s:sym,x,y,r:0,f:1,z:0.8,fill}));
  const N=n0+3*st,other=pick(['dot','star','tri','circ','sq','heart'].filter(x=>x!==s));
  const res=distinct(lay(N),shuffle([[lay(n0+2*st),`यात ${n0+2*st}: ही तिसरी आकृतीच, संख्या वाढवली नाही.`],[n0+4*st<=9?lay(n0+4*st):null,`यात ${n0+4*st}: एक पायरी जास्त.`]]).concat([[lay(N,other),`संख्या बरोबर (${N}), पण चिन्ह बदललं आहे.`],[lay(N-1),`यात ${N-1}: एक कमी.`],[N<9?lay(N+1):null,`यात ${N+1}: एक जास्त.`]]));
  if(!res)return null;
  return finish({tid:'series',lay:'two',q:seriesQ([0,1,2].map(i=>lay(n0+i*st))),...res,steps:[`प्रत्येक आकृतीतील ${SYM[s].nm} मोजा: ${n0}, ${n0+st}, ${n0+2*st}.`,`दर वेळी ${st} ने वाढ ⇒ ${n0+2*st} + ${st} = ${N}.`]});
}
const TR=[['H',F=>H(F),'आरशासारखी डावी-उजवी उलटी केली'],['V',F=>V(F),'वर-खाली उलटी केली'],['R90',F=>R(F,90),'90° घड्याळाच्या दिशेने फिरवली'],
          ['R270',F=>R(F,-90),'90° घड्याळाच्या उलट दिशेने फिरवली'],['R180',F=>R(F,180),'180° फिरवली'],['FILL',FILL,'भरलेले आकार पोकळ आणि पोकळ आकार भरलेले केले']];
const anaQ=(A,B,C)=>`<div class="qrow">${tile(A)}<span class="sep">:</span>${tile(B)}<span class="sep">::</span>${tile(C)}<span class="sep">:</span>${QM}</div>`;
const NEST=['circ','sq','ell','hex'];
const nest=(s,n)=>Array.from({length:n},(_,i)=>({k:'sym',s,x:50,y:50,r:s==='ell'?90:0,f:1,z:n>1?f2(4.9-i*(4.0/(n-1))):3,fill:false}));
function gAnalogy(l){
  if(Math.random()<0.4){ // NMMS प्रकार: एकात एक आकार, संख्या वाढते/कमी होते
    const [s1,s2]=shuffle(NEST);const a=rnd(1,3),k=l===2?pick([2,-1]):pick([1,2]),c=rnd(2,4);
    if(a+k<1||c+k<1||c+k>6||a===c)return null;
    const N=c+k;
    const res=distinct(nest(s2,N),shuffle([[nest(s2,N+1),`यात ${N+1} ${SYM[s2].nm}: एक जास्त.`],[N>1?nest(s2,N-1):null,`यात ${N-1} ${SYM[s2].nm}: एक कमी.`],[nest(s2,c),'ही तिसरी आकृतीच आहे; बदल केला नाही.'],[nest(s1,N),`संख्या बरोबर, पण आकार ${SYM[s1].nm}; तिसऱ्या आकृतीत ${SYM[s2].nm} आहेत.`]]));
    if(!res)return null;
    return finish({tid:'analogy',lay:'two',q:anaQ(nest(s1,a),nest(s1,a+k),nest(s2,c)),...res,
      steps:[`पहिल्या आकृतीत ${a} ${SYM[s1].nm}, दुसऱ्यात ${a+k} ⇒ ${Math.abs(k)} ${k>0?'वाढले':'कमी झाले'}.`,`तिसऱ्या आकृतीत ${c} ${SYM[s2].nm} ⇒ ${c} ${k>0?'+':'−'} ${Math.abs(k)} = ${N}.`,`आकार तोच (${SYM[s2].nm}) राहतो.`]});
  }
  const pool=ASYM.concat(SHAPES);
  const A=randFig(l?3:2,pool,{rots:ROTS}),C=randFig(l?3:2,pool,{rots:ROTS});
  const ti=rnd(0,TR.length-1);const T=TR[ti];
  const uniq=F=>{const ks=TR.map(t=>fKey(t[1](F)));return ks.filter(k=>k===ks[ti]).length===1&&ks[ti]!==fKey(F);};
  if(!uniq(A)||!uniq(C))return null;
  const ans=T[1](C);
  const res=distinct(ans,shuffle(TR.filter((_,i)=>i!==ti).map(t=>[t[1](C),`ही तिसरी आकृती ${t[2]}; पहिल्या जोडीत असा बदल नाही.`]).concat([[C,'ही तिसरी आकृतीच आहे; बदल केला नाही.']])));
  if(!res)return null;
  const i=symIdx(C);
  return finish({tid:'analogy',lay:'two',q:anaQ(A,T[1](A),C),...res,
    steps:[`पहिली → दुसरी: आकृती ${T[2]}.`,'तोच बदल तिसऱ्या आकृतीला करा.',`तपासा: ${symName(C[i])} तिसऱ्या आकृतीत ${POSN(C[i].x,C[i].y)} आहे → उत्तरात ${POSN(ans[i].x,ans[i].y)}.`]});
}
function gComplete(l){
  const P=[0,25,50],pts=[];for(const y of P)for(const x of P)pts.push([x,y]);
  const segs=[];
  for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){const [a,b]=[pts[i],pts[j]];
    if(a[0]===b[0]&&(a[0]===0||a[0]===50))continue;if(a[1]===b[1]&&(a[1]===0||a[1]===50))continue;segs.push({k:'seg',x1:a[0],y1:a[1],x2:b[0],y2:b[1]});}
  const F=shuffle(segs).slice(0,l===0?2:3);
  if(l>0){const s=pick(['dot','tdot','flag','halfc','arrow']);F.push({k:'sym',s,x:pick([12.5,37.5]),y:pick([12.5,37.5]),r:pick(ROTS),f:1,z:0.55,fill:true});}
  const q0=F,qh=H(F,50),qv=V(F,50),qhv=H(V(F,50),50);
  if(new Set([q0,qh,qv,qhv].map(fKey)).size<4)return null;
  const full=[...F,...H(F),...V(F)];
  const frame=`<rect x="0" y="0" width="100" height="100" fill="#fff"/><line x1="50" y1="0" x2="50" y2="100" ${ST(1.5)}/><line x1="0" y1="50" x2="100" y2="50" ${ST(1.5)}/>`;
  const qmark=`<rect x="50" y="50" width="50" height="50" fill="#f1f1f1" ${ST(1.5)}/><text x="75" y="77" font-size="30" font-weight="700" text-anchor="middle" dominant-baseline="central" font-family="Georgia,serif" fill="${INK}">?</text>`;
  const res=distinct(qhv,shuffle([[q0,'हा वरचा डावा भाग जसाच्या तसा आहे; उलटला नाही.'],[qh,'हा फक्त डावी-उजवी उलटला आहे (म्हणजे वरचा उजवा भाग).'],[qv,'हा फक्त वर-खाली उलटला आहे (म्हणजे खालचा डावा भाग).'],[R(F,90,50),'हा भाग फिरवला आहे; या आकृतीत भाग फिरत नाहीत, उलटतात.']]));
  if(!res)return null;
  return finish({tid:'complete',lay:'two',q:`<div class="tile big">${svg(full,'0 0 100 100',frame)}</div>`.replace('</svg>',qmark+'</svg>'),...res,render:G=>tile(G,'0 0 50 50'),
    steps:['वरचे दोन भाग पाहा: उजवा भाग म्हणजे डाव्या भागाची आरशातील प्रतिमा (उभी मधली रेषा = आरसा).','तसंच खालचा डावा भाग = वरच्या डाव्या भागाची पाण्यातील प्रतिमा (आडवी मधली रेषा = आरसा).','म्हणून गायब खालचा उजवा भाग = खालच्या डाव्या भागाची आरशातील प्रतिमा. रेषा मधल्या रेषांना जिथे भेटतात त्या जागा जुळतात का ते तपासा.']});
}
const VTH=[['भूगोल','विज्ञान','गणित','विद्यार्थी','आवडणारे'],['चहा','कॉफी','दूध','लोक','पिणारे'],['क्रिकेट','कबड्डी','खो-खो','खेळाडू','खेळणारे'],
           ['वाद्य','गायन','नाटक','विद्यार्थी','भाग घेणारे'],['मराठी','हिंदी','इंग्रजी','मुले','बोलणारी']];
const AR=`<defs><marker id="ah" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="${INK}"/></marker></defs>`;
const PAPER='<rect x="2" y="2" width="96" height="96" fill="#fff" stroke="#111" stroke-width="1.5" vector-effect="non-scaling-stroke"/>';
const DASH=(x1,y1,x2,y2)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#111" stroke-width="1.3" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>`;
const ARC=d=>`<path d="${d}" fill="none" stroke="#111" stroke-width="1.5" vector-effect="non-scaling-stroke" marker-end="url(#ah)"/>`;
// कागदाची घडी: चारही दिशा (डावी→उजवी, उजवी→डावी, वरून खाली, खालून वर), एक किंवा दोन घड्या
const FOLDS={
  L2R:{ax:'x',nm:'डावा भाग उजवीकडे',keep:{x0:50,x1:100},from:'डाव्या',to:'उजव्या'},
  R2L:{ax:'x',nm:'उजवा भाग डावीकडे',keep:{x0:0,x1:50},from:'उजव्या',to:'डाव्या'},
  T2B:{ax:'y',nm:'वरचा भाग खाली',keep:{y0:50,y1:100},from:'वरच्या',to:'खालच्या'},
  B2T:{ax:'y',nm:'खालचा भाग वर',keep:{y0:0,y1:50},from:'खालच्या',to:'वरच्या'},
};
const foldArrow=(f,c)=>({L2R:`M28,${c} Q50,${c-20} 70,${c-2}`,R2L:`M72,${c} Q50,${c-20} 30,${c-2}`,T2B:`M${c},28 Q${c+20},50 ${c+2},70`,B2T:`M${c},72 Q${c+20},50 ${c+2},30`}[f]);
function gFold(l){
  const vDirs=['L2R','R2L'],hDirs=['T2B','B2T'];
  let seq;
  if(l===0||(l===1&&Math.random()<0.5))seq=[pick([...vDirs,...hDirs])];
  else seq=shuffle([pick(vDirs),pick(hDirs)]);
  // जो भाग शिल्लक राहतो (कागदाचे सगळे थर) तिथेच छिद्रं पडतात
  const R={x0:0,x1:100,y0:0,y1:100};for(const f of seq)Object.assign(R,FOLDS[f].keep);
  const span=(a,b)=>b-a===100?[22,50,78]:[a+14,a+34];
  const cells=[];for(const x of span(R.x0,R.x1))for(const y of span(R.y0,R.y1))cells.push([x,y]);
  const pool=l===0?['circ','sq']:['circ','sq','tdot','flag','halfc','arrow','tri','rtri'];
  const k=l===0?1:2;
  const holes=shuffle(cells).slice(0,k).map(([x,y])=>({...mkEl(pool,x,y,{rots:ROTS,z:0.6}),fill:false}));
  const axes=seq.map(f=>FOLDS[f].ax);
  const close=(F,ax)=>{let G=F;for(const a of ax)G=G.concat(a==='x'?H(G):V(G));return G;};
  const ans=close(holes,axes),layers=2**seq.length;
  const slide=(F,ax)=>{let G=F;for(const a of ax)G=G.concat(G.map(e=>a==='x'?{...e,x:100-e.x}:{...e,y:100-e.y}));return G;};
  const cands=[[holes,'घड्या उघडल्याच नाहीत; फक्त घडीवरची छिद्रं दाखवली.'],[slide(holes,axes),'छिद्रांच्या जागा बरोबर, पण आकार आरशासारखे उलटले नाहीत.']];
  if(seq.length===1){const other=axes[0]==='x'?'y':'x';
    cands.push([close(holes,[other]),`चुकीच्या रेषेवर आरसा घेतला: घडी ${axes[0]==='x'?'उभी':'आडवी'} होती, ${axes[0]==='x'?'आडवी':'उभी'} नाही.`]);
    cands.push([close(holes,['x','y']),`छिद्रं जास्त: एका घडीत ${k*2} च व्हायला हवी, ${k*4} नाही.`]);}
  else{cands.push([close(holes,[axes[0]]),'फक्त पहिली घडी उघडली; दुसरी घडी उघडायची राहिली.']);cands.push([close(holes,[axes[1]]),'फक्त शेवटची घडी उघडली; पहिली घडी उघडायची राहिली.']);}
  const res=distinct(ans,shuffle(cands));
  if(!res)return null;
  // आकृत्या: प्रत्येक घडीपूर्वीचा कागद (तुटक घडीरेषा + बाण), शेवटी छिद्रांसह दुमडलेला कागद
  const DASHRECT=`<rect x="2" y="2" width="96" height="96" fill="#fff" stroke="#111" stroke-width="1.3" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>`;
  const solid=r=>`<rect x="${Math.max(2,r.x0)}" y="${Math.max(2,r.y0)}" width="${Math.min(98,r.x1)-Math.max(2,r.x0)}" height="${Math.min(98,r.y1)-Math.max(2,r.y0)}" fill="#fff" stroke="#111" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
  const cur={x0:0,x1:100,y0:0,y1:100};const tiles=[];
  for(const f of seq){
    const F=FOLDS[f];let draw=`${AR}${DASHRECT}${solid(cur)}`;
    if(F.ax==='x')draw+=DASH(50,Math.max(2,cur.y0),50,Math.min(98,cur.y1))+ARC(foldArrow(f,(cur.y0+cur.y1)/2));
    else draw+=DASH(Math.max(2,cur.x0),50,Math.min(98,cur.x1),50)+ARC(foldArrow(f,(cur.x0+cur.x1)/2));
    tiles.push(tile([],'0 0 100 100',draw));Object.assign(cur,F.keep);
  }
  tiles.push(tile(holes,'0 0 100 100',`${DASHRECT}${solid(cur)}`));
  const order=seq.map((f,i)=>`${i+1}) ${FOLDS[f].nm} (${FOLDS[f].ax==='x'?'उभी':'आडवी'} घडी)`).join(', ');
  const unfold=seq.slice().reverse().map(f=>`${FOLDS[f].ax==='x'?'उभी':'आडवी'} घडी उघडा: ${FOLDS[f].to} भागातील छिद्रांची आरशातील प्रतिमा ${FOLDS[f].from} भागात, घडीपासून तेवढ्याच अंतरावर येते.`);
  return finish({tid:'fold',lay:'two',q:`<div class="qrow">${tiles.join('<span class="sep">→</span>')}</div>`,...res,render:F=>tile(F,'0 0 100 100',PAPER),
    steps:[`घड्यांचा क्रम: ${order}.`,`कागदाचे ${layers} थर एकावर एक आहेत, म्हणून प्रत्येक छिद्र ${layers} वेळा येतं: ${k} × ${layers} = ${k*layers} छिद्रं.`,
      ...(seq.length>1?['शेवटची घडी आधी उघडा.']:[]),...unfold,'आरशात आकारही उलटतात (उदा. झेंड्याची दिशा), ते पर्यायात तपासा.']});
}

// ── नवीन प्रकार ──
Object.assign(DIR,{
  count:'खालील आकृतीचे निरीक्षण करून विचारलेल्या प्रश्नाचे योग्य उत्तर निवडा.',
  textmirror:'प्रश्न आकृतीतील अक्षर-अंक गटाची विचारलेली प्रतिमा उत्तर आकृत्यांतून निवडा.',
  numfig:'पुढील आकृत्यांमधील संख्यांच्या मांडणीत एकच नियम आहे. तो नियम शोधून प्रश्नचिन्हाच्या जागी योग्य पर्याय निवडा.',
  vennrel:'दिलेल्या शब्दसमूहातील संबंध कोणती वेन आकृती योग्य प्रकारे दाखवते ते निवडा.',
});
Object.assign(TRICK,{
  count:'त्रिकोण: शिरोबिंदूतून n रेषा असतील तर एका थरात 1 + 2 + … + (n+1) त्रिकोण; आडव्या रेषांमुळे जितके थर, तितक्याने गुणा. चौरस (n × n जाळी): 1² + 2² + … + n². आयत: (आडव्या रेषांपैकी 2 निवडण्याचे मार्ग) × (उभ्या रेषांपैकी 2 निवडण्याचे मार्ग).',
  textmirror:'उभा आरसा: क्रम उलटा + प्रत्येक अक्षर डावी-उजवी उलटं. पाणी: क्रम तोच + प्रत्येक अक्षर वर-खाली उलटं. आधी फक्त पहिलं अक्षर कुठे आलं ते तपासा, अर्धे पर्याय लगेच बाद होतात.',
  numfig:'नियम शोधायचा क्रम: आधी चारही संख्यांची बेरीज, मग फरक, मग गुणाकार, मग कर्णांवरच्या (तिरप्या) संख्या. जो नियम पहिल्या दोन्ही आकृत्यांना लागू पडतो तोच तिसरीला लावा.',
  vennrel:'दोन-दोन शब्दांची जोडी घ्या आणि विचारा: "सगळे … हे … आहेत का?" (हो ⇒ एक दुसऱ्याच्या आत), "काही आहेत का?" (हो ⇒ वर्तुळं छेदतात), "एकही नाही?" (⇒ वेगळी). तिन्ही जोड्यांची उत्तरं जुळणारी आकृती बरोबर.',
});
const C2=n=>n*(n-1)/2;
function gCount(l){
  const ln=(x1,y1,x2,y2,w=1.6)=>`<line x1="${f2(x1)}" y1="${f2(y1)}" x2="${f2(x2)}" y2="${f2(y2)}" ${ST(w)}/>`;
  const box=inner=>`<div class="tile big">${svg([],'0 0 100 100',`<rect width="100" height="100" fill="#fff"/>${inner}`)}</div>`;
  const kind=pick(l===0?['tri','sq']:['tri','sq','rect']);
  if(kind==='tri'){
    const p=l===0?rnd(1,2):l===1?rnd(2,3):rnd(3,4),q=l===0?0:l===1?rnd(0,1):rnd(1,2);
    const C=(p+1)*(p+2)/2,N=C*(q+1);
    let s=ln(50,8,8,92)+ln(50,8,92,92)+ln(8,92,92,92);
    for(let k=1;k<=p;k++)s+=ln(50,8,8+84*k/(p+1),92);
    for(let h=1;h<=q;h++){const y=8+84*h/(q+1),w=42*(y-8)/84;s+=ln(50-w,y,50+w,y);}
    const res=numOpts(N,[[(p+1)*(q+1),'फक्त सर्वात लहान त्रिकोण मोजले.'],[q?C:null,'आडव्या रेषांमुळे झालेले थर मोजले नाहीत.'],[N-1,'एक त्रिकोण सुटला.'],[N+1,'एक त्रिकोण दोनदा मोजला.'],[N+2,'मोजणीत चूक.'],[N-2,'मोजणीत चूक.']].filter(x=>x[0]));
    if(!res)return null;
    return finish({tid:'count',lay:'text',text:'खालील आकृतीत एकूण त्रिकोण किती आहेत?',q:box(s),...res,render:x=>`<span class="otxt">${x}</span>`,
      steps:[`शिरोबिंदूतून पायथ्याकडे ${p} रेषा ⇒ पायथ्याचे ${p+1} भाग.`,`एका थरातील त्रिकोण = 1 + 2 + … + ${p+1} = ${C}.`,q?`${q} आडव्या रेषांमुळे ${q+1} थर ⇒ ${C} × ${q+1} = ${N}.`:'आडवी रेषा नाही, म्हणून एकूण '+N+'.']});
  }
  if(kind==='sq'){
    const n=l===0?rnd(2,3):l===1?rnd(3,4):rnd(4,5);let S=0;const parts=[];for(let k=1;k<=n;k++){S+=(n-k+1)**2;parts.push(`${k}×${k} चे ${(n-k+1)**2}`);}
    let s='';for(let i=0;i<=n;i++){const t=8+84*i/n;s+=ln(8,t,92,t)+ln(t,8,t,92);}
    const res=numOpts(S,[[n*n,'फक्त सर्वात लहान चौरस मोजले.'],[n*n+1,'लहान चौरस + एक मोठा एवढेच मोजले.'],[S-1,'एक चौरस सुटला.'],[S+1,'एक जास्त मोजला.'],[S-(n-1)**2,'2 × 2 चे चौरस मोजले नाहीत.']]);
    if(!res)return null;
    return finish({tid:'count',lay:'text',text:'खालील आकृतीत एकूण चौरस किती आहेत?',q:box(s),...res,render:x=>`<span class="otxt">${x}</span>`,
      steps:[`ही ${n} × ${n} ची जाळी आहे.`,`आकारानुसार मोजा: ${parts.join(', ')}.`,`बेरीज = ${S}. (सूत्र: 1² + 2² + … + ${n}²)`]});
  }
  let r=rnd(2,3),c=rnd(3,4);if(r===c)c++;
  const N=C2(r+1)*C2(c+1);
  let s='';for(let i=0;i<=r;i++){const y=20+60*i/r;s+=ln(8,y,92,y);}for(let j=0;j<=c;j++){const x=8+84*j/c;s+=ln(x,20,x,80);}
  const res=numOpts(N,[[r*c,'फक्त सर्वात लहान आयत मोजले.'],[N-1,'एक आयत सुटला.'],[N+1,'एक जास्त मोजला.'],[C2(r+1)+C2(c+1),'गुणाकार करायचा, बेरीज नाही.'],[N-r*c,'सर्वात लहान आयत मोजायचे विसरलात.']]);
  if(!res)return null;
  return finish({tid:'count',lay:'text',text:'खालील आकृतीत एकूण आयत (चौरसांसह) किती आहेत?',q:box(s),...res,render:x=>`<span class="otxt">${x}</span>`,
    steps:[`आडव्या रेषा ${r+1}: त्यांतील कोणत्याही 2 निवडण्याचे मार्ग = ${C2(r+1)}.`,`उभ्या रेषा ${c+1}: 2 निवडण्याचे मार्ग = ${C2(c+1)}.`,`प्रत्येक आयत = 2 आडव्या + 2 उभ्या रेषा ⇒ ${C2(r+1)} × ${C2(c+1)} = ${N}.`]});
}
function gTextMirror(l){
  const n=[3,4,5][l];const chars=shuffle(['F','G','J','R','P','Q','2','4','5','7','9','K','N','Z','L']).slice(0,n);
  const F=chars.map((s,i)=>({k:'sym',s,x:20+i*(160/(n-1)),y:30,r:0,f:1,z:1,fill:false}));
  const str=chars.join('');const water=Math.random()<0.4;
  const flipEach=G=>G.map(e=>({...e,r:-e.r,f:-e.f})),vflipEach=G=>G.map(e=>({...e,r:180-e.r,f:-e.f}));
  const rev=G=>G.map(e=>({...e,x:200-e.x}));
  const ans=water?vflipEach(F):rev(flipEach(F));
  const rot=F.map(e=>({...e,x:200-e.x,r:e.r+180}));
  const cands=water?[[rev(flipEach(F)),'ही आरशातील प्रतिमा आहे: क्रमही उलटला आणि अक्षरं डावी-उजवी उलटली.'],[rot,'ही 180° फिरवलेली आहे.'],[rev(vflipEach(F)),'अक्षरं वर-खाली उलटली, पण क्रमही उलटला; पाण्यात क्रम बदलत नाही.'],[F,'मूळ गट जसाच्या तसा.']]
    :[[rev(F),'अक्षरांचा क्रम उलटला, पण अक्षरं स्वतः उलटली नाहीत.'],[flipEach(F),'अक्षरं उलटली, पण क्रम उलटला नाही.'],[vflipEach(F),'ही पाण्यातील प्रतिमा आहे (वर-खाली उलट).'],[rot,'ही 180° फिरवलेली आहे.'],[F,'मूळ गट जसाच्या तसा.']];
  const res=distinct(ans,shuffle(cands));if(!res)return null;
  const wt=G=>`<div class="tile wtile">${svg(G,'0 0 200 60')}</div>`;
  return finish({tid:'textmirror',lay:'textfig',text:water?'प्रश्न आकृतीतील गटाची पाण्यातील प्रतिमा कोणती?':'आरसा उजव्या बाजूला उभा धरल्यास प्रश्न आकृतीतील गटाची प्रतिमा कोणती?',q:wt(F),...res,render:wt,
    steps:water?['पाण्यात डावीकडून उजवीकडचा क्रम बदलत नाही.','फक्त प्रत्येक अक्षर/अंक वर-खाली उलटतो.',`म्हणून "${str}" मधलं पहिलं अक्षर "${chars[0]}" डावीकडेच राहतं, उलटं होऊन.`]
      :['उभ्या आरशात गटाचा क्रम उलटा होतो: शेवटचं अक्षर सगळ्यात डावीकडे येतं.','आणि प्रत्येक अक्षर/अंक स्वतःही डावी-उजवी उलटतो.',`म्हणून "${str}" → क्रम "${[...chars].reverse().join('')}", प्रत्येक अक्षर उलटं.`]});
}
const NRULES=[
  {id:'sum',nm:'चारही संख्यांची बेरीज',f:([a,b,c,d])=>a+b+c+d,ex:([a,b,c,d])=>`${a} + ${b} + ${c} + ${d}`},
  {id:'diag',nm:'(वरची × खालची) + (डावी × उजवी)',f:([a,b,c,d])=>a*d+b*c,ex:([a,b,c,d])=>`${a}×${d} + ${c}×${b}`},
  {id:'diff',nm:'(वरची + खालची) − (डावी + उजवी)',f:([a,b,c,d])=>(a+d)-(b+c),ex:([a,b,c,d])=>`(${a} + ${d}) − (${c} + ${b})`},
  {id:'rowp',nm:'(वरची × खालची) − (डावी × उजवी)',f:([a,b,c,d])=>a*d-b*c,ex:([a,b,c,d])=>`${a}×${d} − ${c}×${b}`},
  {id:'colp',nm:'(वरची + खालची) × (डावी + उजवी)',f:([a,b,c,d])=>(a+d)*(b+c),ex:([a,b,c,d])=>`(${a} + ${d}) × (${c} + ${b})`},
  {id:'half',nm:'चारही संख्यांची बेरीज ÷ 2',f:([a,b,c,d])=>(a+b+c+d)/2,ex:([a,b,c,d])=>`(${a} + ${b} + ${c} + ${d}) ÷ 2`},
];
function gNumFig(l){
  const pool=l===0?['sum','half']:l===1?['sum','diag','diff','half']:['diag','rowp','colp','diff'];
  const rid=pick(pool),R=NRULES.find(r=>r.id===rid);const mx=l===2?9:12;
  const figs=[0,1,2].map(()=>[rnd(1,mx),rnd(1,mx),rnd(1,mx),rnd(1,mx)]);
  const vals=figs.map(R.f);if(vals.some(v=>v<=0||!Number.isInteger(v)))return null;
  if(NRULES.some(o=>o!==R&&o.f(figs[0])===vals[0]&&o.f(figs[1])===vals[1]))return null;   // नियम एकच असावा
  const ans=vals[2];
  const res=numOpts(ans,shuffle(NRULES.filter(o=>o!==R).map(o=>[o.f(figs[2]),`हा "${o.nm}" नियम आहे; तो पहिल्या दोन आकृत्यांना लागू पडत नाही.`])).concat([[ans+1,'हिशोबात 1 ची चूक.'],[ans-1,'हिशोबात 1 ची चूक.'],[ans+2,'हिशोबात चूक.']]).filter(x=>Number.isInteger(x[0])));
  if(!res)return null;
  const t=(v,m)=>`<div class="tile">${svg([],'0 0 100 100',`<rect width="100" height="100" fill="#fff"/><line x1="0" y1="0" x2="100" y2="100" ${ST(1)}/><line x1="100" y1="0" x2="0" y2="100" ${ST(1)}/><circle cx="50" cy="50" r="15" fill="#fff" ${ST(1.4)}/>
    <g font-family="Times New Roman,serif" font-weight="700" font-size="17" fill="${INK}" text-anchor="middle" dominant-baseline="central"><text x="50" y="16">${v[0]}</text><text x="84" y="50">${v[1]}</text><text x="16" y="50">${v[2]}</text><text x="50" y="84">${v[3]}</text><text x="50" y="51">${m}</text></g>`)}</div>`;
  // वर = a, उजवीकडे = b, डावीकडे = c, खाली = d  (a,d आणि b,c समोरासमोर)
  return finish({tid:'numfig',lay:'text',text:'प्रश्नचिन्हाच्या जागी कोणती संख्या येईल?',q:`<div class="qrow">${t(figs[0],vals[0])}${t(figs[1],vals[1])}${t(figs[2],'?')}</div>`,...res,render:x=>`<span class="otxt">${x}</span>`,
    steps:[`नियम: मधली संख्या = ${R.nm}.`,`आकृती 1: ${R.ex(figs[0])} = ${vals[0]} ✔`,`आकृती 2: ${R.ex(figs[1])} = ${vals[1]} ✔`,`आकृती 3: ${R.ex(figs[2])} = ${ans}.`]});
}
// वेन: एक आकृती आणि तिच्यावर अनेक प्रश्न (पूर्ण संच)
function gVennSet(l,count){
  const [A,B,C,who,vb]=pick(VTH);const mx=l===0?15:30;
  const v={a:rnd(2,mx),b:rnd(2,mx),c:rnd(2,mx),ab:rnd(2,mx),ac:rnd(2,mx),bc:rnd(2,mx),abc:rnd(2,mx)};
  const sum=Object.values(v).reduce((s,x)=>s+x,0);const N=sum+rnd(5,30);
  const tA=v.a+v.ab+v.ac+v.abc,tB=v.b+v.ab+v.bc+v.abc,tC=v.c+v.ac+v.bc+v.abc;
  const Q=[
    [`फक्त ${A} ${vb} ${who} किती?`,v.a,`फक्त ${A}`,[`"फक्त ${A}" = ${A} च्या वर्तुळाचा, इतर दोन वर्तुळांबाहेरचा भाग: ${v.a}.`]],
    [`फक्त ${B} ${vb} ${who} किती?`,v.b,`फक्त ${B}`,[`"फक्त ${B}" = ${B} च्या वर्तुळाचा, इतर दोन वर्तुळांबाहेरचा भाग: ${v.b}.`]],
    [`फक्त ${C} ${vb} ${who} किती?`,v.c,`फक्त ${C}`,[`"फक्त ${C}" = ${C} च्या वर्तुळाचा, इतर दोन वर्तुळांबाहेरचा भाग: ${v.c}.`]],
    [`फक्त ${A} आणि ${B} दोन्ही (${C} सोडून) ${vb} ${who} किती?`,v.ab,`फक्त ${A} व ${B}`,[`${A} व ${B} चा सामाईक भाग, ${C} च्या बाहेर: ${v.ab}. मधला भाग घ्यायचा नाही.`]],
    [`फक्त ${A} आणि ${C} दोन्ही (${B} सोडून) ${vb} ${who} किती?`,v.ac,`फक्त ${A} व ${C}`,[`${A} व ${C} चा सामाईक भाग, ${B} च्या बाहेर: ${v.ac}.`]],
    [`तिन्ही ${vb} ${who} किती?`,v.abc,'तिन्ही',[`तिन्ही वर्तुळं जिथे एकत्र येतात तो मधला भाग: ${v.abc}.`]],
    [`फक्त एकच ${vb} ${who} किती?`,v.a+v.b+v.c,'फक्त एकच',['तीन "फक्त" भागांची बेरीज.',`${v.a} + ${v.b} + ${v.c} = ${v.a+v.b+v.c}`]],
    [`बरोबर दोनच ${vb} ${who} किती?`,v.ab+v.ac+v.bc,'बरोबर दोनच',['दोन-दोनचे तीन सामाईक भाग; मधला (तिन्ही) नाही.',`${v.ab} + ${v.ac} + ${v.bc} = ${v.ab+v.ac+v.bc}`]],
    [`किमान दोन ${vb} ${who} किती?`,v.ab+v.ac+v.bc+v.abc,'किमान दोन',['"किमान दोन" = दोन-दोनचे भाग + तिन्हीचा मधला भाग.',`${v.ab} + ${v.ac} + ${v.bc} + ${v.abc} = ${v.ab+v.ac+v.bc+v.abc}`]],
    [`${A} ${vb} एकूण ${who} किती?`,tA,`एकूण ${A}`,[`${A} च्या वर्तुळातले चारही भाग.`,`${v.a} + ${v.ab} + ${v.ac} + ${v.abc} = ${tA}`]],
    [`${C} ${vb} एकूण ${who} किती?`,tC,`एकूण ${C}`,[`${C} च्या वर्तुळातले चारही भाग.`,`${v.c} + ${v.ac} + ${v.bc} + ${v.abc} = ${tC}`]],
    [`${B} आणि ${C} दोन्ही ${vb} ${who} किती?`,v.bc+v.abc,`${B} व ${C} दोन्ही`,[`${B} व ${C} चा सामाईक भाग + मधला भाग (त्यांनाही दोन्ही लागू).`,`${v.bc} + ${v.abc} = ${v.bc+v.abc}`]],
    [`आकृतीत एकूण ${who} किती (किमान एक ${vb})?`,sum,'एकूण',['सर्व 7 भागांची बेरीज.',`${Object.values(v).join(' + ')} = ${sum}`]],
    [`${A} ${vb} एकूण आणि ${C} ${vb} एकूण यांतील फरक किती?`,Math.abs(tA-tC),'फरक',[`एकूण ${A} = ${tA}, एकूण ${C} = ${tC}.`,`फरक = ${Math.abs(tA-tC)}`]],
    [`एकूण ${who} ${N} असतील, तर एकही न ${vb} ${who} किती?`,N-sum,'एकही नाही',[`आकृतीतील सर्व 7 संख्यांची बेरीज = ${sum}.`,`${N} − ${sum} = ${N-sum}`]],
  ];
  const named=[[v.a,`फक्त ${A}`],[v.b,`फक्त ${B}`],[v.c,`फक्त ${C}`],[v.ab,`फक्त ${A} व ${B}`],[v.ac,`फक्त ${A} व ${C}`],[v.bc,`फक्त ${B} व ${C}`],[v.abc,'तिन्ही']].concat(Q.map(q=>[q[1],q[2]]));
  const pickQ=(l===0?Q.slice(0,7):Q).slice();
  const out=[];
  for(const [text,ans,,steps] of shuffle(pickQ)){
    if(out.length>=count)break;
    const res=numOpts(ans,shuffle(named.filter(x=>x[0]!==ans).map(([x,lb])=>[x,`ही संख्या "${lb}" ची आहे; प्रश्न वेगळ्या भागाबद्दल आहे.`])).concat([[ans+1,'बेरजेत 1 ची चूक.'],[ans-1,'बेरजेत 1 ची चूक.'],[ans+2,'बेरजेत चूक.']]));
    if(res)out.push(finish({tid:'venn',lay:'text',text,q:'',...res,render:x=>`<span class="otxt">${x}</span>`,steps}));
  }
  const P=[[62,62,v.a],[178,62,v.b],[120,165,v.c],[120,52,v.ab],[88,120,v.ac],[152,120,v.bc],[120,100,v.abc]];
  const fig=`<div class="wide" style="--w:260px"><svg viewBox="0 0 240 205" xmlns="http://www.w3.org/2000/svg"><rect width="240" height="205" fill="#fff"/>
    <circle cx="90" cy="80" r="55" fill="none" ${ST(1.6)}/><circle cx="150" cy="80" r="55" fill="none" ${ST(1.6)}/><circle cx="120" cy="130" r="55" fill="none" ${ST(1.6)}/>
    <g font-family="Noto Sans Devanagari,sans-serif" font-size="13" font-weight="700" fill="${INK}">
    <text x="30" y="20" text-anchor="middle">${A}</text><text x="210" y="20" text-anchor="middle">${B}</text><text x="205" y="195" text-anchor="middle">${C}</text></g>
    <g font-family="Times New Roman,serif" font-size="15" font-weight="700" fill="${INK}" text-anchor="middle" dominant-baseline="central">${P.map(p=>`<text x="${p[0]}" y="${p[1]}">${p[2]}</text>`).join('')}</g></svg></div>`;
  return {fig,qs:out,head:`वेन आकृतीत ${A}, ${B} आणि ${C} ${vb} ${who} यांची संख्या दिली आहे.`};
}
const VRT={
  nest:['एकात एक तीन वर्तुळं','<circle cx="50" cy="40" r="34"/><circle cx="50" cy="40" r="22"/><circle cx="50" cy="40" r="10"/>'],
  twoin:['मोठ्या वर्तुळात दोन वेगळी वर्तुळं','<circle cx="50" cy="40" r="34"/><circle cx="37" cy="40" r="11"/><circle cx="63" cy="40" r="11"/>'],
  sep3:['तिन्ही वर्तुळं वेगळी','<circle cx="18" cy="40" r="14"/><circle cx="50" cy="40" r="14"/><circle cx="82" cy="40" r="14"/>'],
  ov3:['तिन्ही वर्तुळं एकमेकांना छेदतात','<circle cx="38" cy="31" r="21"/><circle cx="62" cy="31" r="21"/><circle cx="50" cy="52" r="21"/>'],
  insep:['एक वर्तुळ दुसऱ्याच्या आत + एक वेगळं','<circle cx="32" cy="40" r="27"/><circle cx="32" cy="40" r="11"/><circle cx="83" cy="40" r="13"/>'],
  ov2sep:['दोन वर्तुळं छेदतात + एक वेगळं','<circle cx="25" cy="40" r="19"/><circle cx="49" cy="40" r="19"/><circle cx="85" cy="40" r="12"/>'],
  twoovin:['मोठ्या वर्तुळात दोन छेदणारी वर्तुळं','<circle cx="50" cy="40" r="35"/><circle cx="41" cy="40" r="14"/><circle cx="59" cy="40" r="14"/>'],
};
const VREL=[
  ['nest',['वनस्पती','फूल','चाफा'],'चाफा हे फूल आहे आणि प्रत्येक फूल ही वनस्पती आहे.'],
  ['nest',['प्राणी','सस्तन प्राणी','गाय'],'गाय सस्तन प्राणी आहे आणि सगळे सस्तन प्राणी हे प्राणीच आहेत.'],
  ['nest',['भारत','महाराष्ट्र','पुणे'],'पुणे महाराष्ट्रात आहे आणि महाराष्ट्र भारतात आहे.'],
  ['nest',['वाहन','चारचाकी वाहन','मोटार'],'मोटार चारचाकी वाहन आहे आणि सगळी चारचाकी वाहनं ही वाहनंच आहेत.'],
  ['nest',['संख्या','सम संख्या','4 च्या पटीतील संख्या'],'4 च्या पटीतील प्रत्येक संख्या सम आहे आणि सम संख्या ही संख्याच आहे.'],
  ['twoin',['फळे','आंबा','केळी'],'आंबा आणि केळी दोन्ही फळे आहेत, पण आंबा कधीच केळी नसतो.'],
  ['twoin',['प्राणी संग्रहालय','जिराफ','हत्ती'],'जिराफ आणि हत्ती दोघंही प्राणी संग्रहालयात आहेत, पण एकमेकांपासून वेगळे.'],
  ['twoin',['खेळ','क्रिकेट','कबड्डी'],'क्रिकेट आणि कबड्डी हे दोन्ही खेळ, पण एकमेकांपासून वेगळे.'],
  ['twoin',['भाज्या','वांगी','टोमॅटो'],'वांगी आणि टोमॅटो दोन्ही भाज्या, पण वेगळ्या.'],
  ['sep3',['पेन','पुस्तक','दप्तर'],'तिन्ही पूर्णपणे वेगळ्या वस्तू; कोणतीही एक दुसरी नाही.'],
  ['sep3',['सूर्य','चंद्र','पृथ्वी'],'तिन्ही वेगवेगळे; एकात दुसरा येत नाही.'],
  ['sep3',['चिकू','केळी','गुलाब'],'चिकू केळी नाही, आणि गुलाब फळ नाही; तिन्ही वेगळे.'],
  ['ov3',['स्त्री','शिक्षक','लेखक'],'काही स्त्रिया शिक्षक, काही लेखक; काही शिक्षक लेखकही असतात.'],
  ['ov3',['विद्यार्थी','खेळाडू','गायक'],'काही विद्यार्थी खेळाडू, काही गायक; काही खेळाडू गायकही असतात.'],
  ['ov3',['स्त्री','पोलीस','डॉक्टर'],'काही स्त्रिया पोलीस, काही डॉक्टर; एखादा पोलीस डॉक्टरही असू शकतो.'],
  ['insep',['फळ','आंबा','खुर्ची'],'आंबा हे फळ आहे; खुर्चीचा त्यांच्याशी संबंध नाही.'],
  ['insep',['प्राणी','कुत्रा','टेबल'],'कुत्रा हा प्राणी आहे; टेबल वेगळं.'],
  ['insep',['पक्षी','पोपट','पुस्तक'],'पोपट हा पक्षी आहे; पुस्तक वेगळं.'],
  ['ov2sep',['स्त्री','डॉक्टर','टेबल'],'काही स्त्रिया डॉक्टर असतात; टेबलचा संबंध नाही.'],
  ['ov2sep',['विद्यार्थी','खेळाडू','खुर्ची'],'काही विद्यार्थी खेळाडू असतात; खुर्ची वेगळी.'],
  ['twoovin',['माणूस','स्त्री','शिक्षक'],'स्त्री आणि शिक्षक दोघंही माणसं आहेत; काही स्त्रिया शिक्षक असतात.'],
  ['twoovin',['प्राणी','पाळीव प्राणी','कुत्रा'],'पाळीव प्राणी आणि कुत्रा दोघंही प्राणी; काही कुत्रे पाळीव असतात.'],
];
function gVennRel(){
  const [type,words,why]=pick(VREL);
  const others=shuffle(Object.keys(VRT).filter(k=>k!==type)).slice(0,3);
  const draw=k=>`<div class="tile vtile"><svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="80" fill="#fff"/><g fill="none" stroke="${INK}" stroke-width="1.5" vector-effect="non-scaling-stroke">${VRT[k][1]}</g></svg></div>`;
  return finish({tid:'vennrel',lay:'textfig',text:shuffle(words).join(' – '),q:'',figs:[type,...others],why:[null,...others.map(k=>`ही आकृती "${VRT[k][0]}" दाखवते; या शब्दांचा संबंध तसा नाही.`)],render:draw,
    steps:[why,`म्हणून आकृती: ${VRT[type][0]}.`]});
}

// ── घन (cube): फासे / घडी (net) / रंगवलेले घन ──
DIR.cube='खालील घनासंबंधी प्रश्नाचे योग्य उत्तर निवडा.';
TRICK.cube='घनाच्या प्रत्येक बाजूला 4 शेजारी आणि 1 विरुद्ध बाजू असते. एकाच आकृतीत एकत्र दिसणाऱ्या बाजू कधीच विरुद्ध नसतात. शेजारी सगळे मोजा; उरलेली बाजू विरुद्ध. घडीमध्ये (net) एका सरळ ओळीत एक आड एक असलेल्या बाजू विरुद्ध असतात.';
const V3={U:[0,1,0],D:[0,-1,0],L:[-1,0,0],R:[1,0,0],F:[0,0,1],B:[0,0,-1]};
const OPP={U:'D',D:'U',L:'R',R:'L',F:'B',B:'F'};
const xv=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const vk=v=>Object.keys(V3).find(k=>V3[k].every((x,i)=>x===v[i]));
const VIEWS=[];for(const t in V3)for(const f in V3)if(f!==t&&f!==OPP[t])VIEWS.push([t,f,vk(xv(V3[t],V3[f]))]);   // वर, समोर (डावी), उजवी
const isoTxt=(x,y,s)=>`<text x="${x}" y="${y}" font-family="Times New Roman,serif" font-weight="700" font-size="17" fill="${INK}" text-anchor="middle" dominant-baseline="central">${s}</text>`;
const ISO=`<rect width="100" height="100" fill="#fff"/><g fill="#fff" ${ST(1.4)}><polygon points="50,10 88,30 50,50 12,30"/><polygon points="12,30 50,50 50,92 12,72"/><polygon points="50,50 88,30 88,72 50,92"/></g>`;
const isoCube=([t,f,r])=>`<div class="tile">${svg([],'0 0 100 100',ISO+isoTxt(50,30,t)+isoTxt(31,62,f)+isoTxt(69,62,r))}</div>`;
function gCube(l){
  const sub=pick(l===0?['opp','opp','paint']:['opp','net','paint']);
  const lab={};const pool=pick([['1','2','3','4','5','6'],['A','B','C','D','E','F'],['★','●','▲','■','♥','✚']]);
  shuffle(Object.keys(V3)).forEach((k,i)=>lab[k]=pool[i]);
  const L=v=>v.map(k=>lab[k]);
  if(sub==='opp'){
    const X=pick(Object.keys(V3));const nb=VIEWS.find(v=>v[0]===X);
    const ring=[nb[1],nb[2],OPP[nb[1]],OPP[nb[2]]];   // X चे चार शेजारी, क्रमाने
    const corner=set=>pick(VIEWS.filter(v=>set.every(k=>v.includes(k))));
    const vs=[corner([X,ring[0],ring[1]]),corner([X,ring[2],ring[3]])];
    if(l===2)vs.push(pick(VIEWS.filter(v=>!v.includes(X))));
    const ans=lab[OPP[X]];
    const figs=[ans,...shuffle(ring).slice(0,3).map(k=>lab[k])];
    const why=[null,...figs.slice(1).map(s=>`"${s}" हा "${lab[X]}" सोबत एकाच आकृतीत दिसतो, म्हणजे शेजारी आहे; विरुद्ध नाही.`)];
    return finish({tid:'cube',lay:'text',text:`एकाच घनाच्या वेगवेगळ्या स्थिती दाखवल्या आहेत. "${lab[X]}" च्या विरुद्ध बाजूला काय आहे?`,
      q:`<div class="qrow">${vs.map(v=>isoCube(L(v))).join('')}</div>`,figs,why,render:x=>`<span class="otxt">${x}</span>`,
      steps:[`"${lab[X]}" पहिल्या दोन आकृत्यांत दिसतो.`,`आकृती 1 मध्ये त्याच्या शेजारी ${lab[ring[0]]}, ${lab[ring[1]]}; आकृती 2 मध्ये ${lab[ring[2]]}, ${lab[ring[3]]}.`,`एका बाजूला 4 च शेजारी असतात; ते चारही सापडले. उरलेली बाजू "${ans}" = विरुद्ध बाजू.`]});
  }
  if(sub==='net'){
    const N=randNet();if(!N)return null;
    const mxX=Math.max(...N.cells.map(c=>c[0])),mxY=Math.max(...N.cells.map(c=>c[1]));
    const W=(mxX+1)*22+8,Hh=(mxY+1)*22+8;
    const sq=(x,y,k)=>`<rect x="${4+22*x}" y="${4+22*y}" width="22" height="22" fill="#fff" ${ST(1.4)}/>${isoTxt(15+22*x,15+22*y,lab[k])}`;
    const net=`<div class="wide" style="--w:${Math.round(W*2.1)}px">${svg([],`0 0 ${W} ${Hh}`,`<rect width="${W}" height="${Hh}" fill="#fff"/>${N.cells.map((c,i)=>sq(c[0],c[1],N.faces[i])).join('')}`)}</div>`;
    const good=pick(VIEWS);const cands=[];
    if(l===2)cands.push([[good[0],good[2],good[1]],'तिन्ही बाजू शेजारी आहेत, पण त्यांचा क्रम उलटा आहे (आरशातील घन).']);
    for(const p of shuffle(Object.keys(V3))){const q=pick(Object.keys(V3).filter(k=>k!==p&&k!==OPP[p]));cands.push([shuffle([p,OPP[p],q]),`"${lab[p]}" आणि "${lab[OPP[p]]}" या विरुद्ध बाजू आहेत; त्या एकाच वेळी दिसू शकत नाहीत.`]);}
    const seen=new Set([good.join()]),figs=[good],why=[null];
    for(const [v,r] of cands){if(figs.length===4)break;const k=v.join();if(!seen.has(k)&&!VIEWS.some(w=>w.join()===k)){seen.add(k);figs.push(v);why.push(r);}}
    if(figs.length<4)return null;
    return finish({tid:'cube',lay:'textfig',text:'खालील घडी (net) दुमडून घन तयार केला, तर कोणता घन तयार होईल?',q:net,figs,why,render:v=>isoCube(L(v)),
      trick:'घडीत विरुद्ध बाजू ओळखण्याचे नियम: (1) एका सरळ ओळीत एक आड एक असलेल्या बाजू विरुद्ध. (2) "Z" किंवा "S" आकारात दोन टोकांच्या बाजू विरुद्ध. विरुद्ध बाजू कधीच एकत्र दिसत नाहीत; ज्या पर्यायात त्या एकत्र दिसतात तो लगेच बाद.',
      steps:[`घडी दुमडल्यावर विरुद्ध बाजू: ${['U','F','L'].map(k=>`"${lab[k]}"–"${lab[OPP[k]]}"`).join(', ')}.`,'ज्या पर्यायांत विरुद्ध बाजू एकत्र दिसतात ते लगेच बाद.',`उरलेल्या पर्यायात "${lab[good[0]]}", "${lab[good[1]]}", "${lab[good[2]]}" तिन्ही एकमेकांना लागून आहेत${l===2?' आणि त्यांचा क्रमही घडीप्रमाणे आहे':''}.`]});
  }
  const n=l===0?3:rnd(3,5);
  const vals={3:8,2:12*(n-2),1:6*(n-2)**2,0:(n-2)**3};
  const askK=pick(l===0?[3,2,1]:[3,2,1,0]);const ans=vals[askK];
  const nm={3:'तीन बाजू',2:'फक्त दोन बाजू',1:'फक्त एक बाजू',0:'एकही बाजू'};
  const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  const face=P=>{let s='';for(let k=1;k<n;k++){const t=k/n,a=lerp(P[0],P[1],t),b=lerp(P[3],P[2],t),c=lerp(P[0],P[3],t),d=lerp(P[1],P[2],t);
    s+=`<line x1="${f2(a[0])}" y1="${f2(a[1])}" x2="${f2(b[0])}" y2="${f2(b[1])}" ${ST(1)}/><line x1="${f2(c[0])}" y1="${f2(c[1])}" x2="${f2(d[0])}" y2="${f2(d[1])}" ${ST(1)}/>`;}return s;};
  const grid=face([[50,10],[88,30],[50,50],[12,30]])+face([[12,30],[50,50],[50,92],[12,72]])+face([[50,50],[88,30],[88,72],[50,92]]);
  const res=numOpts(ans,shuffle(Object.entries(vals).filter(([k])=>+k!==askK).map(([k,v])=>[v,`ही संख्या "${nm[k]} रंगलेल्या" घनांची आहे.`])).concat([[n**3,'ही सगळ्या लहान घनांची संख्या आहे.'],[ans+4,'मोजणीत चूक.'],[6*n,'चुकीचं सूत्र.']]));
  if(!res)return null;
  return finish({tid:'cube',lay:'text',text:`एका घनाच्या सर्व बाजू रंगवून, आकृतीत दाखवल्याप्रमाणे त्याचे ${n**3} समान लहान घन केले. ${nm[askK]} रंगलेले लहान घन किती?`,
    q:`<div class="tile big">${svg([],'0 0 100 100',ISO+grid)}</div>`,...res,render:x=>`<span class="otxt">${x}</span>`,
    trick:'रंगवलेला n × n × n घन: 3 बाजू रंगलेले = 8 (कोपरे), 2 बाजू = 12(n−2) (कडांवरचे), 1 बाजू = 6(n−2)² (बाजूंच्या मधले), एकही नाही = (n−2)³ (आतले). चारही बेरीज = n³, ही तपासणी नक्की करा.',
    steps:[`इथे n = ${n} (प्रत्येक कडेवर ${n} लहान घन).`,askK===3?'तीन बाजू रंगलेले फक्त कोपऱ्यातले: घनाला 8 कोपरे ⇒ 8.':askK===2?`दोन बाजू रंगलेले कडांवर, कोपरे सोडून: 12 कडा × (${n} − 2) = ${ans}.`:askK===1?`एक बाजू रंगलेले प्रत्येक बाजूच्या मधोमध: 6 बाजू × (${n} − 2)² = ${ans}.`:`एकही बाजू न रंगलेले आतले: (${n} − 2)³ = ${ans}.`,`तपासणी: 8 + ${vals[2]} + ${vals[1]} + ${vals[0]} = ${n**3} ✔`]});
}

// ── मनोरा (NMMS प्रकार): संख्या/अक्षरांचे गट मनोऱ्यात एकच आकार बनवतात; तो आकार सरकतो किंवा आरशासारखा उलटतो ──
DIR.manora='सोबत दिलेल्या मनोऱ्याचे निरीक्षण करा. त्याखाली दिलेल्या प्रश्नांच्या उत्तरासाठी योग्य पर्याय निवडा.';
TRICK.manora='प्रश्नातील प्रत्येक गटाचे अंक/अक्षरं मनोऱ्यात पेन्सिलने जोडून पाहा: सगळे गट एकच आकार बनवतात. पहिल्या दोन गटांत तो आकार कसा हलला (किती ओळी वर/खाली, किती जागा डावी/उजवीकडे, की मधल्या उभ्या रेषेवर उलटला) ते पाहा आणि तोच बदल पुढच्या गटाला करा. क्रमही तोच ठेवा: पर्यायांत तीच अक्षरं उलट्या क्रमाने हमखास असतात.';
const MSHAPES={
  row3:{nm:'एका ओळीतील लगतचे तीन',o:[[0,0],[0,2],[0,4]]},
  diag3:{nm:'उजवीकडे खाली जाणारी तिरपी रेषा',o:[[0,0],[1,1],[2,2]]},
  tri3:{nm:'त्रिकोण: एक वर, दोन खाली',o:[[0,0],[1,-1],[1,1]]},
  vtri3:{nm:'उलटा त्रिकोण: दोन वर, एक खाली',o:[[0,0],[0,2],[1,1]]},
  dia4:{nm:'समभुज चौकोन: वर, डावी, खाली, उजवी',o:[[0,0],[1,-1],[2,0],[1,1]]},
  para4:{nm:'समांतरभुज चौकोन: वर दोन, खाली दोन',o:[[0,0],[0,2],[1,3],[1,1]]},
  line4:{nm:'डावीकडे खाली जाणारी तिरपी रेषा',o:[[0,0],[1,-1],[2,-2],[3,-3]]},
};
function buildPyramid(l){
  const letters=l>0&&Math.random()<0.5;
  const shape=l===0?'tri':pick(['tri','tri','dia']);
  const lens=shape==='tri'?Array.from({length:l===0?6:l===1?7:9},(_,i)=>i+1):(m=>[...Array.from({length:m},(_,i)=>i+1),...Array.from({length:m-1},(_,i)=>m-1-i)])(l===2?5:4);
  const fill=pick(l===0?['top']:['top','bottom','zigtop','zigbottom']);
  const start=letters?rnd(0,25):(l===2?rnd(10,40):1);
  const lab=k=>letters?String.fromCharCode(97+md(start+k,26)):String(start+k);
  const cells=[];lens.forEach((n,i)=>{for(let j=0;j<n;j++)cells.push({i,j,u:2*j-n+1});});
  const rowsOrder=fill==='top'||fill==='zigtop'?lens.map((_,i)=>i):lens.map((_,i)=>lens.length-1-i);
  let k=0;rowsOrder.forEach((i,ri)=>{let row=cells.filter(c=>c.i===i);if((fill==='zigtop'||fill==='zigbottom')&&ri%2===1)row=row.reverse();for(const c of row)c.v=lab(k++);});
  const at=new Map(cells.map(c=>[c.i+','+c.u,c]));
  const fillNm={top:'वरून खाली, प्रत्येक ओळ डावीकडून उजवीकडे',bottom:'खालून वर, प्रत्येक ओळ डावीकडून उजवीकडे',zigtop:'वरून खाली, ओळी आलटून पालटून (डावी→उजवी, मग उजवी→डावी)',zigbottom:'खालून वर, ओळी आलटून पालटून (डावी→उजवी, मग उजवी→डावी)'}[fill];
  return {letters,lens,cells,at,R:lens.length,fillNm,maxU:Math.max(...lens)-1};
}
function strOpts(ans,cands){
  const seen=new Set([ans]),figs=[ans],why=[null];
  for(const [v,r] of cands){if(figs.length===4)break;if(v&&!seen.has(v)){seen.add(v);figs.push(v);why.push(r);}}
  return figs.length===4?{figs,why}:null;
}
const grp=(P,anc,sh,step=[0,0],k=0)=>{const out=[];for(const [dy,du] of MSHAPES[sh].o){const c=P.at.get((anc.i+dy+step[0]*k)+','+(anc.u+du+step[1]*k));if(!c)return null;out.push(c);}return out;};
const gStr=(P,g)=>P.letters?g.map(c=>c.v).join(''):g.map(c=>c.v).join(', ');
function pyrSvg(P,marks=[]){
  const W=Math.max(320,P.maxU*20+60),cx=W/2,H=P.R*30+14;
  let s=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="#fff"/>`;
  for(const [g,col] of marks)for(const c of g)s+=`<circle cx="${cx+c.u*18}" cy="${20+c.i*30}" r="12" fill="none" stroke="${col}" stroke-width="2.4"/>`;
  s+=`<g font-family="Times New Roman,serif" font-size="16" font-weight="700" fill="${INK}" text-anchor="middle" dominant-baseline="central">`;
  for(const c of P.cells)s+=`<text x="${cx+c.u*18}" y="${20+c.i*30}">${c.v}</text>`;
  return `<div class="wide" style="--w:${Math.min(W,420)}px">${s}</g></svg></div>`;
}
const mvDesc=([dy,du])=>{const v=dy?`${Math.abs(dy)} ओळ ${dy>0?'खाली':'वर'}`:'',h=du?(dy&&Math.abs(du)===Math.abs(dy)?`तिरपं ${du>0?'उजवीकडे':'डावीकडे'}`:`${Math.abs(du)/2} जागा ${du>0?'उजवीकडे':'डावीकडे'}`):'';return [v,h].filter(Boolean).join(', ')||'जागीच';};
const STEPS=[[0,2],[0,4],[0,-2],[1,1],[1,-1],[2,0],[-1,1],[-1,-1],[-2,0],[1,3],[-1,3]];
const COLS=['#1f5fbf','#7c3aed','#b45309','#15803d'];
function mSeries(P,l){
  for(let t=0;t<200;t++){
    const sh=pick(Object.keys(MSHAPES)),st=pick(STEPS),a0=pick(P.cells);
    const gs=[0,1,2,3].map(k=>grp(P,a0,sh,st,k));if(gs.some(g=>!g))continue;
    const ans=gs[3];const A=gStr(P,ans);
    const other=pick(Object.keys(MSHAPES).filter(x=>x!==sh&&MSHAPES[x].o.length===MSHAPES[sh].o.length))||null;
    const cands=[[gStr(P,ans.slice().reverse()),'अक्षरं/अंक बरोबर, पण क्रम उलटा आहे.'],[gStr(P,gs[2]),'हा तिसरा गटच आहे; पुढे सरकवला नाही.']];
    const g4=grp(P,a0,sh,st,4);if(g4)cands.push([gStr(P,g4),'हा एक पायरी जास्त पुढे गेलेला गट आहे.']);
    const anc3={i:a0.i+st[0]*3,u:a0.u+st[1]*3};if(other){const go=grp(P,anc3,other);if(go)cands.push([gStr(P,go),`जागा जवळपास बरोबर, पण आकार वेगळा (${MSHAPES[other].nm}).`]);}
    const g5=grp(P,a0,sh,[st[0],-st[1]],3);if(g5)cands.push([gStr(P,g5),'चुकीच्या दिशेने सरकवला.']);
    const res=strOpts(A,shuffle(cands));if(!res)continue;
    return {text:`${gs.slice(0,3).map(g=>gStr(P,g)).join(P.letters?', ':' ; ')}${P.letters?', ':' ; '}?`,figs:res.figs,why:res.why,
      steps:[`प्रत्येक गट मनोऱ्यात एकच आकार बनवतो: ${MSHAPES[sh].nm} (खालच्या आकृतीत रंगाने दाखवलं आहे).`,`दर वेळी हा आकार ${mvDesc(st)} सरकतो.`,`म्हणून चौथा गट, त्याच क्रमाने: ${A}.`],
      sol:pyrSvg(P,gs.map((g,k)=>[g,COLS[k]]))};
  }
  return null;
}
function mAnalogy(P,l){
  const T=[{nm:'मधल्या उभ्या रेषेवर आरशासारखा उलटला (डावी बाजू ↔ उजवी बाजू)',f:c=>P.at.get(c.i+','+(-c.u))}];
  if(P.lens[0]===P.lens[P.R-1])T.push({nm:'मधल्या आडव्या रेषेवर उलटला (वर ↔ खाली)',f:c=>P.at.get((P.R-1-c.i)+','+c.u)});
  for(const st of shuffle(STEPS).slice(0,3))T.push({nm:`${mvDesc(st)} सरकला`,f:c=>P.at.get((c.i+st[0])+','+(c.u+st[1]))});
  for(let t=0;t<300;t++){
    const sh=pick(Object.keys(MSHAPES)),ti=rnd(0,T.length-1),Tr=T[ti];
    const A=grp(P,pick(P.cells),sh),C=grp(P,pick(P.cells),sh);if(!A||!C)continue;
    const mapG=(g,f)=>{const o=g.map(f);return o.some(x=>!x)?null:o;};
    const B=mapG(A,Tr.f),D=mapG(C,Tr.f);if(!B||!D)continue;
    const sA=gStr(P,A),sB=gStr(P,B),sC=gStr(P,C),sD=gStr(P,D);
    if(new Set([sA,sB,sC,sD]).size<4)continue;
    const askC=l>0&&Math.random()<0.35;
    const ans=askC?sC:sD,base=askC?D:C;
    const cands=[[gStr(P,(askC?C:D).slice().reverse()),'अक्षरं/अंक बरोबर, पण क्रम उलटा आहे.'],[askC?sD:sC,askC?'हा चौथा गटच आहे.':'हा तिसरा गटच आहे; बदल केला नाही.']];
    T.forEach((o,k)=>{if(k===ti)return;const g=mapG(base,o.f);if(g)cands.push([gStr(P,g),`हा गट "${o.nm}" असा बदल करून मिळतो; पहिल्या जोडीत असा बदल नाही.`]);});
    const res=strOpts(ans,shuffle(cands));if(!res)continue;
    const sep=P.letters?' : ':' : ';
    return {text:askC?`${sA}${sep}${sB} :: ?${sep}${sD}`:`${sA}${sep}${sB} :: ${sC}${sep}?`,figs:res.figs,why:res.why,
      steps:[`"${sA}" आणि "${sB}" मनोऱ्यात शोधा: दोन्ही गट एकच आकार (${MSHAPES[sh].nm}) बनवतात, आणि दुसरा गट पहिल्याचा ${Tr.nm} आहे.`,
        askC?`इथे उलट दिशेने जा: "${sD}" वरून मागे जा ⇒ "${sC}".`:`तोच बदल "${sC}" ला करा, क्रम तोच ठेवून ⇒ "${sD}".`],
      sol:pyrSvg(P,[[A,COLS[0]],[B,COLS[1]],[C,COLS[2]],[D,COLS[3]]])};
  }
  return null;
}
function gManoraSet(l,count){
  const P=buildPyramid(l);const out=[];
  for(let k=0;k<count*3&&out.length<count;k++){
    const q=(Math.random()<0.5?mSeries:mAnalogy)(P,l);if(!q||out.some(o=>o.text===q.text))continue;
    out.push(finish({tid:'manora',lay:'text',text:q.text,q:'',figs:q.figs,why:q.why,render:x=>`<span class="otxt">${x}</span>`,
      steps:[`मनोरा ${P.fillNm} भरला आहे.`,...q.steps],sol:q.sol}));
  }
  return {fig:pyrSvg(P),qs:out,head:`${P.letters?'अक्षरांच्या':'अंकांच्या'} मनोऱ्यात ${P.fillNm} ${P.letters?'अक्षरं':'संख्या'} लिहिल्या आहेत.`};
}

// ── लपलेली आकृती, घडी व कापणी, पारदर्शक कागद ──
Object.assign(DIR,{
  embed:'प्रश्न आकृती उत्तर आकृत्यांपैकी कोणत्या आकृतीत (तसाच आकार व तशीच दिशा ठेवून) लपलेली आहे ते शोधा.',
  cut:'एका चौरसाकृती कागदाला बाणाच्या दिशेने घड्या घालून शेवटच्या आकृतीत दाखवल्याप्रमाणे कापले आहे. कागद पूर्ण उलगडल्यावर कसा दिसेल ते उत्तर आकृतींतून शोधा.',
  transp:'प्रश्न आकृती पारदर्शक कागदावर काढलेली आहे. कागद तुटक रेषेवर बाणाच्या दिशेने दुमडल्यास तो कसा दिसेल ते उत्तर आकृतींतून शोधा.',
});
Object.assign(TRICK,{
  embed:'लपलेली आकृती आहे तशीच शोधायची: तोच आकार, तीच लांबी आणि तीच दिशा. फिरवलेली किंवा उलटी चालत नाही. प्रश्न आकृतीतील सगळ्यात वेगळी खूण (तिरपी रेषा, कोपरा) आधी पर्यायात शोधा आणि तिथून बाकीच्या रेषा एक-एक जुळवा.',
  cut:'कापलेला भाग घडीच्या रेषेला लागून असेल तर उघडल्यावर दोन्ही बाजूंचा मिळून एकच मोठा आकार बनतो (अर्धा आकार → पूर्ण आकार). कागदाच्या कडेला असेल तर प्रत्येक घडीनंतर त्याची आरशातील प्रत समोरच्या कडेला येते. 1 घडी = 2 प्रती, 2 घड्या = 4 प्रती.',
  transp:'पारदर्शक कागदात दोन्ही अर्ध्यांच्या रेषा दिसतात. जो भाग जागीच राहतो त्याच्या रेषा जशाच्या तशा राहतात; दुमडलेल्या भागाच्या रेषा घडीच्या रेषेवर आरशासारख्या उलटून त्याच भागावर येतात. घडीच्या रेषेला चिकटलेली रेषा उलटल्यावरही घडीच्या रेषेलाच चिकटून राहते.',
});
// ── लपलेली आकृती: 6 × 6 बिंदूंच्या जाळीवरील रेषा ──
const LP=p=>10+16*p;
const ek=(a,b)=>{const k1=a[0]+','+a[1],k2=b[0]+','+b[1];return k1<k2?k1+'|'+k2:k2+'|'+k1;};
function unitEdges(segs){const out=[];for(const [a,b] of segs){const dx=Math.sign(b[0]-a[0]),dy=Math.sign(b[1]-a[1]),n=Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));for(let i=0;i<n;i++)out.push([[a[0]+dx*i,a[1]+dy*i],[a[0]+dx*(i+1),a[1]+dy*(i+1)]]);}return out;}
const edgeSet=segs=>new Set(unitEdges(segs).map(([a,b])=>ek(a,b)));
function contains(figSegs,X){const E=edgeSet(figSegs),xe=unitEdges(X);
  for(let tx=-6;tx<=6;tx++)for(let ty=-6;ty<=6;ty++)if(xe.every(([a,b])=>E.has(ek([a[0]+tx,a[1]+ty],[b[0]+tx,b[1]+ty]))))return true;return false;}
const normSegs=X=>{const xs=X.flat().map(p=>p[0]),ys=X.flat().map(p=>p[1]);const mx=Math.min(...xs),my=Math.min(...ys);return X.map(s=>s.map(p=>[p[0]-mx,p[1]-my]));};
const segSig=X=>[...edgeSet(normSegs(X))].sort().join(';');
const TX=[p=>[-p[0],p[1]],p=>[p[0],-p[1]],p=>[-p[1],p[0]],p=>[-p[0],-p[1]],p=>[p[1],-p[0]],p=>[p[1],p[0]],p=>[-p[1],-p[0]]];
const TXN=['आरशासारखी (डावी-उजवी) उलटी','वर-खाली उलटी','90° फिरवलेली','180° फिरवलेली','90° उलट दिशेने फिरवलेली','तिरप्या रेषेवर उलटी','तिरप्या रेषेवर उलटी'];
const DIRS8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
function randX(m){
  for(let t=0;t<200;t++){let p=[0,0];const segs=[];let last=null;
    for(let i=0;i<m;i++){const d=pick(DIRS8.filter(d=>!last||!(d[0]===-last[0]&&d[1]===-last[1])));const len=d[0]&&d[1]?1:rnd(1,2);const q=[p[0]+d[0]*len,p[1]+d[1]*len];segs.push([p,q]);p=q;last=d;}
    const X=normSegs(segs);const xs=X.flat().map(p=>p[0]),ys=X.flat().map(p=>p[1]);
    if(Math.max(...xs)>3||Math.max(...ys)>3)continue;
    if(edgeSet(X).size!==unitEdges(X).length)continue;            // रेषा एकमेकांवर येऊ नयेत
    const sig=segSig(X);if(TX.some(f=>segSig(X.map(s=>s.map(f)))===sig))continue;   // फिरवल्यावर तशीच दिसणारी नको
    return X;}
  return null;
}
const place=X=>{const xs=X.flat().map(p=>p[0]),ys=X.flat().map(p=>p[1]);const ox=rnd(0,5-Math.max(...xs)),oy=rnd(0,5-Math.max(...ys));return X.map(s=>s.map(p=>[p[0]+ox,p[1]+oy]));};
function extras(k){const out=[];for(let i=0;i<k;i++){const a=[rnd(0,5),rnd(0,5)];const d=pick(DIRS8);const len=rnd(1,4);const b=[a[0]+d[0]*len,a[1]+d[1]*len];if(b[0]<0||b[0]>5||b[1]<0||b[1]>5){i--;continue;}out.push([a,b]);}return out;}
const segSvg=(S,hl=[])=>`<div class="tile">${svg([],'0 0 100 100',`<rect width="100" height="100" fill="#fff"/>${S.map(([a,b])=>`<line x1="${LP(a[0])}" y1="${LP(a[1])}" x2="${LP(b[0])}" y2="${LP(b[1])}" ${ST(1.6)}/>`).join('')}${hl.map(([a,b])=>`<line x1="${LP(a[0])}" y1="${LP(a[1])}" x2="${LP(b[0])}" y2="${LP(b[1])}" stroke="#15803d" stroke-width="4" vector-effect="non-scaling-stroke" stroke-linecap="round"/>`).join('')}`)}</div>`;
function gEmbed(l){
  const X=randX([3,4,5][l]);if(!X)return null;const ne=[5,7,9][l];
  if(Math.random()<0.6){   // प्रकार 1: साधी आकृती, कोणत्या गुंतागुंतीच्या आकृतीत लपली आहे?
    const XP=place(X);const ans=XP.concat(extras(ne));
    const figs=[ans],why=[null];
    for(const ti of shuffle([0,1,2,3,4,5])){if(figs.length===4)break;const Y=normSegs(X.map(s=>s.map(TX[ti])));
      for(let t=0;t<30;t++){const F=place(Y).concat(extras(ne));if(!contains(F,X)){figs.push(F);why.push(`यात प्रश्न आकृती ${TXN[ti]} आहे; तशीच (त्याच दिशेने) नाही.`);break;}}}
    if(figs.length<4)return null;
    return finish({tid:'embed',lay:'textfig',text:'प्रश्न आकृती कोणत्या उत्तर आकृतीत लपलेली आहे?',q:segSvg(X.map(s=>s.map(p=>[p[0]+1,p[1]+1]))),figs,why,render:F=>segSvg(F),
      sol:segSvg(ans,XP),steps:['प्रश्न आकृतीची सगळ्यात वेगळी खूण (तिरपी रेषा / कोपरा) निवडा आणि ती पर्यायांत त्याच दिशेने शोधा.','तिथून प्रत्येक रेषा त्याच लांबीची आणि त्याच दिशेची आहे का ते तपासा.','बरोबर पर्यायात लपलेली आकृती वर हिरव्या रंगात दाखवली आहे.']});
  }
  // प्रकार 2: गुंतागुंतीची आकृती दिली; त्यात कोणती लहान आकृती लपलेली आहे?
  const XP=place(X);const big=XP.concat(extras(ne+1));
  const figs=[X],why=[null];
  for(const ti of shuffle([0,1,2,3,4,5])){if(figs.length===4)break;const Y=normSegs(X.map(s=>s.map(TX[ti])));if(!contains(big,Y)&&segSig(Y)!==segSig(X)){figs.push(Y);why.push(`ही आकृती ${TXN[ti]} आहे; प्रश्न आकृतीत ती या दिशेने नाही.`);}}
  if(figs.length<4)return null;
  return finish({tid:'embed',lay:'textfig',text:'खालीलपैकी कोणती उत्तर आकृती प्रश्न आकृतीत लपलेली आहे?',q:segSvg(big),figs,why,render:F=>segSvg(F.map(s=>s.map(p=>[p[0]+1,p[1]+1]))),
    sol:segSvg(big,XP),steps:['प्रत्येक पर्याय त्याच दिशेने प्रश्न आकृतीत शोधा; फिरवायचा नाही.','फक्त एकाच पर्यायाच्या सगळ्या रेषा प्रश्न आकृतीत तशाच सापडतात (वर हिरव्या रंगात).']});
}
// ── घडी व कापणी ──
const B4=v=>v===0?4:v===100?96:v;
function makeCuts(Rg,k){
  const x0=B4(Rg.x0),x1=B4(Rg.x1),y0=B4(Rg.y0),y1=B4(Rg.y1);
  const sides=k===1?[pick(['top','bottom','left','right','c00','c10','c01','c11'])]:shuffle(['top','bottom','left','right']).slice(0,2);
  return sides.map(sd=>{
    const map=sd==='top'?(u,v)=>[x0+u,y0+v]:sd==='bottom'?(u,v)=>[x0+u,y1-v]:sd==='left'?(u,v)=>[x0+v,y0+u]:sd==='right'?(u,v)=>[x1-v,y0+u]
      :sd==='c00'?(u,v)=>[x0+u,y0+v]:sd==='c10'?(u,v)=>[x1-u,y0+v]:sd==='c01'?(u,v)=>[x0+u,y1-v]:(u,v)=>[x1-u,y1-v];
    let s,f;
    if(sd[0]==='c'){const a=rnd(10,16);let b=rnd(10,16);if(b===a)b+=4;s=[[a,0],[0,b]];f=[[a,-3],[-3,-3],[-3,b],[0,b],[a,0]];}
    else{const L=(sd==='top'||sd==='bottom')?x1-x0:y1-y0,D=(sd==='top'||sd==='bottom')?y1-y0:x1-x0;
      const w=Math.min(rnd(12,18),L*0.5),d=Math.min(rnd(9,14),D*0.4),c=L*(0.4+Math.random()*0.2);
      const kind=pick(['v','rect','step','semi']);
      if(kind==='v')s=[[c-w/2,0],[c+w*(Math.random()<0.5?-0.3:0.3),d],[c+w/2,0]];
      else if(kind==='rect')s=[[c-w/2,0],[c-w/2,d],[c+w/2,d],[c+w/2,0]];
      else if(kind==='step')s=[[c-w/2,0],[c-w/2,d],[c,d],[c,d/2],[c+w/2,d/2],[c+w/2,0]];
      else s=Array.from({length:9},(_,i)=>{const t=Math.PI*(1-i/8);return [c+w/2*Math.cos(t),d*Math.sin(t)];});
      f=[[s[0][0],-3],...s,[s[s.length-1][0],-3]];}
    return {s:s.map(p=>map(p[0],p[1])),f:f.map(p=>map(p[0],p[1]))};
  });
}
const cutMir=(C,ax)=>C.map(c=>({s:c.s.map(p=>ax==='x'?[100-p[0],p[1]]:[p[0],100-p[1]]),f:c.f.map(p=>ax==='x'?[100-p[0],p[1]]:[p[0],100-p[1]])}));
const cutClose=(C,axes)=>{let G=C;for(const a of axes)G=G.concat(cutMir(G,a));return G;};
const cutKey=C=>C.map(c=>c.s.map(p=>Math.round(p[0])+','+Math.round(p[1])).sort().join(' ')).sort().join('|');
const pts=P=>P.map(p=>f2(p[0])+','+f2(p[1])).join(' ');
const cutDraw=C=>C.map(c=>`<polygon points="${pts(c.f)}" fill="#fff"/><polyline points="${pts(c.s)}" fill="none" ${ST(1.5)}/>`).join('');
const PAPER4='<rect x="4" y="4" width="92" height="92" fill="#fff" stroke="#111" stroke-width="1.5" vector-effect="non-scaling-stroke"/>';
function gCut(l){
  const vD=['L2R','R2L'],hD=['T2B','B2T'];
  const seq=l===0?[pick([...vD,...hD])]:l===1?(Math.random()<0.5?[pick([...vD,...hD])]:shuffle([pick(vD),pick(hD)])):shuffle([pick(vD),pick(hD)]);
  const Rg={x0:0,x1:100,y0:0,y1:100};for(const f of seq)Object.assign(Rg,FOLDS[f].keep);
  const C=makeCuts(Rg,l===0?1:2);const axes=seq.map(f=>FOLDS[f].ax);const ans=cutClose(C,axes);
  const cands=[[C,'घड्या उघडल्याच नाहीत; फक्त दुमडलेल्या कागदावरचा काप दाखवला.']];
  if(seq.length===1){const o=axes[0]==='x'?'y':'x';cands.push([cutClose(C,[o]),`चुकीच्या रेषेवर आरसा घेतला: घडी ${axes[0]==='x'?'उभी':'आडवी'} होती.`],[cutClose(C,['x','y']),'काप जास्त: एकाच घडीत प्रत्येक कापाच्या 2 च प्रती येतात.']);}
  else cands.push([cutClose(C,[axes[0]]),'फक्त पहिली घडी उघडली; दुसरी घडी उघडायची राहिली.'],[cutClose(C,[axes[1]]),'फक्त शेवटची घडी उघडली; पहिली घडी उघडायची राहिली.']);
  cands.push([cutClose(C.map(c=>({s:c.s.map(p=>[p[0]+(Rg.x0===0&&Rg.x1===100?0:(Rg.x0===0?50:-50)),p[1]]),f:c.f.map(p=>[p[0]+(Rg.x0===0&&Rg.x1===100?0:(Rg.x0===0?50:-50)),p[1]])})),[]).concat(C),'काप फक्त सरकवला, आरशासारखा उलटला नाही.']);
  const seen=new Set([cutKey(ans)]),figs=[ans],why=[null];
  for(const [G,r] of shuffle(cands)){if(figs.length===4)break;const k=cutKey(G);if(!seen.has(k)){seen.add(k);figs.push(G);why.push(r);}}
  if(figs.length<4)return null;
  const DASHRECT=`<rect x="2" y="2" width="96" height="96" fill="#fff" stroke="#111" stroke-width="1.3" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>`;
  const solid=r=>`<rect x="${B4(r.x0)}" y="${B4(r.y0)}" width="${B4(r.x1)-B4(r.x0)}" height="${B4(r.y1)-B4(r.y0)}" fill="#fff" stroke="#111" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
  const cur={x0:0,x1:100,y0:0,y1:100};const tiles=[];
  for(const f of seq){const F=FOLDS[f];let d=`${AR}${DASHRECT}${solid(cur)}`;
    d+=F.ax==='x'?DASH(50,B4(cur.y0),50,B4(cur.y1))+ARC(foldArrow(f,(cur.y0+cur.y1)/2)):DASH(B4(cur.x0),50,B4(cur.x1),50)+ARC(foldArrow(f,(cur.x0+cur.x1)/2));
    tiles.push(tile([],'0 0 100 100',d));Object.assign(cur,F.keep);}
  tiles.push(tile([],'0 0 100 100',`${DASHRECT}${solid(cur)}${cutDraw(C)}`));
  const onFold=C.some(c=>c.s.some(p=>Math.abs(p[0]-50)<0.5||Math.abs(p[1]-50)<0.5));
  return finish({tid:'cut',lay:'two',q:`<div class="qrow">${tiles.join('<span class="sep">→</span>')}</div>`,figs,why,render:G=>tile([],'0 0 100 100',PAPER4+cutDraw(G)),
    steps:[`घड्यांचा क्रम: ${seq.map((f,i)=>`${i+1}) ${FOLDS[f].nm}`).join(', ')}.`,`${seq.length} घडी ⇒ प्रत्येक कापाच्या ${2**seq.length} प्रती येतात.`,
      ...(onFold?['काप घडीच्या रेषेला लागून आहे, म्हणून उघडल्यावर दोन्ही बाजू मिळून एक मोठा, सममित आकार बनतो.']:[]),
      ...seq.slice().reverse().map(f=>`${FOLDS[f].ax==='x'?'उभी':'आडवी'} घडी उघडा: ${FOLDS[f].to} भागातल्या कापाची आरशातील प्रत ${FOLDS[f].from} भागात येते.`)]});
}
// ── पारदर्शक कागद ──
function gTransp(l){
  const f=pick(Object.keys(FOLDS)),F=FOLDS[f],vert=F.ax==='x';
  const keepLow=vert?F.keep.x0===0:F.keep.y0===0;     // जागीच राहणारा भाग डावा/वरचा आहे का
  const A=[6,22,38,50],Bv=[10,30,50,70,90];
  const half=low=>{const xs=low?A:A.map(v=>100-v);return vert?{xs,ys:Bv}:{xs:Bv,ys:xs};};
  const segsIn=(low,n)=>{const {xs,ys}=half(low);const out=[];const used=new Set();
    for(let i=0;i<50&&out.length<n;i++){const a=[pick(xs),pick(ys)],b=[pick(xs),pick(ys)];if(a[0]===b[0]&&a[1]===b[1])continue;
      if(vert?(a[0]===50&&b[0]===50):(a[1]===50&&b[1]===50))continue;const k=[a,b].map(String).sort().join();if(used.has(k))continue;used.add(k);out.push({k:'seg',x1:a[0],y1:a[1],x2:b[0],y2:b[1]});}return out;};
  const n=[1,2,2][l];
  const keep=segsIn(keepLow,n),move=segsIn(!keepLow,n+(l===2?1:0));
  if(l>0){const {xs,ys}=half(!keepLow);const s=pick(['flag','tdot','arrow','halfc','F','R','rtri']);move.push({k:'sym',s,x:vert?xs[1]:pick([20,50,80]),y:vert?pick([20,50,80]):ys[1],r:pick(ROTS),f:1,z:0.6,fill:false});}
  const mir=G=>vert?H(G):V(G);
  const slide=G=>G.map(e=>{const d=keepLow?-50:50;if(e.k==='seg')return vert?{...e,x1:e.x1+d,x2:e.x2+d}:{...e,y1:e.y1+d,y2:e.y2+d};return vert?{...e,x:e.x+d}:{...e,y:e.y+d};});
  const ans=keep.concat(mir(move));
  const res=distinct(ans,shuffle([[keep.concat(slide(move)),'दुमडलेल्या भागाच्या रेषा फक्त सरकवल्या; घडीच्या रेषेवर आरशासारख्या उलटल्या नाहीत.'],
    [keep,'कागद पारदर्शक आहे, दुमडलेल्या भागाच्या रेषाही दिसायला हव्यात.'],[mir(move),'जागीच राहिलेल्या भागाच्या स्वतःच्या रेषा गायब झाल्या.'],
    [keep.concat(vert?V(slide(move)):H(slide(move))),`दुमडलेल्या रेषा चुकीच्या पद्धतीने उलटल्या: घडी ${vert?'उभी':'आडवी'} आहे, म्हणून ${vert?'डावी-उजवी':'वर-खाली'} उलटायला हव्या.`]]));
  if(!res)return null;
  const vb=vert?(keepLow?'0 0 50 100':'50 0 50 100'):(keepLow?'0 0 100 50':'0 50 100 50');
  const rx=vert?(keepLow?0:50):0,ry=vert?0:(keepLow?0:50),rw=vert?50:100,rh=vert?100:50;
  const border=`<rect x="${rx+1}" y="${ry+1}" width="${rw-2}" height="${rh-2}" fill="#fff" stroke="#111" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
  const q=tile(keep.concat(move),'0 0 100 100',`${AR}<rect x="1" y="1" width="98" height="98" fill="#fff" stroke="#111" stroke-width="1.5" vector-effect="non-scaling-stroke"/>${vert?DASH(50,1,50,99):DASH(1,50,99,50)}${ARC(foldArrow(f,22))}`);
  return finish({tid:'transp',lay:'two',q:`<div class="qrow">${q}</div>`,...res,render:G=>`<div class="tile ${vert?'htile':'wtile2'}">${svg(G,vb,border)}</div>`,
    steps:[`${F.nm} दुमडला, म्हणून ${F.to} बाजूचा भाग जागीच राहतो.`,`${F.to} बाजूच्या रेषा जशाच्या तशा राहतात.`,`${F.from} बाजूच्या रेषा घडीच्या ${vert?'उभ्या':'आडव्या'} रेषेवर आरशासारख्या उलटून ${F.to} बाजूवर येतात (कागद पारदर्शक असल्याने दोन्ही दिसतात).`]});
}
// ── घन: सगळ्या 11 प्रकारच्या घड्या (net) ──
function randNet(){
  const neg=v=>v.map(x=>-x);
  for(let t=0;t<2000;t++){
    const cells=[[0,0]];const has=(x,y)=>cells.some(c=>c[0]===x&&c[1]===y);
    while(cells.length<6){const [x,y]=pick(cells);const [dx,dy]=pick([[1,0],[-1,0],[0,1],[0,-1]]);if(!has(x+dx,y+dy))cells.push([x+dx,y+dy]);}
    const fr=new Map([['0,0',{n:[0,0,1],r:[1,0,0],u:[0,1,0]}]]);const q=['0,0'];
    while(q.length){const k=q.shift();const [x,y]=k.split(',').map(Number);const o=fr.get(k);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nk=(x+dx)+','+(y+dy);if(!has(x+dx,y+dy)||fr.has(nk))continue;
        let n,r,u;if(dx===1){n=o.r;r=neg(o.n);u=o.u;}else if(dx===-1){n=neg(o.r);r=o.n;u=o.u;}else if(dy===1){n=neg(o.u);u=o.n;r=o.r;}else{n=o.u;u=neg(o.n);r=o.r;}
        fr.set(nk,{n,r,u});q.push(nk);}}
    const faces=cells.map(([x,y])=>vk(fr.get(x+','+y).n));
    if(new Set(faces).size!==6)continue;          // दुमडल्यावर दोन चौरस एकमेकांवर येतात = घडी चुकीची
    const mx=Math.min(...cells.map(c=>c[0])),my=Math.min(...cells.map(c=>c[1]));
    return {cells:cells.map(c=>[c[0]-mx,c[1]-my]),faces};
  }
  return null;
}

const TYPES=[
  {id:'series',nm:'क्रमानुसार आकृती',fn:l=>pick([gSerRing,gSerRing,gSerRot,gSerCount])(l)},
  {id:'odd',nm:'विसंगत आकृती',fn:gOdd},
  {id:'analogy',nm:'सहसंबंध',fn:gAnalogy},
  {id:'mirror',nm:'आरशातील प्रतिमा',fn:l=>gMirror(l,false)},
  {id:'water',nm:'पाण्यातील प्रतिमा',fn:l=>gMirror(l,true)},
  {id:'textmirror',nm:'अक्षर-अंक प्रतिमा',fn:gTextMirror},
  {id:'complete',nm:'अपूर्ण आकृती',fn:gComplete},
  {id:'fold',nm:'कागदाची घडी',fn:gFold},
  {id:'count',nm:'आकृती मोजणी',fn:gCount},
  {id:'numfig',nm:'संख्या आकृती',fn:gNumFig},
  {id:'cube',nm:'घन / फासे',fn:gCube},
  {id:'embed',nm:'लपलेली आकृती',fn:gEmbed},
  {id:'cut',nm:'घडी व कापणी',fn:gCut},
  {id:'transp',nm:'पारदर्शक कागद',fn:gTransp},
  {id:'venn',nm:'वेन आकृती (पूर्ण संच)',fn:null},
  {id:'vennrel',nm:'वेन आकृती (संबंध ओळखा)',fn:gVennRel},
  {id:'manora',nm:'मनोरा',fn:null},
];
function make(t,l){for(let i=0;i<300;i++){const q=t.fn(l);if(q)return q;}return null;}


  // ════════════════════════ for the question bank / student app ════════════════════════
  const OPTL = ['A', 'B', 'C', 'D'];
  const LEVELS = ['easy', 'medium', 'hard'];
  // Saved as the question's "explanation" — the student app shows it in 💡 (**bold** + new lines).
  function explText(q) {
    let s = `उत्तर: ${OPTL[q.ans]}\n\n**उत्तर कसं आलं**\n` + q.steps.map((x, i) => `${i + 1}. ${String(x).replace(/<[^>]+>/g, '')}`).join('\n');
    if (q.note) s += '\n' + q.note.map((n, i) => `${OPTL[i]}: ${n}`).join('\n');
    s += '\n\n**बाकी पर्याय का चुकीचे**\n' + q.why.map((w, i) => w ? `${OPTL[i]} – ${w}` : '').filter(Boolean).join('\n');
    return s + `\n\n🔑 **युक्ती:** ${q.trick || TRICK[q.tid]}`;
  }
  const questionText = q => (DIR[q.tid] || '') + (q.text ? ` ${q.text}` : '');

  // Correct answers spread evenly over A–D in random order, so no letter is "usually the answer".
  function moveAnswer(q, to) {
    const from = q.ans; if (from === to) return;
    const swap = a => { if (!a) return a; const b = a.slice(); [b[from], b[to]] = [b[to], b[from]]; return b; };
    q.opts = swap(q.opts); q.raw = swap(q.raw); q.why = swap(q.why); q.note = swap(q.note); q.ans = to;
  }
  function balanceAnswers(qs) {
    let slots = [];
    while (slots.length < qs.length) slots.push(...shuffle([0, 1, 2, 3]));
    slots = shuffle(slots.slice(0, qs.length));
    qs.forEach((q, i) => moveAnswer(q, slots[i]));
  }

  // ── figure HTML (as the generator draws it) → one PNG ──
  const RS = { tile: [150, 150], big: [230, 230], wtile: [270, 81], vtile: [160, 128], htile: [80, 160], wtile2: [160, 80] };
  const sizeOf = el => { for (const k of ['big', 'wtile', 'vtile', 'htile', 'wtile2']) if (el.classList.contains(k)) return RS[k]; return RS.tile; };
  // strokes scale with the picture, so lines look the same however big the app shows it
  const nestSvg = (svgEl, x, y, w, h) => svgEl.outerHTML.replace(/vector-effect="non-scaling-stroke"/g, '').replace(/^<svg\b/, `<svg x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}"`);
  function hatch(x, y, w, h, vert) {
    let s = vert ? `<line x1="${x + 2}" y1="${y}" x2="${x + 2}" y2="${y + h}" stroke="#111" stroke-width="3"/>` : `<line x1="${x}" y1="${y + 2}" x2="${x + w}" y2="${y + 2}" stroke="#111" stroke-width="3"/>`;
    if (vert) for (let t = 0; t < h; t += 7) s += `<line x1="${x + 2}" y1="${y + t}" x2="${x + w}" y2="${y + t + 7}" stroke="#111" stroke-width="1.2"/>`;
    else for (let t = 0; t < w; t += 7) s += `<line x1="${x + t}" y1="${y + 2}" x2="${x + t + 7}" y2="${y + h}" stroke="#111" stroke-width="1.2"/>`;
    return s;
  }
  function layout(el) {
    const c = el.classList;
    if (c.contains('qrow') || c.contains('qcol')) {
      const row = c.contains('qrow'), gap = 10;
      const kids = [...el.children].map(layout).filter(Boolean);
      if (!kids.length) return null;
      const W = row ? kids.reduce((s, k) => s + k.w, 0) + gap * (kids.length - 1) : Math.max(...kids.map(k => k.w));
      const H = row ? Math.max(...kids.map(k => k.h)) : kids.reduce((s, k) => s + k.h, 0) + gap * (kids.length - 1);
      return { w: W, h: H, draw: (x, y) => { let o = '', cx = x, cy = y; for (const k of kids) { if (row) { o += k.draw(cx, y + (H - k.h) / 2); cx += k.w + gap; } else { o += k.draw(x + (W - k.w) / 2, cy); cy += k.h + gap; } } return o; } };
    }
    if (c.contains('sep')) {
      const t = el.textContent.trim(), w = t.length > 1 ? 34 : 20;
      return { w, h: 40, draw: (x, y) => `<text x="${x + w / 2}" y="${y + 20}" font-size="30" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="#111" font-family="Arial,sans-serif">${esc(t)}</text>` };
    }
    if (c.contains('mirror')) { const v = c.contains('v'); const w = v ? 18 : RS.tile[0], h = v ? RS.tile[1] : 18; return { w, h, draw: (x, y) => hatch(x, y, w, h, v) }; }
    if (c.contains('wide')) {
      const s = el.querySelector('svg'); if (!s) return null;
      const vb = s.getAttribute('viewBox').split(/[\s,]+/).map(Number);
      const w = (parseFloat(el.style.getPropertyValue('--w')) || 240) * 1.6, h = w * vb[3] / vb[2];
      return { w, h, draw: (x, y) => nestSvg(s, x, y, w, h) };
    }
    if (c.contains('tile')) {
      const [w, h] = sizeOf(el), s = el.querySelector('svg'), qm = c.contains('qm');
      return { w, h, draw: (x, y) => `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" fill="#fff" stroke="#111" stroke-width="2.5"/>` +
        (qm ? `<text x="${x + w / 2}" y="${y + h / 2 + 3}" font-size="${h * 0.55}" font-weight="700" text-anchor="middle" dominant-baseline="central" font-family="Georgia,serif" fill="#111">?</text>` : s ? nestSvg(s, x + 3, y + 3, w - 6, h - 6) : '') };
    }
    if (el.children.length === 1) return layout(el.children[0]);
    return null;
  }
  async function htmlToPng(html) {
    const box = document.createElement('div'); box.innerHTML = html;
    const L = box.children.length === 1 ? layout(box.children[0]) : layout(Object.assign(document.createElement('div'), { className: 'qrow', innerHTML: html }));
    if (!L) return null;
    const P = 8, W = Math.ceil(L.w + 2 * P), H = Math.ceil(L.h + 2 * P);
    const svgTxt = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${L.draw(P, P)}</svg>`;
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgTxt); await img.decode();
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H);
    return cv.toDataURL('image/png');
  }
  // data URLs → Cloudinary URLs (same picture uploaded once; 8 per request)
  async function uploadAll(list, onProgress) {
    const uniq = [...new Set(list.filter(Boolean))], map = new Map();
    for (let i = 0; i < uniq.length; i += 8) {
      const part = uniq.slice(i, i + 8);
      const urls = await API.uploadFigures(part);
      part.forEach((d, k) => map.set(d, urls[k]));
      onProgress?.(Math.min(i + 8, uniq.length), uniq.length);
    }
    return map;
  }
  // generator questions → question-bank records (no q_id yet; DB.saveQuestion gives one)
  async function toBankQuestions(list, meta, onProgress) {
    const pics = [];
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      const qImg = q.q ? await htmlToPng(q.q) : null;
      const oImg = q.lay === 'text' ? [null, null, null, null] : await Promise.all(q.opts.map(htmlToPng));
      pics.push({ qImg, oImg });
      onProgress?.('draw', i + 1, list.length);
    }
    const map = await uploadAll(pics.flatMap(p => [p.qImg, ...p.oImg]), (a, b) => onProgress?.('upload', a, b));
    return list.map((q, i) => {
      const p = pics[i], textOpts = q.lay === 'text';
      return {
        question: questionText(q),
        image: p.qImg ? map.get(p.qImg) : null,
        type: 'mcq',
        difficulty: LEVELS[meta.level] || 'medium',
        batch: meta.batch || '', subject: meta.subject || '', chapter: meta.chapter || '',
        tags: ['reasoning', q.tid],
        options: textOpts ? { A: String(q.raw[0]), B: String(q.raw[1]), C: String(q.raw[2]), D: String(q.raw[3]) } : { A: '', B: '', C: '', D: '' },
        option_images: textOpts ? { A: null, B: null, C: null, D: null } : { A: map.get(p.oImg[0]), B: map.get(p.oImg[1]), C: map.get(p.oImg[2]), D: map.get(p.oImg[3]) },
        answer: OPTL[q.ans],
        explanation: explText(q),
      };
    });
  }

  // ════════════════════════ admin panel (Create Quiz › step 2 › "🧩 Reasoning प्रश्न") ════════════════════════
  function _css() {
    if (document.getElementById('figgen-css')) return;
    const st = document.createElement('style'); st.id = 'figgen-css';
    st.textContent = `
.fg-panel{display:flex;flex-direction:column;gap:10px}
.fg-lab{font-size:.75rem;font-weight:700;color:var(--text2);margin:0 0 4px}
.fg-chips{display:flex;flex-wrap:wrap;gap:5px}
.fg-chip{border:1px solid var(--border);background:var(--bg3);color:var(--text2);border-radius:20px;padding:4px 10px;font:inherit;font-size:.75rem;font-weight:600;cursor:pointer}
.fg-chip[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff}
.fg-row{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}
.fg-list{display:flex;flex-direction:column;gap:8px;max-height:520px;overflow-y:auto;padding-right:2px}
.fg-card{border:1px solid var(--border);border-radius:10px;padding:8px;background:var(--bg3)}
.fg-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px}
.fg-tag{font-size:.7rem;font-weight:700;background:var(--accent);color:#fff;border-radius:6px;padding:1px 7px}
.fg-sp{flex:1}
.fg-note{font-size:.72rem;color:var(--text2)}
.fg-mini{background:#fff;color:#111;border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:5px;overflow-x:auto}
.fg-mini .gtx{margin:0;font-size:.8rem}
.fg-mini .tile{width:52px;height:52px;background:#fff;border:1px solid #222;display:flex;align-items:center;justify-content:center;flex:none}
.fg-mini .tile svg{width:100%;height:100%;display:block}
.fg-mini .tile.big{width:96px;height:96px}.fg-mini .tile.wtile{width:110px;height:33px}.fg-mini .tile.vtile{width:70px;height:56px}.fg-mini .tile.htile{width:30px;height:60px}.fg-mini .tile.wtile2{width:60px;height:30px}
.fg-mini .tile.qm{font:700 28px Georgia,serif;color:#111}
.fg-mini .qrow{display:flex;align-items:center;gap:3px}.fg-mini .qcol{display:flex;flex-direction:column;align-items:center;gap:3px}
.fg-mini .sep{font-weight:700}
.fg-mini .mirror.v{width:8px;align-self:stretch;border-left:2px solid #111;background:repeating-linear-gradient(-45deg,#111 0 1px,transparent 1px 4px)}
.fg-mini .mirror.h{height:8px;width:52px;border-top:2px solid #111;background:repeating-linear-gradient(-45deg,#111 0 1px,transparent 1px 4px)}
.fg-mini .wide svg{width:min(var(--w),230px);height:auto;display:block}
.fg-opts{display:flex;gap:5px;flex-wrap:wrap}
.fg-opt{display:flex;flex-direction:column;align-items:center;font-size:.8rem;border:1.5px solid transparent;border-radius:6px;padding:2px}
.fg-opt.ans{border-color:#15803d;background:#e3f5e8}
.fg-opt small{font-weight:700;color:#555}
.fg-status{font-size:.78rem;color:var(--text2)}`;
    document.head.appendChild(st);
  }
  function _cardHTML(it, i) {
    const q = it.kind === 'set' ? it.qs[0] : it.q;
    const body = it.kind === 'set'
      ? `${it.fig}<p class="gtx">${it.qs.map((x, k) => `${k + 1}) ${esc(x.text)}`).join('<br>')}</p>`
      : `${q.text ? `<p class="gtx">${esc(q.text)}</p>` : ''}${q.q || ''}<div class="fg-opts">${q.opts.map((o, j) => `<span class="fg-opt${j === q.ans ? ' ans' : ''}">${o}<small>${OPTL[j]}</small></span>`).join('')}</div>`;
    return `<div class="fg-card"><div class="fg-head"><span class="fg-tag">${esc(TYPES.find(t => t.id === it.tid)?.nm || it.tid)}</span>${it.kind === 'set' ? `<span class="fg-note">${it.qs.length} प्रश्न · एकच आकृती</span>` : ''}<span class="fg-sp"></span>
      <button type="button" class="admin-btn-secondary" data-fg-re="${i}" title="हा प्रश्न बदला" aria-label="हा प्रश्न बदला">🔄</button>
      <button type="button" class="admin-btn-primary" data-fg-add="${i}">+ जोडा</button></div><div class="fg-mini">${body}</div></div>`;
  }
  // host: element to fill. opts.onAdd(questions, level) → Promise (saves them and puts them in the quiz)
  function mountPanel(host, opts = {}) {
    _css();
    const st = { types: new Set(TYPES.map(t => t.id)), level: 1, count: 10, items: [], busy: false };
    const setOf = (tid, n) => { const s = (tid === 'venn' ? gVennSet : gManoraSet)(st.level, n); return s.qs.length ? { kind: 'set', tid, qs: s.qs.map(q => ({ ...q, q: s.fig })), fig: s.fig } : null; };
    const one = tid => { const q = make(TYPES.find(t => t.id === tid), st.level); return q ? { kind: 'one', tid, q } : null; };
    function generate() {
      const ts = TYPES.filter(t => st.types.has(t.id)), n = st.count;
      const per = ts.map((t, i) => Math.floor(n / ts.length) + (i < n % ts.length ? 1 : 0));
      st.items = [];
      ts.forEach((t, i) => {
        if (!per[i]) return;
        if (t.id === 'venn' || t.id === 'manora') { const s = setOf(t.id, Math.max(2, Math.min(per[i], t.id === 'venn' ? 10 : 4))); if (s) st.items.push(s); }
        else for (let k = 0; k < per[i]; k++) { const it = one(t.id); if (it) st.items.push(it); }
      });
      balanceAnswers(st.items.flatMap(it => it.kind === 'set' ? it.qs : [it.q]));
    }
    function render(status = '') {
      host.innerHTML = `<div class="fg-panel">
        <div><p class="fg-lab">प्रकार</p><div class="fg-chips">${TYPES.map(t => `<button type="button" class="fg-chip" aria-pressed="${st.types.has(t.id)}" data-fg-type="${t.id}">${t.nm}</button>`).join('')}</div></div>
        <div class="fg-row">
          <label class="fg-lab">पातळी<br><select class="admin-select" id="fg-level">${['सोपे', 'मध्यम', 'कठीण'].map((x, i) => `<option value="${i}"${i === st.level ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
          <label class="fg-lab">प्रश्न<br><select class="admin-select" id="fg-count">${[5, 10, 20, 40].map(x => `<option${x === st.count ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
          <button type="button" class="admin-btn-primary" id="fg-go">🎲 तयार करा</button>
          ${st.items.length ? `<button type="button" class="admin-btn-secondary" id="fg-addall">+ सगळे जोडा (${st.items.reduce((s, it) => s + (it.kind === 'set' ? it.qs.length : 1), 0)})</button>` : ''}
        </div>
        <p class="fg-status" id="fg-status">${status || (st.items.length ? 'बरोबर उत्तर हिरव्या चौकटीत. "+ जोडा" केल्यावर प्रश्न चालू Section मध्ये आणि प्रश्न-बँकेत जातात.' : 'प्रकार, पातळी आणि संख्या निवडून "🎲 तयार करा".')}</p>
        <div class="fg-list">${st.items.map(_cardHTML).join('')}</div></div>`;
    }
    async function add(items) {
      if (st.busy || !items.length) return;
      st.busy = true;
      const qs = items.flatMap(it => it.kind === 'set' ? it.qs : [it.q]);
      host.querySelectorAll('button').forEach(b => { b.disabled = true; });
      const stat = host.querySelector('#fg-status');
      try {
        await opts.onAdd(qs, st.level, (stage, a, b) => { if (stat) stat.textContent = stage === 'draw' ? `⏳ आकृत्या तयार होत आहेत… ${a}/${b}` : stage === 'upload' ? `⏳ चित्रं upload होत आहेत… ${a}/${b}` : `⏳ प्रश्न save होत आहेत…`; });
        st.items = st.items.filter(it => !items.includes(it));
        render(`✅ ${qs.length} प्रश्न जोडले.`);
      } catch (err) {
        render(`⚠️ जोडता आले नाहीत: ${err?.message || err}. Internet तपासून पुन्हा "+ जोडा" करा.`);
      } finally { st.busy = false; }
    }
    host.addEventListener('click', e => {
      if (st.busy) return;
      const t = e.target.closest('button'); if (!t || !host.contains(t)) return;
      if (t.dataset.fgType) { const id = t.dataset.fgType; if (st.types.has(id)) { if (st.types.size > 1) st.types.delete(id); } else st.types.add(id); t.setAttribute('aria-pressed', st.types.has(id)); return; }
      if (t.id === 'fg-go') { st.level = +host.querySelector('#fg-level').value; st.count = +host.querySelector('#fg-count').value; generate(); render(); return; }
      if (t.id === 'fg-addall') { add(st.items.slice()); return; }
      if (t.dataset.fgAdd) { add([st.items[+t.dataset.fgAdd]]); return; }
      if (t.dataset.fgRe) { const i = +t.dataset.fgRe, it = st.items[i]; const nx = it.kind === 'set' ? setOf(it.tid, it.qs.length) : one(it.tid); if (nx) st.items[i] = nx; render(); }
    });
    host.addEventListener('change', e => { if (e.target.id === 'fg-level') st.level = +e.target.value; if (e.target.id === 'fg-count') st.count = +e.target.value; });
    render();
  }

  return { TYPES, DIR, TRICK, make, gVennSet, gManoraSet, explText, questionText, balanceAnswers, htmlToPng, uploadAll, toBankQuestions, mountPanel };
})();

window.FIGGEN = FIGGEN;
