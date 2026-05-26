/* ===========================================
   equipment-effects.js — 장비 옵션 효과 적용 헬퍼
   ============================================
   결정로그 Day 6 / 섹션 4-7 SSOT.

   책임:
   1. 장착된 4부위의 모든 옵션을 집계 (강화 누적 포함)
   2. 옵션 키별 효과 적용 함수 (호출 측에서 사용)

   설계 원칙:
   - 데이터-엔진 분리 — equipment-options.js / equipment-meta.js 의 데이터를
     읽기만 하고 효과 적용 시점에 계산해서 반환.
   - inventory 와 storage 는 호출 측에서 전달 (이 모듈은 stateless).
   - 옵션 미정의/장비 미장착 시 = 기본값 그대로 (안전한 fallback).

   적용 위치 (Equipment-4b/c/d 에서):
   - fish_rate / golden_rate / rainbow_rate → 슬롯 심볼 가중치
   - rock_rate                              → catch-game ROCK_SPAWN_RATE
   - orb_speed                              → catch-game orbDuration
   - weight_bonus                           → weight.js 결과 무게
   - combo_bonus                            → 콤보 1+ 유지 중 추가 무게
   ============================================ */

import { getEquippedBySlot } from './inventory.js';
import { getCatalogEntry } from './equipment-catalog.js';
import { OPTIONS } from './equipment-options.js';
import { getEnhanceBonus } from './equipment-meta.js';
// Day 18 — 레벨 시스템: 활성 옵션 합산 시 레벨 누적 보너스 자동 통합
//   (codexBonuses 와 동일 패턴 — 모든 호출처가 자동 반영됨)
import { getLevelBonuses } from './level-engine.js';
import { SYMBOL_LIST } from './symbols.js';
// ★ Day 30 — 6부위 동적 순회용 (hook + pet 포함)
import { GEAR_SLOTS } from './gear-slots.js';

/** ★ Day 32 — 크리티컬 기본 확률 (대표 결정).
 *
 *  잡기게임 PERFECT/NICE 입력 시 활성. 발동하면 데미지 ×2 (PERFECT 2→4 / NICE 1→2).
 *  장비 critical_rate 옵션 (hook + pet) 과 합산해서 사용. 단위는 % (3 = 3%).
 *
 *  사용처:
 *    - catch-game.js: 크리티컬 체크 + CRITICAL ×2 텍스트 표시
 *    - profile-modal.js: 스탯 표시 (장비 옵션 + 기본 합산)
 */
export const CRITICAL_BASE_RATE = 3;

/**
 * 장착된 4부위의 모든 옵션을 옵션 키별로 합산해서 반환.
 *
 * 누적 규칙:
 * - 같은 옵션 키가 여러 부위에 있으면 합산 (예: 배에도 fish_rate, 낚싯대에도 fish_rate)
 * - 강화 누적은 옵션 베이스값에 더해짐
 * - 사용자에게 표시되는 절대값과 동일 (sign 은 별도, 효과 적용 시 부호 반영)
 *
 * Day 11 변경 ★:
 * - 강화 누적이 (옵션 × 부위 × 등급) 별로 다름 — 단순 등급 × level 곱셈 X
 * - getEnhanceBonus(optionKey, slotId, grade, level) 가 가속 패턴 + ENHANCE_BONUS_TOTAL 매트릭스 참조
 *
 * Day 16 추가 ★ — 장비 도감 보너스 통합:
 * - codexBonuses.fishWeightPct    → totals.weight_bonus    에 합산  (물고기 kg 보너스 %)
 * - codexBonuses.comboWeightPct   → totals.combo_bonus     에 합산  (콤보 kg 보너스 %)
 * - codexBonuses.kabikabiBonusPct → totals.kabikabi_bonus  에 합산  (★ Day 41 신규 — 까비까비 보너스 %)
 * - 호출 측이 codex-engine.getCodexBonuses() 결과를 전달하면 STATS / applyWeight / calcComboBonus / 까비까비 무게 계산이 자동 반영
 *
 * ★ Day 41 (대표 결정) — 도감 cosmetic 카테고리 보상 변경: dropRatePct → kabikabiBonusPct
 *   이전: codexBonuses.dropRatePct 는 totals 에 합산 X (tryRollDrop bonusRate 로 별도 전달)
 *   변경: codexBonuses.kabikabiBonusPct 를 totals.kabikabi_bonus 에 합산 (장비 옵션과 동일 단위)
 *
 * @param {object} inv — 인벤토리 객체 (loadInventory 결과)
 * @param {{ fishWeightPct?: number, comboWeightPct?: number, kabikabiBonusPct?: number }} [codexBonuses]
 *        - Day 16 — 장비 도감 누적 보너스 (codex-engine.getCodexBonuses 결과).
 *          전달 없으면 도감 보너스 미반영 (기존 동작과 동일 — 호환성 유지).
 * @returns {Record<string, number>} — { fish_rate: 5.7, golden_rate: 3.1, ... }
 */
export function getActiveOptions(inv, codexBonuses = null) {
  /** @type {Record<string, number>} */
  const totals = Object.create(null);
  if (!inv || !Array.isArray(inv.items)) {
    // null inv 라도 codexBonuses 가 있으면 0 베이스 + 도감 분만 반영
    for (const key of Object.keys(OPTIONS)) totals[key] = 0;
    if (codexBonuses) {
      totals.weight_bonus    = (totals.weight_bonus    || 0) + (codexBonuses.fishWeightPct    || 0);
      totals.combo_bonus     = (totals.combo_bonus     || 0) + (codexBonuses.comboWeightPct   || 0);
      totals.kabikabi_bonus  = (totals.kabikabi_bonus  || 0) + (codexBonuses.kabikabiBonusPct || 0);  // ★ Day 41
    }
    return totals;
  }

  // 모든 옵션 키 0 으로 초기화 (호출 측에서 ?? 0 안 써도 됨)
  for (const key of Object.keys(OPTIONS)) totals[key] = 0;

  // ★ Day 30 — 모든 GEAR_SLOTS 순회 (rod / float / hook / clothes / boat / pet 6부위 자동 처리).
  //   각 부위에서 장착된 장비의 옵션 합산.
  //   ★ Day 38 후속 (대표 결정 — 강화 효과 인스턴스마다 적용 변경) ★
  //     이전: 강화 보너스 키당 1회만 적용 (옷 weight 3개여도 강화 +12 한 번)
  //     변경: 강화 보너스 × 인스턴스 수 (옷 weight 3개 + 강화 +12 → +36 합산)
  //          → 옵션이 많이 붙을수록 강화 효과 증폭 (옷 풀세트 강함 ↑).
  for (const slot of GEAR_SLOTS) {
    const slotId = slot.id;
    const item = getEquippedBySlot(inv, slotId);
    if (!item || !Array.isArray(item.options)) continue;
    const entry = getCatalogEntry(item.catalogId);
    if (!entry) continue;
    const level = item.level || 0;

    // 같은 키 옵션값 + 인스턴스 수 카운트 (강화 제외)
    const keyValueSums = Object.create(null);
    const keyInstanceCounts = Object.create(null);
    for (const opt of item.options) {
      if (!opt || !opt.key) continue;
      keyValueSums[opt.key] = (keyValueSums[opt.key] || 0) + (opt.value || 0);
      keyInstanceCounts[opt.key] = (keyInstanceCounts[opt.key] || 0) + 1;
    }
    // ★ Day 38 후속 — 강화 보너스 × 인스턴스 수 합산.
    //   예: 옷 weight_bonus 3개 + 강화 +12 → 3 × base + 12 × 3 = 3 × base + 36
    for (const key of Object.keys(keyValueSums)) {
      const enhanceBonus = getEnhanceBonus(key, slotId, entry.grade, level);
      const instCount = keyInstanceCounts[key];
      totals[key] = (totals[key] || 0) + keyValueSums[key] + enhanceBonus * instCount;
    }

    // Day 12: 합성 추가 옵션 (extraOptions) 합산
    // - 기존 옵션과 동일 효과 (예: weight_bonus 는 weight.js 결과 무게 곱셈)
    // - 강화 누적은 적용 X (합성 추가 옵션은 고정값 — 강화 매트릭스 외부)
    if (Array.isArray(item.extraOptions)) {
      for (const opt of item.extraOptions) {
        if (!opt || !opt.key) continue;
        totals[opt.key] = (totals[opt.key] || 0) + (opt.value || 0);
      }
    }
  }

  // Day 16: 장비 도감 보너스 합산 — 장비 옵션과 동일 단위 (%) 로 누적
  // ★ Day 41 — kabikabiBonusPct 합산 추가 (cosmetic 카테고리 보상 변경: dropRatePct → kabikabiBonusPct)
  if (codexBonuses) {
    totals.weight_bonus    = (totals.weight_bonus    || 0) + (codexBonuses.fishWeightPct    || 0);
    totals.combo_bonus     = (totals.combo_bonus     || 0) + (codexBonuses.comboWeightPct   || 0);
    totals.kabikabi_bonus  = (totals.kabikabi_bonus  || 0) + (codexBonuses.kabikabiBonusPct || 0);  // ★ Day 41
  }

  // Day 18 — 레벨 누적 보너스 자동 합산 (모든 호출처 자동 반영).
  //   - fish/golden/rainbow_rate: 양수 가중치 (정수)
  //   - rock_rate / orb_speed:    sign='-' 옵션 — 양수로 저장하는 규약이라 abs 후 가산
  //   - weight_bonus / combo_bonus: 양수 % 가산
  //   - set_drop_rate 는 OPTIONS 에 없어 totals 에 안 들어감 (drop 호출 측 별도 처리)
  const lvBonuses = getLevelBonuses();
  for (const key of Object.keys(OPTIONS)) {
    const raw = lvBonuses[key] || 0;
    if (raw === 0) continue;
    const opt = OPTIONS[key];
    const add = opt.sign === '-' ? Math.abs(raw) : raw;
    totals[key] = (totals[key] || 0) + add;
  }

  return totals;
}

/* ============================================
   효과 적용 함수 (호출 측에서 baseValue 와 활성 옵션 전달)
   ============================================
   각 함수는 stateless — inventory 직접 참조 X.
   호출 측에서 getActiveOptions(inv) 한 번 캐싱하고 여러 함수에 공유.

   부호 처리:
   - + 옵션 (fish_rate, golden_rate, rainbow_rate, weight_bonus, combo_bonus) → 가중치/무게 ↑
   - - 옵션 (rock_rate, orb_speed) → 확률/duration 감소
     (옵션 절대값이 양수로 저장되어 있으니 sign 별도 적용)
   ============================================ */

/**
 * 슬롯 심볼 가중치 적용.
 *
 * Day 7-2: 모델 변경 — % 곱셈 → 정수 직접 가산.
 *   - fish/golden/rainbow 옵션값 만큼 그 심볼 가중치 +N.
 *   - empty 차감은 getAdjustedSymbolList 에서 일괄 처리.
 *
 * @param {string} symbolId — 'fish' | 'golden' | 'rainbow' | 'empty'
 * @param {number} baseWeight — symbols.js 의 기본 가중치
 * @param {Record<string, number>} active — getActiveOptions 결과
 * @returns {number} — 적용된 가중치
 */
export function applySymbolWeight(symbolId, baseWeight, active) {
  let bonusKey = null;
  if (symbolId === 'fish')    bonusKey = 'fish_rate';
  if (symbolId === 'golden')  bonusKey = 'golden_rate';
  if (symbolId === 'rainbow') bonusKey = 'rainbow_rate';
  if (!bonusKey) return baseWeight;
  const bonus = active[bonusKey] || 0;
  return baseWeight + bonus;  // 정수 가산
}

/**
 * 잡기게임 ROCK_SPAWN_RATE 적용.
 * 옵션 sign = '-' → 활성값만큼 감소 (절대값 양수).
 * @param {number} baseRate — 기본 0.30 (30%)
 * @param {Record<string, number>} active
 * @returns {number} — 0~1 범위로 클램프된 적용값
 */
export function applyRockRate(baseRate, active) {
  const reduction = (active.rock_rate || 0) / 100;
  const result = baseRate * (1 - reduction);
  // 안전 클램프 (음수/극단값 방지)
  return Math.max(0, Math.min(1, result));
}

/**
 * 잡기게임 orbDuration 적용.
 * "잡기 속도 -%" → orbDuration 증가 (오래 도는 = 속도 ↓ = 잡기 쉬움).
 * @param {number} baseDuration — ms 단위 (등급별 800/500/400/350/300)
 * @param {Record<string, number>} active
 * @returns {number} — ms (반올림)
 */
export function applyOrbDuration(baseDuration, active) {
  const slowdown = (active.orb_speed || 0) / 100;
  // 속도 -22% = duration × 1.22 (느려짐)
  return Math.round(baseDuration * (1 + slowdown));
}

/** ★ Day 38 (대표 결정) — 콤보 단계 보너스 캡.
 *
 *  콤보 카운트가 이 값에 도달하면 stageBonus 가 캡됨 (= MAX COMBO BONUS 상태).
 *  콤보 카운트 자체는 무한 누적 가능 (예: 80콤보까지 셈) — 보너스만 30에서 멈춤.
 *
 *  사용처:
 *    - calcComboBonus (이 파일) — 무게 보너스 캡 적용
 *    - profile-modal.js — 내정보 콤보 단계 보너스 표시 캡
 *    - combo-text.js — "MAX COMBO BONUS" 텍스트 분기 기준
 */
export const COMBO_STAGE_CAP = 30;

/** ★ Day 38 — 콤보 1단계당 무게 보너스 비율 (5% = 0.05).
 *
 *  이전 (Day 7): 0.1 (10%)
 *  변경 (Day 38): 0.05 (5%)  — 30콤보 캡과 함께 도입.
 *                              30 × 0.05 = 150% 상한.
 *  장비 combo_bonus 는 이 캡과 별개로 동작 (캡 위에 더해짐). */
export const COMBO_STAGE_PER_HIT = 0.05;

/**
 * 콤보 보너스 수치 계산 (표시용 + applyWeight 내부 사용).
 *
 * Day 38 룰 (대표 결정) — 콤보 시스템 변경:
 *   콤보 단계 보너스 = 기본무게 × (min(콤보단계, 30) × 0.05)   [매 콤보마다 +5%, 30콤보 캡 = +150%]
 *   장비 combo_bonus = 기본무게 × (combo_bonus / 100)          [장비 옵션 % 만큼, 캡 X]
 *   콤보 보너스      = 콤보 단계 보너스 + 장비 combo_bonus      (합산, 장비분은 캡 위에 그대로)
 *
 *   예) 80콤보 + 장비 combo_bonus 45% → baseWeight × (1.50 + 0.45) = baseWeight × 1.95
 *
 * 콤보 끊김 (comboCount < 1) → 0 반환.
 * 장비 combo_bonus도 콤보 발동 중일 때만 작용 (콤보 X면 효과 0).
 *
 * @param {number} baseWeight — 콤보 보너스를 계산할 기준 무게 (kg)
 * @param {Record<string, number>} active — getActiveOptions 결과
 * @param {number} comboCount — 현재 콤보 카운트 (0 이면 비활성, 무한 누적 가능)
 * @returns {number} — 콤보 보너스로 추가된 무게 (kg)
 */
export function calcComboBonus(baseWeight, active, comboCount) {
  if (!comboCount || comboCount < 1) return 0;
  // ★ Day 38 — stageBonus 캡 적용 (30콤보 = +150% 상한). 장비 combo_bonus 는 캡 무관.
  const stageBonus      = Math.min(comboCount, COMBO_STAGE_CAP) * COMBO_STAGE_PER_HIT;
  const equipComboBonus = (active.combo_bonus || 0) / 100;
  return baseWeight * (stageBonus + equipComboBonus);
}

/**
 * 물고기 무게에 옵션 적용.
 *
 * Day 7 변경: 시그니처 isComboActive (boolean) → comboCount (number).
 *   - 콤보 단계별 차등 보너스 (1콤보=+10%, 2콤보=+20%, ...)
 *   - 장비 combo_bonus 옵션도 합산 (콤보 발동 중에만)
 *   - weight_bonus 는 항상 적용 (콤보 무관)
 *
 * Day 10 추가: setWeightBonusPct 인자 추가 — 세트 효과 무게 보너스 (% 단위).
 *   - weight_bonus 와 같은 단위로 합산 (대표 결정 — STATS 에서도 합산 표시)
 *   - 호출 측에서 set-effects.js 의 getSetWeightBonus(setGrade) 결과를 전달
 *   - 미전달 시 (default 0) 기존 동작과 동일
 *
 * 최종 무게 = baseWeight × (1 + (weight_bonus + setWeightBonusPct)/100) + 콤보 보너스
 *           = baseWeight × (1 + 총무게보너스율) + 콤보보너스
 *
 * @param {number} baseWeight — weight.js 의 결과 무게 (kg)
 * @param {Record<string, number>} active
 * @param {number} [comboCount=0] — 현재 콤보 카운트 (0 이면 콤보 보너스 X)
 * @param {number} [setWeightBonusPct=0] — 세트 효과 무게 % (0/10/20/30/50)
 * @returns {number}
 */
export function applyWeight(baseWeight, active, comboCount = 0, setWeightBonusPct = 0) {
  const equipWeightBonus = (active.weight_bonus || 0) / 100;
  const setWeightBonus   = (setWeightBonusPct || 0) / 100;
  const totalWeightBonus = equipWeightBonus + setWeightBonus;
  const comboBonus       = calcComboBonus(baseWeight, active, comboCount);
  return baseWeight * (1 + totalWeightBonus) + comboBonus;
}

/**
 * SYMBOL_LIST 에 옵션 효과를 적용한 새 배열 반환.
 * generateGrid(size, list) 에 그대로 전달해서 사용.
 *
 * Day 7-2: 모델 변경 — 정수 가중치 직접 가산.
 *   - fish/golden/rainbow → 옵션값만큼 가중치 +N.
 *   - empty → 옵션 합계만큼 -N (단, 최소 5 보장 — 안전 클램프).
 *   - 옵션 합 너무 크면 empty 5에서 멈춤 (다른 심볼 비율 일부 어긋남, 비상 안전책).
 *
 * Day 21 변경 (대표 결정) ★:
 *   - twinkle_rate 옵션 신규 추가 → twinkle 심볼 가중치 가산 처리.
 *   - empty 차감 합에 twinkleBonus 도 포함 (총합 100 유지 일관성).
 *
 * ★ Day 21 변경 (대표 결정 A1 보정 ★) ★:
 *   - gridSize 인자 추가 — 그리드 크기 기반 보정 도입.
 *   - 보정 계수: stageModifier = 25 / (gridSize × gridSize)
 *       1지역  5×5 = 25셀  → ×1.00 (보정 안 함)
 *       5지역  8×8 = 64셀  → ×0.39
 *       9지역 10×10 = 100셀 → ×0.25
 *       11지역 11×11 = 121셀 → ×0.21 (가장 강한 보정)
 *   - 매칭 심볼(fish/golden/rainbow/twinkle) 의 (베이스+옵션) 합에 stageModifier 곱.
 *   - 후반 갈수록 매칭 셀 절대 수 거의 유지 → 큰 그리드에서 흩어져서 매칭 어려워짐.
 *   - empty 는 매칭 심볼 합의 보충값 (총합 100 유지). 최소 5 보장.
 *   - gridSize 미전달(undefined) 시 25 가정 → 보정 없음 (후방호환).
 *
 * @param {Record<string, number>} active — getActiveOptions 결과
 * @param {Array} [baseList=SYMBOL_LIST] — 베이스 심볼 풀
 * @param {number} [gridSize] — 현재 스테이지 그리드 변 길이 (A1 보정용)
 * @returns {Array} — 가중치 적용된 새 배열
 */
export function getAdjustedSymbolList(active, baseList = SYMBOL_LIST, gridSize) {
  const fishBonus    = (active && active.fish_rate)    || 0;
  const goldenBonus  = (active && active.golden_rate)  || 0;
  const rainbowBonus = (active && active.rainbow_rate) || 0;
  const twinkleBonus = (active && active.twinkle_rate) || 0;
  const EMPTY_MIN    = 5;  // empty 최소 보장값

  // ★ Day 21 — A1 그리드 보정 계수 (25 / 셀수)
  // gridSize 미전달 시 25 가정 → modifier = 1 (보정 없음, 후방호환)
  // ★ Day 40 — 보정 완만하게 (min cap 0.8). 후반 매칭률 유지, 장비 fish_rate 효과 살림. 단 후반 신화 폭주 부작용.
  // ★ Day 41 (대표 결정) — 부드러운 곡선 (sqrt) 으로 변경. 1지역=1.0 기준점 회복 + 후반은 자연 감쇠.
  //   기존(Day 40): 5x5=1.0 / 6x6=0.8 / 7x7=0.8 / ... / 11x11=0.8 (균일)
  //   변경(Day 41): sqrt(25/cells)
  //     5x5=1.000 / 6x6=0.833 / 7x7=0.714 / 8x8=0.625 / 9x9=0.556 / 10x10=0.500 / 11x11=0.455
  //   목적: 후반 지역의 매칭 빈도/등급 자연 감쇠 → 후반 신화 폭주 완화 (대표 시뮬 검토 후 채택).
  const cells = gridSize && gridSize > 0 ? gridSize * gridSize : 25;
  const stageModifier = Math.sqrt(25 / cells);

  // 헬퍼: 베이스 심볼 가중치 찾기 (id로)
  const baseWeightOf = (id) => {
    const s = baseList.find(x => x.id === id);
    return s ? s.weight : 0;
  };

  // 매칭 심볼별 최종 가중치 = (베이스 + 옵션) × stageModifier
  const fishW    = (baseWeightOf('fish')    + fishBonus)    * stageModifier;
  const goldenW  = (baseWeightOf('golden')  + goldenBonus)  * stageModifier;
  const rainbowW = (baseWeightOf('rainbow') + rainbowBonus) * stageModifier;
  const twinkleW = (baseWeightOf('twinkle') + twinkleBonus) * stageModifier;

  // empty = 총합 100 - 매칭심볼 합 (최소 5 보장)
  const matchedSum = fishW + goldenW + rainbowW + twinkleW;
  const emptyW = Math.max(EMPTY_MIN, 100 - matchedSum);

  return baseList.map(s => {
    if (s.id === 'fish')    return { ...s, weight: fishW };
    if (s.id === 'golden')  return { ...s, weight: goldenW };
    if (s.id === 'rainbow') return { ...s, weight: rainbowW };
    if (s.id === 'twinkle') return { ...s, weight: twinkleW };
    if (s.id === 'empty')   return { ...s, weight: emptyW };
    return { ...s };
  });
}