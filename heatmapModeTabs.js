// ============================================================
// RECOVR - 히트맵 모드 탭 (독립 모듈)
//
// 홈 맨 위 메뉴/하단 네비가 아니라, 히트맵 카드 바로 위에
// [회복] [성장·손실] 탭을 둔다. 같은 자리에서 두 히트맵을 전환한다.
//
// muscleHeatmap.js / muscleGrowthDetail.js / exerciseStimHeatmap.js 의
// 렌더·계산·부위 탭 로직은 수정하지 않는다. 기존 컨테이너를
// 히트맵 인근으로만 모으고, hidden 으로 한쪽만 보여 준다.
// ============================================================

const HeatmapModeTabs = (() => {
  const STYLE_ID = 'heatmap-mode-tabs-styles';
  const HOST_ID = 'heatmapModeHost';
  const DEFAULT_MODE = 'recovery';
  const MODES = ['recovery', 'growth'];

  let initialized = false;
  let currentMode = DEFAULT_MODE;

  function ensureStyles() {
    if (typeof document === 'undefined') return false;
    if (document.getElementById(STYLE_ID)) return true;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* 히트맵 카드 바로 위 — 홈 헤더/하단 네비와 무관 */
      .hmt-host { margin-bottom: 16px; }
      .hmt-tabs {
        display: flex;
        gap: 0;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 4px;
        margin: 0 0 8px;
      }
      .hmt-tab {
        flex: 1;
        min-height: 44px;
        padding: 8px 10px;
        border-radius: 7px;
        border: none;
        background: none;
        color: var(--muted);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: background 0.15s, color 0.15s;
      }
      .hmt-tab[aria-selected="true"] {
        background: var(--card);
        color: var(--text);
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      .hmt-tab:active { opacity: 0.75; }
      .hmt-host [data-hmt-panel][hidden] { display: none !important; }
      .hmt-host .mh-card { margin-bottom: 0; }
    `;
    const head = document.head || document.documentElement;
    head.appendChild(style);
    return true;
  }

  function getHost() {
    if (typeof document === 'undefined') return null;
    return document.getElementById(HOST_ID);
  }

  function normalizeMode(mode) {
    return MODES.indexOf(mode) === -1 ? DEFAULT_MODE : mode;
  }

  function applyMode(root) {
    const host = root || getHost();
    if (!host || !host.querySelectorAll) return currentMode;

    const tabs = host.querySelectorAll('[data-hmt-mode]');
    const panels = host.querySelectorAll('[data-hmt-panel]');

    tabs.forEach((tab) => {
      const selected = tab.getAttribute('data-hmt-mode') === currentMode
        || (tab.dataset && tab.dataset.hmtMode === currentMode);
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.setAttribute('tabindex', selected ? '0' : '-1');
      if (tab.classList) {
        if (selected) tab.classList.add('selected');
        else tab.classList.remove('selected');
      }
    });

    panels.forEach((panel) => {
      const id = panel.getAttribute('data-hmt-panel')
        || (panel.dataset && panel.dataset.hmtPanel);
      const on = id === currentMode;
      if (on) {
        if (panel.removeAttribute) panel.removeAttribute('hidden');
      } else if (panel.setAttribute) {
        panel.setAttribute('hidden', '');
      }
    });

    return currentMode;
  }

  function setMode(mode) {
    currentMode = normalizeMode(mode);
    applyMode();
    return currentMode;
  }

  function onTabClick(e) {
    const tab = e.target && e.target.closest
      ? e.target.closest('[data-hmt-mode]')
      : e.target;
    if (!tab) return;
    const mode = tab.getAttribute
      ? tab.getAttribute('data-hmt-mode')
      : (tab.dataset && tab.dataset.hmtMode);
    if (!mode) return;
    e.preventDefault && e.preventDefault();
    setMode(mode);
  }

  function onTabKeydown(e) {
    const host = getHost();
    if (!host) return;
    const tabs = Array.prototype.slice.call(host.querySelectorAll('[data-hmt-mode]'));
    if (!tabs.length) return;
    const current = tabs.filter((t) => t.getAttribute('aria-selected') === 'true')[0] || tabs[0];
    const idx = tabs.indexOf(current);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault && e.preventDefault();
    const mode = tabs[next].getAttribute('data-hmt-mode');
    setMode(mode);
    if (tabs[next].focus) tabs[next].focus();
  }

  function init() {
    ensureStyles();
    const host = getHost();
    if (!host) {
      initialized = true;
      return false;
    }
    if (!initialized) {
      host.addEventListener('click', onTabClick);
      host.addEventListener('keydown', onTabKeydown);
      initialized = true;
    }
    applyMode(host);
    return true;
  }

  function fillEmptyGrowthPanel() {
    if (typeof document === 'undefined' || !document.getElementById) return false;
    const panel = document.getElementById('muscleGrowthHeatmapCard');
    if (!panel) return false;
    if (panel.querySelector && panel.querySelector('.mh-card')) return false;
    panel.innerHTML = `
      <div class="mh-card mh-card--empty">
        <div class="mh-accent-bar" style="background:linear-gradient(90deg, var(--red) 0%, var(--orange) 35%, var(--muted) 55%, var(--green) 100%)"></div>
        <div class="mh-header">
          <div class="mh-title">🔥 근성장 · 근손실 히트맵</div>
        </div>
        <div class="mh-empty-hint">운동을 기록하면 성장·손실 부위가 여기에 표시돼요.</div>
      </div>`;
    return true;
  }

  function afterHomeRender() {
    ensureStyles();
    fillEmptyGrowthPanel();
    applyMode();
  }

  function destroy() {
    const host = getHost();
    if (host) {
      host.removeEventListener('click', onTabClick);
      host.removeEventListener('keydown', onTabKeydown);
    }
    initialized = false;
    currentMode = DEFAULT_MODE;
  }

  function getConfig() {
    return {
      styleId: STYLE_ID,
      hostId: HOST_ID,
      defaultMode: DEFAULT_MODE,
      modes: MODES.slice(),
      recoveryPanelId: 'muscleHeatmapCard',
      growthPanelId: 'muscleGrowthHeatmapCard',
    };
  }

  return {
    init,
    destroy,
    setMode,
    applyMode,
    afterHomeRender,
    ensureStyles,
    getConfig,
  };
})();

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => HeatmapModeTabs.init());
  } else {
    HeatmapModeTabs.init();
  }
}
