/* ===========================================
   imagination-change-popup.js — 상상력 변동 팝업
   ★ Day 38 신규 (대표 결정) ★
   ============================================
   상상력 점수가 변동될 때 화면 정중앙에 가로띠 형태 팝업으로 표시.

   사용 트리거 (모두 hud.refreshImagination 안에서 자동 호출):
   - 장비 장착/해제 (가방 닫힘)
   - 강화 화면에서 복귀
   - 레벨업 (★ slot.js 가 레벨업 팝업 큐 닫힘 후 호출)
   - 도감 등록 (codex.js — Day 38 트리거 신규 추가)

   디자인 (대표 결정):
   - 가로띠 박스 (화면 가로폭 100%, 화면 정중앙)
   - 배경: 흰색 / 텍스트: 새 상상력 점수 = 검은색
   - 증가 시: 초록 ▲ +N / 감소 시: 빨강 ▼ N
   - 지속 2초 자동 닫힘
   - 화면 모달 위에 표시 (z-index 최상위)
   - 첫 변동 (이전값 없음) 무시 — storage.loadPreviousImagination() === null

   ⚠️ 중요:
   - 동일 인스턴스 재사용 (싱글톤). 동시 다중 호출 시 새 값으로 즉시 갱신.
   - body 직접 append (position: fixed) — 어느 화면/모달 위에서도 보임.
   ============================================ */

const DURATION_MS = 2000;     // 표시 지속 시간 (대표 결정)
const FADE_MS     = 220;      // 진입/이탈 페이드 시간

let singletonEl = null;
let hideTimerId = null;
let fadeTimerId = null;

/** 팝업 DOM 생성 (첫 호출 시 1회) */
function ensureElement() {
  if (singletonEl) return singletonEl;

  const el = document.createElement('div');
  el.className = 'imagination-change-popup';
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <div class="imagination-change-popup__inner">
      <span class="imagination-change-popup__label">상상력</span>
      <span class="imagination-change-popup__value">0</span>
      <span class="imagination-change-popup__diff">
        <span class="imagination-change-popup__arrow"></span>
        <span class="imagination-change-popup__diff-num"></span>
      </span>
    </div>
  `;
  document.body.appendChild(el);
  singletonEl = el;
  return el;
}

/**
 * 상상력 변동 팝업 표시.
 *
 * diff > 0  : ▲ 초록 +N
 * diff < 0  : ▼ 빨강 N (음수 그대로 표시)
 * diff === 0: 호출자에서 차단해야 함 (이 함수는 그대로 표시함 — 안전망)
 *
 * @param {number} currentValue - 새 상상력 점수
 * @param {number} diff         - 차이 (current - previous)
 */
export function showImaginationChangePopup(currentValue, diff) {
  const el = ensureElement();

  // 기존 타이머 정리 (연속 호출 시 즉시 갱신)
  if (hideTimerId) { clearTimeout(hideTimerId); hideTimerId = null; }
  if (fadeTimerId) { clearTimeout(fadeTimerId); fadeTimerId = null; }

  // 값 갱신
  const valueEl   = el.querySelector('.imagination-change-popup__value');
  const arrowEl   = el.querySelector('.imagination-change-popup__arrow');
  const diffNumEl = el.querySelector('.imagination-change-popup__diff-num');

  if (valueEl)   valueEl.textContent = Math.round(currentValue).toLocaleString();

  const isUp   = diff > 0;
  const isDown = diff < 0;
  // dataset.dir 로 CSS 분기 (초록/빨강)
  el.dataset.dir = isUp ? 'up' : (isDown ? 'down' : 'zero');

  if (arrowEl)   arrowEl.textContent   = isUp ? '▲' : (isDown ? '▼' : '');
  if (diffNumEl) {
    const absDiff = Math.abs(Math.round(diff));
    diffNumEl.textContent = isUp
      ? `+${absDiff.toLocaleString()}`
      : (isDown ? `-${absDiff.toLocaleString()}` : '');
  }

  // 표시 (CSS 트랜지션이 페이드/슬라이드)
  // 강제 reflow 후 .visible 추가 → 트랜지션 발동
  el.classList.remove('visible');
  void el.offsetWidth;
  el.classList.add('visible');

  // 2초 후 페이드 아웃 → 추가 FADE_MS 후 .visible 제거 (DOM 은 남김, 재사용)
  hideTimerId = setTimeout(() => {
    el.classList.remove('visible');
    fadeTimerId = setTimeout(() => {
      // 모두 정리
      fadeTimerId = null;
    }, FADE_MS);
    hideTimerId = null;
  }, DURATION_MS);
}

/** 강제 즉시 숨김 (화면 전환 cleanup 등 — 현재 호출처 없지만 안전망) */
export function hideImaginationChangePopup() {
  if (!singletonEl) return;
  if (hideTimerId) { clearTimeout(hideTimerId); hideTimerId = null; }
  if (fadeTimerId) { clearTimeout(fadeTimerId); fadeTimerId = null; }
  singletonEl.classList.remove('visible');
}