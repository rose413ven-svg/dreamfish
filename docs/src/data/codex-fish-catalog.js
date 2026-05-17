/* ===========================================
   codex-fish-catalog.js — 물고기 도감 카탈로그 (Day 16 신규 / ★ Day 22 — HIDDEN / ★ Day 27 — 174종 + 9탭)
   ============================================
   ★ Day 27 — 174종 (등급 세분화 + 황금어 신규):
   - 일반 등급 (치어~전설) 각 24종 (6변종 × 4종) = 168
   - 신화 4종, 히든 1종, 황금어 1종
   - 총 174 종 (자동: ALL_FISH.length 기반 갱신)
   - AQUARIUM_MAX_FISH = ceil(174/4) = 44 (이전 16 → 44)

   - 도감 entry key = 물고기 이름 (이름 = unique identifier)
   - 등록은 잡기 성공 시 자동 (catch-game 흐름)
   - 최고 무게 기록 = 잡힐 때마다 갱신
   - 도감 보상 없음 (장비 도감만 보상)

   ★ Day 27 신규 함수:
   - groupEntriesByGradeAndTier() — 등급+변종별 2단 그룹화 (도감 9개 탭의 변종 헤더용)
   - SPECIAL_FISH_GRADES — 특수 탭(히든+황금어) 그룹화 키 묶음
   ============================================ */

import { ALL_FISH, gradeOfFishId, tierOfFishId } from './fish-data.js';

/**
 * 도감 entry 빌더 (★ Day 27 — tier 필드 추가).
 * @param {object} fish  fish-data.js ALL_FISH 의 entry
 * @returns {{ name: string, id: string, grade: string, tier: string|null, baseColor: string, baseSize: number, baseWeight: number }}
 */
function buildEntry(fish) {
  return {
    name:       fish.name,
    id:         fish.id,
    grade:      gradeOfFishId(fish.id),
    tier:       tierOfFishId(fish.id),  // ★ Day 27 — 변종 (base/p1~p5 또는 null)
    baseColor:  fish.color,
    baseSize:   fish.size,
    baseWeight: fish.baseWeight,
  };
}

/**
 * 도감 전체 entry 리스트 (174개, 등급 낮 → 높 순서).
 * UI 렌더링 시 이 순서대로 셀 배치.
 */
export const FISH_CODEX_ENTRIES = Object.freeze(ALL_FISH.map(buildEntry));

/**
 * 이름 → entry 빠른 조회 맵.
 */
const ENTRY_BY_NAME = Object.freeze(
  FISH_CODEX_ENTRIES.reduce((acc, e) => {
    acc[e.name] = e;
    return acc;
  }, {})
);

/**
 * 이름으로 도감 entry 조회.
 * @param {string} name
 * @returns {object|null}
 */
export function getFishEntryByName(name) {
  return ENTRY_BY_NAME[name] || null;
}

/**
 * 도감 총 개수 (= 174).
 */
export const FISH_CODEX_TOTAL = FISH_CODEX_ENTRIES.length;

/**
 * 수족관 표시 최대 어수 = 도감 총수 ÷ 4 (올림 → 44).
 * 도감 등록 4개당 1마리 추가 표시 (codex-engine 의 정렬/추가 로직 참조).
 */
export const AQUARIUM_MAX_FISH = Math.ceil(FISH_CODEX_TOTAL / 4);

/**
 * 등급별 entry 그룹화 (탭 내 등급 헤더 표시용).
 * @returns {{ [grade: string]: Array<entry> }}
 */
export function groupEntriesByGrade() {
  return FISH_CODEX_ENTRIES.reduce((acc, e) => {
    (acc[e.grade] = acc[e.grade] || []).push(e);
    return acc;
  }, {});
}

/**
 * ★ Day 27 — 등급 + 변종 2단 그룹화 (도감 9개 탭의 변종 헤더용).
 *
 * 일반 등급 (치어~전설보스): { '치어': { base: [4], p1: [4], p2: [4], p3: [4], p4: [4], p5: [4] }, ... }
 * 변종 없는 등급 (신화/히든/황금어): { '신화보스': { _: [4] }, '숨겨진보스': { _: [1] }, '황금어': { _: [1] } }
 *
 * UI 렌더링:
 *   for (const tier of TIER_DISPLAY_ORDER) {
 *     const entries = grouped[grade][tier];
 *     if (entries) → 변종 헤더 "기본/+/++/+++/++++/+++++" + 4 셀
 *   }
 *
 * @returns {Object<string, Object<string, Array>>}
 */
export function groupEntriesByGradeAndTier() {
  const result = {};
  for (const entry of FISH_CODEX_ENTRIES) {
    const grade = entry.grade;
    const tier = entry.tier || '_';  // 변종 없으면 '_' 키로 통합
    if (!result[grade]) result[grade] = {};
    if (!result[grade][tier]) result[grade][tier] = [];
    result[grade][tier].push(entry);
  }
  return result;
}

/**
 * ★ Day 27 — 도감 변종 순서 (UI 헤더 표시 순).
 */
export const TIER_DISPLAY_ORDER = Object.freeze(['base', 'p1', 'p2', 'p3', 'p4', 'p5']);

/**
 * ★ Day 27 — 변종 → UI 헤더 라벨 매핑.
 */
export const TIER_LABEL = Object.freeze({
  base: '기본',
  p1:   '+',
  p2:   '++',
  p3:   '+++',
  p4:   '++++',
  p5:   '+++++',
});

/**
 * ★ Day 27 — 도감 메인 탭 9개 정의 (대표 결정 Q11).
 *
 * id: 탭 데이터 키
 * label: UI 표시 라벨 (단축)
 * grades: 이 탭에서 표시할 등급 키들 (groupEntriesByGradeAndTier 의 키와 매칭)
 */
export const FISH_CODEX_TABS = Object.freeze([
  { id: 'tiny',    label: '치어', grades: ['치어'] },
  { id: 'sml',     label: '소형', grades: ['소형'] },
  { id: 'med',     label: '중형', grades: ['중형'] },
  { id: 'big',     label: '월척', grades: ['월척'] },
  { id: 'huge',    label: '대물', grades: ['대물'] },
  { id: 'boss',    label: '보스', grades: ['보스'] },
  { id: 'legend',  label: '전설', grades: ['전설보스'] },
  { id: 'mythic',  label: '신화', grades: ['신화보스'] },
  { id: 'special', label: '특수', grades: ['숨겨진보스', '황금어'] },  // 히든 + 황금어 묶음
]);