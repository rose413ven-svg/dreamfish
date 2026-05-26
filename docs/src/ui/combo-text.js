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
 *
 * Day 38 (대표 결정) — 콤보 시스템 변경:
 *   - 1~29 콤보: "{N} COMBO BONUS" (예: "15 COMBO BONUS")
 *   - 30+ 콤보: "MAX COMBO BONUS" (숫자 hide, 카운트는 무한 누적되어도 텍스트 동일)
 *   - 시각 단계(data-level)는 기존 1~10 그대로 (10 단계 시각 = MAX 시각).
 *
 * @param {HTMLElement} el
 * @param {number} count - 콤보 카운트 (1+, 무한 누적 가능)
 */
export function showComboText(el, count) {
  if (!el || count < 1) return;

  // 단계별 클래스 — 1~10, 11+ = 10 단계 동일 (시각은 그대로)
  const level = count >= 10 ? 10 : count;
  el.dataset.level = String(level);

  // ★ Day 38 — 30+ 콤보 시 MAX 모드 분기 (텍스트만 변경, 시각은 level=10 그대로 사용).
  //   data-max="true" 가 있으면 CSS 에서 .combo-text__num 을 hide,
  //   .combo-text__label 를 "MAX COMBO BONUS" 로 교체 (CSS content X — JS 가 직접 텍스트 세팅).
  const isMax = count >= 30;
  el.dataset.max = isMax ? 'true' : '';

  // 텍스트 갱신 (숫자 + 라벨 분리)
  const numEl   = el.querySelector('.combo-text__num');
  const labelEl = el.querySelector('.combo-text__label');
  if (numEl) {
    numEl.textContent   = String(count);
    // ★ Day 38 — 30+ 콤보 시 숫자 숨김 (CSS 추가 없이 JS 에서 직접 처리, (가) 안)
    numEl.style.display = isMax ? 'none' : '';
  }
  if (labelEl) labelEl.textContent = isMax ? 'MAX COMBO BONUS' : 'COMBO BONUS';

  // 표시 + 펄스 재발동 (이미 보이고 있어도 새 펄스 재시작)
  el.classList.add('combo-text--show');
  el.classList.remove('combo-text--pulse');
  // 강제 reflow → 다음 프레임에 pulse 재발동
  void el.offsetWidth;
  el.classList.add('combo-text--pulse');
}

/**
 * 콤보 텍스트 숨김 (매칭 실패 시).
 * Day 38: dataset.max 도 함께 클리어 + numEl.style.display 복원 (다음 콤보 시작 시 잔존 X).
 * @param {HTMLElement} el
 */
export function hideComboText(el) {
  if (!el) return;
  el.classList.remove('combo-text--show', 'combo-text--pulse');
  el.dataset.level = '';
  el.dataset.max = '';
  // ★ Day 38 — 30+ 콤보로 numEl display:none 된 경우 복원
  const numEl = el.querySelector('.combo-text__num');
  if (numEl) numEl.style.display = '';
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
  if (numEl) {
    numEl.textContent = String(remaining);
    numEl.style.display = '';  // ★ Day 38 — 이전 콤보 MAX 상태에서 display:none 됐을 수 있으므로 복원
  }
  const labelEl = el.querySelector('.combo-text__label');
  if (labelEl) labelEl.textContent = 'GOLDEN CHANCE';
  // 콤보 단계 색 비활성화
  el.dataset.level = '';
  el.dataset.max = '';  // ★ Day 38 — MAX 상태 해제
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
  if (numEl) {
    numEl.textContent = String(remaining);
    numEl.style.display = '';  // ★ Day 38 — MAX 상태에서 display:none 복원
  }
  const labelEl = el.querySelector('.combo-text__label');
  if (labelEl) labelEl.textContent = 'Twinkle chance';
  // 콤보 단계 색 비활성화
  el.dataset.level = '';
  el.dataset.max = '';  // ★ Day 38 — MAX 상태 해제
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