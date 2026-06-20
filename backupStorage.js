// ============================================================
// RECOVR - 백업 파일 핸들 영구 저장 (IndexedDB)
// FileSystemFileHandle을 IndexedDB에 저장해 새로고침 후에도 복원합니다.
// ============================================================

const BackupStorage = (() => {
  const DB_NAME = 'recovr_backup_db_v1';
  const STORE = 'handles';
  const HANDLE_KEY = 'backup_file';

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function put(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function get(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async function remove(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function saveBackupHandle(handle) {
    if (!handle) return;
    await put(HANDLE_KEY, handle);
  }

  async function loadBackupHandle() {
    try {
      return await get(HANDLE_KEY);
    } catch (e) {
      console.warn('[BackupStorage] 핸들 로드 실패:', e);
      return null;
    }
  }

  async function clearBackupHandle() {
    try {
      await remove(HANDLE_KEY);
    } catch (e) {
      console.warn('[BackupStorage] 핸들 삭제 실패:', e);
    }
  }

  return { saveBackupHandle, loadBackupHandle, clearBackupHandle };
})();
