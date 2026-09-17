// ============================================================
// RECOVR - 하단 탭 활성 컬러 모듈 (독립 모듈)
//
// 홈/기록/통계/설정 중 어느 탭에 있는지 한눈에 보이게 한다.
// 기존 switchView()가 붙이는 .nav-item.active 클래스를 그대로 사용하고,
// app.js / 기존 nav CSS / 뷰 전환 로직은 수정하지 않는다.
//
// 이모지는 CSS color를 받지 않아 기존 `color: var(--green)` 만으로는
// 10px 라벨 차이밖에 없다. 배경 필 + 상단 바 + 탭별 액센트 색으로
// 현재 탭을 명확히 표시한다.
// ============================================================

const NavTabHighlight = (() => {
  const STYLE_ID = 'nav-tab-highlight-styles';
  const ITEM_SELECTOR = '.nav-item[data-view]';

  const TAB_ACCENTS = {
    home: 'green',
    log: 'cyan',
    stats: 'violet',
    settings: 'orange',
  };

  let initialized = false;
  let observer = null;

  function ensureStyles() {
    if (typeof document === 'undefined') return false;
    if (document.getElementById(STYLE_ID)) return true;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      nav .nav-item[data-view] {
        position: relative;
        isolation: isolate;
        z-index: 0;
        transition: color 0.15s ease;
      }
      nav .nav-item[data-view]::before {
        content: '';
        position: absolute;
        top: 0;
        left: 50%;
        width: 0;
        height: 3px;
        border-radius: 0 0 3px 3px;
        background: var(--nth-accent, var(--green));
        transform: translateX(-50%);
        transition: width 0.18s ease;
        pointer-events: none;
        z-index: 1;
      }
      nav .nav-item[data-view]::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 2px;
        bottom: 2px;
        width: 64px;
        max-width: calc(100% - 4px);
        transform: translateX(-50%);
        border-radius: 14px;
        background: transparent;
        pointer-events: none;
        z-index: -1;
        transition: background 0.15s ease;
      }
      nav .nav-item[data-view="home"] {
        --nth-accent: var(--green);
        --nth-fill: rgba(0, 255, 157, 0.22);
      }
      nav .nav-item[data-view="log"] {
        --nth-accent: var(--cyan);
        --nth-fill: rgba(0, 229, 255, 0.22);
      }
      nav .nav-item[data-view="stats"] {
        --nth-accent: var(--violet);
        --nth-fill: rgba(167, 139, 250, 0.22);
      }
      nav .nav-item[data-view="settings"] {
        --nth-accent: var(--orange);
        --nth-fill: rgba(255, 107, 53, 0.22);
      }
      nav .nav-item[data-view].active {
        color: var(--nth-accent);
        font-weight: 800;
      }
      nav .nav-item[data-view].active::before {
        width: 28px;
      }
      nav .nav-item[data-view].active::after {
        background: var(--nth-fill);
      }
      nav .nav-item[data-view].active .ni-icon {
        transform: translateY(-1px) scale(1.08);
      }
      body.light nav .nav-item[data-view="home"] { --nth-fill: rgba(0, 165, 113, 0.20); }
      body.light nav .nav-item[data-view="log"] { --nth-fill: rgba(0, 145, 168, 0.20); }
      body.light nav .nav-item[data-view="stats"] { --nth-fill: rgba(139, 108, 214, 0.20); }
      body.light nav .nav-item[data-view="settings"] { --nth-fill: rgba(230, 87, 31, 0.20); }
    `;
    const head = document.head || document.documentElement;
    head.appendChild(style);
    return true;
  }

  function isActiveItem(item) {
    if (!item) return false;
    if (item.classList && typeof item.classList.contains === 'function') {
      return item.classList.contains('active');
    }
    const cls = item.className || '';
    return (' ' + cls + ' ').indexOf(' active ') !== -1;
  }

  function syncAriaCurrent(root) {
    const scope = root && root.querySelectorAll ? root : (typeof document !== 'undefined' ? document : null);
    if (!scope) return 0;

    const items = scope.querySelectorAll(ITEM_SELECTOR);
    let activeCount = 0;
    items.forEach((item) => {
      const active = isActiveItem(item);
      if (active) {
        item.setAttribute('aria-current', 'page');
        activeCount += 1;
      } else if (item.removeAttribute) {
        item.removeAttribute('aria-current');
      } else if (item.setAttribute) {
        item.setAttribute('aria-current', '');
      }
    });
    return activeCount;
  }

  function observeNav() {
    if (typeof document === 'undefined') return;
    if (typeof MutationObserver === 'undefined') return;
    const nav = document.querySelector('nav');
    if (!nav) return;

    if (observer) observer.disconnect();
    observer = new MutationObserver(() => syncAriaCurrent(nav));
    observer.observe(nav, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
    });
  }

  function init() {
    if (initialized) {
      ensureStyles();
      syncAriaCurrent();
      return false;
    }
    ensureStyles();
    syncAriaCurrent();
    observeNav();
    initialized = true;
    return true;
  }

  function destroy() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    initialized = false;
  }

  function getConfig() {
    return {
      styleId: STYLE_ID,
      itemSelector: ITEM_SELECTOR,
      tabAccents: Object.assign({}, TAB_ACCENTS),
    };
  }

  return {
    init,
    destroy,
    ensureStyles,
    syncAriaCurrent,
    getConfig,
  };
})();

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => NavTabHighlight.init());
  } else {
    NavTabHighlight.init();
  }
}
