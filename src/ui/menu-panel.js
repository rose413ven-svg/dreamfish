/* ===========================================
   menu-panel.js — 메뉴 패널 (사이드 슬라이드)
   ============================================
   docs/01_슬롯화면_디자인.md [상단 헤더 / 메뉴 동작] 기반.
   펼침 방향(사이드 슬라이드)은 임시 디폴트 — 추후 변경 가능.
   - 어두운 오버레이 (클릭 시 닫힘)
   - 우측에서 슬라이드 인 패널
   - 6개 메뉴 항목 버튼 (data/menu-items.js)
   - X 닫기 버튼
   ============================================ */

import { MENU_ITEMS } from '../data/menu-items.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** X 아이콘 SVG */
function makeCloseIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.4');
  svg.setAttribute('stroke-linecap', 'round');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M6 6 L18 18 M18 6 L6 18');
  svg.appendChild(path);
  return svg;
}

/**
 * @param {object} [opts]
 * @param {(itemId: string) => void} [opts.onItemClick]   메뉴 항목 클릭
 * @param {() => void}              [opts.onClose]       패널 닫힘 시 (외부 동기화용)
 * @returns {{
 *   root: HTMLElement,
 *   open: () => void,
 *   close: () => void,
 *   toggle: () => void,
 *   isOpen: () => boolean,
 *   setItemDot: (itemId: string, on: boolean) => void,
 *   dispose: () => void,
 * }}
 */
export function createMenuPanel(opts = {}) {
  const { onItemClick, onClose } = opts;

  /* ── 루트 (오버레이 + 패널을 함께 묶음) ── */
  const root = document.createElement('div');
  root.className = 'menu-root';

  /* ── 어두운 오버레이 ── */
  const overlay = document.createElement('div');
  overlay.className = 'menu-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  /* ── 패널 본체 ── */
  const panel = document.createElement('aside');
  panel.className = 'menu-panel';
  panel.setAttribute('role', 'menu');
  panel.setAttribute('aria-hidden', 'true');

  // 닫기 버튼 (X)
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'menu-panel__close';
  closeBtn.setAttribute('aria-label', '닫기');
  closeBtn.appendChild(makeCloseIcon());

  // 라벨
  const label = document.createElement('div');
  label.className = 'menu-panel__label';
  label.textContent = 'MENU';

  // 항목 리스트
  const list = document.createElement('ul');
  list.className = 'menu-panel__list';
  /** id → 버튼 엘리먼트 매핑 (빨간점 동적 갱신용) */
  const itemBtnMap = {};
  MENU_ITEMS.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'menu-panel__list-item';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-panel__item';
    btn.dataset.id = item.id;
    btn.textContent = item.name;
    itemBtnMap[item.id] = btn;
    li.appendChild(btn);
    list.appendChild(li);
  });

  panel.appendChild(closeBtn);
  panel.appendChild(label);
  panel.appendChild(list);

  root.appendChild(overlay);
  root.appendChild(panel);

  /* ── 상태 + 동작 ── */
  let opened = false;

  function open() {
    if (opened) return;
    opened = true;
    overlay.classList.add('menu-overlay--open');
    panel.classList.add('menu-panel--open');
    overlay.setAttribute('aria-hidden', 'false');
    panel.setAttribute('aria-hidden', 'false');
  }

  function close() {
    if (!opened) return;
    opened = false;
    overlay.classList.remove('menu-overlay--open');
    panel.classList.remove('menu-panel--open');
    overlay.setAttribute('aria-hidden', 'true');
    panel.setAttribute('aria-hidden', 'true');
    onClose?.();
  }

  function toggle() {
    opened ? close() : open();
  }

  /* ── 이벤트 ── */
  const ac = new AbortController();

  overlay.addEventListener('click', close, { signal: ac.signal });
  closeBtn.addEventListener('click', close, { signal: ac.signal });

  list.addEventListener(
    'click',
    (e) => {
      const itemBtn = e.target instanceof Element
        ? e.target.closest('.menu-panel__item')
        : null;
      if (!itemBtn) return;
      const id = itemBtn.dataset.id;
      if (!id) return;
      onItemClick?.(id);
    },
    { signal: ac.signal },
  );

  // ESC 키로 닫기
  function onKey(e) {
    if (opened && e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKey, { signal: ac.signal });

  /**
   * 메뉴 항목 우측에 빨간점 표시/제거.
   * Day 16 — 도감 신규 등록 알림용.
   * @param {string} itemId   MENU_ITEMS 의 id (예: 'codex')
   * @param {boolean} on
   */
  function setItemDot(itemId, on) {
    const btn = itemBtnMap[itemId];
    if (!btn) return;
    const existing = btn.querySelector('.codex-dot');
    if (on) {
      if (!existing) {
        const dot = document.createElement('span');
        dot.className = 'codex-dot';
        btn.appendChild(dot);
      }
    } else {
      if (existing) existing.remove();
    }
  }

  return {
    root,
    open,
    close,
    toggle,
    isOpen: () => opened,
    setItemDot,
    dispose: () => ac.abort(),
  };
}