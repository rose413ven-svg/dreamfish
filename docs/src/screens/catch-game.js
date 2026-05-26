/* ===========================================
   catch-game.js — 잡기 게임 v3 (C단계: 선택 시스템)
   ============================================
   v3 변경:
   - 단일 매칭: 즉시 게임 시작
   - 다중 매칭: "잡을 물고기를 터치하여 고르세요" 안내 표시
                 위쪽 물고기 1마리 터치 → 그 마리만 가운데 이동, 나머지 페이드아웃
                 선택 마리 등급 시간으로 게임 시작
   - 동시 떨어지는 원: 1개만 (simultaneous 시스템 폐기)
   - 시간 = 선택한 마리 등급별 (소20/중20/월30/보40/전60)

   판정 시스템 (3단계: PERFECT/NICE/MISS) 및 그물 디자인은 D단계에서 처리.
   ============================================ */

import { renderFishSVG } from '../ui/fish-svg.js';
import {
  getCatchConfig,
  TIME_LIMIT_MS,
  colorOf,
  gradeColorOf,
} from '../data/catch-game-config.js';
import { loadInventory } from '../core/storage.js';
import { getActiveOptions, applyRockRate, applyOrbDuration, CRITICAL_BASE_RATE } from '../data/equipment-effects.js';
// ★ Day 22 Phase 4C: HIDDEN HIT 미니게임 상수 (체력 20 / 시간 30초 / 카운트다운 3)
import {
  HIDDEN_HIT_BOSS_HP,
  HIDDEN_HIT_TIME_LIMIT_SEC,
  HIDDEN_HIT_COUNTDOWN_SEC,
  pickHiddenHitGrade,
  getHiddenBossDisplayFish,
} from '../data/hidden-hit-engine.js';
// ★ Day 22 Phase 4D: 잡기 성공 시 추첨 등급의 GRADE_WEIGHT_RANGE 에서 무게 롤
import { rollWeight } from '../engine/weight.js';
// ★ Day 28: 골든힛 전용 잡기게임 속도 (매칭 개수 기준)
import { getGoldenHitOrbDuration } from '../data/golden-hit-engine.js';
// ★ Day 38 (대표 결정) — 변종 단계 판별 (잡기존 숨김 기믹: +++(p3) 이상 또는 mythic_01)
import { getFishMeta } from '../data/fish-data.js';

/* ============================================
   ★ 반응형 픽셀 상수 (B 방식)
   ============================================
   JS에서 사용하는 픽셀값들은 화면 비율에 맞춰 동적 갱신됨.
   recalcLayoutConstants() 가 mount() 시점에 호출되어 1rem 의 실제 px값을
   읽어와서 모든 layout 상수를 갱신.

     ORB_RADIUS = 2.5rem  (= 25px @ 기준 화면 390px)
     ZONE_HALF  = 4.5rem  (= 45px @ 기준 화면)

   const → let 으로 바꾼 이유: resize/회전 시 갱신되어야 하므로.
   ============================================ */
let ORB_RADIUS = 25;       // 2.5rem (50px / 2) @ 기준 화면

/** 등급별 영문 라벨 (위쪽 검은 물고기 위에 작게) — Day 16: 8등급 / Day 19: 대문자 통일 */
const GRADE_LABEL = {
  '치어':     'TINY',
  '소형':     'SMALL',
  '중형':     'MEDIUM',
  '월척':     'BIG',
  '대물':     'HUGE',
  '보스':     'BOSS',
  '전설보스': 'LEGEND',
  '신화보스': 'MYTHIC',
};

/**
 * ★ Day 27 — result → 영문 등급 라벨.
 * ★ Day 29 (대표 결정) — 잡기게임 상단에는 변종 + 표시 안 함.
 *   변종 등급 확인은 최종 결과팝업의 Lucky Lucky 연쇄에서만 노출.
 *   골든힛 변종은 예외로 표시 유지 (골든힛 자체가 특수 매칭이라 변종 즉시 노출 OK).
 * ★ Day 40 (대표 결정) — 골든힛도 일반힛과 동일하게 잡기게임 상단에 변종 + 표시 X.
 *   'GOLDEN ' 접두 + base 등급만 (예: 'GOLDEN BOSS'). 변종 노출은 결과팝업 사이즈 업그레이드만.
 *
 * 우선순위:
 *   1. 골든힛: 'GOLDEN ' + base 등급 (변종 + 표시 X)
 *   2. 기본 등급 라벨 (변종 X)
 */
function gradeLabelWithPlus(result) {
  const baseEn = GRADE_LABEL[result?.grade] || '';
  if (!baseEn) return '';
  // ★ Day 40 — 골든힛: 'GOLDEN ' 접두 + base 만 (변종 + 표시 X)
  if (result?.goldenHitInfo && typeof result.goldenHitInfo.plusCount === 'number') {
    return 'GOLDEN ' + baseEn;
  }
  // 일반 매칭은 base 등급만 (변종 + 표시 X — ★ Day 29 결과팝업에서만)
  return baseEn;
}

/** 판정 텍스트 + 부수 수치 (★ Day 22 Phase 5 후속 (대표 결정) — perfect/nice/miss sub 폐기, BAD -3초 만 유지) */
const JUDGE_LABEL = {
  perfect: { main: 'PERFECT', sub: ''     },
  nice:    { main: 'NICE',    sub: ''     },
  miss:    { main: 'MISS',    sub: ''     },
  bad:     { main: 'BAD',     sub: '-3초' },  // Day 4: 꽝 원 터치 시
};

/** Day 4: 돌멩이(꽝 원) 시스템 */
const ROCK_SPAWN_RATE = 0.20;        // Day 4-3: 20% → 25%
const BAD_TIME_PENALTY_MS = 3000;    // BAD 발생 시 시간 -3초
/* ─── 잡기존: 90px 네모 ───
   사각 충돌 판정 — 원 중심이 잡기존 중심에서 (dx, dy) 거리일 때:
   - PERFECT: 원이 완전히 잡기존 안 = |dx| ≤ (45-25)=20 AND |dy| ≤ 20
   - NICE   : 원이 조금이라도 걸침   = |dx| < (45+25)=70 AND |dy| < 70
   - MISS   : 그 외 (눌렀는데 영역 밖)
*/
const ZONE_HALF_REM = 4.5;        // 잡기존 반쪽 = 4.5rem (= 45px @ 기준)
const ORB_RADIUS_REM = 2.5;       // 원 반지름 = 2.5rem  (= 25px @ 기준)

let ZONE_HALF = 45;             // 잡기존 90px의 반쪽 @ 기준 (recalc로 갱신)
let PERFECT_HALF = ZONE_HALF - ORB_RADIUS;  // 20 @ 기준
let NICE_HALF    = ZONE_HALF + ORB_RADIUS;  // 70 @ 기준

/**
 * 화면 비율에 맞춰 layout 픽셀 상수 갱신.
 * 1rem 의 실제 px값 (responsive.js가 <html>의 font-size로 설정) 을 읽어와서
 * ORB_RADIUS, ZONE_HALF 등을 일괄 갱신.
 *
 * 호출 시점:
 *   - mount() 진입 시 1회 (responsive.js 가 fontSize 설정 후라야 정확)
 *   - window resize / orientationchange 발생 시
 */
function recalcLayoutConstants() {
  const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
  ORB_RADIUS   = ORB_RADIUS_REM * remPx;
  ZONE_HALF    = ZONE_HALF_REM  * remPx;
  PERFECT_HALF = ZONE_HALF - ORB_RADIUS;
  NICE_HALF    = ZONE_HALF + ORB_RADIUS;
}

// 게임 중 회전/리사이즈 시 자동 갱신 (모듈 로드 시 1회 등록)
window.addEventListener('resize',            recalcLayoutConstants);
window.addEventListener('orientationchange', recalcLayoutConstants);

/* 판정 시간 텀 — 판정 텍스트 보이는 동안 다음 원 안 나옴 */
const JUDGE_PAUSE_MS = 450;

const SPAWN_INTERVAL_MIN = 500;
const SPAWN_INTERVAL_MAX = 1300;
const FIRST_SPAWN_DELAY = 400;

let onCloseCallback = null;
let containerEl = null;
let orbContainerEl = null;
let buttonEl = null;
let timeFillEl = null;
// ★ Day 38 후속E — 시간 바 안쪽 남은 초 텍스트 element
let timeTextEl = null;
let resultsLayoutEl = null;
let selectMessageEl = null;
let fishStates = [];   // 전체 매칭 결과 마리들 (위쪽 표시용)
let selectedFishIdx = -1; // 다중 매칭 시 사용자가 선택한 마리 인덱스
let selectionMode = false; // true: 선택 대기 / false: 게임 진행
let originalMatchCount = 1; // ★ Day 29 — 멀티히트 자동선택: 원본 매칭 클러스터 수 (×N 배수 보상용)

let rafId = null;
let activeOrbs = [];
let nextSpawnAt = 0;
let gameState = null;  // 'selecting' | 'playing' | 'success' | 'fail' | null
let startTime = 0;
let totalTimeMs = 0;   // 선택한 마리 등급별 시간
let judgeLocked = false; // 판정 직후 짧은 시간 잠금 (시간 텀)
let activeOpts = null; // Equipment-4c: 게임 시작 시 캐싱된 장비 옵션 효과 합산
let firstOrbSpawned = false;  // Day 10 후속: 첫 orb 등장 전 화면 터치 시 MISS/BAD 처리 방지 (대표 결정)
// ★ Day 38 후속H — 잡기존 페이드 보류 플래그.
//   selectFish 시점에 true 로 설정만 → spawnOrb 에서 첫 orb 의 lifetime 후 dataset 적용.
let pendingZoneHide = false;

// ★ Day 38 후속 (대표 보고 — 신화 잡기존 판정 너무 후한 버그 수정).
//   기존: 잡기존이 시각만 sizeScale 축소되고 판정 좌표(PERFECT_HALF/NICE_HALF)는 그대로 → 잡기존 밖이어도 NICE 판정.
//   변경: 판정 좌표도 sizeScale 배율로 축소 → 시각/판정 일치.
//   selectFish 시 결정, 판정 코드(handlePullClick / hidden) 에서 매번 곱셈 적용.
//   기본 1.0 (HIDDEN HIT 모드 등 sizeScale 미적용 케이스 호환).
let currentSizeScale = 1.0;

// ★ Day 40 (대표 결정) — 판정 기준을 orb 외곽(ORB_RADIUS) → 심볼 반지름으로 변경.
//   orb 시각 크기는 등급별 새 변수 --orb-scale (orbVisualScale, 옵션 나) 적용. 판정과 무관.
//   심볼은 CSS 역 scale 로 원래 크기 유지. 그 반지름(px) 을 selectFish 에서 저장 → 판정 사용.
//   기본 ORB_RADIUS(25) — selectFish 미적용 케이스 호환.
let currentSymbolHalfPx = 25;

// ★ Day 22 Phase 4C — HIDDEN HIT 미니게임 전용 상태
let hiddenModeActive = false;
let hiddenPhase = 'idle';        // 'idle' | 'countdown' | 'playing' | 'ended'
let hiddenStartTime = 0;
let hiddenTotalTimeMs = 0;
let hiddenNextSpawnAt = 0;
let hiddenSpawnCount = 0;
let hiddenPerfectCount = 0;
let hiddenCountdownEl = null;
// ★ Day 24 — HIDDEN HIT 무게 추첨에 적용할 지역 배율 (slot.js openCatchGameHidden 에서 mount 시 전달)
let hiddenStageMultiplier = 1.0;

/* ============================================
   진입
   ============================================ */

export default {
  /**
   * @param {object} params
   * @param {Array} params.results  - 매칭 결과 배열 (1마리 또는 다중) — HIDDEN 모드에선 빈 배열 가능
   * @param {boolean} params.hasBoss - 분홍 매칭 포함 (★ Day 22 — 항상 false)
   * @param {boolean} [params.hiddenMode=false] - ★ Day 22: HIDDEN HIT 미니게임 모드 (분홍 배경 / 보스 그림자 / 카운트다운)
   *                                              Phase 4A: 진입 흐름 + 분홍 배경 + anywhere click close (다음 단계에서 채움)
   * @param {(result: {caught: Array, missed: Array}) => void} params.onClose
   */
  mount(el, params = {}) {
    // 화면 비율에 맞춰 layout 픽셀 상수 갱신
    // (responsive.js 가 <html> font-size 설정 후라야 정확함 — main.js에서 보장됨)
    recalcLayoutConstants();

    // Equipment-4c: 잡기게임 진입 시 장비 옵션 한 번 집계, 게임 동안 그대로 사용.
    // (잡기게임 화면에서는 가방 못 열어서 장비 변경 X)
    activeOpts = getActiveOptions(loadInventory());

    onCloseCallback = params.onClose;
    const results = params.results || [];
    // ★ Day 29 — 멀티히트 자동선택: slot.js 에서 전달된 원본 매칭 수 (×N 배수 보상용).
    //   없으면 results.length 폴백 (HIDDEN HIT 등 단일 진입 경로 호환).
    originalMatchCount = params.originalMatchCount ?? results.length ?? 1;
    // ★ Day 22: HIDDEN HIT 모드 플래그 (Phase 4 — 4A 진입/분홍 배경 / 4B 보스 그림자+체력 / 4C 카운트다운+타이머 / 4D 종료)
    const hiddenMode = !!params.hiddenMode;
    // ★ Day 24 (대표 결정) ★ — 지역 무게 배율 (밸런스 Phase 2, 하이브리드 안)
    //   HIDDEN HIT 무게 추첨 시 stage.weightMultiplier 곱셈 적용.
    //   호출 측 (slot.js openCatchGameHidden) 에서 전달. 일반 catch 모드는 미사용
    //   (results 안에 이미 stage 배율 적용된 weight 들어있음).
    hiddenStageMultiplier = params.stageMultiplier ?? 1.0;

    /* ── 컨테이너 ── */
    containerEl = document.createElement('div');
    containerEl.className = 'catch-game';
    containerEl.dataset.boss = params.hasBoss ? 'true' : 'false';
    // Day 15: 골든힛 모드 — results 중 하나라도 isGoldenHit 면 화면 전체 황금빛 (CSS 셀렉터)
    //   골든힛은 single hit 이지만, 일관성 + 안전성 위해 some() 검사
    if (results.some(r => r?.isGoldenHit)) {
      containerEl.dataset.goldenHit = 'true';
    }
    // ★ Day 22: HIDDEN HIT 모드 dataset (CSS 분홍 배경 / 배경 물고기 hide / 버튼 hide 등 트리거)
    if (hiddenMode) {
      containerEl.dataset.hiddenMode = 'true';
    }

    // 물속 배경 (4겹: 그라디언트 / 빛줄기 / 헤엄치는 물고기들 / 거품)
    containerEl.innerHTML = `
      <div class="catch-bg">
        <div class="catch-bg__gradient"></div>
        <div class="catch-bg__rays">
          <span class="catch-bg__ray catch-bg__ray--1"></span>
          <span class="catch-bg__ray catch-bg__ray--2"></span>
          <span class="catch-bg__ray catch-bg__ray--3"></span>
        </div>
        <div class="catch-bg__swimmers">
          <!-- ★ Day 28 (대표 결정) — 4마리 → 1마리 (far-1만 유지). 렉 감소.
               (mid-1, near-1, far-2 의 CSS 정의는 dead code 로 남기지만 추후 복원 가능하게 유지) -->
          <span class="catch-bg__swimmer catch-bg__swimmer--far-1"></span>
        </div>
        <div class="catch-bg__bubbles">
          <span class="catch-bg__bubble catch-bg__bubble--1"></span>
          <span class="catch-bg__bubble catch-bg__bubble--2"></span>
          <span class="catch-bg__bubble catch-bg__bubble--3"></span>
          <span class="catch-bg__bubble catch-bg__bubble--4"></span>
          <span class="catch-bg__bubble catch-bg__bubble--5"></span>
        </div>
      </div>
    `;

    /* ── 상단: 물고기 + 체력바 ── */
    resultsLayoutEl = document.createElement('div');
    resultsLayoutEl.className = 'catch-results';
    resultsLayoutEl.dataset.count = String(results.length);
    if (results.length >= 2) {
      resultsLayoutEl.classList.add('catch-results--multi');
    }

    if (hiddenMode) {
      // ★ Day 22 Phase 4B: HIDDEN BOSS 그림자 + 체력바 20 (10×2)
      const hiddenState = buildHiddenBossItem();
      fishStates = [hiddenState];
      resultsLayoutEl.appendChild(hiddenState.itemEl);
      resultsLayoutEl.dataset.count = '1';   // 단일 슬롯 레이아웃
    } else {
      fishStates = results.map((result, idx) => buildFishItem(result, idx));
      fishStates.forEach(s => resultsLayoutEl.appendChild(s.itemEl));
    }

    containerEl.appendChild(resultsLayoutEl);

    /* ── 다중 매칭 시 선택 안내 메시지 ── */
    if (results.length >= 2) {
      selectMessageEl = document.createElement('div');
      selectMessageEl.className = 'catch-game__select-message';
      selectMessageEl.textContent = '잡을 물고기를 터치하여 고르세요';
      containerEl.appendChild(selectMessageEl);
    }

    /* ── 원 레이어 ── */
    orbContainerEl = document.createElement('div');
    orbContainerEl.className = 'catch-game__orb-layer';
    containerEl.appendChild(orbContainerEl);

    /* ── 정중앙: 잡기존 (텍스트 X) ── */
    const btnWrap = document.createElement('div');
    btnWrap.className = 'catch-game__button-wrap';
    btnWrap.innerHTML = `
      <button type="button" class="catch-game__button" aria-label="당기다">
        <span class="catch-game__button-ring catch-game__button-ring--metal"></span>
        <span class="catch-game__button-grip"></span>
        <span class="catch-game__button-crosshair">
          <span class="catch-game__button-crosshair-line catch-game__button-crosshair-line--h"></span>
          <span class="catch-game__button-crosshair-line catch-game__button-crosshair-line--v"></span>
          <span class="catch-game__button-crosshair-dot"></span>
        </span>
      </button>
    `;
    buttonEl = btnWrap.querySelector('.catch-game__button');
    buttonEl.addEventListener('click', handlePullClick);
    containerEl.appendChild(btnWrap);

    /* ── 화면 어디 터치해도 당기다 동작 (HIDDEN 모드에선 부착 X — 별도 close 핸들러로 대체) ── */
    if (!hiddenMode) {
      containerEl.addEventListener('click', handleAnywhereClick);
    }

    /* ── 안내 텍스트 — 화면 하단 ── */
    const hintEl = document.createElement('div');
    hintEl.className = 'catch-game__hint';
    hintEl.textContent = '타이밍에 맞게 화면을 터치하세요';
    containerEl.appendChild(hintEl);

    /* ── 하단: 시간바 ── */
    const timeBar = document.createElement('div');
    timeBar.className = 'catch-game__time-bar';
    timeFillEl = document.createElement('div');
    timeFillEl.className = 'catch-game__time-fill';
    timeBar.appendChild(timeFillEl);
    // ★ Day 38 후속E (대표 결정) — 시간 바 안쪽에 남은 초 텍스트 표시 (장비 catch_time_bonus 체감).
    //   흰색 큰 텍스트, 매 프레임 갱신 (Math.ceil(timeLeft / 1000))
    timeTextEl = document.createElement('div');
    timeTextEl.className = 'catch-game__time-text';
    timeBar.appendChild(timeTextEl);
    containerEl.appendChild(timeBar);

    /* ── ★ Day 22: HIDDEN 모드 — Phase 4C 게임 흐름 (카운트다운 → 30초 게임 → 종료)
         Phase 4D 에서 종료 시 caught/missed 결과 처리 추가 ── */
    if (hiddenMode) {
      hiddenModeActive = true;
      hiddenPhase = 'countdown';
      // ★ Day 25 (대표 결정) — 히든 모드에도 일반 잡기게임과 동일 안내 텍스트 표시 (기존 비움 처리 제거).
      //   메인: '타이밍에 맞게 화면을 터치하세요' (위에서 이미 채움), sub: 'ZONE이 사라집니다' 추가.
      const hintSubEl = document.createElement('div');
      hintSubEl.className = 'catch-game__hint-sub';
      hintSubEl.textContent = 'ZONE이 사라집니다';
      containerEl.appendChild(hintSubEl);
      // anywhere click → HIDDEN 전용 PERFECT 판정 (카운트다운 동안엔 자동 무시)
      containerEl.addEventListener('click', handleHiddenAnywhereClick);
      // 카운트다운 시작 → 3·2·1 → GO! → startHiddenGame
      startHiddenCountdown();
    }

    el.appendChild(containerEl);

    /* ── 단일 / 다중 분기 (HIDDEN 모드에선 skip — Phase 4C 에서 별도 시작 함수 추가) ── */
    if (!hiddenMode) {
      requestAnimationFrame(() => {
        if (results.length === 1) {
          // 단일 매칭: 즉시 선택 + 게임 시작
          selectFish(0);
        } else {
          // 다중 매칭: 선택 모드 진입
          enterSelectionMode();
        }
      });
    }
  },

  unmount() {
    cleanupGame();
  },
};

/* ============================================
   상단 물고기 + 체력바 한 칸 빌드
   ============================================ */

function buildFishItem(result, idx) {
  const config = getCatchConfig(result.grade);
  // Day 3: 색은 등급 색으로 통일 (이전엔 클러스터 색 + 등급 색 분리)
  const gradeColor = gradeColorOf(result.grade);

  const itemEl = document.createElement('div');
  itemEl.className = 'catch-fish-item';
  itemEl.dataset.gradeColor = gradeColor.name;
  itemEl.dataset.idx = String(idx);

  // 등급 라벨 (검은 물고기 위에 작게, 등급 색)
  // ★ Day 27 — 변종 + 포함 표시 (예: TINY+++ / BOSS++ / LEGEND+++++)
  const gradeLabelEl = document.createElement('div');
  gradeLabelEl.className = 'catch-fish-item__grade-label';
  // ★ Day 37 (대표 결정) — 황금빛꿈고래(mythic_01) → SPECIAL MYTHIC 황금색 + 특별 연출.
  //   일반 신화 (mythic_02~04) 는 기존 마젠타 그대로.
  if (result.fish?.id === 'mythic_01') {
    gradeLabelEl.textContent = 'SPECIAL MYTHIC';
    gradeLabelEl.style.color = '#FFD700';
    gradeLabelEl.style.textShadow =
      '0 0 12px rgba(255, 215, 0, 0.95), 0 0 6px rgba(255, 215, 0, 0.55), 0 1px 3px rgba(0, 0, 0, 0.85)';
    gradeLabelEl.classList.add('catch-fish-item__grade-label--special-mythic');
  } else {
    gradeLabelEl.textContent = gradeLabelWithPlus(result);
    gradeLabelEl.style.color = gradeColor.hex;
    gradeLabelEl.style.textShadow =
      `0 0 8px ${gradeColor.glow}, 0 1px 3px rgba(0, 0, 0, 0.85)`;
  }
  itemEl.appendChild(gradeLabelEl);

  // 물고기 (검은 실루엣 + 등급 색 글로우)
  // Day 6 후반 + Day 15: 월척/대물/보스/전설보스만 tight viewBox — 잡기존과 겹침 방지
  // (치어/소형/중형은 default viewBox = 체력바와 적절한 간격 유지)
  const tightFish = (result.grade === '월척' || result.grade === '대물' || result.grade === '보스' || result.grade === '전설보스' || result.grade === '신화보스');
  const fishEl = document.createElement('div');
  fishEl.className = 'catch-fish-item__fish';
  if (result.isGoldenHit) {
    // ★ Day 40 (대표 결정) — 골든힛 상단 물고기를 검은 그림자 + 황금 글로우 + sparkle 로 변경.
    //   이전 (Day 15~39): 황금 fill 인라인 SVG → 잡기 전인데 이미 황금어 정체 노출
    //   변경: 일반 모드와 동일한 renderFishSVG (검은 그림자) + --fish-glow 만 황금색 + sparkle 유지
    //   → 잡기 전엔 까만 그림자로 보이다가 잡고 나서 결과팝업에서 황금어 정체 드러남
    fishEl.classList.add('catch-fish-item__fish--golden-hit');
    fishEl.style.setProperty('--fish-glow', 'rgba(255, 217, 106, 0.85)');
    fishEl.style.setProperty('--fish-glow-color', '#FFD96A');
    // 검은 SVG (일반 모드와 동일) + sparkle 2개 (head, tail) 오버레이
    fishEl.innerHTML = renderFishSVG({ color: '#000000', size: 0.7 }, config.fishScale, { tight: tightFish }) + `
      <div class="catch-fish-item__sparkles" aria-hidden="true">
        <span class="catch-fish-item__sparkle catch-fish-item__sparkle--1"><svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M20 2 L22 18 L38 20 L22 22 L20 38 L18 22 L2 20 L18 18 Z" fill="#ffffff"/></svg></span>
        <span class="catch-fish-item__sparkle catch-fish-item__sparkle--3"><svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M20 2 L22 18 L38 20 L22 22 L20 38 L18 22 L2 20 L18 18 Z" fill="#ffffff"/></svg></span>
      </div>
    `;
    // ★ Day 21 (대표 결정 A안) — 잡기게임 렉 최적화: sparkle 5개 → 2개 (head, tail) 유지
  } else {
    // 일반 모드 (기존 룰 그대로)
    fishEl.style.setProperty('--fish-glow', gradeColor.glow);
    fishEl.style.setProperty('--fish-glow-color', gradeColor.hex);
    fishEl.innerHTML = renderFishSVG({ color: '#000000', size: 0.7 }, config.fishScale, { tight: tightFish });
  }
  itemEl.appendChild(fishEl);

  // 체력바 (등급별 칸 수, 색깔은 등급 색)
  // Day 4: hpRows 정의로 줄 단위 렌더링 (예: 소형 5+5 2줄, 보스 10+10+10 3줄)
  const hpBarEl = document.createElement('div');
  hpBarEl.className = 'catch-fish-item__hp';
  hpBarEl.dataset.rows = String(config.hpRows.length);
  hpBarEl.dataset.grade = result.grade;
  hpBarEl.style.setProperty('--hp-color', gradeColor.hex);
  hpBarEl.style.setProperty('--hp-glow', gradeColor.glow);
  // ★ Day 28 (대표 결정 A-가) — 골든힛 시 체력바 테두리 색을 등급 무관 #FFD96A 부드러운 황금으로 통일
  //   채움 색(background) / 글로우(box-shadow) 는 등급별 색 그대로 유지 (대표 결정 A안).
  //   시각 적용은 catch-game.css 의 [data-golden-hit="true"] 셀렉터에서 처리.
  if (result.isGoldenHit) {
    hpBarEl.dataset.goldenHit = 'true';
  }

  const hpCells = [];
  config.hpRows.forEach((rowSize) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'catch-fish-item__hp-row';
    for (let i = 0; i < rowSize; i++) {
      const cell = document.createElement('div');
      cell.className = 'catch-fish-item__hp-cell';
      cell.dataset.filled = 'true';
      rowEl.appendChild(cell);
      hpCells.push(cell);  // 평탄화 — 인덱스 기반 hp 갱신은 그대로 동작
    }
    hpBarEl.appendChild(rowEl);
  });
  itemEl.appendChild(hpBarEl);

  return {
    result,
    config,
    color: gradeColor,    // 호환성 위해 남겨둠 (spawnOrb 등에서 사용)
    gradeColor,
    hpCurrent: config.hpMax,
    hpCells,
    itemEl,
    hpBarEl,
    fishItemIdx: idx,
  };
}

/* ============================================
   ★ Day 22: HIDDEN BOSS 상단 슬롯 빌드 (Phase 4B)
   ============================================
   buildFishItem 의 HIDDEN HIT 전용 버전:
   - 그림자: 임시 분홍 SVG (Phase 5 에서 신비로운 분홍 물고기 디자인 합의 시 교체)
   - 시각 효과: 분홍 글로우 + sparkle 주변 + 부유 + 환영 페이드 (Q7 d 혼합) — CSS 처리
   - 체력바: 10×2 2줄 = 20칸 (일반 보스와 동일 구조, 색만 흰색-분홍빛)
   - 라벨: "HIDDEN BOSS"
   ============================================ */

const HIDDEN_HP_ROWS = [10, 10];                                  // 10×2 = 20
const HIDDEN_HP_MAX  = HIDDEN_HP_ROWS.reduce((a, b) => a + b, 0); // 20
const HIDDEN_COLOR   = '#FFE0EE';                                 // 흰색-분홍빛 (대표 명세)
const HIDDEN_GLOW    = 'rgba(255, 224, 238, 0.95)';
const HIDDEN_FISH_SCALE = 1.85;                                   // 보스급 크기 (Phase 5 합의 시 조정)

function buildHiddenBossItem() {
  const itemEl = document.createElement('div');
  itemEl.className = 'catch-fish-item catch-fish-item--hidden';
  itemEl.dataset.gradeColor = 'hidden';
  itemEl.dataset.idx = '0';

  // 라벨 "HIDDEN BOSS"
  const gradeLabelEl = document.createElement('div');
  gradeLabelEl.className = 'catch-fish-item__grade-label';
  gradeLabelEl.textContent = 'HIDDEN BOSS';
  gradeLabelEl.style.color = HIDDEN_COLOR;
  gradeLabelEl.style.textShadow =
    `0 0 8px ${HIDDEN_GLOW}, 0 1px 3px rgba(0, 0, 0, 0.85)`;
  itemEl.appendChild(gradeLabelEl);

  // ★ Day 22 Phase 5 (대표 결정): HIDDEN BOSS 잡기 중에는 그림자(정체 숨김),
  //   잡기 성공 후 결과 팝업/도감에서만 라인 아트 큰 잉어 (정체 드러남).
  //   여기는 잡기 중이므로 일반 보스 패턴 = 검은 실루엣 + 분홍 글로우 (CSS --fish-glow).
  //   renderFishSVG 에 id 미전달 → 일반 fish path 사용 (HIDDEN BOSS 분기 미진입).
  const fishEl = document.createElement('div');
  fishEl.className = 'catch-fish-item__fish catch-fish-item__fish--hidden';
  fishEl.style.setProperty('--fish-glow', HIDDEN_GLOW);
  fishEl.style.setProperty('--fish-glow-color', HIDDEN_COLOR);
  fishEl.innerHTML = `
    ${renderFishSVG({ color: '#000000', size: 0.7 }, HIDDEN_FISH_SCALE, { tight: true })}
    <div class="catch-fish-item__sparkles catch-fish-item__sparkles--hidden" aria-hidden="true">
      <span class="catch-fish-item__sparkle catch-fish-item__sparkle--1"><svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M20 2 L22 18 L38 20 L22 22 L20 38 L18 22 L2 20 L18 18 Z" fill="#FFE0EE"/></svg></span>
      <span class="catch-fish-item__sparkle catch-fish-item__sparkle--3"><svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M20 2 L22 18 L38 20 L22 22 L20 38 L18 22 L2 20 L18 18 Z" fill="#FFE0EE"/></svg></span>
    </div>
  `;
  itemEl.appendChild(fishEl);

  // 체력바 — 10×2 2줄 = 20칸 (일반 보스와 동일 구조, 색만 흰-분홍)
  const hpBarEl = document.createElement('div');
  hpBarEl.className = 'catch-fish-item__hp catch-fish-item__hp--hidden';
  hpBarEl.dataset.rows = String(HIDDEN_HP_ROWS.length);
  hpBarEl.dataset.grade = '숨겨진보스';
  hpBarEl.style.setProperty('--hp-color', HIDDEN_COLOR);
  hpBarEl.style.setProperty('--hp-glow', HIDDEN_GLOW);

  const hpCells = [];
  HIDDEN_HP_ROWS.forEach((rowSize) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'catch-fish-item__hp-row';
    for (let i = 0; i < rowSize; i++) {
      const cell = document.createElement('div');
      cell.className = 'catch-fish-item__hp-cell';
      cell.dataset.filled = 'true';
      rowEl.appendChild(cell);
      hpCells.push(cell);
    }
    hpBarEl.appendChild(rowEl);
  });
  itemEl.appendChild(hpBarEl);

  return {
    result: null,    // Phase 4D 에서 추첨 등급 결과로 채울 예정
    config: { hpMax: HIDDEN_HP_MAX, hpRows: HIDDEN_HP_ROWS },
    color: { hex: HIDDEN_COLOR, glow: HIDDEN_GLOW, name: 'hidden' },
    gradeColor: { hex: HIDDEN_COLOR, glow: HIDDEN_GLOW, name: 'hidden' },
    hpCurrent: HIDDEN_HP_MAX,
    hpCells,
    itemEl,
    hpBarEl,
    fishItemIdx: 0,
    isHidden: true,
  };
}

/* ============================================
   ★ Day 22 Phase 4C: HIDDEN HIT 게임 흐름
   ============================================
   흐름:
     mount(hiddenMode) → startHiddenCountdown (3·2·1·GO!)
                       → startHiddenGame → hiddenTick (30초)
                       → spawnHiddenOrb (전반 1100ms / 후반 1000ms 페이스, 흰 원 + 분홍 심볼, 속도 랜덤)
                       → handleHiddenAnywhereClick → doHiddenPull (PERFECT만 인정)
                       → hp 0 도달 (성공) 또는 시간 종료 (실패) → finishHiddenGame
                       → Phase 4D 에서 onCloseCallback 에 caught/missed 결과 추가 예정
   ============================================ */

/** HIDDEN 모드 — 등장 속도 랜덤 (★ Day 22 Phase 7 후속 — 치어/소형/중형만, 잡기존 fade 컨셉 대비 난이도 보정)
 *  catch-game-config.js CATCH_CONFIG 의 orbDuration 중 3등급:
 *    - 치어: 800ms / 소형: 700ms / 중형: 500ms (기존 8등급 → 3등급으로 단순화) */
const HIDDEN_ORB_DURATIONS = [800, 700, 500];

/** HIDDEN 모드 등장 페이스 (대표 결정 — 권장):
 *  전반 15초: 1100ms 간격 / 후반 15초: 1000ms 간격 — "후반 살짝 빨라짐" */
const HIDDEN_SPAWN_INTERVAL_EARLY_MS = 1100;
const HIDDEN_SPAWN_INTERVAL_LATE_MS  = 1000;
const HIDDEN_EARLY_PHASE_END_MS = 15000;   // 전반 15초

/** HIDDEN 모드 — 판정 후 짧은 잠금 (페이스 유지, 일반 JUDGE_PAUSE_MS 보다 짧음) */
const HIDDEN_JUDGE_PAUSE_MS = 200;

/**
 * 카운트다운 3·2·1·GO! 시작 (잡기존 아래쪽에 작게).
 * 카운트 끝나면 startHiddenGame 호출.
 */
function startHiddenCountdown() {
  hiddenCountdownEl = document.createElement('div');
  hiddenCountdownEl.className = 'catch-hidden-countdown';
  containerEl.appendChild(hiddenCountdownEl);

  let n = HIDDEN_HIT_COUNTDOWN_SEC;
  const tick = () => {
    if (hiddenPhase !== 'countdown') return;   // cleanup 안전장치
    if (n > 0) {
      hiddenCountdownEl.textContent = String(n);
      hiddenCountdownEl.classList.remove('catch-hidden-countdown--pulse');
      void hiddenCountdownEl.offsetWidth;
      hiddenCountdownEl.classList.add('catch-hidden-countdown--pulse');
      n--;
      setTimeout(tick, 1000);
    } else {
      // GO! 표시 후 게임 시작
      hiddenCountdownEl.textContent = 'GO!';
      hiddenCountdownEl.classList.remove('catch-hidden-countdown--pulse');
      void hiddenCountdownEl.offsetWidth;
      hiddenCountdownEl.classList.add('catch-hidden-countdown--go');
      setTimeout(() => {
        if (hiddenCountdownEl) {
          hiddenCountdownEl.classList.add('catch-hidden-countdown--hide');
        }
        startHiddenGame();
      }, 700);
    }
  };
  tick();
}

/** 게임 시작 — tick 루프 시작 */
function startHiddenGame() {
  if (hiddenPhase === 'ended') return;
  hiddenPhase = 'playing';
  hiddenStartTime = performance.now();
  hiddenTotalTimeMs = HIDDEN_HIT_TIME_LIMIT_SEC * 1000;
  hiddenNextSpawnAt = hiddenStartTime + 200;              // 게임 시작 직후 첫 spawn
  hiddenSpawnCount = 0;
  hiddenPerfectCount = 0;
  firstOrbSpawned = false;

  // ★ Day 22 Phase 7 후속 (대표 결정): 게임 시작 후 잡기존 페이드 아웃 (HIDDEN 컨셉)
  //   카운트다운 3·2·1 동안엔 잡기존 보임 → GO! 후 페이드 아웃 (1초 ease-out, CSS 트랜지션).
  //   클릭 자체는 anywhere click 으로 그대로 동작 (handleHiddenAnywhereClick → doHiddenPull).
  if (containerEl) {
    containerEl.classList.add('catch-game--hidden-playing');
  }

  rafId = requestAnimationFrame(hiddenTick);
}

/** HIDDEN 모드 tick — 일반 tick 의 간소화 버전 */
function hiddenTick(now) {
  if (hiddenPhase !== 'playing') return;

  const elapsed = now - hiddenStartTime;
  const timeLeft = hiddenTotalTimeMs - elapsed;

  // 시간 종료 → 실패
  if (timeLeft <= 0) {
    finishHiddenGame(false);
    return;
  }

  // 시간바 갱신
  if (timeFillEl) {
    timeFillEl.style.width = `${(timeLeft / hiddenTotalTimeMs) * 100}%`;
    if (timeLeft / hiddenTotalTimeMs <= 0.2) {
      timeFillEl.classList.add('catch-game__time-fill--low');
    } else {
      timeFillEl.classList.remove('catch-game__time-fill--low');
    }
  }
  // ★ Day 38 후속E — 시간 텍스트 (초 단위, 올림) 갱신
  if (timeTextEl) {
    timeTextEl.textContent = `${Math.ceil(timeLeft / 1000)}s`;
  }

  // hp 0 도달 → 잡기 성공
  const hiddenFish = fishStates[0];
  if (!hiddenFish || hiddenFish.hpCurrent <= 0) {
    finishHiddenGame(true);
    return;
  }

  // spawn (전반/후반 간격 다름)
  if (now >= hiddenNextSpawnAt && activeOrbs.length < 1) {
    spawnHiddenOrb(now);
    hiddenSpawnCount++;
    const intervalMs = elapsed < HIDDEN_EARLY_PHASE_END_MS
      ? HIDDEN_SPAWN_INTERVAL_EARLY_MS
      : HIDDEN_SPAWN_INTERVAL_LATE_MS;
    hiddenNextSpawnAt = now + intervalMs;
  }

  // 활성 원 위치 갱신 (일반 tick과 동일 로직)
  for (let i = activeOrbs.length - 1; i >= 0; i--) {
    const orb = activeOrbs[i];
    const t = (now - orb.startTime) / orb.duration;
    if (t >= 1) {
      orb.wrapEl.remove();
      activeOrbs.splice(i, 1);
      continue;
    }
    const x = orb.start.x + (orb.end.x - orb.start.x) * t;
    const y = orb.start.y + (orb.end.y - orb.start.y) * t;
    orb.currentX = x;
    orb.currentY = y;
    orb.wrapEl.style.transform = `translate(${x - ORB_RADIUS}px, ${y - ORB_RADIUS}px)`;
  }

  rafId = requestAnimationFrame(hiddenTick);
}

/** HIDDEN 모드 spawn — 흰 원 + 분홍 fish 심볼, 속도 랜덤, rock 미등장 */
function spawnHiddenOrb(now) {
  firstOrbSpawned = true;

  const rect = containerEl.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;

  // HIDDEN 모드는 정중앙 잡기존 버튼 hide → 화면 중앙 좌표 사용
  const cx = W / 2;
  const cy = H / 2;

  const sides = ['top', 'bottom', 'left', 'right'];
  const side = sides[Math.floor(Math.random() * 4)];

  const margin = 60;
  let start, end;
  if (side === 'top') {
    const xJitter = cx + (Math.random() - 0.5) * (W * 0.5);
    start = { x: xJitter, y: -margin };
    end   = { x: cx * 2 - xJitter, y: H + margin };
  } else if (side === 'bottom') {
    const xJitter = cx + (Math.random() - 0.5) * (W * 0.5);
    start = { x: xJitter, y: H + margin };
    end   = { x: cx * 2 - xJitter, y: -margin };
  } else if (side === 'left') {
    const yJitter = cy + (Math.random() - 0.5) * (H * 0.4);
    start = { x: -margin, y: yJitter };
    end   = { x: W + margin, y: cy * 2 - yJitter };
  } else {
    const yJitter = cy + (Math.random() - 0.5) * (H * 0.4);
    start = { x: W + margin, y: yJitter };
    end   = { x: -margin, y: cy * 2 - yJitter };
  }

  // 속도: 치어~신화보스 orbDuration 랜덤 + 장비 orb_speed 옵션 적용 (★ Day 22 Phase 5 후속)
  //   applyOrbDuration 이 장비 orb_speed 옵션 만큼 duration 증가 (= 속도 감소 = 잡기 쉬워짐)
  const rolledDuration = HIDDEN_ORB_DURATIONS[Math.floor(Math.random() * HIDDEN_ORB_DURATIONS.length)];
  const orbDuration = applyOrbDuration(rolledDuration, activeOpts);
  const symbolSize = 32;   // 일반 보스급 (catch-game-config 와 일관)

  // 흰 원 + 분홍 fish 심볼 (rock 미등장)
  const orbEl = document.createElement('div');
  orbEl.className = 'catch-orb catch-orb--hidden';
  orbEl.style.setProperty('--orb-color', '#FFFFFF');
  orbEl.style.setProperty('--orb-glow', 'rgba(255, 255, 255, 0.95)');
  orbEl.style.setProperty('--orb-grade-color', '#FFE0EE');
  orbEl.style.setProperty('--orb-grade-glow', 'rgba(255, 224, 238, 0.85)');
  orbEl.innerHTML = `
    <span class="catch-orb__core"></span>
    <span class="catch-orb__shine"></span>
    <span class="catch-orb__symbol catch-orb__symbol--hidden" style="width:${symbolSize / 10}rem;height:${symbolSize / 10}rem;">
      ${renderFishSymbolSilhouette(symbolSize)}
    </span>
  `;

  const orbWrap = document.createElement('div');
  orbWrap.className = 'catch-orb-wrap';
  orbWrap.appendChild(orbEl);
  orbWrap.style.transform = `translate(${start.x - ORB_RADIUS}px, ${start.y - ORB_RADIUS}px)`;
  orbContainerEl.appendChild(orbWrap);

  activeOrbs.push({
    el: orbEl,
    wrapEl: orbWrap,
    start, end,
    startTime: now,
    duration: orbDuration * 2,
    currentX: start.x,
    currentY: start.y,
    fishIdx: 0,
    color:      { hex: '#FFFFFF', glow: 'rgba(255,255,255,0.95)', name: 'hidden-white' },
    gradeColor: { hex: '#FFE0EE', glow: 'rgba(255,224,238,0.85)', name: 'hidden' },
    kind: 'fish',   // rock 미등장 (HIDDEN 모드 정책)
  });
}

/** HIDDEN 모드 anywhere click — PERFECT 판정만, MISS 패널티 X */
function handleHiddenAnywhereClick(_e) {
  if (hiddenPhase !== 'playing') return;
  doHiddenPull();
}

/** HIDDEN 모드 판정 — PERFECT 만 hp -1, 외 모두 MISS (체력 회복 X)
 *  ★ Day 22 Phase 5 후속 (대표 결정):
 *   - 물고기 원 하나당 한 번만 클릭 가능 → MISS 시에도 closest orb 제거 (연타 방지)
 *   - PERFECT/MISS 판정 텍스트 옆 수치 (-2 / +1) 숨김 (hideSub: true) */
function doHiddenPull() {
  if (hiddenPhase !== 'playing') return;
  if (!firstOrbSpawned) return;
  if (judgeLocked) return;

  // 잡기존 = 화면 중앙 (HIDDEN 모드 정중앙 버튼 표시는 시각 마커 / 클릭 핸들러는 anywhere 또는 button 둘 다 doHiddenPull 호출)
  const rect = containerEl.getBoundingClientRect();
  const bx = rect.width / 2;
  const by = rect.height / 2;

  // 가장 가까운 fish 원 + PERFECT 판정만 인정
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < activeOrbs.length; i++) {
    const orb = activeOrbs[i];
    const dx = Math.abs(orb.currentX - bx);
    const dy = Math.abs(orb.currentY - by);
    if (dx <= PERFECT_HALF && dy <= PERFECT_HALF) {
      const dist = Math.max(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
  }

  const hiddenFish = fishStates[0];

  if (bestIdx >= 0) {
    // PERFECT — hp -1
    const orb = activeOrbs[bestIdx];
    orb.el.classList.add('catch-orb--caught');
    setTimeout(() => orb.wrapEl.remove(), 280);
    activeOrbs.splice(bestIdx, 1);

    if (hiddenFish && hiddenFish.hpCurrent > 0) {
      hiddenFish.hpCurrent = Math.max(0, hiddenFish.hpCurrent - 1);
      hiddenPerfectCount++;

      // 체력바 갱신
      for (let i = 0; i < hiddenFish.hpCells.length; i++) {
        hiddenFish.hpCells[i].dataset.filled = (i < hiddenFish.hpCurrent) ? 'true' : 'false';
      }
      // 체력바 흔들림
      hiddenFish.hpBarEl.classList.remove('catch-fish-item__hp--shake');
      void hiddenFish.hpBarEl.offsetWidth;
      hiddenFish.hpBarEl.classList.add('catch-fish-item__hp--shake');
      // 아이디어 2: 보스 그림자 살짝 흔들림 (분홍 톤)
      hiddenFish.itemEl.classList.remove('catch-fish-item--hidden-perfect');
      void hiddenFish.itemEl.offsetWidth;
      hiddenFish.itemEl.classList.add('catch-fish-item--hidden-perfect');
    }

    // 아이디어 2: 잡기존 분홍 빛 잔상
    showHiddenPerfectFlash();
    showJudgeText('perfect', { hideSub: true });
  } else {
    // MISS — 체력 변동 X (대표 결정 Q4: MISS 패널티 OFF)
    // ★ Day 22 Phase 5 후속: 연타 방지 — 가장 가까운 orb 를 fade + 제거 (일반 doPull MISS 패턴)
    let closestOrbIdx = -1;
    let closestDist = Infinity;
    for (let i = 0; i < activeOrbs.length; i++) {
      const orb = activeOrbs[i];
      const ox = Math.abs(orb.currentX - bx);
      const oy = Math.abs(orb.currentY - by);
      const d = Math.max(ox, oy);
      if (d < closestDist) {
        closestDist = d;
        closestOrbIdx = i;
      }
    }
    if (closestOrbIdx >= 0) {
      const orb = activeOrbs[closestOrbIdx];
      orb.el.classList.add('catch-orb--miss-fade');
      setTimeout(() => orb.wrapEl.remove(), 300);
      activeOrbs.splice(closestOrbIdx, 1);
    }
    showJudgeText('miss', { hideSub: true });
  }

  // 판정 잠금 (짧게 — 페이스 유지)
  judgeLocked = true;
  setTimeout(() => { judgeLocked = false; }, HIDDEN_JUDGE_PAUSE_MS);
}

/** 잡기존 분홍 빛 잔상 (PERFECT 시) */
function showHiddenPerfectFlash() {
  if (!containerEl) return;
  const flash = document.createElement('div');
  flash.className = 'catch-hidden-perfect-flash';
  containerEl.appendChild(flash);
  setTimeout(() => flash.remove(), 400);
}

/* ============================================
   ★ Day 28 (대표 결정) — 일반 모드 / 골든힛 PERFECT 폭발 + 그림자 흔들림
   ============================================
   HIDDEN 모드 톤(showHiddenPerfectFlash + .catch-fish-item--hidden-perfect) 을
   일반 모드 / 골든힛에도 확장 적용. PERFECT 판정 시에만 호출.

   색 정책 (CSS 변수 --flash-color 로 주입):
     - 골든힛  → '#FFD96A' (부드러운 황금, orb/fish 색과 통일)
     - 일반    → orb.gradeColor.hex (등급별 8색)
   ============================================ */
/**
 * 잡기존 중앙 폭발 빛 잔상 (PERFECT 시 — 일반/골든힛 공용).
 * @param {object} orb           activeOrbs 원 객체 (gradeColor.hex 추출용)
 * @param {boolean} isGoldenHit  골든힛 모드 여부 (true 면 황금 강제)
 */
function showCatchPerfectFlash(orb, isGoldenHit) {
  if (!containerEl) return;
  const flash = document.createElement('div');
  flash.className = 'catch-perfect-flash';
  const flashColor = isGoldenHit ? '#FFD96A' : (orb?.gradeColor?.hex || '#FFFFFF');
  flash.style.setProperty('--flash-color', flashColor);
  containerEl.appendChild(flash);
  setTimeout(() => flash.remove(), 400);
}

/**
 * 상단 물고기 그림자 흔들림 (PERFECT 시 — 일반/골든힛 공용).
 * @param {object} fishStateObj  fishStates 원소 ({ itemEl, ... })
 */
function shakeFishItemPerfect(fishStateObj) {
  if (!fishStateObj?.itemEl) return;
  fishStateObj.itemEl.classList.remove('catch-fish-item--catch-perfect');
  void fishStateObj.itemEl.offsetWidth;   // reflow 강제 → 애니메이션 재시작
  fishStateObj.itemEl.classList.add('catch-fish-item--catch-perfect');
}

/**
 * HIDDEN HIT 게임 종료 (★ Day 22 Phase 4D).
 * - 성공(hp 0 도달): 추첨 등급 + GRADE_WEIGHT_RANGE 에서 무게 롤 → caught.push (보너스 적용은 slot.js onClose 에서)
 * - 실패(시간 종료): missed.push (placeholder, 보상 X 위함)
 *
 * 일반 잡기 결과와 동일한 객체 형식 유지 + isHiddenHit 플래그로 분기.
 * Phase 6 카드뒤집기 / Phase 7 결과 팝업에서 isHiddenHit 분기로 별도 흐름 처리 예정.
 *
 * @param {boolean} success - true: 잡기 성공(hp 0) / false: 시간 종료
 */
function finishHiddenGame(success) {
  if (hiddenPhase === 'ended') return;
  hiddenPhase = 'ended';

  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  const caught = [];
  const missed = [];

  if (success) {
    // 추첨 등급 (월척 40 / 대물 35 / 보스 25) + 해당 등급 무게 롤
    const grade = pickHiddenHitGrade();
    const fish = getHiddenBossDisplayFish();
    // ★ Day 24 — HIDDEN HIT 무게에도 지역 배율 적용 (하이브리드 안: 등급은 미니게임 룰, 무게는 stage 배율)
    const { weight: rolledWeight, tier } = rollWeight(fish.baseWeight, grade, hiddenStageMultiplier);

    caught.push({
      fish,                            // HIDDEN_FISH[0] — 이름 "숨겨진 보스"
      grade,                           // 추첨 등급: '월척' | '대물' | '보스'
      baseWeight: rolledWeight,        // 보너스 적용 전 무게 (slot.js 가 콤보/장비 보너스 적용)
      weight: rolledWeight,            // 임시: slot.js onClose 에서 applyWeight 로 최종 갱신
      tier,
      symbol: 'rainbow',
      size: 0,                         // HIDDEN HIT 는 클러스터 사이즈 무관
      isHiddenHit: true,               // ★ Phase 6/7 분기 키
      perfectCount: hiddenPerfectCount,
      clusterIdx: 1,
    });
    console.log('[HIDDEN HIT Phase 4D] 잡기 성공 — 추첨 등급:', grade, '/ rolled 무게:', rolledWeight, '/ PERFECT', hiddenPerfectCount, '회');
  } else {
    // 시간 종료 — 실패 / 보상 X (Q3 a — missed 에 placeholder 만 push)
    // ★ Day 22 Phase 5 후속 (대표 결정): fish-result missed 팝업 호환 필드 채움
    //   - fish: HIDDEN_FISH[0] (id='hidden_01' 유지 → 라인 아트 큰 잉어 정체 드러남)
    //   - grade: '보스' placeholder (SCALE_MAP 시각 크기용; 보상 X 라 의미 없음)
    missed.push({
      fish: getHiddenBossDisplayFish(),
      grade: '보스',                   // placeholder (시각 크기 / dataset.grade)
      isHiddenHit: true,
      failed: true,
      perfectCount: hiddenPerfectCount,
    });
    console.log('[HIDDEN HIT Phase 4D] 시간 종료 실패 — PERFECT', hiddenPerfectCount, '/', HIDDEN_HIT_BOSS_HP, '회 / 보상 X');
  }

  setTimeout(() => {
    onCloseCallback?.({ caught, missed });
  }, 700);
}

/* ============================================
   다중 매칭 — 선택 모드 진입
   ============================================ */

function enterSelectionMode() {
  selectionMode = true;
  gameState = 'selecting';

  // 시간바 채움 100% 유지 (게임 안 시작)
  timeFillEl.style.width = '100%';

  // 잡기존 숨김 (CSS에서 selecting 클래스로 처리)
  containerEl.classList.add('catch-game--selecting');

  // 위쪽 물고기 각자 클릭 가능하게
  fishStates.forEach((s, idx) => {
    s.itemEl.classList.add('catch-fish-item--selectable');
    // pointer-events 활성
    s.itemEl.style.pointerEvents = 'auto';
    s.itemEl.style.cursor = 'pointer';
    s.itemEl.addEventListener('click', s._onSelectClick = (e) => {
      e.stopPropagation(); // 화면 전체 클릭과 충돌 방지
      selectFish(idx);
    });
  });
}

/* ============================================
   물고기 선택 (단일이면 자동, 다중이면 사용자 클릭)
   ============================================ */

function selectFish(idx) {
  if (selectedFishIdx !== -1) return; // 중복 방지

  selectedFishIdx = idx;
  selectionMode = false;
  containerEl.classList.remove('catch-game--selecting');

  /* ★ Day 38 (대표 결정) — 잡기존 + 물고기원 등급별 크기 축소 + 변종 +++ 잡기존 숨김.
   * ★ Day 40 (대표 결정) — 골든힛도 일반힛과 동일하게 +++ 이상 잡기존 숨김 적용 + GOLDEN MYTHIC 전체 적용.
   *
   *  적용 조건 (HIDDEN HIT 모드 제외 — 히든은 별도 기믹):
   *  1. sizeScale (모든 등급 적용)
   *     - 치어 1.0 / 소형 0.9 / 중형 0.8 / 월척 0.7 / 대물 0.6 / 보스 0.5 / 전설 0.4 / 신화 0.3
   *     - CSS 변수 --zone-scale / --orb-scale 로 일괄 적용 (잡기존 + 모든 orb)
   *  2. 잡기존 숨김 (히든보스와 동일 기믹 — 시각만 사라지고 터치 위치/판정은 그대로)
   *     - 일반 등급 (치어~전설): plusCount >= 3 (변종 +++, ++++, +++++)
   *     - 신화: id === 'mythic_01' (황금빛꿈고래) 만, mythic_02~04 제외
   *     - ★ Day 40 — 골든힛 일반 등급(MEDIUM~LEGEND): goldenHitInfo.plusCount >= 3
   *     - ★ Day 40 — GOLDEN MYTHIC (신화보스 분기 / fishId=golden_01): 항상 적용
   *     - containerEl.dataset.zoneHidden = 'true' → CSS opacity 0 페이드
   */
  if (!hiddenModeActive) {
    const fishResult = fishStates[idx]?.result;
    if (fishResult) {
      const cfg = getCatchConfig(fishResult.grade);
      const sizeScale = cfg.sizeScale ?? 1.0;
      // ★ Day 40 (대표 결정) — 잡기존(zone-scale)과 물고기원(orb-scale) 분리.
      //   잡기존: 기존 sizeScale 그대로 (등급↑ = 작아짐, 난이도 유지)
      //   물고기원 외곽: 새 orbVisualScale (등급↑ = 커짐, 컨셉 일치 — 옵션 나)
      //   심볼: CSS 역 scale 로 원래 크기 유지 (.catch-orb__symbol 참조)
      //   판정: 심볼 반지름 기준 (currentSymbolHalfPx 사용)
      const orbVisualScale = cfg.orbVisualScale ?? sizeScale;
      containerEl.style.setProperty('--zone-scale', String(sizeScale));
      containerEl.style.setProperty('--orb-scale', String(orbVisualScale));

      // ★ Day 38 후속 — 판정 좌표도 sizeScale 적용 (시각/판정 일치).
      //   handlePullClick 에서 PERFECT_HALF * currentSizeScale, NICE_HALF * currentSizeScale 로 비교.
      currentSizeScale = sizeScale;

      // ★ Day 40 (대표 결정) — 판정 기준 심볼 반지름 (px).
      //   orbSymbolSize 값 / 10 = rem 단위, × remPx = px. 그 절반이 반지름.
      //   예: 치어 22 → 2.2rem → 22px(@기준) → 반지름 11px
      //       신화 44 → 4.4rem → 44px(@기준) → 반지름 22px
      const remPxNow = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
      const symbolSize = cfg.orbSymbolSize ?? 22;
      currentSymbolHalfPx = (symbolSize / 10) * remPxNow / 2;

      // 잡기존 숨김 판별
      const fishId = fishResult.fish?.id || '';
      const isGoldenHitResult = !!fishResult.isGoldenHit;
      const goldenPlusCount = fishResult.goldenHitInfo?.plusCount ?? 0;
      let zoneHidden = false;
      if (fishResult.grade === '신화보스') {
        // ★ Day 40 — 신화: 황금빛꿈고래(mythic_01) + 골든힛 신화(GOLDEN MYTHIC, fishId='golden_01') 둘 다 적용
        zoneHidden = (fishId === 'mythic_01') || isGoldenHitResult;
      } else if (isGoldenHitResult) {
        // ★ Day 40 — 골든힛 일반 등급: goldenHitInfo.plusCount >= 3 (GOLDEN xxx+++, ++++, +++++)
        if (goldenPlusCount >= 3) zoneHidden = true;
      } else if (fishId) {
        // 일반 등급: 변종 +++(p3) 이상
        const meta = getFishMeta(fishId);
        if (meta && meta.plusCount >= 3) {
          zoneHidden = true;
        }
      }
      if (zoneHidden) {
        // ★ Day 38 후속H (대표 결정) — 잡기존 페이드 시점 변경:
        //   기존: selectFish 직후 즉시 dataset.zoneHidden='true' → 게임 시작과 동시에 페이드
        //   변경: pendingZoneHide 로 저장만 → 첫 orb 가 잡기존 통과한 후 페이드 시작
        //         (spawnOrb 에서 처음 orb 의 lifetime 후 dataset 설정)
        pendingZoneHide = true;
      }
    }
  }

  // 안내 메시지 페이드아웃
  if (selectMessageEl) {
    selectMessageEl.classList.add('catch-game__select-message--hide');
    setTimeout(() => {
      if (selectMessageEl) selectMessageEl.remove();
      selectMessageEl = null;
    }, 400);
  }

  const selectedItem = fishStates[idx].itemEl;
  const isMulti = fishStates.length >= 2;

  // ─── Day 4-3 (재구현): FLIP 애니메이션 — 1.5초 서서히 이동 + 진짜 도착점 보장
  // 핵심:
  //   1) 안 선택 마리들을 layout에서 즉시 분리(absolute fix) → 선택 마리의 endRect가
  //      "단일매칭 진짜 도착점"이 됨 (이전 버그: 다른 마리들이 600ms layout 차지해
  //       선택 마리가 잘못된 column 자리로 이동했었음)
  //   2) 부모 reflow 강제 → single layout 적용 즉시 반영
  //   3) FLIP transform: 시작 위치/크기로 즉시 점프 → 1.5s 부드럽게 도착점으로
  // ──────────────────────────────────────────────
  let startRect = null;
  if (isMulti) {
    startRect = selectedItem.getBoundingClientRect();
  }

  // 위쪽 정리 — 선택 클릭 핸들러 제거 + 비활성 마리 즉시 absolute로 layout 분리
  fishStates.forEach((s, i) => {
    if (s._onSelectClick) {
      s.itemEl.removeEventListener('click', s._onSelectClick);
      s._onSelectClick = null;
    }
    s.itemEl.classList.remove('catch-fish-item--selectable');
    s.itemEl.style.pointerEvents = '';
    s.itemEl.style.cursor = '';

    if (i !== idx) {
      // ★ Day 10 v4 (대표 결정): 비활성 마리 즉시 제거 (페이드 X).
      //   이전 페이드 처리는 부모 multi 클래스 / data-count 변경에 따른 visual 점프
      //   문제로 자연스럽지 않아 — 그냥 DOM 즉시 제거.
      //   (selectedItem startRect 측정은 이 forEach 전에 이미 끝났음 — line 383~385)
      s.itemEl.remove();
    }
  });

  // 다중매칭이었다면 layout을 단일로 전환 → 도착 상태 = 단일매칭 시작 상태
  if (isMulti && resultsLayoutEl) {
    resultsLayoutEl.classList.remove('catch-results--multi');
    resultsLayoutEl.dataset.count = '1';
  }

  if (isMulti && startRect) {
    // 부모 reflow 강제 → single layout 즉시 반영 (다른 마리 absolute로 빠진 상태)
    void resultsLayoutEl.offsetWidth;

    // FLIP — 새 도착 위치/크기 measure (정확한 단일매칭 도착점)
    const endRect = selectedItem.getBoundingClientRect();
    const dx = startRect.left - endRect.left;
    const dy = startRect.top - endRect.top;
    const sx = endRect.width  > 0 ? startRect.width  / endRect.width  : 1;
    const sy = endRect.height > 0 ? startRect.height / endRect.height : 1;

    // 시작 위치/크기로 즉시 점프 (transition 없이)
    selectedItem.style.transition = 'none';
    selectedItem.style.transformOrigin = 'top left';
    selectedItem.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    void selectedItem.offsetWidth; // reflow 강제

    // 다음 프레임에 도착 위치/크기로 부드럽게 이동 (1.5초 — 서서히 느낌)
    requestAnimationFrame(() => {
      selectedItem.classList.add('catch-fish-item--selected');
      selectedItem.style.transition =
        'transform 1.5s cubic-bezier(0.22, 0.9, 0.32, 1)';
      selectedItem.style.transform = '';
      // transition 끝나면 inline 스타일 정리 (도착점과 layout 위치 일치하므로 점프 없음)
      setTimeout(() => {
        selectedItem.style.transition = '';
        selectedItem.style.transform = '';
        selectedItem.style.transformOrigin = '';
      }, 1600);
    });

    // 게임 시작은 이동 끝 즈음
    setTimeout(() => startGame(), 1600);
  } else {
    // 단일 매칭 — 그냥 selected 표시 후 즉시 시작
    selectedItem.classList.add('catch-fish-item--selected');
    setTimeout(() => startGame(), 200);
  }
}

/* ============================================
   게임 흐름
   ============================================ */

function startGame() {
  const selectedFish = fishStates[selectedFishIdx];
  if (!selectedFish) {
    finishGame();
    return;
  }

  gameState = 'playing';
  // ★ Day 30 (대표 결정) — 펫 catch_time_bonus 옵션 적용:
  //   기존 timeMs × (1 + bonus/100). 풀강 최종 천장 5~7% ~ 17~20% (catch_time_bonus 옵션 + 강화 합).
  //   예: 신화보스 65초 × 1.20 = 78초 (mythic 펫 풀강 +20%).
  const baseTimeMs = selectedFish.config.timeMs || TIME_LIMIT_MS;
  const catchTimeBonusPct = (activeOpts && activeOpts.catch_time_bonus) || 0;
  totalTimeMs = baseTimeMs * (1 + catchTimeBonusPct / 100);
  startTime = performance.now();
  nextSpawnAt = startTime + FIRST_SPAWN_DELAY;
  rafId = requestAnimationFrame(tick);
}

function tick(now) {
  if (gameState !== 'playing') return;

  // 시간
  const elapsed = now - startTime;
  const timeLeft = totalTimeMs - elapsed;
  if (timeLeft <= 0) {
    finishGame();
    return;
  }
  timeFillEl.style.width = `${(timeLeft / totalTimeMs) * 100}%`;
  // Day 4: 20% 이하 남으면 빨간색 + 번쩍번쩍
  if (timeLeft / totalTimeMs <= 0.2) {
    timeFillEl.classList.add('catch-game__time-fill--low');
  } else {
    timeFillEl.classList.remove('catch-game__time-fill--low');
  }
  // ★ Day 38 후속E — 시간 텍스트 (초 단위, 올림) 갱신
  if (timeTextEl) {
    timeTextEl.textContent = `${Math.ceil(timeLeft / 1000)}s`;
  }

  const selectedFish = fishStates[selectedFishIdx];
  if (!selectedFish || selectedFish.hpCurrent <= 0) {
    finishGame();
    return;
  }

  // 동시 등장 1마리만 (simultaneous 폐기)
  if (now >= nextSpawnAt && activeOrbs.length < 1) {
    spawnOrb(now, selectedFish);
    nextSpawnAt = now + SPAWN_INTERVAL_MIN +
                  Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
  }

  // 활성 원 위치 갱신
  for (let i = activeOrbs.length - 1; i >= 0; i--) {
    const orb = activeOrbs[i];
    const t = (now - orb.startTime) / orb.duration;

    if (t >= 1) {
      // 화면 밖으로 완전히 나감 → 자연 사라짐 (안 누른 거 = 패널티 X, 그냥 흘러감)
      orb.wrapEl.remove();
      activeOrbs.splice(i, 1);
      continue;
    }

    // 직선 경로 (출발 → 정반대편)
    const x = orb.start.x + (orb.end.x - orb.start.x) * t;
    const y = orb.start.y + (orb.end.y - orb.start.y) * t;
    orb.currentX = x;
    orb.currentY = y;
    orb.wrapEl.style.transform =
      `translate(${x - ORB_RADIUS}px, ${y - ORB_RADIUS}px)`;
  }

  rafId = requestAnimationFrame(tick);
}

/* ============================================
   원 스폰 — 사방 출현 + 통과 구조 (선택 마리만)
   ============================================ */

function spawnOrb(now, targetFish) {
  // Day 10 후속: 첫 orb 등장 시점 표시 — doPull 의 시작 시점 무시 검사용
  // ★ Day 38 후속H — 첫 orb 인지 미리 판별 (pendingZoneHide 처리용)
  const wasFirstOrb = !firstOrbSpawned;
  firstOrbSpawned = true;

  const rect = containerEl.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;

  // 잡기존(버튼) 중심 위치
  const buttonRect = buttonEl.getBoundingClientRect();
  const containerRect = containerEl.getBoundingClientRect();
  const cx = buttonRect.left - containerRect.left + buttonRect.width / 2;
  const cy = buttonRect.top - containerRect.top + buttonRect.height / 2;

  // 사방 (위/아래/좌/우) + 살짝 비스듬히
  const sides = ['top', 'bottom', 'left', 'right'];
  const side = sides[Math.floor(Math.random() * 4)];

  const margin = 60;
  let start, end;

  if (side === 'top') {
    const xJitter = cx + (Math.random() - 0.5) * (W * 0.5);
    start = { x: xJitter, y: -margin };
    end   = { x: cx * 2 - xJitter, y: H + margin };
  } else if (side === 'bottom') {
    const xJitter = cx + (Math.random() - 0.5) * (W * 0.5);
    start = { x: xJitter, y: H + margin };
    end   = { x: cx * 2 - xJitter, y: -margin };
  } else if (side === 'left') {
    const yJitter = cy + (Math.random() - 0.5) * (H * 0.4);
    start = { x: -margin, y: yJitter };
    end   = { x: W + margin, y: cy * 2 - yJitter };
  } else {
    const yJitter = cy + (Math.random() - 0.5) * (H * 0.4);
    start = { x: W + margin, y: yJitter };
    end   = { x: -margin, y: cy * 2 - yJitter };
  }

  const symbolSize = targetFish.config.orbSymbolSize;

  // Day 4: 25% 확률로 꽝 원(돌멩이) — fish 정보 없음, 검은 원 + 흰 X
  // Equipment-4c: 장비 rock_rate 옵션 적용 (확률 감소)
  const adjustedRockRate = applyRockRate(ROCK_SPAWN_RATE, activeOpts);
  const isRock = Math.random() < adjustedRockRate;

  // 원 DOM
  const orbEl = document.createElement('div');
  orbEl.className = isRock ? 'catch-orb catch-orb--rock' : 'catch-orb';

  if (isRock) {
    // 꽝 원 — 코지한 검은 원 + 흰 X
    orbEl.innerHTML = `
      <span class="catch-orb__core catch-orb__core--rock"></span>
      <span class="catch-orb__rock-x" aria-hidden="true">
        <span class="catch-orb__rock-x-line catch-orb__rock-x-line--1"></span>
        <span class="catch-orb__rock-x-line catch-orb__rock-x-line--2"></span>
      </span>
    `;
  } else {
    // 일반 원 (배경 = 등급 색, 외곽 글로우 = 등급 색, 안쪽 = 검은 물고기 심볼)
    // Day 15 변경 (대표 결정): 골든힛 모드 = 등급 무관 황금색 바탕 통일 + 안쪽 검은 심볼
    const isGoldenHit = !!targetFish.result?.isGoldenHit;
    const orbColorHex   = isGoldenHit ? '#FFD96A' : targetFish.color.hex;
    const orbColorGlow  = isGoldenHit ? 'rgba(255, 217, 106, 0.95)' : targetFish.color.glow;
    const orbGradeHex   = isGoldenHit ? '#FFC93C' : targetFish.gradeColor.hex;
    const orbGradeGlow  = isGoldenHit ? 'rgba(255, 201, 60, 0.85)'  : targetFish.gradeColor.glow;
    orbEl.dataset.color = isGoldenHit ? 'gold' : targetFish.color.name;
    orbEl.dataset.gradeColor = isGoldenHit ? 'gold' : targetFish.gradeColor.name;
    orbEl.style.setProperty('--orb-color', orbColorHex);
    orbEl.style.setProperty('--orb-glow', orbColorGlow);
    orbEl.style.setProperty('--orb-grade-color', orbGradeHex);
    orbEl.style.setProperty('--orb-grade-glow', orbGradeGlow);
    orbEl.innerHTML = `
      <span class="catch-orb__core"></span>
      <span class="catch-orb__shine"></span>
      <span class="catch-orb__guide" style="width:${symbolSize / 10}rem;height:${symbolSize / 10}rem;"></span>
      <span class="catch-orb__symbol" style="width:${symbolSize / 10}rem;height:${symbolSize / 10}rem;">
        ${renderFishSymbolSilhouette(symbolSize)}
      </span>
    `;
  }

  // wrapper로 감싸 inline transform과 caught 애니메이션 충돌 방지
  const orbWrap = document.createElement('div');
  orbWrap.className = 'catch-orb-wrap';
  orbWrap.appendChild(orbEl);
  orbWrap.style.transform =
    `translate(${start.x - ORB_RADIUS}px, ${start.y - ORB_RADIUS}px)`;
  orbContainerEl.appendChild(orbWrap);

  activeOrbs.push({
    el: orbEl,
    wrapEl: orbWrap,
    start, end,
    startTime: now,
    // Equipment-4c: 장비 orb_speed 옵션 적용 (duration 증가 = 속도 감소 = 잡기 쉬움)
    // ★ Day 28 (대표 결정): 골든힛은 매칭 개수 기준 전용 테이블 사용 (등급별 X)
    //   일반 모드 = catch-game-config 등급별 orbDuration
    //   골든힛   = golden-hit-engine getGoldenHitOrbDuration(매칭 개수)
    //   장비 orb_speed 는 둘 다 동일하게 applyOrbDuration() 으로 적용.
    duration: applyOrbDuration(
      targetFish.result?.isGoldenHit
        ? getGoldenHitOrbDuration(targetFish.result.size)
        : targetFish.config.orbDuration,
      activeOpts
    ) * 2,  // 출발 → 정반대편
    currentX: start.x,
    currentY: start.y,
    fishIdx: targetFish.fishItemIdx,
    color: targetFish.color,
    gradeColor: targetFish.gradeColor,
    kind: isRock ? 'rock' : 'fish',
  });

  // ★ Day 38 후속H (대표 결정) — 첫 orb 통과 후 잡기존 페이드 시작.
  //   첫 orb 의 lifetime (출발→반대편 통과 시간 = duration*2) 만큼 기다린 후
  //   dataset.zoneHidden 설정 → CSS opacity 0 transition 1s 페이드아웃 시작.
  //   사용자 시각: 첫 orb 가 잡기존을 완전히 지나간 후 잡기존이 서서히 사라짐.
  if (wasFirstOrb && pendingZoneHide) {
    pendingZoneHide = false;  // 1회만 처리
    const orbLifetimeMs = applyOrbDuration(
      targetFish.result?.isGoldenHit
        ? getGoldenHitOrbDuration(targetFish.result.size)
        : targetFish.config.orbDuration,
      activeOpts
    ) * 2;
    setTimeout(() => {
      if (containerEl) containerEl.dataset.zoneHidden = 'true';
    }, orbLifetimeMs);
  }
}

/* ============================================
   원 안 검은 물고기 심볼 (단순 실루엣 통일)
   ============================================ */
function renderFishSymbolSilhouette(size) {
  // Day 15 변경 (대표 결정): orb 안 fish 심볼은 항상 검은색.
  //   골든힛 모드는 orb 바탕(--orb-color, --orb-grade-color)을 황금으로 강제하므로
  //   안쪽 심볼은 검은이어야 대비 + 가시성 확보.
  return `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">
    <path d="M 8,30
             C 8,16  22,8   38,8
             C 58,8  72,16  78,30
             C 72,44 58,52  38,52
             C 22,52 8,44   8,30 Z
             M 78,30
             L 95,14
             L 92,30
             L 95,46
             L 78,30 Z"
          fill="#000" stroke="rgba(255,255,255,0.18)" stroke-width="0.8"/>
    <circle cx="28" cy="26" r="2.4" fill="rgba(255,255,255,0.85)"/>
  </svg>`;
}

/* ============================================
   당기기 — 충돌 판정 (현재는 hit/miss 2단계, D단계에서 PERFECT/NICE/MISS 3단계로)
   ============================================ */

function handlePullClick(e) {
  if (e) e.stopPropagation();
  // ★ Day 22 Phase 5 후속 (대표 결정): HIDDEN 모드 잡기존 클릭 → doHiddenPull 일관 처리
  if (hiddenModeActive) {
    doHiddenPull();
    return;
  }
  doPull();
}

function handleAnywhereClick(_e) {
  doPull();
}

function doPull() {
  if (gameState !== 'playing') return; // 선택 모드에서는 무시

  // Day 10 후속 (대표 결정): 첫 fish/rock orb 가 화면에 나타나기 전 클릭 무시.
  //   playing 상태로 전환된 직후엔 nextSpawnAt 까지 무 orb 시간이 있는데,
  //   이 사이 화면 터치 시 MISS / BAD 가 발생하면 사용자 입장에서 부당함 (아직 잡을 게 없음).
  //   spawnOrb 가 한 번이라도 호출되면 true → 그 후엔 정상 판정 (MISS 가능).
  //   매 게임마다 cleanupGame 에서 false 로 리셋.
  if (!firstOrbSpawned) return;

  // 판정 텍스트 떠있는 동안 더블 누름 잠금
  if (judgeLocked) return;

  // Day 4: 활성 원 중 꽝 원(rock)이 있으면 → BAD 우선 처리
  // (fish/rock 동시 존재 X — simultaneous = 1, 그러나 안전하게 우선순위)
  const rockIdx = activeOrbs.findIndex(o => o.kind === 'rock');
  if (rockIdx >= 0) {
    handleBad(rockIdx);
    return;
  }

  const buttonRect = buttonEl.getBoundingClientRect();
  const containerRect = containerEl.getBoundingClientRect();
  const bx = buttonRect.left - containerRect.left + buttonRect.width / 2;
  const by = buttonRect.top - containerRect.top + buttonRect.height / 2;

  // 가장 가까운 fish 원 + 그 원의 사각 판정 결과
  let bestIdx = -1;
  let bestDist = Infinity;
  let bestVerdict = 'miss'; // 'perfect' | 'nice' | 'miss'

  for (let i = 0; i < activeOrbs.length; i++) {
    const orb = activeOrbs[i];
    if (orb.kind === 'rock') continue;  // rock은 PERFECT/NICE 판정 대상 X
    const dx = Math.abs(orb.currentX - bx);
    const dy = Math.abs(orb.currentY - by);

    // ★ Day 38 후속 — 잡기존 시각 축소(sizeScale)에 맞춰 판정 좌표도 동일 비율 축소.
    //   기존: PERFECT_HALF / NICE_HALF 고정 → 시각상 잡기존 밖이어도 판정 인정되는 버그.
    //   변경: PERFECT_HALF * currentSizeScale / NICE_HALF * currentSizeScale → 시각/판정 일치.
    // ★ Day 40 (대표 결정) — 판정 기준을 orb 외곽(ORB_RADIUS) → 심볼 반지름(currentSymbolHalfPx)으로 변경.
    //   orb 시각 크기는 별도 (--orb-scale, orbVisualScale) — 판정과 무관.
    //   심볼 크기는 등급별로 다름(22~44px) → currentSymbolHalfPx 도 등급별로 selectFish 에서 갱신됨.
    //   PERFECT = 심볼이 완전히 잡기존 안 (ZONE_HALF - SYMBOL_HALF)
    //   NICE    = 심볼이 잡기존에 일부 겹침 (ZONE_HALF + SYMBOL_HALF)
    const perfectHalf = (ZONE_HALF - currentSymbolHalfPx) * currentSizeScale;
    const niceHalf    = (ZONE_HALF + currentSymbolHalfPx) * currentSizeScale;

    let verdict = 'miss';
    if (dx <= perfectHalf && dy <= perfectHalf)      verdict = 'perfect';
    else if (dx < niceHalf && dy < niceHalf)         verdict = 'nice';

    if (verdict === 'miss') continue;

    // 가장 가까운 거리(체비셰프 거리)
    const dist = Math.max(dx, dy);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
      bestVerdict = verdict;
    }
  }

  const fish = fishStates[selectedFishIdx];

  if (bestIdx >= 0) {
    /* PERFECT 또는 NICE — 원 잡힘 */
    const orb = activeOrbs[bestIdx];
    orb.el.classList.add('catch-orb--caught');
    setTimeout(() => orb.wrapEl.remove(), 280);
    activeOrbs.splice(bestIdx, 1);

    // ★ Day 30 (대표 결정) — 크리티컬 확률 적용 (hook + pet critical_rate 합산):
    //   PERFECT/NICE 시 critical_rate 확률로 데미지 ×2 (퍼펙트 → 4 / 나이스 → 2).
    //   MISS 는 크리티컬 X (체크 안 함).
    //
    // ★ Day 32 (대표 결정) — 기본 확률 추가:
    //   crit% = CRITICAL_BASE_RATE (3) + activeOpts.critical_rate (장비 hook + pet).
    //   장비 없어도 기본 3% 발동 가능.
    let damage = (bestVerdict === 'perfect') ? 2 : 1;
    const equipCriticalPct = (activeOpts && activeOpts.critical_rate) || 0;
    const criticalRatePct = CRITICAL_BASE_RATE + equipCriticalPct;
    const isCritical = (bestVerdict !== 'miss') && (Math.random() * 100 < criticalRatePct);
    if (isCritical) {
      damage *= 2;
      // ★ Day 32 (대표 결정) — CRITICAL ×2 텍스트 표시 (체력바와 잡기존 사이 랜덤 위치, 펑 팝업)
      showCriticalText();
    }

    // ★ Day 28 (대표 결정) — PERFECT 시 폭발 + 그림자 흔들림 (HIDDEN 톤 확장):
    //   일반 모드 = 등급 색 폭발 / 골든힛 = 황금색 폭발 (#FFD96A).
    //   NICE 는 평범 유지 (HIDDEN 이 PERFECT 만 있는 정책과 동일 톤).
    if (bestVerdict === 'perfect') {
      const isGoldenHit = !!fish?.result?.isGoldenHit;
      showCatchPerfectFlash(orb, isGoldenHit);
      shakeFishItemPerfect(fish);
    }

    if (fish && fish.hpCurrent > 0) {
      fish.hpCurrent = Math.max(0, fish.hpCurrent - damage);

      // 체력바 갱신 (오른쪽 끝부터 채움 해제)
      for (let i = 0; i < fish.hpCells.length; i++) {
        fish.hpCells[i].dataset.filled = (i < fish.hpCurrent) ? 'true' : 'false';
      }

      // 체력바 흔들림
      fish.hpBarEl.classList.remove('catch-fish-item__hp--shake');
      void fish.hpBarEl.offsetWidth;
      fish.hpBarEl.classList.add('catch-fish-item__hp--shake');

      if (fish.hpCurrent === 0) {
        fish.itemEl.classList.add('catch-fish-item--cleared');
      }
    }

    flashButton(bestVerdict, orb.gradeColor || orb.color);
    showJudgeText(bestVerdict);

    // 선택 마리 잡았으면 종료
    if (fish && fish.hpCurrent <= 0) {
      // 잠깐 후 종료 (PERFECT/NICE 텍스트 보이도록)
      setTimeout(() => finishGame(), JUDGE_PAUSE_MS);
    }
  } else {
    /* MISS — 누르고 빗나감 */
    flashButton('miss');
    showJudgeText('miss');

    // Day 3 추가: 잡으려 한 위치 근처에 있던 원이 그 자리에 멈췄다 사라지도록
    // (가장 가까운 원을 찾아 화면 밖이 아니라 현 위치에서 페이드)
    // Day 4: rock은 BAD 분기에서 처리하므로 여기서는 fish만 대상
    let closestOrbIdx = -1;
    let closestDist = Infinity;
    for (let i = 0; i < activeOrbs.length; i++) {
      const orb = activeOrbs[i];
      if (orb.kind === 'rock') continue;
      const ox = Math.abs(orb.currentX - bx);
      const oy = Math.abs(orb.currentY - by);
      const d = Math.max(ox, oy);
      if (d < closestDist) {
        closestDist = d;
        closestOrbIdx = i;
      }
    }
    if (closestOrbIdx >= 0) {
      const orb = activeOrbs[closestOrbIdx];
      // 멈춤 + 페이드 (그 자리에서)
      orb.el.classList.add('catch-orb--miss-fade');
      setTimeout(() => orb.wrapEl.remove(), 300);
      activeOrbs.splice(closestOrbIdx, 1);
    }

    // 체력 회복 (체력 깎인 상태일 때만, 풀체력이면 변동 없음)
    if (fish && fish.hpCurrent > 0 && fish.hpCurrent < fish.config.hpMax) {
      fish.hpCurrent = Math.min(fish.config.hpMax, fish.hpCurrent + 1);
      // 다음 빈 칸을 채움
      for (let i = 0; i < fish.hpCells.length; i++) {
        fish.hpCells[i].dataset.filled = (i < fish.hpCurrent) ? 'true' : 'false';
      }
      // 체력바 흔들림 (회복도 표현)
      fish.hpBarEl.classList.remove('catch-fish-item__hp--shake');
      void fish.hpBarEl.offsetWidth;
      fish.hpBarEl.classList.add('catch-fish-item__hp--shake');
    }
  }

  // 판정 잠금 + 시간 텀 (다음 원 안 나옴)
  judgeLocked = true;
  nextSpawnAt = performance.now() + JUDGE_PAUSE_MS;
  setTimeout(() => { judgeLocked = false; }, JUDGE_PAUSE_MS);
}

/* 판정 텍스트 표시 (잡기존 위에 페이드)
   ★ Day 22 Phase 5 후속 (대표 결정): perfect/nice/miss sub 폐기 (JUDGE_LABEL 에서 빈 문자열).
   BAD '-3초' 만 표시 + 빨간색 (CSS .catch-judge--bad .catch-judge__sub).
   sub 가 비어있으면 자동 숨김. opts.hideSub 는 호환성 유지 (현재는 무용지물 — JUDGE_LABEL 자체에서 비웠음). */
function showJudgeText(verdict, opts = {}) {
  if (!containerEl) return;
  const label = JUDGE_LABEL[verdict] || JUDGE_LABEL.miss;
  const el = document.createElement('div');
  el.className = `catch-judge catch-judge--${verdict}`;
  if (opts.hideSub || !label.sub) {
    el.textContent = label.main;
  } else {
    el.innerHTML = `${label.main}<span class="catch-judge__sub">${label.sub}</span>`;
  }
  containerEl.appendChild(el);
  setTimeout(() => el.remove(), 700);
}

/**
 * ★ Day 32 (대표 결정) — CRITICAL ×2 텍스트 (펑 팝업).
 *
 * 크리티컬 발동 시 호출. 위치는 물고기 체력바와 잡기존 사이 영역에서 좌우상하 랜덤.
 * 색상: #E8C870 (황금). 펑 팝업 애니메이션 (scale 0 → 1.3 → 1, rotate -8° → 3° → 0°).
 * 약 0.8초 후 자동 제거.
 *
 * ★ Day 38 후속F (대표 결정) — 화면 밖 짤림 방지:
 *   기존 left 15~85% 고정 범위 → 작은 화면에서 텍스트(약 280px) 좌우 절반이 컨테이너 밖으로 나감.
 *   변경: 텍스트 실측 후 안전 범위(half-width + 여백) 안에서만 랜덤 위치 선정 → 절대 짤리지 않음.
 *         (표시 생략은 X — 반드시 안에 들어가도록 위치를 보정해 표시)
 */
function showCriticalText() {
  if (!containerEl) return;
  const el = document.createElement('div');
  el.className = 'catch-critical';
  el.textContent = 'CRITICAL ×2';

  // 측정 위해 임시로 (50%, 50%) 위치 + visibility hidden 으로 DOM 부착
  el.style.visibility = 'hidden';
  el.style.top  = '50%';
  el.style.left = '50%';
  // ★ Day 39 (대표 결정) — followupF 가 작동 안 한 진짜 원인 수정:
  //   catch-critical-pop animation 의 0% 키프레임이 scale(0) 이라
  //   classList 적용 직후 getBoundingClientRect 가 *scaled (≒0) 박스*를 반환 →
  //   halfWidthPct ≈ 0 → 안전 범위 = 거의 0~100% → 위치 보정 효과 없음 → 화면 밖 짤림 재발.
  //   해결: 측정 직전 animation:none + transform 기본값(translate(-50%,-50%)) 명시 →
  //         scale 적용 안 된 *원본 크기* 측정 → 측정 후 animation 복귀.
  el.style.animation = 'none';
  el.style.transform = 'translate(-50%, -50%)';
  containerEl.appendChild(el);

  // 텍스트 / 컨테이너 실측 → 안전 범위 계산 (scale 무효화된 원본 크기)
  const containerRect = containerEl.getBoundingClientRect();
  const textRect = el.getBoundingClientRect();
  const SAFE_MARGIN_PCT = 2;  // 가장자리 여백 2%

  // 가로: 텍스트 절반 + 여백을 left% 양 끝에서 빼야 안 짤림
  const halfWidthPct  = (textRect.width  / 2 / containerRect.width)  * 100;
  let minLeftPct = halfWidthPct + SAFE_MARGIN_PCT;
  let maxLeftPct = 100 - halfWidthPct - SAFE_MARGIN_PCT;
  // 텍스트가 컨테이너보다 클 정도로 큰 경우 — 가운데 강제
  if (maxLeftPct < minLeftPct) {
    minLeftPct = 50;
    maxLeftPct = 50;
  }

  // 세로: 기존 30~55% 범위를 텍스트 높이 반영해 보정
  const halfHeightPct = (textRect.height / 2 / containerRect.height) * 100;
  let minTopPct = Math.max(30, halfHeightPct + SAFE_MARGIN_PCT);
  let maxTopPct = Math.min(55, 100 - halfHeightPct - SAFE_MARGIN_PCT);
  if (maxTopPct < minTopPct) {
    // 세로도 너무 큰 경우 — 가운데 강제
    minTopPct = (minTopPct + maxTopPct) / 2;
    maxTopPct = minTopPct;
  }

  const topPct  = minTopPct  + Math.random() * (maxTopPct  - minTopPct);
  const leftPct = minLeftPct + Math.random() * (maxLeftPct - minLeftPct);
  el.style.top  = `${topPct}%`;
  el.style.left = `${leftPct}%`;
  // ★ Day 39 — 측정용 inline 무력화 해제 → CSS 의 animation + transform keyframes 정상 시작
  el.style.animation = '';
  el.style.transform = '';
  el.style.visibility = 'visible';

  setTimeout(() => el.remove(), 800);
}

/* Day 4: BAD 처리 — 꽝 원 터치 시
   - 시간 -3초 (startTime 앞당김)
   - 화면 전체 붉은 번쩍 오버레이
   - 그 꽝 원은 그 자리에서 멈춤 + 페이드
   - 판정 텍스트 BAD, 잡기존 빨간 진동
   - 체력 변동 X
*/
function handleBad(rockIdx) {
  const orb = activeOrbs[rockIdx];
  if (!orb) return;

  // 1) 그 자리 멈춤 + 페이드 (다른 원 MISS와 동일한 효과 재사용)
  orb.el.classList.add('catch-orb--miss-fade');
  setTimeout(() => orb.wrapEl.remove(), 300);
  activeOrbs.splice(rockIdx, 1);

  // 2) 시간 -3초 — startTime 앞당기면 elapsed가 즉시 +3초 → 시간바 즉시 줄어듦
  startTime -= BAD_TIME_PENALTY_MS;

  // 3) 화면 전체 붉은 번쩍
  showBadFlash();

  // 4) 판정 텍스트 + 잡기존 효과
  showJudgeText('bad');
  flashButton('bad');

  // 5) 판정 잠금 (다른 판정과 동일하게 다음 원 안 나옴)
  judgeLocked = true;
  nextSpawnAt = performance.now() + JUDGE_PAUSE_MS;
  setTimeout(() => { judgeLocked = false; }, JUDGE_PAUSE_MS);

  // 시간이 -3초로 즉시 0 이하가 됐을 수도 있음 → tick에서 자연스럽게 finishGame
}

/* Day 4: 화면 전체 붉은 번쩍 오버레이 (BAD 발생 시) */
function showBadFlash() {
  if (!containerEl) return;
  const flash = document.createElement('div');
  flash.className = 'catch-game__bad-flash';
  containerEl.appendChild(flash);
  setTimeout(() => flash.remove(), 500);
}

function flashButton(kind, color) {
  buttonEl.classList.remove(
    'catch-game__button--perfect',
    'catch-game__button--nice',
    'catch-game__button--miss',
    'catch-game__button--bad'
  );
  if (color) {
    buttonEl.style.setProperty('--hit-color', color.hex);
    buttonEl.style.setProperty('--hit-glow', color.glow);
  }
  void buttonEl.offsetWidth;
  buttonEl.classList.add(`catch-game__button--${kind}`);
}

/* ============================================
   종료 / 정리
   ============================================ */

function finishGame() {
  if (gameState === 'success' || gameState === 'fail') return;

  // Day 3 변경: 사용자가 선택한 마리 1개만 결과 팝업에 포함
  // - 잡았으면 caught, 못 잡으면 missed
  // - 안 선택한 마리들은 그냥 사라짐 (결과 팝업 X) — "다 가질 수 없다" 컨셉
  // Day 4 추가: 다중 매칭 시 무게 배수 적용 (×N, N = 매칭 마리 수)
  // ★ Day 29 — 멀티히트 자동선택 도입: results.length 가 항상 1 (가장 큰 등급 1개만 진입).
  //   배수는 slot.js 에서 전달된 originalMatchCount 사용 → ×N 보상 보존.
  const caught = [];
  const missed = [];

  // 매칭 마리 수 = slot.js 전달 originalMatchCount (Day 29 이전엔 fishStates.length 였음)
  const matchCount = originalMatchCount || 1;

  const selectedFish = fishStates[selectedFishIdx];
  if (selectedFish) {
    // 잡기 성공 시에만 multiplier 적용 (놓친 건 배수 의미 X)
    if (selectedFish.hpCurrent <= 0) {
      caught.push({ ...selectedFish.result, multiplier: matchCount });
    } else {
      missed.push(selectedFish.result);
    }
  }

  gameState = caught.length > 0 ? 'success' : 'fail';

  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  setTimeout(() => {
    onCloseCallback?.({ caught, missed });
  }, 500);
}

function cleanupGame() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  activeOrbs = [];
  if (buttonEl) buttonEl.removeEventListener('click', handlePullClick);
  if (containerEl) {
    containerEl.removeEventListener('click', handleAnywhereClick);
    containerEl.removeEventListener('click', handleHiddenAnywhereClick);
  }

  // 위쪽 물고기 핸들러 정리
  fishStates.forEach(s => {
    if (s._onSelectClick && s.itemEl) {
      s.itemEl.removeEventListener('click', s._onSelectClick);
      s._onSelectClick = null;
    }
  });

  containerEl = null;
  orbContainerEl = null;
  buttonEl = null;
  resultsLayoutEl = null;
  selectMessageEl = null;
  timeFillEl = null;
  timeTextEl = null;  // ★ Day 38 후속E — 시간 텍스트 element 리셋
  fishStates = [];
  selectedFishIdx = -1;
  selectionMode = false;
  totalTimeMs = 0;
  judgeLocked = false;
  onCloseCallback = null;
  gameState = null;
  activeOpts = null; // Equipment-4c: 다음 게임 시작 시 다시 집계
  firstOrbSpawned = false;  // Day 10 후속: 다음 게임 시작 시 다시 false (첫 orb 대기)
  pendingZoneHide = false;  // ★ Day 38 후속H — 잡기존 페이드 보류 플래그 리셋
  currentSizeScale = 1.0;   // ★ Day 38 후속 — 다음 게임 진입 시 잔존 방지 (HIDDEN HIT 모드 등 selectFish 안 불리는 케이스 대비)

  // ★ Day 22 Phase 4C — HIDDEN 모드 상태 리셋
  hiddenModeActive = false;
  hiddenPhase = 'idle';
  hiddenStartTime = 0;
  hiddenTotalTimeMs = 0;
  hiddenNextSpawnAt = 0;
  hiddenSpawnCount = 0;
  hiddenPerfectCount = 0;
  hiddenCountdownEl = null;
}