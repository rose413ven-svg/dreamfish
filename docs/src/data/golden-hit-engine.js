/* ===========================================
   golden-hit-engine.js — 골든힛 타임 시스템 (Day 15 신규 / ★ Day 27 — 등급 세분화 전용 테이블)
   ============================================
   순수 데이터/로직 모듈 — DOM 의존 X.

   [트리거]
   - 황금 인접 클러스터 3+ 매칭 발생 시 골든힛 타임 진입 후보
   - 그 cast의 다른 매칭 결과(잡기게임)는 모두 무시
   - 진입 직전 콤보 카운트는 보존 (트리거 cast = 콤보 +1 적용 후 save → 종료 후 복원)

   [지속]
   - GOLDEN_HIT_MAX_COUNT 회 (기본 3) cast 동안
   - 모든 cast 1회씩 차감 (황금 0~2개 미스도 차감 — Q1 답)
   - 골든힛 동안 황금 재발동 잠금 (Q3 답)

   [심볼 풀 (골든힛 타임 동안)]
   - 검은/분홍/하얀 → 황금으로 치환  (★ Day 21: 하얀(twinkle) 추가)
   - 물방울(empty)는 그대로 (확률 동일)
   - convertSymbolForGoldenHit() 사용

   [매칭 룰 (골든힛 타임 동안)]
   - 클러스터 룰 무시
   - 황금 심볼 전체 카운트 단일 룰 (위치 무관)
   - 황금 < MIN_GOLDEN_FOR_HIT (3) → 미스, 자동 다음 cast
   - 황금 >= 3 → 단일 매칭 (single hit), 등급+변종 = GOLDEN_HIT_GRADE_TABLE 기반

   ★ Day 27 변경 (대표 결정 — 등급 세분화 시스템):
   1. **골든힛 전용 등급 테이블** (cluster.gradeOf 룰 재사용 폐기):
        3~5  → 대물
        6~10 → 보스
       11~15 → 보스+
       16~20 → 보스++
       21~25 → 전설
       26~30 → 전설+
       31~35 → 전설++
       36~40 → 전설+++
       41~45 → 전설++++
       46~50 → 전설+++++
       51+   → 신화 (전 지역 — 1지역에서도 출현 가능)
   2. **변종별 무게 multiplier** (×1.0 / 1.25 / 1.55 / 1.90 / 2.30 / 2.75)
        기존 등급 무게 범위(weight.js GRADE_WEIGHT_RANGE) × 변종 mult × 지역 mult × 골든힛 보너스(1.10)
   3. **아이템(장비) 보상 완전 제거** — 무게만
        getGoldenHitDropBonusRate() 폐기 (호환성 위해 0 반환 stub만 유지)
   4. **clampGradeForStage 사용 폐기** — 골든힛에선 모든 지역 신화 허용
        (slot.js 호출 라인 제거됨 — Phase 4b)
   5. **황금어 도감 통합** — 어떤 등급 잡혀도 도감엔 'golden_01' (황금꿈잉어) 1종 등록
        (slot.js의 baseFish 매핑 변경 — Phase 4b)

   [효과 (골든힛 타임 동안 잡힌 황금어에 적용)]
   - 무게: rolledWeight × variantMult × (1 + WEIGHT_BONUS_RATE)
   - 드롭 확률: 0 (장비 안 나옴)

   [황금어 (Goldfish)]
   - 한글: "황금어" (UI 결과 팝업 표시)
   - 도감 등록 ID: 'golden_01' (황금꿈잉어, 1종 통합)
   ============================================ */

/** 골든힛 타임 최대 cast 횟수 */
export const GOLDEN_HIT_MAX_COUNT = 3;

/** 매칭 성립 최소 황금 심볼 수 (이 미만 = 미스, 카운트는 차감되지만 잡기게임 X) */
export const MIN_GOLDEN_FOR_HIT = 3;

/** 무게 보너스율 (베이스 무게 × 1.10) — 정체성 5번 (단순함의 반전) */
export const GOLDEN_HIT_WEIGHT_BONUS_RATE = 0.10;

/**
 * @deprecated ★ Day 27 — 골든힛 아이템 보상 완전 제거. 호환성 위해 0 유지.
 *   slot.js 의 catch-game onClose 분기에서 사용 (Phase 4b에서 호출처 정리 예정).
 */
export const GOLDEN_HIT_DROP_BONUS_RATE = 0;

/** 황금어 UI 표시 한글명 */
export const GOLDFISH_NAME_KR = '황금어';
/** 황금어 영문 slug (호환성) */
export const GOLDFISH_SLUG_EN = 'goldfish';
/** ★ Day 27 — 황금어 도감 등록 ID (단일 통합) */
export const GOLDFISH_CODEX_ID = 'golden_01';

/* ============================================
   ★ Day 27 — 골든힛 전용 등급 테이블 (SSOT)
   ============================================
   ★ Day 40 (대표 결정) — 등급 매핑 전면 재구성 (11구간 → 24구간):
     매칭 개수 → 잡기게임 등급 매핑 변경 + 변종(+ ~ +++++) 분포 재정의.
       3       → 중형 (GOLDEN MEDIUM)        base
       4       → 중형 (GOLDEN MEDIUM+)       +
       5       → 중형 (GOLDEN MEDIUM++)      ++
       6       → 중형 (GOLDEN MEDIUM+++)     +++
       7       → 월척 (GOLDEN BIG)           base
       8~10    → 월척 +, ++, +++
       11      → 대물 (GOLDEN HUGE)          base
       12~14   → 대물 +, ++, +++
       15      → 보스 (GOLDEN BOSS)          base
       16~20   → 보스 +, ++, +++, ++++, +++++
       21~22   → 전설보스 (GOLDEN LEGEND)    base
       23~24   → 전설보스 +
       25~26   → 전설보스 ++
       27~28   → 전설보스 +++
       29~30   → 전설보스 ++++
       31~32   → 전설보스 +++++
       33+     → 신화보스 (GOLDEN MYTHIC)    (변종 없음)

   weightMult: 일반힛 변종 무게 비율과 동일 (옵션 가) — base ×1.0 ~ +++++ ×5.0:
     base    1.00
     +       1.35
     ++      1.85
     +++     2.55
     ++++    3.60
     +++++   5.00
   (일반힛 보스 등급 변종 평균 baseWeight 분석 결과와 일치)

   골든힛 보너스 ×1.10 유지 (applyGoldenHitWeight 에서 적용).

   - 변종 + 표시는 결과팝업의 사이즈 업그레이드 펑 연쇄에서만 노출
     (잡기게임 상단 / 물기 알림은 base만 — 일반힛과 동일)
   ============================================ */
export const GOLDEN_HIT_GRADE_TABLE = Object.freeze([
  // GOLDEN MEDIUM (중형) — 3~6
  { min:  3, max:  3, grade: '중형',     tier: 'base', plusCount: 0, weightMult: 1.00 },
  { min:  4, max:  4, grade: '중형',     tier: 'p1',   plusCount: 1, weightMult: 1.35 },
  { min:  5, max:  5, grade: '중형',     tier: 'p2',   plusCount: 2, weightMult: 1.85 },
  { min:  6, max:  6, grade: '중형',     tier: 'p3',   plusCount: 3, weightMult: 2.55 },
  // GOLDEN BIG (월척) — 7~10
  { min:  7, max:  7, grade: '월척',     tier: 'base', plusCount: 0, weightMult: 1.00 },
  { min:  8, max:  8, grade: '월척',     tier: 'p1',   plusCount: 1, weightMult: 1.35 },
  { min:  9, max:  9, grade: '월척',     tier: 'p2',   plusCount: 2, weightMult: 1.85 },
  { min: 10, max: 10, grade: '월척',     tier: 'p3',   plusCount: 3, weightMult: 2.55 },
  // GOLDEN HUGE (대물) — 11~14
  { min: 11, max: 11, grade: '대물',     tier: 'base', plusCount: 0, weightMult: 1.00 },
  { min: 12, max: 12, grade: '대물',     tier: 'p1',   plusCount: 1, weightMult: 1.35 },
  { min: 13, max: 13, grade: '대물',     tier: 'p2',   plusCount: 2, weightMult: 1.85 },
  { min: 14, max: 14, grade: '대물',     tier: 'p3',   plusCount: 3, weightMult: 2.55 },
  // GOLDEN BOSS (보스) — 15~20
  { min: 15, max: 15, grade: '보스',     tier: 'base', plusCount: 0, weightMult: 1.00 },
  { min: 16, max: 16, grade: '보스',     tier: 'p1',   plusCount: 1, weightMult: 1.35 },
  { min: 17, max: 17, grade: '보스',     tier: 'p2',   plusCount: 2, weightMult: 1.85 },
  { min: 18, max: 18, grade: '보스',     tier: 'p3',   plusCount: 3, weightMult: 2.55 },
  { min: 19, max: 19, grade: '보스',     tier: 'p4',   plusCount: 4, weightMult: 3.60 },
  { min: 20, max: 20, grade: '보스',     tier: 'p5',   plusCount: 5, weightMult: 5.00 },
  // GOLDEN LEGEND (전설보스) — 21~32 (2칸씩)
  { min: 21, max: 22, grade: '전설보스', tier: 'base', plusCount: 0, weightMult: 1.00 },
  { min: 23, max: 24, grade: '전설보스', tier: 'p1',   plusCount: 1, weightMult: 1.35 },
  { min: 25, max: 26, grade: '전설보스', tier: 'p2',   plusCount: 2, weightMult: 1.85 },
  { min: 27, max: 28, grade: '전설보스', tier: 'p3',   plusCount: 3, weightMult: 2.55 },
  { min: 29, max: 30, grade: '전설보스', tier: 'p4',   plusCount: 4, weightMult: 3.60 },
  { min: 31, max: 32, grade: '전설보스', tier: 'p5',   plusCount: 5, weightMult: 5.00 },
  // GOLDEN MYTHIC (신화보스) — 33+
  { min: 33, max: Infinity, grade: '신화보스', tier: null, plusCount: 0, weightMult: 1.00 },
]);

/* ============================================
   ★ Day 28 — 골든힛 전용 잡기게임 속도 테이블 (대표 결정)
   ============================================
   ★ Day 40 (대표 결정) — 일반 등급 orbDuration 그대로 사용 (옵션 F=a).
   11구간 → 6구간 (등급 단위) 단순화.
     중형     700 ms
     월척     600 ms
     대물     500 ms
     보스     400 ms
     전설보스 350 ms
     신화보스 300 ms

   값이 작을수록 빠름 = 잡기 어려움. 단위: ms.
   GOLDEN_HIT_GRADE_TABLE 의 6등급 경계와 정확히 일치.

   장비 orb_speed 옵션은 일반 모드와 동일하게 catch-game.js 의 applyOrbDuration()
   래퍼를 통해 적용됨 (속도 감소 = 잡기 쉬워짐).
   ============================================ */
export const GOLDEN_HIT_ORB_DURATION_TABLE = Object.freeze([
  { min:  3, max:  6,        orbDuration: 700 },  // GOLDEN MEDIUM (중형 일반 orbDuration)
  { min:  7, max: 10,        orbDuration: 600 },  // GOLDEN BIG    (월척 일반)
  { min: 11, max: 14,        orbDuration: 500 },  // GOLDEN HUGE   (대물 일반)
  { min: 15, max: 20,        orbDuration: 400 },  // GOLDEN BOSS   (보스 일반)
  { min: 21, max: 32,        orbDuration: 350 },  // GOLDEN LEGEND (전설보스 일반)
  { min: 33, max: Infinity,  orbDuration: 300 },  // GOLDEN MYTHIC (신화보스 일반)
]);

/**
 * ★ Day 28 — 골든힛 매칭 개수 → 잡기게임 orbDuration (ms) 반환.
 *
 * 매칭 개수가 MIN_GOLDEN_FOR_HIT (3) 미만이면 매칭 자체가 성립하지 않으므로
 * 호출되지 않지만, 안전장치로 최저 구간(800)을 반환.
 *
 * @param {number} count  황금 심볼 전체 개수
 * @returns {number}      orbDuration (ms)
 */
export function getGoldenHitOrbDuration(count) {
  for (const row of GOLDEN_HIT_ORB_DURATION_TABLE) {
    if (count >= row.min && count <= row.max) {
      return row.orbDuration;
    }
  }
  // 폴백 (3 미만 호출 시) — 가장 느린 구간으로
  return GOLDEN_HIT_ORB_DURATION_TABLE[0].orbDuration;
}

/**
 * 골든힛 타임 동안 슬롯에 출현시킬 심볼 결정.
 * - 검은(fish) / 분홍(rainbow) / 하얀(twinkle) → 황금(golden) 치환  ★ Day 21: twinkle 추가
 * - 물방울(empty) → 그대로
 * - 황금(golden) → 그대로
 *
 * @param {string} symbol  원래 추첨된 심볼 ('fish' | 'rainbow' | 'twinkle' | 'golden' | 'empty')
 * @returns {string}
 */
export function convertSymbolForGoldenHit(symbol) {
  if (symbol === 'fish' || symbol === 'rainbow' || symbol === 'twinkle') return 'golden';
  return symbol;
}

/**
 * ★ Day 27 — 골든힛 황금 개수 → 등급+변종 정보 객체 (신규 메인 API).
 *
 * 반환 객체:
 *   - grade        : '대물' | '보스' | '전설보스' | '신화보스' (cluster.gradeOf 시스템과 호환되는 한국어 등급명)
 *   - tier         : 'base' | 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | null (신화/대물은 변종 없음)
 *   - plusCount    : 0 (base) ~ 5 (+++++) — UI 표시 '+' 카운트
 *   - weightMult   : 변종별 무게 배율 (1.0 ~ 2.75)
 *   - displayGrade : '대물', '보스+', '전설보스+++', '신화보스' 등 UI 표시용
 *
 * 신화 51+ 는 전 지역 출현 (Q-F 답변 B안 — 1지역에서도 51+ = 신화).
 * 단, 무게는 지역 multiplier 적용되므로 1지역 신화 = 작은 무게 / 11지역 신화 = 큰 무게.
 *
 * @param {number} count  황금 심볼 전체 개수
 * @returns {{grade: string, tier: string|null, plusCount: number, weightMult: number, displayGrade: string} | null}
 *          null = 매칭 X (3 미만)
 */
export function pickGoldenHitGrade(count) {
  if (count < MIN_GOLDEN_FOR_HIT) return null;
  for (const row of GOLDEN_HIT_GRADE_TABLE) {
    if (count >= row.min && count <= row.max) {
      return {
        grade:        row.grade,
        tier:         row.tier,
        plusCount:    row.plusCount,
        weightMult:   row.weightMult,
        displayGrade: row.grade + '+'.repeat(row.plusCount),
      };
    }
  }
  return null;
}

/**
 * @deprecated ★ Day 27 — 변종 시스템 도입으로 폐기 예정. 호환성 위해 string 반환만 유지.
 *   변종 정보가 필요하면 pickGoldenHitGrade() 사용 (객체 반환).
 *   slot.js 마이그레이션 완료 후 (Phase 4b) 제거 예정.
 *
 *   Day 16 cap (25+ 전설보스) 도 폐기됨 — 25+ 이상은 GOLDEN_HIT_GRADE_TABLE 기반 처리.
 *
 * @param {number} count  황금 심볼 전체 개수
 * @returns {string|null} '대물' | '보스' | '전설보스' | '신화보스' / null = 매칭 X
 */
export function gradeFromGoldenCount(count) {
  const info = pickGoldenHitGrade(count);
  return info ? info.grade : null;
}

/**
 * ★ Day 27 — 무게 계산 (골든힛 통합) — 변종 multiplier + 골든힛 보너스 일체화.
 *
 * 호출 흐름:
 *   1. weight.js rollWeight(_, grade, stageMultiplier) 로 기본 무게 추첨
 *   2. 이 함수에 rolledWeight + 변종 weightMult 전달 → 최종 골든힛 무게 산출
 *
 * 최종 무게 = rolledWeight × variantWeightMult × (1 + 0.10)
 *
 * 예 (11지역 보스++ 매칭, 18개 황금):
 *   - rolledWeight: 80~200 × 100(지역) = 8000~20000
 *   - variantWeightMult: 1.55
 *   - 최종: 13640~34100 kg (×1.10 골든힛 보너스 포함)
 *
 * @param {number} rolledWeight     weight.js rollWeight 결과 (지역 multiplier 적용됨)
 * @param {number} variantWeightMult  pickGoldenHitGrade().weightMult (1.0 ~ 2.75)
 * @returns {number}
 */
export function applyGoldenHitWeight(rolledWeight, variantWeightMult = 1.0) {
  return rolledWeight * variantWeightMult * (1 + GOLDEN_HIT_WEIGHT_BONUS_RATE);
}

/**
 * @deprecated ★ Day 27 — applyGoldenHitWeight 로 통합. 호환성 stub.
 *   기존 호출처: 변종 multiplier 1.0 동일하게 동작.
 * @param {number} baseWeight
 * @returns {number}
 */
export function applyGoldenHitWeightBonus(baseWeight) {
  return applyGoldenHitWeight(baseWeight, 1.0);
}

/**
 * @deprecated ★ Day 27 — 골든힛 아이템 보상 완전 제거. 항상 0 반환.
 *   호출처(slot.js catch-game onClose)는 Phase 4b 에서 분기 정리 예정 (호출 자체 제거).
 *
 * @returns {0}
 */
export function getGoldenHitDropBonusRate() {
  return 0;
}

/**
 * 골든힛 타임 상태 머신 — 활성 세션용 데이터 구조 팩토리.
 *
 * @param {number} savedComboCount  진입 직전 콤보 카운트 (트리거 cast +1 적용 후 값)
 * @returns {{ isActive: boolean, remaining: number, savedComboCount: number }}
 */
export function makeGoldenHitState(savedComboCount = 0) {
  return {
    isActive: true,
    remaining: GOLDEN_HIT_MAX_COUNT,
    savedComboCount,
  };
}

/**
 * 카운트 차감 — 1회 cast 처리 후 호출.
 * 0 도달 시 isActive = false (호출처가 종료 처리).
 *
 * @param {object} state
 * @returns {object} 갱신된 state
 */
export function tickGoldenHitState(state) {
  if (!state || !state.isActive) return state;
  const next = state.remaining - 1;
  return {
    ...state,
    remaining: Math.max(0, next),
    isActive: next > 0,
  };
}

/**
 * 비활성 상태 (초기/종료).
 * @returns {{ isActive: false, remaining: 0, savedComboCount: 0 }}
 */
export function makeInactiveGoldenHitState() {
  return { isActive: false, remaining: 0, savedComboCount: 0 };
}