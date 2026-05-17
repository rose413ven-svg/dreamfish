/* ===========================================
   enhance.js — 장비 강화 화면 (Day 11 — Phase 2a)
   ============================================
   결정로그 Day 11 SSOT.

   진입 경로:
     가방 → 장비 클릭 → 컨텍스트 메뉴 → "강화" 버튼
     → navigate(Screen.ENHANCE, { itemId })

   Phase 2a (이번): IDLE 상태 정적 레이아웃 + 가드 표시
     - 장비 셀 / 강화석 셀 / 옵션 비교 / 성공률 / 빈 게이지 / 시작 버튼
     - 가드: MAX (+10) / 강화석 부족 → 시작 버튼 비활성화 + 안내

   Phase 2b ~ 2d (다음): 강화 시도 흐름 + 결과 연출

   params:
     - itemId : 강화할 장비 인스턴스 id (필수)
   ============================================ */

import { Screen, navigate } from '../core/router.js';
import { loadInventory } from '../core/storage.js';
import { findEquipmentById } from '../data/inventory.js';
import { getCatalogEntry } from '../data/equipment-catalog.js';
import { OPTIONS } from '../data/equipment-options.js';
import { ENHANCE_MAX_LEVEL, getEnhanceBonus } from '../data/equipment-meta.js';
import { canEnhance, tryEnhance } from '../data/enhance-engine.js';
import { createGearIcon } from '../ui/gear-icons.js';
import { renderFishSVG } from '../ui/fish-svg.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ============================================
   SVG 헬퍼
   ============================================ */

/** 뒤로 가기 화살표 SVG */
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

/** 강화석 보석 SVG (bag-modal.js makeStoneIcon 과 동일 디자인 — 일관성).
 *  향후 별도 모듈 분리로 중복 제거 가능. */
function makeStoneIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.4');
  svg.setAttribute('stroke-linejoin', 'round');
  const outer = document.createElementNS(SVG_NS, 'path');
  outer.setAttribute('d', 'M12 3 L19 9 L15 20 L9 20 L5 9 Z');
  svg.appendChild(outer);
  const inner = document.createElementNS(SVG_NS, 'path');
  inner.setAttribute('d', 'M5 9 L19 9 M9 20 L12 9 M15 20 L12 9');
  inner.setAttribute('stroke-width', '1');
  inner.setAttribute('opacity', '0.55');
  svg.appendChild(inner);
  return svg;
}

/* ============================================
   포맷터
   ============================================ */

/** 옵션 수치 포맷 — 정수면 정수, 아니면 소수 최대 2자리 (Day 11 후속).
 *  String(Number(...)) 으로 trailing 0 자동 제거: 0.50 → "0.5", 10.18 → "10.18". */
const fmtNum = (n) => String(Number((Number(n) || 0).toFixed(2)));

/**
 * 부호 포함 옵션 값 문자열 — '+' / '-' 접두 + displayScale 적용.
 *
 * ★ Day 21 (대표 보고 버그 픽스) — 강화 화면 입질 스탯이 소수점 2자리로 표시되던 문제:
 *   기존: fmtNum(val) 만 사용 → fish/golden/rainbow/twinkle_rate 가 0.85 같이 표시
 *   변경: OPTIONS[key].displayScale 적용 (profile-modal.js / stats-bar.js 와 동일 패턴)
 *         displayScale=100 인 키 → val × 100 반올림 정수 (0.85 → 85)
 *
 * @param {number} val
 * @param {string} sign  '+' | '-'
 * @param {string} key   옵션 키 (OPTIONS 매핑용)
 */
const signedStr = (val, sign, key) => {
  const opt = OPTIONS[key];
  const scale = opt?.displayScale || 1;
  const v = scale !== 1 ? Math.round((val || 0) * scale) : val;
  const numStr = scale !== 1 ? String(v) : fmtNum(v);
  return sign === '-' ? `-${numStr}` : `+${numStr}`;
};

/** 가중치 옵션 (입질) 은 % 단위 X (정수 가산) — bag-context 와 동일 규칙.
 *  ★ Day 21: twinkle_rate 추가 (하얀물고기 입질 신규 옵션). */
const NO_PERCENT_KEYS = new Set(['fish_rate', 'golden_rate', 'rainbow_rate', 'twinkle_rate']);

/* ============================================
   화면 빌더
   ============================================ */

/**
 * 강화 화면 root 생성.
 * @param {string} itemId
 * @returns {HTMLElement}
 */
function buildEnhanceScreen(itemId) {
  const root = document.createElement('section');
  root.className = 'enhance-screen';

  // 인벤토리 + 장비 로드
  const inv = loadInventory();
  const item = inv ? findEquipmentById(inv, itemId) : null;
  const entry = item ? getCatalogEntry(item.catalogId) : null;

  // 잘못된 진입 가드 — 헤더 + 안내 + 뒤로
  if (!item || !entry) {
    root.appendChild(buildHeader(() => navigateBackToBag()));
    const empty = document.createElement('div');
    empty.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;color:rgba(200,212,240,0.6);font-size:1.4rem;';
    empty.textContent = '강화할 장비를 찾을 수 없습니다.';
    root.appendChild(empty);
    return root;
  }

  const info = canEnhance(itemId);  // ok? + currentLevel/nextLevel/maxLevel/successRate/stoneCost/stoneCount/grade/slotId
  const isMax       = info.currentLevel >= ENHANCE_MAX_LEVEL;
  const isLowStone  = !isMax && info.stoneCount < info.stoneCost;
  const canStart    = info.ok;  // canEnhance 의 종합 판단 (잠금/MAX/강화석 부족 모두 반영)

  // 1. 헤더
  root.appendChild(buildHeader(() => navigateBackToBag()));

  // 2. 큰 장비 셀 + 이름
  root.appendChild(buildEquipStage(item, entry, info));

  // 3. 강화석 줄
  root.appendChild(buildStoneRow(info.stoneCount, isLowStone));

  // 4. 단계 표시 (+N → +N+1 또는 MAX)
  root.appendChild(buildStageRow(info.currentLevel, info.nextLevel, isMax));

  // 5. 옵션 비교 표
  root.appendChild(buildOptionsTable(item, entry, info.currentLevel, info.nextLevel, isMax));

  // 6. 성공률 (MAX 면 숨김)
  if (!isMax) root.appendChild(buildSuccessRow(info.successRate));

  // 7. 게이지 (빈 상태)
  root.appendChild(buildGauge());

  // 8. 강화 시작 버튼 + 부족 안내
  root.appendChild(buildStartRow(canStart, isMax, isLowStone));

  return root;
}

/* ── 1. 헤더 ───────────────────────────────── */

function buildHeader(onBack) {
  const header = document.createElement('header');
  header.className = 'enhance-screen__header';

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'enhance-back-btn';
  back.setAttribute('aria-label', '뒤로');
  back.appendChild(makeBackIcon());
  // Phase 2b 가드 (Q.C 결정): idle 외 상태에선 뒤로 가기 불가
  back.addEventListener('click', () => {
    if (phase !== 'idle') return;
    onBack?.();
  });
  header.appendChild(back);

  const title = document.createElement('h1');
  title.className = 'enhance-screen__title';
  title.textContent = '장비 강화';
  header.appendChild(title);

  return header;
}

/* ── 2. 장비 셀 + 이름 ─────────────────────── */

function buildEquipStage(item, entry, info) {
  const stage = document.createElement('div');
  stage.className = 'enhance-stage';

  // 큰 셀
  const cell = document.createElement('div');
  cell.className = `enhance-equip-cell enhance-equip-cell--${entry.grade}`;

  // 좌상단: 강화 단계 +N (MAX 면 MAX 뱃지로 대체)
  const isMax = (item.level || 0) >= ENHANCE_MAX_LEVEL;
  if (isMax) {
    const badge = document.createElement('span');
    badge.className = 'enhance-equip-cell__max-badge';
    badge.textContent = 'MAX';
    cell.appendChild(badge);
  } else if ((item.level || 0) > 0) {
    const lv = document.createElement('span');
    lv.className = 'enhance-equip-cell__level';
    lv.textContent = `+${item.level}`;
    cell.appendChild(lv);
  }

  // 가운데: 부위 아이콘
  const iconWrap = document.createElement('div');
  iconWrap.className = 'enhance-equip-cell__icon';
  // Day 14 ★ — 카툰 PNG 적용 (entry.grade 인자 추가)
  iconWrap.appendChild(createGearIcon(entry.slotId, entry.grade));
  cell.appendChild(iconWrap);

  stage.appendChild(cell);

  // 셀 아래 이름 — entry.name 은 이미 등급 prefix 포함 (예: '낡은 낚싯대', '신화의 옷')
  // Day 11 — 등급별 색 (modifier 클래스)
  const name = document.createElement('div');
  name.className = `enhance-equip-name enhance-equip-name--${entry.grade}`;
  name.textContent = entry.name || entry.slotName || '';
  stage.appendChild(name);

  return stage;
}

/* ── 3. 강화석 줄 ──────────────────────────── */

function buildStoneRow(stoneCount, isLow) {
  const row = document.createElement('div');
  row.className = 'enhance-stone-row';
  if (isLow) row.classList.add('enhance-stone-row--low');

  // 셀 안쪽에 보유 개수 표시 (가방 .bag-cell__stack 패턴 — 우하단 작게)
  const cell = document.createElement('div');
  cell.className = 'enhance-stone-cell';
  cell.appendChild(makeStoneIcon());

  const count = document.createElement('span');
  count.className = 'enhance-stone-cell__count';
  count.textContent = String(stoneCount);
  cell.appendChild(count);

  row.appendChild(cell);
  return row;
}

/* ── 4. 단계 표시 ──────────────────────────── */

function buildStageRow(currentLevel, nextLevel, isMax) {
  const row = document.createElement('div');
  row.className = 'enhance-stage-row';

  const cur = document.createElement('span');
  cur.className = 'enhance-stage-row__current';
  cur.textContent = `+${currentLevel}`;
  row.appendChild(cur);

  const arrow = document.createElement('span');
  arrow.className = 'enhance-stage-row__arrow';
  arrow.textContent = '→';
  row.appendChild(arrow);

  if (isMax) {
    const max = document.createElement('span');
    max.className = 'enhance-stage-row__max-text';
    max.textContent = 'MAX';
    row.appendChild(max);
  } else {
    const next = document.createElement('span');
    next.className = 'enhance-stage-row__next';
    next.textContent = `+${nextLevel}`;
    row.appendChild(next);
  }

  return row;
}

/* ── 5. 옵션 비교 표 ───────────────────────── */

function buildOptionsTable(item, entry, currentLevel, nextLevel, isMax) {
  const wrap = document.createElement('div');
  wrap.className = 'enhance-options';
  if (isMax) wrap.classList.add('enhance-options--max');

  if (!Array.isArray(item.options) || item.options.length === 0) return wrap;

  // 옵션 표시 순서 = OPTIONS 정의 순 (보트 같은 랜덤 풀도 항상 같은 순서)
  const displayKeys = Object.keys(OPTIONS).filter(k => item.options.some(o => o.key === k));

  for (const key of displayKeys) {
    const opt = item.options.find(o => o.key === key);
    const def = OPTIONS[key];
    if (!opt || !def) continue;

    const baseValue = opt.value || 0;
    const curBonus  = getEnhanceBonus(key, entry.slotId, entry.grade, currentLevel);
    const nextBonus = isMax ? curBonus : getEnhanceBonus(key, entry.slotId, entry.grade, nextLevel);
    const curTotal  = baseValue + curBonus;
    const nextTotal = baseValue + nextBonus;

    const unit = NO_PERCENT_KEYS.has(key) ? '' : '%';

    const row = document.createElement('div');
    row.className = 'enhance-options__row';

    const name = document.createElement('span');
    name.className = 'enhance-options__name';
    name.textContent = def.displayName;
    row.appendChild(name);

    const cur = document.createElement('span');
    cur.className = 'enhance-options__current';
    cur.textContent = `${signedStr(curTotal, def.sign, key)}${unit}`;
    row.appendChild(cur);

    const arrow = document.createElement('span');
    arrow.className = 'enhance-options__arrow';
    arrow.textContent = isMax ? '' : '→';
    row.appendChild(arrow);

    const next = document.createElement('span');
    next.className = 'enhance-options__next';
    next.textContent = isMax ? '—' : `${signedStr(nextTotal, def.sign, key)}${unit}`;
    row.appendChild(next);

    wrap.appendChild(row);
  }

  return wrap;
}

/* ── 6. 성공률 ─────────────────────────────── */

function buildSuccessRow(successRate) {
  const row = document.createElement('div');
  row.className = 'enhance-success-row';
  if (successRate < 0.30) row.classList.add('enhance-success-row--low');

  const label = document.createElement('span');
  label.className = 'enhance-success-row__label';
  label.textContent = '성공 확률';
  row.appendChild(label);

  const value = document.createElement('span');
  value.className = 'enhance-success-row__value';
  value.textContent = `${Math.round((successRate || 0) * 100)}%`;
  row.appendChild(value);

  return row;
}

/* ── 7. 게이지 (빈 상태) ───────────────────── */

function buildGauge() {
  const wrap = document.createElement('div');
  wrap.className = 'enhance-gauge';
  const fill = document.createElement('div');
  fill.className = 'enhance-gauge__fill';
  wrap.appendChild(fill);
  return wrap;
}

/* ── 8. 시작 버튼 + 부족 안내 ──────────────── */

function buildStartRow(canStart, isMax, isLowStone) {
  const row = document.createElement('div');
  row.className = 'enhance-start-row';

  // 강화석 부족 안내 (대표 결정: 미니게임 안내 텍스트 X)
  if (isLowStone) {
    const warn = document.createElement('div');
    warn.className = 'enhance-warning';
    warn.textContent = '꿈조각이 부족합니다';
    row.appendChild(warn);
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'enhance-start-btn';

  if (isMax) {
    btn.textContent = '최대 단계 도달';
    btn.disabled = true;
    btn.classList.add('enhance-start-btn--disabled');
  } else if (!canStart) {
    btn.textContent = '강화 시작';
    btn.disabled = true;
    btn.classList.add('enhance-start-btn--disabled');
  } else {
    btn.textContent = '강화 시작';
    btn.addEventListener('click', handleStartClick);
  }

  row.appendChild(btn);
  return row;
}

/* ============================================
   라우팅 헬퍼
   ============================================ */

/** 가방 모달 다시 열린 슬롯 화면으로 복귀 */
function navigateBackToBag() {
  navigate(Screen.SLOT, { openBag: true });
}

/* ============================================
   State machine — Phase 2b 흐름
   ============================================
   data-phase 값:
     'idle'           — 정적 IDLE 화면 (시작 버튼 활성)
     'enhancing'      — 게이지 5초 진행 중 (뒤로/시작 가드)
     'reveal-pending' — 게이지 100% 도달, 뒤집힌 카드 표시 + 터치 대기
     'revealing'      — 사용자 터치 → 결과 연출 진행 (Phase 2c 예정)
     'result'         — 결과 표시 + 확인 버튼 (Phase 2c 예정)

   Day 9 누적 규칙 18 — State machine = data-attribute 활용:
     CSS 가 phase 별 뒤로/시작 버튼 가드, 게이지 transition 자동 적용.
   ============================================ */

const GAUGE_DURATION_MS = 3000;

/** 현재 phase 변경 — root 의 data-phase attribute 와 모듈 변수 동기화 */
function setPhase(newPhase) {
  phase = newPhase;
  if (currentRoot) currentRoot.dataset.phase = newPhase;
}

/** 모든 setTimeout 정리 — unmount / phase 전환 시 안전 가드 */
function clearTimers() {
  if (gaugeTimer) { clearTimeout(gaugeTimer);  gaugeTimer  = null; }
  if (revealTimer){ clearTimeout(revealTimer); revealTimer = null; }
}

/** "강화 시작" 버튼 클릭 — IDLE → ENHANCING */
function handleStartClick() {
  if (phase !== 'idle' || !currentItemId) return;

  // 결과 즉시 확정 + 강화석 차감 (게이지 도중 떠나도 무관 — Q.C 가드로 떠날 일 없음)
  // 이렇게 하면 결과 보여주는 시점은 게이지 끝났을 때 (5초 후) 로 분리됨.
  const result = tryEnhance(currentItemId);
  if (result.reason) {
    // 가드 실패 (no_stone / max_level 등) — IDLE 에서 disabled 처리됐어야 하지만 안전 가드.
    console.warn('[enhance] tryEnhance 가드 실패:', result.reason);
    return;
  }
  pendingResult = result;

  setPhase('enhancing');
  // 게이지는 CSS transition (data-phase="enhancing") 가 자동 발동
  // 5초 후 reveal-pending 진입
  gaugeTimer = setTimeout(() => {
    gaugeTimer = null;
    enterRevealPending();
  }, GAUGE_DURATION_MS);
}

/** ENHANCING 끝 → REVEAL_PENDING (오버레이 표시) */
function enterRevealPending() {
  if (!currentRoot || phase !== 'enhancing') return;
  setPhase('reveal-pending');
  buildRevealOverlay();
}

/**
 * REVEAL_PENDING 오버레이 — 화면 번쩍 + 두 면 카드 + 안내/결과 텍스트 + 확인 버튼.
 * 사용자 터치 → 카드 뒤집힘 + 결과 분기 (Phase 2c).
 *
 * 카드 구조 (3D 뒤집기):
 *   __inner (transform-style: preserve-3d, transition rotateY)
 *     __back  (면 ① — 황금 물고기 심볼)
 *     __front (면 ② — 등급 색 테두리 + 펄스 + 부위 아이콘 + +N + sparkle 3개)
 */
function buildRevealOverlay() {
  // pendingResult + 장비 정보 로드 (카드 앞면용)
  const inv = loadInventory();
  const item = inv && currentItemId ? findEquipmentById(inv, currentItemId) : null;
  const entry = item ? getCatalogEntry(item.catalogId) : null;
  if (!entry || !pendingResult) return;

  const overlay = document.createElement('div');
  overlay.className = 'enhance-reveal-overlay';
  overlay.dataset.phase = 'pending';  // 'pending' → 'revealing' → 'result'

  // 1. 화면 전체 번쩍 (자동 종료 애니메이션)
  const flash = document.createElement('div');
  flash.className = 'enhance-reveal-flash';
  overlay.appendChild(flash);

  // 2. 카드 (두 면 구조)
  const card = document.createElement('div');
  card.className = `enhance-reveal-card enhance-reveal-card--${entry.grade}`;
  card.dataset.flipped = 'false';
  // outcome (success/fail) — REVEALING 진입 시 부착

  const inner = document.createElement('div');
  inner.className = 'enhance-reveal-card__inner';

  // 면 ① — 뒷면: 황금 물고기 심볼
  // (Day 11 후속) inline style 우선 — size 0.35 * scale 1 = 35% (CSS 와 일치)
  const back = document.createElement('div');
  back.className = 'enhance-reveal-card__back';
  back.innerHTML = renderFishSVG({ color: '#E8C870', size: 0.35 }, 1);
  inner.appendChild(back);

  // 면 ② — 앞면: 등급 색 + 부위 아이콘 + +N + sparkle
  const front = document.createElement('div');
  front.className = 'enhance-reveal-card__front';

  // 좌상단 +N (성공 시 새 단계, 실패 시 기존 단계)
  const displayLevel = pendingResult.success ? pendingResult.newLevel : pendingResult.oldLevel;
  if (displayLevel > 0) {
    const lv = document.createElement('span');
    lv.className = 'enhance-reveal-card__level';
    lv.textContent = `+${displayLevel}`;
    front.appendChild(lv);
  }

  // 가운데 부위 아이콘
  const iconWrap = document.createElement('div');
  iconWrap.className = 'enhance-reveal-card__icon';
  // Day 14 ★ — 카툰 PNG 적용 (entry.grade 인자 추가)
  iconWrap.appendChild(createGearIcon(entry.slotId, entry.grade));
  front.appendChild(iconWrap);

  // sparkle 3개 — 각각 다른 위치/타이밍 (셀 안쪽 반짝)
  const sparkleLayer = document.createElement('div');
  sparkleLayer.className = 'enhance-reveal-card__sparkles';
  for (let i = 1; i <= 3; i++) {
    const sp = document.createElement('div');
    sp.className = `enhance-reveal-card__sparkle enhance-reveal-card__sparkle--${i}`;
    sp.innerHTML = '<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">'
                 + '<path d="M20 2 L22 18 L38 20 L22 22 L20 38 L18 22 L2 20 L18 18 Z" fill="#ffffff"/>'
                 + '</svg>';
    sparkleLayer.appendChild(sp);
  }
  front.appendChild(sparkleLayer);

  inner.appendChild(front);
  card.appendChild(inner);
  overlay.appendChild(card);

  // 3. 안내 텍스트 (REVEAL_PENDING 만 표시)
  const hint = document.createElement('div');
  hint.className = 'enhance-reveal-hint';
  hint.textContent = '터치하여 결과를 확인하세요';
  overlay.appendChild(hint);

  // 4. 결과 텍스트 (RESULT 단계에서 채움)
  const resultText = document.createElement('div');
  resultText.className = 'enhance-result-text';
  // 영문/한글 두 줄 — innerHTML 은 RESULT 진입 시 채움
  overlay.appendChild(resultText);

  // 5. 확인 버튼 (RESULT 단계에서 표시)
  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'enhance-result-confirm-btn';
  confirmBtn.textContent = '확인';
  confirmBtn.addEventListener('click', handleConfirmClick);
  overlay.appendChild(confirmBtn);

  // 6. 화면 어디든 터치 — REVEAL_PENDING 만 받음 (RESULT 에선 확인 버튼만 동작)
  overlay.addEventListener('click', handleRevealClick);

  currentRoot.appendChild(overlay);
}

/**
 * 오버레이 터치 — REVEAL_PENDING → REVEALING (카드 뒤집기) → RESULT (결과 텍스트).
 *
 * 흐름:
 *   1. data-flipped="true" 부착 → CSS 가 카드 700ms 뒤집기 애니메이션
 *   2. overlay data-phase="revealing" 부착 → 안내 텍스트 hide
 *   3. card data-outcome="success"|"fail" 부착 → CSS 가 초록/빨강 연출
 *   4. 700ms 후 (뒤집기 완료) → enterResult() : 결과 텍스트 등장 + 확인 버튼 표시
 */
function handleRevealClick(event) {
  if (phase !== 'reveal-pending') return;
  // RESULT 단계의 확인 버튼은 자체 핸들러로 처리 — overlay click 트리거 방지
  if (event && event.target && typeof event.target.closest === 'function') {
    if (event.target.closest('.enhance-result-confirm-btn')) return;
  }

  setPhase('revealing');

  const overlay = currentRoot.querySelector('.enhance-reveal-overlay');
  const card = currentRoot.querySelector('.enhance-reveal-card');
  if (!overlay || !card) return;

  // 1. 카드 뒤집기 시작 (CSS 700ms transition)
  card.dataset.flipped = 'true';

  // 2. 안내 텍스트 hide
  overlay.dataset.phase = 'revealing';

  // 3. 결과 분기 outcome 부착 — CSS 가 초록 글로우 펄스 (success) / 빨강 번쩍+흔들림+어두워짐 (fail)
  card.dataset.outcome = pendingResult?.success ? 'success' : 'fail';

  // 4. 700ms 후 RESULT 단계 — 결과 텍스트 + 확인 버튼 등장
  revealTimer = setTimeout(() => {
    revealTimer = null;
    enterResult();
  }, 700);
}

/** REVEALING (카드 뒤집기 완료) → RESULT (결과 텍스트 + 확인 버튼) */
function enterResult() {
  if (!currentRoot || !pendingResult || phase !== 'revealing') return;
  setPhase('result');

  const overlay = currentRoot.querySelector('.enhance-reveal-overlay');
  const resultText = currentRoot.querySelector('.enhance-result-text');
  if (!overlay || !resultText) return;

  // 결과 텍스트 채우기 (영문 + 한글 두 줄)
  resultText.innerHTML = pendingResult.success
    ? '<span class="enhance-result-text__en">SUCCEED</span>'
    + '<span class="enhance-result-text__ko">강화 성공</span>'
    : '<span class="enhance-result-text__en">FAILED</span>'
    + '<span class="enhance-result-text__ko">강화 실패</span>';

  overlay.dataset.phase = 'result';
  // CSS 가 phase=result 에서 결과 텍스트 + 확인 버튼 등장 애니메이션 자동 발동
}

/**
 * 확인 버튼 클릭 — RESULT → IDLE (같은 강화 화면 내부 복귀, 새 데이터 자동 반영).
 *
 * 동작:
 *   1. 오버레이 제거 + 타이머 정리
 *   2. root 의 모든 자식 비우고 buildEnhanceScreen 다시 호출 (새 inv 데이터로)
 *   3. 성공 시: 옵션 비교 표 모든 행에 강조 클래스 부착 → CSS 1.5초 글로우
 */
function handleConfirmClick(event) {
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  if (phase !== 'result') return;

  const wasSuccess = !!pendingResult?.success;

  // 정리
  clearTimers();
  pendingResult = null;

  // 자식 모두 제거 (오버레이 + IDLE 컴포넌트)
  while (currentRoot.firstChild) currentRoot.removeChild(currentRoot.firstChild);

  // IDLE 다시 빌드 (loadInventory 새로 호출 → 갱신된 level/강화석/옵션 반영)
  // 명시적 detach + 옮김 — 실제 브라우저 / fake DOM 양쪽 안전.
  const newScreen = buildEnhanceScreen(currentItemId);
  const newChildren = Array.from(newScreen.children);
  for (const child of newChildren) {
    if (child.parentNode === newScreen) newScreen.removeChild(child);
    currentRoot.appendChild(child);
  }

  setPhase('idle');

  // 성공 시 옵션 강조 (변경된 행에 잠시 글로우 — CSS 1.5초 자동 종료)
  if (wasSuccess) highlightChangedOptions();
}

/** 성공 시 IDLE 복귀 직후 옵션 비교 표의 모든 행에 강조 클래스 부착.
 *  CSS 가 1.5초 글로우 후 자동 종료 (animation forward both → 자동 사라짐). */
function highlightChangedOptions() {
  if (!currentRoot) return;
  const rows = currentRoot.querySelectorAll('.enhance-options__row');
  rows.forEach(row => row.classList.add('enhance-options__row--highlight'));
}

/* ============================================
   화면 모듈 인터페이스
   ============================================ */

let currentRoot   = null;
let currentItemId = null;
let phase         = 'idle';
let gaugeTimer    = null;
let revealTimer   = null;
let pendingResult = null;

export default {
  mount(el, params = {}) {
    currentItemId = params.itemId;
    if (!currentItemId) {
      navigateBackToBag();
      return;
    }
    phase = 'idle';
    pendingResult = null;
    currentRoot = buildEnhanceScreen(currentItemId);
    currentRoot.dataset.phase = 'idle';  // 초기 phase 명시 (CSS 가드 발동 기준)
    el.appendChild(currentRoot);
  },

  unmount() {
    // 진행 중 타이머/오버레이 모두 정리
    clearTimers();
    currentRoot = null;
    currentItemId = null;
    phase = 'idle';
    pendingResult = null;
  },
};