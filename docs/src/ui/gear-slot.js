/* ===========================================
   gear-slot.js — 장비 칸 1개 (등급별 처리)
   ============================================
   docs/01_슬롯화면_디자인.md [장비 4칸] SSOT.
   - 56×56px 사각형 (radius 0)
   - 미장착: 점선 테두리 + 부위 아이콘
   - 장착: 등급별 색/글로우/네온/펄스 (Phase 2-4)

   Day 10 (C-2): cosmeticColor 보유 장비 시 가운데서 퍼지는 등급 색 글로우.
   slot.css 의 .gear-slot--has-cosmetic 클래스로 발동.
   ============================================ */

import { createGearIcon } from './gear-icons.js';
import { GEAR_GRADES } from '../data/gear-grades.js';

/**
 * @param {object} opts
 * @param {import('../data/gear-slots.js').GearSlotDef} opts.slot
 * @param {{ grade: keyof typeof GEAR_GRADES, cosmeticColor?: string|null, level?: number, name?: string } | null} [opts.equipped=null]
 * @returns {{
 *   root: HTMLElement,
 *   setEquipped: (next: { grade: keyof typeof GEAR_GRADES, cosmeticColor?: string|null, level?: number } | null) => void,
 * }}
 */
export function createGearSlot(opts) {
  const { slot, equipped = null } = opts;

  const root = document.createElement('div');
  root.className = 'gear-slot';
  root.dataset.position = slot.position;
  root.dataset.slotId = slot.id;
  root.setAttribute('aria-label', slot.name);

  function render(state) {
    root.replaceChildren();
    root.classList.remove(
      'gear-slot--empty',
      'gear-slot--common',
      'gear-slot--uncommon',
      'gear-slot--rare',
      'gear-slot--epic',
      'gear-slot--legendary',
      'gear-slot--mythic',
      // Day 10 — 꾸미기 글로우 잔존 방지
      'gear-slot--has-cosmetic',
    );
    // Day 14 ★ — 강화 레벨 시각 강화 잔존 방지 (--lv inline 변수 클리어).
    root.style.removeProperty('--lv');

    if (!state) {
      // 미장착
      root.classList.add('gear-slot--empty');
      const icon = createGearIcon(slot.icon);
      icon.classList.add('gear-slot__icon');
      root.appendChild(icon);
      return;
    }

    // 장착 (Phase 2-4 본격 구현 — 지금은 등급 클래스만 부착)
    const grade = GEAR_GRADES[state.grade];
    if (!grade) {
      console.warn('[gear-slot] unknown grade:', state.grade);
      return;
    }
    root.classList.add(`gear-slot--${state.grade}`);
    // Day 10 (C-2) — cosmeticColor 보유 시 가운데서 퍼지는 등급 색 글로우
    if (state.cosmeticColor) {
      root.classList.add('gear-slot--has-cosmetic');
    }
    // Day 14 ★ — 카툰 PNG 적용: createGearIcon 에 grade 인자 전달 → 등급별 PNG <img> 반환
    const icon = createGearIcon(slot.icon, state.grade);
    icon.classList.add('gear-slot__icon');
    root.appendChild(icon);

    // Day 11 — 강화 단계 +N 좌상단 (level > 0 일 때만)
    // Day 14 ★ — 강화 레벨 시각 강화 (--lv inline 변수 + slot.css calc 룰 발동).
    const level = state.level || 0;
    if (level > 0) {
      root.style.setProperty('--lv', String(level));
      const lv = document.createElement('span');
      lv.className = 'gear-slot__level';
      lv.textContent = `+${level}`;
      root.appendChild(lv);
    }
  }

  render(equipped);

  return {
    root,
    setEquipped: (next) => render(next),
  };
}