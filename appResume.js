// ============================================================
// RECOVR - 앱 재개(Resume) 강화 모듈 (독립)
// 잠깐 백그라운드로 나갔다 돌아오거나, 앱을 다시 열 때
// 진행 중 운동·타이머·화면 유지를 네이티브 앱에 가깝게 복원합니다.
// ============================================================

const AppResume = (() => {
  const STORAGE_KEY = 'recovr_ui_session_v1';
  const AUTO_RESTORE_MS = 6 * 60 * 60 * 1000; // 6시간 이내 자동 복원
  const DEBOUNCE_MS = 180;
  const WAKE_JUMP_MS = 3500;
  const WAKE_CHECK_MS = 2000;

  let initialized = false;
  let listenersAttached = false;
  let resumeTimer = null;
  let wakeCheckId = null;
  let lastTickAt = 0;
  let lastHiddenAt = 0;
  let coldRestoreDone = false;

  function now() {
    return Date.now();
  }

  function safeJsonParse(raw) {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function getActiveView() {
    if (typeof document === 'undefined') return 'home';
    const el = document.querySelector('.view.active');
    if (!el || !el.id) return 'home';
    return el.id.replace(/^view-/, '') || 'home';
  }

  function isModalOpen() {
    if (typeof document === 'undefined') return false;
    return !!document.getElementById('modalOverlay')?.classList.contains('show');
  }

  function readSession() {
    if (typeof sessionStorage === 'undefined') return null;
    return safeJsonParse(sessionStorage.getItem(STORAGE_KEY));
  }

  function writeSession(partial) {
    if (typeof sessionStorage === 'undefined') return null;
    const prev = readSession() || {};
    const next = {
      ...prev,
      ...partial,
      savedAt: now(),
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (_) { /* quota / private mode */ }
    return next;
  }

  function clearSession() {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) { /* ignore */ }
  }

  function snapshotUi(reason) {
    const snapshot = {
      view: getActiveView(),
      modalOpen: isModalOpen(),
      sessionId: (typeof activeSessionId !== 'undefined') ? activeSessionId : null,
      scrollY: (typeof window !== 'undefined') ? (window.scrollY || 0) : 0,
      hiddenAt: now(),
      reason: reason || 'hide',
    };

    // 휴식 타이머 진행 중이면 종료 시각도 함께 보관
    if (typeof RestTimer !== 'undefined' && typeof RestTimer.getResumeState === 'function') {
      snapshot.rest = RestTimer.getResumeState();
    } else {
      snapshot.rest = null;
    }

    return writeSession(snapshot);
  }

  function kickPaint() {
    if (typeof requestAnimationFrame !== 'function') return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          if (typeof document !== 'undefined' && document.body) {
            // iOS PWA에서 백그라운드 복귀 시 화면이 멈춘 듯 보일 때 레이아웃 재계산
            void document.body.offsetHeight;
          }
          if (typeof window !== 'undefined' && typeof window.focus === 'function') {
            window.focus();
          }
        } catch (_) { /* ignore */ }
      });
    });
  }

  function refreshActiveView() {
    if (typeof document === 'undefined') return;
    const view = getActiveView();
    try {
      if (view === 'home' && typeof renderHome === 'function') renderHome();
      else if (view === 'log' && typeof renderLog === 'function') renderLog();
      else if (view === 'stats' && typeof renderStats === 'function') renderStats();
    } catch (err) {
      console.warn('[AppResume] 뷰 갱신 실패:', err && err.message ? err.message : err);
    }
  }

  function notifyModules() {
    try {
      if (typeof WakeLock !== 'undefined' && typeof WakeLock.sync === 'function') {
        WakeLock.sync();
      }
    } catch (_) { /* ignore */ }

    try {
      if (typeof DurationTimer !== 'undefined' && typeof DurationTimer.onAppResume === 'function') {
        DurationTimer.onAppResume();
      }
    } catch (_) { /* ignore */ }

    try {
      if (typeof RestTimer !== 'undefined' && typeof RestTimer.onAppResume === 'function') {
        RestTimer.onAppResume();
      }
    } catch (_) { /* ignore */ }

    try {
      if (typeof flushWorkoutProgress === 'function' && isModalOpen()) {
        // 복귀 직후 최신 값을 한 번 더 고정 (백그라운드 중 타이머 경과분)
        flushWorkoutProgress();
      }
    } catch (_) { /* ignore */ }
  }

  function showResumeToast(message) {
    if (typeof CelebrateFx !== 'undefined' && typeof CelebrateFx.showToast === 'function') {
      CelebrateFx.showToast(message);
      return;
    }
    console.info('[AppResume]', message);
  }

  function restoreRestFromSnapshot(session) {
    if (!session || !session.rest) return;
    if (typeof RestTimer === 'undefined' || typeof RestTimer.resumeFromState !== 'function') return;
    RestTimer.resumeFromState(session.rest);
  }

  function softResume(reason) {
    notifyModules();
    refreshActiveView();
    kickPaint();

    const session = readSession();
    if (session && session.modalOpen && isModalOpen()) {
      restoreRestFromSnapshot(session);
    }

    if (lastHiddenAt > 0) {
      const awayMs = now() - lastHiddenAt;
      if (awayMs > 60 * 1000 && isModalOpen()) {
        showResumeToast('이어서 진행 중이에요');
      }
    }

    console.info('[AppResume] soft resume:', reason || 'visible');
  }

  function scheduleSoftResume(reason) {
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      resumeTimer = null;
      softResume(reason);
    }, DEBOUNCE_MS);
  }

  function findRecentInProgress() {
    if (typeof findInProgressWorkout !== 'function') return null;
    const w = findInProgressWorkout();
    if (!w) return null;
    const ts = new Date(w.updatedAt || w.createdAt || 0).getTime();
    if (!Number.isFinite(ts) || ts <= 0) return null;
    if (now() - ts > AUTO_RESTORE_MS) return null;
    return w;
  }

  function coldRestore() {
    if (coldRestoreDone) return false;
    coldRestoreDone = true;

    if (typeof document === 'undefined') return false;
    if (isModalOpen()) return false;

    const session = readSession();
    const inProgress = findRecentInProgress();
    if (!inProgress) {
      // 오래된 스냅샷만 정리
      if (session && session.hiddenAt && now() - session.hiddenAt > AUTO_RESTORE_MS) {
        clearSession();
      }
      return false;
    }

    // 세션 스냅샷이 있으면 그 탭/스크롤을 우선 복원
    if (session && session.view && typeof switchView === 'function') {
      try { switchView(session.view); } catch (_) { /* ignore */ }
    }

    const shouldOpenModal = !session || session.modalOpen === true;
    if (!shouldOpenModal) return false;

    if (typeof resumeInProgressModal !== 'function') return false;

    const ok = resumeInProgressModal(inProgress);
    if (ok) {
      restoreRestFromSnapshot(session);
      if (session && typeof session.scrollY === 'number' && typeof window !== 'undefined') {
        setTimeout(() => {
          try { window.scrollTo(0, session.scrollY); } catch (_) { /* ignore */ }
        }, 0);
      }
      showResumeToast('진행 중이던 운동을 이어서 불러왔어요');
      console.info('[AppResume] cold restore modal');
      return true;
    }
    return false;
  }

  function onVisibilityChange() {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'hidden') {
      lastHiddenAt = now();
      snapshotUi('visibilitychange');
      return;
    }
    if (document.visibilityState === 'visible') {
      scheduleSoftResume('visibilitychange');
    }
  }

  function onPageShow(e) {
    if (e && e.persisted) {
      scheduleSoftResume('pageshow-bfcache');
      return;
    }
    // 일반 로드에서도 한 번 soft refresh (타이머/락)
    scheduleSoftResume('pageshow');
  }

  function onPageHide() {
    lastHiddenAt = now();
    snapshotUi('pagehide');
  }

  function onFreeze() {
    lastHiddenAt = now();
    snapshotUi('freeze');
  }

  function onResumeEvent() {
    scheduleSoftResume('resume');
  }

  function onFocus() {
    // 일부 모바일 브라우저에서 visibility보다 focus가 먼저/단독으로 옴
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      scheduleSoftResume('focus');
    }
  }

  function startWakeCheck() {
    if (wakeCheckId || typeof setInterval !== 'function') return;
    lastTickAt = now();
    wakeCheckId = setInterval(() => {
      const t = now();
      if (t - lastTickAt > WAKE_JUMP_MS) {
        // JS 타이머가 오래 멈췄다가 깨어남 → 강제 soft resume
        scheduleSoftResume('time-jump');
      }
      lastTickAt = t;
    }, WAKE_CHECK_MS);
  }

  function attachListeners() {
    if (listenersAttached || typeof document === 'undefined') return;
    listenersAttached = true;

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('focus', onFocus);
    document.addEventListener('freeze', onFreeze);
    document.addEventListener('resume', onResumeEvent);
    startWakeCheck();
  }

  function init() {
    if (initialized) return;
    initialized = true;
    attachListeners();

    // 초기 로드: 잠깐 나갔다 다시 연 경우 진행 중 모달 자동 복원
    setTimeout(() => {
      try { coldRestore(); } catch (err) {
        console.warn('[AppResume] cold restore 실패:', err && err.message ? err.message : err);
      }
    }, 0);
  }

  return {
    init,
    snapshotUi,
    softResume,
    coldRestore,
    readSession,
    clearSession,
    AUTO_RESTORE_MS,
    STORAGE_KEY,
  };
})();
