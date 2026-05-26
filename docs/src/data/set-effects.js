/* ===========================================
   set-effects.js — 장비 세트 효과 시스템
   ============================================
   결정로그 Day 10 / 시스템 ② SSOT.

   책임:
   1. 6부위 동일 등급 검사 (= 세트 발동 여부)
   2. 등급별 세트 보너스 수치 데이터
   3. 세트 효과 적용 헬퍼 (무게 / 드롭 확률)
   4. 세트 진행도 계산 (UI 용 — 가방 모달 헤더 "영웅의 세트 3/6")

   설계 원칙:
   - 데이터-엔진 분리 — inventory 만 읽기, UI 무관.
   - stateless — 호출 측에서 inv 캐싱 후 헬퍼 호출 (equipment-effects.js 패턴 동일).
   - 발동 조건: 6부위(rod/float/clothes/boat/hook/pet) 모두 장착 + 모두 같은 등급 + 희귀 이상.
   - 강화 영향 X (item.level 무관).

   적용 위치 (Phase A 에서):
   - 무게 보너스 (weightPct) → slot.js 의 무게 계산 (weight_bonus 와 같은 단위 % 합산)
   - 발견 확률 (dropRatePct) → equipment-meta.js 의 tryRollDrop bonusRate 인자로 전달
   ============================================ */

import { getEquippedBySlot } from './inventory.js';
import { getCatalogEntry } from './equipment-catalog.js';

/** 세트 발동 가능한 등급 (희귀+ 만 — Day 10 결정) */
export const SET_ELIGIBLE_GRADES = Object.freeze(['rare', 'epic', 'legendary', 'mythic']);

/**
 * 등급별 세트 보너스 수치 (Day 10 결정 — 분리형 균형, 대표 직접 수치).
 *
 *   weightPct   — 무게 kg 보너스 (% 단위 — 일반 옵션 weight_bonus 와 합산)
 *   dropRatePct — 장비 발견 추가 확률 (%p 단위 — LUCKY_DROP_RATE 에 가산, cap 100%)
 *
 * 검증 (cap 100% 닿는지):
 *   보스 70% + 신화 세트 +15%p = 85%   (안전 마진 살아있음)
 *   보스 70% + 전설 세트 +10%p = 80%
 *   모든 조합 cap 안 닿음 — 보너스 가치 살아남.
 *
 * 강화 무관 (item.level 영향 X).
 */
export const SET_BONUSES = Object.freeze({
  rare:      { weightPct: 10, dropRatePct: 3  },
  epic:      { weightPct: 20, dropRatePct: 5  },
  legendary: { weightPct: 30, dropRatePct: 10 },
  mythic:    { weightPct: 50, dropRatePct: 15 },
});

/**
 * 세트 한글 이름 (UI 용 — 가방 헤더 / 결정로그 한글명).
 * 장비 prefix(equipment-catalog.js GRADE_PREFIX)와 톤 통일.
 */
export const SET_NAMES = Object.freeze({
  rare:      '희귀한 세트',
  epic:      '영웅의 세트',
  legendary: '전설의 세트',
  mythic:    '신화의 세트',
});

/* ============================================
   헬퍼 — 발동 검사 / 진행도
   ============================================ */

/**
 * 세트 발동 등급 검사.
 * 6부위(rod/float/clothes/boat/hook/pet) 모두 장착 + 모두 같은 등급 + 희귀 이상이어야 발동.
 * 한 부위라도 미장착 / 다른 등급 섞임 / 일반·고급 = null 반환.
 *
 * @param {object} inv — loadInventory 결과
 * @returns {string|null} — 'rare' | 'epic' | 'legendary' | 'mythic' 또는 null (미발동)
 */
export function getSetGrade(inv) {
  if (!inv || !Array.isArray(inv.items)) return null;
  const SLOTS = ['rod', 'float', 'clothes', 'boat', 'hook', 'pet'];
  let firstGrade = null;
  for (const slotId of SLOTS) {
    const item = getEquippedBySlot(inv, slotId);
    if (!item) return null;  // 한 부위라도 미장착 = 미발동
    const entry = getCatalogEntry(item.catalogId);
    if (!entry) return null;
    if (firstGrade === null) firstGrade = entry.grade;
    else if (entry.grade !== firstGrade) return null;  // 다른 등급 섞임 = 미발동
  }
  // 6부위 동일 등급 — 희귀+ 만 발동
  if (!SET_ELIGIBLE_GRADES.includes(firstGrade)) return null;
  return firstGrade;
}

/**
 * 세트 진행도 (UI 용 — 가방 모달 헤더 "영웅의 세트 3/6").
 * ★ Day 38 후속 (대표 결정) — 4 → 6 표기 통일.
 * 6개 장착 슬롯에서 가장 많이 일치하는 등급을 찾아 N/6 형태로 반환.
 *
 * 동점 시 더 높은 등급 우선 (영웅2 + 희귀2 → 영웅 2/6).
 * 6부위 미장착 슬롯이 있어도 표시 (0이 아닌 경우).
 *
 * 일반/고급은 진행도 후보에서 제외 (세트 X 등급).
 *
 * @param {object} inv
 * @returns {{ topGrade: string, count: number } | null}
 */
export function getSetProgress(inv) {
  if (!inv || !Array.isArray(inv.items)) return null;
  const SLOTS = ['rod', 'float', 'clothes', 'boat', 'hook', 'pet'];
  /** @type {Record<string, number>} */
  const gradeCounts = Object.create(null);
  for (const slotId of SLOTS) {
    const item = getEquippedBySlot(inv, slotId);
    if (!item) continue;
    const entry = getCatalogEntry(item.catalogId);
    if (!entry) continue;
    if (!SET_ELIGIBLE_GRADES.includes(entry.grade)) continue;  // 일반/고급 제외
    gradeCounts[entry.grade] = (gradeCounts[entry.grade] || 0) + 1;
  }
  const entries = Object.entries(gradeCounts);
  if (entries.length === 0) return null;
  // 카운트 가장 많은 등급, 동점 시 더 높은 등급 우선
  entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return SET_ELIGIBLE_GRADES.indexOf(b[0]) - SET_ELIGIBLE_GRADES.indexOf(a[0]);
  });
  return { topGrade: entries[0][0], count: entries[0][1] };
}

/* ============================================
   효과 적용 헬퍼 (호출 측에서 setGrade 캐싱 후 사용)
   ============================================ */

/**
 * 세트 무게 보너스 (% 단위 — weight_bonus 와 합산되도록 같은 단위).
 * 미발동 시 0.
 *
 * 호출 측 사용 패턴:
 *   const totalWeightPct = (active.weight_bonus || 0) + getSetWeightBonus(setGrade);
 *   const finalWeight    = baseWeight × (1 + totalWeightPct/100) + 콤보 보너스
 *
 * @param {string|null} setGrade — getSetGrade 결과
 * @returns {number} — 0 또는 10/20/30/50
 */
export function getSetWeightBonus(setGrade) {
  if (!setGrade) return 0;
  return SET_BONUSES[setGrade]?.weightPct || 0;
}

/**
 * 세트 발견 확률 보너스 (소수 0~1 — LUCKY_DROP_RATE 와 같은 단위).
 * 미발동 시 0.
 *
 * 호출 측 사용 패턴 (equipment-meta.js tryRollDrop bonusRate 인자):
 *   const setBonus = getSetDropRateBonus(setGrade);
 *   const dropRoll = tryRollDrop(fishGrade, setBonus);
 *
 * cap 100% 처리는 tryRollDrop 안에서 (Math.min(1, ...)).
 *
 * @param {string|null} setGrade
 * @returns {number} — 0 또는 0.03 / 0.05 / 0.10 / 0.15
 */
export function getSetDropRateBonus(setGrade) {
  if (!setGrade) return 0;
  return (SET_BONUSES[setGrade]?.dropRatePct || 0) / 100;
}

/**
 * 세트 한글 이름 (UI 용 — 가방 헤더 등).
 * 미발동/잘못된 등급 → 빈 문자열.
 *
 * @param {string|null} setGrade
 * @returns {string} — '희귀한 세트' / '영웅의 세트' / ... / ''
 */
export function getSetName(setGrade) {
  if (!setGrade) return '';
  return SET_NAMES[setGrade] || '';
}

/* ============================================
   UI 용 헬퍼 — Day 10 (컨텍스트 메뉴 + STATS 세트 영역)
   ============================================ */

/**
 * 특정 등급의 6부위 장착 개수 (진행도 N/6 표시용).
 * ★ Day 38 후속 (대표 결정) — 4 → 6 표기 통일.
 * 일반/고급 등 비-eligible 등급은 N=0.
 *
 * @param {object} inv
 * @param {string} grade — 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'
 * @returns {number} — 0 ~ 6
 */
export function countEquippedByGrade(inv, grade) {
  if (!inv || !Array.isArray(inv.items)) return 0;
  if (!SET_ELIGIBLE_GRADES.includes(grade)) return 0;
  const SLOTS = ['rod', 'float', 'clothes', 'boat', 'hook', 'pet'];
  let count = 0;
  for (const slotId of SLOTS) {
    const item = getEquippedBySlot(inv, slotId);
    if (!item) continue;
    const entry = getCatalogEntry(item.catalogId);
    if (!entry) continue;
    if (entry.grade === grade) count++;
  }
  return count;
}

/**
 * 특정 등급 세트 발동 중인지 검사 (= getSetGrade(inv) === grade).
 *
 * @param {object} inv
 * @param {string} grade
 * @returns {boolean}
 */
export function isSetActive(inv, grade) {
  return getSetGrade(inv) === grade;
}

/**
 * 컨텍스트 메뉴 세트 영역용 정보 (클릭 장비 등급 기준).
 *
 * 결정: 클릭 장비 등급 기준 — 그 장비가 속할 세트 정보 표시.
 * 일반/고급 등 비-eligible 등급 → null (영역 자체 표시 X).
 *
 * @param {object} inv
 * @param {string} itemGrade — 클릭한 장비의 등급
 * @returns {{ grade: string, name: string, count: number, isActive: boolean,
 *            weightPct: number, dropRatePct: number } | null}
 */
export function getContextMenuSetInfo(inv, itemGrade) {
  if (!SET_ELIGIBLE_GRADES.includes(itemGrade)) return null;  // 일반/고급 = 영역 X
  const count    = countEquippedByGrade(inv, itemGrade);
  // ★ Day 38 후속 (대표 결정) — 세트 발동 기준 4 → 6 (getSetGrade 와 일관성).
  //   기존: count === 4 → 4부위만 모아도 UI 활성 색 → 실제 효과는 적용 X (getSetGrade는 6 필요).
  //   변경: count === 6 → UI 와 실제 효과 일치.
  const isActive = count === 6;
  const bonus    = SET_BONUSES[itemGrade] || { weightPct: 0, dropRatePct: 0 };
  return {
    grade:       itemGrade,
    name:        SET_NAMES[itemGrade] || '',
    count,
    isActive,
    weightPct:   bonus.weightPct,
    dropRatePct: bonus.dropRatePct,
  };
}

/**
 * 내정보 STATS 세트 영역용 정보.
 *
 * 결정 (대표 정의):
 *   - 발동 중인 세트 → 그 세트 정보 (등급 색)
 *   - 미발동 시 → 가장 진행도 높은 세트 정보 (회색)
 *   - 희귀+ 장비 0개 → null (영역 자체 표시 X)
 *
 * 동점 시 더 높은 등급 우선 (예: 영웅 2 + 희귀 2 → 영웅).
 *
 * @param {object} inv
 * @returns {{ grade: string, name: string, count: number, isActive: boolean,
 *            weightPct: number, dropRatePct: number } | null}
 */
export function getStatsSetInfo(inv) {
  // 1) 발동 중인 세트 우선
  const active = getSetGrade(inv);
  if (active) {
    const bonus = SET_BONUSES[active] || { weightPct: 0, dropRatePct: 0 };
    return {
      grade:       active,
      name:        SET_NAMES[active] || '',
      count:       4,
      isActive:    true,
      weightPct:   bonus.weightPct,
      dropRatePct: bonus.dropRatePct,
    };
  }
  // 2) 미발동 시 가장 진행도 높은 세트 (getSetProgress 활용)
  const progress = getSetProgress(inv);
  if (!progress) return null;  // 희귀+ 장비 0개
  const bonus = SET_BONUSES[progress.topGrade] || { weightPct: 0, dropRatePct: 0 };
  return {
    grade:       progress.topGrade,
    name:        SET_NAMES[progress.topGrade] || '',
    count:       progress.count,
    isActive:    false,
    weightPct:   bonus.weightPct,
    dropRatePct: bonus.dropRatePct,
  };
}