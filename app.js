'use strict';
const $ = id => document.getElementById(id);
const safeRead = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const safeWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
let pages = [], current = 0, zoom = 1, sheet = true, generation = 0;
let revealed = new Set(), edits = safeRead('economics-edits-v1', {}), svgCache = new Map();
const names = ['市場機構・需要と供給','価格メカニズム','需要・供給曲線のシフト','価格弾力性','株式会社のしくみ','会社の種類・会社法','合同会社・企業統治','資金調達・社会的責任','企業の合併・集中','寡占・管理価格','独占禁止法','市場の失敗','インフレ・デフレ','インフレの分類','インフレの影響'];
const graphData = {1:[{id:'1-demand',x:137,y:178,w:106,h:81,path:'M6 6 L78 75',label:'D',lx:80,ly:71},{id:'1-supply',x:137,y:550,w:106,h:86,path:'M18 80 L97 2',label:'S',lx:96,ly:14}],4:[{id:'4-demand',x:173,y:90,w:30,h:65,path:'M5 2 L22 61',label:'D₂',lx:1,ly:8},{id:'4-supply',x:176,y:439,w:25,h:55,path:'M2 53 L20 2',label:'S₂',lx:4,ly:10}],13:[{id:'13-A',x:65,y:231,w:139,h:40,path:'M4 1h12v10H4Z M46 1h12v10H46Z M88 1h12v10H88Z M10 20v4 M52 20v4 M94 20v4 M6 33a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M48 33a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M90 33a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',label:'',lx:0,ly:0},{id:'13-B',x:65,y:322,w:139,h:40,path:'M4 1h12v10H4Z M46 1h12v10H46Z M88 1h12v10H88Z M10 20v4 M52 20v4 M94 20v4 M1 33a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M12 33a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M43 33a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M54 33a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M85 33a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M96 33a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',label:'',lx:0,ly:0}]};
function value(a) { return Object.hasOwn(edits,a.id) ? edits[a.id] : a.answer; }
function fitFont(a, text) { let units = [...text].reduce((n,c)=>n+(/^[\x00-\x7f]$/.test(c)?0.58:1),0); return Math.min(a.size, Math.max(4.5,(a.w-2)/Math.max(1,units))); }
function updateAnswer(btn, a) {
 const hidden = sheet && !revealed.has(a.id); const text = value(a);
 btn.classList.toggle('covered',hidden);btn.setAttribute('aria-expanded',String(!hidden));
 btn.setAttribute('aria-label', hidden ? `${a.n}の答えを表示` : `${a.n} ${text}。タップで隠す`);
 btn.title=hidden?'タップで答えを表示':a.note||text;
 btn.querySelector('span').textContent=text;btn.style.fontSize=fitFont(a,text)+'px';
}
function updateVisibility() {
 document.querySelectorAll('.answer').forEach(b=>updateAnswer(b,pages[current].answers.find(a=>a.id===b.dataset.id)));
 document.querySelectorAll('.graph-answer').forEach(g=>{const hidden=sheet&&!revealed.has(g.dataset.id);g.classList.toggle('covered',hidden);g.setAttribute('aria-label',hidden?'グラフの解答を表示':'グラフの解答を隠す');g.setAttribute('aria-expanded',String(!hidden));});
 const total=pages[current].answers.length;const visible=sheet?pages[current].answers.filter(a=>revealed.has(a.id)).length:total;
 $('progress').textContent=`${visible} / ${total} 表示`;
 $('sheet').setAttribute('aria-pressed',String(sheet));$('sheet').textContent=sheet?'赤シート ON':'赤シート OFF';
}
function resize() {
 if(!pages.length)return;const available=$('scroll-area').clientWidth;const fit=Math.min(1.55,available/516);const scale=fit*zoom;
 $('paper').style.transform=`scale(${scale})`;$('page-shell').style.width=516*scale+'px';$('page-shell').style.height=728.64*scale+'px';$('zoom').textContent=Math.round(zoom*100)+'%';
}
async function render(index) {
 current=Math.max(0,Math.min(pages.length-1,index));const token=++generation;const page=pages[current];
 safeWrite('economics-page-v1',current);$('pages').value=String(current);$('prev').disabled=current===0;$('next').disabled=current===pages.length-1;
 $('page-name').textContent=`${page.page}ページ · ${names[current]}`;
 $('paper').setAttribute('aria-label',`${page.page}ページ ${names[current]}`);$('load-error').hidden=true;
 try {
  if(!svgCache.has(page.page)){const res=await fetch(`assets/page-${String(page.page).padStart(2,'0')}.svg`);if(!res.ok)throw new Error('ページデータを読み込めませんでした');svgCache.set(page.page,await res.text());}
  if(token!==generation)return;$('paper').innerHTML=svgCache.get(page.page);
  const svg=$('paper').querySelector('svg');svg.setAttribute('aria-hidden','true');
  for(const m of page.masks||[]){const b=document.createElement('span');b.className='blank-mask';Object.assign(b.style,{left:m.x+'px',top:m.y+'px',width:m.w+'px',height:m.h+'px'});$('paper').append(b);}
  for(const a of page.answers){
   const b=document.createElement('button');b.type='button';b.className=`answer ${a.choice?'choice':''} ${a.status}`;b.dataset.id=a.id;
   Object.assign(b.style,{left:a.x+'px',top:a.y+'px',width:a.w+'px',height:a.h+'px'});b.append(document.createElement('span'));
   b.addEventListener('click',()=>{if(!sheet){sheet=true;page.answers.forEach(x=>revealed.add(x.id));(graphData[page.page]||[]).forEach(g=>revealed.add(g.id));}if(revealed.has(a.id))revealed.delete(a.id);else revealed.add(a.id);updateVisibility();});
   $('paper').append(b);updateAnswer(b,a);
  }
  for(const g of graphData[page.page]||[]){
   const el=document.createElementNS('http://www.w3.org/2000/svg','svg');el.classList.add('graph-answer');el.dataset.id=g.id;el.setAttribute('viewBox',`0 0 ${g.w} ${g.h}`);el.setAttribute('role','button');el.setAttribute('tabindex','0');
   Object.assign(el.style,{left:g.x+'px',top:g.y+'px',width:g.w+'px',height:g.h+'px'});
   el.innerHTML=`<rect width="100%" height="100%" fill="transparent"/><path class="graph-line" d="${g.path}"/><text class="graph-label" x="${g.lx}" y="${g.ly}">${g.label}</text>`;
   const toggle=()=>{if(!sheet){sheet=true;page.answers.forEach(a=>revealed.add(a.id));(graphData[page.page]||[]).forEach(x=>revealed.add(x.id));}if(revealed.has(g.id))revealed.delete(g.id);else revealed.add(g.id);updateVisibility();};
   el.addEventListener('click',toggle);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});$('paper').append(el);
  }
  const missing=page.answers.filter(a=>a.status==='unfilled').length;const unclear=page.answers.filter(a=>a.status==='uncertain').length;const suppl=page.answers.filter(a=>a.status==='supplemented').length;
  $('notes').textContent=[missing?`写真未記入：${missing}欄（未記入のまま）`:'',unclear?`判読不明：${unclear}欄（要確認）`:'',suppl?`茶色の${suppl}欄は、写真未記入を文脈・計算から補完`:''].filter(Boolean).join(' ／ ');
  updateVisibility();resize();$('scroll-area').scrollLeft=0;
 }catch(e){if(token!==generation)return;$('load-error').hidden=false;$('load-error').textContent=e.message+'。ページを選び直すか、再読み込みしてください。';}
}
function editor() {
 $('answer-list').replaceChildren();
 for(const a of pages[current].answers){const row=document.createElement('div');row.className='edit-row';const label=document.createElement('label');label.htmlFor='edit-'+a.id;label.textContent=a.context;const input=document.createElement('input');input.id='edit-'+a.id;input.value=value(a);input.autocomplete='off';input.addEventListener('input',()=>{edits[a.id]=input.value;safeWrite('economics-edits-v1',edits);const b=document.querySelector(`.answer[data-id="${a.id}"]`);if(b)updateAnswer(b,a);});row.append(label,input);if(a.note||a.status==='supplemented'||a.status==='unfilled'||a.status==='uncertain'){const small=document.createElement('small');small.textContent=({supplemented:'補完：写真では未記入',unfilled:'写真では未記入',uncertain:'判読不明'})[a.status]||a.note;row.append(small);}$('answer-list').append(row);}
 $('editor').showModal();
}
$('prev').addEventListener('click',()=>render(current-1));$('next').addEventListener('click',()=>render(current+1));$('pages').addEventListener('change',e=>render(Number(e.target.value)));
$('sheet').addEventListener('click',()=>{sheet=!sheet;if(sheet)revealed.clear();updateVisibility();});
$('hide').addEventListener('click',()=>{sheet=true;revealed.clear();updateVisibility();});$('show').addEventListener('click',()=>{sheet=false;updateVisibility();});
$('zoom-in').addEventListener('click',()=>{zoom=Math.min(3,zoom+.25);resize();});$('zoom-out').addEventListener('click',()=>{zoom=Math.max(.75,zoom-.25);resize();});$('zoom').addEventListener('click',()=>{zoom=1;resize();});
$('edit').addEventListener('click',editor);$('close-editor').addEventListener('click',()=>$('editor').close());$('reset-edits').addEventListener('click',()=>{pages[current].answers.forEach(a=>delete edits[a.id]);safeWrite('economics-edits-v1',edits);$('editor').close();render(current);});
window.addEventListener('resize',resize);document.addEventListener('keydown',e=>{if($('editor').open||e.target.matches('input,select'))return;if(e.key==='ArrowRight')render(current+1);if(e.key==='ArrowLeft')render(current-1);});
(async()=>{try{const [d,g]=await Promise.all([fetch('data.json'),fetch('assets/glyph-index.json')]);if(!d.ok||!g.ok)throw new Error('教材を読み込めませんでした');pages=await d.json();const fonts=await g.json();const symbols=await Promise.all(fonts.map(async f=>{const r=await fetch('assets/'+f);if(!r.ok)throw new Error('文字データを読み込めませんでした');return r.text();}));const parser=new DOMParser();for(const source of symbols){const xml=parser.parseFromString(source,'image/svg+xml');if(xml.querySelector('parsererror'))throw new Error('文字データの形式に問題があります');$('glyph-store').append(document.importNode(xml.documentElement,true));}pages.forEach((p,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`${p.page}. ${names[i]}`;$('pages').append(o);});await render(Number(safeRead('economics-page-v1',0)));}catch(e){$('load-error').hidden=false;$('load-error').textContent=e.message+'。再読み込みしてください。';}})();
