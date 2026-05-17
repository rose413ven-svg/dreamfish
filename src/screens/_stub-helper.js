/* ===========================================
   _stub-helper.js — Phase 1 stub 공통 헬퍼
   ============================================
   9개 화면 stub의 빈 박스 + "다음" 버튼 DOM 조립을 담당.
   각 화면 모듈이 얇게 유지되도록.
   Phase 1 검증 후 각 화면이 실제 UI로 교체되면 이 파일도 점진 제거.
   ============================================ */

/**
 * stub 화면 1개를 생성한다.
 *
 * @param {object} opts
 * @param {string} opts.label   상단 작은 라벨 (예: "STEP 1 / 9")
 * @param {string} opts.title   가운데 제목 (예: "회사 로고")
 * @param {string} [opts.boxText='STUB']  박스 안 텍스트
 * @param {string} [opts.hint]  부가 설명 (선택)
 * @param {string} [opts.nextText='다음']
 * @param {() => void | Promise<void>} opts.onNext  "다음" 클릭 핸들러
 *
 * @returns {{ root: HTMLElement, dispose: () => void }}
 *   root: 컨테이너에 append 할 엘리먼트
 *   dispose: 이벤트 리스너 정리. unmount() 시 호출.
 */
export function buildStubScreen(opts) {
  const {
    label,
    title,
    boxText = 'STUB',
    hint,
    nextText = '다음',
    onNext,
  } = opts;

  const root = document.createElement('section');
  root.className = 'stub-screen';

  const labelEl = document.createElement('div');
  labelEl.className = 'stub-screen__label';
  labelEl.textContent = label;

  const titleEl = document.createElement('h1');
  titleEl.className = 'stub-screen__title';
  titleEl.textContent = title;

  const boxEl = document.createElement('div');
  boxEl.className = 'stub-screen__box';
  boxEl.textContent = boxText;

  const nextBtn = document.createElement('button');
  nextBtn.className = 'stub-screen__next';
  nextBtn.type = 'button';
  nextBtn.textContent = nextText;

  root.appendChild(labelEl);
  root.appendChild(titleEl);
  root.appendChild(boxEl);

  if (hint) {
    const hintEl = document.createElement('p');
    hintEl.className = 'stub-screen__hint';
    hintEl.textContent = hint;
    root.appendChild(hintEl);
  }

  root.appendChild(nextBtn);

  // AbortController 로 unmount 시 리스너 일괄 정리
  const ac = new AbortController();
  nextBtn.addEventListener(
    'click',
    () => {
      // 중복 클릭 방지
      nextBtn.disabled = true;
      Promise.resolve(onNext?.())
        .catch((err) => {
          console.error('[stub] onNext 실패:', err);
        })
        .finally(() => {
          // Day 12 — navigate 가 router._isNavigating 가드에 막혔거나 실패한 경우
          // (예: 페이드인 도중 클릭 → 첫 navigate 진행 중 → 가드되어 무시) 에는
          // 화면이 그대로 남아있으므로 disabled 풀어 다시 누를 수 있게 한다.
          // navigate 정상 성공 시에는 화면이 unmount 되어 nextBtn 이 DOM 에서 빠지므로
          // isConnected === false → 분기 안 들어가고 영향 X.
          if (nextBtn.isConnected) nextBtn.disabled = false;
        });
    },
    { signal: ac.signal }
  );

  return {
    root,
    dispose: () => ac.abort(),
  };
}