// ============================================================
// RECOVR - 백업 파일 권한 재연결 모듈 (독립)
// IndexedDB에 저장된 FileSystemHandle의 권한을 복원합니다.
// 브라우저 보안상 새로고침 후 권한이 'prompt'가 되면
// 사용자 제스처(탭)에서 requestPermission만으로 복원합니다.
// (파일/폴더를 다시 고를 필요 없음)
// ============================================================

const BackupReconnect = (() => {
  const BANNER_ID = 'backupReconnectBanner';
  const STYLE_ID = 'backup-reconnect-styles';
  const PERM_OPTS = { mode: 'readwrite' };

  let pendingHandle = null;
  let onResultCb = null;
  let busy = false;

  function ensureStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BANNER_ID} {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 9998;
        max-width: 480px;
        margin: 0 auto;
        padding: 10px 14px;
        box-sizing: border-box;
        background: linear-gradient(135deg, rgba(255, 176, 32, 0.95), rgba(0, 212, 255, 0.88));
        border-bottom: 1px solid rgba(255, 176, 32, 0.45);
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        color: #1a1a22;
        font-family: inherit;
      }
      #${BANNER_ID}.visible { display: flex; }
      #${BANNER_ID} .backup-reconnect-text {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.45;
        flex: 1;
        min-width: 0;
      }
      #${BANNER_ID} .backup-reconnect-icon { font-size: 15px; flex-shrink: 0; }
      #${BANNER_ID} .backup-reconnect-actions { display: flex; gap: 6px; flex-shrink: 0; }
      #${BANNER_ID} .backup-reconnect-btn {
        padding: 7px 11px;
        border-radius: 8px;
        border: 1px solid rgba(0,0,0,0.12);
        background: rgba(255,255,255,0.85);
        color: #333;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      #${BANNER_ID} .backup-reconnect-btn.primary {
        background: #1a1a22;
        border-color: transparent;
        color: #fff;
      }
      body.backup-reconnect-open {
        padding-top: 64px;
      }
    `;
    document.head.appendChild(style);
  }

  async function queryPermission(handle) {
    if (!handle || typeof handle.queryPermission !== 'function') return 'prompt';
    try {
      return await handle.queryPermission(PERM_OPTS);
    } catch (_) {
      return 'prompt';
    }
  }

  async function requestPermission(handle) {
    if (!handle || typeof handle.requestPermission !== 'function') return 'prompt';
    try {
      return await handle.requestPermission(PERM_OPTS);
    } catch (err) {
      console.warn('[BackupReconnect] requestPermission 실패:', err && err.name ? err.name : err);
      return 'prompt';
    }
  }

  /**
   * @returns {{ status: 'none'|'restored'|'needs-gesture'|'denied', handle: *, permission: string|null }}
   */
  async function evaluate(handle) {
    if (!handle) return { status: 'none', handle: null, permission: null };
    const permission = await queryPermission(handle);
    if (permission === 'granted') return { status: 'restored', handle, permission };
    if (permission === 'denied') return { status: 'denied', handle, permission };
    return { status: 'needs-gesture', handle, permission };
  }

  async function restoreWithGesture(handle) {
    const target = handle || pendingHandle;
    if (!target) return { status: 'none', handle: null, permission: null };

    const permission = await requestPermission(target);
    if (permission === 'granted') {
      pendingHandle = null;
      hideBanner();
      return { status: 'restored', handle: target, permission };
    }
    if (permission === 'denied') {
      return { status: 'denied', handle: target, permission };
    }
    return { status: 'needs-gesture', handle: target, permission };
  }

  function ensureBanner() {
    ensureStyles();
    let el = document.getElementById(BANNER_ID);
    if (el) return el;

    el = document.createElement('div');
    el.id = BANNER_ID;
    el.className = 'backup-reconnect-banner';
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <div class="backup-reconnect-text">
        <span class="backup-reconnect-icon">📁</span>
        <span>백업 권한이 풀렸어요. 파일 재선택 없이 복원 가능</span>
      </div>
      <div class="backup-reconnect-actions">
        <button type="button" class="backup-reconnect-btn primary" data-action="restore">다시 연결</button>
        <button type="button" class="backup-reconnect-btn" data-action="dismiss">닫기</button>
      </div>`;

    el.querySelector('[data-action="restore"]').addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (busy) return;
      busy = true;
      const btn = ev.currentTarget;
      const prev = btn.textContent;
      btn.textContent = '연결 중…';
      try {
        const result = await restoreWithGesture(pendingHandle);
        if (typeof onResultCb === 'function') await onResultCb(result);
      } finally {
        btn.textContent = prev;
        busy = false;
      }
    });

    el.querySelector('[data-action="dismiss"]').addEventListener('click', (ev) => {
      ev.preventDefault();
      hideBanner();
    });

    document.body.appendChild(el);
    return el;
  }

  function showBanner(handle, onResult) {
    if (!handle || typeof document === 'undefined') return;
    pendingHandle = handle;
    onResultCb = onResult || null;
    const el = ensureBanner();
    el.classList.add('visible');
    document.body.classList.add('backup-reconnect-open');
  }

  function hideBanner() {
    const el = typeof document !== 'undefined'
      ? document.getElementById(BANNER_ID)
      : null;
    if (el) el.classList.remove('visible');
    if (typeof document !== 'undefined') {
      document.body.classList.remove('backup-reconnect-open');
    }
  }

  function getPersistGuide(isPwa) {
    if (isPwa) {
      return '앱으로 실행 중이면 파일 권한이 유지되는 경우가 많아요. 끊기면 상단 "다시 연결"만 탭하세요 (파일 재선택 불필요).';
    }
    return '브라우저 보안상 새로고침 후 권한이 풀릴 수 있어요. 홈 화면 앱 설치, 또는 권한 팝업에서 "매번 허용"을 선택하면 유지됩니다. 끊겨도 파일 재선택 없이 한 번 탭으로 복원돼요.';
  }

  function getPendingHandle() {
    return pendingHandle;
  }

  function hasPending() {
    return !!pendingHandle;
  }

  return {
    evaluate,
    restoreWithGesture,
    showBanner,
    hideBanner,
    getPersistGuide,
    getPendingHandle,
    hasPending,
    queryPermission,
    requestPermission,
    ensureStyles,
  };
})();
