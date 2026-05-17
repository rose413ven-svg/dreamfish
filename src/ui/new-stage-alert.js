/* ===========================================
   new-stage-alert.js — 새 낚시터 입장 알림 (Day 18 신규)
   ============================================
   결정로그 Day 18 SSOT.

   Q6 (대표 결정): 레벨업 팝업과 분리.
   Q9 (대표 결정 A안): 레벨업 팝업 닫힌 직후 트리거.

   책임:
   - 새로 입장 가능해진 낚시터를 알림 팝업으로 표시
   - 다중 해제 케이스 → 큐로 순차 표시 (한 지역씩, 확인 누르면 다음)
   - 모달 (오버레이 + 패널), 확인 버튼만 (오버레이 클릭 닫힘 X)

   사용 패턴 (Phase 5 slot.js 연결 예정):
     const alert = createNewStageAlert();
     content.appendChild(alert.root);
     // 레벨업 팝업 onClose 콜백 안에서:
     newStages.forEach(s => alert.enqueue(s));
   ============================================ */

/**
 * @param {object} [opts]
 * @param {() => void} [opts.onAllClosed] - 큐 다 비워졌을 때 1회 호출
 * @returns {{
 *   root: HTMLElement,
 *   enqueue: (stage: object) => void,
 *   close: () => void,
 *   isOpen: () => boolean,
 *   dispose: () => void,
 * }}
 */
export function createNewStageAlert(opts = {}) {
  const { onAllClosed } = opts;
  let isOpenState = false;
  const queue = [];           // pending stages

  /* ── 루트 + 오버레이 + 패널 ── */
  const root = document.createElement('div');
  root.className = 'newstage-root';
  root.setAttribute('aria-hidden', 'true');

  const overlay = document.createElement('div');
  overlay.className = 'newstage-overlay';

  const panel = document.createElement('div');
  panel.className = 'newstage-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '새 낚시터 입장 가능');
  panel.addEventListener('click', (e) => e.stopPropagation());

  /* ── 헤더 ── */
  const header = document.createElement('div');
  header.className = 'newstage-header';
  header.textContent = '새로운 낚시터';

  /* ── 카드 (배경/이름/소개) ── */
  const card = document.createElement('div');
  card.className = 'newstage-card';

  const cardName = document.createElement('div');
  cardName.className = 'newstage-card__name';

  const cardNameEn = document.createElement('div');
  cardNameEn.className = 'newstage-card__name-en';

  const cardIntro = document.createElement('div');
  cardIntro.className = 'newstage-card__intro';

  card.appendChild(cardName);
  card.appendChild(cardNameEn);
  card.appendChild(cardIntro);

  /* ── 안내 텍스트 ── */
  const note = document.createElement('div');
  note.className = 'newstage-note';
  note.textContent = '메뉴 → 낚시터 맵 에서 입장할 수 있어요';

  /* ── 확인 버튼 ── */
  const okBtn = document.createElement('button');
  okBtn.className = 'newstage-ok';
  okBtn.type = 'button';
  okBtn.textContent = '확인';
  okBtn.addEventListener('click', advance);

  /* ── 조립 ── */
  panel.appendChild(header);
  panel.appendChild(card);
  panel.appendChild(note);
  panel.appendChild(okBtn);

  root.appendChild(overlay);
  root.appendChild(panel);

  /* ============================================
     내부 동작
     ============================================ */

  /** 현재 카드에 stage 정보 그리기. */
  function renderStage(stage) {
    cardName.textContent   = stage.name || '';
    cardNameEn.textContent = stage.nameEn || '';
    // ★ Day 22 Phase 7 후속 (대표 결정): intro 자동 wrap 폐기 — 마침표(.) 기준 split 후 문장별 2줄.
    //   stages.js 의 intro 는 "문장1. 문장2." 형식. 마침표는 분리 후 다시 붙임.
    //   안전 fallback: 마침표 없거나 1문장이면 그대로 표시.
    const intro = stage.intro || '';
    const sentences = intro.split(/\.\s*/).filter(s => s.trim()).map(s => s.trim() + '.');
    cardIntro.innerHTML = sentences.join('<br>');
    // CSS 분기용 메타 (톤별 카드 색 변화 등)
    card.dataset.theme   = stage.theme || '';
    card.dataset.stageId = String(stage.id || '');
  }

  /** 화면에 패널 띄우기 (open 상태 전환). */
  function openPanel() {
    isOpenState = true;
    root.setAttribute('aria-hidden', 'false');
    root.classList.add('newstage-root--open');
  }

  /** 화면 닫기. */
  function closePanel() {
    isOpenState = false;
    root.setAttribute('aria-hidden', 'true');
    root.classList.remove('newstage-root--open');
  }

  /**
   * 확인 버튼 → 큐 다음 항목 표시.
   * 큐 비면 닫고 onAllClosed 호출.
   */
  function advance() {
    if (!isOpenState) return;
    if (queue.length > 0) {
      renderStage(queue.shift());
      // 패널은 그대로 열린 상태 유지 (내용만 교체)
    } else {
      closePanel();
      if (typeof onAllClosed === 'function') {
        try { onAllClosed(); } catch (_) { /* swallow */ }
      }
    }
  }

  /* ============================================
     공개 API
     ============================================ */

  /**
   * 알림 큐에 추가.
   * - 안 열려있으면 즉시 첫 카드 표시 + open
   * - 열려있으면 큐 끝에 append (현재 카드 확인 누르면 순차 표시)
   *
   * @param {object} stage - stages.js Stage 객체
   */
  function enqueue(stage) {
    if (!stage || typeof stage !== 'object') return;
    if (!isOpenState) {
      renderStage(stage);
      openPanel();
    } else {
      queue.push(stage);
    }
  }

  /** 강제 닫기 (큐도 비움). */
  function close() {
    queue.length = 0;
    closePanel();
  }

  function dispose() {
    okBtn.removeEventListener('click', advance);
  }

  return {
    root,
    enqueue,
    close,
    isOpen: () => isOpenState,
    dispose,
  };
}