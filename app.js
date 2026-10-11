'use strict';
const $ = id => document.getElementById(id);
const safeRead = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const safeWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

let pages = [];
let current = 0;
let allRevealed = false;
let edits = safeRead('economics-edits-v1', {});
let revealed = new Set();
let hiddenOverrides = new Set();
let svgCache = new Map();
let pageLoads = new Map();
let answersById = new Map();
let pageObserver;
let loadObserver;
let resizeFrame = 0;

const names = ['市場機構・需要と供給','価格メカニズム','需要・供給曲線のシフト','価格弾力性','株式会社のしくみ','会社の種類・会社法','合同会社・企業統治','資金調達・社会的責任','企業の合併・集中','寡占・管理価格','独占禁止法','市場の失敗','インフレ・デフレ','インフレの分類','インフレの影響'];
const graphData = {
  1:[{id:'1-demand',x:137,y:178,w:106,h:81,path:'M6 6 L78 75',label:'D',lx:80,ly:71},{id:'1-supply',x:137,y:550,w:106,h:86,path:'M18 80 L97 2',label:'S',lx:96,ly:14}],
  4:[{id:'4-demand',x:173,y:90,w:30,h:65,path:'M5 2 L22 61',label:'D₂',lx:1,ly:8},{id:'4-supply',x:176,y:439,w:25,h:55,path:'M2 53 L20 2',label:'S₂',lx:4,ly:10}],
  13:[{id:'13-A',x:65,y:231,w:139,h:40,path:'M4 1h12v10H4Z M46 1h12v10H46Z M88 1h12v10H88Z M10 20v4 M52 20v4 M94 20v4 M6 33a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M48 33a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M90 33a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',label:'',lx:0,ly:0},{id:'13-B',x:65,y:322,w:139,h:40,path:'M4 1h12v10H4Z M46 1h12v10H46Z M88 1h12v10H88Z M10 20v4 M52 20v4 M94 20v4 M1 33a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M12 33a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M43 33a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M54 33a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M85 33a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M96 33a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',label:'',lx:0,ly:0}]
};

function value(answer) { return Object.hasOwn(edits, answer.id) ? edits[answer.id] : answer.answer; }
function fitFont(answer, text) {
  const units = [...text].reduce((n, c) => n + (/^[\x00-\x7f]$/.test(c) ? 0.58 : 1), 0);
  return Math.min(answer.size, Math.max(4.5, (answer.w - 2) / Math.max(1, units)));
}
function isRevealed(id) { return allRevealed ? !hiddenOverrides.has(id) : revealed.has(id); }
function answerFor(id) { return answersById.get(id); }

function updateAnswer(button, answer) {
  const hidden = !isRevealed(answer.id);
  const text = value(answer);
  button.classList.toggle('covered', hidden);
  button.setAttribute('aria-expanded', String(!hidden));
  button.setAttribute('aria-label', hidden ? `${answer.n}の答えを表示` : `${answer.n} ${text}。タップで隠す`);
  button.title = hidden ? 'タップで答えを表示' : (answer.note || text);
  button.querySelector('span').textContent = text;
  button.style.fontSize = fitFont(answer, text) + 'px';
}

function updateVisibility() {
  document.querySelectorAll('.answer').forEach(button => {
    const answer = answerFor(button.dataset.id);
    if (answer) updateAnswer(button, answer);
  });
  document.querySelectorAll('.graph-answer').forEach(graph => {
    const hidden = !isRevealed(graph.dataset.id);
    graph.classList.toggle('covered', hidden);
    graph.setAttribute('aria-label', hidden ? 'グラフの解答を表示' : 'グラフの解答を隠す');
    graph.setAttribute('aria-expanded', String(!hidden));
  });
  const toggle = $('toggle-all');
  toggle.textContent = allRevealed ? 'すべて隠す' : 'すべて表示';
  toggle.setAttribute('aria-pressed', String(allRevealed));
}

function toggleAnswer(id) {
  if (allRevealed) {
    if (hiddenOverrides.has(id)) hiddenOverrides.delete(id);
    else hiddenOverrides.add(id);
  } else if (revealed.has(id)) revealed.delete(id);
  else revealed.add(id);
  updateVisibility();
}

function setCurrent(index) {
  if (!pages.length) return;
  current = Math.max(0, Math.min(pages.length - 1, index));
  safeWrite('economics-page-v1', current);
  document.querySelectorAll('.page-tab').forEach((button, i) => {
    const active = i === current;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  const activeTab = document.querySelector(`.page-tab[data-index="${current}"]`);
  activeTab?.scrollIntoView({block:'nearest', inline:'nearest', behavior:'smooth'});
}

function resizePapers() {
  document.querySelectorAll('.sheet-section.is-rendered').forEach(section => {
    const stage = section.querySelector('.paper-stage');
    const paper = section.querySelector('.sheet-paper');
    const canvas = section.querySelector('.sheet-canvas');
    if (!stage || !paper || !canvas) return;
    const scale = Math.min(1.55, stage.clientWidth / 516);
    paper.style.width = `${516 * scale}px`;
    paper.style.height = `${728.64 * scale}px`;
    canvas.style.transform = `scale(${scale})`;
  });
}

function requestResize() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(resizePapers);
}

function noteText(page) {
  const missing = page.answers.filter(a => a.status === 'unfilled').length;
  const unclear = page.answers.filter(a => a.status === 'uncertain').length;
  const supplemented = page.answers.filter(a => a.status === 'supplemented').length;
  return [
    missing ? `写真未記入：${missing}欄（解答は空欄）` : '',
    unclear ? `判読不明：${unclear}欄（要確認）` : '',
    supplemented ? `${supplemented}欄は写真の未記入箇所を文脈・計算から補完` : ''
  ].filter(Boolean).join(' ／ ');
}

function buildPageList() {
  const tabs = $('page-tabs');
  const list = $('pages-list');
  tabs.replaceChildren();
  list.replaceChildren();
  pages.forEach((page, index) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'page-tab';
    tab.dataset.index = String(index);
    tab.textContent = String(page.page);
    tab.setAttribute('aria-label', `${page.page}ページ：${names[index]}`);
    tab.addEventListener('click', () => {
      setCurrent(index);
      const section = document.getElementById(`sheet-${index + 1}`);
      loadPage(index);
      section?.scrollIntoView({behavior:'smooth', block:'start'});
    });
    tabs.append(tab);

    const section = document.createElement('section');
    section.className = 'sheet-section';
    section.id = `sheet-${index + 1}`;
    section.dataset.index = String(index);
    section.setAttribute('aria-label', `${page.page}ページ ${names[index]}`);
    section.innerHTML = `
      <div class="page-caption"><span><b>${page.page}</b>ページ <span class="caption-dot">·</span> ${names[index]}</span><button class="edit-page" type="button">解答を確認・修正</button></div>
      <div class="paper-stage"><div class="sheet-paper"><div class="sheet-canvas"></div></div></div>
      <p class="page-note"></p>`;
    section.querySelector('.edit-page').addEventListener('click', () => {
      setCurrent(index);
      openEditor(index);
    });
    list.append(section);
    if (loadObserver) loadObserver.observe(section);
  });
  setCurrent(0);
  requestResize();
}

function addMask(canvas, mask) {
  const element = document.createElement('span');
  element.className = 'blank-mask';
  Object.assign(element.style, {left:`${mask.x}px`, top:`${mask.y}px`, width:`${mask.w}px`, height:`${mask.h}px`});
  canvas.append(element);
}

function addAnswer(canvas, answer) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `answer ${answer.choice ? 'choice' : ''} ${answer.status || ''}`;
  button.dataset.id = answer.id;
  Object.assign(button.style, {left:`${answer.x}px`, top:`${answer.y}px`, width:`${answer.w}px`, height:`${answer.h}px`});
  button.append(document.createElement('span'));
  button.addEventListener('click', () => toggleAnswer(answer.id));
  canvas.append(button);
  updateAnswer(button, answer);
}

function addGraphAnswer(canvas, graph) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  element.classList.add('graph-answer');
  element.dataset.id = graph.id;
  element.setAttribute('viewBox', `0 0 ${graph.w} ${graph.h}`);
  element.setAttribute('role', 'button');
  element.setAttribute('tabindex', '0');
  Object.assign(element.style, {left:`${graph.x}px`, top:`${graph.y}px`, width:`${graph.w}px`, height:`${graph.h}px`});
  element.innerHTML = `<rect class="graph-mask" width="100%" height="100%"/><path class="graph-line" d="${graph.path}"/><text class="graph-label" x="${graph.lx}" y="${graph.ly}">${graph.label}</text>`;
  const toggle = () => toggleAnswer(graph.id);
  element.addEventListener('click', toggle);
  element.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); }
  });
  canvas.append(element);
}

async function loadPage(index) {
  const section = document.getElementById(`sheet-${index + 1}`);
  if (!section || section.classList.contains('is-rendered')) return;
  if (pageLoads.has(index)) return pageLoads.get(index);
  const task = (async () => {
    const page = pages[index];
    const canvas = section.querySelector('.sheet-canvas');
    try {
      if (!svgCache.has(page.page)) {
        const response = await fetch(`assets/page-${String(page.page).padStart(2, '0')}.svg`);
        if (!response.ok) throw new Error('ページのSVGを読み込めませんでした');
        svgCache.set(page.page, await response.text());
      }
      canvas.innerHTML = svgCache.get(page.page);
      const pageSvg = canvas.querySelector('svg');
      if (pageSvg) pageSvg.setAttribute('aria-hidden', 'true');
      (page.masks || []).forEach(mask => addMask(canvas, mask));
      page.answers.forEach(answer => addAnswer(canvas, answer));
      (graphData[page.page] || []).forEach(graph => addGraphAnswer(canvas, graph));
      section.querySelector('.page-note').textContent = noteText(page);
      section.classList.add('is-rendered');
      updateVisibility();
      requestResize();
    } catch (error) {
      section.querySelector('.sheet-canvas').innerHTML = '';
      section.querySelector('.paper-stage').insertAdjacentHTML('beforeend', `<p class="page-error" role="alert">${error.message}。再読み込みしてください。</p>`);
    } finally {
      pageLoads.delete(index);
    }
  })();
  pageLoads.set(index, task);
  return task;
}

function openEditor(index = current) {
  current = index;
  const page = pages[index];
  $('editor-title').textContent = `${page.page}ページ · ${names[index]}`;
  const list = $('answer-list');
  list.replaceChildren();
  page.answers.forEach(answer => {
    const row = document.createElement('div');
    row.className = 'edit-row';
    const label = document.createElement('label');
    label.htmlFor = `edit-${answer.id}`;
    label.textContent = answer.context || answer.n || answer.id;
    const input = document.createElement('input');
    input.id = `edit-${answer.id}`;
    input.value = value(answer);
    input.autocomplete = 'off';
    input.addEventListener('input', () => {
      edits[answer.id] = input.value;
      safeWrite('economics-edits-v1', edits);
      document.querySelectorAll(`.answer[data-id="${CSS.escape(answer.id)}"]`).forEach(button => updateAnswer(button, answer));
    });
    row.append(label, input);
    if (answer.note || ['supplemented','unfilled','uncertain'].includes(answer.status)) {
      const small = document.createElement('small');
      small.textContent = ({supplemented:'補完：写真では未記入',unfilled:'写真では未記入',uncertain:'判読不明'})[answer.status] || answer.note;
      row.append(small);
    }
    list.append(row);
  });
  $('editor').showModal();
}

function observePages() {
  pageObserver = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) setCurrent(Number(visible.target.dataset.index));
  }, {rootMargin:'-30% 0px -55% 0px', threshold:[0, 0.1, 0.35, 0.6]});
  document.querySelectorAll('.sheet-section').forEach(section => pageObserver.observe(section));
}

async function init() {
  try {
    const [dataResponse, glyphResponse] = await Promise.all([fetch('data.json'), fetch('assets/glyph-index.json')]);
    if (!dataResponse.ok || !glyphResponse.ok) throw new Error('教材を読み込めませんでした');
    pages = await dataResponse.json();
    const fonts = await glyphResponse.json();
    pages.forEach(page => page.answers.forEach(answer => answersById.set(answer.id, answer)));
    await Promise.all(fonts.map(async filename => {
      const response = await fetch(`assets/${filename}`);
      if (!response.ok) throw new Error('文字データを読み込めませんでした');
      const xml = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
      if (xml.querySelector('parsererror')) throw new Error('文字データの形式に問題があります');
      $('glyph-store').append(document.importNode(xml.documentElement, true));
    }));
    loadObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const index = Number(entry.target.dataset.index);
          loadPage(index);
          loadObserver.unobserve(entry.target);
        }
      });
    }, {rootMargin:'900px 0px', threshold:0});
    buildPageList();
    observePages();
    await loadPage(0);
    updateVisibility();
  } catch (error) {
    $('load-error').hidden = false;
    $('load-error').textContent = `${error.message}。ページを再読み込みしてください。`;
  }
}

$('toggle-all').addEventListener('click', () => {
  allRevealed = !allRevealed;
  revealed.clear();
  hiddenOverrides.clear();
  updateVisibility();
});
$('close-editor').addEventListener('click', () => $('editor').close());
$('reset-edits').addEventListener('click', () => {
  pages[current]?.answers.forEach(answer => delete edits[answer.id]);
  safeWrite('economics-edits-v1', edits);
  $('editor').close();
  const section = document.getElementById(`sheet-${current + 1}`);
  if (section) {
    section.classList.remove('is-rendered');
    loadPage(current);
  }
});
window.addEventListener('resize', requestResize);
window.addEventListener('scroll', () => {
  if (!loadObserver) return;
  document.querySelectorAll('.sheet-section:not(.is-rendered)').forEach(section => {
    const rect = section.getBoundingClientRect();
    if (rect.top < window.innerHeight + 900 && rect.bottom > -900) loadObserver.observe(section);
  });
}, {passive:true});
init();
