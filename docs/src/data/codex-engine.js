/* ===========================================
   codex-engine.js — 도감 등록/판정/정렬 (Day 16 신규)
   ============================================
   storage 와 카탈로그를 연결하는 비즈니스 로직 레이어.

   주요 책임:
   1. 물고기 자동 등록 (잡기 성공 시) + 최고 무게 갱신 + 신규 NEW 플래그
   2. 장비 도감 수동 등록 (사용자 등록 버튼 클릭 시)
   3. 가방 ↔ 도감 비교 → 등록 가능 entry 산출 (빨간점 알림)
   4. 도감 entry 정렬 (등록가능/미등록/완료 + 부위/등급/강화/cosmetic)
   5. 도감 보너스 합산 (외부 effects 호출용)
   ============================================ */

import {
  loadFishCodex,
  saveFishCodex,
  loadEquipmentCodex,
  saveEquipmentCodex,
  loadCodexNewFishNames,
  saveCodexNewFishNames,
  clearCodexNewFishNames,
  clearCodexNewFishNamesByList,
  loadCodexNewBestFishNames,
  addCodexNewBestFishName,
  clearCodexNewBestFishNames,
  clearCodexNewBestFishNamesByList,
} from '../core/storage.js';

import {
  FISH_CODEX_ENTRIES,
  getFishEntryByName,
  AQUARIUM_MAX_FISH,
} from './codex-fish-catalog.js';

import {
  EQUIPMENT_CODEX_ENTRIES,
  getEquipmentEntryByKey,
  getCodexKeysFromItem,
  CODEX_ENHANCE_LEVELS,
} from './codex-equipment-catalog.js';

import {
  sumRewardsFromCodex,
  computeRewardForEntry,
} from './codex-rewards.js';

import { GEAR_GRADE_ORDER } from './gear-grades.js';
import { GEAR_SLOTS } from './gear-slots.js';

/* ============================================
   1. 물고기 도감 — 자동 등록
   ============================================ */

/**
 * 잡기 성공 시 호출 — 물고기 도감에 등록 + 최고 무게 갱신.
 *
 * @param {string} fishName    물고기 이름 (도감 키)
 * @param {number} weightKg    이번에 잡힌 무게
 * @returns {{ isNew: boolean, bestUpdated: boolean }}
 *          isNew: 이번 등록이 처음 등록인지 (NEW 뿅 효과 표시 여부)
 *          bestUpdated: 최고 무게 갱신 여부
 */
export function registerFishCatch(fishName, weightKg) {
  if (!fishName || typeof fishName !== 'string') {
    return { isNew: false, bestUpdated: false };
  }
  // 카탈로그에 없는 이름은 등록 X (방어)
  if (!getFishEntryByName(fishName)) {
    console.warn('[codex] unknown fish name:', fishName);
    return { isNew: false, bestUpdated: false };
  }

  const codex = loadFishCodex();
  const existing = codex[fishName];
  const isNew = !existing;
  const weight = Number(weightKg) || 0;

  let bestUpdated = false;
  if (isNew) {
    codex[fishName] = {
      registeredAt: Date.now(),
      bestWeightKg: weight,
    };
    bestUpdated = true;
  } else if (weight > (existing.bestWeightKg || 0)) {
    codex[fishName] = {
      ...existing,
      bestWeightKg: weight,
    };
    bestUpdated = true;
  }

  saveFishCodex(codex);

  // 신규면 NEW 플래그 큐에 추가
  if (isNew) {
    const newNames = loadCodexNewFishNames();
    if (!newNames.includes(fishName)) {
      newNames.push(fishName);
      saveCodexNewFishNames(newNames);
    }
  }

  // ★ Day 39 — 새 최고기록 갱신 시 NEW BEST 큐에 추가 (도감 우측 하단 NEW 배지 + 빨간점 트리거).
  //   isNew=true 케이스도 bestUpdated=true 이므로 포함됨 (Q2-D: 우측 상단 NEW + 하단 NEW 동시 표시).
  if (bestUpdated) {
    addCodexNewBestFishName(fishName);
  }

  return { isNew, bestUpdated };
}

/** 미확인 신규 물고기 이름 목록. */
export function getNewlyRegisteredFishNames() {
  return loadCodexNewFishNames();
}

/** 미확인 모두 확인 처리 (도감 물고기 탭 진입/이탈 시 호출). */
export function markAllFishNewSeen() {
  clearCodexNewFishNames();
}

/* ★ Day 39 — 새 최고기록 NEW 시스템 export */

/** 미확인 새 최고기록 물고기 이름 목록. */
export function getNewlyRegisteredBestFishNames() {
  return loadCodexNewBestFishNames();
}

/** 새 최고기록 모두 확인 처리. */
export function markAllFishNewBestSeen() {
  clearCodexNewBestFishNames();
}

/** 특정 이름 목록만 NEW (신규 등록) 확인 처리 — 서브 탭 부분 clear 용. */
export function markFishNewSeenByList(names) {
  clearCodexNewFishNamesByList(names);
}

/** 특정 이름 목록만 NEW BEST (새 최고기록) 확인 처리 — 서브 탭 부분 clear 용. */
export function markFishNewBestSeenByList(names) {
  clearCodexNewBestFishNamesByList(names);
}

/** 도감에 등록된 물고기 이름 set 반환. */
export function getRegisteredFishNames() {
  return new Set(Object.keys(loadFishCodex()));
}

/** 특정 물고기의 최고 무게 (없으면 0). */
export function getFishBestWeight(fishName) {
  const codex = loadFishCodex();
  return codex[fishName]?.bestWeightKg ?? 0;
}

/* ============================================
   2. 장비 도감 — 수동 등록
   ============================================ */

/**
 * 일반 보유분 판정 (Day 17 후속 — 대표 결정).
 * - 장비 type
 * - 장착 X (equipped !== true)
 * - 잠금 X (locked !== true)
 * 가방 ↔ 도감 매칭 / 등록 후보 산출 / 소비 후보 정렬 모두 이 기준 사용.
 */
function isRegisterableItem(item) {
  return !!item
      && item.type === 'equipment'
      && !item.equipped
      && !item.locked;
}

/**
 * 한 장비의 옵션 스탯 합 (Day 17 후속 — '가장 허접한' 정렬 기준).
 * options + extraOptions 의 value 단순 합산. 옵션 종류(% vs 정수) 구분 없음 — 대표 결정.
 */
function statSum(item) {
  let s = 0;
  if (Array.isArray(item.options)) {
    for (const o of item.options) s += Number(o?.value) || 0;
  }
  if (Array.isArray(item.extraOptions)) {
    for (const o of item.extraOptions) s += Number(o?.value) || 0;
  }
  return s;
}

/**
 * 등록 시 소비할 "가장 허접한" 매칭 장비 1개 찾기 (Day 17 후속 — 대표 결정).
 *
 * 정렬 우선순위:
 *   - base/enhance 도감 → cosmetic 없음 우선 → 스탯 합 최저
 *   - cosmetic 도감     → 강화 낮음 우선     → 스탯 합 최저
 *
 * 후보 조건:
 *   - isRegisterableItem(item) = true (장착/잠금 제외, 일반 보유분만)
 *   - getCodexKeysFromItem(item) 에 codexKey 포함
 *
 * @param {Array<object>} inventoryItems
 * @param {string} codexKey
 * @returns {object|null}  최우선 1개 (없으면 null)
 */
export function pickWeakestItemForCodexKey(inventoryItems, codexKey) {
  if (!Array.isArray(inventoryItems)) return null;
  const entry = getEquipmentEntryByKey(codexKey);
  if (!entry) return null;

  const candidates = inventoryItems.filter(it =>
    isRegisterableItem(it) && getCodexKeysFromItem(it).includes(codexKey)
  );
  if (candidates.length === 0) return null;

  const isCosmeticCodex = entry.type === 'cosmetic';

  candidates.sort((a, b) => {
    if (isCosmeticCodex) {
      // cosmetic 도감: 강화 낮음 우선 (cosmetic 있는 장비끼리 비교)
      const la = a.level | 0;
      const lb = b.level | 0;
      if (la !== lb) return la - lb;
    } else {
      // base/enhance 도감: cosmetic 없음 우선 (꾸미기 있는 건 다른 도감 보존)
      const ca = a.cosmeticColor ? 1 : 0;
      const cb = b.cosmeticColor ? 1 : 0;
      if (ca !== cb) return ca - cb;
    }
    // 마지막 기준: 스탯 합 최저
    return statSum(a) - statSum(b);
  });

  return candidates[0];
}

/**
 * 등록 버튼 클릭 시 — 장비 도감 1개 entry 등록 + 매칭 장비 1개 소비.
 *
 * Day 17 후속 (대표 결정): 등록 시 가장 허접한 매칭 장비 1개를 가방에서 제거.
 *   - 호출 측에서 inventory 를 load → 이 함수에 전달 → 함수가 mutate (items에서 1개 제거)
 *   - 호출 측에서 saveInventory(inv) 로 영구 저장 (mutate 되어 있음)
 *   - 소비할 장비 없으면 (잠금/장착뿐이거나 매칭 0개) reason='no_registerable_item' 으로 실패
 *
 * @param {string} codexKey
 * @param {object} [inventory]  null 이면 소비 없이 등록만 (테스트/구버전 호환용)
 * @returns {{ ok: boolean, reason?: string, consumedItemId?: string }}
 */
export function registerEquipmentEntry(codexKey, inventory) {
  const entry = getEquipmentEntryByKey(codexKey);
  if (!entry) return { ok: false, reason: 'unknown_key' };

  const codex = loadEquipmentCodex();
  if (codex[codexKey]) return { ok: false, reason: 'already_registered' };

  // Day 17 후속 — 장비 소비 (inventory 전달된 경우)
  let consumedItemId = null;
  if (inventory && Array.isArray(inventory.items)) {
    const target = pickWeakestItemForCodexKey(inventory.items, codexKey);
    if (!target) return { ok: false, reason: 'no_registerable_item' };
    consumedItemId = target.id;
    inventory.items = inventory.items.filter(it => it !== target);
  }

  codex[codexKey] = { registeredAt: Date.now() };
  saveEquipmentCodex(codex);
  return { ok: true, consumedItemId };
}

/** 등록된 codexKey set 반환. */
export function getRegisteredEquipmentKeys() {
  return new Set(Object.keys(loadEquipmentCodex()));
}

/* ============================================
   3. 가방 ↔ 도감 비교 — 등록 가능 산출 (빨간점 알림)
   ============================================ */

/**
 * 가방 안 모든 아이템을 훑어 등록 가능한 미등록 codexKey set 산출.
 *
 * Day 17 후속 (대표 결정): 일반 보유분만 검사 (장착/잠금 제외).
 *   장착/잠금 장비는 등록 시 소비 불가 → 등록 후보로도 카운트 X.
 *
 * @param {Array<object>} inventoryItems  inventory.items
 * @returns {Set<string>}                 미등록 + 가방에 일반 보유분 매칭 있는 codexKey set
 */
export function getRegisterableCodexKeys(inventoryItems) {
  const registered = getRegisteredEquipmentKeys();
  const registerable = new Set();

  if (!Array.isArray(inventoryItems)) return registerable;

  for (const item of inventoryItems) {
    if (!isRegisterableItem(item)) continue;  // Day 17 후속 — 장착/잠금 제외
    const keys = getCodexKeysFromItem(item);
    for (const k of keys) {
      if (!registered.has(k)) registerable.add(k);
    }
  }
  return registerable;
}

/**
 * 가방에 등록 가능한 장비 도감이 1개 이상 있는지.
 * 도감 메뉴/슬롯 햄버거 빨간점 알림용.
 */
export function hasUnregisteredEquipmentInBag(inventoryItems) {
  return getRegisterableCodexKeys(inventoryItems).size > 0;
}

/**
 * 한 아이템의 등록 가능 미등록 codexKey 들 (해당 아이템의 컨텍스트 메뉴 빨간점용).
 *
 * Day 17 후속 (대표 결정): 장착/잠금 장비는 빈 배열 반환 — 등록 후보 아님.
 *
 * @param {object} item
 * @returns {string[]}
 */
export function getRegisterableKeysOfItem(item) {
  if (!isRegisterableItem(item)) return [];  // Day 17 후속 — 장착/잠금 가드
  const registered = getRegisteredEquipmentKeys();
  return getCodexKeysFromItem(item).filter(k => !registered.has(k));
}

/**
 * 한 아이템에 빨간점을 띄울지 (= 미등록 도감 항목이 1개라도 있는지).
 */
export function hasUnregisteredEntryForItem(item) {
  return getRegisterableKeysOfItem(item).length > 0;
}

/* ============================================
   4. 정렬 (장비 도감 — 리스트 UI 용)
   ============================================
   정렬 순서:
   1. 미등록 + 가방에 매칭 장비 있음   (registerable)
   2. 미등록 + 가방에 매칭 장비 없음   (locked)
   3. 등록 완료                         (done)

   같은 그룹 내:
   - 부위 (rod → float → clothes → boat)
   - 등급 (common → mythic)
   - 타입 (base → enhance level asc → cosmetic)
   ============================================ */

/** 정렬 그룹 우선순위 */
const GROUP_PRIORITY = Object.freeze({
  registerable: 0,
  locked:       1,
  done:         2,
});

const SLOT_PRIORITY = Object.freeze(
  GEAR_SLOTS.reduce((acc, s, i) => { acc[s.id] = i; return acc; }, {})
);

const GRADE_PRIORITY = Object.freeze(
  GEAR_GRADE_ORDER.reduce((acc, g, i) => { acc[g] = i; return acc; }, {})
);

/** 타입 우선순위: base < enhance(+3) < enhance(+5) < enhance(+7) < enhance(+10) < cosmetic */
function typePriority(entry) {
  if (entry.type === 'base')     return 0;
  if (entry.type === 'enhance')  return 1 + CODEX_ENHANCE_LEVELS.indexOf(entry.level);
  if (entry.type === 'cosmetic') return 1 + CODEX_ENHANCE_LEVELS.length;
  return 99;
}

/**
 * 장비 도감 entry 리스트를 UI 표시 순서로 정렬해 반환.
 *
 * @param {Array<object>} inventoryItems   가방 items
 * @returns {Array<{entry, group, registered, registerable, reward}>}
 */
export function buildSortedEquipmentList(inventoryItems) {
  const registered  = getRegisteredEquipmentKeys();
  const registerable = getRegisterableCodexKeys(inventoryItems);

  const decorated = EQUIPMENT_CODEX_ENTRIES.map(entry => {
    const isReg = registered.has(entry.codexKey);
    const isCan = registerable.has(entry.codexKey);
    const group = isReg ? 'done' : (isCan ? 'registerable' : 'locked');
    return {
      entry,
      group,
      registered:   isReg,
      registerable: isCan,
      reward:       computeRewardForEntry(entry),
    };
  });

  decorated.sort((a, b) => {
    // 1) 그룹
    const gp = GROUP_PRIORITY[a.group] - GROUP_PRIORITY[b.group];
    if (gp !== 0) return gp;
    // 2) 부위
    const sp = (SLOT_PRIORITY[a.entry.slotId] ?? 99) - (SLOT_PRIORITY[b.entry.slotId] ?? 99);
    if (sp !== 0) return sp;
    // 3) 등급
    const grp = (GRADE_PRIORITY[a.entry.grade] ?? 99) - (GRADE_PRIORITY[b.entry.grade] ?? 99);
    if (grp !== 0) return grp;
    // 4) 타입
    return typePriority(a.entry) - typePriority(b.entry);
  });

  return decorated;
}

/* ============================================
   5. 도감 보너스 합산 (외부 effects 호출용)
   ============================================
   equipment-effects.js / equipment-meta.js 의 tryRollDrop / calcTotalWeight 호출 측에서 사용.
   ============================================ */

/**
 * 현재 등록된 장비 도감 → 누적 보너스.
 *
 * ★ Day 41 (대표 결정) — 반환 키 변경: dropRatePct → kabikabiBonusPct.
 *   cosmetic 카테고리 보상을 장비 발견 +확률에서 까비까비 보너스로 변경.
 *
 * @returns {{ fishWeightPct: number, comboWeightPct: number, kabikabiBonusPct: number }}
 */
export function getCodexBonuses() {
  const codex = loadEquipmentCodex();
  return sumRewardsFromCodex(codex, EQUIPMENT_CODEX_ENTRIES);
}

/* ============================================
   6. 진척도 (헤더 표시용)
   ============================================ */

/** 물고기 도감 진척도 — { current, total } */
export function getFishCodexProgress() {
  return {
    current: getRegisteredFishNames().size,
    total:   FISH_CODEX_ENTRIES.length,
  };
}

/** 장비 도감 진척도 — { current, total } */
export function getEquipmentCodexProgress() {
  return {
    current: getRegisteredEquipmentKeys().size,
    total:   EQUIPMENT_CODEX_ENTRIES.length,
  };
}

/* ============================================
   7. 수족관 표시용 — 등록된 물고기 중 최근 N마리
   ============================================
   대표 결정 — 도감 2개 등록될 때마다 1마리 추가, 최대 AQUARIUM_MAX_FISH(=15).
   가장 최근 등록 물고기 1마리부터 표시 (등록순 역순).
   ============================================ */

/**
 * 수족관에 표시할 물고기 entry 리스트.
 *
 * 대표 결정 (Day 16 — Phase E 후속):
 *   - 도감 4개 등록당 1마리 등장 (60÷4=15 max 정확 부합)
 *   - 최대 15마리 (AQUARIUM_MAX_FISH)
 *   - 가장 최근 등록 N마리 표시 (등록순 역순으로 잘라 시간순 반환)
 *
 * @returns {Array<{ name, grade, baseColor, baseSize, registeredAt }>}
 */
export function getAquariumFishList() {
  const codex = loadFishCodex();
  const names = Object.keys(codex);
  if (names.length === 0) return [];

  // 등록순 정렬 (오래된 → 최근)
  const sorted = names
    .map(name => ({ name, registeredAt: codex[name].registeredAt || 0 }))
    .sort((a, b) => a.registeredAt - b.registeredAt);

  // Day 16 대표 결정: 4개당 1마리 (60÷4=15)
  const count = Math.min(AQUARIUM_MAX_FISH, Math.floor(names.length / 4));
  if (count === 0) return [];

  // 가장 최근 N마리
  const recent = sorted.slice(-count);
  return recent.map(({ name }) => {
    const entry = getFishEntryByName(name);
    return entry ? {
      name:         entry.name,
      grade:        entry.grade,
      baseColor:    entry.baseColor,
      baseSize:     entry.baseSize,
      registeredAt: codex[name].registeredAt || 0,
    } : null;
  }).filter(Boolean);
}