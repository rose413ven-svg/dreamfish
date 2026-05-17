/* ===========================================
   imagination.js — 상상력 (Imagination) 시스템 (Day 25 Phase 3)
   ============================================
   부트스트랩 Day 25 Phase 3 / 결정로그 Day 25 SSOT.

   정의:
   - 상상력 = 입질 4종 UI 표시값 합산
              = fish_rate + golden_rate + rainbow_rate + twinkle_rate
              (각 항목 displayScale=100 적용된 정수값 합)
   - 캐릭터의 "꿈을 낚는 능력" 종합 지표 (대표 컨셉, 코지 톤)

   데이터-엔진 분리:
   - 데이터(SSOT) = RECOMMENDED_IMAGINATION 테이블 (이 파일)
   - 엔진 = getCurrentImagination / getRecommendedImagination

   사용처:
   - 슬롯 HUD (Lv. N 옆 황금색 박스 — hud.refreshImagination)
   - 내정보 모달 (스탯 리스트 최상단 행)
   - 낚시터맵 카드 (입장 레벨 옆 권장 상상력)
   ============================================ */

import { getActiveOptions } from './equipment-effects.js';
import { getCodexBonuses } from './codex-engine.js';
import { OPTIONS } from './equipment-options.js';
import { loadInventory } from '../core/storage.js';

/**
 * 상상력 계산에 들어가는 입질 옵션 키 4종 (대표 정의).
 * 순서는 표시 일관성용 (stats-bar 와 동일 순서).
 */
const IMAGINATION_OPTION_KEYS = Object.freeze([
  'fish_rate',     // 검은물고기
  'golden_rate',   // 황금물고기
  'rainbow_rate',  // 분홍물고기
  'twinkle_rate',  // 하얀물고기 (Day 21 추가)
]);

/**
 * 지역별 권장 상상력 (SSOT) — ★ Day 26 (대표 결정) 1차 변경.
 *
 * 이전 (Day 25): 50 / 200 / 500 / 1000 / 1500 / 2000 / 3000 / 4000 / 5000 / 6000 / 7000
 * 현재 (Day 26): 후반 상승률 완만 + 초중반 가파른 곡선
 *
 * ⚠️ 잔존 임시값 (밸런스 미정밀):
 * - 추후 시뮬레이션/실플레이 데이터 기반 정밀 조정 예정 (대표 명세 — "계속 수정할거야").
 * - 조정 시 이 테이블만 변경 (호출부 영향 X).
 */
export const RECOMMENDED_IMAGINATION = Object.freeze({
  1:  100,
  2:  500,
  3:  1500,
  4:  3000,
  5:  4500,
  6:  5000,
  7:  5500,
  8:  6000,
  9:  6500,
  10: 7000,
  11: 7500,
});

/**
 * 현재 캐릭터의 상상력 합산값 (정수 표시값).
 *
 * 계산: 입질 4종 옵션의 displayScale 적용 정수값 합.
 *   예: fish 5.485 × 100 = 549 (정수), golden 1.350 × 100 = 135 ... → 상상력 = 합
 *
 * @param {object} [inv]           - 인벤토리 (미지정 시 loadInventory 자동 호출)
 * @param {object} [codexBonuses]  - 도감 보너스 (미지정 시 getCodexBonuses 자동 호출)
 * @returns {number} 상상력 정수 합계
 */
export function getCurrentImagination(inv, codexBonuses) {
  const inventory = inv ?? loadInventory();
  const codex     = codexBonuses ?? getCodexBonuses();
  const active    = getActiveOptions(inventory, codex) || {};

  let total = 0;
  for (const key of IMAGINATION_OPTION_KEYS) {
    const rate  = active[key] || 0;
    const opt   = OPTIONS[key];
    const scale = opt?.displayScale || 1;
    const val   = scale !== 1
      ? Math.round(rate * scale)
      : Math.round(rate);
    total += val;
  }
  return total;
}

/**
 * 특정 지역의 권장 상상력 수치.
 *
 * @param {number} stageId - 지역 id (1~11)
 * @returns {number} 권장 상상력 (테이블 외 = 0)
 */
export function getRecommendedImagination(stageId) {
  return RECOMMENDED_IMAGINATION[stageId] ?? 0;
}