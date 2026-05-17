/* ===========================================
   codex-rewards.js — 도감 보상 룰 + 합산 (Day 16 신규)
   ============================================
   대표 결정 룰:
   - 도감 등록 시 보상 종류 = 카테고리별 1:1 매핑
     · base 24      → 물고기 kg 보너스 (전체 100% 달성 시 합계 30%)
     · enhance 96   → 콤보 kg 보너스   (전체 100% 달성 시 합계 50%)
     · cosmetic 16  → 장비 발견 +확률  (전체 100% 달성 시 합계 10%)

   가중치 (어려울수록 보상 ↑):
   - 등급 가중치  [common=1, uncommon=2, rare=3, epic=5, legendary=8, mythic=13]
   - 강화 가중치  [e3=2, e5=3, e7=5, e10=8]
   - cosmetic 가중치 = 등급 가중치 그대로

   분배 공식:
   - base entry      = (등급가중치 / Σ등급가중치 / 4부위) × 30%
   - enhance entry   = (등급가중치 × 강화가중치 / Σ등급 / Σ강화 / 4부위) × 50%
   - cosmetic entry  = (등급가중치 / Σ코스메틱등급 / 4부위) × 10%

   검증: 각 카테고리 전체 합 = 정확히 30 / 50 / 10
   ============================================ */

import { GEAR_SLOTS } from './gear-slots.js';
import { CODEX_ENHANCE_LEVELS, CODEX_COSMETIC_GRADES } from './codex-equipment-catalog.js';

/* ============================================
   가중치 정의
   ============================================ */

/** 등급 가중치 (어려울수록 ↑). 부트스트랩 정체성 5: 단순함의 반전 — 신화는 일반의 13배. */
export const GRADE_WEIGHT = Object.freeze({
  common:    1,
  uncommon:  2,
  rare:      3,
  epic:      5,
  legendary: 8,
  mythic:    13,
});

/** 강화 가중치 (+7/+10 가파르게 ↑). */
export const ENHANCE_WEIGHT = Object.freeze({
  3:  2,
  5:  3,
  7:  5,
  10: 8,
});

/** 카테고리별 보상 종류 + 전체 합 (단위 = %). */
export const REWARD_TYPE = Object.freeze({
  base:     'fishWeightPct',   // 물고기 kg 보너스 %
  enhance:  'comboWeightPct',  // 콤보 kg 보너스 %
  cosmetic: 'dropRatePct',     // 장비 발견 +확률 %p
});

export const REWARD_TOTAL_PCT = Object.freeze({
  base:     30,
  enhance:  50,
  cosmetic: 10,
});

/* ============================================
   분모 (각 카테고리 합산용)
   ============================================ */

const SLOT_COUNT = GEAR_SLOTS.length;                              // 4

const GRADE_WEIGHT_SUM = Object.values(GRADE_WEIGHT)
  .reduce((a, b) => a + b, 0);                                     // 1+2+3+5+8+13 = 32

const ENHANCE_WEIGHT_SUM = Object.values(ENHANCE_WEIGHT)
  .reduce((a, b) => a + b, 0);                                     // 2+3+5+8 = 18

const COSMETIC_GRADE_WEIGHT_SUM = CODEX_COSMETIC_GRADES
  .reduce((s, g) => s + GRADE_WEIGHT[g], 0);                       // 3+5+8+13 = 29

/* ============================================
   entry 보상값 산출
   ============================================ */

/**
 * 도감 1개 entry의 보상값 산출 (raw, round 없음 — 합산 정확성 위해).
 * UI 표시용은 computeRewardForEntryDisplay 사용.
 *
 * @param {{ type: string, slotId: string, grade: string, level?: number }} entry
 * @returns {{ kind: string, valuePct: number }}
 *          kind: 'fishWeightPct' | 'comboWeightPct' | 'dropRatePct'
 *          valuePct: 퍼센트값 (예: 1.875 = 1.875%)
 */
export function computeRewardForEntry(entry) {
  if (!entry || !entry.type || !entry.grade) {
    return { kind: 'fishWeightPct', valuePct: 0 };
  }

  const gradeW = GRADE_WEIGHT[entry.grade] || 0;

  if (entry.type === 'base') {
    // (등급가중치 / 32 / 4) × 30
    const valuePct = (gradeW / GRADE_WEIGHT_SUM / SLOT_COUNT) * REWARD_TOTAL_PCT.base;
    return { kind: REWARD_TYPE.base, valuePct };
  }

  if (entry.type === 'enhance') {
    const enhW = ENHANCE_WEIGHT[entry.level] || 0;
    // (등급 × 강화 / 32 / 18 / 4) × 50
    const denom = GRADE_WEIGHT_SUM * ENHANCE_WEIGHT_SUM * SLOT_COUNT;
    const valuePct = (gradeW * enhW / denom) * REWARD_TOTAL_PCT.enhance;
    return { kind: REWARD_TYPE.enhance, valuePct };
  }

  if (entry.type === 'cosmetic') {
    // (등급가중치 / 29 / 4) × 10
    const valuePct = (gradeW / COSMETIC_GRADE_WEIGHT_SUM / SLOT_COUNT) * REWARD_TOTAL_PCT.cosmetic;
    return { kind: REWARD_TYPE.cosmetic, valuePct };
  }

  return { kind: 'fishWeightPct', valuePct: 0 };
}

/**
 * UI 표시용 — round 3자리.
 * @param {{ type, slotId, grade, level? }} entry
 */
export function computeRewardForEntryDisplay(entry) {
  const r = computeRewardForEntry(entry);
  return { kind: r.kind, valuePct: round3(r.valuePct) };
}

/** 부동소수점 누적 방지 — 소수점 3자리로 정리 (Day 11 규칙 37 패턴). */
function round3(n) {
  return Number(n.toFixed(3));
}

/* ============================================
   등록된 도감 → 누적 보상 합산
   ============================================ */

/**
 * 등록 완료된 codexKey 들에서 누적 보상 산출.
 *
 * @param {object} equipmentCodex  storage 의 EQUIPMENT_CODEX 데이터 (= { [codexKey]: {...} })
 * @param {Array<EquipmentCodexEntry>} allEntries  EQUIPMENT_CODEX_ENTRIES
 * @returns {{ fishWeightPct: number, comboWeightPct: number, dropRatePct: number }}
 *          (단위: %, dropRatePct 는 %p)
 */
export function sumRewardsFromCodex(equipmentCodex, allEntries) {
  // raw 누적 (round 없음 — 누적 오차 방지)
  const raw = { fishWeightPct: 0, comboWeightPct: 0, dropRatePct: 0 };
  if (!equipmentCodex || typeof equipmentCodex !== 'object') return raw;
  if (!Array.isArray(allEntries)) return raw;

  for (const entry of allEntries) {
    if (!equipmentCodex[entry.codexKey]) continue;
    const r = computeRewardForEntry(entry);
    raw[r.kind] += r.valuePct;
  }
  // 마지막에 한 번만 round (Day 11 규칙 37 패턴)
  return {
    fishWeightPct:  round3(raw.fishWeightPct),
    comboWeightPct: round3(raw.comboWeightPct),
    dropRatePct:    round3(raw.dropRatePct),
  };
}

/**
 * 최대값 (100% 달성 시 합계) — UI 진척도 표시용.
 */
export const MAX_REWARDS = Object.freeze({
  fishWeightPct:  REWARD_TOTAL_PCT.base,
  comboWeightPct: REWARD_TOTAL_PCT.enhance,
  dropRatePct:    REWARD_TOTAL_PCT.cosmetic,
});