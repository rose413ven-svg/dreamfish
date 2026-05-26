/* ===========================================
   level-up-popup.js — 레벨업 팝업 (Day 18 신규)
   ============================================
   결정로그 Day 18 SSOT.

   책임:
   - 레벨업 발생 시 큰 임팩트 팝업 표시
   - 다중 레벨업(예: 1→8) 한 번에 합산 보상 표시 (큐 X)
   - 확인 버튼 닫기 → onClose 콜백 (호출자에서 new-stage-alert 트리거 가능)

   디자인 톤 (정체성 5):
   - 콤보 타격감: 별빛 입자 + 글로우 (큰 임팩트)
   - 잔잔한 분위기: 폭발 X, 따뜻한 호박색 + 부드러운 글로우
   - 단정한 미니멀리즘: 한 화면, 단일 카드, 행 8개 정렬
   - 단순함의 반전: 잔잔한 슬롯 게임에 레벨업 = 보상감 임팩트
   - 중독성: 보상 8행 시각화 = "한 번 더" 동기

   사용 패턴 (Phase 5 slot.js 연결 예정):
     const popup = createLevelUpPopup({ onClose: () => { ... } });
     content.appendChild(popup.root);
     popup.show({ from: 1, to: 8, onClose: () => alert.enqueue(...) });
   ============================================ */

import { LEVEL_BONUSES_PER_LEVEL, STAT_DISPLAY_LABELS } from '../data/level-config.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/* 정수 가중치 키 (% 단위 X)
 * ★ Day 22 Phase 7 후속 (대표 결정): twinkle_rate(하얀물고기 입질) 도 % 제거 추가.
 *   다른 화면 (profile-modal / enhance / equipment-context-menu) 과 일관성 유지. */
const NO_PERCENT_KEYS = new Set(['fish_rate', 'golden_rate', 'rainbow_rate', 'twinkle_rate']);

/**
 * 보상값 포맷 — 부호 포함, 단위 분기.
 * fish/golden/rainbow_rate = 정수 가중치 / 나머지 = %
 *
 * ★ Day 41 (대표 결정) — 입질 4종 (NO_PERCENT_KEYS) ×100 표시 적용.
 *   다른 화면 (profile-modal / stats-bar 등) 과 일관성 — 내부 값 0.05 → 화면 +5 로 표시.
 */
function fmtBonusValue(value, key) {
  const unit = NO_PERCENT_KEYS.has(key) ? '' : '%';
  if (!value || value === 0) return `0${unit}`;
  // ★ Day 41 — 입질 4종은 ×100 표시 (내부 0.05 → +5).
  const displayValue = NO_PERCENT_KEYS.has(key) ? value * 100 : value;
  // 소수점 2자리 + trailing 0 제거
  const numStr = String(Number((Number(displayValue) || 0).toFixed(2)));
  if (displayValue > 0) return `+${numStr}${unit}`;
  return `${numStr}${unit}`;   // 음수는 그대로 (-0.4 등)
}

/**
 * 다중 레벨업 보너스 델타 계산.
 * from→to 레벨업 횟수 × LEVEL_BONUSES_PER_LEVEL.
 */
function computeBonusDelta(from, to) {
  const count = Math.max(0, to - from);
  const delta = {};
  for (const [key, perLv] of Object.entries(LEVEL_BONUSES_PER_LEVEL)) {
    delta[key] = perLv * count;
  }
  return delta;
}

/**
 * @param {object} [opts]
 * @param {() => void} [opts.onClose] - 닫힐 때 매번 호출 (모든 show 공통)
 * @returns {{
 *   root: HTMLElement,
 *   show: (info: {from:number, to:number, onClose?: () => void}) => void,
 *   close: () => void,
 *   isOpen: () => boolean,
 *   dispose: () => void,
 * }}
 */
export function createLevelUpPopup(opts = {}) {
  const { onClose: globalOnClose } = opts;
  let isOpenState = false;
  let pendingOnce = null;   // 이번 show() 1회용 콜백

  /* ── 루트 + 오버레이 + 패널 (profile-modal 패턴) ── */
  const root = document.createElement('div');
  root.className = 'levelup-root';
  root.setAttribute('aria-hidden', 'true');

  const overlay = document.createElement('div');
  overlay.className = 'levelup-overlay';

  const panel = document.createElement('div');
  panel.className = 'levelup-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '레벨업');
  // 패널 클릭 → 오버레이 전파 차단 (오버레이로는 안 닫힘 — 확인 버튼만)
  panel.addEventListener('click', (e) => e.stopPropagation());

  /* ── 헤더: 별빛 입자 + "LEVEL UP!" ── */
  const header = document.createElement('div');
  header.className = 'levelup-header';

  // 별빛 입자 (CSS animation 으로 깜빡)
  const stars = document.createElementNS(SVG_NS, 'svg');
  stars.setAttribute('class', 'levelup-stars');
  stars.setAttribute('viewBox', '0 0 200 60');
  stars.setAttribute('aria-hidden', 'true');
  // 작은 별 6개 흩뿌리기
  const starPositions = [
    [20, 12], [55, 38], [88, 8], [124, 42], [155, 14], [185, 36],
  ];
  starPositions.forEach(([cx, cy], i) => {
    const s = document.createElementNS(SVG_NS, 'circle');
    s.setAttribute('cx', cx);
    s.setAttribute('cy', cy);
    s.setAttribute('r', '1.4');
    s.setAttribute('class', `levelup-star levelup-star--${i}`);
    stars.appendChild(s);
  });

  const headerText = document.createElement('div');
  headerText.className = 'levelup-header__text';
  headerText.textContent = 'LEVEL UP!';

  header.appendChild(stars);
  header.appendChild(headerText);

  /* ── 레벨 표시: "Lv. N → Lv. M" ── */
  const levelDisplay = document.createElement('div');
  levelDisplay.className = 'levelup-display';

  const fromEl = document.createElement('span');
  fromEl.className = 'levelup-display__from';

  const arrowEl = document.createElement('span');
  arrowEl.className = 'levelup-display__arrow';
  arrowEl.textContent = '→';

  const toEl = document.createElement('span');
  toEl.className = 'levelup-display__to';

  levelDisplay.appendChild(fromEl);
  levelDisplay.appendChild(arrowEl);
  levelDisplay.appendChild(toEl);

  /* ── 보상 섹션 ── */
  const rewardsSection = document.createElement('section');
  rewardsSection.className = 'levelup-rewards';

  const rewardsLabel = document.createElement('div');
  rewardsLabel.className = 'levelup-rewards__label';
  rewardsLabel.textContent = '새 보상';

  const rewardsList = document.createElement('div');
  rewardsList.className = 'levelup-rewards__list';

  rewardsSection.appendChild(rewardsLabel);
  rewardsSection.appendChild(rewardsList);

  /* ── 확인 버튼 ── */
  const okBtn = document.createElement('button');
  okBtn.className = 'levelup-ok';
  okBtn.type = 'button';
  okBtn.textContent = '확인';
  okBtn.addEventListener('click', close);

  /* ── 조립 ── */
  panel.appendChild(header);
  panel.appendChild(levelDisplay);
  panel.appendChild(rewardsSection);
  panel.appendChild(okBtn);

  root.appendChild(overlay);
  root.appendChild(panel);

  /* ============================================
     공개 API
     ============================================ */

  /**
   * 팝업 표시.
   * @param {object} info
   * @param {number} info.from              레벨업 전 레벨
   * @param {number} info.to                레벨업 후 레벨
   * @param {() => void} [info.onClose]     이번 호출 1회용 콜백
   */
  function show(info = {}) {
    const from = Number(info.from);
    const to   = Number(info.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return;

    pendingOnce = (typeof info.onClose === 'function') ? info.onClose : null;

    // 레벨 표시 갱신
    fromEl.textContent = `Lv. ${from}`;
    toEl.textContent   = `Lv. ${to}`;

    // 다중 레벨업이면 헤더에 횟수 부각 (자연스러운 시각화)
    const jumps = to - from;
    headerText.textContent = jumps >= 2 ? `+${jumps} LEVEL UP!` : 'LEVEL UP!';

    // 보상 행 갱신 (LEVEL_BONUSES_PER_LEVEL 순서 따라 8행)
    const delta = computeBonusDelta(from, to);
    rewardsList.innerHTML = '';
    for (const key of Object.keys(LEVEL_BONUSES_PER_LEVEL)) {
      const value = delta[key] || 0;
      const row = document.createElement('div');
      row.className = 'levelup-reward-row';
      row.dataset.key = key;

      const nameEl = document.createElement('span');
      nameEl.className = 'levelup-reward-row__name';
      nameEl.textContent = STAT_DISPLAY_LABELS[key] || key;

      const valEl = document.createElement('span');
      valEl.className = 'levelup-reward-row__value';
      valEl.textContent = fmtBonusValue(value, key);
      if (value > 0) valEl.classList.add('levelup-reward-row__value--pos');
      else if (value < 0) valEl.classList.add('levelup-reward-row__value--neg');

      row.appendChild(nameEl);
      row.appendChild(valEl);
      rewardsList.appendChild(row);
    }

    isOpenState = true;
    root.setAttribute('aria-hidden', 'false');
    root.classList.add('levelup-root--open');
  }

  /**
   * 팝업 닫기 — pendingOnce 콜백 (이번 1회용) → globalOnClose 순서로 호출.
   */
  function close() {
    if (!isOpenState) return;
    isOpenState = false;
    root.setAttribute('aria-hidden', 'true');
    root.classList.remove('levelup-root--open');

    const once = pendingOnce;
    pendingOnce = null;
    if (typeof once === 'function') {
      try { once(); } catch (_) { /* swallow */ }
    }
    if (typeof globalOnClose === 'function') {
      try { globalOnClose(); } catch (_) { /* swallow */ }
    }
  }

  function dispose() {
    okBtn.removeEventListener('click', close);
  }

  return {
    root,
    show,
    close,
    isOpen: () => isOpenState,
    dispose,
  };
}