/* ===========================================
   grid.js — 슬롯 그리드 생성 엔진
   ============================================
   순수 함수 — 입력 → 출력 (부수효과 없음)
   ============================================ */

import { SYMBOL_LIST } from '../data/symbols.js';

/**
 * 가중치 기반 심볼 1개 랜덤 선택
 * @param {Array} symbolList - SYMBOL_LIST 또는 커스텀 풀
 * @returns {string} 심볼 id
 */
export function pickSymbol(symbolList = SYMBOL_LIST) {
  const totalWeight = symbolList.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const symbol of symbolList) {
    roll -= symbol.weight;
    if (roll < 0) return symbol.id;
  }

  return symbolList[symbolList.length - 1].id;
}

/**
 * size × size 그리드 생성
 * @param {number} size - 한 변 크기 (5, 7, 8, ...)
 * @param {Array} symbolList - 심볼 풀 (낚시터별 다를 수 있음)
 * @returns {Array<Array<string>>} 2차원 배열 (심볼 id)
 */
export function generateGrid(size, symbolList = SYMBOL_LIST) {
  const grid = [];
  for (let row = 0; row < size; row++) {
    const rowArr = [];
    for (let col = 0; col < size; col++) {
      rowArr.push(pickSymbol(symbolList));
    }
    grid.push(rowArr);
  }
  return grid;
}

/**
 * 빈 그리드 (모두 empty) — 초기 표시용
 */
export function emptyGrid(size) {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 'empty')
  );
}