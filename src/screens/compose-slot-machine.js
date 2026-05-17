/* ===========================================
   compose-slot-machine.js — 슬롯머신 연출 모듈 (Day 12 Phase 2b)
   ============================================
   합성 화면의 재료 슬롯 영역이 spinning 진입 시 이 모듈로 교체.
   compose.js 와 분리 — 슬롯머신 로직 캡슐화 (모듈화 + 유지보수).

   타이밍 (대표 결정):
     - 모든 슬롯 동시 회전 시작
     - 1~(N-1)번째 = 자동 정지 (FIRST_STOP_MS + i*STOP_INTERVAL_MS)
     - (N-1)번째 정지 후 분기:
       * 1~(N-1) 모두 황금 → onLastReady 콜백 (STOP 버튼 활성)
       * 1~(N-1) 중 회색 → onAutoFail 콜백 + AUTO_LAST_MS 후 마지막 자동 정지
     - STOP 버튼 클릭 → stopLastSlow() (SLOW_STOP_MS 천천히 감속 → 정지)
     - 모든 슬롯 정지 + bounce 끝 → onAllStop 콜백

   ★ Day 25 (대표 결정) ★ — 타이밍 단축 (느린 진행 개선):
     - FIRST_STOP_MS:    3000 → 1500
     - STOP_INTERVAL_MS: 1500 → 500
     - AUTO_LAST_MS:     1500 → 500
     - SLOW_STOP_MS:     5000 → 3000
     - RESULT_VISIBLE_MS: 1200 (유지)

   ★ Day 25 (대표 결정) ★ — 반전 등장 효과 (surpriseReveal):
     - 마지막 슬롯 실제 결과가 'gold' 이고 호출 측이 surpriseReveal:true 전달 시 발동.
     - 감속 중에는 'gray' 심볼로 표시 → 정지 → 잠시 회색 → 번쩍 → 황금으로 교체.
     - 호출 측 (compose.js) 에서 랜덤 결정 (데이터-엔진 분리).

   슬롯 디자인:
     - 회전 = strip translateY(-50%) 무한 (황금/회색 12개 반복)
     - 정지 = strip 비우고 결과 심볼 1개 + bounce
     - 황금 = bounce + 글로우 무한 펄스
     - 회색 = bounce + 짧은 흔들림 + 어두워짐

   데이터-엔진 분리: slotResults 는 호출측에서 결정 (rollSlotResults).
                     이 모듈은 시각 연출만 담당.
   ============================================ */

import { renderFishSVG } from '../ui/fish-svg.js';

const COLOR_GOLD = '#E8C870';
const COLOR_GRAY = '#8a9cc0';

const TIMING = Object.freeze({
  // ★ Day 25 (대표 결정 — 재조정): 너무 빠르지도 느리지도 않게
  FIRST_STOP_MS:    2000,   // 1번째 슬롯 정지까지 대기 (1500 → 2000)
  STOP_INTERVAL_MS: 1000,   // 슬롯 간 정지 간격 (500 → 1000)
  AUTO_LAST_MS:     1000,   // (자동 실패) 마지막 슬롯 자동 정지 대기 (500 → 1000)
  SLOW_STOP_MS:     3000,   // STOP 버튼 후 마지막 슬롯 감속 시간 (유지)
  RESULT_VISIBLE_MS: 1200,  // 결과 심볼 또렷 시간 (유지)
  BOUNCE_LATENCY:   600,    // 자동 실패용 결과 심볼 bounce 끝까지 대기
  // ★ Day 25 — 반전 효과 단계 타이밍 (surpriseReveal 발동 시)
  SURPRISE_GRAY_HOLD_MS:  450,   // 감속 끝 → 회색으로 잠시 보이는 시간
  SURPRISE_FLASH_MS:      400,   // 번쩍 + 심볼 교체 효과 시간
});

/**
 * 슬롯머신 인스턴스 생성.
 *
 * @param {object}   opts
 * @param {string[]} opts.slotResults — ['gold','gold','gold','gold'] 또는 ['gold','gold'] 등
 * @param {() => void} [opts.onLastReady] — (N-1)번째 정지 후 모두 황금일 때 호출 (STOP 버튼 활성)
 * @param {() => void} [opts.onAutoFail]  — (N-1)번째 정지 후 회색 발생 시 호출 (자동 정지 모드)
 * @param {() => void} [opts.onResultStable] — Day 13 신규 ★: 마지막 슬롯 감속 끝난 시점 호출.
 *                                              compose.js 가 phase 를 'decelerating' → 'result-show'
 *                                              로 변경 → CSS dim 룰 회피 → 결과 심볼이 또렷하게 보임.
 * @param {() => void} [opts.onAllStop]   — 모든 슬롯 정지 + 결과 또렷 시간 끝 시 호출 (reveal 진입)
 * @param {boolean}    [opts.surpriseReveal] — ★ Day 25 — 반전 등장 효과 발동 여부 (true 면 마지막 슬롯이 회색 → 번쩍 → 황금)
 * @returns {{ root: HTMLElement, stopLastSlow: () => void, dispose: () => void }}
 */
export function createSlotMachine({ slotResults, onLastReady, onAutoFail, onResultStable, onAllStop, surpriseReveal = false }) {
  const N = slotResults.length;
  /** @type {HTMLElement[]} */
  const slotEls = [];
  /** @type {ReturnType<typeof setTimeout>[]} */
  const timers = [];
  let disposed = false;
  let lastAlreadyStopped = false;

  // 루트 — 기존 .compose-slots 스타일 재사용 (data-count 동일 패턴)
  const root = document.createElement('div');
  root.className = 'compose-slots compose-slots--spinning';
  root.dataset.count = String(N);

  // 슬롯 N개 빌드 + 회전 시작
  for (let i = 0; i < N; i++) {
    const slotEl = buildSpinningSlot(i);
    slotEls.push(slotEl);
    root.appendChild(slotEl);
    startSpin(slotEl);
  }

  // 1~(N-1)번째 자동 정지 타이머
  for (let i = 0; i < N - 1; i++) {
    const t = setTimeout(() => stopOne(i), TIMING.FIRST_STOP_MS + i * TIMING.STOP_INTERVAL_MS);
    timers.push(t);
  }

  /** 슬롯 1개 정지 (1~N-1번째용) */
  function stopOne(i) {
    if (disposed) return;
    const slotEl = slotEls[i];
    const result = slotResults[i];
    stopSpin(slotEl, result);

    // (N-1)번째 정지 후 분기
    if (i === N - 2) {
      const allGoldSoFar = slotResults.slice(0, N - 1).every(r => r === 'gold');
      if (allGoldSoFar) {
        // 모두 황금 → STOP 버튼 활성화 (마지막은 사용자 조작)
        if (onLastReady) onLastReady();
      } else {
        // 회색 발생 → 자동 정지 모드
        if (onAutoFail) onAutoFail();
        const t = setTimeout(() => stopLastNormal(), TIMING.AUTO_LAST_MS);
        timers.push(t);
      }
    }
  }

  /** 마지막 슬롯 자동 정지 (회색 발생 시) */
  function stopLastNormal() {
    if (disposed || lastAlreadyStopped) return;
    lastAlreadyStopped = true;
    const slotEl = slotEls[N - 1];
    stopSpin(slotEl, slotResults[N - 1]);
    // bounce 끝나면 onAllStop
    const t = setTimeout(() => onAllStop && onAllStop(), TIMING.BOUNCE_LATENCY);
    timers.push(t);
  }

  /**
   * 마지막 슬롯 천천히 감속 정지 (STOP 버튼 클릭 시 외부에서 호출).
   *
   * 정통 슬롯머신 감속 패턴 (대표 요청 — 쫄깃하게 점점 멈추기):
   *   1. 회전 중 strip 의 현재 transform 위치 캡처 (점프 방지)
   *   2. 회전 애니메이션 정지 + 위치 그대로 유지
   *   3. strip 끝에 결과 심볼 추가 (12개 + 결과 = 13개)
   *   4. CSS transition 으로 결과 심볼 위치까지 천천히 이동 (cubic-bezier 강한 ease-out)
   *      → 처음 빠르게, 끝에 매우 느림 (마지막 1초 동안 한 두 심볼만 지나감)
   *   5. 도중에 황금/회색 심볼이 윈도우를 천천히 지나감 (motion blur 점진 감소 — CSS)
   *   6. 결과 심볼에서 정확히 멈춤 (점프 X) → final 효과 부여
   */
  function stopLastSlow() {
    if (disposed || lastAlreadyStopped) return;
    lastAlreadyStopped = true;
    const slotEl = slotEls[N - 1];
    const strip = slotEl.querySelector('.compose-spin-strip');
    const result = slotResults[N - 1];
    if (!strip) return;

    // ★ Day 25 — 반전 등장 효과 발동 여부 결정
    //   실제 결과가 'gold' 이고 호출 측이 surpriseReveal:true 인 경우에만 발동.
    //   감속 중에는 'gray' 심볼로 표시 → 정지 → 잠시 회색 → 번쩍 → 황금으로 교체.
    const useSurprise = surpriseReveal && result === 'gold';
    const displayDuringDecel = useSurprise ? 'gray' : result;

    // 1. 회전 중 strip 의 현재 transform 위치 캡처 (matrix 에서 ty 추출)
    let currentY = 0;
    try {
      const computed = (typeof getComputedStyle === 'function') ? getComputedStyle(strip) : null;
      const tv = computed && computed.transform;
      if (tv && tv !== 'none') {
        const m = tv.match(/matrix(?:3d)?\(([^)]+)\)/);
        if (m) {
          const values = m[1].split(',').map(v => parseFloat(v.trim()));
          // 2D matrix(a,b,c,d,tx,ty) → ty = values[5]
          // 3D matrix3d(...) → ty = values[13]
          if (values.length === 6)       currentY = values[5]  || 0;
          else if (values.length === 16) currentY = values[13] || 0;
        }
      }
    } catch (_) { /* getComputedStyle 미지원 환경 — 0 fallback */ }

    // 2. 회전 애니메이션 정지 + 현재 위치 그대로 (점프 방지)
    strip.style.animation = 'none';
    strip.style.transform = `translateY(${currentY}px)`;

    // 3. 결과 심볼을 strip 끝에 추가 (마지막 = 결과)
    //   ★ Day 25 — 반전 효과 발동 시: 감속 중에는 'gray' 심볼로 페이크 표시
    const resultSymbol = createSymbolEl(displayDuringDecel);
    strip.appendChild(resultSymbol);

    // 4. 셀에 decelerating 클래스 (CSS — motion blur 점진 감소 + 글로우)
    slotEl.classList.add('compose-spin-cell--decelerating');

    // 5. 결과 심볼이 윈도우 가운데에 정확히 위치하려면
    //    Day 14 ★ 버그픽스 (대표 보고 — 멈춤 누르면 슬롯 심볼 사라지고 결과 심볼도 안 보임):
    //    .compose-spin-window 는 display:flex + align-items:center → strip 의 가운데가 window 가운데.
    //    strip 자식 N 개일 때 strip 가운데 = (N-1)/2 인덱스. 결과 심볼 = (N-1) 인덱스.
    //    결과를 window 가운데에 두려면 strip 이 ((N-1) - (N-1)/2) = (N-1)/2 cellSize 만큼 위로 이동.
    //    이전 버그: -(symbolCount - 1) * cellSize → 정확히 2배 멀리 이동 → 결과 심볼이 window 위쪽 한참 위로 사라짐.
    //    수정: -((symbolCount - 1) / 2) * cellSize → 결과 심볼이 정확히 window 가운데에 정지.
    const cellSize = slotEl.offsetHeight || (N === 2 ? 144 : 112);  // 폴백 (9rem 또는 7rem)
    const symbolCount = strip.children.length;
    const targetY = -((symbolCount - 1) / 2) * cellSize;

    // 6. 다음 프레임에 transition + transform 적용 (점진 감속)
    //    Day 14 ★ 통과속도 더 느리게 (대표 결정 — 마지막 심볼 더 천천히 멈추는 긴장감):
    //    cubic-bezier(0.08, 0.4, 0.18, 1) → (0.04, 0.5, 0.1, 1) — 더 강한 ease-out.
    //    처음 더 빠르게 휙 지나가고 마지막 1~2 심볼은 더 길게 천천히 멈춤.
    const raf = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame
      : (fn) => setTimeout(fn, 16);
    raf(() => {
      if (disposed) return;
      strip.style.transition = `transform ${TIMING.SLOW_STOP_MS}ms cubic-bezier(0.04, 0.5, 0.1, 1)`;
      strip.style.transform = `translateY(${targetY}px)`;
    });

    // 7. SLOW_STOP_MS 후:
    //    Day 13 변경 ★: 결과 클래스 부착 전에 phase 를 'result-show' 로 먼저 바꿈 (onResultStable).
    //    이유: CSS rule [data-phase="decelerating"] .compose-spin-cell--gold { filter: brightness(0.55) ...} 가
    //          마지막 슬롯의 결과를 어둡게 만들어 안 보이게 했던 버그 해결.
    //    흐름: SLOW_STOP_MS 도달
    //          → onResultStable (compose.js 가 phase 'result-show' 로 변경)
    //          → next frame 에 결과 class 부착 + 심볼 final 효과
    //          → RESULT_VISIBLE_MS 동안 결과 또렷하게 보임
    //          → onAllStop (compose.js 가 reveal overlay 빌드 + phase 'result')
    //
    //    ★ Day 25 — useSurprise 분기:
    //          → 회색 'gray' class + final 효과 부착
    //          → SURPRISE_GRAY_HOLD_MS 동안 회색 상태 (실패처럼 보임)
    //          → 번쩍 (surprise-flash) + 심볼 교체 (gray → gold) + 셀 class 전환
    //          → SURPRISE_FLASH_MS 동안 황금 또렷
    //          → RESULT_VISIBLE_MS 후 onAllStop
    const t1 = setTimeout(() => {
      if (disposed) return;
      // 1. phase 변경 신호 (CSS dim 룰 회피)
      if (onResultStable) onResultStable();
      // 2. 다음 프레임에 결과 class 부착 (phase 변경이 DOM 에 적용된 후)
      raf(() => {
        if (disposed) return;
        slotEl.classList.remove('compose-spin-cell--decelerating');
        slotEl.classList.remove('compose-spin-cell--spinning');

        if (useSurprise) {
          // ── ★ Day 25 반전 분기 ──
          // 1) 회색 class 부착 → 사용자 시점: "어... 실패네"
          slotEl.classList.add('compose-spin-cell--gray');
          resultSymbol.classList.add('compose-spin-symbol--final');

          // 2) SURPRISE_GRAY_HOLD_MS 후 → 번쩍 + 황금 교체
          const tFlash = setTimeout(() => {
            if (disposed) return;
            // 번쩍 효과 부착 (셀 전체에 흰 광채)
            slotEl.classList.add('compose-spin-cell--surprise-flash');

            // 번쩍 중간 (FLASH 시간의 절반) 시점에 심볼/셀 class 교체
            const tSwap = setTimeout(() => {
              if (disposed) return;
              // strip 비우고 황금 심볼로 교체 + transform 0 (가운데 위치)
              while (strip.firstChild) strip.removeChild(strip.firstChild);
              strip.style.transition = '';
              strip.style.transform  = 'translateY(0)';
              const goldSymbol = createSymbolEl('gold');
              goldSymbol.classList.add('compose-spin-symbol--final');
              goldSymbol.classList.add('compose-spin-symbol--surprise-revealed');
              strip.appendChild(goldSymbol);
              // 셀 class 회색 → 황금 전환
              slotEl.classList.remove('compose-spin-cell--gray');
              slotEl.classList.add('compose-spin-cell--gold');
            }, TIMING.SURPRISE_FLASH_MS * 0.45);
            timers.push(tSwap);

            // 번쩍 효과 종료 + RESULT_VISIBLE_MS 후 onAllStop
            const tEnd = setTimeout(() => {
              if (disposed) return;
              slotEl.classList.remove('compose-spin-cell--surprise-flash');
              const tFinal = setTimeout(() => onAllStop && onAllStop(), TIMING.RESULT_VISIBLE_MS);
              timers.push(tFinal);
            }, TIMING.SURPRISE_FLASH_MS);
            timers.push(tEnd);
          }, TIMING.SURPRISE_GRAY_HOLD_MS);
          timers.push(tFlash);
        } else {
          // ── 일반 분기 (기존 동작) ──
          slotEl.classList.add(`compose-spin-cell--${result}`);
          resultSymbol.classList.add('compose-spin-symbol--final');
          const t2 = setTimeout(() => onAllStop && onAllStop(), TIMING.RESULT_VISIBLE_MS);
          timers.push(t2);
        }
      });
    }, TIMING.SLOW_STOP_MS);
    timers.push(t1);
  }

  /** 정리 — 타이머/애니메이션 모두 해제 */
  function dispose() {
    disposed = true;
    for (const t of timers) clearTimeout(t);
    timers.length = 0;
  }

  return { root, stopLastSlow, dispose };
}

/* ============================================
   내부 헬퍼
   ============================================ */

function buildSpinningSlot(index) {
  const cell = document.createElement('div');
  cell.className = 'compose-spin-cell';
  cell.dataset.index = String(index);

  const window = document.createElement('div');
  window.className = 'compose-spin-window';
  cell.appendChild(window);

  const strip = document.createElement('div');
  strip.className = 'compose-spin-strip';
  window.appendChild(strip);

  return cell;
}

function startSpin(slotEl) {
  const strip = slotEl.querySelector('.compose-spin-strip');
  if (!strip) return;
  // 황금/회색 반복 12개 (translateY -50% 무한 회전 = 6 + 6 동일 패턴)
  // 시작 위치 약간 랜덤 → 슬롯마다 비동기 느낌
  while (strip.firstChild) strip.removeChild(strip.firstChild);
  for (let i = 0; i < 12; i++) {
    strip.appendChild(createSymbolEl(i % 2 === 0 ? 'gold' : 'gray'));
  }
  // 시작 phase 약간 랜덤
  const startOffset = Math.floor(Math.random() * 100);
  strip.style.animationDelay = `-${startOffset}ms`;
  slotEl.classList.add('compose-spin-cell--spinning');
}

function stopSpin(slotEl, result) {
  slotEl.classList.remove('compose-spin-cell--spinning', 'compose-spin-cell--decelerating');
  slotEl.classList.add(`compose-spin-cell--${result}`);  // gold / gray modifier
  const strip = slotEl.querySelector('.compose-spin-strip');
  if (!strip) return;
  while (strip.firstChild) strip.removeChild(strip.firstChild);
  strip.style.animationDelay = '';

  const final = createSymbolEl(result);
  final.classList.add('compose-spin-symbol--final');
  strip.appendChild(final);
}

function createSymbolEl(type) {
  const el = document.createElement('div');
  el.className = `compose-spin-symbol compose-spin-symbol--${type}`;
  const color = type === 'gold' ? COLOR_GOLD : COLOR_GRAY;
  el.innerHTML = renderFishSVG({ color, size: 0.6 }, 1);
  return el;
}