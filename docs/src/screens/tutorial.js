/* ===========================================
   tutorial.js — 5. 튜토리얼 슬롯
   ============================================
   부트스트랩 [화면 흐름] 5단계.
   실제 빌드: 황금 가중치 0%인 5턴 튜토리얼 슬롯.
   ============================================ */

import { navigate, Screen } from '../core/router.js';
import { buildStubScreen } from './_stub-helper.js';

let dispose = null;

export default {
  mount(el) {
    const stub = buildStubScreen({
      label: 'STEP 5 / 9 — TUTORIAL',
      title: '튜토리얼 슬롯',
      boxText: '튜토 슬롯 자리',
      hint: '튜토 5턴 동안 황금 물고기 가중치 0%.',
      onNext: () => navigate(Screen.AWAKENING),
    });
    dispose = stub.dispose;
    el.appendChild(stub.root);
  },
  unmount() {
    dispose?.();
    dispose = null;
  },
};
