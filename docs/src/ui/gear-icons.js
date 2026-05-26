/* ===========================================
   gear-icons.js — 장비 부위 아이콘 (PNG + SVG hybrid)
   ============================================
   docs/01_슬롯화면_디자인.md [장비 부위 아이콘] SSOT.

   Day 14 ★ — 카툰 PNG 적용 (대표 결정 — 24장 등급별 시안).
   동작:
   - createGearIcon(slotId, grade) → 등급 PNG <img> 반환 (장착)
   - createGearIcon(slotId)        → 기존 미니멀 SVG 반환 (미장착 호환 fallback)

   PNG 자산: public/assets/images/equipment/{slotId}_{grade}.png  (24장)
     slotId: rod | float | clothes | boat
     grade:  common | uncommon | rare | epic | legendary | mythic

   SVG fallback (미장착) 디자인:
   - viewBox 0 0 24 24, stroke 1.2px, currentColor 기반 미니멀 톤
   - 미장착 칸은 회색 점선 + 부위 안내용 SVG 그대로 유지 (게임 정체성 — 단정한 미니멀리즘)
   ============================================ */

const NS = 'http://www.w3.org/2000/svg';

const PNG_BASE = 'assets/images/equipment';
const VALID_GRADES = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']);
// ★ Day 29 — hook, pet 추가 (장비 6부위)
const VALID_SLOTS  = new Set(['rod', 'float', 'clothes', 'boat', 'hook', 'pet']);
/** ★ Day 29 — PNG 카툰 아이콘 준비된 부위 (나머지는 SVG fallback 사용).
 *  hook/pet 은 PNG 미준비 → 항상 SVG. 추후 PNG 작업 후 이 set 에 추가. */
const PNG_READY_SLOTS = new Set(['rod', 'float', 'clothes', 'boat']);

function buildPngPath(slotId, grade) {
  return `${PNG_BASE}/${slotId}_${grade}.png`;
}

/* ============================================
   PNG <img> 반환 (장착 분기)
   ============================================ */
function createPngIcon(slotId, grade) {
  const img = document.createElement('img');
  img.src = buildPngPath(slotId, grade);
  img.alt = '';
  img.draggable = false;
  img.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain;pointer-events:none;';
  return img;
}

/* ============================================
   SVG fallback (미장착) — 기존 미니멀 톤 유지
   ============================================ */

function makeSvg(extraAttrs = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.2');
  for (const [k, v] of Object.entries(extraAttrs)) svg.setAttribute(k, v);
  return svg;
}

function appendPath(svg, d) {
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
}

function appendDot(svg, cx, cy, r) {
  const c = document.createElementNS(NS, 'circle');
  c.setAttribute('cx', String(cx));
  c.setAttribute('cy', String(cy));
  c.setAttribute('r', String(r));
  c.setAttribute('fill', 'currentColor');
  c.setAttribute('stroke', 'none');
  svg.appendChild(c);
}

function appendCircle(svg, cx, cy, r) {
  const c = document.createElementNS(NS, 'circle');
  c.setAttribute('cx', String(cx));
  c.setAttribute('cy', String(cy));
  c.setAttribute('r', String(r));
  svg.appendChild(c);
}

function rodSvg() {
  const svg = makeSvg({ 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  appendPath(svg, 'M3 21 L7 17');
  appendCircle(svg, 5.4, 18.6, 1.5);
  appendPath(svg, 'M7 17 L20 4');
  appendDot(svg, 12.5, 11.5, 0.6);
  appendDot(svg, 16, 8, 0.6);
  appendPath(svg, 'M20 4 Q22.5 13 18 21');
  appendPath(svg, 'M18 21 L16.2 19.5 L17.2 17.8');
  return svg;
}

function floatSvg() {
  const svg = makeSvg({ 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  appendDot(svg, 12, 1.6, 0.9);
  appendPath(svg, 'M12 2.5 L12 7');
  appendPath(svg, 'M8 12 Q8 7 12 7 Q16 7 16 12');
  appendPath(svg, 'M8 12 L16 12');
  appendPath(svg, 'M8 12 Q8 17 12 17 Q16 17 16 12');
  appendPath(svg, 'M12 17 L12 22');
  return svg;
}

function clothesSvg() {
  const svg = makeSvg({ 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  appendPath(svg, 'M10 5 L14 5');
  appendPath(svg, 'M10 5 L12 8.5 L14 5');
  appendPath(svg, 'M10 5 L5 8 L5 11 L7 11');
  appendPath(svg, 'M14 5 L19 8 L19 11 L17 11');
  appendPath(svg, 'M7 11 L7 21 L17 21 L17 11');
  return svg;
}

function boatSvg() {
  const svg = makeSvg({ 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  appendDot(svg, 12, 4, 1.0);
  appendPath(svg, 'M12 5 L12 8');
  appendPath(svg, 'M8 11 Q12 7.5 16 11');
  appendPath(svg, 'M8 11 L8 16 L16 16 L16 11');
  appendCircle(svg, 12, 13, 1.1);
  appendPath(svg, 'M3 16 L21 16');
  appendPath(svg, 'M3 16 Q4 21 8 21 L16 21 Q20 21 21 16');
  return svg;
}

/** ★ Day 29 — 낚시바늘 (J자 + 끝 미늘) */
function hookSvg() {
  const svg = makeSvg({ 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  // 매듭(고리) — 상단
  appendCircle(svg, 12, 3.2, 1.0);
  // 줄 — 위에서 아래로
  appendPath(svg, 'M12 4.2 L12 12');
  // J자 곡선 — 아래로 내려가 좌측으로 휘어 위로
  appendPath(svg, 'M12 12 Q12 19 8 19 Q4.5 19 4.5 15');
  // 끝 미늘 — 안쪽 작은 가시
  appendPath(svg, 'M4.5 15 L6.2 15.8');
  return svg;
}

/** ★ Day 29 — 펫 (귀여운 동물 얼굴 — 머리 + 귀 + 눈) */
function petSvg() {
  const svg = makeSvg({ 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  // 머리 (얼굴 큰 원)
  appendCircle(svg, 12, 13.5, 6);
  // 귀 (양쪽 삼각형)
  appendPath(svg, 'M7.2 9 L5.8 5.2 L9.5 7.8 Z');
  appendPath(svg, 'M16.8 9 L18.2 5.2 L14.5 7.8 Z');
  // 눈 (양쪽 점)
  appendDot(svg, 9.8, 13, 0.7);
  appendDot(svg, 14.2, 13, 0.7);
  // 코 (작은 점)
  appendDot(svg, 12, 15, 0.6);
  // 입 (작은 곡선)
  appendPath(svg, 'M10.8 16.4 Q12 17.4 13.2 16.4');
  return svg;
}

const SVG_FACTORIES = {
  rod:     rodSvg,
  float:   floatSvg,
  clothes: clothesSvg,
  boat:    boatSvg,
  hook:    hookSvg,    // ★ Day 29
  pet:     petSvg,     // ★ Day 29
};

/**
 * 장비 부위 아이콘 생성.
 *
 * Day 14 ★ — grade 인자에 따라 PNG (장착) / SVG (미장착) 분기.
 *
 * @param {'rod'|'float'|'clothes'|'boat'} slotId 부위 ID
 * @param {'common'|'uncommon'|'rare'|'epic'|'legendary'|'mythic'} [grade] 등급 (있으면 PNG, 없으면 SVG)
 * @returns {HTMLImageElement|SVGSVGElement}
 *   - grade 있음 → <img> (PNG, 카툰 톤, 등급별 다른 디자인)
 *   - grade 없음 → <svg> (미니멀 톤, 미장착 안내용)
 */
export function createGearIcon(slotId, grade = null) {
  if (!VALID_SLOTS.has(slotId)) {
    throw new Error(`[gear-icons] unknown slotId: ${slotId}`);
  }
  // ★ Day 29 — hook/pet 은 PNG 미준비 → 항상 SVG fallback.
  //   추후 PNG 작업 후 PNG_READY_SLOTS 에 추가하면 자동으로 PNG 분기.
  if (grade && VALID_GRADES.has(grade) && PNG_READY_SLOTS.has(slotId)) {
    return createPngIcon(slotId, grade);
  }
  const factory = SVG_FACTORIES[slotId];
  return factory();
}