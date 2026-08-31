// ============================================================
// RECOVR - 콤보 재미 연출 모듈 (독립 모듈)
// 세트 체크를 빠르게 연속으로 할 때 게임처럼 "N 콤보!" 텍스트가 튀는 연출.
// celebrateFx.js / microAnim.js와 동일한 패턴(이벤트 위임 + 캡처 단계)으로
// 동작하며, 기존 모듈의 로직·DOM·클래스는 전혀 건드리지 않는 완전 별도 모듈.
// ============================================================

const ComboFx = (() => {
  const STYLE_ID = 'combo-fx-styles';
  const LAYER_ID = 'comboFxLayer';

  const COMBO_WINDOW_MS = 3000; // 이 시간 안에 다음 체크가 오면 콤보 유지
  const POP_MS = 900;
  const FLASH_MS = 260;
  const FLASH_MIN_COMBO = 7; // 이 콤보부터 화면 전체 플래시 추가

  const CHECK_SELECTORS = '.set-check, .duration-check';

  // 콤보 수에 따라 점점 더 화려해지는 단계. min 값이 큰 것부터 매칭되도록 뒤에서부터 탐색.
  const TIERS = [
    { min: 2, className: 'cbf-tier-1', label: (n) => `${n} 콤보!`, vibrate: [10, 30, 10] },
    { min: 4, className: 'cbf-tier-2', label: (n) => `${n} 콤보! 🔥`, vibrate: [12, 24, 12, 24, 12] },
    { min: 7, className: 'cbf-tier-3', label: (n) => `${n} 콤보!! 💪 대박`, vibrate: [16, 24, 16, 24, 16, 24] },
    { min: 10, className: 'cbf-tier-4', label: (n) => `${n} 콤보!!! 🐲괴물모드`, vibrate: [20, 30, 20, 30, 20, 30, 30] },
  ];

  let initialized = false;
  let reducedMotion = false;
  let mq = null;
  let comboCount = 0;
  let comboTimer = null;
  let lastCheckAt = 0;

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) { /* ignore */ }
  }

  function ensureStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${LAYER_ID} {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 12006;
        overflow: hidden;
      }
      .cbf-combo {
        position: absolute;
        left: 0;
        top: 0;
        transform: translate(-50%, 0);
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 800;
        font-size: 17px;
        white-space: nowrap;
        pointer-events: none;
        animation: cbf-combo-pop ${POP_MS}ms cubic-bezier(0.22, 1.4, 0.36, 1) both;
        will-change: transform, opacity;
      }
      .cbf-tier-1 {
        color: #ffd600;
        text-shadow: 0 0 12px rgba(255, 214, 0, 0.55);
      }
      .cbf-tier-2 {
        color: #ff6b35;
        font-size: 20px;
        text-shadow: 0 0 14px rgba(255, 107, 53, 0.6);
      }
      .cbf-tier-3 {
        color: #00ff9d;
        font-size: 23px;
        text-shadow: 0 0 16px rgba(0, 255, 157, 0.65);
      }
      .cbf-tier-4 {
        font-size: 22px;
        background: linear-gradient(90deg, #ff3b5c, #a78bfa, #00e5ff);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        filter: drop-shadow(0 0 10px rgba(167, 139, 250, 0.6));
      }
      .cbf-flash {
        position: absolute;
        inset: 0;
        pointer-events: none;
        animation: cbf-flash-fade ${FLASH_MS}ms ease-out forwards;
      }

      @keyframes cbf-combo-pop {
        0%   { opacity: 0; transform: translate(-50%, 8px) scale(0.4) rotate(-6deg); }
        25%  { opacity: 1; transform: translate(-50%, -6px) scale(1.25) rotate(4deg); }
        45%  { opacity: 1; transform: translate(-50%, -10px) scale(1) rotate(-2deg); }
        100% { opacity: 0; transform: translate(-50%, -46px) scale(0.92) rotate(0deg); }
      }
      @keyframes cbf-flash-fade {
        0%   { opacity: 0.5; }
        100% { opacity: 0; }
      }

      @media (prefers-reduced-motion: reduce) {
        .cbf-combo,
        .cbf-flash {
          animation: none !important;
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureLayer() {
    let layer = document.getElementById(LAYER_ID);
    if (layer) return layer;
    layer = document.createElement('div');
    layer.id = LAYER_ID;
    document.body.appendChild(layer);
    return layer;
  }

  function getTier(count) {
    let tier = null;
    for (let i = 0; i < TIERS.length; i++) {
      if (count >= TIERS[i].min) tier = TIERS[i];
    }
    return tier;
  }

  function screenFlash(tier) {
    if (typeof document === 'undefined') return false;
    const layer = ensureLayer();
    const flash = document.createElement('div');
    flash.className = 'cbf-flash';
    flash.style.background = tier.className === 'cbf-tier-4'
      ? 'radial-gradient(circle at 50% 30%, rgba(167,139,250,0.35), rgba(255,59,92,0.18) 55%, transparent 75%)'
      : 'radial-gradient(circle at 50% 30%, rgba(0,255,157,0.28), transparent 70%)';
    layer.appendChild(flash);
    window.setTimeout(() => {
      if (flash.parentNode) flash.parentNode.removeChild(flash);
    }, FLASH_MS + 40);
    return true;
  }

  function popupCombo(anchorEl, count) {
    const tier = getTier(count);
    if (!tier) return false;
    if (reducedMotion) return false;
    if (typeof document === 'undefined' || !anchorEl) return false;

    ensureStyles();
    const layer = ensureLayer();
    const rect = anchorEl.getBoundingClientRect();
    // 화면 가장자리 근처에서 텍스트가 잘리지 않도록 안전 영역 안으로 x좌표를 보정
    const centerX = rect.left + rect.width / 2;
    const safeX = Math.min(Math.max(centerX, 84), window.innerWidth - 84);

    const label = document.createElement('div');
    label.className = `cbf-combo ${tier.className}`;
    label.textContent = tier.label(count);
    label.style.left = safeX + 'px';
    label.style.top = (rect.top - 6) + 'px';
    layer.appendChild(label);
    window.setTimeout(() => {
      if (label.parentNode) label.parentNode.removeChild(label);
    }, POP_MS + 60);

    vibrate(tier.vibrate);
    if (count >= FLASH_MIN_COMBO) screenFlash(tier);
    return true;
  }

  function resetCombo() {
    comboCount = 0;
    if (comboTimer) {
      window.clearTimeout(comboTimer);
      comboTimer = null;
    }
  }

  // 세트 체크 1건을 콤보 카운터에 반영하고, 필요하면 팝업을 띄운다.
  // anchorEl은 팝업 위치 기준 엘리먼트(체크박스). 테스트/직접 호출 시에도 사용 가능.
  function registerCheck(anchorEl) {
    const now = Date.now();
    if (now - lastCheckAt > COMBO_WINDOW_MS) {
      comboCount = 0;
    }
    comboCount += 1;
    lastCheckAt = now;

    if (comboTimer) window.clearTimeout(comboTimer);
    comboTimer = window.setTimeout(resetCombo, COMBO_WINDOW_MS);

    if (comboCount >= 2) popupCombo(anchorEl, comboCount);
    return comboCount;
  }

  function getCombo() {
    return comboCount;
  }

  function onClick(e) {
    const check = e.target.closest(CHECK_SELECTORS);
    if (!check) return;
    // 체크 토글은 인라인 onclick(app.js)에서 동기적으로 처리되므로,
    // 다음 프레임에 최종 checked 상태를 확인한다 (celebrateFx.js와 동일한 패턴).
    window.requestAnimationFrame(() => {
      if (check.classList.contains('checked')) {
        registerCheck(check);
      }
    });
  }

  function onMotionChange(e) {
    reducedMotion = !!(e && e.matches);
  }

  function init() {
    if (initialized || typeof document === 'undefined') return false;
    initialized = true;
    reducedMotion = prefersReducedMotion();
    ensureStyles();
    ensureLayer();
    // 모달 내부(.modal)는 onclick="event.stopPropagation()"으로 버블 단계 전파를 막으므로,
    // 모달 안의 세트 체크를 감지하려면 캡처 단계에서 받아야 한다 (기존 모듈과 동일한 규칙).
    document.addEventListener('click', onClick, true);

    if (window.matchMedia) {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mq.addEventListener) mq.addEventListener('change', onMotionChange);
      else if (mq.addListener) mq.addListener(onMotionChange);
    }
    return true;
  }

  function destroy() {
    if (!initialized || typeof document === 'undefined') return;
    document.removeEventListener('click', onClick, true);
    resetCombo();
    if (mq) {
      if (mq.removeEventListener) mq.removeEventListener('change', onMotionChange);
      else if (mq.removeListener) mq.removeListener(onMotionChange);
      mq = null;
    }
    const layer = document.getElementById(LAYER_ID);
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    initialized = false;
  }

  function getConfig() {
    return {
      styleId: STYLE_ID,
      layerId: LAYER_ID,
      comboWindowMs: COMBO_WINDOW_MS,
      flashMinCombo: FLASH_MIN_COMBO,
      tierCount: TIERS.length,
      checkSelectors: CHECK_SELECTORS,
    };
  }

  return {
    init,
    destroy,
    registerCheck,
    resetCombo,
    getCombo,
    prefersReducedMotion,
    getConfig,
    ensureStyles,
  };
})();

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ComboFx.init());
  } else {
    ComboFx.init();
  }
}
