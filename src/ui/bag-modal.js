/* ===========================================
   bag-modal.js — 가방 모달 (Bag-2)
   ============================================
   메뉴(햄버거) → 가방 클릭 시 띄우는 모달.

   구조:
     bag-root (= overlay + panel 묶음)
       ├── bag-overlay (어두운 dim, 클릭 시 닫힘)
       └── bag-panel
             ├── bag-header (제목 + 카운트 + 닫기)
             ├── bag-sort   (등급별 / 부위별 토글)
             └── bag-grid   (70칸, 7×10, 스크롤)
                   ├── bag-cell--equipment  (장비 — 등급별)
                   ├── bag-cell--stone      (강화석)
                   └── bag-cell--empty      (빈 칸)

   원칙:
     - 데이터 / UI 분리 — inventory.js 가 모든 자료구조 담당
     - 변경마다 saveInventory(inv) 호출 (영구화)
     - Bag-3 에서 셀 클릭 시 컨텍스트 메뉴(장착/강화/합성/도감) 추가 예정
   ============================================ */

import {
  loadInventory,
  saveInventory,
  loadBagNewItemIds,    // Day 16 후속: 새 장비 빨간점
  clearBagNewItemIds,   // Day 16 후속: 가방 진입 후 셀 터치/close 시 모두 clear
} from '../core/storage.js';
import {
  makeDefaultInventory,
  getSortedItems,
  getFreeSlots,
  getEquippedBySlot,    // Day 19 — ↑ 화살표 판정 (같은 부위 장착 장비 비교)
} from '../data/inventory.js';
import { getCatalogEntry } from '../data/equipment-catalog.js';
import { getEnhanceBonus } from '../data/equipment-meta.js';   // Day 19 — 옵션 총합(베이스+강화)
import { createGearIcon } from './gear-icons.js';
import {
  openEquipmentContextMenu,
  closeEquipmentContextMenu,
} from './equipment-context-menu.js';
import {
  openEnhancestoneContextMenu,
  closeEnhancestoneContextMenu,
} from './enhancestone-context-menu.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ============================================
   SVG 헬퍼 (이모지 X 정책)
   ============================================ */

/** X (닫기) 아이콘 */
function makeCloseIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.4');
  svg.setAttribute('stroke-linecap', 'round');
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', 'M6 6 L18 18 M18 6 L6 18');
  svg.appendChild(p);
  return svg;
}

/** 자물쇠 아이콘 (잠금 표시용 — 우하단 작은 마크) */
function makeLockIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  // 자물쇠 본체
  const body = document.createElementNS(SVG_NS, 'rect');
  body.setAttribute('x', '5'); body.setAttribute('y', '11');
  body.setAttribute('width', '14'); body.setAttribute('height', '10');
  body.setAttribute('rx', '1.5');
  svg.appendChild(body);
  // 고리
  const arc = document.createElementNS(SVG_NS, 'path');
  arc.setAttribute('d', 'M8 11 V7 Q8 3 12 3 Q16 3 16 7 V11');
  svg.appendChild(arc);
  return svg;
}

/** 강화석 보석 아이콘 (청은빛 다이아몬드 형태) */
function makeStoneIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.4');
  svg.setAttribute('stroke-linejoin', 'round');
  // 외곽 다이아몬드 (육각형 보석)
  const outer = document.createElementNS(SVG_NS, 'path');
  outer.setAttribute('d', 'M12 3 L19 9 L15 20 L9 20 L5 9 Z');
  svg.appendChild(outer);
  // 안쪽 면 (반사광)
  const inner = document.createElementNS(SVG_NS, 'path');
  inner.setAttribute('d', 'M5 9 L19 9 M9 20 L12 9 M15 20 L12 9');
  inner.setAttribute('stroke-width', '1');
  inner.setAttribute('opacity', '0.55');
  svg.appendChild(inner);
  return svg;
}

/** Day 19 — 위 방향 화살표 (장착 장비보다 좋은 옵션 보유 후보 표시).
 *  굵은 chevron-up 모양 — 작은 사이즈에서도 시인성 좋음. */
function makeUpArrowIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M12 4 L4 14 L8.5 14 L8.5 20 L15.5 20 L15.5 14 L20 14 Z');
  svg.appendChild(path);
  return svg;
}

/* ============================================
   Day 19 — ↑ 화살표 판정 헬퍼 (대표 결정 — 항목 7)
   ============================================
   "장착 장비보다 한 가지라도 더 좋은 옵션이 있는 후보" 를 가방 셀 우상단에
   연두 ↑ 화살표로 표시. 유저가 가방에서 더 좋은 장비를 한눈에 찾을 수 있도록.

   판정 규칙:
   - 빈 슬롯 (해당 부위 미장착) → 모든 후보 true
   - 자기 자신 (장착 중인 장비)  → false (화살표 X)
   - 동일 옵션 키 직접 비교: 후보 value > 장착 value 면 더 좋음
     · sign='+' / sign='-' 옵션 모두 동일 — 저장값은 양수이고 값 큰 게 좋음
       (sign='-' 옵션의 -3 vs -6 = 저장값 3 vs 6 → 6이 더 좋음 — 대표 의도)
   - 후보에만 있는 옵션 → equippedVal=0 이라 자동으로 "신규 보유" 처리
     (itemVal > 0 이면 itemVal > equippedVal 조건이 잡음)
   ============================================ */

function buildOptionTotalsBag(item) {
  const e = getCatalogEntry(item.catalogId);
  if (!e) return {};
  const level = item.level || 0;
  const totals = {};
  if (Array.isArray(item.options)) {
    for (const o of item.options) {
      if (!o || !o.key) continue;
      const eb = getEnhanceBonus(o.key, e.slotId, e.grade, level);
      totals[o.key] = (o.value || 0) + eb;
    }
  }
  return totals;
}

function isBetterCandidate(item, inv) {
  if (!item || item.type === 'enhancestone') return false;
  const entry = getCatalogEntry(item.catalogId);
  if (!entry) return false;

  const equipped = getEquippedBySlot(inv, entry.slotId);
  if (!equipped) return true;                 // 빈 슬롯 → 모든 후보 ↑
  if (equipped.id === item.id) return false;  // 자기 자신 비교 X

  const itemTotals = buildOptionTotalsBag(item);
  const equippedTotals = buildOptionTotalsBag(equipped);

  const keys = new Set([...Object.keys(itemTotals), ...Object.keys(equippedTotals)]);
  for (const key of keys) {
    const itemVal = itemTotals[key] || 0;
    const equippedVal = equippedTotals[key] || 0;
    // 한 가지라도 후보 value > 장착 value 면 더 좋음 (부호 무관, 저장값 자체 비교)
    if (itemVal > equippedVal + 0.0005) return true;
  }
  return false;
}


/* ============================================
   메인 팩토리
   ============================================ */

/**
 * @param {object} [opts]
 * @param {() => void} [opts.onClose]  닫힐 때 콜백 (외부 동기화용)
 */
export function createBagModal(opts = {}) {
  const { onClose } = opts;

  /* ── 상태: 인벤토리 로드 (없으면 더미 생성 + 저장) ── */
  let inv = loadInventory();
  if (!inv) {
    inv = makeDefaultInventory();
    saveInventory(inv);
  }

  /* ── 루트 ── */
  const root = document.createElement('div');
  root.className = 'bag-root';
  root.setAttribute('aria-hidden', 'true');

  /* ── 오버레이 (dim, 클릭 시 닫힘) ── */
  const overlay = document.createElement('div');
  overlay.className = 'bag-overlay';

  /* ── 패널 ── */
  const panel = document.createElement('div');
  panel.className = 'bag-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '인벤토리');
  // 패널 클릭이 오버레이로 전파돼서 닫히는 거 방지
  panel.addEventListener('click', e => e.stopPropagation());

  /* ── 헤더 ── */
  const header = document.createElement('header');
  header.className = 'bag-header';

  const title = document.createElement('h2');
  title.className = 'bag-title';
  title.textContent = '인벤토리';

  const countEl = document.createElement('div');
  countEl.className = 'bag-count';
  // 숫자 부분은 Bebas Neue 톤 (CSS에서 처리)

  const closeBtn = document.createElement('button');
  closeBtn.className = 'bag-close';
  closeBtn.setAttribute('aria-label', '가방 닫기');
  closeBtn.appendChild(makeCloseIcon());
  closeBtn.addEventListener('click', close);

  header.appendChild(title);
  header.appendChild(countEl);
  header.appendChild(closeBtn);

  /* ── 정렬 버튼 (단일) ── */
  const sortBar = document.createElement('div');
  sortBar.className = 'bag-sort';

  const sortBtn = document.createElement('button');
  sortBtn.className = 'bag-sort__btn';
  sortBtn.setAttribute('aria-label', '부위별 + 등급별로 정렬');

  // SVG 정렬 아이콘 (위 화살표 짧고 아래 화살표 길게 — 정렬 메타포)
  const sortIcon = document.createElementNS(SVG_NS, 'svg');
  sortIcon.setAttribute('viewBox', '0 0 24 24');
  sortIcon.setAttribute('fill', 'none');
  sortIcon.setAttribute('stroke', 'currentColor');
  sortIcon.setAttribute('stroke-width', '1.4');
  sortIcon.setAttribute('stroke-linecap', 'round');
  sortIcon.setAttribute('stroke-linejoin', 'round');
  // 짧은 라인 (위)
  const l1 = document.createElementNS(SVG_NS, 'path');
  l1.setAttribute('d', 'M5 7 L13 7');
  sortIcon.appendChild(l1);
  // 중간 라인
  const l2 = document.createElementNS(SVG_NS, 'path');
  l2.setAttribute('d', 'M5 12 L17 12');
  sortIcon.appendChild(l2);
  // 긴 라인 (아래)
  const l3 = document.createElementNS(SVG_NS, 'path');
  l3.setAttribute('d', 'M5 17 L19 17');
  sortIcon.appendChild(l3);

  const sortLabel = document.createElement('span');
  sortLabel.className = 'bag-sort__label';
  sortLabel.textContent = '정렬';

  sortBtn.appendChild(sortIcon);
  sortBtn.appendChild(sortLabel);

  // 클릭 시 재정렬 (시각 피드백 — pulse 클래스 잠시 부착)
  sortBtn.addEventListener('click', () => {
    renderGrid();
    sortBtn.classList.remove('bag-sort__btn--pulse');
    // reflow 강제 후 다시 부착 (애니메이션 재시작)
    void sortBtn.offsetWidth;
    sortBtn.classList.add('bag-sort__btn--pulse');
  });

  sortBar.appendChild(sortBtn);

  /* ── 그리드 (70칸) ── */
  const grid = document.createElement('div');
  grid.className = 'bag-grid';

  // 셀 클릭 — 이벤트 위임 (장비 → 장비 컨텍스트 메뉴 / 강화석 → 강화석 컨텍스트 메뉴)
  grid.addEventListener('click', e => {
    // 장비 셀
    const eqCell = e.target.closest('.bag-cell--equipment');
    if (eqCell) {
      const id = eqCell.dataset.id;
      if (id) openContextMenuFromBag(id);
      return;
    }
    // 강화석 셀
    const stoneCell = e.target.closest('.bag-cell--stone');
    if (stoneCell) {
      openEnhancestoneContextMenu({ parent: root });
      return;
    }
  });

  /* ── 조립 ── */
  panel.appendChild(header);
  panel.appendChild(sortBar);
  panel.appendChild(grid);
  root.appendChild(overlay);
  root.appendChild(panel);

  // 오버레이 클릭으로 닫기
  overlay.addEventListener('click', close);

  /* ============================================
     렌더링
     ============================================ */

  function renderHeader() {
    const used = inv.items.length;
    countEl.innerHTML = `<span class="bag-count__num">${used}</span><span class="bag-count__sep">/</span><span class="bag-count__num">${inv.capacity}</span>`;
  }

  function renderGrid() {
    grid.replaceChildren();
    const sorted = getSortedItems(inv);
    // Day 16 후속: 새 장비 ID 큐 캡처 (이번 렌더 동안만 사용 — 셀 빌드 후 빨간점 표시용)
    const newItemIds = new Set(loadBagNewItemIds());
    for (let i = 0; i < inv.capacity; i++) {
      const cell = document.createElement('div');
      cell.className = 'bag-cell';
      const item = sorted[i];
      if (!item) {
        cell.classList.add('bag-cell--empty');
      } else if (item.type === 'enhancestone') {
        renderStoneCell(cell, item);
      } else {
        renderEquipmentCell(cell, item);
        // Day 16 후속: 새 장비라면 빨간점 부착 (잠금 자리 = 우하단)
        if (newItemIds.has(item.id)) {
          const dot = document.createElement('span');
          dot.className = 'bag-cell__new-dot';
          cell.appendChild(dot);
        }
      }
      grid.appendChild(cell);
    }
  }

  function renderEquipmentCell(cell, item) {
    const entry = getCatalogEntry(item.catalogId);
    if (!entry) {
      cell.classList.add('bag-cell--empty');
      return;
    }
    cell.classList.add('bag-cell--equipment', `bag-cell--${entry.grade}`);
    if (item.equipped) cell.classList.add('bag-cell--equipped');
    if (item.locked)   cell.classList.add('bag-cell--locked');
    // Day 10 (C-2) — 꾸미기 효과 글로우 (cosmeticColor 보유 시 등급 색 글로우)
    if (item.cosmeticColor) cell.classList.add('bag-cell--has-cosmetic');
    cell.dataset.id = item.id;
    cell.setAttribute('aria-label', entry.name);

    // 부위 아이콘
    // Day 14 ★ — 카툰 PNG 적용 (entry.grade 인자 추가)
    const icon = createGearIcon(entry.slotId, entry.grade);
    icon.classList.add('bag-cell__icon');
    cell.appendChild(icon);

    // 강화 단계 (+N) — level > 0
    if (item.level > 0) {
      const lv = document.createElement('span');
      lv.className = 'bag-cell__level';
      lv.textContent = `+${item.level}`;
      cell.appendChild(lv);
    }

    // 장착 'E' 마크 (우상단)
    if (item.equipped) {
      const eBadge = document.createElement('span');
      eBadge.className = 'bag-cell__equipped';
      eBadge.textContent = 'E';
      cell.appendChild(eBadge);
    } else if (isBetterCandidate(item, inv)) {
      // Day 19 — 장착 장비보다 한 가지라도 더 좋은 옵션 보유 → 우상단 연두 ↑
      //   유저가 가방에서 더 좋은 장비를 한눈에 찾을 수 있도록 (대표 결정).
      //   E 배지와 같은 우상단 자리 — 장착 장비는 비교 X 라 충돌 X.
      const upBadge = document.createElement('span');
      upBadge.className = 'bag-cell__upgrade';
      upBadge.setAttribute('aria-label', '장착 장비보다 좋은 옵션 보유');
      upBadge.appendChild(makeUpArrowIcon());
      cell.appendChild(upBadge);
    }

    // Bag-5: 잠금 자물쇠 — 우하단, 잠금 상태일 때만 표시.
    // 잠금/해제 토글은 컨텍스트 메뉴 헤더의 자물쇠 버튼에서 수행 (가방 셀에선 클릭 안 받음).
    if (item.locked) {
      const lockEl = document.createElement('span');
      lockEl.className = 'bag-cell__lock';
      lockEl.appendChild(makeLockIcon());
      cell.appendChild(lockEl);
    }

    // Day 13 — 합성 추가 옵션 보유 시 좌하단 분홍별 (대표 결정 — 메인 가방에도 표시 통일).
    // 합성 화면의 가방 셀 (compose-bag-cell) 과 동일 표시 패턴.
    if (Array.isArray(item.extraOptions) && item.extraOptions.length > 0) {
      const star = document.createElement('span');
      star.className = 'bag-cell__compose-mark';
      star.textContent = '★';
      cell.appendChild(star);
    }
  }

  function renderStoneCell(cell, item) {
    cell.classList.add('bag-cell--stone');
    cell.setAttribute('aria-label', `꿈조각 ${item.count}개`);

    const iconWrap = document.createElement('span');
    iconWrap.className = 'bag-cell__icon';
    iconWrap.appendChild(makeStoneIcon());
    cell.appendChild(iconWrap);

    const stack = document.createElement('span');
    stack.className = 'bag-cell__stack';
    stack.textContent = `×${item.count}`;
    cell.appendChild(stack);
  }

  function renderAll() {
    renderHeader();
    renderGrid();
  }

  /* ============================================
     컨텍스트 메뉴 (셀 클릭 시) — 신규 모듈 사용
     ============================================
     슬롯 화면의 gear-slot 도 같은 모듈을 사용하므로 두 화면이
     동일한 디자인/동작을 갖게 됨 (bag.css 의 .bag-context__* 스타일 공유).
     ============================================ */

  /** 가방 안에서 셀 클릭 시 컨텍스트 메뉴를 panel 안에 띄움 */
  function openContextMenuFromBag(itemId) {
    // Day 16 후속 (대표 결정): 셀 터치 시 모든 새 장비 빨간점 clear (해당 장비 + 그 외 모두).
    //   clear 후 즉시 리렌더 → 빨간점 사라짐.
    const hadNewItems = loadBagNewItemIds().length > 0;
    if (hadNewItems) {
      clearBagNewItemIds();
      renderAll();
    }
    openEquipmentContextMenu(itemId, {
      parent: panel,                  // 가방 panel 안에 띄움
      onChange: () => {
        // 컨텍스트 메뉴가 LocalStorage 를 변경했으므로 inv 를 다시 로드해야
        // renderGrid 가 최신 상태(equipped 등)를 그림.
        const fresh = loadInventory();
        if (fresh) inv = fresh;
        renderAll();
      },
      onNavigate: () => {
        // 강화/합성/도감 navigate 직전 — 가방 모달 정리
        // root 는 #app 자식이므로 navigate 의 fadeSwap 시 자동 제거됨
        isOpen = false;
        onClose?.();
      },
    });
  }


  let isOpen = false;
  function open() {
    // navigate 등으로 root 가 강제 제거됐으면 isOpen 동기화 (재오픈 가능하도록)
    if (isOpen && !root.parentNode) {
      isOpen = false;
    }
    if (isOpen) return;
    // 매번 LocalStorage 다시 읽음 (다른 곳에서 변경됐을 수 있음)
    const fresh = loadInventory();
    if (fresh) inv = fresh;
    // #app 자식으로 추가 — navigate 시 fadeSwap 이 #app 통째로 페이드아웃하면서
    // 가방 모달도 함께 자연스럽게 사라짐 (슬롯 잠깐 보이는 깜빡임 제거).
    const app = document.getElementById('app') || document.body;
    app.appendChild(root);
    renderAll();
    // rAF: append 후 다음 프레임에 클래스 추가 (트랜지션 발동)
    requestAnimationFrame(() => {
      root.classList.add('bag-root--open');
      root.setAttribute('aria-hidden', 'false');
    });
    isOpen = true;
  }

  function close() {
    if (!isOpen) return;
    closeEquipmentContextMenu();      // 열려있는 장비 컨텍스트 메뉴 정리
    closeEnhancestoneContextMenu();   // 열려있는 강화석 컨텍스트 메뉴 정리
    // Day 16 후속 (대표 결정): 가방 닫을 때 새 장비 빨간점 모두 clear
    //   slot.js 의 onClose 콜백이 refreshCodexDots 호출 → 햄버거/메뉴 빨간점도 자동 OFF
    clearBagNewItemIds();
    root.classList.remove('bag-root--open');
    root.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      if (root.parentNode) root.parentNode.removeChild(root);
    }, 350); // CSS 트랜지션과 일치
    isOpen = false;
    onClose?.();
  }

  function dispose() {
    if (root.parentNode) root.parentNode.removeChild(root);
    isOpen = false;
  }

  return { open, close, dispose, isOpen: () => isOpen };
}