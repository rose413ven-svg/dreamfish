/* ===========================================
   cluster.js — 매칭 덩어리 검출 (BFS flood fill)
   ============================================
   매칭 룰:
   - 인접: 상하좌우 4방향
   - fish (검은): fish끼리만 매칭
   - rainbow (분홍): rainbow끼리만 매칭 (검은과 연결 X)
   - golden: golden끼리만 매칭 (인접 클러스터, 별도 흐름 — golden-hit-engine + slot.js)
   - empty: 매칭 X
   - 3개 이상 모이면 cluster

   등급 결정 (Day 16 — 8등급 / ★ Day 22 — 분홍 트리거 폐기):
   - 치어:       검은 3개
   - 소형:       검은 4개
   - 중형:       검은 5~6개
   - 월척:       검은 7~8개
   - 대물:       검은 9~10개
   - 보스:       검은 11~14개   (분홍은 더 이상 보스 트리거 X)
   - 전설보스:   검은 15~24개
   - 신화보스:   검은 25+개     (분홍 10+ 트리거 폐기 — Day 22)

   ★ Day 22 — 분홍(rainbow) 보스 트리거 완전 폐기 (HIDDEN HIT 미니게임 도입):
     - 분홍 클러스터는 더 이상 forceBoss 부착 X → 사이즈 기반 일반 등급
       (단, Phase 2 부터 slot.js 흐름에서 분홍 매칭 시 HIDDEN HIT 미니게임으로
        분기 — 일반 잡기 게임으로 안 감. Phase 0 단계에선 일반 등급으로 처리)
     - 신화보스 분홍 10+ 트리거 폐기 → 신화보스 = 검은 25+ 단독
     - gradeOf / gradeOrder 시그니처에서 forceBoss 인자 폐기

   (황금 10+ → 신화 트리거는 slot.js 흐름에서 처리 — cluster gradeOf 와 별도)
   ============================================ */

/**
 * 같은 종류 인접 덩어리 검출
 * @param {Array<Array<string>>} grid
 * @param {string} symbol - 'fish' / 'rainbow' / 'golden'
 * @param {number} minSize
 */
function findClustersOfSymbol(grid, symbol, minSize) {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const clusters = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (visited[r][c]) continue;
      if (grid[r][c] !== symbol) continue;

      const queue = [[r, c]];
      const cells = [];
      visited[r][c] = true;

      while (queue.length) {
        const [cr, cc] = queue.shift();
        cells.push({ row: cr, col: cc, idx: cr * cols + cc });

        const neighbors = [
          [cr - 1, cc], [cr + 1, cc],
          [cr, cc - 1], [cr, cc + 1],
        ];

        for (const [nr, nc] of neighbors) {
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          if (visited[nr][nc]) continue;
          if (grid[nr][nc] !== symbol) continue;
          visited[nr][nc] = true;
          queue.push([nr, nc]);
        }
      }

      if (cells.length >= minSize) {
        clusters.push({
          cells,
          size: cells.length,
          symbol,
        });
      }
    }
  }
  return clusters;
}

/**
 * 모든 매칭 덩어리 찾기 (fish + rainbow)
 * 등급 낮은 순으로 정렬 (치어 → 소형 → ... → 신화보스)
 *
 * ★ Day 22 — 분홍 forceBoss 부착 폐기:
 *   - 기존: rainbowClusters 에 c.forceBoss = true 부착 (분홍 = 강제 보스/신화 트리거)
 *   - 변경: 폐기. 분홍 클러스터는 사이즈 기반 일반 등급으로 처리됨.
 *     (단, slot.js 흐름에서 분홍 매칭 검출 시 HIDDEN HIT 미니게임으로 분기 예정.
 *      Phase 0 단계에선 일반 잡기 흐름과 동일 — Phase 2 에서 별도 분기 추가)
 *
 * @returns {Array<{cells, size, symbol}>}
 */
export function findClusters(grid, minSize = 3) {
  const fishClusters = findClustersOfSymbol(grid, 'fish', minSize);
  const rainbowClusters = findClustersOfSymbol(grid, 'rainbow', minSize);

  // ★ Day 22 — forceBoss 부착 폐기 (HIDDEN HIT 도입으로 분홍 보스 트리거 자체 폐기)

  const all = [...fishClusters, ...rainbowClusters];
  // 등급 낮은 순 정렬
  all.sort((a, b) => gradeOrder(a) - gradeOrder(b));
  return all;
}

/** 등급 순서 인덱스 (Day 16 — 8등급. 0=치어 → 7=신화보스).
 *  ★ Day 29 — 등급 임계값 1단계씩 낮춤 (저렙 도파민 보강 + 도감 채우기 보장).
 *  검은(fish): size 3=치어 / 4=소형 / 5=중형 / 6=월척 / 7=대물 / 8=보스 / 9=전설보스 / 10+=신화보스
 *  분홍: 사이즈 기반 일반 등급 (검은과 동일 룰). 단 slot.js 에서 분홍 매칭 자체는
 *        HIDDEN HIT 미니게임(3~9) 또는 신화 트리거(10+) 로 분기되므로,
 *        이 함수의 분홍 등급은 사실상 사용되지 않는다. */
function gradeOrder(cluster) {
  // ★ Day 29 — 새 임계값 (3=치어 ~ 10+=신화보스 / 11+ 매칭은 모두 신화로 처리)
  const s = cluster.size;
  if (s <= 3)  return 0;  // 치어 (3)
  if (s === 4) return 1;  // 소형 (4)
  if (s === 5) return 2;  // 중형 (5)
  if (s === 6) return 3;  // 월척 (6)
  if (s === 7) return 4;  // 대물 (7)
  if (s === 8) return 5;  // 보스 (8)
  if (s === 9) return 6;  // 전설보스 (9)
  return 7;               // 신화보스 (10+)
}

/**
 * 매칭 사이즈 → 등급 (Day 16 — 8등급 / ★ Day 29 — 임계값 1단계씩 낮춤).
 *
 * ★ Day 29 (대표 결정) ★ — 등급 임계값 재설계:
 *   배경: 저렙 지역(5×5 그리드)에서 큰 매칭 발생 빈도 매우 낮음 → 월척+ 도감 채우기 거의 불가
 *   해결: 모든 매칭 크기 1단계씩 좋은 등급으로 매핑 (저렙 도파민 보강)
 *         검은 11+ 매칭은 모두 신화보스로 통일 (cap)
 *
 *   매핑:
 *     3 = 치어       6 = 월척       9 = 전설보스
 *     4 = 소형       7 = 대물      10+ = 신화보스 (10/11/12... 모두 신화)
 *     5 = 중형       8 = 보스
 *
 *   분홍/황금/트윙클 매칭은 별도 분기로 처리되므로 이 함수의 결과는 검은(fish) 매칭에만 적용됨.
 *
 * @param {number} size      클러스터 크기
 * @returns {string|null}     '치어' | '소형' | ... | '신화보스' / null = 매칭 X
 */
export function gradeOf(size) {
  // ★ Day 29 — 새 임계값 (3=치어 ~ 10+=신화보스)
  if (size <= 2)  return null;
  if (size === 3) return '치어';
  if (size === 4) return '소형';
  if (size === 5) return '중형';
  if (size === 6) return '월척';
  if (size === 7) return '대물';
  if (size === 8) return '보스';
  if (size === 9) return '전설보스';
  return '신화보스';   // 10+ = 모두 신화로 처리
}

/**
 * ★ Day 29 — 등급명 → 순서 인덱스 (낮→높).
 *
 * 용도: 멀티히트 자동선택 시 가장 큰 등급 비교 (slot.js openCatchGame).
 *       다른 등급 비교가 필요한 곳에서도 재사용 가능.
 *
 * 신화/히든/황금어 변종 없는 단일 어종은 일반 8등급 안에 매핑되어 있고,
 * 황금어/히든은 별도 추첨 시스템이라 멀티히트 비교에 들어오지 않음 (안전).
 */
export const GRADE_RANK = Object.freeze({
  '치어':     0,
  '소형':     1,
  '중형':     2,
  '월척':     3,
  '대물':     4,
  '보스':     5,
  '전설보스': 6,
  '신화보스': 7,
});

/**
 * 황금 셀 좌표 리스트 (선 연결용 — 레거시, 5개 흩어짐 모델)
 * @deprecated Phase C — 황금 매칭이 인접 클러스터 모델로 변경됨. findGoldenClusters 사용 권장.
 */
export function findGoldenCells(grid) {
  const cells = [];
  const cols = grid[0]?.length || 0;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 'golden') {
        cells.push({ row: r, col: c, idx: r * cols + c });
      }
    }
  }
  return cells;
}

export function countGolden(grid) {
  return findGoldenCells(grid).length;
}

/**
 * Phase C: 황금 인접 클러스터 검출.
 * findClusters 와 분리 — 황금은 잡기게임 X / 미니게임 O 라 처리 흐름 다름.
 *
 * Day 16 — 황금 10+ 인접 클러스터 = 신화 트리거 (slot.js 흐름에서 별도 처리)
 *          그 외 황금 3+ 인접 클러스터 = 골든힛 트리거 (기존 룰)
 *
 * @param {Array<Array<string>>} grid
 * @param {number} [minSize=3]
 * @returns {Array<{cells, size, symbol}>}
 */
export function findGoldenClusters(grid, minSize = 3) {
  return findClustersOfSymbol(grid, 'golden', minSize);
}

/**
 * Day 20: 꿈조각(트윙클) 인접 클러스터 검출.
 * findClusters / findGoldenClusters 와 분리 — 트윙클은 잡기게임 X / 트윙클타임 미니게임 O.
 *
 * 트리거 룰: 3+ 인접 클러스터 (황금과 동일)
 *  - slot.js 흐름에서 golden 클러스터가 먼저 있으면 그쪽 우선, 없을 때만 twinkle 트리거.
 *  - 트윙클 매칭 효과(빛나는 흰 선 + 흰 입자 + TWINKLE HIT 라벨)는 Phase 2 에서 처리.
 *  - 트윙클타임 진입(시작 팝업/카드 게임/자동 캐스트)은 Phase 3+ 에서 처리.
 *
 * @param {Array<Array<string>>} grid
 * @param {number} [minSize=3]
 * @returns {Array<{cells, size, symbol}>}
 */
export function findTwinkleClusters(grid, minSize = 3) {
  return findClustersOfSymbol(grid, 'twinkle', minSize);
}

/** Day 16 — 신화 트리거 임계값 (검은 25 / 황금 10).
 *  ★ Day 22 — MYTHIC_TRIGGER_PINK 폐기 (분홍 10+ 신화 트리거 폐기). */
export const MYTHIC_TRIGGER_BLACK = 25;
export const MYTHIC_TRIGGER_GOLD  = 10;

/**
 * ★ Day 26 — 까비까비 클러스터 검출 (Mixed 인접 덩어리, 대표 결정).
 *
 * 정의:
 * - 입질 4종(fish/golden/rainbow/twinkle) 중 어떤 심볼이든 매칭 후보
 * - 인접 (상하좌우 4방향), 3개 이상 모이면 클러스터
 * - **서로 다른 심볼이 2종 이상 포함되어야 까비까비** (단일 심볼 클러스터는 HIT가 잡으므로 제외)
 * - HIT 클러스터에 포함된 셀은 매칭에서 제외 (excludeCellSet 으로 전달 — 대표 Q-B A)
 *
 * 보상은 slot.js 에서 계산:
 *   weight = cellCount × max(1, kabikabi_bonus)
 *
 * 호출 순서 (slot.js):
 *   1. findClusters / findGoldenClusters / findTwinkleClusters 먼저
 *   2. 결과 셀들을 excludeCellSet 으로 모음
 *   3. findKabikabiClusters(grid, excludeCellSet) 호출
 *
 * @param {Array<Array<string>>} grid
 * @param {Set<string>} [excludeCellSet] - "row,col" 키 형태로 제외할 셀 (HIT 매칭 셀들)
 * @param {number} [minSize=3]
 * @returns {Array<{cells, size, symbols, isMixed: true}>}
 */
export function findKabikabiClusters(grid, excludeCellSet = new Set(), minSize = 3) {
  const KABIKABI_SYMBOLS = new Set(['fish', 'golden', 'rainbow', 'twinkle']);
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const clusters = [];

  const cellKey = (r, c) => `${r},${c}`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (visited[r][c]) continue;
      if (excludeCellSet.has(cellKey(r, c))) continue;
      if (!KABIKABI_SYMBOLS.has(grid[r][c])) continue;

      // BFS — 입질 4종이면 무엇이든 매칭 (excludeCellSet 셀은 벽처럼 차단)
      const queue = [[r, c]];
      const cells = [];
      const symbols = new Set();
      visited[r][c] = true;

      while (queue.length) {
        const [cr, cc] = queue.shift();
        const sym = grid[cr][cc];
        cells.push({ row: cr, col: cc, idx: cr * cols + cc, symbol: sym });
        symbols.add(sym);

        const neighbors = [
          [cr - 1, cc], [cr + 1, cc],
          [cr, cc - 1], [cr, cc + 1],
        ];
        for (const [nr, nc] of neighbors) {
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          if (visited[nr][nc]) continue;
          if (excludeCellSet.has(cellKey(nr, nc))) continue;
          if (!KABIKABI_SYMBOLS.has(grid[nr][nc])) continue;
          visited[nr][nc] = true;
          queue.push([nr, nc]);
        }
      }

      // 까비까비 조건: 사이즈 minSize+ AND 심볼 종류 2종+ (mixed)
      if (cells.length >= minSize && symbols.size >= 2) {
        clusters.push({
          cells,
          size: cells.length,
          symbols,
          isMixed: true,
        });
      }
    }
  }
  return clusters;
}

/**
 * ★ Day 29 — 좌표 배열에서 최대 인접 클러스터 size 계산 (BFS 기반).
 *
 * 용도: 트윙클 타임 자동 캐스트 중 누적 잠긴 트윙클 셀의 가장 큰 인접 덩어리 size 검사.
 *       size ≥ 15 → 황금빛꿈고래(mythic_01) 트리거 (slot.js exitTwinkleHitTime).
 *
 * findClustersOfSymbol 과 달리 2D grid 가 아닌 좌표 배열을 받음 (lockedCells 형태).
 * 단순 인접(상하좌우 4방향)만 검사. 행/열 경계 체크 포함.
 *
 * @param {Array<{row:number, col:number}>} cells   좌표 배열 (셀 단위)
 * @param {number} rows                              그리드 행 수
 * @param {number} cols                              그리드 열 수
 * @returns {number}                                 가장 큰 인접 클러스터 size (셀 없으면 0)
 */
export function findMaxClusterSizeFromCells(cells, rows, cols) {
  if (!cells || cells.length === 0) return 0;

  const cellSet = new Set(cells.map(({ row, col }) => row * cols + col));
  const visited = new Set();
  let maxSize = 0;

  for (const { row: sr, col: sc } of cells) {
    const startIdx = sr * cols + sc;
    if (visited.has(startIdx)) continue;

    // BFS — 시작 셀에서 인접 셀로 확장
    const queue = [[sr, sc]];
    visited.add(startIdx);
    let size = 0;

    while (queue.length) {
      const [r, c] = queue.shift();
      size += 1;

      const neighbors = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
      for (const [nr, nc] of neighbors) {
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const nIdx = nr * cols + nc;
        if (visited.has(nIdx)) continue;
        if (!cellSet.has(nIdx)) continue;
        visited.add(nIdx);
        queue.push([nr, nc]);
      }
    }

    if (size > maxSize) maxSize = size;
  }

  return maxSize;
}

/**
 * ★ Day 36 (대표 결정) — 좌표 배열에서 인접 클러스터(size >= minSize)들의 셀 좌표 배열을 모두 반환.
 *
 * findMaxClusterSizeFromCells 와 동일한 BFS 인접 탐색을 쓰되, max 1개가 아닌 모든 클러스터를 반환.
 *
 * 용도: 트윙클 타임 자동 캐스트 중 누적 잠긴 트윙클 셀의 인접 클러스터(3+)만
 *       "신화 트리거 대상 셀"로 식별 → 황금 테두리 표시. 흩어진 단독/소수(<3) 셀은 제외.
 *
 * @param {Array<{row:number, col:number}>} cells   좌표 배열 (셀 단위)
 * @param {number} rows                              그리드 행 수
 * @param {number} cols                              그리드 열 수
 * @param {number} [minSize=3]                       클러스터로 인정할 최소 size (트윙클 매칭 임계와 동일)
 * @returns {Array<Array<{row:number, col:number}>>} 인접 클러스터 셀 배열의 배열 (셀 없으면 빈 배열)
 */
export function findClustersInCells(cells, rows, cols, minSize = 3) {
  if (!cells || cells.length === 0) return [];

  const cellSet = new Set(cells.map(({ row, col }) => row * cols + col));
  const visited = new Set();
  const result = [];

  for (const { row: sr, col: sc } of cells) {
    const startIdx = sr * cols + sc;
    if (visited.has(startIdx)) continue;

    // BFS — 시작 셀에서 인접 셀로 확장하며 클러스터 수집
    const queue = [[sr, sc]];
    visited.add(startIdx);
    const cluster = [];

    while (queue.length) {
      const [r, c] = queue.shift();
      cluster.push({ row: r, col: c });

      const neighbors = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
      for (const [nr, nc] of neighbors) {
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const nIdx = nr * cols + nc;
        if (visited.has(nIdx)) continue;
        if (!cellSet.has(nIdx)) continue;
        visited.add(nIdx);
        queue.push([nr, nc]);
      }
    }

    if (cluster.length >= minSize) result.push(cluster);
  }

  return result;
}