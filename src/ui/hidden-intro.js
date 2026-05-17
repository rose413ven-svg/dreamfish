/* ===========================================
   hidden-intro.js — HIDDEN BOSS 진입 팝업 (★ Day 22 신규)
   ============================================
   twinkle-intro / minigame-intro 의 분홍 톤 변경판.
   - 타이틀: "HIDDEN BOSS"
   - 서브:   "숨겨진 보스가 나타났다"
   - 설명:   "숨겨진 보스는 X원 미출현하고, / PERFECT 에만 체력이 닳습니다"
            (작은 글씨, 신규 요소 — twinkle-intro 에는 없는 description)
   - 버튼:   "시작" → onConfirm() → 잡기 게임 HIDDEN 모드 진입 (Phase 4 예정)

   아이콘 SVG: 임시 (트윙클 아이콘 분홍 톤). Phase 5 에서 분홍 물고기 SVG 디자인
              합의 후 정확한 디자인으로 교체.
   ============================================ */

export function createHiddenIntro({ onConfirm }) {
  const el = document.createElement('div');
  el.className = 'hidden-intro';
  el.innerHTML = `
    <div class="hidden-intro__backdrop"></div>
    <div class="hidden-intro__panel">
      <div class="hidden-intro__icon">
        <svg viewBox="0 4 60 32" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 20 Q18 8 35 12 Q48 16 50 20 Q48 24 35 28 Q18 32 8 20 Z M50 20 L58 13 L58 27 Z"
                fill="#000000"
                stroke="rgba(0,0,0,0.3)" stroke-width="0.4"/>
          <circle cx="14" cy="18" r="1.2" fill="#000000"/>
        </svg>
      </div>
      <div class="hidden-intro__title">HIDDEN<br>BOSS</div>
      <div class="hidden-intro__sub">숨겨진 보스가 나타났다</div>
      <div class="hidden-intro__description">
        숨겨진 보스는 X원 미출현하고,<br>
        PERFECT 에만 체력이 닳습니다
      </div>
      <button class="hidden-intro__btn">터치하여 시작하기</button>
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

export function showHiddenIntro(el) {
  el.classList.remove('hide');
  void el.offsetWidth;
  el.classList.add('show');
}