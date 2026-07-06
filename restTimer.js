// ============================================================
// RECOVR - 세트 간 휴식 타이머 모듈 (독립 모듈)
// 세트 완료 시 카운트다운 · 진동 알림 · 설정 연동
// ============================================================

const RestTimer = (() => {
  const DEFAULT_SECONDS = 90;
  const PRESETS = [60, 90, 120, 180];
  const TICK_MS = 200;
  const MIN_SECONDS = 10;
  const MAX_SECONDS = 600;

  let overlayEl = null;
  let timerId = null;
  let endAt = 0;
  let remainingSec = 0;
  let initialized = false;

  function clampSeconds(sec) {
    const n = parseInt(sec, 10);
    if (!Number.isFinite(n)) return DEFAULT_SECONDS;
    return Math.max(MIN_SECONDS, Math.min(MAX_SECONDS, n));
  }

  function loadConfig() {
    if (typeof loadSettings !== 'function') {
      return { enabled: true, seconds: DEFAULT_SECONDS };
    }
    const rt = loadSettings().restTimer || {};
    return {
      enabled: rt.enabled !== false,
      seconds: clampSeconds(rt.seconds ?? DEFAULT_SECONDS),
    };
  }

  function saveConfig(partial) {
    if (typeof loadSettings !== 'function' || typeof saveSettingsToStorage !== 'function') return;
    const settings = loadSettings();
    const current = settings.restTimer || {};
    settings.restTimer = {
      enabled: partial.enabled ?? current.enabled ?? true,
      seconds: clampSeconds(partial.seconds ?? current.seconds ?? DEFAULT_SECONDS),
    };
    saveSettingsToStorage(settings);
  }

  function formatSeconds(totalSec) {
    const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function ensureOverlay() {
    if (overlayEl) return overlayEl;

    const modal = document.querySelector('#modalOverlay .modal');
    if (!modal) return null;

    overlayEl = document.createElement('div');
    overlayEl.id = 'restTimerOverlay';
    overlayEl.className = 'rest-timer-overlay';
    overlayEl.innerHTML = `
      <div class="rest-timer-inner">
        <div class="rest-timer-label">휴식 중</div>
        <div class="rest-timer-display" id="restTimerDisplay">1:30</div>
        <div class="rest-timer-bar"><div class="rest-timer-bar-fill" id="restTimerBarFill"></div></div>
        <div class="rest-timer-actions">
          <button type="button" class="rest-timer-btn" data-action="add30">+30초</button>
          <button type="button" class="rest-timer-btn rest-timer-btn-primary" data-action="skip">건너뛰기</button>
        </div>
      </div>
    `;

    overlayEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      if (btn.dataset.action === 'skip') skip();
      if (btn.dataset.action === 'add30') addSeconds(30);
    });

    modal.appendChild(overlayEl);
    return overlayEl;
  }

  function updateDisplay(totalSec) {
    const display = document.getElementById('restTimerDisplay');
    const barFill = document.getElementById('restTimerBarFill');
    if (!display || !barFill) return;

    display.textContent = formatSeconds(remainingSec);
    const total = Math.max(1, totalSec || remainingSec || 1);
    const pct = Math.max(0, Math.min(100, (remainingSec / total) * 100));
    barFill.style.width = `${pct}%`;
    display.classList.toggle('rest-timer-done-flash', remainingSec <= 0);
  }

  function showOverlay(totalSec) {
    const el = ensureOverlay();
    if (!el) return;
    el.classList.add('visible');
    updateDisplay(totalSec);
  }

  function hideOverlay() {
    if (!overlayEl) return;
    overlayEl.classList.remove('visible');
    const display = document.getElementById('restTimerDisplay');
    if (display) display.classList.remove('rest-timer-done-flash');
  }

  function vibrateDone() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([180, 80, 180]);
    }
  }

  function tick() {
    remainingSec = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    updateDisplay();
    if (remainingSec <= 0) {
      finish();
    }
  }

  function finish() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    vibrateDone();
    setTimeout(() => hideOverlay(), 600);
  }

  function stop() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    endAt = 0;
    remainingSec = 0;
    hideOverlay();
  }

  function skip() {
    stop();
  }

  function addSeconds(extra) {
    if (!timerId) return;
    endAt += extra * 1000;
    tick();
  }

  function start(seconds) {
    const config = loadConfig();
    if (!config.enabled) return;

    const totalSec = clampSeconds(seconds ?? config.seconds);
    if (timerId) clearInterval(timerId);

    remainingSec = totalSec;
    endAt = Date.now() + totalSec * 1000;
    showOverlay(totalSec);
    tick();
    timerId = setInterval(tick, TICK_MS);
  }

  function onSetCompleted() {
    const modal = document.getElementById('modalOverlay');
    if (!modal?.classList.contains('show')) return;
    start();
  }

  function handleModalClick(e) {
    const modal = document.getElementById('modalOverlay');
    if (!modal?.classList.contains('show')) return;

    const check = e.target.closest('.set-check, .duration-check');
    if (check) {
      if (check.classList.contains('checked')) return;
      setTimeout(() => {
        if (check.isConnected && check.classList.contains('checked')) {
          onSetCompleted();
        }
      }, 0);
      return;
    }

    if (e.target.closest('.duration-toggle-btn')) {
      const row = e.target.closest('.duration-set-row');
      const durCheck = row?.querySelector('.duration-check');
      const wasChecked = durCheck?.classList.contains('checked');
      setTimeout(() => {
        if (durCheck?.isConnected && durCheck.classList.contains('checked') && !wasChecked) {
          onSetCompleted();
        }
      }, 50);
    }
  }

  function fillForm() {
    const config = loadConfig();
    const enabledEl = document.getElementById('restTimerEnabled');
    const secondsEl = document.getElementById('restTimerSeconds');
    const settingsWrap = document.getElementById('restTimerSettings');

    if (enabledEl) enabledEl.checked = config.enabled;
    if (secondsEl) secondsEl.value = String(config.seconds);
    if (settingsWrap) settingsWrap.style.display = config.enabled ? '' : 'none';

    document.querySelectorAll('.rest-preset-btn').forEach((btn) => {
      const val = parseInt(btn.dataset.sec, 10);
      btn.classList.toggle('selected', val === config.seconds);
    });
  }

  function saveFromForm() {
    const enabledEl = document.getElementById('restTimerEnabled');
    const secondsEl = document.getElementById('restTimerSeconds');
    saveConfig({
      enabled: enabledEl ? enabledEl.checked : true,
      seconds: secondsEl ? secondsEl.value : DEFAULT_SECONDS,
    });
    fillForm();
  }

  function selectPreset(seconds) {
    const sec = clampSeconds(seconds);
    saveConfig({ seconds: sec });
    const secondsEl = document.getElementById('restTimerSeconds');
    if (secondsEl) secondsEl.value = String(sec);
    fillForm();
  }

  function onModalClose() {
    stop();
  }

  function init() {
    if (initialized) return;
    initialized = true;

    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', handleModalClick, true);
    }

    fillForm();
  }

  return {
    init,
    start,
    stop,
    skip,
    addSeconds,
    onSetCompleted,
    onModalClose,
    fillForm,
    saveFromForm,
    selectPreset,
    loadConfig,
    formatSeconds,
    PRESETS,
    DEFAULT_SECONDS,
  };
})();
