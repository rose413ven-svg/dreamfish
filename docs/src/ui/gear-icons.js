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
const VALID_SLOTS  = new Set(['rod', 'float', 'clothes', 'boat']);

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

const SVG_FACTORIES = { rod: rodSvg, float: floatSvg, clothes: clothesSvg, boat: boatSvg };

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
  if (grade && VALID_GRADES.has(grade)) {
    return createPngIcon(slotId, grade);
  }
  const factory = SVG_FACTORIES[slotId];
  return factory();
}