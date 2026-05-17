/* ===========================================
   menu-items.js — 메뉴 패널 항목 (Day 26 갱신)
   ============================================
   docs/01_슬롯화면_디자인.md [상단 헤더 / 메뉴 동작] SSOT.
   각 메뉴는 버튼만 — 안 컨텐츠는 추후 단계에서 화면별로 구현.

   Day 18 변경:
   - 'fishery-map' (낚시터 맵) 추가 — 내정보 아래
   - 햄버거 메뉴 6 → 7개

   ★ Day 26 변경 (대표 결정):
   - 'shop' (상점) 추가 — 가장 상단 (준비중 stub)
   - 메뉴 순서 재정렬: 상점 > 내정보 > 낚시터맵 > 인벤토리 > 도감 > 합성 > 랭킹 > 설정
   - 'bag' → 'inventory' 명칭 통일 (text '가방' → '인벤토리'); id 는 'bag' 유지 (라우터 키 호환)
   - 햄버거 메뉴 7 → 8개
   ============================================ */

/**
 * @typedef {object} MenuItem
 * @property {string} id    고유 식별자
 * @property {string} name  표시 이름
 */

/** @type {ReadonlyArray<MenuItem>} */
export const MENU_ITEMS = Object.freeze([
  { id: 'shop',         name: '상점'      },   // ★ Day 26 신규 (가장 상단 — 준비중 stub)
  { id: 'profile',      name: '내정보'    },
  { id: 'stage-map',    name: '낚시터 맵' },
  { id: 'bag',          name: '인벤토리'  },   // ★ Day 26 — '가방' → '인벤토리' 명칭 변경 (id는 호환 위해 'bag' 유지)
  { id: 'codex',        name: '도감'      },
  { id: 'compose',      name: '합성'      },
  { id: 'ranking',      name: '랭킹'      },
  { id: 'settings',     name: '설정'      },
]);