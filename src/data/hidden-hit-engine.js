/* ===========================================
   hidden-hit-engine.js — HIDDEN HIT 미니게임 엔진 (★ Day 22 신규)
   ============================================
   분홍(rainbow) 매칭 시 진입하는 새 미니게임의 데이터/엔진 레이어.
   기존 분홍 보스힛 시스템(forceBoss) 폐기 후 도입 — cluster.js Day 22 변경 참조.

   핵심 흐름 (slot.js Phase 2 이후 추가 예정):
     분홍 매칭 검출 → HIDDEN HIT 콤보 라벨 + 진입 팝업 → 잡기 게임 HIDDEN 모드
     → 30초 / 보스 체력 20 (PERFECT만 차감) → 잡기 성공 시 카드뒤집기 (X1/X3/X5)
     → fish-result 팝업 (등급 추첨 무게 × 카드 배수 + 콤보/장비 보너스)

   책임:
     - HIDDEN HIT 진입 트리거 판단
     - 미니게임 상수 (체력/시간/카운트다운)
     - 잡기 등급 추첨 (월척 40 / 대물 35 / 보스 25)
     - 카드 3장 구성 (X1/X3/X5 1장씩, 위치만 셔플 — 균등 1/3 추첨 효과)
     - 도감/결과 팝업 표시용 fish entry 조회

   다른 미니게임과 분리:
     - golden-hit-engine.js → 황금 매칭 (자동 cast N회 + 무게 보너스)
     - twinkle-session.js   → 트윙클 매칭 (꿈조각 카드 매칭)
     - hidden-hit-engine.js → 분홍 매칭 (잡기 + 카드 배수)
   ============================================ */

import { HIDDEN_FISH } from './fish-data.js';

/* ============================================
   미니게임 상수
   ============================================ */

/** 보스 체력 (PERFECT 1회당 1 차감 → 0 도달 시 잡기 성공) */
export const HIDDEN_HIT_BOSS_HP = 20;

/** 제한 시간 (초). 종료 시 보상 X / 실패 */
export const HIDDEN_HIT_TIME_LIMIT_SEC = 30;

/** 시작 카운트다운 (초). 3·2·1 표시 후 물고기 원 등장 시작 */
export const HIDDEN_HIT_COUNTDOWN_SEC = 3;

/** 분홍 매칭 최소 사이즈 (HIDDEN HIT 진입 조건) */
export const HIDDEN_HIT_MIN_CLUSTER = 3;

/* ============================================
   잡기 등급 추첨 (대표 결정 — Day 22)
   - 월척 40% / 대물 35% / 보스 25%
   - 추첨된 등급의 weight.js GRADE_WEIGHT_RANGE 에서 무게 롤
   - 결과 팝업 표시 등급 = 이 추첨 결과 (월척/대물/보스 중 1개)
   ============================================ */

const HIDDEN_HIT_GRADE_WEIGHTS = [
  { grade: '월척', weight: 40 },
  { grade: '대물', weight: 35 },
  { grade: '보스', weight: 25 },
];

/**
 * HIDDEN HIT 잡기 등급 추첨.
 * @returns {'월척'|'대물'|'보스'}
 */
export function pickHiddenHitGrade() {
  return weightedPick(HIDDEN_HIT_GRADE_WEIGHTS).grade;
}

/* ============================================
   카드뒤집기 (대표 결정 — Day 22)
   - 카드 3장 = X1 / X3 / X5 1장씩 고정 구성
   - 위치만 셔플 (Fisher-Yates) → 유저는 위치로 1장 선택
   - 결과 = 사용자 입장 균등 1/3 추첨 효과
   ============================================ */

/** 카드 배수 풀 (3장 = X1/X3/X5 1장씩) */
export const HIDDEN_HIT_CARD_MULTIPLIERS = Object.freeze([1, 3, 5]);

/**
 * 카드 3장 셔플 — Fisher-Yates.
 * UI 에서 카드뒤집기 팝업 시작 시 호출.
 * @returns {Array<1|3|5>} 길이 3, X1/X3/X5 1장씩 무작위 순서
 */
export function shuffleHiddenHitCards() {
  const cards = [...HIDDEN_HIT_CARD_MULTIPLIERS];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

/* ============================================
   진입 트리거 판단
   ============================================ */

/**
 * 매칭 클러스터 검출 결과에서 HIDDEN HIT 진입 여부 판단.
 * 분홍(rainbow) 클러스터가 1개 이상 + 사이즈 >= MIN_CLUSTER 면 진입.
 *
 * Phase 2 부터 slot.js handleMatchFound 흐름에서 호출.
 *
 * @param {Array<{symbol: string, size: number}>} clusters - findClusters() 결과
 * @returns {boolean}
 */
export function shouldTriggerHiddenHit(clusters) {
  if (!clusters || !Array.isArray(clusters)) return false;
  return clusters.some(c => c.symbol === 'rainbow' && c.size >= HIDDEN_HIT_MIN_CLUSTER);
}

/* ============================================
   도감/결과 팝업 표시용 fish entry
   ============================================ */

/**
 * HIDDEN BOSS 도감/결과 팝업 표시용 fish entry 반환.
 * 이름 = "숨겨진 보스" 고정, 이미지/색은 분홍 디자인 (Phase 5 SVG 합의).
 * 실제 잡기 무게는 추첨 등급(월척/대물/보스) 의 GRADE_WEIGHT_RANGE 기반 (rollWeight).
 * @returns {object}
 */
export function getHiddenBossDisplayFish() {
  return HIDDEN_FISH[0];
}

/* ============================================
   ★ Day 27 — 히든힛 장비 등급 추첨 (지역별 차등 — 대표 결정 Q-H)
   ============================================
   변경 이유:
   - Day 22 이전: equipment-meta.LUCKY_DROP_GRADE_POOL[어종등급] 사용 (지역 무관)
   - Day 27: 히든힛은 어종 등급(월척/대물/보스) 무관, 지역만 기준으로 장비 등급 차등.
     → 초반 지역엔 영웅(epic) 이상 매우 낮은 확률, 후반엔 점진 증가.
     → 일반 매칭(검은) 의 LUCKY_DROP_GRADE_POOL 은 그대로 유지 (변경 X).

   분포 (대표 결정 — Epic 기준 1%/3%/5%/7%/10%/15%):
   - 각 행 합 = 1.0 (100%)
   - normal=common 코드 표기 통일

   호출 위치:
   - slot.js HIDDEN HIT onClose 분기에서 rollDropGrade(어종등급) 대신
     rollHiddenDropGrade(stage.id) 사용 (Phase 5 마이그레이션).
   ============================================ */

/** 지역(stageId) → 변종 그룹 매핑 (fish-data.js STAGE_TO_TIER 와 동일 패턴, 6단계) */
const STAGE_TO_DROP_TIER = Object.freeze({
   1: 't1',  2: 't1',
   3: 't2',  4: 't2',
   5: 't3',  6: 't3',
   7: 't4',  8: 't4',
   9: 't5', 10: 't5',
  11: 't6',
});

/**
 * 히든힛 장비 등급 분포 (지역 그룹별) — 합 1.0.
 *
 * Epic 기준 1/3/5/7/10/15% — 영웅 이상 후반 지역으로 갈수록 점진 증가.
 * 대표 결정 (Day 27 Q-H 답변).
 */
const HIDDEN_HIT_DROP_GRADE_POOLS = Object.freeze({
  // [등급, 누적확률] 페어 배열 — 합 = 1.0
  t1: [['common', 0.60], ['uncommon', 0.30], ['rare', 0.09], ['epic', 0.01]],                                                    // 1~2지역
  t2: [['common', 0.42], ['uncommon', 0.35], ['rare', 0.20], ['epic', 0.03]],                                                    // 3~4지역
  t3: [['common', 0.25], ['uncommon', 0.35], ['rare', 0.34], ['epic', 0.05], ['legendary', 0.01]],                               // 5~6지역
  t4: [['common', 0.12], ['uncommon', 0.30], ['rare', 0.48], ['epic', 0.07], ['legendary', 0.03]],                               // 7~8지역
  t5: [['common', 0.05], ['uncommon', 0.18], ['rare', 0.61], ['epic', 0.10], ['legendary', 0.05], ['mythic', 0.01]],             // 9~10지역
  t6: [                  ['uncommon', 0.05], ['rare', 0.67], ['epic', 0.15], ['legendary', 0.10], ['mythic', 0.03]],             // 11지역
});

/**
 * ★ Day 27 — 히든힛 장비 등급 추첨 (지역만 기준, 어종 등급 무관).
 *
 * @param {number} stageId  1~11
 * @returns {'common'|'uncommon'|'rare'|'epic'|'legendary'|'mythic'}
 */
export function rollHiddenDropGrade(stageId) {
  const tier = STAGE_TO_DROP_TIER[stageId];
  const pool = HIDDEN_HIT_DROP_GRADE_POOLS[tier];
  if (!pool || pool.length === 0) {
    console.warn('[hidden-hit] unknown stageId:', stageId, '— fallback common');
    return 'common';
  }
  const roll = Math.random();
  let acc = 0;
  for (const [grade, weight] of pool) {
    acc += weight;
    if (roll < acc) return grade;
  }
  return pool[pool.length - 1][0];
}

/**
 * (디버그/시뮬레이션용) 지역 → 분포 풀 조회.
 * 시뮬레이션 (`sim_hidden_drop.mjs`) 에서 검증 시 사용.
 *
 * @param {number} stageId
 * @returns {Array<[string, number]>}
 */
export function getHiddenDropPoolByStage(stageId) {
  const tier = STAGE_TO_DROP_TIER[stageId];
  return HIDDEN_HIT_DROP_GRADE_POOLS[tier] || [];
}

/* ============================================
   내부 유틸
   ============================================ */

/**
 * 가중치 기반 1개 추첨.
 * @param {Array<{weight: number}>} entries
 * @returns {object}
 */
function weightedPick(entries) {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll <= 0) return e;
  }
  return entries[entries.length - 1];
}