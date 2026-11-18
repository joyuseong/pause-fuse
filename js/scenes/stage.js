// 장면 03~13 · 하나의 고정 무대
// 장면(.layer)들이 같은 화면에 겹쳐 있고, 하나의 스크롤 타임라인(master) 위에 차례로 놓인다.
// 각 장면은 { el, dur, lead, tops, cover, build(tl) } 로 정의한다.
//   dur   : 장면 길이 (타임라인 단위. 1 단위 = 화면 높이 × UNIT 만큼의 스크롤)
//   lead  : 앞 장면이 끝나기 전에 얼마나 먼저 시작하는지 (불투명 배경이 앞 장면을 덮으며 들어올 때)
//   tops  : [시작, 끝, 'ink'|'cu'] — 밝은 배경이 상단을 덮는 동안 로고·진행 막대를 어두운 색으로
//   cover : [시작, 끝] — 불투명 배경이 3D 캔버스를 완전히 가리는 동안 (그동안 3D 그리기를 쉰다)
import { $, $$, comma } from '../util.js';

const UNIT = 0.62;

// 문의 메일 주소. 넣으면 마지막 장면에 "문의 메일 보내기" 버튼이 나타난다. (자료에 연락처가 없어 비워 둠)
export const CONTACT_EMAIL = '';

export function initStage({ gsap, html, ocean, track, setStory }) {
  const stage = $('#stage');
  const P = ocean ? ocean.params : {};       // 3D 가 없어도 같은 타임라인이 돌도록 빈 객체로 대신한다
  const rig = ocean ? ocean.rig : {};
  if (ocean) Object.assign(rig, { x: 41, dist: 8.5, h: 2.6, ahead: 3.6, lift: -1.3, tz: 0 });

  /* ── 도우미 ── */
  const show = (tl, sel, at, o = {}) => tl.fromTo(sel, { autoAlpha: 0, y: o.y ?? 18 },
    { autoAlpha: 1, y: 0, duration: o.d ?? 0.18, stagger: o.s ?? 0, ease: 'power2.out' }, at);
  const hide = (tl, sel, at, o = {}) => tl.to(sel, { autoAlpha: 0, y: o.y ?? -16, duration: o.d ?? 0.14, ease: 'power1.in' }, at);
  const words = (tl, sel, at, o = {}) => tl.fromTo(sel + ' .wi', { yPercent: 120 },
    { yPercent: 0, duration: o.d ?? 0.3, stagger: o.s ?? 0.035, ease: 'power3.out' }, at);
  const clip = (tl, sel, from, to, at, d = 0.34) => tl.fromTo(sel, { clipPath: from }, { clipPath: to, duration: d, ease: 'power2.inOut' }, at);
  const clipOut = (tl, sel, to, at, d = 0.32) => tl.to(sel, { clipPath: to, duration: d, ease: 'power2.in' }, at);
  const count = (tl, el, at, d = 0.45) => {
    const to = Number(el.dataset.to), dec = Number(el.dataset.dec || 0), o = { v: 0 };
    tl.fromTo(o, { v: 0 }, { v: to, duration: d, ease: 'power2.out', onUpdate() { el.textContent = dec ? o.v.toFixed(dec) : comma(o.v); } }, at);
  };
  const env = (tl, hex, at, d = 0.5) => {
    if (!ocean) return;
    const c = ocean.envColor.clone().set(hex);
    tl.to(ocean.envColor, { r: c.r, g: c.g, b: c.b, duration: d }, at);
  };
  const FULL = 'inset(0% 0% 0% 0%)';

  /* ── 장면 정의 ── */
  const defs = [

    // 03 · 같은 사건? — 가까운 두 지점에서 진동과 전기 사건이 되풀이되고, 이름표가 3D 지점을 따라다닌다
    { el: $('#s03'), dur: 3.4, build(tl) {
      tl.set(P, { duel: 1 }, 0.02).set(P, { duel: 0 }, 3.1);
      tl.to(rig, { x: 43.4, dist: 7.0, h: 2.1, duration: 3.4 }, 0);
      show(tl, '#s03 .pins', 0.3, { y: 0, d: 0.25 });
      words(tl, '.s3-a .giant', 0.45, { d: 0.35 });
      hide(tl, '.s3-a', 1.3);
      tl.to('#s03 .pins', { autoAlpha: 0, duration: 0.12 }, 1.3)      // 큰 글자가 나오는 동안은 이름표를 치웠다가
        .to('#s03 .pins', { autoAlpha: 1, duration: 0.15 }, 2.5);    // 마지막 비트에서 다시 보인다
      show(tl, '.s3-b', 1.42, { y: 0, d: 0.1 });
      tl.fromTo('.s3-b .sli', { yPercent: 114 }, { yPercent: 0, duration: 0.24, stagger: 0.17, ease: 'power3.out' }, 1.5);
      show(tl, '.s3-b .txt', 2.05);
      hide(tl, '.s3-b', 2.42);
      show(tl, '.s3-c', 2.52, { y: 0, d: 0.1 });
      show(tl, '.s3-c .duo > div', 2.58, { s: 0.14, y: 30, d: 0.22 });
      show(tl, '.s3-c .src', 2.9);
      hide(tl, '.s3-c', 3.2);
      tl.to('#s03 .pins', { autoAlpha: 0, duration: 0.14 }, 3.2);
    } },

    // 04 · 이름 — 종이색 화면의 PAUSE(일시정지 막대) → 남색 화면의 FUSE(두 선이 하나로)
    { el: $('#s04'), dur: 3.0, lead: 0.3, tops: [[0.28, 1.22, 'ink']], cover: [[0.32, 2.7]], build(tl) {
      clip(tl, '#s4BgA', 'inset(0% 0% 0% 100%)', FULL, 0, 0.3);
      tl.fromTo('.s4-a .bars i', { scaleY: 0 }, { scaleY: 1, duration: 0.3, stagger: 0.08, ease: 'power3.out' }, 0.3);
      show(tl, '.s4-a .word', 0.36, { y: 60, d: 0.3 });
      show(tl, '.s4-a .mean', 0.62);
      hide(tl, '.s4-a', 1.02);
      clip(tl, '#s4BgB', 'inset(100% 0% 0% 0%)', FULL, 0.98, 0.26);
      tl.set('#s4BgA', { autoAlpha: 0 }, 1.26);
      tl.fromTo('.fuse path', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, ease: 'power1.inOut' }, 1.2);
      show(tl, '.s4-b .word', 1.3, { y: 60, d: 0.3 });
      show(tl, '.s4-b .mean', 1.56);
      hide(tl, '.s4-b', 1.98);
      show(tl, '.s4-c .lock', 2.06);
      show(tl, '.s4-c .h1', 2.12, { y: 30, d: 0.24 });
      hide(tl, '.s4-c', 2.58);
      clipOut(tl, '#s4BgB', 'inset(0% 0% 100% 0%)', 2.68);
      // 화면이 가려진 동안 카메라를 케이블 바로 위(다음 장면 자리)로 옮긴다
      tl.to(rig, { x: 44, dist: 0.4, h: 1.05, ahead: 10, lift: 0.15, duration: 1.6, ease: 'power1.inOut' }, 0.6);
      env(tl, 0x04121f, 0.6);
    } },

    // 05 · 작동 방식 — 카메라가 케이블 위를 지나며 네 관문을 통과한다
    { el: $('#s05'), dur: 4.2, build(tl) {
      tl.fromTo(P, { gates: 0 }, { gates: 1, duration: 0.3 }, 0).to(P, { gates: 0, duration: 0.3 }, 3.9);
      tl.fromTo(rig, { x: 44 }, { x: 69, duration: 3.7, immediateRender: false }, 0.2);
      tl.fromTo(P, { gate: -0.59 }, { gate: 3.95, duration: 3.7, immediateRender: false }, 0.2);   // 관문 간격 5.5 에 맞춘 값
      show(tl, '.s5-shade', 0.05, { y: 0 });
      show(tl, '.s5 .eyebrow', 0.1);
      show(tl, '.s5 .io-in', 0.16);
      [0.3, 1.14, 1.96, 2.78].forEach((t, i) => {
        const li = $$('.s5-steps li')[i];
        show(tl, li, t, { y: 40, d: 0.22 });
        hide(tl, li, t + 0.72, { y: -30, d: 0.12 });
      });
      show(tl, '.s5-end', 3.6);
      hide(tl, '.s5', 4.0);
    } },

    // 06 · 실제 제품 — 실제 실행 화면 4장을 카드처럼 넘긴다
    { el: $('#s06'), dur: 4.3, lead: 0.35, tops: [[0.33, 4.02, 'ink']], cover: [[0.37, 3.96]], build(tl) {
      clip(tl, '#s06 > .bg', 'circle(0% at 78% 55%)', 'circle(150% at 78% 55%)', 0, 0.36);
      show(tl, '.s6-txt .eyebrow, .s6-txt .h1', 0.3, { s: 0.06 });
      tl.fromTo('.s6 .card', { yPercent: 70, rotateY: -46, rotateX: 10, autoAlpha: 0 }, {
        yPercent: (i) => i * 3.2, xPercent: (i) => i * 3.4, z: (i) => -i * 90, rotateY: -15, rotateX: 5, autoAlpha: 1,
        duration: 0.4, stagger: 0.06, ease: 'power3.out',
      }, 0.42);
      show(tl, '.s6-caps li', 0.6, { s: 0.05, y: 10 });
      show(tl, '.s6 .fine', 0.8);
      const cards = $$('.s6 .card'), caps = $$('.s6-caps li');
      [0.95, 1.8, 2.6, 3.35].forEach((t, i) => {
        tl.to(caps, { opacity: (j) => (j === i ? 1 : 0.28), duration: 0.12 }, t);
        tl.to(cards[i], { rotateY: -6, rotateX: 2, xPercent: 0, yPercent: 0, z: 40, duration: 0.25, ease: 'power2.out' }, t);
        if (i < 3) tl.to(cards[i], { xPercent: -118, rotateY: -50, autoAlpha: 0, duration: 0.25, ease: 'power2.in' }, t + 0.6);
      });
      hide(tl, '.s6', 3.9, { d: 0.1 });
      clipOut(tl, '#s06 > .bg', 'circle(0% at 22% 50%)', 3.96, 0.34);
      // 가려진 동안 넓은 전경으로
      tl.to(rig, { x: 22, dist: 13, h: 4.6, ahead: 16, lift: 0.2, tz: -3, duration: 1.5, ease: 'power1.inOut' }, 1.0);
      env(tl, 0x0b2740, 1.0);
    } },

    // 07 · 구현 검증
    { el: $('#s07'), dur: 2.6, build(tl) {
      tl.set(P, { autoRig: 1 }, 0.02);     // (위치 0 의 set 은 만들 때 바로 적용되므로 조금 뒤에 둔다)
      tl.to(rig, { x: 27, duration: 2.6 }, 0);
      show(tl, '#s07 > .bg', 0, { y: 0, d: 0.3 });
      show(tl, '.s7 .eyebrow, .s7 .h1', 0.2, { s: 0.06 });
      show(tl, '.s7 .stat', 0.5, { s: 0.14, y: 30 });
      $$('.s7 .stat').forEach((s, i) => $$('.n b', s).forEach((b) => count(tl, b, 0.55 + i * 0.14, 0.5)));
      show(tl, '.s7 .fine', 1.15);
    } },

    // 08 · 정직한 결과 — 줄어든 것과 잃은 것을 같은 크기로
    { el: $('#s08'), dur: 3.1, lead: 0.35, tops: [[0.3, 2.76, 'ink']], cover: [[0.37, 2.72]], build(tl) {
      clip(tl, '#s08 > .bg', 'inset(0% 100% 0% 0%)', FULL, 0, 0.35);
      show(tl, '.s8 .eyebrow', 0.3);
      show(tl, '.s8 .h1', 0.34, { y: 30, d: 0.24 });
      show(tl, '.s8 .chart', 0.62, { s: 0.2, y: 24 });
      tl.fromTo('.s8 .track i', { scaleX: 0 }, { scaleX: 1, duration: 0.4, stagger: 0.09, ease: 'power2.out' }, 0.72);
      $$('.s8 .val').forEach((b, i) => count(tl, b, 0.72 + i * 0.09, 0.4));
      show(tl, '.s8 .badge', 1.25, { s: 0.2, y: 10 });
      show(tl, '.s8 .txt', 1.6);
      show(tl, '.s8 .fine', 1.75);
      hide(tl, '.s8', 2.62, { d: 0.1 });
      clipOut(tl, '#s08 > .bg', 'inset(0% 0% 0% 100%)', 2.7, 0.34);
      tl.to(rig, { x: 30, duration: 2.4 }, 0.3);
    } },

    // 09 · 연구 기록
    { el: $('#s09'), dur: 2.7, build(tl) {
      show(tl, '#s09 > .bg', 0, { y: 0, d: 0.25 });
      tl.to(rig, { x: 33, duration: 2.7 }, 0);
      show(tl, '.s9 .eyebrow, .s9 .h1', 0.15, { s: 0.06 });
      show(tl, '.ledger > div', 0.45, { s: 0.16, y: 20 });
      $$('.ledger dt b').forEach((b, i) => count(tl, b, 0.5 + i * 0.16, 0.55));
      show(tl, '.s9 .fine', 1.35);
      tl.set(P, { autoRig: 0 }, 2.6);
    } },

    // 10 · 특허
    { el: $('#s10'), dur: 2.3, lead: 0.35, tops: [[0.3, 2.3, 'cu']], cover: [[0.37, 2.3]], build(tl) {
      clip(tl, '#s10 > .bg', 'circle(0% at 50% 50%)', 'circle(75% at 50% 50%)', 0, 0.36);
      show(tl, '.s10 .eyebrow, .s10 .h2', 0.3, { s: 0.06 });
      clip(tl, '.patno span', 'inset(0% 100% 0% 0%)', FULL, 0.5, 0.5);
      show(tl, '.kv > div', 1.0, { s: 0.1 });
    } },

    // 11 · 시장·사업 모델
    { el: $('#s11'), dur: 3.6, lead: 0.35, tops: [[0.3, 3.6, 'ink']], cover: [[0, 3.6]], build(tl) {
      clip(tl, '#s11 > .bg', 'inset(100% 0% 0% 0%)', FULL, 0, 0.35);
      show(tl, '.s11-a .eyebrow, .s11-a .h1', 0.3, { s: 0.06 });
      show(tl, '.s11-a .stat', 0.55, { s: 0.14, y: 30 });
      $$('.s11-a .stat').forEach((s, i) => $$('.n b', s).forEach((b) => count(tl, b, 0.6 + i * 0.14, 0.5)));
      show(tl, '.s11-a .fine', 1.15);
      hide(tl, '.s11-a', 1.62);
      show(tl, '.s11-b .eyebrow, .s11-b .h1', 1.76, { s: 0.06 });
      show(tl, '.model li', 2.0, { s: 0.12, y: 26 });
      show(tl, '.goal', 2.5);
      $$('.goal i').forEach((b) => count(tl, b, 2.52, 0.45));
      show(tl, '.s11-b .fine', 2.8);
    } },

    // 12 · 로드맵·목표
    { el: $('#s12'), dur: 3.6, lead: 0.35, cover: [[0, 3.28]], build(tl) {
      clip(tl, '#s12 > .bg', 'inset(0% 0% 0% 100%)', FULL, 0, 0.35);
      show(tl, '.s12-a .eyebrow, .s12-a .h1', 0.3, { s: 0.06 });
      show(tl, '.road li', 0.55, { s: 0.09, y: 20 });
      show(tl, '.s12-a .fine', 1.2);
      hide(tl, '.s12-a', 1.6);
      show(tl, '.s12-b .eyebrow, .s12-b .h1', 1.74, { s: 0.06 });
      show(tl, '.targets > div', 1.98, { s: 0.09, y: 26 });
      $$('.targets .n b').forEach((b, i) => count(tl, b, 2.0 + i * 0.09, 0.45));
      show(tl, '.s12-b .fine', 2.6);
      hide(tl, '.s12-b', 3.16, { d: 0.1 });
      clipOut(tl, '#s12 > .bg', 'inset(0% 0% 100% 0%)', 3.24, 0.34);
      // 가려진 동안 첫 장면과 닮은 전경으로 돌아간다
      tl.to(rig, { x: -12, dist: 11.6, h: 4.2, ahead: 19, lift: 0.1, tz: -3.5, duration: 1.2, ease: 'power1.inOut' }, 0.8);
      env(tl, 0x04121f, 0.8);
    } },

    // 13 · 클로징
    { el: $('#s13'), dur: 2.4, build(tl) {
      tl.set(P, { autoRig: 1 }, 0.05);
      tl.to(rig, { x: -9, dist: 10.6, duration: 2.4 }, 0);
      show(tl, '.s13-shade', 0.1, { y: 0, d: 0.3 });
      words(tl, '.s13 .giant', 0.25, { d: 0.35, s: 0.045 });
      show(tl, '.s13 .cap', 0.95);
      show(tl, '.s13 .cta-row', 1.15);
      show(tl, '.s13 .end', 1.4, { y: 0 });
    } },
  ];

  /* ── 장면을 master 타임라인에 차례로 놓는다 ── */
  let t = 0;
  defs.forEach((d, i) => { d.t0 = i ? t - (d.lead || 0) : 0; t = d.t0 + d.dur; });
  const total = t;

  const master = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: stage, start: 'top top', end: () => '+=' + Math.round(total * UNIT * window.innerHeight),
      pin: true, scrub: 0.7, anticipatePin: 1, invalidateOnRefresh: false,
    },
  });
  defs.forEach((d, i) => {
    const tl = gsap.timeline({ defaults: { ease: 'none' } });
    d.build(tl);
    tl.set({}, {}, d.dur);
    master.set(d.el, { autoAlpha: 1 }, d.t0).add(tl, d.t0);
    if (i < defs.length - 1) master.set(d.el, { autoAlpha: 0 }, d.t0 + d.dur);
  });

  // 앞 장면에서 무대로 넘어오는 한 화면 분량: 카메라를 케이블 기준 리그로 넘기고, 장면 02 의 마지막 문구를 지운다
  const fly = gsap.to(ocean ? rig : {}, {
    mix: 1, ease: 'power1.inOut',
    scrollTrigger: { trigger: stage, start: 'top bottom', end: 'top top', scrub: 0.7 },
  });
  gsap.to('.s2-d', { autoAlpha: 0, ease: 'none', scrollTrigger: { trigger: stage, start: 'top bottom', end: 'top 45%', scrub: true } });
  if (ocean) {
    const c = ocean.envColor.clone().set(0x071d30);     // --navy
    gsap.to(ocean.envColor, { r: c.r, g: c.g, b: c.b, ease: 'none', scrollTrigger: { trigger: stage, start: 'top bottom', end: 'top top', scrub: true } });
  }
  track(2, fly.scrollTrigger, master.scrollTrigger);

  /* ── 현재 장면에 따른 상태: 진행 막대, 상단 색, 3D 쉬기, 이름표 위치 ── */
  const st = master.scrollTrigger;
  const pinE = $('#s3PinE'), pinD = $('#s3PinD'), line = $('#s3Line');
  gsap.ticker.add(() => {
    const inStage = st.isActive || st.progress > 0;
    if (!inStage) {
      if (ocean && P.live < 1) P.live = 1;
      html.classList.remove('top-ink', 'top-cu');
      return;
    }
    const time = master.time();
    let cur = 0, top = '', covered = false;
    defs.forEach((d, i) => {
      const l = time - d.t0;
      if (l >= 0) cur = i;
      if (l < 0 || l > d.dur) return;
      (d.tops || []).forEach(([a, b, k]) => { if (l >= a && l < b) top = k; });
      (d.cover || []).forEach(([a, b]) => { if (l >= a && l < b) covered = true; });
    });
    html.classList.toggle('top-ink', top !== '');
    html.classList.toggle('top-cu', top === 'cu');
    if (ocean) P.live = covered ? 0 : 1;
    setStory(2 + cur, (time - defs[cur].t0) / defs[cur].dur);

    // 장면 03: 이름표와 점선을 3D 두 지점의 화면 위치에 맞춘다
    if (ocean && cur === 0) {
      const e = ocean.screenOf(ocean.duel.pE), d = ocean.screenOf(ocean.duel.pD);
      // 좁은 화면에서 이름표가 화면 밖으로 나가지 않게 가로 위치를 가둔다 (점선은 실제 지점을 가리킨다)
      const m = 66, w = window.innerWidth, cx = (x) => Math.min(w - m, Math.max(m, x)).toFixed(1);
      pinE.style.transform = `translate(${cx(e.x)}px,${e.y.toFixed(1)}px) translate(-50%,calc(-100% - 30px))`;
      pinD.style.transform = `translate(${cx(d.x)}px,${d.y.toFixed(1)}px) translate(-50%,calc(-100% - 30px))`;
      line.setAttribute('x1', d.x.toFixed(1)); line.setAttribute('y1', d.y.toFixed(1));
      line.setAttribute('x2', e.x.toFixed(1)); line.setAttribute('y2', e.y.toFixed(1));
    }
  });

  return { st, total, times: defs.map((d) => ({ id: d.el.id, t0: d.t0, dur: d.dur })) };
}
