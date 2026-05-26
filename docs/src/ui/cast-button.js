/* ===========================================
   cast-button.js — 던지다 / 당기다 버튼
   ============================================
   docs/01_슬롯화면_디자인.md [던지다 / 당기다 버튼] SSOT.
   - 86×86 원형, 상태에 따라 텍스트 + 색 변경
   - 파동 링 2겹 (장식)
   - :active scale + ripple 은 CSS 자동 동작
   - state 토글 로직은 Phase 2-2 (지금은 'cast' 고정)
   ============================================ */

/** @typedef {'cast' | 'pull' | 'wait'} CastState */

const LABEL = Object.freeze({
  cast: 'CAST',
  pull: 'PULL',
  wait: 'WAITING',
});

/**
 * @param {object} [opts]
 * @param {CastState} [opts.state='cast']
 * @param {() => void} [opts.onClick]
 * @returns {{
 *   root: HTMLElement,
 *   dispose: () => void,
 *   setState: (s: CastState) => void,
 *   getState: () => CastState,
 * }}
 */
export function createCastButton(opts = {}) {
  const { state: initialState = 'cast', onClick } = opts;

  let state = initialState;

  const root = document.createElement('button');
  root.type = 'button';
  root.className = 'cast-btn';
  root.setAttribute('aria-label', LABEL[state]);

  // 파동 링 2겹 (장식)
  const ringOuter = document.createElement('span');
  ringOuter.className = 'cast-btn__ring cast-btn__ring--outer';
  ringOuter.setAttribute('aria-hidden', 'true');

  const ringInner = document.createElement('span');
  ringInner.className = 'cast-btn__ring cast-btn__ring--inner';
  ringInner.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.className = 'cast-btn__text';
  text.textContent = LABEL[state];

  root.appendChild(ringOuter);
  root.appendChild(ringInner);
  root.appendChild(text);
  root.dataset.state = state;

  function setState(next) {
    if (next !== 'cast' && next !== 'pull' && next !== 'wait') {
      console.warn('[cast-btn] unknown state:', next);
      return;
    }
    state = next;
    root.dataset.state = state;
    text.textContent = LABEL[state];
    root.setAttribute('aria-label', LABEL[state]);
  }

  /**
   * 자동 모드에서 버튼이 "스스로 눌리는" 시각 효과
   * (실제 클릭 이벤트는 발생 안 함 — 모션만)
   */
  function triggerPress() {
    root.classList.remove('cast-btn--auto-press');
    void root.offsetWidth; // 강제 리플로우 — 연속 호출 시 애니메이션 재시작
    root.classList.add('cast-btn--auto-press');
    setTimeout(() => {
      root.classList.remove('cast-btn--auto-press');
    }, 300);
  }

  /**
   * Day 4-3: 비활성 시각 표시 — 결과 처리 흐름 동안
   * 클릭이 무시되는 구간(isProcessing=true)에서 사용자 혼란 방지
   * @param {boolean} busy
   */
  function setBusy(busy) {
    root.classList.toggle('cast-btn--busy', !!busy);
  }

  const ac = new AbortController();
  if (typeof onClick === 'function') {
    // ★ Day 38 후속 (대표 결정) — 'click' → 'pointerdown' 변경.
    //   배경: 가장자리 터치 시 시각 반응(:active)은 동작하는데 click 이벤트는 발화 안 되는
    //         케이스 (손가락이 살짝 빗나갈 때 등) → 캐스트 처리 미동작 버그.
    //   변경: pointerdown 으로 즉시 처리 → 버튼이 시각 반응한 시점에 무조건 진행.
    //   부작용: click 보다 응답성 ↑ (100ms 가까운 차이) — 게임 반응성 좋아짐.
    //          jitter 우려는 :active CSS 가 이미 처리해주므로 사용자 인지에 영향 X.
    //   busy 체크: 콜백(handleCast) 내부 isProcessing 가드 그대로 동작 (이벤트 타입 무관).
    root.addEventListener('pointerdown', onClick, { signal: ac.signal });
  }

  return {
    root,
    dispose: () => ac.abort(),
    setState,
    getState: () => state,
    triggerPress,
    setBusy,
  };
}