/* ===========================================
   splash.js — 1. 회사 로고 (드림퀘스트)
   ============================================
   부트스트랩 [화면 흐름] 1단계.
   실제 빌드: 자동 페이드 1.5~2초 후 자동 전환.
   Phase 1 stub: "다음" 버튼으로 수동 진행.

   ★ Day 38 후속 (대표 결정) — 강종 후 재진입 시 빈 슬롯에서 시작.
   ============================================
   splash 는 앱 부팅 진입점 (main.js → SPLASH 만 호출). 메뉴/가방 등
   화면 간 이동에서는 splash 거치지 않음.

   - 강종 후 재진입: splash 통과 → 활성 세션 클리어 → 빈 슬롯에서 시작 ✅
   - 정상 흐름 (메뉴 ↔ 슬롯): splash 안 거침 → 콤보/골든힛 그대로 유지 ✅

   클리어 대상 (영속 저장 세션만):
   - SLOT_SESSION       — 슬롯 결과 큐 / 콤보 / 히트 팝업 (강종 시 "타이니 더블힛"
                          자동 시작 원인)
   - GOLDEN_HIT_SESSION — 골든힛 타임 활성 세션

   영구 데이터 (인벤토리/레벨/도감/돈 등) 는 별도 키라 영향 X.
   TWINKLE_SESSION 은 모듈 변수 only (localStorage X) → 강종 시 자연 소멸 → 처리 불필요.
   ============================================ */

import { navigate, Screen } from '../core/router.js';
import { buildStubScreen } from './_stub-helper.js';
// ★ Day 38 후속 — 강종 후 재진입 시 빈 슬롯 보장 (활성 세션 클리어).
import { resetSlotSession, resetGoldenHitSession } from '../core/storage.js';

let dispose = null;

export default {
  mount(el) {
    // ★ Day 38 후속 (대표 결정) — 부팅 시 활성 세션 클리어.
    //   splash 는 앱 부팅 시 1회만 진입 → 강종 후 재진입에서만 트리거됨.
    //   정상 흐름(메뉴 ↔ 슬롯)에선 splash 안 거치니까 콤보/골든힛 보존.
    resetSlotSession();
    resetGoldenHitSession();

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