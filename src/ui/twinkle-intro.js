/* ===========================================
   twinkle-intro.js — 꿈조각(트윙클) 타임 진입 팝업
   ============================================
   Day 20: minigame-intro.js 의 톤 변경판.
   - "TWINKLE TIME" + "꿈조각을 낚으세요" + "시작" 버튼
   - 클릭 → onConfirm() → 카드 미니게임 진입 (slot.js 에서 처리)
   ============================================ */

export function createTwinkleIntro({ onConfirm }) {
  const el = document.createElement('div');
  el.className = 'twinkle-intro';
  el.innerHTML = `
    <div class="twinkle-intro__backdrop"></div>
    <div class="twinkle-intro__panel">
      <div class="twinkle-intro__icon">
        <svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 20 Q18 8 35 12 Q48 16 50 20 Q48 24 35 28 Q18 32 8 20 Z M50 20 L58 13 L58 27 Z"
                fill="#F0F8FF"/>
        </svg>
      </div>
      <div class="twinkle-intro__title">TWINKLE<br>TIME</div>
      <div class="twinkle-intro__sub">꿈조각을 낚으세요</div>
      <button class="twinkle-intro__btn">터치하여 시작하기</button>
    </div>
  `;

  // ★ Day 26 (대표 결정) — 버튼만이 아니라 팝업 어디든 터치 → 시작.
  //   show 클래스 가드 — 첫 클릭이 show 를 제거하면 두 번째 클릭은 early return (더블탭 안전).
  el.addEventListener('click', () => {
    if (!el.classList.contains('show')) return;
    el.classList.remove('show');
    el.classList.add('hide');
    setTimeout(() => onConfirm?.(), 200);
  });

  return el;
}

export function showTwinkleIntro(el) {
  el.classList.remove('hide');
  void el.offsetWidth;
  el.classList.add('show');
}