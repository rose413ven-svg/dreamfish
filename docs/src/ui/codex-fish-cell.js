/* ===========================================
   codex-fish-cell.js — 물고기 도감 단일 셀 (Day 16 — Phase C)
   ============================================
   대표 결정 사항:
   - 한 행 1셀
   - 셀 = 등급 글로우 심볼 + 등급 + 이름
   - 등록됨: 등급 색 물고기 실루엣 + 이름 + 최고 무게
   - 미등록: 회색 실루엣 + "???" + "—"
   - 신규 등록 (캡처본): 우상단 NEW 배지

   같은 이름 = 단일 도감 (등급은 entry 정의 따라).
   ============================================ */

import { renderFishSVG } from './fish-svg.js';
import { formatWeight } from '../engine/weight.js';

/* ============================================
   설정
   ============================================ */

/** 미등록 상태에서 표시되는 회색 톤 (어두운 청남 배경에 잘 보이는 단정한 회색) */
const LOCKED_COLOR = '#3a4762';   // 미등록 실루엣 색
const LOCKED_TEXT  = '???';

/** 등록 셀 외곽 글로우 강도 (등급 색 alpha 적용) */
const GLOW_ALPHA   = 0.32;

/* ============================================
   ─ 헬퍼: 등급별 색 (catch-game-config 와 별개 — 도감 셀 톤은 살짝 부드럽게)
   ============================================
   참고: catch-game-config.GRADE_COLORS 와 hex 동일. 글로우 strength 만 조정.
*/
const GRADE_HEX = Object.freeze({
  '치어':       '#B0DCFF',
  '소형':       '#FFFFFF',
  '중형':       '#C8E664',
  '월척':       '#7B61FF',
  '대물':       '#FF8E5B',
  '보스':       '#E94560',
  '전설보스':   '#FFD700',
  '신화보스':   '#FF49A6',   // Day 16 임시 — Phase B/C 색 다듬는 단계에서 검토
  '숨겨진보스': '#FF9DCB',   // ★ Day 22 임시 — Phase 5 SVG 디자인 합의 시 정확한 색
});

/** rgba glow 변환 */
function hexToGlow(hex, alpha = GLOW_ALPHA) {
  // 단순 변환 (3자리 단축은 미사용 — 모든 색 6자리)
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ============================================
   메인 — 셀 빌더
   ============================================ */

/**
 * 물고기 도감 단일 셀.
 *
 * @param {object} opts
 * @param {object} opts.entry         FISH_CODEX_ENTRIES 의 항목
 *                                    { name, id, grade, baseColor, baseSize, baseWeight }
 * @param {boolean} opts.registered   등록 여부
 * @param {number}  [opts.bestWeightKg]  등록된 경우 최고 무게
 * @param {boolean} [opts.isNew=false]   신규 NEW 배지 표시 여부 (우측 상단 — 처음 등록)
 * @param {boolean} [opts.isNewBest=false]  ★ Day 39 — 새 최고기록 NEW 배지 표시 여부 (우측 하단 — 초록)
 * @returns {{ root: HTMLElement }}
 */
export function createFishCodexCell({ entry, registered, bestWeightKg = 0, isNew = false, isNewBest = false }) {
  const root = document.createElement('article');
  root.className = 'codex-fish-cell';
  root.dataset.grade = entry.grade;
  root.dataset.fishName = entry.name;
  if (registered) {
    root.classList.add('codex-fish-cell--registered');
  } else {
    root.classList.add('codex-fish-cell--locked');
  }

  const gradeHex = GRADE_HEX[entry.grade] || '#FFFFFF';

  /* 좌측 — 등급 글로우 심볼 영역 */
  const symBox = document.createElement('div');
  symBox.className = 'codex-fish-cell__sym';
  if (registered) {
    symBox.style.boxShadow = `0 0 14px ${hexToGlow(gradeHex)}, inset 0 0 8px ${hexToGlow(gradeHex, 0.18)}`;
    symBox.style.borderColor = hexToGlow(gradeHex, 0.55);
  }

  // 물고기 SVG (등록 = 컬러 / 미등록 = 회색 실루엣)
  // ★ Day 22 Phase 7 후속 (대표 결정): 등록된 fish 만 id 전달 → fish-svg.js HIDDEN BOSS 분기 진입
  //   - 미등록(잡기 전): id 없음 → 일반 fish path (그림자, 정체 미공개)
  //   - 등록(잡기 후): id='hidden_01' → 라인 아트 (시크릿꿈고래 정체 드러남)
  const fishForSvg = registered
    ? { id: entry.id, color: entry.baseColor, size: entry.baseSize }
    : {                color: LOCKED_COLOR,    size: entry.baseSize };
  symBox.innerHTML = renderFishSVG(fishForSvg, 0.95);

  /* 우측 — 텍스트 영역 (등급 + 이름 + 최고무게) */
  const info = document.createElement('div');
  info.className = 'codex-fish-cell__info';

  const gradeLine = document.createElement('div');
  gradeLine.className = 'codex-fish-cell__grade';
  gradeLine.textContent = entry.grade;
  if (registered) gradeLine.style.color = gradeHex;

  const nameLine = document.createElement('div');
  nameLine.className = 'codex-fish-cell__name';
  nameLine.textContent = registered ? entry.name : LOCKED_TEXT;

  const weightLine = document.createElement('div');
  weightLine.className = 'codex-fish-cell__weight';
  if (registered) {
    weightLine.innerHTML = `최고기록 <span class="codex-fish-cell__weight-num">${formatWeight(bestWeightKg)}</span>`;
  } else {
    weightLine.textContent = '— —';
  }

  info.appendChild(gradeLine);
  info.appendChild(nameLine);
  info.appendChild(weightLine);

  /* NEW 배지 (캡처본 기준) — 우측 상단: 신규 등록 */
  if (isNew) {
    const newBadge = document.createElement('span');
    newBadge.className = 'codex-fish-cell__new-badge';
    newBadge.textContent = 'NEW';
    root.appendChild(newBadge);
  }

  /* ★ Day 39 — 새 최고기록 배지 — 우측 하단 (초록) — 신규 등록 NEW 와 동시 표시 가능 (Q2-D)
     ★ Day 41 (대표 결정) — 텍스트 'NEW' → 'BEST' (신규 등록 NEW 와 헷갈리지 않도록 변경) */
  if (isNewBest && registered) {
    const newBestBadge = document.createElement('span');
    newBestBadge.className = 'codex-fish-cell__newbest-badge';
    newBestBadge.textContent = 'BEST';   // ★ Day 41 — NEW → BEST
    root.appendChild(newBestBadge);
  }

  root.appendChild(symBox);
  root.appendChild(info);

  return { root };
}