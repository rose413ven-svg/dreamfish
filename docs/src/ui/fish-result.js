/* ===========================================
   fish-result.js — 물고기 결과 팝업
   ============================================
   - 슬롯 위치에서 점점 커짐
   - 박스/배경 투명, 뒷화면 강한 블러
   - 잡힘 (caught): 검은 그림자 → 진짜 물고기 변신, 등급 영문 라벨, 무게
   - 놓침 (missed): 그림자 유지(등급 색 글로우), "MISSED" 빨간 라벨, 무게 X
   - 확인 버튼 X — 화면 어디 터치하면 닫힘 (페이드인 끝난 즉시 받음)

   Lucky-3 (Day 9) — 장비 드롭 흐름 분기 추가
   ───────────────────────────────────────────
   showFishResult(el, data) 의 data 에 dropPayload 가 있으면 드롭 흐름.
   dropPayload:
     { bagFull: false, catalogId, slotId, grade, name, slotName }
     또는 { bagFull: true }

   state machine (data-drop-phase):
     '' (초기, dropPayload X): 어디든 터치 → 종료
     '' (초기, dropPayload O): 어디든 터치 → 'drop-show-star' 또는 'drop-bagfull'
     'drop-show-star':  별 + "터치해서 확인해보자". 물고기 영역 터치만 → 'drop-tension'
     'drop-tension':    긴장감 효과 진행. 클릭 무시. ~1초 후 자동 → 'drop-equip'
     'drop-equip':      장비 등장. 어디든 터치 → 종료
     'drop-bagfull':    "가방이 가득 찼습니다". 어디든 터치 → 종료
   ============================================ */

import { renderFishSVG } from './fish-svg.js';
import { formatWeight } from '../engine/weight.js';
import { createGearIcon } from './gear-icons.js';
import { GEAR_GRADES } from '../data/gear-grades.js';
// Day 19 — 별빛 반짝 효과 (멀티힛 / 골든힛 케이스에만 CSS 토글로 표시)
import { createSparkleStars } from './sparkle-stars.js';
// Day 16 — 도감 자동 등록 + NEW 뿅 효과
import { registerFishCatch } from '../data/codex-engine.js';
// ★ Day 26 — 가방 빈칸 경고 (대표 결정) — 빈칸 1~5 면 하단 경고 표시
import { getFreeSlots } from '../data/inventory.js';
import { loadInventory } from '../core/storage.js';

// ★ Day 26 (대표 결정) — 가방 빈칸 경고 threshold
const BAG_WARN_THRESHOLD = 5;

const REVEAL_DELAY = {
  '치어':     200,   // Day 15: 소형보다 약간 짧게
  '소형':     300,
  '중형':     500,
  '월척':     800,
  '대물':     1000,  // Day 15: 월척보다 약간 길게
  '보스':    1200,
  '전설보스': 1600,
  '신화보스': 2000,  // Day 16 신규
};

const GRADE_EN = {
  '치어':     'TINY',
  '소형':     'SMALL',
  '중형':     'MEDIUM',
  '월척':     'BIG',
  '대물':     'HUGE',
  '보스':     'BOSS',
  '전설보스': 'LEGEND',  // Day 15: LEGEND BOSS → LEGEND (대표 결정)
  '신화보스': 'MYTHIC',  // Day 16 신규
};

/**
 * ★ Day 27 — 어종 id에서 변종 정보 추출 (fish-data.js getFishMeta 의 inline 버전).
 *   import 의존성 줄이기 위해 자체 정의. 패턴: `<grade>_<tier>_<index>`
 *   - 'tiny_p3_02' → { plusCount: 3 }
 *   - 'mythic_01' / 'hidden_01' / 'golden_01' → { plusCount: 0 } (변종 없음)
 *
 * @param {string} fishId
 * @returns {{ plusCount: number }}
 */
function getFishPlusCount(fishId) {
  if (!fishId) return { plusCount: 0 };
  const m = fishId.match(/^(?:tiny|sml|med|big|huge|boss|legend)_(base|p1|p2|p3|p4|p5)_/);
  if (!m) return { plusCount: 0 };
  const tier = m[1];
  return { plusCount: tier === 'base' ? 0 : Number(tier.slice(1)) };
}

/**
 * ★ Day 27 — 등급 영문명 + 변종 + 표시.
 *   - 일반 매칭: fish.id에서 변종 추출 (예: tiny_p3_02 → 'TINY+++')
 *   - 골든힛: goldenHitInfo.plusCount 사용 (예: 보스++ → 'BOSS++')
 *   - 신화/히든/황금어: 변종 없음 (그대로)
 *
 * @param {object} fish               result.fish (id 포함)
 * @param {string} grade              한국어 등급 (base, 변종 X)
 * @param {object|null} goldenHitInfo result.goldenHitInfo (골든힛 시 plusCount 포함)
 * @returns {string}
 */
function gradeEnDisplay(fish, grade, goldenHitInfo) {
  const baseEn = GRADE_EN[grade] ?? '';
  if (!baseEn) return '';
  // 골든힛 우선 (변종 정보가 goldenHitInfo에 있음)
  if (goldenHitInfo && typeof goldenHitInfo.plusCount === 'number') {
    return baseEn + '+'.repeat(goldenHitInfo.plusCount);
  }
  // 일반 매칭: fish.id에서 변종 추출
  const { plusCount } = getFishPlusCount(fish?.id);
  return baseEn + '+'.repeat(plusCount);
}

/** 다중매칭 배수 라벨 (Day 4) */
const MULTI_HIT_LABEL = {
  2: 'DOUBLE HIT',
  3: 'TRIPLE HIT',
  4: 'QUAD HIT',
  5: 'PENTA HIT',
};

function multiHitLabelOf(n) {
  if (n >= 6) return 'MEGA HIT';
  return MULTI_HIT_LABEL[n] || null;
}

/* ============================================
   ★ Day 29 v3 — 변종 등급 펑 연출 (대표 결정)
   ============================================
   기존 (v1/v2): Lucky Lucky 텍스트 overlay 별도 element
   신규 (v3): Lucky Lucky 텍스트 폐기. 변종 등급 텍스트(mainEl) 자체에 펑 연출.

   흐름:
   1. 결과팝업 등장 후 INITIAL_DELAY (500ms) 대기
   2. popStep(0): base 등급("TINY") 펑 등장 (scale 0.3 → 1.4 → 1)
   3. POP_HOLD (600ms) 유지 후 fadeStep: 기존 등급 사라짐 (scale 1 → 0.6, opacity 1 → 0)
   4. popStep(1): "TINY+" 펑 등장
   5. ... 반복 (plusCount 까지) ...
   6. 마지막 단계 도달 후 그대로 유지 (forwards)

   슬롯 럭키럭키 텍스트와 헷갈리지 않도록 결과팝업에는 Lucky 텍스트 X.
   ============================================ */

const POP_INITIAL_DELAY    = 500;    // 결과팝업 등장 후 base 등급 페이드인 시작까지
const BASE_FADE_IN_MS      = 300;    // ★ Day 30 — base 첫 등급 부드러운 페이드인 (펑 X, 깜박 X)
const BASE_HOLD_MS         = 500;    // ★ Day 30 — base 페이드인 후 다음 단계까지 유지
const SIZE_UPGRADE_HOLD_MS = 800;    // ★ Day 30 — 1단+ 펑 + 배지 표시 유지 (단계 사이 텀 완화)
const FADE_OUT_MS          = 200;    // fade out duration
const POP_DURATION_MS      = 500;    // 펑 animation duration (CSS keyframes 와 일치)
const BADGE_DURATION_MS    = 500;    // SIZE UPGRADE 배지 펑 animation 길이 (CSS 와 일치)

/**
 * 변종 등급 펑 연쇄 — base 등급부터 변종 단계까지 mainEl 텍스트 교체하며 연출.
 *
 * ★ Day 29 v4 — onComplete 콜백 추가: 마지막 단계 완료 후 호출 (산식/무게 표시 트리거).
 *
 * ★ Day 30 (대표 결정) — 흐름 재설계:
 *   - step 0 (base, 예: 'TINY'): 부드러운 페이드인 0.3초 (펑 X, 깜박임 X — grade-fade-in 클래스).
 *   - step 1+ : 등급 텍스트 펑 (grade-pop) + SIZE UPGRADE 배지 동시 등장.
 *     · 1단 = 'SIZE UPGRADE' / 2단 = 'X2' / 3단 = 'X3' / 4단 = 'X4' / 5단 = 'X5'
 *     · 등급 텍스트 단계별 크기: 3.2 / 3.4 / 3.6 / 3.7 / 3.8 / 4.2 rem (data-upgrade-step="N")
 *     · 색은 등급 본래 색 유지 + 글로우만 단계별 강화 (CSS currentColor)
 *
 * 멱등성: 동일 결과팝업 재호출 시 이전 연쇄 자동 중단 (el._stopVariantLuckyChain).
 *
 * @param {HTMLElement} el            fish-result 루트
 * @param {HTMLElement} mainEl        등급 텍스트 element (.fish-result__grade-main)
 * @param {string}      baseEnGrade   base 등급 영문 (예: 'TINY')
 * @param {number}      plusCount     0~5 (0=base 만 / 1+=base 후 SIZE UPGRADE 연쇄)
 * @param {Function}    [onComplete]  마지막 단계 완료 후 콜백 (대표 결정 — 산식/무게 표시 트리거)
 */
function startVariantLuckyChain(el, mainEl, baseEnGrade, plusCount, onComplete) {
  // 이전 연쇄 중단 (멱등성)
  if (el._stopVariantLuckyChain) el._stopVariantLuckyChain();

  // ★ Day 39 (대표 결정) — base 등급 텍스트 *진짜* 근본 원인 수정 (연속힛 깜빡임).
  //   원인: 직전 _stopVariantLuckyChain 이 grade-pending 까지 제거 → mainEl.opacity 기본값 1.
  //         호출부에서 grade-pending 추가했더라도 위 줄에서 즉시 무력화.
  //         → .show 추가 시 텍스트가 opacity:1 로 즉시 노출 → 깜빡 → 그 후 fadeInBase 가
  //           POP_INITIAL_DELAY (500ms) 뒤에야 opacity:0 으로 다시 숨겼다 페이드인.
  //   첫 힛 OK / 연속힛 깜빡 패턴 정확히 이 흐름과 일치 (첫 힛은 _stopVariantLuckyChain 미정의).
  //   변경: _stopVariantLuckyChain 직후 grade-pending + dataset.upgradeStep='0' 즉시 복구.
  //         이전 forwards animation 잔존(.grade-pop/.grade-fade-in)은 _stopVariantLuckyChain
  //         이 이미 깨끗하게 정리하므로 grade-pending 의 opacity:0 이 확실히 적용됨.
  mainEl.classList.add('grade-pending');
  mainEl.dataset.upgradeStep = '0';

  const timers = [];
  let cancelled = false;

  /** ★ Day 30 — SIZE UPGRADE 배지 표시 헬퍼.
   *  ★ Day 38 후속 (대표 결정):
   *    - [5] 2단+ 텍스트 'X2' → 'SIZE UPGRADE ×2' 풀텍스트로 통일.
   *    - [4] isLast=true 시 자동 제거 timeout 등록 X (마지막 배지는 팝업 닫힐 때까지 유지).
   */
  const showSizeUpgradeBadge = (step, isLast = false) => {
    if (cancelled) return;
    const gradeBox = el.querySelector('.fish-result__grade');
    if (!gradeBox) return;
    // 기존 배지 제거 (다음 단계 연쇄 시 잔존 방지)
    gradeBox.querySelectorAll('.fish-result__size-upgrade').forEach(b => b.remove());
    const badge = document.createElement('div');
    badge.className = 'fish-result__size-upgrade';
    // ★ Day 38 후속 [5] — 1단 'SIZE UPGRADE' / 2단+ 'SIZE UPGRADE ×N' 풀텍스트
    badge.textContent = step === 1 ? 'SIZE UPGRADE' : `SIZE UPGRADE ×${step}`;
    gradeBox.appendChild(badge);
    // ★ Day 38 후속 [4] — 마지막 단계 배지는 자동 제거 X (팝업 닫힐 때까지 유지)
    if (!isLast) {
      timers.push(setTimeout(() => badge.remove(), SIZE_UPGRADE_HOLD_MS));
    }
  };

  el._stopVariantLuckyChain = () => {
    cancelled = true;
    timers.forEach(id => clearTimeout(id));
    mainEl.classList.remove('grade-pending', 'grade-pop', 'grade-fade-out', 'grade-fade-in');
    delete mainEl.dataset.upgradeStep;
    el.querySelectorAll('.fish-result__size-upgrade').forEach(b => b.remove());
  };

  /** ★ Day 30 — base 등급 페이드인 (펑 X, 깜박 X).
   *  ★ Day 38 후속 (대표 결정 — [2] 깜빡임 수정):
   *    기존: textContent 교체 → remove(...) → reflow → add('grade-fade-in') 순서.
   *    문제: grade-pending 이 호출부에서 명시적으로 부여되지 않은 케이스 (예: 이전 결과 잔존)
   *          + reflow 사이에 한 프레임 텍스트 노출 → 간헐적 깜빡임.
   *    변경:
   *      1) 모든 호출에서 grade-pending 강제 부여 (opacity:0 보장).
   *      2) animation 시작 직후 다음 프레임에서 grade-pending 제거 (덮어쓰기 충돌 방지).
   *      3) textContent 교체는 grade-pending 이 active 인 상태에서만 (안 보이는 동안).
   */
  const fadeInBase = () => {
    if (cancelled) return;
    // [2] grade-pending 강제 (opacity 0 보장) — 텍스트 교체가 안 보이는 상태에서 일어나도록
    mainEl.classList.add('grade-pending');
    mainEl.classList.remove('grade-pop', 'grade-fade-out', 'grade-fade-in');
    mainEl.textContent = baseEnGrade;
    mainEl.dataset.upgradeStep = '0';
    void mainEl.offsetWidth;  // reflow
    mainEl.classList.add('grade-fade-in');
    // animation 시작 후 다음 프레임에서 grade-pending 제거
    //   (남겨두면 opacity:0 이 grade-fade-in animation 과 충돌해 일부 브라우저에서 깜빡 가능)
    requestAnimationFrame(() => {
      if (cancelled) return;
      mainEl.classList.remove('grade-pending');
    });
  };

  /** 1단+ 펑 등장 — 텍스트 교체 + grade-pop animation + SIZE UPGRADE 배지.
   *  ★ Day 38 후속 — isLast 전달: 마지막 step 의 배지는 자동 제거 X. */
  const popStep = (step, isLast = false) => {
    if (cancelled) return;
    mainEl.textContent = baseEnGrade + '+'.repeat(step);
    mainEl.classList.remove('grade-pending', 'grade-fade-out', 'grade-pop', 'grade-fade-in');
    mainEl.dataset.upgradeStep = String(step);
    void mainEl.offsetWidth;
    mainEl.classList.add('grade-pop');
    // 동시 등장 — SIZE UPGRADE 배지 (마지막 단계면 자동 제거 X)
    showSizeUpgradeBadge(step, isLast);
  };

  /** fade out — 다음 단계로 가기 직전 텍스트 사라짐 */
  const fadeOutStep = () => {
    if (cancelled) return;
    mainEl.classList.remove('grade-pop', 'grade-fade-in');
    void mainEl.offsetWidth;
    mainEl.classList.add('grade-fade-out');
  };

  /** 단계 N 진행 */
  const runStep = (step) => {
    if (cancelled) return;

    if (step === 0) {
      // ★ Day 30 — base 등급은 펑 X, 페이드인만
      fadeInBase();
      if (plusCount === 0) {
        // base 만 (변종 없음) — 페이드인 끝나면 onComplete
        timers.push(setTimeout(() => {
          if (cancelled) return;
          onComplete?.();
        }, BASE_FADE_IN_MS + BASE_HOLD_MS));
        return;
      }
      // base 페이드인 → 잠시 유지 → fade out → 1단 시작
      timers.push(setTimeout(() => {
        if (cancelled) return;
        fadeOutStep();
        timers.push(setTimeout(() => {
          runStep(step + 1);
        }, FADE_OUT_MS));
      }, BASE_FADE_IN_MS + BASE_HOLD_MS));
      return;
    }

    // step 1+ — 펑 + SIZE UPGRADE 배지
    // ★ Day 38 후속 [4] — 마지막 단계면 isLast=true → 배지 자동 제거 X
    const isLast = (step >= plusCount);
    popStep(step, isLast);

    // 마지막 단계 — 펑 끝나면 onComplete (산식/무게 표시)
    if (isLast) {
      timers.push(setTimeout(() => {
        if (cancelled) return;
        onComplete?.();
      }, POP_DURATION_MS));
      return;
    }

    // SIZE_UPGRADE_HOLD 후 fade out → FADE_OUT 후 다음 단계
    timers.push(setTimeout(() => {
      if (cancelled) return;
      fadeOutStep();
      timers.push(setTimeout(() => {
        runStep(step + 1);
      }, FADE_OUT_MS));
    }, SIZE_UPGRADE_HOLD_MS));
  };

  // 결과팝업 등장 후 잠시 뒤 base 페이드인 시작
  timers.push(setTimeout(() => runStep(0), POP_INITIAL_DELAY));
}

const SCALE_MAP = {
  '치어':     0.7,   // Day 15: 소형보다 작게
  '소형':     0.9,
  '중형':     1.4,
  '월척':     2.0,
  '대물':     2.4,   // Day 15: 월척과 보스 사이
  '보스':     2.7,
  '전설보스': 3.4,
  '신화보스': 3.8,   // Day 16 신규
};

/* ─── Lucky-3: 장비 등급 영문 + 긴장감 색 분기 ─── */
const EQUIP_GRADE_EN = Object.freeze({
  common:    'COMMON',
  uncommon:  'UNCOMMON',
  rare:      'RARE',
  epic:      'EPIC',
  legendary: 'LEGENDARY',
  mythic:    'MYTHIC',
});

/** Day 9 결정: 일반/고급 = 황금빛, 희귀+ = 빨간빛 (긴장감 단계 색) */
const TENSION_COLOR_BY_EQUIP_GRADE = Object.freeze({
  common:    'gold',
  uncommon:  'gold',
  rare:      'red',
  epic:      'red',
  legendary: 'red',
  mythic:    'red',
});

/** 긴장감 효과 지속 시간 (drop-tension → drop-equip 자동 전이) */
const TENSION_DURATION_MS = 1000;

/* 페이드인 시간 — 페이드인 끝난 즉시 터치 받음 */
const POPUP_FADE_IN_MS = 1000;

export function createFishResult({ onConfirm, onAccumulate }) {
  const el = document.createElement('div');
  el.className = 'fish-result';
  // ★ Day 40 (대표 결정) — 결과팝업을 카드 형태로 변경 + 카드 안 별빛 입자 (stagemap-card 와 동일 시각).
  //   12개 circle 좌표 / r 값 / 4단계 색·delay 모두 stage-map.js 와 동일 (별 크기 픽셀 단위까지 일치하도록
  //   카드 max-width: 22rem + SVG viewBox 0 0 400 600 + preserveAspectRatio xMidYMid slice 사용).
  const STAR_POSITIONS = [
    [40, 80], [120, 50], [200, 120], [310, 70], [360, 180],
    [60, 230], [150, 320], [280, 280], [340, 380],
    [80, 440], [220, 470], [360, 540],
  ];
  const starsSvg = STAR_POSITIONS.map(([cx, cy], i) =>
    `<circle cx="${cx}" cy="${cy}" r="${i % 3 === 0 ? 1.6 : 1.0}" class="fish-result__star fish-result__star--${i % 4}"/>`
  ).join('');
  el.innerHTML = `
    <div class="fish-result__backdrop"></div>
    <div class="fish-result__panel">
      <svg class="fish-result__stars" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${starsSvg}</svg>
      <div class="fish-result__grade">
        <div class="fish-result__grade-main"></div>
        <div class="fish-result__grade-sub"></div>
      </div>
      <div class="fish-result__fish">
        <div class="fish-result__shadow"></div>
        <div class="fish-result__real"></div>
        <!-- ★ Day 25: 드롭 별 컨테이너 — JS 가 아이템 수만큼 .fish-result__drop-star 동적 생성 -->
        <div class="fish-result__drop-stars" aria-hidden="true"></div>
        <!-- Lucky-4: 별 파티클 흩날림 (8개, drop-tension 단계에서 흩어짐) -->
        <div class="fish-result__drop-particles" aria-hidden="true">
          <span class="fish-result__drop-particle"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L14.39 9.26 L22 9.27 L15.8 13.97 L18.2 21.23 L12 16.77 L5.8 21.23 L8.2 13.97 L2 9.27 L9.61 9.26 Z" fill="currentColor"/></svg></span>
          <span class="fish-result__drop-particle"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L14.39 9.26 L22 9.27 L15.8 13.97 L18.2 21.23 L12 16.77 L5.8 21.23 L8.2 13.97 L2 9.27 L9.61 9.26 Z" fill="currentColor"/></svg></span>
          <span class="fish-result__drop-particle"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L14.39 9.26 L22 9.27 L15.8 13.97 L18.2 21.23 L12 16.77 L5.8 21.23 L8.2 13.97 L2 9.27 L9.61 9.26 Z" fill="currentColor"/></svg></span>
          <span class="fish-result__drop-particle"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L14.39 9.26 L22 9.27 L15.8 13.97 L18.2 21.23 L12 16.77 L5.8 21.23 L8.2 13.97 L2 9.27 L9.61 9.26 Z" fill="currentColor"/></svg></span>
          <span class="fish-result__drop-particle"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L14.39 9.26 L22 9.27 L15.8 13.97 L18.2 21.23 L12 16.77 L5.8 21.23 L8.2 13.97 L2 9.27 L9.61 9.26 Z" fill="currentColor"/></svg></span>
          <span class="fish-result__drop-particle"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L14.39 9.26 L22 9.27 L15.8 13.97 L18.2 21.23 L12 16.77 L5.8 21.23 L8.2 13.97 L2 9.27 L9.61 9.26 Z" fill="currentColor"/></svg></span>
          <span class="fish-result__drop-particle"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L14.39 9.26 L22 9.27 L15.8 13.97 L18.2 21.23 L12 16.77 L5.8 21.23 L8.2 13.97 L2 9.27 L9.61 9.26 Z" fill="currentColor"/></svg></span>
          <span class="fish-result__drop-particle"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L14.39 9.26 L22 9.27 L15.8 13.97 L18.2 21.23 L12 16.77 L5.8 21.23 L8.2 13.97 L2 9.27 L9.61 9.26 Z" fill="currentColor"/></svg></span>
        </div>
        <!-- Lucky-3: 장비 등장 영역 -->
        <div class="fish-result__drop-equip">
          <div class="fish-result__drop-equip-icon"></div>
          <div class="fish-result__drop-equip-name"></div>
          <div class="fish-result__drop-equip-grade-en"></div>
        </div>
      </div>
      <div class="fish-result__name"></div>
      <div class="fish-result__weight">
        <div class="fish-result__weight-breakdown"></div>
        <div class="fish-result__weight-final"></div>
      </div>
      <!-- Lucky-3: 드롭 메시지 (panel 가장 아래) -->
      <div class="fish-result__drop-message"></div>
      <!-- ★ Day 26 — 인벤토리 빈칸 경고 (빈칸 1~5 일 때 표시, 대표 결정) -->
      <div class="fish-result__bag-warn"></div>
    </div>
  `;

  // Day 19 v2 — 결과 팝업 등급 영역에 별빛 반짝 효과 부착 (레벨업 팝업과 1:1 동일 효과).
  //   CSS 가 [data-multihit] 또는 [data-golden-hit="true"] 일 때만 display:block 으로 표시
  //   (단일 일반 등급은 등급 색이 메인 임팩트라 반짝 X — 대표 결정).
  //   prepend = 첫 자식으로 → 텍스트 뒤로 깔림 (레벨업 팝업의 stars 패턴과 동일).
  const gradeBox = el.querySelector('.fish-result__grade');
  if (gradeBox) gradeBox.prepend(createSparkleStars());

  // closure 인스턴스 변수
  let dropPayloadRef = null;
  let tensionTimer = null;
  // Lucky-5: 합산 1회 가드 — 한 결과팝업에서 onAccumulate 한 번만 호출
  let accumulated = false;
  const tryAccumulate = () => {
    if (accumulated) return;
    accumulated = true;
    onAccumulate?.();
  };

  /** Lucky-3: 단계별 클릭 핸들러 (state machine) */
  el._onClickAnywhere = (e) => {
    if (el.dataset.locked === 'true') return;
    if (!el.classList.contains('show')) return;

    const phase = el.dataset.dropPhase || '';
    const drop  = dropPayloadRef;

    // 드롭 X — 어디든 터치 → 합산(첫 터치 = 종료) + 종료
    if (!drop) {
      tryAccumulate();          // Lucky-5: 합산
      el.dataset.locked = 'true';
      hide(el);
      setTimeout(() => onConfirm?.(), 200);
      return;
    }

    // 첫 단계 — 합산(첫 터치) + 별/메시지 또는 가방 가득 메시지로 전이
    if (phase === '') {
      tryAccumulate();          // Lucky-5: 첫 터치에 합산
      const msgEl = el.querySelector('.fish-result__drop-message');
      if (drop.bagFull) {
        el.dataset.dropPhase = 'drop-bagfull';
        // ★ Day 26 (대표 결정) — 가방 가득 시 메시지 변경
        msgEl.innerHTML = '인벤토리가 가득 차서 장비를 획득할 수 없습니다';
      } else {
        el.dataset.dropPhase = 'drop-show-star';
        msgEl.innerHTML =
          '<div>물고기에서 뭔가 반짝거린다.</div>' +
          '<div class="fish-result__drop-message-hint">터치해서 확인해보자</div>';
      }
      return;
    }

    // 별/메시지 단계 — ★ Day 26 (대표 결정): 물고기 영역만 아니라 어디든 터치 → 다음 단계.
    if (phase === 'drop-show-star') {
      el.dataset.dropPhase = 'drop-tension';
      if (tensionTimer) clearTimeout(tensionTimer);
      tensionTimer = setTimeout(() => {
        tensionTimer = null;
        // 장비 정보는 등장 직전에 채워야 pop 애니메이션 명확
        populateDropEquip(el, drop);
        el.dataset.dropPhase = 'drop-equip';
        const msgEl = el.querySelector('.fish-result__drop-message');
        if (msgEl) msgEl.innerHTML = '인벤토리를 확인해보세요';
      }, TENSION_DURATION_MS);
      return;
    }

    // 긴장감 진행 중 — 클릭 무시
    if (phase === 'drop-tension') return;

    // 장비 등장 단계 또는 가방 가득 단계 — 어디든 터치 → 종료
    if (phase === 'drop-equip' || phase === 'drop-bagfull') {
      el.dataset.locked = 'true';
      hide(el);
      setTimeout(() => onConfirm?.(), 200);
      return;
    }
  };
  el.addEventListener('click', el._onClickAnywhere);

  // showFishResult 가 갱신할 수 있도록 setter 노출
  el._setDropPayload = (p) => { dropPayloadRef = p || null; };
  el._clearTensionTimer = () => {
    if (tensionTimer) {
      clearTimeout(tensionTimer);
      tensionTimer = null;
    }
  };
  // Lucky-5: 합산 가드 리셋 (showFishResult 마다 새 결과이므로)
  el._resetAccumulated = () => { accumulated = false; };

  return el;
}

/** Lucky-3: 장비 등장 영역 채우기 (drop-equip phase 진입 직전 호출) */
function populateDropEquip(el, drop) {
  const iconBox   = el.querySelector('.fish-result__drop-equip-icon');
  const nameEl    = el.querySelector('.fish-result__drop-equip-name');
  const gradeEnEl = el.querySelector('.fish-result__drop-equip-grade-en');

  iconBox.innerHTML = '';

  // ★ Day 25 — 복수 아이템 처리
  const items = drop.items ?? [drop];  // 구형 단일 payload 하위 호환

  // ★ Day 25 후속 (대표 결정) — 1개·복수 무관: 장비 이름 + 등급 영문 텍스트 항상 비움 (셀만 표시).
  nameEl.textContent    = '';
  gradeEnEl.textContent = '';

  if (items.length === 1) {
    // ── 1개: 기존 큰 아이콘 셀 (5.2rem) 그대로, 텍스트 영역만 비움 ──
    const item = items[0];
    try {
      const svg = createGearIcon(item.slotId, item.grade);
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      iconBox.appendChild(svg);
    } catch (e) {
      console.warn('[fish-result] gear icon 실패:', item.slotId);
    }

    const gradeColor = GEAR_GRADES[item.grade]?.color || '#ffffff';
    el.style.setProperty('--drop-equip-color', gradeColor);
    iconBox.classList.remove('fish-result__drop-equip-icon--multi');
  } else {
    // ── 2~5개: 아이콘 가로 배열 (단일 셀과 동일 크기 — CSS 자동 처리) ──
    iconBox.classList.add('fish-result__drop-equip-icon--multi');
    iconBox.style.setProperty('--drop-item-count', String(items.length));

    // 최고 등급 색을 테두리/글로우 기준 색으로 사용
    const gradeColor = GEAR_GRADES[drop.grade]?.color || '#ffffff';
    el.style.setProperty('--drop-equip-color', gradeColor);

    items.forEach((item) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'fish-result__drop-equip-icon-cell';
      const itemColor = GEAR_GRADES[item.grade]?.color || '#ffffff';
      wrapper.style.setProperty('--cell-equip-color', itemColor);
      try {
        const svg = createGearIcon(item.slotId, item.grade);
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        wrapper.appendChild(svg);
      } catch (e) {
        console.warn('[fish-result] gear icon 실패:', item.slotId);
      }
      iconBox.appendChild(wrapper);
    });
  }
}

export function showFishResult(el, data) {
  const {
    fish, weight, tier, grade, missed = false, multiplier = 1,
    baseWeight = weight, comboBonus = 0, equipmentBonus = 0,
    kabikabiBonus = 0,  // ★ Day 31 (대표 결정) — 까비까비 동시 발생 시 분배된 까비 무게
    dropPayload = null,  // Lucky-3
    isGoldenHit = false,  // Day 15: 골든힛 타임 single hit (true 면 등급 + GOLDEN HIT 라벨)
    cardMultiplier,       // ★ Day 22 Phase 7 후속 — HIDDEN HIT 카드 배수 (1/3/5)
    isMythicHit = false,  // ★ Day 27: 신화 매칭 (검은 25+ 또는 11지역 분홍/황금/하얀 10+) — 게임 최고 보상
    goldenHitInfo = null, // ★ Day 27: 골든힛 변종 정보 (displayGrade 포함)
    isHiddenHit = false,  // ★ Day 28: 히든힛 결과 — missed 시 그림자 완전 검정 톤 분기용
  } = data;

  // 이전 호출 잔여 정리 — 타이머 / 드롭 단계 / 장비 영역 / 메시지 모두 초기화
  if (el._clearTensionTimer) el._clearTensionTimer();
  if (el._setDropPayload)    el._setDropPayload(dropPayload);
  if (el._resetAccumulated)  el._resetAccumulated();  // Lucky-5
  el.dataset.dropPhase = '';
  const iconBox  = el.querySelector('.fish-result__drop-equip-icon');
  if (iconBox) {
    iconBox.innerHTML = '';
    iconBox.classList.remove('fish-result__drop-equip-icon--multi');
  }
  const dropNameEl = el.querySelector('.fish-result__drop-equip-name');
  if (dropNameEl)  dropNameEl.textContent = '';
  const dropGradeEnEl = el.querySelector('.fish-result__drop-equip-grade-en');
  if (dropGradeEnEl)  dropGradeEnEl.textContent = '';
  const dropMsgEl = el.querySelector('.fish-result__drop-message');
  if (dropMsgEl)  dropMsgEl.innerHTML = '';

  // ★ Day 26 (대표 결정) — 인벤토리 빈칸 경고 (빈칸 1~5 면 하단 경고 표시).
  //   빈칸 0 (가득) 은 drop-bagfull phase 가 처리하므로 여기서는 hide.
  //   drop 여부 무관하게 표시 (사용자가 미리 정리하도록).
  const bagWarnEl = el.querySelector('.fish-result__bag-warn');
  if (bagWarnEl) {
    try {
      const inv = loadInventory();
      const remaining = getFreeSlots(inv);
      if (remaining > 0 && remaining <= BAG_WARN_THRESHOLD) {
        bagWarnEl.textContent = '인벤토리가 거의 찼습니다. 메뉴>합성에서 정리하세요';
        bagWarnEl.dataset.show = 'true';
      } else {
        bagWarnEl.textContent = '';
        delete bagWarnEl.dataset.show;
      }
    } catch (err) {
      // 안전장치 — inventory 로드 실패 시 경고 미표시
      bagWarnEl.textContent = '';
      delete bagWarnEl.dataset.show;
    }
  }

  // ★ Day 25 — 드롭 별 동적 생성 (아이템 수만큼 반짝)
  const starsContainer = el.querySelector('.fish-result__drop-stars');
  if (starsContainer) {
    starsContainer.innerHTML = '';
    if (dropPayload && !dropPayload.bagFull) {
      const items = dropPayload.items ?? [dropPayload];
      const count = Math.min(items.length, 5);
      // 아이템 수별 별 위치 (top%, left% — 물고기 영역 안)
      const STAR_POS = [
        [],
        [{ t: 50, l: 50 }],
        [{ t: 50, l: 33 }, { t: 50, l: 67 }],
        [{ t: 33, l: 50 }, { t: 65, l: 33 }, { t: 65, l: 67 }],
        [{ t: 33, l: 33 }, { t: 33, l: 67 }, { t: 65, l: 33 }, { t: 65, l: 67 }],
        [{ t: 28, l: 50 }, { t: 55, l: 25 }, { t: 55, l: 75 }, { t: 78, l: 35 }, { t: 78, l: 65 }],
      ];
      const positions = STAR_POS[count] || STAR_POS[1];
      const starSize  = count === 1 ? '3.2rem' : '2.2rem';  // 1개면 크게, 복수면 작게
      const starSVG   = `<svg viewBox="0 0 40 40" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><path d="M20 2 L22 18 L38 20 L22 22 L20 38 L18 22 L2 20 L18 18 Z" fill="#ffffff"/></svg>`;
      positions.forEach((pos, i) => {
        const star = document.createElement('div');
        star.className = 'fish-result__drop-star';
        star.style.cssText = `
          top: ${pos.t}%; left: ${pos.l}%;
          transform: translate(-50%, -50%);
          width: ${starSize}; height: ${starSize};
          animation-delay: ${i * 0.12}s;
        `;
        star.innerHTML = starSVG;
        starsContainer.appendChild(star);
      });
      el.dataset.dropStarCount = String(count);
    } else {
      delete el.dataset.dropStarCount;
    }
  }

  const isMultiHit = !missed && multiplier >= 2;
  const multiLabel = isMultiHit ? multiHitLabelOf(multiplier) : null;

  el.dataset.grade = grade;
  el.dataset.tier = tier?.name ?? '';
  el.dataset.missed = missed ? 'true' : 'false';
  el.dataset.locked = 'true';
  if (isMultiHit) {
    el.dataset.multihit = String(multiplier);
  } else {
    delete el.dataset.multihit;
  }
  // Day 15: 골든힛 타임 single hit 식별 (CSS 황금빛 오버라이드)
  // Day 18 후속 (대표 결정) — missed 케이스도 골든힛 타임이면 attribute 둠 (글로우 황금색)
  if (isGoldenHit) {
    el.dataset.goldenHit = 'true';
  } else {
    delete el.dataset.goldenHit;
  }
  // ★ Day 27 — 신화 매칭 식별 (CSS 신화 톤 오버라이드)
  if (isMythicHit) {
    el.dataset.mythicHit = 'true';
    // 황금빛꿈고래(mythic_01)는 엔딩 상징 — 별도 dataset 으로 특별 연출 분기 가능
    if (fish?.id === 'mythic_01') {
      el.dataset.endingMythic = 'true';
    } else {
      delete el.dataset.endingMythic;
    }
  } else {
    delete el.dataset.mythicHit;
    delete el.dataset.endingMythic;
  }
  // ★ Day 28 (대표 결정) — 히든힛 결과 식별:
  //   missed 시 그림자 색을 등급별 색 글로우(보스 = 붉은빛) 대신 완전 검정으로 오버라이드 (CSS).
  if (isHiddenHit) {
    el.dataset.hiddenHit = 'true';
  } else {
    delete el.dataset.hiddenHit;
  }

  // Lucky-3: 긴장감 색 / 가방가득 데이터 attribute 설정 (CSS 셀렉터용)
  if (dropPayload && !dropPayload.bagFull) {
    const colorTag = TENSION_COLOR_BY_EQUIP_GRADE[dropPayload.grade] || 'gold';
    el.dataset.dropColor = colorTag;
  } else {
    delete el.dataset.dropColor;
  }
  if (dropPayload && dropPayload.bagFull) {
    el.dataset.dropBagfull = 'true';
  } else {
    delete el.dataset.dropBagfull;
  }

  const scale = SCALE_MAP[grade] ?? 1.0;

  const shadowFish = { ...fish, color: '#000000' };
  // ★ Day 28 (대표 결정) — 히든힛(시크릿꿈고래) 결과 시 그림자를 단색 검정으로 렌더 (radial gradient 분홍 제거)
  el.querySelector('.fish-result__shadow').innerHTML = renderFishSVG(shadowFish, scale, { shadow: isHiddenHit });
  el.querySelector('.fish-result__real').innerHTML = renderFishSVG(fish, scale);

  const mainEl = el.querySelector('.fish-result__grade-main');
  const subEl  = el.querySelector('.fish-result__grade-sub');
  // ★ Day 29 v4 (대표 결정) — 변종 펑 활성 여부 (활성이면 REVEAL_DELAY 흐름 건너뜀,
  //   산식/무게 표시는 펑 끝난 후 onComplete 콜백에서 트리거)
  let variantChainActive = false;

  if (missed) {
    mainEl.textContent = 'MISSED';
    subEl.textContent = '';
  } else if (isMythicHit) {
    // ★ Day 27 — 신화 매칭 — 메인: 등급 (MYTHIC), 서브: 'MYTHIC HIT'
    // ★ Day 37 (대표 결정) — 황금빛꿈고래(mythic_01) → 서브 'SPECIAL MYTHIC' (황금 톤 + 글로우 펄스).
    //   일반 신화 (mythic_02~04) → 서브 'MYTHIC HIT' (기존 마젠타 톤).
    mainEl.textContent = gradeEnDisplay(fish, grade, null);
    subEl.textContent = (fish?.id === 'mythic_01') ? 'SPECIAL MYTHIC' : 'MYTHIC HIT';
  } else if (isGoldenHit) {
    // ★ Day 40 (대표 결정) — 골든힛도 일반힛과 동일한 사이즈 업그레이드 펑 연쇄 적용.
    //   잡기게임 상단/물기 알림은 base만 표시 (예: 'GOLDEN BOSS') → 결과팝업에서만 변종 펑 노출:
    //     GOLDEN BOSS (페이드인) → GOLDEN BOSS+ (펑) → GOLDEN BOSS++ → ... (plusCount 만큼).
    //   baseEnGrade = 'GOLDEN ' + 일반 등급 영문 (예: 'GOLDEN BOSS').
    //   plusCount   = goldenHitInfo.plusCount (0~5, GOLDEN_HIT_GRADE_TABLE 24구간 기준).
    //   서브: 'GOLDEN HIT' (기존 유지).
    //
    // ★ Day 39 깜빡임 수정 패턴 동일 적용 (mainEl 클래스 정리 + grade-pending + textContent 교체 순서).
    subEl.textContent = 'GOLDEN HIT';
    const baseEnGrade = 'GOLDEN ' + (GRADE_EN[grade] ?? '');
    const plusCount = goldenHitInfo?.plusCount ?? 0;
    if (GRADE_EN[grade]) {
      mainEl.classList.remove('grade-pop', 'grade-fade-in', 'grade-fade-out');
      mainEl.classList.add('grade-pending');
      mainEl.textContent = baseEnGrade;
      mainEl.dataset.upgradeStep = '0';
      variantChainActive = true;
      startVariantLuckyChain(el, mainEl, baseEnGrade, plusCount, () => {
        // ★ 등급 확정 — 산식/무게 표시 트리거 (일반힛과 동일 흐름)
        if (!el.classList.contains('show')) return;
        el.classList.add('revealed');
        setTimeout(() => {
          if (!el.classList.contains('show')) return;
          if (reg && reg.bestUpdated && !finalEl.querySelector('.fish-result__record-badge')) {
            const badge = document.createElement('span');
            badge.className = 'fish-result__record-badge';
            badge.textContent = 'NEW RECORD';
            finalEl.appendChild(badge);
          }
          el.classList.add('final-reveal');
        }, 500);
      });
    } else {
      mainEl.textContent = baseEnGrade;
    }
  } else if (isMultiHit || (!isMythicHit && !isGoldenHit)) {
    // ★ Day 38 후속 (대표 결정) — 더블힛/일반 분기 통합:
    //   기존: 더블힛은 mainEl 텍스트만 즉시 표시 (변종 펑 연쇄 X, SIZE UPGRADE 배지 X)
    //   변경: 더블힛도 변종 펑 연쇄 + 사이즈 업그레이드 배지 적용.
    //         multiLabel 은 subEl 에 그대로 유지 (DOUBLE HIT 등 표시).
    //
    // ★ Day 27 — 일반 매칭도 변종 + 포함 표시 (예: 치어 7지역 → 'TINY+++')
    // ★ Day 29 v3 (대표 결정) — Lucky Lucky 텍스트 폐기. 변종 등급 텍스트(mainEl) 자체에 펑 연출.
    // ★ Day 29 v4 (대표 결정) — 산식/최종무게는 펑 연쇄 끝난 후 표시 (onComplete 콜백).
    //
    // ★ Day 29 — 임시 디버그 (대표 시각 검증용):
    //   _DEBUG_FORCE_VARIANT_LUCKY = true 시 plusCount === 0 인 base 변종도 1단 연쇄.
    //   ★ Day 38 후속 (대표 결정) — false 로 변경 (정상화).
    const _DEBUG_FORCE_VARIANT_LUCKY = false;
    const baseEnGrade = GRADE_EN[grade] ?? '';
    const { plusCount } = getFishPlusCount(fish?.id);
    const effectivePlusCount = (plusCount === 0 && _DEBUG_FORCE_VARIANT_LUCKY) ? 1 : plusCount;
    if (baseEnGrade) {
      // ★ Day 39 (대표 결정) — base 등급 텍스트 간헐 깜빡임 근본 수정 [JS 호출부 부분].
      //   원인: 직전 잡기 결과에서 mainEl 에 남아 있던 .grade-pop / .grade-fade-in 의
      //         animation forwards 가 opacity:1 을 고정 → 새 textContent 가 한 프레임 노출 →
      //         POP_INITIAL_DELAY 뒤 fadeInBase 가 클래스 정리하며 사라졌다 다시 등장 = "깜빡".
      //   "간헐적" 이유: 직전 잡기 분기에 따라 잔존 클래스 유무가 달라짐.
      //   변경:
      //     1) textContent 변경 *전* 에 grade-pop / grade-fade-in / grade-fade-out 모두 제거
      //        → animation forwards 해제.
      //     2) grade-pending 먼저 추가 (opacity:0 확실히 적용) → 그 다음 textContent 교체.
      //     3) dataset.upgradeStep='0' 명시 초기화 (이전 변종 단계 폰트 크기 잔존 방지).
      //   ※ CSS 안전망(.grade-pending 에 animation:none) 도 함께 적용 — slot.css 참조.
      mainEl.classList.remove('grade-pop', 'grade-fade-in', 'grade-fade-out');
      mainEl.classList.add('grade-pending');   // 펑 직전까지 opacity 0 (이제 animation 해제됨 → 확실히 적용)
      mainEl.textContent = baseEnGrade;
      mainEl.dataset.upgradeStep = '0';
      variantChainActive = true;               // ★ REVEAL_DELAY 흐름 건너뛰기 표시
      startVariantLuckyChain(el, mainEl, baseEnGrade, effectivePlusCount, () => {
        // ★ 등급 확정 — 산식/무게 표시 트리거 (기존 REVEAL_DELAY 흐름 동작 이전)
        if (!el.classList.contains('show')) return;  // 팝업 이미 닫힘
        el.classList.add('revealed');
        setTimeout(() => {
          if (!el.classList.contains('show')) return;
          // record-badge append (bestUpdated 시만 — 신기록 갱신 또는 첫 등록)
          if (reg && reg.bestUpdated && !finalEl.querySelector('.fish-result__record-badge')) {
            const badge = document.createElement('span');
            badge.className = 'fish-result__record-badge';
            badge.textContent = 'NEW RECORD';
            finalEl.appendChild(badge);
          }
          el.classList.add('final-reveal');
        }, 500);
      });
    } else {
      mainEl.textContent = gradeEnDisplay(fish, grade, null);
    }
    // ★ Day 38 후속 — 더블힛이면 multiLabel 유지, 일반이면 빈 문자열
    subEl.textContent = isMultiHit ? multiLabel : '';
  }

  const nameEl = el.querySelector('.fish-result__name');
  nameEl.textContent = fish.name;

  // ── 기존 NEW 배지 정리 (다음 결과 표시 시 잔존 방지) ──
  nameEl.querySelector('.fish-result__new-badge')?.remove();

  // Day 16 — 잡기 성공 시 도감 자동 등록 + 신규일 때 NEW 뿅 효과.
  //   대표 결정: "신규는 이름 등장 0.3초 후 NEW 배지 (다른 연출 X)".
  //   missed = true 면 등록 X (놓친 물고기는 도감 등록 안 함).
  // Day 17 픽스 (대표 결정): 도감 최고기록 = 무게바에 누적되는 최종무게 (weight × multiplier).
  //   기존엔 weight 만 등록 (멀티히트 배수 누락) → slot.js onAccumulate 의 누적 공식과 일치시킴.
  //   weight 자체에 콤보 + 장비/세트 weight_bonus 이미 합산되어 있음 (applyWeight 결과).
  // Day 18 후속 (대표 결정) — registerFishCatch 결과를 reg 변수에 보관 →
  //   bestUpdated 시 무게 옆 NEW RECORD 배지도 부착 (NEW 배지와는 별도).
  // ★ Day 27 후속 (대표 결정) — HIDDEN HIT cardMultiplier 도 도감 무게에 반영 (버그 수정).
  //   기존: weight × multiHit (cardMultiplier 누락) → HIDDEN HIT ×3/×5 카드 잡기 시 도감 기록 손해
  //   변경: weight × multiHit × cardMultiplier — slot.js onAccumulate/onConfirm 의 gainedKg 공식과 완전 일치
  //         (노란색 팝업 = 무게바 누적 = 도감 등록 모두 동일 최종무게)
  let reg = null;
  if (!missed && fish?.name) {
    const multHit = (multiplier && multiplier >= 2) ? multiplier : 1;
    const cardMult = cardMultiplier || 1;
    const finalWeight = (weight || 0) * multHit * cardMult;
    reg = registerFishCatch(fish.name, finalWeight);
    if (reg.isNew) {
      // 같은 popup 인스턴스 내에서만 부착 (다음 결과로 교체 시 hide 처리됨)
      setTimeout(() => {
        // 결과 팝업이 이미 닫혔으면 부착 안 함
        if (!el.classList.contains('show')) return;
        // 중복 부착 방지
        if (nameEl.querySelector('.fish-result__new-badge')) return;
        const badge = document.createElement('span');
        badge.className = 'fish-result__new-badge';
        badge.textContent = 'NEW';
        nameEl.appendChild(badge);
      }, 300);
    }
  }

  const weightEl    = el.querySelector('.fish-result__weight');
  const breakdownEl = el.querySelector('.fish-result__weight-breakdown');
  const finalEl     = el.querySelector('.fish-result__weight-final');
  // ── 기존 NEW RECORD 배지 정리 (다음 결과 표시 시 잔존 방지) ──
  finalEl.querySelector('.fish-result__record-badge')?.remove();
  if (missed) {
    breakdownEl.innerHTML = '';
    finalEl.textContent = '';
    finalEl.style.color = '';
  } else {
    // ★ Day 31 (대표 결정) — 산식: 기본무게 + 까비까비무게 + (콤보보너스 + 물고기무게보너스)
    //   - 까비까비무게는 옵션 (검은 HIT + 까비까비 동시 발생 시에만 > 0)
    //   - 물고기무게보너스 / 콤보보너스는 (기본무게 + 까비까비무게) 적용베이스 기준 (slot.js 에서 계산됨)
    //   - 까비 단독 / 골든·히든·트윙클 + 까비 동시 시에는 kabikabiBonus = 0 (즉시 보상으로 별도 처리됨)
    // ★ Day 39 (대표 결정 옵션 A) — 각 숫자 위에 작은 라벨 추가.
    //   각 항목을 fish-result__weight-group 으로 감싸고, 라벨(작은 글씨, 위) + 숫자(큰 글씨, 아래) 배치.
    //   괄호는 제거 — 라벨로 의미 명확하니 평탄 합산 표시 (수학적으로도 평탄 합산).
    //   라벨 텍스트: "기본무게" / "까비까비" / "콤보보너스" / "무게보너스".
    const totalBonus = (comboBonus || 0) + (equipmentBonus || 0);
    const hasKabikabi = (kabikabiBonus || 0) > 0.0005;
    if (totalBonus > 0.0005 || hasKabikabi) {
      const parts = [
        // 기본무게 그룹 — 흰
        `<span class="fish-result__weight-group fish-result__weight-group--base">` +
          `<span class="fish-result__weight-label">기본무게</span>` +
          `<span class="fish-result__weight-base">${formatWeight(baseWeight)}</span>` +
        `</span>`,
      ];
      // 까비 (있을 때만) — 사이언
      if (hasKabikabi) {
        parts.push(`<span class="fish-result__weight-op">+</span>`);
        parts.push(
          `<span class="fish-result__weight-group fish-result__weight-group--kabikabi">` +
            `<span class="fish-result__weight-label">까비까비</span>` +
            `<span class="fish-result__weight-kabikabi">${formatWeight(kabikabiBonus)}</span>` +
          `</span>`
        );
      }
      // 콤보보너스 — 연두
      if (comboBonus > 0.0005) {
        parts.push(`<span class="fish-result__weight-op">+</span>`);
        parts.push(
          `<span class="fish-result__weight-group fish-result__weight-group--combo">` +
            `<span class="fish-result__weight-label">콤보보너스</span>` +
            `<span class="fish-result__weight-combo">${formatWeight(comboBonus)}</span>` +
          `</span>`
        );
      }
      // 무게보너스 — 황금
      if (equipmentBonus > 0.0005) {
        parts.push(`<span class="fish-result__weight-op">+</span>`);
        parts.push(
          `<span class="fish-result__weight-group fish-result__weight-group--equip">` +
            `<span class="fish-result__weight-label">무게보너스</span>` +
            `<span class="fish-result__weight-equip">${formatWeight(equipmentBonus)}</span>` +
          `</span>`
        );
      }
      breakdownEl.innerHTML = parts.join('');
    } else {
      breakdownEl.innerHTML = '';
    }
    if (isMultiHit) {
      finalEl.innerHTML =
        `${formatWeight(weight)}<span class="fish-result__weight-multi">× ${multiplier}</span>`;
    } else if (cardMultiplier !== undefined && cardMultiplier !== null) {
      // ★ Day 22 Phase 7 후속 (대표 결정) — HIDDEN HIT 카드 배수 표시
      //   weight 는 이미 cardMultiplier 반영된 최종 (slot.js Math.round(finalWeight * cardMultiplier))
      //   "최종무게 ×배수" 형식 (예: "120 kg × 3") — 사용자가 뽑은 카드 한눈에 확인
      finalEl.innerHTML =
        `${formatWeight(weight)}<span class="fish-result__weight-multi">× ${cardMultiplier}</span>`;
    } else {
      finalEl.textContent = formatWeight(weight);
    }
    if (tier?.color) finalEl.style.color = tier.color;
    weightEl.style.color = '';
    // Day 18 후속 (대표 결정) — record-badge append + final-reveal 클래스는
    //   아래 setTimeout(delay + 500) 에서 통합 처리 (final 과 동시 뿅).
  }

  el.classList.remove('hide', 'show', 'revealed', 'final-reveal');
  void el.offsetWidth;
  el.classList.add('show');

  if (!missed && !variantChainActive) {
    // ★ Day 29 v4 — 변종 펑 연쇄가 활성이면 산식/무게 표시는 onComplete 콜백에서 처리.
    //   변종 펑 미활성 (mythic/golden/multi 등) 분기만 여기 기존 REVEAL_DELAY 흐름.
    const delay = REVEAL_DELAY[grade] ?? 500;
    setTimeout(() => {
      el.classList.add('revealed');
    }, delay);

    // Day 18 후속 (대표 결정) — 최종 무게 + NEW RECORD 배지 동시 뿅 (revealed 후 추가 500ms).
    //   순서:
    //     1) show          → 등급, 물고기 그림자, 이름 표시
    //     2) revealed      → breakdown 수식 (보너스 분해) 표시
    //     3) final-reveal  → 최종 무게 + NEW RECORD 배지 동시 pop (탱탱볼)
    //   record-badge 는 final-reveal 시점에 DOM append → 동시 등장.
    setTimeout(() => {
      if (!el.classList.contains('show')) return;
      // record-badge append (bestUpdated 시만 — 신기록 갱신 또는 첫 등록)
      if (reg && reg.bestUpdated && !finalEl.querySelector('.fish-result__record-badge')) {
        const badge = document.createElement('span');
        badge.className = 'fish-result__record-badge';
        badge.textContent = 'NEW RECORD';
        finalEl.appendChild(badge);
      }
      el.classList.add('final-reveal');
    }, delay + 500);
  }

  setTimeout(() => {
    el.dataset.locked = 'false';
  }, POPUP_FADE_IN_MS);
}

function hide(el) {
  el.classList.remove('show', 'revealed', 'final-reveal');
  el.classList.add('hide');
  // 드롭 phase 초기화 — 다음 결과 표시 시 새 흐름 시작
  el.dataset.dropPhase = '';
  delete el.dataset.dropColor;
  delete el.dataset.dropBagfull;
  // ★ Day 29 — 변종 Lucky Lucky 연쇄 진행 중이면 중단 (다음 팝업에 잔영 방지)
  if (el._stopVariantLuckyChain) el._stopVariantLuckyChain();
}