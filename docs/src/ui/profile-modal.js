/* ===========================================
   profile-modal.js — 내 정보 모달 (Day 7)
   ============================================
   메뉴 → '내정보' 클릭 시 슬롯 화면 위에 띄움.
   bag-modal 과 동일 패턴 (오버레이 + 슬라이드 패널).

   표시 항목 (Day 7 결정 — 닉네임 + 장비 옵션 합계 2개만):
   1. 닉네임 — storage.loadNickname() (기본값 '낭만대표')
   2. 장비 옵션 합계 7종 — 보너스만 표시 (베이스값 X)
      형식: '+5%' / '0%' / '-5%' (해석 B 채택)
      - sign='-' 옵션은 음수로 표시 (rock_rate, orb_speed)
      - combo_bonus 만 콤보 단계 보너스 (콤보단계×10%) 동적 합산
        → 모달 열린 시점 콤보 카운트 기준
        → 콤보 끊김 시 장비분만 표시

   추후 추가 예정 (placeholder 만):
   - 랭킹 / 도감 진행도 / 물고기별 최고 무게 등

   공개 API: createProfileModal({ getCurrentCombo, onClose })
   - root + open + close + dispose
   ============================================ */

import { OPTIONS } from '../data/equipment-options.js';
import { getActiveOptions, CRITICAL_BASE_RATE, COMBO_STAGE_CAP, COMBO_STAGE_PER_HIT } from '../data/equipment-effects.js';
// Day 10 v2 — 세트 효과 (대표 결정 변경): STATS 위쪽 별도 영역 삭제 →
//   옵션 7종 안의 weight_bonus 행에 세트 무게 % 합산 +
//   신규 행 '장비 발견 추가 확률' 추가 (총 8행)
import { getSetGrade, getSetWeightBonus, getSetDropRateBonus } from '../data/set-effects.js';
import { GEAR_GRADES } from '../data/gear-grades.js';
import { loadInventory, loadNickname } from '../core/storage.js';
// Day 17 후속 v2 (대표 보고 — 도감 보너스가 내정보 수치에 미반영):
//   getActiveOptions 두 번째 인자로 codexBonuses 전달 필요 (stats-bar.js / slot.js 패턴과 동일).
//   ★ Day 41 (대표 결정) — 도감 cosmetic 카테고리 변경: dropRatePct → kabikabiBonusPct.
//     장비 발견 추가 확률 행에서 도감 분 제거 (세트+레벨만), 까비까비 보너스 행은 active.kabikabi_bonus 자동 반영.
import { getCodexBonuses } from '../data/codex-engine.js';
// Day 18 — 레벨 시스템 도입:
//   - 닉네임 옆 'Lv. N' 표시
//   - STATS 행에 레벨 누적 보너스 합산 (옵션 7종 + set_drop_rate)
import { getCurrentLevel, getLevelBonuses } from '../data/level-engine.js';
// ★ Day 25 Phase 3 — 상상력 스탯 (스탯 리스트 최상단 행)
import { getCurrentImagination } from '../data/imagination.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** X 닫기 아이콘 */
function makeCloseIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.4');
  svg.setAttribute('stroke-linecap', 'round');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M6 6 L18 18 M18 6 L6 18');
  svg.appendChild(path);
  return svg;
}

/** 숫자 표시 — 정수면 정수, 소수면 최대 2자리, trailing 0 자동 제거 (Day 11 후속).
 *  String(Number(...)) 패턴: 0.50 → "0.5", 10.18 → "10.18", 0 → "0". */
function fmtNum(n) {
  if (!n) return '0';
  return String(Number((Number(n) || 0).toFixed(2)));
}

/* fish/golden/rainbow/twinkle_rate 는 정수 가중치 (% 단위 X), 나머지는 % 표시.
 * ★ Day 21 (대표 결정) — twinkle_rate 도 다른 입질과 동일 표기 방법: % 없이 정수 가중치. */
const NO_PERCENT_KEYS = new Set(['fish_rate', 'golden_rate', 'rainbow_rate', 'twinkle_rate']);

/**
 * 보너스 표시 형식 (해석 B — 보너스만 표시).
 * Day 7-2: 옵션 종류 따라 단위 분기 (가중치 정수 vs %).
 * Day 18 후속 (대표 결정): OPTIONS 의 displayScale 적용.
 *   - displayScale: 100 인 키 (fish/golden/rainbow_rate) → value × 100 반올림 표시
 *   - 실제 게임 가중치는 그대로 (예: 0.73) — UI 만 큰 숫자 (73 으로) — 스탯 임팩트
 * Day 21 (대표 결정): twinkle_rate 도 동일 처리 (NO_PERCENT_KEYS + displayScale: 100).
 * - 0    → '0' or '0%' (괄호 X)
 * - sign='-' & value > 0 → '-{value}{단위}'  (음수 그대로)
 * - sign='+' & value > 0 → '+{value}{단위}'
 *
 * @param {number} value — 옵션 합계 (장비 + 콤보, 양수로 저장)
 * @param {string} sign  — '+' | '-'
 * @param {string} key   — 옵션 키 (단위 + displayScale 분기용)
 */
function formatBonus(value, sign, key) {
  const opt = OPTIONS[key];
  const scale = opt?.displayScale || 1;
  // displayScale 있는 키는 ×scale 반올림 정수, 없는 키는 기존 fmtNum (소수 2자리)
  const displayVal = scale !== 1 ? Math.round((value || 0) * scale) : value;
  const unit = NO_PERCENT_KEYS.has(key) ? '' : '%';
  if (!displayVal || displayVal === 0) return `0${unit}`;
  const numStr = scale !== 1 ? String(displayVal) : fmtNum(displayVal);
  if (sign === '-') return `-${numStr}${unit}`;
  return `+${numStr}${unit}`;
}

/**
 * 옵션 7종 + 세트 효과 합산 행 데이터 (Day 10 v2 — 대표 결정 변경).
 *
 * Day 10 v2 (대표 결정 — STATS 위쪽 세트 영역 삭제):
 * - weight_bonus 행: 옵션 분 + 세트 무게 % 합산 표시
 * - 신규 8번째 행 '장비 발견 추가 확률': 세트 발동 시 % 표시, 미발동 시 0%
 *
 * combo_bonus 만 콤보 단계 보너스 동적 합산 (기존 그대로).
 *
 * @param {number} comboCount — 모달 열린 시점 콤보 카운트
 */
function buildStatRows(comboCount) {
  const inv = loadInventory();
  // Day 17 후속 v2 (대표 보고 — 도감 보너스 미반영 픽스):
  //   getCodexBonuses() 두 번째 인자 전달 → weight_bonus / combo_bonus 에 도감 분 자동 합산.
  const codexBonuses = getCodexBonuses();
  const active = getActiveOptions(inv, codexBonuses) || {};
  // ★ Day 38 (대표 결정) — 콤보 단계 보너스 5%, 30콤보 캡 (=150% 상한).
  //   콤보 카운트 자체는 무한 누적 가능하나 보너스 표시는 30에서 정지.
  //   장비 combo_bonus 는 이 캡과 별개 (active.combo_bonus 그대로 합산).
  const stageBonus = comboCount > 0
    ? Math.min(comboCount, COMBO_STAGE_CAP) * (COMBO_STAGE_PER_HIT * 100)  // 0.05 × 100 = 5%
    : 0;

  // Day 10 v2 — 세트 효과 캐싱 (모달 열린 시점 4부위 등급 기준)
  const setGrade           = getSetGrade(inv);
  const setWeightBonusPct  = getSetWeightBonus(setGrade);                 // 0/10/20/30/50
  const setDropRatePct     = setGrade ? (getSetDropRateBonus(setGrade) * 100) : 0;  // 0/3/5/10/15
  // ★ Day 41 (대표 결정) — 도감 cosmetic 카테고리 보상 변경 (장비 발견 → 까비까비 보너스).
  //   이전: 도감 dropRatePct 가 장비 발견 추가 확률에 합산됨.
  //   변경: 도감 kabikabiBonusPct 는 equipment-effects.getActiveOptions 가 active.kabikabi_bonus 에 자동 합산.
  //         장비 발견 추가 확률 = 세트 효과 + 레벨 누적만 (도감 분 제거).

  // Day 18 — 레벨 누적 보너스.
  //   ⚠️ fish/golden/rainbow/rock/orb/weight/combo 7종은 equipment-effects.getActiveOptions
  //      내부에서 자동 합산됨 (active 결과에 이미 포함). 여기선 set_drop_rate 만 별도 사용.
  const levelBonuses = getLevelBonuses();
  const levelDropPct = levelBonuses.set_drop_rate || 0;
  const totalDropPct = setDropRatePct + levelDropPct;   // ★ Day 41 — 도감 dropRatePct 제거

  /* ★ Day 38 후속 (대표 결정) — STATS 표시 순서 명시 배열 + 2개씩 grid 배치.
   *
   *  순서 (총 13개, 2 columns × 7 rows, 마지막 행은 우측 빈칸):
   *    1행: 검은물고기 입질 / 황금물고기 입질
   *    2행: 분홍물고기 입질 / 하얀물고기 입질
   *    3행: 물고기 kg 보너스 / 콤보 kg 보너스
   *    4행: 까비까비 보너스 / 럭키럭키 발동
   *    5행: 크리티컬 확률 / X 등장 확률
   *    6행: 물고기 속도 / 잡기시간 증가
   *    7행: 장비 발견 추가 확률 / (빈칸)
   *
   *  이전 (Day 25~37): Object.keys(OPTIONS) 순회 + sub tier(입질 4종 들여쓰기) — 폐기.
   *  현재 (Day 38)   : 명시적 STAT_ORDER 배열 + 모든 행 main tier 동일 처리 (sub 제거).
   */
  const STAT_ORDER = [
    'fish_rate',         // 검은물고기 입질
    'golden_rate',       // 황금물고기 입질
    'rainbow_rate',      // 분홍물고기 입질
    'twinkle_rate',      // 하얀물고기 입질
    'weight_bonus',      // 물고기 kg 보너스
    'combo_bonus',       // 콤보 kg 보너스
    'kabikabi_bonus',    // 까비까비 보너스
    'lucky_rate',        // 럭키럭키 발동
    'critical_rate',     // 크리티컬 확률
    'rock_rate',         // X 등장 확률
    'orb_speed',         // 물고기 속도
    'catch_time_bonus',  // 잡기시간 증가
    'set_drop_rate',     // 장비 발견 추가 확률 (가상 키 — 세트+도감+레벨)
  ];

  return STAT_ORDER.map(key => {
    // set_drop_rate 는 OPTIONS 에 없는 가상 키 → 별도 처리
    if (key === 'set_drop_rate') {
      return {
        key:       'set_drop_rate',
        name:      '장비 발견 추가 확률',
        valueText: formatBonus(totalDropPct, '+', 'set_drop_rate'),
        hasBonus:  totalDropPct > 0,
      };
    }

    const opt = OPTIONS[key];
    let value = active[key] || 0;

    // combo_bonus 만 콤보 단계 보너스 합산 (다른 옵션은 장비분만)
    if (key === 'combo_bonus' && stageBonus > 0) {
      value = Math.round((value + stageBonus) * 10) / 10;
    }
    // Day 10 v2 — weight_bonus 에 세트 무게 % 합산 (대표 결정 — STATS 행 안 합산)
    if (key === 'weight_bonus' && setWeightBonusPct > 0) {
      value = Math.round((value + setWeightBonusPct) * 10) / 10;
    }
    // ★ Day 32 (대표 결정) — critical_rate 에 기본 확률 3% 합산.
    //   장비 없어도 기본 3% 가 항상 적용되므로 STATS 에도 합산해서 표시 (시작 시 3% 보임).
    if (key === 'critical_rate') {
      value = Math.round((value + CRITICAL_BASE_RATE) * 10) / 10;
    }
    return {
      key,
      name:      opt.displayName,
      valueText: formatBonus(value, opt.sign, key),
      hasBonus:  value > 0,
    };
  });
}

/**
 * @param {object} [opts]
 * @param {() => number} [opts.getCurrentCombo] — 현재 콤보 카운트 getter (open 시점에 호출)
 * @param {() => void}   [opts.onClose]
 * @returns {{
 *   root: HTMLElement,
 *   open: () => void,
 *   close: () => void,
 *   dispose: () => void,
 *   isOpen: () => boolean,
 * }}
 */
export function createProfileModal(opts = {}) {
  const { getCurrentCombo, onClose } = opts;
  let isOpen = false;

  /* ── 루트 ── */
  const root = document.createElement('div');
  root.className = 'profile-root';
  root.setAttribute('aria-hidden', 'true');

  /* ── 오버레이 (dim, 클릭 시 닫힘) ── */
  const overlay = document.createElement('div');
  overlay.className = 'profile-overlay';

  /* ── 패널 ── */
  const panel = document.createElement('div');
  panel.className = 'profile-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '내 정보');
  // 패널 클릭이 오버레이로 전파돼서 닫히는 거 방지
  panel.addEventListener('click', e => e.stopPropagation());

  /* ── 헤더 ── */
  const header = document.createElement('header');
  header.className = 'profile-header';

  const title = document.createElement('h2');
  title.className = 'profile-title';
  title.textContent = '내 정보';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'profile-close';
  closeBtn.setAttribute('aria-label', '내 정보 닫기');
  closeBtn.appendChild(makeCloseIcon());
  closeBtn.addEventListener('click', close);

  header.appendChild(title);
  header.appendChild(closeBtn);

  /* ── 본문 (스크롤 영역) ── */
  const body = document.createElement('div');
  body.className = 'profile-body';

  /* 섹션 1 — 닉네임 */
  const nicknameSection = document.createElement('section');
  nicknameSection.className = 'profile-section profile-section--nickname';

  const nicknameLabel = document.createElement('div');
  nicknameLabel.className = 'profile-section__label';
  nicknameLabel.textContent = '닉네임';

  const nicknameValue = document.createElement('div');
  nicknameValue.className = 'profile-nickname';
  // Day 18 — 닉네임 + Lv 뱃지 (refresh() 에서 갱신)
  const nicknameText = document.createElement('span');
  nicknameText.className = 'profile-nickname__text';
  const nicknameLv = document.createElement('span');
  nicknameLv.className = 'profile-nickname__lv';
  nicknameValue.appendChild(nicknameText);
  nicknameValue.appendChild(nicknameLv);

  nicknameSection.appendChild(nicknameLabel);
  nicknameSection.appendChild(nicknameValue);

  /* 섹션 2 — STATS (Day 10 v2 — 옵션 7종 + 신규 1행 = 총 8행, 별도 세트 영역 X) */
  const statsSection = document.createElement('section');
  statsSection.className = 'profile-section profile-section--stats';

  const statsLabel = document.createElement('div');
  statsLabel.className = 'profile-section__label';
  statsLabel.textContent = 'STATS';

  const statsList = document.createElement('div');
  statsList.className = 'profile-stat-list';
  // refresh() 에서 행 8개 갱신 (옵션 7 + 장비 발견 추가 확률 1)

  statsSection.appendChild(statsLabel);
  statsSection.appendChild(statsList);

  /* 섹션 3 — 추후 추가 예정 placeholder */
  const futureSection = document.createElement('section');
  futureSection.className = 'profile-section profile-section--future';

  const futureLabel = document.createElement('div');
  futureLabel.className = 'profile-section__label profile-section__label--muted';
  futureLabel.textContent = '추후 추가 예정';

  const futureNote = document.createElement('div');
  futureNote.className = 'profile-future-note';
  futureNote.textContent = '랭킹 · 도감 진행도 · 물고기별 최고 무게';

  futureSection.appendChild(futureLabel);
  futureSection.appendChild(futureNote);

  /* 조립 */
  body.appendChild(nicknameSection);
  body.appendChild(statsSection);
  body.appendChild(futureSection);

  panel.appendChild(header);
  panel.appendChild(body);

  root.appendChild(overlay);
  root.appendChild(panel);

  /* 이벤트 — 오버레이 클릭 닫기 */
  overlay.addEventListener('click', close);

  /* ============================================
     동적 갱신 (open 직전 호출)
     ============================================ */
  function refresh() {
    // 닉네임 + Lv 뱃지 (Day 18)
    nicknameText.textContent = loadNickname();
    nicknameLv.textContent = `Lv. ${getCurrentLevel()}`;

    // 콤보 단계 (combo_bonus 행 동적 반영)
    const comboCount = (typeof getCurrentCombo === 'function')
      ? (getCurrentCombo() || 0)
      : 0;

    // Day 10 v2 — 옵션 8행 빌드 (세트 무게/발견 합산은 buildStatRows 내부에서 처리)
    const rows = buildStatRows(comboCount);
    statsList.innerHTML = '';

    // ★ Day 25 Phase 3 / ★ Day 38 후속 — 스탯 리스트 최상단에 "상상력" 행 (종합점수 강조).
    //   Day 38 변경: 종합점수 느낌 살리기 — grid 전체 폭 차지 + 큰 글씨 + 강조 박스.
    //   (CSS .profile-stat-row--imagination 에서 처리)
    const imaginationRow = document.createElement('div');
    imaginationRow.className = 'profile-stat-row profile-stat-row--main profile-stat-row--imagination';
    imaginationRow.dataset.key = 'imagination';
    const imgName = document.createElement('span');
    imgName.className = 'profile-stat-row__name';
    imgName.textContent = '상상력';
    const imgValue = document.createElement('span');
    imgValue.className = 'profile-stat-row__value profile-stat-row__value--has-bonus';
    imgValue.textContent = getCurrentImagination().toLocaleString();
    imaginationRow.appendChild(imgName);
    imaginationRow.appendChild(imgValue);
    statsList.appendChild(imaginationRow);

    // ★ Day 38 후속 (대표 결정) — 모든 행 main tier 동일 처리.
    //   이전 (Day 25): 입질 4종은 sub tier (들여쓰기 + 색 다름).
    //   변경 (Day 38): 입질 4종도 다른 옵션과 동일 main tier (분홍 라벨) — 2개씩 grid 배치 일관성.
    for (const r of rows) {
      const row = document.createElement('div');
      row.className = 'profile-stat-row profile-stat-row--main';
      row.dataset.key = r.key;

      const name = document.createElement('span');
      name.className = 'profile-stat-row__name';
      name.textContent = r.name;

      const value = document.createElement('span');
      value.className = 'profile-stat-row__value';
      value.textContent = r.valueText;
      // 보너스 있으면 강조 (CSS에서 색 분기)
      if (r.hasBonus) {
        value.classList.add('profile-stat-row__value--has-bonus');
      }

      row.appendChild(name);
      row.appendChild(value);
      statsList.appendChild(row);
    }
  }

  /* ============================================
     공개 API
     ============================================ */

  function open() {
    // navigate 등으로 root 가 강제 제거됐으면 isOpen 동기화 (재오픈 가능)
    if (isOpen && !root.parentNode) {
      isOpen = false;
    }
    if (isOpen) return;

    refresh();
    // #app 자식으로 추가 (bag-modal 패턴 — navigate 시 fadeSwap 함께 사라짐)
    const app = document.getElementById('app') || document.body;
    app.appendChild(root);
    requestAnimationFrame(() => {
      root.classList.add('profile-root--open');
      root.setAttribute('aria-hidden', 'false');
    });
    isOpen = true;
  }

  function close() {
    if (!isOpen) return;
    root.classList.remove('profile-root--open');
    root.setAttribute('aria-hidden', 'true');
    // CSS 트랜지션 끝난 후 DOM 제거 (320ms + 여유)
    setTimeout(() => {
      if (root.parentNode) root.parentNode.removeChild(root);
    }, 350);
    isOpen = false;
    if (typeof onClose === 'function') onClose();
  }

  function dispose() {
    if (root.parentNode) root.parentNode.removeChild(root);
    isOpen = false;
  }

  return { root, open, close, dispose, isOpen: () => isOpen };
}