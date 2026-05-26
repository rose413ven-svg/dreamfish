/* ===========================================
   special-mythic-hit-intro.js — SPECIAL MYTHIC HIT 진입 화면 (★ Day 36 신규 / Day 37 정정 / ★ Day 39 임팩트 강화)
   ============================================
   대표 결정 (Day 36 / Day 37 정정 / Day 39 임팩트 강화):
   - 트윙클 타임 종료 + 꿈조각 보상 팝업 닫힘 → 황금빛꿈고래 신화 트리거 발동 시 표시.
   - ★ Day 39 (대표 결정 A+B+D 조합) — 백드롭 + 빛줄기 + 그라데이션 텍스트 추가:
       · backdrop  = 어두운 화면 + 황금 비네팅 (가운데로 빛 모임)
       · light-rays = 텍스트 뒤에서 회전하는 부채꼴 황금 빛줄기
       · grade/main 텍스트 = 황금 그라데이션 + 검정 외곽선 (CSS 처리)
   - 텍스트 두 줄:
       위 = "SPECIAL MYTHIC" (황금 그라데이션 + 글로우 펄스 + 외곽선)
       아래 = "HIT" (황금 + 외곽선)
   - sparkle stars (별 흩날림) 유지.
   - 하단 가이드 텍스트 없음.
   - 사용자가 슬롯 cast(pull) 버튼 누르면 → 사라짐 + 황금빛꿈고래 인트로(mythic-intro) 표시.
   ============================================ */

import { createSparkleStars } from './sparkle-stars.js';

export function createSpecialMythicHitIntro() {
  const el = document.createElement('div');
  el.className = 'special-mythic-hit-intro';
  el.innerHTML = `
    <div class="special-mythic-hit-intro__backdrop"></div>
    <div class="special-mythic-hit-intro__rays"></div>
    <div class="special-mythic-hit-intro__content">
      <div class="special-mythic-hit-intro__grade">SPECIAL MYTHIC</div>
      <div class="special-mythic-hit-intro__main">HIT</div>
    </div>
  `;
  // ★ Day 37 — 별 효과 흩날림 (content 안에 prepend → 텍스트 뒤로 paint order)
  const content = el.querySelector('.special-mythic-hit-intro__content');
  if (content) content.prepend(createSparkleStars());
  return el;
}

export function showSpecialMythicHitIntro(el) {
  el.classList.remove('hide');
  void el.offsetWidth;
  el.classList.add('show');
}

export function hideSpecialMythicHitIntro(el) {
  el.classList.remove('show');
  el.classList.add('hide');
}