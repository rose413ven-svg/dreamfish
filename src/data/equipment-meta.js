/* ===========================================
   equipment-meta.js — 장비 메타 시스템 데이터
   ============================================
   결정로그 Day 6 / Day 10 / Day 11 / Day 21 SSOT.

   포함:
   - 강화 데이터 (10강 시스템 — Day 11 재설계, Day 21 새 옵션/등급 칸 확장)
   - 합성 데이터 (성공률, 재료/결과 개수)
   - Lucky 드롭 (등급별 확률, 등급 가중 풀)
   - 꾸미기 색 풀 (등급별 단일색, 희귀+ 시작)
   ============================================ */

/* ============================================
   강화 시스템 (섹션 7) — Day 11 재설계 ★
   ============================================
   Day 6 → Day 11 변경:
   - 5강 → 10강
   - 강화석: 등급별 차등 (1~5개) → 모든 등급 1개 통일
   - 성공률: 5단계 → 10단계 (95/90/85/75/65/55/45/35/25/15)
   - 강화 보너스: 단순 등차 (등급별 단일값 × level)
                 → 가속 패턴 + 옵션×부위×등급 매트릭스
   - 실패 시: 단계 유지 + 강화석은 소모 (Day 6 정책 유지, 코지 톤)
   ============================================ */

/** 강화 한도 (+0 ~ +10강) */
export const ENHANCE_MAX_LEVEL = 10;

/**
 * ★ Day 26 — 까비까비 보너스 강화 누적 (선형, 대표 결정).
 *
 * 다른 옵션들은 ENHANCE_ACCEL_PATTERN (가속 패턴) 으로 비선형 누적되지만,
 * kabikabi_bonus 만 단계별 +0.5 씩 일정하게 증가 (대표 명세 명시).
 *
 * 풀강(+10) 시 누적 = 10 × 0.5 = 5.0
 *
 * 적용:
 * - getEnhanceBonus(optionKey, slotId, grade, level) 안 kabikabi_bonus 분기
 * - ENHANCE_BONUS_TOTAL.kabikabi_bonus.float 매트릭스는 참조용 (5.0) — 실제 계산은 선형
 */
export const KABIKABI_ENHANCE_STEP = 0.5;

/**
 * 강화 단계별 성공률 (실패 시 유지, 강화석은 소모).
 * Day 11: 10강 확장. 1~5강 평균 82% (안정), 6~10강 평균 35% (도전).
 * 10강 1회 시도 기댓값 ≈ 강화석 22개.
 */
export const ENHANCE_SUCCESS_RATE = Object.freeze({
  1:  0.95,
  2:  0.90,
  3:  0.85,
  4:  0.75,
  5:  0.65,
  6:  0.55,
  7:  0.45,
  8:  0.35,
  9:  0.25,
  10: 0.15,
});

/**
 * 등급별 강화석 소모량.
 * Day 11: 모든 등급 1개 통일 (대표 결정 — 강화석 자체 희소성으로 가치 보존).
 * 신화 1부위 풀강 = 10개 (실패 평균 포함 22개 ≈ 미니게임 다회 플레이).
 */
export const ENHANCE_STONE_COST = Object.freeze({
  common:    1,
  uncommon:  1,
  rare:      1,
  epic:      1,
  legendary: 1,
  mythic:    1,
});

/**
 * 강화 +N강당 가속 패턴 (10단계, 합 100%).
 * 모든 옵션 공통 비율 — 옵션별로 다른 가속 패턴 X.
 *
 * 1~5강 누적 = 36% (안정 구간)
 * 6~10강 누적 = 64% (도전 구간 — 후반 약 1.8배 가속)
 *
 * 사용: getEnhanceBonus(optionKey, slotId, grade, level) 안에서
 *       cumPct = sum(ENHANCE_ACCEL_PATTERN[0..level-1]) / 100
 *       bonus = ENHANCE_BONUS_TOTAL[opt][slot][grade] × cumPct
 */
export const ENHANCE_ACCEL_PATTERN = Object.freeze([
  4, 6, 7, 9, 10, 11, 12, 13, 14, 14
]);

/**
 * 옵션 × 부위 × 등급별 — 10강 풀강 시 강화 누적 보너스 (총량).
 *
 * 설계 원칙:
 * - 부위별 차등: 메인 부위 (낚싯대=가중치, 찌=감소, 옷=무게) vs 보조 부위 (배)
 * - 등급별 점진 ↑: 일반→신화 비율 스케일링
 * - 옵션 추첨 70% : 강화 누적 30% 비율로 풀강 합계 배분
 *
 * Day 13 변경 ★: 배 부위 강화 누적 전부 ×5 + 일반/고급 등급 추가 (대표 결정).
 *   원인: 기존 작은 수치 (예: 0.1) × cumPct 4% (1강) = 0.004 → 표시 0 으로 뭉개짐.
 *   해결: ×5 로 키우고, 추첨 정밀도 1자리 → 2자리 (equipment-options.js) 같이.
 *   콤보 kg 보너스도 ×5 그대로 (대표 결정 — 끝판왕 풀세팅에서 옷에 근접해도 OK).
 *
 * ★ Day 21 변경 (대표 결정) ★:
 * - 낚싯대 옵션 풀 확장 (고정+랜덤 혼합) 으로 새 등급/옵션 칸들 강화 누적 추가:
 *     golden_rate.rod   → common, uncommon 신규 (rare 의 30% / 60% 톤)
 *     rainbow_rate.rod  → common, uncommon, rare 신규 (epic 의 15% / 30% / 60% 톤)
 *     twinkle_rate      → 전부 신규 (golden_rate 와 동일 톤 — D1 안)
 * - 모두 기존 패턴 따라 임시값 — 대표 검토 후 조정 가능.
 *
 * 부위 풀에 해당 옵션이 없으면 키 부재 → getEnhanceBonus 가 0 반환.
 */
export const ENHANCE_BONUS_TOTAL = Object.freeze({
  // 가중치 옵션 (양수, 합 100 유지)
  // ★ Day 23 (대표 결정) ★ — fish_rate 강화 누적 ×2 상향 (밸런스 Phase 1-B):
  //   대표 의도 "강화 의미를 더 크게" 반영 — 옵션 추첨 : 강화 비율 70:30 → 67:33 으로 강화 비중 ↑
  //   신화 낚싯대 풀강 시 = 옵션 추첨 평균 16 + 강화 누적 9 = 25 (이전 16.5 대비 +52%)
  fish_rate: {
    rod:  { common: 1.0, uncommon: 2.0, rare: 3.0, epic: 5.0, legendary: 7.0, mythic: 9.0 },     // ★ Day 23 — ×2
    boat: { common: 0.20, uncommon: 0.50, rare: 5.0, epic: 7.0, legendary: 10.0, mythic: 15.0 }, // ★ Day 23 — ×2
  },
  golden_rate: {
    // Day 21 — common/uncommon 신규 (rare 0.3 의 약 30% / 60% 톤)
    // ★ Day 23 — 일반~희귀만 소폭 상향 (영웅+ 그대로) — 옵션 추첨 상향과 동일 톤
    rod:  { common: 0.15, uncommon: 0.30, rare: 0.45, epic: 0.5, legendary: 0.8, mythic: 1.2 },  // ★ Day 23
    boat: { common: 0.04, uncommon: 0.08, rare: 0.75, epic: 0.75, legendary: 1.0, mythic: 1.5 }, // ★ Day 23
  },
  rainbow_rate: {
    // Day 21 — common/uncommon/rare 신규 (epic 0.5 의 약 20% / 30% / 60% 톤)
    // ★ Day 23 — 일반~희귀만 소폭 상향 (다른 입질과 동일 톤으로 정리)
    rod:  { common: 0.15, uncommon: 0.25, rare: 0.45, epic: 0.5, legendary: 0.9, mythic: 1.5 },  // ★ Day 23
    boat: { common: 0.04, uncommon: 0.08, rare: 0.75, epic: 0.75, legendary: 1.0, mythic: 1.5 }, // ★ Day 23
  },

  // ★ Day 21 신규 ★ 하얀물고기 입질(트윙클) — golden_rate 와 동일 톤 (D1 안)
  // ★ Day 23 — 일반~희귀만 소폭 상향 (golden_rate 와 동일)
  twinkle_rate: {
    rod:  { common: 0.15, uncommon: 0.30, rare: 0.45, epic: 0.5, legendary: 0.8, mythic: 1.2 },  // ★ Day 23
    boat: { common: 0.04, uncommon: 0.08, rare: 0.75, epic: 0.75, legendary: 1.0, mythic: 1.5 }, // ★ Day 23
  },

  // 감소량 옵션 (양수로 저장; sign='-' 로 적용 — equipment-options.js 참조)
  rock_rate: {
    float: { common: 0.3, uncommon: 0.7, rare: 1.4, epic: 2.3, legendary: 3.3, mythic: 4.5 },
    boat:  { common: 0.05, uncommon: 0.15, rare: 0.75, epic: 2.25, legendary: 5.0, mythic: 7.5 },
  },
  orb_speed: {
    float: { common: 0.3, uncommon: 0.7, rare: 1.4, epic: 2.3, legendary: 3.3, mythic: 4.5 },
    boat:  { common: 0.05, uncommon: 0.15, rare: 0.75, epic: 2.25, legendary: 5.0, mythic: 7.5 },
  },

  // 무한 +% 옵션 (cap 없음)
  weight_bonus: {
    clothes: { common: 1, uncommon: 2, rare: 3, epic: 6, legendary: 8, mythic: 12 },
    boat:    { common: 0.15, uncommon: 0.35, rare: 1.5, epic: 5, legendary: 10, mythic: 15 },
  },
  combo_bonus: {
    clothes: { rare: 5, epic: 8, legendary: 12, mythic: 17 },  // 희귀+ 만
    boat:    { common: 0.30, uncommon: 0.75, rare: 3, epic: 10, legendary: 20, mythic: 35 },
  },

  // ★ Day 26 신규 ★ 까비까비 보너스 — 찌 희귀+ 전용, 풀강 = 5.0 (선형 +0.5 × 10)
  //   ⚠️ 실제 계산은 getEnhanceBonus 안 선형 분기로 처리 (가속 패턴 미사용).
  //   이 값은 풀강 표시/참조용 (다른 옵션과 인터페이스 일관성 유지).
  kabikabi_bonus: {
    float: { rare: 5.0, epic: 5.0, legendary: 5.0, mythic: 5.0 },  // 등급 무관 풀강 +5.0
  },
});

/**
 * 단계별 가속 누적 비율 (0~100).
 * level=0 → 0 / level=N → 1~N단계 비율 합 / level≥10 → 100.
 *
 * @param {number} level — 0 ~ ENHANCE_MAX_LEVEL
 * @returns {number} 0 ~ 100
 */
export function accumEnhancePct(level) {
  if (!level || level <= 0) return 0;
  if (level >= ENHANCE_MAX_LEVEL) return 100;
  let acc = 0;
  for (let i = 0; i < level; i++) acc += ENHANCE_ACCEL_PATTERN[i];
  return acc;
}

/**
 * 옵션 × 부위 × 등급 × 강화 단계의 강화 누적 보너스 (절대값).
 *
 * 부위별로 옵션 풀이 다르므로 (낚싯대 메인 vs 배 보조 등),
 * 같은 옵션이라도 부위에 따라 다른 누적량을 적용해야 함.
 *
 * @param {string} optionKey — 'fish_rate' | 'golden_rate' | ... (OPTIONS 키)
 * @param {string} slotId    — 'rod' | 'float' | 'clothes' | 'boat'
 * @param {string} grade     — 'common' ~ 'mythic'
 * @param {number} level     — 0 ~ 10
 * @returns {number} 강화 누적 보너스 (해당 옵션의 단위와 동일, 예: % 또는 가중치)
 */
export function getEnhanceBonus(optionKey, slotId, grade, level) {
  if (!level || level <= 0) return 0;

  // ★ Day 26 — 까비까비 보너스만 선형 +0.5/단계 (가속 패턴 미사용, 대표 결정).
  //   찌 희귀+ 등급에서만 옵션이 추첨되므로 다른 부위/등급에서는 자연스럽게 0 반환.
  if (optionKey === 'kabikabi_bonus') {
    // 옵션이 추첨되는 부위/등급에서만 강화 누적 적용 (옵션 부재 시 0).
    const hasOption = ENHANCE_BONUS_TOTAL.kabikabi_bonus?.[slotId]?.[grade];
    if (!hasOption) return 0;
    const capped = Math.min(level, ENHANCE_MAX_LEVEL);
    return capped * KABIKABI_ENHANCE_STEP;
  }

  const total = ENHANCE_BONUS_TOTAL[optionKey]?.[slotId]?.[grade];
  if (!total) return 0;
  return total * accumEnhancePct(level) / 100;
}

/* ============================================
   합성 시스템 (섹션 9)
   ============================================
   재료 = 같은 부위 + 같은 등급 (A안)
   결과 = 동일 부위, 등급은 윗 등급 (성공) 또는 같은 등급 (실패) 1장
   ============================================ */

/**
 * 재료 등급 → 합성 정보. (Day 12 갱신)
 * 성공률 = 슬롯머신 4슬롯 (또는 신화 2슬롯) 모두 황금일 확률 = 전체 합성 성공 확률.
 * 실패 시 동등급 1장 (재료 등급 그대로) — 기획서 v2.3 의 50% 사라짐 룰 변경.
 *
 * 슬롯머신 룰:
 * - 1~3번째 슬롯 = 각 황금 97% / 회색 3% 독립 추첨
 * - 마지막 슬롯 = 등급별 황금률 (역산값) 적용 → 전체 성공률 = successRate
 * - 신화는 모든 슬롯 강제 황금 (100% 보장)
 */
export const COMPOSE_INFO = Object.freeze({
  common: {
    materialCount: 4,
    resultGrade:   'uncommon',
    successRate:   0.70,
  },
  uncommon: {
    materialCount: 4,
    resultGrade:   'rare',
    successRate:   0.50,
  },
  rare: {
    materialCount: 4,
    resultGrade:   'epic',
    successRate:   0.30,
  },
  epic: {
    materialCount: 4,
    resultGrade:   'legendary',
    successRate:   0.20,
  },
  legendary: {
    materialCount: 2,
    resultGrade:   'mythic',
    successRate:   0.70,    /* Day 17 후속 v2 (대표 결정): 1.00 → 0.70 */
  },
});

/**
 * 슬롯머신 1~3번째 슬롯 황금 확률 (Day 12).
 * 4번째(마지막) 슬롯의 황금률은 전체 successRate 와 prelimGoldRate 로부터 역산.
 *
 * 산식: prelimGoldRate^(materialCount-1) * lastSlotGoldRate = successRate
 *   → lastSlotGoldRate = successRate / prelimGoldRate^(materialCount-1)
 *
 * 신화는 모든 슬롯 100% 황금 강제 (별도 처리).
 */
export const COMPOSE_PRELIM_GOLD_RATE = 0.97;

/**
 * 합성 추가 옵션 (Day 12 신규) — 합성 성공시만 등장, 모든 등급 동일 확률.
 *
 * 부착 옵션: weight_bonus (물고기 kg 보너스) — 기존 옵션과 동일 효과 (weight.js 결과 무게 곱셈).
 * 표시: 장비 인스턴스의 extraOptions 배열에 별도 저장 → UI 에서 분홍색 줄로 표시.
 *       일반 등급 = 옵션 자체 등장 X (ranges.common = null).
 */
export const COMPOSE_BONUS_INFO = Object.freeze({
  /** 합성 성공 시 추가 옵션 등장 확률 (모든 등급 동일) */
  appearRate: 0.20,

  /** 부착될 옵션 키 (현재 weight_bonus 1종 — 향후 확장 가능) */
  optionKey: 'weight_bonus',

  /** 결과 등급별 % 범위 (한 부위당) — Day 12 대표 결정 */
  ranges: Object.freeze({
    common:    null,                  // 일반 = 합성 추가 옵션 X
    uncommon:  { min: 1,  max: 3  },  // 고급 +1~3%
    rare:      { min: 3,  max: 5  },  // 희귀 +3~5%
    epic:      { min: 5,  max: 8  },  // 영웅 +5~8%
    legendary: { min: 8,  max: 12 },  // 전설 +8~12%
    mythic:    { min: 12, max: 20 },  // 신화 +12~20%
  }),
});

/**
 * 마지막 슬롯 황금률 역산 (UI 표시 / 시뮬레이션 검증용).
 * Day 17 후속 v2 (대표 결정): 신화도 일반 산식 적용 (1.0 강제 분기 제거).
 *
 * ★ Day 26 (대표 결정) ★ — 1, 2번째 슬롯 100% 강제 황금 도입:
 *   - 1, 2번째 = 1.0 (강제), 3번째 ~ (N-1)번째 = 0.97 (기존 prelim)
 *   - 4슬롯: prelimAll = 1.0 × 1.0 × 0.97 = 0.97. lastSlotGoldRate = successRate / 0.97.
 *   - 2슬롯 (신화): prelimAll = 1.0 (1번째만 prelim — 강제). lastSlotGoldRate = successRate.
 *   - 전체 성공률 유지 (등급별 successRate 그대로).
 *
 * @param {string} fromGrade — 재료 등급
 * @returns {number} — 마지막 슬롯 황금 확률 (0~1).
 */
export function getLastSlotGoldRate(fromGrade) {
  const info = COMPOSE_INFO[fromGrade];
  if (!info) return 0;
  // ★ Day 26 — 1, 2번째 강제 황금 (=1.0) 반영한 prelimAll 산식
  const lastIdx = info.materialCount - 1;
  const numForced = Math.min(2, lastIdx);                    // 강제 황금 슬롯 수 (1, 2번째)
  const numPrelim = Math.max(0, lastIdx - numForced);        // 0.97 추첨 슬롯 수
  const prelimAll = Math.pow(COMPOSE_PRELIM_GOLD_RATE, numPrelim);
  return info.successRate / prelimAll;
}

/* ============================================
   Lucky 드롭 (섹션 11)
   ============================================
   물고기 잡을 때마다 일정 확률로 장비 드롭.
   부위는 4부위 균등 랜덤, 등급은 물고기 등급별 가중 풀.
   ============================================ */

/**
 * 물고기 등급별 장비 드롭 확률 (Day 9 갱신).
 * 잡기 성공한 1마리에 대해서만 시도 (다중매칭이어도 selectedFish 1마리만).
 */
export const LUCKY_DROP_RATE = Object.freeze({
  '치어':     0.70,  
  '소형':     0.75,
  '중형':     0.80,
  '월척':     0.85,
  '대물':     0.90,  
  '보스':     0.90,
  '전설보스': 1.00,
  '신화보스': 1.00,  // Day 16 신규
});

/**
 * 물고기 등급별 드롭 장비 등급 가중 풀 (Day 9 갱신).
 * [등급, 확률] 페어 배열, 합 = 1.0
 */
export const LUCKY_DROP_GRADE_POOL = Object.freeze({
  '치어':     [['common',    0.98], ['uncommon', 0.02]],                                                    // Day 15 갱신: 일반 70 / 고급 30
  '소형':     [['common',    0.95], ['uncommon', 0.05]],                                                    // Day 15 갱신: 일반 60 / 고급 40
  '중형':     [['common',    0.90], ['uncommon', 0.07], ['rare',      0.03]],                               // Day 15 갱신: 일반 40 / 고급 50 / 희귀 10
  '월척':     [['common',    0.80], ['uncommon', 0.10], ['rare',      0.07], ['epic',      0.03]],
  '대물':     [['common',    0.60], ['uncommon', 0.25], ['rare',      0.10], ['epic',      0.05]],          // Day 15: 월척 복제 (임시)
  '보스':     [['uncommon',  0.65], ['rare',     0.25], ['epic',      0.08], ['legendary', 0.02]],
  '전설보스': [['rare',      0.80], ['epic',     0.15], ['legendary', 0.03], ['mythic',    0.02]],
  '신화보스': [['legendary', 0.50], ['mythic',   0.50]],                               // ★ Day 27 — 무조건 1개, 전설 50% / 신화 50% (대표 결정 Q-G)
});

/** 부위 균등 랜덤 풀 */
const DROP_SLOT_POOL = Object.freeze(['rod', 'float', 'clothes', 'boat']);

/**
 * 물고기 등급 → 드롭 장비 등급 가중 추첨.
 * 풀에 없으면 'common' 반환.
 */
export function rollDropGrade(fishGrade) {
  const pool = LUCKY_DROP_GRADE_POOL[fishGrade];
  if (!pool || pool.length === 0) return 'common';
  const roll = Math.random();
  let acc = 0;
  for (const [grade, weight] of pool) {
    acc += weight;
    if (roll < acc) return grade;
  }
  return pool[pool.length - 1][0];
}

/** 부위 균등 랜덤 (4부위 각 25%) */
export function rollDropSlot() {
  return DROP_SLOT_POOL[Math.floor(Math.random() * DROP_SLOT_POOL.length)];
}

/**
 * 물고기 등급 → 장비 드롭 시도.
 * 확률 미달 시 null 반환.
 *
 * Day 10 — 세트 효과 'dropRatePct' 추가 적용 위해 bonusRate 인자 추가.
 *   호출 측에서 set-effects.js 의 getSetDropRateBonus(setGrade) 결과를 전달.
 *   bonusRate 미전달 시 (default 0) 기존 동작과 동일 — 호환성 유지.
 *   합산 후 cap 100% (Math.min(1, ...)).
 *
 * ★ Day 25 (대표 결정) ★ — 지역 관계없이 드롭 등급 확률 동일.
 *   (Day 24 dropShift 인자 폐기, rollDropGrade 직접 사용으로 원복)
 *
 * @param {string} fishGrade — '치어' | '소형' | '중형' | '월척' | '대물' | '보스' | '전설보스' | '신화보스'
 * @param {number} [bonusRate=0] — 추가 확률 (소수 0~1 단위, 예: 0.15 = +15%p)
 * @returns {{ slotId: string, grade: string } | null}
 */
export function tryRollDrop(fishGrade, bonusRate = 0) {
  const baseRate  = LUCKY_DROP_RATE[fishGrade] ?? 0;
  const totalRate = Math.min(1, baseRate + (bonusRate || 0));  // cap 100%
  if (Math.random() >= totalRate) return null;
  return {
    slotId: rollDropSlot(),
    grade:  rollDropGrade(fishGrade),
  };
}

/**
 * ★ Day 25 — 드롭 발생 여부만 확인 (수량 결정 X).
 *
 * tryRollDrop 의 확률 체크 로직만 분리.
 * 복수 드롭 처리 (slot.js) 에서 확률 통과 후 수량을 별도로 결정할 때 사용.
 *
 * @param {string} fishGrade
 * @param {number} [bonusRate=0]
 * @returns {boolean} 드롭 발생 여부
 */
export function checkDropChance(fishGrade, bonusRate = 0) {
  const baseRate  = LUCKY_DROP_RATE[fishGrade] ?? 0;
  const totalRate = Math.min(1, baseRate + (bonusRate || 0));
  return Math.random() < totalRate;
}

/* ============================================
   꾸미기 색 (섹션 10 — Day 10 단순화)
   ============================================
   희귀부터 시작 (일반/고급 = 꾸미기 X).
   드롭/합성 시 COSMETIC_DROP_RATE 확률로 색 부여, 떨어지면 null.

   Day 10 변경:
   - 등급별 색 풀 3가지 변형 → 등급당 단일 색으로 단순화 (대표 결정)
   - 100% 자동 부여 → 50% 확률 부여 (테스트용, 정식 빌드 ~10% 예정)
   - 색 = gear-grades.js GEAR_GRADES 의 color 와 동일 (글로우 톤 통일)
   ============================================ */

/**
 * 등급별 꾸미기 색 (Day 10 — 등급당 단일 색).
 * 일반/고급 = null (꾸미기 X).
 * 색 코드는 gear-grades.js 의 GEAR_GRADES.color 와 일치.
 */
export const COSMETIC_COLOR_BY_GRADE = Object.freeze({
  common:    null,
  uncommon:  null,
  rare:      '#2563EB',  // 진한 파랑 (Day 19 변경 — 청은 #5FC9F7 → 진한 파랑 #2563EB)
  epic:      '#B080D0',  // 보라
  legendary: '#FFD96A',  // 황금
  mythic:    '#FF49A6',  // 진한 분홍 (Day 16 후속 — 신화보스 색과 통일)
});

/**
 * 꾸미기 옵션 부여 확률 (희귀+ 장비 대상).
 * Day 10 — 테스트용 50%. 정식 빌드에서 10% 정도로 낮출 예정 (대표 메모).
 */
export const COSMETIC_DROP_RATE = 0.5;

/**
 * 등급별 꾸미기 색 추첨 (Day 10 변경).
 *   - 일반/고급 = 항상 null (적용 X)
 *   - 희귀+ = COSMETIC_DROP_RATE 확률로 등급 색 반환, 떨어지면 null
 *
 * 합성/드롭 시 makeEquipment 안에서 자동 호출 (inventory.js).
 * @param {string} grade — common | uncommon | rare | epic | legendary | mythic
 * @returns {string|null}
 */
export function rollCosmeticColor(grade) {
  const color = COSMETIC_COLOR_BY_GRADE[grade];
  if (!color) return null;  // 일반/고급
  if (Math.random() >= COSMETIC_DROP_RATE) return null;  // 50% 확률 미당첨
  return color;
}

/**
 * @deprecated Day 10 단순화로 등급당 단일 색이 되어, COSMETIC_COLOR_BY_GRADE 사용 권장.
 * 호환성 위해 남겨둠 — 외부 import 없으면 다음 정리에서 제거 가능.
 */
export const COSMETIC_COLOR_POOL = COSMETIC_COLOR_BY_GRADE;