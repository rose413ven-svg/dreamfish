/* ===========================================
   start.js — 2. 시작 화면 (구글 로그인 + 시작하기)
   ============================================
   부트스트랩 [화면 흐름] 2단계.
   첫 실행: → NICKNAME
   재실행: → STAGE_MAP (자동 스킵 가능)
   ============================================ */

import { navigate, Screen } from '../core/router.js';
import { isFirstRun } from '../core/storage.js';
import { buildStubScreen } from './_stub-helper.js';

let dispose = null;

export default {
  mount(el) {
    const firstRun = isFirstRun();
    const next = firstRun ? Screen.NICKNAME : Screen.STAGE_MAP;

    const stub = buildStubScreen({
      label: 'STEP 2 / 9 — START',
      title: '시작 화면',
      boxText: '구글 로그인 / 시작',
      hint: firstRun
        ? '첫 실행 흐름 — 다음은 닉네임 입력입니다.'
        : '재실행 흐름 — 다음은 낚시터 맵으로 바로 이동합니다.',
      onNext: () => navigate(next),
    });
    dispose = stub.dispose;
    el.appendChild(stub.root);
  },
  unmount() {
    dispose?.();
    dispose = null;
  },
};
