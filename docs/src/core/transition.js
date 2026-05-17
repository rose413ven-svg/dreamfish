/* ===========================================
   transition.js — 페이드인 / 페이드아웃
   ============================================
   부트스트랩 [화면 흐름] 규칙: 모든 화면 전환 = 페이드인/아웃.
   순수 DOM 조작만 담당. 라우팅 로직은 router.js.

   Day 13 변경 ★ — 대표 결정 (다음 버튼 반응 지연 수정).
   기존: fadeOut/fadeIn 동일 1000ms → 버튼 클릭 후 1초간 화면 변화 X
        → 사용자에게 "안 눌리는 것처럼" 느껴짐 (인지된 지연 = 1초+)
   변경: fadeOut 350ms (즉각 반응) / fadeIn 700ms (부드러운 등장).
        총 약 1.05초로 줄어들면서 클릭 즉시 화면이 빠르게 사라져 "눌림" 인지.
   ============================================ */

/** 페이드아웃 기본 시간 — 빠르게 (사용자 클릭 후 즉각 반응) */
const DEFAULT_FADE_OUT_MS = 350;

/** 페이드인 기본 시간 — 부드럽게 (새 화면 자연스러운 등장) */
const DEFAULT_FADE_IN_MS = 700;

/**
 * 엘리먼트를 페이드인 (opacity 0 → 1)
 *
 * Day 13 변경 ★ — RAF 패턴 제거 (router 의 비차단 호출과 안전 호환).
 *   기존: transition='none' + opacity='0' → RAF → transition 갱신 → RAF → opacity '1'
 *        → 비동기 RAF 콜백이 router 의 다음 fadeOut transition 을 덮어쓰는 잠재 충돌.
 *   변경: 동기적으로 transition 갱신 + opacity '1' 설정. 첫 호출 (opacity 가 1 또는 미설정)
 *        시에는 강제 리플로우로 0 으로 만든 후 transition (페이드인 효과 보장).
 *
 * @param {HTMLElement} el
 * @param {number} [duration=700]
 * @returns {Promise<void>}
 */
export function fadeIn(el, duration = DEFAULT_FADE_IN_MS) {
  return new Promise((resolve) => {
    if (!el) {
      resolve();
      return;
    }

    // 현재 opacity 가 1 (또는 미설정 = 자연 1) 이면 0 으로 강제 후 페이드인.
    // fadeOut 직후 호출되는 경우 (가장 일반) 는 이미 0 이라 그대로 진행.
    const cur = el.style.opacity;
    if (cur === '' || parseFloat(cur) > 0.01) {
      el.style.transition = 'none';
      el.style.opacity = '0';
      // 강제 리플로우 — 다음 transition 갱신이 0 → 1 로 보이도록.
      void el.offsetWidth;
    }

    el.style.transition = `opacity ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    el.style.opacity = '1';

    setTimeout(resolve, duration);
  });
}

/**
 * 엘리먼트를 페이드아웃 (opacity 1 → 0)
 * @param {HTMLElement} el
 * @param {number} [duration=350]
 * @returns {Promise<void>}
 */
export function fadeOut(el, duration = DEFAULT_FADE_OUT_MS) {
  return new Promise((resolve) => {
    if (!el) {
      resolve();
      return;
    }

    el.style.transition = `opacity ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    el.style.opacity = '0';

    setTimeout(resolve, duration);
  });
}

/**
 * 페이드아웃 → 콜백 실행 → 페이드인을 한 번에 처리.
 * 화면 전환 시 사용 (router.js → navigate).
 *
 * Day 13 — fadeOut 짧게 / fadeIn 부드럽게 분리 (대표 결정).
 *
 * @param {HTMLElement} container
 * @param {() => void | Promise<void>} swap   교체 시점에 실행할 함수
 * @param {number} [fadeOutMs=350]
 * @param {number} [fadeInMs=700]
 * @returns {Promise<void>}
 */
export async function fadeSwap(container, swap, fadeOutMs = DEFAULT_FADE_OUT_MS, fadeInMs = DEFAULT_FADE_IN_MS) {
  await fadeOut(container, fadeOutMs);
  await swap();
  await fadeIn(container, fadeInMs);
}