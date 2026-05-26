/* ===========================================
   enhance-engine.js — 강화 로직 모듈 (Day 11 — Phase 1)
   ============================================
   결정로그 Day 6 / Day 11 SSOT.

   책임:
   1. canEnhance(itemId)  — 강화 가능 여부 + 정보 조회 (화면 표시용)
   2. tryEnhance(itemId)  — 강화 시도 (성공률 굴림 + 강화석 차감 + level++ + 저장)

   정책 (Day 11):
   - 실패 시 단계 유지 (하락 X / 장비 파괴 X) — 코지 톤 (Day 6 정책 그대로)
   - 실패 시에도 강화석 1개 소모
   - 성공 시 level++ 만 (옵션 baseValue 는 그대로 — 표시는 getEnhanceBonus 합산이 자동 반영)
   - 강화석 비용은 모든 등급 1개 통일 (Day 11 — ENHANCE_STONE_COST 참조)

   설계 원칙:
   - 데이터-엔진 분리 — 옵션 값 직접 mutate X. level 만 변경.
   - storage 계층은 이 모듈에서 직접 호출 (load/save 한 곳에서 묶어 관리).
   - UI 무관 (강화 화면이 결과 받아 자체 연출).

   호출:
     import { canEnhance, tryEnhance } from '../data/enhance-engine.js';
     const info = canEnhance(itemId);    // { ok: true, currentLevel: 3, ... }
     const res  = tryEnhance(itemId);    // { success: true, oldLevel: 3, newLevel: 4, ... }
   ============================================ */

import { loadInventory, saveInventory } from '../core/storage.js';
import { findEquipmentById, countEnhanceStones } from './inventory.js';
import { getCatalogEntry } from './equipment-catalog.js';
import {
  ENHANCE_MAX_LEVEL,
  ENHANCE_SUCCESS_RATE,
  ENHANCE_STONE_COST,
  ENHANCE_OUTCOME_TABLE,   // ★ Day 41 — +6강 이상 3분기 확률표
  hasDowngradeRisk,        // ★ Day 41 — 하락 적용 단계 판정
} from './equipment-meta.js';

/* ============================================
   내부 헬퍼 — 강화석 차감 (모든 stack 순회)
   ============================================ */

/**
 * 인벤토리에서 강화석 N개 차감.
 * 차감 전에 충분한지 검증 → 부족하면 inv 미변경 + false 반환 (rollback 안전).
 * 호출 측에서 saveInventory 호출 필요.
 *
 * @param {object} inv
 * @param {number} count — 차감할 개수 (1 이상)
 * @returns {boolean} 차감 성공 여부
 */
function consumeEnhanceStones(inv, count) {
  if (!inv || count <= 0) return count <= 0;
  if (countEnhanceStones(inv) < count) return false;

  let remaining = count;
  for (const it of inv.items) {
    if (!it || it.type !== 'enhancestone') continue;
    if (remaining <= 0) break;
    const take = Math.min(it.count || 0, remaining);
    it.count -= take;
    remaining -= take;
  }
  // count 0 인 stack 제거 (가방 칸 회수)
  inv.items = inv.items.filter(it => !(it && it.type === 'enhancestone' && (it.count || 0) <= 0));
  return remaining === 0;
}

/* ============================================
   공개 API
   ============================================ */

/**
 * 강화 가능 여부 + 정보 조회 (강화 화면 진입 시 호출).
 *
 * 반환 정보 (성공/실패 무관):
 *   currentLevel, nextLevel, maxLevel, successRate, stoneCost, stoneCount, grade, slotId
 *
 * 성공 시: { ok: true, ... 정보 }
 * 실패 시: { ok: false, reason, ... 정보(가능한 한) }
 *
 * reason 종류:
 *   'no_inventory'    — 인벤토리 로드 실패
 *   'item_not_found'  — itemId 로 장비 찾을 수 없음
 *   'unknown_catalog' — catalog 정의 없음
 *   'locked'          — 장비 잠금됨
 *   'max_level'       — 이미 최대 단계
 *   'no_stone'        — 강화석 부족
 *
 * @param {string} itemId
 * @returns {object}
 */
export function canEnhance(itemId) {
  const inv = loadInventory();
  if (!inv) return { ok: false, reason: 'no_inventory' };

  const item = findEquipmentById(inv, itemId);
  if (!item) return { ok: false, reason: 'item_not_found' };

  const entry = getCatalogEntry(item.catalogId);
  if (!entry) return { ok: false, reason: 'unknown_catalog' };

  const currentLevel = item.level || 0;
  const nextLevel    = currentLevel + 1;
  const stoneCount   = countEnhanceStones(inv);
  const stoneCost    = ENHANCE_STONE_COST[entry.grade] ?? 1;
  const successRate  = ENHANCE_SUCCESS_RATE[nextLevel] ?? 0;

  const info = {
    currentLevel,
    nextLevel,
    maxLevel: ENHANCE_MAX_LEVEL,
    successRate,
    stoneCost,
    stoneCount,
    grade:  entry.grade,
    slotId: entry.slotId,
  };

  if (item.locked)                           return { ok: false, reason: 'locked',     ...info };
  if (currentLevel >= ENHANCE_MAX_LEVEL)     return { ok: false, reason: 'max_level',  ...info };
  if (stoneCount < stoneCost)                return { ok: false, reason: 'no_stone',   ...info };

  return { ok: true, ...info };
}

/**
 * 강화 시도.
 * 흐름: 가드 → 강화석 차감 (성공/실패 무관) → 성공률 굴림 → 성공 시 level++ → 저장.
 *
 * 반환:
 *   성공 시: { success: true,  oldLevel, newLevel, successRate, stoneCost, stoneRemaining }
 *   실패 시: { success: false, oldLevel, newLevel: oldLevel, successRate, stoneCost, stoneRemaining }
 *   가드 실패 시: { success: false, reason, oldLevel, newLevel: oldLevel, ... }
 *
 * 가드 실패 reason 은 canEnhance 와 동일 (no_inventory/item_not_found/unknown_catalog/locked/max_level/no_stone).
 * 가드 실패 시 인벤토리 미변경 (강화석 미차감).
 *
 * @param {string} itemId
 * @returns {object}
 */
export function tryEnhance(itemId) {
  const inv = loadInventory();
  if (!inv) return { success: false, reason: 'no_inventory' };

  const item = findEquipmentById(inv, itemId);
  if (!item) return { success: false, reason: 'item_not_found' };

  const entry = getCatalogEntry(item.catalogId);
  if (!entry) return { success: false, reason: 'unknown_catalog' };

  const oldLevel    = item.level || 0;
  const nextLevel   = oldLevel + 1;
  const stoneCost   = ENHANCE_STONE_COST[entry.grade] ?? 1;
  const successRate = ENHANCE_SUCCESS_RATE[nextLevel] ?? 0;

  // 가드 (강화석 차감 전에)
  if (item.locked) {
    return { success: false, reason: 'locked', oldLevel, newLevel: oldLevel, stoneCost };
  }
  if (oldLevel >= ENHANCE_MAX_LEVEL) {
    return { success: false, reason: 'max_level', oldLevel, newLevel: oldLevel, stoneCost };
  }
  if (countEnhanceStones(inv) < stoneCost) {
    return { success: false, reason: 'no_stone', oldLevel, newLevel: oldLevel, stoneCost };
  }

  // 강화석 차감 (성공/유지/하락 무관)
  const consumed = consumeEnhanceStones(inv, stoneCost);
  if (!consumed) {
    // 가드 통과 후 차감 실패 = 데이터 정합성 문제. 안전 가드.
    return { success: false, reason: 'no_stone', oldLevel, newLevel: oldLevel, stoneCost };
  }

  // ★ Day 41 (대표 결정) — +6강 이상은 3분기 추첨 (성공/유지/하락), 이하는 기존 2분기.
  //   outcome: 'success' = level++ / 'maintain' = level 유지 / 'downgrade' = level-- (최소 0)
  let outcome;       // 'success' | 'maintain' | 'downgrade'
  let newLevel = oldLevel;

  if (hasDowngradeRisk(nextLevel)) {
    // +6 ~ +10 강 도전 — 3분기 (success / maintain / downgrade)
    const table = ENHANCE_OUTCOME_TABLE[nextLevel];
    const roll  = Math.random();
    if (roll < table.success) {
      outcome = 'success';
      item.level = nextLevel;
      newLevel = item.level;
    } else if (roll < table.success + table.maintain) {
      outcome = 'maintain';
      // level 그대로
    } else {
      outcome = 'downgrade';
      // 하락 — 최소 0 보장
      item.level = Math.max(0, oldLevel - 1);
      newLevel = item.level;
    }
  } else {
    // +1 ~ +5 강 도전 — 기존 2분기 (success / maintain[기존 fail])
    const success = Math.random() < successRate;
    if (success) {
      outcome = 'success';
      item.level = nextLevel;
      newLevel = item.level;
    } else {
      outcome = 'maintain';
      // level 그대로
    }
  }

  // 저장 (모든 결과에 강화석 차감 반영)
  saveInventory(inv);

  // 호환성 — success 플래그는 outcome === 'success' 와 동일 (기존 호출처가 result.success 만 봐도 동작).
  return {
    success: outcome === 'success',
    outcome,             // ★ Day 41 — 'success' | 'maintain' | 'downgrade'
    oldLevel,
    newLevel,
    successRate,
    stoneCost,
    stoneRemaining: countEnhanceStones(inv),
  };
}