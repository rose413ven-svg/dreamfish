/* ===========================================
   equipment-options.js — 장비 옵션 시스템 데이터
   ============================================
   결정로그 Day 6 / Day 11 / Day 21 SSOT.

   구성:
   - OPTION_KEYS / OPTIONS — 옵션 8종 정의 (Day 21: twinkle_rate 신규 추가)
   - OPTION_RANGES — 옵션 × 부위 × 등급 추첨 범위
   - 부위별 풀 + 등급별 슬롯 개수
   - rollOptions() — 부위/등급 → 옵션 배열 자동 추첨
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
  FISH_RATE:        'fish_rate',     // 검은물고기 등장 +%   → fish 심볼 가중치
  GOLDEN_RATE:      'golden_rate',   // 황금물고기 등장 +%   → golden 심볼 가중치
  RAINBOW_RATE:     'rainbow_rate',  // 분홍물고기 등장 +%   → rainbow 심볼 가중치
  TWINKLE_RATE:     'twinkle_rate',  // 하얀물고기 등장 +%   → twinkle 심볼 가중치 (Day 21)
  ROCK_RATE:        'rock_rate',     // X 등장 -%            → ROCK_SPAWN_RATE
  ORB_SPEED:        'orb_speed',     // 잡기 속도 -%         → orbDuration (속도 ↓ = duration ↑)
  WEIGHT_BONUS:     'weight_bonus',  // 물고기 무게 +%       → weight.js 결과 무게 곱셈
  COMBO_BONUS:      'combo_bonus',   // 콤보 무게 +%         → 콤보 1+ 유지 중 추가 무게
  KABIKABI_BONUS:   'kabikabi_bonus',// ★ Day 26 — 까비까비 (Day 30: 배수 → %보너스로 변경, cellCount × (1+bonus/100))
  LUCKY_RATE:       'lucky_rate',    // ★ Day 29 — 럭키럭키 발동 확률 +% (기본 5% + 장비)
  CRITICAL_RATE:    'critical_rate', // ★ Day 30 — 잡기게임 크리티컬 확률 +% (PERFECT/NICE 시 데미지 ×2)
  CATCH_TIME_BONUS: 'catch_time_bonus', // ★ Day 30 — 잡기게임 제한시간 +% (펫 전용, 풀강 최종 5~20%)
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
  fish_rate:        { key: 'fish_rate',        displayName: '검은물고기 입질',  sign: '+', displayScale: 100 },
  golden_rate:      { key: 'golden_rate',      displayName: '황금물고기 입질',  sign: '+', displayScale: 100 },
  rainbow_rate:     { key: 'rainbow_rate',     displayName: '분홍물고기 입질',  sign: '+', displayScale: 100 },
  twinkle_rate:     { key: 'twinkle_rate',     displayName: '하얀물고기 입질',  sign: '+', displayScale: 100 },
  rock_rate:        { key: 'rock_rate',        displayName: 'X 등장 확률',       sign: '-' },
  orb_speed:        { key: 'orb_speed',        displayName: '물고기 속도',       sign: '-' },
  weight_bonus:     { key: 'weight_bonus',     displayName: '물고기 kg 보너스',  sign: '+' },
  combo_bonus:      { key: 'combo_bonus',      displayName: '콤보 kg 보너스',    sign: '+' },
  kabikabi_bonus:   { key: 'kabikabi_bonus',   displayName: '까비까비 보너스',   sign: '+' },  // ★ Day 26 (Day 30: %보너스로 의미 변경)
  lucky_rate:       { key: 'lucky_rate',       displayName: '럭키럭키 발동',     sign: '+' },  // ★ Day 29
  critical_rate:    { key: 'critical_rate',    displayName: '크리티컬 확률',     sign: '+' },  // ★ Day 30
  catch_time_bonus: { key: 'catch_time_bonus', displayName: '잡기시간 증가',     sign: '+' },  // ★ Day 30
});

/* ============================================
   ★ Day 41 (대표 결정) — 지역별 옵션 multiplier import
   ============================================
   weight_bonus / combo_bonus / kabikabi_bonus 3종에만 적용 (rollOptionValue).
   ============================================ */
import { getStageOptionMultiplier } from './equipment-meta.js';

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
  // ★ Day 30 (대표 결정) — 랜덤 풀 추가로 rod/float/hook/pet 신규 부위 추가:
  //   옵션 추첨 기본값 (강화 풀강 시 +30% 비율 추가) — 모든 신규 부위 동일 수치:
  //   common 1~3 / uncommon 3~5 / rare 5~7 / epic 7~9 / legendary 9~11 / mythic 15~20
  //   옷 기존 수치 그대로 유지 (대표 결정 Q10 — 옷 본연 효과 보존).
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
    // ★ Day 30 신규 ★
    rod: {
      common:    { min: 1,  max: 3  },
      uncommon:  { min: 3,  max: 5  },
      rare:      { min: 5,  max: 7  },
      epic:      { min: 7,  max: 9  },
      legendary: { min: 9,  max: 11 },
      mythic:    { min: 15, max: 20 },
    },
    float: {
      common:    { min: 1,  max: 3  },
      uncommon:  { min: 3,  max: 5  },
      rare:      { min: 5,  max: 7  },
      epic:      { min: 7,  max: 9  },
      legendary: { min: 9,  max: 11 },
      mythic:    { min: 15, max: 20 },
    },
    hook: {
      common:    { min: 1,  max: 3  },
      uncommon:  { min: 3,  max: 5  },
      rare:      { min: 5,  max: 7  },
      epic:      { min: 7,  max: 9  },
      legendary: { min: 9,  max: 11 },
      mythic:    { min: 15, max: 20 },
    },
    pet: {
      common:    { min: 1,  max: 3  },
      uncommon:  { min: 3,  max: 5  },
      rare:      { min: 5,  max: 7  },
      epic:      { min: 7,  max: 9  },
      legendary: { min: 9,  max: 11 },
      mythic:    { min: 15, max: 20 },
    },
  },

  // 콤보 무게 + — 옷(희귀+) + 배(전 등급) — 캡 없음, 조건부 (콤보 유지 중)
  // Day 13: 배는 전 등급 추첨 가능 (대표 결정 — ×5 그대로 진행)
  // ★ Day 30 (대표 결정) — 옷 일반부터 2개 고정 (combo 포함) + 랜덤 풀 추가:
  //   옷 common/uncommon 신규 (weight_bonus.clothes 와 동일 톤 — 1~3 / 3~5).
  //   rod/float/hook/pet 신규 부위 — weight_bonus 와 동일 수치.
  combo_bonus: {
    clothes: {
      common:    { min: 1,  max: 3  },   // ★ Day 30 신규
      uncommon:  { min: 3,  max: 5  },   // ★ Day 30 신규
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
    // ★ Day 30 신규 ★
    rod: {
      common:    { min: 1,  max: 3  },
      uncommon:  { min: 3,  max: 5  },
      rare:      { min: 5,  max: 7  },
      epic:      { min: 7,  max: 9  },
      legendary: { min: 9,  max: 11 },
      mythic:    { min: 15, max: 20 },
    },
    float: {
      common:    { min: 1,  max: 3  },
      uncommon:  { min: 3,  max: 5  },
      rare:      { min: 5,  max: 7  },
      epic:      { min: 7,  max: 9  },
      legendary: { min: 9,  max: 11 },
      mythic:    { min: 15, max: 20 },
    },
    hook: {
      common:    { min: 1,  max: 3  },
      uncommon:  { min: 3,  max: 5  },
      rare:      { min: 5,  max: 7  },
      epic:      { min: 7,  max: 9  },
      legendary: { min: 9,  max: 11 },
      mythic:    { min: 15, max: 20 },
    },
    pet: {
      common:    { min: 1,  max: 3  },
      uncommon:  { min: 3,  max: 5  },
      rare:      { min: 5,  max: 7  },
      epic:      { min: 7,  max: 9  },
      legendary: { min: 9,  max: 11 },
      mythic:    { min: 15, max: 20 },
    },
  },

  // ★ Day 26 신규 / ★ Day 30 전면 재설계 ★ 까비까비 보너스
  //   Day 26 (이전): 배수 (×2~10), 찌 희귀+ 전용
  //   Day 30 (대표 결정): %보너스로 의미 변경. cellCount × (1 + bonus/100). 8% → 1.08배.
  //   모든 부위에 추가 (rod/float/clothes/hook/pet) — 랜덤 풀 구성원.
  //   배(boat)에는 추가 X (대표 명시 — 배는 그대로 변경 없음).
  //   옵션 추첨 기본값 (강화 풀강 시 +30% 비율 추가, 까비는 늘어나도 밸런스 OK):
  //   common 10~15 / uncommon 15~20 / rare 20~30 / epic 30~50 / legendary 50~75 / mythic 80~100
  //   - 모든 부위 동일 수치 (대표 결정 — 단순성 + 일관성)
  //   - 보상 계산: cellCount × max(1, 1 + bonus/100) [옵션 없으면 ×1 기본]
  kabikabi_bonus: {
    rod: {
      common:    { min: 10, max: 15 },
      uncommon:  { min: 15, max: 20 },
      rare:      { min: 20, max: 30 },
      epic:      { min: 30, max: 50 },
      legendary: { min: 50, max: 75 },
      mythic:    { min: 80, max: 100 },
    },
    float: {
      common:    { min: 10, max: 15 },
      uncommon:  { min: 15, max: 20 },
      rare:      { min: 20, max: 30 },
      epic:      { min: 30, max: 50 },
      legendary: { min: 50, max: 75 },
      mythic:    { min: 80, max: 100 },
    },
    clothes: {
      common:    { min: 10, max: 15 },
      uncommon:  { min: 15, max: 20 },
      rare:      { min: 20, max: 30 },
      epic:      { min: 30, max: 50 },
      legendary: { min: 50, max: 75 },
      mythic:    { min: 80, max: 100 },
    },
    hook: {
      common:    { min: 10, max: 15 },
      uncommon:  { min: 15, max: 20 },
      rare:      { min: 20, max: 30 },
      epic:      { min: 30, max: 50 },
      legendary: { min: 50, max: 75 },
      mythic:    { min: 80, max: 100 },
    },
    pet: {
      common:    { min: 10, max: 15 },
      uncommon:  { min: 15, max: 20 },
      rare:      { min: 20, max: 30 },
      epic:      { min: 30, max: 50 },
      legendary: { min: 50, max: 75 },
      mythic:    { min: 80, max: 100 },
    },
  },

  // ★ Day 29 (대표 결정) — 럭키럭키 발동 확률 — 낚시바늘 + 펫 (둘 다 풀강 시 합쳐서 기본 5% 외 +18% → 약 23% 도달)
  //   ★ Day 30 — 그대로 유지 (대표 결정 Q11-b). hook+pet 풀강 합산 약 41%.
  // ★ Day 29 신규 — 럭키럭키 발동 — 낚시바늘 + 펫 전용
  // ★ Day 41 (대표 결정) ★ — 옵션값 1/3 감소 (후반 럭키 폭주 완화):
  //   배경: mythic+10 hook+pet 풀강 시 럭키 합산 약 38% + base 20%(테스트) = 58%/pull → 신화 연쇄 폭주
  //   변경: 옵션 추첨값 1/3 감소 + 강화 누적도 1/3 감소 (equipment-meta.js)
  //   풀강 신화 합산: 약 38% → 약 11% (장비분), base+레벨 포함 36%/pull
  lucky_rate: {
    hook: {
      common:    { min: 0.2, max: 0.5 },   // ★ Day 41 — 0.5~1.5 → 0.2~0.5 (×1/3)
      uncommon:  { min: 0.3, max: 0.8 },   // ★ Day 41 — 1.0~2.5 → 0.3~0.8
      rare:      { min: 0.7, max: 1.2 },   // ★ Day 41 — 2.0~3.5 → 0.7~1.2
      epic:      { min: 1.0, max: 1.7 },   // ★ Day 41 — 3.0~5.0 → 1.0~1.7
      legendary: { min: 1.5, max: 2.3 },   // ★ Day 41 — 4.5~7.0 → 1.5~2.3
      mythic:    { min: 2.0, max: 3.0 },   // ★ Day 41 — 6.0~9.0 → 2.0~3.0
    },
    pet: {
      common:    { min: 0.2, max: 0.5 },   // ★ Day 41 — 0.5~1.5 → 0.2~0.5 (×1/3)
      uncommon:  { min: 0.3, max: 0.8 },   // ★ Day 41 — 1.0~2.5 → 0.3~0.8
      rare:      { min: 0.7, max: 1.2 },   // ★ Day 41 — 2.0~3.5 → 0.7~1.2
      epic:      { min: 1.0, max: 1.7 },   // ★ Day 41 — 3.0~5.0 → 1.0~1.7
      legendary: { min: 1.5, max: 2.3 },   // ★ Day 41 — 4.5~7.0 → 1.5~2.3
      mythic:    { min: 2.0, max: 3.0 },   // ★ Day 41 — 6.0~9.0 → 2.0~3.0
    },
  },

  // ★ Day 30 신규 ★ 크리티컬 확률 — 낚시바늘(hook) + 펫(pet)
  //   잡기게임 PERFECT/NICE 입력 시 critical_rate 확률로 데미지 ×2 (잡기 단축).
  //   매 입력마다 체크되므로 럭키와 동일 톤 (옵션 A) — 풀강 합산 약 30~36%.
  //   옵션 추첨 기본값 (강화 풀강 시 +30% 비율 추가).
  critical_rate: {
    hook: {
      common:    { min: 0.5, max: 1.5 },
      uncommon:  { min: 1.0, max: 2.5 },
      rare:      { min: 2.0, max: 3.5 },
      epic:      { min: 3.0, max: 5.0 },
      legendary: { min: 4.5, max: 7.0 },
      mythic:    { min: 6.0, max: 9.0 },
    },
    pet: {
      common:    { min: 0.5, max: 1.5 },
      uncommon:  { min: 1.0, max: 2.5 },
      rare:      { min: 2.0, max: 3.5 },
      epic:      { min: 3.0, max: 5.0 },
      legendary: { min: 4.5, max: 7.0 },
      mythic:    { min: 6.0, max: 9.0 },
    },
  },

  // ★ Day 30 신규 ★ 잡기시간 증가 — 펫(pet) 전용
  //   잡기게임 등급별 timeMs × (1 + bonus/100). 풀강 최종 천장 5~7% ~ 17~20% (대표 결정 Q12).
  //   다른 옵션과 다르게 풀강 최종 천장 기준 → 옵션 추첨 70% / 강화 누적 30% 분배:
  //   common 옵션 3~5 (+강화 2 = 풀강 5~7) / mythic 옵션 11~14 (+강화 6 = 풀강 17~20)
  catch_time_bonus: {
    pet: {
      common:    { min: 3,  max: 5  },
      uncommon:  { min: 4,  max: 6  },
      rare:      { min: 6,  max: 8  },
      epic:      { min: 7,  max: 10 },
      legendary: { min: 9,  max: 12 },
      mythic:    { min: 11, max: 14 },
    },
  },
});

/* ============================================
   부위별 풀 + 등급별 슬롯 개수
   ============================================
   ★ Day 30 (대표 결정) — 시스템 전면 재정리:

   공통 패턴: { fixed: [...], randomPool: [...], randomCount: { min, max } }
   - fixed: 무조건 들어가는 옵션 (등급마다 다를 수 있음)
   - randomPool: 추가로 들어갈 수 있는 옵션 풀
   - randomCount: 일반~영웅 = 0~3 랜덤 / 전설 = 2확정 / 신화 = 3확정 (펫은 다름)

   랜덤 풀 공통 (무게/콤보/까비) — 모든 부위 공통, 중복 허용 (대표 결정 Q1/Q2):
     무게 + 무게, 까비 + 까비 + 까비 가능. UI 별도 줄 + 효과 합산.

   부위별 fixed 구성:
   - 낚시대(rod):  4종 입질 (검은/황금/분홍/하얀) — 모든 등급 고정
   - 옷(clothes):  weight_bonus + combo_bonus — 모든 등급 고정 (★ Day 30 변경 — 일반/고급도 2개)
   - 찌(float):    rock_rate + orb_speed — 모든 등급 고정 (★ Day 30 변경 — 기존 kabikabi.float 폐기)
   - 낚시바늘(hook): critical_rate + lucky_rate — 모든 등급 고정 (★ Day 30 변경)
   - 펫(pet):      등급별 점진 추가 — common 1개 / uncommon 2개 / rare~mythic 3개
   - 배(boat):     8개 풀 랜덤 추첨 (Day 21 그대로)

   ★ 옷 기존 수치 그대로 유지 + 새 옵션은 별도 수치 (대표 결정 Q10 (나))
   ★ 같은 옵션 중복 시 별도 인스턴스로 저장 → 효과는 합산 (Phase 3에서 처리)
   ============================================ */

/** ★ Day 30 공통 — 모든 부위의 랜덤 풀 (중복 허용) */
const COMMON_RANDOM_POOL = Object.freeze(['weight_bonus', 'combo_bonus', 'kabikabi_bonus']);

/** ★ Day 30 — 공통 랜덤 카운트 패턴 (rod / clothes / float / hook 적용) */
const COMMON_RANDOM_COUNT_BY_GRADE = Object.freeze({
  common:    { min: 0, max: 3 },
  uncommon:  { min: 0, max: 3 },
  rare:      { min: 0, max: 3 },
  epic:      { min: 0, max: 3 },
  legendary: { min: 2, max: 2 },  // 2확정
  mythic:    { min: 3, max: 3 },  // 3확정 (전부)
});

/** ★ Day 30 — 낚시대(rod): 입질 4종 고정 + 무게/콤보/까비 풀 (중복 허용) */
const ROD_OPTIONS_BY_GRADE = Object.freeze({
  common:    { fixed: ['fish_rate', 'golden_rate', 'rainbow_rate', 'twinkle_rate'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.common },
  uncommon:  { fixed: ['fish_rate', 'golden_rate', 'rainbow_rate', 'twinkle_rate'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.uncommon },
  rare:      { fixed: ['fish_rate', 'golden_rate', 'rainbow_rate', 'twinkle_rate'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.rare },
  epic:      { fixed: ['fish_rate', 'golden_rate', 'rainbow_rate', 'twinkle_rate'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.epic },
  legendary: { fixed: ['fish_rate', 'golden_rate', 'rainbow_rate', 'twinkle_rate'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.legendary },
  mythic:    { fixed: ['fish_rate', 'golden_rate', 'rainbow_rate', 'twinkle_rate'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.mythic },
});

/** ★ Day 30 — 옷(clothes): weight + combo 2개 고정 (일반부터) + 무게/콤보/까비 풀 (중복 허용).
 *  옷 기존 weight_bonus / combo_bonus 수치 유지 (대표 결정 Q10 — 옷 본연 강함 보존). */
const CLOTHES_OPTIONS_BY_GRADE = Object.freeze({
  common:    { fixed: ['weight_bonus', 'combo_bonus'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.common },
  uncommon:  { fixed: ['weight_bonus', 'combo_bonus'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.uncommon },
  rare:      { fixed: ['weight_bonus', 'combo_bonus'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.rare },
  epic:      { fixed: ['weight_bonus', 'combo_bonus'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.epic },
  legendary: { fixed: ['weight_bonus', 'combo_bonus'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.legendary },
  mythic:    { fixed: ['weight_bonus', 'combo_bonus'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.mythic },
});

/** ★ Day 30 — 찌(float): rock + orb 2개 고정 + 무게/콤보/까비 풀 (중복 허용 — 까비 포함).
 *  기존 kabikabi_bonus.float (Day 26) 폐기 → 새 옵션으로 통합 (대표 결정 Q2 (나)). */
const FLOAT_OPTIONS_BY_GRADE = Object.freeze({
  common:    { fixed: ['rock_rate', 'orb_speed'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.common },
  uncommon:  { fixed: ['rock_rate', 'orb_speed'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.uncommon },
  rare:      { fixed: ['rock_rate', 'orb_speed'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.rare },
  epic:      { fixed: ['rock_rate', 'orb_speed'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.epic },
  legendary: { fixed: ['rock_rate', 'orb_speed'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.legendary },
  mythic:    { fixed: ['rock_rate', 'orb_speed'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.mythic },
});

/** ★ Day 30 — 낚시바늘(hook): critical + lucky 2개 고정 (일반부터) + 무게/콤보/까비 풀 (중복 허용). */
const HOOK_OPTIONS_BY_GRADE = Object.freeze({
  common:    { fixed: ['critical_rate', 'lucky_rate'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.common },
  uncommon:  { fixed: ['critical_rate', 'lucky_rate'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.uncommon },
  rare:      { fixed: ['critical_rate', 'lucky_rate'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.rare },
  epic:      { fixed: ['critical_rate', 'lucky_rate'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.epic },
  legendary: { fixed: ['critical_rate', 'lucky_rate'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.legendary },
  mythic:    { fixed: ['critical_rate', 'lucky_rate'], randomPool: COMMON_RANDOM_POOL, randomCount: COMMON_RANDOM_COUNT_BY_GRADE.mythic },
});

/** ★ Day 30 — 펫(pet): 등급별 점진 고정 + 무게/콤보/까비 풀 (중복 허용).
 *  - common: 잡기시간 (1개 고정) + 0~3 랜덤
 *  - uncommon: + 크리 (2개 고정) + 0~3 랜덤
 *  - rare: + 럭키 (3개 고정) + 0~3 랜덤
 *  - epic: 3개 고정 + 1 랜덤 (확정) = 4개
 *  - legendary: 3개 고정 + 2 랜덤 (확정) = 5개
 *  - mythic: 3개 고정 + 3 랜덤 (확정) = 6개
 *  대표 결정: 영웅~신화에 무게/콤보/까비 랜덤 (중복 가능). */
const PET_OPTIONS_BY_GRADE = Object.freeze({
  common:    { fixed: ['catch_time_bonus'],                                  randomPool: COMMON_RANDOM_POOL, randomCount: { min: 0, max: 3 } },
  uncommon:  { fixed: ['catch_time_bonus', 'critical_rate'],                 randomPool: COMMON_RANDOM_POOL, randomCount: { min: 0, max: 3 } },
  rare:      { fixed: ['catch_time_bonus', 'critical_rate', 'lucky_rate'],   randomPool: COMMON_RANDOM_POOL, randomCount: { min: 0, max: 3 } },
  epic:      { fixed: ['catch_time_bonus', 'critical_rate', 'lucky_rate'],   randomPool: COMMON_RANDOM_POOL, randomCount: { min: 1, max: 1 } },
  legendary: { fixed: ['catch_time_bonus', 'critical_rate', 'lucky_rate'],   randomPool: COMMON_RANDOM_POOL, randomCount: { min: 2, max: 2 } },
  mythic:    { fixed: ['catch_time_bonus', 'critical_rate', 'lucky_rate'],   randomPool: COMMON_RANDOM_POOL, randomCount: { min: 3, max: 3 } },
});

/** 배 = 8개 풀 (랜덤 추첨) — ★ Day 21: twinkle_rate 추가로 풀 7개 → 8개. ★ Day 30: 대표 결정 그대로 유지. */
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

/** 풀에서 중복 없이 N개 추첨 (Fisher-Yates partial) — 배(boat) 전용 */
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

/** ★ Day 30 신규 — 풀에서 중복 허용 N개 추첨 (rod/clothes/float/hook/pet 랜덤 풀용).
 *  예: ['weight_bonus', 'weight_bonus', 'kabikabi_bonus'] 가능 — 효과는 합산 (Phase 3). */
function pickRandomFromPoolWithDup(pool, count) {
  const result = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool[idx]);
  }
  return result;
}

/** ★ Day 30 신규 — 등급별 randomCount 범위(min~max) 안에서 정수 추첨 */
function rollRandomCount(range) {
  const min = range?.min ?? 0;
  const max = range?.max ?? 0;
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * 부위 + 등급 → 옵션 키 배열
 *
 * ★ Day 30 — 통일된 fixed + randomPool 모델 (배 제외):
 *   - rod/clothes/float/hook/pet: SLOT_CONFIG[slotId][grade] = { fixed, randomPool, randomCount }
 *     fixed 전부 + randomPool 에서 중복 허용 N개 (N = rollRandomCount(range))
 *   - boat: 풀에서 슬롯 수만큼 중복 없이 랜덤 추첨 (그대로)
 */
const SLOT_CONFIG = Object.freeze({
  rod: ROD_OPTIONS_BY_GRADE,
  clothes: CLOTHES_OPTIONS_BY_GRADE,
  float: FLOAT_OPTIONS_BY_GRADE,
  hook: HOOK_OPTIONS_BY_GRADE,
  pet: PET_OPTIONS_BY_GRADE,
});

/**
 * ★ Day 30 — 부위/등급의 고정(fixed) 옵션 개수 반환.
 *
 * options 배열에서 인덱스 기준으로 fixed/random 인스턴스 구분:
 *   options[0..N-1] = fixed (위쪽 일반 표시)
 *   options[N..]    = random 풀 (아래쪽 황금색)
 *
 * 사용처: equipment-context-menu, enhance 등 UI 에서 fixed/random 인스턴스 구별.
 * 배(boat)는 별도 시스템 (전부 풀 추첨) → 0 반환 (= fixed 없음).
 *
 * @param {string} slotId
 * @param {string} grade
 * @returns {number} fixed 인스턴스 개수
 */
export function getFixedOptionCount(slotId, grade) {
  if (slotId === 'boat') return 0;
  const conf = SLOT_CONFIG[slotId]?.[grade];
  return conf?.fixed?.length || 0;
}

export function rollOptionKeys(slotId, grade) {
  // 배는 별도 처리 (중복 없이 풀에서 추첨)
  if (slotId === 'boat') {
    const slotCount = BOAT_SLOTS_BY_GRADE[grade] ?? 2;
    return pickRandomFromPool(BOAT_POOL, slotCount);
  }

  // 공통 부위 (rod / clothes / float / hook / pet) — fixed + randomPool 모델
  const conf = SLOT_CONFIG[slotId]?.[grade];
  if (!conf) return [];

  const fixed = [...(conf.fixed || [])];
  const n = rollRandomCount(conf.randomCount);
  const random = pickRandomFromPoolWithDup(conf.randomPool || [], n);
  return [...fixed, ...random];
}

/**
 * ★ Day 41 (대표 결정) — 지역별 옵션 multiplier 적용 대상.
 * 자원 획득 보너스 3종만 (밸런스 안전 — lucky/critical/입질 등은 그대로).
 * 합성 추가 옵션 (extraOptions = weight_bonus) 도 동일 처리 (rollExtraOption 에서 별도).
 */
const STAGE_MULTIPLIER_OPTIONS = new Set([
  'weight_bonus',
  'combo_bonus',
  'kabikabi_bonus',
]);

/**
 * 옵션 키 + 부위 + 등급 → 수치 랜덤 추첨 (해당 조합 범위 내, 소수 2자리).
 *
 * Day 11 변경 ★: 시그니처에 slotId 추가 (부위별 차등 적용).
 * Day 13 변경 ★: 정밀도 1자리 → 2자리 (대표 결정 — 작은 수치(0.05~0.15 등) 가
 *               1자리 반올림에서 0.1로 뭉개지지 않게. 표시는 fmtNum 가 trailing 0 제거).
 * ★ Day 41 (대표 결정) — stageId 인자 추가 (옵션 4번째).
 *   - STAGE_MULTIPLIER_OPTIONS (weight/combo/kabikabi) 3종에만 multiplier 적용.
 *   - stageId 미지정 시 multiplier=1.0 (기존 동작과 동일 — 호환).
 *   - 합성 추가 옵션 (rollExtraOption) 은 별도 함수에서 동일 패턴 처리.
 * 호출부 검증: rollOptions 안에서 slotId/stageId 자동 전달.
 *
 * 부재 케이스 (해당 옵션이 이 부위/등급에 없음) → 0 반환.
 */
export function rollOptionValue(optionKey, slotId, grade, stageId) {
  if (!OPTIONS[optionKey]) return 0;
  const range = OPTION_RANGES[optionKey]?.[slotId]?.[grade];
  if (!range) return 0;
  let value = range.min + Math.random() * (range.max - range.min);
  // ★ Day 41 — 3종 옵션에만 stageId 기반 multiplier 적용
  if (STAGE_MULTIPLIER_OPTIONS.has(optionKey)) {
    value *= getStageOptionMultiplier(stageId);
  }
  return Math.round(value * 100) / 100;
}

/**
 * 부위 + 등급 → 옵션 배열 [{ key, value }, ...] 자동 생성.
 * 합성/드롭 시 호출 → EquipmentItem.options 에 저장.
 *
 * ★ Day 41 — stageId 인자 추가 (3번째). 미지정 시 multiplier=1.0 (기존 동작).
 */
export function rollOptions(slotId, grade, stageId) {
  const keys = rollOptionKeys(slotId, grade);
  return keys.map(key => ({
    key,
    value: rollOptionValue(key, slotId, grade, stageId),
  }));
}