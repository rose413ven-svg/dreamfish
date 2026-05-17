/* ===========================================
   stage-intro.js — 8. 낚시터별 인트로
   ============================================
   부트스트랩 [화면 흐름] 8단계.
   STAGE_MAP 에서 넘어온 stageId 를 params 로 받음.
   ============================================ */

import { navigate, Screen } from '../core/router.js';
import { buildStubScreen } from './_stub-helper.js';

let dispose = null;

export default {
  mount(el, params = {}) {
    const stageId = params.stageId ?? 1;

    const stub = buildStubScreen({
      label: 'STEP 8 / 9 — STAGE INTRO',
      title: `낚시터 ${stageId} 인트로`,
      boxText: '낚시터별 인트로 이미지/애니',
      hint: '낚시터마다 분위기 잡는 인트로. 내용은 추후 결정.',
      onNext: () => navigate(Screen.SLOT, { stageId }),
    });
    dispose = stub.dispose;
    el.appendChild(stub.root);
  },
  unmount() {
    dispose?.();
    dispose = null;
  },
};
