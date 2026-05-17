/* ===========================================
   stage-map.js — 낚시터 전체 맵 (Day 18 출시 수준 UI)
   ============================================
   결정로그 Day 18 SSOT.

   기존 Phase 1 stub 폐기 → 출시 수준 화면으로 전면 재작성.

   화면 구성:
   - 헤더: 뒤로 가기 (← 슬롯으로) / 타이틀 "낚시터 맵"
   - 동그라미 헤더: 5+5+1 배치
     · 상단 줄 1~5지역 / 하단 줄 6~10지역 / 오른쪽 끝 11지역 (만렙 전엔 검은 톤)
     · 활성 = 호박빛 글로우 / 잠금 = 회색 + 자물쇠
     · 동그라미 터치 → 해당 지역 카드로 점프 (스와이프 + 동기)
   - 메인 카드: 배경 이미지(placeholder 그라데이션) + 한국어 이름 + 영문 + 소개
     · 잠금 = 회색 톤 + 큰 자물쇠
     · 11지역 잠금 = 검은 톤 + "미지의 공간" 위장
   - 입장 버튼: 활성이면 입장 (slot 화면으로 navigate)

   인터랙션 (대표 결정):
   - 동그라미 터치 → 즉시 점프
   - 카드 좌우 스와이프 → 인접 지역 이동 (동그라미도 동기)

   추후 (Phase E):
   - 각 stage 별 배경 이미지 (placeholder 그라데이션 자리에)
   - 만렙 도달 시 11지역 "미지의 공간" → "꿈의 심해" 정식 공개 연출
   ============================================ */

import { navigate, Screen } from '../core/router.js';
import { STAGES, isStageUnlocked } from '../data/stages.js';
import { getCurrentLevel } from '../data/level-engine.js';
// ★ Day 25 Phase 3 — 권장 상상력 표시
import { getRecommendedImagination } from '../data/imagination.js';
import { saveLastSlotStageId, loadLastSlotStageId, addSeenStageId, getSeenStageIds } from '../core/storage.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SWIPE_THRESHOLD_PX = 50;     // 스와이프 임계값
const SWIPE_VELOCITY_MS  = 300;    // 빠른 스와이프 시간 한계

let state = null;

/* ============================================
   아이콘 SVG
   ============================================ */

function makeBackIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', 'M15 5 L8 12 L15 19');
  svg.appendChild(p);
  return svg;
}

function makeLockIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  // 자물쇠 본체 + 고리
  const body = document.createElementNS(SVG_NS, 'rect');
  body.setAttribute('x', '5');
  body.setAttribute('y', '11');
  body.setAttribute('width', '14');
  body.setAttribute('height', '10');
  body.setAttribute('rx', '1.5');
  const shackle = document.createElementNS(SVG_NS, 'path');
  shackle.setAttribute('d', 'M8 11 V8 a4 4 0 0 1 8 0 V11');
  svg.appendChild(shackle);
  svg.appendChild(body);
  return svg;
}

/* ============================================
   카드 렌더링 헬퍼
   ============================================ */

/**
 * 카드 1개 렌더 (전체 교체용 — 스와이프 후 호출).
 * @param {HTMLElement} cardEl - 컨테이너
 * @param {object} stage       - stages.js Stage
 * @param {boolean} unlocked
 */
function renderCard(cardEl, stage, unlocked) {
  // 11지역 + 잠금 = 검은 톤 + "미지의 공간" 위장 (대표 결정 — Q8)
  const isHidden11 = (stage.id === 11) && !unlocked;

  cardEl.dataset.stageId = String(stage.id);
  cardEl.dataset.unlocked = unlocked ? '1' : '0';
  cardEl.dataset.hidden11 = isHidden11 ? '1' : '0';
  cardEl.dataset.theme = stage.theme || '';

  cardEl.innerHTML = '';

  // 배경 그라데이션 (CSS 에서 data-stage-id 별로 분기 — placeholder)
  const bg = document.createElement('div');
  bg.className = 'stagemap-card__bg';
  cardEl.appendChild(bg);

  // 별빛 입자 (잔잔한 분위기 — 활성 카드만)
  if (unlocked && !isHidden11) {
    const stars = document.createElementNS(SVG_NS, 'svg');
    stars.setAttribute('class', 'stagemap-card__stars');
    stars.setAttribute('viewBox', '0 0 400 600');
    stars.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    const positions = [
      [40, 80], [120, 50], [200, 120], [310, 70], [360, 180],
      [60, 230], [150, 320], [280, 280], [340, 380],
      [80, 440], [220, 470], [360, 540],
    ];
    positions.forEach(([cx, cy], i) => {
      const star = document.createElementNS(SVG_NS, 'circle');
      star.setAttribute('cx', cx);
      star.setAttribute('cy', cy);
      star.setAttribute('r', i % 3 === 0 ? '1.6' : '1.0');
      star.setAttribute('class', `stagemap-card__star stagemap-card__star--${i % 4}`);
      stars.appendChild(star);
    });
    cardEl.appendChild(stars);
  }

  // 11지역 잠금 시 큰 자물쇠 + 보랏빛 안개
  if (isHidden11) {
    const veil = document.createElement('div');
    veil.className = 'stagemap-card__veil';
    cardEl.appendChild(veil);
    const bigLock = document.createElement('div');
    bigLock.className = 'stagemap-card__biglock';
    bigLock.appendChild(makeLockIcon());
    cardEl.appendChild(bigLock);
  } else if (!unlocked) {
    // 일반 잠금 — 회색 톤 (CSS에서 dim) + 큰 자물쇠
    const bigLock = document.createElement('div');
    bigLock.className = 'stagemap-card__biglock';
    bigLock.appendChild(makeLockIcon());
    cardEl.appendChild(bigLock);
  }

  // 본문 (이름 + 영문 + 소개)
  const body = document.createElement('div');
  body.className = 'stagemap-card__body';

  const nameEl = document.createElement('div');
  nameEl.className = 'stagemap-card__name';
  nameEl.textContent = isHidden11 ? '미지의 공간' : stage.name;

  const nameEnEl = document.createElement('div');
  nameEnEl.className = 'stagemap-card__name-en';
  nameEnEl.textContent = isHidden11 ? '— ? ? ? —' : stage.nameEn;

  const introEl = document.createElement('div');
  introEl.className = 'stagemap-card__intro';
  introEl.textContent = isHidden11
    ? '꿈의 끝에서 무언가가 기다리고 있다…'
    : (stage.intro || '');

  body.appendChild(nameEl);
  body.appendChild(nameEnEl);
  body.appendChild(introEl);

  // 요구 레벨 표시 (잠금일 때 강조)
  const req = document.createElement('div');
  req.className = 'stagemap-card__req';
  let reqLabelText = '';
  if (unlocked) {
    reqLabelText = `Lv. ${stage.requiredLevel} 이상`;
    req.classList.add('stagemap-card__req--unlocked');
  } else if (isHidden11) {
    reqLabelText = '만렙 도달 시 해제 (Lv. 50)';
    req.classList.add('stagemap-card__req--hidden11');
  } else {
    reqLabelText = `Lv. ${stage.requiredLevel} 도달 시 해제`;
    req.classList.add('stagemap-card__req--locked');
  }

  // 입장 레벨 라벨 (왼쪽)
  const reqLabel = document.createElement('span');
  reqLabel.className = 'stagemap-card__req-label';
  reqLabel.textContent = reqLabelText;
  req.appendChild(reqLabel);

  // ★ Day 25 Phase 3 (대표 명세 후속) — 권장 상상력 같은 행에 옆쪽 표시.
  //   잔존 임시값 (밸런스 미정밀): src/data/imagination.js RECOMMENDED_IMAGINATION 테이블.
  const recommended = getRecommendedImagination(stage.id);
  if (recommended > 0) {
    const rec = document.createElement('span');
    rec.className = 'stagemap-card__recommend';
    rec.textContent = `권장 상상력 ${recommended.toLocaleString()}`;
    req.appendChild(rec);
  }

  body.appendChild(req);

  cardEl.appendChild(body);
}

/**
 * 동그라미 헤더 1개 렌더.
 * @param {object} stage
 * @param {boolean} unlocked
 * @param {boolean} active   현재 선택
 * @param {boolean} seen     ★ Day 22 Phase 7 후속 — 사용자가 본 stage 여부 (false 면 빨간점)
 */
function renderDot(stage, unlocked, active, seen) {
  const dot = document.createElement('button');
  dot.type = 'button';
  dot.className = 'stagemap-dot';
  dot.dataset.stageId = String(stage.id);
  dot.dataset.unlocked = unlocked ? '1' : '0';
  if (active) dot.classList.add('stagemap-dot--active');
  if (!unlocked) dot.classList.add('stagemap-dot--locked');
  if (stage.id === 11) dot.classList.add('stagemap-dot--special');

  // 11지역 잠금 = 검은 톤 (.stagemap-dot--hidden11)
  if (stage.id === 11 && !unlocked) dot.classList.add('stagemap-dot--hidden11');

  // ★ Day 22 Phase 7 후속 (대표 결정): 잠금 해제 + 미관람 → 빨간점 (확인하면 자연 제거)
  if (unlocked && !seen) dot.classList.add('stagemap-dot--unseen');

  // 내용 — 활성/입장가능 = 지역 번호 / 잠금 = 자물쇠 아이콘
  if (!unlocked) {
    dot.appendChild(makeLockIcon());
  } else {
    const num = document.createElement('span');
    num.className = 'stagemap-dot__num';
    num.textContent = String(stage.id);
    dot.appendChild(num);
  }
  dot.setAttribute('aria-label', `${stage.id}지역${unlocked ? '' : ' (잠금)'}`);
  return dot;
}

/* ============================================
   화면 모듈
   ============================================ */

export default {
  /**
   * @param {HTMLElement} el
   * @param {{ stageId?: number }} [params] - 진입 시 표시할 stage (없으면 현재 레벨 최대 활성 지역)
   */
  mount(el, params = {}) {
    const currentLevel = getCurrentLevel();

    // 초기 인덱스 결정 (★ Day 22 Phase 7 후속 — 대표 결정)
    //   1) params.stageId 우선 (다른 화면에서 명시 전달)
    //   2) 없으면 — 마지막 본/진입 stage (loadLastSlotStageId — slot 진입 시 + stage-map 변경 시 저장)
    //   3) 그것도 없으면 — 입장 가능한 최고 stage
    //   4) 그것도 없으면 0 (1지역)
    let initialIndex = 0;
    if (params.stageId) {
      const idx = STAGES.findIndex(s => s.id === params.stageId);
      if (idx >= 0) initialIndex = idx;
    } else {
      // 1) 마지막 본/진입 stage 우선
      const lastStageId = loadLastSlotStageId();
      if (lastStageId !== null) {
        const lastIdx = STAGES.findIndex(s => s.id === lastStageId);
        if (lastIdx >= 0) {
          initialIndex = lastIdx;
        }
      }
      // 2) lastStageId 없거나 못 찾으면 — 입장 가능한 가장 큰 인덱스
      if (initialIndex === 0 && lastStageId === null) {
        for (let i = STAGES.length - 1; i >= 0; i--) {
          if (currentLevel >= STAGES[i].requiredLevel) {
            initialIndex = i;
            break;
          }
        }
      }
    }

    state = {
      currentIndex: initialIndex,
      level: currentLevel,
      disposers: [],
    };

    /* ── 루트 ── */
    const root = document.createElement('section');
    root.className = 'stagemap-screen';

    /* ── 1. 헤더 (뒤로 + 타이틀) ── */
    const header = document.createElement('div');
    header.className = 'stagemap-screen__header';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'stagemap-back';
    backBtn.setAttribute('aria-label', '뒤로');
    backBtn.appendChild(makeBackIcon());

    const title = document.createElement('div');
    title.className = 'stagemap-screen__title';
    title.textContent = 'MAP';

    // 헤더 우측 placeholder (좌우 균형용)
    const headerSpacer = document.createElement('div');
    headerSpacer.className = 'stagemap-screen__header-spacer';

    header.appendChild(backBtn);
    header.appendChild(title);
    header.appendChild(headerSpacer);

    /* ── 2. 동그라미 헤더 (5+5+1) ── */
    const dotsWrap = document.createElement('div');
    dotsWrap.className = 'stagemap-dots';

    // 상단 줄 (1~5)
    const rowTop = document.createElement('div');
    rowTop.className = 'stagemap-dots__row stagemap-dots__row--top';
    // 하단 줄 + 11지역 컬럼 (6~10 + 11)
    const rowBottom = document.createElement('div');
    rowBottom.className = 'stagemap-dots__row stagemap-dots__row--bottom';

    const dotElements = [];   // [el x 11]
    // ★ Day 22 Phase 7 후속 (대표 결정): mount 시점 seenStageIds 로 빨간점 표시
    //   syncTo 호출 시 현재 dot 의 unseen 클래스 제거 (addSeenStageId 후 시각 즉시 갱신).
    const seenIds = getSeenStageIds();
    STAGES.forEach((stage, idx) => {
      const unlocked = currentLevel >= stage.requiredLevel;
      const active = idx === initialIndex;
      const seen = seenIds.includes(stage.id);
      const dot = renderDot(stage, unlocked, active, seen);
      dot.addEventListener('click', () => goToIndex(idx));
      dotElements.push(dot);
      if (stage.id <= 5) {
        rowTop.appendChild(dot);
      } else {
        // 6~10지역 + 11지역 모두 하단 줄 같은 간격 (대표 결정 — 11지역도 동일 gap)
        rowBottom.appendChild(dot);
      }
    });

    dotsWrap.appendChild(rowTop);
    dotsWrap.appendChild(rowBottom);

    /* ── 3. 카드 영역 (스와이프) ── */
    const cardViewport = document.createElement('div');
    cardViewport.className = 'stagemap-card-viewport';

    const cardTrack = document.createElement('div');
    cardTrack.className = 'stagemap-card-track';

    // 카드 3장 (이전 / 현재 / 다음) 으로 viewport 안에 둠 (스와이프 부드럽게).
    // 단순화: 한 장만 두고 슬라이드 후 내용 교체 (성능/접근성 단순).
    const card = document.createElement('div');
    card.className = 'stagemap-card';
    cardTrack.appendChild(card);
    cardViewport.appendChild(cardTrack);

    // 스와이프 인디케이터 (좌/우 화살표 — 인접 지역 있을 때만 가시화)
    const arrowL = document.createElement('button');
    arrowL.type = 'button';
    arrowL.className = 'stagemap-arrow stagemap-arrow--left';
    arrowL.setAttribute('aria-label', '이전 지역');
    arrowL.innerHTML = '<span>‹</span>';

    const arrowR = document.createElement('button');
    arrowR.type = 'button';
    arrowR.className = 'stagemap-arrow stagemap-arrow--right';
    arrowR.setAttribute('aria-label', '다음 지역');
    arrowR.innerHTML = '<span>›</span>';

    cardViewport.appendChild(arrowL);
    cardViewport.appendChild(arrowR);

    /* ── 4. 입장 버튼 ── */
    const enterRow = document.createElement('div');
    enterRow.className = 'stagemap-enter-row';

    const enterBtn = document.createElement('button');
    enterBtn.type = 'button';
    enterBtn.className = 'stagemap-enter';
    enterBtn.textContent = '입장하기';
    enterRow.appendChild(enterBtn);

    /* ── 조립 ── */
    root.appendChild(header);
    root.appendChild(dotsWrap);
    root.appendChild(cardViewport);
    root.appendChild(enterRow);
    el.appendChild(root);

    /* ============================================
       동작 — 인덱스 변경 / 카드 갱신
       ============================================ */

    /** 현재 인덱스 변경 → 카드 + 동그라미 + 입장 버튼 동기. */
    function syncTo(idx, opts = {}) {
      const { direction = 0 } = opts;  // -1 = 왼쪽으로 슬라이드 / +1 = 오른쪽으로 / 0 = 즉시
      const clamped = Math.max(0, Math.min(STAGES.length - 1, idx));
      state.currentIndex = clamped;

      const stage = STAGES[clamped];
      const unlocked = currentLevel >= stage.requiredLevel;

      // ★ Day 22 Phase 7 후속 (대표 결정): stage 변경 시 마지막 본 stage 저장
      //   재접속 시 stage-map mount 에서 loadLastSlotStageId 로 복원 → 마지막 본 카드 자동 선택
      saveLastSlotStageId(stage.id);

      // ★ Day 22 Phase 7 후속 (5차 작업, 대표 결정): 본 stage 누적 저장 (햄버거 빨간점 제거용)
      //   "낚시터 새로 열림 → 햄버거 stage-map 항목에 빨간점 / 새 stage 카드 보면 사라짐" 흐름.
      //   잠금 여부 무관 누적 — hasUnseenStage 검사 시 잠금 해제 여부 적용.
      addSeenStageId(stage.id);

      // 동그라미 active 갱신
      dotElements.forEach((d, i) => {
        d.classList.toggle('stagemap-dot--active', i === clamped);
        // ★ Day 22 Phase 7 후속 (대표 결정): 사용자가 본 stage 의 dot 에서 빨간점 즉시 제거
        if (i === clamped) {
          d.classList.remove('stagemap-dot--unseen');
        }
      });

      // 카드 슬라이드 애니메이션 (direction !== 0 시)
      if (direction !== 0) {
        // 페이드/슬라이드 — 짧게 (180ms)
        cardTrack.classList.remove('stagemap-card-track--slide-in-left', 'stagemap-card-track--slide-in-right');
        cardTrack.classList.add(direction > 0
          ? 'stagemap-card-track--slide-out-left'
          : 'stagemap-card-track--slide-out-right');

        setTimeout(() => {
          renderCard(card, stage, unlocked);
          cardTrack.classList.remove('stagemap-card-track--slide-out-left', 'stagemap-card-track--slide-out-right');
          cardTrack.classList.add(direction > 0
            ? 'stagemap-card-track--slide-in-right'
            : 'stagemap-card-track--slide-in-left');
          // 인접 가능 화살표 / 입장 버튼 갱신
          updateArrowsAndEnter(clamped, unlocked, stage);
          setTimeout(() => {
            cardTrack.classList.remove('stagemap-card-track--slide-in-left', 'stagemap-card-track--slide-in-right');
          }, 220);
        }, 160);
      } else {
        renderCard(card, stage, unlocked);
        updateArrowsAndEnter(clamped, unlocked, stage);
      }
    }

    /** 좌/우 화살표 가시화 + 입장 버튼 상태 갱신. */
    function updateArrowsAndEnter(idx, unlocked, stage) {
      arrowL.classList.toggle('stagemap-arrow--hidden', idx <= 0);
      arrowR.classList.toggle('stagemap-arrow--hidden', idx >= STAGES.length - 1);

      // 입장 버튼: 잠금 = 비활성, 활성 = 입장 가능
      enterBtn.disabled = !unlocked;
      enterBtn.classList.toggle('stagemap-enter--locked', !unlocked);
      if (unlocked) {
        enterBtn.textContent = '입장하기';
      } else if (stage.id === 11) {
        enterBtn.textContent = '봉인됨';
      } else {
        enterBtn.textContent = '잠금';
      }
    }

    /** 지정 인덱스로 점프 (동그라미 클릭 시). */
    function goToIndex(idx) {
      if (idx === state.currentIndex) return;
      const dir = idx > state.currentIndex ? +1 : -1;
      syncTo(idx, { direction: dir });
    }

    /** 인접 이동 (스와이프 / 화살표). */
    function moveBy(delta) {
      const next = state.currentIndex + delta;
      if (next < 0 || next >= STAGES.length) return;
      syncTo(next, { direction: delta > 0 ? +1 : -1 });
    }

    /* ============================================
       스와이프 (Pointer Events)
       ============================================ */
    let pointerActive = false;
    let pointerStartX = 0;
    let pointerStartY = 0;
    let pointerStartT = 0;
    let isHorizontalGesture = false;

    function onPointerDown(e) {
      // 좌클릭/터치만
      if (e.button !== undefined && e.button !== 0) return;
      pointerActive = true;
      pointerStartX = e.clientX;
      pointerStartY = e.clientY;
      pointerStartT = Date.now();
      isHorizontalGesture = false;
      // viewport 가 capture (스크롤 충돌 방지)
      try { cardViewport.setPointerCapture(e.pointerId); } catch (_) {}
    }

    function onPointerMove(e) {
      if (!pointerActive) return;
      const dx = e.clientX - pointerStartX;
      const dy = e.clientY - pointerStartY;
      // 가로 의도 확정 (가로 우세)
      if (!isHorizontalGesture && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        isHorizontalGesture = Math.abs(dx) > Math.abs(dy);
      }
      // 가로 드래그면 카드 살짝 따라가기 (시각 피드백)
      if (isHorizontalGesture) {
        e.preventDefault();
        cardTrack.style.transform = `translateX(${dx * 0.4}px)`;
        cardTrack.style.transition = 'none';
      }
    }

    function onPointerUp(e) {
      if (!pointerActive) return;
      pointerActive = false;
      const dx = e.clientX - pointerStartX;
      const dt = Date.now() - pointerStartT;

      // transform 복귀
      cardTrack.style.transform = '';
      cardTrack.style.transition = '';

      if (!isHorizontalGesture) return;
      // 임계값 또는 빠른 스와이프 → 인접 이동
      const isFastSwipe = (Math.abs(dx) > 30) && (dt < SWIPE_VELOCITY_MS);
      if (Math.abs(dx) >= SWIPE_THRESHOLD_PX || isFastSwipe) {
        // dx > 0 (오른쪽으로 드래그) = 이전 지역(왼쪽 인덱스)
        moveBy(dx > 0 ? -1 : +1);
      }
    }

    function onPointerCancel() {
      pointerActive = false;
      isHorizontalGesture = false;
      cardTrack.style.transform = '';
      cardTrack.style.transition = '';
    }

    cardViewport.addEventListener('pointerdown', onPointerDown);
    cardViewport.addEventListener('pointermove', onPointerMove);
    cardViewport.addEventListener('pointerup', onPointerUp);
    cardViewport.addEventListener('pointercancel', onPointerCancel);
    cardViewport.addEventListener('pointerleave', onPointerCancel);

    state.disposers.push(() => {
      cardViewport.removeEventListener('pointerdown', onPointerDown);
      cardViewport.removeEventListener('pointermove', onPointerMove);
      cardViewport.removeEventListener('pointerup', onPointerUp);
      cardViewport.removeEventListener('pointercancel', onPointerCancel);
      cardViewport.removeEventListener('pointerleave', onPointerCancel);
    });

    /* ============================================
       이벤트 — 뒤로 / 화살표 / 입장
       ============================================ */
    backBtn.addEventListener('click', () => navigate(Screen.SLOT));
    arrowL.addEventListener('click', () => moveBy(-1));
    arrowR.addEventListener('click', () => moveBy(+1));

    // ★ 대표 결정 — 화살표 버튼 터치 시 swipe 감지 충돌 막아 click 정상 작동.
    //   cardViewport 의 pointerdown 으로 전파되면 setPointerCapture 가 걸려
    //   click 이벤트가 발생 안 함 → stopPropagation 으로 차단.
    const arrowStop = (e) => e.stopPropagation();
    arrowL.addEventListener('pointerdown', arrowStop);
    arrowR.addEventListener('pointerdown', arrowStop);

    enterBtn.addEventListener('click', () => {
      const stage = STAGES[state.currentIndex];
      if (!isStageUnlocked(stage.id, currentLevel)) return;
      // 슬롯 화면으로 stageId 전달
      navigate(Screen.SLOT, { stageId: stage.id });
    });

    state.disposers.push(() => {
      backBtn.removeEventListener('click', () => {});
      arrowL.removeEventListener('click', () => {});
      arrowR.removeEventListener('click', () => {});
      enterBtn.removeEventListener('click', () => {});
    });

    /* ── 초기 카드 렌더 ── */
    syncTo(initialIndex, { direction: 0 });
  },

  unmount() {
    if (state?.disposers) {
      for (const d of state.disposers) {
        try { d(); } catch (_) {}
      }
    }
    state = null;
  },
};