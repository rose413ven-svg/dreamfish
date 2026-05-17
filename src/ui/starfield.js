/* ===========================================
   starfield.js — 배경 (그라디언트 + 달 + 별)
   ============================================
   docs/01_슬롯화면_디자인.md [배경] SSOT.
   - 그라디언트 배경
   - 우상단 달 (본체 + 글로우 + 크레이터 3개)
   - 점 별 + 십자 별 (data/stars.js)
   pointer-events: none — 입력 차단 X.
   ============================================ */

import { STAR_POINTS, STAR_CROSSES } from '../data/stars.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** 점 별 1개 (div) */
function createStarPoint(spec) {
  const el = document.createElement('div');
  el.className = 'starfield__point';
  el.style.left = `${spec.x}%`;
  el.style.top = `${spec.y}%`;
  el.style.width = `${spec.size}px`;
  el.style.height = `${spec.size}px`;
  el.style.background = spec.color;
  el.style.opacity = String(spec.opacity);
  return el;
}

/** 십자 별 1개 (SVG, 마름모 8각형) */
function createStarCross(spec) {
  const r = spec.size;
  const d = r * 2;
  const inner = r * 0.15;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('starfield__cross');
  svg.setAttribute('width', String(d));
  svg.setAttribute('height', String(d));
  svg.setAttribute('viewBox', `0 0 ${d} ${d}`);
  svg.style.left = `${spec.x}%`;
  svg.style.top = `${spec.y}%`;
  svg.style.opacity = String(spec.opacity);

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute(
    'd',
    `M${r} 0 ` +
    `L${r + inner} ${r - inner} ` +
    `L${d} ${r} ` +
    `L${r + inner} ${r + inner} ` +
    `L${r} ${d} ` +
    `L${r - inner} ${r + inner} ` +
    `L0 ${r} ` +
    `L${r - inner} ${r - inner} Z`
  );
  path.setAttribute('fill', spec.color);
  svg.appendChild(path);
  return svg;
}

/** 달 (본체 + 크레이터 3개. 글로우는 CSS box-shadow) */
function createMoon() {
  const moon = document.createElement('div');
  moon.className = 'starfield__moon';
  for (let i = 1; i <= 3; i++) {
    const crater = document.createElement('div');
    crater.className = `starfield__crater starfield__crater--${i}`;
    moon.appendChild(crater);
  }
  return moon;
}

/**
 * 배경 컴포넌트 생성.
 * @returns {{ root: HTMLElement }}
 */
export function createStarfield() {
  const root = document.createElement('div');
  root.className = 'starfield';

  root.appendChild(createMoon());
  STAR_POINTS.forEach((s) => root.appendChild(createStarPoint(s)));
  STAR_CROSSES.forEach((s) => root.appendChild(createStarCross(s)));

  return { root };
}
