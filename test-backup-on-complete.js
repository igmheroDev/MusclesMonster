#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
  else console.log('OK:', msg);
}

const src = fs.readFileSync(path.join(__dirname, 'backupOnComplete.js'), 'utf8');

function loadModule(env) {
  const context = {
    console,
    localStorage: {
      _d: {},
      getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
      setItem(k, v) { this._d[k] = String(v); },
    },
    BackupStorage: env.BackupStorage,
    BackupWriter: env.BackupWriter,
    BackupReconnect: env.BackupReconnect,
  };
  vm.runInNewContext(src + '\nthis.BackupOnComplete = BackupOnComplete;', context);
  return context.BackupOnComplete;
}

async function run() {
  console.log('=== backupOnComplete ===');

  // 1) 핸들 없음
  {
    const mod = loadModule({
      BackupStorage: { async loadBackupHandle() { return null; } },
      BackupWriter: {
        supportsAutoFileBackup() { return true; },
        async writeToRoot() { return { ok: true }; },
      },
    });
    const r = await mod.syncAfterWorkoutSave({
      buildJson: () => '{"ok":true}',
      getRootHandle: () => null,
      setRootHandle() {},
    });
    assert(r.status === 'none' && r.wrote === false, '핸들 없으면 none');
  }

  // 2) 권한 복원 후 쓰기
  {
    let setHandle = null;
    let wrote = null;
    const handle = { kind: 'file', name: 'recovr_backup.json' };
    const mod = loadModule({
      BackupStorage: { async loadBackupHandle() { return handle; } },
      BackupWriter: {
        supportsAutoFileBackup() { return true; },
        async writeToRoot(h, json) {
          wrote = { h, json };
          return { ok: true };
        },
      },
      BackupReconnect: {
        async queryPermission() { return 'prompt'; },
        async restoreWithGesture(h) { return { status: 'restored', handle: h, permission: 'granted' }; },
        hideBanner() {},
      },
    });
    const r = await mod.syncAfterWorkoutSave({
      buildJson: () => '{"workouts":[]}',
      getRootHandle: () => null,
      setRootHandle(h) { setHandle = h; },
      updateStatus() {},
      hideBanner() {},
    });
    assert(r.status === 'written' && r.wrote === true, '제스처 복원 후 쓰기');
    assert(setHandle === handle, '루트 핸들 설정');
    assert(wrote && wrote.json.includes('workouts'), 'JSON 전달');
  }

  // 3) 권한 거부 시 쓰기 안 함
  {
    let writeCalled = false;
    const handle = { kind: 'file', name: 'x.json' };
    const mod = loadModule({
      BackupStorage: { async loadBackupHandle() { return handle; } },
      BackupWriter: {
        supportsAutoFileBackup() { return true; },
        async writeToRoot() { writeCalled = true; return { ok: true }; },
      },
      BackupReconnect: {
        async queryPermission() { return 'prompt'; },
        async restoreWithGesture() { return { status: 'needs-gesture', handle, permission: 'prompt' }; },
      },
    });
    const r = await mod.syncAfterWorkoutSave({
      buildJson: () => '{"workouts":[]}',
      getRootHandle: () => null,
      setRootHandle() {},
      updateStatus() {},
    });
    assert(r.status === 'needs-gesture' && r.wrote === false, '권한 없으면 쓰기 스킵');
    assert(!writeCalled, 'writeToRoot 미호출');
  }

  // 4) 이미 granted면 restore 없이 쓰기
  {
    let restoreCalled = false;
    const handle = { kind: 'file', name: 'ok.json' };
    const mod = loadModule({
      BackupStorage: { async loadBackupHandle() { return handle; } },
      BackupWriter: {
        supportsAutoFileBackup() { return true; },
        async writeToRoot() { return { ok: true }; },
      },
      BackupReconnect: {
        async queryPermission() { return 'granted'; },
        async restoreWithGesture() {
          restoreCalled = true;
          return { status: 'restored', handle, permission: 'granted' };
        },
      },
    });
    const r = await mod.syncAfterWorkoutSave({
      buildJson: () => '{"workouts":[1]}',
      getRootHandle: () => null,
      setRootHandle() {},
      updateStatus() {},
    });
    assert(r.wrote === true, 'granted면 쓰기');
    assert(!restoreCalled, 'granted면 restore 스킵');
  }

  // 5) 가이드·통합 참조
  {
    const mod = loadModule({
      BackupStorage: {},
      BackupWriter: {
        supportsAutoFileBackup() { return true; },
        isSamsungInternet() { return false; },
        prefersDirectoryBackup() { return false; },
      },
    });
    const guide = mod.getSettingsGuide();
    assert(guide.includes('수정 완료') || guide.includes('저장하기'), '가이드에 수정완료 언급');
    assert(!guide.includes('세트 체크'), '세트 체크마다 백업 문구 제거');
  }

  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

  assert(html.includes('backupOnComplete.js'), 'index loads module');
  assert(sw.includes('backupOnComplete.js'), 'sw caches module');
  assert(sw.includes('recovr-cache-v59'), 'sw cache bump');
  assert(app.includes('syncBackupAfterWorkoutSave'), 'app wires sync');
  assert(app.includes('BackupOnComplete.syncAfterWorkoutSave'), 'app calls module');
  assert(/function triggerAutoBackup\(\)\s*\{\s*return;\s*\}/.test(app), 'progress auto backup disabled');
  assert(app.includes('// 홈 렌더 이후, 저장 버튼 제스처로만 파일 재연결·백업'), 'saveWorkout calls sync after render');
  assert(app.includes('backupRootHandle = null'), 'init clears handle');
  assert(!/async function initBackupFromStorage\(\) \{[\s\S]*queryPermission/.test(app), 'init does not queryPermission');

  if (failures) {
    console.error('\n' + failures + ' failure(s)');
    process.exit(1);
  }
  console.log('\nALL PASSED');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
