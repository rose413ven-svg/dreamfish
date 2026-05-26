/* ===========================================
   golden-line.js — 황금 매칭 연결선 + 입자 흩날림
   ============================================
   Day 18 후속 (대표 결정) — 완전 재설계:
   - Phase C에서 폐기됐던 drawGoldenLine 재활성 + 디자인 개선
   - 픽셀 좌표 기반 (셀 가운데 정확히 찍음 — 기존 viewBox=none 문제 해결)
   - 황금 그라데이션 + 외곽 블러 글로우 + 끝점 별 마커
   - 천천히 그려짐 (2.5초)
   - 화면 전체 황금 입자 흩날림 (별빛연못 카드 입자와 동일 톤)

   사용:
   - drawGoldenLine(gridEl, goldenCells) → Promise (선 끝나면 resolve)
   - startGoldenParticles(screenEl)       → 화면 전체 입자 (자동 dispose)
   ============================================ */

const LINE_DURATION       = 2500;   // 선 그려짐 시간 (천천히)
const LINE_FADE           = 600;    // 선 fade out
const PARTICLE_COUNT      = 35;     // 입자 개수 — Day 21 (대표 결정 ④): 70 → 35 (모바일 GPU 부담 ↓)
const PARTICLE_DURATION   = 3500;   // 입자 부유 유지 시간
const PARTICLE_FADE       = 800;    // 입자 fade out

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 황금 매칭 셀들을 천천히 연결하는 황금 선 + 별 마커.
 * 픽셀 좌표 기반 (각 셀의 실제 중심 — getBoundingClientRect).
 *
 * @param {HTMLElement} gridEl       - .slot-grid 요소 (cells 컨테이너)
 * @param {Array<{row:number, col:number}>} goldenCells - 황금 클러스터 셀들
 * @returns {Promise<void>} 선 그려짐 끝나면 resolve (fade 는 뒤에서 자동)
 */
export function drawGoldenLine(gridEl, goldenCells) {
  return new Promise(resolve => {
    // ★ Day 41 (대표 보고 — 선 연출 간헐적 미표시 버그) — 매칭 직후 호출 시 grid reflow 중이라
    //   getBoundingClientRect 가 width=0/height=0 반환 → 조용히 early return 되는 케이스 방지.
    //   한 프레임 기다린 후 측정 → 정확한 좌표 확보.
    requestAnimationFrame(() => {
      if (!goldenCells || goldenCells.length < 2 || !gridEl) {
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

    // 각 황금 셀의 픽셀 중심 좌표 (grid 컨테이너 기준)
    const points = [];
    for (const cell of goldenCells) {
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
    overlay.className = 'golden-line-overlay';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.classList.add('golden-line-svg');

    // defs: 그라데이션 + 블러 글로우 필터
    const defs = document.createElementNS(SVG_NS, 'defs');

    const grad = document.createElementNS(SVG_NS, 'linearGradient');
    grad.setAttribute('id', 'goldenLineGrad');
    grad.setAttribute('x1', '0%'); grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%'); grad.setAttribute('y2', '0%');
    [
      ['0%',   '#FFB347'],
      ['25%',  '#FFD96A'],
      ['50%',  '#FFF1B8'],
      ['75%',  '#FFD96A'],
      ['100%', '#FFB347'],
    ].forEach(([off, col]) => {
      const stop = document.createElementNS(SVG_NS, 'stop');
      stop.setAttribute('offset', off);
      stop.setAttribute('stop-color', col);
      grad.appendChild(stop);
    });
    defs.appendChild(grad);

    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.setAttribute('id', 'goldenLineGlow');
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
    glowPath.setAttribute('stroke', '#FFD96A');
    glowPath.setAttribute('stroke-width', '10');
    glowPath.setAttribute('stroke-linecap', 'round');
    glowPath.setAttribute('stroke-linejoin', 'round');
    glowPath.setAttribute('opacity', '0.65');
    glowPath.setAttribute('filter', 'url(#goldenLineGlow)');
    glowPath.classList.add('golden-line-glow');

    // 메인 path (그라데이션, 얇음)
    const mainPath = document.createElementNS(SVG_NS, 'path');
    mainPath.setAttribute('d', pathData);
    mainPath.setAttribute('fill', 'none');
    mainPath.setAttribute('stroke', 'url(#goldenLineGrad)');
    mainPath.setAttribute('stroke-width', '3.5');
    mainPath.setAttribute('stroke-linecap', 'round');
    mainPath.setAttribute('stroke-linejoin', 'round');
    mainPath.classList.add('golden-line-main');

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
      star.setAttribute('fill', '#FFE9A8');
      star.classList.add('golden-line-marker');
      star.style.setProperty('--delay', `${(i * 0.10).toFixed(2)}s`);
      svg.appendChild(star);
    });

    overlay.appendChild(svg);
    gridEl.appendChild(overlay);

    // ★ Day 21 (대표 보고 버그 픽스) — 황금 연결선 간헐적 누락 픽스:
    //   기존: gridEl.appendChild 직후 즉시 mainPath.getTotalLength() 호출
    //         → 일부 모바일 브라우저에서 SVG layout 미완료 시 0 반환
    //         → strokeDasharray=0 / strokeDashoffset=0 → transition 트리거 X → 선 안 보임
    //   변경: requestAnimationFrame 으로 감싸 다음 paint 직전에 측정 (layout 완료 보장)
    //   추가 안전장치: length=0 이면 dasharray 설정 자체 skip (CSS 기본값으로 정상 그려짐)
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
        // 선 그려짐 완료 → resolve (호출자가 팝업 트리거 가능)
        resolve();
        // 자동 fade out + remove (백그라운드)
        overlay.classList.add('fading');
        setTimeout(() => overlay.remove(), LINE_FADE);
      }, LINE_DURATION);
    });
    });   // ★ Day 41 — 외곽 requestAnimationFrame 닫기
  });
}

/**
 * 화면 전체 황금빛 입자 흩날림 (별빛연못 카드 입자와 동일 톤).
 * Promise 반환 X — 자동 dispose (PARTICLE_DURATION + PARTICLE_FADE 후 remove).
 * 호출자: 황금 매칭 발견 시점에 한 번 호출.
 *
 * @param {HTMLElement} screenEl - .slot-screen 또는 비슷한 전체 화면 컨테이너
 */
export function startGoldenParticles(screenEl) {
  if (!screenEl) return;

  const overlay = document.createElement('div');
  overlay.className = 'golden-particles-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = document.createElement('span');
    p.className = `golden-particle golden-particle--${i % 4}`;
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