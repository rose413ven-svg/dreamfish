/* ===========================================
   awakening.js — 6. 잠 깨기 (인트로 애니/이미지)
   ============================================
   부트스트랩 [화면 흐름] 6단계 (첫 실행 분기 마지막 인트로).
   첫 실행 흐름을 통과한 시점이므로 launched 플래그를 기록.
   다음 실행부터는 splash → start → stage-map 으로 단축됨.
   ============================================ */

import { navigate, Screen } from '../core/router.js';
import { markAsLaunched } from '../core/storage.js';
import { buildStubScreen } from './_stub-helper.js';

let dispose = null;

export default {
  mount(el) {
    const stub = buildStubScreen({
      label: 'STEP 6 / 9 — AWAKENING',
      title: '잠 깨기',
      boxText: '잠 깨기 연출',
      hint: '여기를 통과하면 첫 실행 완료로 기록되어, 다음 실행부터 스킵됩니다.',
      onNext: () => {
        markAsLaunched();
        navigate(Screen.STAGE_MAP);
      },
    });
    dispose = stub.dispose;
    el.appendChild(stub.root);
  },
  unmount() {
    dispose?.();
    dispose = null;
  },
};
