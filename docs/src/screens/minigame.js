/* ===========================================
   minigame.js — 미니게임 화면 (Stub)
   ============================================
   황금 5+ 매칭 시 진입
   실제 미니게임 3종은 추후 구현
   ============================================ */

let onCloseCallback = null;

export default {
  mount(el, params = {}) {
    onCloseCallback = params.onClose;

    const root = document.createElement('section');
    root.className = 'minigame-screen';
    root.innerHTML = `
      <div class="minigame-screen__inner">
        <div class="minigame-screen__title">황금 미니게임</div>
        <div class="minigame-screen__sub">(추후 구현 예정)</div>
        <button class="minigame-screen__btn">슬롯으로 돌아가기</button>
      </div>
    `;

    const btn = root.querySelector('.minigame-screen__btn');
    btn.addEventListener('click', () => {
      onCloseCallback?.();
    });

    el.appendChild(root);
  },

  unmount() {
    onCloseCallback = null;
  },
};