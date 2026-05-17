/* ===========================================
   stats-bar.js — 슬롯 위 등장 확률 표시 UI
   ============================================
   - 위치: 콤보텍스트 ↔ 슬롯 그리드 사이 (slot-fx-area 안)
   - 표시: 검은물고기 / 황금물고기 / 분홍물고기 / 하얀물고기 등장 추가확률 4종
     ★ Day 21 (대표 결정): 하얀물고기(twinkle) 항목 신규 추가 — 분홍 옆 4번째 자리
   - 항상 4개 표시 (0%여도 — 직관성, "장비 끼면 활성화되는 자리" 인지)
   - 심볼은 항상 글로우 (검은색 안 보이니까)
   - 수치 0%면 흐림 / 보너스 있으면 강조
   ============================================ */

import { getActiveOptions } from '../data/equipment-effects.js';
import { loadInventory } from '../core/storage.js';
// Day 16 — 도감 보너스 일관성 (현재 stats-bar 표시 항목은 영향 X 지만, 추후 확장 대비)
import { getCodexBonuses } from '../data/codex-engine.js';
// Day 18 후속 (대표 결정) — OPTIONS.displayScale 활용 (fish/golden/rainbow_rate ×100 표시)
import { OPTIONS } from '../data/equipment-options.js';

/* 슬롯 셀 심볼 path (slot-cell.js의 symbolSVG와 동일 모양) */
const SYMBOL_PATH =
  "M8 20 Q18 8 35 12 Q48 16 50 20 Q48 24 35 28 Q18 32 8 20 Z M50 20 L58 13 L58 27 Z";

/** 심볼별 fill 색 + CSS 클래스 키.
 *  ★ Day 21 (대표 결정): twinkle 항목 추가 — 분홍 옆 4번째 자리 (하얀 입질 옵션 신규).
 *    fill 색 #F0F8FF 는 slot-cell.js 의 twinkle 심볼 색과 동일 (Alice Blue 톤). */
const SYMBOL_DEFS = [
  { key: 'fish',    fill: '#000000', optionKey: 'fish_rate',    cls: 'slot-stats-bar__item--fish'    },
  { key: 'golden',  fill: '#E8C870', optionKey: 'golden_rate',  cls: 'slot-stats-bar__item--golden'  },
  { key: 'rainbow', fill: '#FF9DCB', optionKey: 'rainbow_rate', cls: 'slot-stats-bar__item--rainbow' },
  { key: 'twinkle', fill: '#F0F8FF', optionKey: 'twinkle_rate', cls: 'slot-stats-bar__item--twinkle' },  // ★ Day 21
];

function symbolSVG(fill) {
  return `<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
    <path d="${SYMBOL_PATH}" fill="${fill}"/>
  </svg>`;
}

/**
 * 슬롯 위 stats-bar 생성.
 *
 * @returns {{ root: HTMLDivElement, refresh: () => void, dispose: () => void }}
 */
export function createStatsBar() {
  const root = document.createElement('div');
  root.className = 'slot-stats-bar';

  // 3개 항목 빌드
  const items = SYMBOL_DEFS.map(def => {
    const itemEl = document.createElement('div');
    itemEl.className = `slot-stats-bar__item ${def.cls}`;
    itemEl.innerHTML = `
      <div class="slot-stats-bar__symbol">${symbolSVG(def.fill)}</div>
      <span class="slot-stats-bar__value">+0%</span>
    `;
    root.appendChild(itemEl);
    return { itemEl, def };
  });

  /** 가방 변경 시 호출 — 옵션 합계 다시 계산해서 수치 갱신
   *  Day 7-2: 모델 변경 — 옵션값이 정수 가중치 (% 단위 X)
   *  Day 16: 도감 보너스 일관성 — getActiveOptions 에 codexBonuses 전달 */
  function refresh() {
    const inv = loadInventory();
    const active = getActiveOptions(inv, getCodexBonuses()) || {};
    items.forEach(({ itemEl, def }) => {
      const rate = active[def.optionKey] || 0;
      // Day 18 후속 (대표 결정) — OPTIONS.displayScale 활용.
      //   fish/golden/rainbow_rate 는 displayScale=100 → value × 100 반올림 정수.
      //   실제 게임 가중치는 그대로 (예: 0.73), UI 만 큰 숫자 (73).
      const opt = OPTIONS[def.optionKey];
      const scale = opt?.displayScale || 1;
      const displayVal = scale !== 1
        ? Math.round(rate * scale)
        : Number((Number(rate) || 0).toFixed(2));
      const valueEl = itemEl.querySelector('.slot-stats-bar__value');
      valueEl.textContent = `+${displayVal}`;
      itemEl.classList.toggle('has-bonus', rate > 0);
    });
  }

  // 초기값 반영
  refresh();

  function dispose() {
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  return { root, refresh, dispose };
}