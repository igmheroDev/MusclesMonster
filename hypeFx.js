// ============================================================
// RECOVR - 랜덤 응원 대사 연출 모듈 (독립 모듈)
// 세트 체크·운동 저장 시 랜덤한 한국어 응원 문구를 말풍선으로 노출.
// celebrateFx.js / microAnim.js / comboFx.js와 동일한 패턴(이벤트 위임 +
// 캡처 단계)으로 동작하며, 기존 모듈의 로직·DOM·클래스는 건드리지 않는다.
// ============================================================

const HypeFx = (() => {
  const STYLE_ID = 'hype-fx-styles';
  const LAYER_ID = 'hypeFxLayer';

  const CHECK_COOLDOWN_MS = 4000; // 체크할 때마다 뜨면 시끄러우니 최소 간격을 둔다
  const SAVE_COOLDOWN_MS = 3000;
  // celebrateFx.js의 "운동 기록 완료 💪" 토스트(하단, ~1.45s)와 겹치지 않도록
  // 저장 응원 문구는 화면 상단에, 살짝 늦게 띄운다.
  const SAVE_DELAY_MS = 1600;
  const CHECK_BUBBLE_MS = 1500;
  const SAVE_BUBBLE_MS = 2000;

  const CHECK_PHRASES = [
    '좋아 좋아! 👍',
    '바로 이거지!',
    '근육이 웃고 있어요 😄',
    '오늘 폼 미쳤다',
    '괴물 모드 ON 🐲',
    '가자 가자!',
    '이 맛에 운동하지',
    '근손실은 없다!',
    '지금 완전 물올랐음',
    '심장이 뛴다 🔥',
    '이대로만 가자',
    '오늘 컨디션 최고',
  ];

  const SAVE_PHRASES = [
    '오늘도 자신을 이겼다 💪',
    '내일의 나에게 선물했어요',
    '몸이 기억할 거예요, 오늘을',
    '이게 바로 성장의 냄새',
    '고생했다 진짜, 오늘의 너',
    '근육아 고마워 🙏',
    '한 걸음 더 괴물이 됐다 🐲',
    '오늘의 나 vs 어제의 나, 승리!',
    '땀은 배신하지 않는다',
    '이 정도면 전설이지',
  ];

  let initialized = false;
  let reducedMotion = false;
  let mq = null;
  let lastCheckHypeAt = 0;
  let lastSaveHypeAt = 0;
  let lastCheckPhraseIdx = -1;
  let lastSavePhraseIdx = -1;

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  // 같은 문구가 연달아 두 번 뜨지 않도록 이전 인덱스를 피해서 랜덤 선택
  function pickPhrase(list, lastIdx) {
    if (list.length === 1) return { text: list[0], idx: 0 };
    let idx = Math.floor(Math.random() * list.length);
    if (idx === lastIdx) idx = (idx + 1) % list.length;
    return { text: list[idx], idx };
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
        z-index: 12007;
        overflow: hidden;
      }
      .hfx-bubble {
        position: absolute;
        max-width: 78vw;
        white-space: nowrap;
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        pointer-events: none;
      }
      .hfx-check {
        left: 0;
        top: 0;
        transform: translate(-50%, 0);
        font-size: 12.5px;
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(20, 20, 28, 0.9);
        border: 1px solid rgba(0, 229, 255, 0.35);
        color: var(--text, #e8e8f0);
        animation: hfx-check-pop ${CHECK_BUBBLE_MS}ms cubic-bezier(0.22, 1.2, 0.36, 1) both;
      }
      body.light .hfx-check {
        background: rgba(255, 255, 255, 0.96);
        border-color: rgba(0, 165, 190, 0.35);
      }
      .hfx-save {
        left: 50%;
        top: calc(64px + env(safe-area-inset-top, 0px));
        transform: translateX(-50%) translateY(-16px);
        font-size: 14px;
        padding: 10px 18px;
        border-radius: 999px;
        background: linear-gradient(135deg, rgba(0, 229, 255, 0.16), rgba(167, 139, 250, 0.16));
        border: 1px solid rgba(0, 229, 255, 0.4);
        color: var(--text, #e8e8f0);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
        animation: hfx-save-pop ${SAVE_BUBBLE_MS}ms ease both;
      }

      @keyframes hfx-check-pop {
        0%   { opacity: 0; transform: translate(-50%, 6px) scale(0.85); }
        16%  { opacity: 1; transform: translate(-50%, -2px) scale(1.04); }
        30%  { opacity: 1; transform: translate(-50%, -4px) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -30px) scale(0.98); }
      }
      @keyframes hfx-save-pop {
        0%   { opacity: 0; transform: translateX(-50%) translateY(-16px); }
        14%  { opacity: 1; transform: translateX(-50%) translateY(0); }
        80%  { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
      }

      @media (prefers-reduced-motion: reduce) {
        .hfx-bubble {
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

  function showBubble(text, variant, anchorEl) {
    if (typeof document === 'undefined' || reducedMotion || !text) return false;
    ensureStyles();
    const layer = ensureLayer();

    const bubble = document.createElement('div');
    bubble.className = `hfx-bubble hfx-${variant}`;
    bubble.textContent = text;

    let ttl = CHECK_BUBBLE_MS;
    if (variant === 'check' && anchorEl && anchorEl.getBoundingClientRect) {
      const rect = anchorEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const safeX = Math.min(Math.max(centerX, 90), window.innerWidth - 90);
      bubble.style.left = safeX + 'px';
      bubble.style.top = (rect.top - 34) + 'px';
    } else {
      ttl = SAVE_BUBBLE_MS;
    }

    layer.appendChild(bubble);
    window.setTimeout(() => {
      if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
    }, ttl + 60);
    return true;
  }

  function hypeOnCheck(anchorEl) {
    if (reducedMotion) return false;
    const now = Date.now();
    if (now - lastCheckHypeAt < CHECK_COOLDOWN_MS) return false;
    lastCheckHypeAt = now;

    const picked = pickPhrase(CHECK_PHRASES, lastCheckPhraseIdx);
    lastCheckPhraseIdx = picked.idx;
    return showBubble(picked.text, 'check', anchorEl);
  }

  function hypeOnSave() {
    if (reducedMotion) return false;
    const now = Date.now();
    if (now - lastSaveHypeAt < SAVE_COOLDOWN_MS) return false;
    lastSaveHypeAt = now;

    const picked = pickPhrase(SAVE_PHRASES, lastSavePhraseIdx);
    lastSavePhraseIdx = picked.idx;
    return showBubble(picked.text, 'save', null);
  }

  function onClick(e) {
    const check = e.target.closest('.set-check, .duration-check');
    if (check) {
      // 체크 토글은 인라인 onclick(app.js)에서 동기적으로 처리되므로,
      // 다음 프레임에 최종 checked 상태를 확인한다 (celebrateFx.js와 동일한 패턴).
      window.requestAnimationFrame(() => {
        if (check.classList.contains('checked')) hypeOnCheck(check);
      });
    }

    const saveBtn = e.target.closest('#saveBtn');
    if (saveBtn && !saveBtn.disabled) {
      window.setTimeout(() => {
        const overlay = document.getElementById('modalOverlay');
        const closed = !overlay || !overlay.classList.contains('show');
        if (closed) {
          window.setTimeout(hypeOnSave, SAVE_DELAY_MS);
        }
      }, 60);
    }
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
    // 모달 안의 세트 체크·저장 버튼을 감지하려면 캡처 단계에서 받아야 한다.
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
      checkCooldownMs: CHECK_COOLDOWN_MS,
      saveCooldownMs: SAVE_COOLDOWN_MS,
      saveDelayMs: SAVE_DELAY_MS,
      checkPhraseCount: CHECK_PHRASES.length,
      savePhraseCount: SAVE_PHRASES.length,
    };
  }

  return {
    init,
    destroy,
    hypeOnCheck,
    hypeOnSave,
    prefersReducedMotion,
    getConfig,
    ensureStyles,
  };
})();

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => HypeFx.init());
  } else {
    HypeFx.init();
  }
}
