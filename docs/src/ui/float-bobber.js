/* ===========================================
   float-bobber.js — 낚시 찌 (단순 버전 복구)
   ============================================
   - hidden / idle / bite 만
   - 던지기 / 파동 제거
   ============================================ */

export function createBobber() {
  const el = document.createElement('div');
  el.className = 'float-bobber bobber-hidden';
  el.innerHTML = `
    <svg class="float-bobber__line" viewBox="0 0 4 200" preserveAspectRatio="none"
         xmlns="http://www.w3.org/2000/svg">
      <line x1="2" y1="0" x2="2" y2="200"
            stroke="#c8d4f0" stroke-width="0.6"
            opacity="0.6"/>
            <!-- ★ Day 21 (대표 결정) — stroke-dasharray="2,1" 제거: 점선 → 가는 실선 -->
    </svg>
    <svg class="float-bobber__body" viewBox="0 0 40 70" xmlns="http://www.w3.org/2000/svg">
      <line x1="20" y1="4" x2="20" y2="20" stroke="#f0f4ff" stroke-width="1.4" stroke-linecap="round"/>
      <circle cx="20" cy="4" r="1.6" fill="#f0f4ff"/>
      <ellipse cx="20" cy="32" rx="9" ry="14" fill="#ffffff" stroke="#0a1024" stroke-width="0.8"/>
      <path d="M 11 28 Q 11 22 20 20 Q 29 22 29 28 Z" fill="#E24B4A"/>
      <line x1="11" y1="28" x2="29" y2="28" stroke="#0a1024" stroke-width="0.6"/>
      <circle cx="20" cy="48" r="2" fill="#6890c8"/>
    </svg>
  `;

  return el;
}

export function setBobberState(el, state) {
  el.classList.remove('bobber-idle', 'bobber-bite', 'bobber-hidden');
  el.classList.add(`bobber-${state}`);
}

// 호환용 — 이전 castBobber 호출도 그냥 idle로
export function castBobber(el) {
  setBobberState(el, 'idle');
}

export function biteBobber(el) {
  setBobberState(el, 'bite');
}

export function showBobber(el) {
  setBobberState(el, 'idle');
}

export function hideBobber(el) {
  setBobberState(el, 'hidden');
}

/* ============================================
   ★ Day 26 (대표 결정 Q10 — B) — 찌 cosmetic 입자 효과
   ============================================
   기존 글로우/halo 폐기 → 찌 주위 반짝이는 작은 입자 떠다님.
   - 등급별 개수: rare 4 / epic 6 / legendary 8 / mythic 12
   - 등급별 색: 파랑/보라/노랑/분홍 (cosmetic-star 색과 일관)
   - 크기: 1.5~2.5px (등급별 미세 차등)
   - 움직임: 랜덤 떠다님 (4가지 keyframes 순환 + 입자별 다른 phase/duration)
   - GPU 부담: transform + opacity 만 (rare 4개 ~ mythic 12개, paint 가벼움)
   ============================================ */

const FLOAT_PARTICLE_COUNT_BY_GRADE = {
  rare:      4,
  epic:      6,
  legendary: 8,
  mythic:   12,
};

/**
 * 찌 cosmetic 입자 sync — grade 변경 시 호출 (등급 X → 레이어 제거).
 *
 * @param {HTMLElement} bobberEl  찌 root (position relative)
 * @param {string|null} grade     'rare'|'epic'|'legendary'|'mythic'|null
 */
export function syncFloatCosmeticParticles(bobberEl, grade) {
  if (!bobberEl) return;

  // 기존 레이어 제거
  const oldLayer = bobberEl.querySelector('.float-bobber__particles');
  if (oldLayer) oldLayer.remove();
  if (!grade) return;

  const count = FLOAT_PARTICLE_COUNT_BY_GRADE[grade] || 0;
  if (count === 0) return;

  const layer = document.createElement('div');
  layer.className = 'float-bobber__particles';
  bobberEl.appendChild(layer);

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = `float-bobber__particle float-bobber__particle--${grade}`;
    // 초기 위치 — 찌 본체 주위 (중심 50%, 50% 기준 좌우 ±25%)
    const left = 25 + Math.random() * 50;     // 25~75%
    const top  = 30 + Math.random() * 40;     // 30~70%
    p.style.left = `${left.toFixed(1)}%`;
    p.style.top  = `${top.toFixed(1)}%`;
    // 4가지 drift keyframes 순환
    const animIdx = (i % 4) + 1;
    const dur     = 3000 + Math.random() * 3000;   // 3~6초
    const delay   = Math.random() * 3;              // 0~3초 (각 입자 다른 phase)
    p.style.animation = `float-particle-drift-${animIdx} ${dur.toFixed(0)}ms ease-in-out -${delay.toFixed(2)}s infinite`;
    layer.appendChild(p);
  }
}