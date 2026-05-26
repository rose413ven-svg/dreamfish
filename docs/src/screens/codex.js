/* ===========================================
   codex.js — 도감 화면 (Day 16 — Phase D)
   ============================================
   결정로그 Day 16 SSOT.

   화면 구성:
     1. 헤더: 타이틀 "도감" + X 닫기 버튼
     2. 진척도: "23 / 60" 형태 (현재 탭 기준 동적 갱신)
     3. 탭 바: 물고기 / 장비
     4. 리스트:
        - 물고기 탭: 60종 셀 (등급별 헤더 + 캡처본 NEW 표시)
        - 장비 탭 (Phase D 신규): 136개 셀 (정렬 그룹 + 등록 버튼)
     5. 수족관 영역: 등록 물고기 fish orb 부유

   진입 파라미터:
     - tab     : 'fish' | 'equipment'  (기본 'fish')
     - itemId  : 컨텍스트 메뉴 진입 시 — 장비 탭 진입 시 해당 아이템의 등록 가능 셀 상단 스크롤

   컨텍스트 메뉴 진입 흐름 (대표 결정 A2):
     - itemId 전달되면 강제로 tab='equipment' 활성화
     - 해당 아이템의 codexKey 들 중 미등록 셀 상단으로 스크롤
   ============================================ */

import { Screen, navigate } from '../core/router.js';
import {
  getFishCodexProgress,
  getEquipmentCodexProgress,
  getNewlyRegisteredFishNames,
  markAllFishNewSeen,
  // ★ Day 39 — 새 최고기록 NEW + 부분 clear (서브 탭 진입 시 그 탭만)
  getNewlyRegisteredBestFishNames,
  markAllFishNewBestSeen,
  markFishNewSeenByList,
  markFishNewBestSeenByList,
  hasUnregisteredEquipmentInBag,
  getRegisteredFishNames,
  getFishBestWeight,
  buildSortedEquipmentList,
  registerEquipmentEntry,
  getRegisterableKeysOfItem,
  getCodexBonuses,
} from '../data/codex-engine.js';
import {
  groupEntriesByGrade,
  groupEntriesByGradeAndTier,
  TIER_DISPLAY_ORDER,
  TIER_LABEL,
  FISH_CODEX_TABS,
  getFishEntryByName,   // ★ Day 39 — 부분 clear 시 이름 → grade 조회
} from '../data/codex-fish-catalog.js';
import { MAX_REWARDS } from '../data/codex-rewards.js';
import { createFishCodexCell }       from '../ui/codex-fish-cell.js';
import { createEquipmentCodexCell }  from '../ui/codex-equipment-cell.js';
import { createCodexAquarium }       from '../ui/codex-aquarium.js';
// Day 17 후속 (대표 결정): 등록 확인 팝업
import { openCodexRegisterConfirm }  from '../ui/codex-register-confirm.js';
import { loadInventory, saveInventory } from '../core/storage.js';
import { findEquipmentById as findEqById } from '../data/inventory.js';
// Day 17 후속 — 보상 토스트 표시용 보상 산출 (codexKey 단위 1개)
import { computeRewardForEntry } from '../data/codex-rewards.js';
import { getEquipmentEntryByKey } from '../data/codex-equipment-catalog.js';
// ★ Day 41 (대표 결정) — 도감 닫힐 때 누적 상상력 변동 팝업 표시 (도감 안에서 보상 토스트와 겹치지 않도록).
//   v2 (Day 41 후속) — storage 의존 제거. state.imaginationBefore (mount 시 캡처) 로 정확한 diff.
import { showImaginationChangePopup } from '../ui/imagination-change-popup.js';
import { getCurrentImagination } from '../data/imagination.js';
import { savePreviousImagination } from '../core/storage.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** 등급 순서 (UI 그룹 헤더 순서) / ★ Day 22 — '숨겨진보스' 추가 / ★ Day 27 — '황금어' 추가 (10등급) */
const GRADE_ORDER = Object.freeze([
  '치어', '소형', '중형', '월척', '대물', '보스', '전설보스', '신화보스', '숨겨진보스', '황금어',
]);

/** ★ Day 38 후속F (대표 결정) — 도감 표시용 등급 한글 → 영문 매핑.
 *  일반 등급(치어~신화보스) 만 영문 표시, 황금어는 한글 그대로 유지.
 *  ★ Day 38 후속G (대표 결정) — '숨겨진보스' → 'Hidden Boss' 영문 변경 / '특수' 탭은 한글 그대로.
 *  ★ Day 40 (대표 결정) — '황금어' → 'GOLDEN FISH', 'Hidden Boss' → 'HIDDEN BOSS' (대문자 통일).
 *  데이터는 한글 그대로, 표시 시점에만 이 매핑 사용 (데이터-엔진 분리). */
const GRADE_DISPLAY = Object.freeze({
  '치어':       'TINY',
  '소형':       'SMALL',
  '중형':       'MEDIUM',
  '월척':       'BIG',
  '대물':       'HUGE',
  '보스':       'BOSS',
  '전설보스':   'LEGEND',
  '신화보스':   'MYTHIC',
  '숨겨진보스': 'HIDDEN BOSS',  // ★ Day 40 — 'Hidden Boss' → 'HIDDEN BOSS' 대문자 통일
  '황금어':     'GOLDEN FISH',  // ★ Day 40 — 한글 '황금어' → 영문 'GOLDEN FISH'
});

/** ★ Day 38 후속G (대표 결정) — 도감 서브 탭 label 표시 매핑 (id 기준).
 *  '특수' 탭만 한글 유지, 나머지 8개 등급 탭은 영문 표시. */
const SUB_TAB_DISPLAY = Object.freeze({
  tiny:    'TINY',
  sml:     'SMALL',
  med:     'MEDIUM',
  big:     'BIG',
  huge:    'HUGE',
  boss:    'BOSS',
  legend:  'LEGEND',
  mythic:  'MYTHIC',
  special: '특수',     // 한글 유지 — 안에 'Hidden Boss' + '황금어' 그룹 헤더 표시
});

/** 도감 표시용 등급 이름 헬퍼 — 매핑 없으면 원본 그대로 반환. */
function getGradeDisplayName(koreanGrade) {
  return GRADE_DISPLAY[koreanGrade] || koreanGrade;
}

/** ★ Day 38 후속G — 도감 서브 탭 표시 label (id 기준). 매핑 없으면 원본 label 반환. */
function getSubTabDisplayLabel(tabDef) {
  return SUB_TAB_DISPLAY[tabDef.id] || tabDef.label;
}

/** X 아이콘 SVG */
function makeCloseIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', 'M6 6 L18 18 M18 6 L6 18');
  svg.appendChild(p);
  return svg;
}

function makeRedDot() {
  const d = document.createElement('span');
  d.className = 'codex-dot';
  return d;
}

/* ★ Day 39 — 이름으로 해당 물고기의 grade 한글 키 조회 (서브 탭 부분 clear 매칭용). */
function getFishEntryGrade(name) {
  const entry = getFishEntryByName(name);
  return entry ? entry.grade : null;
}

/* ★ Day 39 (대표 결정 수정) — "탭 떠날 때 clear" 패턴 헬퍼.
   특정 서브 탭에 속한 grades 의 NEW + NEW BEST 를 state 와 storage 양쪽에서 부분 clear.
   - mount 안의 activateFishSubTab (이전 탭 전환 시점) 에서 호출.
   - default export 의 unmount (도감 닫는 시점) 에서도 모듈 스코프이므로 호출 가능.
   @param {string} tabId         FISH_CODEX_TABS 의 id (tiny/small/.../mythic/special)
   @param {object} stateRef      mount 의 state 객체 (newFishNames, newBestFishNames 보유)
   @returns {string[]}           clear 된 이름 목록 (선택적 활용용)
*/
function clearTabNewSeen(tabId, stateRef) {
  if (!tabId || !stateRef) return [];
  const tabDef = FISH_CODEX_TABS.find(t => t.id === tabId);
  if (!tabDef || !Array.isArray(tabDef.grades)) return [];
  const gradesSet = new Set(tabDef.grades);
  const allNames = new Set([...stateRef.newFishNames, ...stateRef.newBestFishNames]);
  const namesToClear = [];
  for (const name of allNames) {
    const grade = getFishEntryGrade(name);
    if (grade && gradesSet.has(grade)) {
      namesToClear.push(name);
    }
  }
  if (namesToClear.length > 0) {
    // storage 부분 clear (양쪽 시스템)
    markFishNewSeenByList(namesToClear);
    markFishNewBestSeenByList(namesToClear);
    // state 에서도 제거
    for (const n of namesToClear) {
      stateRef.newFishNames.delete(n);
      stateRef.newBestFishNames.delete(n);
    }
  }
  return namesToClear;
}

let state = null;

export default {
  /**
   * @param {HTMLElement} el
   * @param {{ tab?: 'fish'|'equipment', itemId?: string }} [params]
   */
  mount(el, params = {}) {
    // ── 진입 시점 NEW 캡처 ──
    // ★ Day 39 (대표 결정 I+K) — mount 시 storage 일괄 clear 제거.
    //   대신: state 에 newFishNames + newBestFishNames 캡처만. 실제 clear 는 사용자가
    //   특정 9개 서브 탭에 진입했을 때 그 탭에 속한 grades 만 부분 clear.
    //   mount 시 활성 탭(첫 화면 탭)은 자동으로 진입한 것으로 간주 → 그 탭 NEW 즉시 clear (K 옵션).
    const newFishNamesCapture     = new Set(getNewlyRegisteredFishNames());
    const newBestFishNamesCapture = new Set(getNewlyRegisteredBestFishNames());

    // ── 컨텍스트 메뉴 진입: itemId 있으면 장비 탭 강제 활성화 + 스크롤 타겟 결정 ──
    let initialTab = params.tab === 'equipment' ? 'equipment' : 'fish';
    let focusCodexKey = null;
    if (params.itemId) {
      initialTab = 'equipment';
      const inv = loadInventory();
      const item = inv ? findEqById(inv, params.itemId) : null;
      if (item) {
        const regKeys = getRegisterableKeysOfItem(item);
        // 가장 단순한 후보 = base codexKey (등록 가능한 것 중 첫 번째)
        focusCodexKey = regKeys[0] || null;
      }
    }

    state = {
      activeTab:        initialTab,
      activeFishSubTab: 'tiny',   // ★ Day 27 — 9개 서브 탭 (FISH_CODEX_TABS 의 id) 기본 'tiny'
      focusItemId:      params.itemId || null,
      focusCodexKey,
      newFishNames:     newFishNamesCapture,
      newBestFishNames: newBestFishNamesCapture,   // ★ Day 39 — 새 최고기록 캡처
      // ★ Day 41 후속 (대표 보고 — storage 의존 시 팝업 누락) — 진입 시점 imagination 캡처.
      //   storage.previousImagination 은 가방/메뉴 흐름에 따라 갱신 시점이 달라서 정확도 보장 X.
      //   mount 시점 값을 직접 저장 → unmount 시 정확한 diff 계산.
      imaginationBefore: (() => {
        try { return getCurrentImagination(); } catch (e) { return 0; }
      })(),
    };

    /* ── 루트 ── */
    const root = document.createElement('section');
    root.className = 'codex-screen';

    /* ── 1. 헤더 ── */
    const header = document.createElement('div');
    header.className = 'codex-screen__header';

    const title = document.createElement('h1');
    title.className = 'codex-screen__title';
    title.textContent = '도감';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'codex-close-btn';
    closeBtn.setAttribute('aria-label', '닫기');
    closeBtn.appendChild(makeCloseIcon());
    closeBtn.addEventListener('click', () => {
      navigate(Screen.SLOT);
    });
    header.appendChild(closeBtn);

    root.appendChild(header);

    /* ── 2. 진척도 ── */
    const progress = document.createElement('div');
    progress.className = 'codex-progress';
    root.appendChild(progress);

    /* ── 3. 탭 바 (물고기 / 장비) ── */
    const tabs = document.createElement('div');
    tabs.className = 'codex-tabs';

    const fishTab = document.createElement('button');
    fishTab.type = 'button';
    fishTab.className = 'codex-tab';
    fishTab.dataset.tab = 'fish';
    fishTab.textContent = '물고기';

    const equipTab = document.createElement('button');
    equipTab.type = 'button';
    equipTab.className = 'codex-tab';
    equipTab.dataset.tab = 'equipment';
    equipTab.textContent = '장비';

    tabs.appendChild(fishTab);
    tabs.appendChild(equipTab);
    root.appendChild(tabs);

    /* ── ★ Day 27 — 3-2. 물고기 서브 탭 바 (9개 등급 탭) ── */
    const fishSubTabs = document.createElement('div');
    fishSubTabs.className = 'codex-sub-tabs';
    const subTabButtons = {};  // id → button (활성 토글용)
    for (const tabDef of FISH_CODEX_TABS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'codex-sub-tab';
      btn.dataset.subTab = tabDef.id;
      // ★ Day 38 후속G — 서브 탭 영문 표시 (특수 탭만 한글 유지)
      btn.textContent = getSubTabDisplayLabel(tabDef);
      btn.addEventListener('click', () => {
        activateFishSubTab(tabDef.id);
      });
      fishSubTabs.appendChild(btn);
      subTabButtons[tabDef.id] = btn;
    }
    root.appendChild(fishSubTabs);

    /* ── 4. 리스트 ── */
    const list = document.createElement('div');
    list.className = 'codex-list';
    root.appendChild(list);

    /* ── 5. 수족관 ── */
    const aquarium = createCodexAquarium();
    root.appendChild(aquarium.root);

    el.appendChild(root);

    /* ============================================
       탭 활성화 (메인 탭 — 물고기/장비)
       ============================================ */
    function activateTab(tab) {
      state.activeTab = tab;

      fishTab.classList.toggle('codex-tab--active',  tab === 'fish');
      equipTab.classList.toggle('codex-tab--active', tab === 'equipment');

      // ★ Day 27 — 물고기 탭일 때만 서브 탭 바 표시
      fishSubTabs.classList.toggle('codex-sub-tabs--visible', tab === 'fish');

      renderProgress();
      renderTabDots();
      renderList();

      // 장비 탭 + focusCodexKey 가 있으면 해당 셀 위치로 스크롤 (다음 frame)
      if (tab === 'equipment' && state.focusCodexKey) {
        requestAnimationFrame(() => {
          const target = list.querySelector(`[data-codex-key="${state.focusCodexKey}"]`);
          if (target) {
            target.scrollIntoView({ block: 'start', behavior: 'auto' });
            // 한 번 사용 후 클리어 (탭 전환 후 재진입에 영향 X)
            state.focusCodexKey = null;
          }
        });
      }
    }

    /* ============================================
       ★ Day 27 — 서브 탭 활성화 (9개 등급 탭)
       ★ Day 39 (대표 결정 수정) — "탭 떠날 때 clear" 패턴.
         사용자가 빨간점 보고 진입했을 때 NEW 배지가 사라지면 어떤 게 새로운지 알 수 없는 문제 → 변경.
         - 같은 탭 클릭: skip (NEW 유지, 사용자가 계속 보는 중)
         - 다른 탭으로 전환: *이전* 탭의 NEW + NEW BEST 부분 clear → 새 탭에서는 NEW 표시 유지
         - 도감 닫기 (unmount): 현재 활성 탭의 NEW + NEW BEST 부분 clear (default.unmount 에서)
       ============================================ */
    function activateFishSubTab(subTabId) {
      // 같은 탭 — NEW 유지 (사용자가 보고 있는 중)
      if (state.activeFishSubTab === subTabId) return;

      // ── 이전 탭의 NEW + NEW BEST 부분 clear (탭 떠나는 시점) ──
      clearTabNewSeen(state.activeFishSubTab, state);

      // 새 탭으로 전환
      state.activeFishSubTab = subTabId;

      // 버튼 활성 토글
      for (const id of Object.keys(subTabButtons)) {
        subTabButtons[id].classList.toggle('codex-sub-tab--active', id === subTabId);
      }
      renderList();
      renderSubTabDots();  // 이전 탭 빨간점 사라짐, 새 탭은 NEW 유지
      renderTabDots();     // 상위 탭 빨간점 갱신 (서브 탭 전체 NEW 합집합 기반)
    }

    function renderProgress() {
      progress.innerHTML = '';
      const prog = state.activeTab === 'fish'
        ? getFishCodexProgress()
        : getEquipmentCodexProgress();

      const labelText = document.createTextNode(
        state.activeTab === 'fish' ? '물고기  ' : '장비  '
      );
      const cur = document.createElement('span');
      cur.className = 'codex-progress__current';
      cur.textContent = String(prog.current);

      const sep = document.createElement('span');
      sep.className = 'codex-progress__sep';
      sep.textContent = '/';

      progress.appendChild(labelText);
      progress.appendChild(cur);
      progress.appendChild(sep);
      progress.appendChild(document.createTextNode(String(prog.total)));
    }

    function renderTabDots() {
      // ★ Day 39 (대표 결정 수정) — 매번 remove + append 하면 codex-dot-pop animation 재실행되어
      //   탭 클릭마다 빨간점이 깜빡임. DOM diff 패턴으로 변경: 차이 있을 때만 조작.

      // 물고기 탭 — newFishNames + newBestFishNames 합집합
      const fishShouldShow = state.newFishNames.size > 0 || state.newBestFishNames.size > 0;
      const fishExisting = fishTab.querySelector('.codex-dot');
      if (fishShouldShow && !fishExisting) {
        fishTab.appendChild(makeRedDot());
      } else if (!fishShouldShow && fishExisting) {
        fishExisting.remove();
      }
      // 변경 없으면 그대로 유지 (깜빡 X)

      // 장비 탭 — 가방 매칭
      const inv = loadInventory();
      const bagItems = inv?.items || [];
      const equipShouldShow = hasUnregisteredEquipmentInBag(bagItems);
      const equipExisting = equipTab.querySelector('.codex-dot');
      if (equipShouldShow && !equipExisting) {
        equipTab.appendChild(makeRedDot());
      } else if (!equipShouldShow && equipExisting) {
        equipExisting.remove();
      }
    }

    /* ★ Day 39 — 9개 서브 탭 빨간점 렌더 (해당 탭의 grades 안에 NEW 또는 NEW BEST 있을 때).
       ★ Day 39 (대표 결정 수정) — DOM diff 패턴: 매번 remove + append 하면 codex-dot-pop
         animation 재실행되어 탭 클릭마다 빨간점 깜빡. 차이 있을 때만 DOM 조작. */
    function renderSubTabDots() {
      for (const tabDef of FISH_CODEX_TABS) {
        const btn = subTabButtons[tabDef.id];
        if (!btn) continue;

        // 이 탭에 NEW 또는 NEW BEST 매칭 이름 있나? (한 개만 찾아도 됨)
        let shouldShow = false;
        if (Array.isArray(tabDef.grades) && tabDef.grades.length > 0) {
          const gradesSet = new Set(tabDef.grades);
          for (const name of state.newFishNames) {
            const g = getFishEntryGrade(name);
            if (g && gradesSet.has(g)) { shouldShow = true; break; }
          }
          if (!shouldShow) {
            for (const name of state.newBestFishNames) {
              const g = getFishEntryGrade(name);
              if (g && gradesSet.has(g)) { shouldShow = true; break; }
            }
          }
        }

        const existing = btn.querySelector('.codex-dot');
        if (shouldShow && !existing) {
          btn.appendChild(makeRedDot());
        } else if (!shouldShow && existing) {
          existing.remove();
        }
        // 변경 없으면 그대로 유지 (깜빡 X)
      }
    }

    function renderList() {
      list.innerHTML = '';
      // Day 16 후속: 활성 탭별 CSS 분기 (물고기 탭 = 2열 그리드)
      list.dataset.activeTab = state.activeTab;
      if (state.activeTab === 'fish') {
        renderFishList();
      } else {
        renderEquipmentList();
      }
    }

    /* ============================================
       물고기 도감 리스트 — ★ Day 27 (9개 서브 탭 + 변종 그룹)
       활성 서브 탭의 등급만 렌더링:
         - 일반 등급 (치어~전설): 변종 6 그룹 (기본 ~ +++++) × 4셀
         - 신화: 단일 그리드 4셀 (변종 없음)
         - 특수: 히든 1 + 황금어 1 (등급 헤더로 구분)
       ============================================ */
    function renderFishList() {
      const groupedByTier = groupEntriesByGradeAndTier();  // { '치어': { base: [4], p1: [4], ... }, ... }
      const groupedByGrade = groupEntriesByGrade();        // { '치어': [24], ... } — 등급별 전체 헤더 카운트용
      const registered = getRegisteredFishNames();

      // 활성 서브 탭의 정의 찾기
      const tabDef = FISH_CODEX_TABS.find(t => t.id === state.activeFishSubTab) || FISH_CODEX_TABS[0];

      // 탭에 포함된 등급들 순회 (대부분 1개, '특수' 탭은 2개)
      for (const grade of tabDef.grades) {
        const entries = groupedByGrade[grade] || [];
        if (entries.length === 0) continue;

        // 등급 헤더 (등급명 + N/Total)
        const hdr = document.createElement('div');
        hdr.className = 'codex-grade-header';
        hdr.dataset.grade = grade;

        const hName = document.createElement('span');
        hName.className = 'codex-grade-header__name';
        // ★ Day 38 후속F — 도감 등급명 영문 표시 (특수 등급은 한글 유지)
        hName.textContent = getGradeDisplayName(grade);
        const hCount = document.createElement('span');
        hCount.className = 'codex-grade-header__count';
        const regCountInGroup = entries.filter(e => registered.has(e.name)).length;
        hCount.textContent = `${regCountInGroup} / ${entries.length}`;
        const hBar = document.createElement('div');
        hBar.className = 'codex-grade-header__bar';

        hdr.appendChild(hName);
        hdr.appendChild(hCount);
        hdr.appendChild(hBar);
        list.appendChild(hdr);

        // 변종별 그룹 렌더
        const tierMap = groupedByTier[grade] || {};

        // 일반 등급 (치어~전설): TIER_DISPLAY_ORDER (base~p5) 순서대로 변종 헤더 + 4셀
        const hasTiers = TIER_DISPLAY_ORDER.some(t => tierMap[t]);
        if (hasTiers) {
          for (const tier of TIER_DISPLAY_ORDER) {
            const tierEntries = tierMap[tier];
            if (!tierEntries || tierEntries.length === 0) continue;
            // 변종 헤더 (기본 / + / ++ / ...)
            const tierHdr = document.createElement('div');
            tierHdr.className = 'codex-tier-header';
            tierHdr.dataset.tier = tier;
            tierHdr.textContent = TIER_LABEL[tier] || tier;
            list.appendChild(tierHdr);

            for (const entry of tierEntries) {
              const isReg = registered.has(entry.name);
              const cell = createFishCodexCell({
                entry,
                registered: isReg,
                bestWeightKg: isReg ? getFishBestWeight(entry.name) : 0,
                isNew: isReg && state.newFishNames.has(entry.name),
                isNewBest: isReg && state.newBestFishNames.has(entry.name),   // ★ Day 39 — 새 최고기록 배지
              });
              list.appendChild(cell.root);
            }
          }
        } else {
          // 변종 없는 등급 (신화/히든/황금어): _ 키로 통합 → 단일 그리드
          const flatEntries = tierMap['_'] || [];
          for (const entry of flatEntries) {
            const isReg = registered.has(entry.name);
            const cell = createFishCodexCell({
              entry,
              registered: isReg,
              bestWeightKg: isReg ? getFishBestWeight(entry.name) : 0,
              isNew: isReg && state.newFishNames.has(entry.name),
              isNewBest: isReg && state.newBestFishNames.has(entry.name),   // ★ Day 39 — 새 최고기록 배지
            });
            list.appendChild(cell.root);
          }
        }
      }
    }

    /* ============================================
       장비 도감 리스트 (Phase D 신규)
       ============================================ */
    function renderEquipmentList() {
      // 보상 합계 헤더 (현재 누적 / 최대)
      const summary = buildRewardSummary();
      list.appendChild(summary);

      // 정렬된 entry 리스트
      const inv = loadInventory();
      const bagItems = inv?.items || [];
      const sortedList = buildSortedEquipmentList(bagItems);

      // 셀 빌드 (그룹 헤더 없이 한 줄 셀들 — 정렬에 그룹 우선순위 포함됨)
      // 단 그룹 사이 시각 구분을 위해 group 변할 때 헤더 한 줄 끼움
      let lastGroup = null;
      for (const item of sortedList) {
        if (item.group !== lastGroup) {
          // 그룹 헤더 (한 줄)
          const hdr = document.createElement('div');
          hdr.className = 'codex-grade-header';
          hdr.dataset.group = item.group;
          const hName = document.createElement('span');
          hName.className = 'codex-grade-header__name';
          hName.textContent = groupLabel(item.group);
          const hBar = document.createElement('div');
          hBar.className = 'codex-grade-header__bar';
          hdr.appendChild(hName);
          hdr.appendChild(hBar);
          list.appendChild(hdr);
          lastGroup = item.group;
        }

        const cellApi = createEquipmentCodexCell({
          entry:         item.entry,
          group:         item.group,
          registered:    item.registered,
          registerable:  item.registerable,
          reward:        item.reward,
          onRegister:    handleRegister,
        });
        list.appendChild(cellApi.root);
      }
    }

    function groupLabel(group) {
      if (group === 'registerable') return '등록 가능';
      if (group === 'locked')       return '미보유';
      if (group === 'done')         return '등록 완료';
      return '';
    }

    function buildRewardSummary() {
      const wrap = document.createElement('div');
      wrap.className = 'codex-reward-summary';

      const bonuses = getCodexBonuses();
      // ★ Day 41 (대표 결정) — cosmetic 카테고리 보상 변경: 장비 발견확률 → 까비까비 보너스
      const items = [
        { label: '물고기kg보너스',  value: bonuses.fishWeightPct,    max: MAX_REWARDS.fishWeightPct,    unit: '%' },
        { label: '콤보kg보너스',    value: bonuses.comboWeightPct,   max: MAX_REWARDS.comboWeightPct,   unit: '%' },
        { label: '까비까비보너스',  value: bonuses.kabikabiBonusPct, max: MAX_REWARDS.kabikabiBonusPct, unit: '%' },  // ★ Day 41
      ];
      for (const it of items) {
        const span = document.createElement('span');
        span.className = 'codex-reward-summary__item';
        const lab = document.createElement('span');
        lab.className = 'codex-reward-summary__item-label';
        lab.textContent = `${it.label}`;
        const val = document.createElement('span');
        val.className = 'codex-reward-summary__item-value';
        val.textContent = `+${it.value}${it.unit} / +${it.max}${it.unit}`;
        span.appendChild(lab);
        span.appendChild(val);
        wrap.appendChild(span);
      }
      return wrap;
    }

    /* ============================================
       등록 버튼 핸들러 (Day 17 후속 — 대표 결정)
       ============================================
       흐름:
         1. 셀 [등록] 버튼 → openCodexRegisterConfirm 팝업
         2. 사용자 [확인] → loadInventory → registerEquipmentEntry(codexKey, inv) 호출
            (engine 내부에서 가장 허접한 매칭 장비 1개 자동 선정 후 inv.items 에서 제거)
         3. saveInventory(inv) 로 영구 저장
         4. 보상 토스트 표시 + 등록된 셀에 글로우 펄스
         5. 진척도/탭 점/리스트/수족관 일괄 갱신
       취소/오버레이 클릭 → 아무것도 안 함 (등록 X, 장비 X)
       ============================================ */
    function handleRegister(codexKey) {
      openCodexRegisterConfirm({
        parent: root,
        onConfirm: () => {
          const inv = loadInventory();
          if (!inv) {
            console.warn('[codex] register failed: no inventory');
            return;
          }
          const result = registerEquipmentEntry(codexKey, inv);
          if (!result.ok) {
            console.warn('[codex] register failed:', codexKey, result.reason);
            return;
          }
          saveInventory(inv);  // 소비된 장비 영구 반영

          // 보상 토스트 — 셀이 새로 렌더되기 전에 호출 (오버레이 X, 화면 위 별개 레이어)
          const entry = getEquipmentEntryByKey(codexKey);
          if (entry) {
            const reward = computeRewardForEntry(entry);
            showRegisterToast(reward);
          }

          // 즉시 리렌더 — 정렬 그룹 변경 + 보상 합계 갱신 + 탭 빨간점 갱신 + 진척도 갱신
          renderProgress();
          renderTabDots();
          renderList();
          aquarium.refresh();

          // 등록된 셀에 글로우 펄스 (renderList 후 새 셀 기준)
          requestAnimationFrame(() => {
            const newCell = list.querySelector(`[data-codex-key="${codexKey}"]`);
            if (newCell) {
              newCell.classList.add('codex-eq-cell--just-registered');
              setTimeout(() => {
                newCell.classList.remove('codex-eq-cell--just-registered');
              }, 1300);
            }
          });
        }
      });
    }

    /* ============================================
       보상 토스트 (Day 17 후속 — C-2 연출)
       ============================================
       대표 결정 a 안:
         - 위 큰 글자: +1.875% (수치 강조)
         - 아래 작은 글자: 물고기 kg
         - 위치: 화면 가운데
         - 0.8 페이드인 → 0.4 유지 → 0.6 페이드아웃 (총 1.8s)
       ============================================ */
    function showRegisterToast(reward) {
      // 기존 토스트 있으면 즉시 제거 (연속 등록 대비)
      const existing = document.querySelector('.codex-register-toast');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.className = 'codex-register-toast';

      const valFixed = Number((reward?.valuePct || 0).toFixed(3));
      // ★ Day 41 — dropRatePct (%p) → kabikabiBonusPct (%). 단위 통일 (모두 %).
      const valStr = `+${valFixed}%`;
      const labelStr = REWARD_LABEL[reward?.kind] || '보상';

      const valEl = document.createElement('div');
      valEl.className = 'codex-register-toast__value';
      valEl.textContent = valStr;

      const labelEl = document.createElement('div');
      labelEl.className = 'codex-register-toast__label';
      labelEl.textContent = labelStr;

      toast.appendChild(valEl);
      toast.appendChild(labelEl);
      document.body.appendChild(toast);

      // 등장 (0.8s in)
      requestAnimationFrame(() => toast.classList.add('codex-register-toast--show'));

      // 1.2s 후 페이드아웃 시작 (0.8 in + 0.4 hold = 1.2)
      setTimeout(() => {
        toast.classList.remove('codex-register-toast--show');
        toast.classList.add('codex-register-toast--out');
        // 0.6s 페이드아웃 후 제거
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 600);
      }, 1200);
    }

    // 보상 라벨 (등록 토스트용 — codex-equipment-cell.js 와 동일 SSOT 가 있으면 좋지만,
    //  단순 매핑이라 여기 직접 정의. 변경 시 두 곳 동기화 필요.)
    // ★ Day 41 (대표 결정) — dropRatePct(장비 발견) → kabikabiBonusPct(까비까비).
    const REWARD_LABEL = Object.freeze({
      fishWeightPct:    '물고기 kg',
      comboWeightPct:   '콤보 kg',
      kabikabiBonusPct: '까비까비',  // ★ Day 41
    });

    /* ── 탭 클릭 ── */
    fishTab.addEventListener('click', () => {
      if (state.activeTab === 'fish') return;
      activateTab('fish');
    });
    equipTab.addEventListener('click', () => {
      if (state.activeTab === 'equipment') return;
      // ★ Day 39 (대표 결정 수정) — "탭 떠날 때 clear" 패턴 일관 적용.
      //   이전 (일괄 clear) → 현재 활성 서브 탭의 NEW + NEW BEST 만 부분 clear.
      //   사용자가 안 본 다른 서브 탭들의 NEW 는 유지 (슬롯 복귀 후 다시 들어와 확인 가능).
      if (state.activeTab === 'fish') {
        clearTabNewSeen(state.activeFishSubTab, state);
      }
      activateTab('equipment');
    });

    /* ── 초기 활성 탭 적용 ── */
    activateTab(state.activeTab);
    // ★ Day 27 — 초기 서브 탭 버튼 활성 상태 적용 (active class 토글)
    for (const id of Object.keys(subTabButtons)) {
      subTabButtons[id].classList.toggle('codex-sub-tab--active', id === state.activeFishSubTab);
    }
    // ★ Day 39 (대표 결정 수정 — "탭 떠날 때 clear") — K 옵션 제거.
    //   초기 활성 탭(보통 'tiny')의 NEW 는 사용자가 화면에서 직접 확인하도록 유지.
    //   부분 clear 는 사용자가 *다른 탭으로 전환* 또는 *도감 닫을 때* 만 발생.
    //   서브 탭 빨간점은 mount 즉시 시각 표시 필요하므로 renderSubTabDots() 만 호출.
    renderSubTabDots();
  },

  unmount() {
    // ★ Day 39 (대표 결정 수정 — "탭 떠날 때 clear") — 도감 닫는 시점에 현재 활성 서브 탭의
    //   NEW + NEW BEST 부분 clear. 사용자가 마지막으로 본 탭을 "확인 완료" 로 간주.
    //   물고기 탭 활성일 때만 의미 있음 (장비 탭은 별도 시스템).
    if (state && state.activeTab === 'fish' && state.activeFishSubTab) {
      clearTabNewSeen(state.activeFishSubTab, state);
    }

    // ★ Day 41 (대표 결정) — 도감 화면 닫힐 때 누적 상상력 변동 팝업 표시.
    //   배경: 도감 등록 시 보상 토스트(흰색 띠)와 상상력 변동 팝업(흰색 띠)이 겹치는 시각 충돌.
    //   해결: 도감 안에서는 hud.refreshImagination 호출 X (codex 는 hud 객체 접근 불가 + 호출 안 함).
    //         도감 unmount 시점에 누적 변동을 한 번에 팝업 표시 + storage previous 갱신.
    //   v2 (Day 41 후속) — storage 의존 제거. state.imaginationBefore (mount 시 캡처) 로 정확한 diff.
    //     storage.previousImagination 은 가방/메뉴 흐름에 따라 갱신 시점이 달라 부정확할 수 있음.
    try {
      const currentAfter = getCurrentImagination();
      const before = state ? state.imaginationBefore : null;
      const diff = (before == null) ? 0 : (currentAfter - before);
      if (diff !== 0) {
        // 화면 전환 후 표시 (250ms 지연) — codex 화면 사라지고 slot 화면 mount 직후 노출.
        setTimeout(() => {
          showImaginationChangePopup(currentAfter, diff);
        }, 250);
      }
      // storage previous 갱신 — slot 복귀 후 hud.refreshImagination 자동 호출 시 중복 팝업 방지.
      savePreviousImagination(currentAfter);
    } catch (e) {
      // storage / imagination 산출 실패 시 팝업 누락 OK (도감 닫기 자체는 정상 진행)
      console.warn('[codex] imagination popup on unmount failed:', e);
    }

    state = null;
  },
};