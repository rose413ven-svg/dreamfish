/* ===========================================
   symbols.js — 슬롯 심볼 정의 + 가중치
   ============================================
   Day 7-2: 새 모델 — 정수 가중치 직접 가산 (% X)
   - 옵션 = 가중치 +N (예: fish_rate +5 → fish 가중치 +5)
   - empty 자동 차감 (옵션 합계만큼)
   - 가중치 = 등장 확률 % (총합 100 기준)

   Day 11 (강화 시스템 10강 도입): 베이스 가중치 재설계 (대표 결정)
     이전: empty 55 / fish 30 / golden 5 / rainbow 10  (대표 임의 테스트값)
     변경: empty 79 / fish 12 / golden 5 / rainbow 4   (정식 베이스)

   Day 20 (꿈조각 미니게임 — TWINKLE TIME 도입): twinkle 심볼 신규 추가 (대표 결정)
     변경: empty 76 → 71 / twinkle 5 신규 (golden 과 동일 가중치)

   ★ Day 21 (대표 결정) ★ — 그리드 보정 가중치 도입 + 베이스 재조정:
     - 그리드 보정 A1 도입 (equipment-effects.getAdjustedSymbolList):
         보정 계수 = 25 / (gridSize × gridSize)
         1지역 5×5 = ×1.0 / 11지역 11×11 = ×0.21
         → 매칭 가능 셀의 절대 수가 후반에서도 거의 유지 (대형 그리드에서
            흩어져서 인접 클러스터 형성이 자연스럽게 어려워짐)
     - 베이스 가중치 미세 조정 (전체 매칭 빈도 손잡이 — 대표 결정 임시값):
         empty   71 → 76
         fish    14 → 13
         golden   5 → 4
         rainbow  4 → 3
         twinkle  5 → 4
         (총합 100 유지)
     - 의도: A1 보정으로 후반 매칭 자연 감소 + 베이스 미세 조정으로
            전체 빈도 살짝 낮춰 시작. "너무 안 잡힌다" 싶으면 fish 13 → 14
            처럼 베이스만 손대서 1~11지역 통째 매칭 빈도 조절 가능 (밸런싱 손잡이).

   ★ Day 23 (대표 결정) ★ — 황·분·하얀 베이스 7 → 8 미세 상향 (밸런스 Phase 1-F):
     - Monte Carlo 시뮬레이션 검증 후 도입 (대표 직접 확인 — 30 cast당 1번 목표)
     - empty 62 → 59 / golden 7 → 8 / rainbow 7 → 8 / twinkle 7 → 8
     - 효과: 희귀 풀강 + Lv.20 캐릭터의 5지역 활동 무대에서
            황·분·하얀 매칭 약 31 cast당 1번 (대표 목표 정확 일치)
     - 검 우월 컨셉 유지: fish 17 그대로 / 황·분·하얀만 미세 상향
     - 매우 작은 변경(empty -3, 황·분·하얀 +1)이지만 효과 명확
   ============================================ */

export const SYMBOL_TYPES = {
  EMPTY:   'empty',
  FISH:    'fish',
  GOLDEN:  'golden',
  RAINBOW: 'rainbow',
  TWINKLE: 'twinkle',
};

export const SYMBOL_LIST = [
  { id: 'empty',   weight: 67, matchable: false },  // ★ Day 23 — 62 → 59 (황·분·하얀 +1씩 보충)
  { id: 'fish',    weight: 18, matchable: true  },  // 그대로 (검 우월 컨셉)
  { id: 'golden',  weight: 5,  matchable: true  },  // ★ Day 23 — 7 → 8 (밸런스 Phase 1-F)
  { id: 'rainbow', weight: 5,  matchable: true  },  // ★ Day 23 — 7 → 8
  { id: 'twinkle', weight: 5,  matchable: true  },  // ★ Day 23 — 7 → 8
];