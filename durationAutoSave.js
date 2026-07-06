// ============================================================
// RECOVR - 스톱워치 실행 중 주기적 자동 저장 (독립 모듈)
// 앱 강제 종료 시에도 진행 중인 시간 운동 기록 복구 강화
// ============================================================

const DurationAutoSave = (() => {
  const INTERVAL_MS = 30000;

  let intervalId = null;
  let initialized = false;

  function isModalOpen() {
    if (typeof document === 'undefined') return false;
    return document.getElementById('modalOverlay')?.classList.contains('show');
  }

  function isStopwatchRunning() {
    if (typeof document === 'undefined') return false;
    if (!isModalOpen()) return false;
    return !!document.querySelector('#modalOverlay.show .duration-set-row.is-running');
  }

  function saveProgress() {
    if (typeof saveWorkoutProgress !== 'function') return;
    saveWorkoutProgress(true);
  }

  function tick() {
    if (!isStopwatchRunning()) return;
    saveProgress();
  }

  function onVisibilityHidden() {
    if (!isStopwatchRunning()) return;
    if (typeof flushWorkoutProgress === 'function') {
      flushWorkoutProgress();
    } else {
      saveProgress();
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;

    intervalId = setInterval(tick, INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onVisibilityHidden();
    });
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    initialized = false;
  }

  return {
    init,
    stop,
    tick,
    isStopwatchRunning,
    INTERVAL_MS,
  };
})();
