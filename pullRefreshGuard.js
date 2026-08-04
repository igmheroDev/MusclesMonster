// ============================================================
// RECOVR - 당겨서 새로고침 방지 모듈 (독립)
// 모바일 브라우저의 pull-to-refresh가 운동 중 화면을 리셋하지 않게 합니다.
// ============================================================

const PullRefreshGuard = (() => {
  const STYLE_ID = 'recovr-pull-refresh-guard';
  const CSS_TEXT = [
    'html, body {',
    '  overscroll-behavior-y: none;',
    '  overscroll-behavior: none;',
    '}',
  ].join('\n');

  let initialized = false;
  let listenersAttached = false;
  let touchStartY = 0;

  function getScrollTop() {
    if (typeof document === 'undefined') return 0;
    const el = document.scrollingElement || document.documentElement;
    return el ? (el.scrollTop || 0) : 0;
  }

  function isScrollableOverflow(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    const style = typeof window !== 'undefined' && window.getComputedStyle
      ? window.getComputedStyle(el)
      : null;
    if (!style) return false;
    const oy = style.overflowY;
    if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') return false;
    return el.scrollHeight > el.clientHeight + 1;
  }

  function findScrollableAncestor(target) {
    let node = target;
    while (node && node !== document.body && node !== document.documentElement) {
      if (isScrollableOverflow(node)) return node;
      node = node.parentElement;
    }
    return null;
  }

  function ensureStyles() {
    if (typeof document === 'undefined') return;
    let styleEl = document.getElementById(STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(styleEl);
    }
    if (styleEl.textContent !== CSS_TEXT) {
      styleEl.textContent = CSS_TEXT;
    }
  }

  function onTouchStart(e) {
    if (!e.touches || e.touches.length !== 1) return;
    touchStartY = e.touches[0].clientY;
  }

  function onTouchMove(e) {
    if (!e.touches || e.touches.length !== 1) return;
    // overscroll-behavior 지원 브라우저는 CSS로 충분
    if (typeof CSS !== 'undefined' && CSS.supports
        && CSS.supports('overscroll-behavior-y', 'none')) {
      return;
    }

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY;
    // 아래로 당기는 제스처만 차단 (위로 스크롤은 허용)
    if (deltaY <= 0) return;

    const nested = findScrollableAncestor(e.target);
    if (nested) {
      if (nested.scrollTop > 0) return;
      // 내부 스크롤이 맨 위인데 아래로 당기면 부모로 체인 → 새로고침 유발
      if (typeof e.cancelable !== 'boolean' || e.cancelable) {
        e.preventDefault();
      }
      return;
    }

    if (getScrollTop() <= 0) {
      if (typeof e.cancelable !== 'boolean' || e.cancelable) {
        e.preventDefault();
      }
    }
  }

  function attachListeners() {
    if (listenersAttached || typeof document === 'undefined') return;
    listenersAttached = true;

    document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    // preventDefault가 필요할 수 있어 passive: false
    document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
  }

  function isActive() {
    if (typeof document === 'undefined') return false;
    return !!document.getElementById(STYLE_ID) && listenersAttached;
  }

  function init() {
    if (initialized) return;
    initialized = true;
    ensureStyles();
    attachListeners();
  }

  return {
    init,
    ensureStyles,
    isActive,
    // 테스트용
    _getScrollTop: getScrollTop,
    _findScrollableAncestor: findScrollableAncestor,
    _onTouchStart: onTouchStart,
    _onTouchMove: onTouchMove,
  };
})();
