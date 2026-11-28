// ============================================================
// RECOVR - 앱 뒤로가기 스택 (독립 모듈)
//
// 안드로이드 뒤로가기·제스처가 팝업이 열린 상태에서 앱을 바로 종료하지
// 않도록 History API로 표준 모바일 앱 뒤로가기를 맞춘다.
//  - 오버레이/시트/모달이 열리면 한 단계 pushState
//  - popstate 는 맨 위 오버레이를 닫고, 없으면 이전 탭으로 돌아가고,
//    홈 루트에서는 "앱을 종료할까요?" 확인을 띄운다.
//  - 닫기 버튼으로 직접 닫아도 해당 history 항목을 함께 제거한다.
// 기존 오버레이 모듈의 공개 close/hide API만 호출한다.
// ============================================================

const AppBackStack = (() => {
  const STYLE_ID = 'app-back-stack-styles';
  const EXIT_ID = 'appBackExitOverlay';
  const ROOT_FLAG = 'recovrRoot';
  const OVERLAY_FLAG = 'recovrOverlay';
  const TAB_FLAG = 'recovrTab';
  const EXIT_FLAG = 'recovrExit';

  const OVERLAY_DEFS = [
    { id: EXIT_ID, z: 10050, close: () => hideExitConfirm({ fromPopstate: true }) },
    { id: 'wcvOverlay', z: 1400, close: () => call('WorkoutCelebrateVideo', 'hide') },
    { id: 'celebrateFxOverlay', z: 1350, close: () => call('CelebrateFx', 'hideMissionClear') },
    { selector: '.rest-timer-overlay', z: 9999, close: () => call('RestTimer', 'skip') },
    { id: 'wcmOverlay', z: 1320, close: () => call('WorkoutCompleteMap', 'hide') },
    { id: 'eshExerciseOverlay', z: 1210, close: () => call('ExerciseStimHeatmap', 'closeExercise') },
    { id: 'eshMuscleOverlay', z: 1200, close: () => call('ExerciseStimHeatmap', 'closeMuscle') },
    { id: 'hbmdOverlay', z: 1300, close: () => call('HomeBodyMapDetail', 'close', { fromPopstate: true }) },
    { id: 'mgdOverlay', z: 1220, close: () => call('MuscleGrowthDetail', 'closeList') },
    { id: 'prTrendOverlay', z: 1200, close: () => call('PrTrendDetail', 'close') },
    { id: 'cqaOverlay', z: 1200, close: () => call('CardioListQuickActions', 'close') },
    { id: 'exPickerOverlay', z: 260, close: () => call('ExercisePicker', 'close') },
    { id: 'aiChatOverlay', z: 250, close: () => call('AiCoach', 'closeChat') },
    { id: 'modalOverlay', z: 200, close: () => {
      if (typeof closeModal === 'function') closeModal();
    } },
  ];

  let started = false;
  let overlayTrapArmed = false;
  let pendingSyncBacks = 0;
  let handlingPopstate = false;
  let exitOpen = false;
  let allowingExit = false;
  let tabStack = [];
  let observer = null;
  let originalSwitchView = null;
  let popHandler = null;
  const modules = {};

  function resolveMod(name) {
    if (modules[name]) return modules[name];
    const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : null);
    if (root && root[name]) {
      modules[name] = root[name];
      return root[name];
    }
    return null;
  }

  function registerModules(map) {
    if (!map) return;
    Object.keys(map).forEach((name) => {
      if (map[name]) modules[name] = map[name];
    });
  }

  function call(modName, method, arg) {
    const mod = resolveMod(modName);
    if (mod && typeof mod[method] === 'function') {
      return arg === undefined ? mod[method]() : mod[method](arg);
    }
    return undefined;
  }

  function getEl(def) {
    if (typeof document === 'undefined') return null;
    if (def.id) return document.getElementById(def.id);
    if (def.selector) return document.querySelector(def.selector);
    return null;
  }

  function isShown(el) {
    if (!el || !el.classList) return false;
    const shown = el.classList.contains('show') || el.classList.contains('visible');
    if (!shown) return false;
    try {
      if (typeof getComputedStyle === 'function') {
        const cs = getComputedStyle(el);
        if (cs && cs.display === 'none') return false;
      }
    } catch (e) { /* ignore */ }
    if (el.hidden) return false;
    return true;
  }

  function zOf(el, fallback) {
    let z = fallback || 0;
    try {
      if (typeof getComputedStyle === 'function') {
        const computed = parseInt(getComputedStyle(el).zIndex, 10);
        if (Number.isFinite(computed)) z = computed;
      }
    } catch (e) { /* ignore */ }
    const inline = el && el.style && parseInt(el.style.zIndex, 10);
    if (Number.isFinite(inline) && inline > z) z = inline;
    // 자세히 보기 위에 추천 운동 시트가 떠야 한다 (CSS가 아직 안 먹어도 동일).
    if (el && (el.id === 'eshMuscleOverlay' || el.id === 'eshExerciseOverlay')) {
      const hbmd = typeof document !== 'undefined' ? document.getElementById('hbmdOverlay') : null;
      if (isShown(hbmd)) z = Math.max(z, el.id === 'eshExerciseOverlay' ? 1410 : 1400);
    }
    return z;
  }

  function getOpenOverlays() {
    const items = [];
    OVERLAY_DEFS.forEach((def) => {
      const el = getEl(def);
      if (!isShown(el)) return;
      items.push({ id: def.id || def.selector, def, el, z: zOf(el, def.z) });
    });
    items.sort((a, b) => b.z - a.z);
    return items;
  }

  function ensureStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${EXIT_ID} {
        display: none; position: fixed; inset: 0; z-index: 10050;
        align-items: center; justify-content: center;
        background: rgba(0,0,0,0.62);
        padding: 24px 18px;
        overscroll-behavior: contain;
      }
      #${EXIT_ID}.show { display: flex; }
      #${EXIT_ID} .abs-card {
        width: min(100%, 320px);
        background: var(--card, #16161f);
        color: var(--text, #eee);
        border: 1px solid var(--border, #2a2a36);
        border-radius: 16px;
        padding: 20px 18px 16px;
        box-shadow: 0 16px 40px rgba(0,0,0,0.45);
      }
      #${EXIT_ID} .abs-title {
        font-size: 17px; font-weight: 800; letter-spacing: -0.02em;
        word-break: keep-all; line-height: 1.4; margin: 0 0 16px;
        text-align: center;
      }
      #${EXIT_ID} .abs-actions {
        display: flex; gap: 8px;
      }
      #${EXIT_ID} .abs-btn {
        flex: 1; min-height: 44px; min-width: 44px;
        border-radius: 12px; border: 1px solid var(--border, #2a2a36);
        font-size: 15px; font-weight: 700; cursor: pointer;
        touch-action: manipulation;
      }
      #${EXIT_ID} .abs-btn-cancel {
        background: transparent; color: var(--muted, #8a8a9a);
      }
      #${EXIT_ID} .abs-btn-exit {
        background: #ff3b5c; border-color: #ff3b5c; color: #fff;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureExitEl() {
    if (typeof document === 'undefined') return null;
    let el = document.getElementById(EXIT_ID);
    if (el) return el;
    ensureStyles();
    el = document.createElement('div');
    el.id = EXIT_ID;
    el.className = 'abs-exit-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'absExitTitle');
    el.innerHTML = `
      <div class="abs-card" onclick="event.stopPropagation()">
        <p class="abs-title" id="absExitTitle">앱을 종료할까요?</p>
        <div class="abs-actions">
          <button type="button" class="abs-btn abs-btn-cancel" data-abs-cancel>취소</button>
          <button type="button" class="abs-btn abs-btn-exit" data-abs-exit>종료</button>
        </div>
      </div>`;
    el.addEventListener('click', (e) => {
      if (e.target === el) cancelExit();
    });
    const cancel = el.querySelector('[data-abs-cancel]');
    const exitBtn = el.querySelector('[data-abs-exit]');
    if (cancel) cancel.addEventListener('click', (e) => { e.preventDefault(); cancelExit(); });
    if (exitBtn) exitBtn.addEventListener('click', (e) => { e.preventDefault(); confirmExit(); });
    document.body.appendChild(el);
    return el;
  }

  function canUseHistory() {
    return typeof history !== 'undefined' && typeof history.pushState === 'function';
  }

  function armRoot() {
    if (!canUseHistory()) return false;
    if (history.state && history.state[ROOT_FLAG]) return false;
    try {
      history.pushState({ [ROOT_FLAG]: true }, '', (typeof location !== 'undefined' && location.href) || '');
      return true;
    } catch (e) {
      return false;
    }
  }

  function armOverlayTrap() {
    if (overlayTrapArmed) return false;
    if (!canUseHistory()) return false;
    overlayTrapArmed = true;
    try {
      history.pushState({ [OVERLAY_FLAG]: true }, '', (typeof location !== 'undefined' && location.href) || '');
      return true;
    } catch (e) {
      overlayTrapArmed = false;
      return false;
    }
  }

  function requestSyncBack(n) {
    const count = n == null ? 1 : n;
    if (count <= 0) return;
    pendingSyncBacks += count;
    try {
      if (count === 1) history.back();
      else history.go(-count);
    } catch (e) {
      pendingSyncBacks = Math.max(0, pendingSyncBacks - count);
    }
  }

  function syncOverlayTrap() {
    const open = getOpenOverlays().filter((item) => item.id !== EXIT_ID);
    if (open.length > 0) {
      armOverlayTrap();
      return;
    }
    if (!overlayTrapArmed) return;
    if (handlingPopstate) {
      overlayTrapArmed = false;
      return;
    }
    overlayTrapArmed = false;
    requestSyncBack(1);
  }

  function closeTopOverlay() {
    const open = getOpenOverlays();
    const top = open.find((item) => item.id !== EXIT_ID) || open[0];
    if (!top || !top.def || typeof top.def.close !== 'function') return false;
    handlingPopstate = true;
    overlayTrapArmed = false;
    try { top.def.close(); } catch (e) { /* ignore */ }
    handlingPopstate = false;
    const still = getOpenOverlays().filter((item) => item.id !== EXIT_ID);
    if (still.length > 0) armOverlayTrap();
    return true;
  }

  function currentViewName() {
    if (typeof document === 'undefined') return 'home';
    const active = document.querySelector('.view.active');
    if (!active || !active.id) return 'home';
    return String(active.id).replace(/^view-/, '') || 'home';
  }

  function wrapMethod(holder, name) {
    if (!holder || typeof holder[name] !== 'function' || holder[name]._absSync) return false;
    const orig = holder[name];
    const wrapped = function absSynced() {
      const result = orig.apply(this, arguments);
      Promise.resolve().then(() => { try { syncOverlayTrap(); } catch (e) { /* ignore */ } });
      return result;
    };
    wrapped._absSync = true;
    holder[name] = wrapped;
    return true;
  }

  function wrapKnownApis() {
    const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : null);
    wrapMethod(resolveMod('HomeBodyMapDetail'), 'open');
    wrapMethod(resolveMod('HomeBodyMapDetail'), 'close');
    wrapMethod(resolveMod('ExerciseStimHeatmap'), 'openMuscle');
    wrapMethod(resolveMod('ExerciseStimHeatmap'), 'closeMuscle');
    wrapMethod(resolveMod('ExerciseStimHeatmap'), 'openExercise');
    wrapMethod(resolveMod('ExerciseStimHeatmap'), 'closeExercise');
    wrapMethod(resolveMod('ExercisePicker'), 'open');
    wrapMethod(resolveMod('ExercisePicker'), 'close');
    wrapMethod(resolveMod('WorkoutCelebrateVideo'), 'show');
    wrapMethod(resolveMod('WorkoutCelebrateVideo'), 'hide');
    wrapMethod(resolveMod('WorkoutCompleteMap'), 'show');
    wrapMethod(resolveMod('WorkoutCompleteMap'), 'hide');
    wrapMethod(resolveMod('PrTrendDetail'), 'open');
    wrapMethod(resolveMod('PrTrendDetail'), 'close');
    wrapMethod(resolveMod('MuscleGrowthDetail'), 'openList');
    wrapMethod(resolveMod('MuscleGrowthDetail'), 'closeList');
    wrapMethod(resolveMod('CardioListQuickActions'), 'open');
    wrapMethod(resolveMod('CardioListQuickActions'), 'close');
    wrapMethod(resolveMod('AiCoach'), 'openChat');
    wrapMethod(resolveMod('AiCoach'), 'closeChat');
    wrapMethod(resolveMod('CelebrateFx'), 'showMissionClear');
    wrapMethod(resolveMod('CelebrateFx'), 'hideMissionClear');
    wrapMethod(resolveMod('RestTimer'), 'start');
    wrapMethod(resolveMod('RestTimer'), 'skip');
    wrapMethod(resolveMod('RestTimer'), 'stop');
    if (root) {
      if (typeof root.openModal === 'function') wrapMethod(root, 'openModal');
      if (typeof root.openModalWithPrefill === 'function') wrapMethod(root, 'openModalWithPrefill');
      if (typeof root.closeModal === 'function') wrapMethod(root, 'closeModal');
    }
  }

  function hookSwitchView() {
    const root = typeof window !== 'undefined' ? window : null;
    if (!root || typeof root.switchView !== 'function') return false;
    if (root.switchView._absWrapped) return true;
    originalSwitchView = root.switchView;
    const wrapped = function switchViewWrapped(viewName, opts) {
      const from = currentViewName();
      const result = originalSwitchView.apply(this, arguments);
      if (opts && opts.fromPopstate) return result;
      const next = viewName;
      if (!next || next === from) return result;
      if (!canUseHistory()) return result;
      tabStack.push(from);
      try {
        history.pushState(
          { [TAB_FLAG]: next, recovrTabFrom: from },
          '',
          (typeof location !== 'undefined' && location.href) || ''
        );
      } catch (e) {
        tabStack.pop();
      }
      return result;
    };
    wrapped._absWrapped = true;
    root.switchView = wrapped;
    return true;
  }

  function unhookSwitchView() {
    const root = typeof window !== 'undefined' ? window : null;
    if (root && originalSwitchView) {
      root.switchView = originalSwitchView;
    }
    originalSwitchView = null;
  }

  function popTab() {
    if (!tabStack.length) return false;
    const prev = tabStack.pop();
    const root = typeof window !== 'undefined' ? window : null;
    const fn = (root && root.switchView) || (typeof switchView === 'function' ? switchView : null);
    if (typeof fn === 'function') {
      try { fn(prev, { fromPopstate: true }); } catch (e) { /* ignore */ }
    }
    return true;
  }

  function showExitConfirm() {
    ensureExitEl();
    const el = document.getElementById(EXIT_ID);
    if (!el) return false;
    exitOpen = true;
    el.classList.add('show');
    return true;
  }

  function hideExitConfirm() {
    const el = typeof document !== 'undefined' ? document.getElementById(EXIT_ID) : null;
    if (el) el.classList.remove('show');
    exitOpen = false;
  }

  function cancelExit() {
    hideExitConfirm();
    armRoot();
  }

  function confirmExit() {
    allowingExit = true;
    hideExitConfirm();
    if (!canUseHistory()) return;
    try { history.back(); } catch (e) { /* ignore */ }
  }

  function handlePopstate() {
    if (pendingSyncBacks > 0) {
      pendingSyncBacks -= 1;
      return { action: 'sync' };
    }
    if (allowingExit) {
      allowingExit = false;
      // 가드 항목을 제거한 뒤 한 번 더 뒤로 가 앱(또는 이전 페이지)을 떠난다.
      try { history.back(); } catch (e) { /* ignore */ }
      return { action: 'exit' };
    }
    if (exitOpen) {
      cancelExit();
      return { action: 'exit-cancel' };
    }
    if (closeTopOverlay()) return { action: 'overlay' };
    if (popTab()) return { action: 'tab' };
    armRoot();
    showExitConfirm();
    return { action: 'exit-confirm' };
  }

  function matchesOverlayNode(node) {
    if (!node || node.nodeType !== 1) return false;
    return OVERLAY_DEFS.some((def) => {
      if (def.id && node.id === def.id) return true;
      if (def.selector && typeof node.matches === 'function' && node.matches(def.selector)) return true;
      return false;
    });
  }

  function hookObserver() {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return false;
    if (observer) return true;
    observer = new MutationObserver((mutations) => {
      let relevant = false;
      for (let i = 0; i < mutations.length; i += 1) {
        const m = mutations[i];
        if (m.type === 'attributes' && matchesOverlayNode(m.target)) {
          relevant = true;
          break;
        }
        if (m.type === 'childList') {
          const nodes = [];
          m.addedNodes && m.addedNodes.forEach((n) => nodes.push(n));
          m.removedNodes && m.removedNodes.forEach((n) => nodes.push(n));
          if (nodes.some(matchesOverlayNode)) {
            relevant = true;
            break;
          }
        }
      }
      if (relevant) syncOverlayTrap();
    });
    const root = document.body || document.documentElement;
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'style'],
    });
    return true;
  }

  function onPopstateEvent() {
    handlePopstate();
  }

  function init(opts) {
    if (opts && opts.modules) registerModules(opts.modules);
    if (started) {
      wrapKnownApis();
      return true;
    }
    started = true;
    ensureStyles();
    ensureExitEl();
    hookSwitchView();
    wrapKnownApis();
    hookObserver();
    armRoot();
    popHandler = onPopstateEvent;
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('popstate', popHandler);
    }
    // 이미 열린 오버레이가 있으면 가드를 맞춘다.
    syncOverlayTrap();
    return true;
  }

  function resetForTest() {
    if (observer) {
      try { observer.disconnect(); } catch (e) { /* ignore */ }
      observer = null;
    }
    if (typeof window !== 'undefined' && popHandler) {
      window.removeEventListener('popstate', popHandler);
    }
    unhookSwitchView();
    hideExitConfirm();
    started = false;
    overlayTrapArmed = false;
    pendingSyncBacks = 0;
    handlingPopstate = false;
    exitOpen = false;
    allowingExit = false;
    tabStack = [];
    popHandler = null;
  }

  const api = {
    init,
    registerModules,
    resetForTest,
    handlePopstate,
    syncOverlayTrap,
    getOpenOverlays,
    armRoot,
    armOverlayTrap,
    closeTopOverlay,
    showExitConfirm,
    hideExitConfirm,
    cancelExit,
    confirmExit,
    currentViewName,
    hookSwitchView,
    isOverlayTrapArmed: () => overlayTrapArmed,
    isExitConfirmOpen: () => exitOpen,
    isAllowingExit: () => allowingExit,
    getTabStack: () => tabStack.slice(),
    getPendingSyncBacks: () => pendingSyncBacks,
    OVERLAY_DEFS,
    EXIT_ID,
    ROOT_FLAG,
    OVERLAY_FLAG,
    TAB_FLAG,
    EXIT_FLAG,
  };

  if (typeof window !== 'undefined') window.AppBackStack = api;
  return api;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = AppBackStack;
