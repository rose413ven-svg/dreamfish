/* ===========================================
   inventory.js — 인벤토리 자료구조 + 헬퍼
   ============================================
   가방 시스템의 데이터 계층. UI 와 완전 분리됨.
   storage.js 가 영구 저장을 담당 (loadInventory / saveInventory).

   ───────────────────────────────────────
   자료구조
   ───────────────────────────────────────

   Inventory:
     {
       capacity: 56,         // 가방 칸 수 (7×8)
       items:    [...],      // 아이템 배열 (빈 칸은 표현 X — 칸 수 < capacity)
     }

   Item — 두 종류:

   1) EquipmentItem (장비)
      {
        type:          'equipment',
        id:            'eq_xxx',         // 인스턴스 고유 (생성 시 자동)
        catalogId:     'rod_common',     // EQUIPMENT_CATALOG 참조
        level:         0,                // 강화 단계 0~5
        locked:        false,            // 잠금 (실수 합성/폐기 방지)
        equipped:      false,            // 현재 장착 중 여부 (장착=true 면 가방 안 'E' 표시)
        options:       [...],            // [{ key, value }] — 옵션 배열 (Day 6 장비 시스템)
        cosmeticColor: '#5FC9F7' | null, // 꾸미기 색 (희귀+ 만, 일반/고급=null)
      }

   2) EnhanceStoneItem (강화석 — stackable)
      {
        type:  'enhancestone',
        count: 5,                    // 1~100 (그 이상은 가방에 새 칸 — 추후)
      }

   ───────────────────────────────────────
   원칙
   ───────────────────────────────────────
   - 정렬은 화면 표시할 때 적용 (데이터 자체 순서는 의미 없음)
   - 빈 칸은 데이터에 없음 (UI에서 capacity - items.length 만큼 빈 칸 그림)
   - 강화석은 100개 cap (그 이상은 추후 결정 — 본 빌드에서는 100 한도)
   ============================================ */

import { getCatalogEntry } from './equipment-catalog.js';
import { rollOptions } from './equipment-options.js';
import { rollCosmeticColor } from './equipment-meta.js';

/** 가방 기본 크기 (7×10) */
export const INVENTORY_CAPACITY = 70;

/** 강화석 1칸 stack 한도 — ★ Day 41 (대표 결정) — 100 → 999 (가방 효율 ↑) */
export const ENHANCE_STONE_STACK_MAX = 999;

/** 다음 인스턴스 id 생성용 시퀀스 (LocalStorage 갱신 시 같이 저장됨) */
let _idSeq = 0;

/** 인스턴스 id 시퀀스 동기화 (loadInventory 후 호출) */
export function syncIdSeq(items) {
  let max = 0;
  for (const it of items) {
    if (it && it.type === 'equipment') {
      const m = /^eq_(\d+)$/.exec(it.id);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  }
  _idSeq = max;
}

/** 새 EquipmentItem 생성 — 옵션/꾸미기 색은 자동 추첨 (opts로 override 가능) */
export function makeEquipment(catalogId, opts = {}) {
  const entry = getCatalogEntry(catalogId);
  if (!entry) {
    console.warn('[inventory] unknown catalogId:', catalogId);
    return null;
  }
  _idSeq += 1;
  return {
    type:          'equipment',
    id:            `eq_${_idSeq}`,
    catalogId,
    level:         opts.level         ?? 0,
    locked:        opts.locked        ?? false,
    equipped:      opts.equipped      ?? false,
    // Day 6 장비 시스템 — 옵션/꾸미기 자동 추첨
    // ★ Day 41 (대표 결정) — opts.stageId 전달 시 3종 옵션(weight/combo/kabikabi)에 지역 multiplier 적용
    options:       opts.options       ?? rollOptions(entry.slotId, entry.grade, opts.stageId),
    // Day 12 합성 시스템 — 합성 추가 옵션 (성공시 20% 확률로 weight_bonus 부착)
    // 구조: [{ key, value, source: 'compose' }, ...] — 향후 확장 대비 배열
    extraOptions:  opts.extraOptions  ?? [],
    cosmeticColor: opts.cosmeticColor !== undefined ? opts.cosmeticColor : rollCosmeticColor(entry.grade),
  };
}

/** 새 EnhanceStoneItem 생성 */
export function makeEnhanceStone(count = 1) {
  return {
    type:  'enhancestone',
    count: Math.max(1, Math.min(ENHANCE_STONE_STACK_MAX, count)),
  };
}

/** 빈 인벤토리 (가방 0개 — 디버그/리셋용) */
export function makeEmptyInventory() {
  return {
    capacity: INVENTORY_CAPACITY,
    items:    [],
  };
}

/**
 * 첫 시작 더미 인벤토리.
 *
 * Day 10 변경: 시작 일반 장비 4개 제거 (대표 결정).
 *   - 이전: 일반 장비 4개 (각 부위) + 강화석 5개 = 5칸 사용
 *   - 변경: 강화석 5개만 = 1칸 사용, 69칸 빈자리
 *   - 의도: 빈 가방으로 시작 → Lucky 드롭으로만 장비 획득 → 자연스러운 진행
 *           "낚시는 기다리는 묘미" 코지 톤 강화. 첫 장비 드롭의 즐거움.
 *   - 강화석은 유지 (강화 시스템 테스트 가능하도록)
 *
 * Day 11 변경 (★ 임시 — 강화 시스템 테스트용): 시작 강화석 5 → 99
 *   - 이유: 10강 시스템 도달까지 강화석 다수 필요 (신화 1부위 풀강 = 10개 + 실패분)
 *           미니게임 (강화석 획득 경로) 구현 전이므로 임시로 ↑.
 *   - ⚠️ 출시 전 5개로 복원 필요. 결정로그에 메모 박음.
 *
 * 추후 게임 진행으로 폐기 가능하도록 storage.js 의 resetInventory() 사용.
 *
 * 영향: 이 함수가 호출되는 시점은 LocalStorage에 가방이 없을 때 (첫 실행 등).
 *       기존 가방을 가진 사용자는 영향 X — 일반 장비 4개 그대로 보유.
 *       깨끗한 시작이 필요하면 LocalStorage 비우거나 resetInventory.
 */
export function makeDefaultInventory() {
  syncIdSeq([]);  // 시퀀스 0 부터 시작
  return {
    capacity: INVENTORY_CAPACITY,
    // Day 20: 시작 강화석 삭제 (대표 결정) — 깨끗한 빈 가방.
    //   강화석은 트윙클 타임 또는 도감 보상으로만 획득.
    items: [],
  };
}

/* ============================================
   조회 헬퍼
   ============================================ */

/** 가방에 남은 빈 칸 수 */
export function getFreeSlots(inv) {
  return Math.max(0, inv.capacity - inv.items.length);
}

/** 가방이 가득 찼는가 */
export function isFull(inv) {
  return getFreeSlots(inv) <= 0;
}

/** 정리 알림 임계값 (5칸) 도달 여부 */
export function shouldNotifyCleanup(inv) {
  return getFreeSlots(inv) <= 5;
}

/** id 로 장비 인스턴스 조회 */
export function findEquipmentById(inv, id) {
  return inv.items.find(it => it && it.type === 'equipment' && it.id === id) || null;
}

/** 부위 별 장착 중 장비 (없으면 null) */
export function getEquippedBySlot(inv, slotId) {
  return inv.items.find(it => {
    if (!it || it.type !== 'equipment' || !it.equipped) return false;
    const entry = getCatalogEntry(it.catalogId);
    return entry?.slotId === slotId;
  }) || null;
}

/**
 * 가방 안 강화석 총 개수 (모든 stack 합산).
 * 강화석은 100 cap 으로 1 stack 이지만 향후 다중 stack 가능성 대비 합산 처리.
 *
 * @param {object} inv — 인벤토리
 * @returns {number} 0 이상의 정수
 */
export function countEnhanceStones(inv) {
  if (!inv || !Array.isArray(inv.items)) return 0;
  let total = 0;
  for (const it of inv.items) {
    if (it && it.type === 'enhancestone') total += (it.count || 0);
  }
  return total;
}

/* ============================================
   변경 헬퍼 (불변성 보장 — 호출 측에서 saveInventory 호출 필요)
   ============================================ */

/** 가방에 장비 추가 (가득 차면 false 반환).
 *  ★ Day 41 — opts.stageId 전달 시 makeEquipment 가 3종 옵션에 지역 multiplier 적용. */
export function addEquipment(inv, catalogId, opts = {}) {
  if (isFull(inv)) return false;
  const item = makeEquipment(catalogId, opts);
  if (!item) return false;
  inv.items.push(item);
  return true;
}

/**
 * 가방에 강화석 추가.
 *
 * Day 20 변경 (대표 결정 — 100개 초과 시 새 가방칸 추가):
 *   1. 기존 enhancestone stack 들의 빈 공간(100-count)부터 채움.
 *   2. 그래도 남으면 가방 빈 칸에 새 stack 으로 push (각 100 cap).
 *   3. 가방 꽉 차서 더 못 받는 양만 사라짐 (불가피).
 *
 * 이전: single stack 만 채우고 초과분은 그냥 버림 (대표 보고로 확인).
 *
 * @param {object} inv
 * @param {number} count - 추가할 양
 * @returns {number} 실제로 추가된 양 (가방 꽉 찬 경우 count 보다 적을 수 있음)
 */
export function addEnhanceStone(inv, count = 1) {
  if (!inv || !Array.isArray(inv.items) || count <= 0) return 0;

  let remaining = count;
  let totalAdded = 0;

  // 1) 기존 모든 stack 의 빈 공간 다 채우기
  for (const stack of inv.items) {
    if (!stack || stack.type !== 'enhancestone') continue;
    const space = ENHANCE_STONE_STACK_MAX - (stack.count || 0);
    if (space <= 0) continue;
    const add = Math.min(space, remaining);
    stack.count = (stack.count || 0) + add;
    totalAdded += add;
    remaining -= add;
    if (remaining <= 0) return totalAdded;
  }

  // 2) 남은 양 → 가방 빈칸이 있으면 새 stack push (각 100 cap)
  while (remaining > 0 && !isFull(inv)) {
    const chunk = Math.min(remaining, ENHANCE_STONE_STACK_MAX);
    inv.items.push(makeEnhanceStone(chunk));
    totalAdded += chunk;
    remaining -= chunk;
  }

  return totalAdded;   // 가방 꽉 차서 남은 양은 못 받음 (이 부분만 손실)
}

/** 장비 잠금 토글 */
export function toggleLock(inv, id) {
  const item = findEquipmentById(inv, id);
  if (!item) return false;
  item.locked = !item.locked;
  return true;
}

/**
 * 장비 장착 — 같은 부위에 이미 장착된 게 있으면 자동 해제 후 새 것 장착.
 * 잠금된 장비도 장착 가능 (장착이 폐기는 아니므로).
 */
export function equipItem(inv, id) {
  const target = findEquipmentById(inv, id);
  if (!target) return false;
  const targetEntry = getCatalogEntry(target.catalogId);
  if (!targetEntry) return false;

  // 같은 부위에 장착된 다른 장비 자동 해제
  for (const it of inv.items) {
    if (!it || it.type !== 'equipment' || !it.equipped) continue;
    const e = getCatalogEntry(it.catalogId);
    if (e && e.slotId === targetEntry.slotId && it.id !== id) {
      it.equipped = false;
    }
  }
  target.equipped = true;
  return true;
}

/** 장비 해제 */
export function unequipItem(inv, id) {
  const item = findEquipmentById(inv, id);
  if (!item) return false;
  item.equipped = false;
  return true;
}

/** 장비 폐기 (잠금된 건 거부) */
export function discardItem(inv, id) {
  const item = findEquipmentById(inv, id);
  if (!item) return false;
  if (item.locked) return false;
  inv.items = inv.items.filter(it => it !== item);
  return true;
}

/* ============================================
   정렬 (UI 표시용 — 데이터 자체 순서는 안 바꿈)
   ============================================ */

import { GEAR_GRADE_ORDER } from './gear-grades.js';
import { GEAR_SLOTS } from './gear-slots.js';

const GRADE_RANK = Object.fromEntries(
  GEAR_GRADE_ORDER.map((g, i) => [g, i])  // common=0 (낮은 등급), mythic=5 (높은 등급)
);
const SLOT_RANK = Object.fromEntries(
  GEAR_SLOTS.map((s, i) => [s.id, i])  // rod=0, float=1, clothes=2, boat=3
);

/**
 * 정렬된 표시용 배열 반환 (원본 미수정).
 * Day 10 v4 변경 (대표 결정): 장착 장비 4개를 부위 무관 가장 앞으로.
 *   0차 정렬: equipped (장착 → 미장착)
 *   1차 정렬: 부위 순 (rod→float→clothes→boat) — 장착끼리 / 미장착끼리 각각 적용
 *   2차 정렬: 등급 높은 순 (mythic→common)
 * 강화석은 항상 맨 끝.
 */
export function getSortedItems(inv) {
  const equipments = [];
  const stones = [];
  for (const it of inv.items) {
    if (!it) continue;
    if (it.type === 'enhancestone') stones.push(it);
    else equipments.push(it);
  }

  equipments.sort((a, b) => {
    // 0차: 장착 우선 (대표 결정 — 장착 장비 4개 가장 위/앞)
    if (a.equipped !== b.equipped) return a.equipped ? -1 : 1;

    const ea = getCatalogEntry(a.catalogId);
    const eb = getCatalogEntry(b.catalogId);
    // 1차: 부위 순 (rod → float → clothes → boat)
    const sa = SLOT_RANK[ea?.slotId] ?? 99;
    const sb = SLOT_RANK[eb?.slotId] ?? 99;
    if (sa !== sb) return sa - sb;
    // 2차: 같은 부위 안에선 등급 높은 순 (mythic → common)
    return (GRADE_RANK[eb?.grade] ?? 0) - (GRADE_RANK[ea?.grade] ?? 0);
  });

  return [...equipments, ...stones];
}

/* ============================================
   마이그레이션 (Day 6 — 장비 옵션 시스템 도입)
   ============================================
   옵션/꾸미기 색이 없는 옛 EquipmentItem (Bag-1 시절 stats:{}만 있던 데이터)을
   자동으로 채워준다. storage.js 의 loadInventory() 에서 호출.
   ============================================ */

/**
 * 인벤토리 마이그레이션. 변경 시 inv 객체 자체를 mutate.
 * 다음 saveInventory() 호출 시 자동 저장됨.
 * @returns {boolean} 변경 발생 여부
 */
export function migrateInventory(inv) {
  if (!inv || !Array.isArray(inv.items)) return false;
  let changed = false;

  // Day 9 — Lucky-2 버그 후속: id 중복 정리.
  // 이전 빌드에서 _idSeq 미동기화로 인해 eq_1, eq_1 같은 중복 id 가 들어갔을 수 있음.
  // 중복 발견 시 새 id 부여 (현재 최대값 + 1).
  {
    let maxIdNum = 0;
    for (const it of inv.items) {
      if (it && it.type === 'equipment') {
        const m = /^eq_(\d+)$/.exec(it.id);
        if (m) maxIdNum = Math.max(maxIdNum, parseInt(m[1], 10));
      }
    }
    const seenIds = new Set();
    for (const it of inv.items) {
      if (!it || it.type !== 'equipment') continue;
      if (seenIds.has(it.id)) {
        maxIdNum += 1;
        it.id = `eq_${maxIdNum}`;
        changed = true;
        console.log('[inventory] id 중복 정리:', it.catalogId, '→', it.id);
      }
      seenIds.add(it.id);
    }
  }

  for (const item of inv.items) {
    if (!item || item.type !== 'equipment') continue;
    const entry = getCatalogEntry(item.catalogId);
    if (!entry) continue;
    // 옵션 배열 없거나 빈 경우 = 옛 데이터
    if (!Array.isArray(item.options) || item.options.length === 0) {
      item.options = rollOptions(entry.slotId, entry.grade);
      changed = true;
    }
    // Day 12 — 합성 추가 옵션 필드 마이그레이션 (기존 저장 장비는 빈 배열로)
    if (!Array.isArray(item.extraOptions)) {
      item.extraOptions = [];
      changed = true;
    }
    // 꾸미기 색 필드 자체가 없으면 추첨 (null 은 명시적으로 "없음" 이므로 건드리지 않음)
    if (!('cosmeticColor' in item)) {
      item.cosmeticColor = rollCosmeticColor(entry.grade);
      changed = true;
    }
    // 옛 stats 필드 정리 (있으면 제거 — Day 6 이후 미사용)
    if ('stats' in item) {
      delete item.stats;
      changed = true;
    }
  }
  return changed;
}