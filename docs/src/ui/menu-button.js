/* ===========================================
   menu-button.js — 햄버거 메뉴 버튼 (정적)
   ============================================
   docs/01_슬롯화면_디자인.md [상단 헤더] SSOT.
   - 박스 없음, 라인 3줄만
   - 라인 22px × 1.4px, color #c8d4f0, gap 5px
   - 터치 영역 약 44×44px (라인 주위 패딩으로 확보)
   - 클릭 동작은 Phase 2-2 에서 패널 펼침 연결

   Day 16 — setDot API 추가 (도감 신규 등록 알림용 빨간점)
   ============================================ */

/**
 * @param {object} [opts]
 * @param {() => void} [opts.onClick]
 * @returns {{ root: HTMLButtonElement, setDot: (on: boolean) => void, dispose: () => void }}
 */
export function createMenuButton(opts = {}) {
  const { onClick } = opts;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'menu-button';
  btn.setAttribute('aria-label', '메뉴');

  for (let i = 0; i < 3; i++) {
    const line = document.createElement('span');
    line.className = 'menu-button__line';
    btn.appendChild(line);
  }

  /**
   * 햄버거 버튼 우상단 빨간점 표시/제거 (Day 16).
   * 표시 조건은 호출 측에서 결정 (codex 신규 알림 등).
   */
  function setDot(on) {
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

  const ac = new AbortController();
  if (typeof onClick === 'function') {
    btn.addEventListener('click', onClick, { signal: ac.signal });
  }

  return {
    root: btn,
    setDot,
    dispose: () => ac.abort(),
  };
}