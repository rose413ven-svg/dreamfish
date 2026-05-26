/* ===========================================
   codex-rewards.js — 도감 보상 룰 + 합산
   ============================================
   ★ Day 41 (대표 결정) ★ — 도감 보상 전면 재설계:
   - 총합 상향: base 30% → 100% / enhance 50% → 100% / cosmetic 10% → 100%
   - cosmetic 카테고리 보상 종류 변경: 장비 발견 +확률 → 까비까비 보너스
   - 가중치 분리: base 와 enhance 가 서로 다른 등급 가중치를 쓰도록 분리

   ★ Day 41 v2 (대표 보고 — 저등급 고강화 도감 보상이 너무 낮고 신화 한쪽 압도) ★
   - "일반 +10강 = 1.0%" 를 기준점으로 enhance 가중치 평탄화
   - 등급 격차 ↓ (mythic 압도 완화)

   ★ Day 41 v3 (대표 결정) ★ — 강화 단계 평탄화 + 콤보 보너스 비중 ↑
   - REWARD_TOTAL_PCT.enhance: 100 → 150 (콤보 보너스가 메인 성장 보상)
   - ENHANCE_WEIGHT: {3:1, 5:2, 7:5, 10:12} → {3:2, 5:4, 7:6, 10:8} (1:2:3:4 비율)
     +10강 쏠림 해소 → +3/+5/+7강 보상이 의미 있게 ↑
   - 일반 +3강: 0.083% → 0.25% (×3 ↑)
   - 일반 +5강: 0.167% → 0.50% (×3 ↑)
   - 일반 +7강: 0.417% → 0.75% (×1.8 ↑)
   - 일반 +10강: 1.0% (그대로 — 대표 기준점)
   - base (물고기 보너스) 와 cosmetic (까비까비) 는 v2 그대로 유지
     (base 와 enhance 는 다른 보상 종류라 직접 비교 무의미 — 카테고리 내 단조 증가만 보장)

   ----- Day 41 v3 가중치 -----
   [base 100%]   — 물고기 kg 보너스 (v2 그대로)
     GRADE_WEIGHT_BASE = {common:8, uncommon:12, rare:18, epic:26, legendary:35, mythic:45}
     → entry 1개당:
        common 0.93% / uncommon 1.39% / rare 2.08% / epic 3.01%
        legendary 4.05% / mythic 5.21%

   [enhance 150%]   — 콤보 kg 보너스 (★ Day 41 v3 — 합 150% + 강화단계 평탄화)
     GRADE_WEIGHT_ENHANCE = {common:10, uncommon:11, rare:13, epic:16, legendary:20, mythic:30}  (합 100, v2 그대로)
     ENHANCE_LEVEL_WEIGHT = {3:2, 5:4, 7:6, 10:8}                                                  (합 20, 비율 1:2:3:4)
     → 일반 +10강 1.000% / +7강 0.750% / +5강 0.500% / +3강 0.250%
     → 신화 +10강 3.000% / +7강 2.250% / +5강 1.500% / +3강 0.750%
     → 전설 +10강 2.000% / 영웅 +10강 1.600%

   [cosmetic 100%]   — 까비까비 보너스 (v2 그대로 평탄화)
     GRADE_WEIGHT_COSMETIC = {rare:15, epic:22, legendary:32, mythic:45}                          (합 114)
     → 신화 1개 6.58% / 전설 4.68% / 영웅 3.22% / 희귀 2.19%

   ----- 분배 공식 (부위 6 / SLOT_COUNT 자동) -----
   base entry      = (GRADE_WEIGHT_BASE[grade]      / Σ_base / 6) × REWARD_TOTAL_PCT.base
   enhance entry   = (GRADE_WEIGHT_ENHANCE[grade] × ENHANCE_LEVEL_WEIGHT[level] / Σ_enh_grade / Σ_enh_lv / 6) × REWARD_TOTAL_PCT.enhance
   cosmetic entry  = (GRADE_WEIGHT_COSMETIC[grade]  / Σ_cos / 6) × REWARD_TOTAL_PCT.cosmetic
   ============================================ */

import { GEAR_SLOTS } from './gear-slots.js';
import { CODEX_ENHANCE_LEVELS, CODEX_COSMETIC_GRADES } from './codex-equipment-catalog.js';

/* ============================================
   가중치 정의 — Day 41 분리 구조
   ============================================ */

/** base 카테고리(물고기 보너스) 등급 가중치. Day 41 v2 — 격차 ×5.6 (이전 ×16.7 → 평탄화). */
export const GRADE_WEIGHT_BASE = Object.freeze({
  common:    8,
  uncommon:  12,
  rare:      18,
  epic:      26,
  legendary: 35,
  mythic:    45,
});

/** enhance 카테고리(콤보 보너스) 등급 가중치. ★ Day 41 v2 — "일반 +10강 1.0%" 기준점 평탄화 (합 100). */
export const GRADE_WEIGHT_ENHANCE = Object.freeze({
  common:    10,
  uncommon:  11,
  rare:      13,
  epic:      16,
  legendary: 20,
  mythic:    30,
});

/** cosmetic 카테고리(까비까비 보너스) 등급 가중치. ★ Day 41 v2 — 평탄화 (격차 ×5 → ×3). rare 이상만. */
export const GRADE_WEIGHT_COSMETIC = Object.freeze({
  rare:      15,
  epic:      22,
  legendary: 32,
  mythic:    45,
});

/** 강화 단계 가중치 — ★ Day 41 v3: 2:4:6:8 (1:2:3:4 비율, 합 20).
 *  이전 v2 {1, 2, 5, 12} — +10강 60% 쏠림 → +3/+5/+7강 보상 너무 낮음.
 *  v3 평탄화 — +10강 비중 40%, +3/+5/+7강도 의미 있는 보상.
 *  결과 (일반 등급 기준): +3강 0.25% / +5강 0.50% / +7강 0.75% / +10강 1.00% */
export const ENHANCE_WEIGHT = Object.freeze({
  3:  2,
  5:  4,
  7:  6,
  10: 8,
});

/* 호환성 — 외부에서 GRADE_WEIGHT 를 참조할 수 있어서 base 가중치로 alias (deprecated). */
export const GRADE_WEIGHT = GRADE_WEIGHT_BASE;

/** 카테고리별 보상 종류. */
export const REWARD_TYPE = Object.freeze({
  base:     'fishWeightPct',     // 물고기 kg 보너스 %
  enhance:  'comboWeightPct',    // 콤보 kg 보너스 %
  cosmetic: 'kabikabiBonusPct',  // ★ Day 41 — 까비까비 보너스 % (이전: dropRatePct)
});

/** Day 41 — 카테고리별 합. ★ Day 41 v3: enhance 100 → 150 (콤보 보너스 메인 성장 보상). */
export const REWARD_TOTAL_PCT = Object.freeze({
  base:     100,   // ★ Day 41 — 30 → 100
  enhance:  150,   // ★ Day 41 v3 — 100 → 150 (콤보 보너스가 메인 성장 보상)
  cosmetic: 100,   // ★ Day 41 — 10 → 100
});

/* ============================================
   분모 (각 카테고리 합산용)
   ============================================ */

const SLOT_COUNT = GEAR_SLOTS.length;                                // 6 (Day 30: hook + pet 추가)

const GRADE_WEIGHT_BASE_SUM = Object.values(GRADE_WEIGHT_BASE)
  .reduce((a, b) => a + b, 0);                                       // 8+12+18+26+35+45 = 144

const GRADE_WEIGHT_ENHANCE_SUM = Object.values(GRADE_WEIGHT_ENHANCE)
  .reduce((a, b) => a + b, 0);                                       // 10+11+13+16+20+30 = 100 (Day 41 v2 평탄화)

const GRADE_WEIGHT_COSMETIC_SUM = CODEX_COSMETIC_GRADES
  .reduce((s, g) => s + (GRADE_WEIGHT_COSMETIC[g] || 0), 0);         // 15+22+32+45 = 114

const ENHANCE_WEIGHT_SUM = Object.values(ENHANCE_WEIGHT)
  .reduce((a, b) => a + b, 0);                                       // 2+4+6+8 = 20 (Day 41 v3 평탄화 1:2:3:4)

/* ============================================
   entry 보상값 산출
   ============================================ */

/**
 * 도감 1개 entry의 보상값 산출 (raw, round 없음 — 합산 정확성 위해).
 *
 * @param {{ type: string, slotId: string, grade: string, level?: number }} entry
 * @returns {{ kind: string, valuePct: number }}
 *          kind: 'fishWeightPct' | 'comboWeightPct' | 'kabikabiBonusPct'
 *          valuePct: 퍼센트값
 */
export function computeRewardForEntry(entry) {
  if (!entry || !entry.type || !entry.grade) {
    return { kind: 'fishWeightPct', valuePct: 0 };
  }

  if (entry.type === 'base') {
    const gradeW = GRADE_WEIGHT_BASE[entry.grade] || 0;
    const valuePct = (gradeW / GRADE_WEIGHT_BASE_SUM / SLOT_COUNT) * REWARD_TOTAL_PCT.base;
    return { kind: REWARD_TYPE.base, valuePct };
  }

  if (entry.type === 'enhance') {
    const gradeW = GRADE_WEIGHT_ENHANCE[entry.grade] || 0;
    const enhW   = ENHANCE_WEIGHT[entry.level] || 0;
    const denom  = GRADE_WEIGHT_ENHANCE_SUM * ENHANCE_WEIGHT_SUM * SLOT_COUNT;
    const valuePct = (gradeW * enhW / denom) * REWARD_TOTAL_PCT.enhance;
    return { kind: REWARD_TYPE.enhance, valuePct };
  }

  if (entry.type === 'cosmetic') {
    const gradeW = GRADE_WEIGHT_COSMETIC[entry.grade] || 0;
    const valuePct = (gradeW / GRADE_WEIGHT_COSMETIC_SUM / SLOT_COUNT) * REWARD_TOTAL_PCT.cosmetic;
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

/** 부동소수점 누적 방지 — 소수점 3자리로 정리. */
function round3(n) {
  return Number(n.toFixed(3));
}

/* ============================================
   등록된 도감 → 누적 보상 합산
   ============================================ */

/**
 * 등록 완료된 codexKey 들에서 누적 보상 산출.
 *
 * @param {object} equipmentCodex
 * @param {Array<EquipmentCodexEntry>} allEntries
 * @returns {{ fishWeightPct: number, comboWeightPct: number, kabikabiBonusPct: number }}
 */
export function sumRewardsFromCodex(equipmentCodex, allEntries) {
  // ★ Day 41 — dropRatePct → kabikabiBonusPct 변경
  const raw = { fishWeightPct: 0, comboWeightPct: 0, kabikabiBonusPct: 0 };
  if (!equipmentCodex || typeof equipmentCodex !== 'object') return raw;
  if (!Array.isArray(allEntries)) return raw;

  for (const entry of allEntries) {
    if (!equipmentCodex[entry.codexKey]) continue;
    const r = computeRewardForEntry(entry);
    raw[r.kind] += r.valuePct;
  }
  return {
    fishWeightPct:    round3(raw.fishWeightPct),
    comboWeightPct:   round3(raw.comboWeightPct),
    kabikabiBonusPct: round3(raw.kabikabiBonusPct),
  };
}

/**
 * 최대값 (100% 달성 시 합계) — UI 진척도 표시용.
 * ★ Day 41 — 100/100/100 으로 통일.
 */
export const MAX_REWARDS = Object.freeze({
  fishWeightPct:    REWARD_TOTAL_PCT.base,
  comboWeightPct:   REWARD_TOTAL_PCT.enhance,
  kabikabiBonusPct: REWARD_TOTAL_PCT.cosmetic,
});