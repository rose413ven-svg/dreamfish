/* ===========================================
   twinkle-session.js — 트윙클 타임 세션 (Day 20 신규)
   ============================================
   대표 명시:
   - "다른화면에 들어가도 계속 돌게" → unmount 시 세션 저장 + leftAt 기록.
                                       mount 시 경과 시간만큼 백그라운드 시뮬레이션.
   - "앱 종료/리로드 시 보상 없이 취소" → 영구 저장(localStorage) X.
                                          module-level 변수만 사용 → 페이지 리로드 시 자연스럽게 사라짐.

   슬롯 화면 unmount → saveTwinkleSession({ ...state, leftAt })
   슬롯 화면 mount   → loadTwinkleSession() → 시뮬레이션 → clearTwinkleSession()
   ============================================ */

/**
 * @typedef {object} TwinkleSession
 * @property {string|number} stageId      어느 스테이지에서 진입했는지 (다른 스테이지면 취소)
 * @property {boolean} started            첫 cast 클릭 여부 (false면 백그라운드 진행 안 함 — 대표 명시)
 * @property {number} remaining           남은 자동 캐스트 횟수
 * @property {number} savedComboCount     진입 직전 콤보 (종료 시 복원)
 * @property {Array<Array<string>>|null} savedGridData  진입 직전 슬롯 그리드 (복원용 깊은 복사)
 * @property {Array<{row:number,col:number}>} lockedCells  잠긴 꿈조각 셀 누적
 * @property {number} rewardCount         누적 꿈조각 보상 수
 * @property {number} leftAt              화면 떠난 시점 timestamp (Date.now)
 */

/** 모듈 레벨 트윙클 세션 (앱 리로드 시 사라짐). */
let _twinkleSession = null;

/**
 * 트윙클 세션 저장 (슬롯 화면 unmount 시).
 * @param {TwinkleSession} data
 */
export function saveTwinkleSession(data) {
  _twinkleSession = { ...data };
}

/**
 * 트윙클 세션 로드 (슬롯 화면 mount 시).
 * @returns {TwinkleSession|null}
 */
export function loadTwinkleSession() {
  return _twinkleSession ? { ..._twinkleSession } : null;
}

/**
 * 트윙클 세션 클리어 (mount 후 복원 완료 시점에 호출).
 */
export function clearTwinkleSession() {
  _twinkleSession = null;
}