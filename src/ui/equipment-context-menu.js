/* ===========================================
   equipment-context-menu.js — 장비 컨텍스트 메뉴 (단독 모듈)
   ============================================
   장비 인스턴스 1개에 대한 액션 메뉴(장착/강화/합성/도감)를 띄움.
   가방 모달 안에서도, 슬롯 화면 장비칸 클릭 시에도 재사용.

   디자인은 bag.css의 .bag-context__* 스타일 그대로 사용
   (단일 진실의 원천 — 두 화면에서 같은 모양으로 보임).

   호출:
     openEquipmentContextMenu(itemId, {
       parent:    document.getElementById('app'),  // 부모 엘리먼트 (기본 #app)
       onChange:  () => {...},                      // 장착/해제 후 콜백
       onNavigate:() => {...},                      // 강화/합성/도감 이동 직전 콜백
     });

   onNavigate 가 호출된 후 navigate(...) 실행.
   호출 측이 "가방을 닫는다" 같은 정리 작업을 onNavigate 안에서 수행.
   ============================================ */

import { loadInventory, saveInventory } from '../core/storage.js';
import { findEquipmentById, equipItem, toggleLock, getEquippedBySlot } from '../data/inventory.js';
import { getCatalogEntry } from '../data/equipment-catalog.js';
import { GEAR_GRADES } from '../data/gear-grades.js';
import { OPTIONS } from '../data/equipment-options.js';
import { getEnhanceBonus } from '../data/equipment-meta.js';
// Day 10 — 세트 효과 (C-1): 클릭 장비 등급 기준 세트 영역 (희귀+ 만)
import { getContextMenuSetInfo } from '../data/set-effects.js';
import { Screen, navigate } from '../core/router.js';
import { hasUnregisteredEntryForItem } from '../data/codex-engine.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 자물쇠 SVG (헤더 토글 버튼용)
 * @param {boolean} open  true면 열린 자물쇠(고리 풀림), false면 닫힘
 */
function makeLockIcon(open = false) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  // 자물쇠 본체 (공통)
  const body = document.createElementNS(SVG_NS, 'rect');
  body.setAttribute('x', '5'); body.setAttribute('y', '11');
  body.setAttribute('width', '14'); body.setAttribute('height', '10');
  body.setAttribute('rx', '1.5');
  svg.appendChild(body);
  // 고리 — 열림이면 오른쪽 끝이 본체에서 빠져나온 모양 (위로 떠있음)
  const arc = document.createElementNS(SVG_NS, 'path');
  arc.setAttribute('d', open
    ? 'M8 11 V7 Q8 3 12 3 Q16 3 16 6'    // 열림: 오른쪽 끝(16,6) — 본체 외곽 위로
    : 'M8 11 V7 Q8 3 12 3 Q16 3 16 7 V11' // 닫힘: 양쪽 모두 본체와 결합
  );
  svg.appendChild(arc);
  return svg;
}

/** 현재 열려 있는 컨텍스트 메뉴 root (한 번에 1개만) */
let currentRoot = null;
let currentTimer = 0;

/** 닫기 (트랜지션 후 DOM 제거) */
export function closeEquipmentContextMenu() {
  if (!currentRoot) return;
  currentRoot.classList.remove('bag-context--open');
  const target = currentRoot;
  currentRoot = null;
  if (currentTimer) clearTimeout(currentTimer);
  currentTimer = setTimeout(() => {
    if (target.parentNode) target.parentNode.removeChild(target);
  }, 220);
}

/**
 * @param {string} itemId  장비 인스턴스 id (예: 'eq_3')
 * @param {object} [opts]
 * @param {HTMLElement} [opts.parent]      부모 엘리먼트. 기본 #app
 * @param {() => void}  [opts.onChange]    장착/해제 직후 호출
 * @param {() => void}  [opts.onNavigate]  강화/합성/도감 navigate 직전 호출
 *                                          (호출 측에서 가방 닫기 등 정리)
 * @returns {{ close: () => void } | null}  열림 핸들 (실패 시 null)
 */
export function openEquipmentContextMenu(itemId, opts = {}) {
  const parent = opts.parent || document.getElementById('app') || document.body;
  const onChange = opts.onChange;
  const onNavigate = opts.onNavigate;

  // 인벤토리 로드 + 장비 조회
  const inv = loadInventory();
  if (!inv) return null;
  const item = findEquipmentById(inv, itemId);
  if (!item) return null;
  const entry = getCatalogEntry(item.catalogId);
  if (!entry) return null;

  // 이미 열려있으면 먼저 닫음
  closeEquipmentContextMenu();

  // root + overlay
  const root = document.createElement('div');
  root.className = 'bag-context';

  const ovl = document.createElement('div');
  ovl.className = 'bag-context__overlay';
  ovl.addEventListener('click', closeEquipmentContextMenu);

  // panel (등급별 색)
  const cpanel = document.createElement('div');
  cpanel.className = `bag-context__panel bag-context--${entry.grade}`;
  cpanel.addEventListener('click', e => e.stopPropagation());

  // 헤더 — 이름 + 자물쇠 토글 + 등급
  const cheader = document.createElement('div');
  cheader.className = 'bag-context__header';
  const cname = document.createElement('div');
  cname.className = 'bag-context__name';
  cname.textContent = entry.name;

  // Bag-5: 자물쇠 토글 버튼 — 이름 옆에 배치.
  // 해제 상태 = 회색 자물쇠, 잠금 상태 = 청은빛 활성 자물쇠.
  // 클릭 시 메뉴는 그대로 두고 자물쇠 색 + 강화/합성 disabled 만 즉시 갱신.
  const lockBtn = document.createElement('button');
  lockBtn.type = 'button';
  lockBtn.className = 'bag-context__lock-toggle';
  if (item.locked) lockBtn.classList.add('bag-context__lock-toggle--on');
  lockBtn.setAttribute('aria-label', item.locked ? '잠금 해제' : '잠그기');
  lockBtn.appendChild(makeLockIcon(!item.locked));

  const cgrade = document.createElement('div');
  cgrade.className = 'bag-context__grade';
  cgrade.textContent = GEAR_GRADES[entry.grade]?.name || entry.grade;
  if (item.level > 0) cgrade.textContent += ` +${item.level}`;
  cheader.appendChild(cname);
  cheader.appendChild(lockBtn);
  // Day 9 후속: 장착 중인 장비면 'E' 황금 뱃지 — 가방 셀의 'E' 뱃지와 톤 통일.
  if (item.equipped) {
    const eBadge = document.createElement('span');
    eBadge.className = 'bag-context__equipped-badge';
    eBadge.textContent = 'E';
    cheader.appendChild(eBadge);
  }
  cheader.appendChild(cgrade);

  // 설명
  const cdesc = document.createElement('div');
  cdesc.className = 'bag-context__desc';
  cdesc.textContent = entry.description;

  // ───────────────────────────────────────
  // Day 10 (C-1) — 세트 영역 (희귀 이상 등급 장비만)
  // ───────────────────────────────────────
  // 결정:
  // - 클릭 장비 등급 기준 (그 장비가 속할 세트 정보)
  // - 진행도 = 4부위 중 그 등급으로 장착된 부위 수 / 4
  // - 발동 = 4/4 → 등급 색 / 미발동 = 0~3/4 → 회색
  // - 라벨 / 진행도 / 두 스탯 수치 모두 같이 색 분기 (대표 결정)
  // - 일반/고급 = 영역 자체 X (getContextMenuSetInfo 가 null 반환)
  // - 4부위에 같은 영역 표시 (효과는 1번만 적용 — 코드상 보장됨)
  let csetArea = null;
  const setInfo = getContextMenuSetInfo(inv, entry.grade);
  if (setInfo) {
    csetArea = document.createElement('div');
    csetArea.className = `bag-context__set bag-context__set--${setInfo.grade}`;
    csetArea.classList.add(setInfo.isActive ? 'bag-context__set--active' : 'bag-context__set--inactive');

    const cseth = document.createElement('div');
    cseth.className = 'bag-context__set-header';
    const csetn = document.createElement('span');
    csetn.className = 'bag-context__set-name';
    csetn.textContent = setInfo.name;
    const csetp = document.createElement('span');
    csetp.className = 'bag-context__set-progress';
    csetp.textContent = `${setInfo.count}/4`;
    cseth.appendChild(csetn);
    cseth.appendChild(csetp);

    const csetrows = document.createElement('div');
    csetrows.className = 'bag-context__set-rows';
    // 두 행 — 물고기 kg 보너스, 장비 발견 추가 확률 (수치는 항상 표시, 색만 분기)
    const mkRow = (name, valueText) => {
      const row = document.createElement('div');
      row.className = 'bag-context__set-row';
      const nm = document.createElement('span');
      nm.className = 'bag-context__set-row-name';
      nm.textContent = name;
      const vl = document.createElement('span');
      vl.className = 'bag-context__set-row-value';
      vl.textContent = valueText;
      row.appendChild(nm);
      row.appendChild(vl);
      return row;
    };
    csetrows.appendChild(mkRow('물고기 kg 보너스',     `+${setInfo.weightPct}%`));
    csetrows.appendChild(mkRow('장비 발견 추가 확률', `+${setInfo.dropRatePct}%`));

    csetArea.appendChild(cseth);
    csetArea.appendChild(csetrows);
  }

  // ───────────────────────────────────────
  // Day 10 (C-3) — 고유 꾸미기 효과 라벨 (cosmeticColor 보유 장비만)
  // ───────────────────────────────────────
  // 결정 (대표):
  //   - cosmeticColor 보유 시에만 표시 (희귀+ + 50% 확률 추첨 통과한 장비)
  //   - 위치: 옵션 영역 위쪽, 세트 영역 아래
  //   - "고유 꾸미기 효과" 라벨 (다른 색 — 등급 색 사용)
  let ccosmeticLabel = null;
  if (item.cosmeticColor) {
    ccosmeticLabel = document.createElement('div');
    ccosmeticLabel.className = `bag-context__cosmetic-label bag-context__cosmetic-label--${entry.grade}`;
    ccosmeticLabel.textContent = '고유 꾸미기 효과';
  }

  // 옵션 리스트 — Day 6 + Day 9 비교 시스템
  // ───────────────────────────────────────
  // 표시 케이스:
  //   1. 같은 부위 장착 X → 비교 X, 클릭 장비 옵션만 표시 (현재 동작 유지)
  //   2. 클릭 장비가 자기 자신 (장착 중) → 비교 X, 헤더 'E' 뱃지로 식별
  //   3. 비교 가능 → 합집합 표시
  //      - 클릭만 가진 옵션         : NEW (황금)
  //      - 둘 다 있고 클릭 ↑       : ▲N (초록)
  //      - 둘 다 있고 클릭 ↓       : ▼N (빨강)
  //      - 둘 다 있고 동일          : 차이 칸 비움
  //      - 장착만 가진 옵션 (잃을) : 행 전체 빨강 톤 + ▼
  //
  // Q4 결정: + 기호 X (모든 곳).
  // ★ Day 10 후속 (대표 보고): sign='-' 인 옵션 (rock_rate, orb_speed) 은 음수로 표시 — 양수 그대로면 이상하게 보임.
  //    signed() 헬퍼 — sign='-' 면 -, sign='+' 면 부호 X (Q4 결정 유지).
  const NO_PERCENT_KEYS = new Set(['fish_rate', 'golden_rate', 'rainbow_rate', 'twinkle_rate']);
  // ★ Day 22 Phase 7 후속 (대표 결정): twinkle_rate(하얀물고기 입질) 도 % 제거.
  //   profile-modal.js / enhance.js 는 이미 Day 21 에 추가됨 — 컨텍스트 메뉴만 누락이었음 (가방/장착 화면).
  //   displayScale: 100 (×100 반올림 정수 표시) 은 fmtNum 헬퍼가 모든 옵션 공통 처리 (line 244).
  // Day 11 후속 — 정수면 정수, 소수면 최대 2자리, trailing 0 자동 제거
  // (String(Number(...)) 패턴: 0.50 → "0.5", 10.18 → "10.18", 0 → "0")
  const fmtNumRaw = (n) => String(Number((Number(n) || 0).toFixed(2)));

  // Day 19 — '내정보' 화면(profile-modal.js)과 표시 일관성 위해 displayScale 적용.
  // fish/golden/rainbow_rate 는 OPTIONS 에 displayScale: 100 정의됨 → value × 100 반올림 정수 표시
  // (예: 0.73 → '73').  나머지 옵션은 기존 fmtNumRaw (소수 2자리 최대).
  const fmtNum = (n, key) => {
    const opt = key ? OPTIONS[key] : null;
    const scale = opt?.displayScale || 1;
    if (scale !== 1) return String(Math.round((Number(n) || 0) * scale));
    return fmtNumRaw(n);
  };
  const signed = (val, sign, key) => sign === '-' ? `-${fmtNum(val, key)}` : fmtNum(val, key);

  /** 옵션별 total 맵 (베이스 value + 강화 누적 보너스).
   *  Day 11 변경: 옵션×부위×등급별로 강화 누적이 다르므로 옵션마다 따로 계산. */
  function buildOptionTotals(it) {
    const e = getCatalogEntry(it.catalogId);
    if (!e) return {};
    const level = it.level || 0;
    const totals = {};
    if (Array.isArray(it.options)) {
      for (const o of it.options) {
        if (!o || !o.key) continue;
        const eb = getEnhanceBonus(o.key, e.slotId, e.grade, level);
        totals[o.key] = (o.value || 0) + eb;
      }
    }
    return totals;
  }

  // 같은 부위 장착 장비 — 자기 자신이면 비교 X
  const equippedSibling = getEquippedBySlot(inv, entry.slotId);
  const isSelfEquipped = equippedSibling && equippedSibling.id === item.id;
  const hasComparison = !!(equippedSibling && !isSelfEquipped);

  const itemTotals = buildOptionTotals(item);
  const equippedTotals = hasComparison ? buildOptionTotals(equippedSibling) : {};

  // 표시할 키 목록 (OPTIONS 정의 순서로 정렬 — 보트도 일관된 순서)
  const displayKeys = hasComparison
    ? Object.keys(OPTIONS).filter(k => k in itemTotals || k in equippedTotals)
    : Object.keys(OPTIONS).filter(k => k in itemTotals);

  const coptions = document.createElement('div');
  coptions.className = 'bag-context__options';

  for (const key of displayKeys) {
    const def = OPTIONS[key];
    if (!def) continue;
    const inItem = key in itemTotals;
    const inEquipped = key in equippedTotals;
    const itemVal = itemTotals[key] || 0;
    const equippedVal = equippedTotals[key] || 0;
    const unit = NO_PERCENT_KEYS.has(key) ? '' : '%';

    const row = document.createElement('div');
    row.className = 'bag-context__option';

    const nameEl = document.createElement('span');
    nameEl.className = 'bag-context__option-name';
    nameEl.textContent = def.displayName;

    const valEl = document.createElement('span');
    valEl.className = 'bag-context__option-value';

    const diffEl = document.createElement('span');
    diffEl.className = 'bag-context__option-diff';

    if (inItem) {
      // 클릭 장비가 가진 옵션 — 메인값 = 클릭 value (Day 10: sign='-' 면 음수 표시)
      valEl.textContent = `${signed(itemVal, def.sign, key)}${unit}`;

      if (hasComparison) {
        if (!inEquipped) {
          // 클릭만 가진 옵션 — NEW
          diffEl.textContent = 'NEW';
          diffEl.classList.add('bag-context__option-diff--new');
        } else {
          const diff = itemVal - equippedVal;
          if (Math.abs(diff) < 0.0005) {
            // 동일 — 차이 칸 비움 (시각적 단정)
          } else if (diff > 0) {
            diffEl.textContent = `▲${fmtNum(diff, key)}${unit}`;
            diffEl.classList.add('bag-context__option-diff--up');
          } else {
            diffEl.textContent = `▼${fmtNum(-diff, key)}${unit}`;
            diffEl.classList.add('bag-context__option-diff--down');
          }
        }
      }
    } else {
      // 장착만 가진 옵션 — 잃을 옵션 (메인값=장착 value, 차이=▼만)
      row.classList.add('bag-context__option--lost');
      valEl.textContent = `${signed(equippedVal, def.sign, key)}${unit}`;
      diffEl.textContent = '▼';
      diffEl.classList.add('bag-context__option-diff--down');
    }

    row.appendChild(nameEl);
    row.appendChild(valEl);
    row.appendChild(diffEl);
    coptions.appendChild(row);
  }

  // ───────────────────────────────────────
  // Day 13 — 합성 추가 옵션 (extraOptions) 별도 분홍 줄 표시 (대표 결정).
  // ───────────────────────────────────────
  // 기존 동작: extraOptions 가 컨텍스트 메뉴에 표시 안 됨 → "물고기 kg 보너스" 옵션 보유 사실 모름
  // 변경: 일반 옵션 행들 다음에 ★ 분홍 줄로 별도 표시 — 합성 결과 카드의 표시 패턴과 동일
  //       (.compose-result-options__row--extra) 와 통일된 비주얼.
  // 비교 (▲/▼/NEW) 는 표시 안 함 — extraOptions 는 합성 시 1회 추첨된 고정값이므로
  //   강화로 변하지 않고, "이 장비만의 특별한 옵션" 강조에 집중 (분홍 줄 = 별도 영역 인상).
  if (Array.isArray(item.extraOptions) && item.extraOptions.length > 0) {
    for (const opt of item.extraOptions) {
      const def = OPTIONS[opt.key];
      if (!def) continue;
      const unit = NO_PERCENT_KEYS.has(opt.key) ? '' : '%';

      const row = document.createElement('div');
      row.className = 'bag-context__option bag-context__option--extra';

      const star = document.createElement('span');
      star.className = 'bag-context__option-mark';
      star.textContent = '★';
      row.appendChild(star);

      const nameEl = document.createElement('span');
      nameEl.className = 'bag-context__option-name';
      nameEl.textContent = def.displayName;
      row.appendChild(nameEl);

      const valEl = document.createElement('span');
      valEl.className = 'bag-context__option-value';
      const sign = def.sign === '-' ? '-' : '+';
      valEl.textContent = `${sign}${fmtNum(opt.value || 0, opt.key)}${unit}`;
      row.appendChild(valEl);

      // diff 영역은 빈 span (레이아웃 정렬 위해 — 일반 옵션 행과 컬럼 폭 맞춤)
      const diffEl = document.createElement('span');
      diffEl.className = 'bag-context__option-diff';
      row.appendChild(diffEl);

      coptions.appendChild(row);
    }
  }

  // 액션 4개
  const cactions = document.createElement('div');
  cactions.className = 'bag-context__actions';

  /** 장착/해제 토글 */
  function handleEquip() {
    // 매번 fresh inv 로드 (외부에서 변경됐을 수 있음)
    const fresh = loadInventory();
    if (!fresh) return;
    const target = findEquipmentById(fresh, itemId);
    if (!target) return;
    if (target.equipped) {
      target.equipped = false;
    } else {
      equipItem(fresh, target.id);
    }
    saveInventory(fresh);
    closeEquipmentContextMenu();
    onChange?.();
  }

  /** 강화/합성/도감 화면으로 이동 */
  function handleNav(screenKey) {
    closeEquipmentContextMenu();
    onNavigate?.();
    navigate(screenKey, { itemId });
  }

  const actions = [
    { key: 'equip',   label: item.equipped ? '해제' : '장착',
      primary: true, handler: handleEquip },
    { key: 'enhance', label: '강화',
      requiresUnlocked: true,
      handler: () => handleNav(Screen.ENHANCE) },
    { key: 'compose', label: '합성',
      requiresUnlocked: true,
      handler: () => handleNav(Screen.COMPOSE) },
    { key: 'codex',   label: '도감',
      requiresUnlocked: true,
      handler: () => handleNav(Screen.CODEX) },
  ];
  // Day 12 — 호출측에서 비활성화할 액션 키 배열 (예: 슬롯 화면 상단 장착 칸 = ['compose','codex'])
  const disableActions = Array.isArray(opts.disableActions) ? opts.disableActions : [];
  for (const a of actions) {
    const btn = document.createElement('button');
    btn.className = 'bag-context__btn';
    if (a.primary) btn.classList.add('bag-context__btn--primary');
    // Day 6 후반: requiresUnlocked 액션은 lockable 클래스로 마킹.
    // syncLockedActions 가 이 클래스로 일괄 처리 → 추후 새 잠금 가드 액션 추가 시 자동 동작.
    if (a.requiresUnlocked) btn.classList.add('bag-context__btn--lockable');
    btn.dataset.action = a.key;
    btn.textContent = a.label;
    // Day 12 — 호출측 명시 비활성 (잠금과 별개 채널, 항상 비활성)
    const forceDisabled = disableActions.includes(a.key);
    if (forceDisabled) {
      btn.classList.add('bag-context__btn--disabled');
      btn.setAttribute('aria-disabled', 'true');
    }
    // Bag-5: 잠금 가드 — 핸들러 내부에서 검사하므로 잠금 토글 시 별도 핸들러 재부착 불필요.
    btn.addEventListener('click', () => {
      if (forceDisabled) return;                          // Day 12 — 호출측 비활성 가드
      if (a.requiresUnlocked && item.locked) return;
      a.handler();
    });
    // 초기 잠금 상태 시각 반영
    if (a.requiresUnlocked && item.locked) {
      btn.classList.add('bag-context__btn--disabled');
      btn.setAttribute('aria-disabled', 'true');
    }
    // Day 16 — 도감 버튼 빨간점 (이 아이템으로 등록 가능한 미등록 도감이 있을 때)
    //   비활성/잠금이어도 알림은 표시 (사용자가 잠금 풀고 진입할 수 있는 안내).
    if (a.key === 'codex' && hasUnregisteredEntryForItem(item)) {
      const dot = document.createElement('span');
      dot.className = 'codex-dot';
      btn.appendChild(dot);
    }
    cactions.appendChild(btn);
  }

  /** Bag-5: 잠금 토글 시 메뉴 내 시각만 즉시 갱신 (메뉴는 닫지 않음) */
  function syncLockedActions() {
    // 자물쇠 SVG 모양 교체 (열림 ↔ 닫힘) — 색 토글만으로는 헷갈리는 문제 해결
    const oldSvg = lockBtn.querySelector('svg');
    if (oldSvg) lockBtn.removeChild(oldSvg);
    lockBtn.appendChild(makeLockIcon(!item.locked));

    lockBtn.classList.toggle('bag-context__lock-toggle--on', item.locked);
    lockBtn.setAttribute('aria-label', item.locked ? '잠금 해제' : '잠그기');
    // Day 6 후반: lockable 클래스가 붙은 버튼 모두 일괄 처리 (강화/합성/도감 등).
    // Day 14 ★ 버그픽스 (대표 보고 — 슬롯 화면 장착장비칸에서 자물쇠 토글 후 합성/도감 활성화 버그):
    //   disableActions (호출측 강제 비활성, 잠금과 별개 채널 — 부트스트랩 규칙 42) 가 우선.
    //   잠금 풀려도 호출측이 명시한 액션은 항상 disabled 유지. (예: 슬롯 화면 장착장비칸 = 합성/도감 항상 비활성)
    //   이전 버그: 무차별 toggle('disabled', item.locked) 가 forceDisabled 별도 채널을 덮어씀.
    for (const btnEl of cactions.querySelectorAll('.bag-context__btn--lockable')) {
      const action = btnEl.dataset.action;
      const isForceDisabled = disableActions.includes(action);
      const shouldDisable = isForceDisabled || item.locked;
      btnEl.classList.toggle('bag-context__btn--disabled', shouldDisable);
      btnEl.setAttribute('aria-disabled', shouldDisable ? 'true' : 'false');
    }
  }

  /** 자물쇠 토글 핸들러 — 헤더 자물쇠 클릭 시 호출 */
  function handleLockToggle() {
    const fresh = loadInventory();
    if (!fresh) return;
    if (!toggleLock(fresh, itemId)) return;
    saveInventory(fresh);
    const updated = findEquipmentById(fresh, itemId);
    if (!updated) return;
    item.locked = updated.locked;
    syncLockedActions();
    // 가방 모달의 inv 갱신용 (메뉴 닫고 가방 보면 자물쇠 자동 반영)
    onChange?.();
  }
  lockBtn.addEventListener('click', handleLockToggle);

  cpanel.appendChild(cheader);
  cpanel.appendChild(cdesc);
  // Day 10: 세트 영역 → 고유 꾸미기 효과 라벨 → 옵션 리스트 순 (대표 결정)
  if (csetArea)       cpanel.appendChild(csetArea);
  if (ccosmeticLabel) cpanel.appendChild(ccosmeticLabel);
  cpanel.appendChild(coptions);
  cpanel.appendChild(cactions);
  root.appendChild(ovl);
  root.appendChild(cpanel);
  parent.appendChild(root);
  currentRoot = root;

  // rAF 로 트랜지션 발동
  requestAnimationFrame(() => {
    root.classList.add('bag-context--open');
  });

  return { close: closeEquipmentContextMenu };
}