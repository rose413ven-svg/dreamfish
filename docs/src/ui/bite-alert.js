/* ===========================================
   bite-alert.js — 매칭 알림
   ============================================
   표시 규칙 (slot.css와 정합):
   - main = 항상 "HIT" (텍스트 고정)
   - prefix:
     · 분홍 매칭(hasBoss) 포함 → "BOSS"  ← ★ Day 22 폐기 (hasBoss 항상 false)
     · 다중 매칭 → DOUBLE/TRIPLE/QUAD/PENTA/MEGA
     · 단일 → 비움 (CSS가 hide)
     · isHiddenHit → 비움 (CSS가 hide) / Day 22
   - grade-label (HIT 위 작은 텍스트):
     TINY / SMALL / MEDIUM / BIG / HUGE / BOSS / LEGEND / MYTHIC
     · 다중 매칭 시 가장 높은 등급
     · BOSS HIT일 때는 CSS가 자동으로 hide
     · isHiddenHit → "HIDDEN" 표시 (Day 22 — 골든/트윙클과 동일 2단 구성)

   data 속성 (CSS 트리거):
   - data-hit-count: 색깔 차등용 (1~6) — Day 19 부터는 모두 황금색 통일
   - data-boss: "true" / "false" (Day 22 — 항상 false)
   - data-golden-hit: "true" / "false" (Day 15)
   - data-twinkle-hit: "true" / "false" (Day 20)
   - data-hidden-hit: "true" / "false" (★ Day 22)

   Day 19 — 별빛 반짝 효과 추가 (sparkle-stars 공통 컴포넌트).
   ★ Day 22 — HIDDEN HIT 미니게임 도입 (분홍 매칭). 골든/트윙클과 동일 2단 표시.
   ============================================ */

import { createSparkleStars } from './sparkle-stars.js';

const HIT_PREFIX = ['', '', 'DOUBLE', 'TRIPLE', 'QUAD', 'PENTA'];

const GRADE_LABEL = {
  '치어':     'TINY',
  '소형':     'SMALL',
  '중형':     'MEDIUM',
  '월척':     'BIG',
  '대물':     'HUGE',
  '보스':     'BOSS',
  '전설보스': 'LEGEND',
  '신화보스': 'MYTHIC',   // Day 16 신규 / Day 19 — 대문자 통일
};

const GRADE_RANK = {
  '치어':     0,
  '소형':     1,
  '중형':     2,
  '월척':     3,
  '대물':     4,
  '보스':     5,
  '전설보스': 6,
  '신화보스': 7,          // Day 16 신규
};

/**
 * ★ Day 27 — 한국어 등급명 (변종 + 포함) → { base, plus } 분리.
 * 예: '치어+++' → { base: '치어', plus: '+++' }
 *     '신화보스' → { base: '신화보스', plus: '' }
 */
function splitGradePlus(grade) {
  if (!grade) return { base: '', plus: '' };
  const m = grade.match(/^(.+?)(\+*)$/);
  return m ? { base: m[1], plus: m[2] || '' } : { base: grade, plus: '' };
}

function getPrefix(count) {
  if (count <= 1) return '';
  if (count >= 6) return 'MEGA';
  return HIT_PREFIX[count];
}

/** 가장 높은 등급의 라벨 (영문 + 변종 +). ★ Day 27 — 변종 표시 추가 */
function topGradeLabel(grades = []) {
  let topRank = -1;
  let topLabel = '';
  for (const g of grades) {
    const { base, plus } = splitGradePlus(g);
    const r = GRADE_RANK[base] ?? -1;
    if (r > topRank) {
      topRank = r;
      topLabel = (GRADE_LABEL[base] ?? '') + plus;
    }
  }
  return topLabel;
}

/** 가장 높은 등급의 한국어 base 이름 (변종 제외 — Day 19 CSS 등급별 색 분기용 dataset 키) */
function topGradeKorean(grades = []) {
  let topRank = -1;
  let topGrade = '';
  for (const g of grades) {
    const { base } = splitGradePlus(g);
    const r = GRADE_RANK[base] ?? -1;
    if (r > topRank) {
      topRank = r;
      topGrade = base;
    }
  }
  return topGrade;
}

export function createBiteAlert() {
  const el = document.createElement('div');
  el.className = 'bite-alert';
  el.innerHTML = `
    <div class="bite-alert__grade"></div>
    <div class="bite-alert__prefix"></div>
    <div class="bite-alert__main">HIT</div>
  `;
  // Day 19 v2 — 별빛 반짝 효과를 텍스트 뒤로 깔기 위해 첫 자식으로 prepend
  //   (레벨업 팝업의 stars 먼저 append → headerText 다음 append 패턴과 동일).
  el.prepend(createSparkleStars());
  return el;
}

/**
 * @param {HTMLElement} el
 * @param {object} opts
 * @param {number} opts.count        매칭 덩어리 수
 * @param {boolean} opts.hasBoss     분홍 매칭(보스 강제) 포함 여부 (★ Day 22 — 항상 false)
 * @param {string[]} opts.grades     각 매칭 등급 배열 (변종 + 포함 가능 — ★ Day 27)
 * @param {boolean} [opts.isGoldenHit=false]  Day 15: 골든힛 타임 single hit 여부 — true 면 등급+HIT 황금색
 * @param {boolean} [opts.isTwinkleHit=false] Day 20: 트윙클(꿈조각) 매칭 여부 — true 면 등급+HIT 흰색·연푸른빛
 * @param {boolean} [opts.isHiddenHit=false]  ★ Day 22: HIDDEN HIT(분홍) 매칭 여부 — true 면 main "HIDDEN HIT" 연한 핑크
 * @param {boolean} [opts.isMythicHit=false]  ★ Day 27: 신화 매칭 여부 (검은 25+ 또는 11지역 분홍/황금/하얀 10+) — 게임 최고 보상 톤
 */
export function showBiteAlert(el, opts = {}) {
  const {
    count = 1,
    hasBoss = false,
    grades = [],
    isGoldenHit = false,
    isTwinkleHit = false,
    isHiddenHit = false,
    isMythicHit = false,
    isGoldenDreamWhale = false,  // ★ Day 37 — 황금빛꿈고래(mythic_01) 식별 — SPECIAL MYTHIC 황금 톤
  } = opts;

  const prefixEl = el.querySelector('.bite-alert__prefix');
  const mainEl = el.querySelector('.bite-alert__main');

  if (isMythicHit && hasBoss) {
    // ★ Day 37 (대표 결정) — 신화 트리거 매칭 분기:
    //   isGoldenDreamWhale=true  → grade = "SPECIAL MYTHIC" (황금 #FFD700, 특별 연출 — slot.js Day 36 흐름에선 안 띄움)
    //   isGoldenDreamWhale=false → grade = "MYTHIC"          (마젠타 #FF49A6, Day 27 기존 정책 — 일반 신화 트리거)
    //   main = "HIT" 통일.
    prefixEl.textContent = '';
    mainEl.textContent = 'HIT';
  } else if (isHiddenHit) {
    // ★ Day 22 — HIDDEN HIT 매칭 (분홍): 골든힛/트윙클힛과 동일 2단 구성
    //   grade 자리 = "HIDDEN" (작게) / main 자리 = "HIT" (크게) — 일반 매칭과 같은 크기/방식
    //   prefix 비움. CSS data-hidden-hit="true" 가 연한 핑크 색 + 글로우 처리.
    prefixEl.textContent = '';
    mainEl.textContent = 'HIT';
  } else if (hasBoss) {
    // 분홍 매칭 — main 한 줄에 'BOSS HIT' (CSS가 main을 빨간 큰 글씨로 처리)
    // ★ Day 22 — hasBoss 항상 false 이므로 사실상 진입 X. 코드 호환 위해 분기 유지.
    prefixEl.textContent = '';
    mainEl.textContent = 'BOSS HIT';
  } else {
    // 일반 매칭 — prefix(DOUBLE 등) + main('HIT')
    prefixEl.textContent = getPrefix(count);
    mainEl.textContent = 'HIT';
  }

  // grade label (BOSS HIT 일 때는 CSS가 자동 hide / HIDDEN HIT 일 때는 "HIDDEN" 표시)
  const gradeEl = el.querySelector('.bite-alert__grade');
  if (isMythicHit && hasBoss) {
    // ★ Day 37 (대표 결정) — 황금빛꿈고래만 "SPECIAL MYTHIC", 그 외 일반 신화는 "MYTHIC".
    gradeEl.textContent = isGoldenDreamWhale ? 'SPECIAL MYTHIC' : 'MYTHIC';
  } else if (isHiddenHit) {
    // ★ Day 22 — 골든/트윙클과 같은 2단 구성: grade 자리에 "HIDDEN" (작은 글자)
    gradeEl.textContent = 'HIDDEN';
  } else if (isGoldenHit) {
    // ★ Day 40 (대표 결정) — 골든힛 매칭 시 'GOLDEN ' 접두 + base 등급만 (변종 + 표시 X).
    //   변종 + 노출은 결과팝업의 사이즈 업그레이드 펑 연쇄에서만 (일반힛과 일관).
    const topBaseKr = topGradeKorean(grades);
    const baseEn = GRADE_LABEL[topBaseKr] ?? '';
    gradeEl.textContent = baseEn ? 'GOLDEN ' + baseEn : topGradeLabel(grades);
  } else {
    const gradeLabel = topGradeLabel(grades);
    gradeEl.textContent = gradeLabel;
  }

  // Day 19 — 최상 등급 한국어명 dataset 에 박음 → CSS 가 [data-top-grade="..."] 로 색 분기.
  //   결과 팝업(fish-result)과 동일한 등급 색 팔레트로 grade 라벨 표시.
  const topGradeKr = topGradeKorean(grades);
  if (topGradeKr) {
    el.dataset.topGrade = topGradeKr;
  } else {
    delete el.dataset.topGrade;
  }

  el.dataset.hitCount = String(Math.min(count, 6));
  el.dataset.boss = hasBoss ? 'true' : 'false';
  // Day 15: 골든힛 타임 single hit 식별 — CSS 가 황금색 처리
  if (isGoldenHit) {
    el.dataset.goldenHit = 'true';
  } else {
    delete el.dataset.goldenHit;
  }
  // Day 20: 트윙클(꿈조각) 매칭 식별 — CSS 가 흰색·연푸른빛 처리
  if (isTwinkleHit) {
    el.dataset.twinkleHit = 'true';
  } else {
    delete el.dataset.twinkleHit;
  }
  // ★ Day 22: HIDDEN HIT(분홍) 매칭 식별 — CSS 가 연한 핑크 처리 + grade/prefix hide
  if (isHiddenHit) {
    el.dataset.hiddenHit = 'true';
  } else {
    delete el.dataset.hiddenHit;
  }
  // ★ Day 27: 신화 매칭 식별 — CSS 가 게임 최고 보상 톤 처리.
  if (isMythicHit) {
    el.dataset.mythicHit = 'true';
  } else {
    delete el.dataset.mythicHit;
  }
  // ★ Day 37: 황금빛꿈고래 식별 — CSS 가 SPECIAL MYTHIC 황금 톤 처리 (일반 신화는 마젠타)
  if (isGoldenDreamWhale) {
    el.dataset.goldenDreamWhale = 'true';
  } else {
    delete el.dataset.goldenDreamWhale;
  }

  el.classList.remove('hide');
  void el.offsetWidth;
  el.classList.add('show');
}

export function hideBiteAlert(el) {
  el.classList.remove('show');
  el.classList.add('hide');
}