/* ===========================================
   fish-svg.js — 물고기 SVG 렌더
   ============================================
   기획서 V-006: Phase 1~4 동안은 같은 path + 색·크기만 차등
   Phase B에서 종별 정밀 SVG 디자인 예정

   ★ Day 22 — HIDDEN BOSS (id='hidden_01' / 이름="숨겨진 보스") 전용 분기:
     - 라인 아트 (stroke only, fill='none')
     - 큰 통통한 몸 + 흐르는 꼬리 + 측면 점선 + 작은 눈
     - 일반 fish 와 다른 viewBox / 디자인
   ============================================ */

/**
 * 물고기 SVG 생성
 * @param {object} fish - { id, color, size }
 * @param {number} scale - 기본 크기에 곱하는 스케일 (등급별)
 * @param {object} [opts]
 * @param {boolean} [opts.tight=false] - true면 viewBox 위/아래 빈 공간 줄임
 *   (Day 6 후반: 잡기게임 월척/대물/보스/전설보스 잡기존 겹침 방지용. 치어/소형/중형/결과팝업은 영향 X)
 * @param {boolean} [opts.shadow=false] - ★ Day 28 (대표 결정): true면 hidden_01 의 분홍 radial gradient
 *   대신 단색 #000000 fill 사용 → 결과팝업 그림자(__shadow) 가 완전 검정으로 보임.
 * @returns {string} SVG HTML
 */
export function renderFishSVG(fish, scale = 1, opts = {}) {
  const color = fish?.color || '#000000';
  const size = (fish?.size || 0.6) * 100 * scale;

  // ★ Day 22 — HIDDEN BOSS (시크릿꿈고래) 전용 SVG
  //   동화책 고래 형태: 둥근 통통한 몸 + 분수공 + V자 꼬리 + 작은 눈
  //   radial gradient 로 안쪽 빛나는 분홍 (옵션 1 — 부드러운 radial 빛)
  //   gradient ID 는 매 호출마다 unique (multiple instance 충돌 방지)
  //
  //   ★ Day 28 (대표 결정) — opts.shadow=true 인 경우 (결과팝업 missed 그림자용):
  //   gradient 대신 단색 #000000 fill 사용 → 완전 검정 실루엣.
  if (fish?.id === 'hidden_01') {
    const viewBox = opts.tight ? '20 18 160 76' : '0 0 200 110';
    if (opts.shadow) {
      // 단색 검정 — 그림자 전용 (결과팝업 missed)
      return `
        <svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg"
             style="width: ${size}%; height: auto;">
          <path d="M 30 55 Q 30 22 95 22 Q 155 22 165 52 L 192 28 L 192 82 L 165 58 Q 155 88 95 88 Q 30 88 30 55 Z"
                fill="#000000" stroke="#000000" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M 75 22 Q 75 8 70 4 M 80 22 Q 80 10 84 6"
                fill="none" stroke="#000000" stroke-width="1.8" stroke-linecap="round"/>
          <circle cx="50" cy="48" r="2.6" fill="#000000"/>
        </svg>
      `;
    }
    const gradId = `whale-grad-${Math.random().toString(36).slice(2, 8)}`;
    return `
      <svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg"
           style="width: ${size}%; height: auto;">
        <defs>
          <radialGradient id="${gradId}" cx="45%" cy="42%" r="58%">
            <stop offset="0%" stop-color="#FFE0EE" stop-opacity="0.85"/>
            <stop offset="50%" stop-color="#FFC8DE" stop-opacity="0.65"/>
            <stop offset="100%" stop-color="#FFB8D8" stop-opacity="0.4"/>
          </radialGradient>
        </defs>
        <path d="M 30 55 Q 30 22 95 22 Q 155 22 165 52 L 192 28 L 192 82 L 165 58 Q 155 88 95 88 Q 30 88 30 55 Z"
              fill="url(#${gradId})" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 75 22 Q 75 8 70 4 M 80 22 Q 80 10 84 6"
              fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="50" cy="48" r="2.6" fill="${color}"/>
      </svg>
    `;
  }

  // 일반 fish (Day 16 이전부터 통일된 path)
  const viewBox = opts.tight ? '0 4 60 32' : '0 -4 60 50';

  return `
    <svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg"
         style="width: ${size}%; height: auto;">
      <path d="M8 20 Q18 8 35 12 Q48 16 50 20 Q48 24 35 28 Q18 32 8 20 Z M50 20 L58 13 L58 27 Z"
            fill="${color}"
            stroke="rgba(0,0,0,0.3)" stroke-width="0.4"/>
      <circle cx="14" cy="18" r="1.2" fill="#000000"/>
    </svg>
  `;
}