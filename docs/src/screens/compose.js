/* ===========================================
   compose.js — 장비 합성 화면 (Day 12 — Phase 2a)
   ============================================
   결정로그 Day 12 SSOT (작업 종료 시 정리).

   진입 경로 (대표 C-10 결정):
     A) 햄버거 메뉴 → 합성 → navigate(Screen.COMPOSE)
        → 빈 슬롯 4개 (또는 신화 진입 시 2개) — 사용자가 가방에서 선택
     B) 가방 → 장비 컨텍스트 메뉴 → 합성 → navigate(Screen.COMPOSE, { itemId })
        → 첫 슬롯에 자동 진입한 장비 + 그 등급/부위로 가방 필터링

   상태 모델 (data-phase):
     idle (정적 IDLE)  ← Phase 2a (이번)
       ↓ 합성 시작
     spinning          ← Phase 2b (슬롯머신 회전)
       ↓ 마지막 STOP
     reveal-pending    ← Phase 2c (결과 카드 뒷면)
       ↓ 탭
     revealing         ← Phase 2c (카드 뒤집기)
       ↓
     result            ← Phase 2c (결과 + 확인 버튼)
       ↓ 확인
     idle (복귀)

   슬롯 데이터 흐름:
     - materialSlots = [itemId|null, ...]   (length = 4 or 2)
     - "슬롯에 든 장비" 도 inventory.items 에 그대로 존재
     - 가방 렌더링 시 materialSlots 의 id 는 숨김
     - unmount 시 materialSlots 비움 → 자연 복원 (대표 C-7 A)

   params:
     - itemId (선택) — 가방 컨텍스트 메뉴 진입 시 자동 첫 슬롯 진입
   ============================================ */

import { Screen, navigate } from '../core/router.js';
import { loadInventory, saveInventory } from '../core/storage.js';
import { findEquipmentById } from '../data/inventory.js';
import { getCatalogEntry } from '../data/equipment-catalog.js';
import { GEAR_GRADES } from '../data/gear-grades.js';
import { COMPOSE_INFO, COMPOSE_PRELIM_GOLD_RATE } from '../data/equipment-meta.js';
import { canCompose, getComposePreview, tryCompose } from '../data/compose-engine.js';
import { OPTIONS } from '../data/equipment-options.js';
import { createGearIcon } from '../ui/gear-icons.js';
import { createSlotMachine } from './compose-slot-machine.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ============================================
   ★ Day 26 (렉 개선 방안 A) — sparkle SVG 템플릿 캐싱
   ============================================
   카드 N장 × sparkle 4개씩 = innerHTML 파싱 4N회 → cloneNode 4N회 (브라우저 파싱 비용 절감).
   템플릿은 모듈 로드 시 1회만 생성 (lazy init). 재사용은 cloneNode(true).
   ============================================ */
let SPARKLE_SVG_TEMPLATE = null;
function getSparkleSvg() {
  if (!SPARKLE_SVG_TEMPLATE) {
    SPARKLE_SVG_TEMPLATE = document.createElementNS(SVG_NS, 'svg');
    SPARKLE_SVG_TEMPLATE.setAttribute('viewBox', '0 0 40 40');
    SPARKLE_SVG_TEMPLATE.setAttribute('xmlns', SVG_NS);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M20 2 L22 18 L38 20 L22 22 L20 38 L18 22 L2 20 L18 18 Z');
    path.setAttribute('fill', '#ffffff');
    SPARKLE_SVG_TEMPLATE.appendChild(path);
  }
  return SPARKLE_SVG_TEMPLATE.cloneNode(true);
}

/** ★ Day 26 — 카드 앞면 sparkle 레이어 추가 (sparkle 3개) — buildRevealOverlay / handleMultiCardFlip 공용 */
function appendSparkleLayer(frontEl) {
  const sparkleLayer = document.createElement('div');
  sparkleLayer.className = 'compose-reveal-card__sparkles';
  for (let s = 1; s <= 3; s++) {
    const sp = document.createElement('div');
    sp.className = `compose-reveal-card__sparkle compose-reveal-card__sparkle--${s}`;
    sp.appendChild(getSparkleSvg());
    sparkleLayer.appendChild(sp);
  }
  frontEl.appendChild(sparkleLayer);
}

/* ============================================
   모듈 상태
   ============================================ */

/** @type {HTMLElement|null} 합성 화면 루트 */
let currentRoot = null;

/** @type {object|null} 인벤토리 ref (mount 시 로드) */
let currentInventory = null;

/** @type {string[][]} ★ Day 25 — 슬롯별 재료 ID 스택 (다중합성).
 *  length = N (4 or 2), 각 슬롯은 itemId 배열.
 *  첫 아이템 들어오기 전: [[], [], [], []] (기본 4슬롯 빈 상태) */
let slotStacks = [[], [], [], []];

/** @type {boolean} 가방 컨텍스트 메뉴 진입 여부 (뒤로 가기 분기용) */
let entryFromBag = false;

/** @type {string} 현재 phase (Phase 2b부터 확장) */
let phase = 'idle';

/** @type {object[]|null} ★ Day 25 — 합성 시도 결과 배열 (다중합성 N회 결과).
 *  단일 합성 시 length=1, 다중 시 length=N. reveal 시 인벤토리 갱신. */
let pendingResults = null;

/** @type {{ root: HTMLElement, stopLastSlow: () => void, dispose: () => void }|null} */
let slotMachine = null;

/** @type {ReturnType<typeof setTimeout>|null} reveal-pending → result 진입 타이머 */
let revealTimer = null;

/* ============================================
   SVG 헬퍼
   ============================================ */

/** 뒤로 가기 화살표 (enhance.js 와 동일 디자인) */
function makeBackIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M15 6 L9 12 L15 18');
  svg.appendChild(path);
  return svg;
}

/** 합성 슬롯의 + 아이콘 (빈 슬롯 표시) */
function makePlusIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.4');
  svg.setAttribute('stroke-linecap', 'round');
  const h = document.createElementNS(SVG_NS, 'path');
  h.setAttribute('d', 'M12 7 V17');
  const v = document.createElementNS(SVG_NS, 'path');
  v.setAttribute('d', 'M7 12 H17');
  svg.appendChild(h);
  svg.appendChild(v);
  return svg;
}

/* ============================================
   상태 헬퍼
   ============================================ */

/**
 * 현재 첫 슬롯 장비 얻기 (등급/부위 결정 기준).
 * @returns {object|null} 장비 인스턴스 또는 null (빈 슬롯)
 */
/** ★ Day 25 — 첫 슬롯의 첫 아이템 (다중합성 기준이 되는 재료) */
function getFirstMaterial() {
  const first = slotStacks?.[0]?.[0];
  if (!first) return null;
  return findEquipmentById(currentInventory, first);
}

/** ★ Day 25 — 총 재료 수 (모든 슬롯 합산) */
function getTotalMaterialCount() {
  return slotStacks.reduce((sum, s) => sum + s.length, 0);
}

/** ★ Day 25 — 다음 재료가 들어갈 슬롯 인덱스 (가장 짧은 슬롯 중 첫 번째 = 1→2→3→4→1 순환) */
function getNextSlotIndex() {
  if (slotStacks.length === 0) return 0;
  let minLen = slotStacks[0].length;
  let minIdx = 0;
  for (let i = 1; i < slotStacks.length; i++) {
    if (slotStacks[i].length < minLen) {
      minLen = slotStacks[i].length;
      minIdx = i;
    }
  }
  return minIdx;
}

/** ★ Day 25 — 합성 횟수 (모든 슬롯이 같은 길이일 때만 의미 있음 — 그 길이) */
function getComposeCount() {
  if (slotStacks.length === 0) return 0;
  return slotStacks[0].length;
}

/**
 * 현재 슬롯 갯수 결정 — 첫 슬롯 첫 아이템 등급 따라 4 (default) 또는 2 (신화 합성).
 * 빈 상태 또는 신화 외 등급 = 4. legendary 면 2.
 */
function getRequiredSlotCount() {
  const first = getFirstMaterial();
  if (!first) return 4;  // 빈 상태 = 기본 4슬롯
  const entry = getCatalogEntry(first.catalogId);
  if (!entry) return 4;
  const info = COMPOSE_INFO[entry.grade];
  return info ? info.materialCount : 4;
}

/**
 * slotStacks 길이 보정 — 첫 아이템 등급 변경 시 (예: legendary 첫 진입 → 4→2)
 * 초과분은 잘라내고 (안의 아이템은 자연 복원), 부족분은 빈 배열로 채움.
 */
function normalizeMaterialSlots() {
  const required = getRequiredSlotCount();
  if (slotStacks.length < required) {
    while (slotStacks.length < required) slotStacks.push([]);
  } else if (slotStacks.length > required) {
    slotStacks = slotStacks.slice(0, required);
  }
}

/**
 * 가방에 표시 가능한 장비 목록 (필터 적용).
 *  - 장비 타입만, 잠긴/착용/슬롯에 든 거 제외, 신화 X
 */
function getBagItems() {
  if (!currentInventory) return [];
  // ★ Day 25 — 모든 슬롯의 모든 아이템 ID 수집
  const slotted = new Set();
  for (const stack of slotStacks) {
    for (const id of stack) slotted.add(id);
  }
  const items = [];
  for (const it of currentInventory.items) {
    if (!it || it.type !== 'equipment') continue;
    if (it.locked)   continue;
    if (it.equipped) continue;
    if (slotted.has(it.id)) continue;
    const entry = getCatalogEntry(it.catalogId);
    if (!entry) continue;
    if (entry.grade === 'mythic') continue;  // 신화는 합성 불가
    items.push(it);
  }
  const GRADE_ORDER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };

  // ★ Day 26 (대표 결정) — 첫 슬롯에 장비 들어가면 같은 부위가 가방 상단으로.
  //   첫 슬롯 비어있을 때는 기존 정렬 (등급 → 부위) 그대로.
  const firstMaterial = getFirstMaterial();
  const referenceSlotId = firstMaterial
    ? (getCatalogEntry(firstMaterial.catalogId)?.slotId || null)
    : null;

  items.sort((a, b) => {
    const ea = getCatalogEntry(a.catalogId);
    const eb = getCatalogEntry(b.catalogId);

    // 1순위 (Day 26): 첫 슬롯과 같은 부위 우선 (referenceSlotId 있을 때만)
    if (referenceSlotId) {
      const aIsRef = ea.slotId === referenceSlotId;
      const bIsRef = eb.slotId === referenceSlotId;
      if (aIsRef && !bIsRef) return -1;
      if (!aIsRef && bIsRef) return 1;
    }

    // 2순위: 등급 (기존)
    const dg = GRADE_ORDER[ea.grade] - GRADE_ORDER[eb.grade];
    if (dg !== 0) return dg;

    // 3순위: 부위 (기존)
    return ea.slotId.localeCompare(eb.slotId);
  });
  return items;
}

/**
 * 가방 셀이 클릭 가능한지 (등급 + 부위 첫 슬롯 기준 통일 가드).
 * 첫 슬롯이 비어있으면 모든 셀 클릭 가능.
 */
function isBagItemSelectable(item) {
  const first = getFirstMaterial();
  if (!first) return true;
  const firstEntry = getCatalogEntry(first.catalogId);
  const itemEntry = getCatalogEntry(item.catalogId);
  if (!firstEntry || !itemEntry) return false;
  return firstEntry.grade === itemEntry.grade && firstEntry.slotId === itemEntry.slotId;
}

/**
 * ★ Day 25 — 시작 버튼 활성화 가능 여부 (다중합성).
 * 모든 슬롯이 같은 길이 && 길이 > 0 && idle phase.
 */
function canStart() {
  if (phase !== 'idle') return false;
  if (slotStacks.length === 0) return false;
  const firstLen = slotStacks[0].length;
  if (firstLen === 0) return false;
  return slotStacks.every(s => s.length === firstLen);
}

/* ============================================
   화면 빌드
   ============================================ */

/** 합성 화면 전체 루트 빌드 */
function buildComposeScreen() {
  const root = document.createElement('section');
  root.className = 'compose-screen';
  root.dataset.phase = phase;

  root.appendChild(buildHeader(handleBackClick));
  root.appendChild(buildMultiNotice());  // ★ Day 26 — 4슬롯 상단 안내 (대표 결정)
  root.appendChild(buildMaterialSlotsArea());
  root.appendChild(buildInfoRow());
  root.appendChild(buildBagSection());
  root.appendChild(buildStartRow());
  root.appendChild(buildBottomNote());

  return root;
}

/** 헤더: 뒤로 + "장비 합성" 타이틀 */
function buildHeader(onBack) {
  const header = document.createElement('header');
  header.className = 'compose-header';

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'compose-header__back';
  back.setAttribute('aria-label', '뒤로');
  back.appendChild(makeBackIcon());
  back.addEventListener('click', () => onBack && onBack());
  header.appendChild(back);

  const title = document.createElement('h1');
  title.className = 'compose-header__title';
  title.textContent = '장비 합성';
  header.appendChild(title);

  // (spacer 제거 — 백버튼이 absolute 라서 flex 흐름에 안 들어감.
  //  title 만 flex: 1 로 헤더 전체 차지 → 화면 정중앙 가운데 정렬, 강화 화면과 동일 패턴.)

  return header;
}

/** 재료 슬롯 영역 (4개 또는 2개) — phase 따라 분기 */
function buildMaterialSlotsArea() {
  // spinning 이상 phase = 슬롯머신 모듈의 root 사용 (Phase 2b)
  if (phase !== 'idle' && slotMachine) {
    return slotMachine.root;
  }

  // idle = 기존 빈/채워진 슬롯
  const wrap = document.createElement('div');
  wrap.className = 'compose-slots';
  wrap.dataset.count = String(slotStacks.length);

  // ★ Day 25 — 슬롯별 [첫 아이템 ID, 카운트] 전달
  for (let i = 0; i < slotStacks.length; i++) {
    const stack   = slotStacks[i];
    const headId  = stack.length > 0 ? stack[0] : null;
    const cell = buildMaterialSlotCell(i, headId, stack.length);
    wrap.appendChild(cell);
  }

  return wrap;
}

/** 재료 슬롯 셀 1개 (빈 / 채워짐) — ★ Day 25 count 인자 추가 (다중합성 카운트 배지) */
function buildMaterialSlotCell(index, itemId, count = 0) {
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'compose-slot';
  cell.dataset.index = String(index);

  if (!itemId) {
    cell.classList.add('compose-slot--empty');
    cell.setAttribute('aria-label', `재료 슬롯 ${index + 1} (빈 칸)`);
    const plus = makePlusIcon();
    plus.setAttribute('class', 'compose-slot__plus');
    cell.appendChild(plus);
    cell.disabled = true;  // 빈 슬롯은 클릭 X (가방에서 선택해야 함)
    return cell;
  }

  // 채워진 슬롯
  const item = findEquipmentById(currentInventory, itemId);
  if (!item) {
    cell.classList.add('compose-slot--empty');
    return cell;
  }
  const entry = getCatalogEntry(item.catalogId);
  cell.classList.add('compose-slot--filled', `compose-slot--${entry.grade}`);
  cell.setAttribute('aria-label', `${entry.name} (제거하려면 탭)`);
  cell.dataset.id = itemId;

  // 부위 아이콘
  // Day 14 ★ — 카툰 PNG 적용 (entry.grade 인자 추가)
  const icon = createGearIcon(entry.slotId, entry.grade);
  icon.classList.add('compose-slot__icon');
  cell.appendChild(icon);

  // 강화 단계 (+N) 좌상단
  if (item.level > 0) {
    const lv = document.createElement('span');
    lv.className = 'compose-slot__level';
    lv.textContent = `+${item.level}`;
    cell.appendChild(lv);
  }

  // 합성 추가 옵션 보유 마크 (좌하단 분홍별) — 대표 결정 D-γ
  if (Array.isArray(item.extraOptions) && item.extraOptions.length > 0) {
    const star = document.createElement('span');
    star.className = 'compose-slot__compose-mark';
    star.textContent = '★';
    cell.appendChild(star);
  }

  // ★ Day 25 — 다중합성 카운트 배지 (우측 상단, count ≥ 2일 때만)
  if (count >= 2) {
    const badge = document.createElement('span');
    badge.className = 'compose-slot__count-badge';
    badge.textContent = `×${count}`;
    cell.appendChild(badge);
  }

  // 클릭 = 슬롯에서 빼기 (가방 복원)
  cell.addEventListener('click', () => handleSlotClick(index));

  return cell;
}

/** 정보 행 — 첫 슬롯 채워지면 결과 등급 + 합성 성공률 표시 */
function buildInfoRow() {
  const row = document.createElement('div');
  row.className = 'compose-info';

  const first = getFirstMaterial();
  if (!first) {
    row.classList.add('compose-info--empty');
    const hint = document.createElement('span');
    hint.className = 'compose-info__hint';
    hint.textContent = '아래 가방에서 재료를 선택하세요';
    row.appendChild(hint);
    return row;
  }

  const preview = getComposePreview(first);
  if (!preview) {
    row.classList.add('compose-info--empty');
    return row;
  }

  // 결과 등급 라벨
  const arrow = document.createElement('span');
  arrow.className = 'compose-info__arrow';
  arrow.textContent = '→';
  row.appendChild(arrow);

  const resultGrade = document.createElement('span');
  resultGrade.className = `compose-info__result compose-info__result--${preview.toGrade}`;
  resultGrade.textContent = `${GEAR_GRADES[preview.toGrade].name} 1장`;
  row.appendChild(resultGrade);

  // 성공률
  const rateLabel = document.createElement('span');
  rateLabel.className = 'compose-info__rate-label';
  rateLabel.textContent = '합성 성공 확률';
  row.appendChild(rateLabel);

  const rateValue = document.createElement('span');
  rateValue.className = 'compose-info__rate-value';
  rateValue.textContent = `${Math.round(preview.successRate * 100)}%`;
  row.appendChild(rateValue);

  return row;
}

/** 가방 영역 (3행 스크롤) */
function buildBagSection() {
  const section = document.createElement('div');
  section.className = 'compose-bag';

  const header = document.createElement('div');
  header.className = 'compose-bag__header';
  const label = document.createElement('span');
  label.className = 'compose-bag__label';
  label.textContent = '가방';
  header.appendChild(label);
  section.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'compose-bag__grid';
  section.appendChild(grid);

  const items = getBagItems();
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'compose-bag__empty';
    empty.textContent = '합성 가능한 장비가 없습니다';
    grid.appendChild(empty);
    return section;
  }

  for (const item of items) {
    grid.appendChild(buildBagCell(item));
  }

  return section;
}

/** 가방 셀 1개 — 가방 모달 셀 디자인 패턴 따름 */
function buildBagCell(item) {
  const entry = getCatalogEntry(item.catalogId);
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = `compose-bag-cell compose-bag-cell--${entry.grade}`;
  cell.dataset.id = item.id;
  cell.setAttribute('aria-label', entry.name);

  // 꾸미기 글로우
  if (item.cosmeticColor) cell.classList.add('compose-bag-cell--has-cosmetic');

  // 비활성 (다른 등급/부위)
  const selectable = isBagItemSelectable(item);
  if (!selectable) {
    cell.classList.add('compose-bag-cell--disabled');
    cell.setAttribute('aria-disabled', 'true');
  }

  // 부위 아이콘
  // Day 14 ★ — 카툰 PNG 적용 (entry.grade 인자 추가)
  const icon = createGearIcon(entry.slotId, entry.grade);
  icon.classList.add('compose-bag-cell__icon');
  cell.appendChild(icon);

  // 강화 단계 +N (좌상단)
  if (item.level > 0) {
    const lv = document.createElement('span');
    lv.className = 'compose-bag-cell__level';
    lv.textContent = `+${item.level}`;
    cell.appendChild(lv);
  }

  // 합성 추가 옵션 마크 (좌하단 분홍별)
  if (Array.isArray(item.extraOptions) && item.extraOptions.length > 0) {
    const star = document.createElement('span');
    star.className = 'compose-bag-cell__compose-mark';
    star.textContent = '★';
    cell.appendChild(star);
  }

  // 클릭 = 슬롯에 추가
  cell.addEventListener('click', () => {
    if (!selectable) return;
    handleBagClick(item.id);
  });

  return cell;
}

/** 시작 버튼 + STOP 버튼 (phase 따라 CSS visibility 처리) */
function buildStartRow() {
  const row = document.createElement('div');
  row.className = 'compose-start-row';

  // 시작 버튼 (idle phase 에서만 보임)
  const startBtn = document.createElement('button');
  startBtn.type = 'button';
  startBtn.className = 'compose-start-btn';
  startBtn.textContent = '합성 시작';
  if (!canStart()) {
    startBtn.classList.add('compose-start-btn--disabled');
    startBtn.disabled = true;
  }
  startBtn.addEventListener('click', handleStartClick);
  row.appendChild(startBtn);

  // STOP 버튼 (last-ready phase 에서만 보임)
  const stopBtn = document.createElement('button');
  stopBtn.type = 'button';
  stopBtn.className = 'compose-stop-btn';
  stopBtn.textContent = '멈춤';
  stopBtn.addEventListener('click', handleStopClick);
  row.appendChild(stopBtn);

  return row;
}

/** 하단 안내 텍스트 (대표 E 결정: 잘 보이는 흐릿한 색) */
function buildBottomNote() {
  const note = document.createElement('p');
  note.className = 'compose-note';
  note.textContent = '합성 성공시 일정확률로 모든 부위에 추가스탯 등장';
  return note;
}

/** ★ Day 26 — 4슬롯 상단 안내 텍스트 (대표 결정 — 다중합성 안내) */
function buildMultiNotice() {
  const div = document.createElement('p');
  div.className = 'compose-multi-notice';
  div.textContent = '같은 장비부위 다중합성 가능';
  return div;
}

/* ============================================
   인터랙션 핸들러
   ============================================ */

/** 가방 셀 클릭 → 첫 빈 슬롯에 추가 */
function handleBagClick(itemId) {
  if (phase !== 'idle') return;

  // ★ Day 26 — 안전장치 (대표 보고된 간헐적 "찌→옷 변환" 버그 사전 방지):
  //   buildBagCell 의 selectable 가드(closure 캐시)가 race/상태불일치로 우회될 가능성.
  //   push 직전 itemId 실존 + 부위/등급 재검증 → 불일치면 무시 + 콘솔 경고.
  const clickedItem = findEquipmentById(currentInventory, itemId);
  if (!clickedItem) {
    console.warn('[compose] handleBagClick: 아이템 찾을 수 없음', itemId);
    return;
  }
  if (!isBagItemSelectable(clickedItem)) {
    const ref = getFirstMaterial();
    console.warn('[compose] handleBagClick: 부위/등급 불일치 가드 발동 (Day 26 안전장치)', {
      itemId,
      clickedCatalog: clickedItem.catalogId,
      referenceCatalog: ref?.catalogId,
    });
    return;  // 가드 — 잘못된 부위/등급 push 차단
  }

  // ★ Day 25 — 다중합성: 가장 짧은 슬롯 (= 1→2→3→4→1 순환)에 추가
  // 첫 아이템이면 등급 따라 슬롯 갯수(2 or 4) 재결정 후 다시 시도
  const wasEmpty = getTotalMaterialCount() === 0;
  if (wasEmpty) {
    // 첫 아이템 후 slotStacks 길이 재조정 (legendary → 2슬롯)
    // 임시로 첫 슬롯에 push 해서 getRequiredSlotCount 가 정상 동작하도록
    slotStacks[0].push(itemId);
    normalizeMaterialSlots();
  } else {
    const targetIdx = getNextSlotIndex();
    slotStacks[targetIdx].push(itemId);
  }

  refreshScreen();
}

/** 슬롯 셀 클릭 → 가방으로 복원 */
function handleSlotClick(index) {
  if (phase !== 'idle') return;
  if (index < 0 || index >= slotStacks.length) return;
  if (slotStacks[index].length === 0) return;

  // ★ Day 26 (대표 결정) — 모든 슬롯 동일하게 마지막 1개만 pop.
  //   이전 Day 25 "첫 슬롯 = 모든 슬롯 비우기" 룰 폐기 — 첫 슬롯도 다른 슬롯과 같이 한 개만 pop.
  slotStacks[index].pop();
  refreshScreen();
}

/** phase 변경 + DOM data-phase 동기화 (CSS 가드 발동 기준) */
function setPhase(newPhase) {
  phase = newPhase;
  if (currentRoot) currentRoot.dataset.phase = newPhase;
}

/** 시작 버튼 클릭 — Phase 2b: 슬롯머신 회전 시작 */
function handleStartClick() {
  if (!canStart()) return;

  // ★ Day 25 — 다중합성 N회 실행 (방식 A — 슬롯당 같은 부위 N개씩, 총 N회 합성)
  const composeCount = getComposeCount();        // 합성 횟수 (= 슬롯당 길이)
  const N            = slotStacks.length;        // 슬롯 갯수 (4 or 2)
  const results = [];

  for (let c = 0; c < composeCount; c++) {
    // c번째 합성 = 각 슬롯의 c번째 아이템들로 1회 합성
    const materialIds = slotStacks.map(s => s[c]);
    const result = tryCompose(currentInventory, materialIds);
    if (!result.ok) {
      console.error('[compose] tryCompose 실패 (회', c + 1, '):', result.reason);
      return;
    }
    results.push(result);
  }
  pendingResults = results;

  // ★ Day 26 (대표 결정 — 방안 A) ★ 다중합성 통합 슬롯 시각 산식:
  //   - 1, 2번째 슬롯: 100% 강제 황금 (단일 합성 산식과 일관)
  //   - 3번째 슬롯 (4슬롯에서만): 97% 황금 추첨 (단일 합성 산식과 일관)
  //   - 마지막 슬롯: N회 합성 중 1회라도 성공 + prelim 모두 황금일 때 황금
  //     · prelim 회색 발생 시 (3번째 슬롯 3% 확률) → 카드 일부 성공이라도 시각상 회색
  //       (드문 케이스이지만 시각/카드 미세 불일치 가능 — 카드 결과가 진실값)
  //   - 이전 Day 25 "단순 비율 분배" 방식 폐기 (시각상 회색 너무 많이 나옴 문제 — 대표 보고)
  const hasAnySuccess = results.some(r => r.success);
  const lastIdx       = N - 1;
  const unifiedSlots  = [];
  let prelimAllGold   = true;

  for (let i = 0; i < lastIdx; i++) {
    let isGold;
    if (i < 2) {
      isGold = true;  // 1, 2번째 강제 황금
    } else {
      // 3번째 이후 (4슬롯에서만) — 97% 추첨
      isGold = Math.random() < COMPOSE_PRELIM_GOLD_RATE;
    }
    unifiedSlots.push(isGold ? 'gold' : 'gray');
    if (!isGold) prelimAllGold = false;
  }

  // 마지막 슬롯: prelim 모두 황금 + N회 중 1회라도 성공 → 황금
  const lastIsGold = prelimAllGold && hasAnySuccess;
  unifiedSlots.push(lastIsGold ? 'gold' : 'gray');

  // ★ Day 25 — 반전 효과 (Q3 — 다중합성에서도 발동):
  //   마지막 슬롯이 'gold' 일 때 25% 확률로 발동 (시각 연출만).
  const SURPRISE_REVEAL_CHANCE = 0.25;
  const lastResult     = unifiedSlots[unifiedSlots.length - 1];
  const useSurprise    = (lastResult === 'gold') && (Math.random() < SURPRISE_REVEAL_CHANCE);

  slotMachine = createSlotMachine({
    slotResults:    unifiedSlots,
    onLastReady:    handleSlotMachineLastReady,
    onAutoFail:     handleSlotMachineAutoFail,
    onResultStable: handleSlotMachineResultStable,
    onAllStop:      handleSlotMachineAllStop,
    surpriseReveal: useSurprise,
  });

  // 3. 슬롯 영역 DOM 교체 (전체 refreshScreen 대신 부분 교체 — 슬롯머신 timer 보존)
  const oldSlots = currentRoot.querySelector('.compose-slots');
  if (oldSlots && oldSlots.parentNode) {
    oldSlots.parentNode.replaceChild(slotMachine.root, oldSlots);
  }

  // 4. phase = spinning (CSS 가 시작 버튼 hide / 정보 행 hide / 뒤로 가드 발동)
  setPhase('spinning');
}

/** 슬롯머신 — (N-1)번째 정지 후 모두 황금일 때 호출 → STOP 버튼 활성 */
function handleSlotMachineLastReady() {
  setPhase('last-ready');
}

/** 슬롯머신 — (N-1)번째 정지 후 회색 발생 → 자동 정지 모드 */
function handleSlotMachineAutoFail() {
  setPhase('auto-fail');
}

/** Day 13 ★ — 마지막 슬롯 감속 종료 시점 호출.
 *   phase 'decelerating' → 'result-show' 로 변경 → CSS dim 룰 회피.
 *   compose-slot-machine.js 가 다음 프레임에 결과 class 부착 → 결과 심볼 또렷하게 보임. */
function handleSlotMachineResultStable() {
  setPhase('result-show');
}

/** 슬롯머신 — 모든 슬롯 정지 + bounce 끝 → 결과 카드 즉시 표시 (Phase 2c → 디테일 다듬기)
 *
 *  ★ Day 25 — 다중합성:
 *    - 단일 합성 (N=1): 기존대로 즉시 result phase + 앞면 표시
 *    - 다중 합성 (N>1): reveal-pending phase + 뒷면 카드 그리드 → 터치로 result 진입
 */
function handleSlotMachineAllStop() {
  const isMulti = pendingResults && pendingResults.length > 1;

  if (isMulti) {
    // 다중: 뒷면 카드 그리드 표시 (터치 대기)
    setPhase('reveal-pending');
    buildRevealOverlay();
    // enterResult 는 카드 뒤집기 후 (handleMultiCardFlip) 호출됨
  } else {
    // 단일: 기존 흐름 (즉시 result + 앞면 표시)
    setPhase('result');
    buildRevealOverlay();
    enterResult();
  }
}

/** STOP 버튼 클릭 — 마지막 슬롯 천천히 감속 정지 */
function handleStopClick() {
  if (phase !== 'last-ready') return;
  if (!slotMachine) return;
  setPhase('decelerating');
  slotMachine.stopLastSlow();
}

/* ============================================
   REVEAL 오버레이 (Phase 2c → 디테일 다듬기)
   ============================================
   대표 요청:
     - 카드 뒤집기 연출 삭제 (뒷면 + 탭 대기 제거)
     - 슬롯머신 정지 즉시 결과 카드 (앞면) + 결과 텍스트 + 옵션 + 확인 버튼

   data-phase 흐름 (단순화):
     spinning → ... → result (직행)
     reveal-pending / revealing 단계 사라짐

   합성 특화:
     - 결과 옵션 표시 (카드 아래) — 옵션 4종 + 합성 추가 옵션 (분홍)
     - 카드 등급 = pendingResult.resultGrade
   ============================================ */

/** REVEAL 오버레이 빌드 — 카드(앞면) + flash + result-text + options + confirm (즉시 result 상태)
 *
 *  ★ Day 25 — 다중합성 대응 (N>1):
 *    - 카드 N장 그리드 배치 (Q2 A안)
 *    - 모든 카드 뒷면 표시 → 1회 터치 → 동시 뒤집힘 → 앞면
 *    - 단일 합성(N=1)은 기존과 동일 (즉시 앞면)
 */
function buildRevealOverlay() {
  if (!pendingResults || pendingResults.length === 0) return;
  if (!currentRoot) return;

  const isMulti = pendingResults.length > 1;

  const overlay = document.createElement('div');
  overlay.className = 'compose-reveal-overlay';
  overlay.dataset.phase = isMulti ? 'reveal-pending' : 'result';
  if (isMulti) overlay.dataset.multi = 'true';

  // 1. 화면 번쩍 (자동 종료)
  const flash = document.createElement('div');
  flash.className = 'compose-reveal-flash';
  overlay.appendChild(flash);

  // 2. 카드 그리드 (단일이어도 그리드에 1장 — 통합 처리)
  const cardsGrid = document.createElement('div');
  cardsGrid.className = 'compose-reveal-cards';
  cardsGrid.dataset.count = String(pendingResults.length);
  overlay.appendChild(cardsGrid);

  // ★ Day 26 (렉 개선 방안 A) — DocumentFragment 로 카드 N장 한 번에 append
  //   (cardsGrid 가 아직 currentRoot 에 안 붙어있어 paint 영향 적음, 그러나 명시적 패턴 도입).
  const cardsFragment = document.createDocumentFragment();

  for (let i = 0; i < pendingResults.length; i++) {
    const res        = pendingResults[i];
    const resultEntry = getCatalogEntry(res.resultItem.catalogId);
    if (!resultEntry) continue;

    const card = document.createElement('div');
    card.className = `compose-reveal-card compose-reveal-card--${resultEntry.grade}`;
    // 단일이면 즉시 앞면, 다중이면 뒷면 시작 (터치로 뒤집기)
    card.dataset.flipped = isMulti ? 'false' : 'true';
    card.dataset.outcome = res.success ? 'success' : 'fail';
    card.dataset.cardIndex = String(i);

    const inner = document.createElement('div');
    inner.className = 'compose-reveal-card__inner';

    // 뒷면 (다중합성에서만 표시 — CSS data-flipped="false"이면 보임)
    if (isMulti) {
      const back = document.createElement('div');
      back.className = 'compose-reveal-card__back';
      // ★ Day 26 — 뒷면 sparkle: innerHTML 파싱 → SVG 템플릿 cloneNode 재사용 (렉 개선)
      const backSparkle = document.createElement('div');
      backSparkle.className = 'compose-reveal-card__back-sparkle';
      backSparkle.appendChild(getSparkleSvg());
      back.appendChild(backSparkle);
      inner.appendChild(back);
    }

    // 앞면 (등급 색 + 부위 아이콘 + sparkle)
    const front = document.createElement('div');
    front.className = 'compose-reveal-card__front';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'compose-reveal-card__icon';
    iconWrap.appendChild(createGearIcon(resultEntry.slotId, resultEntry.grade));
    front.appendChild(iconWrap);

    // ★ Day 26 (렉 개선 방안 A) — sparkle 추가 룰:
    //   1) 성공 카드에만 sparkle 추가 (실패 카드는 sparkle DOM X — paint 부하 감소)
    //   2) 단일 합성 (즉시 앞면): 즉시 sparkle 추가
    //   3) 다중 합성 (뒷면 시작 → 뒤집힘 후 앞면): handleMultiCardFlip 에서 지연 추가
    //      → 첫 빌드 시점 (카드 N장 한 번에 등장) 의 sparkle DOM × N 부하 회피.
    if (res.success && !isMulti) {
      appendSparkleLayer(front);
    }

    inner.appendChild(front);
    card.appendChild(inner);
    cardsFragment.appendChild(card);  // ★ Day 26 — fragment 에 모아둠
  }
  cardsGrid.appendChild(cardsFragment);  // ★ Day 26 — N장 카드를 한 번에 cardsGrid 에 추가

  // 다중합성 — 터치 안내 (뒷면 단계)
  if (isMulti) {
    const tapHint = document.createElement('div');
    tapHint.className = 'compose-reveal-tap-hint';
    tapHint.textContent = '터치해서 결과를 확인하세요';
    overlay.appendChild(tapHint);
  }

  // 3. 결과 텍스트 (enterResult 에서 채움 — 다중이면 통합 메시지)
  const resultText = document.createElement('div');
  resultText.className = 'compose-result-text';
  overlay.appendChild(resultText);

  // 4. 결과 옵션 표시 영역 (단일 합성만 — 다중은 카드 자체로 표현)
  const resultOptions = document.createElement('div');
  resultOptions.className = 'compose-result-options';
  overlay.appendChild(resultOptions);

  // 5. 확인 버튼
  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'compose-result-confirm-btn';
  confirmBtn.textContent = '확인';
  confirmBtn.addEventListener('click', handleConfirmClick);
  overlay.appendChild(confirmBtn);

  // ★ Day 25 — 다중합성: 오버레이 터치 시 모든 카드 동시 뒤집기 (1회만)
  if (isMulti) {
    overlay.addEventListener('click', handleMultiCardFlip);
  }

  currentRoot.appendChild(overlay);
}

/** ★ Day 25 — 다중합성 카드 동시 뒤집기 핸들러 (1회만 발동) */
function handleMultiCardFlip(event) {
  if (phase === 'result') return;  // 이미 뒤집힘 완료 → 무시 (확인 버튼이 받음)
  // 확인 버튼이나 개별 카드 클릭은 그냥 통과 (overlay 자체 클릭만 발동)
  const overlay = currentRoot?.querySelector('.compose-reveal-overlay');
  if (!overlay) return;

  // 모든 카드 뒤집기 + ★ Day 26 (렉 개선 방안 A) — 성공 카드에만 sparkle 지연 추가
  const cards = overlay.querySelectorAll('.compose-reveal-card');
  cards.forEach(c => {
    c.dataset.flipped = 'true';
    // 성공 카드는 buildRevealOverlay 에서 sparkle 안 만들었으므로 여기서 추가 (뒤집힘 직전 = paint 부담 최소화)
    if (c.dataset.outcome === 'success') {
      const front = c.querySelector('.compose-reveal-card__front');
      if (front && !front.querySelector('.compose-reveal-card__sparkles')) {
        appendSparkleLayer(front);
      }
    }
  });

  overlay.dataset.phase = 'result';
  setPhase('result');
  // 결과 텍스트 채우기 (통합 메시지)
  enterResult();
}

/** result phase — 결과 텍스트 + 옵션 + 확인 버튼 채움 (handleSlotMachineAllStop 또는 카드 뒤집기 직후 호출) */
function enterResult() {
  if (!currentRoot || !pendingResults || pendingResults.length === 0) return;
  if (phase !== 'result') return;

  const overlay     = currentRoot.querySelector('.compose-reveal-overlay');
  const resultText  = currentRoot.querySelector('.compose-result-text');
  const resultOpts  = currentRoot.querySelector('.compose-result-options');
  if (!overlay || !resultText || !resultOpts) return;

  while (resultText.firstChild) resultText.removeChild(resultText.firstChild);

  const isMulti = pendingResults.length > 1;
  const successCount = pendingResults.filter(r => r.success).length;
  const totalCount   = pendingResults.length;

  if (isMulti) {
    // ★ Day 25 — 다중합성 통합 메시지: 한글 "N회 중 X회 성공" 만 표시
    //   (대표 결정 Day 25 후속) — "N/N" 영문 부분 폐기, 한글만 깔끔하게.
    const koSpan = document.createElement('span');
    koSpan.className = 'compose-result-text__ko';
    koSpan.textContent = `${totalCount}회 중 ${successCount}회 성공`;
    resultText.appendChild(koSpan);

    // 다중에서는 옵션 표시 X (카드 자체로 표현)
    while (resultOpts.firstChild) resultOpts.removeChild(resultOpts.firstChild);
  } else {
    // 단일 합성 — 기존 흐름
    const single = pendingResults[0];
    const enSpan = document.createElement('span');
    enSpan.className = 'compose-result-text__en';
    enSpan.textContent = single.success ? 'SUCCEED' : 'FAILED';
    resultText.appendChild(enSpan);
    const koSpan = document.createElement('span');
    koSpan.className = 'compose-result-text__ko';
    koSpan.textContent = single.success ? '합성 성공' : '합성 실패';
    resultText.appendChild(koSpan);

    fillResultOptions(resultOpts, single.resultItem);
  }

  overlay.dataset.phase = 'result';
}

/** 결과 옵션 영역 채우기 — 옵션 4종 + extraOptions (분홍) */
function fillResultOptions(container, resultItem) {
  while (container.firstChild) container.removeChild(container.firstChild);

  // 기본 옵션
  if (Array.isArray(resultItem.options)) {
    for (const opt of resultItem.options) {
      const def = OPTIONS[opt.key];
      if (!def) continue;
      const row = document.createElement('div');
      row.className = 'compose-result-options__row';

      const name = document.createElement('span');
      name.className = 'compose-result-options__name';
      name.textContent = def.displayName;
      row.appendChild(name);

      const value = document.createElement('span');
      value.className = 'compose-result-options__value';
      const sign = def.sign === '-' ? '-' : '+';
      value.textContent = `${sign}${formatValue(opt.value)}`;
      row.appendChild(value);

      container.appendChild(row);
    }
  }

  // 합성 추가 옵션 (분홍)
  if (Array.isArray(resultItem.extraOptions)) {
    for (const opt of resultItem.extraOptions) {
      const def = OPTIONS[opt.key];
      if (!def) continue;
      const row = document.createElement('div');
      row.className = 'compose-result-options__row compose-result-options__row--extra';

      const star = document.createElement('span');
      star.className = 'compose-result-options__mark';
      star.textContent = '★';
      row.appendChild(star);

      const name = document.createElement('span');
      name.className = 'compose-result-options__name';
      name.textContent = def.displayName;
      row.appendChild(name);

      const value = document.createElement('span');
      value.className = 'compose-result-options__value';
      value.textContent = `+${formatValue(opt.value)}%`;
      row.appendChild(value);

      container.appendChild(row);
    }
  }
}

/** 값 표시 정리 — 정수면 정수, 소수면 최대 2자리 (Day 11 누적 규칙 37 패턴) */
function formatValue(v) {
  if (typeof v !== 'number') return String(v ?? 0);
  return String(Number(v.toFixed(2)));
}

/**
 * 확인 버튼 — result phase → IDLE 복귀.
 *   1. 인벤토리 갱신 (재료 제거 + 결과 추가 + 저장)
 *   2. 오버레이 + 슬롯머신 정리
 *   3. materialSlots 초기화
 *   4. IDLE 화면 새로 빌드 (가방에 결과 장비 표시)
 */
function handleConfirmClick(event) {
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  if (phase !== 'result') return;

  // 1. 인벤토리 갱신 (다중합성 N회 통합 반영)
  applyComposeResults();

  // 2. 정리
  if (revealTimer) {
    clearTimeout(revealTimer);
    revealTimer = null;
  }
  if (slotMachine) {
    slotMachine.dispose();
    slotMachine = null;
  }
  pendingResults = null;
  slotStacks = [[], [], [], []];  // ★ Day 25 — 빈 4슬롯 상태로 복귀

  // 3. IDLE 복귀 — root 자식 모두 비우고 새로 빌드
  setPhase('idle');
  while (currentRoot.firstChild) currentRoot.removeChild(currentRoot.firstChild);
  const newScreen = buildComposeScreen();
  // Day 11 누적 규칙 33 — 명시적 detach 후 옮김
  const newChildren = Array.from(newScreen.children);
  for (const child of newChildren) {
    if (child.parentNode === newScreen) newScreen.removeChild(child);
    currentRoot.appendChild(child);
  }
  currentRoot.dataset.phase = 'idle';
}

/**
 * ★ Day 25 — 다중합성 결과 인벤토리 반영 — 재료 N개씩 제거 + 결과 N개 추가 + 저장.
 * 데이터-엔진 분리: tryCompose 는 결과만 결정, 인벤토리 갱신은 여기서.
 */
function applyComposeResults() {
  if (!pendingResults || pendingResults.length === 0) return;
  if (!currentInventory) return;

  for (const result of pendingResults) {
    if (!result.ok) continue;
    // 1. 재료 제거 (consumedIds — 각 합성마다 N(=4 or 2)개)
    for (const id of result.consumedIds) {
      const idx = currentInventory.items.findIndex(it => it && it.id === id);
      if (idx >= 0) currentInventory.items.splice(idx, 1);
    }
    // 2. 결과 장비 추가
    currentInventory.items.push(result.resultItem);
  }

  // 3. 영구 저장
  saveInventory(currentInventory);
}

/** 뒤로 가기 — 진입 경로에 따라 분기 */
function handleBackClick() {
  // 슬롯에 든 장비는 인벤토리에 그대로 → 자동 복원 (별도 처리 X)
  if (entryFromBag) {
    navigate(Screen.SLOT, { openBag: true });
  } else {
    navigate(Screen.SLOT);
  }
}

/* ============================================
   화면 갱신
   ============================================ */

/**
 * 슬롯 변경 시 전체 화면 재빌드 (root 의 children 교체).
 * - 슬롯 갯수 변동 가능성이 있어서 부분 갱신보다 전체 재빌드가 단순/안전.
 * - root 자체는 유지 (mount 위치 보존), 자식만 교체.
 */
function refreshScreen() {
  if (!currentRoot) return;
  const newScreen = buildComposeScreen();

  // Day 11 누적 규칙 33 — 명시적 detach 후 옮김 (실제/fake DOM 양쪽 안전)
  while (currentRoot.firstChild) {
    currentRoot.removeChild(currentRoot.firstChild);
  }
  const newChildren = Array.from(newScreen.children);
  for (const child of newChildren) {
    if (child.parentNode === newScreen) newScreen.removeChild(child);
    currentRoot.appendChild(child);
  }
  currentRoot.dataset.phase = phase;
}

/* ============================================
   Screen 모듈 export
   ============================================ */

export default {
  mount(el, params = {}) {
    currentInventory = loadInventory();
    phase = 'idle';
    entryFromBag = !!params.itemId;

    // ★ Day 25 — 빈 4슬롯 상태로 초기화
    slotStacks = [[], [], [], []];

    // 진입 경로 B (가방 컨텍스트 메뉴): 첫 슬롯 자동 진입
    if (params.itemId) {
      const item = findEquipmentById(currentInventory, params.itemId);
      if (item && item.type === 'equipment') {
        const entry = getCatalogEntry(item.catalogId);
        if (entry && entry.grade !== 'mythic' && !item.locked) {
          slotStacks[0].push(params.itemId);
          normalizeMaterialSlots();
        }
      }
    }

    currentRoot = buildComposeScreen();
    el.appendChild(currentRoot);
  },

  unmount() {
    // 진행 중 슬롯머신 정리 (타이머 모두 해제)
    if (slotMachine) {
      slotMachine.dispose();
      slotMachine = null;
    }
    // reveal 진입 타이머 정리
    if (revealTimer) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }
    pendingResults = null;
    currentRoot = null;
    currentInventory = null;
    slotStacks = [[], [], [], []];
    entryFromBag = false;
    phase = 'idle';
  },
};