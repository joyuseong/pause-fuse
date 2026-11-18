// 장면 모듈이 함께 쓰는 작은 도구들
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const debounce = (fn, ms) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };

// 1234 → "1,234"
export const comma = (n) => Math.round(n).toLocaleString('en-US');

// 텍스트를 단어 단위 마스크(.w > .wi)로 감싼다. <em> 같은 안쪽 태그는 유지.
export function splitWords(root) {
  root.setAttribute('aria-label', root.textContent.replace(/\s+/g, ' ').trim());
  const walk = (node) => {
    [...node.childNodes].forEach((ch) => {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        ch.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
          const wi = document.createElement('span'); wi.className = 'wi'; wi.textContent = part;
          w.appendChild(wi); frag.appendChild(w);
        });
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1) walk(ch);
    });
  };
  walk(root);
}

// 각 줄(.line)이 화면 폭을 꽉 채우도록 줄마다 글자 크기를 맞춘다 (높이가 넘치면 전체를 함께 줄임).
export function fitLines(el) {
  if (!el) return;
  const lines = $$('.line', el);
  const W = el.clientWidth;
  if (!W || !lines.length) return;
  const BASE = 100, LH = 1.04;
  lines.forEach((l) => { l.style.fontSize = BASE + 'px'; });
  const raw = lines.map((l) => (BASE * W) / Math.max(l.offsetWidth, 1));
  const cap = Math.min(...raw) * 1.9;                       // 짧은 줄이 지나치게 커지지 않게
  const sizes = raw.map((s) => Math.min(s, cap));
  const total = sizes.reduce((a, s) => a + s * LH, 0);
  const maxH = window.innerHeight * 0.7;
  const k = total > maxH ? maxH / total : 1;
  lines.forEach((l, i) => { l.style.fontSize = (sizes[i] * k).toFixed(2) + 'px'; });
}
