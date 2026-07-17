// ============================================================
// RECOVR - 화면 꺼짐 방지 모듈 (독립)
// Screen Wake Lock API로 앱 사용 중 화면이 꺼지지 않게 합니다.
// ============================================================

const WakeLock = (() => {
  const SETTINGS_FIELD = 'wakeLock';

  let wakeLockSentinel = null;
  let requestInFlight = false;
  let initialized = false;
  let listenersAttached = false;

  function isSupported() {
    return typeof navigator !== 'undefined'
      && !!navigator.wakeLock
      && typeof navigator.wakeLock.request === 'function';
  }

  function loadConfig() {
    if (typeof loadSettings !== 'function') {
      return { enabled: true };
    }
    const wl = loadSettings().wakeLock || {};
    return {
      enabled: wl.enabled !== false,
    };
  }

  function saveConfig(partial) {
    if (typeof loadSettings !== 'function' || typeof saveSettingsToStorage !== 'function') return;
    const settings = loadSettings();
    const current = settings.wakeLock || {};
    settings.wakeLock = {
      enabled: partial.enabled ?? current.enabled ?? true,
    };
    saveSettingsToStorage(settings);
  }

  function isActive() {
    return !!(wakeLockSentinel && !wakeLockSentinel.released);
  }

  async function release() {
    if (!wakeLockSentinel) return;
    const sentinel = wakeLockSentinel;
    wakeLockSentinel = null;
    try {
      await sentinel.release();
    } catch (err) {
      console.warn('[WakeLock] release 실패:', err && err.name ? err.name : err);
    }
  }

  async function request() {
    if (!isSupported()) return false;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return false;

    const config = loadConfig();
    if (!config.enabled) {
      await release();
      return false;
    }

    if (isActive() || requestInFlight) return isActive();

    requestInFlight = true;
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', () => {
        // 시스템이 잠금을 해제했을 때 (탭 전환 등)
        if (wakeLockSentinel) wakeLockSentinel = null;
        updateStatusUi();
      });
      updateStatusUi();
      return true;
    } catch (err) {
      // NotAllowedError: 배터리 절전 / 권한 / 비보안 컨텍스트 등
      console.warn('[WakeLock] request 실패:', err && err.name ? err.name : err);
      wakeLockSentinel = null;
      updateStatusUi();
      return false;
    } finally {
      requestInFlight = false;
    }
  }

  async function sync() {
    const config = loadConfig();
    if (!config.enabled) {
      await release();
      updateStatusUi();
      return false;
    }
    return request();
  }

  function getStatusHint() {
    if (!isSupported()) {
      return '이 브라우저는 화면 유지(Wake Lock)를 지원하지 않아요';
    }
    const config = loadConfig();
    if (!config.enabled) return '꺼짐 · 설정에서 켤 수 있어요';
    if (isActive()) return '켜짐 · 앱 사용 중 화면이 꺼지지 않아요';
    return '켜짐 · 화면이 보일 때 자동으로 유지해요';
  }

  function updateStatusUi() {
    const el = typeof document !== 'undefined'
      ? document.getElementById('wakeLockStatus')
      : null;
    if (el) el.textContent = getStatusHint();
  }

  function fillForm() {
    const config = loadConfig();
    const enabledEl = document.getElementById('wakeLockEnabled');
    if (enabledEl) enabledEl.checked = config.enabled;
    updateStatusUi();
  }

  function saveFromForm() {
    const enabledEl = document.getElementById('wakeLockEnabled');
    const enabled = enabledEl ? enabledEl.checked : true;
    saveConfig({ enabled });
    fillForm();
    sync();
  }

  function attachListeners() {
    if (listenersAttached || typeof document === 'undefined') return;
    listenersAttached = true;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        sync();
      } else {
        // 브라우저가 자동 release하지만 상태만 정리
        wakeLockSentinel = null;
        updateStatusUi();
      }
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;
    attachListeners();
    fillForm();
    sync();
  }

  return {
    init,
    request,
    release,
    sync,
    isSupported,
    isActive,
    loadConfig,
    saveConfig,
    fillForm,
    saveFromForm,
    getStatusHint,
    updateStatusUi,
  };
})();
