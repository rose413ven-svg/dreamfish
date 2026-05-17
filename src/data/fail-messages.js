/* ===========================================
   fail-messages.js — 실패 메시지 풀
   ============================================
   같은 메시지 반복 방지 → 랜덤 선택
   ============================================ */

export const FAIL_MESSAGES = [
  '입질이 없다',
  '조용하다...',
  '흠...',
  '다음을 기약한다..',
];

/**
 * 랜덤하게 하나 선택
 */
export function pickFailMessage() {
  const i = Math.floor(Math.random() * FAIL_MESSAGES.length);
  return FAIL_MESSAGES[i];
}