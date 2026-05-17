/* ===========================================
   slot-grid.js — 슬롯 그리드 컨테이너
   ============================================
   docs/01_슬롯화면_디자인.md SSOT.

   Phase 3-1 v2: 4차 빌드 방식 적용
   - 셀 간 gap 3px (선명한 격자)
   - 셀별 phase / flow-duration 다르게 → 자연스러운 물결
   - 회전: 모든 셀 동시 spinning ON
   - 멈춤: 좌상→우하 stagger로 셀 stop
   ============================================ */

import { createSlotCell } from './slot-cell.js';

/**
 * @param {object} [opts]
 * @param {number} [opts.rows=5]
 * @param {number} [opts.cols=5]
 * @returns {{
 *   root: HTMLElement,
 *   cells: Array<ReturnType<typeof createSlotCell>>,
 *   rows: number,
 *   cols: number,
 * }}
 */
export function createSlotGrid(opts = {}) {
  const { rows = 5, cols = 5 } = opts;

  const root = document.createElement('div');
  root.className = 'slot-grid';
  root.style.setProperty('--slot-rows', String(rows));
  root.style.setProperty('--slot-cols', String(cols));

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = createSlotCell();
      // 셀별 차등 — 각자 다른 물결 타이밍
      const phase = (r + c) * 0.05;                 // 대각선 phase
      const flow = 1.4 + Math.random() * 0.4;       // 1.4~1.8s
      cell.root.style.setProperty('--phase', `${phase}s`);
      cell.root.style.setProperty('--flow-duration', `${flow}s`);
      root.appendChild(cell.root);
      cells.push(cell);
    }
  }

  return { root, cells, rows, cols };
}

/**
 * 그리드 데이터로 셀 채우기 (즉시)
 */
export function fillGrid(cells, gridData) {
  const rows = gridData.length;
  const cols = gridData[0]?.length || 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      cells[idx]?.setSymbol(gridData[r][c]);
    }
  }
}

/**
 * 회전 연출 — 4차 빌드 방식
 * Day 3 v2 (A1): 좌상→우하 대각선 stagger 복원
 *               타격감(빛 플래시 + 강한 바운스)은 slot.css에서 유지
 * - 모든 셀 동시 spinning ON (셀별 phase로 자연스러운 물결)
 * - duration 후 좌상→우하 대각선 stagger로 셀 stop + 심볼 노출
 *
 * Day 20 — lockedIndices 옵션 추가 (꿈조각 트윙클타임 자동 캐스트용):
 *   - 잠긴 셀(꿈조각 매칭 누적분)은 회전/심볼 변경/stop 모두 스킵
 *   - 결과 그리드의 잠긴 셀 값은 호출자가 직접 유지(덮어쓰기) 책임
 *   - 시각: 잠긴 셀은 현재 상태(setTwinkleMatched 등) 그대로 유지
 *
 * @param {HTMLElement} root
 * @param {Array} cells
 * @param {Array<Array<string>>} finalGridData
 * @param {number} [duration=1000]
 * @param {number[]} [lockedIndices=[]]   회전 스킵할 셀 인덱스 배열 (row*cols+col)
 * @returns {Promise<void>}
 */
export function spinGrid(root, cells, finalGridData, duration = 1000, lockedIndices = []) {
  return new Promise(resolve => {
    const lockedSet = new Set(lockedIndices);

    // 1. 잠기지 않은 셀만 회전 시작
    cells.forEach((cell, idx) => {
      if (!lockedSet.has(idx)) cell.setSpinning(true);
    });

    setTimeout(() => {
      // 2. 좌상→우하 대각선 stagger로 멈춤 (잠긴 셀은 스킵)
      const rows = finalGridData.length;
      const cols = finalGridData[0]?.length || 0;
      let stopped = 0;
      // 잠긴 셀 수만큼 total에서 차감 (그렇지 않으면 resolve 조건 못 채움)
      const total = rows * cols - lockedSet.size;
      const STAGGER = 30; // ms — 셀 사이 간격 (대각선)

      // total === 0 (모든 셀 잠김) → 즉시 resolve
      if (total <= 0) {
        setTimeout(resolve, 50);
        return;
      }

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const delay = (r + c) * STAGGER;
          const idx = r * cols + c;

          if (lockedSet.has(idx)) continue;   // Day 20: 잠긴 셀 스킵

          setTimeout(() => {
            cells[idx]?.setSymbol(finalGridData[r][c]);
            cells[idx]?.triggerStop();

            stopped++;
            if (stopped === total) {
              // 마지막 stop bounce(0.55s) + 플래시(0.35s) 끝날 때까지 살짝 기다림
              setTimeout(resolve, 550);
            }
          }, delay);
        }
      }
    }, duration);
  });
}