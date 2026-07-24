// ============================================================
// RECOVR - 운동 수정완료 시에만 백업 파일 재연결·쓰기
// 앱 시작 직후 FS 권한/쓰기를 건드리지 않아 홈 렌더와 충돌하지 않습니다.
// 사용자 제스처(저장하기 / 수정 완료) 안에서만 requestPermission + write.
// ============================================================

const BackupOnComplete = (() => {
  const GUIDE =
    '폴더/파일을 한 번 연결해 두면, 「저장하기 / 수정 완료」할 때만 백업 파일에 저장돼요. 앱 시작 시에는 연결하지 않아요.';

  /**
   * @param {object} deps
   * @param {function(): string} deps.buildJson
   * @param {function(*): void} deps.setRootHandle
   * @param {function(): *} deps.getRootHandle
   * @param {function(): void} [deps.updateStatus]
   * @param {function(): void} [deps.hideBanner]
   * @returns {Promise<{ status: string, wrote: boolean }>}
   */
  async function syncAfterWorkoutSave(deps) {
    if (!deps || typeof deps.buildJson !== 'function') {
      return { status: 'no-deps', wrote: false };
    }
    if (typeof BackupStorage === 'undefined' || typeof BackupWriter === 'undefined') {
      return { status: 'no-module', wrote: false };
    }
    if (!BackupWriter.supportsAutoFileBackup()) {
      return { status: 'unsupported', wrote: false };
    }

    let handle = typeof deps.getRootHandle === 'function' ? deps.getRootHandle() : null;

    try {
      if (!handle) {
        handle = await BackupStorage.loadBackupHandle();
      }
    } catch (err) {
      console.warn('[BackupOnComplete] 핸들 로드 실패:', err);
      return { status: 'load-failed', wrote: false };
    }

    if (!handle) {
      return { status: 'none', wrote: false };
    }

    // 이미 권한이 있으면 바로 쓰기, 없으면 저장 버튼 제스처로 복원
    let permission = 'prompt';
    try {
      if (typeof BackupReconnect !== 'undefined' && BackupReconnect.queryPermission) {
        permission = await BackupReconnect.queryPermission(handle);
      } else if (handle.queryPermission) {
        permission = await handle.queryPermission({ mode: 'readwrite' });
      }
    } catch (_) {
      permission = 'prompt';
    }

    if (permission !== 'granted') {
      if (typeof BackupReconnect !== 'undefined' && BackupReconnect.restoreWithGesture) {
        const result = await BackupReconnect.restoreWithGesture(handle);
        if (result.status !== 'restored') {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('recovr_backup_linked', 'true');
          }
          if (typeof deps.setRootHandle === 'function') deps.setRootHandle(null);
          if (typeof deps.updateStatus === 'function') deps.updateStatus();
          return { status: result.status || 'needs-gesture', wrote: false };
        }
      } else if (handle.requestPermission) {
        try {
          permission = await handle.requestPermission({ mode: 'readwrite' });
        } catch (_) {
          permission = 'prompt';
        }
        if (permission !== 'granted') {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('recovr_backup_linked', 'true');
          }
          if (typeof deps.setRootHandle === 'function') deps.setRootHandle(null);
          if (typeof deps.updateStatus === 'function') deps.updateStatus();
          return { status: 'needs-gesture', wrote: false };
        }
      }
    }

    if (typeof deps.setRootHandle === 'function') deps.setRootHandle(handle);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('recovr_backup_linked', 'true');
    }
    if (typeof deps.hideBanner === 'function') deps.hideBanner();

    const json = deps.buildJson();
    if (!json || json.length < 10) {
      if (typeof deps.updateStatus === 'function') deps.updateStatus();
      return { status: 'empty-payload', wrote: false };
    }

    const writeResult = await BackupWriter.writeToRoot(handle, json);
    if (typeof deps.updateStatus === 'function') deps.updateStatus();

    if (!writeResult.ok) {
      console.warn('[BackupOnComplete] 쓰기 실패:', writeResult.error);
      return { status: 'write-failed', wrote: false };
    }

    return { status: 'written', wrote: true };
  }

  function getSettingsGuide() {
    if (typeof BackupWriter !== 'undefined' && BackupWriter.isSamsungInternet
      && BackupWriter.isSamsungInternet()) {
      return '삼성 인터넷은 자동 파일 백업을 지원하지 않아요. Chrome 브라우저 사용을 권장합니다.';
    }
    if (typeof BackupWriter !== 'undefined' && BackupWriter.prefersDirectoryBackup
      && BackupWriter.prefersDirectoryBackup()) {
      return GUIDE + ' Android Chrome에서는 "내 파일" 앱에 RECOVR 폴더를 만들고 연결하는 것을 권장해요.';
    }
    return GUIDE + ' (Chrome/Edge)';
  }

  return {
    syncAfterWorkoutSave,
    getSettingsGuide,
    GUIDE,
  };
})();
