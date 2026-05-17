/* ===========================================
   turn-counter.js — TURN 카운터
   ============================================
   docs/01_슬롯화면_디자인.md [TURN 카운터] SSOT.
   - 위치: 슬롯 그리드 바로 아래, 가운데 정렬
   - "TURN" 라벨 9px / 숫자 14px / 3자리 zero-padding
   ============================================ */

const PAD = 3;

function padTurn(n) {
  return String(Math.max(0, Math.floor(n))).padStart(PAD, '0');
}

/**
 * @param {object} [opts]
 * @param {number} [opts.value=0]
 * @returns {{ root: HTMLElement, setValue: (n: number) => void }}
 */
export function createTurnCounter(opts = {}) {
  const { value = 0 } = opts;

  const root = document.createElement('div');
  root.className = 'turn-counter';

  const label = document.createElement('span');
  label.className = 'turn-counter__label';
  label.textContent = 'TURN';

  const num = document.createElement('span');
  num.className = 'turn-counter__num';
  num.textContent = padTurn(value);

  root.appendChild(label);
  root.appendChild(num);

  function setValue(n) {
    num.textContent = padTurn(n);
  }

  return { root, setValue };
}
