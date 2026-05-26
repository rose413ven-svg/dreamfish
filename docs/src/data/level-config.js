/* ===========================================
   level-config.js — 레벨 시스템 SSOT (Day 18 / ★ Day 25 무한 렙업)
   ============================================
   결정로그 Day 18 SSOT.

   ★ Day 25 (대표 결정) — 무한 렙업 구조:
   - 만렙 제약 폐기. 50렙 이후에도 계속 렙업 가능.
   - 11지역(꿈의 심해) requiredLevel=50 은 그대로 → 50렙 = "11지역 잠금 해제" 마일스톤
   - EXP_TABLE 끝(50렙→51렙) 이후로는 level-engine.js 가 마지막 값(200kg) 무한 반복
   - 추후 랭킹 시스템 (레벨 / 누적 무게 기준) 용 기반

   구성:
   - LEGACY_MAX_LEVEL_MILESTONE — 마지막 지역 해제 레벨 (50, 표시·UI 분기용)
   - EXP_TABLE_DEV              — 개발/테스트 경험치 테이블 (49개 entry, 1→50렙)
   - EXP_TABLE_RELEASE          — 출시본 경험치 테이블 (TODO — Phase E)
   - ACTIVE_EXP_TABLE           — 현재 활성 테이블 (DEV/RELEASE 토글 한 줄)
   - LEVEL_BONUSES_PER_LEVEL    — 1 레벨업당 스탯 증가량 (무한 렙업이므로 영구 누적)
   - STAT_DISPLAY_LABELS        — UI 표시명

   사용 패턴 (데이터-엔진 분리):
   - 데이터: 이 파일 (수치/표만)
   - 엔진:  level-engine.js (계산/누적/조회 함수)
   ============================================ */

/**
 * ⚠️ DEPRECATED 명칭 (★ Day 25 — 무한 렙업 도입 후) — 사실상 "11지역 해제 마일스톤".
 * 50렙 도달 = 11지역 잠금 해제. 그 이후로는 계속 렙업 진행됨.
 * level-engine.js 의 levelFromTotalExp 등은 이 값을 더 이상 cap 으로 사용하지 않음.
 */
export const MAX_LEVEL = 50;

/**
 * 개발/테스트용 경험치 테이블 (71개 entry).
 *
 * ★ Day 27 후속 (대표 결정) — 5일 도달 50렙 곡선 + 50렙 이후 무한 곡선:
 *   - 하루 3시간 플레이 기준 약 5일에 50렙 도달 (15시간)
 *   - "초반 수월, 후반 잘 안 오름" 컨셉 부합
 *
 *   1지역 (1~5렙):   약 5~10분 — 100/300/500/1000 kg (★ Day 28 초반 가속)
 *   2지역 (5~10렙):  약 40분  — 2K~6K kg (★ Day 28 dip 해소)
 *   3지역 (10~15렙): 약 60분  — 6.5K~12K kg
 *   4지역 (15~20렙): 약 70분  — 12K~25K kg
 *   5지역 (20~25렙): 약 80분  — 22K~50K kg
 *   6지역 (25~30렙): 약 90분  — 45K~100K kg
 *   7지역 (30~35렙): 약 100분 — 80K~185K kg
 *   8지역 (35~40렙): 약 110분 — 180K~420K kg
 *   9지역 (40~45렙): 약 130분 — 280K~650K kg
 *   10지역 (45~50렙): 약 180분 — 400K~1.1M kg
 *   50렙 누적 = 약 8.6M kg
 *
 *   50렙 이후 (11지역, 대표 원안):
 *   50~55렙: 2M~6M       (각 0.4~1.2일)
 *   55~60렙: 8M~16M      (각 1.5~3.0일)
 *   60~65렙: 20M~40M     (각 3.7~7.4일)
 *   65~70렙: 50M~90M     (각 9~17일)
 *   70~71렙: 100M~110M   (각 18.5~20.4일)
 *   70렙 도달 = 약 112일 (3.7개월)
 *
 *   72렙 이후 (level-engine getExpCostForLevel): 110M + (level-71) × 10M
 *   (예: 72→73 = 120M, 100→101 = 400M, 200→201 = 1400M)
 *
 * index N = (N+1)렙 → (N+2)렙 으로 가는 데 필요한 무게(kg).
 * - index 0  = 1렙→2렙   = 100 (★ Day 28)
 * - index 49 = 50렙→51렙 = 2,000,000
 * - index 70 = 71렙→72렙 = 110,000,000 (마지막 명시 entry)
 * - index 71+ = level-engine 선형 공식 (+10,000,000 per level)
 */
export const EXP_TABLE_DEV = Object.freeze([
  /* 1~5렙 (1지역) — ★ Day 28 (대표 결정) 초반 진입 가속: 700/1200/2000/3500 → 100/300/500/1000 */
  50, 70, 100, 200,

  /* 5~10렙 (2지역) — ★ Day 28 (대표 결정) dip 해소 + 부드러운 단조 증가: 3000/3500/4500/5500/6500 → 2000/3000/4000/5000/6000 */
  300, 300, 300, 300, 300,

  /* 10~15렙 (3지역) - 약 60분 */
  600, 600, 600, 600, 600,

  /* 15~20렙 (4지역) - 약 70분 */
  1000, 1000, 1000, 1000, 1000,

  /* 20~25렙 (5지역) - 약 80분 */
  1500, 1500, 1500, 1500, 1500,

  /* 25~30렙 (6지역) - 약 90분 */
  2000, 2000, 2000, 2000, 2000,

  /* 30~35렙 (7지역) - 약 100분 */
  2500, 2500, 2500, 2500, 2500,

  /* 35~40렙 (8지역) - 약 110분 */
  3000, 3000, 3000, 3000, 3000,

  /* 40~45렙 (9지역) - 약 130분 */
  3500, 3500, 3500, 3500, 3500,

  /* 45~50렙 (10지역) - 약 180분 */
  4000, 4000, 4000, 4000, 4000,

  /* 50~55렙 (11지역 입문) */
  1000000, 2000000, 3000000, 4000000, 5000000,

  /* 55~60렙 */
  8000000, 10000000, 12000000, 14000000, 16000000,

  /* 60~65렙 */
  20000000, 25000000, 30000000, 35000000, 40000000,

  /* 65~70렙 */
  50000000, 60000000, 70000000, 80000000, 90000000,

  /* 70~72렙 (명시 entry 마지막) */
  100000000, 110000000,
]);

/**
 * 출시본 경험치 테이블 — TODO (Phase E 에서 본격 정밀 설계).
 * 현재는 DEV 와 동일하게 두고, 출시 전 정밀 곡선으로 교체.
 *
 * 예상 누적: 약 1억 5천만 ~ 22억 kg (하루 3시간 × 30일 페이스)
 */
export const EXP_TABLE_RELEASE = EXP_TABLE_DEV;  // TODO Phase E

/**
 * 현재 활성 경험치 테이블.
 * ⚠️ 출시 시 EXP_TABLE_RELEASE 로 한 줄 변경.
 */
export const ACTIVE_EXP_TABLE = EXP_TABLE_DEV;

/**
 * 1 레벨업당 스탯 증가량 (대표 결정 — Day 18 / Day 21 확장 / ★ Day 23 입질 보너스 3배 상향).
 *
 * 키는 equipment-options.js OPTION_KEYS + set_drop_rate 와 매칭.
 *
 * 단위:
 * - fish_rate/golden_rate/rainbow_rate/twinkle_rate: 정수 가중치 (% 아님)
 * - rock_rate/orb_speed:                % (음수 = 감소)
 * - weight_bonus/combo_bonus:           %
 * - set_drop_rate:                      % (장비 발견 추가 확률)
 * - critical_rate/lucky_rate/catch_time_bonus: %  (★ Day 34 신규)
 *
 * 49렙 누적 효과 (만렙 = 1렙 + 49회 레벨업):
 * - fish/golden/rainbow/twinkle_rate: +7.35 (정수 가중치)  ★ Day 23: 2.45 → 7.35
 * - rock_rate / orb_speed:    -9.8%
 * - weight_bonus / combo_bonus: +49%
 * - set_drop_rate:            +4.9%
 * - critical_rate / lucky_rate / catch_time_bonus: +4.9%  ★ Day 34 신규
 *
 * ★ Day 21 (대표 결정): twinkle_rate 추가 — 다른 입질과 동일 0.05 (golden/rainbow 톤).
 *
 * ★ Day 23 (대표 결정) ★ — 레벨업 입질 보상 강화 (밸런스 Phase 1-A):
 *   - 입질 4종 0.05 → 0.15 (3배)
 *   - 만렙 누적 +245 → +735 (UI 표시값) → 신화 낚싯대 한 장의 약 60~80% 가치
 *   - 무게/콤보는 1.0 그대로 유지 (대표 결정 — 충분히 강함)
 *
 * ★ Day 34 (대표 결정) ★ — 신규 옵션 3종 레벨업 보상 추가:
 *   - critical_rate / lucky_rate / catch_time_bonus 각 +0.1% per level
 *   - 49렙 누적 +4.9% (조용히 누적되는 보조 보상 — 장비 옵션이 메인)
 */
export const LEVEL_BONUSES_PER_LEVEL = Object.freeze({
  fish_rate:        0.05,  // ★ Day 41 (대표 결정) — Day 23 의 0.15 → 0.05 로 원복 (×100 표시 시 +5)
  golden_rate:      0.05,  // ★ Day 41 — 0.15 → 0.05
  rainbow_rate:     0.05,  // ★ Day 41 — 0.15 → 0.05
  twinkle_rate:     0.05,  // ★ Day 41 — 0.15 → 0.05
  rock_rate:       -0.2,   // 음수 = X 등장 확률 감소
  orb_speed:       -0.2,   // 음수 = 잡기 게임 물고기 속도 감소
  weight_bonus:     1.0,
  combo_bonus:      1.0,
  set_drop_rate:    0.1,
  critical_rate:    0.1,   // ★ Day 34 — 잡기게임 크리티컬 확률 (기본 3% + 장비 + 레벨 누적)
  lucky_rate:       0.1,   // ★ Day 34 — 럭키럭키 발동 확률 (기본 5% + 장비 + 레벨 누적)
  catch_time_bonus: 0.1,   // ★ Day 34 — 잡기시간 증가 (장비 펫 + 레벨 누적)
});

/**
 * UI 표시명 (내정보 모달 스탯 항목 라벨과 일치).
 * profile-modal 등에서 자체 라벨 쓰는 경우 이 표는 참고용.
 * ★ Day 21: twinkle_rate 추가.
 */
export const STAT_DISPLAY_LABELS = Object.freeze({
  fish_rate:        '검은물고기 입질',
  golden_rate:      '황금물고기 입질',
  rainbow_rate:     '분홍물고기 입질',
  twinkle_rate:     '하얀물고기 입질',  // ★ Day 21
  rock_rate:        'X 등장 확률',
  orb_speed:        '물고기 속도',
  weight_bonus:     '물고기 kg 보너스',
  combo_bonus:      '콤보 kg 보너스',
  set_drop_rate:    '장비 발견 추가 확률',
  kabikabi_bonus:   '까비까비 보너스',   // ★ Day 26 (Day 30: % 보너스)
  lucky_rate:       '럭키럭키 발동',     // ★ Day 29
  critical_rate:    '크리티컬 확률',     // ★ Day 30
  catch_time_bonus: '잡기시간 증가',     // ★ Day 30
});