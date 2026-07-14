// ============================================================
// RECOVR - 마이크로 애니메이션 모듈 (독립 모듈)
// 터치·완료 피드백용 짧은 motion. 기존 모듈 로직은 수정하지 않음.
// ============================================================

const MicroAnim = (() => {
  const STYLE_ID = 'micro-anim-styles';
  const POP_MS = 320;
  const RIPPLE_MS = 480;
  const FLASH_MS = 700;

  const CHECK_SELECTORS = '.set-check, .duration-check, .dm-mission-check';
  const RIPPLE_SELECTORS = '.save-btn, .type-btn, .rec-apply-btn, .ai-coach-open-btn, .nav-item.fab, .fatigue-btn, .dm-mission-item, .rest-preset-btn, .cardio-quick-btn';
  const PRESS_SELECTORS = '.nav-item, .log-tab, .theme-toggle, .add-set-btn, .cal-nav-btn';

  let initialized = false;
  let reducedMotion = false;
  let mq = null;

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  function ensureStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes ma-pop {
        0%   { transform: scale(1); }
        35%  { transform: scale(1.22); }
        65%  { transform: scale(0.94); }
        100% { transform: scale(1); }
      }
      @keyframes ma-check-flash {
        0%   { box-shadow: 0 0 0 0 rgba(0, 255, 157, 0.45); }
        100% { box-shadow: 0 0 0 10px rgba(0, 255, 157, 0); }
      }
      @keyframes ma-success-pulse {
        0%   { filter: brightness(1); }
        40%  { filter: brightness(1.18); }
        100% { filter: brightness(1); }
      }
      @keyframes ma-ripple-fade {
        to { transform: scale(2.4); opacity: 0; }
      }
      @keyframes ma-stamp {
        0%   { transform: scale(0.6) rotate(-8deg); opacity: 0.4; }
        55%  { transform: scale(1.08) rotate(2deg); opacity: 1; }
        100% { transform: scale(1) rotate(0deg); opacity: 1; }
      }

      .ma-pop {
        animation: ma-pop ${POP_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }
      .ma-check-flash {
        animation: ma-check-flash ${FLASH_MS}ms ease-out both;
      }
      .ma-success-pulse {
        animation: ma-success-pulse 420ms ease both;
      }
      .ma-stamp {
        animation: ma-stamp 380ms cubic-bezier(0.34, 1.4, 0.64, 1) both;
      }
      .ma-press {
        transform: scale(0.94);
        transition: transform 80ms ease;
      }
      .ma-ripple-host {
        position: relative;
        overflow: hidden;
      }
      .ma-ripple {
        position: absolute;
        border-radius: 50%;
        pointer-events: none;
        background: rgba(255, 255, 255, 0.28);
        transform: scale(0);
        animation: ma-ripple-fade ${RIPPLE_MS}ms ease-out forwards;
        will-change: transform, opacity;
      }
      body.light .ma-ripple {
        background: rgba(0, 0, 0, 0.12);
      }

      @media (prefers-reduced-motion: reduce) {
        .ma-pop,
        .ma-check-flash,
        .ma-success-pulse,
        .ma-stamp,
        .ma-ripple {
          animation: none !important;
        }
        .ma-press {
          transform: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function playClass(el, className, durationMs) {
    if (!el || reducedMotion) return false;
    el.classList.remove(className);
    // restart animation
    void el.offsetWidth;
    el.classList.add(className);
    window.setTimeout(() => {
      el.classList.remove(className);
    }, durationMs + 40);
    return true;
  }

  function pop(el) {
    if (!el) return false;
    playClass(el, 'ma-pop', POP_MS);
    playClass(el, 'ma-check-flash', FLASH_MS);
    return true;
  }

  function stamp(el) {
    if (!el) return false;
    return playClass(el, 'ma-stamp', 380);
  }

  function successPulse(el) {
    if (!el) return false;
    return playClass(el, 'ma-success-pulse', 420);
  }

  function ripple(el, clientX, clientY) {
    if (!el || reducedMotion) return false;
    ensureStyles();
    el.classList.add('ma-ripple-host');

    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = (typeof clientX === 'number' ? clientX : rect.left + rect.width / 2) - rect.left - size / 2;
    const y = (typeof clientY === 'number' ? clientY : rect.top + rect.height / 2) - rect.top - size / 2;

    const ink = document.createElement('span');
    ink.className = 'ma-ripple';
    ink.style.width = size + 'px';
    ink.style.height = size + 'px';
    ink.style.left = x + 'px';
    ink.style.top = y + 'px';
    el.appendChild(ink);

    window.setTimeout(() => {
      if (ink.parentNode) ink.parentNode.removeChild(ink);
    }, RIPPLE_MS + 40);
    return true;
  }

  function celebrateMissionCard() {
    const card = document.querySelector('.dm-card');
    if (!card) return false;
    stamp(card);
    successPulse(card);
    return true;
  }

  function onPointerDown(e) {
    if (reducedMotion) return;
    const pressEl = e.target.closest(PRESS_SELECTORS);
    if (pressEl) pressEl.classList.add('ma-press');

    const rippleEl = e.target.closest(RIPPLE_SELECTORS);
    if (rippleEl) {
      const point = (e.touches && e.touches[0]) || e;
      ripple(rippleEl, point.clientX, point.clientY);
    }
  }

  function onPointerUp(e) {
    document.querySelectorAll('.ma-press').forEach((el) => el.classList.remove('ma-press'));
  }

  function onClick(e) {
    const check = e.target.closest(CHECK_SELECTORS);
    if (check) {
      // inline onclick / 모듈 핸들러가 checked를 토글한 뒤 실행
      window.requestAnimationFrame(() => {
        if (check.classList.contains('checked')) pop(check);
      });
    }

    const mission = e.target.closest('.dm-mission-item');
    if (mission) {
      window.requestAnimationFrame(() => {
        const checkEl = mission.querySelector('.dm-mission-check');
        if (checkEl && checkEl.classList.contains('checked')) pop(checkEl);
        if (mission.classList.contains('done') && typeof document !== 'undefined') {
          // 하루 미션 전체 완료 시 카드 도장 연출
          window.setTimeout(() => {
            const allDone = document.querySelectorAll('.dm-mission-item').length > 0
              && document.querySelectorAll('.dm-mission-item:not(.done)').length === 0;
            if (allDone) celebrateMissionCard();
          }, 30);
        }
      });
    }

    const saveBtn = e.target.closest('#saveBtn, .save-btn');
    if (saveBtn && !saveBtn.disabled) {
      window.setTimeout(() => successPulse(saveBtn), 0);
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

    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('pointerup', onPointerUp, { passive: true });
    document.addEventListener('pointercancel', onPointerUp, { passive: true });
    document.addEventListener('click', onClick, false);

    if (window.matchMedia) {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mq.addEventListener) mq.addEventListener('change', onMotionChange);
      else if (mq.addListener) mq.addListener(onMotionChange);
    }
    return true;
  }

  function destroy() {
    if (!initialized || typeof document === 'undefined') return;
    document.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);
    document.removeEventListener('click', onClick);
    if (mq) {
      if (mq.removeEventListener) mq.removeEventListener('change', onMotionChange);
      else if (mq.removeListener) mq.removeListener(onMotionChange);
      mq = null;
    }
    initialized = false;
  }

  // Node 테스트용 상수/헬퍼
  function getConfig() {
    return {
      styleId: STYLE_ID,
      popMs: POP_MS,
      rippleMs: RIPPLE_MS,
      flashMs: FLASH_MS,
      checkSelectors: CHECK_SELECTORS,
      rippleSelectors: RIPPLE_SELECTORS,
      pressSelectors: PRESS_SELECTORS,
    };
  }

  return {
    init,
    destroy,
    pop,
    stamp,
    ripple,
    successPulse,
    celebrateMissionCard,
    prefersReducedMotion,
    getConfig,
    ensureStyles,
  };
})();

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MicroAnim.init());
  } else {
    MicroAnim.init();
  }
}
