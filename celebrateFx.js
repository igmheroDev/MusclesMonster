// ============================================================
// RECOVR - 중간 수준 축하 연출 모듈 (독립 모듈)
// 미션 클리어 풀스크린, confetti, 스트릭 불꽃, XP 팝
// 기존 모듈 로직은 수정하지 않음 (이벤트 위임 + DOM 관찰)
// ============================================================

const CelebrateFx = (() => {
  const STYLE_ID = 'celebrate-fx-styles';
  const OVERLAY_ID = 'celebrateFxOverlay';
  const LAYER_ID = 'celebrateFxLayer';

  const CONFETTI_COUNT = 42;
  const CONFETTI_MS = 1600;
  const OVERLAY_MS = 2200;
  const XP_MS = 900;
  const STREAK_MS = 1100;
  const COOLDOWN_MS = 2500;

  const COLORS = ['#00ff9d', '#00e5ff', '#ffd600', '#ff6b35', '#a78bfa', '#ff3b5c'];

  let initialized = false;
  let reducedMotion = false;
  let mq = null;
  let lastMissionClearAt = 0;
  let lastWorkoutFxAt = 0;
  let streakObserver = null;

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
        z-index: 12000;
        overflow: hidden;
      }
      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 12010;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(6, 8, 14, 0.72);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        pointer-events: auto;
      }
      #${OVERLAY_ID}.show { display: flex; }
      .cfx-overlay-card {
        text-align: center;
        padding: 28px 24px 24px;
        max-width: 300px;
        width: calc(100% - 48px);
        border-radius: 20px;
        border: 1px solid rgba(255, 214, 0, 0.35);
        background: linear-gradient(160deg, rgba(26,26,36,0.96), rgba(20,20,28,0.98));
        box-shadow: 0 18px 50px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset;
        animation: cfx-card-in 420ms cubic-bezier(0.34, 1.45, 0.64, 1) both;
      }
      body.light .cfx-overlay-card {
        background: linear-gradient(160deg, #fff, #f4f4f8);
        box-shadow: 0 16px 40px rgba(0,0,0,0.12);
      }
      .cfx-flame {
        font-size: 52px;
        line-height: 1;
        display: inline-block;
        animation: cfx-flame 900ms ease-in-out infinite;
        filter: drop-shadow(0 0 12px rgba(255,107,53,0.55));
      }
      .cfx-title {
        margin-top: 10px;
        font-family: 'Space Grotesk', sans-serif;
        font-size: 24px;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: var(--text, #e8e8f0);
      }
      .cfx-sub {
        margin-top: 8px;
        font-size: 13px;
        color: var(--muted, #6b6b85);
        line-height: 1.45;
      }
      .cfx-streak {
        margin-top: 14px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(255,107,53,0.16);
        color: var(--orange, #ff6b35);
        font-size: 13px;
        font-weight: 700;
      }
      .cfx-dismiss {
        margin-top: 18px;
        width: 100%;
        border: none;
        border-radius: 12px;
        padding: 12px 14px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        color: #0a0a0f;
        background: linear-gradient(135deg, #ffd600, #00ff9d);
      }
      .cfx-dismiss:active { transform: scale(0.98); }

      .cfx-confetti {
        position: absolute;
        top: -12px;
        width: 8px;
        height: 12px;
        border-radius: 2px;
        opacity: 0.95;
        animation-name: cfx-confetti-fall;
        animation-timing-function: cubic-bezier(0.2, 0.7, 0.3, 1);
        animation-fill-mode: forwards;
        will-change: transform, opacity;
      }
      .cfx-xp {
        position: absolute;
        z-index: 12005;
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: 15px;
        color: var(--green, #00ff9d);
        text-shadow: 0 0 10px rgba(0,255,157,0.35);
        pointer-events: none;
        animation: cfx-xp-float ${XP_MS}ms ease-out forwards;
        white-space: nowrap;
      }
      .cfx-toast {
        position: absolute;
        left: 50%;
        bottom: calc(110px + env(safe-area-inset-bottom, 0px));
        transform: translateX(-50%) translateY(12px);
        padding: 10px 16px;
        border-radius: 999px;
        background: rgba(20,20,28,0.92);
        border: 1px solid rgba(0,255,157,0.35);
        color: var(--text, #e8e8f0);
        font-size: 13px;
        font-weight: 700;
        opacity: 0;
        animation: cfx-toast-in 1400ms ease both;
        white-space: nowrap;
      }
      body.light .cfx-toast {
        background: rgba(255,255,255,0.95);
        border-color: rgba(0,165,113,0.35);
      }
      .cfx-streak-ignite {
        animation: cfx-streak-pop ${STREAK_MS}ms cubic-bezier(0.34, 1.5, 0.64, 1) both;
        box-shadow: 0 0 0 0 rgba(255,107,53,0.45);
      }

      @keyframes cfx-card-in {
        from { opacity: 0; transform: scale(0.82) translateY(16px); }
        to   { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes cfx-flame {
        0%, 100% { transform: translateY(0) scale(1) rotate(-4deg); }
        50% { transform: translateY(-4px) scale(1.08) rotate(4deg); }
      }
      @keyframes cfx-confetti-fall {
        0%   { transform: translate3d(0,0,0) rotate(0deg); opacity: 1; }
        100% { transform: translate3d(var(--cfx-dx), 110vh, 0) rotate(var(--cfx-rot)); opacity: 0; }
      }
      @keyframes cfx-xp-float {
        0%   { opacity: 0; transform: translate(-50%, 8px) scale(0.7); }
        18%  { opacity: 1; transform: translate(-50%, 0) scale(1.12); }
        100% { opacity: 0; transform: translate(-50%, -42px) scale(1); }
      }
      @keyframes cfx-toast-in {
        0%   { opacity: 0; transform: translateX(-50%) translateY(16px); }
        12%  { opacity: 1; transform: translateX(-50%) translateY(0); }
        75%  { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
      }
      @keyframes cfx-streak-pop {
        0%   { transform: scale(0.85); filter: brightness(1); }
        35%  { transform: scale(1.18); filter: brightness(1.25); }
        100% { transform: scale(1); filter: brightness(1); }
      }

      @media (prefers-reduced-motion: reduce) {
        .cfx-overlay-card,
        .cfx-flame,
        .cfx-confetti,
        .cfx-xp,
        .cfx-toast,
        .cfx-streak-ignite {
          animation: none !important;
        }
        #${OVERLAY_ID}.show .cfx-overlay-card { opacity: 1; transform: none; }
        .cfx-toast { opacity: 1; transform: translateX(-50%); }
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

  function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <div class="cfx-overlay-card" role="dialog" aria-modal="true" aria-labelledby="cfxTitle">
        <div class="cfx-flame" aria-hidden="true">🔥</div>
        <div class="cfx-title" id="cfxTitle">미션 클리어!</div>
        <div class="cfx-sub" id="cfxSub">오늘의 데일리 미션을 모두 완료했어요</div>
        <div class="cfx-streak" id="cfxStreak" hidden></div>
        <button type="button" class="cfx-dismiss" data-cfx-dismiss>멋져요!</button>
      </div>
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('[data-cfx-dismiss]')) hideMissionClear();
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function confettiBurst(opts) {
    if (typeof document === 'undefined') return false;
    if (reducedMotion) return false;
    ensureStyles();
    const layer = ensureLayer();
    const count = (opts && opts.count) || CONFETTI_COUNT;
    const originX = (opts && typeof opts.x === 'number') ? opts.x : window.innerWidth / 2;
    const originY = (opts && typeof opts.y === 'number') ? opts.y : window.innerHeight * 0.28;

    for (let i = 0; i < count; i++) {
      const piece = document.createElement('span');
      piece.className = 'cfx-confetti';
      const dx = (Math.random() - 0.5) * window.innerWidth * 0.9;
      const rot = (Math.random() * 720 - 360) + 'deg';
      const delay = Math.random() * 180;
      const dur = CONFETTI_MS + Math.random() * 500;
      piece.style.left = originX + (Math.random() - 0.5) * 40 + 'px';
      piece.style.top = originY + 'px';
      piece.style.background = COLORS[i % COLORS.length];
      piece.style.setProperty('--cfx-dx', dx + 'px');
      piece.style.setProperty('--cfx-rot', rot);
      piece.style.animationDuration = dur + 'ms';
      piece.style.animationDelay = delay + 'ms';
      piece.style.width = (6 + Math.random() * 6) + 'px';
      piece.style.height = (8 + Math.random() * 8) + 'px';
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      layer.appendChild(piece);
      window.setTimeout(() => {
        if (piece.parentNode) piece.parentNode.removeChild(piece);
      }, dur + delay + 40);
    }
    return true;
  }

  function floatXp(anchorEl, text) {
    if (!anchorEl || reducedMotion) return false;
    ensureStyles();
    const layer = ensureLayer();
    const rect = anchorEl.getBoundingClientRect();
    const label = document.createElement('div');
    label.className = 'cfx-xp';
    label.textContent = text || '+1';
    label.style.left = (rect.left + rect.width / 2) + 'px';
    label.style.top = (rect.top - 4) + 'px';
    layer.appendChild(label);
    window.setTimeout(() => {
      if (label.parentNode) label.parentNode.removeChild(label);
    }, XP_MS + 40);
    return true;
  }

  function showToast(message) {
    if (typeof document === 'undefined' || !message) return false;
    ensureStyles();
    const layer = ensureLayer();
    const toast = document.createElement('div');
    toast.className = 'cfx-toast';
    toast.textContent = message;
    layer.appendChild(toast);
    window.setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 1450);
    return true;
  }

  function igniteStreakPill() {
    const pill = document.getElementById('streakPill');
    if (!pill || pill.style.display === 'none') return false;
    if (reducedMotion) return false;
    ensureStyles();
    pill.classList.remove('cfx-streak-ignite');
    void pill.offsetWidth;
    pill.classList.add('cfx-streak-ignite');
    window.setTimeout(() => pill.classList.remove('cfx-streak-ignite'), STREAK_MS + 40);

    const dm = document.querySelector('.dm-streak-pill');
    if (dm) {
      dm.classList.remove('cfx-streak-ignite');
      void dm.offsetWidth;
      dm.classList.add('cfx-streak-ignite');
      window.setTimeout(() => dm.classList.remove('cfx-streak-ignite'), STREAK_MS + 40);
    }
    return true;
  }

  function getMissionStreakSafe() {
    try {
      if (typeof DailyMission !== 'undefined' && DailyMission.getMissionStreak) {
        return DailyMission.getMissionStreak() || 0;
      }
    } catch (e) { /* ignore */ }
    return 0;
  }

  function showMissionClear(opts) {
    if (typeof document === 'undefined') return false;
    const now = Date.now();
    if (now - lastMissionClearAt < COOLDOWN_MS) return false;
    lastMissionClearAt = now;

    ensureStyles();
    const overlay = ensureOverlay();
    const streak = (opts && opts.streak != null) ? opts.streak : getMissionStreakSafe();
    const streakEl = overlay.querySelector('#cfxStreak');
    const titleEl = overlay.querySelector('#cfxTitle');
    const subEl = overlay.querySelector('#cfxSub');

    if (titleEl) titleEl.textContent = (opts && opts.title) || '미션 클리어!';
    if (subEl) subEl.textContent = (opts && opts.subtitle) || '오늘의 데일리 미션을 모두 완료했어요';

    if (streakEl) {
      if (streak >= 2) {
        streakEl.hidden = false;
        streakEl.textContent = `🔥 ${streak}일 연속 유지 중`;
      } else {
        streakEl.hidden = true;
        streakEl.textContent = '';
      }
    }

    overlay.classList.add('show');
    confettiBurst({ count: 56, y: window.innerHeight * 0.22 });
    igniteStreakPill();
    vibrate([18, 40, 18, 40, 28]);

    if (!reducedMotion) {
      window.setTimeout(() => {
        if (overlay.classList.contains('show')) hideMissionClear();
      }, OVERLAY_MS + 1800);
    }
    return true;
  }

  function hideMissionClear() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.classList.remove('show');
  }

  function workoutSaved() {
    const now = Date.now();
    if (now - lastWorkoutFxAt < COOLDOWN_MS) return false;
    lastWorkoutFxAt = now;

    confettiBurst({ count: 36, y: window.innerHeight * 0.35 });
    showToast('운동 기록 완료 💪');
    igniteStreakPill();
    vibrate([12, 24, 12]);
    return true;
  }

  function missionsAllDone() {
    const items = document.querySelectorAll('.dm-mission-item');
    if (!items.length) return false;
    return document.querySelectorAll('.dm-mission-item:not(.done)').length === 0;
  }

  function onClick(e) {
    const check = e.target.closest('.set-check, .duration-check');
    if (check) {
      window.requestAnimationFrame(() => {
        if (!check.classList.contains('checked')) return;
        floatXp(check, '+1 세트');
        confettiBurst({
          count: 12,
          x: check.getBoundingClientRect().left + check.getBoundingClientRect().width / 2,
          y: check.getBoundingClientRect().top,
        });
        vibrate(8);
      });
    }

    const mission = e.target.closest('.dm-mission-item');
    if (mission) {
      window.requestAnimationFrame(() => {
        const checkEl = mission.querySelector('.dm-mission-check');
        if (checkEl && checkEl.classList.contains('checked')) {
          floatXp(checkEl, '+1 미션');
        }
        window.setTimeout(() => {
          if (missionsAllDone()) showMissionClear();
        }, 40);
      });
    }

    const saveBtn = e.target.closest('#saveBtn');
    if (saveBtn && !saveBtn.disabled) {
      window.setTimeout(() => {
        const overlay = document.getElementById('modalOverlay');
        const closed = !overlay || !overlay.classList.contains('show');
        if (closed) workoutSaved();
      }, 60);
    }
  }

  function watchStreakPill() {
    const pill = document.getElementById('streakPill');
    if (!pill || typeof MutationObserver === 'undefined') return;
    let prev = pill.textContent;
    streakObserver = new MutationObserver(() => {
      const next = pill.textContent;
      if (next && next !== prev && pill.style.display !== 'none') {
        igniteStreakPill();
      }
      prev = next;
    });
    streakObserver.observe(pill, { childList: true, characterData: true, subtree: true });
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
    document.addEventListener('click', onClick, false);
    watchStreakPill();

    if (window.matchMedia) {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mq.addEventListener) mq.addEventListener('change', onMotionChange);
      else if (mq.addListener) mq.addListener(onMotionChange);
    }
    return true;
  }

  function destroy() {
    if (!initialized || typeof document === 'undefined') return;
    document.removeEventListener('click', onClick);
    if (streakObserver) {
      streakObserver.disconnect();
      streakObserver = null;
    }
    if (mq) {
      if (mq.removeEventListener) mq.removeEventListener('change', onMotionChange);
      else if (mq.removeListener) mq.removeListener(onMotionChange);
      mq = null;
    }
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    const layer = document.getElementById(LAYER_ID);
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    initialized = false;
  }

  function getConfig() {
    return {
      styleId: STYLE_ID,
      overlayId: OVERLAY_ID,
      layerId: LAYER_ID,
      confettiCount: CONFETTI_COUNT,
      confettiMs: CONFETTI_MS,
      overlayMs: OVERLAY_MS,
      colors: COLORS.slice(),
      cooldownMs: COOLDOWN_MS,
    };
  }

  return {
    init,
    destroy,
    confettiBurst,
    floatXp,
    showToast,
    showMissionClear,
    hideMissionClear,
    workoutSaved,
    igniteStreakPill,
    prefersReducedMotion,
    getConfig,
    ensureStyles,
  };
})();

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CelebrateFx.init());
  } else {
    CelebrateFx.init();
  }
}
