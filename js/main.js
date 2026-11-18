// PAUSE-FUSE 새 홈페이지 — 시작점. 장면별 연출은 js/scenes/ 아래에 있다.
import { OceanScene } from './scene.js';
import { $, $$, splitWords, fitLines, debounce } from './util.js';
import { initHero } from './scenes/hero.js';
import { initProblem } from './scenes/problem.js';
import { initStage, CONTACT_EMAIL } from './scenes/stage.js';

const html = document.documentElement;
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
// 주소 뒤에 ?static 을 붙이면 모션 없는 정적 화면을 강제로 볼 수 있다 (저사양 기기·점검용)
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  || new URLSearchParams(location.search).has('static');

// 문의 메일 주소가 정해져 있으면 마지막 장면의 버튼을 켠다
if (CONTACT_EMAIL) {
  const a = $('#ctaMail');
  a.href = 'mailto:' + CONTACT_EMAIL;
  a.hidden = false;
}

// 승인된 장면 구성 (진행 막대 칸 수)
const SCENES = ['히어로', '문제', '같은 사건?', '이름', '작동 방식', '실제 제품', '구현 검증', '정직한 결과', '연구 기록', '특허', '시장·사업 모델', '로드맵·목표', '클로징'];

/* ── 진행 막대 ─────────────────────────────────────────── */
const story = $('#story');
SCENES.forEach(() => {
  const li = document.createElement('li');
  li.appendChild(document.createElement('i'));
  story.appendChild(li);
});
const bars = $$('i', story);
$('#sceneTotal').textContent = String(SCENES.length).padStart(2, '0');

function setStory(index, progress) {
  bars.forEach((b, i) => {
    b.style.transform = `scaleX(${i < index ? 1 : i === index ? Math.max(0, Math.min(1, progress)) : 0})`;
  });
  $('#sceneNo').textContent = String(index + 1).padStart(2, '0');
}

// 장면마다 "시작 ScrollTrigger ~ 끝 ScrollTrigger" 구간을 등록해 두고, 현재 스크롤이 어느 장면인지 계산한다.
const ranges = [];
function track(index, startST, endST) { ranges[index] = { a: startST, b: endST || startST }; }
let stage = null;   // 장면 03~13 은 무대(stage.js)가 자기 타임라인 기준으로 진행 막대를 직접 갱신한다
function updateStory() {
  const y = window.scrollY;
  if (stage && y >= stage.st.start) return;
  let cur = 0, prog = 0;
  ranges.forEach((r, i) => {
    if (!r) return;
    const a = r.a.start, b = r.b.end;
    if (i === 0 || y >= a - 1) { cur = i; prog = (y - a) / Math.max(1, b - a); }
  });
  setStory(cur, prog);
}

/* ── 3D 배경 ───────────────────────────────────────────── */
let ocean = null;
try {
  ocean = new OceanScene($('#gl'), { reduced });
  ocean.start();
  window.__ocean = ocean;   // 콘솔에서 상태를 확인하기 위한 손잡이
} catch (err) {
  console.warn('[PAUSE-FUSE] 3D 장면을 시작하지 못해 정적 배경으로 표시합니다.', err);
  html.classList.add('no-gl');
}

/* ── 시작 ──────────────────────────────────────────────── */
if (!gsap || !ScrollTrigger || reduced) {
  // GSAP 을 못 불러왔거나 모션 축소 설정이면: 고정·스크럽 없이 모든 글을 그대로 보여 준다.
  html.classList.add('ready', 'static');
  setStory(0, 0);
} else {
  boot();
}

function boot() {
  gsap.registerPlugin(ScrollTrigger);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  $$('[data-split]').forEach(splitWords);
  const fitAll = () => $$('[data-fit]').forEach(fitLines);

  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1800))]).then(() => {
    if (html.classList.contains('static')) return;   // 4초 안전장치가 먼저 작동한 경우
    fitAll();
    html.classList.add('ready');

    // 고정 구간이 차례로 쌓이므로 문서 순서대로 만든다
    const ctx = { gsap, ScrollTrigger, html, ocean, track, setStory };
    const hero = initHero(ctx);
    initProblem(ctx);
    stage = initStage(ctx);
    window.__stage = stage;   // 콘솔 점검용

    ScrollTrigger.addEventListener('refresh', updateStory);
    window.addEventListener('scroll', updateStory, { passive: true });
    updateStory();
    hero.playIntro();
  });
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', fitAll);
  window.addEventListener('resize', debounce(() => { fitAll(); ScrollTrigger.refresh(); }, 160));
}
