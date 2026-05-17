/* ===========================================
   responsive.js — 반응형 기본 단위 갱신기 (B 방식)
   ============================================
   역할: 화면 가로에 맞춰 <html> 의 font-size 를 동적 갱신.
         그 결과 모든 rem 단위가 화면 비율에 자동 비례됨.

   원리:
     1rem 기준값 = 10px @ 기준 화면 (가로 390px)

     화면 가로 / 390 * 10 = 현재 1rem 의 px 환산값
       360px 폰    →  1rem ≈  9.23px (살짝 축소)
       390px 폰    →  1rem  = 10.00px (기준)
       412px 폰    →  1rem ≈ 10.56px (살짝 확대)
       540px 태블릿 →  1rem ≈ 13.85px (cap 적용 후 확대)

   사용자(=대표님 + Claude)는 CSS에서 그냥 rem 단위로 작성:

     padding: 2.2rem 1.8rem;    # = 22px 18px @ 기준 화면
     font-size: 1.4rem;         # = 14px @ 기준 화면
     width: 11.2rem;            # = 112px @ 기준 화면

   변환 공식:  px값 ÷ 10 = rem값  (소수점 한 자리 옮김)

   호출 시점:
     main.js boot() 에서 1회 init().
     resize / orientationchange 에서 자동 갱신.

   원칙:
     - 단일 책임 (이 모듈은 html font-size 만 다룸)
     - DOM 의존 없음 (window + documentElement)
   =========================================== */

// 기준 가로 (px). reset.css 의 max-w 와 함께 비율 계산 기준
const BASE_W = 390;

// 컨테이너 최대 가로 (px). reset.css 의 --max-w 와 일치해야 함
const MAX_W = 540;

// 1rem 의 기준 px값 (= 10px @ 기준 화면).
// 이 값을 바꾸면 모든 rem 의 의미가 일괄 스케일됨.
const REM_BASE = 10;

// 디버그 로그 (개발 중에만 true)
const DEBUG = false;

// 갱신 중복 호출 방지용 rAF 핸들
let rafHandle = 0;

/**
 * <html> 의 font-size 를 화면 사이즈에 맞춰 갱신.
 * 결과적으로 모든 rem 단위가 자동으로 화면 비율 따라감.
 */
function update() {
  rafHandle = 0;

  // 실제 컨테이너 가로 = min(window.innerWidth, MAX_W)
  // window.innerWidth 는 safe-area 미반영(전체 뷰포트). #app 의 컨텐츠 영역은
  // safe-area-inset-left/right 만큼 줄어들지만, 폰 세로모드에서는 보통 0.
  const w = Math.min(window.innerWidth, MAX_W);
  const fontSize = (w / BASE_W) * REM_BASE;

  document.documentElement.style.fontSize = `${fontSize}px`;

  if (DEBUG) {
    console.log('[responsive]', {
      innerWidth: window.innerWidth,
      effectiveWidth: w,
      fontSize: fontSize.toFixed(3) + 'px',
      remEquivalent: '1rem ≈ ' + fontSize.toFixed(2) + 'px',
    });
  }
}

// rAF 로 묶어서 resize 폭주 방지
function scheduleUpdate() {
  if (rafHandle) return;
  rafHandle = requestAnimationFrame(update);
}

/**
 * 초기화: 1회 update + resize/orientationchange 리스너 등록.
 * main.js boot() 에서 호출.
 */
export function initResponsive() {
  update();
  window.addEventListener('resize', scheduleUpdate, { passive: true });
  window.addEventListener('orientationchange', scheduleUpdate, { passive: true });
}