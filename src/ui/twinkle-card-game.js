/* ===========================================
   twinkle-card-game.js — 꿈조각 자동캐스트 횟수 결정 카드 게임 (Day 20 / ★ Day 25 간소화)
   ============================================
   ★ Day 25 (대표 결정) — 카드 수 간소화: 4×4=16 → 4×3=12 (각 종류 4장 → 3장).
   카드 앞면: ×3 / ×5 / ×7 / ×10 각 3장씩 → 랜덤 셔플.

   종료 조건:
   - 같은 횟수 카드 3장이 모이는 순간 → 종료 트리거.
     · 해당 횟수 카드 3장 모두 황금 테두리 + 반짝 효과
     · 나머지 안 뒤집은 카드 자동 공개
     · 페이드아웃 후 onResult(value) 콜백

   통계:
   - 최단 3장 (3장 연속 같은 값) ~ 최장 9장 (4종류 2장씩 8장 → 9장째 무조건 결정).
   - 기존 16장 ↔ 새 12장: 최단·최장 통계 동일, 카드 풀만 줄어듦.

   사용:
   - const game = createTwinkleCardGame({ onResult: (value) => {...} });
   - rootEl.appendChild(game.root);
   - game.show();
   ============================================ */

const CARD_VALUES = [3, 5, 7, 10];
const CARDS_PER_VALUE = 3;    // ★ Day 25 — 4 → 3 (대표 결정 — 간소화)
const TOTAL_CARDS = 12;       // ★ Day 25 — 16 → 12 (4×3 그리드)
const MATCH_NEEDED = 3;

// 종료 시점 타이밍 (페이드아웃 + 콜백)
// Day 20: 대표 결정 — 결과 머무름 시간 조정
//   1차: 1200 → 3000 (너무 짧아서 늘림)
//   2차: 3000 → 2000 (트윙클타임 종료 후 슬롯 머무름 시간이 따로 추가되어 카드는 줄임)
const WINNING_HIGHLIGHT_MS = 2000;   // 황금 테두리 + 반짝 노출 시간 (3장 강조 단계)
const REVEAL_REMAINING_MS  = 1800;   // 나머지 카드 자동 공개 후 페이드아웃 까지 대기
const FADE_OUT_MS          = 500;    // 팝업 페이드아웃 시간

/**
 * 카드 셔플 (Fisher-Yates).
 * @returns {number[]} 12장 카드의 value 배열 (예: [7,3,10,...])
 */
function shuffleCards() {
  const cards = [];
  for (const v of CARD_VALUES) {
    for (let i = 0; i < CARDS_PER_VALUE; i++) cards.push(v);
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

/**
 * 4×3 카드 미니게임 생성. ★ Day 25 — 16 → 12장 (각 종류 3장씩).
 * @param {object} opts
 * @param {(value:number) => void} opts.onResult  3장 같은 횟수 모이면 호출, 결정된 횟수 전달
 * @returns {{ root: HTMLElement, show: () => void }}
 */
export function createTwinkleCardGame({ onResult }) {
  const root = document.createElement('div');
  root.className = 'twinkle-card-game';

  const backdrop = document.createElement('div');
  backdrop.className = 'twinkle-card-game__backdrop';
  root.appendChild(backdrop);

  const panel = document.createElement('div');
  panel.className = 'twinkle-card-game__panel';
  root.appendChild(panel);

  const title = document.createElement('div');
  title.className = 'twinkle-card-game__title';
  title.textContent = 'CHOOSE YOUR CHANCE';
  panel.appendChild(title);

  const sub = document.createElement('div');
  sub.className = 'twinkle-card-game__sub';
  sub.textContent = '같은 횟수 3장을 모으세요';
  panel.appendChild(sub);

  const grid = document.createElement('div');
  grid.className = 'twinkle-card-game__grid';
  panel.appendChild(grid);

  // 카드 셔플
  const deck = shuffleCards();

  // 카드 상태: 뒤집힌 카드 value 카운트
  const flippedCount = { 3: 0, 5: 0, 7: 0, 10: 0 };
  const flippedCards = [];   // 뒤집힌 순서대로 card 객체 추적 (winning 카드 식별용)
  let isFinished = false;    // 종료 후 추가 클릭 차단

  // ★ Day 25 — 12장 카드 DOM 생성 (기존 16 → 12)
  const cardEls = deck.map((value, idx) => {
    const card = document.createElement('div');
    card.className = 'twinkle-card-game__card';
    card.dataset.value = String(value);
    card.dataset.index = String(idx);
    card.dataset.flipped = 'false';
    // Day 20: 12장 시차 페이드인 — 0.04s 씩 늦게 등장 (총 0.45s 정도)
    card.style.setProperty('--card-delay', `${(idx * 0.04).toFixed(2)}s`);

    const inner = document.createElement('div');
    inner.className = 'twinkle-card-game__card-inner';

    // 뒷면 (트윙클 심볼)
    const back = document.createElement('div');
    back.className = 'twinkle-card-game__card-back';
    back.innerHTML = `
      <svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" class="twinkle-card-game__back-fish">
        <path d="M8 20 Q18 8 35 12 Q48 16 50 20 Q48 24 35 28 Q18 32 8 20 Z M50 20 L58 13 L58 27 Z"
              fill="#F0F8FF" stroke="#FFFFFF" stroke-width="0.4" stroke-opacity="0.8"/>
      </svg>
    `;
    inner.appendChild(back);

    // 앞면 (×N 숫자 + 별빛)
    const front = document.createElement('div');
    front.className = 'twinkle-card-game__card-front';
    front.innerHTML = `
      <div class="twinkle-card-game__card-num">×${value}</div>
      <svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" class="twinkle-card-game__card-stars" aria-hidden="true">
        ${renderCardStars(value)}
      </svg>
    `;
    inner.appendChild(front);

    card.appendChild(inner);

    // 클릭 → 뒤집기
    card.addEventListener('click', () => handleCardClick(idx));

    grid.appendChild(card);
    return card;
  });

  function handleCardClick(idx) {
    if (isFinished) return;
    const card = cardEls[idx];
    if (card.dataset.flipped === 'true') return;   // 이미 뒤집힘

    card.dataset.flipped = 'true';
    const value = deck[idx];
    flippedCount[value] = (flippedCount[value] || 0) + 1;
    flippedCards.push({ idx, value });

    // 종료 조건: 같은 value 3장
    if (flippedCount[value] >= MATCH_NEEDED) {
      finish(value);
    }
  }

  function finish(winningValue) {
    isFinished = true;

    // 1) 같은 횟수 3장 모두 winning 강조 (황금 두꺼운 테두리 + 반짝)
    flippedCards.forEach(({ idx, value }) => {
      if (value === winningValue) {
        cardEls[idx].classList.add('twinkle-card-game__card--winning');
      }
    });

    // 2) WINNING_HIGHLIGHT_MS 뒤 → 나머지 안 뒤집은 카드 자동 공개
    setTimeout(() => {
      cardEls.forEach((card, idx) => {
        if (card.dataset.flipped !== 'true') {
          card.dataset.flipped = 'true';
          card.classList.add('twinkle-card-game__card--auto-reveal');
        }
      });

      // 3) REVEAL_REMAINING_MS 뒤 → 페이드아웃 시작
      setTimeout(() => {
        root.classList.add('twinkle-card-game--fading');

        // 4) 페이드아웃 끝나면 onResult 콜백
        setTimeout(() => {
          onResult?.(winningValue);
        }, FADE_OUT_MS);
      }, REVEAL_REMAINING_MS);
    }, WINNING_HIGHLIGHT_MS);
  }

  function show() {
    void root.offsetWidth;
    root.classList.add('twinkle-card-game--show');
  }

  return { root, show };
}

/**
 * 카드 앞면 별빛 SVG 생성 (value 별 별 개수 차등).
 * viewBox 100x130 (카드 비율 가정) 안 흩뿌림.
 *
 * - ×3: 별 1개 (잔잔)
 * - ×5: 별 2개
 * - ×7: 별 3개
 * - ×10: 별 6개 + 큰 별 (가장 화려)
 */
function renderCardStars(value) {
  // 별 path (5점 별 — 작은 단위)
  const star = (cx, cy, r, opacity = 0.6, anim = false) => {
    const points = [];
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (Math.PI * i) / 5;
      const rr = (i % 2 === 0) ? r : r * 0.45;
      points.push(`${(cx + rr * Math.cos(ang)).toFixed(1)},${(cy + rr * Math.sin(ang)).toFixed(1)}`);
    }
    const animTag = anim
      ? `<animate attributeName="opacity" values="0.5;1;0.5" dur="2.4s" repeatCount="indefinite"/>`
      : '';
    return `<polygon points="${points.join(' ')}" fill="#FFFFFF" opacity="${opacity}">${animTag}</polygon>`;
  };

  switch (value) {
    case 3:
      return star(50, 105, 4, 0.55, true);
    case 5:
      return star(38, 105, 3.5, 0.55, true) + star(62, 105, 3.5, 0.55, true);
    case 7:
      return star(34, 105, 3.5, 0.6, true) + star(50, 108, 4, 0.7, true) + star(66, 105, 3.5, 0.6, true);
    case 10:
      return [
        star(18, 22, 2.5, 0.85),
        star(82, 24, 2.5, 0.75),
        star(14, 50, 2.0, 0.65),
        star(86, 60, 2.5, 0.85),
        star(34, 108, 3.5, 0.95, true),
        star(50, 112, 4.2, 0.95, true),
        star(66, 108, 3.5, 0.95, true),
        star(20, 124, 2.0, 0.7),
        star(80, 122, 2.5, 0.85),
      ].join('');
    default:
      return '';
  }
}

export function showTwinkleCardGame(game) {
  game.show();
}