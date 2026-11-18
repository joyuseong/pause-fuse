// 장면 02 · 문제
// 닻이 케이블에 걸린다 → 구리색 화면 "약 6개월" → 어두운 화면 "5,000만~6,000만 유로" → 이 제품의 자리.
// 3D 쪽 움직임(닻·충격·정전·재통전)은 scene.js 가 params.fly2 / params.s2 값만 보고 만든다.
import { $, comma } from '../util.js';
import { S2 } from '../scene.js';

export function initProblem({ gsap, html, ocean, track }) {
  const sec = $('#scene-02');
  const panelCu = $('#s2PanelCu');
  const elMonths = $('#s2Months'), elLo = $('#s2Lo'), elHi = $('#s2Hi');

  // 장면 01 → 02 이동 (고정 전 한 화면 분량): 카메라가 닻이 내려오는 곳으로 날아간다
  const flyST = { trigger: sec, start: 'top bottom', end: 'top top', scrub: 0.7 };
  let fly = null;
  if (ocean) {
    fly = gsap.to(ocean.params, { fly2: 1, ease: 'none', scrollTrigger: flyST });
    const c = ocean.envColor.clone().set(0x0b2740);     // --navy-2
    gsap.to(ocean.envColor, { r: c.r, g: c.g, b: c.b, ease: 'none', scrollTrigger: { ...flyST, scrub: true } });
  } else {
    fly = gsap.to({}, { duration: 1, scrollTrigger: flyST });
  }

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: sec, start: 'top top', end: '+=540%', pin: true, scrub: 0.8, anticipatePin: 1 },
  });
  track(1, fly.scrollTrigger, tl.scrollTrigger);

  if (ocean) tl.to(ocean.params, { s2: 1, duration: 1 }, 0);

  /* 비트 A · 원인 (0.00 – 0.20) */
  tl.fromTo('.s2-shade', { opacity: 0 }, { opacity: 1, duration: 0.03 }, 0)
    .fromTo('.s2-a .eyebrow', { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.03 }, 0.005)
    .fromTo('.s2-a .sli', { yPercent: 114 }, { yPercent: 0, duration: 0.05, stagger: 0.034, ease: 'power3.out' }, 0.018)
    .fromTo('.s2-a .s2-line, .s2-a .src', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.03, stagger: 0.012 }, 0.122)
    .to('.s2-a', { opacity: 0, xPercent: -5, duration: 0.03, ease: 'power1.in' }, S2.impact - 0.032);

  /* 충격 → 구리색 화면이 충격 지점에서 원형으로 번진다 */
  tl.fromTo(panelCu, { '--r': 0 }, { '--r': 165, duration: 0.07, ease: 'power2.in' }, S2.impact + 0.004);

  /* 비트 B · 약 6개월 */
  const months = { v: 0 };
  tl.fromTo('#s2PanelCu .tag', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.025 }, 0.25)
    .fromTo('#s2PanelCu .bignum > *', { yPercent: 36, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.04, stagger: 0.012, ease: 'power3.out' }, 0.255)
    .fromTo('#s2PanelCu .bigcap', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.03 }, 0.285)
    .fromTo('#s2PanelCu .tline .d0, #s2PanelCu .tline .bar', { opacity: 0 }, { opacity: 1, duration: 0.02 }, 0.295)
    // 숫자와 기간 막대가 같은 속도로 찬다
    .fromTo(months, { v: 0 }, { v: 6, duration: 0.105, onUpdate() { elMonths.textContent = Math.round(months.v); } }, 0.3)
    .fromTo('#s2PanelCu .tline .bar i', { scaleX: 0 }, { scaleX: 1, duration: 0.105 }, 0.3)
    .fromTo('#s2PanelCu .tline .d1', { opacity: 0 }, { opacity: 1, duration: 0.02 }, 0.4)
    .fromTo('#s2PanelCu .foot', { opacity: 0 }, { opacity: 1, duration: 0.03 }, 0.41);

  /* 어두운 화면이 아래에서 덮는다 */
  tl.fromTo('#s2PanelInk', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.06, ease: 'power2.inOut' }, 0.47)
    .set(panelCu, { autoAlpha: 0 }, 0.532);

  /* 비트 C · 5,000만~6,000만 유로 */
  const money = { lo: 0, hi: 0 };
  tl.fromTo('#s2PanelInk .tag', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.025 }, 0.515)
    .fromTo('#s2PanelInk .bigmoney', { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.035, ease: 'power3.out' }, 0.525)
    .fromTo(money, { lo: 0, hi: 0 }, {
      lo: 5000, hi: 6000, duration: 0.11, ease: 'power2.out',
      onUpdate() { elLo.textContent = comma(money.lo); elHi.textContent = comma(money.hi); },
    }, 0.53)
    .fromTo('#s2PanelInk .bigcap', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.03 }, 0.6)
    .fromTo('#s2PanelInk .steps', { opacity: 0 }, { opacity: 1, duration: 0.02 }, 0.605)
    .fromTo('#s2PanelInk .steps li', { opacity: 0.22 }, { opacity: 1, duration: 0.022, stagger: 0.028 }, 0.625)
    .fromTo('#s2PanelInk .foot', { opacity: 0 }, { opacity: 1, duration: 0.03 }, 0.715)
    .to('#s2PanelInk', { autoAlpha: 0, duration: 0.055 }, 0.765);

  /* 비트 D · 이 제품의 자리 (케이블이 다시 켜지는 동안) */
  tl.fromTo('.s2-dshade', { opacity: 0 }, { opacity: 1, duration: 0.05 }, 0.815)
    .fromTo('.s2-d .giant .wi', { yPercent: 120 }, { yPercent: 0, duration: 0.055, stagger: 0.011, ease: 'power3.out' }, 0.83)
    .fromTo('.s2-d .cap', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.03 }, 0.905)
    .fromTo('.s2-d .fine', { opacity: 0 }, { opacity: 1, duration: 0.025 }, 0.925)
    .set({}, {}, 1);

  // 구리색 화면이 상단을 덮는 동안에는 로고·진행 막대를 어두운 색으로 바꾼다
  tl.eventCallback('onUpdate', () => {
    const p = tl.progress();
    html.classList.toggle('on-cu', p > 0.266 && p < 0.526);
  });

  // 구리색 원형 전환의 중심을 3D 충격 지점의 화면 위치에 맞춘다
  if (ocean) {
    gsap.ticker.add(() => {
      const s = ocean.params.s2;
      if (s < S2.impact - 0.08 || s > S2.impact + 0.12) return;
      const p = ocean.screenOf(ocean.impactPoint);
      panelCu.style.setProperty('--ix', p.x.toFixed(1) + 'px');
      panelCu.style.setProperty('--iy', p.y.toFixed(1) + 'px');
    });
  }
}
