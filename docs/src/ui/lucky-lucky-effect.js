/* ===========================================
   lucky-lucky-effect.js — 등급 Lucky Lucky 텍스트 연출 (★ Day 29)
   ============================================
   슬롯 화면 등급 럭키 발동 시 텍스트 팡 연출.

   호출 위치:
   - slot.js handlePull 의 tryLuckyLuckyUpgrade 발동 시.

   단계별 화려도 ↑:
   - data-stage="1" → 황금 작게
   - data-stage="2" → 살짝 크고 진한 황금
   - data-stage="3" → 주황빛
   - data-stage="4" → 핑크
   - data-stage="5" → 무지개 핑크 + 다층 글로우

   결과팝업 변종 Lucky 연쇄 연출(fish-result.js)과 시각적 톤 동일.
   ============================================ */

const ELEMENT_CLASS = 'slot-lucky-lucky';

/**
 * Lucky Lucky 효과 표시.
 *
 * 컨테이너에 .slot-lucky-lucky element 가 없으면 1회 생성, 있으면 재사용.
 * 단계별 텍스트/스타일 변경 → animation 재시작.
 *
 * @param {HTMLElement} container  슬롯 화면 컨테이너 (예: slotWrap)
 * @param {number}      chainStep  연쇄 단계 (1=첫 발동, 2=X2, ..., 7=X7)
 */
export function showLuckyLuckyEffect(container, chainStep) {
  let el = container.querySelector('.' + ELEMENT_CLASS);
  if (!el) {
    el = document.createElement('div');
    el.className = ELEMENT_CLASS;
    container.appendChild(el);
  }
  el.textContent = chainStep <= 1 ? 'Lucky Lucky' : `Lucky Lucky ×${chainStep}`;
  // 5단계까지만 시각 분기 (그 이상은 5단 톤 유지)
  el.dataset.stage = String(Math.min(chainStep, 5));
  el.classList.remove('show');
  void el.offsetWidth;   // reflow — CSS animation 재시작 트릭
  el.classList.add('show');
}

/**
 * 진행 중인 Lucky Lucky 효과 즉시 종료 (잡기게임 진입 시 등에서 호출).
 *
 * @param {HTMLElement} container
 */
export function hideLuckyLuckyEffect(container) {
  const el = container.querySelector('.' + ELEMENT_CLASS);
  if (el) {
    el.classList.remove('show');
    el.dataset.stage = '';
  }
}