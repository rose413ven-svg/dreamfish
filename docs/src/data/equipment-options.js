/* ===========================================
   equipment-options.js — 장비 옵션 시스템 데이터
   ============================================
   결정로그 Day 6 / Day 11 / Day 21 SSOT.

   구성:
   - OPTION_KEYS / OPTIONS — 옵션 8종 정의 (Day 21: twinkle_rate 신규 추가)
   - OPTION_RANGES — 옵션 × 부위 × 등급 추첨 범위
   - 부위별 풀 + 등급별 슬롯 개수
   - rollOptions() — 부위/등급 → 옵션 배열 자동 추첨

   옵션 ID 키 = 슬롯 심볼 코드 키와 일치 (fish/golden/rainbow/twinkle).
   효과 적용 시 매핑 단순화 — equipment-options 키와 symbols 키 동일.

   Day 11 변경 ★:
   - 그룹(A1/A/B/C) 개념 폐기 (단일 그룹별 등급 범위 → 옵션×부위×등급 매트릭스)
   - 부위별 차등 — 메인 부위 큰 수치 / 보조 부위(배) 작은 수치
   - 옵션 추첨 70% : 강화 누적 30% 비율 (강화 누적은 equipment-meta.js 참조)

   ★ Day 21 변경 (대표 결정) ★:
   - 하얀물고기 입질(twinkle_rate) 신규 옵션 추가 — golden 과 동일 톤 (D1 안)
   - 낚싯대 옵션 구조 변경 — "고정 + 풀에서 랜덤 N개" 혼합 모델 (배 방식 일부 차용)
       common    : fish 고정 (1개)
       uncommon  : fish 고정 + {golden, rainbow, twinkle} 풀에서 랜덤 1개 (총 2개)
       rare      : fish 고정 + {golden, rainbow, twinkle} 풀에서 랜덤 2개 (총 3개)
       epic+     : fish + golden + rainbow + twinkle 모두 고정 (총 4개)
   - 배(boat) 슬롯 수 수정 (twinkle_rate 추가로 풀 7개 → 8개):
       common 2 / uncommon 3 / rare 4 / epic 5 / legendary 6 / mythic 8 (전부)
   - OPTION_RANGES 확장 (낚싯대 새 등급 칸 신설):
       golden_rate.rod    → common, uncommon 신규 (희귀 패턴 따라 임시값)
       rainbow_rate.rod   → common, uncommon, rare 신규
       twinkle_rate.rod   → 전 등급 신규 (golden_rate.rod 와 동일 톤)
       twinkle_rate.boat  → 전 등급 신규 (golden_rate.boat 와 동일 톤)
   ============================================ */

/** 옵션 ID 키 — 슬롯 심볼 코드 키와 일치 (단순 매핑) */
export const OPTION_KEYS = Object.freeze({
  FISH_RATE:      'fish_rate',     // 검은물고기 등장 +%   → fish 심볼 가중치
  GOLDEN_RATE:    'golden_rate',   // 황금물고기 등장 +%   → golden 심볼 가중치
  RAINBOW_RATE:   'rainbow_rate',  // 분홍물고기 등장 +%   → rainbow 심볼 가중치
  TWINKLE_RATE:   'twinkle_rate',  // 하얀물고기 등장 +%   → twinkle 심볼 가중치 (Day 21)
  ROCK_RATE:      'rock_rate',     // X 등장 -%            → ROCK_SPAWN_RATE
  ORB_SPEED:      'orb_speed',     // 잡기 속도 -%         → orbDuration (속도 ↓ = duration ↑)
  WEIGHT_BONUS:   'weight_bonus',  // 물고기 무게 +%       → weight.js 결과 무게 곱셈
  COMBO_BONUS:    'combo_bonus',   // 콤보 무게 +%         → 콤보 1+ 유지 중 추가 무게
  KABIKABI_BONUS: 'kabikabi_bonus',// ★ Day 26 — 까비까비 배수 (찌 희귀+ 전용, mixed 클러스터 무게 ×배수)
});

/**
 * @typedef {object} OptionDef
 * @property {string} key         코드 키
 * @property {string} displayName 게임 내 표시명 (수치/단위 제외)
 * @property {'+'|'-'} sign       부호 (+ = 증가, - = 감소)
 */

/** 옵션 9종 정의 (Day 21: twinkle_rate 신규 / ★ Day 26: kabikabi_bonus 신규).
 *  Day 7-2: fish/golden/rainbow_rate = 정수 가중치 가산 모델 (% 곱셈 X).
 *  displayName: '입질' 통일 (Day 10 v2 대표 결정).
 *  Day 11: group 필드 제거 (단일 그룹 → 옵션×부위×등급 매트릭스로 대체).
 *  Day 21: twinkle_rate 추가 — 정수 가중치 가산 (fish/golden/rainbow 와 동일 모델).
 *  ★ Day 26: kabikabi_bonus 추가 — 찌 희귀+ 전용, mixed 클러스터 무게 ×배수 (sign='+', displayScale=1). */
export const OPTIONS = Object.freeze({
  fish_rate:      { key: 'fish_rate',      displayName: '검은물고기 입질',  sign: '+', displayScale: 100 },
  golden_rate:    { key: 'golden_rate',    displayName: '황금물고기 입질',  sign: '+', displayScale: 100 },
  rainbow_rate:   { key: 'rainbow_rate',   displayName: '분홍물고기 입질',  sign: '+', displayScale: 100 },
  twinkle_rate:   { key: 'twinkle_rate',   displayName: '하얀물고기 입질',  sign: '+', displayScale: 100 },
  rock_rate:      { key: 'rock_rate',      displayName: 'X 등장 확률',       sign: '-' },
  orb_speed:      { key: 'orb_speed',      displayName: '물고기 속도',       sign: '-' },
  weight_bonus:   { key: 'weight_bonus',   displayName: '물고기 kg 보너스',  sign: '+' },
  combo_bonus:    { key: 'combo_bonus',    displayName: '콤보 kg 보너스',    sign: '+' },
  kabikabi_bonus: { key: 'kabikabi_bonus', displayName: '까비까비 보너스',   sign: '+' },  // ★ Day 26
});

/* ============================================
   OPTION_RANGES — 옵션 × 부위 × 등급 매트릭스 (Day 11 / Day 21 확장)
   ============================================
   각 옵션이 들어갈 수 있는 부위와 등급 조합에 대해서만 정의.
   부재 키 = "이 옵션은 이 부위/등급 조합에서 추첨될 수 없음".

   - 옵션 추첨 = OPTION_RANGES (이 데이터)
   - 강화 누적 = ENHANCE_BONUS_TOTAL (equipment-meta.js)
   - 합계 (옵션 + 강화 풀강) = 풀강 합계 (결정로그 Day 11 매트릭스 참조)

   비율: 옵션 70% : 강화 30% (모든 옵션 공통).
   예: 신화 검은 낚싯대 풀강 +15
       → 옵션 추첨 ~10.5 (범위 9~12) + 강화 누적 4.5 = 15.0

   Day 21 확장 분 (기존 패턴 따라 임시값 — 대표 검토 후 조정 가능):
   - golden_rate.rod    common/uncommon  : 희귀의 30% / 60% 톤
   - rainbow_rate.rod   common/uncommon/rare : 영웅의 15% / 30% / 60% 톤
   - twinkle_rate       전부 신규 — golden_rate 와 동일 톤 (D1 안)
   ============================================ */
export const OPTION_RANGES = Object.freeze({
  // 검은물고기 입질 — 낚싯대(메인) + 배(보조) — 정수 가중치
  // ★ Day 23 (대표 결정) ★ — 검은 입질 강화 (밸런스 Phase 1-B):
  //   낚싯대 약 ×1.5 / 배 약 ×2.0 (배가 너무 작았어서 더 끌어올림)
  //   대표 컨셉 "검 > 황·분·하얀" 유지하면서 검 우월성 더 명확하게.
  fish_rate: {
    rod: {
      common:    { min: 1.0, max: 2.5 },     // ★ Day 23 — 0.5~1.5 → 1.0~2.5
      uncommon:  { min: 2.0, max: 3.5 },     // ★ Day 23 — 1.5~2.5 → 2.0~3.5
      rare:      { min: 4.0, max: 6.5 },     // ★ Day 23 — 2.5~4.5 → 4.0~6.5
      epic:      { min: 7.0, max: 10.0 },    // ★ Day 23 — 5.0~7.0 → 7.0~10.0
      legendary: { min: 10.0, max: 14.0 },   // ★ Day 23 — 7.0~10.0 → 10.0~14.0
      mythic:    { min: 14.0, max: 18.0 },   // ★ Day 23 — 9.0~12.0 → 14.0~18.0
    },
    boat: {
      common:    { min: 0.30, max: 0.70 },   // ★ Day 23 — 0.10~0.30 → 0.30~0.70
      uncommon:  { min: 0.60, max: 1.20 },   // ★ Day 23 — 0.30~0.60 → 0.60~1.20
      rare:      { min: 1.5, max: 2.5 },     // ★ Day 23 — 0.7~1.3 → 1.5~2.5
      epic:      { min: 2.5, max: 4.0 },     // ★ Day 23 — 1.0~2.0 → 2.5~4.0
      legendary: { min: 4.0, max: 7.0 },     // ★ Day 23 — 1.5~3.5 → 4.0~7.0
      mythic:    { min: 6.0, max: 9.0 },     // ★ Day 23 — 2.5~4.5 → 6.0~9.0
    },
  },

  // 황금물고기 입질 — 낚싯대(Day 21: 전 등급으로 확장) + 배(전 등급) — 정수 가중치
  // Day 13: 배는 전 등급 추첨 가능 (대표 결정 — 일반/고급에도 옵션 수치 들어가게)
  // Day 21: 낚싯대도 common/uncommon 신규 추가 (낚싯대 풀 랜덤 구조 도입 — 대표 결정)
  // ★ Day 23 (대표 결정) ★ — 일반~희귀만 소폭 상향 (밸런스 Phase 1-B):
  //   진입 단계 의미감 확보. 영웅+ 등급은 컨셉상 검 우월성 유지를 위해 그대로.
  golden_rate: {
    rod: {
      common:    { min: 0.15, max: 0.40 },  // ★ Day 23 — 0.10~0.30 → 0.15~0.40
      uncommon:  { min: 0.35, max: 0.80 },  // ★ Day 23 — 0.25~0.60 → 0.35~0.80
      rare:      { min: 0.5, max: 1.3 },    // ★ Day 23 — 0.4~1.0 → 0.5~1.3
      epic:      { min: 0.7, max: 1.7 },
      legendary: { min: 1.5, max: 2.5 },
      mythic:    { min: 2.0, max: 3.5 },
    },
    boat: {
      common:    { min: 0.08, max: 0.20 },  // ★ Day 23 — 0.05~0.15 → 0.08~0.20
      uncommon:  { min: 0.10, max: 0.30 },  // ★ Day 23 — 0.05~0.20 → 0.10~0.30
      rare:      { min: 0.15, max: 0.40 },  // ★ Day 23 — 0.1~0.3 → 0.15~0.40
      epic:      { min: 0.2, max: 0.5 },
      legendary: { min: 0.3, max: 0.7 },
      mythic:    { min: 0.5, max: 0.9 },
    },
  },

  // 분홍물고기 입질 — 낚싯대(Day 21: 전 등급으로 확장) + 배(전 등급) — 정수 가중치
  // Day 13: 배는 전 등급 추첨 가능
  // Day 21: 낚싯대도 common/uncommon/rare 신규 추가
  // ★ Day 23 (대표 결정) ★ — 일반~희귀만 소폭 상향 (밸런스 Phase 1-B):
  //   다른 입질(황/하얀)과 동일 톤으로 정리 (이전엔 미세 차이 있었음).
  rainbow_rate: {
    rod: {
      common:    { min: 0.15, max: 0.40 },  // ★ Day 23 — 0.10~0.25 → 0.15~0.40 (다른 입질과 동일 톤)
      uncommon:  { min: 0.35, max: 0.80 },  // ★ Day 23 — 0.20~0.50 → 0.35~0.80
      rare:      { min: 0.5, max: 1.3 },    // ★ Day 23 — 0.50~1.00 → 0.5~1.3
      epic:      { min: 0.8, max: 1.7 },
      legendary: { min: 1.5, max: 2.7 },
      mythic:    { min: 2.5, max: 4.5 },
    },
    boat: {
      common:    { min: 0.08, max: 0.20 },  // ★ Day 23 — 0.05~0.15 → 0.08~0.20
      uncommon:  { min: 0.10, max: 0.30 },  // ★ Day 23 — 0.05~0.20 → 0.10~0.30
      rare:      { min: 0.15, max: 0.40 },  // ★ Day 23 — 0.1~0.3 → 0.15~0.40
      epic:      { min: 0.2, max: 0.5 },
      legendary: { min: 0.3, max: 0.7 },
      mythic:    { min: 0.5, max: 0.9 },
    },
  },

  // ★ Day 21 신규 ★ 하얀물고기 입질(트윙클) — golden_rate 와 동일 톤 (D1 안)
  // 낚싯대(메인) 전 등급 + 배(보조) 전 등급
  // 트윙클 미니게임 발동 빈도 조절 옵션 — golden 과 동일 희소성
  // ★ Day 23 (대표 결정) ★ — 일반~희귀만 소폭 상향 (밸런스 Phase 1-B): golden_rate 와 동일 톤
  twinkle_rate: {
    rod: {
      common:    { min: 0.15, max: 0.40 },  // ★ Day 23 — 0.10~0.30 → 0.15~0.40 (golden_rate.rod 와 동일)
      uncommon:  { min: 0.35, max: 0.80 },  // ★ Day 23 — 0.25~0.60 → 0.35~0.80
      rare:      { min: 0.5, max: 1.3 },    // ★ Day 23 — 0.4~1.0 → 0.5~1.3
      epic:      { min: 0.7, max: 1.7 },
      legendary: { min: 1.5, max: 2.5 },
      mythic:    { min: 2.0, max: 3.5 },
    },
    boat: {
      common:    { min: 0.08, max: 0.20 },  // ★ Day 23 — 0.05~0.15 → 0.08~0.20
      uncommon:  { min: 0.10, max: 0.30 },  // ★ Day 23 — 0.05~0.20 → 0.10~0.30
      rare:      { min: 0.15, max: 0.40 },  // ★ Day 23 — 0.1~0.3 → 0.15~0.40
      epic:      { min: 0.2, max: 0.5 },
      legendary: { min: 0.3, max: 0.7 },
      mythic:    { min: 0.5, max: 0.9 },
    },
  },

  // X 등장 - — 찌(메인) + 배(전 등급) — 양수 저장, sign='-' 적용
  // Day 13: 배는 전 등급 추첨 가능
  rock_rate: {
    float: {
      common:    { min: 0.4, max: 1.0 },
      uncommon:  { min: 1.0, max: 2.5 },
      rare:      { min: 2.0, max: 4.0 },
      epic:      { min: 4.0, max: 6.5 },
      legendary: { min: 6.0, max: 9.5 },
      mythic:    { min: 8.5, max: 12.5 },
    },
    boat: {
      common:    { min: 0.05, max: 0.15 },  // Day 13 — 배 전 등급
      uncommon:  { min: 0.10, max: 0.25 },
      rare:      { min: 0.2, max: 0.5 },
      epic:      { min: 0.7, max: 1.4 },
      legendary: { min: 1.5, max: 3.5 },
      mythic:    { min: 2.5, max: 4.5 },
    },
  },

  // 잡기 속도 - — 찌(메인) + 배(전 등급)
  // Day 13: 배는 전 등급 추첨 가능
  orb_speed: {
    float: {
      common:    { min: 0.4, max: 1.0 },
      uncommon:  { min: 1.0, max: 2.5 },
      rare:      { min: 2.0, max: 4.0 },
      epic:      { min: 4.0, max: 6.5 },
      legendary: { min: 6.0, max: 9.5 },
      mythic:    { min: 8.5, max: 12.5 },
    },
    boat: {
      common:    { min: 0.05, max: 0.15 },  // Day 13 — 배 전 등급
      uncommon:  { min: 0.10, max: 0.25 },
      rare:      { min: 0.2, max: 0.5 },
      epic:      { min: 0.7, max: 1.4 },
      legendary: { min: 1.5, max: 3.5 },
      mythic:    { min: 2.5, max: 4.5 },
    },
  },

  // 물고기 무게 + — 옷(메인) + 배(전 등급) — 캡 없음
  // Day 13: 배는 전 등급 추첨 가능
  weight_bonus: {
    clothes: {
      common:    { min: 1,  max: 3  },
      uncommon:  { min: 3,  max: 5  },
      rare:      { min: 6,  max: 10 },
      epic:      { min: 11, max: 15 },
      legendary: { min: 17, max: 23 },
      mythic:    { min: 25, max: 31 },
    },
    boat: {
      common:    { min: 0.10, max: 0.30 },  // Day 13 — 배 전 등급
      uncommon:  { min: 0.20, max: 0.50 },
      rare:      { min: 0.5, max: 1.0 },
      epic:      { min: 1.5, max: 2.5 },
      legendary: { min: 3,   max: 5   },
      mythic:    { min: 6,   max: 8   },
    },
  },

  // 콤보 무게 + — 옷(희귀+) + 배(전 등급) — 캡 없음, 조건부 (콤보 유지 중)
  // Day 13: 배는 전 등급 추첨 가능 (대표 결정 — ×5 그대로 진행)
  combo_bonus: {
    clothes: {
      rare:      { min: 10, max: 16 },
      epic:      { min: 17, max: 23 },
      legendary: { min: 24, max: 32 },
      mythic:    { min: 33, max: 45 },
    },
    boat: {
      common:    { min: 0.20, max: 0.50 },  // Day 13 — 배 전 등급
      uncommon:  { min: 0.50, max: 1.00 },
      rare:      { min: 1,  max: 1.8 },
      epic:      { min: 3,  max: 5   },
      legendary: { min: 6,  max: 10  },
      mythic:    { min: 13, max: 21  },
    },
  },

  // ★ Day 26 신규 ★ 까비까비 보너스 — 찌(메인) 희귀+ 전용 (대표 결정).
  //   - 일반/고급 찌: 옵션 부재 (부재 키 = 추첨 불가 → 0 반환)
  //   - 희귀(×2~3) / 영웅(×3~5) / 전설(×6~8) / 신화(×8~10)
  //   - 강화 누적 = 선형 +0.5/단계 (equipment-meta.js KABIKABI_ENHANCE_STEP)
  //   - 보상 계산: cellCount × max(1, kabikabi_bonus) [옵션 없으면 ×1 기본]
  //   - 다른 부위에는 없음 (배 풀에도 미추가 — 찌 전용)
  kabikabi_bonus: {
    float: {
      rare:      { min: 2, max: 3  },
      epic:      { min: 3, max: 5  },
      legendary: { min: 6, max: 8  },
      mythic:    { min: 8, max: 10 },
    },
  },
});

/* ============================================
   부위별 풀 + 등급별 슬롯 개수
   ============================================
   결정로그 Day 6 / Day 21 SSOT.

   - 낚싯대(rod):  ★ Day 21 — 고정 + 풀에서 랜덤 N개 혼합 구조 (신규).
                   { fixed: [...], randomPool: [...], randomCount: N }
                   비전문가 설명: "이건 무조건 붙는 옵션, 이건 나머지 후보 풀,
                   거기서 N개만 랜덤으로 더 뽑아 붙는다" 형태.
   - 찌(float):    ★ Day 26 — 등급별 분기 (일반/고급 2슬롯 / 희귀+ 3슬롯, kabikabi_bonus 추가)
   - 옷(clothes):  일반/고급=weight, 희귀+=+combo
   - 배(boat):     8개 풀에서 랜덤 N개 (Day 21: twinkle_rate 추가로 7→8개)

   원칙: 같은 장비 안 옵션 중복 X (B안).
   ============================================ */

/** ★ Day 21 변경 — 낚싯대: 등급별 고정 + 풀에서 랜덤 N개 혼합 (대표 결정)
 *  - common:    검은만 고정 (1개)
 *  - uncommon:  검은 + {황금/분홍/하얀} 풀에서 랜덤 1개 (총 2개)
 *  - rare:      검은 + {황금/분홍/하얀} 풀에서 랜덤 2개 (총 3개)
 *  - epic+:     검은/황금/분홍/하얀 모두 고정 (총 4개) — 랜덤 풀 없음
 */
const ROD_OPTIONS_BY_GRADE = Object.freeze({
  common: {
    fixed:       ['fish_rate'],
    randomPool:  [],
    randomCount: 0,
  },
  uncommon: {
    fixed:       ['fish_rate'],
    randomPool:  ['golden_rate', 'rainbow_rate', 'twinkle_rate'],
    randomCount: 1,
  },
  rare: {
    fixed:       ['fish_rate'],
    randomPool:  ['golden_rate', 'rainbow_rate', 'twinkle_rate'],
    randomCount: 2,
  },
  epic: {
    fixed:       ['fish_rate', 'golden_rate', 'rainbow_rate', 'twinkle_rate'],
    randomPool:  [],
    randomCount: 0,
  },
  legendary: {
    fixed:       ['fish_rate', 'golden_rate', 'rainbow_rate', 'twinkle_rate'],
    randomPool:  [],
    randomCount: 0,
  },
  mythic: {
    fixed:       ['fish_rate', 'golden_rate', 'rainbow_rate', 'twinkle_rate'],
    randomPool:  [],
    randomCount: 0,
  },
});

/** 찌 옵션 (★ Day 26 — 등급별 분기 도입, 대표 결정).
 *  - 일반/고급: [rock_rate, orb_speed]                  (기존 2슬롯 그대로)
 *  - 희귀~신화: [rock_rate, orb_speed, kabikabi_bonus]  (까비까비 보너스 추가, 3슬롯)
 */
const FLOAT_OPTIONS_BY_GRADE = Object.freeze({
  common:    ['rock_rate', 'orb_speed'],
  uncommon:  ['rock_rate', 'orb_speed'],
  rare:      ['rock_rate', 'orb_speed', 'kabikabi_bonus'],
  epic:      ['rock_rate', 'orb_speed', 'kabikabi_bonus'],
  legendary: ['rock_rate', 'orb_speed', 'kabikabi_bonus'],
  mythic:    ['rock_rate', 'orb_speed', 'kabikabi_bonus'],
});

/** 등급별 옵션 풀 — 옷 */
const CLOTHES_OPTIONS_BY_GRADE = Object.freeze({
  common:    ['weight_bonus'],
  uncommon:  ['weight_bonus'],
  rare:      ['weight_bonus', 'combo_bonus'],
  epic:      ['weight_bonus', 'combo_bonus'],
  legendary: ['weight_bonus', 'combo_bonus'],
  mythic:    ['weight_bonus', 'combo_bonus'],
});

/** 배 = 8개 풀 (랜덤 추첨) — ★ Day 21: twinkle_rate 추가로 풀 7개 → 8개 */
const BOAT_POOL = Object.freeze([
  'fish_rate', 'golden_rate', 'rainbow_rate', 'twinkle_rate',
  'rock_rate', 'orb_speed',
  'weight_bonus', 'combo_bonus',
]);

/** 등급별 슬롯 개수 — 배 (★ Day 21: 대표 결정 — twinkle 추가 반영해 전체 +1, 신화 8개 전부) */
const BOAT_SLOTS_BY_GRADE = Object.freeze({
  common:    2,
  uncommon:  3,  // Day 21: 2 → 3
  rare:      4,  // Day 21: 3 → 4
  epic:      5,  // Day 21: 4 → 5
  legendary: 6,  // Day 21: 5 → 6
  mythic:    8,  // Day 21: 7 → 8 (= 풀 전부) — 엔드게임 장비
});

/* ============================================
   추첨 함수
   ============================================ */

/** 풀에서 중복 없이 N개 추첨 (Fisher-Yates partial) */
function pickRandomFromPool(pool, count) {
  const arr = [...pool];
  const result = [];
  const n = Math.min(count, arr.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * arr.length);
    result.push(arr[idx]);
    arr.splice(idx, 1);
  }
  return result;
}

/**
 * 부위 + 등급 → 옵션 키 배열
 * - 낚싯대(rod) ★ Day 21: { fixed, randomPool, randomCount } 혼합 모델
 *   → 고정 옵션 + 풀에서 N개 추첨한 옵션 합쳐 반환
 * - 배(boat): 풀에서 슬롯 수만큼 랜덤 추첨
 * - 찌/옷: 풀 그대로 반환 (고정)
 */
export function rollOptionKeys(slotId, grade) {
  if (slotId === 'rod') {
    // ★ Day 21 — 낚싯대 고정 + 랜덤 혼합 모델
    const conf = ROD_OPTIONS_BY_GRADE[grade];
    if (!conf) return [];
    const fixed  = [...(conf.fixed || [])];
    const random = pickRandomFromPool(conf.randomPool || [], conf.randomCount || 0);
    return [...fixed, ...random];
  }
  if (slotId === 'float') {
    // ★ Day 26 — 찌 등급별 옵션 분기 (희귀+ 부터 kabikabi_bonus 추가)
    return [...(FLOAT_OPTIONS_BY_GRADE[grade] || [])];
  }
  if (slotId === 'clothes') {
    return [...(CLOTHES_OPTIONS_BY_GRADE[grade] || [])];
  }
  if (slotId === 'boat') {
    const slotCount = BOAT_SLOTS_BY_GRADE[grade] ?? 2;
    return pickRandomFromPool(BOAT_POOL, slotCount);
  }
  return [];
}

/**
 * 옵션 키 + 부위 + 등급 → 수치 랜덤 추첨 (해당 조합 범위 내, 소수 2자리).
 *
 * Day 11 변경 ★: 시그니처에 slotId 추가 (부위별 차등 적용).
 * Day 13 변경 ★: 정밀도 1자리 → 2자리 (대표 결정 — 작은 수치(0.05~0.15 등) 가
 *               1자리 반올림에서 0.1로 뭉개지지 않게. 표시는 fmtNum 가 trailing 0 제거).
 * 호출부 검증: rollOptions 안에서 slotId 자동 전달.
 *
 * 부재 케이스 (해당 옵션이 이 부위/등급에 없음) → 0 반환.
 */
export function rollOptionValue(optionKey, slotId, grade) {
  if (!OPTIONS[optionKey]) return 0;
  const range = OPTION_RANGES[optionKey]?.[slotId]?.[grade];
  if (!range) return 0;
  const value = range.min + Math.random() * (range.max - range.min);
  return Math.round(value * 100) / 100;
}

/**
 * 부위 + 등급 → 옵션 배열 [{ key, value }, ...] 자동 생성.
 * 합성/드롭 시 호출 → EquipmentItem.options 에 저장.
 */
export function rollOptions(slotId, grade) {
  const keys = rollOptionKeys(slotId, grade);
  return keys.map(key => ({
    key,
    value: rollOptionValue(key, slotId, grade),
  }));
}