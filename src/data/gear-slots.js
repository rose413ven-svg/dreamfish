/* ===========================================
   gear-slots.js — 장비 4부위 정의
   ============================================
   docs/01_슬롯화면_디자인.md [장비 4칸 / 4부위 데이터 구조] SSOT.
   ============================================ */

/**
 * @typedef {object} GearSlotDef
 * @property {string} id        고유 식별자
 * @property {string} name      한글 이름
 * @property {'left-top'|'left-bottom'|'right-top'|'right-bottom'} position
 * @property {string} icon      아이콘 키 (ui/gear-icons.js 와 매칭)
 */

/** @type {ReadonlyArray<GearSlotDef>} */
export const GEAR_SLOTS = Object.freeze([
  { id: 'rod',     name: '낚싯대', position: 'left-top',     icon: 'rod'     },
  { id: 'float',   name: '찌',     position: 'left-bottom',  icon: 'float'   },
  { id: 'clothes', name: '옷',     position: 'right-top',    icon: 'clothes' },
  { id: 'boat',    name: '배',     position: 'right-bottom', icon: 'boat'    },
]);