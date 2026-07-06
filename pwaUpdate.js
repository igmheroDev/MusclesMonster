// ============================================================
// RECOVR - PWA 업데이트 안내 모듈 (독립 모듈)
// 새 Service Worker 설치 시 새로고침 배너 표시
// ============================================================

const PwaUpdate = (() => {
  let registration = null;
  let waitingWorker = null;
  let bannerEl = null;
  let initialized = false;

  function ensureBanner() {
    if (bannerEl) return bannerEl;

    bannerEl = document.createElement('div');
    bannerEl.id = 'pwaUpdateBanner';
    bannerEl.className = 'pwa-update-banner';
    bannerEl.innerHTML = `
      <div class="pwa-update-text">
        <span class="pwa-update-icon">🔄</span>
        <span>새 버전이 준비되었어요</span>
      </div>
      <div class="pwa-update-actions">
        <button type="button" class="pwa-update-btn pwa-update-btn-primary" data-action="apply">새로고침</button>
        <button type="button" class="pwa-update-btn" data-action="dismiss">나중에</button>
      </div>
    `;

    bannerEl.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'apply') apply();
      if (action === 'dismiss') dismiss();
    });

    document.body.prepend(bannerEl);
    return bannerEl;
  }

  function showBanner() {
    ensureBanner().classList.add('visible');
  }

  function hideBanner() {
    if (bannerEl) bannerEl.classList.remove('visible');
  }

  function trackWorker(worker) {
    if (!worker) return;

    worker.addEventListener('statechange', () => {
      if (worker.state !== 'installed') return;

      if (navigator.serviceWorker.controller) {
        waitingWorker = worker;
        showBanner();
      } else {
        worker.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  }

  function apply() {
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    hideBanner();
  }

  function dismiss() {
    hideBanner();
  }

  function onControllerChange() {
    window.location.reload();
  }

  function init(reg) {
    if (initialized || !reg) return;
    initialized = true;
    registration = reg;

    if (reg.waiting && navigator.serviceWorker.controller) {
      waitingWorker = reg.waiting;
      showBanner();
    }

    if (reg.installing) trackWorker(reg.installing);

    reg.addEventListener('updatefound', () => {
      trackWorker(reg.installing);
    });

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
  }

  return {
    init,
    apply,
    dismiss,
    showBanner,
    hideBanner,
  };
})();
