/* ===========================================
   stages.js — 낚시터 11개 정의 (Day 18 갱신 / ★ Day 24 — 지역별 무게 배율 도입)
   ============================================
   결정로그 Day 18 SSOT.

   기존 (Day 17 이전) 10개 → 11개로 확장.
   각 stage 에 입장 레벨(requiredLevel) 필드 추가.
   기존 9, 10번 infinite 모드 폐기 → 일반 모드로 전환.
   11번 = 만렙(50) 전용 무한 지역 (꿈의 심해).

   필드:
   - id              낚시터 번호 (1~11)
   - name            한국어 정식 이름
   - nameEn          영문 이름 (UI 보조용)
   - theme           톤 키워드 (맵 카드 분위기 결정용)
   - intro           1~2 줄 짧은 소개 (맵 카드 표시용)
   - gridSize        슬롯 그리드 변(=n×n)
   - mode            'normal' (KG 게이지 클리어) / 'infinite' (11번)
   - targetKg        ⚠️ DEPRECATED — 레벨 시스템으로 대체됨 (Day 18 이후). 현재 미사용 레거시 필드.
   - requiredLevel   입장 가능 최소 레벨 (1지역만 1)
   - weightMultiplier ★ Day 24 신규 — 등급별 무게 추첨에 곱해지는 지역 배율 (기획서 34-2 원안)
                     1지역 ×1.0 → 11지역 ×100 까지 점진 증가

   ★ 11번 카드 비활성화 표시:
   - 만렙 도달 전: "미지의 공간" 으로 위장 표시 (UI 단)
   - 데이터(여기) 는 정식 이름 "꿈의 심해" 로 유지

   ★ Day 24 (대표 결정) ★ — 지역별 무게/등급 차별화 시스템 (밸런스 Phase 2):
   1. 등급 제한 X — 모든 지역에서 치어~보스 등급은 다 출현 가능
   2. 무게 배율 (weightMultiplier) — 같은 등급도 후반 지역이 훨씬 무거움
      기획서 34-2 원안 복원 (Day 16에 단순화로 폐기됐던 시스템 부활).
      [Day 24 원안 — ×100 곡선] 1: ×1.0 / 2: ×1.8 / 3: ×3.0 / 4: ×5.0 / 5: ×8.5 / 6: ×15
                                  7: ×25  / 8: ×50  / 9: ×65  / 10: ×80 / 11: ×100
   3. 신화보스 (황금빛꿈고래) 만 11지역 전용 — clampGradeForStage 로 다른 지역에서는 전설보스로 다운.
      트리거 조건 (검은 25+ / 황금 10+) 은 그대로 유지 (대표 결정 — 추후 수정 예정).

   ★ Day 40 후속 (대표 결정) ★ — weightMultiplier 실제 활성화 (직전까지 모든 지역 1.0 통일 = 미적용 상태였음).
      옵션 B-1 완만 곡선 채택 (Day 24 원안 ×100 은 너무 극단적 → 게임 균형 위해 완화):
      1: ×1.0 / 2: ×1.2 / 3: ×1.5 / 4: ×2.0  / 5: ×2.7 / 6: ×3.5
      7: ×4.5 / 8: ×5.5 / 9: ×6.5 / 10: ×7.5 / 11: ×8.5
      변종 시스템 차이(약 6배) + 지역 차이(8.5배) = 최대 약 50배 차이 — "후반 = 무거움" 동기 부여.

   ★ Day 25 (대표 결정) ★ — 드롭 시프트 시스템 제거:
   4. 장비 드롭 등급 확률은 지역 관계없이 모든 지역 동일 (dropShift 폐기).
   ============================================ */

/**
 * @typedef {object} Stage
 * @property {number}  id
 * @property {string}  name
 * @property {string}  nameEn
 * @property {string}  theme
 * @property {string}  intro
 * @property {number}  gridSize
 * @property {'normal'|'infinite'} mode
 * @property {number|null} targetKg
 * @property {number}  requiredLevel
 */

/** @type {ReadonlyArray<Stage>} */
export const STAGES = Object.freeze([
  {
    id: 1,
    name:   '별빛 연못',
    nameEn: 'Starlight Pond',
    theme:  '잔잔·첫 꿈·평온',
    intro:  '밤하늘 별이 쏟아지는 연못. 첫 꿈낚시가 시작되는 곳.',
    gridSize: 5,
    mode: 'normal',
    targetKg: 100_000,        // ⚠️ DEPRECATED (Day 18 이후 레벨 시스템 대체) — 레거시 필드
    requiredLevel: 1,
    weightMultiplier: 1.0,    // ★ Day 24 — 기준점
    dropCountWeights: [[1, 1.0]],  // ★ Day 25 — 1지역: 1개 고정
  },
  {
    id: 2,
    name:   '반딧불 저수지',
    nameEn: 'Firefly Reservoir',
    theme:  '동화·이끼·부드러움',
    intro:  '반딧불이 떠다니는 잠든 저수지. 동화같은 적막이 흐른다.',
    gridSize: 6,
    mode: 'normal',
    targetKg: 200,
    requiredLevel: 5,
    weightMultiplier: 1.2,    // ★ Day 24
    dropCountWeights: [[1, 0.65], [2, 0.35]],  // ★ Day 25 — 1~2개
  },
  {
    id: 3,
    name:   '새벽 안개 호수',
    nameEn: 'Misty Dawn Lake',
    theme:  '안개·신비·고요',
    intro:  '안개 자욱한 새벽의 호수. 보이지 않는 그림자가 헤엄친다.',
    gridSize: 7,
    mode: 'normal',
    targetKg: 300,
    requiredLevel: 10,
    weightMultiplier: 1.5,    // ★ Day 24
    dropCountWeights: [[1, 0.55], [2, 0.30], [3, 0.15]],  // ★ Day 25 — 1~3개
  },
  {
    id: 4,
    name:   '꿈빛 폭포',
    nameEn: 'Dreamlight Falls',
    theme:  '빛·청량·감격',
    intro:  '떨어지는 물에 무지개 빛이 흐르는 폭포. 가슴이 청량해진다.',
    gridSize: 7,
    mode: 'normal',
    targetKg: 500,
    requiredLevel: 15,
    weightMultiplier: 2.0,    // ★ Day 24
    dropCountWeights: [[1, 0.50], [2, 0.33], [3, 0.17]],  // ★ Day 25 — 1~3개
  },
  {
    id: 5,
    name:   '노을 흐르는 강',
    nameEn: 'Sunset River',
    theme:  '노을·따뜻함·향수',
    intro:  '황혼이 끝없이 흐르는 강. 따스한 노을이 마음을 적신다.',
    gridSize: 8,
    mode: 'normal',
    targetKg: 700,
    requiredLevel: 20,
    weightMultiplier: 2.7,    // ★ Day 24
    dropCountWeights: [[1, 0.45], [2, 0.30], [3, 0.17], [4, 0.08]],  // ★ Day 25 — 1~4개
  },
  {
    id: 6,
    name:   '천둥꿈 바다',
    nameEn: 'Thunderdream Sea',
    theme:  '천둥·거친·변곡점',
    intro:  '잔잔한 꿈에 천둥이 치는 바다. 거친 파도 너머 무엇이 있을까.',
    gridSize: 8,
    mode: 'normal',
    targetKg: 1_000,
    requiredLevel: 25,
    weightMultiplier: 3.5,     // ★ Day 24
    dropCountWeights: [[1, 0.40], [2, 0.27], [3, 0.18], [4, 0.10], [5, 0.05]],  // ★ Day 25 — 1~5개
  },
  {
    id: 7,
    name:   '별을 삼킨 심해',
    nameEn: 'Star-Swallowed Abyss',
    theme:  '심해·별·신비',
    intro:  '별이 가라앉은 깊은 바다. 빛이 닿지 않는 곳에 별이 산다.',
    gridSize: 9,
    mode: 'normal',
    targetKg: 1_500,
    requiredLevel: 30,
    weightMultiplier: 4.5,     // ★ Day 24
    dropCountWeights: [[1, 0.40], [2, 0.27], [3, 0.18], [4, 0.10], [5, 0.05]],  // ★ Day 25 — 1~5개
  },
  {
    id: 8,
    name:   '잠의 협곡',
    nameEn: 'Vale of Slumber',
    theme:  '깊은 잠·거대·정적',
    intro:  '끝없는 잠이 흐르는 거대 협곡. 정적만이 가득하다.',
    gridSize: 9,
    mode: 'normal',
    targetKg: 2_000,
    requiredLevel: 35,
    weightMultiplier: 5.5,     // ★ Day 24
    dropCountWeights: [[1, 0.40], [2, 0.27], [3, 0.18], [4, 0.10], [5, 0.05]],  // ★ Day 25 — 1~5개
  },
  {
    id: 9,
    name:   '달의 정원',
    nameEn: 'Moon Garden',
    theme:  '달빛·향기·휴식',
    intro:  '달빛 정원의 비밀 호수. 향기로운 휴식이 깃든다.',
    gridSize: 10,
    mode: 'normal',
    targetKg: 2_500,          // ⚠️ Day 18 신규 — 기존 infinite 폐기 후 추정값 (밸런싱 시 조정)
    requiredLevel: 40,
    weightMultiplier: 6.5,     // ★ Day 24
    dropCountWeights: [[1, 0.40], [2, 0.27], [3, 0.18], [4, 0.10], [5, 0.05]],  // ★ Day 25 — 1~5개
  },
  {
    id: 10,
    name:   '별빛 사막',
    nameEn: 'Starlight Desert',
    theme:  '사막·별·무한',
    intro:  '별 아래 끝없는 사구의 호수. 모래 너머 별빛이 흐른다.',
    gridSize: 10,
    mode: 'normal',
    targetKg: 3_000,          // ⚠️ Day 18 신규 — 기존 infinite 폐기 후 추정값 (밸런싱 시 조정)
    requiredLevel: 45,
    weightMultiplier: 7.5,     // ★ Day 24
    dropCountWeights: [[1, 0.40], [2, 0.27], [3, 0.18], [4, 0.10], [5, 0.05]],  // ★ Day 25 — 1~5개
  },
  {
    id: 11,
    name:   '꿈의 심해',       // 정식 이름 (만렙 도달 후 공개) — UI 단에서 잠금 시 '미지의 공간' 표시
    nameEn: 'Dream Abyss',
    theme:  '무한·정점·혼합',
    intro:  '모든 꿈이 모이는 무한의 심해. 황금빛꿈고래가 잠들어 있다.',
    gridSize: 11,
    mode: 'infinite',
    targetKg: null,
    requiredLevel: 50,
    weightMultiplier: 8.5,    // ★ Day 24 — 엔드게임. 황금빛꿈고래 = 신화보스 추첨 시 100,000~300,000kg
    dropCountWeights: [[1, 0.40], [2, 0.27], [3, 0.18], [4, 0.10], [5, 0.05]],  // ★ Day 25 — 1~5개
  },
]);

/* ============================================
   조회 헬퍼
   ============================================ */

/**
 * id 로 낚시터 찾기 (없으면 1번 반환).
 * @param {number} id
 * @returns {Stage}
 */
export function getStage(id) {
  return STAGES.find(s => s.id === id) || STAGES[0];
}

/**
 * 특정 레벨에서 입장 가능한 낚시터 id 목록.
 * @param {number} level
 * @returns {number[]}
 */
export function getUnlockedStageIds(level) {
  return STAGES
    .filter(s => level >= s.requiredLevel)
    .map(s => s.id);
}

/**
 * 특정 낚시터가 특정 레벨에서 잠금 해제 상태인지.
 * @param {number} stageId
 * @param {number} level
 * @returns {boolean}
 */
export function isStageUnlocked(stageId, level) {
  const st = STAGES.find(s => s.id === stageId);
  if (!st) return false;
  return level >= st.requiredLevel;
}

/**
 * 레벨업 전후 비교 → 이번에 새로 해제된 낚시터 목록.
 * 새 지역 알림 팝업 트리거용 (slot.js 또는 호출자에서 사용).
 *
 * @param {number} prevLevel
 * @param {number} newLevel
 * @returns {Stage[]}
 */
export function getNewlyUnlockedStages(prevLevel, newLevel) {
  if (newLevel <= prevLevel) return [];
  return STAGES.filter(s =>
    s.requiredLevel > prevLevel &&
    s.requiredLevel <= newLevel
  );
}

/* ============================================
   ★ Day 24 — 지역별 무게/등급 시스템 (밸런스 Phase 2)
   ============================================ */

/**
 * 지역의 무게 배율 반환.
 * 호출 측에서 rollWeight 결과에 곱하거나, rollWeight 시그니처에 전달.
 *
 * @param {number} stageId
 * @returns {number} 1.0 ~ 100.0 (1지역 기준)
 */
export function getStageWeightMultiplier(stageId) {
  const stage = STAGES.find(s => s.id === stageId);
  return stage?.weightMultiplier ?? 1.0;
}

/**
 * ★ Day 25 — 지역별 드롭 수량 가중 추첨.
 *
 * dropCountWeights: [[수량, 가중치], ...] — 합계 1.0 기준.
 * 숫자가 클수록 가중치 낮게 설정되어 있음 (합성 유도용).
 * 드롭 확률 통과 후 1회만 호출 (방식 A).
 *
 * @param {number} stageId
 * @returns {number} 드롭 아이템 수 (1 이상)
 */
export function rollDropCount(stageId) {
  const stage  = STAGES.find(s => s.id === stageId);
  const table  = stage?.dropCountWeights ?? [[1, 1.0]];
  const roll   = Math.random();
  let acc = 0;
  for (const [count, weight] of table) {
    acc += weight;
    if (roll < acc) return count;
  }
  return table[table.length - 1][0];  // fallback: 마지막 값
}

/**
 * 지역 룰에 맞춰 등급 클램프 (호환성 유지 — Day 29부터 통과 함수로 동작).
 *
 * ★ Day 29 (대표 결정) ★ — 신화 11지역 한정 강등 로직 폐기:
 *   배경: 등급 임계값 변경으로 검은 10+ = 신화보스가 모든 지역에서 등장 가능 (gradeOf)
 *         + 황금/트윙클/분홍 10+ 신화 트리거도 모든 지역으로 확장 (slot.js)
 *   효과: clampGradeForStage 는 더 이상 등급을 변경하지 않음 (그대로 반환)
 *   유지 이유: slot.js 호출처 3군데 (셀 색용, lastMatchedCells, resultQueue) 안전 유지.
 *             추후 완전 폐기 가능하지만 일단 통과 함수로 두어 호환성 ↑.
 *
 * @param {string} grade '치어' | '소형' | '중형' | '월척' | '대물' | '보스' | '전설보스' | '신화보스'
 * @param {number} stageId
 * @returns {string} grade 그대로 반환 (Day 29 — 강등 폐기)
 */
export function clampGradeForStage(grade, stageId) {
  // ★ Day 29 — 강등 로직 폐기. 모든 등급 그대로 통과.
  return grade;
}

/* ============================================
   ★ Day 29 — 지역별 변종 확률 분포 (시스템 A — 대표 결정)
   ============================================
   변경 배경:
   - 기존 (Day 27): 지역마다 변종 1개 고정 매핑 (1~2지역=base, 3~4=p1, ..., 11=p5)
   - 신규 (Day 29): 모든 지역에서 모든 (해금된) 변종 가능 — 지역별 확률 분포 추첨

   누적 해금 단계 (대표 결정):
   - 1~2지역  : base, p1
   - 3~4지역  : base, p1, p2
   - 5~6지역  : base, p1, p2, p3
   - 7~8지역  : base, p1, p2, p3, p4
   - 9~10지역 : base, p1, p2, p3, p4, p5
   - 11지역   : base, p1, p2, p3, p4, p5 (p5 비중 ↑)

   확률 표 (대표 검토 후 결정):
   | 지역 | base | + | ++ | +++ | ++++ | +++++ |
   | 1    | 92%  | 8%  | -   | -   | -   | -   |
   | 2    | 85%  | 15% | -   | -   | -   | -   |
   | 3    | 70%  | 22% | 8%  | -   | -   | -   |
   | 4    | 60%  | 25% | 15% | -   | -   | -   |
   | 5    | 48%  | 25% | 19% | 8%  | -   | -   |
   | 6    | 38%  | 25% | 22% | 15% | -   | -   |
   | 7    | 30%  | 22% | 23% | 18% | 7%  | -   |
   | 8    | 23%  | 20% | 22% | 22% | 13% | -   |
   | 9    | 18%  | 18% | 22% | 22% | 15% | 5%  |
   | 10   | 13%  | 15% | 22% | 22% | 18% | 10% |
   | 11   | 8%   | 12% | 18% | 22% | 22% | 18% |
   ============================================ */

/**
 * 지역별 변종 확률 분포 (각 행 합 = 1.0).
 * @type {Readonly<Record<number, Readonly<Record<string, number>>>>}
 */
const STAGE_VARIANT_DIST = Object.freeze({
  1:  Object.freeze({ base: 0.90, p1: 0.10 }),
  2:  Object.freeze({ base: 0.80, p1: 0.20 }),
  3:  Object.freeze({ base: 0.65, p1: 0.25, p2: 0.10 }),
  4:  Object.freeze({ base: 0.55, p1: 0.25, p2: 0.20 }),
  5:  Object.freeze({ base: 0.45, p1: 0.25, p2: 0.20, p3: 0.10 }),
  6:  Object.freeze({ base: 0.38, p1: 0.25, p2: 0.22, p3: 0.15 }),
  7:  Object.freeze({ base: 0.30, p1: 0.22, p2: 0.20, p3: 0.18, p4: 0.10 }),
  8:  Object.freeze({ base: 0.23, p1: 0.20, p2: 0.22, p3: 0.22, p4: 0.13 }),
  9:  Object.freeze({ base: 0.18, p1: 0.18, p2: 0.22, p3: 0.22, p4: 0.15, p5: 0.05 }),
  10: Object.freeze({ base: 0.13, p1: 0.15, p2: 0.22, p3: 0.22, p4: 0.18, p5: 0.10 }),
  11: Object.freeze({ base: 0.08, p1: 0.12, p2: 0.18, p3: 0.22, p4: 0.22, p5: 0.18 }),
});

/**
 * 지역별 변종 확률 분포 반환 (외부 노출 — 결과팝업 Lucky Lucky 연출 등에서 활용 가능).
 *
 * @param {number} stageId  1~11
 * @returns {Readonly<Record<string, number>>}  변종 → 확률 매핑
 */
export function getStageVariantDistribution(stageId) {
  return STAGE_VARIANT_DIST[stageId] || { base: 1.0 };
}

/**
 * 지역별 변종 추첨 (시스템 A — 누적 확률 합산 방식).
 *
 * 예: 1지역 (base 92% / p1 8%) → 92% 확률로 'base' / 8% 확률로 'p1'
 *
 * 합 1.0 가정 (위 STAGE_VARIANT_DIST 검증됨). 부동소수 오차로 인한
 * 마지막 안전망: 'base' 반환.
 *
 * @param {number} stageId  1~11
 * @returns {'base'|'p1'|'p2'|'p3'|'p4'|'p5'}
 */
export function pickStageVariant(stageId) {
  const dist = STAGE_VARIANT_DIST[stageId] || { base: 1.0 };
  let r = Math.random();
  for (const [tier, prob] of Object.entries(dist)) {
    r -= prob;
    if (r < 0) return tier;
  }
  return 'base';  // 안전망 (부동소수 오차)
}