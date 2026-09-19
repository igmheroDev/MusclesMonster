// ============================================================
// RECOVR - 통계 추세 막대그래프 탭 → 그날 상세로 이동 (독립 모듈)
//
// 통계 탭의 다음 두 막대그래프도 정보만 보여줄 뿐 탭해도 반응이 없었다.
//  - "최근 추세" (#trendChart) — 최근 8세션 볼륨 그래프
//  - "유산소 추세" (#cardioTrendChart) — 최근 8세션 유산소 시간 그래프
//
// 이 모듈은 위 그래프를 렌더하는 app.js(renderTrendChart)와
// cardioTracker.js(renderTrendChart/getCardioTrend)의 코드를 전혀
// 수정하지 않는다. 두 곳이 실제로 사용하는 것과 동일한 정렬/자르기
// 규칙(getCompletedWorkouts 오름차순 정렬 후 최근 8개, 유산소는
// CardioTracker.isCardioWorkout 필터 추가)을 공개 함수만으로 그대로
// 재현해 "몇 번째 막대가 어떤 workout인지"를 찾아낸다.
//
// 탭하면 기록(Log) 탭의 "목록" 뷰로 이동해 해당 날짜의 카드를 펼치고
// 화면에 스크롤한다. 목록은 이미 완성된 LogList 모듈(공개 API:
// sortWithIndex/getVisibleCount/loadMore/toggleDetail)만 재사용한다.
// ============================================================

const TrendChartQuickActions = (() => {
  const STYLE_ID = 'trend-chart-quick-actions-styles';
  const ENHANCE_ATTR = 'data-tcqa-ready';
  const HIGHLIGHT_CLASS = 'tcqa-highlight';
  const MAX_LOAD_MORE_ATTEMPTS = 200;

  const registry = {};

  function loadWorkoutsSafe() {
    try {
      if (typeof loadWorkouts === 'function') return loadWorkouts();
    } catch (e) { /* ignore */ }
    return [];
  }

  function completedWorkoutsSafe() {
    try {
      if (typeof getCompletedWorkouts === 'function') return getCompletedWorkouts();
    } catch (e) { /* ignore */ }
    return [];
  }

  function isActivateKey(e) {
    return !!e && (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar');
  }

  function formatDateLabel(dateStr) {
    const d = new Date(`${dateStr}T12:00:00`);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  // app.js renderTrendChart() / cardioTracker.js getCardioTrend()과 동일한
  // "오름차순 정렬 후 최근 8개" 규칙을 그대로 재현한다(참조는 완전히 재사용,
  // sort/slice는 원본 배열 요소를 복제하지 않으므로 완료 기록(getCompletedWorkouts)의
  // 요소 참조가 그대로 유지된다 — 이후 completedIndexToRawIndex에서 이 성질을 이용).
  function buildSortedForContainer(id, completed) {
    if (id === 'cardioTrendChart') {
      const isCardio = (typeof CardioTracker !== 'undefined' && typeof CardioTracker.isCardioWorkout === 'function')
        ? CardioTracker.isCardioWorkout
        : () => false;
      return [...completed]
        .filter((w) => isCardio(w))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-8);
    }
    return [...completed]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-8);
  }

  // getCompletedWorkouts()의 k번째 원소가 loadWorkouts()(진행중 포함 원본 배열)의
  // 몇 번째 인덱스였는지 위치 기반으로 되짚는다(둘 다 같은 순간에 호출되는
  // localStorage 스냅샷 기준이라 개수/순서가 항상 일치함 — getCompletedWorkouts는
  // loadWorkouts().filter(w => !w.inProgress)라 상대 순서를 그대로 보존한다).
  function completedIndexToRawIndex(completedIdx) {
    if (completedIdx < 0) return -1;
    const raw = loadWorkoutsSafe();
    let count = 0;
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] && raw[i].inProgress) continue;
      if (count === completedIdx) return i;
      count++;
    }
    return -1;
  }

  function getWrap(container) {
    return container && container.children ? container.children[0] : null;
  }

  function ensureStyles() {
    if (typeof document === 'undefined') return false;
    if (document.getElementById(STYLE_ID)) return true;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #trendChart > div > div,
      #cardioTrendChart > div > div {
        cursor: pointer;
        border-radius: 6px;
        transition: transform 0.12s ease, opacity 0.12s ease;
      }
      #trendChart > div > div:active,
      #cardioTrendChart > div > div:active {
        transform: scale(0.94);
        opacity: 0.8;
      }
      #trendChart > div > div:focus-visible,
      #cardioTrendChart > div > div:focus-visible {
        outline: 2px solid var(--text);
        outline-offset: 2px;
      }
      @keyframes tcqaFlash {
        0%, 100% { box-shadow: none; }
        15%, 85% { box-shadow: 0 0 0 3px var(--cyan); }
      }
      .${HIGHLIGHT_CLASS} {
        animation: tcqaFlash 1.5s ease;
        border-radius: 14px;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
    return true;
  }

  function enhanceA11y(el, ariaLabel) {
    if (!el || !el.setAttribute || el.getAttribute(ENHANCE_ATTR) === '1') return;
    el.setAttribute(ENHANCE_ATTR, '1');
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    if (ariaLabel) el.setAttribute('aria-label', ariaLabel);
  }

  function enhanceBars(id) {
    const container = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (!container) return;
    const wrap = getWrap(container);
    if (!wrap || !wrap.children) return;

    const sorted = buildSortedForContainer(id, completedWorkoutsSafe());
    Array.prototype.forEach.call(wrap.children, (bar, i) => {
      const w = sorted[i];
      const label = w && w.date ? `${formatDateLabel(w.date)} 기록 상세 보기` : '기록 상세 보기';
      enhanceA11y(bar, label);
    });
  }

  function findBar(container, target) {
    const wrap = getWrap(container);
    if (!wrap) return null;
    let node = target;
    while (node && node !== container) {
      if (node.parentNode === wrap) return node;
      node = node.parentNode;
    }
    return null;
  }

  function flashHighlight(el) {
    if (!el || !el.classList) return;
    el.classList.add(HIGHLIGHT_CLASS);
    if (typeof setTimeout === 'function') {
      setTimeout(() => el.classList.remove(HIGHLIGHT_CLASS), 1600);
    }
  }

  // Log 탭 "목록" 뷰에서 realIdx(loadWorkouts() 기준 원본 인덱스)에 해당하는
  // 카드가 보이도록 필요한 만큼 더보기를 누르고, 펼친 뒤 스크롤한다.
  function revealAndOpen(realIdx) {
    if (typeof switchView === 'function') switchView('log');
    if (typeof setLogTab === 'function') setLogTab('list');

    if (typeof LogList === 'undefined' || typeof LogList.sortWithIndex !== 'function') return;

    const rawList = loadWorkoutsSafe();
    const sorted = LogList.sortWithIndex(rawList);
    const pos = sorted.findIndex((entry) => entry.idx === realIdx);
    if (pos < 0) return;

    let guard = 0;
    while (LogList.getVisibleCount() <= pos && guard < MAX_LOAD_MORE_ATTEMPTS) {
      const before = LogList.getVisibleCount();
      LogList.loadMore();
      if (LogList.getVisibleCount() <= before) break;
      guard++;
    }

    const itemId = `wi-${realIdx}`;
    const panelId = `wp-${realIdx}`;
    const item = typeof document !== 'undefined' ? document.getElementById(itemId) : null;
    if (!item) return;

    LogList.toggleDetail(panelId, itemId);
    flashHighlight(item);
    if (item.scrollIntoView) item.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function activateBar(id, bar) {
    const container = typeof document !== 'undefined' ? document.getElementById(id) : null;
    const wrap = getWrap(container);
    if (!wrap || !wrap.children) return;

    const barIdx = Array.prototype.indexOf.call(wrap.children, bar);
    if (barIdx < 0) return;

    const completed = completedWorkoutsSafe();
    const sorted = buildSortedForContainer(id, completed);
    const workoutObj = sorted[barIdx];
    if (!workoutObj) return;

    const completedIdx = completed.indexOf(workoutObj);
    const realIdx = completedIndexToRawIndex(completedIdx);
    if (realIdx < 0) return;

    revealAndOpen(realIdx);
  }

  function onClick(id) {
    return (e) => {
      const container = typeof document !== 'undefined' ? document.getElementById(id) : null;
      if (!container) return;
      const bar = findBar(container, e.target);
      if (!bar) return;
      activateBar(id, bar);
    };
  }

  function onKeydown(id) {
    return (e) => {
      if (!isActivateKey(e)) return;
      const container = typeof document !== 'undefined' ? document.getElementById(id) : null;
      if (!container) return;
      const bar = findBar(container, e.target);
      if (!bar) return;
      e.preventDefault && e.preventDefault();
      activateBar(id, bar);
    };
  }

  function hookContainer(id) {
    const container = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (!container) return false;

    registry[id] = registry[id] || { hooked: false, observer: null };
    enhanceBars(id);

    if (registry[id].hooked) return true;
    registry[id].hooked = true;

    container.addEventListener('click', onClick(id));
    container.addEventListener('keydown', onKeydown(id));

    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => enhanceBars(id));
      observer.observe(container, { childList: true, subtree: true });
      registry[id].observer = observer;
    }
    return true;
  }

  function init() {
    ensureStyles();
    hookContainer('trendChart');
    hookContainer('cardioTrendChart');
  }

  return {
    init,
    ensureStyles,
    buildSortedForContainer,
    completedIndexToRawIndex,
    activateBar,
    revealAndOpen,
  };
})();

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => TrendChartQuickActions.init());
  } else {
    TrendChartQuickActions.init();
  }
}
