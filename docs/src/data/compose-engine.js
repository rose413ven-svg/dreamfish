/* ===========================================
   compose-engine.js — 합성 시스템 엔진 (Day 12 신규)
   ============================================
   합성 시스템의 모든 비즈니스 로직 (UI 와 완전 분리).
   슬롯머신 연출 데이터 + 합성 결과 생성을 담당.

   ───────────────────────────────────────
   외부 API
   ───────────────────────────────────────

   - canCompose(inv, materialIds)
       재료 검증 (등급 통일 / 부위 통일 / 잠금 / 카운트).
       반환: { ok, reason?, materialCount, fromGrade, toGrade,
               slotId, successRate, lastSlotGoldRate, prelimGoldRate }

   - rollSlotResults(fromGrade, willSucceed)
       슬롯머신 4슬롯 (또는 신화 2슬롯) 의 황금/회색 결과 결정.
       시각 연출용 (1~3번째는 97/3 독립, 마지막은 willSucceed 에 맞춤).
       반환: { slots: ['gold'|'gray', ...], success: boolean, lastSlotIndex }

   - rollExtraOption(toGrade)
       합성 성공 시 추가 옵션 추첨 (20% 확률).
       반환: null | { key, value, source: 'compose' }

   - tryCompose(inv, materialIds)
       원자적 합성 실행. (UI 흐름과 통합 — 시각 연출 후 호출 가능)
       내부에서 canCompose → 성공 판정 → 결과 장비 생성.
       반환: {
         success: boolean,           // 확률 판정 결과
         resultItem: object,         // 새 장비 인스턴스 (가방 추가는 호출측 책임)
         consumedIds: string[],      // 제거할 재료 id 목록
         extraOption?: { key, value, source: 'compose' } | null,
         successRate: number,
       }

   ───────────────────────────────────────
   원칙
   ───────────────────────────────────────
   - UI 분리: navigate / DOM 조작 X. 데이터만 반환.
   - rollback 안전: tryCompose 는 재료 검증 → 결과 생성만.
     인벤토리 갱신 (재료 제거 + 결과 추가) 은 호출측 책임.
   - 슬롯머신 결과는 willSucceed 와 정합 보장 (성공 = 모두 황금, 실패 = 회색 ≥ 1).
   ============================================ */

import {
  COMPOSE_INFO,
  COMPOSE_PRELIM_GOLD_RATE,
  COMPOSE_BONUS_INFO,
  getLastSlotGoldRate,
  getStageOptionMultiplier,   // ★ Day 41 — 합성 추가 옵션 stage multiplier
} from './equipment-meta.js';
import { getCatalogEntry } from './equipment-catalog.js';
import { findEquipmentById, makeEquipment } from './inventory.js';
// ★ Day 41 (대표 결정 B) — 합성 시 최고 도달 지역 자동 사용
import { getCurrentLevel } from './level-engine.js';
import { getUnlockedStageIds } from './stages.js';

/**
 * 합성 시점의 stage multiplier 결정 — 최고 도달 지역 기준.
 * 호출처가 명시적으로 전달하지 않으면 (대부분 케이스) 자동으로 최고 unlock 지역 사용.
 *
 * @param {number} [stageId] — 명시 전달 시 그대로 사용
 * @returns {number} stageId (1~11)
 */
function resolveComposeStageId(stageId) {
  if (typeof stageId === 'number' && stageId > 0) return stageId;
  const unlocked = getUnlockedStageIds(getCurrentLevel());
  return unlocked.length ? Math.max(...unlocked) : 1;
}

/* ============================================
   1. 재료 검증 — canCompose
   ============================================ */

/**
 * 재료 검증 + 합성 정보 조회 (UI 가드 + 시작 가능 여부).
 *
 * 가드 순서 (실패 시 reason 포함하여 즉시 반환):
 *   1. inv 유효성
 *   2. materialIds 배열 + 갯수 일치 (등급 첫 재료 기준)
 *   3. 모든 재료 존재 + 장비 타입
 *   4. 모든 재료 등급 동일 (첫 재료 기준)
 *   5. 모든 재료 부위 동일 (첫 재료 기준)
 *   6. 모든 재료 잠금 X
 *   7. 합성 가능 등급 (신화는 합성 불가)
 *
 * @param {object}   inv          — 인벤토리
 * @param {string[]} materialIds  — 재료 장비 id 배열
 * @returns {object} 검증 결과 + 합성 정보
 */
export function canCompose(inv, materialIds) {
  const fail = (reason) => ({ ok: false, reason });

  if (!inv || !Array.isArray(inv.items)) return fail('no_inventory');
  if (!Array.isArray(materialIds) || materialIds.length === 0) return fail('no_materials');

  // 첫 재료 등급/부위 기준
  const firstItem = findEquipmentById(inv, materialIds[0]);
  if (!firstItem) return fail('material_not_found');
  const firstEntry = getCatalogEntry(firstItem.catalogId);
  if (!firstEntry) return fail('unknown_catalog');

  const fromGrade = firstEntry.grade;
  const slotId    = firstEntry.slotId;
  const info      = COMPOSE_INFO[fromGrade];
  if (!info) return fail('cannot_compose_grade');  // 신화는 합성 불가

  // 재료 갯수 정합
  if (materialIds.length !== info.materialCount) {
    return fail('material_count_mismatch');
  }

  // 모든 재료 검증 — id 중복 X, 존재 O, 잠금 X, 등급/부위 통일
  const seen = new Set();
  for (const id of materialIds) {
    if (seen.has(id)) return fail('duplicate_material');
    seen.add(id);
    const it = findEquipmentById(inv, id);
    if (!it || it.type !== 'equipment') return fail('material_not_found');
    if (it.locked) return fail('material_locked');
    const entry = getCatalogEntry(it.catalogId);
    if (!entry) return fail('unknown_catalog');
    if (entry.grade !== fromGrade) return fail('grade_mismatch');
    if (entry.slotId !== slotId)   return fail('slot_mismatch');
  }

  return {
    ok:               true,
    materialCount:    info.materialCount,
    fromGrade,
    toGrade:          info.resultGrade,
    slotId,
    successRate:      info.successRate,
    prelimGoldRate:   COMPOSE_PRELIM_GOLD_RATE,
    lastSlotGoldRate: getLastSlotGoldRate(fromGrade),
  };
}

/**
 * 첫 재료 1개만 있는 상태에서 등급/부위/슬롯 갯수 등 미리 조회 (UI 안내용).
 * 합성 화면 IDLE 에서 첫 슬롯에만 재료 있을 때 "70% 성공률" 표시 등에 사용.
 *
 * @param {object} item — 재료 장비 1개 (예: 첫 슬롯)
 * @returns {object|null} { fromGrade, toGrade, slotId, materialCount, successRate, ... } | null
 */
export function getComposePreview(item) {
  if (!item || item.type !== 'equipment') return null;
  const entry = getCatalogEntry(item.catalogId);
  if (!entry) return null;
  const info = COMPOSE_INFO[entry.grade];
  if (!info) return null;
  return {
    fromGrade:        entry.grade,
    toGrade:          info.resultGrade,
    slotId:           entry.slotId,
    materialCount:    info.materialCount,
    successRate:      info.successRate,
    prelimGoldRate:   COMPOSE_PRELIM_GOLD_RATE,
    lastSlotGoldRate: getLastSlotGoldRate(entry.grade),
  };
}

/* ============================================
   2. 슬롯머신 결과 결정 — rollSlotResults
   ============================================
   백엔드에서 전체 결과를 먼저 확정하고 (강화 시스템과 동일 패턴 — Day 11 누적 규칙 35),
   슬롯 표시는 "결과에 정합한" 황금/회색 배치로 결정.

   1~3번째 슬롯 = 97/3 독립 추첨
   마지막 슬롯  = lastSlotGoldRate 적용 (역산값)
   신화 합성    = 모든 슬롯 강제 황금 (전설→신화 = 100% 보장)

   주의: 산술적으로 "1~3번째 모두 황금 + 마지막 황금" = 전체 successRate.
        그러나 1~3번째에서 회색이 나오면 마지막 슬롯 결과는 "이미 실패 확정"
        → 마지막 슬롯도 자동 회색 또는 임의 (UI 에서 STOP 버튼 비활성화 + 자동 정지).
   ============================================ */

/**
 * 슬롯머신 황금/회색 결과 결정.
 *
 * ★ Day 26 (대표 결정) ★ — 새 산식:
 *   - 1번째 슬롯 (idx 0): 100% 강제 황금
 *   - 2번째 슬롯 (idx 1): 100% 강제 황금
 *   - 3번째 슬롯 (idx 2, 4슬롯에서만): 97% 황금 (기존 prelim)
 *   - 마지막 슬롯: prelim 모두 황금일 때만 lastSlotGoldRate (재산정 — equipment-meta.js)
 *   - 1, 2번째 강제 도입으로 마지막 황금률이 올라가지만, 전체 성공률은 등급별 successRate 그대로 유지.
 *
 * 산식 검증 (4슬롯 rare 30%):
 *   1.0 × 1.0 × 0.97 × (0.30/0.97) = 0.30 ✓
 *
 * 신화 합성 (2슬롯, successRate=0.70):
 *   1.0 × (0.70/1.0) = 0.70 ✓
 *
 * @param {string} fromGrade — 재료 등급 (common/uncommon/.../legendary)
 * @returns {{ slots: string[], success: boolean, lastSlotIndex: number }}
 */
export function rollSlotResults(fromGrade) {
  const info = COMPOSE_INFO[fromGrade];
  if (!info) return { slots: [], success: false, lastSlotIndex: -1 };

  const count = info.materialCount;
  const lastIdx = count - 1;
  /** @type {('gold'|'gray')[]} */
  const slots = [];

  // ★ Day 26 — 1, 2번째 강제 황금 / 3+ 번째 97% / 마지막은 prelim 모두 황금일 때 lastSlotGoldRate
  let prelimAllGold = true;
  for (let i = 0; i < lastIdx; i++) {
    let isGold;
    if (i < 2) {
      // 1, 2번째 슬롯 = 100% 강제 황금 (대표 결정)
      isGold = true;
    } else {
      // 3번째 이후 (4슬롯에서만 해당) = 기존 97% 추첨
      isGold = Math.random() < COMPOSE_PRELIM_GOLD_RATE;
    }
    slots.push(isGold ? 'gold' : 'gray');
    if (!isGold) prelimAllGold = false;
  }

  // 마지막 슬롯
  let lastIsGold = false;
  if (prelimAllGold) {
    // 1~(N-1) 모두 황금 → 마지막 슬롯에 lastSlotGoldRate 적용
    const lastRate = getLastSlotGoldRate(fromGrade);
    lastIsGold = Math.random() < lastRate;
  } else {
    // 이미 회색 발생 = 실패 확정 → 마지막 회색 (UI 자동 정지)
    lastIsGold = false;
  }
  slots.push(lastIsGold ? 'gold' : 'gray');

  const success = slots.every(s => s === 'gold');
  return { slots, success, lastSlotIndex: lastIdx };
}

/* ============================================
   3. 합성 추가 옵션 추첨 — rollExtraOption
   ============================================
   합성 성공시 20% 확률로 weight_bonus 옵션 부착.
   일반 등급 = 옵션 자체 X (ranges.common = null).
   ============================================ */

/**
 * 합성 추가 옵션 추첨 — 성공시 호출.
 *
 * ★ Day 41 (대표 결정) — stageId 인자 추가 (옵션 2번째).
 *   합성 추가 옵션 (weight_bonus 1종) 도 지역 multiplier 적용 — 본 옵션과 일관성.
 *   호출처 (tryCompose) 가 currentStageId (최고 도달 지역) 전달.
 *
 * @param {string} toGrade — 결과 등급
 * @param {number} [stageId] — 합성 시 지역 multiplier (미지정 시 ×1.0)
 * @returns {{ key, value, source }|null} — 추첨 안 됨 / 등급 X = null
 */
export function rollExtraOption(toGrade, stageId) {
  const range = COMPOSE_BONUS_INFO.ranges[toGrade];
  if (!range) return null;  // 일반 등급 등 = 옵션 X
  if (Math.random() >= COMPOSE_BONUS_INFO.appearRate) return null;  // 80% 미추첨

  // 등급별 % 범위 내 랜덤 추첨 (소수 1자리)
  let raw = range.min + Math.random() * (range.max - range.min);
  // ★ Day 41 — stageId 기반 multiplier (key = weight_bonus 이므로 항상 적용)
  raw *= getStageOptionMultiplier(stageId);
  const value = Math.round(raw * 10) / 10;
  return {
    key:    COMPOSE_BONUS_INFO.optionKey,
    value,
    source: 'compose',
  };
}

/* ============================================
   4. 합성 실행 — tryCompose
   ============================================
   원자적 합성 결과 생성.
   - 재료 검증 (canCompose)
   - 슬롯머신 결과 결정 (rollSlotResults)
   - 결과 장비 생성 (성공 = 다음 등급 / 실패 = 동등급)
   - 성공시 합성 추가 옵션 추첨 (20%)

   ⚠️ 인벤토리 갱신 (재료 제거 + 결과 추가) 은 호출측 책임.
      이 함수는 "어떤 결과가 나왔는지" 만 결정.
      (rollback 안전 + UI 흐름과 분리)
   ============================================ */

/**
 * 합성 시도. 결과만 결정 — 인벤토리 갱신 X (호출측 책임).
 *
 * ★ Day 41 (대표 결정) — stageId 인자 추가 (옵션 3번째).
 *   합성 시 지역 multiplier — 결과 장비의 본 옵션 + 합성 추가 옵션 모두 적용.
 *   호출처 (compose.js) 가 currentStageId (최고 도달 지역) 전달.
 *
 * @param {object}   inv         — 인벤토리
 * @param {string[]} materialIds — 재료 장비 id 배열
 * @param {number}   [stageId]   — 합성 시점의 지역 (최고 도달 지역). 미지정 시 ×1.0.
 * @returns {object} 결과 객체 또는 가드 실패 시 { ok: false, reason }
 */
export function tryCompose(inv, materialIds, stageId) {
  // 1. 가드 검증
  const check = canCompose(inv, materialIds);
  if (!check.ok) return { ok: false, reason: check.reason };

  // ★ Day 41 — stageId 미지정 시 최고 도달 지역 자동 사용 (대표 결정 B)
  const effectiveStageId = resolveComposeStageId(stageId);

  // 2. 슬롯머신 결과 → 성공/실패 확정
  const slotResult = rollSlotResults(check.fromGrade);

  // 3. 결과 장비 생성 — ★ Day 41: stageId 전달 (본 옵션 multiplier)
  const resultGrade = slotResult.success ? check.toGrade : check.fromGrade;
  const resultCatalogId = `${check.slotId}_${resultGrade}`;
  const resultItem = makeEquipment(resultCatalogId, { stageId: effectiveStageId });
  if (!resultItem) {
    // 카탈로그 없음 (예외 — 카탈로그 빌드 정합 깨짐)
    return { ok: false, reason: 'cannot_make_result' };
  }

  // 4. 합성 추가 옵션 추첨 (성공시만) — ★ Day 41: stageId 전달
  let extraOption = null;
  if (slotResult.success) {
    extraOption = rollExtraOption(resultGrade, effectiveStageId);
    if (extraOption) {
      resultItem.extraOptions = [extraOption];
    }
  }

  return {
    ok:           true,
    success:      slotResult.success,
    resultItem,
    consumedIds:  materialIds.slice(),  // 호출측이 인벤토리에서 제거할 id 목록
    slotResults:  slotResult.slots,     // 슬롯머신 시각 연출용 ['gold','gold','gold','gray']
    fromGrade:    check.fromGrade,
    toGrade:      check.toGrade,
    resultGrade,                        // 실제 결과 등급 (성공 = toGrade, 실패 = fromGrade)
    slotId:       check.slotId,
    successRate:  check.successRate,
    extraOption,                        // null 또는 { key, value, source }
  };
}