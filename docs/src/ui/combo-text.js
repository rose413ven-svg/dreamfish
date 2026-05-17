/* ===========================================
   combo-text.js — 콤보 텍스트 (Day 7)
   ============================================
   매 매칭 성공 시 콤보 +1, 텍스트 표시.
   매칭 실패 시 콤보 0 + 텍스트 hide.

   형식: "1 COMBO BONUS" / "2 COMBO BONUS" / ...
   단계별 색상/글로우 (1~10), 9~10 별 파티클.
   콤보 끊기기 전까지 계속 보임 (자동 hide X).
   새 콤보 발생 시 "팡" 펄스 애니메이션 재발동.

   위치: slot-screen content 안 (HUD ↔ 슬롯 그리드 사이).
   ============================================ */

/**
 * 콤보 텍스트 element 생성.
 * @returns {HTMLDivElement}
 */
export function createComboText() {
  const el = document.createElement('div');
  el.className = 'combo-text';
  el.innerHTML = `
    <span class="combo-text__num">0</span>
    <span class="combo-text__label">COMBO BONUS</span>
    <span class="combo-text__star combo-text__star--1">✦</span>
    <span class="combo-text__star combo-text__star--2">✦</span>
    <span class="combo-text__star combo-text__star--3">✦</span>
    <span class="combo-text__star combo-text__star--4">✦</span>
  `;
  return el;
}

/**
 * 콤보 텍스트 표시 + 팡 펄스 애니메이션.
 * @param {HTMLElement} el
 * @param {number} count - 콤보 카운트 (1+)
 */
export function showComboText(el, count) {
  if (!el || count < 1) return;

  // 단계별 클래스 — 1~10, 11+ = 10 단계 동일
  const level = count >= 10 ? 10 : count;
  el.dataset.level = String(level);

  // 텍스트 갱신 (숫자 + 라벨 분리)
  const numEl = el.querySelector('.combo-text__num');
  if (numEl) numEl.textContent = String(count);

  // 표시 + 펄스 재발동 (이미 보이고 있어도 새 펄스 재시작)
  el.classList.add('combo-text--show');
  el.classList.remove('combo-text--pulse');
  // 강제 reflow → 다음 프레임에 pulse 재발동
  void el.offsetWidth;
  el.classList.add('combo-text--pulse');
}

/**
 * 콤보 텍스트 숨김 (매칭 실패 시).
 * @param {HTMLElement} el
 */
export function hideComboText(el) {
  if (!el) return;
  el.classList.remove('combo-text--show', 'combo-text--pulse');
  el.dataset.level = '';
}

/**
 * Day 15: 골든힛 타임 카운트 표시 (콤보 자리 재활용).
 * - 콤보 텍스트 element 를 그대로 사용하되 data-mode="golden-hit" 어트리뷰트로 CSS 분기
 * - 숫자 = 남은 횟수, 라벨 = "GOLDEN HIT" (CSS 가 황금빛 처리)
 * - 콤보 modifier (combo-text--show / level / pulse) 사용 안 함
 *
 * @param {HTMLElement} el
 * @param {number} remaining  남은 cast 횟수 (3 → 0)
 */
export function showGoldenHitCount(el, remaining) {
  if (!el) return;
  el.dataset.mode = 'golden-hit';
  // 숫자 + 라벨 갱신
  const numEl = el.querySelector('.combo-text__num');
  if (numEl) numEl.textContent = String(remaining);
  const labelEl = el.querySelector('.combo-text__label');
  if (labelEl) labelEl.textContent = 'GOLDEN CHANCE';
  // 콤보 단계 색 비활성화
  el.dataset.level = '';
  // 표시 + 짧은 펄스 (카운트 갱신 시점 강조)
  el.classList.add('combo-text--show');
  el.classList.remove('combo-text--pulse');
  void el.offsetWidth;
  el.classList.add('combo-text--pulse');
}

/**
 * Day 15: 골든힛 타임 카운트 표시 종료 → 일반 콤보 모드 복귀.
 * @param {HTMLElement} el
 */
export function hideGoldenHitCount(el) {
  if (!el) return;
  delete el.dataset.mode;
  // 라벨 원복 (다음 콤보 표시 시점에 덮어쓰지만 안전망)
  const labelEl = el.querySelector('.combo-text__label');
  if (labelEl) labelEl.textContent = 'COMBO BONUS';
  el.classList.remove('combo-text--show', 'combo-text--pulse');
  el.dataset.level = '';
}

/**
 * Day 20: 트윙클(꿈조각) 타임 자동 캐스트 카운트 표시.
 * 골든힛 카운트와 동일 패턴 — data-mode="twinkle" 어트리뷰트로 CSS 분기.
 * - 숫자 = 남은 cast 횟수 (3/5/7/10 → 0)
 * - 라벨 = "Twinkle chance" (대표 명시 — mixed case)
 * - 흰색·연푸른빛 톤 (CSS 처리)
 *
 * @param {HTMLElement} el
 * @param {number} remaining  남은 cast 횟수
 */
export function showTwinkleChance(el, remaining) {
  if (!el) return;
  el.dataset.mode = 'twinkle';
  const numEl = el.querySelector('.combo-text__num');
  if (numEl) numEl.textContent = String(remaining);
  const labelEl = el.querySelector('.combo-text__label');
  if (labelEl) labelEl.textContent = 'Twinkle chance';
  // 콤보 단계 색 비활성화
  el.dataset.level = '';
  // 표시 + 짧은 펄스 (카운트 갱신 시점 강조)
  el.classList.add('combo-text--show');
  el.classList.remove('combo-text--pulse');
  void el.offsetWidth;
  el.classList.add('combo-text--pulse');
}

/**
 * Day 20: 트윙클 카운트 표시 종료 → 일반 콤보 모드 복귀.
 * @param {HTMLElement} el
 */
export function hideTwinkleChance(el) {
  if (!el) return;
  delete el.dataset.mode;
  const labelEl = el.querySelector('.combo-text__label');
  if (labelEl) labelEl.textContent = 'COMBO BONUS';
  el.classList.remove('combo-text--show', 'combo-text--pulse');
  el.dataset.level = '';
}