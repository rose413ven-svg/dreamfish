/* ===========================================
   hud.js — 상단 헤더 (Day 18 갱신)
   ============================================
   docs/01_슬롯화면_디자인.md [상단 헤더] + [Lv 게이지] SSOT.

   Day 18 변경 (대표 결정):
   - KG GAUGE → Lv 게이지로 전환 (B안)
     · 라벨: "Lv. N" (크게)
     · 값  : "1,234 / 5,000 kg" (작게)
     · 게이지바: 다음 레벨까지 진행도 (다 차면 레벨업)
   - 데이터 출처: level-engine.getExpProgress()

   API:
   - setLevelProgress(progress?)  레벨 진행도 갱신 (인자 미지정 시 자동 조회)
   - animateExpGain(gainedKg)     무게 획득 연출 (+kg 떠오름 + 게이지 펄스 + 진행도 갱신)
   - setFishery(number, name)     낚시터 라벨 갱신
   - setMenuDot(on)               햄버거 빨간점 (도감 알림)

   하위 호환 stub (Phase 5 에서 호출부 정리 후 제거):
   - setKg(current, max)          → setLevelProgress() 로 위임
   - animateKgGain(g, n, opts)    → animateExpGain(g) 로 위임
   - showGainBurst(g)             → animateExpGain(g) 로 위임
   ============================================ */

import { createMenuButton } from './menu-button.js';
import { getExpProgress } from '../data/level-engine.js';
// ★ Day 25 Phase 3 — 상상력 시스템
import { getCurrentImagination } from '../data/imagination.js';
// ★ Day 38 — 상상력 변동 팝업 + 직전값 저장
import { loadPreviousImagination, savePreviousImagination } from '../core/storage.js';
import { showImaginationChangePopup } from './imagination-change-popup.js';

/**
 * @param {object} [opts]
 * @param {number} [opts.fisheryNumber=1]
 * @param {string} [opts.fisheryName='별빛 연못']
 * @param {() => void} [opts.onMenuClick]
 * @returns {{
 *   root: HTMLElement,
 *   dispose: () => void,
 *   setLevelProgress: (progress?: object) => void,
 *   animateExpGain: (gainedKg: number) => void,
 *   setFishery: (number: number, name: string) => void,
 *   setMenuDot: (on: boolean) => void,
 *   setKg: (current: number, max?: number) => void,           // 호환 stub
 *   animateKgGain: (g: number, n: number, o?: object) => void, // 호환 stub
 *   showGainBurst: (g: number) => void,                        // 호환 stub
 * }}
 */
export function createHud(opts = {}) {
  const {
    fisheryNumber = 1,
    fisheryName = '별빛 연못',
    onMenuClick,
  } = opts;

  const root = document.createElement('header');
  root.className = 'hud';

  /* ── 상단 줄: 낚시터 이름 + 메뉴 버튼 ── */
  const top = document.createElement('div');
  top.className = 'hud__top';

  const title = document.createElement('div');
  title.className = 'hud__title';

  const titleUpper = document.createElement('div');
  titleUpper.className = 'hud__title-upper';
  titleUpper.textContent = `FISHERY ${fisheryNumber}`;

  const titleName = document.createElement('div');
  titleName.className = 'hud__title-name';
  titleName.textContent = fisheryName;

  title.appendChild(titleUpper);
  title.appendChild(titleName);

  const menu = createMenuButton({ onClick: onMenuClick });

  top.appendChild(title);
  top.appendChild(menu.root);

  /* ── Lv 게이지 (Day 18 — KG GAUGE 자리) ── */
  const gauge = document.createElement('div');
  gauge.className = 'hud__gauge';

  const gaugeRow = document.createElement('div');
  gaugeRow.className = 'hud__gauge-row';

  // ★ Day 25 Phase 3 — 좌측 그룹: Lv. N + 상상력 박스 (서로 옆에 붙임)
  const leftGroup = document.createElement('div');
  leftGroup.className = 'hud__gauge-left-group';

  // 라벨 = "Lv. N" (크게)
  const gaugeLabel = document.createElement('span');
  gaugeLabel.className = 'hud__gauge-label';

  // ★ Day 25 Phase 3 — 상상력 박스 (Lv. N 옆, Lv.와 같은 높이 작은 박스, 황금색 숫자)
  //   refreshImagination() 으로 갱신 (강화/렙업/장비장착/합성 시 즉시).
  const imaginationBox = document.createElement('span');
  imaginationBox.className = 'hud__imagination';
  imaginationBox.setAttribute('aria-label', '상상력');
  // 초기값은 setLevelProgress 호출 시점에 refreshImagination 자동 호출됨

  leftGroup.appendChild(gaugeLabel);
  leftGroup.appendChild(imaginationBox);

  // 값 = "1,234 / 5,000 kg" (작게, 우측)
  const gaugeValue = document.createElement('span');
  gaugeValue.className = 'hud__gauge-value';

  gaugeRow.appendChild(leftGroup);
  gaugeRow.appendChild(gaugeValue);

  const gaugeBar = document.createElement('div');
  gaugeBar.className = 'hud__gauge-bar';

  const gaugeFill = document.createElement('div');
  gaugeFill.className = 'hud__gauge-fill';
  gaugeBar.appendChild(gaugeFill);

  gauge.appendChild(gaugeRow);
  gauge.appendChild(gaugeBar);

  root.appendChild(top);
  root.appendChild(gauge);

  /* ============================================
     포맷 / 갱신
     ============================================ */

  /** kg 수치 포맷 — 천 단위는 콤마, 소수는 trailing 0 제거.
   *  ★ Day 22 Phase 7 후속 (대표 결정): 소수점 2자리 표시 (기존 3자리 → 2자리). */
  function fmtKg(v) {
    const n = Number(v) || 0;
    if (n >= 1000) return Math.round(n).toLocaleString();
    return String(Number(n.toFixed(2)));
  }

  /**
   * 레벨 진행도 갱신.
   * @param {object} [progress] - level-engine.getExpProgress() 결과 (미지정 시 자동 조회)
   */
  function setLevelProgress(progress) {
    const p = progress || getExpProgress();
    // Day 18 후속 (대표 결정) — "Lv. N" 의 숫자만 더 크게 (CSS .hud__gauge-label-num 에서 폰트 크기 분기)
    gaugeLabel.innerHTML = `Lv. <span class="hud__gauge-label-num">${p.level}</span>`;
    if (p.isMax) {
      gaugeValue.textContent = 'MAX';
      gaugeFill.style.width = '100%';
    } else {
      gaugeValue.textContent = `${fmtKg(p.expIntoLevel)} / ${fmtKg(p.expForNext)} kg`;
      gaugeFill.style.width = `${p.percent}%`;
    }
  }

  /**
   * 무게 획득 연출 — ★ Day 26 (대표 결정) 변경:
   *   - 기존 게이지 위 +N kg 떠오름 텍스트 폐기 (이제 슬롯 그리드 가운데 큰 버스트로 표시).
   *   - 게이지 펄스 + 진행도 갱신은 유지 (게이지 차오름 시각).
   *   - 슬롯 가운데 큰 버스트는 slot.js 에서 showCenterGainBurst(grid.root, gained) 호출.
   * @param {number} _gainedKg — 인자는 호환성 위해 유지 (Day 26 부터 표시 안 함)
   */
  function animateExpGain(_gainedKg) {
    // 1) 게이지 바 펄스
    gaugeBar.classList.remove('hud__gauge-bar--gain-flash');
    void gaugeBar.offsetWidth;  // 애니메이션 재시작
    gaugeBar.classList.add('hud__gauge-bar--gain-flash');
    setTimeout(() => gaugeBar.classList.remove('hud__gauge-bar--gain-flash'), 1100);

    // 2) 진행도 갱신 (width transition CSS 1000ms)
    setLevelProgress();
  }

  /** 낚시터 라벨 갱신 */
  function setFishery(number, name) {
    titleUpper.textContent = `FISHERY ${number}`;
    titleName.textContent = name;
  }

  /* ============================================
     하위 호환 stub (Phase 5 에서 호출부 정리 후 제거)
     ============================================ */
  function setKg(_current, _max) {
    setLevelProgress();
  }
  function animateKgGain(gainedKg, _newCurrent, _options) {
    animateExpGain(gainedKg);
  }
  function showGainBurst(gainedKg) {
    animateExpGain(gainedKg);
  }

  /**
   * ★ Day 25 Phase 3 / ★ Day 38 확장 (대표 결정) — 상상력 박스 갱신 + 변동 팝업.
   *
   * 호출 시점: 강화/렙업/장비장착/합성/도감 등록 등 스탯 변동 후 즉시.
   * (내정보 모달은 열릴 때마다 새로 계산 → 별도 트리거 불필요)
   *
   * Day 38 추가 + ★ Day 38 후속 (버그 수정):
   * - 직전값 (storage) 과 비교해 diff !== 0 이면 상상력 변동 팝업 표시.
   * - 첫 변동 (저장값 없음) 은 팝업 X, 값만 저장 → 두 번째 변동부터 표시 (대표 결정).
   * - 호출자가 팝업 억제하고 싶을 때 { suppressPopup: true } 옵션 전달
   *   (예: 레벨업 케이스 — slot.js 가 레벨업 팝업 닫힘 후 직접 표시 처리).
   *
   * ★ Day 38 후속 버그 수정 (대표 보고):
   * 시나리오: 가방 → 장비 클릭 → 강화 화면 → 강화 → 가방 복귀(자동) → 가방 닫기 → 슬롯 복귀
   *         → 변동 팝업이 안 뜸.
   * 원인: 강화 완료 시 slot 재mount → createHud → 초기 자동 호출에서 storage 가 갱신되어
   *       다음 명시적 트리거(가방 닫기) 시 diff=0 발생.
   * 해결: { suppressStorageUpdate: true } 신설 — storage 갱신도 안 함.
   *       slot 초기 mount 자동 호출은 박스 텍스트만 갱신하고 previous 그대로 유지 →
   *       다음 명시 트리거에서 정확히 diff 계산.
   *
   * @param {object} [opts]
   * @param {boolean} [opts.suppressPopup=false]         - true 면 팝업 표시 안 함 (값만 갱신 + 저장)
   * @param {boolean} [opts.suppressStorageUpdate=false] - true 면 storage previousImagination 도 갱신 안 함
   * @returns {{ current: number, previous: number | null, diff: number }} 갱신 결과
   */
  function refreshImagination(opts = {}) {
    const { suppressPopup = false, suppressStorageUpdate = false } = opts;
    const current = getCurrentImagination();

    // 박스 텍스트 갱신 (항상 — 표시값 동기화)
    imaginationBox.textContent = current.toLocaleString();
    imaginationBox.dataset.value = String(current);

    // ★ Day 38 — 직전값과 비교
    const previous = loadPreviousImagination();  // null = 첫 변동
    const diff = previous === null ? 0 : (current - previous);

    // 팝업 표시 조건:
    //   - previous !== null  (첫 변동 무시)
    //   - diff !== 0         (변동 없으면 표시 X)
    //   - suppressPopup X    (호출자 억제 요청)
    if (previous !== null && diff !== 0 && !suppressPopup) {
      showImaginationChangePopup(current, diff);
    }

    // ★ Day 38 후속 — storage 갱신은 suppressStorageUpdate 가 false 일 때만.
    //   slot 초기 mount 의 자동 호출은 true → previous 보존 → 다음 명시 트리거에서 diff 계산.
    if (!suppressStorageUpdate) {
      savePreviousImagination(current);
    }

    return { current, previous, diff };
  }

  /* 초기 진행도 + 상상력 반영
   * ★ Day 38 후속 (버그 수정) — 초기 mount 자동 호출은 팝업 + storage 둘 다 억제.
   *    storage 가 미리 갱신되면 강화 후 slot 재mount 시 diff=0 되어 다음 명시 트리거에서 팝업 누락.
   *    → 박스 텍스트만 갱신하고 previous 보존 → 가방 닫기 시 정확히 비교됨. */
  setLevelProgress();
  refreshImagination({ suppressPopup: true, suppressStorageUpdate: true });

  return {
    root,
    dispose: () => menu.dispose(),
    /* 신규 API (Day 18) */
    setLevelProgress,
    animateExpGain,
    /* ★ Day 25 Phase 3 — 상상력 박스 갱신 */
    refreshImagination,
    /* 공통 */
    setFishery,
    setMenuDot: (on) => menu.setDot(on),
    /* 하위 호환 stub */
    setKg,
    animateKgGain,
    showGainBurst,
  };
}