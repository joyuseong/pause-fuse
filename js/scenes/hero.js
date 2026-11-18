// 장면 01 · 히어로
// 첫 등장은 안쪽 요소(.eyebrow, .wi, .lede, .chips li …)만, 스크롤은 바깥 래퍼(.sx, .line, .beat-2 …)만 움직인다.
// 같은 요소의 같은 속성을 두 타임라인이 함께 건드리면 시작값이 꼬이므로 대상을 나눠 둔다.
import { $$ } from '../util.js';

export function initHero({ gsap, html, ocean, track }) {
  let introTl = null;
  let introDone = false;

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#hero', start: 'top top', end: '+=280%', pin: true, scrub: 0.8, anticipatePin: 1,
      onUpdate(self) {
        if (!introDone && introTl && self.progress > 0.004) { introTl.progress(1); introDone = true; }
        html.classList.toggle('scrolled', self.progress > 0.012);
      },
    },
  });
  track(0, tl.scrollTrigger);

  if (ocean) tl.to(ocean.params, { progress: 1, duration: 1 }, 0);

  // 비트 1 퇴장: 줄마다 다른 속도로 위로 빠져나간다
  tl.to('.beat-1 .sx, .legend', { opacity: 0, y: -22, duration: 0.09, ease: 'power1.in' }, 0.02)
    .to('.beat-1 .mega .line', { yPercent: -160, opacity: 0, duration: 0.17, stagger: 0.028, ease: 'power2.in' }, 0.04);

  // 비트 2: 화면을 채우는 타이포가 단어 단위로 올라온다
  tl.fromTo('.beat-2 .giant .wi', { yPercent: 120 }, { yPercent: 0, duration: 0.2, stagger: 0.045, ease: 'power3.out' }, 0.3)
    .fromTo('.beat-2 .cap', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.1 }, 0.54);
  if (ocean) tl.add(() => ocean.fireEvent({ lead: 0.3 }), 0.36);

  // 비트 2 퇴장: 글자 속으로 통과하듯 커지며 사라진다
  tl.to('.beat-2', { scale: 1.7, opacity: 0, duration: 0.2, ease: 'power2.in' }, 0.76)
    .to('.hero-shade', { opacity: 0, duration: 0.3 }, 0.7)
    .set({}, {}, 1);

  function countUp() {
    $$('.num[data-count]').forEach((el) => {
      const end = Number(el.dataset.count);
      const o = { v: 0 };
      gsap.to(o, { v: end, duration: 1.7, ease: 'power2.out', onUpdate() { el.textContent = Math.round(o.v); } });
    });
  }

  function playIntro() {
    const it = gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete() { introDone = true; } });
    it.to('#gl', { opacity: 1, duration: 2.0, ease: 'power2.out' }, 0)
      .from('.top', { y: -22, opacity: 0, duration: 1.1 }, 0.25)
      .from('.beat-1 .eyebrow', { opacity: 0, x: -18, duration: 1.1 }, 0.45)
      .from('.beat-1 .mega .wi', { yPercent: 120, duration: 1.25, stagger: 0.095 }, 0.6)
      .from('.beat-1 .lede', { opacity: 0, y: 22, duration: 1.1 }, 1.55)
      .from('.chips li', { opacity: 0, y: 20, duration: 0.9, stagger: 0.11 }, 1.8)
      .add(countUp, 1.85)
      .from('.legend > div', { opacity: 0, x: 14, duration: 0.8, stagger: 0.08 }, 2.0)
      // CSS 에 transition 이 걸린 요소는 from() 대신 끝값을 명시한다
      .fromTo('.scroll-cue', { opacity: 0 }, { opacity: 1, duration: 1.0 }, 2.4);
    if (ocean) {
      it.to(ocean.params, { intro: 1, duration: 3.4, ease: 'power3.out' }, 0)
        .add(() => ocean.fireEvent({ lead: 0.4 }), 1.2);   // "연결할 근거"가 뜨는 순간 첫 사건
    }
    introTl = it;
  }

  return { playIntro };
}
