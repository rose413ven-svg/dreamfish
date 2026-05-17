/* ===========================================
   router.js — 화면 라우팅 골격
   ============================================
   부트스트랩 [화면 흐름]의 9개 화면 간 전환을 관리.
   각 화면 모듈은 { mount(container), unmount() } 인터페이스를 따름.
   Phase 0에서는 골격만, 실제 화면 연결은 Phase 1.
   ============================================ */

import { fadeOut, fadeIn } from './transition.js';

/**
 * 화면 키 상수
 * 부트스트랩 [화면 흐름]과 1:1 대응.
 */
export const Screen = Object.freeze({
  SPLASH:      'splash',       // 1. 회사 로고
  START:       'start',        // 2. 시작 화면 (구글 로그인)
  NICKNAME:    'nickname',     // 3. 닉네임 정하기
  INTRO:       'intro',        // 4. 인트로 애니/이미지
  TUTORIAL:    'tutorial',     // 5. 튜토리얼 슬롯
  AWAKENING:   'awakening',    // 6. 잠 깨기
  STAGE_MAP:   'stage-map',    // 7. 낚시터 전체 맵
  STAGE_INTRO: 'stage-intro',  // 8. 낚시터별 인트로
  SLOT:        'slot',         // 9. 슬롯 (메인 게임플레이)

  // Bag-3: 가방에서 진입하는 화면들 (현재 stub)
  ENHANCE:     'enhance',      // 강화
  COMPOSE:     'compose',      // 합성
  CODEX:       'codex',        // 도감
});

/** 등록된 화면 모듈: { [key]: { mount, unmount } } */
const screens = new Map();

/** 현재 활성 화면 */
let currentKey = null;
let currentModule = null;

/** 라우터가 그릴 컨테이너 (보통 #app) */
let rootContainer = null;

/** 화면 전환 진행 중 가드 — 연타 시 fadeSwap 중첩 방지 (Day 12 — 깜박임 해결) */
let _isNavigating = false;

/**
 * 라우터 초기화
 * @param {HTMLElement} container
 */
export function initRouter(container) {
  rootContainer = container;
}

/**
 * 화면 모듈 등록
 * @param {string} key   Screen.* 중 하나
 * @param {{ mount: (el: HTMLElement, params?: object) => void | Promise<void>, unmount?: () => void | Promise<void> }} module
 */
export function registerScreen(key, module) {
  screens.set(key, module);
}

/**
 * 화면 전환 (페이드아웃 → 교체 → 페이드인)
 *
 * Day 13 변경 ★ — 대표 보고 (다음 버튼 두 번 눌러야 넘어가는 문제 수정).
 *   기존: _isNavigating = true 가 fadeSwap (fadeOut + swap + fadeIn) 끝날 때까지 유지.
 *        → 페이드인 700ms 도중에 사용자가 새 화면의 "다음" 클릭해도 가드에 걸려 무시.
 *        → 사용자 체감 "두 번 눌러야 함".
 *   변경: fadeOut + swap (mount 끝) 까지만 잠금 → mount 끝나자마자 _isNavigating = false.
 *        페이드인은 await 안 하고 비차단으로 진행 → 페이드인 도중 클릭도 받음.
 *
 * @param {string} key      Screen.* 중 하나
 * @param {object} [params] 다음 화면에 넘길 파라미터
 */
export async function navigate(key, params = {}) {
  // 연타 가드: 이미 fadeOut + mount 진행 중이면 무시 (페이드인 중에는 false 라 통과)
  if (_isNavigating) return;
  if (!rootContainer) {
    throw new Error('[router] initRouter() 먼저 호출되어야 합니다.');
  }
  const next = screens.get(key);
  if (!next) {
    throw new Error(`[router] 등록되지 않은 화면: ${key}`);
  }

  _isNavigating = true;
  try {
    // 1) 페이드아웃 (350ms) — 사용자에게 "눌렸다" 즉각 인지
    await fadeOut(rootContainer);

    // 2) 화면 교체 (unmount → DOM 클리어 → mount)
    if (currentModule?.unmount) {
      await currentModule.unmount();
    }
    rootContainer.innerHTML = '';
    await next.mount(rootContainer, params);
    currentKey = key;
    currentModule = next;
  } catch (e) {
    _isNavigating = false;
    throw e;
  }

  // 3) 잠금 해제 ★ — mount 끝났으니 다음 클릭 받을 수 있음
  _isNavigating = false;

  // 4) 페이드인 (700ms) — 비차단 (await 안 함). 사용자가 페이드인 도중 클릭하면
  //    새 navigate 호출 → 새 fadeOut 시작 → 컨테이너 transition 자동으로 갱신.
  fadeIn(rootContainer);
}

/** 현재 화면 키 반환 */
export function getCurrentScreen() {
  return currentKey;
}