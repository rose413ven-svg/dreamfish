/* ===========================================
   twinkle-line.js — 꿈조각(트윙클) 매칭 연결선 + 입자 흩날림
   ============================================
   Day 20: golden-line.js 의 톤 변경판 (대표 결정).
   - 구조/타이밍/픽셀좌표 로직은 동일
   - 그라데이션/끝점/입자 색만 흰색 + 연한 푸른빛 글로우 톤
   - 호출처는 slot.js 의 twinkle 클러스터 트리거 분기

   사용:
   - drawTwinkleLine(gridEl, twinkleCells) → Promise (선 끝나면 resolve)
   - startTwinkleParticles(screenEl)       → 화면 전체 입자 (자동 dispose)
   ============================================ */

const LINE_DURATION       = 2500;
const LINE_FADE           = 600;
const PARTICLE_COUNT      = 35;  // ★ Day 21 (대표 결정 ④): 70 → 35 (모바일 GPU 부담 ↓)
const PARTICLE_DURATION   = 3500;
const PARTICLE_FADE       = 800;

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 꿈조각 매칭 셀들을 천천히 연결하는 흰 크리스탈 선 + 별 마커.
 * @param {HTMLElement} gridEl
 * @param {Array<{row:number, col:number}>} twinkleCells
 * @returns {Promise<void>}
 */
export function drawTwinkleLine(gridEl, twinkleCells) {
  return new Promise(resolve => {
    // ★ Day 41 (대표 보고 — 선 연출 간헐적 미표시 버그) — 매칭 직후 호출 시 grid reflow 중이라
    //   getBoundingClientRect 가 width=0/height=0 반환 → 조용히 early return 되는 케이스 방지.
    //   한 프레임 기다린 후 측정 → 정확한 좌표 확보.
    requestAnimationFrame(() => {
      if (!twinkleCells || twinkleCells.length < 2 || !gridEl) {
        resolve();
        return;
      }

    const cellEls = gridEl.querySelectorAll('.slot-cell');
    if (cellEls.length === 0) { resolve(); return; }

    const gridRect = gridEl.getBoundingClientRect();
    const W = gridRect.width;
    const H = gridRect.height;
    if (W <= 0 || H <= 0) { resolve(); return; }

    const cols = parseInt(gridEl.style.getPropertyValue('--slot-cols'), 10) || 5;

    const points = [];
    for (const cell of twinkleCells) {
      const idx = cell.row * cols + cell.col;
      const el = cellEls[idx];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      points.push({
        x: r.left + r.width  / 2 - gridRect.left,
        y: r.top  + r.height / 2 - gridRect.top,
      });
    }
    if (points.length < 2) { resolve(); return; }

    // ── overlay + SVG ────────────────────────────
    const overlay = document.createElement('div');
    overlay.className = 'twinkle-line-overlay';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.classList.add('twinkle-line-svg');

    // defs: 흰색 ~ 연한 푸른빛 그라데이션 + 블러 글로우
    const defs = document.createElementNS(SVG_NS, 'defs');

    const grad = document.createElementNS(SVG_NS, 'linearGradient');
    grad.setAttribute('id', 'twinkleLineGrad');
    grad.setAttribute('x1', '0%'); grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%'); grad.setAttribute('y2', '0%');
    [
      ['0%',   '#B5DCFF'],   // 연한 푸른빛
      ['25%',  '#D7EFFF'],   // 옅은 하늘
      ['50%',  '#FFFFFF'],   // 가장 밝은 흰
      ['75%',  '#D7EFFF'],
      ['100%', '#B5DCFF'],
    ].forEach(([off, col]) => {
      const stop = document.createElementNS(SVG_NS, 'stop');
      stop.setAttribute('offset', off);
      stop.setAttribute('stop-color', col);
      grad.appendChild(stop);
    });
    defs.appendChild(grad);

    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.setAttribute('id', 'twinkleLineGlow');
    filter.setAttribute('x', '-50%'); filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%'); filter.setAttribute('height', '200%');
    const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
    blur.setAttribute('stdDeviation', '4');
    blur.setAttribute('in', 'SourceGraphic');
    filter.appendChild(blur);
    defs.appendChild(filter);

    svg.appendChild(defs);

    // path d 문자열
    let pathData = '';
    points.forEach((p, i) => {
      pathData += (i === 0 ? 'M' : ' L') + ` ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    });

    // 외곽 글로우 path (두꺼움 + 블러, 옅은 하늘색)
    const glowPath = document.createElementNS(SVG_NS, 'path');
    glowPath.setAttribute('d', pathData);
    glowPath.setAttribute('fill', 'none');
    glowPath.setAttribute('stroke', '#D7EFFF');
    glowPath.setAttribute('stroke-width', '10');
    glowPath.setAttribute('stroke-linecap', 'round');
    glowPath.setAttribute('stroke-linejoin', 'round');
    glowPath.setAttribute('opacity', '0.65');
    glowPath.setAttribute('filter', 'url(#twinkleLineGlow)');
    glowPath.classList.add('twinkle-line-glow');

    // 메인 path (그라데이션, 얇음)
    const mainPath = document.createElementNS(SVG_NS, 'path');
    mainPath.setAttribute('d', pathData);
    mainPath.setAttribute('fill', 'none');
    mainPath.setAttribute('stroke', 'url(#twinkleLineGrad)');
    mainPath.setAttribute('stroke-width', '3.5');
    mainPath.setAttribute('stroke-linecap', 'round');
    mainPath.setAttribute('stroke-linejoin', 'round');
    mainPath.classList.add('twinkle-line-main');

    svg.appendChild(glowPath);
    svg.appendChild(mainPath);

    // 끝점 별 마커 (흰색)
    points.forEach((p, i) => {
      const s = 9;
      const star = document.createElementNS(SVG_NS, 'path');
      star.setAttribute('d',
        `M ${p.x} ${p.y - s} ` +
        `L ${p.x + s * 0.30} ${p.y - s * 0.30} ` +
        `L ${p.x + s} ${p.y} ` +
        `L ${p.x + s * 0.30} ${p.y + s * 0.30} ` +
        `L ${p.x} ${p.y + s} ` +
        `L ${p.x - s * 0.30} ${p.y + s * 0.30} ` +
        `L ${p.x - s} ${p.y} ` +
        `L ${p.x - s * 0.30} ${p.y - s * 0.30} Z`
      );
      star.setAttribute('fill', '#FFFFFF');
      star.classList.add('twinkle-line-marker');
      star.style.setProperty('--delay', `${(i * 0.10).toFixed(2)}s`);
      svg.appendChild(star);
    });

    overlay.appendChild(svg);
    gridEl.appendChild(overlay);

    // ★ Day 21 (대표 결정) — 트윙클 연결선 간헐적 누락 동일 픽스 (golden-line.js 동일 패턴):
    //   requestAnimationFrame 으로 감싸 layout 완료 후 getTotalLength 측정.
    //   length=0 이면 dasharray 설정 자체 skip (안전장치).
    requestAnimationFrame(() => {
      const length = mainPath.getTotalLength();
      if (length > 0) {
        glowPath.style.strokeDasharray  = length;
        glowPath.style.strokeDashoffset = length;
        mainPath.style.strokeDasharray  = length;
        mainPath.style.strokeDashoffset = length;
      }

      void overlay.offsetWidth;
      overlay.classList.add('drawing');

      setTimeout(() => {
        resolve();
        overlay.classList.add('fading');
        setTimeout(() => overlay.remove(), LINE_FADE);
      }, LINE_DURATION);
    });
    });   // ★ Day 41 — 외곽 requestAnimationFrame 닫기
  });
}

/**
 * 화면 전체 흰 크리스탈 입자 흩날림 (트윙클 톤).
 * @param {HTMLElement} screenEl
 */
export function startTwinkleParticles(screenEl) {
  if (!screenEl) return;

  const overlay = document.createElement('div');
  overlay.className = 'twinkle-particles-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = document.createElement('span');
    p.className = `twinkle-particle twinkle-particle--${i % 4}`;
    p.style.left = `${Math.random() * 100}%`;
    p.style.top  = `${Math.random() * 100}%`;
    const size = 0.3 + Math.random() * 0.7;
    p.style.setProperty('--size', `${size.toFixed(2)}rem`);
    p.style.setProperty('--drift-x', `${(Math.random() * 16 - 8).toFixed(1)}px`);
    p.style.setProperty('--drift-y', `${(Math.random() * -24 - 8).toFixed(1)}px`);
    p.style.animationDelay = `${(Math.random() * 1.5).toFixed(2)}s`;
    overlay.appendChild(p);
  }

  screenEl.appendChild(overlay);

  setTimeout(() => {
    overlay.classList.add('fading');
    setTimeout(() => overlay.remove(), PARTICLE_FADE);
  }, PARTICLE_DURATION);
}