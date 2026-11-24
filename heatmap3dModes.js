// ============================================================
// RECOVR - Shared home 3D body-map modes (independent module)
//
// Owns ONE WebGL stage for 회복 / 성장 / 손실 on the home
// heatmap host. Home is 3D-only (no 2D/3D toggle). Falls back
// to existing 2D cards only when WebGL is unavailable.
//
// Growth / loss formulas: see BODY_MAP_3D_MODES.md (from MuscleGrowthTracker)
// ============================================================

const Heatmap3dModes = (() => {
  const STYLE_ID = 'heatmap-3d-modes-styles';
  const MOUNT_ID = 'home-modes';
  const SHARED_HOST_ID = 'h3dSharedHost';
  const CHROME_ID = 'h3dModesChrome';
  const MODES = ['recovery', 'growth', 'loss'];
  const DEFAULT_MODE = 'recovery';
  const MODE_STORAGE_KEY = 'recovr_heatmap_data_mode';
  const MODE_LABELS = {
    recovery: '회복',
    growth: '성장',
    loss: '손실',
  };

  let currentMode = DEFAULT_MODE;
  let mapMode = '3d'; // home defaults to 3D; '2d' only as WebGL fallback
  let lastRecovery = null;
  let lastPerMuscle = null;
  let wired = false;
  let visible = true;

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  function webglOk() {
    return typeof BodyMap3D !== 'undefined'
      && typeof BodyMap3D.isWebGLAvailable === 'function'
      && BodyMap3D.isWebGLAvailable();
  }

  function ensureStyles() {
    if (typeof document === 'undefined') return false;
    if (document.getElementById(STYLE_ID)) return true;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${CHROME_ID} {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-start;
        gap: 8px;
        margin: 0 0 8px;
      }
      #${CHROME_ID} .h3d-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 12px;
        font-size: 11px;
        color: var(--muted);
      }
      #${CHROME_ID} .h3d-legend span {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      #${CHROME_ID} .h3d-legend i {
        width: 8px; height: 8px; border-radius: 50%; display: inline-block;
      }
      #${CHROME_ID} .h3d-fallback-note {
        width: 100%;
        font-size: 11px;
        color: var(--muted);
        margin: 0;
      }
      #${SHARED_HOST_ID} {
        height: min(52vh, 420px);
        min-height: 280px;
        border-radius: 14px;
        overflow: hidden;
        background: #0a0a0f;
        border: 1px solid var(--border);
        margin-bottom: 8px;
        touch-action: pan-y;
      }
      #${SHARED_HOST_ID} .bm3-stage {
        width: 100%;
        max-width: none;
        height: 100%;
        aspect-ratio: auto;
        touch-action: pan-y;
      }
      #${SHARED_HOST_ID}[hidden] { display: none !important; }
      #${CHROME_ID}[hidden] { display: none !important; }
      /* Home never shows a 2D/3D toggle — remove any leftover DOM */
      .hmt-host .bm3-mode-toggle {
        display: none !important;
      }
      /* 3D mode: hide 2D panel cards entirely */
      .hmt-host.h3d-active .mh-body-wrap,
      .hmt-host.h3d-active .mh-legend,
      .hmt-host.h3d-active .mh-sub,
      .hmt-host.h3d-active #mh3dHost,
      .hmt-host.h3d-active #muscleHeatmapCard,
      .hmt-host.h3d-active #muscleGrowthHeatmapCard {
        display: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
    return true;
  }

  function ownsHome3d() {
    return true;
  }

  /** Home is 3D-only; ignore stored 2D preference. Fall back to 2D only without WebGL. */
  function resolveHomeMapMode() {
    if (webglOk()) {
      mapMode = '3d';
      if (typeof BodyMap3D !== 'undefined' && BodyMap3D.setPreferredMode) {
        try { BodyMap3D.setPreferredMode('3d'); } catch (e) { /* ignore */ }
      }
    } else {
      mapMode = '2d';
    }
    return mapMode;
  }

  function loadSavedMode() {
    try {
      const v = localStorage.getItem(MODE_STORAGE_KEY);
      if (MODES.indexOf(v) !== -1) currentMode = v;
    } catch (e) { /* ignore */ }
  }

  function saveMode(mode) {
    try { localStorage.setItem(MODE_STORAGE_KEY, mode); } catch (e) { /* ignore */ }
  }

  function getHost() {
    return document.getElementById('heatmapModeHost');
  }

  function legendHtml(mode) {
    if (mode === 'growth') {
      return `
        <span><i style="background:#14c878"></i>성장 중</span>
        <span><i style="background:#2ef0a0"></i>강한 성장</span>
        <span><i style="background:#3a3a44"></i>신호 없음</span>`;
    }
    if (mode === 'loss') {
      return `
        <span><i style="background:#7b6cff"></i>손실</span>
        <span><i style="background:#4a3dc8"></i>손실 심함</span>
        <span><i style="background:#3a3a44"></i>유지</span>`;
    }
    return `
      <span><i style="background:#ff3b5c"></i>피로</span>
      <span><i style="background:#f5a524"></i>회복 중</span>
      <span><i style="background:#3ee6b0"></i>준비됨</span>`;
  }

  function ensureChrome() {
    const host = getHost();
    if (!host) return null;
    let chrome = document.getElementById(CHROME_ID);
    if (!chrome) {
      chrome = document.createElement('div');
      chrome.id = CHROME_ID;
      const tabs = host.querySelector('.hmt-tabs');
      if (tabs && tabs.nextSibling) host.insertBefore(chrome, tabs.nextSibling);
      else host.insertBefore(chrome, host.firstChild);
    }
    // Legend only — no 2D/3D toggle on home
    const fallbackNote = (mapMode !== '3d')
      ? '<p class="h3d-fallback-note" data-h3d-fallback>3D를 사용할 수 없어 2D로 표시합니다.</p>'
      : '';
    chrome.innerHTML = `
      <div class="h3d-legend" data-h3d-legend aria-label="${MODE_LABELS[currentMode] || ''} 범례">${legendHtml(currentMode)}</div>
      ${fallbackNote}`;
    // Strip any leftover toggles injected elsewhere into chrome
    chrome.querySelectorAll('.bm3-mode-toggle').forEach((el) => el.remove());
    return chrome;
  }

  function ensureSharedHost() {
    const host = getHost();
    if (!host) return null;
    let shared = document.getElementById(SHARED_HOST_ID);
    if (!shared) {
      shared = document.createElement('div');
      shared.id = SHARED_HOST_ID;
      shared.className = 'h3d-shared-host';
      const chrome = document.getElementById(CHROME_ID);
      if (chrome && chrome.nextSibling) host.insertBefore(shared, chrome.nextSibling);
      else {
        const tabs = host.querySelector('.hmt-tabs');
        if (tabs && tabs.nextSibling) host.insertBefore(shared, tabs.nextSibling);
        else host.appendChild(shared);
      }
    }
    return shared;
  }

  function upgradeTabs() {
    const host = getHost();
    if (!host) return;
    const tablist = host.querySelector('.hmt-tabs');
    if (!tablist) return;
    tablist.setAttribute('aria-label', '바디맵 모드');
    tablist.innerHTML = `
      <button type="button" class="hmt-tab" role="tab" id="hmtTabRecovery" data-hmt-mode="recovery" aria-controls="muscleHeatmapCard" aria-label="회복">${MODE_LABELS.recovery}</button>
      <button type="button" class="hmt-tab" role="tab" id="hmtTabGrowth" data-hmt-mode="growth" aria-controls="muscleGrowthHeatmapCard" aria-label="성장">${MODE_LABELS.growth}</button>
      <button type="button" class="hmt-tab" role="tab" id="hmtTabLoss" data-hmt-mode="loss" aria-controls="muscleGrowthHeatmapCard" aria-label="손실">${MODE_LABELS.loss}</button>`;
  }

  function applyTabSelection() {
    const host = getHost();
    if (!host) return;
    host.querySelectorAll('[data-hmt-mode]').forEach((tab) => {
      const on = tab.getAttribute('data-hmt-mode') === currentMode;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.setAttribute('tabindex', on ? '0' : '-1');
      tab.classList.toggle('selected', on);
    });

    const showRecovery = currentMode === 'recovery';
    const recoveryPanel = document.getElementById('muscleHeatmapCard');
    const growthPanel = document.getElementById('muscleGrowthHeatmapCard');
    if (recoveryPanel) {
      if (showRecovery) recoveryPanel.removeAttribute('hidden');
      else recoveryPanel.setAttribute('hidden', '');
    }
    if (growthPanel) {
      if (!showRecovery) growthPanel.removeAttribute('hidden');
      else growthPanel.setAttribute('hidden', '');
    }
  }

  function refreshLegend() {
    const el = document.querySelector(`#${CHROME_ID} [data-h3d-legend]`);
    if (el) {
      el.innerHTML = legendHtml(currentMode);
      el.setAttribute('aria-label', `${MODE_LABELS[currentMode] || ''} 범례`);
    }
  }

  function buildDataPayload() {
    if (currentMode === 'recovery') {
      return { recovery: lastRecovery || {}, view: 'front' };
    }
    return { perMuscle: lastPerMuscle || {}, view: 'front' };
  }

  async function mountOrTransition3d() {
    if (typeof BodyMap3D === 'undefined') return false;
    const shared = ensureSharedHost();
    if (!shared) return false;

    if (BodyMap3D.unmount) BodyMap3D.unmount('recovery');

    const data = buildDataPayload();
    const colorMode = currentMode;

    if (BodyMap3D.hasMount && BodyMap3D.hasMount(MOUNT_ID)) {
      BodyMap3D.transitionUpdate(MOUNT_ID, data, {
        colorMode,
        animate: true,
        duration: BodyMap3D.TRANSITION_MS || 400,
      });
      return true;
    }

    shared.innerHTML = '';
    const ok = await BodyMap3D.mount(MOUNT_ID, shared, {
      colorMode,
      data,
      showPedestal: false,
      autoRotate: !prefersReducedMotion(),
      onMuscleTap: null,
    });
    if (!ok) {
      // Mount failed → fall back to 2D cards
      mapMode = '2d';
      return false;
    }
    return true;
  }

  function teardown3d() {
    if (typeof BodyMap3D !== 'undefined') BodyMap3D.unmount(MOUNT_ID);
    const shared = document.getElementById(SHARED_HOST_ID);
    if (shared) shared.innerHTML = '';
  }

  async function applyViewMode() {
    const host = getHost();
    if (!host) return;
    resolveHomeMapMode();
    ensureChrome();
    const shared = ensureSharedHost();
    const chrome = document.getElementById(CHROME_ID);

    if (mapMode === '3d' && visible) {
      host.classList.add('h3d-active');
      if (chrome) chrome.removeAttribute('hidden');
      if (shared) shared.removeAttribute('hidden');
      const ok = await mountOrTransition3d();
      if (!ok) {
        host.classList.remove('h3d-active');
        if (shared) shared.setAttribute('hidden', '');
        teardown3d();
        ensureChrome(); // refresh fallback note
        if (chrome) chrome.removeAttribute('hidden');
        refreshLegend();
      }
    } else {
      host.classList.remove('h3d-active');
      if (shared) shared.setAttribute('hidden', '');
      teardown3d();
      if (chrome) chrome.removeAttribute('hidden');
      refreshLegend();
    }
  }

  function setMode(mode) {
    const next = MODES.indexOf(mode) === -1 ? DEFAULT_MODE : mode;
    const changed = next !== currentMode;
    currentMode = next;
    saveMode(currentMode);
    applyTabSelection();
    refreshLegend();
    if (mapMode === '3d' && visible) {
      if (changed) mountOrTransition3d();
      else applyViewMode();
    }
    return currentMode;
  }

  function onTabClick(e) {
    const tab = e.target && e.target.closest ? e.target.closest('[data-hmt-mode]') : null;
    if (!tab || !getHost() || !getHost().contains(tab)) return;
    const mode = tab.getAttribute('data-hmt-mode');
    if (!mode || MODES.indexOf(mode) === -1) return;
    e.preventDefault();
    e.stopPropagation();
    setMode(mode);
  }

  function refreshDataCaches() {
    try {
      if (typeof loadWorkouts === 'function' && typeof calcMuscleRecovery === 'function') {
        const workouts = loadWorkouts();
        lastRecovery = calcMuscleRecovery(workouts);
      }
    } catch (e) {
      console.warn('[Heatmap3dModes] recovery cache failed', e);
    }
    try {
      if (typeof MuscleGrowthTracker !== 'undefined' && MuscleGrowthTracker.compute) {
        const workouts = (typeof loadWorkouts === 'function') ? loadWorkouts() : [];
        const result = MuscleGrowthTracker.compute(workouts, new Date());
        lastPerMuscle = (result && result.perMuscle) || {};
      }
    } catch (e) {
      console.warn('[Heatmap3dModes] growth/loss cache failed', e);
    }
  }

  function wire() {
    if (wired) return;
    const host = getHost();
    if (!host) return;
    host.addEventListener('click', onTabClick, true);
    wired = true;
  }

  function afterHomeRender(recovery) {
    ensureStyles();
    loadSavedMode();
    resolveHomeMapMode();
    upgradeTabs();
    wire();
    if (recovery) lastRecovery = recovery;
    refreshDataCaches();
    if (recovery) lastRecovery = recovery;
    ensureChrome();
    ensureSharedHost();
    applyTabSelection();
    refreshLegend();
    applyViewMode();
  }

  function setVisible(isVisible) {
    visible = !!isVisible;
    if (!visible) teardown3d();
    else applyViewMode();
  }

  function getState() {
    return {
      mode: currentMode,
      mapMode,
      mountId: MOUNT_ID,
      modes: MODES.slice(),
      labels: Object.assign({}, MODE_LABELS),
    };
  }

  return {
    afterHomeRender,
    setMode,
    setVisible,
    ownsHome3d,
    getState,
    MOUNT_ID,
    MODES,
    MODE_LABELS,
    legendHtml,
  };
})();

if (typeof window !== 'undefined') {
  window.Heatmap3dModes = Heatmap3dModes;
}
