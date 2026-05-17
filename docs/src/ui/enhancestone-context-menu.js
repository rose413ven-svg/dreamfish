/* ===========================================
   enhancestone-context-menu.js — 강화석 컨텍스트 메뉴
   ============================================
   가방 모달 안에서 강화석 셀 클릭 시 띄움.
   디자인은 equipment-context-menu 와 같은 .bag-context__* 베이스 재사용.

   강화석은 자원 아이템 (효과 X) — 보유 개수 + 짧은 설명만 표시.
   액션 버튼 없음 (강화는 강화 화면에서 별도로 수행).

   호출:
     openEnhancestoneContextMenu({
       parent: document.getElementById('app'),
     });
   ============================================ */

import { loadInventory } from '../core/storage.js';
import { countEnhanceStones } from '../data/inventory.js';

let currentRoot = null;
let currentTimer = null;

/** 닫기 (트랜지션 후 DOM 제거) */
export function closeEnhancestoneContextMenu() {
  if (!currentRoot) return;
  currentRoot.classList.remove('bag-context--open');
  const target = currentRoot;
  currentRoot = null;
  if (currentTimer) clearTimeout(currentTimer);
  currentTimer = setTimeout(() => {
    if (target.parentNode) target.parentNode.removeChild(target);
  }, 220);
}

/**
 * 강화석 컨텍스트 메뉴 열기.
 * 인벤토리에서 enhancestone 아이템 찾아 보유 개수 표시.
 *
 * @param {object} [opts]
 * @param {HTMLElement} [opts.parent] 부모 엘리먼트 (기본 #app)
 * @returns {{ close: () => void } | null}
 */
export function openEnhancestoneContextMenu(opts = {}) {
  const parent = opts.parent || document.getElementById('app') || document.body;

  // 인벤토리에서 강화석 보유 개수 계산 (Day 20: multi-stack 지원 — 모든 stack 합산)
  const inv = loadInventory();
  if (!inv) return null;
  const totalStones = countEnhanceStones(inv);
  if (totalStones <= 0) return null;

  // 이미 열려있으면 먼저 닫음
  closeEnhancestoneContextMenu();

  // root + overlay
  const root = document.createElement('div');
  root.className = 'bag-context';

  const ovl = document.createElement('div');
  ovl.className = 'bag-context__overlay';
  ovl.addEventListener('click', closeEnhancestoneContextMenu);

  // panel — 강화석 전용 클래스 추가 (bag.css 에서 청은빛 톤 적용)
  const cpanel = document.createElement('div');
  cpanel.className = 'bag-context__panel bag-context--stone';
  cpanel.addEventListener('click', e => e.stopPropagation());

  // 헤더
  const cheader = document.createElement('div');
  cheader.className = 'bag-context__header';
  const cname = document.createElement('div');
  cname.className = 'bag-context__name';
  cname.textContent = '강화석';
  // 우측에 보유 개수 (등급 위치 재활용)
  const ccount = document.createElement('div');
  ccount.className = 'bag-context__grade';
  ccount.textContent = `${totalStones}개 보유`;
  cheader.appendChild(cname);
  cheader.appendChild(ccount);

  // 본문 — 짧은 설명만 (큰 카운트는 헤더 우측에 이미 있음)
  const cbody = document.createElement('div');
  cbody.className = 'bag-context__stone-body';

  const cdesc = document.createElement('div');
  cdesc.className = 'bag-context__desc';
  cdesc.textContent = '장비를 강화할 때 사용되는 별의 조각.';

  cbody.appendChild(cdesc);

  cpanel.appendChild(cheader);
  cpanel.appendChild(cbody);
  root.appendChild(ovl);
  root.appendChild(cpanel);
  parent.appendChild(root);
  currentRoot = root;

  // rAF 로 트랜지션 발동
  requestAnimationFrame(() => {
    root.classList.add('bag-context--open');
  });

  return { close: closeEnhancestoneContextMenu };
}