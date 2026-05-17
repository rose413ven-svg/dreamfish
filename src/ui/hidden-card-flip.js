/* ===========================================
   hidden-card-flip.js — HIDDEN HIT 카드뒤집기 (★ Day 22 Phase 6)
   ============================================
   잡기 성공 후 무게 보너스 카드 뽑기 (X1/X3/X5 중 1장).

   흐름:
     1. show → 카드 3장 뒷면 + 셔플 애니메이션 (1.2초)
     2. 셔플 종료 → 사용자 클릭 대기
     3. 사용자 카드 클릭 → 모든 카드 동시 공개 (앞면 플립 0.6초)
     4. 1.5초 대기 (사용자가 운 확인)
     5. 선택 카드 중앙 확대 + 페이드아웃 (0.7초) + 다른 카드 페이드아웃
     6. _onSelect(cardMultiplier) 콜백 호출 → Phase 7 결과 팝업

   카드 디자인:
     - 뒷면: 분홍 그라데이션 + HIDDEN HIT 잡기게임 흰 원 + 분홍 fish 심볼 (컨셉 일관)
     - 앞면: 어두운 배경 + "×N" 분홍 글로우
     - 비율: 3:4 직사각형 (8rem × 11rem)
   ============================================ */

import { shuffleHiddenHitCards } from '../data/hidden-hit-engine.js';

/** 카드 뒷면 fish 심볼 SVG (catch-game.js renderFishSymbolSilhouette 패턴, fill 분홍) */
const FISH_SYMBOL_SVG = `
  <svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">
    <path d="M 8,30 C 8,16 22,8 38,8 C 58,8 72,16 78,30 C 72,44 58,52 38,52 C 22,52 8,44 8,30 Z
             M 78,30 L 95,14 L 92,30 L 95,46 L 78,30 Z"
          fill="#FF9DCB" stroke="rgba(255,255,255,0.4)" stroke-width="0.8"/>
    <circle cx="28" cy="26" r="2.4" fill="rgba(255,255,255,0.85)"/>
  </svg>
`;

/** 카드 1장 HTML (뒷면 = 흰 원 + 분홍 심볼 / 앞면 = ×N) */
function cardHtml(index) {
  return `
    <div class="hidden-card-flip__card" data-index="${index}">
      <div class="hidden-card-flip__card-inner">
        <div class="hidden-card-flip__face hidden-card-flip__face--back">
          <span class="hidden-card-flip__orb">
            <span class="hidden-card-flip__orb-symbol">${FISH_SYMBOL_SVG}</span>
          </span>
        </div>
        <div class="hidden-card-flip__face hidden-card-flip__face--front">
          <span class="hidden-card-flip__multiplier"></span>
        </div>
      </div>
    </div>
  `;
}

export function createHiddenCardFlip() {
  const el = document.createElement('div');
  el.className = 'hidden-card-flip';
  el.innerHTML = `
    <div class="hidden-card-flip__backdrop"></div>
    <div class="hidden-card-flip__panel">
      <div class="hidden-card-flip__title">BONUS</div>
      <div class="hidden-card-flip__cards">
        ${cardHtml(0)}
        ${cardHtml(1)}
        ${cardHtml(2)}
      </div>
      <div class="hidden-card-flip__hint">카드를 선택하세요</div>
    </div>
  `;

  // 매 호출마다 셔플 + 선택 콜백 다이내믹 설정
  el._multipliers = [];      // 셔플 결과 (예: [3, 1, 5])
  el._selectionLocked = true; // 셔플 중엔 클릭 금지
  el._onSelect = null;        // showHiddenCardFlip 시 설정

  const cards = el.querySelectorAll('.hidden-card-flip__card');
  const hintEl = el.querySelector('.hidden-card-flip__hint');

  cards.forEach((card, idx) => {
    card.addEventListener('click', () => {
      if (el._selectionLocked) return;
      el._selectionLocked = true;   // 한 번만 선택

      hintEl.classList.add('hidden-card-flip__hint--hide');

      // ★ Day 22 Phase 6 후속 (대표 결정):
      //   1단계 — 선택 카드만 먼저 공개 (앞면 플립 0.6초)
      //   2단계 — 1초 후 나머지 카드도 공개 + 선택 카드 색 #7B61FF (보라) 강조 변경
      //   3단계 — 다시 1초 후 다른 카드 빠른 페이드(0.15초) + 선택 카드 중앙 확대(0.7초)
      //   4단계 — onSelect 콜백 호출

      // [1단계] 선택 카드만 먼저 공개
      const selectedCard = cards[idx];
      selectedCard.querySelector('.hidden-card-flip__multiplier').textContent = `×${el._multipliers[idx]}`;
      selectedCard.classList.add('hidden-card-flip__card--revealed');

      // [2단계] 1초 후 나머지 공개 + 선택 카드 보라 강조
      setTimeout(() => {
        cards.forEach((c, i) => {
          if (i !== idx) {
            c.querySelector('.hidden-card-flip__multiplier').textContent = `×${el._multipliers[i]}`;
            c.classList.add('hidden-card-flip__card--revealed');
          }
        });
        // 선택 카드 색 변경 (분홍 → 보라)
        selectedCard.classList.add('hidden-card-flip__card--selected-purple');

        // [3단계] 다시 1초 후 다른 카드 빠른 페이드 + 선택 카드 확대
        setTimeout(() => {
          cards.forEach((c, i) => {
            if (i === idx) {
              c.classList.add('hidden-card-flip__card--zoom');
            } else {
              c.classList.add('hidden-card-flip__card--fade-out-fast');
            }
          });

          // [4단계] 선택 카드 확대 0.7초 끝나면 onSelect 콜백
          setTimeout(() => {
            el.classList.remove('show');
            el.classList.add('hide');
            const cb = el._onSelect;
            el._onSelect = null;
            if (cb) cb(el._multipliers[idx]);
          }, 700);
        }, 1000);   // Q1 a — 운 확인 1초
      }, 1000);   // 선택 카드만 본 후 1초
    });
  });

  // 셔플 시작 — 사실상 "팝업 등장" 트리거 (★ Day 22 Phase 7 후속 — 대표 결정)
  //   흔들림 셔플 애니메이션 폐기. 카드 페이드인은 모달 자체 .show transition (0.3초) 으로 자연 처리.
  //   셔플 결과(Math random) 자체는 그대로 — 시각 연출만 단순화.
  el._startShuffle = () => {
    // 카드 상태 리셋 (재호출 대응)
    cards.forEach(c => {
      c.classList.remove(
        'hidden-card-flip__card--revealed',
        'hidden-card-flip__card--selected',
        'hidden-card-flip__card--selected-purple',
        'hidden-card-flip__card--zoom',
        'hidden-card-flip__card--fade-out',
        'hidden-card-flip__card--fade-out-fast',
      );
      c.querySelector('.hidden-card-flip__multiplier').textContent = '';
    });
    hintEl.classList.remove('hidden-card-flip__hint--hide');
    hintEl.textContent = '카드를 선택하세요';

    // 셔플 결과 (예: [3, 1, 5]) — 결과 로직은 기존과 동일 (Fisher-Yates)
    el._multipliers = shuffleHiddenHitCards();
    el._selectionLocked = true;

    // 모달 페이드인 (~0.3초) 끝난 직후 클릭 활성 — 짧은 대기 400ms
    setTimeout(() => {
      el._selectionLocked = false;
    }, 400);
  };

  return el;
}

/**
 * 팝업 표시 + 셔플 시작.
 * @param {HTMLElement} el - createHiddenCardFlip() 으로 만든 element
 * @param {(cardMultiplier: number) => void} onSelect - 사용자 선택 후 콜백 (cardMultiplier = 1 | 3 | 5)
 */
export function showHiddenCardFlip(el, onSelect) {
  el._onSelect = onSelect;
  el.classList.remove('hide');
  void el.offsetWidth;
  el.classList.add('show');
  // 팝업 등장 후 셔플 시작 (0.3초)
  setTimeout(() => {
    if (el._startShuffle) el._startShuffle();
  }, 300);
}