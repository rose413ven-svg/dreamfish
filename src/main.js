/* ===========================================
   main.js — 엔트리 포인트
   ============================================
   DOM 준비 후 라우터 초기화 → 9개 화면 모듈 등록 → 첫 화면 진입.
   첫 실행 / 재실행 분기는 각 화면 내부 (start.js 등) 에서 결정.
   main.js 는 항상 SPLASH 로 시작.

   Resp-1: 반응형 기본 단위(--unit) 초기화 추가.
   ============================================ */

import { initRouter, registerScreen, navigate, Screen } from './core/router.js';
import { initResponsive } from './core/responsive.js';

import splash      from './screens/splash.js';
import start       from './screens/start.js';
import nickname    from './screens/nickname.js';
import intro       from './screens/intro.js';
import tutorial    from './screens/tutorial.js';
import awakening   from './screens/awakening.js';
import stageMap    from './screens/stage-map.js';
import stageIntro  from './screens/stage-intro.js';
import slot        from './screens/slot.js';

// Bag-3: 가방에서 진입하는 stub 화면들
import enhance     from './screens/enhance.js';
import compose     from './screens/compose.js';
import codex       from './screens/codex.js';

function boot() {
  const app = document.getElementById('app');
  if (!app) {
    console.error('[main] #app 컨테이너를 찾을 수 없습니다.');
    return;
  }

  // ★ 반응형 단위 초기화 (라우터보다 먼저 — 첫 화면 렌더 전에 --unit 확정)
  initResponsive();

  initRouter(app);

  registerScreen(Screen.SPLASH,      splash);
  registerScreen(Screen.START,       start);
  registerScreen(Screen.NICKNAME,    nickname);
  registerScreen(Screen.INTRO,       intro);
  registerScreen(Screen.TUTORIAL,    tutorial);
  registerScreen(Screen.AWAKENING,   awakening);
  registerScreen(Screen.STAGE_MAP,   stageMap);
  registerScreen(Screen.STAGE_INTRO, stageIntro);
  registerScreen(Screen.SLOT,        slot);

  // Bag-3: 가방 컨텍스트 메뉴에서 진입
  registerScreen(Screen.ENHANCE,     enhance);
  registerScreen(Screen.COMPOSE,     compose);
  registerScreen(Screen.CODEX,       codex);

  navigate(Screen.SPLASH);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}