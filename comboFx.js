// ============================================================
// RECOVR - 콤보 재미 연출 모듈 (독립 모듈)
// 세트 체크를 빠르게 연속으로 할 때 게임처럼 "N 콤보!" 텍스트가 튀는 연출.
// celebrateFx.js / microAnim.js와 동일한 패턴(이벤트 위임 + 캡처 단계)으로
// 동작하며, 기존 모듈의 로직·DOM·클래스는 전혀 건드리지 않는 완전 별도 모듈.
// ============================================================

const ComboFx = (() => {
  const STYLE_ID = 'combo-fx-styles';
  const LAYER_ID = 'comboFxLayer';
  const HOME_CARD_ID = 'comboBestCard';
  const BEST_STORAGE_KEY = 'recovr_combo_best_v1';

  const COMBO_WINDOW_MS = 3000; // 이 시간 안에 다음 체크가 오면 콤보 유지
  const POP_MS = 900;
  const FLASH_MS = 260;
  const FLASH_MIN_COMBO = 7; // 이 콤보부터 화면 전체 플래시 추가
  const RECORD_MIN_COMBO = 2; // 이 콤보부터 "최고 기록"으로 인정

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
  let bestCombo = 0;
  let bestLoaded = false;

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

  function loadBest() {
    if (bestLoaded) return bestCombo;
    bestLoaded = true;
    try {
      const raw = localStorage.getItem(BEST_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      bestCombo = (parsed && typeof parsed.best === 'number' && parsed.best > 0) ? parsed.best : 0;
    } catch (e) {
      bestCombo = 0;
    }
    return bestCombo;
  }

  function saveBest(value) {
    try {
      localStorage.setItem(BEST_STORAGE_KEY, JSON.stringify({ best: value, updatedAt: new Date().toISOString() }));
    } catch (e) { /* 저장 실패는 무시 - 다음 콤보에서 다시 시도됨 */ }
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
      .cbf-record {
        position: absolute;
        left: 0;
        top: 0;
        transform: translate(-50%, 0);
        white-space: nowrap;
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 800;
        font-size: 15px;
        color: #ffd600;
        text-shadow: 0 0 14px rgba(255, 214, 0, 0.6);
        padding: 6px 14px;
        border-radius: 999px;
        background: rgba(10, 10, 15, 0.55);
        border: 1px solid rgba(255, 214, 0, 0.4);
        pointer-events: none;
        animation: cbf-record-pop ${POP_MS + 400}ms cubic-bezier(0.22, 1.4, 0.36, 1) both;
        will-change: transform, opacity;
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
      @keyframes cbf-record-pop {
        0%   { opacity: 0; transform: translate(-50%, 10px) scale(0.6); }
        30%  { opacity: 1; transform: translate(-50%, -4px) scale(1.1); }
        70%  { opacity: 1; transform: translate(-50%, -4px) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -30px) scale(0.95); }
      }

      @media (prefers-reduced-motion: reduce) {
        .cbf-combo,
        .cbf-flash,
        .cbf-record {
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
    checkNewRecord(anchorEl);
    return comboCount;
  }

  // 이번 콤보가 역대 최고 기록을 넘었는지 확인하고, 넘었다면 저장 + 신기록 연출을 띄운다.
  function checkNewRecord(anchorEl) {
    loadBest();
    if (comboCount <= bestCombo || comboCount < RECORD_MIN_COMBO) return false;
    bestCombo = comboCount;
    saveBest(bestCombo);
    renderHomeCard();
    announceRecord(anchorEl);
    return true;
  }

  function announceRecord(anchorEl) {
    if (reducedMotion || typeof document === 'undefined') return false;
    ensureStyles();
    const layer = ensureLayer();
    const rect = (anchorEl && anchorEl.getBoundingClientRect) ? anchorEl.getBoundingClientRect() : null;
    const centerX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const safeX = Math.min(Math.max(centerX, 84), window.innerWidth - 84);
    const topY = rect ? rect.top - 48 : window.innerHeight * 0.3;

    const badge = document.createElement('div');
    badge.className = 'cbf-record';
    badge.textContent = `🏆 최고 기록 경신! ${bestCombo}콤보`;
    badge.style.left = safeX + 'px';
    badge.style.top = topY + 'px';
    layer.appendChild(badge);
    window.setTimeout(() => {
      if (badge.parentNode) badge.parentNode.removeChild(badge);
    }, POP_MS + 400);

    if (typeof CelebrateFx !== 'undefined' && typeof CelebrateFx.confettiBurst === 'function') {
      CelebrateFx.confettiBurst({ count: 20, x: safeX, y: Math.max(topY, 40) });
    }
    return true;
  }

  // 홈 화면의 #comboBestCard에 최고 콤보 기록을 렌더링한다.
  // muscleGrowthTracker.js 등 기존 모듈과 동일한 "독립 카드 렌더" 패턴.
  function renderHomeCard() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById(HOME_CARD_ID);
    if (!container) return;

    loadBest();
    if (bestCombo < RECORD_MIN_COMBO) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="cbf-best-card">
        <div class="cbf-best-icon">🏆</div>
        <div class="cbf-best-text">
          <div class="cbf-best-label">최고 콤보</div>
          <div class="cbf-best-value">${bestCombo}<span>콤보</span></div>
        </div>
      </div>`;
  }

  function getCombo() {
    return comboCount;
  }

  function getBestCombo() {
    loadBest();
    return bestCombo;
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
      homeCardId: HOME_CARD_ID,
      bestStorageKey: BEST_STORAGE_KEY,
      comboWindowMs: COMBO_WINDOW_MS,
      flashMinCombo: FLASH_MIN_COMBO,
      recordMinCombo: RECORD_MIN_COMBO,
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
    getBestCombo,
    renderHomeCard,
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
