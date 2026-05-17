/* ===========================================
   equipment-catalog.js — 장비 카탈로그 (24종)
   ============================================
   장비 데이터의 단일 진실 원천 (SSOT).

   구조:
     4부위 (rod / float / clothes / boat) × 6등급 (common~mythic) = 24종

   각 카탈로그 항목 = "장비의 정체" (등급, 부위, 이름, 설명).
   인벤토리의 EquipmentItem 인스턴스가 catalogId 로 이 카탈로그를 참조.

   stats(능력치) 필드는 비워둠 — 장비 시스템 단계(다음 단계)에서 채움.
   여기에 채워두면 나중에 변경 시 가방 시스템 코드도 함께 손봐야 함.

   네이밍 톤:
     게임 분위기(별빛 연못 / 달빛 향어)와 일관된 코지 톤.
     낮은 등급 = 일상적, 높은 등급 = 환상적.
   ============================================ */

import { GEAR_SLOTS } from './gear-slots.js';
import { GEAR_GRADE_ORDER } from './gear-grades.js';

/** 등급별 형용사 (장비 이름 prefix) — Day 9 갱신.
 *  Day 16 후속: 도감 셀에서도 재사용하기 위해 export. */
export const GRADE_PREFIX = Object.freeze({
  common:    '낡은',
  uncommon:  '고급진',
  rare:      '희귀한',
  epic:      '영웅의',
  legendary: '전설의',
  mythic:    '신화의',
});

/**
 * 등급별 짧은 설명 — 부위명 동적 치환 (Day 9 B안).
 * 함수 호출 시 부위 한글명(낚싯대/찌/옷/배)을 받아 자연스러운 문장 생성.
 */
const GRADE_DESC = Object.freeze({
  common:    (slotName) => `평범한 ${slotName}. 잔잔한 시작.`,
  uncommon:  (slotName) => `정성스레 다듬어진 ${slotName}.`,
  rare:      (slotName) => `은은한 빛이 깃든 ${slotName}.`,
  epic:      (slotName) => `용맹한 손길이 닿은 ${slotName}.`,
  legendary: (slotName) => `전설로 전해지는 빛나는 ${slotName}.`,
  mythic:    (slotName) => `별빛과 달빛이 담긴 영롱한 ${slotName}.`,
});

/**
 * @typedef {object} CatalogEntry
 * @property {string} catalogId   고유 식별자 (예: 'rod_common')
 * @property {string} slotId      부위 (rod/float/clothes/boat)
 * @property {string} slotName    부위 한글명 (낚싯대/찌/옷/돛단배)
 * @property {string} grade       등급 키
 * @property {string} name        표시 이름 (예: '낡은 낚싯대')
 * @property {string} description 짧은 설명
 */

/** 카탈로그 빌더 — 4부위 × 6등급 자동 생성 */
function buildCatalog() {
  /** @type {Record<string, CatalogEntry>} */
  const catalog = {};
  for (const slot of GEAR_SLOTS) {
    for (const grade of GEAR_GRADE_ORDER) {
      const catalogId = `${slot.id}_${grade}`;
      catalog[catalogId] = Object.freeze({
        catalogId,
        slotId:      slot.id,
        slotName:    slot.name,
        grade,
        name:        `${GRADE_PREFIX[grade]} ${slot.name}`,
        description: GRADE_DESC[grade](slot.name),
      });
    }
  }
  return Object.freeze(catalog);
}

/** 전체 카탈로그 (24종) — 키: catalogId, 값: CatalogEntry */
export const EQUIPMENT_CATALOG = buildCatalog();

/** catalogId 로 카탈로그 조회 (없으면 null) */
export function getCatalogEntry(catalogId) {
  return EQUIPMENT_CATALOG[catalogId] || null;
}

/** 부위로 필터 (예: 모든 낚싯대) */
export function getCatalogBySlot(slotId) {
  return Object.values(EQUIPMENT_CATALOG).filter(c => c.slotId === slotId);
}

/** 등급으로 필터 (예: 모든 신화 등급) */
export function getCatalogByGrade(grade) {
  return Object.values(EQUIPMENT_CATALOG).filter(c => c.grade === grade);
}