/* ===========================================
   nickname.js — 3. 닉네임 정하기
   ============================================
   부트스트랩 [화면 흐름] 3단계.
   첫 실행 분기에서만 거치는 화면.
   ============================================ */

import { navigate, Screen } from '../core/router.js';
import { buildStubScreen } from './_stub-helper.js';

let dispose = null;

export default {
  mount(el) {
    const stub = buildStubScreen({
      label: 'STEP 3 / 9 — NICKNAME',
      title: '닉네임 정하기',
      boxText: '입력 폼 자리',
      hint: '실제 빌드에서는 닉네임 입력 후 저장합니다.',
      onNext: () => navigate(Screen.INTRO),
    });
    dispose = stub.dispose;
    el.appendChild(stub.root);
  },
  unmount() {
    dispose?.();
    dispose = null;
  },
};
