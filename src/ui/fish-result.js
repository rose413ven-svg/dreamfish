/* ===========================================
   fish-result.js — 물고기 결과 팝업
   ============================================
   - 슬롯 위치에서 점점 커짐
   - 박스/배경 투명, 뒷화면 강한 블러
   - 잡힘 (caught): 검은 그림자 → 진짜 물고기 변신, 등급 영문 라벨, 무게
   - 놓침 (missed): 그림자 유지(등급 색 글로우), "MISSED" 빨간 라벨, 무게 X
   - 확인 버튼 X — 화면 어디 터치하면 닫힘 (페이드인 끝난 즉시 받음)

   Lucky-3 (Day 9) — 장비 드롭 흐름 분기 추가
   ───────────────────────────────────────────
   showFishResult(el, data) 의 data 에 dropPayload 가 있으면 드롭 흐름.
   dropPayload:
     { bagFull: false, catalogId, slotId, grade, name, slotName }
     또는 { bagFull: true }

   state machine (data-drop-phase):
     '' (초기, dropPayload X): 어디든 터치 → 종료
     '' (초기, dropPayload O): 어디든 터치 → 'drop-show-star' 또는 'drop-bagfull'
     'drop-show-star':  별 + "터치해서 확인해보자". 물고기 영역 터치만 → 'drop-tension'
     'drop-tension':    긴장감 효과 진행. 클릭 무시. ~1초 후 자동 → 'drop-equip'
     'drop-equip':      장비 등장. 어디든 터치 → 종료
     'drop-bagfull':    "가방이 가득 찼습니다". 어디든 터치 → 종료
   ============================================ */

import { renderFishSVG } from './fish-svg.js';
import { formatWeight } from '../engine/weight.js';
import { createGearIcon } from './gear-icons.js';
import { GEAR_GRADES } from '../data/gear-grades.js';
// Day 19 — 별빛 반짝 효과 (멀티힛 / 골든힛 케이스에만 CSS 토글로 표시)
import { createSparkleStars } from './sparkle-stars.js';
// Day 16 — 도감 자동 등록 + NEW 뿅 효과
import { registerFishCatch } from '../data/codex-engine.js';
// ★ Day 26 — 가방 빈칸 경고 (대표 결정) — 빈칸 1~5 면 하단 경고 표시
import { getFreeSlots } from '../data/inventory.js';
import { loadInventory } from '../core/storage.js';

// ★ Day 26 (대표 결정) — 가방 빈칸 경고 threshold
const BAG_WARN_THRESHOLD = 5;

const REVEAL_DELAY = {
  '치어':     200,   // Day 15: 소형보다 약간 짧게
  '소형':     300,
  '중형':     500,
  '월척':     800,
  '대물':     1000,  // Day 15: 월척보다 약간 길게
  '보스':    1200,
  '전설보스': 1600,
  '신화보스': 2000,  // Day 16 신규
};

const GRADE_EN = {
  '치어':     'TINY',
  '소형':     'SMALL',
  '중형':     'MEDIUM',
  '월척':     'BIG',
  '대물':     'HUGE',
  '보스':     'BOSS',
  '전설보스': 'LEGEND',  // Day 15: LEGEND BOSS → LEGEND (대표 결정)
  '신화보스': 'MYTHIC',  // Day 16 신규
};

/**
 * ★ Day 27 — 어종 id에서 변종 정보 추출 (fish-data.js getFishMeta 의 inline 버전).
 *   import 의존성 줄이기 위해 자체 정의. 패턴: `<grade>_<tier>_<index>`
 *   - 'tiny_p3_02' → { plusCount: 3 }
 *   - 'mythic_01' / 'hidden_01' / 'golden_01' → { plusCount: 0 } (변종 없음)
 *
 * @param {string} fishId
 * @returns {{ plusCount: number }}
 */
function getFishPlusCount(fishId) {
  if (!fishId) return { plusCount: 0 };
  const m = fishId.match(/^(?:tiny|sml|med|big|huge|boss|legend)_(base|p1|p2|p3|p4|p5)_/);
  if (!m) return { plusCount: 0 };
  const tier = m[1];
  return { plusCount: tier === 'base' ? 0 : Number(tier.slice(1)) };
}

/**
 * ★ Day 27 — 등급 영문명 + 변종 + 표시.
 *   - 일반 매칭: fish.id에서 변종 추출 (예: tiny_p3_02 → 'TINY+++')
 *   - 골든힛: goldenHitInfo.plusCount 사용 (예: 보스++ → 'BOSS++')
 *   - 신화/히든/황금어: 변종 없음 (그대로)
 *
 * @param {object} fish               result.fish (id 포함)
 * @param {string} grade              한국어 등급 (base, 변종 X)
 * @param {object|null} goldenHitInfo result.goldenHitInfo (골든힛 시 plusCount 포함)
 * @returns {string}
 */
function gradeEnDisplay(fish, grade, goldenHitInfo) {
  const baseEn = GRADE_EN[grade] ?? '';
  if (!baseEn) return '';
  // 골든힛 우선 (변종 정보가 goldenHitInfo에 있음)
  if (goldenHitInfo && typeof goldenHitInfo.plusCount === 'number') {
    return baseEn + '+'.repeat(goldenHitInfo.plusCount);
  }
  // 일반 매칭: fish.id에서 변종 추출
  const { plusCount } = getFishPlusCount(fish?.id);
  return baseEn + '+'.repeat(plusCount);
}

/** 다중매칭 배수 라벨 (Day 4) */
const MULTI_HIT_LABEL = {
  2: 'DOUBLE HIT',
  3: 'TRIPLE HIT',
  4: 'QUAD HIT',
  5: 'PENTA HIT',
};

function multiHitLabelOf(n) {
  if (n >= 6) return 'MEGA HIT';
  return MULTI_HIT_LABEL[n] || null;
}

const SCALE_MAP = {
  '치어':     0.7,   // Day 15: 소형보다 작게
  '소형':     0.9,
  '중형':     1.4,
  '월척':     2.0,
  '대물':     2.4,   // Day 15: 월척과 보스 사이
  '보스':     2.7,
  '전설보스': 3.4,
  '신화보스': 3.8,   // Day 16 신규
};

/* ─── Lucky-3: 장비 등급 영문 + 긴장감 색 분기 ─── */
const EQUIP_GRADE_EN = Object.freeze({
  common:    'COMMON',
  uncommon:  'UNCOMMON',
  rare:      'RARE',
  epic:      'EPIC',
  legendary: 'LEGENDARY',
  mythic:    'MYTHIC',
});

/** Day 9 결정: 일반/고급 = 황금빛, 희귀+ = 빨간빛 (긴장감 단계 색) */
const TENSION_COLOR_BY_EQUIP_GRADE = Object.freeze({
  common:    'gold',
  uncommon:  'gold',
  rare:      'red',
  epic:      'red',
  legendary: 'red',
  mythic:    'red',
});

/** 긴장감 효과 지속 시간 (drop-tension → drop-equip 자동 전이) */
const TENSION_DURATION_MS = 1000;

/* 페이드인 시간 — 페이드인 끝난 즉시 터치 받음 */
const POPUP_FADE_IN_MS = 1000;

export function createFishResult({ onConfirm, onAccumulate }) {
  const el = document.createElement('div');
  el.className = 'fish-result';
  el.innerHTML = `
    <div class="fish-result__backdrop"></div>
    <div class="fish-result__panel">
      <div class="fish-result__grade">
        <div class="fish-result__grade-main"></div>
        <div class="fish-result__grade-sub"></div>
      </div>
      <div class="fish-result__fish">
        <div class="fish-result__shadow"></div>
        <div class="fish-result__real"></div>
        <!-- ★ Day 25: 드롭 별 컨테이너 — JS 가 아이템 수만큼 .fish-result__drop-star 동적 생성 -->
        <div class="fish-result__drop-stars" aria-hidden="true"></div>
        <!-- Lucky-4: 별 파티클 흩날림 (8개, drop-tension 단계에서 흩어짐) -->
        <div class="fish-result__drop-particles" aria-hidden="true">
          <span class="fish-result__drop-particle"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L14.39 9.26 L22 9.27 L15.8 13.97 L18.2 21.23 L12 16.77 L5.8 21.23 L8.2 13.97 L2 9.27 L9.61 9.26 Z" fill="currentColor"/></svg></span>
          <span class="fish-result__drop-particle"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L14.39 9.26 L22 9.27 L15.8 13.97 L18.2 21.23 L12 16.77 L5.8 21.23 L8.2 13.97 L2 9.27 L9.61 9.26 Z" fill="currentColor"/></svg></span>
          <span class="fish-result__drop-particle"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L14.39 9.26 L22 9.27 L15.8 13.97 L18.2 21.23 L12 16.77 L5.8 21.23 L8.2 13.97 L2 9.27 L9.61 9.26 Z" fill="currentColor"/></svg></span>
          <span class="fish-result__drop-particle"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L14.39 9.26 L22 9.27 L15.8 13.97 L18.2 21.23 L12 16.77 L5.8 21.23 L8.2 13.97 L2 9.27 L9.61 9.26 Z" fill="currentColor"/></svg></span>
          <span class="fish-result__drop-particle"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L14.39 9.26 L22 9.27 L15.8 13.97 L18.2 21.23 L12 16.77 L5.8 21.23 L8.2 13.97 L2 9.27 L9.61 9.26 Z" fill="currentColor"/></svg></span>
          <span class="fish-result__drop-particle"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L14.39 9.26 L22 9.27 L15.8 13.97 L18.2 21.23 L12 16.77 L5.8 21.23 L8.2 13.97 L2 9.27 L9.61 9.26 Z" fill="currentColor"/></svg></span>
          <span class="fish-result__drop-particle"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L14.39 9.26 L22 9.27 L15.8 13.97 L18.2 21.23 L12 16.77 L5.8 21.23 L8.2 13.97 L2 9.27 L9.61 9.26 Z" fill="currentColor"/></svg></span>
          <span class="fish-result__drop-particle"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L14.39 9.26 L22 9.27 L15.8 13.97 L18.2 21.23 L12 16.77 L5.8 21.23 L8.2 13.97 L2 9.27 L9.61 9.26 Z" fill="currentColor"/></svg></span>
        </div>
        <!-- Lucky-3: 장비 등장 영역 -->
        <div class="fish-result__drop-equip">
          <div class="fish-result__drop-equip-icon"></div>
          <div class="fish-result__drop-equip-name"></div>
          <div class="fish-result__drop-equip-grade-en"></div>
        </div>
      </div>
      <div class="fish-result__name"></div>
      <div class="fish-result__weight">
        <div class="fish-result__weight-breakdown"></div>
        <div class="fish-result__weight-final"></div>
      </div>
      <!-- Lucky-3: 드롭 메시지 (panel 가장 아래) -->
      <div class="fish-result__drop-message"></div>
      <!-- ★ Day 26 — 인벤토리 빈칸 경고 (빈칸 1~5 일 때 표시, 대표 결정) -->
      <div class="fish-result__bag-warn"></div>
    </div>
  `;

  // Day 19 v2 — 결과 팝업 등급 영역에 별빛 반짝 효과 부착 (레벨업 팝업과 1:1 동일 효과).
  //   CSS 가 [data-multihit] 또는 [data-golden-hit="true"] 일 때만 display:block 으로 표시
  //   (단일 일반 등급은 등급 색이 메인 임팩트라 반짝 X — 대표 결정).
  //   prepend = 첫 자식으로 → 텍스트 뒤로 깔림 (레벨업 팝업의 stars 패턴과 동일).
  const gradeBox = el.querySelector('.fish-result__grade');
  if (gradeBox) gradeBox.prepend(createSparkleStars());

  // closure 인스턴스 변수
  let dropPayloadRef = null;
  let tensionTimer = null;
  // Lucky-5: 합산 1회 가드 — 한 결과팝업에서 onAccumulate 한 번만 호출
  let accumulated = false;
  const tryAccumulate = () => {
    if (accumulated) return;
    accumulated = true;
    onAccumulate?.();
  };

  /** Lucky-3: 단계별 클릭 핸들러 (state machine) */
  el._onClickAnywhere = (e) => {
    if (el.dataset.locked === 'true') return;
    if (!el.classList.contains('show')) return;

    const phase = el.dataset.dropPhase || '';
    const drop  = dropPayloadRef;

    // 드롭 X — 어디든 터치 → 합산(첫 터치 = 종료) + 종료
    if (!drop) {
      tryAccumulate();          // Lucky-5: 합산
      el.dataset.locked = 'true';
      hide(el);
      setTimeout(() => onConfirm?.(), 200);
      return;
    }

    // 첫 단계 — 합산(첫 터치) + 별/메시지 또는 가방 가득 메시지로 전이
    if (phase === '') {
      tryAccumulate();          // Lucky-5: 첫 터치에 합산
      const msgEl = el.querySelector('.fish-result__drop-message');
      if (drop.bagFull) {
        el.dataset.dropPhase = 'drop-bagfull';
        // ★ Day 26 (대표 결정) — 가방 가득 시 메시지 변경
        msgEl.innerHTML = '인벤토리가 가득 차서 장비를 획득할 수 없습니다';
      } else {
        el.dataset.dropPhase = 'drop-show-star';
        msgEl.innerHTML =
          '<div>물고기에서 뭔가 반짝거린다.</div>' +
          '<div class="fish-result__drop-message-hint">터치해서 확인해보자</div>';
      }
      return;
    }

    // 별/메시지 단계 — ★ Day 26 (대표 결정): 물고기 영역만 아니라 어디든 터치 → 다음 단계.
    if (phase === 'drop-show-star') {
      el.dataset.dropPhase = 'drop-tension';
      if (tensionTimer) clearTimeout(tensionTimer);
      tensionTimer = setTimeout(() => {
        tensionTimer = null;
        // 장비 정보는 등장 직전에 채워야 pop 애니메이션 명확
        populateDropEquip(el, drop);
        el.dataset.dropPhase = 'drop-equip';
        const msgEl = el.querySelector('.fish-result__drop-message');
        if (msgEl) msgEl.innerHTML = '인벤토리를 확인해보세요';
      }, TENSION_DURATION_MS);
      return;
    }

    // 긴장감 진행 중 — 클릭 무시
    if (phase === 'drop-tension') return;

    // 장비 등장 단계 또는 가방 가득 단계 — 어디든 터치 → 종료
    if (phase === 'drop-equip' || phase === 'drop-bagfull') {
      el.dataset.locked = 'true';
      hide(el);
      setTimeout(() => onConfirm?.(), 200);
      return;
    }
  };
  el.addEventListener('click', el._onClickAnywhere);

  // showFishResult 가 갱신할 수 있도록 setter 노출
  el._setDropPayload = (p) => { dropPayloadRef = p || null; };
  el._clearTensionTimer = () => {
    if (tensionTimer) {
      clearTimeout(tensionTimer);
      tensionTimer = null;
    }
  };
  // Lucky-5: 합산 가드 리셋 (showFishResult 마다 새 결과이므로)
  el._resetAccumulated = () => { accumulated = false; };

  return el;
}

/** Lucky-3: 장비 등장 영역 채우기 (drop-equip phase 진입 직전 호출) */
function populateDropEquip(el, drop) {
  const iconBox   = el.querySelector('.fish-result__drop-equip-icon');
  const nameEl    = el.querySelector('.fish-result__drop-equip-name');
  const gradeEnEl = el.querySelector('.fish-result__drop-equip-grade-en');

  iconBox.innerHTML = '';

  // ★ Day 25 — 복수 아이템 처리
  const items = drop.items ?? [drop];  // 구형 단일 payload 하위 호환

  // ★ Day 25 후속 (대표 결정) — 1개·복수 무관: 장비 이름 + 등급 영문 텍스트 항상 비움 (셀만 표시).
  nameEl.textContent    = '';
  gradeEnEl.textContent = '';

  if (items.length === 1) {
    // ── 1개: 기존 큰 아이콘 셀 (5.2rem) 그대로, 텍스트 영역만 비움 ──
    const item = items[0];
    try {
      const svg = createGearIcon(item.slotId, item.grade);
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      iconBox.appendChild(svg);
    } catch (e) {
      console.warn('[fish-result] gear icon 실패:', item.slotId);
    }

    const gradeColor = GEAR_GRADES[item.grade]?.color || '#ffffff';
    el.style.setProperty('--drop-equip-color', gradeColor);
    iconBox.classList.remove('fish-result__drop-equip-icon--multi');
  } else {
    // ── 2~5개: 아이콘 가로 배열 (단일 셀과 동일 크기 — CSS 자동 처리) ──
    iconBox.classList.add('fish-result__drop-equip-icon--multi');
    iconBox.style.setProperty('--drop-item-count', String(items.length));

    // 최고 등급 색을 테두리/글로우 기준 색으로 사용
    const gradeColor = GEAR_GRADES[drop.grade]?.color || '#ffffff';
    el.style.setProperty('--drop-equip-color', gradeColor);

    items.forEach((item) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'fish-result__drop-equip-icon-cell';
      const itemColor = GEAR_GRADES[item.grade]?.color || '#ffffff';
      wrapper.style.setProperty('--cell-equip-color', itemColor);
      try {
        const svg = createGearIcon(item.slotId, item.grade);
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        wrapper.appendChild(svg);
      } catch (e) {
        console.warn('[fish-result] gear icon 실패:', item.slotId);
      }
      iconBox.appendChild(wrapper);
    });
  }
}

export function showFishResult(el, data) {
  const {
    fish, weight, tier, grade, missed = false, multiplier = 1,
    baseWeight = weight, comboBonus = 0, equipmentBonus = 0,
    dropPayload = null,  // Lucky-3
    isGoldenHit = false,  // Day 15: 골든힛 타임 single hit (true 면 등급 + GOLDEN HIT 라벨)
    cardMultiplier,       // ★ Day 22 Phase 7 후속 — HIDDEN HIT 카드 배수 (1/3/5)
    isMythicHit = false,  // ★ Day 27: 신화 매칭 (검은 25+ 또는 11지역 분홍/황금/하얀 10+) — 게임 최고 보상
    goldenHitInfo = null, // ★ Day 27: 골든힛 변종 정보 (displayGrade 포함)
    isHiddenHit = false,  // ★ Day 28: 히든힛 결과 — missed 시 그림자 완전 검정 톤 분기용
  } = data;

  // 이전 호출 잔여 정리 — 타이머 / 드롭 단계 / 장비 영역 / 메시지 모두 초기화
  if (el._clearTensionTimer) el._clearTensionTimer();
  if (el._setDropPayload)    el._setDropPayload(dropPayload);
  if (el._resetAccumulated)  el._resetAccumulated();  // Lucky-5
  el.dataset.dropPhase = '';
  const iconBox  = el.querySelector('.fish-result__drop-equip-icon');
  if (iconBox) {
    iconBox.innerHTML = '';
    iconBox.classList.remove('fish-result__drop-equip-icon--multi');
  }
  const dropNameEl = el.querySelector('.fish-result__drop-equip-name');
  if (dropNameEl)  dropNameEl.textContent = '';
  const dropGradeEnEl = el.querySelector('.fish-result__drop-equip-grade-en');
  if (dropGradeEnEl)  dropGradeEnEl.textContent = '';
  const dropMsgEl = el.querySelector('.fish-result__drop-message');
  if (dropMsgEl)  dropMsgEl.innerHTML = '';

  // ★ Day 26 (대표 결정) — 인벤토리 빈칸 경고 (빈칸 1~5 면 하단 경고 표시).
  //   빈칸 0 (가득) 은 drop-bagfull phase 가 처리하므로 여기서는 hide.
  //   drop 여부 무관하게 표시 (사용자가 미리 정리하도록).
  const bagWarnEl = el.querySelector('.fish-result__bag-warn');
  if (bagWarnEl) {
    try {
      const inv = loadInventory();
      const remaining = getFreeSlots(inv);
      if (remaining > 0 && remaining <= BAG_WARN_THRESHOLD) {
        bagWarnEl.textContent = '인벤토리가 거의 찼습니다. 메뉴>합성에서 정리하세요';
        bagWarnEl.dataset.show = 'true';
      } else {
        bagWarnEl.textContent = '';
        delete bagWarnEl.dataset.show;
      }
    } catch (err) {
      // 안전장치 — inventory 로드 실패 시 경고 미표시
      bagWarnEl.textContent = '';
      delete bagWarnEl.dataset.show;
    }
  }

  // ★ Day 25 — 드롭 별 동적 생성 (아이템 수만큼 반짝)
  const starsContainer = el.querySelector('.fish-result__drop-stars');
  if (starsContainer) {
    starsContainer.innerHTML = '';
    if (dropPayload && !dropPayload.bagFull) {
      const items = dropPayload.items ?? [dropPayload];
      const count = Math.min(items.length, 5);
      // 아이템 수별 별 위치 (top%, left% — 물고기 영역 안)
      const STAR_POS = [
        [],
        [{ t: 50, l: 50 }],
        [{ t: 50, l: 33 }, { t: 50, l: 67 }],
        [{ t: 33, l: 50 }, { t: 65, l: 33 }, { t: 65, l: 67 }],
        [{ t: 33, l: 33 }, { t: 33, l: 67 }, { t: 65, l: 33 }, { t: 65, l: 67 }],
        [{ t: 28, l: 50 }, { t: 55, l: 25 }, { t: 55, l: 75 }, { t: 78, l: 35 }, { t: 78, l: 65 }],
      ];
      const positions = STAR_POS[count] || STAR_POS[1];
      const starSize  = count === 1 ? '3.2rem' : '2.2rem';  // 1개면 크게, 복수면 작게
      const starSVG   = `<svg viewBox="0 0 40 40" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><path d="M20 2 L22 18 L38 20 L22 22 L20 38 L18 22 L2 20 L18 18 Z" fill="#ffffff"/></svg>`;
      positions.forEach((pos, i) => {
        const star = document.createElement('div');
        star.className = 'fish-result__drop-star';
        star.style.cssText = `
          top: ${pos.t}%; left: ${pos.l}%;
          transform: translate(-50%, -50%);
          width: ${starSize}; height: ${starSize};
          animation-delay: ${i * 0.12}s;
        `;
        star.innerHTML = starSVG;
        starsContainer.appendChild(star);
      });
      el.dataset.dropStarCount = String(count);
    } else {
      delete el.dataset.dropStarCount;
    }
  }

  const isMultiHit = !missed && multiplier >= 2;
  const multiLabel = isMultiHit ? multiHitLabelOf(multiplier) : null;

  el.dataset.grade = grade;
  el.dataset.tier = tier?.name ?? '';
  el.dataset.missed = missed ? 'true' : 'false';
  el.dataset.locked = 'true';
  if (isMultiHit) {
    el.dataset.multihit = String(multiplier);
  } else {
    delete el.dataset.multihit;
  }
  // Day 15: 골든힛 타임 single hit 식별 (CSS 황금빛 오버라이드)
  // Day 18 후속 (대표 결정) — missed 케이스도 골든힛 타임이면 attribute 둠 (글로우 황금색)
  if (isGoldenHit) {
    el.dataset.goldenHit = 'true';
  } else {
    delete el.dataset.goldenHit;
  }
  // ★ Day 27 — 신화 매칭 식별 (CSS 신화 톤 오버라이드)
  if (isMythicHit) {
    el.dataset.mythicHit = 'true';
    // 황금빛꿈고래(mythic_01)는 엔딩 상징 — 별도 dataset 으로 특별 연출 분기 가능
    if (fish?.id === 'mythic_01') {
      el.dataset.endingMythic = 'true';
    } else {
      delete el.dataset.endingMythic;
    }
  } else {
    delete el.dataset.mythicHit;
    delete el.dataset.endingMythic;
  }
  // ★ Day 28 (대표 결정) — 히든힛 결과 식별:
  //   missed 시 그림자 색을 등급별 색 글로우(보스 = 붉은빛) 대신 완전 검정으로 오버라이드 (CSS).
  if (isHiddenHit) {
    el.dataset.hiddenHit = 'true';
  } else {
    delete el.dataset.hiddenHit;
  }

  // Lucky-3: 긴장감 색 / 가방가득 데이터 attribute 설정 (CSS 셀렉터용)
  if (dropPayload && !dropPayload.bagFull) {
    const colorTag = TENSION_COLOR_BY_EQUIP_GRADE[dropPayload.grade] || 'gold';
    el.dataset.dropColor = colorTag;
  } else {
    delete el.dataset.dropColor;
  }
  if (dropPayload && dropPayload.bagFull) {
    el.dataset.dropBagfull = 'true';
  } else {
    delete el.dataset.dropBagfull;
  }

  const scale = SCALE_MAP[grade] ?? 1.0;

  const shadowFish = { ...fish, color: '#000000' };
  // ★ Day 28 (대표 결정) — 히든힛(시크릿꿈고래) 결과 시 그림자를 단색 검정으로 렌더 (radial gradient 분홍 제거)
  el.querySelector('.fish-result__shadow').innerHTML = renderFishSVG(shadowFish, scale, { shadow: isHiddenHit });
  el.querySelector('.fish-result__real').innerHTML = renderFishSVG(fish, scale);

  const mainEl = el.querySelector('.fish-result__grade-main');
  const subEl  = el.querySelector('.fish-result__grade-sub');
  if (missed) {
    mainEl.textContent = 'MISSED';
    subEl.textContent = '';
  } else if (isMythicHit) {
    // ★ Day 27 — 신화 매칭 — 메인: 등급 (MYTHIC), 서브: 'MYTHIC HIT' (황금빛꿈고래는 'GOLDEN DREAM')
    mainEl.textContent = gradeEnDisplay(fish, grade, null);
    subEl.textContent = (fish?.id === 'mythic_01') ? 'GOLDEN DREAM' : 'MYTHIC HIT';
  } else if (isGoldenHit) {
    // Day 15: 골든힛 타임 single hit (Q8 답) — 메인 = 등급명, 서브 = GOLDEN HIT
    // ★ Day 27 — 변종 + 포함 (예: BOSS++, LEGEND+++++)
    mainEl.textContent = gradeEnDisplay(fish, grade, goldenHitInfo);
    subEl.textContent  = 'GOLDEN HIT';
  } else if (isMultiHit) {
    // Day 18 후속 (대표 결정) — 멀티힛도 골든힛과 동일 배치:
    //   메인 = 등급명 (위 큰글씨), 서브 = 멀티힛 라벨 (아래 작은글씨)
    mainEl.textContent = gradeEnDisplay(fish, grade, null);
    subEl.textContent  = multiLabel;
  } else {
    // ★ Day 27 — 일반 매칭도 변종 + 포함 표시 (예: 치어 7지역 → 'TINY+++')
    mainEl.textContent = gradeEnDisplay(fish, grade, null);
    subEl.textContent = '';
  }

  const nameEl = el.querySelector('.fish-result__name');
  nameEl.textContent = fish.name;

  // ── 기존 NEW 배지 정리 (다음 결과 표시 시 잔존 방지) ──
  nameEl.querySelector('.fish-result__new-badge')?.remove();

  // Day 16 — 잡기 성공 시 도감 자동 등록 + 신규일 때 NEW 뿅 효과.
  //   대표 결정: "신규는 이름 등장 0.3초 후 NEW 배지 (다른 연출 X)".
  //   missed = true 면 등록 X (놓친 물고기는 도감 등록 안 함).
  // Day 17 픽스 (대표 결정): 도감 최고기록 = 무게바에 누적되는 최종무게 (weight × multiplier).
  //   기존엔 weight 만 등록 (멀티히트 배수 누락) → slot.js onAccumulate 의 누적 공식과 일치시킴.
  //   weight 자체에 콤보 + 장비/세트 weight_bonus 이미 합산되어 있음 (applyWeight 결과).
  // Day 18 후속 (대표 결정) — registerFishCatch 결과를 reg 변수에 보관 →
  //   bestUpdated 시 무게 옆 NEW RECORD 배지도 부착 (NEW 배지와는 별도).
  // ★ Day 27 후속 (대표 결정) — HIDDEN HIT cardMultiplier 도 도감 무게에 반영 (버그 수정).
  //   기존: weight × multiHit (cardMultiplier 누락) → HIDDEN HIT ×3/×5 카드 잡기 시 도감 기록 손해
  //   변경: weight × multiHit × cardMultiplier — slot.js onAccumulate/onConfirm 의 gainedKg 공식과 완전 일치
  //         (노란색 팝업 = 무게바 누적 = 도감 등록 모두 동일 최종무게)
  let reg = null;
  if (!missed && fish?.name) {
    const multHit = (multiplier && multiplier >= 2) ? multiplier : 1;
    const cardMult = cardMultiplier || 1;
    const finalWeight = (weight || 0) * multHit * cardMult;
    reg = registerFishCatch(fish.name, finalWeight);
    if (reg.isNew) {
      // 같은 popup 인스턴스 내에서만 부착 (다음 결과로 교체 시 hide 처리됨)
      setTimeout(() => {
        // 결과 팝업이 이미 닫혔으면 부착 안 함
        if (!el.classList.contains('show')) return;
        // 중복 부착 방지
        if (nameEl.querySelector('.fish-result__new-badge')) return;
        const badge = document.createElement('span');
        badge.className = 'fish-result__new-badge';
        badge.textContent = 'NEW';
        nameEl.appendChild(badge);
      }, 300);
    }
  }

  const weightEl    = el.querySelector('.fish-result__weight');
  const breakdownEl = el.querySelector('.fish-result__weight-breakdown');
  const finalEl     = el.querySelector('.fish-result__weight-final');
  // ── 기존 NEW RECORD 배지 정리 (다음 결과 표시 시 잔존 방지) ──
  finalEl.querySelector('.fish-result__record-badge')?.remove();
  if (missed) {
    breakdownEl.innerHTML = '';
    finalEl.textContent = '';
    finalEl.style.color = '';
  } else {
    const totalBonus = (comboBonus || 0) + (equipmentBonus || 0);
    if (totalBonus > 0.0005) {
      const parts = [
        `<span class="fish-result__weight-base">${formatWeight(baseWeight)}</span>`,
        `<span class="fish-result__weight-op"> + (</span>`,
      ];
      const inner = [];
      if (comboBonus > 0.0005) {
        inner.push(`<span class="fish-result__weight-combo">${formatWeight(comboBonus)}</span>`);
      }
      if (equipmentBonus > 0.0005) {
        inner.push(`<span class="fish-result__weight-equip">${formatWeight(equipmentBonus)}</span>`);
      }
      parts.push(inner.join(`<span class="fish-result__weight-op"> + </span>`));
      parts.push(`<span class="fish-result__weight-op">)</span>`);
      breakdownEl.innerHTML = parts.join('');
    } else {
      breakdownEl.innerHTML = '';
    }
    if (isMultiHit) {
      finalEl.innerHTML =
        `${formatWeight(weight)}<span class="fish-result__weight-multi">× ${multiplier}</span>`;
    } else if (cardMultiplier !== undefined && cardMultiplier !== null) {
      // ★ Day 22 Phase 7 후속 (대표 결정) — HIDDEN HIT 카드 배수 표시
      //   weight 는 이미 cardMultiplier 반영된 최종 (slot.js Math.round(finalWeight * cardMultiplier))
      //   "최종무게 ×배수" 형식 (예: "120 kg × 3") — 사용자가 뽑은 카드 한눈에 확인
      finalEl.innerHTML =
        `${formatWeight(weight)}<span class="fish-result__weight-multi">× ${cardMultiplier}</span>`;
    } else {
      finalEl.textContent = formatWeight(weight);
    }
    if (tier?.color) finalEl.style.color = tier.color;
    weightEl.style.color = '';
    // Day 18 후속 (대표 결정) — record-badge append + final-reveal 클래스는
    //   아래 setTimeout(delay + 500) 에서 통합 처리 (final 과 동시 뿅).
  }

  el.classList.remove('hide', 'show', 'revealed', 'final-reveal');
  void el.offsetWidth;
  el.classList.add('show');

  if (!missed) {
    const delay = REVEAL_DELAY[grade] ?? 500;
    setTimeout(() => {
      el.classList.add('revealed');
    }, delay);

    // Day 18 후속 (대표 결정) — 최종 무게 + NEW RECORD 배지 동시 뿅 (revealed 후 추가 500ms).
    //   순서:
    //     1) show          → 등급, 물고기 그림자, 이름 표시
    //     2) revealed      → breakdown 수식 (보너스 분해) 표시
    //     3) final-reveal  → 최종 무게 + NEW RECORD 배지 동시 pop (탱탱볼)
    //   record-badge 는 final-reveal 시점에 DOM append → 동시 등장.
    setTimeout(() => {
      if (!el.classList.contains('show')) return;
      // record-badge append (bestUpdated 시만 — 신기록 갱신 또는 첫 등록)
      if (reg && reg.bestUpdated && !finalEl.querySelector('.fish-result__record-badge')) {
        const badge = document.createElement('span');
        badge.className = 'fish-result__record-badge';
        badge.textContent = 'NEW RECORD';
        finalEl.appendChild(badge);
      }
      el.classList.add('final-reveal');
    }, delay + 500);
  }

  setTimeout(() => {
    el.dataset.locked = 'false';
  }, POPUP_FADE_IN_MS);
}

function hide(el) {
  el.classList.remove('show', 'revealed', 'final-reveal');
  el.classList.add('hide');
  // 드롭 phase 초기화 — 다음 결과 표시 시 새 흐름 시작
  el.dataset.dropPhase = '';
  delete el.dataset.dropColor;
  delete el.dataset.dropBagfull;
}