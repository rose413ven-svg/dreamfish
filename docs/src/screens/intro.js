/* ===========================================
   intro.js — 4. 인트로 애니메이션 / 이미지 (스킵불가)
   ============================================
   부트스트랩 [화면 흐름] 4단계. 첫 실행 분기.
   실제 빌드: 인트로 애니/이미지 (내용 미정).
   ============================================ */

import { navigate, Screen } from '../core/router.js';
import { buildStubScreen } from './_stub-helper.js';

let dispose = null;

export default {
  mount(el) {
    const stub = buildStubScreen({
      label: 'STEP 4 / 9 — INTRO',
      title: '인트로',
      boxText: '인트로 애니/이미지',
      hint: '내용은 추후 결정. 스킵 불가.',
      onNext: () => navigate(Screen.TUTORIAL),
    });
    dispose = stub.dispose;
    el.appendChild(stub.root);
  },
  unmount() {
    dispose?.();
    dispose = null;
  },
};
