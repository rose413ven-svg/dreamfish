/* ===========================================
   imagination.js — 상상력 (Imagination) 시스템
   ★ Day 25 Phase 3 신규 / ★ Day 38 전면 재설계 (대표 결정) ★
   ============================================
   부트스트랩 Day 25 Phase 3 / 결정로그 Day 25 / Day 38 SSOT.

   ★ Day 38 변경 (대표 결정) ★
   - 이전 (Day 25~37): 입질 4종 (fish/golden/rainbow/twinkle) UI 표시값 단순 합
   - 변경 (Day 38)   : 모든 옵션 가중치 차등 합산 (1순위 9종 / 2순위 4종 + set_drop_rate)

   상상력 = "캐릭터 종합 스탯 점수" (= 꿈을 낚는 능력 종합 지표).
   장비 / 강화 / 도감 / 레벨 / 세트에서 오는 정적 옵션만 합산.

   ⚠️ 콤보 단계 보너스 (comboCount × 5%) 는 의도적으로 제외:
      - 인게임 동적 효과 → 상상력은 정적 스탯만 반영
      - 콤보 끊겼다고 상상력 떨어지는 황당함 방지
      - 장비 옵션 combo_bonus 는 정적이므로 포함 (active.combo_bonus 그대로 사용)

   가중치 설계 (1차안, 풀강 신화 4부위 + 풀세트 + 풀도감 + 49렙 시 약 9,000~10,000점):
     1순위 (입질 4종 / 물고기·콤보·까비 보너스 / 럭키 / 크리티컬)  = 30~100점/단위 고단가
     2순위 (X등장 / 물고기속도 / 장비발견 / 잡기시간)              = 30점/단위 균일

   데이터-엔진 분리:
   - 데이터(SSOT) = IMAGINATION_WEIGHTS + RECOMMENDED_IMAGINATION 테이블
   - 엔진 = getCurrentImagination / getRecommendedImagination
     (가중치 조정 = 이 파일 상단 IMAGINATION_WEIGHTS 만 수정 → 모든 호출처 자동 반영)

   사용처:
   - 슬롯 HUD (Lv. N 옆 황금색 박스 — hud.refreshImagination)
   - 내정보 모달 (스탯 리스트 최상단 행)
   - 낚시터맵 카드 (입장 레벨 옆 권장 상상력)
   - 상상력 변동 팝업 (imagination-change-popup.js) — Day 38 신규
   ============================================ */

import { getActiveOptions } from './equipment-effects.js';
import { getCodexBonuses } from './codex-engine.js';
import { loadInventory } from '../core/storage.js';
// ★ Day 38 — 세트 효과 (set_drop_rate 별도 계산용)
// ★ Day 38 후속 (대표 결정) — getSetWeightBonus 추가: 세트 weightPct 도 상상력 별도 합산.
import { getSetGrade, getSetDropRateBonus, getSetWeightBonus } from './set-effects.js';
// ★ Day 38 — 레벨 누적 보너스 (set_drop_rate 별도 추가용)
import { getLevelBonuses } from './level-engine.js';

/* ============================================
   ★ Day 38 (대표 결정) — 옵션 가중치 테이블 (SSOT)
   ============================================
   각 옵션 1단위당 상상력 점수 기여도.

   ⚠️ 입질 4종 (fish/golden/rainbow/twinkle_rate) 은 displayScale=100 적용된 정수값이 아니라
      OPTIONS 의 raw 값 (예: 5.485) 기준으로 곱한다.
      → 5.485 × 100점 = 548.5 → 반올림 → 549점 (기존 displayScale 합산과 동일 결과).

   ⚠️ rock_rate / orb_speed 는 sign='-' (감소가 좋은 효과) 이지만,
      상상력 점수에는 절대값 × 가중치로 + 가산 (스탯 = 좋은 효과 = 상상력 ↑).

   가중치 조정 시 이 테이블만 수정 — 호출부 영향 X.
   ============================================ */
export const IMAGINATION_WEIGHTS = Object.freeze({
  // ─── 1순위 (9종) — 고단가 ───
  // 입질 4종 — 100점/단위 (= displayScale=100 적용과 동일, 기존 호환)
  fish_rate:        100,   // 검은물고기 입질
  golden_rate:      100,   // 황금물고기 입질
  rainbow_rate:     100,   // 분홍물고기 입질
  twinkle_rate:     100,   // 하얀물고기 입질

  // ★ Day 41 (대표 결정) — 물고기/콤보/까비까비 가중치 상향:
  //   weight_bonus  30 → 100  (도감 합 100% 일치, 물고기 보너스 = 메인 보상 종류)
  //   combo_bonus   30 → 70   (도감 enhance 합 150% 와 연동, 콤보가 메인 성장)
  //   kabikabi_bonus 10 → 50  (도감 cosmetic 합 100% 와 연동, 까비까비 비중 ↑)
  weight_bonus:      100,  // ★ Day 41 — 30 → 100
  combo_bonus:        70,  // ★ Day 41 — 30 → 70
  kabikabi_bonus:     50,  // ★ Day 41 — 10 → 50

  // 럭키/크리티컬 — ★ Day 41 (대표 결정 후속) — 80 → 100 (입질/물고기 보너스와 동급, 최상위 가치)
  lucky_rate:        100,  // 럭키럭키 발동 (%) — ★ Day 41 후속: 80 → 100
  critical_rate:     100,  // 크리티컬 확률 (%) — ★ Day 41 후속: 80 → 100

  // ─── 2순위 (4종, set_drop_rate 포함) — 균일 30점/단위 ───
  rock_rate:         30,   // X 등장 확률 (%, 감소 — 절대값 × 30)
  orb_speed:         30,   // 물고기 속도 (%, 감소 — 절대값 × 30)
  catch_time_bonus:  30,   // 잡기시간 증가 (%)
  set_drop_rate:     30,   // 장비 발견 추가 확률 (%) — 가상 키 (세트 + 도감 + 레벨)
});

/**
 * 1순위/2순위 분류 — UI/디버그용 (계산에는 직접 사용 X).
 * 가중치 자체는 IMAGINATION_WEIGHTS 에서 단가로 차등 표현됨.
 */
export const IMAGINATION_TIER = Object.freeze({
  tier1: ['fish_rate', 'golden_rate', 'rainbow_rate', 'twinkle_rate',
          'weight_bonus', 'combo_bonus', 'kabikabi_bonus',
          'lucky_rate', 'critical_rate'],
  tier2: ['rock_rate', 'orb_speed', 'catch_time_bonus', 'set_drop_rate'],
});

/**
 * 지역별 권장 상상력 (SSOT) — Day 26 곡선 그대로 유지.
 * Day 38 가중치 변경으로 풀강 상한이 약 9,000~10,000 으로 올라가지만
 * 권장 테이블 자체는 그대로 두고 추후 시뮬레이션 후 정밀 조정 예정.
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
 * 현재 캐릭터의 상상력 합산값 (정수).
 *
 * 계산: 모든 옵션 × 가중치 합산 + set_drop_rate (세트+도감+레벨 합산) × 30.
 *
 *   total = Σ (|optionValue| × IMAGINATION_WEIGHTS[key])  for key in OPTIONS
 *         + (setDropRate + codexDropRate + levelSetDropRate) × IMAGINATION_WEIGHTS.set_drop_rate
 *
 *   부호 처리: rock_rate / orb_speed 는 active 결과가 양수 저장이므로 절대값 처리 불필요.
 *              (혹시 모를 음수 케이스 대비 Math.abs 적용)
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

  // 1) OPTIONS 12종 (set_drop_rate 제외) — active 결과 × 가중치 합산.
  //    active 에는 장비 + 강화 + 도감(weight/combo) + 레벨 옵션 분이 이미 합산됨.
  for (const [key, weight] of Object.entries(IMAGINATION_WEIGHTS)) {
    if (key === 'set_drop_rate') continue;  // 가상 키 — 아래에서 별도 계산
    const rawValue = active[key];
    if (!Number.isFinite(rawValue)) continue;
    total += Math.abs(rawValue) * weight;
  }

  // 2) set_drop_rate (가상 키) — 세트 효과 + 레벨 set_drop_rate 합산.
  //    ★ Day 41 (대표 결정) — 도감 cosmetic 카테고리 변경: dropRatePct → kabikabiBonusPct.
  //      이전: 도감 dropRatePct 합산 → 변경: 도감은 set_drop_rate 에 영향 X (까비까비는 위 1) 항목에서 active.kabikabi_bonus 로 자동 반영됨).
  //    profile-modal.js 의 표시 산식과 동일 로직 (단위: %).
  const setGrade           = getSetGrade(inventory);
  const setDropRatePct     = setGrade ? (getSetDropRateBonus(setGrade) * 100) : 0;
  const levelBonuses       = getLevelBonuses() || {};
  const levelDropPct       = levelBonuses.set_drop_rate || 0;
  const totalDropPct       = setDropRatePct + levelDropPct;   // ★ Day 41 — codex.dropRatePct 제거
  total += totalDropPct * IMAGINATION_WEIGHTS.set_drop_rate;

  // 3) ★ Day 38 후속 (대표 결정) — 세트 weightPct (무게 보너스) 별도 합산.
  //    배경: active.weight_bonus 는 장비/강화/도감/레벨까지만 합산됨 (getActiveOptions).
  //          세트 weightPct (희귀10/영웅20/전설30/신화50) 는 applyWeight 의 별도 인자라
  //          active 에 안 들어감 → 상상력 산식에서 누락되어 있었음.
  //    수정: setGrade 발동 시 getSetWeightBonus(setGrade) 결과(%)에
  //          weight_bonus 가중치(30) 곱셈 추가 → 풀세트 발동 시 정확한 점수 반영.
  //    예: 신화 풀세트 → 50% × 30 = +1500 점 추가.
  const setWeightPct = setGrade ? getSetWeightBonus(setGrade) : 0;
  total += setWeightPct * IMAGINATION_WEIGHTS.weight_bonus;

  return Math.round(total);
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