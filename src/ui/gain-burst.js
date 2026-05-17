/* ===========================================
   gain-burst.js — 최종무게 버스트 (슬롯 가운데, Day 26 신규)
   ============================================
   결정로그 Day 26 SSOT.

   대표 결정:
   - 기존 게이지 위 hud__gauge-gain 효과 폐기 → 슬롯 그리드 가운데로 이동
   - 시안 B (큰 글자 + 노랑 + 충격 링 + 글로우) — 시각적 도파민 강조
   - 글자 크기 = 화면 폭 90% 까지 자동 축소 (큰 수도 안 짤리게)
   - 자동 dispose (animationend + safety timeout)

   호출:
   - showCenterGainBurst(gridRoot, gainedKg)
     · gainedKg: 표시할 무게 (kg)
     · gridRoot: 슬롯 그리드 root DOM (position: relative)

   CSS:
   - public/styles/screens/slot.css 안 "Day 26 — 최종무게 버스트" 섹션
   ============================================ */

const ANIMATION_TOTAL_MS = 1800;     // 모션 끝 + 안전 여유
const TEXT_MAX_FONT_PX = 64;         // 최대 글자 크기 (작은 수일 때)
const TEXT_MIN_FONT_PX = 26;         // 최소 글자 크기 (매우 큰 수일 때 안전)
const CHAR_WIDTH_RATIO = 0.62;       // Pretendard ExtraBold 한 글자 폭 비율 추정
const GRID_USABLE_RATIO = 0.92;      // 그리드 폭의 92% 까지 글자 차지

/**
 * 슬롯 그리드 가운데 최종무게 버스트 표시.
 *
 * @param {HTMLElement} gridRoot
 * @param {number} gainedKg
 */
export function showCenterGainBurst(gridRoot, gainedKg) {
  if (!gridRoot) return;

  // 1. 텍스트 결정
  const text = `+${(Number(gainedKg) || 0).toFixed(2)}`;

  // 2. 글자 크기 동적 계산 — 그리드 폭 기준으로 글자 수에 맞춰 자동 축소.
  //    fontSize = (gridWidth × 0.92) / charCount / 0.62
  const gridWidth = gridRoot.offsetWidth || 380;
  const maxTextWidth = gridWidth * GRID_USABLE_RATIO;
  const idealFontSize = maxTextWidth / text.length / CHAR_WIDTH_RATIO;
  const fontSize = Math.max(TEXT_MIN_FONT_PX, Math.min(TEXT_MAX_FONT_PX, idealFontSize));

  // 3. DOM 빌드 (wrapper → text + ring)
  const wrapper = document.createElement('div');
  wrapper.className = 'gain-burst';

  // 충격 링 (확장 페이드)
  const ring = document.createElement('div');
  ring.className = 'gain-burst__ring';
  wrapper.appendChild(ring);

  // 텍스트 (scale pop)
  const textEl = document.createElement('div');
  textEl.className = 'gain-burst__text';
  textEl.textContent = text;
  textEl.style.fontSize = `${fontSize.toFixed(1)}px`;
  wrapper.appendChild(textEl);

  gridRoot.appendChild(wrapper);

  // 4. 애니메이션 종료 시 자동 제거
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
  };
  textEl.addEventListener('animationend', remove, { once: true });
  setTimeout(remove, ANIMATION_TOTAL_MS);
}

/** 그리드 안 모든 burst 요소 강제 제거 (화면 전환 등 cleanup 용) */
export function clearAllCenterGainBurst(gridRoot) {
  if (!gridRoot) return;
  gridRoot.querySelectorAll('.gain-burst').forEach(el => {
    if (el.parentNode) el.parentNode.removeChild(el);
  });
}