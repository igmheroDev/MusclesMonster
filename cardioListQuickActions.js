// ============================================================
// RECOVR - 통계 유산소 카드 탭 인터랙션 연결 (독립 모듈)
//
// 통계 탭의 다음 두 카드도 정보만 보여줄 뿐 탭해도 반응이 없었다.
//  - "이번 주 유산소 기구별" (#cardioMachineList) — 기구별 이번 주 합계 분
//  - "유산소 세부 지표" (#cardioMetricsStats) — 주간 거리·칼로리·평균 심박
//
// 이 모듈은 위 카드를 렌더하는 cardioTracker.js(renderMachineBreakdown)와
// cardioMetrics.js(renderStatsCard)의 코드를 전혀 수정하지 않는다. 두 모듈이
// 이미 공개한 읽기 전용 API(isCardioExercise/getExerciseMinutes/getWeeklyStats/
// formatMinutes, normalizeMetrics/hasAny/formatSummary)만 매니저 참조로 재사용해서
// 탭하면 열리는 상세 시트를 새로 추가한다.
//   - 기구별 카드(행) 탭        → 그 기구의 최근 세션 목록(날짜·시간·세부지표)
//   - 유산소 세부 지표 카드 탭 → 이번 주 세부 지표를 입력한 세션 목록
//
// 시트 UI는 exerciseStimHeatmap.js가 이미 정의해 둔 .esh-overlay/.esh-sheet류
// CSS를 그대로 재사용한다(신규 CSS 클래스를 index.html에 추가하지 않음).
// ============================================================

const CardioListQuickActions = (() => {
  const STYLE_ID = 'cardio-list-quick-actions-styles';
  const ENHANCE_ATTR = 'data-clqa-ready';
  const OVERLAY_ID = 'cqaOverlay';

  const registry = {};

  function getTracker() {
    return (typeof CardioTracker !== 'undefined') ? CardioTracker : null;
  }

  function getMetrics() {
    return (typeof CardioMetrics !== 'undefined') ? CardioMetrics : null;
  }

  function loadWorkoutsSafe() {
    try {
      if (typeof getCompletedWorkouts === 'function') return getCompletedWorkouts();
      if (typeof loadWorkouts === 'function') return loadWorkouts();
    } catch (e) { /* ignore */ }
    return [];
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function isActivateKey(e) {
    return !!e && (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar');
  }

  function compareDateDesc(a, b) {
    if (a === b) return 0;
    return a < b ? 1 : -1;
  }

  function ensureStyles() {
    if (typeof document === 'undefined') return false;
    if (document.getElementById(STYLE_ID)) return true;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #cardioMachineList .muscle-card > div,
      #cardioMetricsStats .stats-grid .stat-card {
        cursor: pointer;
        transition: transform 0.12s ease, opacity 0.12s ease;
      }
      #cardioMachineList .muscle-card > div:active,
      #cardioMetricsStats .stats-grid .stat-card:active {
        transform: scale(0.97);
        opacity: 0.82;
      }
      #cardioMachineList .muscle-card > div:focus-visible,
      #cardioMetricsStats .stats-grid .stat-card:focus-visible {
        outline: 2px solid var(--text);
        outline-offset: 2px;
        border-radius: 8px;
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

  // ------------------------------------------------------------
  // 시트 오픈/닫기 (exerciseStimHeatmap.js의 esh-overlay/esh-sheet 재사용)
  // ------------------------------------------------------------
  function open(html) {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.innerHTML = html;
    overlay.classList.add('show');
  }

  function close() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.classList.remove('show');
    overlay.innerHTML = '';
  }

  function closeOnOverlay(e) {
    if (e && e.target && e.target.id === OVERLAY_ID) close();
  }

  function buildSheetShell({ kicker, title, hint, bodyHtml }) {
    return `
      <div class="esh-sheet esh-sheet--list" onclick="event.stopPropagation()">
        <div class="esh-sheet-header">
          <div>
            <div class="esh-sheet-kicker">${escapeHtml(kicker)}</div>
            <div class="esh-sheet-title">${escapeHtml(title)}</div>
          </div>
          <button type="button" class="esh-sheet-close" onclick="CardioListQuickActions.close()">닫기</button>
        </div>
        <div class="esh-list-hint">${escapeHtml(hint)}</div>
        <div class="muscle-card" style="padding:14px 15px">${bodyHtml}</div>
      </div>`;
  }

  function buildRowHtml(leftText, rightText) {
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:12.5px">${escapeHtml(leftText)}</span>
        <span style="font-size:12px;font-weight:700;color:var(--cardio)">${escapeHtml(rightText)}</span>
      </div>`;
  }

  function formatDateLabel(dateStr) {
    const d = new Date(`${dateStr}T12:00:00`);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  // ------------------------------------------------------------
  // "이번 주 유산소 기구별" (#cardioMachineList)
  // 기구(행)를 탭하면 그 기구의 최근 세션 목록을 보여준다.
  // ------------------------------------------------------------
  function enhanceMachineListRows() {
    const container = document.getElementById('cardioMachineList');
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll('.muscle-card').forEach((wrap) => {
      Array.prototype.forEach.call(wrap.children || [], (row) => {
        const firstSpan = row.children && row.children[0];
        const label = firstSpan ? normalizeText(firstSpan.textContent) : '';
        enhanceA11y(row, label ? `${label} 최근 세션 보기` : undefined);
      });
    });
  }

  function findRowInWrap(container, target) {
    const wrap = container.querySelector && container.querySelector('.muscle-card');
    if (!wrap) return null;
    let node = target;
    while (node && node !== container) {
      if (node.parentNode === wrap) return node;
      node = node.parentNode;
    }
    return null;
  }

  // 행 텍스트("🪜 천국의 계단")에서 아이콘 토큰만 떼어 운동명("천국의 계단")을 얻는다.
  // renderMachineBreakdown이 항상 `${icon} ${name}` 형태로만 렌더하므로 안전하게 매칭된다.
  function extractExerciseName(fullLabel) {
    return normalizeText(String(fullLabel || '').replace(/^\S+\s*/, ''));
  }

  function buildMachineSheetHtml(name, fullLabel) {
    const tracker = getTracker();
    const metricsMod = getMetrics();
    const workouts = loadWorkoutsSafe();

    const sessions = [];
    workouts.forEach((w) => {
      (w.exercises || []).forEach((ex) => {
        if (!ex || ex.name !== name) return;
        if (tracker && !tracker.isCardioExercise(ex)) return;
        const minutes = tracker ? tracker.getExerciseMinutes(ex) : 0;
        if (minutes <= 0) return;
        const metricsSummary = metricsMod ? metricsMod.formatSummary(ex) : '';
        sessions.push({ date: w.date, minutes, metricsSummary });
      });
    });
    sessions.sort((a, b) => compareDateDesc(a.date, b.date));
    const top = sessions.slice(0, 10);

    const weekly = tracker ? tracker.getWeeklyStats(workouts) : null;
    const weeklyMinutes = weekly && weekly.byMachine ? weekly.byMachine[name] : null;
    const weeklyText = weeklyMinutes
      ? `이번 주 합계 ${tracker.formatMinutes(weeklyMinutes)} · `
      : '';

    const bodyHtml = top.length
      ? top.map((s) => {
        const minutesLabel = tracker ? tracker.formatMinutes(s.minutes) : `${s.minutes}분`;
        const right = s.metricsSummary ? `${minutesLabel} · ${s.metricsSummary}` : minutesLabel;
        return buildRowHtml(formatDateLabel(s.date), right);
      }).join('')
      : `<div class="esh-empty">최근 기록이 없어요</div>`;

    return buildSheetShell({
      kicker: '유산소 · 최근 세션',
      title: fullLabel,
      hint: `${weeklyText}최근 기록순으로 보여줘요.`,
      bodyHtml,
    });
  }

  function activateMachineRow(row) {
    const firstSpan = row.children && row.children[0];
    const fullLabel = firstSpan ? normalizeText(firstSpan.textContent) : '';
    const name = extractExerciseName(fullLabel);
    if (!name) return;
    open(buildMachineSheetHtml(name, fullLabel));
  }

  function onMachineListClick(e) {
    const container = document.getElementById('cardioMachineList');
    if (!container) return;
    const row = findRowInWrap(container, e.target);
    if (!row) return;
    activateMachineRow(row);
  }

  function onMachineListKeydown(e) {
    if (!isActivateKey(e)) return;
    const container = document.getElementById('cardioMachineList');
    if (!container) return;
    const row = findRowInWrap(container, e.target);
    if (!row) return;
    e.preventDefault && e.preventDefault();
    activateMachineRow(row);
  }

  // ------------------------------------------------------------
  // "유산소 세부 지표" (#cardioMetricsStats)
  // 3개 타일(거리/칼로리/심박) 중 아무거나 탭하면, 이번 주 세부 지표를
  // 입력한 세션들을 날짜순으로 모아 보여준다(집계 숫자가 어떤 기록들로
  // 이루어졌는지 근거를 확인할 수 있게).
  // ------------------------------------------------------------
  function hasRealData(container) {
    // 데이터 없을 때는 .stats-grid 없이 안내 문구 카드 1개만 렌더되므로,
    // .stats-grid 존재 여부로 실제 데이터 상태를 구분한다.
    return !!(container && container.querySelector && container.querySelector('.stats-grid'));
  }

  function enhanceMetricsStatCards() {
    const container = document.getElementById('cardioMetricsStats');
    if (!container || !hasRealData(container)) return;
    container.querySelectorAll('.stat-card').forEach((card) => {
      enhanceA11y(card, '이번 주 유산소 세부 지표를 세션별로 보기');
    });
  }

  const METRICS_WINDOW_DAYS = 7; // CardioMetrics.renderStatsCard()와 동일한 주간 집계 기준

  function buildMetricsSheetHtml() {
    const metricsMod = getMetrics();
    const tracker = getTracker();
    const workouts = loadWorkoutsSafe();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - METRICS_WINDOW_DAYS);
    cutoff.setHours(0, 0, 0, 0);

    // CardioMetrics.getCardioExercises()는 내부 전용(비공개) 함수라 재사용하지 않고,
    // 이미 공개된 CardioTracker.isCardioExercise() + CardioMetrics.normalizeMetrics/hasAny/
    // formatSummary()만으로 동일한 "세부 지표가 있는 유산소 세션" 목록을 직접 구성한다.
    const sessions = [];
    workouts.forEach((w) => {
      if (!w.date || new Date(`${w.date}T12:00:00`) < cutoff) return;
      (w.exercises || []).forEach((ex) => {
        if (!ex) return;
        const isCardio = tracker
          ? tracker.isCardioExercise(ex)
          : (w.type === 'cardio' && ex.mode === 'duration');
        if (!isCardio) return;
        if (!metricsMod || !metricsMod.hasAny(metricsMod.normalizeMetrics(ex))) return;
        sessions.push({ date: w.date, name: ex.name, summary: metricsMod.formatSummary(ex) });
      });
    });
    sessions.sort((a, b) => compareDateDesc(a.date, b.date));

    const bodyHtml = sessions.length
      ? sessions.map((s) => buildRowHtml(`${formatDateLabel(s.date)} · ${s.name}`, s.summary)).join('')
      : `<div class="esh-empty">이번 주 세부 지표 기록이 없어요</div>`;

    return buildSheetShell({
      kicker: '유산소 · 세부 지표',
      title: '🏃 이번 주 세션별 기록',
      hint: '거리·칼로리·심박을 입력한 세션만 표시돼요.',
      bodyHtml,
    });
  }

  function onMetricsStatsClick(e) {
    const container = document.getElementById('cardioMetricsStats');
    if (!container || !hasRealData(container)) return;
    const card = e.target && e.target.closest ? e.target.closest('.stat-card') : null;
    if (!card) return;
    open(buildMetricsSheetHtml());
  }

  function onMetricsStatsKeydown(e) {
    if (!isActivateKey(e)) return;
    const container = document.getElementById('cardioMetricsStats');
    if (!container || !hasRealData(container)) return;
    const card = e.target && e.target.closest ? e.target.closest('.stat-card') : null;
    if (!card) return;
    e.preventDefault && e.preventDefault();
    open(buildMetricsSheetHtml());
  }

  // ------------------------------------------------------------
  // 컨테이너별 훅 (listQuickActions.js와 동일한 관례: 컨테이너당 위임 1회 등록,
  // MutationObserver로 재렌더 시 a11y 속성 재적용)
  // ------------------------------------------------------------
  function hookContainer(id, enhanceFn, onClick, onKeydown) {
    const container = document.getElementById(id);
    if (!container) return false;

    registry[id] = registry[id] || { hooked: false, observer: null };
    enhanceFn();

    if (registry[id].hooked) return true;
    registry[id].hooked = true;

    container.addEventListener('click', onClick);
    container.addEventListener('keydown', onKeydown);

    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => enhanceFn());
      observer.observe(container, { childList: true, subtree: true });
      registry[id].observer = observer;
    }
    return true;
  }

  function init() {
    ensureStyles();
    hookContainer('cardioMachineList', enhanceMachineListRows, onMachineListClick, onMachineListKeydown);
    hookContainer('cardioMetricsStats', enhanceMetricsStatCards, onMetricsStatsClick, onMetricsStatsKeydown);
  }

  return {
    init,
    ensureStyles,
    open,
    close,
    closeOnOverlay,
    buildMachineSheetHtml,
    buildMetricsSheetHtml,
    extractExerciseName,
  };
})();

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CardioListQuickActions.init());
  } else {
    CardioListQuickActions.init();
  }
}
