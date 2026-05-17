/* ===========================================
   slot-cell.js — 셀 1개
   ============================================
   - empty / fish / golden / rainbow / twinkle
   - matched + cluster-index (1~6)
   - 헤엄 모션

   Day 20: twinkle 심볼 추가 (꿈조각 미니게임)
     - 흰색(Alice Blue 톤) 단색 fill, 다른 심볼과 동일 path 구조 (눈 없음)
     - 옅은 하늘색 글로우는 slot.css 의 .cell-glow 에서 처리
   ============================================ */

/** @typedef {'empty' | 'fish' | 'golden' | 'rainbow' | 'twinkle'} SlotSymbol */

export function createSlotCell(opts = {}) {
  const { symbol = 'empty' } = opts;

  const root = document.createElement('div');
  root.className = 'slot-cell';
  root.dataset.symbol = symbol;

  // 셀별 헤엄 타이밍
  const swimDelay = (Math.random() * 1.5).toFixed(2);
  const swimDuration = (1.4 + Math.random() * 0.6).toFixed(2);
  root.style.setProperty('--swim-delay', `${swimDelay}s`);
  root.style.setProperty('--swim-duration', `${swimDuration}s`);

  const glow = document.createElement('div');
  glow.className = 'cell-glow';
  root.appendChild(glow);

  const strip = document.createElement('div');
  strip.className = 'reel-strip';
  root.appendChild(strip);

  function symbolSVG(s) {
    if (s === 'empty') return '';
    const fillColor =
      s === 'golden'  ? '#E8C870' :
      s === 'rainbow' ? '#FF9DCB' :
      s === 'twinkle' ? '#F0F8FF' :
                        '#000000';
    return `
      <div class="reel-symbol">
        <svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 20 Q18 8 35 12 Q48 16 50 20 Q48 24 35 28 Q18 32 8 20 Z M50 20 L58 13 L58 27 Z"
                fill="${fillColor}"/>
        </svg>
      </div>
    `;
  }

  function setSymbol(next) {
    root.dataset.symbol = next;
    root.classList.remove('spinning');
    strip.innerHTML = symbolSVG(next);
  }

  function setSpinning(on) {
    if (on) {
      root.classList.add('spinning');
      strip.innerHTML = '';
    } else {
      root.classList.remove('spinning');
    }
  }

  function triggerStop() {
    root.classList.add('stopped');
    // Day 3: 강한 바운스 0.55s + 빛 플래시 0.35s — 600ms 후 제거
    setTimeout(() => root.classList.remove('stopped'), 600);
  }

  /**
   * 매칭 강조
   * @param {boolean} on
   * @param {string|null} grade - '치어' | '소형' | '중형' | '월척' | '대물' | '보스' | '전설보스' | '신화보스' (null이면 색 없음)
   * @param {string} [symbol]   - 'fish' | 'rainbow' (rainbow면 분홍 흰빛 코어 펄스 별도 처리)
   *
   * Day 3: 클러스터 인덱스(1~6) 기반 → 등급(5단계) 기반으로 변경
   *        잡기 게임 색 시스템과 통일성 ↑
   */
  function setMatched(on, grade = null, symbol) {
    if (on) {
      root.classList.add('matched');
      if (symbol === 'rainbow') {
        // 분홍 매칭: 등급 색 무시, 무조건 흰빛 코어 펄스
        root.dataset.matchType = 'rainbow';
        delete root.dataset.grade;
      } else {
        // 일반(fish) 매칭: 등급별 색
        // Day 15: 7등급 — fallback은 '소형' 유지 (가장 안전한 흰빛)
        root.dataset.grade = grade || '소형';
        delete root.dataset.matchType;
      }
    } else {
      root.classList.remove('matched');
      delete root.dataset.grade;
      delete root.dataset.matchType;
    }
  }

  function setGoldenMatched(on) {
    if (on) root.classList.add('matched-golden');
    else root.classList.remove('matched-golden');
  }

  // Day 20: 꿈조각(트윙클) 클러스터 매칭 셀 발광 — setGoldenMatched 와 동일 패턴
  function setTwinkleMatched(on) {
    if (on) root.classList.add('matched-twinkle');
    else root.classList.remove('matched-twinkle');
  }

  // ★ Day 26 — 까비까비 매칭 셀 발광 (Mixed 클러스터, 대표 결정).
  //   colorIdx: 1~5 (네온 색 인덱스 — CSS data-kabikabi-color="N" 으로 매핑).
  //   테두리 네온색만 적용, 배경/심볼은 변경 X (대표 명세).
  function setKabikabiMatched(on, colorIdx = 1) {
    if (on) {
      root.classList.add('matched-kabikabi');
      root.dataset.kabikabiColor = String(colorIdx);
    } else {
      root.classList.remove('matched-kabikabi');
      delete root.dataset.kabikabiColor;
    }
  }

  setSymbol(symbol);

  return { root, setSymbol, setSpinning, triggerStop, setMatched, setGoldenMatched, setTwinkleMatched, setKabikabiMatched };
}