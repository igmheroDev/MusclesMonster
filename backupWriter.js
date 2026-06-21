// ============================================================
// RECOVR - 백업 파일 쓰기 모듈 (독립)
// File System Access API 환경별 쓰기 전략과 에러 메시지를 담당합니다.
// ============================================================

const BACKUP_FILE_NAME = 'recovr_backup.json';

const BackupWriter = (() => {
  function isAndroid() {
    return /android/i.test(navigator.userAgent);
  }

  function isRunningAsPwa() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }

  // Android PWA/모바일에서 단일 파일 쓰기가 불안정한 환경
  function prefersDirectoryBackup() {
    return isAndroid() && 'showDirectoryPicker' in window;
  }

  function shouldSkipPreRead() {
    return isAndroid();
  }

  function describeError(err) {
    if (!err) return '알 수 없는 오류가 발생했어요.';

    if (err.name === 'NoModificationAllowedError') {
      return '선택한 위치에 쓰기 권한이 없어요.\n\n"내 파일" 앱에서 RECOVR 폴더를 새로 만든 뒤, 그 폴더를 선택해주세요.';
    }
    if (err.name === 'InvalidStateError') {
      return '파일 상태가 바뀌었어요.\n\n연결을 다시 시도하거나 "전체 데이터보내기"를 이용해주세요.';
    }
    if (err.name === 'NotAllowedError') {
      return '파일 접근 권한이 거부됐어요.\n\n다시 연결할 때 권한을 허용해주세요.';
    }
    if (err.name === 'AbortError') {
      return '';
    }

    return `백업 저장에 실패했어요. (${err.name || '오류'})\n\n다른 폴더를 선택하거나 "전체 데이터보내기"를 이용해주세요.`;
  }

  async function writeToFileHandle(fileHandle, json) {
    let writable = null;
    try {
      writable = await fileHandle.createWritable();
      await writable.write(json);
      await writable.close();
      return { ok: true };
    } catch (err) {
      if (writable) {
        try { await writable.abort(); } catch (_) { /* ignore */ }
      }
      return { ok: false, error: err };
    }
  }

  async function writeToDirectory(dirHandle, json, fileName = BACKUP_FILE_NAME) {
    try {
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      return writeToFileHandle(fileHandle, json);
    } catch (err) {
      return { ok: false, error: err };
    }
  }

  async function writeToRoot(rootHandle, json) {
    if (!rootHandle) return { ok: false, error: new Error('NoHandle') };
    if (rootHandle.kind === 'directory') {
      return writeToDirectory(rootHandle, json);
    }
    return writeToFileHandle(rootHandle, json);
  }

  function getRootLabel(rootHandle) {
    if (!rootHandle) return '';
    if (rootHandle.kind === 'directory') {
      return `${rootHandle.name}/${BACKUP_FILE_NAME}`;
    }
    return rootHandle.name;
  }

  function getMobileConnectGuide() {
    return (
      'Android 앱 모드에서는 폴더 연결이 더 안정적이에요.\n\n' +
      '1. "내 파일" 앱에서 RECOVR 폴더를 새로 만드세요\n' +
      '2. 다음 화면에서 그 폴더를 선택하세요\n' +
      '3. 폴더 안에 recovr_backup.json 이 자동 저장됩니다'
    );
  }

  return {
    BACKUP_FILE_NAME,
    prefersDirectoryBackup,
    shouldSkipPreRead,
    describeError,
    writeToFileHandle,
    writeToDirectory,
    writeToRoot,
    getRootLabel,
    getMobileConnectGuide,
    isRunningAsPwa,
  };
})();
