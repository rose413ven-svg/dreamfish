/* ===========================================
   codex-register-confirm.js — 도감 등록 확인 팝업 (Day 17 후속 신규)
   ============================================
   대표 결정:
   - 등록 버튼 클릭 → 이 모달 표시 → 사용자가 [확인] 누르면 실제 등록 + 장비 소비.
   - 메시지: "장비를 도감에 등록할까요?" (단일 라인)
   - 버튼: [취소] [확인]
   - 취소/오버레이 클릭 시 닫힘 (등록 X).

   스타일: public/styles/screens/codex.css 의 .codex-confirm__* (모듈 SSOT)
   ============================================ */

/** 동시에 1개만 열림 — 중복 호출 시 기존 인스턴스 먼저 닫음 */
let currentRoot = null;
let currentTimer = 0;

/** 닫기 (트랜지션 후 DOM 제거) */
export function closeCodexRegisterConfirm() {
  if (!currentRoot) return;
  currentRoot.classList.remove('codex-confirm--open');
  const target = currentRoot;
  currentRoot = null;
  if (currentTimer) clearTimeout(currentTimer);
  currentTimer = setTimeout(() => {
    if (target.parentNode) target.parentNode.removeChild(target);
  }, 220);
}

/**
 * 등록 확인 팝업 열기.
 *
 * @param {object}   [opts]
 * @param {HTMLElement} [opts.parent]    부모 엘리먼트 (기본 #app or body)
 * @param {() => void}  [opts.onConfirm] [확인] 클릭 시 호출 (취소/오버레이 시엔 호출 X)
 * @param {() => void}  [opts.onCancel]  취소 클릭 시 호출 (선택)
 * @returns {{ close: () => void }}
 */
export function openCodexRegisterConfirm(opts = {}) {
  const parent = opts.parent || document.getElementById('app') || document.body;
  const onConfirm = opts.onConfirm;
  const onCancel  = opts.onCancel;

  // 기존 인스턴스 닫고 시작
  closeCodexRegisterConfirm();

  const root = document.createElement('div');
  root.className = 'codex-confirm';

  const ovl = document.createElement('div');
  ovl.className = 'codex-confirm__overlay';
  ovl.addEventListener('click', () => {
    closeCodexRegisterConfirm();
    onCancel?.();
  });

  const panel = document.createElement('div');
  panel.className = 'codex-confirm__panel';
  panel.addEventListener('click', (e) => e.stopPropagation());

  const msg = document.createElement('div');
  msg.className = 'codex-confirm__message';
  msg.textContent = '장비를 도감에 등록할까요?';

  const actions = document.createElement('div');
  actions.className = 'codex-confirm__actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'codex-confirm__btn codex-confirm__btn--cancel';
  cancelBtn.textContent = '취소';
  cancelBtn.addEventListener('click', () => {
    closeCodexRegisterConfirm();
    onCancel?.();
  });

  const okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.className = 'codex-confirm__btn codex-confirm__btn--ok';
  okBtn.textContent = '확인';
  okBtn.addEventListener('click', () => {
    closeCodexRegisterConfirm();
    onConfirm?.();
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(okBtn);
  panel.appendChild(msg);
  panel.appendChild(actions);
  root.appendChild(ovl);
  root.appendChild(panel);
  parent.appendChild(root);
  currentRoot = root;

  // 트랜지션 발동
  requestAnimationFrame(() => {
    root.classList.add('codex-confirm--open');
  });

  return { close: closeCodexRegisterConfirm };
}