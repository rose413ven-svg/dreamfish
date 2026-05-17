/* ===========================================
   stars.js — 별 분포 데이터
   ============================================
   docs/01_슬롯화면_디자인.md [배경] 섹션 SSOT.
   - 화면 전체 골고루 분포 (위쪽만 X)
   - 35~50개 점 + 4개 십자별
   - 좌표는 % (0~100) 단위로 화면 크기와 무관
   ============================================ */

/** 일반 별 색 (청백) */
const COLOR_BLUE = '#c8d4f0';
/** 황색 별 색 (살짝 따뜻) */
const COLOR_WARM = '#ffd9a0';

/**
 * 점 별 (작은 원).
 * @typedef {object} StarPoint
 * @property {number} x        가로 위치 (% 0~100)
 * @property {number} y        세로 위치 (% 0~100)
 * @property {number} size     지름 (px, 0.6 ~ 1.4)
 * @property {string} color    색
 * @property {number} opacity  0~1
 */

/** 점 별 40개 — 화면 전체에 약간 무작위로 분포 */
export const STAR_POINTS = [
  // 상단 (0~25%)
  { x:  6, y:  4, size: 1.0, color: COLOR_BLUE, opacity: 0.85 },
  { x: 18, y:  9, size: 1.3, color: COLOR_WARM, opacity: 0.95 },
  { x: 32, y:  6, size: 0.7, color: COLOR_BLUE, opacity: 0.55 },
  { x: 48, y: 12, size: 1.0, color: COLOR_BLUE, opacity: 0.75 },
  { x: 62, y:  4, size: 0.8, color: COLOR_BLUE, opacity: 0.6  },
  { x: 78, y: 11, size: 1.2, color: COLOR_BLUE, opacity: 0.85 },
  { x: 92, y:  7, size: 0.6, color: COLOR_BLUE, opacity: 0.5  },
  { x: 14, y: 18, size: 0.9, color: COLOR_BLUE, opacity: 0.7  },
  { x: 38, y: 22, size: 1.1, color: COLOR_WARM, opacity: 0.85 },
  { x: 56, y: 19, size: 0.8, color: COLOR_BLUE, opacity: 0.65 },

  // 중상 (25~45%) — 헤더 ~ KG 게이지 영역
  { x:  4, y: 28, size: 0.7, color: COLOR_BLUE, opacity: 0.55 },
  { x: 24, y: 33, size: 1.0, color: COLOR_BLUE, opacity: 0.8  },
  { x: 44, y: 30, size: 0.9, color: COLOR_BLUE, opacity: 0.7  },
  { x: 70, y: 27, size: 1.2, color: COLOR_WARM, opacity: 0.9  },
  { x: 86, y: 35, size: 0.8, color: COLOR_BLUE, opacity: 0.6  },
  { x: 12, y: 41, size: 1.0, color: COLOR_BLUE, opacity: 0.75 },
  { x: 30, y: 44, size: 0.6, color: COLOR_BLUE, opacity: 0.5  },
  { x: 58, y: 42, size: 0.8, color: COLOR_BLUE, opacity: 0.65 },

  // 중간 (45~65%) — 슬롯 그리드 뒤편
  { x:  8, y: 50, size: 0.9, color: COLOR_BLUE, opacity: 0.7  },
  { x: 92, y: 49, size: 1.0, color: COLOR_WARM, opacity: 0.8  },
  { x:  3, y: 58, size: 0.7, color: COLOR_BLUE, opacity: 0.55 },
  { x: 96, y: 60, size: 0.8, color: COLOR_BLUE, opacity: 0.6  },
  { x:  6, y: 64, size: 1.1, color: COLOR_BLUE, opacity: 0.8  },
  { x: 94, y: 66, size: 0.6, color: COLOR_BLUE, opacity: 0.5  },

  // 중하 (65~80%) — TURN 카운터 영역
  { x: 16, y: 71, size: 0.9, color: COLOR_BLUE, opacity: 0.7  },
  { x: 36, y: 73, size: 0.7, color: COLOR_BLUE, opacity: 0.55 },
  { x: 52, y: 70, size: 1.0, color: COLOR_BLUE, opacity: 0.75 },
  { x: 68, y: 75, size: 0.8, color: COLOR_BLUE, opacity: 0.6  },
  { x: 84, y: 72, size: 1.2, color: COLOR_WARM, opacity: 0.9  },
  { x: 28, y: 79, size: 0.6, color: COLOR_BLUE, opacity: 0.5  },
  { x: 60, y: 81, size: 0.9, color: COLOR_BLUE, opacity: 0.7  },

  // 하단 (80~100%) — 장비 + 던지다 버튼 영역
  { x:  9, y: 85, size: 1.0, color: COLOR_BLUE, opacity: 0.75 },
  { x: 26, y: 89, size: 0.7, color: COLOR_BLUE, opacity: 0.55 },
  { x: 41, y: 87, size: 0.8, color: COLOR_WARM, opacity: 0.8  },
  { x: 58, y: 90, size: 0.6, color: COLOR_BLUE, opacity: 0.5  },
  { x: 74, y: 86, size: 1.1, color: COLOR_BLUE, opacity: 0.8  },
  { x: 90, y: 91, size: 0.9, color: COLOR_BLUE, opacity: 0.7  },
  { x: 18, y: 95, size: 0.7, color: COLOR_BLUE, opacity: 0.55 },
  { x: 50, y: 96, size: 0.8, color: COLOR_BLUE, opacity: 0.65 },
  { x: 80, y: 97, size: 0.6, color: COLOR_BLUE, opacity: 0.5  },
];

/**
 * 십자별 (반짝이는 ✦ 모양). 별 4개를 화면에 분산.
 * @typedef {object} StarCross
 * @property {number} x        가로 위치 (%)
 * @property {number} y        세로 위치 (%)
 * @property {number} size     반경 (px, 십자 한쪽 길이)
 * @property {string} color
 * @property {number} opacity
 */

/** 십자별 4개 */
export const STAR_CROSSES = [
  { x: 22, y: 14, size: 6, color: COLOR_WARM, opacity: 0.95 },
  { x: 78, y: 25, size: 5, color: COLOR_BLUE, opacity: 0.85 },
  { x: 12, y: 60, size: 5, color: COLOR_BLUE, opacity: 0.85 },
  { x: 86, y: 78, size: 6, color: COLOR_WARM, opacity: 0.95 },
];
