/* ===========================================
   slot.js — 9. 슬롯 (메인 게임플레이)
   ============================================
   Phase 3-2 v9:
   - 덩어리별 다른 색으로 매칭 강조 (1~6)
   ============================================ */

import { createStarfield } from '../ui/starfield.js';
import { createHud } from '../ui/hud.js';
import { createSlotGrid, fillGrid, spinGrid } from '../ui/slot-grid.js';
import { createTurnCounter } from '../ui/turn-counter.js';
import { createGearSlot } from '../ui/gear-slot.js';
import { createCastButton } from '../ui/cast-button.js';
import { createMenuPanel } from '../ui/menu-panel.js';
import { createBagModal } from '../ui/bag-modal.js';
import { createProfileModal } from '../ui/profile-modal.js';
import { createBobber, castBobber, biteBobber, hideBobber, syncFloatCosmeticParticles } from '../ui/float-bobber.js';
import { createBiteAlert, showBiteAlert, hideBiteAlert } from '../ui/bite-alert.js';
import { showLuckyLuckyEffect, hideLuckyLuckyEffect } from '../ui/lucky-lucky-effect.js';
import { createFishResult, showFishResult } from '../ui/fish-result.js';
// Day 18 후속 (대표 결정) — drawGoldenLine 재활성 + startGoldenParticles 추가
//   황금 매칭 발견 시 발광 + 선 연결 + 화면 전체 입자 → 끝나면 골든힛 진입 팝업
import { drawGoldenLine, startGoldenParticles } from '../ui/golden-line.js';
// Day 20: 꿈조각(트윙클) 매칭 연결선 + 입자 — golden-line 의 톤 변경판
import { drawTwinkleLine, startTwinkleParticles } from '../ui/twinkle-line.js';
import { createTwinkleIntro, showTwinkleIntro } from '../ui/twinkle-intro.js';
import { createMythicIntro, showMythicIntro } from '../ui/mythic-intro.js';
import { createSpecialMythicHitIntro, showSpecialMythicHitIntro, hideSpecialMythicHitIntro } from '../ui/special-mythic-hit-intro.js';
import { createTwinkleCardGame } from '../ui/twinkle-card-game.js';
import { createTwinkleRewardPopup } from '../ui/twinkle-reward-popup.js';
// Day 20 Phase 5: 트윙클 세션 (다른 화면 다녀와도 백그라운드 진행 — module-level, 앱 리로드 시 사라짐)
import { saveTwinkleSession, loadTwinkleSession, clearTwinkleSession } from '../data/twinkle-session.js';
// ★ Day 22: HIDDEN HIT(분홍) 매칭 연결선 + 입자 — golden-line 의 톤 변경판 (Phase 2)
import { drawHiddenLine, startHiddenParticles } from '../ui/hidden-line.js';
// ★ Day 22: HIDDEN HIT 진입 트리거 판단 (Phase 2)
import { shouldTriggerHiddenHit, rollHiddenDropGrade } from '../data/hidden-hit-engine.js';
// ★ Day 22: HIDDEN BOSS 진입 팝업 (Phase 3)
import { createHiddenIntro, showHiddenIntro } from '../ui/hidden-intro.js';
// ★ Day 22: HIDDEN HIT 카드뒤집기 (Phase 6 — X1/X3/X5 무게 보너스)
import { createHiddenCardFlip, showHiddenCardFlip } from '../ui/hidden-card-flip.js';
import { createMinigameIntro, showMinigameIntro } from '../ui/minigame-intro.js';
// Day 19 — 골든힛 타임 동안 슬롯 그리드 안에 별빛 입자 필드 (라스베가스 마퀴 대체).
import { createSparkleField } from '../ui/sparkle-stars.js';

import { GEAR_SLOTS } from '../data/gear-slots.js';
import { getStage, clampGradeForStage, rollDropCount } from '../data/stages.js';
import { pickFishByGrade, pickMythicFish, pickGoldenDreamWhale, GOLDEN_FISH } from '../data/fish-data.js';

// Bag-4: 가방 ↔ 슬롯 장비칸 연동
// Lucky-2 (Day 9): 드롭 시스템 — tryRollDrop / addEquipment / saveInventory 추가
// Day 13 — 슬롯 활성 세션 보존 (콤보+히트팝업+당기기 유지)
// ★ Day 21 — saveStageProgress/loadStageProgress 폐기 (kgCurrent 변수 정리, 대표 결정).
//            글로벌 turnCount 로 이전 (saveTotalTurnCount/loadTotalTurnCount).
//            stageId 유지는 별도 saveLastSlotStageId/loadLastSlotStageId 로 분리.
import {
  loadInventory, saveInventory,
  saveTotalTurnCount, loadTotalTurnCount,
  saveLastSlotStageId, loadLastSlotStageId,
  saveSlotSession, loadSlotSession, resetSlotSession,
  saveGoldenHitSession, loadGoldenHitSession, resetGoldenHitSession,
  addBagNewItemId, loadBagNewItemIds,   // Day 16 후속: 가방 새 장비 빨간점
  getSeenStageIds,                      // ★ Day 22 Phase 7 후속 — 햄버거 stage-map 빨간점용
} from '../core/storage.js';
import { getActiveOptions, getAdjustedSymbolList, applyWeight, calcComboBonus } from '../data/equipment-effects.js';
import { getEquippedBySlot, isFull, makeEquipment, makeDefaultInventory, addEnhanceStone, countEnhanceStones } from '../data/inventory.js';
import { getCatalogEntry } from '../data/equipment-catalog.js';
import { tryRollDrop, checkDropChance, rollDropGrade, rollDropSlot } from '../data/equipment-meta.js';
// Day 10 — 세트 효과 (Phase A)
import { getSetGrade, getSetWeightBonus, getSetDropRateBonus } from '../data/set-effects.js';
import { openEquipmentContextMenu } from '../ui/equipment-context-menu.js';
import { createComboText, showComboText, hideComboText, showGoldenHitCount, hideGoldenHitCount, showTwinkleChance, hideTwinkleChance } from '../ui/combo-text.js';
// ★ Day 26 — 까비까비 텍스트 오버레이 (Mixed 클러스터 무게 표시)
import { showKabikabiClusterText, clearAllKabikabiText } from '../ui/kabikabi-text.js';
// ★ Day 26 — 최종무게 버스트 (대표 결정 시안 B — 슬롯 가운데 큰 글자 + 노랑 + 충격 링)
import { showCenterGainBurst } from '../ui/gain-burst.js';
import { createStatsBar } from '../ui/stats-bar.js';
// Day 16 — 도감 빨간점 알림 + 도감 보너스 통합
import {
  getNewlyRegisteredFishNames,
  hasUnregisteredEquipmentInBag,
  getCodexBonuses,
} from '../data/codex-engine.js';

import { generateGrid, emptyGrid } from '../engine/grid.js';
import { findClusters, findGoldenClusters, findTwinkleClusters, findKabikabiClusters, findMaxClusterSizeFromCells, findClustersInCells, gradeOf, GRADE_RANK } from '../engine/cluster.js';
import { rollWeight } from '../engine/weight.js';

// Day 15: 골든힛 타임 시스템 / ★ Day 27 — 등급 세분화 시스템 마이그레이션
//   변경:
//   - GOLDFISH_NAME_KR 제거 (GOLDEN_FISH[0].name 직접 사용 — 도감 등록 ID 일치)
//   - gradeFromGoldenCount → pickGoldenHitGrade (객체 반환: grade/tier/plusCount/weightMult/displayGrade)
//   - applyGoldenHitWeightBonus → applyGoldenHitWeight (변종 multiplier 통합)
//   - getGoldenHitDropBonusRate 제거 (아이템 보상 완전 제거)
// Day 16 후속: tickGoldenHitState 제거 (cast 시작 시점에서 inline 차감으로 변경)
import {
  GOLDEN_HIT_MAX_COUNT,
  MIN_GOLDEN_FOR_HIT,
  makeGoldenHitState,
  makeInactiveGoldenHitState,
  convertSymbolForGoldenHit,
  pickGoldenHitGrade,
  applyGoldenHitWeight,
} from '../data/golden-hit-engine.js';

// Day 15: minigame.js (stub) 사용 X — 골든힛 시스템으로 완전 대체
//   미니게임 화면 진입 흐름 폐기됨 (Phase 2A)
// import minigameScreen from './minigame.js';
import catchGameScreen from './catch-game.js';

import { navigate, Screen } from '../core/router.js';

// Day 18 — 레벨 시스템 (Phase 1~5 통합)
import { addExp, getLevelBonuses, getCurrentLevel } from '../data/level-engine.js';
// ★ Day 22 Phase 7 후속 — 햄버거 stage-map 빨간점 (잠금 해제된 stage 중 미관람 있으면 표시)
import { STAGES } from '../data/stages.js';
import { getNewlyUnlockedStages } from '../data/stages.js';
import { createLevelUpPopup } from '../ui/level-up-popup.js';
import { createNewStageAlert } from '../ui/new-stage-alert.js';

// ★ Day 26 (대표 결정) ★ — 매 cast 0.1kg 자동 보상 폐기 (Day 23 PER_CAST_GAIN 완전 제거).
//   이전: 잡든 안 잡든 매 cast 0.1kg 자동 EXP 적립 (꽝 시점 소폭 보상).
//   현재: 매칭/잡기로 얻은 무게만 EXP 누적 (꽝 = 0).

let disposers = [];

export default {
  mount(el, params = {}) {
    // ★ Day 21 (대표 결정) — kgCurrent 변수 폐기 + turnCount 글로벌화 + stageId 분리 저장.
    //   - 마지막 진입 stageId: loadLastSlotStageId() (메뉴/가방 등 다녀와도 복원)
    //   - 누적 cast 횟수: loadTotalTurnCount() (전 스테이지 공통 글로벌 카운트)
    //   - 매 cast 후 saveTotalTurnCount + saveLastSlotStageId 영구 저장
    // Day 19 — params.stageId 가 비어 있으면 저장된 stageId 사용 (1지역으로 떨어지는 버그 수정).
    //   savedProgress 도 없으면 기존대로 1지역.
    const lastStageId = loadLastSlotStageId();
    const stageId = params.stageId ?? lastStageId ?? 1;
    const stage = getStage(stageId);

    // 글로벌 누적 cast 횟수 (스테이지 무관, 평생 누적)
    const initialTurn = loadTotalTurnCount();

    const root = document.createElement('section');
    root.className = 'slot-screen';

    const star = createStarfield();
    root.appendChild(star.root);

    const content = document.createElement('div');
    content.className = 'slot-screen__content';

    let menuBtnEl = null;

    // Bag-2: 가방 모달 (lazy 생성 — 첫 가방 클릭 시 1회 생성)
    let bagModal = null;
    function ensureBagModal() {
      if (!bagModal) {
        bagModal = createBagModal({
          // Bag-4: 가방 닫힐 때(또는 강화/합성/도감으로 이동 시) gear-slot 동기화
          // Day 7-2: 장비 옵션 변경 가능 → stats-bar도 같이 갱신
          // Day 16: 도감 빨간점 갱신 (가방 안 장비 변동으로 등록 가능 entry 변할 수 있음)
          onClose: () => {
            syncGearSlots();
            statsBar.refresh();
            // ★ Day 25 Phase 3 — 가방 닫힐 때 (장비 장착/해제) 상상력 즉시 갱신
            hud.refreshImagination();
            refreshCodexDots();
          },
        });
        disposers.push(() => bagModal.dispose());
      }
      return bagModal;
    }

    /**
     * Day 16 — 햄버거 / 메뉴 '도감' / '가방' 항목 빨간점 갱신.
     * 조건:
     *   - 도감 (codex):
     *     · 미확인 신규 등록 물고기 1개+ 또는
     *     · 가방에 등록 가능 미등록 장비 1개+
     *   - 가방 (bag, Day 16 후속):
     *     · 새로 들어온 미확인 장비 1개+ (drop 시 큐에 추가)
     *   - 햄버거 = 도감 OR 가방 (둘 중 하나라도 알림 있으면 표시)
     * 호출 시점:
     *   - 슬롯 mount 끝 (초기 표시)
     *   - 가방 모달 닫힐 때 (인벤토리 변동 + 가방 빨간점 clear)
     *   - 잡기 성공 + 도감 등록 직후 (drop 시 가방 빨간점도 추가됨)
     */
    function refreshCodexDots() {
      const inv = loadInventory();
      const bagItems = inv?.items || [];
      // 도감 빨간점 조건
      const hasNewFish      = getNewlyRegisteredFishNames().length > 0;
      const hasRegisterable = hasUnregisteredEquipmentInBag(bagItems);
      const showCodexDot    = hasNewFish || hasRegisterable;
      // 가방 빨간점 조건 (Day 16 후속)
      const hasBagNewItems  = loadBagNewItemIds().length > 0;
      // ★ Day 22 Phase 7 후속 (5차 작업, 대표 결정): 햄버거 stage-map 빨간점
      //   "잠금 해제된 stage 중 본 적 없는 (SEEN_STAGE_IDS 미포함) 게 있으면 표시"
      //   stage-map 에서 해당 stage 카드 보면 addSeenStageId 호출되어 자연 제거.
      const seenStageIds = getSeenStageIds();
      const currentLevel = getCurrentLevel();
      const hasUnseenStage = STAGES.some(s =>
        currentLevel >= s.requiredLevel && !seenStageIds.includes(s.id)
      );
      // 햄버거 = 도감 OR 가방 OR 새 stage
      const showMenuDot     = showCodexDot || hasBagNewItems || hasUnseenStage;

      // 햄버거 버튼 우상단
      hud.setMenuDot?.(showMenuDot);
      // 메뉴 패널 항목별 빨간점
      menuPanel.setItemDot?.('codex',     showCodexDot);
      menuPanel.setItemDot?.('bag',       hasBagNewItems);
      menuPanel.setItemDot?.('stage-map', hasUnseenStage);   // ★ Day 22 Phase 7 후속 — 신규
    }

    // Day 7: 내정보 모달 - 메뉴 'profile' 클릭 시
    // getCurrentCombo: 모달 열린 시점 콤보 카운트 가져옴 (combo_bonus 행 동적 반영)
    let profileModal = null;
    function ensureProfileModal() {
      if (!profileModal) {
        profileModal = createProfileModal({
          getCurrentCombo: () => comboCount,
        });
        disposers.push(() => profileModal.dispose());
      }
      return profileModal;
    }

    const menuPanel = createMenuPanel({
      onItemClick: (id) => {
        console.log('[menu] item:', id);
        menuPanel.close();
        if (id === 'shop') {
          // ★ Day 26 — 상점 (대표 결정 옵션 C — 빈 임시 화면 + 준비중 메시지).
          //   향후 상점 화면 정식 구현 시 navigate(Screen.SHOP) 로 교체.
          if (typeof window !== 'undefined' && window.alert) {
            window.alert('상점은 준비 중입니다.\n곧 만나요!');
          }
        } else if (id === 'bag') {
          ensureBagModal().open();
        } else if (id === 'profile') {
          ensureProfileModal().open();
        } else if (id === 'compose') {
          // Day 12 — 합성 화면 진입 (햄버거 메뉴 → 합성, 빈 슬롯)
          navigate(Screen.COMPOSE);
        } else if (id === 'codex') {
          // Day 16 — 도감 화면 진입 (햄버거 메뉴 → 도감, 물고기 탭 기본)
          navigate(Screen.CODEX, { tab: 'fish' });
        } else if (id === 'stage-map') {
          // Day 18 — 낚시터 맵 화면 진입 (햄버거 메뉴 → 낚시터 맵)
          navigate(Screen.STAGE_MAP);
        }
      },
      onClose: () => {
        menuBtnEl?.setAttribute('aria-expanded', 'false');
      },
    });
    disposers.push(() => menuPanel.dispose());

    // Day 13 ★ — 햄버거 메뉴 클릭 깜빡임 수정 (대표 보고 — 간헐적으로 열렸다 닫히는 현상).
    //   원인 추정:
    //     1) aria-expanded 속성 기반 토글 → 빠른 더블탭/모바일 고스트 클릭 시
    //        첫 클릭이 'true' 만들고 두번째가 'false' 만들어 닫힘.
    //     2) menuPanel.open() 후 overlay 가 즉시 pointer-events: auto 가 되면서
    //        같은 탭의 후속 이벤트가 overlay 를 닫는 케이스.
    //   해결:
    //     - menuPanel.toggle() + menuPanel.isOpen() 사용 → 내부 상태 일관성
    //     - 250ms 디바운스 → 더블탭/고스트 클릭 무시
    //     - stopPropagation → 외부 핸들러로 전파 방지
    let lastMenuClickAt = 0;
    const handleMenuClick = (e) => {
      const now = Date.now();
      if (now - lastMenuClickAt < 250) return;  // 디바운스
      lastMenuClickAt = now;
      if (typeof e?.stopPropagation === 'function') e.stopPropagation();
      menuPanel.toggle();
      const btn = e?.currentTarget;
      if (btn && typeof btn.setAttribute === 'function') {
        btn.setAttribute('aria-expanded', String(menuPanel.isOpen()));
      }
    };

    const hud = createHud({
      fisheryNumber: stage.id,
      fisheryName: stage.name,
      // ★ Day 21 — kgCurrent/kgMax 인자 제거 (Day 18 이후 hud.js 가 사용 안 함, 잔존 정리)
      onMenuClick: handleMenuClick,  // Day 13 — 디바운스 + toggle 패턴 (간헐 깜빡임 수정)
    });
    disposers.push(() => hud.dispose());
    content.appendChild(hud.root);

    // Day 7: 콤보 텍스트 — HUD ↔ 슬롯 그리드 사이 공간에 표시
    const comboTextEl = createComboText();
    content.appendChild(comboTextEl);

    // Day 4 후속: KG바 ↔ 슬롯 사이 연출 영역 (추후 텍스트/이펙트 들어갈 자리)
    const fxArea = document.createElement('div');
    fxArea.className = 'slot-fx-area';
    content.appendChild(fxArea);

    // Day 7-2: 슬롯 위 stats-bar — fxArea 안에 채움 (이미 height 3.8rem 차지 → 화면 크기 변동 X)
    // 검은/황금/분홍 등장 추가확률 3종 표시. 가방 닫힐 때 갱신.
    const statsBar = createStatsBar();
    fxArea.appendChild(statsBar.root);
    disposers.push(() => statsBar.dispose());

    menuBtnEl = hud.root.querySelector('.menu-button');

    // 슬롯 영역
    const slotWrap = document.createElement('div');
    slotWrap.className = 'slot-wrap';

    const grid = createSlotGrid({ rows: stage.gridSize, cols: stage.gridSize });
    // ★ Day 21 (대표 결정 ②) — 후반 그리드(≥ 8×8) 헤엄 OFF 마커.
    //   slot-grid--large 클래스 부착 → CSS 에서 fish-swim animation 제거.
    //   5,6지역(8×8) / 7,8지역(9×9) / 9,10지역(10×10) / 11지역(11×11) 대상.
    //   효과: 64~121셀 동시 헤엄 (Day 17 단순화 후에도 셀 수 폭증) GPU 부담 ↓.
    if (stage.gridSize >= 8) {
      grid.root.classList.add('slot-grid--large');
    }
    slotWrap.appendChild(grid.root);
    fillGrid(grid.cells, emptyGrid(stage.gridSize));

    const bobberEl = createBobber();
    // ★ Day 25 — 슬롯 크기에 따라 낚시줄/찌 비례 축소 (낚시터가 커지면 멀리 보이는 시각효과).
    //   CSS calc: scale = 1 - (gridSize - 5) * 0.075 → 5렙 1.0 / 11지역 0.55
    bobberEl.style.setProperty('--grid-size', String(stage.gridSize));
    slotWrap.appendChild(bobberEl);

    const biteAlertEl = createBiteAlert();
    slotWrap.appendChild(biteAlertEl);

    content.appendChild(slotWrap);

    // ★ Day 29 (대표 결정) — 장비 6슬롯 한 줄 배치 (gear-row).
    //   위치: 슬롯 그리드 바로 아래, 턴 횟수 위.
    //   순서: GEAR_SLOTS 배열 순서대로 (낚시대→찌→바늘→옷→배→펫).
    //   6칸 합친 가로 크기 = 슬롯 그리드 가로보다 약간 작게 (CSS 에서 처리).
    const gearRow = document.createElement('div');
    gearRow.className = 'gear-row';

    // Bag-4: gear-slot 컴포넌트를 slot.id 별로 저장 (인벤토리 동기화용)
    const gearSlotMap = {};

    GEAR_SLOTS.forEach((slot) => {
      const gs = createGearSlot({ slot, equipped: null });
      gearSlotMap[slot.id] = gs;
      // Bag-4: 장비칸 클릭 — 장착됐으면 컨텍스트 메뉴, 비었으면 가방 열기
      gs.root.addEventListener('click', () => {
        const inv = loadInventory();
        const eq = inv ? getEquippedBySlot(inv, slot.id) : null;
        if (eq) {
          openEquipmentContextMenu(eq.id, {
            // parent 는 기본값(#app) 사용
            // ★ Day 29 v5 (대표 결정) — 장비 변경 (장착/해제) 시 입질스탯 즉시 반영.
            //   기존: syncGearSlots 만 호출 → gear-slot UI 만 갱신, 입질스탯 그대로 (다른 화면 다녀와야 반영되는 버그)
            //   수정: statsBar.refresh + hud.refreshImagination + refreshCodexDots 도 같이 (가방 닫힐 때와 동일).
            onChange: () => {
              syncGearSlots();
              statsBar.refresh();
              hud.refreshImagination();
              refreshCodexDots();
            },
            // Day 12 — 슬롯 화면 상단 장착 장비 = 합성/도감 비활성
            //   (장착 중인 장비는 잠긴 상태와 유사 — 함부로 합성/도감 진입 금지)
            disableActions: ['compose', 'codex'],
            // navigate 직전 정리 — 슬롯 화면은 라우터가 알아서 unmount 하므로 별도 작업 X
          });
        } else {
          ensureBagModal().open();
        }
      });
      gearRow.appendChild(gs.root);
    });

    content.appendChild(gearRow);

    // TURN
    // ★ Day 21 — 글로벌 누적 cast 횟수 (전 스테이지 공통, kgCurrent 변수 폐기)
    let turnValue = initialTurn;
    // Day 7: 콤보 카운터 (모듈 변수, 새로고침 시 0부터)
    let comboCount = 0;
    const turn = createTurnCounter({ value: turnValue });
    // ★ Day 38 후속 (대표 결정) — turn 카운터 위치를 cast 버튼 아래로 이동.
    //   기존: gearRow → turn → cast (turn 이 중간)
    //   변경: gearRow → cast → turn (cast 가 gearRow 쪽 위로, turn 이 cast 아래)
    //   실제 content.appendChild(turn.root) 는 actionRow append 직후 (line ~2727 부근).

    // 장비 ★ Day 29 — gear-row 가 위에 따로 배치됨. actionRow 는 cast 만.
    const actionRow = document.createElement('div');
    actionRow.className = 'action-row';

    /**
     * Bag-4: 인벤토리의 장착 상태를 슬롯 화면 gear-slot 4개에 반영.
     * 호출 시점:
     *   - slot.js mount 끝 (첫 진입 시 장착 상태 표시)
     *   - 가방 모달 닫힐 때 (사용자가 가방에서 장착/해제했을 수 있음)
     */
    function syncGearSlots() {
      const inv = loadInventory();
      if (!inv) return;
      for (const slotDef of GEAR_SLOTS) {
        const gs = gearSlotMap[slotDef.id];
        if (!gs) continue;
        const eq = getEquippedBySlot(inv, slotDef.id);
        if (eq) {
          const entry = getCatalogEntry(eq.catalogId);
          // Day 10 (C-2): cosmeticColor 도 같이 전달 (장착 장비칸 글로우 발동)
          // Day 11: level 도 같이 전달 (장착 장비칸 좌상단 +N 표시)
          gs.setEquipped(entry ? {
            grade: entry.grade,
            cosmeticColor: eq.cosmeticColor || null,
            level: eq.level || 0,
          } : null);
        } else {
          gs.setEquipped(null);
        }
      }
      // Day 10 (D) — 게임 화면 시각 효과 갱신 (찌 줄 / 찌 글로우 / 슬롯 파티클 / 외곽)
      syncCosmeticEffects(inv);
    }

    /**
     * Day 10 (Phase D) — 4부위 cosmeticColor 보유 시 게임 화면 시각 효과 갱신.
     *
     * 부위별 매핑 (결정로그 Day 10):
     *   rod     → 찌의 낚싯줄 색/글로우      → bobberEl  의 부수 클래스
     *   float   → 찌 자체 글로우 (파티클 X)  → bobberEl  의 부수 클래스
     *   clothes → 슬롯 안 파티클              → grid.root 의 부수 클래스
     *   boat    → 슬롯 그리드 외곽 테두리     → grid.root 의 부수 클래스
     *
     * 클래스 prefix 분리 → bobber 의 hidden/idle/bite 토글이나
     * grid 회전 등 기존 동작과 충돌 X.
     *
     * 등급별 색 = 등급 베이스 색 (희귀 청은 / 영웅 보라 / 전설 황금 / 신화 빨강).
     */
    function syncCosmeticEffects(inv) {
      if (!inv) return;
      // 4부위 각각의 cosmeticColor 보유 여부 → 등급 추출
      /** @type {{rod?:string, float?:string, clothes?:string, boat?:string}} */
      const cosmetics = {};
      for (const slotId of ['rod', 'float', 'clothes', 'boat']) {
        const eq = getEquippedBySlot(inv, slotId);
        if (!eq || !eq.cosmeticColor) continue;
        const entry = getCatalogEntry(eq.catalogId);
        if (entry) cosmetics[slotId] = entry.grade;
      }

      applyCosmeticClass(bobberEl, 'float-bobber--rod-cosmetic',     cosmetics.rod);
      applyCosmeticClass(bobberEl, 'float-bobber--float-cosmetic',   cosmetics.float);
      // ★ Day 26 (대표 결정 Q10 — B) — 찌 cosmetic 입자 떠다님 효과 (기존 글로우/halo 폐기)
      syncFloatCosmeticParticles(bobberEl, cosmetics.float);
      // Day 10 v4 (대표 결정): 옷 cosmetic 은 정적 ::before 가 아니라 동적 별 layer 로
      //   슬롯 안을 돌아다니다 사라지는 연출. 등급별 4/6/8/10 개 별 동시 표시.
      //   ★ Day 21 (대표 결정 C안): 정적화 — 위치 고정 + opacity 펄스만 (렉 부담 -90%)
      syncClothesCosmeticStars(grid.root, cosmetics.clothes);
      // ★ Day 25 (대표 결정) — 배 cosmetic 위치를 HUD 게이지바 바로 위로 이동.
      //   기존: 슬롯 우상단 정적 1개 → 변경: 무게바 위에서 우→좌 20초 무한루프 + 잔잔한 흔들기.
      //   GPU 부담 최소화: 1 요소, left + transform rotate 합성, 60fps 무난.
      syncBoatCosmeticIcon(hud.root, cosmetics.boat);
    }

    /** prefix 로 시작하는 cosmetic 클래스 토글 헬퍼 (등급별 단일 클래스만 부착). */
    function applyCosmeticClass(el, prefix, grade) {
      if (!el) return;
      // 이전 등급 클래스 모두 제거
      for (const g of ['rare', 'epic', 'legendary', 'mythic']) {
        el.classList.remove(`${prefix}-${g}`);
      }
      if (grade) el.classList.add(`${prefix}-${grade}`);
    }

    /** 옷 cosmetic — 슬롯 안 별 layer 정적 관리 (★ Day 21 C안: 정적화).
     *
     *  ★ Day 21 (대표 결정 C안) — 별 정적화로 렉 부담 -90%.
     *    기존: 임의 위치 등장 + transform 이동 + 재귀 spawn (10개 동시 transform+blend+mask 무한)
     *    변경: 등급별 고정 위치 N개 한 번에 spawn + opacity 펄스만 (각 별 phase 다르게)
     *    - transform 0 + DOM mutation 0 + blend-mode 정적 합성 1회만
     *    - 별마다 다른 phase/duration 으로 자연스러운 깜빡임 유지 (정체성 영향 X)
     */
    function syncClothesCosmeticStars(gridRoot, grade) {
      const old = gridRoot.querySelector('.slot-grid__star-layer');
      if (old) old.remove();
      if (!grade) return;

      const layer = document.createElement('div');
      layer.className = 'slot-grid__star-layer';
      layer.dataset.grade = grade;
      gridRoot.appendChild(layer);

      // ★ Day 26 (대표 결정 Q4-1 B) — 그리드 전체 외곽 테두리 안쪽 배치 (이전 셀 내부 비대칭 배치 폐기):
      //   - 희귀 4개 = 그리드 4모서리
      //   - 영웅 8개 = 4모서리 + 각 변 가운데 1개씩
      //   - 전설 12개 = 4모서리 + 각 변에 2개씩 (1/3, 2/3 위치)
      //   - 신화 16개 = 4모서리 + 각 변에 3개씩 (1/4, 2/4, 3/4 위치)
      //   - 좌표 3%/97% (테두리 안쪽 살짝) — 그리드 밖 튀어나옴 방지.
      const POSITIONS_BY_GRADE = {
        rare: [
          // 4 모서리
          [3, 3], [97, 3], [3, 97], [97, 97],
        ],
        epic: [
          // 4 모서리 + 4 변 가운데
          [3, 3], [97, 3], [3, 97], [97, 97],
          [50, 3], [97, 50], [50, 97], [3, 50],
        ],
        legendary: [
          // 4 모서리 + 각 변에 2개씩 (1/3, 2/3 위치)
          [3, 3], [97, 3], [3, 97], [97, 97],
          [33, 3], [67, 3],       // 위 변
          [97, 33], [97, 67],     // 오른쪽 변
          [33, 97], [67, 97],     // 아래 변
          [3, 33], [3, 67],       // 왼쪽 변
        ],
        mythic: [
          // 4 모서리 + 각 변에 3개씩 (1/4, 2/4, 3/4 위치)
          [3, 3], [97, 3], [3, 97], [97, 97],
          [25, 3], [50, 3], [75, 3],          // 위 변
          [97, 25], [97, 50], [97, 75],       // 오른쪽 변
          [25, 97], [50, 97], [75, 97],       // 아래 변
          [3, 25], [3, 50], [3, 75],          // 왼쪽 변
        ],
      };
      const positions = POSITIONS_BY_GRADE[grade] || [];

      // 별 N개 한 번에 spawn (정적 — 재귀 X)
      positions.forEach(([x, y], i) => {
        const star = document.createElement('div');
        star.className = `cosmetic-star cosmetic-star--${grade}`;
        star.style.left = `${x}%`;
        star.style.top  = `${y}%`;
        // 별마다 다른 phase + duration 으로 자연스러운 깜빡임 (동시 깜빡 X)
        const dur   = 2500 + (i % 4) * 400;          // 2.5 / 2.9 / 3.3 / 3.7s 순환
        const delay = (i * 0.27) % (dur / 1000);     // 별마다 다른 시작 phase
        star.style.animationDuration = `${dur}ms`;
        star.style.animationDelay    = `-${delay.toFixed(2)}s`;
        layer.appendChild(star);
      });
    }

    // ★ Day 21 — spawnCosmeticStar (재귀 spawn) 폐기 — 정적 spawn 으로 통합 (syncClothesCosmeticStars 내부).

    /** ★ Day 25 (대표 결정) — 배 cosmetic 위치 변경: HUD 게이지바 바로 위.
     *  20초 무한루프로 오른쪽 끝 → 왼쪽 끝 이동 + 잔잔한 흔들기.
     *  구조: outer (좌→우 이동) + inner (흔들기) + SVG.
     *  GPU 부담: 1 요소 left + transform 1개 합성, 60fps 무난.
     *
     *  @param {HTMLElement} hudRoot — HUD root (내부 .hud__gauge-bar 탐색)
     *  @param {string|null} grade  'rare'|'epic'|'legendary'|'mythic'|null
     */
    function syncBoatCosmeticIcon(hudRoot, grade) {
      // 기존 아이콘 제거 (HUD root 어디에 있든)
      const old = hudRoot.querySelector('.slot-grid__boat-icon');
      if (old) old.remove();
      if (!grade) return;

      // 게이지바를 찾아 그 안에 부착 (게이지바 바로 위 — bottom: 100% 로 위치)
      const gaugeBar = hudRoot.querySelector('.hud__gauge-bar');
      if (!gaugeBar) return;

      // outer = 좌→우 이동 컨테이너 (animation: boat-sail)
      const outer = document.createElement('div');
      outer.className = `slot-grid__boat-icon slot-grid__boat-icon--${grade}`;

      // inner = 잔잔한 흔들기 (animation: boat-rock)
      const inner = document.createElement('div');
      inner.className = 'slot-grid__boat-icon__inner';

      // 단순한 돛단배 SVG — 삼각 돛 + 곡선 선체 (단정한 미니멀리즘)
      // 등급 색은 currentColor 로 outer 에서 상속.
      inner.innerHTML = `
        <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <!-- 돛대 (얇은 세로선) -->
          <line x1="16" y1="4" x2="16" y2="20" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          <!-- 삼각 돛 (오른쪽) -->
          <path d="M 16 6 L 16 18 L 26 18 Z" fill="currentColor" opacity="0.85"/>
          <!-- 선체 (곡선) -->
          <path d="M 6 22 Q 16 28 26 22 L 24 24 Q 16 27 8 24 Z" fill="currentColor"/>
        </svg>
      `;

      outer.appendChild(inner);
      gaugeBar.appendChild(outer);
    }

    // 미니게임 / 리듬게임
    const overlayLayer = document.createElement('div');
    overlayLayer.className = 'screen-overlay';

    /**
     * Day 15: 골든힛 타임 진입.
     * - 콤보 카운트 보존 (트리거 cast = +1 적용된 상태 그대로 save)
     * - 모듈 콤보 0으로 리셋 (골든힛 동안 매칭해도 카운트 X — Q1 답 룰)
     * - 콤보 텍스트 hide
     * - 황금 매칭 셀 발광 클리어 (다음 cast 위해)
     *
     * ★ finishTurn 호출 X — 진입 직후 카운트 차감 사이드이펙트 회피.
     *   finishTurn 안의 골든힛 tick 로직이 진입 시 한 번 더 깎아 3→2 가 되어 2회만 동작했던 버그 수정.
     *   → 대신 finishTurn 의 정리 작업 (cast 활성화/isProcessing/activeBiteInfo) 인라인 처리.
     *
     * Phase 2C 예정: 라스베가스 마퀴 테두리 ON, 콤보 자리 카운트 표시
     */
    function enterGoldenHitTime() {
      goldenHitState = makeGoldenHitState(comboCount);
      comboCount = 0;
      hideComboText(comboTextEl);
      clearAllHighlights();
      // Day 15 Phase 2C → Day 19 변경:
      //   라스베가스 마퀴 CSS 효과 (slot-grid::before) 폐기.
      //   대신 슬롯 그리드 안에 별빛 입자 필드 36개 부착 (천천히 떠다님 + 깜빡).
      //   data-golden-hit attribute 는 다른 곳(예: bite-alert, fish-result)에서도
      //   참조하므로 유지.
      grid.root.dataset.goldenHit = 'true';
      if (!goldenSparkleField) {
        // Day 19 fix3 — 대표 결정 — 입자 크기 r=2.5 → 2.0 (직경 5px → 4px)
        goldenSparkleField = createSparkleField({ radius: 2.0 });
        grid.root.appendChild(goldenSparkleField);
      }
      // Day 15 Phase 2C: 콤보 자리에 카운트 표시 (남은 횟수)
      showGoldenHitCount(comboTextEl, goldenHitState.remaining);
      // finishTurn 인라인 (단, 골든힛 tick 부분 제외)
      cast.setState('cast');
      cast.setBusy(false);
      isProcessing = false;
      activeBiteInfo = null;
      autoMode = false;  // Day 15: 골든힛 모드는 항상 수동 cast (대표 결정)
      // Day 15 Phase 2D: 활성 세션 저장 (화면 전환 시 보존)
      saveGoldenHitSession({ stageId, ...goldenHitState });
    }

    /**
     * Day 15: 골든힛 타임 종료.
     * - state 초기화
     * - 보존된 콤보 복원 (savedComboCount > 0 이면 다시 텍스트 표시)
     * - 자동 모드 해제
     *
     * Phase 2C 예정: 라스베가스 마퀴 OFF, 카운트 표시 OFF
     */
    function exitGoldenHitTime() {
      const restoredCombo = goldenHitState.savedComboCount;
      goldenHitState = makeInactiveGoldenHitState();
      // Day 15 Phase 2C → Day 19 변경: 마퀴 attr OFF + sparkle-field 제거
      delete grid.root.dataset.goldenHit;
      if (goldenSparkleField) {
        goldenSparkleField.remove();
        goldenSparkleField = null;
      }
      hideGoldenHitCount(comboTextEl);
      comboCount = restoredCombo;
      if (comboCount > 0) {
        showComboText(comboTextEl, comboCount);
      } else {
        hideComboText(comboTextEl);
      }
      autoMode = false;
      // Day 15 Phase 2D: 활성 세션 reset (종료 시 영구저장 비움)
      resetGoldenHitSession();
    }

    /**
     * Day 20: 트윙클(꿈조각) 타임 진입 — 카드 미니게임 띄우기.
     * 카드 게임 결과(자동 캐스트 횟수) 받으면 enterTwinkleAutoCast(value) 호출.
     */
    function enterTwinkleHitTime() {
      // cast 버튼 잠금 (대표 명시 — "캐스트버튼은 잠시 비활성화")
      cast.setBusy(true);

      const cardGame = createTwinkleCardGame({
        onResult: (chosenValue) => {
          // 카드 게임 DOM 제거
          cardGame.root.remove();
          // 자동 캐스트 모드 진입
          enterTwinkleAutoCast(chosenValue);
        },
      });
      root.appendChild(cardGame.root);
      cardGame.show();
    }

    /**
     * Day 20: 트윙클 자동 캐스트 모드 진입.
     * - 카드 게임 결과로 받은 횟수(3/5/7/10)를 remaining 에 세팅
     * - 진입 직전 슬롯 결과(lastGridData) + 콤보 백업
     * - "N Twinkle chance" 표시 (콤보 자리 재활용)
     * - cast 버튼 활성화 (단, started=false 라 첫 클릭 시 차감 시작)
     * - 트윙클 트리거 셀 발광은 해제 (자동 캐스트 시작 시점에는 깨끗한 그리드)
     *
     * @param {number} chosenValue  3 | 5 | 7 | 10
     */
    function enterTwinkleAutoCast(chosenValue) {
      // 진입 직전 상태 저장 (종료 시 복원용)
      const savedGrid = lastGridData
        ? lastGridData.map(row => [...row])   // 얕은 복사 (2D 배열 each row)
        : null;

      twinkleHitState = {
        isActive: true,
        remaining: chosenValue,
        started: false,
        savedComboCount: comboCount,
        savedGridData: savedGrid,
        lockedCells: [],
        rewardCount: 0,
        goldenWhaleTriggered: false,   // ★ Day 29
      };

      // 진입 시점 — 트윙클 트리거 셀 발광 해제 (자동 캐스트는 깨끗한 시작점부터)
      lastTwinkleMatchedCells.forEach(({ row, col }) => {
        const idx = row * grid.cols + col;
        grid.cells[idx]?.setTwinkleMatched(false);
      });
      lastTwinkleMatchedCells = [];

      // 콤보 0 (트윙클타임 동안은 콤보 카운트 X — 대표 명시)
      comboCount = 0;
      hideComboText(comboTextEl);

      // "Twinkle chance N" 표시
      showTwinkleChance(comboTextEl, twinkleHitState.remaining);

      // Day 20: 트윙클타임 동안 슬롯 그리드 안에 별 입자 필드 부착 (골든힛과 동일 패턴, 톤만 변경)
      if (!twinkleSparkleField) {
        twinkleSparkleField = createSparkleField({
          radius: 2.5,         // 트윙클 별은 골든힛 circle(2.0) 보다 약간 크게 (별 형태 잘 보이게)
          shape: 'star',       // Day 20: 5점 별 (대표 명시 — 점 말고 별)
          tone: 'twinkle',     // CSS data-tone="twinkle" → 흰색·연푸른 깜빡
        });
        grid.root.appendChild(twinkleSparkleField);
      }

      // ★ Day 35 (대표 결정 B-가) — 트윙클 타임 진행 중 트윙클 매칭 셀에 두꺼운 황금 테두리.
      //   grid 컨테이너에 클래스 부착 → CSS 자식 셀렉터로 .matched-twinkle 셀의 테두리만 황금으로 덮어씀.
      //   exitTwinkleHitTime 에서 제거.
      grid.root.classList.add('twinkle-time-active');

      // cast 버튼 활성화 — 사용자가 클릭 시점에 자동 회전 시작
      cast.setBusy(false);
      cast.setState('cast');
      isProcessing = false;
      autoMode = false;  // 트윙클 모드는 자체 자동 회전 (autoMode 무관)
    }

    /**
     * Day 20: 트윙클 자동 캐스트 모드 종료.
     * - 잠긴 셀 발광 해제
     * - 진입 직전 그리드 복원 (fillGrid)
     * - 콤보 복원
     * - 보상 팝업 표시 → 닫힘 시 가방에 꿈조각 +N 지급
     */
    function exitTwinkleHitTime() {
      const reward = twinkleHitState.rewardCount;
      const restoredCombo = twinkleHitState.savedComboCount;
      const savedGrid = twinkleHitState.savedGridData;
      const wasGoldenWhaleTriggered = twinkleHitState.goldenWhaleTriggered;   // ★ Day 29 — state 초기화 전 캡쳐

      // Day 20: 트윙클 별 입자 필드 제거 (가장 먼저 — 시각적 즉시 종료감)
      if (twinkleSparkleField) {
        twinkleSparkleField.remove();
        twinkleSparkleField = null;
      }

      // ★ Day 35 (대표 결정 B-가) — 트윙클 타임 종료: grid 황금 테두리 클래스 제거
      // ★ Day 37 후속 (대표 결정) — 황금빛꿈고래 트리거 시 트윙클 시각(황금 테두리) 보존.
      //   목적: SPECIAL MYTHIC HIT 인트로 배경에 트윙클 마지막 화면 + 황금 테두리 그대로 보여야 함.
      //   황금 테두리 셀렉터: .slot-grid.twinkle-time-active .matched-twinkle[data-mythic-candidate]
      //   → 3가지 조건 (class + class + dataset) 모두 유지 필요 → 정리 작업 모두 미룸.
      //   pendingTwinkleLockedCells 에 좌표 사본 저장 → finishTurn 에서 일괄 정리.
      if (wasGoldenWhaleTriggered) {
        // 트리거 발동 — 시각 정리 모두 미룸 (트윙클 마지막 화면 + 황금 테두리 유지)
        pendingTwinkleLockedCells = twinkleHitState.lockedCells.map(c => ({ ...c }));
      } else {
        // 일반 종료 — 기존대로 즉시 정리
        grid.root.classList.remove('twinkle-time-active');

        // ★ Day 36 — 신화 후보 마킹(data-mythic-candidate) 모두 클리어 (다음 트윙클 타임 위해)
        // ★ Day 39 — data-mythic-triggered 도 같이 클리어 (size 15+ 황금 배경 dataset)
        for (const cell of grid.cells) {
          if (cell?.root?.dataset?.mythicCandidate) {
            delete cell.root.dataset.mythicCandidate;
          }
          if (cell?.root?.dataset?.mythicTriggered) {
            delete cell.root.dataset.mythicTriggered;
          }
        }

        // 잠긴 셀 발광 해제
        twinkleHitState.lockedCells.forEach(({ row, col }) => {
          const idx = row * grid.cols + col;
          grid.cells[idx]?.setTwinkleMatched(false);
        });
      }

      // 진입 직전 그리드 복원 (시각만, 매칭 효과 발동 X)
      // ★ Day 37 (대표 결정) — 황금빛꿈고래 트리거 발동 시 그리드 복원 미룸.
      //   목적: 꿈조각 보상 팝업 → SPECIAL MYTHIC HIT 인트로 표시 시 배경에 트윙클 타임 마지막 화면 보이게.
      //   savedGrid 는 pendingTwinkleRestoreGrid 에 임시 저장 → 잡기게임 종료 후 finishTurn 에서 복원.
      //   일반 종료 (트리거 X) 시는 기존대로 즉시 복원.
      if (savedGrid) {
        if (wasGoldenWhaleTriggered) {
          // 트리거 발동 — 복원 미룸 (다음 일반 cast 시점에 새 spin 시작하므로 사실상 자동 정리)
          pendingTwinkleRestoreGrid = savedGrid;
        } else {
          fillGrid(grid.cells, savedGrid);
          lastGridData = savedGrid;
        }
      }

      // Twinkle chance 표시 종료
      hideTwinkleChance(comboTextEl);

      // 콤보 복원
      comboCount = restoredCombo;
      if (comboCount > 0) {
        showComboText(comboTextEl, comboCount);
      } else {
        hideComboText(comboTextEl);
      }

      // state 초기화
      twinkleHitState = {
        isActive: false,
        remaining: 0,
        started: false,
        savedComboCount: 0,
        savedGridData: null,
        lockedCells: [],
        rewardCount: 0,
        goldenWhaleTriggered: false,   // ★ Day 29
      };

      autoMode = false;
      isProcessing = false;
      cast.setBusy(false);
      cast.setState('cast');

      // 보상 팝업 (꿈조각 +N) — 닫힘 시 가방에 지급 + 황금빛꿈고래 트리거 발동 시 잡기게임 진입
      twinkleRewardPopup.show({
        rewardCount: reward,
        onClose: () => {
          if (reward > 0) {
            const inv = loadInventory();
            const added = addEnhanceStone(inv, reward);
            saveInventory(inv);
            if (added < reward) {
              console.warn('[twinkle] stack cap 으로 일부 보상 미지급:', reward, '→', added);
            }
          }
          // ★ Day 29 — 황금빛꿈고래 트리거 발동 시 잡기게임 입장 (대표 결정 (iii)):
          //   트윙클 타임 정상 종료 + 꿈조각 보상 정산 후 → 황금빛꿈고래 잡기게임 진입.
          //   handleMythicTriggerHit('goldenwhale', ...) 가 mythic_01 황금빛꿈고래로 분기.
          if (wasGoldenWhaleTriggered) {
            const inv = loadInventory();
            const codexBonuses = getCodexBonuses();
            const activeOpts = getActiveOptions(inv, codexBonuses);
            const setGrade = getSetGrade(inv);
            const setWeightBonusPct = getSetWeightBonus(setGrade);
            handleMythicTriggerHit('goldenwhale', activeOpts, setWeightBonusPct);
          }
        },
      });
    }

    /**
     * Day 20: 트윙클 자동 캐스트 모드 cast 결과 처리.
     * - newGrid 에서 'twinkle' 심볼 셀 찾기 (잠금 셀 제외, 새로 등장)
     * - 새 트윙클 셀: setTwinkleMatched(true) + lockedCells push + rewardCount++
     * - 다른 매칭(fish/rainbow/golden) 효과 무시
     * - 처리 후 finishTurn (remaining 차감은 runSpin 시작 시점에서)
     */
    function handleSpinCompleteTwinkleAutoCast(newGrid) {
      const cols = grid.cols;
      const rows = newGrid.length;

      // 잠긴 셀 인덱스 set (이미 트윙클인 셀)
      const lockedSet = new Set(
        twinkleHitState.lockedCells.map(({ row, col }) => row * cols + col)
      );

      // newGrid 에서 새로 등장한 twinkle 셀 찾기
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          if (lockedSet.has(idx)) continue;     // 이미 잠긴 셀 스킵
          if (newGrid[r][c] !== 'twinkle') continue;

          // 새 꿈조각 셀 — 잠금 + 보상 누적
          grid.cells[idx]?.setTwinkleMatched(true);
          twinkleHitState.lockedCells.push({ row: r, col: c });
          twinkleHitState.rewardCount += 1;
        }
      }

      // ★ Day 29 — 누적 트윙클 셀의 최대 인접 클러스터 size 검사 (15+ → 황금빛꿈고래 트리거).
      //   한 번 트리거 후엔 재검사 X (idempotent — 발동은 exitTwinkleHitTime 에서 한 번만).
      //   대표 결정 (가)/(iii): 누적 잠긴 셀 기반 / 트윙클 타임 정상 종료 후 추가 잡기게임.
      if (!twinkleHitState.goldenWhaleTriggered) {
        const maxClusterSize = findMaxClusterSizeFromCells(
          twinkleHitState.lockedCells, rows, cols
        );
        if (maxClusterSize >= 15) {
          twinkleHitState.goldenWhaleTriggered = true;
          // 시각 알림 — 일단 console 로깅 (추후 정식 연출 추가 예정)
          console.log('[twinkle] 황금빛꿈고래 트리거 발동! 누적 클러스터 size:', maxClusterSize);
        }
      }

      // ★ Day 36 (대표 결정) — 신화 트리거 대상 셀(인접 클러스터 3+)만 황금 테두리 표시.
      //   - findClustersInCells 로 누적 셀들 중 인접 클러스터(size >= 3) 모두 추출.
      //   - 클러스터에 속한 셀에만 data-mythic-candidate="true" 부착 → CSS 가 황금 테두리 적용.
      //   - 흩어진 단독/소수(<3) 트윙클 셀은 dataset X → 일반 트윙클 색(옅은 하늘색) 유지.
      //   - 매 spin 후 전체 재계산 (셀 추가로 인접 관계 변할 수 있음 — 단순 재마킹).
      markMythicCandidateCells(rows, cols);
    }

    /**
     * ★ Day 36 — 트윙클 타임 누적 셀의 인접 클러스터(3+)에 data-mythic-candidate 마킹.
     *   매 spin 후 전체 클리어 → 재마킹 (인접 관계 변할 수 있음 — 단순 재계산).
     *
     * ★ Day 39 (대표 결정 옵션 A + (가)) — size 분기 추가:
     *   - cluster.length >= 3  → data-mythic-candidate="true"  (황금 테두리 — Day 36~37 기존 동작 유지)
     *   - cluster.length >= 15 → 추가로 data-mythic-triggered="true" (황금 배경 — 신화 트리거 도달 덩어리)
     *   - 매 spin 재계산 — 15+ 덩어리가 더 자라거나 다른 덩어리가 별도 15+ 도달해도 일관 표시.
     */
    function markMythicCandidateCells(rows, cols) {
      const cells = grid.cells;
      // 1) 기존 마킹 모두 클리어 (candidate + triggered 둘 다)
      for (const cell of cells) {
        if (cell?.root?.dataset?.mythicCandidate) {
          delete cell.root.dataset.mythicCandidate;
        }
        if (cell?.root?.dataset?.mythicTriggered) {
          delete cell.root.dataset.mythicTriggered;
        }
      }
      // 2) 인접 클러스터(3+) 추출
      const clusters = findClustersInCells(twinkleHitState.lockedCells, rows, cols, 3);
      // 3) 각 클러스터 셀에 dataset 부착 — size 분기
      for (const cluster of clusters) {
        const isTriggered = cluster.length >= 15;
        for (const { row, col } of cluster) {
          const idx = row * cols + col;
          const root = cells[idx]?.root;
          if (root) {
            root.dataset.mythicCandidate = 'true';
            if (isTriggered) {
              root.dataset.mythicTriggered = 'true';
            }
          }
        }
      }
    }

    /**
     * Day 20 Phase 5: 백그라운드 시뮬레이션 (다른 화면 갔다온 동안 진행된 회차 계산).
     * 슬롯 화면 unmount 후 mount 까지의 경과 시간 / 회차당 평균 시간 만큼 시뮬레이션.
     *
     * @param {object} state                  세션 데이터 { remaining, lockedCells, rewardCount, ... }
     * @param {number} elapsedMs              경과 시간 (ms)
     * @param {number} gridSize               그리드 한 변 셀 수
     * @param {Array} symbolList              백그라운드 회차에 사용할 가중치 풀
     * @returns {object}                      시뮬레이션 후 갱신된 state (얕은 복사)
     */
    function simulateTwinkleCasts(state, elapsedMs, gridSize, symbolList) {
      // 1회차 자동 진행 시간 = 버튼 press 모션 + spin + 결과 처리 약 100ms
      //   AUTO_PRESS_DELAY (200) + AUTO_PRESS_DURATION (300) + SPIN_DURATION (2000) + 약 300ms 여유 ≈ 2800
      const SIM_INTERVAL = AUTO_PRESS_DELAY + AUTO_PRESS_DURATION + SPIN_DURATION + 300;
      const possibleCasts = Math.floor(elapsedMs / SIM_INTERVAL);
      let casts = Math.min(possibleCasts, state.remaining);

      const totalCells = gridSize * gridSize;
      const lockedCells = [...state.lockedCells];
      let rewardCount = state.rewardCount;
      let remaining = state.remaining;

      for (let i = 0; i < casts; i++) {
        if (lockedCells.length >= totalCells) break;  // 조기 종료: 모든 셀 잠김

        const lockedSet = new Set(lockedCells.map(({ row, col }) => row * gridSize + col));
        const simGrid = generateGrid(gridSize, symbolList);

        for (let r = 0; r < gridSize; r++) {
          for (let c = 0; c < gridSize; c++) {
            const idx = r * gridSize + c;
            if (lockedSet.has(idx)) continue;
            if (simGrid[r][c] !== 'twinkle') continue;
            lockedCells.push({ row: r, col: c });
            rewardCount += 1;
          }
        }
        remaining -= 1;
      }

      // ★ Day 29 — 백그라운드 시뮬레이션 후 누적 클러스터 size 검사 (15+ → 트리거).
      //   기존 state.goldenWhaleTriggered 가 true 면 그대로 유지 (이미 발동됨).
      let goldenWhaleTriggered = state.goldenWhaleTriggered || false;
      if (!goldenWhaleTriggered) {
        const maxClusterSize = findMaxClusterSizeFromCells(lockedCells, gridSize, gridSize);
        if (maxClusterSize >= 15) {
          goldenWhaleTriggered = true;
        }
      }

      return { ...state, remaining, lockedCells, rewardCount, goldenWhaleTriggered };
    }

    /**
     * Day 20 Phase 5: 트윙클 세션 복원 시도 (mount 시 호출).
     * - 세션 없으면 그냥 리턴
     * - 다른 stageId면 클리어 후 리턴 (대표 결정 — 다른 스테이지면 취소)
     * - 세션 있으면: 시뮬레이션 → 상태 복원 → UI 반영 → 종료/계속 분기
     *
     * @param {Array} symbolList   현 시점 활성 옵션 적용된 심볼 가중치 (시뮬레이션용)
     */
    function tryRestoreTwinkleSession(symbolList) {
      const session = loadTwinkleSession();
      if (!session) return;

      if (session.stageId !== stageId) {
        // 다른 스테이지로 진입 — 트윙클 세션 취소 (보상 없음, 대표 명시 정책 일관)
        clearTwinkleSession();
        return;
      }

      const elapsed = Math.max(0, Date.now() - session.leftAt);

      // started=false 면 백그라운드 시뮬레이션 X (대표 명시 — 첫 cast 클릭 전엔 정지)
      let restored = {
        remaining:    session.remaining,
        lockedCells:  [...session.lockedCells],
        rewardCount:  session.rewardCount,
        goldenWhaleTriggered: session.goldenWhaleTriggered || false,   // ★ Day 29
      };
      if (session.started) {
        restored = simulateTwinkleCasts(restored, elapsed, stage.gridSize, symbolList);
      }

      // 상태 복원
      twinkleHitState = {
        isActive:        true,
        started:         session.started,
        remaining:       restored.remaining,
        savedComboCount: session.savedComboCount,
        savedGridData:   session.savedGridData,
        lockedCells:     restored.lockedCells,
        rewardCount:     restored.rewardCount,
        goldenWhaleTriggered: restored.goldenWhaleTriggered || false,   // ★ Day 29
      };
      clearTwinkleSession();

      // 그리드 시각 복원 — 진입 직전 그리드를 베이스로 + 잠긴 셀은 'twinkle' 강제
      if (session.savedGridData) {
        const baseGrid = session.savedGridData.map(row => [...row]);
        twinkleHitState.lockedCells.forEach(({ row, col }) => {
          baseGrid[row][col] = 'twinkle';
        });
        lastGridData = baseGrid;
        fillGrid(grid.cells, baseGrid);
      }
      // 잠긴 셀 발광 복원
      twinkleHitState.lockedCells.forEach(({ row, col }) => {
        const idx = row * grid.cols + col;
        grid.cells[idx]?.setTwinkleMatched(true);
      });

      // 콤보 비활성 + Twinkle chance 표시 (트윙클 동안 콤보 카운트 X — 대표 명시)
      comboCount = 0;
      hideComboText(comboTextEl);
      showTwinkleChance(comboTextEl, twinkleHitState.remaining);

      // 종료 검사 (시뮬레이션 결과 remaining 0 또는 모든 셀 잠김)
      const totalCells = grid.rows * grid.cols;
      const allLocked = twinkleHitState.lockedCells.length >= totalCells;
      if (twinkleHitState.remaining === 0 || allLocked) {
        // 즉시 종료 + 보상 팝업 (살짝 딜레이로 UI 안정화 후)
        setTimeout(() => {
          if (twinkleHitState.isActive) exitTwinkleHitTime();
        }, 400);
        return;
      }

      // 진행 중 — started=true 면 자동 다음 회차, started=false 면 사용자 cast 클릭 대기
      if (twinkleHitState.started) {
        setTimeout(() => {
          if (!twinkleHitState.isActive) return;
          cast.triggerPress();
        }, AUTO_PRESS_DELAY);
        setTimeout(() => {
          if (!twinkleHitState.isActive) return;
          runSpin();
        }, AUTO_PRESS_DELAY + AUTO_PRESS_DURATION);
      } else {
        // 첫 cast 클릭 대기 상태
        cast.setBusy(false);
        cast.setState('cast');
        isProcessing = false;
        autoMode = false;
      }
    }

    /**
     * Day 15: 골든힛 타임 모드 cast 결과 처리.
     * - 클러스터 룰 무시, 황금 심볼 전체 카운트 단일 룰 (위치 무관)
     * - 황금 ≥ MIN_GOLDEN_FOR_HIT (3) → 단일 매칭 → 잡기게임
     * - 황금 < 3 → 미스 처리 → 자동 finishTurn
     * - 카운트 차감은 finishTurn 안에서 (모든 분기 통합)
     * - 분홍 룰 (분홍 3+ = 보스) 적용 X (분홍 자체가 황금으로 치환되었으므로)
     *
     * @param {Array<Array<string>>} newGrid       회전 결과 그리드 (이미 황금 치환 적용된 상태)
     * @param {object} activeOpts                  장비 옵션
     * @param {number} setWeightBonusPct           세트 무게 보너스 %
     */
    async function handleSpinCompleteGoldenHit(newGrid, activeOpts, setWeightBonusPct) {
      const cols = grid.cols;

      // 황금 셀 좌표 + 카운트
      const goldenCells = [];
      for (let r = 0; r < newGrid.length; r++) {
        for (let c = 0; c < newGrid[0].length; c++) {
          if (newGrid[r][c] === 'golden') {
            goldenCells.push({ row: r, col: c });
          }
        }
      }
      const goldenCount = goldenCells.length;

      // ★ Day 27 — 골든힛 전용 등급 테이블 (객체 반환):
      //   { grade, tier, plusCount, weightMult, displayGrade }
      //   대표 결정 (Q-F B안): 전 지역에서 51+ = 신화 출현 가능 (clampGradeForStage 호출 제거)
      const goldenInfo = pickGoldenHitGrade(goldenCount);  // null = 매칭 X (3 미만)

      if (goldenInfo) {
        const grade = goldenInfo.grade;
        // 매칭 — 모든 황금 셀 발광 + 잡기게임 (단일 single hit)
        lastGoldenMatchedCells = [];
        goldenCells.forEach(({ row, col }) => {
          const idx = row * cols + col;
          grid.cells[idx]?.setGoldenMatched(true);
          lastGoldenMatchedCells.push({ row, col });
        });

        // ★ Day 27 — 황금어 도감 통합 (GOLDEN_FISH[0] = 황금꿈잉어 고정)
        //   fish.name 으로 도감 등록되므로 (codex-engine.registerFishCatch)
        //   기존: 일반 어종 풀에서 픽 후 이름만 '황금어'로 덮어씀 → 도감 매칭 실패 버그
        //   변경: GOLDEN_FISH[0] 직접 사용 → 도감엔 '황금꿈잉어' 자동 등록
        const baseFish = GOLDEN_FISH[0];
        const fish = {
          ...baseFish,
          color: '#FFD96A',              // Day 15: 황금색 (UI 시각)
          isGoldenHit: true,             // Day 15: 결과 팝업/잡기게임 식별 플래그
        };

        // ★ Day 24 — rollWeight 에 stage.weightMultiplier 전달 (지역 배율 적용)
        const { weight: rolledWeight, tier } = rollWeight(fish.baseWeight, grade, stage.weightMultiplier);
        // ★ Day 27 — applyGoldenHitWeight 로 통합:
        //   변종 weightMult (×1.0 ~ ×2.75) × 골든힛 보너스 ×1.10 동시 적용
        const goldenBoostedBase = applyGoldenHitWeight(rolledWeight, goldenInfo.weightMult);
        // 골든힛 동안 콤보는 0 (모듈 변수)이므로 calcComboBonus = 0, 장비 weight_bonus 만 적용됨
        const weight = applyWeight(goldenBoostedBase, activeOpts, comboCount, setWeightBonusPct);
        const comboBonus = calcComboBonus(goldenBoostedBase, activeOpts, comboCount);
        const totalWeightPct = (activeOpts.weight_bonus || 0) + setWeightBonusPct;
        const equipmentBonus = goldenBoostedBase * (totalWeightPct / 100);

        const result = {
          fish, weight, tier, grade,
          goldenHitInfo: goldenInfo,      // ★ Day 27 — UI 변종 표시용 (보스+, 전설++ 등)
          baseWeight: goldenBoostedBase,  // 결과팝업 작은 줄 = 변종×보너스 적용된 베이스
          equipmentBonus,
          comboBonus,
          comboLevel: 0,                  // 골든힛 동안 콤보 X
          size: goldenCount,              // 황금 매칭 카운트
          symbol: 'golden',
          clusterIdx: 1,
          isGoldenHit: true,              // Day 15: 단일 매칭 식별 플래그
        };

        resultQueue = [result];

        // bite-alert: 등급(변종 포함) + HIT 표시 (single hit, hasBoss 없음, isGoldenHit=true 로 빨간색)
        // ★ Day 27 — displayGrade 사용 (보스+, 전설++++ 등 + 표시)
        const grades = [goldenInfo.displayGrade];
        pendingHasBoss = false;
        activeBiteInfo = { count: 1, grades, hasBoss: false, isGoldenHit: true };
        showBiteAlert(biteAlertEl, activeBiteInfo);

        // Day 15: 일반 모드와 일관 — cast 'pull' 상태로 전환, 사용자가 당기면 잡기게임 진입
        // (handlePull → processNextResult → openCatchGame 자동 흐름)
        cast.setState('pull');
      } else {
        // 미스 (황금 < 3) — 수동 cast (대표 결정 — 1회 종료마다 사용자 직접 cast)
        //   기존 missed 흐름의 autoMode 자동 cast 룰 적용 X (골든힛 모드는 항상 수동)
        //   finishTurn 안에서 카운트 차감 → 다음 cast 사용자 클릭 대기
        finishTurn();
      }
    }

    /**
     * ★ Day 29 — 신화 트리거 매칭 처리 (전 지역, 일반 슬롯).
     *
     * 대표 결정 (Day 29):
     * - 11지역 한정 → 전 지역으로 확장 (등급 임계값 변경과 함께 정합성)
     * - 트리거 4종 (검은 매칭은 일반 매칭 흐름에서 처리됨, 여기는 황금/트윙클/분홍만):
     *   · 황금 10+   → 골든힛 스킵, 이 함수로
     *   · 트윙클 10+ → 트윙클 카드 게임 스킵, 이 함수로  (★ Day 29 신규 트리거 처리)
     *   · 분홍 10+   → HIDDEN HIT 스킵, 이 함수로
     * - 신화 어종: pickMythicFish() — mythic_02~04 무작위 (3종 동일 보상)
     *   · 황금빛꿈고래(mythic_01)는 트윙클 타임 중 트윙클 15+ 전용 — 별도 분기 (pickGoldenDreamWhale)
     *   · 검은 매칭은 일반 매칭 흐름의 신화보스 분기에서 처리됨 (handleMatchFound)
     * - 무게: rollWeight(_, '신화보스', stage.weightMultiplier)
     *   ※ Day 29 — 지역 weightMultiplier 폐기 예정 (Phase 3) — 현재 코드는 호환성 위해 유지
     * - 장비 보상: 전설 50% / 신화 50% 무조건 1개 (LUCKY_DROP_GRADE_POOL['신화보스'] + dropCount=1 강제)
     * - 잡기게임 후 도감 등록 (mythic_02~04 중 잡힌 1종)
     *
     * @param {'golden'|'twinkle'|'rainbow'} triggerSymbol  신화 트리거 심볼
     * @param {object} activeOpts                          장비 옵션
     * @param {number} setWeightBonusPct                   세트 무게 보너스 %
     */
    function handleMythicTriggerHit(triggerSymbol, activeOpts, setWeightBonusPct) {
      const grade = '신화보스';
      // ★ Day 29 — 트리거별 어종 결정:
      //   'goldenwhale' (트윙클 타임 중 트윙클 15+ 누적 클러스터) → mythic_01 황금빛꿈고래 (엔딩 상징)
      //   그 외 ('golden'/'twinkle'/'rainbow' 10+, 검은 10+) → mythic_02~04 무작위
      const mythicFish = (triggerSymbol === 'goldenwhale')
        ? pickGoldenDreamWhale()
        : pickMythicFish();

      // ★ Day 41 (대표 결정) — 골든힛 트리거 (황금 10+) 시 fish.name 만 GOLDEN_FISH[0].name (황금빛꿈잉어) 로 통일.
      //   - 결과 팝업 표시 이름 = 황금빛꿈잉어
      //   - 도감 등록 ID = fish.name 기반 → 황금빛꿈잉어로 통합 등록 (mythic_02~04 별도 등록 X)
      //   - 등급 (신화보스) / baseWeight (mythicFish.baseWeight) / 무게 산정은 그대로 유지
      const fish = (triggerSymbol === 'golden')
        ? { ...mythicFish, name: GOLDEN_FISH[0].name }
        : mythicFish;

      // 무게 추첨 (신화보스 1000~3000 × 11지역 multiplier 100 = 100,000~300,000 kg)
      const { weight: rolledWeight, tier } = rollWeight(mythicFish.baseWeight, grade, stage.weightMultiplier);
      const weight = applyWeight(rolledWeight, activeOpts, comboCount, setWeightBonusPct);
      const comboBonus = calcComboBonus(rolledWeight, activeOpts, comboCount);
      const totalWeightPct = (activeOpts.weight_bonus || 0) + setWeightBonusPct;
      const equipmentBonus = rolledWeight * (totalWeightPct / 100);

      const isGoldenDreamWhale = (triggerSymbol === 'goldenwhale');   // ★ Day 29 — 황금빛꿈고래 식별

      const result = {
        fish,                                 // ★ Day 41 — mythicFish 직접 X. 골든힛 시 name 만 황금빛꿈잉어로 교체된 fish.
        weight, tier, grade,
        baseWeight: rolledWeight,
        equipmentBonus,
        comboBonus,
        comboLevel: comboCount,
        size: isGoldenDreamWhale ? 15 : 10,   // 표시용 (황금빛꿈고래는 트윙클 15+, 일반 신화는 10+)
        symbol: triggerSymbol,
        clusterIdx: 1,
        isMythicHit: true,                    // ★ Day 27 신화 식별 플래그
        isGoldenDreamWhale,                   // ★ Day 29 — 황금빛꿈고래 전용 플래그 (엔딩 연출 분기용)
        mythicTriggerSymbol: triggerSymbol,
      };

      resultQueue = [result];

      // ★ Day 37 (대표 결정) — 신화 트리거 흐름 분기:
      //   isGoldenDreamWhale = true  (트윙클 타임 중 트윙클 15+ 누적):
      //     → SPECIAL MYTHIC HIT 인트로 + cast pull + mythic-intro 흐름 (Day 36)
      //   isGoldenDreamWhale = false (일반 신화 — 검은 10+/분홍 10+/하얀 10+/황금 10+):
      //     → bite-alert 'MYTHIC HIT' + cast pull → 사용자 cast → 잡기게임 (Day 35 이전 기존 흐름)
      activeBiteInfo = { count: 1, grades: [grade], hasBoss: true, isMythicHit: true, isGoldenDreamWhale };
      autoMode = false;

      if (isGoldenDreamWhale) {
        // 황금빛꿈고래 — Day 36 흐름
        showSpecialMythicHitIntro(specialMythicHitIntro);
        cast.setBusy(false);
        cast.setState('pull');
        awaitingMythicPull = true;
      } else {
        // 일반 신화 — Day 35 이전 흐름 (bite-alert MYTHIC HIT + cast pull)
        showBiteAlert(biteAlertEl, activeBiteInfo);
        cast.setState('pull');
      }
    }

    /**
     * 잡기 게임 (Day 3 v2 — 다중 매칭 통합 / ★ Day 29 — 멀티히트 자동선택)
     *
     * ★ Day 29 (대표 결정) ★ — 멀티히트 자동선택:
     *   배경: 기존엔 사용자가 잡기게임에서 클러스터 선택 → 1마리만 잡기. 나머지는 사라짐.
     *   변경: 가장 큰 등급의 클러스터 1개를 자동 선택 (선택 UI 제거).
     *         보상은 기존대로 멀티히트 배수(×N) 유지 (×2/×3/×4 — originalMatchCount).
     *   같은 등급 멀티히트도 그 등급 1개로 진행.
     *
     * @param {Array} results - 한 턴의 매칭 결과 전부 (다중 매칭일 수 있음)
     */
    function openCatchGame(results) {
      // ★ Day 29 — 잡기게임 진입 시 Lucky Lucky 텍스트 잔영 정리
      hideLuckyLuckyEffect(biteAlertEl);

      // ★ Day 29 — 멀티히트 자동선택: 가장 큰 등급 1개만 잡기게임으로
      //   원본 매칭 수는 originalMatchCount 로 catch-game 에 전달 (×N 배수 보상 유지)
      const originalMatchCount = results.length;
      let selectedResults = results;
      if (results.length >= 2) {
        // 가장 큰 등급의 결과 1개 선택 (동률이면 첫 번째 매칭 우선)
        let highestRank = -1;
        let highestResult = results[0];
        for (const r of results) {
          const rank = GRADE_RANK[r.grade] ?? -1;
          if (rank > highestRank) {
            highestRank = rank;
            highestResult = r;
          }
        }
        selectedResults = [highestResult];
      }

      // 깜박임 방지 — 잡기 게임이 화면 덮은 상태에서 cast 버튼을 미리 'cast'로
      // (이렇게 하면 잡기 게임 unmount 직후 'pull' 상태가 잠깐 보이지 않음)
      cast.setState('cast');
      // Day 4-3: 결과 처리 흐름 동안 cast 비활성 시각 표시 (어둑함 + 클릭 차단)
      // → 결과 팝업 사이 텀에 사용자가 "왜 안 눌리지?" 버그 느낌 방지
      cast.setBusy(true);

      // Day 4-3: 잡기 게임 진입과 함께 슬롯 매칭 강조 종료
      // → 결과 팝업 사이 텀(1.1초)에 슬롯이 노출될 때 셀들이 계속 깜빡거리는
      //   "막 변하는" 잔영 시각 인상 차단 (다중매칭에서 특히 두드러졌던 증상)
      clearAllHighlights();

      overlayLayer.innerHTML = '';
      overlayLayer.classList.add('show');
      // Day 19 — 잡기게임 진입 시 sparkle-field 숨김 (paint 비용 0 → 잡기게임 렉 해소).
      //   골든힛 모드일 때만 sparkle-field 존재. 일반 모드는 null 가드로 안전.
      if (goldenSparkleField) goldenSparkleField.classList.add('sparkle-field--hidden');
      catchGameScreen.mount(overlayLayer, {
        results: selectedResults,
        originalMatchCount,            // ★ Day 29 — 멀티히트 배수 보존
        hasBoss: pendingHasBoss,
        onClose: ({ caught, missed }) => {
          overlayLayer.classList.remove('show');
          catchGameScreen.unmount();
          overlayLayer.innerHTML = '';
          // Day 19 — 잡기게임 종료 시 sparkle-field 다시 보이게 (visibility 복귀).
          if (goldenSparkleField) goldenSparkleField.classList.remove('sparkle-field--hidden');
          pendingHasBoss = false;

          if (missed.length > 0) {
            console.log('[catch-game] 놓침:', missed.map(m => m.fish.name).join(', '));
          }

          // ───────────────────────────────────────
          // Lucky-2 (Day 9): 잡힌 1마리에 대해 드롭 시도
          // Day 10 — 세트 효과: 발견 확률 추가 (4부위 동일 등급 시)
          // ───────────────────────────────────────
          // 다중매칭이어도 catch-game.js 의 finishGame 에서 selectedFish 1마리만
          // caught 에 들어옴 (Day 3 결정). 따라서 caught[0] 에 대해서만 시도.
          //
          // 흐름:
          //   1. inv 한 번 읽기 + null 가드 + 세트 발견 보너스 캐싱
          //   2. tryRollDrop(grade, setDropBonus) → null 또는 { slotId, grade }
          //   3. 가방 가득 체크: isFull → bagFull 플래그 (장비 생성 X)
          //   4. 가득 X → makeEquipment + 가방에 push + 즉시 saveInventory
          //   5. 결과 객체에 dropPayload 첨부 → fish-result.js 가 흐름 분기
          // ───────────────────────────────────────
          const caughtWithDrop = caught.map((r, idx) => {
            // 첫 번째 잡힘 1마리에만 드롭 시도 (실제로 caught.length 는 항상 0 또는 1)
            if (idx !== 0) return { ...r, missed: false };

            // ★ Day 27 — 골든힛 결과는 아이템(장비) 보상 완전 제거 (대표 결정 Q10)
            //   무게만 획득 — drop 시도 자체 skip
            if (r.isGoldenHit) return { ...r, missed: false };

            // Day 9 후속 + Day 10: inv 한 번만 읽고 세트 보너스 같이 캐싱.
            // null 가드: 첫 실행 등 가방 미저장 상태 → 기본 가방 생성 후 진행.
            // (이게 없으면 isFull(null) TypeError → onClose 중단 → 결과팝업 미표시)
            let inv = loadInventory();
            if (!inv) {
              inv = makeDefaultInventory();
              saveInventory(inv);
            }

            // Day 10 — 세트 효과: 4부위 동일 등급 시 드롭 발생 확률 +%p (cap 100%는 tryRollDrop 안)
            const setGrade     = getSetGrade(inv);
            const setDropBonus = getSetDropRateBonus(setGrade);
            // ★ Day 27 — 골든힛 드롭 보너스 제거 (위 early-return으로 골든힛 분기 도달 안 함)
            // Day 16: 장비 도감 코스메틱 보상 = 드롭 +%p (등록 16개 합 = +10%p)
            //   getCodexBonuses().dropRatePct 는 % 단위 (예: 5.234) → /100 변환
            const codexDropBonus = (getCodexBonuses().dropRatePct || 0) / 100;
            // Day 18 — 레벨 누적 발견 확률 (1렙=0, 50렙=+4.9%p)
            //   getLevelBonuses().set_drop_rate 는 % 단위 → /100 변환
            const levelDropBonus = (getLevelBonuses().set_drop_rate || 0) / 100;
            const totalBonus   = setDropBonus + codexDropBonus + levelDropBonus;

            // ★ Day 25 — 방식 A: 확률 1번 통과 → 지역별 수량 추첨 → 복수 아이템 생성
            if (!checkDropChance(r.grade, totalBonus)) return { ...r, missed: false };

            // 가방 가득 체크 — 1개도 못 넣으면 bagFull
            if (isFull(inv)) {
              return {
                ...r,
                missed:      false,
                dropPayload: { bagFull: true },
              };
            }

            // 지역별 수량 추첨
            // ★ Day 27 — 신화보스(검은 25+ 황금빛꿈고래, 분홍/황금/하얀 10+ 신화 4종)는
            //   대표 결정 Q-G: 무조건 1개만 드롭 (전설 50% / 신화 50% 중 1개)
            //   → dropCount = 1 강제 + LUCKY_DROP_GRADE_POOL['신화보스'] = [legendary 0.5, mythic 0.5]
            const dropCount = (r.grade === '신화보스') ? 1 : rollDropCount(stage.id);
            const droppedItems = [];

            for (let di = 0; di < dropCount; di++) {
              if (isFull(inv)) break;  // 도중 가방 가득 → 그 자리에서 중단
              const slotId    = rollDropSlot();
              const grd       = rollDropGrade(r.grade);
              const catalogId = `${slotId}_${grd}`;
              // ★ Day 41 (대표 결정) — stage.id 전달 → 3종 옵션(weight/combo/kabikabi)에 지역 multiplier 적용
              const newItem   = makeEquipment(catalogId, { stageId: stage.id });
              if (!newItem) {
                console.warn('[lucky-drop] makeEquipment 실패:', catalogId);
                continue;
              }
              inv.items.push(newItem);
              addBagNewItemId(newItem.id);
              const entry = getCatalogEntry(catalogId);
              droppedItems.push({
                catalogId,
                slotId,
                grade:    grd,
                name:     entry?.name || catalogId,
                slotName: entry?.slotName || '',
              });
            }

            if (droppedItems.length === 0) return { ...r, missed: false };

            saveInventory(inv);
            refreshCodexDots();

            // 가장 높은 등급 기준으로 긴장감 색 결정 (fish-result.js 의 TENSION_COLOR 셀렉터용)
            const GRADE_ORDER_DROP = ['common','uncommon','rare','epic','legendary','mythic'];
            const topGrade = droppedItems.reduce((best, item) => {
              return GRADE_ORDER_DROP.indexOf(item.grade) > GRADE_ORDER_DROP.indexOf(best)
                ? item.grade : best;
            }, droppedItems[0].grade);

            return {
              ...r,
              missed:      false,
              dropPayload: {
                bagFull: false,
                items:   droppedItems,          // ★ Day 25 — 복수 아이템 배열
                grade:   topGrade,              // 긴장감 색 결정용 (최고 등급)
                // 하위 호환 필드 (단일 참조 시 첫 번째 아이템 기준)
                catalogId: droppedItems[0].catalogId,
                slotId:    droppedItems[0].slotId,
                name:      droppedItems[0].name,
                slotName:  droppedItems[0].slotName,
              },
            };
          });

          // 잡힌 물고기 + 놓친 물고기 모두 결과 팝업 큐에 차례차례
          // (잡힘 = caught: false / 놓침 = missed: true)
          fishResultQueue = [
            ...caughtWithDrop,
            ...missed.map(r => ({ ...r, missed: true })),
          ];
          showNextFishResult();
        },
      });
    }

    /**
     * ★ Day 22: HIDDEN HIT 미니게임 진입 (Phase 4A~4D)
     *
     * 일반 openCatchGame 과 분리 — HIDDEN 모드는 results 없음 (잡기 보스 1마리 고정),
     * mount 시 hiddenMode 옵션 전달.
     *
     * Phase 4D 동작:
     *   - catch-game finishHiddenGame 이 추첨 등급 + rolled 무게 + perfectCount 결정 → caught/missed
     *   - onClose: 콤보/장비 무게 보너스 적용 (일반 잡기 결과와 동일 패턴) → 최종 결과 console.log + finishTurn
     *
     * Phase 6 카드뒤집기 / Phase 7 결과팝업 추가 시 이 onClose 안에서 분기 추가 예정.
     */
    function openCatchGameHidden() {
      // 일반 openCatchGame 과 동일한 진입 준비 (cast 비활성 + 슬롯 강조 종료)
      cast.setState('cast');
      cast.setBusy(true);
      clearAllHighlights();

      overlayLayer.innerHTML = '';
      overlayLayer.classList.add('show');
      if (goldenSparkleField) goldenSparkleField.classList.add('sparkle-field--hidden');

      catchGameScreen.mount(overlayLayer, {
        hiddenMode: true,
        results: [],
        hasBoss: false,
        stageMultiplier: stage.weightMultiplier,  // ★ Day 24 — HIDDEN HIT 무게에 지역 배율 적용 (하이브리드)
        onClose: ({ caught = [], missed = [] }) => {
          overlayLayer.classList.remove('show');
          catchGameScreen.unmount();
          overlayLayer.innerHTML = '';
          if (goldenSparkleField) goldenSparkleField.classList.remove('sparkle-field--hidden');

          // ★ Day 22 Phase 7: 잡기 성공 → 카드뒤집기 → fish-result 결과 팝업 통합
          //   1. 장비 드롭 시도 (tryRollDrop) — 일반 흐름 패턴 그대로 (세트/코덱스/레벨 보너스)
          //   2. 가방 가득 체크 → dropPayload 첨부
          //   3. fishResultQueue 에 caught + missed push → showNextFishResult
          //   4. fish-result.js 가 도감 등록 (registerFishCatch) 자동 처리
          //   HIDDEN HIT 특이사항:
          //     - isGoldenHit=false → goldenBonus=0
          //     - multiplier 명시 X (다중매칭 X) → 자동 1
          //     - cardMultiplier 는 weight 에 이미 반영, 별도 표시 X
          if (caught.length > 0) {
            const r = caught[0];
            // 카드 배수 미정 — 카드뒤집기 결과 받은 후 보너스 적용 (closure 캡처)
            showHiddenCardFlip(hiddenCardFlip, (cardMultiplier) => {
              // 활성 장비/세트 옵션 캐싱 (handleCast 와 동일 패턴)
              let inv = loadInventory();
              if (!inv) {
                inv = makeDefaultInventory();
                saveInventory(inv);
              }
              const codexBonuses = getCodexBonuses();
              const activeOpts = getActiveOptions(inv, codexBonuses);
              const setGrade = getSetGrade(inv);
              const setWeightBonusPct = getSetWeightBonus(setGrade);

              // 무게 보너스 적용 (일반 handleMatchFound 와 동일 함수)
              const rolledWeight = r.baseWeight;
              const totalWeightPct = (activeOpts.weight_bonus || 0) + setWeightBonusPct;
              const equipmentBonus = rolledWeight * (totalWeightPct / 100);
              const comboBonus = calcComboBonus(rolledWeight, activeOpts, comboCount);
              const finalWeight = applyWeight(rolledWeight, activeOpts, comboCount, setWeightBonusPct);
              // ★ Day 22 Phase 7 후속 (대표 결정): weight 자체는 cardMultiplier 미적용 (수식 더한 값).
              //   결과 팝업 표시: "{수식 더한 값} kg × cardMultiplier" — 사용자가 직접 곱셈 확인 가능.
              //   실제 누적 무게는 fish-result onAccumulate / onConfirm 에서 cardMultiplier 별도 곱.

              // ───────────────────────────────────────
              // ★ Phase 7: 장비 드롭 시도 (Lucky-2 + 세트/코덱스/레벨 보너스)
              //   일반 openCatchGame onClose 의 caughtWithDrop 패턴 그대로 적용
              // ───────────────────────────────────────
              const setDropBonus = getSetDropRateBonus(setGrade);
              const goldenBonus = 0;   // HIDDEN HIT 은 골든힛 X
              const codexDropBonus = (codexBonuses.dropRatePct || 0) / 100;
              const levelDropBonus = (getLevelBonuses().set_drop_rate || 0) / 100;
              const totalBonus = setDropBonus + goldenBonus + codexDropBonus + levelDropBonus;

              // ★ Day 25 — 방식 A: 확률 1번 통과 → 지역별 수량 추첨 → 복수 아이템 생성
              let dropPayload = null;
              if (checkDropChance(r.grade, totalBonus)) {
                if (isFull(inv)) {
                  dropPayload = { bagFull: true };
                } else {
                  const dropCount  = rollDropCount(stage.id);
                  const droppedItems = [];
                  const GRADE_ORDER_DROP = ['common','uncommon','rare','epic','legendary','mythic'];

                  for (let di = 0; di < dropCount; di++) {
                    if (isFull(inv)) break;
                    const slotId    = rollDropSlot();
                    // ★ Day 27 — 히든힛 장비 등급은 지역 기준 (어종 등급 무관, 대표 결정 Q-H)
                    //   Epic 기준 1/3/5/7/10/15% — 후반 지역으로 갈수록 영웅 이상 점진 증가
                    const grd       = rollHiddenDropGrade(stage.id);
                    const catalogId = `${slotId}_${grd}`;
                    // ★ Day 41 (대표 결정) — stage.id 전달 → 3종 옵션 지역 multiplier 적용
                    const newItem   = makeEquipment(catalogId, { stageId: stage.id });
                    if (!newItem) {
                      console.warn('[lucky-drop HIDDEN] makeEquipment 실패:', catalogId);
                      continue;
                    }
                    inv.items.push(newItem);
                    addBagNewItemId(newItem.id);
                    const entry = getCatalogEntry(catalogId);
                    droppedItems.push({
                      catalogId,
                      slotId,
                      grade:    grd,
                      name:     entry?.name || catalogId,
                      slotName: entry?.slotName || '',
                    });
                  }

                  if (droppedItems.length > 0) {
                    saveInventory(inv);
                    refreshCodexDots();

                    const topGrade = droppedItems.reduce((best, item) => {
                      return GRADE_ORDER_DROP.indexOf(item.grade) > GRADE_ORDER_DROP.indexOf(best)
                        ? item.grade : best;
                    }, droppedItems[0].grade);

                    dropPayload = {
                      bagFull: false,
                      items:   droppedItems,
                      grade:   topGrade,
                      catalogId: droppedItems[0].catalogId,
                      slotId:    droppedItems[0].slotId,
                      name:      droppedItems[0].name,
                      slotName:  droppedItems[0].slotName,
                    };
                  }
                }
              }

              // 최종 결과 객체 (일반 잡기 결과와 동일 형식)
              const finalResult = {
                ...r,
                weight:         finalWeight,        // ★ Phase 7 후속 (대표 결정) — cardMultiplier 미적용 (수식 더한 값)
                baseWeight:     rolledWeight,
                equipmentBonus,
                comboBonus,
                comboLevel:     comboCount,
                cardMultiplier,                     // 표시 + onAccumulate/onConfirm gainedKg 계산 시 적용
                missed:         false,
                dropPayload,
              };

              console.log('[HIDDEN HIT Phase 7] 최종 잡기 결과 (카드 배수 + 장비 드롭):', {
                grade:           finalResult.grade,
                rolledWeight,
                equipmentBonus:  Math.round(equipmentBonus),
                comboBonus:      Math.round(comboBonus),
                comboLevel:      finalResult.comboLevel,
                cardMultiplier,
                weightBeforeCard: finalResult.weight,                          // cardMultiplier 미적용
                actualGainedKg:   Math.round(finalResult.weight * cardMultiplier), // 실제 누적 무게
                perfectCount:    finalResult.perfectCount,
                dropPayload,
              });

              // fish-result 팝업 표시 + (있으면) missed 도 함께 큐 (Phase 5 후속과 동일 패턴)
              fishResultQueue = [
                finalResult,
                ...missed.map(m => ({ ...m, missed: true })),
              ];
              showNextFishResult();
              // (finishTurn 은 showNextFishResult 큐 다 끝나면 자동 호출)
            });
            return;
          } else if (missed.length > 0) {
            const m = missed[0];
            console.log('[HIDDEN HIT Phase 4D] 시간 종료 실패 — 보상 X / PERFECT', m.perfectCount, '회');
            // ★ Day 22 Phase 5 후속 (대표 결정): missed 시 fish-result 팝업 호출 (일반 잡기 missed 와 동일 흐름)
            //   fish-result.js 의 missed 분기 = "MISSED" 라벨 + 그림자/실제 fish 표시 + 무게 X
            fishResultQueue = missed.map(r => ({ ...r, missed: true }));
            showNextFishResult();
            return;   // finishTurn 은 fish-result 팝업 닫을 때 자동 호출 (showNextFishResult 흐름)
          }

          console.log('[HIDDEN HIT Phase 4D] catch-game close → finishTurn');
          finishTurn();
        },
      });
    }

    const minigameIntro = createMinigameIntro({
      onConfirm: () => {
        // Day 15: 골든힛 타임 진입 (cast 활성화는 enterGoldenHitTime 안에서 처리)
        //   ★ finishTurn 호출 X — 진입 직후 카운트 차감 회피 (3→2 버그 수정)
        enterGoldenHitTime();
      },
    });

    // Day 20: 트윙클 타임 진입 팝업 — onConfirm 에서 카드 미니게임으로 진입
    const twinkleIntro = createTwinkleIntro({
      onConfirm: () => {
        enterTwinkleHitTime();
      },
    });

    // ★ Day 22: HIDDEN BOSS 진입 팝업 — onConfirm 에서 잡기 게임 HIDDEN 모드 진입 (Phase 4A)
    //   Phase 4A: openCatchGameHidden() → 분홍 배경 catch-game + anywhere click close
    //   Phase 4B/C/D 에서 보스 그림자/체력바/카운트다운/타이머/판정/종료 처리 추가
    const hiddenIntro = createHiddenIntro({
      onConfirm: () => {
        openCatchGameHidden();
      },
    });

    // ★ Day 35 (대표 결정 A-가) — 신화 트리거 진입 팝업.
    //   트윙클 타임 중 트윙클 15+ 누적 → 황금빛꿈고래 발동 시 표시.
    //   ★ Day 36 변경 — Special Mythic Hit Intro → 사용자 pull → 이 mythic-intro 표시 → 터치 → 잡기게임.
    //                  onConfirm 안에서 bite-alert hide 호출 제거 (Day 36 에서 bite-alert 자체를 안 띄움).
    const mythicIntro = createMythicIntro({
      onConfirm: () => {
        activeBiteInfo = null;
        processNextResult();
      },
    });

    // ★ Day 36 (대표 결정) — SPECIAL MYTHIC HIT 인트로 (floating UI, backdrop X).
    //   꿈조각 보상 팝업 닫힘 → handleMythicTriggerHit 안에서 표시.
    //   사용자 슬롯 cast(pull) 버튼 터치 → handlePull 에서 hide + mythic-intro 표시.
    const specialMythicHitIntro = createSpecialMythicHitIntro();

    // ★ Day 22 Phase 6: HIDDEN HIT 카드뒤집기 (X1/X3/X5 무게 보너스)
    //   onSelect 는 showHiddenCardFlip 호출 시 다이내믹 설정 (openCatchGameHidden onClose 안에서)
    const hiddenCardFlip = createHiddenCardFlip();

    // Day 20: 트윙클 타임 종료 보상 팝업 (꿈조각 +N 개)
    const twinkleRewardPopup = createTwinkleRewardPopup();

    // ============================================
    // 흐름
    // ============================================
    let isProcessing = false;
    let resultQueue = [];
    let pendingGoldenTrigger = false;
    // Day 20: 꿈조각(트윙클) 트리거 대기 플래그 — pendingGoldenTrigger 와 동일 패턴
    let pendingTwinkleTrigger = false;
    // ★ Day 22: HIDDEN HIT(분홍) 트리거 대기 플래그 — Phase 2 (Phase 3 에서 진입 팝업 추가 예정)
    let pendingHiddenTrigger = false;
    let pendingHasBoss = false;  // Day 3 v2: 잡기 게임에 분홍 매칭 정보 전달용 (★ Day 22 — 항상 false)
    let autoMode = false;  // Day 3: 꽝 시 자동 다시 던지기
    // Day 15 — 골든힛 타임 상태 ★
    //   isActive: 골든힛 모드 ON/OFF
    //   remaining: 남은 cast 횟수 (3 → 0)
    //   savedComboCount: 진입 직전 보존된 콤보 (종료 시 복원)
    //   makeInactiveGoldenHitState() 로 초기화 (모든 필드 0/false)
    let goldenHitState = makeInactiveGoldenHitState();
    // Day 19 — 골든힛 타임 동안 슬롯 그리드 안에 부착되는 별빛 필드 SVG (라스베가스 마퀴 대체).
    //   enterGoldenHitTime 에서 createSparkleField() → appendChild,
    //   exitGoldenHitTime / unmount 에서 remove + null 처리.
    let goldenSparkleField = null;
    // Day 20 — 트윙클 타임 동안 슬롯 그리드 안에 부착되는 별 입자 필드 (골든힛과 동일 패턴, 톤만 흰색·연푸른).
    //   enterTwinkleAutoCast → createSparkleField({shape:'star', tone:'twinkle'}) + appendChild
    //   exitTwinkleHitTime → remove + null
    let twinkleSparkleField = null;
    // Day 20 — 트윙클(꿈조각) 타임 상태:
    //   isActive: 자동 캐스트 모드 ON/OFF (카드 게임 끝나고 N회 결정된 후 활성)
    //   remaining: 남은 cast 횟수 (3/5/7/10 → 0)
    //   started: 첫 cast 클릭 여부 (false면 대기, true면 차감 시작)
    //   savedComboCount: 진입 직전 콤보 (종료 시 복원)
    //   savedGridData: 진입 직전 슬롯 결과 그리드 (종료 시 fillGrid 로 복원)
    //   lockedCells: 잠긴 셀 [{row,col}] (트윙클 매칭으로 누적되는 꿈조각 셀)
    //   rewardCount: 누적 꿈조각 보상 수 (lockedCells.length 와 동일)
    let twinkleHitState = {
      isActive: false,
      remaining: 0,
      started: false,
      savedComboCount: 0,
      savedGridData: null,
      lockedCells: [],
      rewardCount: 0,
      goldenWhaleTriggered: false,   // ★ Day 29 — 트윙클 누적 클러스터 15+ 도달 시 true
    };
    // Day 13 — 세션 복원용 ★: showBiteAlert 호출 시 정보 저장 → unmount 시 saveSlotSession 에 포함
    //   히트 팝업 떠있는 상태에서 강화/합성 다녀와도 그대로 복원 가능.
    let activeBiteInfo = null;
    // Day 13 추가 ★ — 마지막 spin 결과 그리드 심볼 (대표 결정 — 다른 화면 다녀와도 심볼 보존).
    //   spinGrid 호출 후 newGrid 를 여기에 보관 → unmount 시 saveSlotSession 에 포함.
    //   mount 시 sessionData.gridData 있으면 fillGrid 로 복원.
    //   활성 흐름 (콤보/큐/pull) 이 없어도 lastGridData 만 있으면 세션 저장 → 다음 진입 시 그리드 보임.
    let lastGridData = null;
    // Day 13 추가 ★ — 매칭된 셀 효과 정보 (대표 결정 — 슬롯 당첨효과도 보존).
    //   handleMatchFound 시 채우고, clearAllHighlights 시 비움.
    //   {row, col, grade, symbol} 배열 — mount 시 cell.setMatched(true, ...) 재적용.
    let lastMatchedCells = [];
    //   황금 매칭 셀 정보 — {row, col} 배열. mount 시 cell.setGoldenMatched(true) 재적용.
    let lastGoldenMatchedCells = [];
    //   Day 20: 트윙클 매칭 셀 정보 — {row, col} 배열. Phase 3 진입 시점/종료 시 사용.
    let lastTwinkleMatchedCells = [];
    //   ★ Day 22: HIDDEN HIT(분홍) 매칭 셀 정보 — {row, col} 배열. drawHiddenLine 에 전달.
    let lastHiddenMatchedCells = [];
    //   ★ Day 26: 까비까비 매칭 클러스터 정보 — Phase 4.2 텍스트 오버레이용 (위치/색/무게 보관).
    //   각 원소: { cells: [{row,col,symbol}], size, colorIdx (1~5), weight (kg, 소수 2자리) }
    let lastKabikabiClusters = [];
    //   ★ Day 31 — 검은 HIT + 까비까비 동시 발생 시 까비 무게 임시 보관 (잡기 결과에 합산용).
    //   - 검은 HIT 동시 발생: 즉시 보상 차단 → 여기 저장 → handleMatchFound 에서 resultQueue 각 항목에 분배
    //   - 골든/히든/트윙클/단독: 0 그대로 (즉시 보상은 위에서 직접 처리)
    //   - handleMatchFound 종료 시 0 으로 리셋
    let pendingKabikabiTotalWeight = 0;
    // ★ Day 36 (대표 결정) — 신화 트리거 흐름: SPECIAL MYTHIC HIT 인트로 표시 후 사용자 pull 대기.
    //   handlePull 진입부에서 이 플래그 true 면 special intro hide + mythic-intro 표시 + 플래그 reset + return (일반 매칭 처리 건너뜀).
    let awaitingMythicPull = false;
    // ★ Day 37 (대표 결정) — 황금빛꿈고래 트리거 시 트윙클 진입 직전 그리드 임시 보관.
    //   exitTwinkleHitTime 에서 즉시 복원 X (트윙클 마지막 화면 유지) → 잡기게임 종료 후 finishTurn 에서 복원.
    let pendingTwinkleRestoreGrid = null;
    // ★ Day 37 (대표 결정 후속) — 황금빛꿈고래 트리거 시 트윙클 시각(황금 테두리) 보존.
    //   exitTwinkleHitTime 에서 즉시 정리 X: twinkle-time-active 클래스 / data-mythic-candidate / matched-twinkle 모두 유지.
    //   잡기게임 종료 후 finishTurn 에서 이 좌표들 기준으로 일괄 정리.
    //   값 = lockedCells 좌표 배열 (사본) | null
    let pendingTwinkleLockedCells = null;

    const SPIN_DURATION = 2000;
    const BITE_BEFORE = 500;
    const BOBBER_HIDE_BEFORE = 200;
    const AUTO_PRESS_DELAY = 200;     // 꽝 인지 휴지
    const AUTO_PRESS_DURATION = 300;  // 버튼 눌리는 모션 시간 = cast-btn--auto-press 애니메이션 길이

    function clearAllHighlights() {
      // Day 20: 트윙클 자동 캐스트 중에는 잠긴 셀의 setTwinkleMatched 보존
      const lockedSet = twinkleHitState.isActive
        ? new Set(twinkleHitState.lockedCells.map(({ row, col }) => row * grid.cols + col))
        : new Set();

      grid.cells.forEach((cell, idx) => {
        cell.setMatched(false);
        cell.setGoldenMatched(false);
        // ★ Day 26 — 까비까비 매칭 클리어 (Mixed 클러스터 테두리 네온 해제)
        cell.setKabikabiMatched(false);
        if (!lockedSet.has(idx)) {
          cell.setTwinkleMatched(false);
        }
      });
      // Day 13 추가 — 매칭 정보 클리어 (다음 spin 또는 처리 종료 시점에 상태 리셋)
      lastMatchedCells = [];
      lastGoldenMatchedCells = [];
      // Day 20: 트윙클 트리거 셀 정보 — 자동 캐스트 중에는 이미 비어있음 (enterTwinkleAutoCast 에서 비움)
      if (!twinkleHitState.isActive) {
        lastTwinkleMatchedCells = [];
      }
      // ★ Day 26 — 까비까비 매칭 정보 클리어
      lastKabikabiClusters = [];
      // ★ Day 26 — 까비까비 텍스트 오버레이 강제 클리어 (남아있던 애니메이션 중인 텍스트 제거)
      clearAllKabikabiText(grid.root);
    }

    // Day 4: 마지막으로 표시한 결과 — 팝업 닫힌 후 KG 반영 시 사용
    let lastShownResult = null;

    /* ============================================
       Day 18 — 레벨업 팝업 + 새 지역 알림 (Phase 5 연결)
       ============================================
       흐름:
       1) onAccumulate: 무게 합산 시점에 addExp(kg) 호출 → 레벨업 결과를 pendingLevelUp 에 저장
       2) onConfirm: 떠오름 연출 끝나면 (1100ms 후) 레벨업 팝업 트리거 (pendingLevelUp 있으면)
       3) 레벨업 팝업 닫힘 → 새 지역 해제 목록이 있으면 new-stage-alert 큐로 순차 표시
       4) 모든 알림 끝나면 showNextFishResult() 로 다음 결과 진행 */

    /** @type {{prevLevel: number, newLevel: number} | null} */
    let pendingLevelUp = null;
    /** 새 지역 알림 큐 모두 닫혔을 때 실행할 콜백 (1회용) */
    let pendingNewStagesCallback = null;

    const levelUpPopup = createLevelUpPopup();
    root.appendChild(levelUpPopup.root);
    disposers.push(() => levelUpPopup.dispose());

    const newStageAlert = createNewStageAlert({
      onAllClosed: () => {
        const cb = pendingNewStagesCallback;
        pendingNewStagesCallback = null;
        if (typeof cb === 'function') {
          try { cb(); } catch (_) { /* swallow */ }
        }
      },
    });
    root.appendChild(newStageAlert.root);
    disposers.push(() => newStageAlert.dispose());

    /** 레벨업 흐름 트리거 — 팝업 → (있으면) 새 지역 알림 → showNextFishResult */
    function triggerLevelUpFlow({ prevLevel, newLevel }) {
      // ★ Day 25 — 레벨업 즉시 슬롯 위 stats-bar 수치 갱신
      //   기존: 가방 닫힐 때만 statsBar.refresh() 호출 → 렙업해도 입질/황금/무지개/반짝
      //   수치가 갱신 안 됨 (가방 들어갔다 와야 반영되는 버그)
      //   수정: triggerLevelUpFlow 진입 시 즉시 refresh() — getLevelBonuses 합산된 새 수치 반영
      statsBar.refresh();
      // ★ Day 25 Phase 3 — 레벨업 시 상상력도 즉시 갱신 (입질 4종 합산값 변동)
      hud.refreshImagination();

      const newStages = getNewlyUnlockedStages(prevLevel, newLevel);
      levelUpPopup.show({
        from: prevLevel,
        to:   newLevel,
        onClose: () => {
          if (newStages.length > 0) {
            // ★ Day 25 후속 (대표 결정) — 새 낚시터 알림 팝업 표시 시점에 빨간점 즉시 갱신.
            //   기존: 새 stage 가 잠금 해제 + SEEN_STAGE_IDS 미포함 상태가 됐는데도
            //   refreshCodexDots() 호출이 없어서 햄버거 + 낚시터맵 빨간점이 다음 트리거까지 안 떴음.
            //   수정: 새 stage 알림 enqueue 직전 refreshCodexDots() → 팝업 열리는 순간 빨간점 표시.
            refreshCodexDots();
            // 큐 다 닫힌 후 다음 결과 진행
            pendingNewStagesCallback = () => showNextFishResult();
            for (const s of newStages) newStageAlert.enqueue(s);
          } else {
            showNextFishResult();
          }
        },
      });
    }

    const fishResult = createFishResult({
      // Lucky-5 (Day 9): 합산 = 첫 터치 시점, 떠오름 = 종료 시점.
      // 드롭 X 흐름: 어디든 터치 → onAccumulate → onConfirm (둘이 거의 동시)
      // 드롭 흐름:   첫 터치 → onAccumulate (게이지 차오름 시작),
      //              … 별/긴장감/장비 단계들 …,
      //              마지막 터치 → onConfirm (떠오름 텍스트 + 게이지 반짝)
      onAccumulate: () => {
        if (!lastShownResult || lastShownResult.missed) return;
        const mult = lastShownResult.multiplier && lastShownResult.multiplier >= 2
          ? lastShownResult.multiplier
          : 1;
        // ★ Day 22 Phase 7 후속 (대표 결정): HIDDEN HIT cardMultiplier 도 누적 무게에 적용.
        //   lastShownResult.weight 는 cardMultiplier 미적용 (수식 더한 값 — 결과 팝업 표시 일관성).
        //   실제 누적 = weight × mult(다중매칭) × cardMultiplier(카드 배수).
        const cardMult = lastShownResult.cardMultiplier || 1;
        const gainedKg = lastShownResult.weight * mult * cardMult;
        // ★ Day 21 — kgCurrent 변수 폐기 (Day 18 EXP 게이지 통합 후 미사용).
        //   addExp 호출이 실제 게이지 + 옆 무게 텍스트 갱신을 담당 (storage.totalExp 자동 저장).

        // Day 18 — 경험치 추가 (무게 = 경험치). 다중 레벨업 시 pendingLevelUp 에 캡처.
        const expResult = addExp(gainedKg);
        if (expResult.leveledUp) {
          // 이미 pending 있으면 newLevel 만 갱신 (한 onAccumulate 안에서 여러번 일어날 일은 없지만 방어적)
          if (pendingLevelUp) {
            pendingLevelUp.newLevel = expResult.newLevel;
          } else {
            pendingLevelUp = {
              prevLevel: expResult.prevLevel,
              newLevel:  expResult.newLevel,
            };
          }
          // ★ Day 38 후속 (대표 보고 — 1→2 렙업 즉시 반영 누락 버그 수정).
          //   기존: 1100ms 후 triggerLevelUpFlow(onConfirm) 에서만 statsBar.refresh / hud.refreshImagination
          //         호출. 다른 렙업은 자연스럽게 동작하지만 첫 렙업(1→2)에서 누락되는 케이스 발생.
          //   변경: addExp 직후 즉시 호출 → 어떤 흐름에서도 갱신 보장 (onConfirm 시점 중복 호출 무해).
          //   참고: getActiveOptions 가 이미 getLevelBonuses 자동 합산하므로 refresh 만 호출하면 충분.
          statsBar.refresh();
          hud.refreshImagination();
        }

        // Lucky-5: 게이지 채움만 (떠오름 텍스트는 onConfirm 시점).
        // ★ Day 21 — hud.setKg stub 대신 setLevelProgress 직접 호출 (kgCurrent 폐기).
        hud.setLevelProgress();
      },
      onConfirm: () => {
        // 팝업 닫힌 후 떠오름 표시 (잡힌 마리만, missed는 변동 X)
        if (lastShownResult && !lastShownResult.missed) {
          const mult = lastShownResult.multiplier && lastShownResult.multiplier >= 2
            ? lastShownResult.multiplier
            : 1;
          // ★ Day 22 Phase 7 후속 (대표 결정): HIDDEN HIT cardMultiplier 도 burst 표시에 적용.
          const cardMult = lastShownResult.cardMultiplier || 1;
          const gainedKg = lastShownResult.weight * mult * cardMult;
          // Lucky-5: 떠오름 텍스트 + 게이지 반짝 (KG 합산은 이미 onAccumulate 시점에 처리됨)
          hud.showGainBurst(gainedKg);
          // ★ Day 26 (대표 결정 시안 B) — 슬롯 그리드 가운데 큰 버스트 (기존 게이지 위 떠오름 텍스트 폐기)
          showCenterGainBurst(grid.root, gainedKg);
          lastShownResult = null;
          // Day 18 — 떠오름 1100ms 후: 레벨업 발생했으면 팝업, 아니면 다음 결과
          const lvUp = pendingLevelUp;
          pendingLevelUp = null;
          if (lvUp) {
            setTimeout(() => triggerLevelUpFlow(lvUp), 1100);
          } else {
            setTimeout(() => showNextFishResult(), 1100);
          }
        } else {
          // missed면 연출 없이 즉시 다음
          lastShownResult = null;
          showNextFishResult();
        }
      },
    });

    let fishResultQueue = [];

    /**
     * 잡기 게임 종료 후 받은 caught + missed 결과를 차례차례 결과 팝업으로 표시
     * Day 4: KG 합산은 팝업 닫힌 onConfirm 시점에서 처리 (애니메이션 연동)
     */
    function showNextFishResult() {
      if (fishResultQueue.length === 0) {
        // 모든 결과 표시 완료 → 다음 단계
        if (pendingGoldenTrigger) {
          pendingGoldenTrigger = false;
          showMinigameIntro(minigameIntro);
        } else {
          finishTurn();
        }
        return;
      }
      const next = fishResultQueue.shift();
      lastShownResult = next;        // 닫힐 때 onConfirm에서 KG 반영
      showFishResult(fishResult, next);
      // Day 16 후속: 잡기 결과 표시 시점 = registerFishCatch 호출 시점 (fish-result 내부)
      //   → 슬롯 햄버거/메뉴 빨간점 즉시 갱신 (NEW 물고기 알림용).
      refreshCodexDots();
    }

    /**
     * Day 3 v2: 다중 매칭을 한 잡기 게임에서 통합 진행
     * resultQueue 전부 한 번에 catch-game으로 보냄
     */
    function processNextResult() {
      if (resultQueue.length > 0) {
        const allResults = resultQueue.slice();
        resultQueue = [];
        openCatchGame(allResults);
      } else if (pendingGoldenTrigger) {
        pendingGoldenTrigger = false;
        showMinigameIntro(minigameIntro);
      } else {
        finishTurn();
      }
    }

    function finishTurn() {
      clearAllHighlights();
      cast.setState('cast');
      cast.setBusy(false);  // Day 4-3: 결과 처리 흐름 끝, cast 다시 활성화
      isProcessing = false;
      // Day 13 — 활성 흐름 끝 (콤보는 별개로 유지됨 — 콤보는 매칭 시 +1, 꽝일 때만 0).
      // 큐/히트 팝업/대기 플래그 모두 0/null 인 상태이므로 활성 흐름은 끝났지만,
      // 그리드 심볼 (lastGridData) 은 보존되어야 다음 진입 시 결과가 보임 (대표 결정).
      // 따라서 resetSlotSession 은 여기서 호출하지 않음. 정리는 unmount disposer 가 알아서.
      // (이전: comboCount === 0 이면 resetSlotSession 호출 → 그리드 심볼도 함께 삭제되는 버그)
      activeBiteInfo = null;

      // ★ Day 37 (대표 결정) — 황금빛꿈고래 트리거 시 미뤘던 트윙클 진입 직전 그리드 복원.
      //   exitTwinkleHitTime 에서 미뤘던 복원을 잡기게임 종료 후 이 시점에 수행.
      //   (트윙클 마지막 화면 유지 → 잡기게임 진행 → 종료 후 일반 슬롯 화면으로 복귀)
      // ★ Day 37 후속 — 트윙클 시각(twinkle-time-active 클래스 / mythic-candidate / matched-twinkle) 도 함께 정리.
      if (pendingTwinkleLockedCells) {
        // 1) twinkle-time-active 클래스 제거 (황금 테두리 셀렉터 조건 1)
        grid.root.classList.remove('twinkle-time-active');
        // 2) mythic-candidate / mythic-triggered dataset 모두 클리어
        //    (Day 39 — mythic-triggered = size 15+ 황금 배경 dataset 도 함께 정리)
        for (const cell of grid.cells) {
          if (cell?.root?.dataset?.mythicCandidate) {
            delete cell.root.dataset.mythicCandidate;
          }
          if (cell?.root?.dataset?.mythicTriggered) {
            delete cell.root.dataset.mythicTriggered;
          }
        }
        // 3) matched-twinkle 클래스 제거 (황금 테두리 셀렉터 조건 2)
        pendingTwinkleLockedCells.forEach(({ row, col }) => {
          const idx = row * grid.cols + col;
          grid.cells[idx]?.setTwinkleMatched(false);
        });
        pendingTwinkleLockedCells = null;
      }
      if (pendingTwinkleRestoreGrid) {
        fillGrid(grid.cells, pendingTwinkleRestoreGrid);
        lastGridData = pendingTwinkleRestoreGrid;
        pendingTwinkleRestoreGrid = null;
      }

      // Day 15: 골든힛 타임 카운트 차감 후 종료 처리.
      //   Day 16 후속 (대표 결정): 차감은 runSpin 시작 시점에서 이미 처리됨 (cast 누르는 순간).
      //   여기서는 종료 검사만 — remaining === 0 이면 exitGoldenHitTime.
      //   미종료 시 autoMode = false 강제 (대표 결정 — 골든힛 모드는 항상 수동 cast)
      if (goldenHitState.isActive) {
        if (goldenHitState.remaining === 0) {
          // 이번 cast 가 마지막 골든힛 cast — 결과 처리 후 종료
          goldenHitState = { ...goldenHitState, isActive: false };
          exitGoldenHitTime();
        } else {
          autoMode = false;
          // showGoldenHitCount / saveGoldenHitSession 은 runSpin 시작 시 이미 호출
        }
      }

      // Day 20: 트윙클 자동 캐스트 종료 검사 (remaining === 0 이면 종료 + 보상 팝업)
      //   미종료 시 자동으로 다음 회차 진행 (대표 명시 — "해당횟수만큼 자동으로 슬롯이 돌아가고")
      //   종료 시: 대표 결정 — 마지막 슬롯 결과 + 잠긴 셀들 충분히 보이도록 2.5초 지연 후 exit.
      //     그 동안 cast 잠금으로 사용자 입력 차단.
      if (twinkleHitState.isActive) {
        // 조기 종료: 모든 셀이 잠김 (드물지만 가능 — 회전할 셀이 없음)
        const totalCells = grid.rows * grid.cols;
        const allLocked = twinkleHitState.lockedCells.length >= totalCells;
        if (twinkleHitState.remaining === 0 || allLocked) {
          // 마지막 슬롯 결과 머무름 — 사용자가 결과를 충분히 보도록 (대표 명시)
          cast.setBusy(true);   // 입력 차단
          setTimeout(() => {
            if (twinkleHitState.isActive) exitTwinkleHitTime();
          }, 2500);
          return;
        }
        // 자동 다음 회차 (autoMode 와 별개로 트윙클 모드 자체 자동 진행)
        setTimeout(() => {
          if (!twinkleHitState.isActive) return;   // 중간에 종료된 경우 방어
          cast.triggerPress();
        }, AUTO_PRESS_DELAY);
        setTimeout(() => {
          if (!twinkleHitState.isActive) return;
          runSpin();
        }, AUTO_PRESS_DELAY + AUTO_PRESS_DURATION);
        return;   // 일반 autoMode 분기 건너뛰기
      }

      // Day 3: 자동 모드면 버튼이 "스스로 눌리는" 모션 보이고 다음 spin
      // (매칭 발견 시에는 handleMatchFound에서 autoMode를 false로 끄므로
      //  여기서 자동 재실행되지 않음)
      if (autoMode) {
        // 1) 짧은 휴지 후 → 버튼 press 모션 트리거
        setTimeout(() => {
          if (!autoMode) return;
          cast.triggerPress();
        }, AUTO_PRESS_DELAY);

        // 2) press 모션 끝나는 시점에 다음 spin 시작
        setTimeout(() => {
          if (autoMode) runSpin();
        }, AUTO_PRESS_DELAY + AUTO_PRESS_DURATION);
      }
    }

    /**
     * 던지기 1회 실행 (회전 → 결과 분류)
     * 자동 모드일 때 finishTurn에서 재호출됨
     */
    async function runSpin() {
      if (isProcessing) return;
      isProcessing = true;

      // Day 3: 회전 중 = 버튼 "기다리다" 비활성 모드
      cast.setState('wait');

      // Day 16 후속 (대표 결정): 골든힛 카운트는 cast 누르는 "순간" 차감 (즉시 피드백).
      //   - 그 cast 자체는 골든힛 cast 로 진행되어야 하므로 isActive 는 유지 (remaining 만 -1)
      //   - 0 도달 시 종료(exitGoldenHitTime) 는 결과 처리 후로 미룸 (그 cast 도 골든힛 cast)
      //   - 이전: 결과 처리 후 tickGoldenHitState 호출 → 카운트 표시가 지연됨
      if (goldenHitState.isActive) {
        goldenHitState = {
          ...goldenHitState,
          remaining: Math.max(0, goldenHitState.remaining - 1),
        };
        showGoldenHitCount(comboTextEl, goldenHitState.remaining);
        saveGoldenHitSession({ stageId, ...goldenHitState });
      }

      // Day 20: 트윙클 자동 캐스트 — cast 누르는 순간 차감 (골든힛과 동일 패턴).
      //   - 첫 cast 클릭 시점: started=false → started=true 로 전환, remaining 그대로 유지 후 -1
      //     (즉, 첫 cast 도 즉시 차감 — 골든힛 동일. 대표 명시: "남은횟수 1바로 차감방식, 골든힛타임과 동일한 방식 차감")
      //   - 매 cast 마다 remaining -1, 라벨 갱신
      //   - 0 도달 시 종료(exitTwinkleHitTime) 는 결과 처리 후로 미룸
      if (twinkleHitState.isActive) {
        twinkleHitState = {
          ...twinkleHitState,
          started: true,
          remaining: Math.max(0, twinkleHitState.remaining - 1),
        };
        showTwinkleChance(comboTextEl, twinkleHitState.remaining);
      }

      clearAllHighlights();

      // Day 4-3: 방어적 클린업 — 이전 UI/상태 잔영 강제 정리
      // (race condition으로 hide transition 진행 중에 새 spin 시작되는 경우 대비)
      hideBiteAlert(biteAlertEl);
      activeBiteInfo = null;  // Day 13 — 새 던지기 시작 = 옛 히트 정보 폐기
      fishResult.classList.remove('show', 'revealed');
      fishResult.classList.add('hide');
      fishResultQueue = [];
      resultQueue = [];
      lastShownResult = null;
      pendingHasBoss = false;
      pendingGoldenTrigger = false;
      cast.setBusy(false);  // 만에 하나 busy 상태 잔존 시 풀어주기

      castBobber(bobberEl);

      // Equipment-4b: 장착된 장비 옵션을 슬롯 심볼 가중치에 적용
      // Day 10: inv 한 번만 읽고 옵션 + 세트 등급 같이 캐싱 (storage I/O 절약)
      // Day 16: 도감 보너스도 한 번 캐싱 — getActiveOptions / tryRollDrop 모두 사용
      // ★ Day 21 (대표 결정 A1 보정): getAdjustedSymbolList 에 stage.gridSize 전달
      //    → 그리드 크기 기반 보정 (큰 그리드일수록 매칭 심볼 가중치 ↓).
      const inv = loadInventory();
      const codexBonuses = getCodexBonuses();
      const activeOpts = getActiveOptions(inv, codexBonuses);
      const adjustedSymbolList = getAdjustedSymbolList(activeOpts, undefined, stage.gridSize);
      // Day 10 — 세트 효과: 4부위 동일 등급 검사 → 무게 보너스 % 계산
      const setGrade           = getSetGrade(inv);             // null | 'rare'/'epic'/'legendary'/'mythic'
      const setWeightBonusPct  = getSetWeightBonus(setGrade);  // 0 / 10 / 20 / 30 / 50
      let newGrid = generateGrid(stage.gridSize, adjustedSymbolList);

      // Day 15: 골든힛 타임 모드 — 검은/분홍 → 황금 치환, 물방울은 그대로 (확률 그대로)
      if (goldenHitState.isActive) {
        newGrid = newGrid.map(row => row.map(convertSymbolForGoldenHit));
      }

      // Day 20: 트윙클 자동 캐스트 모드 — 잠긴 셀은 'twinkle' 로 강제 유지 (회전 결과에 관계없이)
      //   spinGrid 가 lockedIndices 로 잠긴 셀 회전 스킵, newGrid 데이터도 일관되게 'twinkle'.
      let twinkleLockedIndices = [];
      if (twinkleHitState.isActive) {
        const cols = grid.cols;
        twinkleHitState.lockedCells.forEach(({ row, col }) => {
          newGrid[row][col] = 'twinkle';
          twinkleLockedIndices.push(row * cols + col);
        });
      }

      setTimeout(() => biteBobber(bobberEl), SPIN_DURATION - BITE_BEFORE);
      setTimeout(() => hideBobber(bobberEl), SPIN_DURATION - BOBBER_HIDE_BEFORE);

      await spinGrid(grid.root, grid.cells, newGrid, SPIN_DURATION, twinkleLockedIndices);
      // Day 13 ★ — 그리드 심볼 보존 (다른 화면 다녀와도 결과 유지).
      lastGridData = newGrid;

      turnValue += 1;
      turn.setValue(turnValue);
      // ★ Day 26 (대표 결정) — 매 cast +0.1kg 자동 보상 폐기 (이전 Day 21/23 룰 모두 제거).
      //   매칭/잡기로 얻은 무게만 addExp 호출 (꽝 = EXP 0).
      //   하지만 setLevelProgress 는 유지 (다른 경로로 게이지 갱신 시 동기화 필요).
      hud.setLevelProgress();

      // ★ Day 21 — 글로벌 누적 cast 횟수 저장 (스테이지 무관) + 마지막 stageId 저장 (재진입 시 복원).
      saveTotalTurnCount(turnValue);
      saveLastSlotStageId(stageId);

      await new Promise(r => setTimeout(r, 200));

      // Day 15: 골든힛 타임 cast — 클러스터 룰 무시, 황금 카운트 단일 룰
      if (goldenHitState.isActive) {
        await handleSpinCompleteGoldenHit(newGrid, activeOpts, setWeightBonusPct);
        return;
      }

      // Day 20: 트윙클 자동 캐스트 — 클러스터/잡기게임/콤보 전부 무시, twinkle 셀 잠금만 처리.
      if (twinkleHitState.isActive) {
        handleSpinCompleteTwinkleAutoCast(newGrid);
        finishTurn();
        return;
      }

      const clusters = findClusters(newGrid, 3);
      // Phase C: 황금도 인접 클러스터 3+ 매칭 (이전: 그리드 5개 흩어짐)
      const goldenClusters = findGoldenClusters(newGrid, 3);
      const hasGoldenTrigger = goldenClusters.length > 0;
      // Day 20: 꿈조각(트윙클) 인접 클러스터 3+ 매칭 — golden 이 우선, golden 없을 때만 twinkle
      const twinkleClusters  = !hasGoldenTrigger ? findTwinkleClusters(newGrid, 3) : [];
      const hasTwinkleTrigger = twinkleClusters.length > 0;
      // ★ Day 22: HIDDEN HIT(분홍) 매칭 검출 — golden/twinkle 우선, 둘 다 없을 때만 hidden 검사.
      //   분홍 클러스터는 findClusters() 결과에 fish 와 함께 포함되어 있으므로 symbol 필터로 추출.
      //   (cluster.js Day 22 — forceBoss 폐기로 분홍도 일반 매칭 큐에 포함됨)
      const rainbowClusters = (!hasGoldenTrigger && !hasTwinkleTrigger)
        ? clusters.filter(c => c.symbol === 'rainbow')
        : [];
      const hasHiddenTrigger = shouldTriggerHiddenHit(rainbowClusters);

      // ★ Day 26 — 까비까비 매칭 검출 (Mixed 클러스터, 대표 결정).
      //   - 입질 4종(fish/golden/rainbow/twinkle) 중 2종+ 섞인 인접 3+ 클러스터
      //   - HIT 클러스터 셀은 제외 (excludeCellSet) — 대표 Q-B A
      //   - 보상은 슬롯 결과 시점에 즉시 처리 (HIT 와 별개 — 대표 Q-바)
      //   - 콤보는 한 캐스트당 +1 (HIT/까비까비 어떤 매칭이라도 1개라도 있으면 — 대표 Q-D)
      const kabikabiExcludeSet = new Set();
      clusters.forEach(c => c.cells.forEach(({ row, col }) => kabikabiExcludeSet.add(`${row},${col}`)));
      goldenClusters.forEach(c => c.cells.forEach(({ row, col }) => kabikabiExcludeSet.add(`${row},${col}`)));
      twinkleClusters.forEach(c => c.cells.forEach(({ row, col }) => kabikabiExcludeSet.add(`${row},${col}`)));
      // (rainbowClusters 는 clusters 의 부분집합이므로 별도 추가 X)
      const kabikabiClusters = findKabikabiClusters(newGrid, kabikabiExcludeSet, 3);
      const hasKabikabiMatch = kabikabiClusters.length > 0;

      // ★ Day 29 — 신화 트리거 검출 (전 지역 적용, 대표 결정).
      //   배경: 등급 임계값 변경(10+=신화) 정합성 + 저렙 도파민 보강
      //   해당 심볼 10개 이상 매칭 → 골든힛/트윙클/히든힛 스킵 → 신화 출현
      //   - 황금 10+   : 골든힛 발동 안 함, 신화로 격상
      //   - 트윙클 10+ : 트윙클 카드 게임 발동 안 함, 신화로 격상  (★ Day 29 신규: 일반 슬롯 트윙클 10+ 신화 트리거 추가)
      //   - 분홍 10+   : 히든힛 발동 안 함, 신화로 격상
      //   우선순위: 황금 > 트윙클 > 분홍 (기존 매칭 분기 우선순위와 일관)
      //   신화 어종: mythic_02~04 무작위 (mythic_01 황금빛꿈고래는 트윙클 타임 중 트윙클 15+ 전용 — 별도 분기)
      let mythicTriggerSymbol = null;  // 'golden' | 'twinkle' | 'rainbow' | null
      {
        const goldenMaxSize  = goldenClusters.reduce((m, c) => Math.max(m, c.size), 0);
        const twinkleMaxSize = twinkleClusters.reduce((m, c) => Math.max(m, c.size), 0);
        const rainbowMaxSize = rainbowClusters.reduce((m, c) => Math.max(m, c.size), 0);
        if (goldenMaxSize >= 10)       mythicTriggerSymbol = 'golden';
        else if (twinkleMaxSize >= 10) mythicTriggerSymbol = 'twinkle';
        else if (rainbowMaxSize >= 10) mythicTriggerSymbol = 'rainbow';
      }

      if (mythicTriggerSymbol) {
        // ★ Day 37 (대표 결정 B-가) — 신화 트리거 매칭 셀에 신화 색(마젠타) 시각 효과.
        //   검은 10+ 신화보스 매칭(.matched[data-grade="신화보스"]) 와 동일 시각 — 통일된 신화 색.
        //   기존: handleMythicTriggerHit 호출만 → 매칭 셀에 setter 호출 없어서 시각 효과 X (대표 보고)
        //   변경: setMatched(true, '신화보스', 'fish') 호출 → .matched + data-grade="신화보스"
        //         → CSS .matched[data-grade="신화보스"] 마젠타 배경 + 글로우 + 펄스 자동 적용.
        //   symbol 은 'fish' 고정 (rainbow 분기로 빠지면 흰빛 코어 펄스 됨 → 마젠타 통일성 위해 'fish').
        const triggerClusters =
          mythicTriggerSymbol === 'golden'  ? goldenClusters  :
          mythicTriggerSymbol === 'twinkle' ? twinkleClusters :
          mythicTriggerSymbol === 'rainbow' ? rainbowClusters : [];
        triggerClusters.forEach(c => {
          c.cells.forEach(({ row, col }) => {
            const idx = row * grid.cols + col;
            grid.cells[idx]?.setMatched(true, '신화보스', 'fish');
            // Day 13 - 매칭 정보 저장 (화면 다녀와도 복원 가능)
            lastMatchedCells.push({ row, col, grade: '신화보스', symbol: c.symbol });
          });
        });
        handleMythicTriggerHit(mythicTriggerSymbol, activeOpts, setWeightBonusPct);
        return;
      }

      if (hasGoldenTrigger) {
        // Phase C: 클러스터 안 셀들만 발광 (B안 — matched-golden 클래스 = 황금 글로우 + 펄스)
        // 이전엔 그리드 전체 황금 셀 발광이었음
        const cols = grid.cols;
        // Day 13 추가 — 황금 매칭 셀 좌표 저장 (다른 화면 다녀와도 효과 복원용)
        lastGoldenMatchedCells = [];
        goldenClusters.forEach(c => {
          c.cells.forEach(({ row, col }) => {
            const idx = row * cols + col;
            grid.cells[idx]?.setGoldenMatched(true);
            lastGoldenMatchedCells.push({ row, col });
          });
        });
        // 자동 OFF
        autoMode = false;
        pendingGoldenTrigger = true;
        // Day 18 후속 (대표 결정) — 황금 매칭 연출 시작:
        //   1) 화면 전체 황금 입자 흩날림 (백그라운드, 자동 dispose)
        //   2) 셀들 사이 황금 선 천천히 그려짐 (2.5초)
        //   3) 선 끝나면 → 골든힛 진입 팝업 (pendingGoldenTrigger 분기 트리거)
        startGoldenParticles(root);
      } else if (hasTwinkleTrigger) {
        // Day 20: 꿈조각(트윙클) 매칭 연출 — 골든힛과 동일 구조, 톤만 흰색/연푸른빛
        const cols = grid.cols;
        lastTwinkleMatchedCells = [];
        twinkleClusters.forEach(c => {
          c.cells.forEach(({ row, col }) => {
            const idx = row * cols + col;
            grid.cells[idx]?.setTwinkleMatched(true);
            lastTwinkleMatchedCells.push({ row, col });
          });
        });
        autoMode = false;
        pendingTwinkleTrigger = true;
        startTwinkleParticles(root);
      } else if (hasHiddenTrigger) {
        // ★ Day 22: HIDDEN HIT(분홍) 매칭 연출 — 골든힛/트윙클과 동일 구조, 톤만 분홍.
        //   분홍 셀 강조는 일반 setMatched 사용 (symbol='rainbow' 분기 = 흰빛 코어 펄스).
        //   Phase 4 에서 분홍 전용 강조 메서드 추가 검토.
        const cols = grid.cols;
        lastHiddenMatchedCells = [];
        rainbowClusters.forEach(c => {
          // ★ Day 24 — 신화보스 셀 색 11지역 전용 클램프 (시각 일관성)
          const grade = clampGradeForStage(gradeOf(c.size), stage.id);   // 셀 색용
          c.cells.forEach(({ row, col }) => {
            const idx = row * cols + col;
            grid.cells[idx]?.setMatched(true, grade, 'rainbow');
            lastHiddenMatchedCells.push({ row, col, grade, symbol: 'rainbow' });
          });
        });
        // Day 13 — 세션 복원용: 분홍 매칭 셀 정보도 lastMatchedCells 에 포함 (Phase 0/Phase 2 일관 유지)
        lastMatchedCells = [...lastHiddenMatchedCells];
        autoMode = false;
        pendingHiddenTrigger = true;
        startHiddenParticles(root);
        // ★ Day 22: bite-alert "HIDDEN HIT" 표시 (Q1 a — grade/prefix hide)
        activeBiteInfo = { count: 1, grades: [], hasBoss: false, isHiddenHit: true };
        showBiteAlert(biteAlertEl, activeBiteInfo);
      }

      // ★ Day 26 — 까비까비 시각효과 적용 + 보상 처리 (대표 Q-바 / Q-자 B).
      //   - 셀 클래스 부착 (matched-kabikabi + data-kabikabi-color="1~5" 순환)
      //   - 텍스트 오버레이 — 클러스터 근처에 "까비까비 +Xkg" 띄움
      //
      // ★ Day 30 — 까비까비 식 변경: cellCount × max(1, bonus) → cellCount × (1 + bonus/100)
      //   (8% → ×1.08배 = 8% 보너스로 의미 변경)
      //
      // ★ Day 31 (대표 결정) — 검은 HIT 동시 발생 분기:
      //   - hasBlackHit (clusters.length > 0) + 까비: 즉시 보상 차단 → pendingKabikabiTotalWeight 저장
      //     · 큰 황금색 수치 X / 무게바 X / 경험치 X
      //     · 텍스트 오버레이는 그대로 유지 (시각 효과)
      //     · handleMatchFound 에서 resultQueue 각 항목에 분배 + 잡기 결과 팝업 산식에 합산
      //   - 골든/히든/트윙클 + 까비: 까비 먼저 즉시 보상 (현재 동작 유지) → 해당 힛 진행
      //   - 까비 단독: 즉시 보상 (현재 동작 유지)
      if (hasKabikabiMatch) {
        const colsK = grid.cols;
        const kabikabiBonusPct = activeOpts.kabikabi_bonus || 0;
        const effectiveMult = 1 + (kabikabiBonusPct / 100);  // ★ Day 30 — % 보너스로 의미 변경

        lastKabikabiClusters = [];
        let kabikabiTotalWeight = 0;

        kabikabiClusters.forEach((cluster, idx) => {
          const colorIdx = (idx % 5) + 1;  // 1~5 순환 (네온색 인덱스)
          cluster.cells.forEach(({ row, col }) => {
            const cellIdx = row * colsK + col;
            grid.cells[cellIdx]?.setKabikabiMatched(true, colorIdx);
          });
          // 클러스터별 무게 = 셀수 × (1 + bonus/100) (소수점 2자리 반올림)
          const clusterWeight = Math.round(cluster.size * effectiveMult * 100) / 100;
          kabikabiTotalWeight += clusterWeight;
          // Phase 4.2 텍스트 오버레이용 보관
          const clusterInfo = {
            cells:    cluster.cells.map(({ row, col, symbol }) => ({ row, col, symbol })),
            size:     cluster.size,
            colorIdx,
            weight:   clusterWeight,
          };
          lastKabikabiClusters.push(clusterInfo);
          // 클러스터 근처 "까비까비 +Xkg" 텍스트 오버레이 (시각 효과 — 모든 케이스에서 유지)
          showKabikabiClusterText(grid.root, clusterInfo, grid.cells, grid.rows, grid.cols);
        });
        // 합산 무게 한 번 더 반올림 (개별 반올림 합산 미세 오차 정리)
        kabikabiTotalWeight = Math.round(kabikabiTotalWeight * 100) / 100;

        // ★ Day 31 — 검은 HIT 동시 발생 여부에 따른 분기
        const hasBlackHit = clusters.length > 0;

        if (hasBlackHit && kabikabiTotalWeight > 0) {
          // 검은 HIT + 까비: 즉시 보상 차단 → 잡기 결과에 합산 (handleMatchFound 에서 처리)
          pendingKabikabiTotalWeight = kabikabiTotalWeight;
        } else if (kabikabiTotalWeight > 0) {
          // 골든/히든/트윙클 + 까비 또는 까비 단독: 즉시 보상 (현재 동작 유지)
          //   - 경험치 적용 + 무게바 버스트 + 큰 황금색 수치 (Day 26 동작)
          const kabikabiExpResult = addExp(kabikabiTotalWeight);
          if (kabikabiExpResult.leveledUp) {
            if (pendingLevelUp) {
              pendingLevelUp.newLevel = kabikabiExpResult.newLevel;
            } else {
              pendingLevelUp = {
                prevLevel: kabikabiExpResult.prevLevel,
                newLevel:  kabikabiExpResult.newLevel,
              };
            }
            // ★ Day 38 후속 — 까비까비 흐름의 렙업도 동일하게 즉시 stats-bar / hud 갱신 보장.
            //   onAccumulate 흐름과 동일 패턴 (첫 렙업 누락 방지).
            statsBar.refresh();
            hud.refreshImagination();
          }
          hud.setLevelProgress();
          hud.showGainBurst(kabikabiTotalWeight);
          showCenterGainBurst(grid.root, kabikabiTotalWeight);
        }
      }

      // Phase C: 황금 클러스터 매칭도 콤보 +1 (검은/분홍과 일관성)
      // Day 15: 트리거 cast 콤보 +1 적용 룰 유지 (Q1 답: a) — 보존되어 종료 후 이어짐
      // Day 20: 트윙클도 콤보 +1 — 진입 직전 콤보 보존 (Phase 4 에서 트윙클타임 종료 시 복원)
      // ★ Day 22: HIDDEN HIT(분홍)도 콤보 +1 — 콤보 흐름 일관성 유지
      // ★ Day 26: 까비까비도 콤보 +1 — 한 캐스트당 매칭 1개라도 있으면 +1 (대표 Q-D)
      // ★ Day 26 후속 (대표 결정): autoMode 제어 분리:
      //   - HIT/골든/트윙클/히든 발동 → autoMode = false (사용자 결과 확인 후 수동 cast)
      //   - 까비까비 단독 발동 → autoMode 유지 (꽝과 같은 자동 다음 캐스트, 단 1.5초 대기)
      const hasNonKabikabiMatch = clusters.length > 0 || hasGoldenTrigger || hasTwinkleTrigger || hasHiddenTrigger;
      const hasMatch = hasNonKabikabiMatch || hasKabikabiMatch;
      if (hasMatch) {
        comboCount += 1;
        showComboText(comboTextEl, comboCount);
        if (hasNonKabikabiMatch) {
          // HIT/골든/트윙클/히든 발동 시에만 자동 모드 끔 (결과 확인 필요)
          autoMode = false;
        }
        // 까비까비 단독 = autoMode 유지 → finishTurn 에서 자동 재실행 트리거
      }

      if (pendingGoldenTrigger) {
        // Day 15: 황금 3+ 매칭 시 검은/분홍 잡기게임 무시 (Q2 답)
        //   → 그 cast의 다른 매칭 결과 모두 버리고 골든힛 팝업 직행
        //   → 시작 버튼 → enterGoldenHitTime → cast 다시 활성화 (1회차 시작)
        // Day 18 후속 (대표 결정) — 선 연결 연출 끝난 후 팝업 (즉시 X)
        //   drawGoldenLine 은 2.5초 후 resolve → 그 뒤에 showMinigameIntro
        pendingGoldenTrigger = false;
        drawGoldenLine(grid.root, lastGoldenMatchedCells).then(() => {
          showMinigameIntro(minigameIntro);
        });
      } else if (pendingTwinkleTrigger) {
        // Day 20: 트윙클 3+ 매칭 시 검은/분홍 잡기게임 무시 (golden 과 동일 정책)
        //   → 흰 크리스탈 선 그려짐 (2.5초) → TWINKLE TIME 진입 팝업
        //   → 시작 버튼 → enterTwinkleHitTime → 카드 미니게임 → 횟수 결정 → (Phase 4) 자동 캐스트
        pendingTwinkleTrigger = false;
        drawTwinkleLine(grid.root, lastTwinkleMatchedCells).then(() => {
          showTwinkleIntro(twinkleIntro);
        });
      } else if (pendingHiddenTrigger) {
        // ★ Day 22: HIDDEN HIT(분홍) 매칭 시 검은 잡기게임 무시 (Q3 a — 분홍 우선)
        //   Phase 2: 분홍 선 연출 → finishTurn
        //   Phase 3: 분홍 선 연출(2.5초) → bite-alert hide → HIDDEN BOSS 진입 팝업
        //   Phase 4 에서 hiddenIntro onConfirm → 잡기 게임 HIDDEN 모드 진입으로 교체 예정
        pendingHiddenTrigger = false;
        drawHiddenLine(grid.root, lastHiddenMatchedCells).then(() => {
          hideBiteAlert(biteAlertEl);
          activeBiteInfo = null;
          showHiddenIntro(hiddenIntro);
        });
      } else if (clusters.length > 0) {
        // 검은 클러스터 매칭 → 잡기게임 (분홍은 hasHiddenTrigger 분기에서 처리됨)
        // Day 10: setWeightBonusPct 추가 전달 (세트 효과 무게 보너스)
        // ★ Day 26: HIT 동시 발동 시 까비까비 시각효과는 이미 위에서 적용됨 (Q-자 B — 거의 동시 진입)
        handleMatchFound(clusters, activeOpts, comboCount, setWeightBonusPct);
      } else if (hasKabikabiMatch) {
        // ★ Day 26 — 까비까비만 단독 발동 (대표 결정):
        //   - 결과 확인 시간 1.5초 후 finishTurn (꽝과 같은 자동 진행 방식 + 결과 보여줄 시간 추가)
        //   - 위 콤보 처리에서 autoMode 유지됨 (hasNonKabikabiMatch=false 분기) → finishTurn 안 자동 재실행 트리거
        //   - 콤보는 위에서 +1 이미 처리됨 (꽝 분기 아님 → 콤보 리셋 X)
        //   - 보상도 위에서 즉시 처리됨 (게이지 + 버스트)
        //
        // ★ Day 26 후속 버그픽스 (대표 보고): 까비까비 보상 만으로 레벨업 시 팝업 미트리거 문제.
        //   원인: pendingLevelUp 저장만 하고 triggerLevelUpFlow 호출 안 됨.
        //         (HIT 매칭 시는 fish-result onConfirm 에서 트리거 되지만 까비까비 단독 흐름은 fish-result 없음)
        //   수정: 1.5초 후 pendingLevelUp 있으면 triggerLevelUpFlow 호출.
        //         triggerLevelUpFlow → 팝업 닫힘 → showNextFishResult → 큐 비어있음 → finishTurn 자동 호출.
        //         따라서 자동 cast 흐름은 동일하게 유지됨.
        setTimeout(() => {
          const lvUp = pendingLevelUp;
          pendingLevelUp = null;
          if (lvUp) {
            triggerLevelUpFlow(lvUp);
          } else {
            finishTurn();
          }
        }, 1500);
      } else {
        // Day 7: 꽝 → 콤보 즉시 리셋 + 텍스트 hide
        comboCount = 0;
        hideComboText(comboTextEl);
        // finishTurn에서 autoMode 보고 자동 재실행
        finishTurn();
      }
    }

    async function handleCast() {
      const s = cast.getState();
      if (s === 'wait') return;  // 회전 중 클릭 무시
      if (s === 'cast') {
        if (isProcessing) return;
        // Day 3: 던지다 1번 누르면 자동 모드 ON (꽝일 때만 자동 반복)
        autoMode = true;
        runSpin();
      } else {
        handlePull();
      }
    }

    function handleMatchFound(clusters, activeOpts, comboCount, setWeightBonusPct = 0) {
      const cols = grid.cols;

      // Day 3: 매칭 셀 색 = 등급 기반 (이전 클러스터 인덱스 1~6 → 등급 5단계)
      // 분홍(rainbow)이면 흰빛 코어 펄스로 별도 처리 (slot-cell.setMatched가 분기)
      // Day 13 추가 — 매칭 셀 정보 저장 (다른 화면 다녀와도 효과 복원용)
      // ★ Day 22 — gradeOf 시그니처 변경: forceBoss 인자 폐기 (분홍 트리거 폐기)
      // ★ Day 24 — 신화보스 11지역 전용 클램프: 다른 지역 25+ 매칭 시 전설보스 셀 색
      lastMatchedCells = [];
      clusters.forEach((cluster) => {
        const grade = clampGradeForStage(gradeOf(cluster.size), stage.id);
        cluster.cells.forEach(({ row, col }) => {
          const idx = row * cols + col;
          grid.cells[idx]?.setMatched(true, grade, cluster.symbol);
          lastMatchedCells.push({ row, col, grade, symbol: cluster.symbol });
        });
      });

      // Day 7: 콤보 보너스 = 콤보 단계×10% + 장비 combo_bonus 옵션 (기본 무게 기준 합산)
      // applyWeight 안에서 calcComboBonus 호출되지만, 표시용 comboBonus 분도 별도 저장.
      // Day 10: 세트 무게 보너스 (setWeightBonusPct) 도 weight_bonus 와 같은 단위로 합산.
      //
      // ★ Day 31 (대표 결정) — 검은 HIT + 까비까비 동시 발생 시 새 산식:
      //   적용베이스 = rolledWeight + kabikabiBonus
      //   물고기무게보너스 = 적용베이스 × (weight_bonus% + setWeightBonusPct%) / 100
      //   콤보보너스      = 적용베이스 × (콤보단계 × 10% + combo_bonus%) / 100
      //   finalWeight    = 적용베이스 + 물고기무게보너스 + 콤보보너스
      //                  = applyWeight(적용베이스, activeOpts, comboCount, setWeightBonusPct)
      //   ★ kabikabi 무게는 검은 클러스터 N개에 균등 분배 (각 결과 팝업이 산식 표시 일관성).
      const kabikabiPerCluster = clusters.length > 0
        ? Math.round((pendingKabikabiTotalWeight / clusters.length) * 100) / 100
        : 0;

      resultQueue = clusters.map((cluster, clusterIdx) => {
        // ★ Day 29 — clampGradeForStage 는 통과 함수로 동작 (강등 폐기, 모든 지역 신화 허용)
        const grade = clampGradeForStage(gradeOf(cluster.size), stage.id);
        // ★ Day 29 — 검은 10+ 매칭 = 신화보스. 일반 신화 트리거와 동일하게 mythic_02~04 무작위 (대표 결정).
        //   황금빛꿈고래(mythic_01)는 트윙클 타임 중 트윙클 15+ 전용 (별도 분기 — pickGoldenDreamWhale)
        const fish = (grade === '신화보스')
          ? pickMythicFish()
          : pickFishByGrade(stage.id, grade);
        // Equipment-4d + Day 7 콤보 + Day 10 세트: 장비 weight_bonus + 세트 weightPct + 콤보 보너스 합쳐 적용
        const { weight: rolledWeight, tier } = rollWeight(fish.baseWeight, grade, stage.weightMultiplier);
        // ★ Day 31 — 적용베이스 = rolledWeight + kabikabiBonus (까비 동시 발생 시)
        const kabikabiBonus = kabikabiPerCluster;
        const adjustedBase  = rolledWeight + kabikabiBonus;
        const weight        = applyWeight(adjustedBase, activeOpts, comboCount, setWeightBonusPct);
        // 콤보 보너스 분 = 무게바 떠오름 옆 표시용 (HUD에서 색상/크기 처리)
        const comboBonus    = calcComboBonus(adjustedBase, activeOpts, comboCount);
        // Day 7-2 + Day 10: 결과 팝업 무게 분해 표시용 — 장비 weight_bonus 분 + 세트 무게 % 합산
        // (대표 결정: STATS 와 결과팝업 모두 합산 표시 — 사용자 입장에선 둘 다 "장비/세트로 인한 보너스")
        const totalWeightPct = (activeOpts.weight_bonus || 0) + setWeightBonusPct;
        const equipmentBonus = adjustedBase * (totalWeightPct / 100);
        return {
          fish, weight, tier, grade,
          baseWeight: rolledWeight,      // 결과팝업 작은 줄 = 기본 무게 표시 (까비 미포함)
          kabikabiBonus,                 // ★ Day 31 신규 — 까비까비 분배 무게 (kg)
          equipmentBonus,                // 결과팝업 작은 줄 = 장비+세트 보너스 분 (적용베이스 기준 — 까비 포함)
          comboBonus,                    // 콤보 보너스 분 (적용베이스 기준 — 까비 포함)
          comboLevel: comboCount,        // 결과 시점 콤보 단계 (HUD 색상용, 1~10+)
          size: cluster.size,
          symbol: cluster.symbol,
          clusterIdx: clusterIdx + 1,
        };
      });

      // ★ Day 31 — pending 까비 무게 리셋 (이번 매칭 처리 종료)
      pendingKabikabiTotalWeight = 0;

      // Day 3: bite-alert에 등급 + 보스 정보 전달
      // ★ Day 22 — 분홍 보스 트리거 폐기 (HIDDEN HIT 미니게임 도입):
      //   기존: hasBoss = clusters.some(c => c.symbol === 'rainbow')
      //   변경: hasBoss = false 고정. 분홍 매칭 시 BOSS 텍스트 표시 X.
      //   (Phase 2 에서 분홍 매칭 시 HIDDEN HIT 라벨/팝업으로 별도 분기 추가 예정)
      // ★ Day 29 (대표 결정) — 힛 팝업에는 base 등급만 표시. 변종 + 는 결과팝업에서만 노출.
      //   배경: 힛 팝업에서 변종 결과가 미리 보이면 결과팝업의 Lucky Lucky 연쇄 연출이 김 빠짐.
      //   이전 (Day 27): fishDisplayGrade(r.fish.id) — '치어+++' 표시
      //   신규 (Day 29): r.grade 직접 사용 — '치어' 만 표시
      const grades = resultQueue.map(r => r.grade);
      const hasBoss = false;
      // ★ Day 27 — 신화 매칭 (검은 25+ 황금빛꿈고래) 포함 여부 → bite-alert 톤 분기
      const isMythicHit = resultQueue.some(r => r.grade === '신화보스');
      // 보스 정보를 잡기 게임에서도 쓰기 위해 저장 (Phase 2 까지 false 고정)
      pendingHasBoss = hasBoss;
      // Day 13 — 세션 복원용 ★: 히트 팝업 정보 저장 (다른 화면 다녀와도 복원 가능)
      activeBiteInfo = { count: clusters.length, grades, hasBoss, isMythicHit };
      showBiteAlert(biteAlertEl, activeBiteInfo);

      cast.setState('pull');
      // Day 4-3: isProcessing = false 제거 (결과 처리 흐름 끝까지 잠금 유지)
      // → 결과 팝업 사이 텀에 사용자가 슬롯 영역 클릭해도 새 spin 시작 안 함
      // → 사용자 당기다(cast 'pull')는 handleCast의 'pull' 분기에서 isProcessing 체크 없이 처리
      // → 큐 다 비우고 finishTurn 도달 시점에 isProcessing = false로 자연스럽게 해제됨
    }

    /* ============================================
       ★ Day 29 — Lucky Lucky 등급 럭키 시스템 (대표 결정)
       ============================================
       매 pull 1회 럭키 체크. 발동 시 잡기 대상 결과 등급 한 단계 ↑.
       사용자가 풀 버튼 다시 누르면 또 럭키 체크 → 안 뜰 때까지 연쇄.
       10매칭(신화보스) = 럭키 비활성 (이미 최상위).
       확률 = LUCKY_BASE_RATE + activeOpts.lucky_rate (장비 옵션).
       ============================================ */
    const LUCKY_BASE_RATE = 0.15;   // ★ 테스트용 (대표 지시) — 정식: 0.05 (5%)
    const GRADE_ORDER = ['치어', '소형', '중형', '월척', '대물', '보스', '전설보스', '신화보스'];
    let luckyChainCount = 0;        // 현재 pull 사이클의 연쇄 카운트 (X2, X3 표시용)

    /** 다음 등급 (한 단계 위). 신화보스 = null. */
    function nextGradeOf(grade) {
      const idx = GRADE_ORDER.indexOf(grade);
      if (idx < 0 || idx >= GRADE_ORDER.length - 1) return null;
      return GRADE_ORDER[idx + 1];
    }

    /** resultQueue 에서 가장 높은 등급의 인덱스 (멀티히트 자동선택 기준). */
    function findHighestResultIdx(results) {
      let highIdx = 0;
      let highRank = -1;
      results.forEach((r, idx) => {
        const rank = GRADE_RANK[r.grade] ?? -1;
        if (rank > highRank) { highRank = rank; highIdx = idx; }
      });
      return highIdx;
    }

    /**
     * 결과 객체 한 단계 등급 업그레이드 (어종/무게 재계산).
     * 럭키 발동 시 호출.
     *
     * @param {object} result        resultQueue 의 한 원소 (mutate)
     * @param {string} newGrade      업그레이드 후 등급
     * @param {object} activeOpts    장비 옵션
     * @param {number} setWeightBonusPct  세트 무게 보너스
     */
    function upgradeResultGrade(result, newGrade, activeOpts, setWeightBonusPct) {
      // 어종 재추첨 — 신화면 mythic_02~04 무작위, 일반이면 지역 변종 분포 기반
      const newFish = (newGrade === '신화보스')
        ? pickMythicFish()
        : pickFishByGrade(stage.id, newGrade);

      // 무게 재계산 (Phase 3-C D-i 공식 + 지역 배율 — 현재 모두 1.0)
      const { weight: rolledWeight, tier } = rollWeight(newFish.baseWeight, newGrade, stage.weightMultiplier);
      const weight = applyWeight(rolledWeight, activeOpts, comboCount, setWeightBonusPct);
      const comboBonus = calcComboBonus(rolledWeight, activeOpts, comboCount);
      const totalWeightPct = (activeOpts.weight_bonus || 0) + (setWeightBonusPct || 0);
      const equipmentBonus = rolledWeight * (totalWeightPct / 100);

      // mutate (resultQueue 안의 객체)
      result.grade = newGrade;
      result.fish = newFish;
      result.weight = weight;
      result.tier = tier;
      result.baseWeight = rolledWeight;
      result.equipmentBonus = equipmentBonus;
      result.comboBonus = comboBonus;
      // size/symbol/clusterIdx 는 원래 매칭 정보라 그대로 유지 (시각 흔적)
      // 신화 도달 시 신화 플래그 표시 (멀티힛 X — 단일 잡기)
      if (newGrade === '신화보스') {
        result.isMythicHit = true;
      }
    }

    /**
     * 럭키 체크 + 발동 시 등급 업그레이드.
     *
     * @returns {boolean}  true = 발동됨 (등급 ↑), false = 미발동
     */
    function tryLuckyLuckyUpgrade(activeOpts, setWeightBonusPct) {
      if (resultQueue.length === 0) return false;

      // 멀티히트 자동선택 기준 — 가장 큰 등급 1개 대상
      const highIdx = findHighestResultIdx(resultQueue);
      const target = resultQueue[highIdx];

      // 신화보스 도달 — 럭키 비활성 (대표 결정)
      if (target.grade === '신화보스') return false;

      // 럭키 확률 (기본 + 장비)
      const luckyRate = LUCKY_BASE_RATE + ((activeOpts.lucky_rate || 0) / 100);
      if (Math.random() >= luckyRate) return false;

      const next = nextGradeOf(target.grade);
      if (!next) return false;

      upgradeResultGrade(target, next, activeOpts, setWeightBonusPct);
      return true;
    }

    function handlePull() {
      if (resultQueue.length === 0) return;

      // ★ Day 36 (대표 결정) — 신화 트리거 흐름: SPECIAL MYTHIC HIT 인트로 → 사용자 pull → 황금빛꿈고래 인트로.
      //   awaitingMythicPull = true 면 일반 매칭 처리(럭키 체크 등) 건너뛰고 mythic-intro 표시 후 return.
      //   처리 흐름: special intro hide → mythic-intro show → 인트로 터치 시 잡기게임 진입 (mythic-intro onConfirm).
      if (awaitingMythicPull) {
        awaitingMythicPull = false;
        hideSpecialMythicHitIntro(specialMythicHitIntro);
        cast.setState('wait');  // 인트로 표시 동안 cast 비활성 (인트로 onConfirm 에서 잡기게임 진입)
        showMythicIntro(mythicIntro);
        return;
      }

      // ★ Day 29 v2 (대표 결정) — 다음 pull 누른 순간 이전 Lucky Lucky 텍스트 즉시 사라짐.
      //   (Lucky 발동 시 안 사라지고 유지 → 사용자가 또 풀 누르면 사라짐 → 또 발동 시 새로 등장)
      hideLuckyLuckyEffect(biteAlertEl);

      // ★ Day 29 — Lucky Lucky 등급 럭키 체크 (매 pull 1회)
      const inv = loadInventory();
      const codexBonuses = getCodexBonuses();
      const activeOpts = getActiveOptions(inv, codexBonuses);
      const setGrade = getSetGrade(inv);
      const setWeightBonusPct = getSetWeightBonus(setGrade);

      if (tryLuckyLuckyUpgrade(activeOpts, setWeightBonusPct)) {
        // 럭키 발동 — bite-alert 등급 텍스트 갱신 + Lucky Lucky 텍스트 연출
        luckyChainCount += 1;
        if (activeBiteInfo) {
          activeBiteInfo.grades = resultQueue.map(r => r.grade);
          // 신화 도달 시 isMythicHit 플래그 (bite-alert 톤 변경)
          if (resultQueue.some(r => r.grade === '신화보스')) {
            activeBiteInfo.isMythicHit = true;
          }
          showBiteAlert(biteAlertEl, activeBiteInfo);
          // ★ Day 29 v2 (대표 결정) — 등급 텍스트가 바뀔 때 순간 크게 → 작아지는 pop 연출
          //   showBiteAlert 가 등급 텍스트 갱신 직후 .grade-pop 클래스 추가 → animation 자동.
          //   재발동 시 reflow 트릭으로 animation 재시작.
          const gradeEl = biteAlertEl.querySelector('.bite-alert__grade');
          if (gradeEl) {
            gradeEl.classList.remove('grade-pop');
            void gradeEl.offsetWidth;
            gradeEl.classList.add('grade-pop');
          }
        }
        showLuckyLuckyEffect(biteAlertEl, luckyChainCount);
        // cast 는 그대로 'pull' 상태 — 사용자가 또 누르면 또 럭키 체크
        return;
      }

      // 미발동 → 잡기게임 진입 (기존 흐름)
      luckyChainCount = 0;   // 다음 사이클 위해 리셋
      hideBiteAlert(biteAlertEl);
      activeBiteInfo = null;
      processNextResult();
    }

    const cast = createCastButton({
      state: 'cast',
      onClick: () => handleCast(),
    });
    disposers.push(() => cast.dispose());

    actionRow.appendChild(cast.root);

    content.appendChild(actionRow);
    // ★ Day 38 후속 (대표 결정) — turn 카운터를 cast 아래로 배치 (위 createTurnCounter 호출 위치 참고).
    content.appendChild(turn.root);
    root.appendChild(content);

    root.appendChild(menuPanel.root);
    root.appendChild(fishResult);
    root.appendChild(minigameIntro);
    root.appendChild(twinkleIntro);   // Day 20
    root.appendChild(twinkleRewardPopup.root);   // Day 20
    root.appendChild(hiddenIntro);    // ★ Day 22 — HIDDEN BOSS 진입 팝업
    root.appendChild(mythicIntro);    // ★ Day 35 — 신화 트리거 (황금빛꿈고래) 진입 팝업
    root.appendChild(specialMythicHitIntro);  // ★ Day 36 — SPECIAL MYTHIC HIT 인트로 (floating)
    root.appendChild(hiddenCardFlip); // ★ Day 22 Phase 6 — HIDDEN HIT 카드뒤집기
    root.appendChild(overlayLayer);

    el.appendChild(root);

    // Bag-4: 첫 진입 시 인벤토리에서 장착 상태 읽어 gear-slot 4개에 반영
    syncGearSlots();

    // Day 16: 슬롯 진입 시 도감 빨간점 초기 표시
    //   (이전 세션에서 등록된 NEW 물고기 또는 가방 매칭 등록 가능 장비가 있으면 점 표시)
    refreshCodexDots();

    // ──────────────────────────────────────────
    // Day 13 ★ — 슬롯 활성 세션 복원 (대표 결정).
    // 강화/합성/도감/가방 등 다른 화면 다녀와도 콤보+히트팝업+당기기 그대로.
    // 같은 stageId 일 때만 복원 (다른 stage 진입 시 무시 — 스테이지별 독립 보존 정책).
    // Day 13 추가 — 그리드 심볼 (gridData) 도 복원 (대표 결정 — 이전 결과 그대로 보이게).
    // ──────────────────────────────────────────
    const savedSession = loadSlotSession();
    if (savedSession && savedSession.stageId === stageId) {
      // 0) 그리드 심볼 복원 (가장 먼저 — emptyGrid 위에 덮어쓰기)
      //    활성 흐름 (콤보/큐/pull) 없어도 그리드만 보존된 케이스 모두 처리.
      if (Array.isArray(savedSession.gridData) && savedSession.gridData.length > 0) {
        fillGrid(grid.cells, savedSession.gridData);
        lastGridData = savedSession.gridData;  // 다음 unmount 시 다시 저장 가능하게
      }
      // 0-2) Day 13 추가 ★ — 매칭 셀 효과 복원 (대표 결정 — 슬롯 당첨효과 보존).
      //   handleMatchFound / 황금 매칭 시점에 저장된 셀 좌표 + 등급 + 심볼로 setMatched 재호출.
      const cols = grid.cols;
      if (Array.isArray(savedSession.matchedCells) && savedSession.matchedCells.length > 0) {
        savedSession.matchedCells.forEach(({ row, col, grade, symbol }) => {
          const idx = row * cols + col;
          grid.cells[idx]?.setMatched(true, grade, symbol);
        });
        lastMatchedCells = savedSession.matchedCells;  // 다음 unmount 시 재저장
      }
      if (Array.isArray(savedSession.goldenMatchedCells) && savedSession.goldenMatchedCells.length > 0) {
        savedSession.goldenMatchedCells.forEach(({ row, col }) => {
          const idx = row * cols + col;
          grid.cells[idx]?.setGoldenMatched(true);
        });
        lastGoldenMatchedCells = savedSession.goldenMatchedCells;
      }
      // 1) 콤보 복원 (>0 일 때만 텍스트 표시)
      if (typeof savedSession.comboCount === 'number' && savedSession.comboCount > 0) {
        comboCount = savedSession.comboCount;
        showComboText(comboTextEl, comboCount);
      }
      // 2) 결과 큐 복원 (잡기 대기 중인 결과들)
      if (Array.isArray(savedSession.resultQueue)) {
        resultQueue = savedSession.resultQueue;
      }
      // 3) 보스/황금 트리거 플래그 복원
      pendingHasBoss       = !!savedSession.pendingHasBoss;
      pendingGoldenTrigger = !!savedSession.pendingGoldenTrigger;
      // 4) 자동 모드 복원 (세션에 들어있으면 — 보통은 false 가 자연스러움)
      autoMode = !!savedSession.autoMode;
      // 5) cast 버튼 상태 복원 ('pull' 이면 당기기 활성, 'wait' 면 회전 중이었던 케이스 = 'cast' 로 안전 복귀)
      const cs = savedSession.castState;
      if (cs === 'pull') {
        cast.setState('pull');
        // pull 상태 = 결과 처리 흐름 중 → isProcessing 도 true 로 (새 spin 차단)
        isProcessing = true;
      }
      // (cs === 'wait' 면 회전 중에 떠난 셈인데 회전 자체를 재개할 수는 없으므로
      //   안전하게 'cast' 로 복귀 — resultQueue 가 비어있을 가능성이 큼)
      // 6) 히트 팝업 복원 (resultQueue 있고 cast='pull' 일 때만 의미)
      //    Day 13 추가 ★ — activeBiteInfo 모듈 변수도 갱신해야 다음 unmount 시
      //    disposer 가 'biteAlertActive: activeBiteInfo !== null' 을 정확히 true 로 평가.
      //    (대표 보고 — "두 번째 다른 화면 다녀오면 히트팝업 사라짐" 버그 원인 수정)
      if (savedSession.biteAlertActive && savedSession.biteAlertInfo) {
        activeBiteInfo = savedSession.biteAlertInfo;
        showBiteAlert(biteAlertEl, activeBiteInfo);
      }
    }

    // ──────────────────────────────────────────
    // Day 15 Phase 2D — 골든힛 타임 활성 세션 복원
    // 같은 stageId 면 isActive 그대로 / 다른 stageId 면 reset (slotSession 정책과 동일).
    // 복원 시 모듈 변수 + 비주얼 (마퀴 + 카운트 표시) 모두 갱신.
    // ──────────────────────────────────────────
    const savedGoldenHit = loadGoldenHitSession();
    if (savedGoldenHit && savedGoldenHit.stageId === stageId && savedGoldenHit.isActive) {
      goldenHitState = {
        isActive: true,
        remaining: savedGoldenHit.remaining || 0,
        savedComboCount: savedGoldenHit.savedComboCount || 0,
      };
      // 비주얼 복원
      grid.root.dataset.goldenHit = 'true';
      // Day 19 — 마퀴 폐기, sparkle-field 부착 (enterGoldenHitTime 과 동일 패턴)
      if (!goldenSparkleField) {
        // Day 19 fix3 — radius 2.0 (enterGoldenHitTime 과 동일 옵션)
        goldenSparkleField = createSparkleField({ radius: 2.0 });
        grid.root.appendChild(goldenSparkleField);
      }
      // 콤보 텍스트 자리 — 일반 콤보 복원 위에 골든힛 카운트 덮어씌움 (골든힛이 우선)
      showGoldenHitCount(comboTextEl, goldenHitState.remaining);
      // 콤보 카운트는 골든힛 동안 0이어야 일관 — slotSession 복원으로 set 됐어도 0으로 강제
      comboCount = 0;
    } else if (savedGoldenHit && savedGoldenHit.stageId !== stageId) {
      // 다른 stage 진입 → 폐기
      resetGoldenHitSession();
    }

    // ──────────────────────────────────────────
    // Day 20 Phase 5 — 트윙클 타임 활성 세션 복원 (백그라운드 진행).
    // 골든힛이 active 면 트윙클 복원 안 함 (두 시스템 동시 active 방지 — 안전망).
    // 시뮬레이션용 가중치 풀: 현 시점 활성 옵션 적용된 SYMBOL_LIST.
    // 다른 stageId 또는 골든힛 active 시 트윙클 세션 폐기 (보상 없음 — 대표 명시 정책).
    // ──────────────────────────────────────────
    if (!goldenHitState.isActive) {
      // 활성 옵션 + 가중치 풀 (mount 시점 inv 기준)
      // ★ Day 21 — getAdjustedSymbolList 에 stage.gridSize 전달 (그리드 보정 A1 일관 적용).
      const _invForTwinkle  = loadInventory();
      const _codexForTwinkle = getCodexBonuses();
      const _actsForTwinkle = getActiveOptions(_invForTwinkle, _codexForTwinkle);
      const _symbolListForTwinkle = getAdjustedSymbolList(_actsForTwinkle, undefined, stage.gridSize);
      tryRestoreTwinkleSession(_symbolListForTwinkle);
    } else {
      // 골든힛 active — 트윙클 세션 있으면 폐기
      clearTwinkleSession();
    }

    // Bag-3: 강화/합성/도감 stub 에서 뒤로가기로 돌아온 경우 가방 자동 재오픈
    if (params.openBag) {
      // mount 직후 라우터의 fadeIn(1초)이 시작됨 → 가방도 같이 페이드인되어 자연스러움
      setTimeout(() => ensureBagModal().open(), 0);
    }

    // ──────────────────────────────────────────
    // Day 13 ★ — 슬롯 활성 세션 저장 disposer 등록.
    // unmount 시점에 disposers 가 호출되면서 이 클로저가 모듈 변수들 (comboCount,
    // resultQueue, pendingHasBoss 등) 의 마지막 값을 캡처해 saveSlotSession 호출.
    // disposers 는 unmount() 안에서 forEach 로 호출되므로 mount 의 클로저 변수 접근 가능.
    //
    // 저장 조건 (다음 중 하나라도):
    //   - 콤보 보유 (comboCount > 0)              → 콤보 유지 목적
    //   - 결과 큐 보유 (resultQueue.length > 0)   → 잡기 대기 (당기기 누르기 전)
    //   - cast 가 'pull' 상태                      → 히트 팝업 떠 있음
    //   - Day 13 추가 ★: lastGridData 보유        → 한 번이라도 spin 했음 (그리드 심볼 보존 — 대표 결정)
    // 모두 false 면 idle = 세션 영구 데이터 삭제.
    // ──────────────────────────────────────────
    disposers.push(() => {
      const isActive = (
        (typeof comboCount === 'number' && comboCount > 0) ||
        (Array.isArray(resultQueue) && resultQueue.length > 0) ||
        cast.getState() === 'pull'
      );
      // Day 13 추가 — 그리드 심볼 스냅샷 있으면 활성 흐름이 없어도 저장.
      const hasGridSnapshot = Array.isArray(lastGridData) && lastGridData.length > 0;

      if (isActive || hasGridSnapshot) {
        saveSlotSession({
          stageId,
          comboCount,
          castState:            cast.getState(),
          biteAlertActive:      activeBiteInfo !== null,
          biteAlertInfo:        activeBiteInfo,
          resultQueue,
          pendingHasBoss,
          pendingGoldenTrigger,
          autoMode,
          gridData:             lastGridData,           // Day 13 ★
          matchedCells:         lastMatchedCells,       // Day 13 추가 ★ (매칭 셀 효과)
          goldenMatchedCells:   lastGoldenMatchedCells, // Day 13 추가 ★ (황금 매칭)
        });
      } else {
        resetSlotSession();
      }

      // Day 20 Phase 5: 트윙클 세션 — active 면 백그라운드 진행용으로 저장 (leftAt 기록).
      //   대표 명시: 다른 화면 가도 백그라운드에서 진행 / 앱 종료 시 보상 없이 취소.
      //   storage 안 씀 (앱 리로드 시 자연스럽게 사라짐) — module-level 변수 사용.
      if (twinkleHitState.isActive) {
        saveTwinkleSession({
          stageId,
          started:         twinkleHitState.started,
          remaining:       twinkleHitState.remaining,
          savedComboCount: twinkleHitState.savedComboCount,
          savedGridData:   twinkleHitState.savedGridData,
          lockedCells:     twinkleHitState.lockedCells,
          rewardCount:     twinkleHitState.rewardCount,
          goldenWhaleTriggered: twinkleHitState.goldenWhaleTriggered,   // ★ Day 29
          leftAt:          Date.now(),
        });
      }
    });
  },

  unmount() {
    // ──────────────────────────────────────────
    // Day 13 ★ — 슬롯 활성 세션 저장 (대표 결정).
    // 활성 흐름 진행 중 (콤보 보유 OR 결과 큐 보유 OR pull 대기) 일 때만 저장.
    // idle 상태면 resetSlotSession 으로 깨끗 정리 (다음 진입 시 빈 상태로 시작).
    //
    // 현재 disposers 가 module-scope 라 mount 안 변수 (comboCount, resultQueue, ...) 에
    // 직접 접근 불가 — disposers 에 saveSession 클로저를 미리 push 하는 방식으로 처리.
    // (이 unmount 메소드 자체는 disposers 만 비움)
    // ──────────────────────────────────────────
    disposers.forEach((d) => d());
    disposers = [];
  },
};