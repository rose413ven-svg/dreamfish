/* ===========================================
   fish-data.js — 물고기 174종 데이터 (★ Day 27 — 변종 시스템 도입)
   ============================================
   Day 16: 등급 5→7→8 + 11지역 → 10지역
   Day 22: HIDDEN BOSS 1종 추가 (9번째 등급 '숨겨진보스')

   ★ Day 27 변경 (대표 결정 — 등급 세분화 시스템):
   - 11지역 부활
   - 일반 등급 (치어~전설) 각 6변종 (base/+/++/+++/++++/+++++) × 4종 = 168
   - 신화 4종 (변종 없음)
     · mythic_01 황금빛꿈고래: 11지역 검은 25+ 전용 (게임 엔딩 상징, 별도 영상)
     · mythic_02~04: 11지역 분홍/황금/하얀 10+ 무작위
   - 히든 1종 (기존 유지)
   - 황금어 1종 신규 (골든힛 도감 통합 어종)
   - 총 168 + 4 + 1 + 1 = 174종

   변종-지역 매핑:
     base   = 1~2지역
     +  (p1) = 3~4지역
     ++ (p2) = 5~6지역
     +++(p3) = 7~8지역
     ++++(p4)= 9~10지역
     +++++(p5)= 11지역

   무게 차등 원칙 (대표 결정 — C안 + 변종 baseWeight 미세 증가):
     - 변종 자체엔 별도 배율 없음 (지역 weightMultiplier로 차등)
     - 단, 어종 baseWeight를 변종 단계 올라갈수록 점진 증가 (자연스러운 + 효과)

   실제 무게 = baseWeight × 지역 weightMultiplier × 랜덤 배율
              HIDDEN BOSS = 추첨 등급의 GRADE_WEIGHT_RANGE (hidden-hit-engine.js)
              GOLDEN     = 골든힛 전용 보상 (golden-hit-engine.js, baseWeight 표시용)
   ============================================ */

/* ============================================
   치어 (tiny) — 24종 (6변종 × 4종)
   ============================================ */
export const TINY_BASE = [
  { id: 'tiny_base_01', name: '꿈씨 새끼붕어',      baseWeight: 0.10, color: '#D8E4F0', size: 0.42 },
  { id: 'tiny_base_02', name: '솜털 망둑이',        baseWeight: 0.12, color: '#E0D8C0', size: 0.44 },
  { id: 'tiny_base_03', name: '송알 새끼버들치',    baseWeight: 0.08, color: '#C8E0D8', size: 0.40 },
  { id: 'tiny_base_04', name: '토톡 모래무지',      baseWeight: 0.14, color: '#D0C8B8', size: 0.46 },
];
export const TINY_P1 = [
  { id: 'tiny_p1_01', name: '까꿍 미꾸리',          baseWeight: 0.11, color: '#C0B098', size: 0.43 },
  { id: 'tiny_p1_02', name: '또박 어린각시붕어',    baseWeight: 0.13, color: '#E8D8E0', size: 0.45 },
  { id: 'tiny_p1_03', name: '빠끔 새끼쉬리',        baseWeight: 0.10, color: '#D8C8B8', size: 0.42 },
  { id: 'tiny_p1_04', name: '동글 새끼떡붕어',      baseWeight: 0.15, color: '#D0D8E0', size: 0.47 },
];
export const TINY_P2 = [
  { id: 'tiny_p2_01', name: '살랑 어린납자루',      baseWeight: 0.12, color: '#C8D0D8', size: 0.43 },
  { id: 'tiny_p2_02', name: '종알 어린각시고기',    baseWeight: 0.14, color: '#E0C8D0', size: 0.45 },
  { id: 'tiny_p2_03', name: '폴짝 어린납지리',      baseWeight: 0.13, color: '#D0E0C0', size: 0.44 },
  { id: 'tiny_p2_04', name: '도란 어린버들치',      baseWeight: 0.16, color: '#C0D8C8', size: 0.46 },
];
export const TINY_P3 = [
  { id: 'tiny_p3_01', name: '사르륵 새벽미꾸리',    baseWeight: 0.14, color: '#B8C0D8', size: 0.44 },
  { id: 'tiny_p3_02', name: '또로록 안개붕어',      baseWeight: 0.16, color: '#D8D0E0', size: 0.46 },
  { id: 'tiny_p3_03', name: '살그머니 꿈자락각시',  baseWeight: 0.15, color: '#C8B8D0', size: 0.45 },
  { id: 'tiny_p3_04', name: '어룽 안갯빛쉬리',      baseWeight: 0.18, color: '#B8D0E0', size: 0.47 },
];
export const TINY_P4 = [
  { id: 'tiny_p4_01', name: '노을빛 어린별붕어',    baseWeight: 0.17, color: '#FFB888', size: 0.45 },
  { id: 'tiny_p4_02', name: '가물가물 안개각시',    baseWeight: 0.19, color: '#A8B0C8', size: 0.47 },
  { id: 'tiny_p4_03', name: '별총총 어린은빛피라미', baseWeight: 0.18, color: '#D0E0FF', size: 0.46 },
  { id: 'tiny_p4_04', name: '어슴푸레 꿈빛쉬리',    baseWeight: 0.22, color: '#C0A8E0', size: 0.48 },
];
export const TINY_P5 = [
  { id: 'tiny_p5_01', name: '은하결 새끼별고기',    baseWeight: 0.22, color: '#B0C0FF', size: 0.47 },
  { id: 'tiny_p5_02', name: '꿈자락 새끼달피라미',  baseWeight: 0.25, color: '#FFE8B0', size: 0.49 },
  { id: 'tiny_p5_03', name: '안개결 어린별쉬리',    baseWeight: 0.23, color: '#A8C8E0', size: 0.48 },
  { id: 'tiny_p5_04', name: '별눈물 새끼은하각시',  baseWeight: 0.28, color: '#D8B8FF', size: 0.50 },
];

/* ============================================
   소형 (sml) — 24종
   ============================================ */
export const SML_BASE = [
  { id: 'sml_base_01', name: '또르르 송사리',       baseWeight: 0.32, color: '#B5C7E8', size: 0.55 },
  { id: 'sml_base_02', name: '반짝 피라미',         baseWeight: 0.42, color: '#E8E0B5', size: 0.60 },
  { id: 'sml_base_03', name: '종알 빙어',           baseWeight: 0.36, color: '#C8E0F0', size: 0.58 },
  { id: 'sml_base_04', name: '살랑 가시고기',       baseWeight: 0.46, color: '#A8C8B0', size: 0.62 },
];
export const SML_P1 = [
  { id: 'sml_p1_01', name: '졸졸 쉬리',             baseWeight: 0.52, color: '#D8B8A8', size: 0.65 },
  { id: 'sml_p1_02', name: '또박 각시붕어',         baseWeight: 0.40, color: '#E0B8C8', size: 0.58 },
  { id: 'sml_p1_03', name: '살금 떡붕어',           baseWeight: 0.44, color: '#C0C8D0', size: 0.60 },
  { id: 'sml_p1_04', name: '도란 모래무지',         baseWeight: 0.38, color: '#D8C0A8', size: 0.57 },
];
export const SML_P2 = [
  { id: 'sml_p2_01', name: '폴짝 납자루',           baseWeight: 0.50, color: '#B8D0E0', size: 0.63 },
  { id: 'sml_p2_02', name: '동글 각시고기',         baseWeight: 0.46, color: '#D8B8D0', size: 0.61 },
  { id: 'sml_p2_03', name: '사르락 안개송사리',     baseWeight: 0.55, color: '#A8B8D0', size: 0.64 },
  { id: 'sml_p2_04', name: '보송 안개피라미',       baseWeight: 0.60, color: '#D8D0B0', size: 0.65 },
];
export const SML_P3 = [
  { id: 'sml_p3_01', name: '어룽 꿈빛빙어',         baseWeight: 0.62, color: '#B0D0E8', size: 0.65 },
  { id: 'sml_p3_02', name: '살푸시 안개쉬리',       baseWeight: 0.70, color: '#C8B0A0', size: 0.66 },
  { id: 'sml_p3_03', name: '노을빛 송사리',         baseWeight: 0.68, color: '#FFA070', size: 0.66 },
  { id: 'sml_p3_04', name: '반딧불 피라미',         baseWeight: 0.78, color: '#FFE070', size: 0.67 },
];
export const SML_P4 = [
  { id: 'sml_p4_01', name: '별가루 빙어',           baseWeight: 0.85, color: '#D0E0FF', size: 0.68 },
  { id: 'sml_p4_02', name: '무지개 가시고기',       baseWeight: 0.95, color: '#FF9DCB', size: 0.70 },
  { id: 'sml_p4_03', name: '천둥결 송사리',         baseWeight: 0.88, color: '#7080B0', size: 0.69 },
  { id: 'sml_p4_04', name: '안개결 피라미',         baseWeight: 1.00, color: '#9098A8', size: 0.70 },
];
export const SML_P5 = [
  { id: 'sml_p5_01', name: '은하결 별송사리',       baseWeight: 1.10, color: '#A0B8FF', size: 0.71 },
  { id: 'sml_p5_02', name: '별눈물 피라미',         baseWeight: 1.20, color: '#E8C8FF', size: 0.72 },
  { id: 'sml_p5_03', name: '꿈자락 빙어',           baseWeight: 1.15, color: '#FFD8E8', size: 0.71 },
  { id: 'sml_p5_04', name: '안개결 별가시고기',     baseWeight: 1.30, color: '#B0A8D8', size: 0.73 },
];

/* ============================================
   중형 (med) — 24종
   ============================================ */
export const MED_BASE = [
  { id: 'med_base_01', name: '별가루 잉어',         baseWeight:   6, color: '#C8D4F0', size: 0.78 },
  { id: 'med_base_02', name: '풀잎 향어',           baseWeight:   9, color: '#9DC890', size: 0.78 },
  { id: 'med_base_03', name: '안개빛 농어',         baseWeight:  14, color: '#B8C0C8', size: 0.78 },
  { id: 'med_base_04', name: '폭포물 황어',         baseWeight:  22, color: '#E8C870', size: 0.78 },
];
export const MED_P1 = [
  { id: 'med_p1_01', name: '노을빛 누치',           baseWeight:  35, color: '#FFB070', size: 0.79 },
  { id: 'med_p1_02', name: '번개무늬 청어',         baseWeight:  60, color: '#7090C8', size: 0.79 },
  { id: 'med_p1_03', name: '별꿈 갈치',             baseWeight: 100, color: '#D0D8E8', size: 0.79 },
  { id: 'med_p1_04', name: '잠빛 갈겨니',           baseWeight: 180, color: '#B0A8D0', size: 0.79 },
];
export const MED_P2 = [
  { id: 'med_p2_01', name: '꿈비늘 잉어',           baseWeight: 250, color: '#FFE090', size: 0.80 },
  { id: 'med_p2_02', name: '꿈안개 잉어',           baseWeight: 280, color: '#D8C8E8', size: 0.80 },
  { id: 'med_p2_03', name: '새벽결 향어',           baseWeight: 320, color: '#A8C0A0', size: 0.80 },
  { id: 'med_p2_04', name: '송알송알 농어',         baseWeight: 360, color: '#A8B0C0', size: 0.80 },
];
export const MED_P3 = [
  { id: 'med_p3_01', name: '무지개 누치',           baseWeight: 420, color: '#FF9DCB', size: 0.81 },
  { id: 'med_p3_02', name: '노을꽃 황어',           baseWeight: 500, color: '#FF8050', size: 0.81 },
  { id: 'med_p3_03', name: '반딧불 청어',           baseWeight: 580, color: '#FFE060', size: 0.81 },
  { id: 'med_p3_04', name: '별가루 갈치',           baseWeight: 680, color: '#D8E0FF', size: 0.81 },
];
export const MED_P4 = [
  { id: 'med_p4_01', name: '천둥결 잉어',           baseWeight: 800, color: '#5070A0', size: 0.82 },
  { id: 'med_p4_02', name: '안개결 향어',           baseWeight: 950, color: '#90A098', size: 0.82 },
  { id: 'med_p4_03', name: '별눈물 농어',           baseWeight:1100, color: '#A0B8FF', size: 0.82 },
  { id: 'med_p4_04', name: '무지갯빛 갈겨니',       baseWeight:1300, color: '#FF80B0', size: 0.82 },
];
export const MED_P5 = [
  { id: 'med_p5_01', name: '은하빛 별잉어',         baseWeight:1500, color: '#90A8FF', size: 0.83 },
  { id: 'med_p5_02', name: '꿈자락 별향어',         baseWeight:1800, color: '#B8A0E8', size: 0.83 },
  { id: 'med_p5_03', name: '별꿈 안개농어',         baseWeight:2100, color: '#A8B8E0', size: 0.83 },
  { id: 'med_p5_04', name: '잠속 별갈치',           baseWeight:2500, color: '#7060A8', size: 0.83 },
];

/* ============================================
   월척 (big) — 24종
   ============================================ */
export const BIG_BASE = [
  { id: 'big_base_01', name: '달밤의 거대향어',     baseWeight:   35, color: '#8FA8D0', size: 0.88 },
  { id: 'big_base_02', name: '반딧불 대왕메기',     baseWeight:   55, color: '#C8E060', size: 0.88 },
  { id: 'big_base_03', name: '안개속 대왕가물치',   baseWeight:   80, color: '#909AA8', size: 0.88 },
  { id: 'big_base_04', name: '꿈자락 거대청새치',   baseWeight:  130, color: '#5FC9F7', size: 0.88 },
];
export const BIG_P1 = [
  { id: 'big_p1_01', name: '노을 대왕연어',         baseWeight:  220, color: '#FF8A50', size: 0.89 },
  { id: 'big_p1_02', name: '천둥 거대다랑어',       baseWeight:  380, color: '#5070A0', size: 0.89 },
  { id: 'big_p1_03', name: '심연 대왕문어',         baseWeight:  650, color: '#8050A0', size: 0.89 },
  { id: 'big_p1_04', name: '잠속 대왕복어',         baseWeight: 1100, color: '#D8C0E8', size: 0.89 },
];
export const BIG_P2 = [
  { id: 'big_p2_01', name: '새벽결 거대향어',       baseWeight: 1400, color: '#A0B0D8', size: 0.90 },
  { id: 'big_p2_02', name: '폭포물 대왕메기',       baseWeight: 1700, color: '#80B0A0', size: 0.90 },
  { id: 'big_p2_03', name: '안갯빛 대왕가물치',     baseWeight: 2000, color: '#7888A0', size: 0.90 },
  { id: 'big_p2_04', name: '꿈빛 거대청새치',       baseWeight: 2400, color: '#60BFFA', size: 0.90 },
];
export const BIG_P3 = [
  { id: 'big_p3_01', name: '노을꽃 대왕연어',       baseWeight: 2800, color: '#FF7040', size: 0.91 },
  { id: 'big_p3_02', name: '천둥결 거대다랑어',     baseWeight: 3300, color: '#3050A0', size: 0.91 },
  { id: 'big_p3_03', name: '심연결 대왕문어',       baseWeight: 3900, color: '#604098', size: 0.91 },
  { id: 'big_p3_04', name: '잠빛 대왕복어',         baseWeight: 4600, color: '#C0A8E0', size: 0.91 },
];
export const BIG_P4 = [
  { id: 'big_p4_01', name: '별가루 대왕향어',       baseWeight: 5300, color: '#B0C0FF', size: 0.92 },
  { id: 'big_p4_02', name: '무지개 대왕메기',       baseWeight: 6200, color: '#FF9DCB', size: 0.92 },
  { id: 'big_p4_03', name: '어둠빛 대왕가물치',     baseWeight: 7200, color: '#404858', size: 0.92 },
  { id: 'big_p4_04', name: '별눈물 거대청새치',     baseWeight: 8500, color: '#80B0FF', size: 0.92 },
];
export const BIG_P5 = [
  { id: 'big_p5_01', name: '은하결 대왕연어',       baseWeight: 9800, color: '#A0B0FF', size: 0.93 },
  { id: 'big_p5_02', name: '벼락결 별다랑어',       baseWeight:11500, color: '#5060B0', size: 0.93 },
  { id: 'big_p5_03', name: '잠속 별문어',           baseWeight:13500, color: '#704090', size: 0.93 },
  { id: 'big_p5_04', name: '꿈자락 신비복어',       baseWeight:16000, color: '#D8B0F0', size: 0.93 },
];

/* ============================================
   대물 (huge) — 24종
   ============================================ */
export const HUGE_BASE = [
  { id: 'huge_base_01', name: '별씨 대왕잉어',       baseWeight:   70, color: '#A0B8E0', size: 0.92 },
  { id: 'huge_base_02', name: '반딧빛 대왕거북',     baseWeight:  120, color: '#B0E070', size: 0.92 },
  { id: 'huge_base_03', name: '안갯빛 거대가물치',   baseWeight:  180, color: '#8090A8', size: 0.92 },
  { id: 'huge_base_04', name: '무지개 폭포대왕',     baseWeight:  280, color: '#80D8F7', size: 0.92 },
];
export const HUGE_P1 = [
  { id: 'huge_p1_01', name: '노을꽃 대왕송어',       baseWeight:  450, color: '#FF7050', size: 0.93 },
  { id: 'huge_p1_02', name: '천둥울림 대왕다랑어',   baseWeight:  760, color: '#4060A0', size: 0.93 },
  { id: 'huge_p1_03', name: '별눈물 심해대왕',       baseWeight: 1300, color: '#7050B0', size: 0.93 },
  { id: 'huge_p1_04', name: '잠속결 대왕복어',       baseWeight: 2200, color: '#C8B0E8', size: 0.93 },
];
export const HUGE_P2 = [
  { id: 'huge_p2_01', name: '새벽결 대왕잉어',       baseWeight: 2700, color: '#90A8C0', size: 0.94 },
  { id: 'huge_p2_02', name: '풀잎 대왕거북',         baseWeight: 3200, color: '#80A060', size: 0.94 },
  { id: 'huge_p2_03', name: '폭포결 대왕가물치',     baseWeight: 3800, color: '#7090A0', size: 0.94 },
  { id: 'huge_p2_04', name: '안갯결 폭포대왕',       baseWeight: 4500, color: '#A0B8C8', size: 0.94 },
];
export const HUGE_P3 = [
  { id: 'huge_p3_01', name: '별가루 대왕송어',       baseWeight: 5300, color: '#D0E0FF', size: 0.95 },
  { id: 'huge_p3_02', name: '천둥결 대왕다랑어',     baseWeight: 6300, color: '#304080', size: 0.95 },
  { id: 'huge_p3_03', name: '심연결 심해대왕',       baseWeight: 7500, color: '#503890', size: 0.95 },
  { id: 'huge_p3_04', name: '잠속 신비복어',         baseWeight: 8900, color: '#B898E0', size: 0.95 },
];
export const HUGE_P4 = [
  { id: 'huge_p4_01', name: '무지개 대왕잉어',       baseWeight:10500, color: '#FF80C8', size: 0.96 },
  { id: 'huge_p4_02', name: '노을빛 대왕거북',       baseWeight:12500, color: '#FF8050', size: 0.96 },
  { id: 'huge_p4_03', name: '어둠결 대왕가물치',     baseWeight:14800, color: '#303848', size: 0.96 },
  { id: 'huge_p4_04', name: '별눈물 폭포대왕',       baseWeight:17500, color: '#90B0FF', size: 0.96 },
];
export const HUGE_P5 = [
  { id: 'huge_p5_01', name: '은하결 대왕송어',       baseWeight:20500, color: '#A0B8FF', size: 0.97 },
  { id: 'huge_p5_02', name: '천둥결 별다랑어',       baseWeight:24000, color: '#404FA0', size: 0.97 },
  { id: 'huge_p5_03', name: '별꿈 심해대왕',         baseWeight:28000, color: '#6040A8', size: 0.97 },
  { id: 'huge_p5_04', name: '잠속 별복어',           baseWeight:33000, color: '#C0A0F0', size: 0.97 },
];

/* ============================================
   보스 (boss) — 24종
   ============================================ */
export const BOSS_BASE = [
  { id: 'boss_base_01', name: '은빛 별잉어',         baseWeight:  140, color: '#E8EFFA', size: 0.95 },
  { id: 'boss_base_02', name: '반딧불 대왕거북',     baseWeight:  220, color: '#E8F0A8', size: 0.95 },
  { id: 'boss_base_03', name: '안개 비단잉어',       baseWeight:  340, color: '#D8C8E0', size: 0.95 },
  { id: 'boss_base_04', name: '무지개 달빛송어',     baseWeight:  520, color: '#FF9DCB', size: 0.95 },
];
export const BOSS_P1 = [
  { id: 'boss_p1_01', name: '황혼 가오리',           baseWeight:  850, color: '#C868A0', size: 0.96 },
  { id: 'boss_p1_02', name: '벼락무늬 상어',         baseWeight: 1500, color: '#E0E090', size: 0.96 },
  { id: 'boss_p1_03', name: '별삼킨 돌고래',         baseWeight: 2500, color: '#9DB8E8', size: 0.96 },
  { id: 'boss_p1_04', name: '은하수 향유고래',       baseWeight: 5000, color: '#A090E0', size: 0.96 },
];
export const BOSS_P2 = [
  { id: 'boss_p2_01', name: '새벽빛 별잉어',         baseWeight: 6200, color: '#D8E0F8', size: 0.97 },
  { id: 'boss_p2_02', name: '풀잎결 대왕거북',       baseWeight: 7500, color: '#A8C898', size: 0.97 },
  { id: 'boss_p2_03', name: '폭포결 비단잉어',       baseWeight: 9000, color: '#A0B8C0', size: 0.97 },
  { id: 'boss_p2_04', name: '안갯빛 달빛송어',       baseWeight:11000, color: '#E0B8D0', size: 0.97 },
];
export const BOSS_P3 = [
  { id: 'boss_p3_01', name: '천둥 황혼가오리',       baseWeight:13000, color: '#A05080', size: 0.98 },
  { id: 'boss_p3_02', name: '별가루 무늬상어',       baseWeight:15500, color: '#D0E8FF', size: 0.98 },
  { id: 'boss_p3_03', name: '노을 별삼킨돌고래',     baseWeight:18500, color: '#FF7090', size: 0.98 },
  { id: 'boss_p3_04', name: '심연 향유고래',         baseWeight:22000, color: '#5040A0', size: 0.98 },
];
export const BOSS_P4 = [
  { id: 'boss_p4_01', name: '은하결 별잉어',         baseWeight:26000, color: '#A0B0FF', size: 0.98 },
  { id: 'boss_p4_02', name: '천둥결 대왕거북',       baseWeight:31000, color: '#506098', size: 0.98 },
  { id: 'boss_p4_03', name: '어둠결 비단잉어',       baseWeight:37000, color: '#382848', size: 0.98 },
  { id: 'boss_p4_04', name: '별눈물 달빛송어',       baseWeight:44000, color: '#90A8FF', size: 0.98 },
];
export const BOSS_P5 = [
  { id: 'boss_p5_01', name: '별꿈 황혼가오리',       baseWeight:52000, color: '#B070C0', size: 0.99 },
  { id: 'boss_p5_02', name: '잠속 무늬상어',         baseWeight:61000, color: '#7060A8', size: 0.99 },
  { id: 'boss_p5_03', name: '은하결 별삼킨돌고래',   baseWeight:72000, color: '#A8C0FF', size: 0.99 },
  { id: 'boss_p5_04', name: '꿈자락 향유고래',       baseWeight:85000, color: '#C8B0F0', size: 0.99 },
];

/* ============================================
   전설 (legend) — 24종
   ============================================ */
export const LEGEND_BASE = [
  { id: 'legend_base_01', name: '별을 깨운 신어',       baseWeight:  4000, color: '#F0F5FF', size: 0.98 },
  { id: 'legend_base_02', name: '안개를 짠 비단신어',   baseWeight:  6500, color: '#E0D0F0', size: 0.98 },
  { id: 'legend_base_03', name: '노을바람 신어',        baseWeight: 10000, color: '#FF7090', size: 0.98 },
  { id: 'legend_base_04', name: '별을 빚은 신어',       baseWeight: 16000, color: '#A0C0FF', size: 0.98 },
];
export const LEGEND_P1 = [
  { id: 'legend_p1_01', name: '잠의 정령',              baseWeight: 24000, color: '#C0A8F0', size: 0.99 },
  { id: 'legend_p1_02', name: '꿈을 깨운 신어',         baseWeight: 33000, color: '#E8C8FF', size: 0.99 },
  { id: 'legend_p1_03', name: '무지개를 짠 신어',       baseWeight: 44000, color: '#FF9DCB', size: 0.99 },
  { id: 'legend_p1_04', name: '풀잎바람 신어',          baseWeight: 56000, color: '#A0D098', size: 0.99 },
];
export const LEGEND_P2 = [
  { id: 'legend_p2_01', name: '별가루 신어',            baseWeight: 70000, color: '#D0E0FF', size: 0.99 },
  { id: 'legend_p2_02', name: '노을꽃 신어',            baseWeight: 86000, color: '#FF8060', size: 0.99 },
  { id: 'legend_p2_03', name: '안갯결 신어',            baseWeight:105000, color: '#A8B8C8', size: 0.99 },
  { id: 'legend_p2_04', name: '폭포결 신어',            baseWeight:128000, color: '#80B0E0', size: 0.99 },
];
export const LEGEND_P3 = [
  { id: 'legend_p3_01', name: '천둥울림 신어',          baseWeight:155000, color: '#4060B0', size: 1.00 },
  { id: 'legend_p3_02', name: '심연 정령',              baseWeight:185000, color: '#5040A8', size: 1.00 },
  { id: 'legend_p3_03', name: '은빛 정령',              baseWeight:220000, color: '#E0E8F0', size: 1.00 },
  { id: 'legend_p3_04', name: '노을 정령',              baseWeight:265000, color: '#FF7050', size: 1.00 },
];
export const LEGEND_P4 = [
  { id: 'legend_p4_01', name: '별눈물 신어',            baseWeight:315000, color: '#A0B8FF', size: 1.00 },
  { id: 'legend_p4_02', name: '무지갯빛 신어',          baseWeight:380000, color: '#FF80C8', size: 1.00 },
  { id: 'legend_p4_03', name: '어둠결 신어',            baseWeight:455000, color: '#302848', size: 1.00 },
  { id: 'legend_p4_04', name: '새벽빛 정령',            baseWeight:545000, color: '#D0D8F0', size: 1.00 },
];
export const LEGEND_P5 = [
  { id: 'legend_p5_01', name: '은하결 신어',            baseWeight: 650000, color: '#90A8FF', size: 1.00 },
  { id: 'legend_p5_02', name: '별꿈 정령',              baseWeight: 780000, color: '#C8B0FF', size: 1.00 },
  { id: 'legend_p5_03', name: '잠속 정령',              baseWeight: 935000, color: '#6040A0', size: 1.00 },
  { id: 'legend_p5_04', name: '꿈자락 신어',            baseWeight:1120000, color: '#FFB0E0', size: 1.00 },
];

/* ============================================
   신화 (mythic) — 4종 (변종 없음)
   - mythic_01 황금빛꿈고래: 11지역 검은 25+ 전용 (게임 엔딩 상징)
   - mythic_02~04: 11지역 분홍/황금/하얀 10+ 무작위
   - 4종 동일 보상 (대표 결정: 무게 + 전설/신화 장비 50:50)
   ============================================ */
export const MYTHIC_FISH = [
  { id: 'mythic_01', name: '황금빛꿈고래',          baseWeight: 150000, color: '#FFE090', size: 1.00 },
  { id: 'mythic_02', name: '무지갯빛 환상고래',     baseWeight: 130000, color: '#FFB0F0', size: 1.00 },
  { id: 'mythic_03', name: '은하결 별고래',         baseWeight: 140000, color: '#A0B8FF', size: 1.00 },
  { id: 'mythic_04', name: '새벽빛 정령고래',       baseWeight: 135000, color: '#FFE8B0', size: 1.00 },
];

/* ============================================
   히든 (hidden) — 1종 (분홍 미니게임 보상)
   - baseWeight 500 = 도감/카탈로그 표시용
     실제 잡기 무게는 hidden-hit-engine.js pickHiddenHitGrade() 추첨 →
     해당 등급의 weight.js GRADE_WEIGHT_RANGE 에서 균등 랜덤 롤
   ============================================ */
export const HIDDEN_FISH = [
  { id: 'hidden_01', name: '시크릿꿈고래',          baseWeight: 500, color: '#FFB8D8', size: 1.00 },
];

/* ============================================
   황금어 (golden) — 1종 (★ Day 27 신규)
   - 골든힛에서 잡힌 모든 등급(대물~legend+++++~신화) 통합 도감 어종
   - baseWeight 5000 = 도감/카탈로그 표시용
     실제 잡기 무게는 golden-hit-engine.js 의 등급별 무게 계산 (지역 multiplier 반영)
   - 도감 특수어종 탭에 표시 (히든과 함께)
   ============================================ */
export const GOLDEN_FISH = [
  { id: 'golden_01', name: '황금꿈잉어',            baseWeight: 5000, color: '#FFE090', size: 1.00 },
];

/* ============================================
   등급별 통합 풀 (기존 호환 + 도감용)
   ============================================ */
export const TINY_FISH   = Object.freeze([...TINY_BASE,   ...TINY_P1,   ...TINY_P2,   ...TINY_P3,   ...TINY_P4,   ...TINY_P5]);
export const SMALL_FISH  = Object.freeze([...SML_BASE,    ...SML_P1,    ...SML_P2,    ...SML_P3,    ...SML_P4,    ...SML_P5]);
export const MEDIUM_FISH = Object.freeze([...MED_BASE,    ...MED_P1,    ...MED_P2,    ...MED_P3,    ...MED_P4,    ...MED_P5]);
export const BIG_FISH    = Object.freeze([...BIG_BASE,    ...BIG_P1,    ...BIG_P2,    ...BIG_P3,    ...BIG_P4,    ...BIG_P5]);
export const HUGE_FISH   = Object.freeze([...HUGE_BASE,   ...HUGE_P1,   ...HUGE_P2,   ...HUGE_P3,   ...HUGE_P4,   ...HUGE_P5]);
export const BOSS_FISH   = Object.freeze([...BOSS_BASE,   ...BOSS_P1,   ...BOSS_P2,   ...BOSS_P3,   ...BOSS_P4,   ...BOSS_P5]);
export const LEGEND_FISH = Object.freeze([...LEGEND_BASE, ...LEGEND_P1, ...LEGEND_P2, ...LEGEND_P3, ...LEGEND_P4, ...LEGEND_P5]);

/* ============================================
   변종 시스템 메타데이터 (★ Day 27 신규)
   ============================================ */

/** 변종 순서 (낮→높). + 표시 카운트 = TIER_ORDER 인덱스 */
export const TIER_ORDER = Object.freeze(['base', 'p1', 'p2', 'p3', 'p4', 'p5']);

/** 지역(stageId 1~11) → 변종 매핑 */
export const STAGE_TO_TIER = Object.freeze({
   1: 'base',  2: 'base',
   3: 'p1',    4: 'p1',
   5: 'p2',    6: 'p2',
   7: 'p3',    8: 'p3',
   9: 'p4',   10: 'p4',
  11: 'p5',
});

/** 등급 + 변종 → 풀 매핑 (지역 기반 픽 시 사용) */
const GRADE_TIER_TO_POOL = Object.freeze({
  '치어':   { base: TINY_BASE,   p1: TINY_P1,   p2: TINY_P2,   p3: TINY_P3,   p4: TINY_P4,   p5: TINY_P5   },
  '소형':   { base: SML_BASE,    p1: SML_P1,    p2: SML_P2,    p3: SML_P3,    p4: SML_P4,    p5: SML_P5    },
  '중형':   { base: MED_BASE,    p1: MED_P1,    p2: MED_P2,    p3: MED_P3,    p4: MED_P4,    p5: MED_P5    },
  '월척':   { base: BIG_BASE,    p1: BIG_P1,    p2: BIG_P2,    p3: BIG_P3,    p4: BIG_P4,    p5: BIG_P5    },
  '대물':   { base: HUGE_BASE,   p1: HUGE_P1,   p2: HUGE_P2,   p3: HUGE_P3,   p4: HUGE_P4,   p5: HUGE_P5   },
  '보스':   { base: BOSS_BASE,   p1: BOSS_P1,   p2: BOSS_P2,   p3: BOSS_P3,   p4: BOSS_P4,   p5: BOSS_P5   },
  '전설보스':{ base: LEGEND_BASE, p1: LEGEND_P1, p2: LEGEND_P2, p3: LEGEND_P3, p4: LEGEND_P4, p5: LEGEND_P5 },
});

/* ============================================
   등급 → 풀 매핑 (변종 무시 — 도감/픽업 안전망)
   ============================================ */
const GRADE_TO_POOL = Object.freeze({
  '치어':       TINY_FISH,
  '소형':       SMALL_FISH,
  '중형':       MEDIUM_FISH,
  '월척':       BIG_FISH,
  '대물':       HUGE_FISH,
  '보스':       BOSS_FISH,
  '전설보스':   LEGEND_FISH,
  '신화보스':   MYTHIC_FISH,
  '숨겨진보스': HIDDEN_FISH,
  '황금어':     GOLDEN_FISH,  // ★ Day 27
});

/**
 * 등급 매칭 시 어종 픽 (★ Day 27 — stageId 기반 변종 풀 선택).
 *
 * 동작:
 *   1. stageId → STAGE_TO_TIER[stageId] → 변종 (예: 5→'p2')
 *   2. GRADE_TIER_TO_POOL[grade][tier] → 변종 풀 (예: 5지역 '중형' → MED_P2)
 *   3. 변종 풀에서 균등 랜덤 픽
 *
 * 신화/히든/황금어는 변종 없음 — GRADE_TO_POOL 직접 사용 (안전망).
 * stageId 없거나 등급에 변종 없으면 GRADE_TO_POOL 통합 풀에서 픽 (호환).
 *
 * @param {number|null} stageId  1~11 (없으면 통합 풀 사용)
 * @param {string} grade '치어' | '소형' | '중형' | '월척' | '대물' | '보스' | '전설보스' | '신화보스' | '숨겨진보스' | '황금어'
 * @returns {object|null}
 */
export function pickFishByGrade(stageId, grade) {
  // 변종 시스템 — stageId + 일반 등급
  if (stageId && GRADE_TIER_TO_POOL[grade]) {
    const tier = STAGE_TO_TIER[stageId];
    if (tier) {
      const tierPool = GRADE_TIER_TO_POOL[grade][tier];
      if (tierPool && tierPool.length > 0) {
        return tierPool[Math.floor(Math.random() * tierPool.length)];
      }
    }
  }
  // 안전망 (신화/히든/황금어 또는 stageId 없을 때)
  const pool = GRADE_TO_POOL[grade];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * ★ Day 27 — 도감용 전체 물고기 목록 (총 174종, 순서 = 등급 낮→높).
 */
export const ALL_FISH = Object.freeze([
  ...TINY_FISH,    //  24
  ...SMALL_FISH,   //  24
  ...MEDIUM_FISH,  //  24
  ...BIG_FISH,     //  24
  ...HUGE_FISH,    //  24
  ...BOSS_FISH,    //  24
  ...LEGEND_FISH,  //  24
  ...MYTHIC_FISH,  //   4
  ...HIDDEN_FISH,  //   1
  ...GOLDEN_FISH,  //   1 ★ Day 27
]);                 // 174

/**
 * 물고기 id → 등급 역매핑 (도감 빌드/검색용).
 * ★ Day 27 — 새 ID 패턴 (tiny_base_01, tiny_p1_01 등) 대응.
 */
export function gradeOfFishId(fishId) {
  if (!fishId) return null;
  if (fishId.startsWith('tiny_'))   return '치어';
  if (fishId.startsWith('sml_'))    return '소형';
  if (fishId.startsWith('med_'))    return '중형';
  if (fishId.startsWith('big_'))    return '월척';
  if (fishId.startsWith('huge_'))   return '대물';
  if (fishId.startsWith('boss_'))   return '보스';
  if (fishId.startsWith('legend_')) return '전설보스';
  if (fishId.startsWith('mythic_')) return '신화보스';
  if (fishId.startsWith('hidden_')) return '숨겨진보스';
  if (fishId.startsWith('golden_')) return '황금어';   // ★ Day 27
  return null;
}

/**
 * ★ Day 27 — 물고기 id → 변종 (tier) 추출.
 *
 * 패턴: `<grade>_<tier>_<index>` (예: 'tiny_p3_02' → 'p3')
 * 신화/히든/황금어는 변종 없으므로 null.
 *
 * @returns {'base'|'p1'|'p2'|'p3'|'p4'|'p5'|null}
 */
export function tierOfFishId(fishId) {
  if (!fishId) return null;
  const m = fishId.match(/^(tiny|sml|med|big|huge|boss|legend)_(base|p1|p2|p3|p4|p5)_/);
  return m ? m[2] : null;
}

/**
 * ★ Day 27 — 물고기 id → 메타데이터 (등급 + 변종 + 표시용 등급명).
 *
 * 예:
 *   getFishMeta('tiny_p3_02') → { grade: '치어', tier: 'p3', displayGrade: '치어+++', plusCount: 3 }
 *   getFishMeta('mythic_01')  → { grade: '신화보스', tier: null, displayGrade: '신화보스', plusCount: 0 }
 *
 * @returns {{grade: string, tier: string|null, displayGrade: string, plusCount: number}|null}
 */
export function getFishMeta(fishId) {
  const grade = gradeOfFishId(fishId);
  if (!grade) return null;
  const tier = tierOfFishId(fishId);
  const plusCount = tier && tier !== 'base' ? Number(tier.slice(1)) : 0;
  const displayGrade = grade + '+'.repeat(plusCount);
  return { grade, tier, displayGrade, plusCount };
}

/**
 * ★ Day 27 — 어종 id → UI 표시용 등급명 (변종 + 표시).
 *
 * 예: 'tiny_p3_02' → '치어+++'  / 'mythic_01' → '신화보스'  / 'golden_01' → '황금어'
 */
export function fishDisplayGrade(fishId) {
  const meta = getFishMeta(fishId);
  return meta ? meta.displayGrade : null;
}

/**
 * ★ Day 27 — 신화 어종 추첨 (트리거별 다른 풀).
 *
 * 대표 결정 (Q-I B안):
 * - 검은 25+ 매칭 (triggerSymbol='fish') → **mythic_01 (황금빛꿈고래)** 고정 — 게임 엔딩 상징
 * - 분홍/황금/하얀 10+ 매칭 → **mythic_02~04 중 무작위** (황금빛꿈고래 제외)
 *
 * 보상은 4종 모두 동일 (대표 결정 — 무게 + 전설/신화템 50:50).
 * 차별점: 황금빛꿈고래만 별도 엔딩 영상 + 잡기 애니메이션 (추후 추가).
 *
 * @param {'fish'|'rainbow'|'golden'|'twinkle'} triggerSymbol  매칭 트리거 심볼
 * @returns {object|null}  mythic fish entry
 */
export function pickMythicFish(triggerSymbol) {
  // 검은 매칭 (검은 25+) = 황금빛꿈고래 고정 (엔딩 상징)
  if (triggerSymbol === 'fish') {
    return MYTHIC_FISH[0];  // mythic_01 황금빛꿈고래
  }
  // 분홍/황금/하얀 10+ = 나머지 3종 무작위 (mythic_02~04)
  const candidates = MYTHIC_FISH.slice(1);  // [mythic_02, mythic_03, mythic_04]
  if (candidates.length === 0) return MYTHIC_FISH[0];
  return candidates[Math.floor(Math.random() * candidates.length)];
}