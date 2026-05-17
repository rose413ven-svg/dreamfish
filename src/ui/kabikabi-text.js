/* ===========================================
   kabikabi-text.js — 까비까비 매칭 텍스트 오버레이 (Day 26 신규)
   ============================================
   결정로그 Day 26 SSOT.

   역할:
   - 까비까비 클러스터 발동 시 "까비까비" + 무게 숫자 텍스트를 슬롯 그리드 위에 띄움
   - 클러스터별 색상 (사이언/자홍/라임/옐로우/바이올렛 — 5색 순환)
   - 위치 자동 판단 (대표 Q-다 A):
     · 클러스터가 그리드 상단이면 아래에
     · 클러스터가 그리드 하단이면 위에
     · 가운데면 위쪽 우선 (충돌 회피)
   - 모션: scale 뿅 등장 → 1.5초 유지 → 페이드아웃 (CSS @keyframes kabikabi-pop, 총 2.0초)
   - 애니메이션 끝나면 DOM 자동 제거 (animationend 리스너)

   호출:
   - showKabikabiClusterText(gridEl, clusterInfo, cellsArr, gridRows, gridCols)
     · clusterInfo: { cells: [{row, col, symbol}], weight, colorIdx }
     · cellsArr:    grid.cells 배열 (각 셀의 .root DOM 참조용)
   - clearAllKabikabiText(gridEl) — 강제 클리어 (clearAllHighlights 등에서)

   CSS:
   - public/styles/screens/slot.css 안 "Day 26 — 까비까비 ..." 섹션
   ============================================ */

const KABIKABI_TEXT_CLASS = 'kabikabi-text';
// CSS @keyframes kabikabi-pop 총 길이 (ms) — 안전 여유 100ms
const ANIMATION_TOTAL_MS = 2100;

/**
 * 클러스터 한 개의 까비까비 텍스트를 그리드 위에 표시.
 *
 * @param {HTMLElement} gridEl    슬롯 그리드 컨테이너 (position: relative)
 * @param {object} clusterInfo    { cells: [{row, col, symbol}], weight, colorIdx (1~5), size }
 * @param {Array}   cellsArr      grid.cells (각 셀에 .root DOM)
 * @param {number}  gridRows
 * @param {number}  gridCols
 */
export function showKabikabiClusterText(gridEl, clusterInfo, cellsArr, gridRows, gridCols) {
  if (!gridEl || !clusterInfo || !Array.isArray(clusterInfo.cells) || clusterInfo.cells.length === 0) return;

  // 1. 클러스터 위치 분석
  const rows = clusterInfo.cells.map(c => c.row);
  const cols = clusterInfo.cells.map(c => c.col);
  const topRow    = Math.min(...rows);
  const bottomRow = Math.max(...rows);
  const avgCol    = cols.reduce((s, v) => s + v, 0) / cols.length;
  const anchorCol = Math.round(avgCol);

  // 2. 위치 자동 판단 (대표 Q-다 A)
  //   - 클러스터 중간점이 그리드 상반부면 → 아래에 (placeBelow = true)
  //   - 하반부면 → 위에 (placeBelow = false)
  //   - 가운데면 위쪽 우선 (대표 명세)
  const clusterMidRow = (topRow + bottomRow) / 2;
  const gridMid       = (gridRows - 1) / 2;
  const placeBelow    = clusterMidRow < gridMid;

  // 3. anchor 셀 선정 (텍스트가 부착될 기준 셀)
  const anchorRow = placeBelow ? bottomRow : topRow;
  const anchorIdx = anchorRow * gridCols + anchorCol;
  const anchorCell = cellsArr[anchorIdx]?.root;
  if (!anchorCell) return;

  // 4. 그리드 기준 anchor 셀의 픽셀 위치 (offset 사용 — grid 안 absolute 기준)
  const cellTop    = anchorCell.offsetTop;
  const cellLeft   = anchorCell.offsetLeft;
  const cellWidth  = anchorCell.offsetWidth;
  const cellHeight = anchorCell.offsetHeight;

  // 5. 텍스트 DOM 생성 (wrapper → inner 구조 — translate/scale 충돌 회피)
  const wrapper = document.createElement('div');
  wrapper.className = KABIKABI_TEXT_CLASS;
  wrapper.dataset.kabikabiColor = String(clusterInfo.colorIdx || 1);

  const inner = document.createElement('div');
  inner.className = 'kabikabi-text__inner';

  const label = document.createElement('div');
  label.className = 'kabikabi-text__label';
  label.textContent = '까비까비';

  const weight = document.createElement('div');
  weight.className = 'kabikabi-text__weight';
  // 무게 숫자 — kg 표기 없음, 소수점 2자리 (대표 명세)
  weight.textContent = (Number(clusterInfo.weight) || 0).toFixed(2);

  inner.appendChild(label);
  inner.appendChild(weight);
  wrapper.appendChild(inner);

  // 6. 위치 적용
  //   - left: 셀 중앙 (wrapper CSS 의 translateX(-50%) 와 짝)
  //   - top:  placeBelow → 셀 아래 살짝 띄움 / 아니면 셀 위에 (텍스트 영역 띄움)
  wrapper.style.left = `${cellLeft + cellWidth / 2}px`;
  if (placeBelow) {
    // 셀 아래 (gap 4px)
    wrapper.style.top = `${cellTop + cellHeight + 4}px`;
  } else {
    // 셀 위 (텍스트 약 4rem 높이 추정 — 라벨 + 무게 두 줄, gap 4px)
    // tokens.css 기준 1rem = 10px @ 390px 화면 → 4rem ≈ 40px
    wrapper.style.top = `${cellTop - 40}px`;
  }

  gridEl.appendChild(wrapper);

  // 7. 애니메이션 종료 시 자동 제거 (animationend + 안전 timeout 이중 안전망)
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
  };
  inner.addEventListener('animationend', remove, { once: true });
  setTimeout(remove, ANIMATION_TOTAL_MS);
}

/**
 * 그리드 안 모든 까비까비 텍스트 강제 제거 (clearAllHighlights 등에서).
 *
 * @param {HTMLElement} gridEl
 */
export function clearAllKabikabiText(gridEl) {
  if (!gridEl) return;
  gridEl.querySelectorAll(`.${KABIKABI_TEXT_CLASS}`).forEach(el => {
    if (el.parentNode) el.parentNode.removeChild(el);
  });
}