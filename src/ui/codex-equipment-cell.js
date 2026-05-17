/* ===========================================
   codex-equipment-cell.js — 장비 도감 단일 셀 (Day 16 — Phase D)
   ============================================
   대표 결정 사항:
   - 한 행 1셀
   - PNG 이미지(등급색 외곽) + 강화 배지 + 코스메틱 마크 + 등급/부위/보상/등록버튼
   - 보상: base→물고기 kg% / enhance→콤보 kg% / cosmetic→드롭 +%p
   - 정렬 그룹별 상태:
     · registerable: 가방에 매칭 장비 있음 + 미등록 → 등록 버튼 활성
     · locked:       가방에 매칭 없음 + 미등록 → "보유 없음" 안내
     · done:         등록 완료 → "✓ 등록됨" 표시 + 회색조

   PNG 경로: /assets/images/equipment/{slotId}_{grade}.png
   ============================================ */

import { GEAR_GRADES } from '../data/gear-grades.js';
import { GEAR_SLOTS } from '../data/gear-slots.js';
import { GRADE_PREFIX } from '../data/equipment-catalog.js';   // Day 16 후속: 등급별 형용사 (낡은/고급진/...)

/** 부위 한글명 매핑 */
const SLOT_NAME = Object.freeze(
  GEAR_SLOTS.reduce((acc, s) => { acc[s.id] = s.name || s.id; return acc; }, {})
);

/** 보상 종류 라벨 */
const REWARD_LABEL = Object.freeze({
  fishWeightPct:  '물고기 kg',
  comboWeightPct: '콤보 kg',
  dropRatePct:    '장비 발견 +',
});

/** PNG 이미지 경로 빌더 — 가방 셀(gear-icons.js)과 동일한 상대 경로.
 *  Capacitor/Vite 환경에서 절대 경로('/assets/...')는 file:// 프로토콜과 충돌하여
 *  로드 실패 → onerror fallback 으로 ? 표시되는 버그. 슬래시 제거하여 가방과 일관성. */
function imagePath(slotId, grade) {
  return `assets/images/equipment/${slotId}_${grade}.png`;
}

/* ============================================
   메인 — 셀 빌더
   ============================================ */

/**
 * 장비 도감 단일 셀.
 *
 * @param {object} opts
 * @param {object} opts.entry          EQUIPMENT_CODEX_ENTRIES 의 항목
 *                                     { codexKey, slotId, grade, type, level? }
 * @param {string} opts.group          'registerable' | 'locked' | 'done'
 * @param {boolean} opts.registered
 * @param {boolean} opts.registerable
 * @param {{ kind: string, valuePct: number }} opts.reward
 * @param {(codexKey: string) => void} [opts.onRegister]   등록 버튼 클릭 핸들러
 * @returns {{ root: HTMLElement, refresh: (newOpts) => void }}
 */
export function createEquipmentCodexCell(opts) {
  const root = document.createElement('article');
  root.className = 'codex-eq-cell';
  root.dataset.codexKey = opts.entry.codexKey;
  root.dataset.grade    = opts.entry.grade;
  root.dataset.type     = opts.entry.type;
  root.dataset.group    = opts.group;

  buildCellContent(root, opts);

  /** 셀 상태 갱신 (등록 직후 호출 — 같은 DOM 유지하면서 시각만 바꿈) */
  function refresh(newOpts) {
    root.innerHTML = '';
    root.dataset.group = newOpts.group;
    buildCellContent(root, newOpts);
  }

  return { root, refresh };
}

function buildCellContent(root, opts) {
  const { entry, group, registered, registerable, reward, onRegister } = opts;
  const gradeMeta = GEAR_GRADES[entry.grade] || { name: entry.grade, color: '#888' };
  const gradeColor = gradeMeta.color;
  // Day 16 후속: gradeName 은 타이틀에서 빠짐 (등급 표시 X → 장비 이름으로 통일).

  /* ── 좌측 이미지 박스 ── */
  const imgBox = document.createElement('div');
  imgBox.className = 'codex-eq-cell__img';
  // 등급 색 외곽 (등록/미등록 무관 — 등록된 도감은 더 진하게 인라인)
  imgBox.style.borderColor = registered
    ? `${gradeColor}cc`
    : `${gradeColor}55`;
  if (registered) {
    imgBox.style.boxShadow = `0 0 10px ${gradeColor}66, inset 0 0 6px ${gradeColor}33`;
  }

  const img = document.createElement('img');
  img.className = 'codex-eq-cell__img-png';
  img.alt = `${entry.slotId} ${entry.grade}`;
  img.src = imagePath(entry.slotId, entry.grade);
  // PNG 로드 실패 시 fallback (회색 박스 + 이름 첫 글자)
  img.onerror = () => {
    img.style.display = 'none';
    const fallback = document.createElement('div');
    fallback.className = 'codex-eq-cell__img-fallback';
    fallback.textContent = '?';
    imgBox.appendChild(fallback);
  };
  imgBox.appendChild(img);

  /* 강화 배지 (+N) — enhance 타입만 */
  if (entry.type === 'enhance' && entry.level) {
    const enhBadge = document.createElement('span');
    enhBadge.className = 'codex-eq-cell__enh-badge';
    enhBadge.textContent = `+${entry.level}`;
    imgBox.appendChild(enhBadge);
  }

  /* 코스메틱 마크 (★) — cosmetic 타입만 */
  if (entry.type === 'cosmetic') {
    const cosMark = document.createElement('span');
    cosMark.className = 'codex-eq-cell__cos-mark';
    cosMark.textContent = '★';
    cosMark.style.color = gradeColor;
    imgBox.appendChild(cosMark);
  }

  /* ── 우측 정보 영역 ── */
  const info = document.createElement('div');
  info.className = 'codex-eq-cell__info';

  // 상단 한 줄: 장비 이름 (등급 prefix + 부위명).
  //   Day 16 후속 (대표 결정):
  //     - 기존: '낚싯대 · 일반'  → 변경: '낡은 낚싯대' (등급 표시 빼고 이름만)
  //     - 강화: '낚싯대 · 일반 +3' → 변경: '+3 낡은 낚싯대' (강화 수치 이름 앞)
  //     - 코스메틱: '낚싯대 · 일반 꾸미기' → 변경: '낡은 낚싯대 꾸미기' (자연스러운 뒤 어미)
  const titleLine = document.createElement('div');
  titleLine.className = 'codex-eq-cell__title';
  const slotName    = SLOT_NAME[entry.slotId] || entry.slotId;
  const gradePrefix = GRADE_PREFIX[entry.grade] || '';
  const baseName    = `${gradePrefix} ${slotName}`;   // 예: '낡은 낚싯대'

  let titleText;
  if (entry.type === 'enhance') {
    titleText = `+${entry.level} ${baseName}`;        // 예: '+3 낡은 낚싯대'
  } else if (entry.type === 'cosmetic') {
    titleText = `${baseName}(꾸미기)`;                 // 예: '낡은 낚싯대(꾸미기)' — ★ Day 22 Phase 7 후속 (대표 결정): 괄호 형식
  } else {
    titleText = baseName;                              // 예: '낡은 낚싯대'
  }
  titleLine.textContent = titleText;
  // 등급 색
  titleLine.style.color = gradeColor;

  // 중단: 보상 텍스트 — "물고기 kg +1.875%" 등
  const rewardLine = document.createElement('div');
  rewardLine.className = 'codex-eq-cell__reward';
  const rewardLabel = REWARD_LABEL[reward.kind] || '보상';
  const valFixed = Number((reward.valuePct || 0).toFixed(3));
  // "+" 표시 — drop 도 %p 형태 (+1.121%)
  const rewardText = reward.kind === 'dropRatePct'
    ? `${rewardLabel}${valFixed}%p`
    : `${rewardLabel} +${valFixed}%`;
  rewardLine.textContent = rewardText;

  info.appendChild(titleLine);
  info.appendChild(rewardLine);

  // ── 우측 액션 영역 (Day 17 후속 — 셀 우측 끝 별도 컬럼) ──
  //   기존: action 영역이 info 안 하단 (3줄 세로). → 2열 그리드에선 좁아져서 짤림.
  //   변경: action 을 info 밖으로 분리 → [이미지 | 정보(이름+보상) | 액션] 3구역 가로 배치.
  const actionLine = document.createElement('div');
  actionLine.className = 'codex-eq-cell__action';

  if (group === 'done') {
    const doneTag = document.createElement('span');
    doneTag.className = 'codex-eq-cell__done';
    doneTag.textContent = '✓';
    actionLine.appendChild(doneTag);
  } else if (group === 'registerable') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'codex-eq-cell__btn';
    btn.textContent = '등록';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      btn.disabled = true;          // 이중 클릭 방지
      onRegister?.(entry.codexKey);
    });
    actionLine.appendChild(btn);
  } else {
    // locked — 가방에 매칭 장비 없음 (Day 17 후속: 잠금/장착도 매칭에서 제외됨)
    const lockedTag = document.createElement('span');
    lockedTag.className = 'codex-eq-cell__locked-tag';
    lockedTag.textContent = '보유 없음';
    actionLine.appendChild(lockedTag);
  }

  root.appendChild(imgBox);
  root.appendChild(info);
  root.appendChild(actionLine);
}