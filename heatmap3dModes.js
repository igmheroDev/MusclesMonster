// ============================================================
// RECOVR - Shared home 3D body-map modes (independent module)
//
// Owns ONE WebGL stage for Recovery / Growth / Loss on the home
// heatmap host. Does not rewrite MuscleHeatmap / MuscleGrowthDetail
// calculation — only reuses their data and hides their per-card 3D.
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

  let currentMode = DEFAULT_MODE;
  let mapMode = '2d';
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
        justify-content: space-between;
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
      #${SHARED_HOST_ID} {
        height: min(52vh, 420px);
        min-height: 280px;
        border-radius: 14px;
        overflow: hidden;
        background: #0a0a0f;
        border: 1px solid var(--border);
        margin-bottom: 8px;
        /* Allow vertical page scroll when the gesture starts on the 3D host */
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
      /* Chrome owns the single 2D/3D toggle — never show the recovery card's duplicate */
      .hmt-host .bm3-mode-toggle[data-bm3-toggle="recovery"] {
        display: none !important;
      }
      /* In 2D, cards keep their own legends; chrome legend only for 3D */
      #${CHROME_ID} .h3d-legend { display: none; }
      .hmt-host.h3d-active #${CHROME_ID} .h3d-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 12px;
      }
      /* 3D mode: hide 2D panel cards entirely (avoids stacked headers / Front·Back / legends) */
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

  function syncMapMode() {
    if (typeof BodyMap3D !== 'undefined' && BodyMap3D.getPreferredMode) {
      mapMode = BodyMap3D.getPreferredMode();
    }
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
        <span><i style="background:#14c878"></i>Growing</span>
        <span><i style="background:#2ef0a0"></i>Strong growth</span>
        <span><i style="background:#3a3a44"></i>No signal</span>`;
    }
    if (mode === 'loss') {
      return `
        <span><i style="background:#7b6cff"></i>Losing</span>
        <span><i style="background:#4a3dc8"></i>High loss</span>
        <span><i style="background:#3a3a44"></i>Stable</span>`;
    }
    return `
      <span><i style="background:#ff3b5c"></i>Fatigued</span>
      <span><i style="background:#f5a524"></i>Recovering</span>
      <span><i style="background:#3ee6b0"></i>Ready</span>`;
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
    const toggle = (typeof BodyMap3D !== 'undefined' && BodyMap3D.buildModeToggle)
      ? BodyMap3D.buildModeToggle(mapMode, { scope: 'home-modes' })
      : '';
    chrome.innerHTML = `
      <div class="h3d-legend" data-h3d-legend>${legendHtml(currentMode)}</div>
      ${toggle}`;
    if (typeof BodyMap3D !== 'undefined' && BodyMap3D.bindModeToggle) {
      BodyMap3D.bindModeToggle(chrome, (mode) => {
        mapMode = mode;
        applyViewMode();
      });
    }
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
    tablist.setAttribute('aria-label', 'Body map mode');
    // Rebuild three English-labelled tabs while keeping panel ids
    tablist.innerHTML = `
      <button type="button" class="hmt-tab" role="tab" id="hmtTabRecovery" data-hmt-mode="recovery" aria-controls="muscleHeatmapCard">Recovery</button>
      <button type="button" class="hmt-tab" role="tab" id="hmtTabGrowth" data-hmt-mode="growth" aria-controls="muscleGrowthHeatmapCard">Growth</button>
      <button type="button" class="hmt-tab" role="tab" id="hmtTabLoss" data-hmt-mode="loss" aria-controls="muscleGrowthHeatmapCard">Loss</button>`;
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

    // Panels are toggled here; do not call HeatmapModeTabs.setMode —
    // it would overwrite the Loss tab selection (loss shares the growth panel).
  }

  function refreshLegend() {
    const el = document.querySelector(`#${CHROME_ID} [data-h3d-legend]`);
    if (el) el.innerHTML = legendHtml(currentMode);
  }

  function buildDataPayload() {
    if (currentMode === 'recovery') {
      return { recovery: lastRecovery || {}, view: 'front' };
    }
    return { perMuscle: lastPerMuscle || {}, view: 'front' };
  }

  async function mountOrTransition3d() {
    if (typeof BodyMap3D === 'undefined') return;
    const shared = ensureSharedHost();
    if (!shared) return;

    // Suppress recovery card's own WebGL context
    if (BodyMap3D.unmount) BodyMap3D.unmount('recovery');

    const data = buildDataPayload();
    const colorMode = currentMode;

    if (BodyMap3D.hasMount && BodyMap3D.hasMount(MOUNT_ID)) {
      BodyMap3D.transitionUpdate(MOUNT_ID, data, {
        colorMode,
        animate: true,
        duration: BodyMap3D.TRANSITION_MS || 400,
      });
      return;
    }

    shared.innerHTML = '';
    await BodyMap3D.mount(MOUNT_ID, shared, {
      colorMode,
      data,
      showPedestal: false,
      autoRotate: !prefersReducedMotion(),
      onMuscleTap: null,
    });
  }

  function teardown3d() {
    if (typeof BodyMap3D !== 'undefined') BodyMap3D.unmount(MOUNT_ID);
    const shared = document.getElementById(SHARED_HOST_ID);
    if (shared) shared.innerHTML = '';
  }

  function applyViewMode() {
    const host = getHost();
    if (!host) return;
    ensureChrome();
    const shared = ensureSharedHost();
    const chrome = document.getElementById(CHROME_ID);

    if (mapMode === '3d' && visible) {
      host.classList.add('h3d-active');
      if (chrome) chrome.removeAttribute('hidden');
      if (shared) shared.removeAttribute('hidden');
      mountOrTransition3d();
    } else {
      host.classList.remove('h3d-active');
      if (shared) shared.setAttribute('hidden', '');
      teardown3d();
      // Keep chrome (toggle + legend) visible so user can switch back to 3D
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
    // Capture + stopPropagation so HeatmapModeTabs' bubble listener cannot
    // double-toggle panels (Loss shares the growth panel id).
    host.addEventListener('click', onTabClick, true);
    wired = true;
  }

  function afterHomeRender(recovery) {
    ensureStyles();
    loadSavedMode();
    syncMapMode();
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
    legendHtml,
  };
})();

if (typeof window !== 'undefined') {
  window.Heatmap3dModes = Heatmap3dModes;
}
