/* ===========================================
   combo-overlay.js — 콤보 오버레이
   ============================================
   매칭 발견 순간 화면 중앙에 짧게 등장
   - 등급명 (치어/소형/중형/월척/대물/보스/전설보스/신화보스)
   - 사이즈 (예: "x7")
   ============================================ */

/**
 * 콤보 오버레이 element 생성
 */
export function createComboOverlay() {
  const el = document.createElement('div');
  el.className = 'combo-overlay';
  el.innerHTML = `
    <div class="combo-overlay__grade"></div>
    <div class="combo-overlay__size"></div>
  `;
  return el;
}

/**
 * 콤보 표시
 * @param {HTMLElement} el
 * @param {string} grade - '치어' | '소형' | '중형' | '월척' | '대물' | '보스' | '전설보스' | '신화보스'
 * @param {number} size - 매칭된 셀 수
 */
export function showCombo(el, grade, size) {
  const gradeEl = el.querySelector('.combo-overlay__grade');
  const sizeEl = el.querySelector('.combo-overlay__size');

  gradeEl.textContent = grade;
  sizeEl.textContent = `× ${size}`;

  // 등급별 클래스 (CSS에서 색 분기)
  el.dataset.grade = grade;

  el.classList.remove('show');
  void el.offsetWidth;  // 강제 reflow
  el.classList.add('show');

  setTimeout(() => el.classList.remove('show'), 1400);
}