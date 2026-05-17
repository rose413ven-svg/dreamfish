/* ===========================================
   twinkle-reward-popup.js — 트윙클타임 보상 팝업 (Day 20 신규)
   ============================================
   대표 명시: "트윙클타임끝나면 level up 팝업과 똑같은 팝업을 통해 획득꿈조각 알림"
   → level-up-popup.js 구조 그대로 따르되 내용 단순화:
       헤더(TWINKLE!) + 큰 꿈조각 아이콘 + "+N 개" + 확인 버튼

   톤:
   - 밝은 흰색 + 연한 푸른빛 글로우 (트윙클 정체성)
   - 별빛 입자 (level-up 황금 → 흰색)

   사용:
     const popup = createTwinkleRewardPopup({ onClose });
     content.appendChild(popup.root);
     popup.show({ rewardCount: 5 });
   ============================================ */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @param {object} [opts]
 * @param {() => void} [opts.onClose] - 닫힐 때 매번 호출
 * @returns {{
 *   root: HTMLElement,
 *   show: (info: {rewardCount:number, onClose?: () => void}) => void,
 *   close: () => void,
 *   isOpen: () => boolean,
 *   dispose: () => void,
 * }}
 */
export function createTwinkleRewardPopup(opts = {}) {
  const { onClose: globalOnClose } = opts;
  let isOpenState = false;
  let pendingOnce = null;

  /* ── 루트 + 오버레이 + 패널 ── */
  const root = document.createElement('div');
  root.className = 'twinkle-reward-root';
  root.setAttribute('aria-hidden', 'true');

  const overlay = document.createElement('div');
  overlay.className = 'twinkle-reward-overlay';

  const panel = document.createElement('div');
  panel.className = 'twinkle-reward-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '꿈조각 획득');
  panel.addEventListener('click', (e) => e.stopPropagation());

  /* ── 헤더: 별빛 입자 + "TWINKLE!" ── */
  const header = document.createElement('div');
  header.className = 'twinkle-reward-header';

  const stars = document.createElementNS(SVG_NS, 'svg');
  stars.setAttribute('class', 'twinkle-reward-stars');
  stars.setAttribute('viewBox', '0 0 200 60');
  stars.setAttribute('aria-hidden', 'true');
  const starPositions = [
    [20, 12], [55, 38], [88, 8], [124, 42], [155, 14], [185, 36],
  ];
  starPositions.forEach(([cx, cy], i) => {
    const s = document.createElementNS(SVG_NS, 'circle');
    s.setAttribute('cx', cx);
    s.setAttribute('cy', cy);
    s.setAttribute('r', '1.4');
    s.setAttribute('class', `twinkle-reward-star twinkle-reward-star--${i}`);
    stars.appendChild(s);
  });

  const headerText = document.createElement('div');
  headerText.className = 'twinkle-reward-header__text';
  headerText.textContent = 'TWINKLE!';

  header.appendChild(stars);
  header.appendChild(headerText);

  /* ── 큰 꿈조각 아이콘 ── */
  const iconWrap = document.createElement('div');
  iconWrap.className = 'twinkle-reward-icon';
  iconWrap.innerHTML = `
    <svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M8 20 Q18 8 35 12 Q48 16 50 20 Q48 24 35 28 Q18 32 8 20 Z M50 20 L58 13 L58 27 Z"
            fill="#F0F8FF" stroke="#FFFFFF" stroke-width="0.4" stroke-opacity="0.8"/>
    </svg>
  `;

  /* ── 보상 메시지: "꿈조각 +N 개" ── */
  const message = document.createElement('div');
  message.className = 'twinkle-reward-message';

  const labelEl = document.createElement('span');
  labelEl.className = 'twinkle-reward-message__label';
  labelEl.textContent = '꿈조각';

  const valueEl = document.createElement('span');
  valueEl.className = 'twinkle-reward-message__value';
  // 갱신은 show() 에서

  const unitEl = document.createElement('span');
  unitEl.className = 'twinkle-reward-message__unit';
  unitEl.textContent = '개 획득';  // ★ Day 26 (대표 결정): "개" → "개 획득"

  message.appendChild(labelEl);
  message.appendChild(valueEl);
  message.appendChild(unitEl);

  /* ── 확인 버튼 ── */
  const okBtn = document.createElement('button');
  okBtn.className = 'twinkle-reward-ok';
  okBtn.type = 'button';
  okBtn.textContent = '확인';
  okBtn.addEventListener('click', close);

  /* ── 조립 ── */
  panel.appendChild(header);
  panel.appendChild(iconWrap);
  panel.appendChild(message);
  panel.appendChild(okBtn);

  root.appendChild(overlay);
  root.appendChild(panel);

  /**
   * 팝업 표시.
   * @param {object} info
   * @param {number} info.rewardCount       획득 꿈조각 개수 (1+)
   * @param {() => void} [info.onClose]     이번 호출 1회용 콜백
   */
  function show(info = {}) {
    const rewardCount = Math.max(0, Number(info.rewardCount) || 0);
    pendingOnce = (typeof info.onClose === 'function') ? info.onClose : null;

    valueEl.textContent = `${rewardCount}`;  // ★ Day 26 (대표 결정): "+N" → "N" (+ 부호 제거)

    isOpenState = true;
    root.setAttribute('aria-hidden', 'false');
    root.classList.add('twinkle-reward-root--open');
  }

  function close() {
    if (!isOpenState) return;
    isOpenState = false;
    root.setAttribute('aria-hidden', 'true');
    root.classList.remove('twinkle-reward-root--open');

    const once = pendingOnce;
    pendingOnce = null;
    if (typeof once === 'function') {
      try { once(); } catch (_) { /* swallow */ }
    }
    if (typeof globalOnClose === 'function') {
      try { globalOnClose(); } catch (_) { /* swallow */ }
    }
  }

  function dispose() {
    okBtn.removeEventListener('click', close);
  }

  return {
    root,
    show,
    close,
    isOpen: () => isOpenState,
    dispose,
  };
}