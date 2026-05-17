/* ===========================================
   gear-grades.js — 장비 등급 6단계
   ============================================
   docs/01_슬롯화면_디자인.md [장비 4칸 / 장착 상태 (등급별)] SSOT.
   - color: 테두리/네온 색
   - glow: 0~1 (외곽 글로우 강도)
   - neon: 0~1 (네온 효과 강도)
   - pulse: true = 펄스 애니메이션 (신화 전용)
   색은 tokens.css 의 --gear-* 와 일치.
   ============================================ */

export const GEAR_GRADES = Object.freeze({
  common:    { name: '일반', color: '#FFFFFF', glow: 0,    neon: 0,    pulse: false },
  uncommon:  { name: '고급', color: '#9DE36B', glow: 0.15, neon: 0,    pulse: false },
  rare:      { name: '희귀', color: '#2563EB', glow: 0.3,  neon: 0,    pulse: false },
  epic:      { name: '영웅', color: '#B080D0', glow: 0.4,  neon: 0.3,  pulse: false },
  legendary: { name: '전설', color: '#FFD96A', glow: 0.5,  neon: 0.6,  pulse: false },
  mythic:    { name: '신화', color: '#FF49A6', glow: 0.7,  neon: 1.0,  pulse: true  },
});

/** 등급 키 순서 (낮음 → 높음) */
export const GEAR_GRADE_ORDER = Object.freeze([
  'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic',
]);