/* ===========================================
   splash.js — 1. 회사 로고 (드림퀘스트)
   ============================================
   부트스트랩 [화면 흐름] 1단계.
   실제 빌드: 자동 페이드 1.5~2초 후 자동 전환.
   Phase 1 stub: "다음" 버튼으로 수동 진행.
   ============================================ */

import { navigate, Screen } from '../core/router.js';
import { buildStubScreen } from './_stub-helper.js';

let dispose = null;

export default {
  mount(el) {
    const stub = buildStubScreen({
      label: 'STEP 1 / 9 — SPLASH',
      title: '회사 로고',
      boxText: '드림퀘스트',
      hint: '실제 빌드에서는 1.5~2초 자동 페이드 후 다음 화면으로 자동 전환됩니다.',
      onNext: () => navigate(Screen.START),
    });
    dispose = stub.dispose;
    el.appendChild(stub.root);
  },
  unmount() {
    dispose?.();
    dispose = null;
  },
};
