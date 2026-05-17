/* ===========================================
   level-engine.js — 레벨 엔진 (Day 18 / ★ Day 25 무한 렙업)
   ============================================
   결정로그 Day 18 SSOT.

   ★ Day 25 (대표 결정) — 무한 렙업 구조:
   - 만렙(MAX_LEVEL) 제약 폐기. 50렙 이후에도 계속 렙업.
   - ACTIVE_EXP_TABLE 끝(50렙→51렙) 이후로는 마지막 값(현재 200kg) 무한 반복.
   - 50렙 = 11지역 잠금 해제 마일스톤 (지역 시스템 변동 X)
   - 추후 랭킹 시스템 (레벨 / 누적 무게 기준) 기반 마련.

   책임:
   - 누적 무게(=경험치) 관리
   - 레벨 계산 (totalExp → level + into-level 진행도) — 무한 렙업
   - 레벨업 판정 (addExp 시 다중 레벨업 가능 → queue 반환)
   - 레벨 보너스 누적 계산 (다른 모듈에 합산용)
   - 다음 지역 해제 이벤트 계산 (stages.js requiredLevel 변동 시점)

   데이터-엔진 분리:
   - 데이터(SSOT) = level-config.js  (수치/표)
   - 데이터(SSOT) = stages.js         (입장레벨)
   - 엔진(여기)   = 계산/누적/조회

   외부 사용 패턴:
   - 슬롯 화면(낚시 결과) → addExp(kg) 호출 → pendingLevelUps 반환 → 팝업 큐
   - 내정보/HUD/슬롯 → getCurrentLevel() / getExpProgress() 로 조회
   - 옵션 합산 (stats-bar / profile-modal / equipment-effects) → getLevelBonuses() 사용
   ============================================ */

import {
  ACTIVE_EXP_TABLE,
  LEVEL_BONUSES_PER_LEVEL,
} from './level-config.js';
// Day 18 후속 — storage 자동 통합: 재접속 시 누적 경험치 복원 + addExp 시 자동 저장
import { loadTotalExp, saveTotalExp } from '../core/storage.js';

/* ============================================
   내부 상태 (모듈 싱글톤)
   ============================================ */

/** 누적 획득 무게(kg). 모듈 로드 시점에 storage 에서 복원. */
let _totalExp = loadTotalExp();

/**
 * ★ Day 25 — 무한 렙업: 안전 가드 (실용상 도달 불가한 상한, 무한 루프 방지용).
 * ★ Day 27 갱신 — 71→72=110M, +10M/렙 곡선 기준 50만 렙은 누적 약 2.5e16 kg 필요 (수만 년).
 */
const MAX_ITER_GUARD = 500000;

/**
 * ★ Day 25 — 특정 레벨 → 다음 레벨로 가는 데 필요한 경험치.
 * 테이블 안: 테이블 값.
 * 테이블 밖(72렙 이후, 무한 렙업):
 *   ★ Day 27 후속 (대표 결정) — 점진 선형 증가 (+10,000,000 kg / 렙).
 *   ACTIVE_EXP_TABLE 마지막 entry = 71→72 = 110,000,000.
 *   - 72→73:  110M + 1×10M  = 120,000,000
 *   - 80→81:  110M + 9×10M  = 200,000,000
 *   - 100→101: 110M + 29×10M = 400,000,000
 *   - 200→201: 110M + 129×10M = 1,400,000,000
 *
 *   "후반 잘 안 오름" 컨셉 — 70렙 도달 약 3.7개월, 100렙 약 4년 (3h/일 기준).
 *
 * @param {number} level - 1 이상
 * @returns {number}
 */
function getExpCostForLevel(level) {
  if (level < 1) return ACTIVE_EXP_TABLE[0] || 50;
  const idx = level - 1;
  if (idx < ACTIVE_EXP_TABLE.length) return ACTIVE_EXP_TABLE[idx];
  // 72렙 이후 — 마지막 값 기준 선형 증가 (+10,000,000 kg / 렙)
  const last   = ACTIVE_EXP_TABLE[ACTIVE_EXP_TABLE.length - 1];   // 110,000,000
  const beyond = level - ACTIVE_EXP_TABLE.length;                  // 72렙→1, 73렙→2 ...
  return last + beyond * 10000000;
}

/* ============================================
   상태 조회 / 설정 (저장-로드용)
   ============================================ */

/**
 * 현재 누적 경험치(=누적 무게 kg).
 */
export function getTotalExp() {
  return _totalExp;
}

/**
 * 누적 경험치 직접 설정 (저장-로드용 / 디버그).
 * 음수는 0으로 클램프. Day 18 — 자동 저장.
 */
export function setTotalExp(value) {
  _totalExp = Math.max(0, Number(value) || 0);
  saveTotalExp(_totalExp);
}

/**
 * 상태 리셋 (테스트용). Day 18 — 자동 저장.
 */
export function resetLevel() {
  _totalExp = 0;
  saveTotalExp(_totalExp);
}

/* ============================================
   레벨 계산 (순수 함수) — ★ Day 25 무한 렙업
   ============================================ */

/**
 * 누적 경험치 → 현재 레벨 계산. ★ Day 25 — 무한 렙업.
 *
 * @param {number} totalExp - 누적 경험치
 * @returns {number} 현재 레벨 (1 ~ 이론상 무한, 실용상 MAX_ITER_GUARD 까지)
 */
export function levelFromTotalExp(totalExp) {
  let lv = 1;
  let remaining = Math.max(0, totalExp);
  let iter = 0;
  while (iter < MAX_ITER_GUARD) {
    const cost = getExpCostForLevel(lv);
    if (remaining < cost) break;
    remaining -= cost;
    lv++;
    iter++;
  }
  return lv;
}

/**
 * 현재 레벨 (싱글톤 상태 기반).
 */
export function getCurrentLevel() {
  return levelFromTotalExp(_totalExp);
}

/**
 * 특정 레벨에 도달하기까지의 누적 경험치. ★ Day 25 — 무한 렙업 대응.
 * level=1 → 0, level=2 → 50, level=51 → 50렙 누적 + 200, ...
 */
export function cumulativeExpAtLevel(level) {
  const cap = Math.max(1, level);
  let sum = 0;
  for (let i = 1; i < cap; i++) {
    sum += getExpCostForLevel(i);
  }
  return sum;
}

/**
 * 현재 레벨 → 다음 레벨로 가는 데 필요한 경험치 (해당 레벨업 1회분).
 * ★ Day 25 — 무한 렙업: 더 이상 null 반환 안 함.
 *
 * @param {number} level
 * @returns {number}
 */
export function expForLevelUp(level) {
  return getExpCostForLevel(level);
}

/**
 * 현재 레벨 진행도 (HUD / 내정보 표시용). ★ Day 25 — 무한 렙업: isMax 항상 false.
 *
 * @returns {{
 *   level: number,
 *   expIntoLevel: number,
 *   expForNext: number,
 *   percent: number,
 *   isMax: boolean,           ★ Day 25 — 항상 false (무한 렙업)
 *   totalExp: number,
 * }}
 */
export function getExpProgress() {
  const level = getCurrentLevel();
  const cumNow  = cumulativeExpAtLevel(level);
  const intoLv  = _totalExp - cumNow;
  const need    = expForLevelUp(level);

  const percent = Math.max(0, Math.min(100, (intoLv / need) * 100));
  return {
    level,
    expIntoLevel: intoLv,
    expForNext:   need,
    percent,
    isMax:        false,   // ★ Day 25 — 무한 렙업: 만렙 개념 폐기
    totalExp:     _totalExp,
  };
}

/* ============================================
   경험치 획득 / 레벨업 트리거
   ============================================ */

/**
 * @typedef {object} LevelUpEvent
 * @property {number} from   레벨업 전 레벨
 * @property {number} to     레벨업 후 레벨
 */

/**
 * @typedef {object} AddExpResult
 * @property {number} prevLevel
 * @property {number} newLevel
 * @property {number} prevTotalExp
 * @property {number} newTotalExp
 * @property {boolean} leveledUp
 * @property {LevelUpEvent[]} levelUps    다중 레벨업 시 각 단계 (1→2, 2→3 …)
 * @property {number[]} newlyUnlockedStages  이번 호출로 새로 해제된 stage id 목록 (요청 시 호출자가 매핑)
 */

/**
 * 경험치(=무게 kg) 추가. 다중 레벨업 시 levelUps 배열로 반환.
 *
 * ⚠️ newlyUnlockedStages 는 빈 배열로 반환.
 *    실제 stage 해제 매핑은 호출자(slot.js)에서 stages.js 의 requiredLevel 과 대조 (관심사 분리).
 *
 * @param {number} amountKg
 * @returns {AddExpResult}
 */
export function addExp(amountKg) {
  const add = Math.max(0, Number(amountKg) || 0);
  const prevTotalExp = _totalExp;
  const prevLevel    = levelFromTotalExp(prevTotalExp);

  _totalExp = prevTotalExp + add;
  // Day 18 후속 — 자동 저장 (재접속 시 복원)
  saveTotalExp(_totalExp);

  const newLevel = levelFromTotalExp(_totalExp);

  const levelUps = [];
  for (let lv = prevLevel; lv < newLevel; lv++) {
    levelUps.push({ from: lv, to: lv + 1 });
  }

  return {
    prevLevel,
    newLevel,
    prevTotalExp,
    newTotalExp: _totalExp,
    leveledUp:   newLevel > prevLevel,
    levelUps,
    newlyUnlockedStages: [],   // 호출자에서 매핑
  };
}

/* ============================================
   레벨 보너스 (다른 모듈 합산용)
   ============================================ */

/**
 * 특정 레벨까지의 누적 보너스 객체 반환.
 * 레벨업 N회 = (level - 1) 회 보너스 누적.
 *
 * ⚠️ 1렙은 보너스 0. 50렙은 49회분 누적.
 *
 * @param {number} [level] - 미지정 시 현재 레벨 사용
 * @returns {Record<string, number>}
 */
export function getLevelBonuses(level) {
  const lv = (level === undefined || level === null) ? getCurrentLevel() : level;
  const cnt = Math.max(0, lv - 1);
  const out = {};
  for (const [key, perLv] of Object.entries(LEVEL_BONUSES_PER_LEVEL)) {
    out[key] = perLv * cnt;
  }
  return out;
}

/* ============================================
   디버그 유틸
   ============================================ */

/**
 * 디버그용 — 1렙~60렙까지의 누적/필요 경험치 표 반환.
 * ★ Day 25 — 무한 렙업: 표시 상한 60렙으로 고정 (실용 디버그용).
 */
export function debugExpTable() {
  const rows = [];
  let cum = 0;
  const DEBUG_DISPLAY_UPPER = 60;
  for (let lv = 1; lv <= DEBUG_DISPLAY_UPPER; lv++) {
    const need = expForLevelUp(lv);
    rows.push({
      level: lv,
      needForNext: need,
      cumulativeAtLevel: cum,
    });
    cum += need;
  }
  return rows;
}