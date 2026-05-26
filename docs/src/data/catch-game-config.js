/* ===========================================
   catch-game-config.js — 잡기 게임 설정
   ============================================
   데이터 분리 원칙: 게임 로직과 분리.
   ============================================ */

/** 폴백 시간 제한 (등급 정보 없을 때) */
export const TIME_LIMIT_MS = 20000;

/**
 * 등급별 설정
 * - hpRows       : 체력바 줄 구성 (예: [5, 5] = 5칸 2줄)
 * - hpMax        : 자동 계산 (hpRows 합) — getCatchConfig에서 채워줌
 * - timeMs       : 그 등급 잡기에 주어지는 시간 (사용자 선택한 등급의 시간만 적용)
 * - orbDuration  : 원이 출발점 → 정중앙(잡기존)까지 걸리는 시간 (ms)
 *                  실제 화면 통과까지는 catch-game.js 내부에서 *2 처리
 * - fishScale    : 위쪽 검은 물고기 실루엣 크기 배율
 * - orbSymbolSize: 원 안의 검은 물고기 심볼 크기 (px, 원 50px 기준)
 * - sizeScale    : ★ Day 38 (대표 결정) — 잡기존 + 물고기원 등급별 크기 배율 (난이도 기믹).
 *                  높은 등급일수록 작아짐 → 잡기 어려움.
 *                  치어 1.0 / 소형 0.9 / 중형 0.8 / 월척 0.7 / 대물 0.6 / 보스 0.5 / 전설 0.4 / 신화 0.3
 * - orbVisualScale : ★ Day 40 (대표 결정) — 물고기원 시각 크기만 (판정 무관). 등급↑ = orb↑ 컨셉 일치.
 *                  잡기존(--zone-scale) + 심볼 크기는 그대로 두고 orb 외곽만 별도 커짐.
 *                  심볼은 CSS 역 scale 로 원래 크기 유지. 판정은 심볼 반지름 기준.
 *                  치어 0.6 / 소형 0.8 / 중형 1.0 / 월척 1.5 / 대물 1.8 / 보스 2.2 / 전설 2.6 / 신화 3.0
 *                  (★ Day 40 후속 — 치어/소형/중형 더 작게: 1.0/1.1/1.3 → 0.6/0.8/1.0, 등급차 명확)
 *
 * 동시 등장 = 1마리 고정 (simultaneous 시스템 폐기)
 *
 * Day 4: 체력 칸수 대폭 증가
 *   소형 5 → 10 (5+5 2줄)
 *   중형 7 → 14 (7+7 2줄)
 *   월척 10 → 20 (10+10 2줄)
 *   보스 15 → 30 (10+10+10 3줄)
 *   전설보스 20 → 39 (13+13+13 3줄)
 *
 * Day 15 — 7등급 확장: 치어 = 소형 복제 / 대물 = 월척 복제 (임시, 추후 조정)
 */
export const CATCH_CONFIG = {
  // Day 17 후속 v2 (대표 결정): 치어 = 8 HP (4+4 2줄)
  // ★ Day 28 (대표 결정): orbDuration 전반적 완화 — 잡기 난이도 ↓
  // ★ Day 38 (대표 결정): sizeScale 추가 — 잡기존/물고기원 등급별 축소 난이도 기믹
  // ★ Day 40 (대표 결정): fishScale 전체 재조정 — 상단 물고기 그림자 시각 균형
  //   치어/소형 0.35 유지 / 중형 0.68→0.45 / 월척 1.15→0.65 / 대물 1.15→0.75
  //   보스 1.85→0.85 / 전설 2.10→1.00 / 신화 2.30→1.30
  // ★ Day 40 후속 (대표 결정): orbVisualScale 추가 — 물고기원 시각 크기 (판정 무관)
  // ★ Day 40 후속 (대표 결정): orbSymbolSize 월척~신화만 키움 — 잡기존 대비 심볼 비율 47~60%
  //   치어/소형/중형 그대로 (등급 차 정체성 유지)
  //   월척 32→42 / 대물 32→42 / 보스 36→46 / 전설 40→50 / 신화 44→54
  '치어':     { hpRows: [4, 4],         timeMs: 20000, orbDuration: 900, fishScale: 0.35, orbSymbolSize: 22, sizeScale: 1.0, orbVisualScale: 0.6 },
  '소형':     { hpRows: [5, 5],         timeMs: 20000, orbDuration: 800, fishScale: 0.35, orbSymbolSize: 22, sizeScale: 0.9, orbVisualScale: 0.8 },
  '중형':     { hpRows: [7, 7],         timeMs: 25000, orbDuration: 700, fishScale: 0.45, orbSymbolSize: 28, sizeScale: 0.8, orbVisualScale: 1.0 },
  '월척':     { hpRows: [7, 7, 7],       timeMs: 30000, orbDuration: 600, fishScale: 0.65, orbSymbolSize: 42, sizeScale: 0.7, orbVisualScale: 1.5 },
  '대물':     { hpRows: [8, 8, 8],       timeMs: 35000, orbDuration: 500, fishScale: 0.75, orbSymbolSize: 42, sizeScale: 0.6, orbVisualScale: 1.8 },
  '보스':     { hpRows: [8, 8, 8, 8],   timeMs: 45000, orbDuration: 450, fishScale: 0.85, orbSymbolSize: 46, sizeScale: 0.6, orbVisualScale: 2.0 },
  '전설보스': { hpRows: [8, 8, 8, 8, 8], timeMs: 55000, orbDuration: 400, fishScale: 1.00, orbSymbolSize: 50, sizeScale: 0.5, orbVisualScale: 2.3 },
  '신화보스': { hpRows: [9, 9, 9, 9, 9], timeMs: 65000, orbDuration: 380, fishScale: 1.30, orbSymbolSize: 54, sizeScale: 0.5, orbVisualScale: 2.5 },
};

export function getCatchConfig(grade) {
  const cfg = CATCH_CONFIG[grade] || CATCH_CONFIG['소형'];
  // hpMax는 hpRows의 합으로 자동 계산 (단일 진실의 원천)
  const hpMax = cfg.hpRows.reduce((a, b) => a + b, 0);
  return { ...cfg, hpMax };
}


/* ============================================
   클러스터 색상 (참고용 — 슬롯 셀 시각 구분에서만 사용)
   잡기 게임 안에서는 등급 색으로 통일됨 (Day 3 변경)
   ============================================ */

export const CLUSTER_COLORS = {
  1: { name: 'white',  hex: '#E6F1FB', glow: 'rgba(230, 241, 251, 0.85)' },
  2: { name: 'green',  hex: '#9DE36B', glow: 'rgba(157, 227, 107, 0.85)' },
  3: { name: 'blue',   hex: '#5FC9F7', glow: 'rgba(95, 201, 247, 0.85)'  },
  4: { name: 'purple', hex: '#C68FF0', glow: 'rgba(198, 143, 240, 0.85)' },
  5: { name: 'pink',   hex: '#FF9DCB', glow: 'rgba(255, 157, 203, 0.85)' },
  6: { name: 'red',    hex: '#FF6F6F', glow: 'rgba(255, 111, 111, 0.85)' },
};


/* ============================================
   등급 색상 (잡기 게임 — 원/체력바/글로우 모두 등급 색으로 통일)
   "어느 등급인지" 명확히. 통일성 ↑.

   Day 17 후속 v2 (대표 결정 — 잡기게임 + 도감 + 슬롯 매칭 셀 + fish-result 영문 라벨 통일):
   - 치어:   옅은 하늘색  #B0DCFF
   - 소형:   흰   #FFFFFF
   - 중형:   라임 #C8E664
   - 월척:   인디고 #7B61FF  (이전 앰버 → 인디고 변경 ★)
   - 대물:   앰버 #FFA94D
   - 보스:   크림슨 #E94560
   - 전설:   골드 #FFD700
   - 신화:   마젠타 #FF49A6
   - 골든힛은 제외 (황금 톤 별도 유지)
   ============================================ */

export const GRADE_COLORS = {
  '치어':     { hex: '#B0DCFF', glow: 'rgba(176, 220, 255, 0.95)', name: 'sky-pale' },   // Day 18 후속 (대표 결정 — 옅은 하늘색)
  '소형':     { hex: '#FFFFFF', glow: 'rgba(255, 255, 255, 0.95)', name: 'white'     },
  '중형':     { hex: '#C8E664', glow: 'rgba(200, 230, 100, 0.88)', name: 'lime'      },
  '월척':     { hex: '#7B61FF', glow: 'rgba(123,  97, 255, 0.92)', name: 'indigo'    },   // Day 17 후속 v2 ★
  '대물':     { hex: '#FFA94D', glow: 'rgba(255, 169,  77, 0.88)', name: 'amber'     },
  '보스':     { hex: '#E94560', glow: 'rgba(233,  69,  96, 0.92)', name: 'crimson'   },
  '전설보스': { hex: '#FFD700', glow: 'rgba(255, 215,   0, 0.95)', name: 'gold'      },
  '신화보스': { hex: '#FF49A6', glow: 'rgba(255,  73, 166, 0.95)', name: 'magenta'   },
};

export function gradeColorOf(grade) {
  return GRADE_COLORS[grade] || GRADE_COLORS['소형'];
}

/**
 * 매칭 결과의 색 — 잡기 게임에서 사용
 * Day 3 이후: 클러스터 idx가 아니라 등급 색을 반환 (통일성)
 */
export function colorOf(result) {
  return gradeColorOf(result?.grade);
}