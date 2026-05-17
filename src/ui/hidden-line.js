/* ===========================================
   hidden-line.js — HIDDEN HIT 매칭 연결선 + 입자 흩날림 (★ Day 22 신규)
   ============================================
   golden-line / twinkle-line 패턴 재활용 — 분홍 톤 (HIDDEN HIT 미니게임).
   분홍(rainbow) 매칭 셀들을 잇는 연한 핑크 그라데이션 선 + 화면 전체 분홍 입자.

   - 픽셀 좌표 기반 (셀 가운데 정확히 찍음)
   - 연한 핑크 그라데이션 + 외곽 블러 글로우 + 끝점 별 마커
   - 천천히 그려짐 (2.5초)
   - 화면 전체 분홍 입자 흩날림

   사용:
   - drawHiddenLine(gridEl, hiddenCells) → Promise (선 끝나면 resolve)
   - startHiddenParticles(screenEl)      → 화면 전체 입자 (자동 dispose)

   ★ Day 22 — 황금/트윙클과 동일 RAF 픽스 + PARTICLE_COUNT 35 적용 (Day 21 정책)
   ============================================ */

const LINE_DURATION       = 2500;   // 선 그려짐 시간 (천천히)
const LINE_FADE           = 600;    // 선 fade out
const PARTICLE_COUNT      = 35;     // 입자 개수 — Day 21 정책 (모바일 GPU 부담 ↓)
const PARTICLE_DURATION   = 3500;   // 입자 부유 유지 시간
const PARTICLE_FADE       = 800;    // 입자 fade out

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * HIDDEN HIT 매칭 셀들을 천천히 연결하는 분홍 선 + 별 마커.
 * 픽셀 좌표 기반 (각 셀의 실제 중심 — getBoundingClientRect).
 *
 * @param {HTMLElement} gridEl       - .slot-grid 요소 (cells 컨테이너)
 * @param {Array<{row:number, col:number}>} hiddenCells - 분홍 클러스터 셀들
 * @returns {Promise<void>} 선 그려짐 끝나면 resolve (fade 는 뒤에서 자동)
 */
export function drawHiddenLine(gridEl, hiddenCells) {
  return new Promise(resolve => {
    if (!hiddenCells || hiddenCells.length < 2 || !gridEl) {
      resolve();
      return;
    }

    const cellEls = gridEl.querySelectorAll('.slot-cell');
    if (cellEls.length === 0) {
      resolve();
      return;
    }

    const gridRect = gridEl.getBoundingClientRect();
    const W = gridRect.width;
    const H = gridRect.height;
    if (W <= 0 || H <= 0) { resolve(); return; }

    // cols 추출 (--slot-cols CSS 변수 → 정수)
    const cols = parseInt(gridEl.style.getPropertyValue('--slot-cols'), 10) || 5;

    // 각 분홍 셀의 픽셀 중심 좌표 (grid 컨테이너 기준)
    const points = [];
    for (const cell of hiddenCells) {
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
    overlay.className = 'hidden-line-overlay';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.classList.add('hidden-line-svg');

    // defs: 분홍 그라데이션 + 블러 글로우 필터
    const defs = document.createElementNS(SVG_NS, 'defs');

    const grad = document.createElementNS(SVG_NS, 'linearGradient');
    grad.setAttribute('id', 'hiddenLineGrad');
    grad.setAttribute('x1', '0%'); grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%'); grad.setAttribute('y2', '0%');
    [
      ['0%',   '#FF9DCB'],
      ['25%',  '#FFB8D8'],
      ['50%',  '#FFE0EE'],
      ['75%',  '#FFB8D8'],
      ['100%', '#FF9DCB'],
    ].forEach(([off, col]) => {
      const stop = document.createElementNS(SVG_NS, 'stop');
      stop.setAttribute('offset', off);
      stop.setAttribute('stop-color', col);
      grad.appendChild(stop);
    });
    defs.appendChild(grad);

    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.setAttribute('id', 'hiddenLineGlow');
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

    // 외곽 글로우 path (두꺼움 + 블러)
    const glowPath = document.createElementNS(SVG_NS, 'path');
    glowPath.setAttribute('d', pathData);
    glowPath.setAttribute('fill', 'none');
    glowPath.setAttribute('stroke', '#FFB8D8');
    glowPath.setAttribute('stroke-width', '10');
    glowPath.setAttribute('stroke-linecap', 'round');
    glowPath.setAttribute('stroke-linejoin', 'round');
    glowPath.setAttribute('opacity', '0.65');
    glowPath.setAttribute('filter', 'url(#hiddenLineGlow)');
    glowPath.classList.add('hidden-line-glow');

    // 메인 path (그라데이션, 얇음)
    const mainPath = document.createElementNS(SVG_NS, 'path');
    mainPath.setAttribute('d', pathData);
    mainPath.setAttribute('fill', 'none');
    mainPath.setAttribute('stroke', 'url(#hiddenLineGrad)');
    mainPath.setAttribute('stroke-width', '3.5');
    mainPath.setAttribute('stroke-linecap', 'round');
    mainPath.setAttribute('stroke-linejoin', 'round');
    mainPath.classList.add('hidden-line-main');

    svg.appendChild(glowPath);
    svg.appendChild(mainPath);

    // 끝점 별 마커 (각 셀 가운데 — 작은 4-point 별, 시차 pop-in)
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
      star.setAttribute('fill', '#FFE0EE');
      star.classList.add('hidden-line-marker');
      star.style.setProperty('--delay', `${(i * 0.10).toFixed(2)}s`);
      svg.appendChild(star);
    });

    overlay.appendChild(svg);
    gridEl.appendChild(overlay);

    // ★ Day 21 RAF 픽스 (간헐적 누락 방지) — golden-line / twinkle-line 동일 패턴
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
        // 선 그려짐 완료 → resolve (호출자가 진입 팝업 트리거 가능)
        resolve();
        // 자동 fade out + remove (백그라운드)
        overlay.classList.add('fading');
        setTimeout(() => overlay.remove(), LINE_FADE);
      }, LINE_DURATION);
    });
  });
}

/**
 * 화면 전체 분홍 입자 흩날림 (golden / twinkle 동일 톤).
 * Promise 반환 X — 자동 dispose (PARTICLE_DURATION + PARTICLE_FADE 후 remove).
 * 호출자: 분홍 매칭 발견 시점에 한 번 호출.
 *
 * @param {HTMLElement} screenEl - .slot-screen 또는 비슷한 전체 화면 컨테이너
 */
export function startHiddenParticles(screenEl) {
  if (!screenEl) return;

  const overlay = document.createElement('div');
  overlay.className = 'hidden-particles-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = document.createElement('span');
    p.className = `hidden-particle hidden-particle--${i % 4}`;
    // 화면 전체 분산
    p.style.left = `${Math.random() * 100}%`;
    p.style.top  = `${Math.random() * 100}%`;
    // 다양한 크기 + 타이밍
    const size = 0.3 + Math.random() * 0.7;   // 0.3 ~ 1.0 rem
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