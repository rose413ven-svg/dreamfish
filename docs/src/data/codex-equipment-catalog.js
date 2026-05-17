/* ===========================================
   codex-equipment-catalog.js — 장비 도감 카탈로그 (Day 16 신규)
   ============================================
   136개 = 24(base) + 96(enhance) + 16(cosmetic)

   - base 24:      4부위 × 6등급
   - enhance 96:   4부위 × 6등급 × 4강화단계(+3, +5, +7, +10)
   - cosmetic 16:  4부위 × 4등급(희귀/영웅/전설/신화)

   codexKey 형식:
     - base:      '{slot}_{grade}'              예: 'rod_legendary'
     - enhance:   '{slot}_{grade}_e{level}'     예: 'rod_legendary_e7'
     - cosmetic:  '{slot}_{grade}_cos'          예: 'rod_legendary_cos'

   등록 조건 (codex-engine 에서 검사):
     - base:      가방에 같은 slot+grade + 강화 0 + 꾸미기 없음 장비 1+ 보유
                  (Day 17 후속 v2 — 꾸미기 있으면 cosmetic 도감만 매칭)
     - enhance:   가방에 같은 slot+grade + level === N + 꾸미기 없음 장비 1+ 보유
                  (대표 결정 — 정확히 그 단계만, 그 이상은 X; 꾸미기는 cosmetic 도감 전용)
     - cosmetic:  가방에 같은 slot+grade + cosmeticColor != null 장비 1+ 보유 (강화 수치 무관)
   ============================================ */

import { GEAR_SLOTS } from './gear-slots.js';
import { GEAR_GRADE_ORDER } from './gear-grades.js';
// Day 17 픽스 — inventory item 구조는 catalogId 만 가짐 (slotId/grade는 카탈로그 조회로 획득)
import { getCatalogEntry } from './equipment-catalog.js';

/** 강화 도감 대상 단계 (대표 결정) */
export const CODEX_ENHANCE_LEVELS = Object.freeze([3, 5, 7, 10]);

/** 코스메틱 도감 대상 등급 (희귀+ 만 코스메틱 가능) */
export const CODEX_COSMETIC_GRADES = Object.freeze(['rare', 'epic', 'legendary', 'mythic']);

/**
 * 카탈로그 entry 타입.
 * @typedef {object} EquipmentCodexEntry
 * @property {string} codexKey   고유 식별자 (storage 키와 1:1 매칭)
 * @property {string} slotId     'rod' | 'float' | 'clothes' | 'boat'
 * @property {string} grade      'common' | 'uncommon' | ... | 'mythic'
 * @property {'base'|'enhance'|'cosmetic'} type
 * @property {number} [level]    type='enhance' 일 때만 (3 / 5 / 7 / 10)
 */

/** 전체 카탈로그 빌더 — 24 + 96 + 16 = 136 */
function buildCatalog() {
  const list = [];

  // base 24
  GEAR_SLOTS.forEach(({ id: slotId }) => {
    GEAR_GRADE_ORDER.forEach(grade => {
      list.push({
        codexKey: `${slotId}_${grade}`,
        slotId,
        grade,
        type: 'base',
      });
    });
  });

  // enhance 96
  GEAR_SLOTS.forEach(({ id: slotId }) => {
    GEAR_GRADE_ORDER.forEach(grade => {
      CODEX_ENHANCE_LEVELS.forEach(level => {
        list.push({
          codexKey: `${slotId}_${grade}_e${level}`,
          slotId,
          grade,
          type: 'enhance',
          level,
        });
      });
    });
  });

  // cosmetic 16 (희귀+ 만)
  GEAR_SLOTS.forEach(({ id: slotId }) => {
    CODEX_COSMETIC_GRADES.forEach(grade => {
      list.push({
        codexKey: `${slotId}_${grade}_cos`,
        slotId,
        grade,
        type: 'cosmetic',
      });
    });
  });

  return list;
}

/** @type {ReadonlyArray<EquipmentCodexEntry>} */
export const EQUIPMENT_CODEX_ENTRIES = Object.freeze(buildCatalog());

/** 빠른 조회 맵: codexKey → entry */
const ENTRY_BY_KEY = Object.freeze(
  EQUIPMENT_CODEX_ENTRIES.reduce((acc, e) => {
    acc[e.codexKey] = e;
    return acc;
  }, {})
);

/**
 * codexKey 로 entry 조회.
 * @param {string} codexKey
 * @returns {EquipmentCodexEntry|null}
 */
export function getEquipmentEntryByKey(codexKey) {
  return ENTRY_BY_KEY[codexKey] || null;
}

/** 총 개수 (= 136). */
export const EQUIPMENT_CODEX_TOTAL = EQUIPMENT_CODEX_ENTRIES.length;

/* ============================================
   장비 아이템 → 등록 가능 codexKey 산출
   ============================================
   한 아이템이 여러 도감에 동시 매칭 가능 (예: 전설 +7강 코스메틱 장비 → 3개 도감 동시 등록 가능):
     - 'rod_legendary'
     - 'rod_legendary_e7'  (+7강 정확히)
     - 'rod_legendary_cos' (cosmeticColor 있음)
   ============================================ */

/**
 * 한 장비 인스턴스에서 등록 가능한 모든 codexKey 산출.
 *
 * @param {object} item  inventory 의 장비 인스턴스
 *                       필수: slotId, grade
 *                       선택: enhanceLevel (number), cosmeticColor (string|null)
 * @returns {string[]}   매칭되는 codexKey 배열 (0~3개)
 */
export function getCodexKeysFromItem(item) {
  // Day 17 픽스 (대표 보고 — 가방 컨텍스트 메뉴 도감 빨간점 + 도감 등록 미작동):
  //   inventory item 은 slotId/grade 필드 자체가 없음 (catalogId 안에 합쳐져 있음).
  //   강화 단계도 'enhanceLevel' 이 아니라 'level' (inventory.js makeEquipment 참조).
  //   → getCatalogEntry(item.catalogId) 로 slotId/grade 획득, item.level 사용.
  // Day 17 후속 (대표 결정 — base 매칭 0강 한정):
  //   base 도감은 강화 0 장비만 매칭 (이전: 강화 무관 = 모든 강화 장비 매칭).
  //   강화 N 장비는 enhance 도감(N)에만 매칭됨.
  // Day 17 후속 v2 (대표 보고 — 꾸미기 있는 장비가 일반 도감에도 등록되던 버그):
  //   꾸미기(cosmeticColor) 있는 장비는 cosmetic 도감 1개에만 매칭 (base/enhance 제외).
  //   꾸미기 없는 일반 장비는 base/enhance 매칭 가능 (이전과 동일).
  if (!item || item.type !== 'equipment' || !item.catalogId) return [];
  const entry = getCatalogEntry(item.catalogId);
  if (!entry) return [];
  const { slotId, grade } = entry;
  const keys = [];
  const lv = item.level | 0;
  const hasCosmetic = !!item.cosmeticColor;

  if (hasCosmetic) {
    // 꾸미기 있는 장비 = cosmetic 도감만 (Day 17 후속 v2 대표 결정)
    // 등급이 cosmetic 대상(rare+) 아니면 빈 배열 — 사실상 안 생기는 케이스이지만 방어적.
    if (CODEX_COSMETIC_GRADES.includes(grade)) {
      keys.push(`${slotId}_${grade}_cos`);
    }
  } else {
    // 꾸미기 없는 일반 장비 = base/enhance 매칭 가능
    // base — 강화 0 한정 (Day 17 후속)
    if (lv === 0) {
      keys.push(`${slotId}_${grade}`);
    }
    // enhance — 정확히 3/5/7/10 강일 때만
    if (CODEX_ENHANCE_LEVELS.includes(lv)) {
      keys.push(`${slotId}_${grade}_e${lv}`);
    }
  }

  return keys;
}