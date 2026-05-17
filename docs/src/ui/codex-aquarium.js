/* ===========================================
   codex-aquarium.js — 수족관 영역 (Day 16 — Phase C + 후속 개선)
   ============================================
   대표 결정 사항:
   - 도감 리스트 아래 화면 20% 고정
   - 어항 느낌의 둥근 사각 테두리
   - 도감 4개 등록당 1마리 추가 (codex-engine.getAquariumFishList)
   - 최대 15마리 (= 60 ÷ 4)
   - orb = 등급 색 후광 + 검은색 물고기 심볼 (잡기게임 동일 path)
   - 진짜 물고기처럼 좌우로 헤엄 (불규칙, 빠르고 느림, 방향 전환 시 좌우 반전)
   - AQUARIUM 라벨 밑에 작은 설명 "신규 물고기 4마리 발견시 1마리씩 추가" 항상 표시
   ============================================ */

import { getAquariumFishList } from '../data/codex-engine.js';

const GRADE_HEX = Object.freeze({
  '치어':       '#B0DCFF',
  '소형':       '#FFFFFF',
  '중형':       '#C8E664',
  '월척':       '#7B61FF',
  '대물':       '#FFA94D',
  '보스':       '#E94560',
  '전설보스':   '#FFD700',
  '신화보스':   '#FF49A6',
  '숨겨진보스': '#FF9DCB',   // ★ Day 22 임시 — Phase 5 SVG 디자인 합의 시 정확한 색
});

/** 검은 물고기 SVG path (slot-cell / catch-game 심볼과 동일) */
const FISH_SYMBOL_PATH =
  "M8 20 Q18 8 35 12 Q48 16 50 20 Q48 24 35 28 Q18 32 8 20 Z M50 20 L58 13 L58 27 Z";

/** 검은 물고기 심볼 SVG inline */
function fishSymbolSVG() {
  return `<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <path d="${FISH_SYMBOL_PATH}" fill="#000000"/>
  </svg>`;
}

/**
 * 수족관 영역 생성.
 * @returns {{ root: HTMLElement, refresh: () => void }}
 */
export function createCodexAquarium() {
  const root = document.createElement('div');
  root.className = 'codex-aquarium';

  // 어항 테두리 + 내부
  const tank = document.createElement('div');
  tank.className = 'codex-aquarium__tank';
  root.appendChild(tank);

  // 상단 메인 라벨
  const label = document.createElement('div');
  label.className = 'codex-aquarium__label';
  label.textContent = 'AQUARIUM';
  root.appendChild(label);

  // 메인 라벨 밑 작은 설명 (Day 16 후속 — 항상 표시)
  const subLabel = document.createElement('div');
  subLabel.className = 'codex-aquarium__sub-label';
  subLabel.textContent = '신규 물고기 4마리 발견시 1마리씩 추가';
  root.appendChild(subLabel);

  /** orb 들을 다시 그림 (등록 변동 시) */
  function refresh() {
    tank.innerHTML = '';

    const fishList = getAquariumFishList();
    if (fishList.length === 0) {
      // Day 16 후속: 빈 상태 텍스트 삭제 — 어항만 비어있는 상태로 보임
      return;
    }

    // orb 배치 — 각자 다른 phase, 다른 속도, 다른 Y 위치로 자연스러운 군영 효과
    fishList.forEach((fish, i) => {
      const orb = document.createElement('div');
      orb.className = 'codex-aquarium__orb';
      const hex = GRADE_HEX[fish.grade] || '#FFFFFF';
      // orb 글로우 (등급 색)
      orb.style.background  = hex;
      orb.style.boxShadow   = `0 0 10px ${hex}, 0 0 20px ${hex}88, 0 0 30px ${hex}44`;

      // 큰 등급일수록 약간 크게
      const sizeBoost = {
        '치어': 0.85, '소형': 0.9, '중형': 1.0, '월척': 1.1,
        '대물': 1.18, '보스': 1.28, '전설보스': 1.4, '신화보스': 1.55,
        '숨겨진보스': 1.55,   // ★ Day 22 — 신화보스와 동일 (보스급)
      }[fish.grade] || 1.0;
      const baseRem = 1.6 * sizeBoost;
      orb.style.width  = `${baseRem}rem`;
      orb.style.height = `${baseRem}rem`;

      // Y 위치 — 어항 안 25~75% 범위에서 랜덤 (deterministic 한 분배 + 약간의 jitter)
      const seed = (i * 1731 + 137) % 100 / 100;  // 0~1
      const yPct = 28 + seed * 44;                 // 28% ~ 72%
      orb.style.setProperty('--orb-y', `${yPct}%`);

      // 헤엄 속도 — 8s ~ 16s 사이 (등급마다 다른 시드)
      const seed2 = (i * 977 + 271) % 100 / 100;
      const duration = 9 + seed2 * 7;              // 9s ~ 16s
      orb.style.setProperty('--swim-duration', `${duration.toFixed(2)}s`);

      // animation-delay — 각자 다른 phase (음수로 시작 위치 분산)
      const delay = -((i * 1.7 + seed * 5) % duration);
      orb.style.animationDelay = `${delay.toFixed(2)}s`;

      // orb 안 물고기 심볼
      orb.innerHTML = `<span class="codex-aquarium__orb-fish">${fishSymbolSVG()}</span>`;

      orb.dataset.grade = fish.grade;
      orb.title = fish.name;
      tank.appendChild(orb);
    });
  }

  refresh();

  return { root, refresh };
}