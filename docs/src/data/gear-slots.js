/* ===========================================
   gear-slots.js — 장비 6부위 정의 (★ Day 29 — hook + pet 추가)
   ============================================
   docs/01_슬롯화면_디자인.md [장비 4칸 / 4부위 데이터 구조] SSOT.

   ★ Day 29 (대표 결정) — 장비 카테고리 2종 추가:
   - hook (낚시바늘)
   - pet  (펫)
   둘 다 lucky_rate (럭키럭키 발동) 옵션 부여 예정 — Phase 4 시스템 정합성.
   장비 옵션은 추후 리밸런싱 (대표 명시).

   position 필드:
   - 기존 4부위 = 슬롯 화면 좌우 코너 (left-top / left-bottom / right-top / right-bottom)
   - 신규 2부위 (hook/pet) = 슬롯 화면 UI 위치 추후 결정 (일단 'extra-1' / 'extra-2' placeholder)
   ============================================ */

/**
 * @typedef {object} GearSlotDef
 * @property {string} id        고유 식별자
 * @property {string} name      한글 이름
 * @property {string} position  슬롯 화면 위치 키 (UI 배치용)
 * @property {string} icon      아이콘 키 (ui/gear-icons.js 와 매칭)
 */

/** @type {ReadonlyArray<GearSlotDef>} */
export const GEAR_SLOTS = Object.freeze([
  // ★ Day 29 — 표시 순서: 낚시대 → 찌 → 바늘 → 옷 → 배 → 펫 (대표 결정)
  //   이 순서가 inventory.js / codex 정렬에도 자동 적용됨 (GEAR_SLOTS 인덱스 기반).
  { id: 'rod',     name: '낚싯대',   position: 'gear-bar',  icon: 'rod'     },
  { id: 'float',   name: '찌',       position: 'gear-bar',  icon: 'float'   },
  { id: 'hook',    name: '낚시바늘', position: 'gear-bar',  icon: 'hook'    },  // ★ Day 29
  { id: 'clothes', name: '옷',       position: 'gear-bar',  icon: 'clothes' },
  { id: 'boat',    name: '배',       position: 'gear-bar',  icon: 'boat'    },
  { id: 'pet',     name: '펫',       position: 'gear-bar',  icon: 'pet'     },  // ★ Day 29
]);