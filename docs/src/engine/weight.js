/* ===========================================
   weight.js — 무게 추첨 엔진
   ============================================
   Day 17 변경 (대표 결정 — 단순화):
   - 기존 tier 시스템(평범/좋음/대박/기록급 × 배율 0.8~6.0) 제거
   - 등급별 무게 범위 안에서 균등 랜덤 1개 추첨
   - 종별 baseWeight 데이터는 그대로 보존 (도감/표시용, 무게 계산에선 미사용)
   - tier 는 호환성 위해 '평범'(흰색) 고정 더미 반환 (fish-result.js dataset/색)

   호출처:
   - slot.js (일반 cast) : rollWeight(fish.baseWeight, grade)
   - slot.js (골든힛 cast): rollWeight(fish.baseWeight, grade)
     ※ baseWeight 인자는 시그니처 호환성 위해 유지 (실제 계산에선 미사용)
   ============================================ */

/**
 * 등급별 무게 범위 (대표 결정 — Day 17 SSOT / ★ Day 23 전 등급 재조정).
 * 매 매칭마다 [min, max] 범위 안에서 균등 랜덤 1개 추첨.
 * 콤보/장비/세트 보너스 + 멀티히트 배수는 이 위에 추가 적용됨 (applyWeight).
 *
 * ★ Day 23 (대표 결정) ★ — 밸런스 Phase 1-D:
 *   매 cast 보상 0.01 → 0.1 kg 도입에 맞춰 치어/소형 등급 의미감 회복.
 *   동시에 후반 등급(전설/신화보스) 무게는 다소 낮춰 등급 간 비율 정돈.
 *
 *   비교 (변경 전 → 변경 후):
 *   - 치어:     0.10~1.00   →  1~5     (×5 평균)
 *   - 소형:     0.50~5.00   →  3~10    (×2 평균)
 *   - 중형:     3.00~20.00  →  7~25    (그대로 톤)
 *   - 월척:     15~50       →  20~50   (min 살짝 ↑)
 *   - 대물:     40~100      →  40~100  (그대로)
 *   - 보스:     80~300      →  80~200  (max ↓)
 *   - 전설보스: 200~500     →  180~300 (전체 ↓)
 *   - 신화보스: 1000~5000   →  1000~3000 (max ↓)
 *
 *   미스 보상 0.1 kg 와 비교 시 등급 차이가 명확히 살아남:
 *   - 미스 10번 = 1 kg
 *   - 치어 평균 3 kg ≒ 미스 30번
 *   - 소형 평균 6.5 kg ≒ 미스 65번
 *   - 중형 평균 16 kg ≒ 소형 2.5마리
 */
export const GRADE_WEIGHT_RANGE = Object.freeze({
  '치어':     { min:    1,    max:    5    },   // ★ Day 23 — 0.10~1.00 → 1~5
  '소형':     { min:    3,    max:   10    },   // ★ Day 23 — 0.50~5.00 → 3~10
  '중형':     { min:    7,    max:   25    },   // ★ Day 23 — 3~20 → 7~25
  '월척':     { min:   20,    max:   50    },   // ★ Day 23 — 15~50 → 20~50
  '대물':     { min:   40,    max:  100    },   // ★ Day 23 — 그대로 (40~100)
  '보스':     { min:   80,    max:  200    },   // ★ Day 23 — 80~300 → 80~200
  '전설보스': { min:  180,    max:  300    },   // ★ Day 23 — 200~500 → 180~300
  '신화보스': { min: 1000,    max: 3000    },   // ★ Day 23 — 1000~5000 → 1000~3000
});

/**
 * @deprecated Day 17 — tier 시스템 제거. 호환성 위해 더미 1개만 유지.
 *   fish-result.js 의 dataset.tier / finalEl.style.color 에서 참조함 (흰색 고정).
 *   CSS 에 data-tier 셀렉터 분기 없음 (검증 완료).
 */
export const WEIGHT_TIERS = Object.freeze([
  Object.freeze({ name: '평범', probability: 100, multMin: 1, multMax: 1, color: '#FFFFFF' }),
]);

/**
 * @deprecated Day 17 — 사용처 없음. 호환성 위해 stub 유지.
 */
export function rollWeightTier() {
  return WEIGHT_TIERS[0];
}

/**
 * 실제 무게 계산 (Day 17 — 등급별 단순 균등 랜덤 / ★ Day 24 — 지역 배율 적용).
 *
 * ★ Day 24 (대표 결정) ★ — 지역별 무게 배율 도입 (밸런스 Phase 2):
 *   - 시그니처에 stageMultiplier 인자 추가 (기본값 1.0 — 후방호환)
 *   - 호출 측 (slot.js / catch-game.js) 에서 stages.getStageWeightMultiplier(stageId) 전달
 *   - 같은 등급이라도 1지역 ×1.0 / 11지역 ×100 → 후반 갈수록 무게 ↑
 *   - 골든힛 / HIDDEN HIT 도 동일 패턴 (등급은 그대로, 무게만 배율 적용)
 *
 *   데이터-엔진 분리:
 *   - weight.js 는 stages.js 를 import 하지 않음 (호출 측이 multiplier 전달)
 *   - 단일 진입점 유지 (모든 무게 추첨이 이 함수 거침)
 *
 * @param {number} _baseWeight     종별 기본 무게 (Day 17부터 무게 계산에선 미사용 — 데이터 보존)
 * @param {string} grade           '치어' | '소형' | '중형' | '월척' | '대물' | '보스' | '전설보스' | '신화보스'
 * @param {number} [stageMultiplier=1.0]  ★ Day 24 — 지역 배율 (1지역 1.0 ~ 11지역 100)
 * @returns {{ weight: number, tier: object }}
 *          weight: 등급 범위 [min, max] 안 균등 랜덤 × stageMultiplier (콤보/장비/멀티히트 보너스 적용 전)
 *          tier:   '평범' 더미 객체 (호환성 — 색 흰색 고정)
 */
export function rollWeight(_baseWeight, grade, stageMultiplier = 1.0) {
  const range = GRADE_WEIGHT_RANGE[grade];
  if (!range) {
    console.warn('[weight] unknown grade:', grade, '— fallback to 1.0kg');
    return { weight: 1 * stageMultiplier, tier: WEIGHT_TIERS[0] };
  }
  const rolled = range.min + Math.random() * (range.max - range.min);
  const weight = rolled * stageMultiplier;
  return { weight, tier: WEIGHT_TIERS[0] };
}

/**
 * 무게 표시용 포맷 (kg)
 */
export function formatWeight(kg) {
  if (kg >= 100) return kg.toFixed(0) + ' kg';
  if (kg >= 10)  return kg.toFixed(1) + ' kg';
  return kg.toFixed(2) + ' kg';
}