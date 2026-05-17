/* ===========================================
   minigame-intro.js — 골든힛 타임 진입 팝업 (Day 15 갱신)
   ============================================
   황금 인접 클러스터 3+ 매칭 시 등장
   "골든힛 타임 시작" 버튼 → cast 버튼 누르면 1회차 시작
   (트리거 cast의 다른 매칭 결과는 무시)
   ============================================ */

export function createMinigameIntro({ onConfirm }) {
  const el = document.createElement('div');
  el.className = 'minigame-intro';
  el.innerHTML = `
    <div class="minigame-intro__backdrop"></div>
    <div class="minigame-intro__panel">
      <div class="minigame-intro__icon">
        <svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 20 Q18 8 35 12 Q48 16 50 20 Q48 24 35 28 Q18 32 8 20 Z M50 20 L58 13 L58 27 Z"
                fill="#E8C870"/>
        </svg>
      </div>
      <div class="minigame-intro__title">GOLDEN<br>HIT</div>
      <div class="minigame-intro__sub">GOLDEN HIT TIME 3회</div>
      <button class="minigame-intro__btn">터치하여 시작하기</button>
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

export function showMinigameIntro(el) {
  el.classList.remove('hide');
  void el.offsetWidth;
  el.classList.add('show');
}