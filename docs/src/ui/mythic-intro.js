/* ===========================================
   mythic-intro.js — 신화 트리거 진입 팝업 (★ Day 35 신규)
   ============================================
   대표 결정 (Day 35) — A. (가):
   - 트윙클 타임 중 트윙클 15+ 누적 → 황금빛꿈고래 신화 트리거 발생 시 표시.
   - 기존 3개 인트로(minigame/twinkle/hidden)는 그대로 유지. 이건 별도 신규 1개.
   - 텍스트는 한 줄만: "신화속 황금빛꿈고래가 나타났다..."
   - 하단 "터치하여 시작하기" 동일 패턴 (다른 인트로들과 통일).
   - 클릭 → onConfirm() → 잡기 게임 직접 진입 (slot.js handleMythicTriggerHit 흐름).
   ============================================ */

export function createMythicIntro({ onConfirm }) {
  const el = document.createElement('div');
  el.className = 'mythic-intro';
  el.innerHTML = `
    <div class="mythic-intro__backdrop"></div>
    <div class="mythic-intro__panel">
      <div class="mythic-intro__title">신화속 황금빛꿈고래가<br>나타났다...</div>
      <button class="mythic-intro__btn">터치하여 시작하기</button>
    </div>
  `;

  // ★ Day 26 패턴 통일 — 버튼만이 아니라 팝업 어디든 터치 → 시작.
  //   show 클래스 가드 — 첫 클릭이 show 를 제거하면 두 번째 클릭은 early return (더블탭 안전).
  el.addEventListener('click', () => {
    if (!el.classList.contains('show')) return;
    el.classList.remove('show');
    el.classList.add('hide');
    setTimeout(() => onConfirm?.(), 200);
  });

  return el;
}

export function showMythicIntro(el) {
  el.classList.remove('hide');
  void el.offsetWidth;
  el.classList.add('show');
}