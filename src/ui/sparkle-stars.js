/* ===========================================
   sparkle-stars.js — 별빛 반짝 효과 (Day 19 / v3)
   ============================================
   레벨업 팝업(level-up-popup.js)의 별빛 입자 효과를 베이스로 한 공통 컴포넌트.

   대표 결정 (Day 19 v3):
   - 별 모양/색/깜빡 keyframes 는 레벨업 팝업과 1:1 동일 (circle, scale 0.85↔1.2, fill 동일)
   - 별 r=2.5 (레벨업 1.4 대비 크게)
   - 부유 효과 추가 (10s 주기, 천천히 떠다님)
   - 부유와 깜빡은 SVG <g> wrapper + 내부 circle 의 layer 분리로 transform 충돌 회피
     · wrapper g 에 sparkle-drift (translate 부유)
     · 내부 circle 에 sparkle-twinkle (scale 깜빡)
   - 별 절대 위치는 circle 의 cx/cy 로 박음 (CSS transform 이 위치를 덮지 못하도록)

   API:
   - createSparkleStars()   — bite-alert / fish-result__grade 용 (8개 별, 가로 펼친 배치)
   - createSparkleField(opts) — 골든힛 슬롯 그리드 용 (36개 별, 6×6 격자 + jitter)
   ============================================ */

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ====== A. bite-alert / fish-result__grade 용 ====== */

/** 별 위치 — viewBox 280×60 안에 8개 (양옆으로 펼쳐 분포).
 *  레벨업 6개([20,12][55,38][88,8][124,42][155,14][185,36]) + 양옆 추가 2개. */
const STARS_POSITIONS = [
  [20, 14], [55, 42], [90, 10], [125, 44], [155, 16], [185, 40], [225, 20], [260, 44],
];

/** 별마다 다른 부유 거리 (viewBox unit, ±8~12 내외).
 *  Day 19 fix2 — 이전 ±2~5 unit 은 컨테이너에 비례 변환 후 ±3~7px 정도로 작아 거의 안 움직이는
 *  인상이었음 → 거리 키워서 6s 주기에 시각적으로 흔들거림이 잘 보이도록 (대표 결정). */
const STARS_DRIFTS = [
  [10, -6], [-8,  9], [12,  4], [-9, -7], [ 8, 11], [-11, -5], [ 7,  8], [-10, -9],
];

const STAR_RADIUS = 2.5;

/**
 * bite-alert / fish-result__grade 에 부착할 별빛 SVG.
 * 8개 별, 영역 24rem × 4rem (CSS 에서 박음), 부유 10s + 깜빡 1.8s.
 *
 * @returns {SVGSVGElement}
 */
export function createSparkleStars() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'sparkle-stars');
  svg.setAttribute('viewBox', '0 0 280 60');
  svg.setAttribute('aria-hidden', 'true');

  STARS_POSITIONS.forEach(([cx, cy], i) => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', `sparkle-drift sparkle-drift--${i}`);
    g.style.setProperty('--drift-dx', `${STARS_DRIFTS[i][0]}px`);
    g.style.setProperty('--drift-dy', `${STARS_DRIFTS[i][1]}px`);

    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', String(cx));
    c.setAttribute('cy', String(cy));
    c.setAttribute('r',  String(STAR_RADIUS));
    c.setAttribute('class', `sparkle-star sparkle-star--${i}`);

    g.appendChild(c);
    svg.appendChild(g);
  });
  return svg;
}


/* ====== B. 골든힛 슬롯 그리드 용 ====== */

/**
 * 골든힛 타임 동안 슬롯 그리드 안에 깔리는 별빛 필드 (36개 별).
 *
 * Day 19 fix — viewBox 픽셀 1:1 매칭 방식으로 변경:
 *   이전 v3 는 viewBox 240×280 고정 + preserveAspectRatio="slice" → 컨테이너가 슬롯 그리드(약 350~700px)
 *   처럼 더 크면 비례 확대로 별이 2~3배 크게 보이고, 부유 거리도 같이 확대돼 별 크기 대비
 *   시각적 이동이 작아지는 문제 (대표 보고).
 *
 *   해결: SVG 부착 후 requestAnimationFrame 한 프레임 뒤에 실제 픽셀 크기 측정 → viewBox 를
 *   컨테이너 픽셀과 1:1 매칭 → 별 r=2.5 는 정확히 2.5px (시안 그대로), 부유는 픽셀 단위로
 *   ±15px (별 크기 대비 6배 이동) → 천천히 떠다님 시각적으로 잘 보임.
 *
 * 구성:
 * - 6×6 격자 (cols×rows) 각 셀 중심에 별 1개 + 셀 안 70% jitter (랜덤 위치)
 * - 별마다 random 부유 거리 (±15px) / random 부유 delay (0~10s)
 * - 별마다 random 깜빡 duration (1.8~2.4s) / random 깜빡 delay (0~2s)
 *   → 동시 깜빡 X, 시간차 떠다님 (자연스러운 흩어짐)
 *
 * 절대 위치는 circle.cx/cy 로 박고, 부유는 wrapper g 의 CSS transform 으로 처리
 *   → 위치 충돌 없음 (시안에서 한곳 모이던 문제 해결).
 *
 * @param {object} [opts]
 * @param {number} [opts.count=36]     별 개수
 * @param {number} [opts.radius=2.5]   별 반지름 (픽셀 단위, viewBox 1:1 매칭)
 * @param {number} [opts.cols=6]       격자 열
 * @param {number} [opts.rows=6]       격자 행
 * @param {number} [opts.drift=15]     부유 거리 ±drift px (별마다 random ±drift 내)
 * @returns {SVGSVGElement}
 */
export function createSparkleField(opts = {}) {
  const {
    count  = 36,
    radius = 2.5,
    cols   = 6,
    rows   = 6,
    drift  = 25,
    shape  = 'circle',   // Day 20: 'circle' (골든힛) | 'star' (트윙클 5점 별)
    tone   = 'golden',   // Day 20: CSS data-tone 분기 ('golden' | 'twinkle')
  } = opts;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'sparkle-field');
  svg.dataset.tone = tone;   // Day 20: CSS 분기 키
  svg.setAttribute('aria-hidden', 'true');
  // viewBox 는 부착 후 측정해서 박음 (1:1 픽셀 매칭).

  // 부착 후 한 프레임 뒤 — DOM 부착되어 getBoundingClientRect 가 정확한 픽셀 반환할 때.
  requestAnimationFrame(() => {
    populateSparkleField(svg, { count, radius, cols, rows, drift, shape });
  });

  return svg;
}

/**
 * SVG 측정 후 viewBox 설정 + 별 36개 생성 (내부 헬퍼 — createSparkleField 전용).
 */
function populateSparkleField(svg, { count, radius, cols, rows, drift, shape }) {
  const rect = svg.getBoundingClientRect();
  const W = Math.max(1, Math.round(rect.width));
  const H = Math.max(1, Math.round(rect.height));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const cellW = W / cols;
  const cellH = H / rows;
  const total = Math.min(count, cols * rows);
  const driftRange = drift * 2;

  let placed = 0;
  for (let r = 0; r < rows && placed < total; r++) {
    for (let c = 0; c < cols && placed < total; c++) {
      const baseX = cellW * (c + 0.5);
      const baseY = cellH * (r + 0.5);
      const jx = (Math.random() - 0.5) * cellW * 0.7;
      const jy = (Math.random() - 0.5) * cellH * 0.7;
      const dx = ((Math.random() - 0.5) * driftRange).toFixed(1);
      const dy = ((Math.random() - 0.5) * driftRange).toFixed(1);
      const driftDelay   = (Math.random() * 6).toFixed(2);   // 6s 주기 균등 분배
      const twinkleDelay = (Math.random() * 2).toFixed(2);
      const twinkleDur   = (1.8 + Math.random() * 0.6).toFixed(2);

      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'sparkle-drift');
      g.style.setProperty('--drift-dx', dx + 'px');
      g.style.setProperty('--drift-dy', dy + 'px');
      g.style.animationDelay = driftDelay + 's';

      const cx = baseX + jx;
      const cy = baseY + jy;

      // Day 20: shape 분기 — 'circle' (기본/골든힛) | 'star' (트윙클 5점 별)
      let shapeEl;
      if (shape === 'star') {
        shapeEl = createStarPolygon(cx, cy, radius);
      } else {
        shapeEl = document.createElementNS(SVG_NS, 'circle');
        shapeEl.setAttribute('cx', cx.toFixed(2));
        shapeEl.setAttribute('cy', cy.toFixed(2));
        shapeEl.setAttribute('r',  String(radius));
      }
      shapeEl.setAttribute('class', 'sparkle-star');
      shapeEl.style.animationDelay = twinkleDelay + 's';
      shapeEl.style.animationDuration = twinkleDur + 's';

      g.appendChild(shapeEl);
      svg.appendChild(g);
      placed++;
    }
  }
}

/**
 * 5점 별 SVG polygon 생성 (Day 20 추가 — 트윙클 입자용).
 * 외접 반지름 r, 안쪽 점은 r * 0.4 (잘 보이는 5점 별 비율).
 *
 * @param {number} cx
 * @param {number} cy
 * @param {number} r   외접 반지름 (픽셀)
 * @returns {SVGPolygonElement}
 */
function createStarPolygon(cx, cy, r) {
  const innerR = r * 0.4;
  const points = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (Math.PI * i) / 5;
    const rr = (i % 2 === 0) ? r : innerR;
    points.push(`${(cx + rr * Math.cos(ang)).toFixed(1)},${(cy + rr * Math.sin(ang)).toFixed(1)}`);
  }
  const polygon = document.createElementNS(SVG_NS, 'polygon');
  polygon.setAttribute('points', points.join(' '));
  return polygon;
}