/* ===========================================
   storage.js — 영구 저장 래퍼
   ============================================
   LocalStorage 위에 얇게 래핑한 단일 진입점.
   Phase 1에서는 첫 실행 / 재실행 판단만 사용.
   추후 닉네임, 진행도, 인벤토리 등 영구 데이터의 출입구가 됨.
   부트스트랩 [절대 금지 사항]: 영구 누적 데이터 무단 변경 금지.
   ============================================ */

import { migrateInventory, syncIdSeq } from '../data/inventory.js';

const KEY = Object.freeze({
  LAUNCHED:            'nangman.launched',            // 첫 실행 여부 플래그
  INVENTORY:           'nangman.inventory',           // 가방 데이터 (Bag-1)
  STAGE_PROGRESS:      'nangman.stageProgress',       // 슬롯 진행도 (Day 6 후반) — ⚠️ Day 21 DEPRECATED (kgCurrent 폐기, turnValue 는 TOTAL_TURN_COUNT 로 이전)
  SLOT_SESSION:        'nangman.slotSession',         // 슬롯 활성 세션 (Day 13 — 콤보+히트팝업+당기기 보존)
  NICKNAME:            'nangman.nickname',            // 닉네임 (Day 7 — 내정보 화면)
  GOLDEN_HIT_SESSION:  'nangman.goldenHitSession',    // 골든힛 타임 활성 세션 (Day 15 — 화면 전환 보존)
  FISH_CODEX:          'nangman.fishCodex',           // 물고기 도감 (Day 16) — { [name]: { registeredAt, bestWeightKg } }
  EQUIPMENT_CODEX:     'nangman.equipmentCodex',      // 장비 도감 (Day 16) — { [codexKey]: { registeredAt } }
  CODEX_NEW_FISH:      'nangman.codexNewFish',        // 미확인 신규 등록 물고기 이름들 (Day 16) — Array<string>
  BAG_NEW_ITEMS:       'nangman.bagNewItems',         // 미확인 신규 가방 장비 id들 (Day 16 후속) — Array<string>
  TOTAL_EXP:           'nangman.totalExp',            // 누적 경험치 = 누적 무게 (Day 18 — 레벨 시스템)
  TOTAL_TURN_COUNT:    'nangman.totalTurnCount',      // ★ Day 21 — 누적 cast 횟수 (전 스테이지 공통 글로벌 카운트, 대표 결정)
  SLOT_LAST_STAGE_ID:  'nangman.lastSlotStageId',     // ★ Day 21 — 마지막 진입 슬롯 stageId (메뉴→가방등 후 재진입 시 복원)
  SEEN_STAGE_IDS:      'nangman.seenStageIds',        // ★ Day 22 Phase 7 후속 — 사용자가 stage-map 에서 본 stage id 목록 (햄버거 빨간점용)
});

/** 안전한 읽기: 예외/미지원 환경에서 null 반환 */
function readRaw(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn('[storage] read 실패:', e);
    return null;
  }
}

/** 안전한 쓰기: 실패 시 false */
function writeRaw(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn('[storage] write 실패:', e);
    return false;
  }
}

/**
 * 첫 실행 여부.
 * true  → 부트스트랩 [화면 흐름] 첫 실행 분기 (splash → start → nickname → ... → slot)
 * false → 재실행 분기 (splash → start → stage-map → stage-intro → slot)
 */
export function isFirstRun() {
  return readRaw(KEY.LAUNCHED) !== '1';
}

/**
 * 첫 실행 흐름을 한 번이라도 통과했음을 기록.
 * 보통 닉네임 입력 완료 또는 awakening 통과 시점에 호출 예정.
 */
export function markAsLaunched() {
  writeRaw(KEY.LAUNCHED, '1');
}

/**
 * 개발/테스트용: 첫 실행 상태로 초기화.
 * 사용자가 명시적으로 요청한 경우만 호출. 자동 호출 금지.
 */
export function resetLaunchFlag() {
  try {
    localStorage.removeItem(KEY.LAUNCHED);
  } catch (e) {
    console.warn('[storage] reset 실패:', e);
  }
}


/* ============================================
   가방 (인벤토리) — Bag-1
   ============================================
   inventory.js 의 Inventory 객체를 LocalStorage 에 직렬화/복원.

   원칙 (부트스트랩 [절대 금지 사항]):
   - 영구 누적 데이터 무단 변경 금지.
   - resetInventory() 는 사용자가 명시적으로 요청한 경우만 호출.

   호출 흐름:
   - loadInventory() : 첫 진입 또는 가방 모달 열 때 1회.
   - saveInventory(inv) : 변경 발생할 때마다 (장착/잠금/폐기 등).
   - resetInventory() : 디버그 메뉴에서 명시적으로.
   ============================================ */

/**
 * 인벤토리 로드.
 * 저장된 데이터 없으면 null 반환 (호출 측에서 makeDefaultInventory 사용).
 * 손상된 데이터는 null 반환 (사용자가 직접 리셋해야 함 — 자동 폐기 X).
 *
 * Day 6: 옛 데이터(옵션/꾸미기 없는 EquipmentItem) 자동 마이그레이션.
 * 변경 발생 시 즉시 저장 (다음 변경 호출까지 안 기다림).
 */
export function loadInventory() {
  const raw = readRaw(KEY.INVENTORY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    // 최소 구조 검증
    if (!data || typeof data !== 'object') return null;
    if (!Array.isArray(data.items)) return null;
    if (typeof data.capacity !== 'number') return null;
    // Day 6: 마이그레이션 (옛 데이터 → 옵션/꾸미기 자동 채움)
    const changed = migrateInventory(data);
    if (changed) {
      // 즉시 저장 — 다음 변경 호출까지 안 기다림 (마이그레이션 결과 영구화)
      writeRaw(KEY.INVENTORY, JSON.stringify(data));
    }
    // Day 9 — Lucky-2 버그 수정: id 시퀀스를 인벤토리 최대값에 맞춰 동기화.
    // 이게 없으면 페이지 reload 후 _idSeq=0 으로 시작 → 새 makeEquipment 호출 시
    // eq_1 부터 다시 만들어져 기존 장비와 id 충돌 → 컨텍스트 메뉴/장착 오작동.
    syncIdSeq(data.items);
    return data;
  } catch (e) {
    console.warn('[storage] inventory parse 실패:', e);
    return null;
  }
}

/** 인벤토리 저장. 변경 발생 시마다 호출. */
export function saveInventory(inv) {
  if (!inv || !Array.isArray(inv.items)) {
    console.warn('[storage] invalid inventory:', inv);
    return false;
  }
  return writeRaw(KEY.INVENTORY, JSON.stringify(inv));
}

/**
 * 개발/테스트용: 가방 초기화 (저장된 데이터 삭제).
 * 다음 loadInventory() 는 null 반환 → 호출 측에서 makeDefaultInventory 호출.
 */
export function resetInventory() {
  try {
    localStorage.removeItem(KEY.INVENTORY);
  } catch (e) {
    console.warn('[storage] inventory reset 실패:', e);
  }
}

/* ============================================
   슬롯 진행도 (Day 6 후반 — 화면 전환 시 무게바 초기화 방지)
   ============================================
   ⚠️ Day 21 (대표 결정) — DEPRECATED ⚠️
   - kgCurrent 변수 폐기 (Day 18 에서 게이지 시스템이 EXP 게이지로 통합된 후 사실상 미사용)
   - turnValue 는 TOTAL_TURN_COUNT (글로벌, 스테이지 무관 누적) 로 이전 — 대표 결정.
   - 기존 데이터(stageProgress 키)는 안 지움 (안전상) — 로드 시 무시.
   - 본 함수들은 미래 호환 위해 남겨두지만 신규 호출 X.

   ── 이전 동작(폐기됨) ──
   슬롯 화면 mount/unmount 사이에 kgCurrent 가 클로저 변수라 사라지는 문제 해결.
   다른 화면(가방/강화/합성/도감) 갔다 와도 진행도 그대로 유지.
   stageId 가 바뀌면 (다른 stage 진입) 새 stage 진행도는 0부터 시작.
   ============================================ */

/**
 * @deprecated Day 21 — kgCurrent 폐기 + turnValue 글로벌 이전. 신규 호출 X.
 * 슬롯 진행도 저장.
 * Day 10 v2 — turnValue 추가 (대표 결정 — 재접속 시 턴 카운트 유지).
 *
 * @param {number} stageId
 * @param {number} kgCurrent
 * @param {number} [turnValue=0]
 */
export function saveStageProgress(stageId, kgCurrent, turnValue = 0) {
  if (typeof stageId !== 'number' || typeof kgCurrent !== 'number') {
    console.warn('[storage] invalid stage progress:', stageId, kgCurrent);
    return;
  }
  if (typeof turnValue !== 'number' || turnValue < 0) turnValue = 0;
  writeRaw(KEY.STAGE_PROGRESS, JSON.stringify({ stageId, kgCurrent, turnValue }));
}

/**
 * @deprecated Day 21 — kgCurrent 폐기 + turnValue 글로벌 이전. 신규 호출 X.
 * 슬롯 진행도 로드.
 *
 * @returns {{ stageId: number, kgCurrent: number, turnValue: number } | null}
 */
export function loadStageProgress() {
  const raw = readRaw(KEY.STAGE_PROGRESS);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (typeof data?.stageId !== 'number') return null;
    if (typeof data?.kgCurrent !== 'number') return null;
    const turnValue = (typeof data.turnValue === 'number' && data.turnValue >= 0)
      ? data.turnValue
      : 0;
    return { stageId: data.stageId, kgCurrent: data.kgCurrent, turnValue };
  } catch (e) {
    console.warn('[storage] stage progress parse 실패:', e);
    return null;
  }
}

/** 슬롯 진행도 리셋 (개발/디버그 용)
 *  @deprecated Day 21 — 신규 호출 X. */
export function resetStageProgress() {
  try {
    localStorage.removeItem(KEY.STAGE_PROGRESS);
  } catch (e) {
    console.warn('[storage] stage progress reset 실패:', e);
  }
}

/* ============================================
   ★ Day 21 — 누적 cast 횟수 (전 스테이지 공통 글로벌) ★
   ============================================
   대표 결정: 스테이지가 바뀌어도 턴 횟수가 초기화되지 않게 변경.
   - 모든 스테이지 통틀어 매 cast (1회 회전) 마다 +1 누적.
   - 키: TOTAL_TURN_COUNT — 단일 정수 (kgCurrent 같은 부가 데이터 X)
   - 매 cast 마다 영구 저장 (재접속 시 복원).
   ============================================ */

/**
 * 누적 cast 횟수 저장 (글로벌, 스테이지 무관).
 * @param {number} count
 */
export function saveTotalTurnCount(count) {
  if (typeof count !== 'number' || count < 0) {
    console.warn('[storage] invalid total turn count:', count);
    return;
  }
  writeRaw(KEY.TOTAL_TURN_COUNT, String(Math.floor(count)));
}

/**
 * 누적 cast 횟수 로드. 미저장 시 0 반환.
 * @returns {number}
 */
export function loadTotalTurnCount() {
  const raw = readRaw(KEY.TOTAL_TURN_COUNT);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return (Number.isFinite(n) && n >= 0) ? n : 0;
}

/** 누적 cast 횟수 리셋 (개발/디버그 용) */
export function resetTotalTurnCount() {
  try {
    localStorage.removeItem(KEY.TOTAL_TURN_COUNT);
  } catch (e) {
    console.warn('[storage] total turn count reset 실패:', e);
  }
}

/* ============================================
   ★ Day 21 — 마지막 진입 슬롯 stageId ★
   ============================================
   메뉴 → 가방/강화/맵/도감 → 뒤로 → 슬롯 재진입 시 stageId 복원 용.
   기존 stageProgress.stageId 가 담당하던 역할 (Day 19) 을 분리/이전.
   ============================================ */

/**
 * 마지막 진입 슬롯 stageId 저장.
 * @param {number} stageId
 */
export function saveLastSlotStageId(stageId) {
  if (typeof stageId !== 'number') {
    console.warn('[storage] invalid last slot stageId:', stageId);
    return;
  }
  writeRaw(KEY.SLOT_LAST_STAGE_ID, String(stageId));
}

/**
 * 마지막 진입 슬롯 stageId 로드. 미저장 시 null.
 * @returns {number|null}
 */
export function loadLastSlotStageId() {
  const raw = readRaw(KEY.SLOT_LAST_STAGE_ID);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

/* ============================================
   ★ Day 22 Phase 7 후속 — 사용자가 본 stage id 목록 (햄버거 빨간점용)
   ============================================
   stage-map 에서 stage 카드로 스와이프/동그라미 클릭 시 호출되어
   해당 stageId 를 누적 저장. 햄버거 메뉴 빨간점은:
     "잠금 해제된 stage 중 SEEN_STAGE_IDS 에 없는 게 있으면 표시"
   stage 카드를 보면 빨간점이 사라지는 컨셉 (가방/도감 빨간점과 유사).
   ============================================ */

/**
 * 사용자가 본 stage id 목록 로드.
 * @returns {number[]}
 */
export function getSeenStageIds() {
  const raw = readRaw(KEY.SEEN_STAGE_IDS);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(n => typeof n === 'number') : [];
  } catch (e) {
    console.warn('[storage] seenStageIds 파싱 실패:', e);
    return [];
  }
}

/**
 * stageId 를 본 것으로 누적 저장 (중복 추가 X).
 * @param {number} stageId
 */
export function addSeenStageId(stageId) {
  if (typeof stageId !== 'number') {
    console.warn('[storage] invalid seenStageId:', stageId);
    return;
  }
  const cur = getSeenStageIds();
  if (cur.includes(stageId)) return;
  cur.push(stageId);
  writeRaw(KEY.SEEN_STAGE_IDS, JSON.stringify(cur));
}

/** seenStageIds 초기화 (테스트/리셋 용). */
export function resetSeenStageIds() {
  try {
    localStorage.removeItem(KEY.SEEN_STAGE_IDS);
  } catch (e) {
    console.warn('[storage] resetSeenStageIds 실패:', e);
  }
}

/* ============================================
   슬롯 활성 세션 (Day 13 — 콤보+히트팝업+당기기 보존)
   ============================================
   슬롯 화면에서 강화/합성/도감/가방 등 다른 화면으로 다녀와도
   진행 중이던 활성 상태가 그대로 유지되도록 보존.

   stageProgress 와의 차이:
   - stageProgress = "스테이지 누적 진행도" (kg, turn) — 영구 누적
   - slotSession   = "현재 진행 중인 활성 흐름" (콤보, 잡기 대기 큐) — 일회성

   저장 시점: 슬롯 화면 unmount 시 (활성 흐름 진행 중이면)
   복원 시점: 슬롯 화면 mount 시 (sameStage + 세션 있으면)
   초기화 시점:
     - 활성 흐름 끝 (finishTurn 도달) → resetSlotSession (다음 진입 시 깨끗 시작)
     - stageId 변경 (다른 스테이지 진입) → 무시 (mount 시점에 자동 폐기)

   세션 데이터 구조 (모두 직렬화 가능 plain object):
     {
       stageId:             number,
       comboCount:          number,
       castState:           'cast'|'pull'|'wait',
       biteAlertActive:     boolean,
       biteAlertInfo:       { count, grades, hasBoss } | null,
       resultQueue:         array (잡기 대기 결과 N개 — fish 객체 포함, JSON 가능),
       pendingHasBoss:      boolean,
       pendingGoldenTrigger: boolean,
       autoMode:            boolean,
     }
   ============================================ */

/**
 * 슬롯 활성 세션 저장.
 * @param {object} session — 위 구조 객체
 * @returns {boolean} 성공 여부
 */
export function saveSlotSession(session) {
  if (!session || typeof session !== 'object') {
    console.warn('[storage] invalid slot session:', session);
    return false;
  }
  if (typeof session.stageId !== 'number') {
    console.warn('[storage] slot session stageId 누락:', session);
    return false;
  }
  return writeRaw(KEY.SLOT_SESSION, JSON.stringify(session));
}

/**
 * 슬롯 활성 세션 로드.
 * 손상되거나 없으면 null.
 * @returns {object|null}
 */
export function loadSlotSession() {
  const raw = readRaw(KEY.SLOT_SESSION);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (typeof data.stageId !== 'number') return null;
    return data;
  } catch (e) {
    console.warn('[storage] slot session parse 실패:', e);
    return null;
  }
}

/** 슬롯 활성 세션 초기화 (활성 흐름 끝났을 때 / 디버그). */
export function resetSlotSession() {
  try {
    localStorage.removeItem(KEY.SLOT_SESSION);
  } catch (e) {
    console.warn('[storage] slot session reset 실패:', e);
  }
}

/* ============================================
   골든힛 타임 활성 세션 (Day 15)
   ============================================
   화면 전환 (가방 모달, 강화 화면 등) 시 골든힛 상태 보존용.
   같은 stageId 면 mount 시 복원, 다른 stageId 면 reset.
   { stageId, isActive, remaining, savedComboCount }
   ============================================ */

export function saveGoldenHitSession(session) {
  if (!session || typeof session !== 'object') {
    console.warn('[storage] invalid goldenHit session:', session);
    return false;
  }
  if (typeof session.stageId !== 'number') {
    console.warn('[storage] goldenHit session stageId 누락:', session);
    return false;
  }
  return writeRaw(KEY.GOLDEN_HIT_SESSION, JSON.stringify(session));
}

export function loadGoldenHitSession() {
  const raw = readRaw(KEY.GOLDEN_HIT_SESSION);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (typeof data.stageId !== 'number') return null;
    return data;
  } catch (e) {
    console.warn('[storage] goldenHit session parse 실패:', e);
    return null;
  }
}

export function resetGoldenHitSession() {
  try {
    localStorage.removeItem(KEY.GOLDEN_HIT_SESSION);
  } catch (e) {
    console.warn('[storage] goldenHit session reset 실패:', e);
  }
}

/* ============================================
   닉네임 (Day 7 — 내정보 화면)
   ============================================
   nickname 화면이 아직 스텁이라 임시 placeholder 사용.
   추후 nickname 화면 활성화 시 saveNickname 호출하면 됨.
   ============================================ */

const DEFAULT_NICKNAME = '낭만대표';

/**
 * 닉네임 저장.
 * @param {string} name
 */
export function saveNickname(name) {
  if (typeof name !== 'string' || !name.trim()) {
    console.warn('[storage] invalid nickname:', name);
    return;
  }
  writeRaw(KEY.NICKNAME, name.trim());
}

/**
 * 닉네임 로드. 저장된 값이 없으면 기본값 반환.
 * @returns {string}
 */
export function loadNickname() {
  const raw = readRaw(KEY.NICKNAME);
  return raw || DEFAULT_NICKNAME;
}

/** 닉네임 리셋 (개발/디버그 용). 다음 loadNickname 은 기본값 반환. */
export function resetNickname() {
  try {
    localStorage.removeItem(KEY.NICKNAME);
  } catch (e) {
    console.warn('[storage] nickname reset 실패:', e);
  }
}

/* ============================================
   도감 — 물고기 (Day 16)
   ============================================
   데이터 구조: { [fishName: string]: { registeredAt: number, bestWeightKg: number } }
   - fishName 키 = 도감의 unique identifier (등급 가리지 않고 이름 기준 단일 셀)
   - 존재 = 등록됨
   - bestWeightKg = 잡힐 때마다 갱신 (현재 무게가 더 크면 덮어씀)
   ============================================ */

/** 도감 빈 상태 디폴트 */
function emptyFishCodex() { return {}; }

/**
 * 물고기 도감 로드.
 * @returns {object} { [name]: { registeredAt, bestWeightKg } }
 */
export function loadFishCodex() {
  const raw = readRaw(KEY.FISH_CODEX);
  if (!raw) return emptyFishCodex();
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return emptyFishCodex();
    return data;
  } catch (e) {
    console.warn('[storage] fish codex parse 실패:', e);
    return emptyFishCodex();
  }
}

/**
 * 물고기 도감 저장 (전체 덮어쓰기).
 * @param {object} codex
 */
export function saveFishCodex(codex) {
  if (!codex || typeof codex !== 'object') {
    console.warn('[storage] invalid fish codex:', codex);
    return false;
  }
  return writeRaw(KEY.FISH_CODEX, JSON.stringify(codex));
}

/** 물고기 도감 리셋 (개발/디버그 용). */
export function resetFishCodex() {
  try {
    localStorage.removeItem(KEY.FISH_CODEX);
  } catch (e) {
    console.warn('[storage] fish codex reset 실패:', e);
  }
}

/* ============================================
   도감 — 장비 (Day 16)
   ============================================
   데이터 구조: { [codexKey: string]: { registeredAt: number } }
   - codexKey 형식:
     · base:      '{slot}_{grade}'             예: 'rod_legendary'
     · enhance:   '{slot}_{grade}_e{level}'    예: 'rod_legendary_e7'  (level ∈ 3,5,7,10)
     · cosmetic:  '{slot}_{grade}_cos'         예: 'rod_legendary_cos'
   - 존재 = 등록됨 (등록 후 영구 유지)
   ============================================ */

function emptyEquipmentCodex() { return {}; }

/** 장비 도감 로드. */
export function loadEquipmentCodex() {
  const raw = readRaw(KEY.EQUIPMENT_CODEX);
  if (!raw) return emptyEquipmentCodex();
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return emptyEquipmentCodex();
    return data;
  } catch (e) {
    console.warn('[storage] equipment codex parse 실패:', e);
    return emptyEquipmentCodex();
  }
}

/** 장비 도감 저장 (전체 덮어쓰기). */
export function saveEquipmentCodex(codex) {
  if (!codex || typeof codex !== 'object') {
    console.warn('[storage] invalid equipment codex:', codex);
    return false;
  }
  return writeRaw(KEY.EQUIPMENT_CODEX, JSON.stringify(codex));
}

/** 장비 도감 리셋. */
export function resetEquipmentCodex() {
  try {
    localStorage.removeItem(KEY.EQUIPMENT_CODEX);
  } catch (e) {
    console.warn('[storage] equipment codex reset 실패:', e);
  }
}

/* ============================================
   도감 — 미확인 신규 등록 물고기 (Day 16)
   ============================================
   잡기 성공 시 자동 등록된 신규 물고기 이름들을 누적.
   사용자가 도감 화면 (물고기 탭) 진입/이탈 시 clear → 빨간점 사라짐.
   ============================================ */

/** 미확인 신규 물고기 이름 배열 로드. */
export function loadCodexNewFishNames() {
  const raw = readRaw(KEY.CODEX_NEW_FISH);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(s => typeof s === 'string');
  } catch (e) {
    console.warn('[storage] codex new fish parse 실패:', e);
    return [];
  }
}

/** 미확인 신규 물고기 이름 배열 저장 (전체 덮어쓰기). */
export function saveCodexNewFishNames(names) {
  if (!Array.isArray(names)) {
    console.warn('[storage] invalid codex new fish names:', names);
    return false;
  }
  return writeRaw(KEY.CODEX_NEW_FISH, JSON.stringify(names));
}

/** 미확인 신규 물고기 모두 clear (사용자 확인 처리). */
export function clearCodexNewFishNames() {
  try {
    localStorage.removeItem(KEY.CODEX_NEW_FISH);
  } catch (e) {
    console.warn('[storage] codex new fish clear 실패:', e);
  }
}


/* ============================================
   가방 — 미확인 신규 장비 (Day 16 후속)
   ============================================
   drop 으로 새 장비가 가방에 들어왔을 때 그 장비의 id 를 누적.
   사용자가 가방 진입 후 셀 터치 또는 가방 닫기 시 모두 clear → 빨간점 사라짐.
   ============================================ */

/** 미확인 신규 가방 장비 id 배열 로드. */
export function loadBagNewItemIds() {
  const raw = readRaw(KEY.BAG_NEW_ITEMS);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(s => typeof s === 'string');
  } catch (e) {
    console.warn('[storage] bag new items parse 실패:', e);
    return [];
  }
}

/** 단일 id 추가 (중복 방지). */
export function addBagNewItemId(id) {
  if (!id || typeof id !== 'string') return false;
  const list = loadBagNewItemIds();
  if (list.includes(id)) return false;
  list.push(id);
  return writeRaw(KEY.BAG_NEW_ITEMS, JSON.stringify(list));
}

/** 미확인 신규 가방 장비 모두 clear (사용자 확인 처리). */
export function clearBagNewItemIds() {
  try {
    localStorage.removeItem(KEY.BAG_NEW_ITEMS);
  } catch (e) {
    console.warn('[storage] bag new items clear 실패:', e);
  }
}


/* ============================================
   누적 경험치 (Day 18 — 레벨 시스템)
   ============================================
   - 누적 무게(kg) = 누적 경험치 (단일 값, 음수 없음)
   - level-engine.js 가 모듈 로드 시 loadTotalExp() / addExp 시 saveTotalExp() 자동 호출
   - 재접속 시 자동 복원 → 레벨 / 진행도 유지
   ============================================ */

/**
 * 누적 경험치 저장.
 * @param {number} value - kg 단위 누적값 (음수는 0으로 클램프)
 */
export function saveTotalExp(value) {
  const n = Math.max(0, Number(value) || 0);
  writeRaw(KEY.TOTAL_EXP, String(n));
}

/**
 * 누적 경험치 로드. 저장 없으면 0.
 * @returns {number}
 */
export function loadTotalExp() {
  const raw = readRaw(KEY.TOTAL_EXP);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** 누적 경험치 리셋 (개발/디버그). */
export function resetTotalExp() {
  try {
    localStorage.removeItem(KEY.TOTAL_EXP);
  } catch (e) {
    console.warn('[storage] totalExp reset 실패:', e);
  }
}