// ============================================================
// RECOVR - 운동 완료 바디맵 요약 화면 (독립 모듈)
// 저장 성공 시 히트맵 + 요약 통계 + confetti (CelebrateFx 재사용)
// ============================================================

const WorkoutCompleteMap = (() => {
  const STYLE_ID = 'workout-complete-map-styles';
  const OVERLAY_ID = 'wcmOverlay';
  const CORAL = '#ff3b5c';
  const MINT = '#3ee6b0';
  const VIEWBOX_W = 240;
  const VIEWBOX_H = 360;
  const COOLDOWN_MS = 1800;

  let initialized = false;
  let reducedMotion = false;
  let mq = null;
  let lastShownAt = 0;
  let pendingWorkout = null;
  let mapMode = '2d';
  const BM3_MOUNT_ID = 'complete';
  let lastStats = null;
  let lastView = 'front';

  function syncMapModeFromStorage() {
    if (typeof BodyMap3D !== 'undefined' && BodyMap3D.getPreferredMode) {
      mapMode = BodyMap3D.getPreferredMode();
    }
  }

  function teardown3d() {
    if (typeof BodyMap3D !== 'undefined') BodyMap3D.unmount(BM3_MOUNT_ID);
  }

  function estimateSetCounts(loads, totalSets) {
    const counts = {};
    const keys = Object.keys(loads || {});
    const sum = keys.reduce((s, k) => s + (loads[k] || 0), 0) || 1;
    keys.forEach((m) => {
      counts[m] = Math.max(1, Math.round(((loads[m] || 0) / sum) * (totalSets || keys.length)));
    });
    return counts;
  }

  async function mountOrUpdate3d(stats, view) {
    if (typeof BodyMap3D === 'undefined') return;
    const host3d = document.getElementById('wcm3dHost');
    if (!host3d) return;
    const data = {
      loads: (stats && stats.loads) || {},
      setCounts: estimateSetCounts(stats && stats.loads, stats && stats.sets),
      view: view || 'front',
    };
    if (host3d.querySelector('canvas')) {
      BodyMap3D.update(BM3_MOUNT_ID, data, { colorMode: 'complete' });
      return;
    }
    await BodyMap3D.mount(BM3_MOUNT_ID, host3d, {
      colorMode: 'complete',
      data,
      showPedestal: true,
      autoRotate: !reducedMotion,
    });
  }

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function ensureStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 12100;
        display: none;
        align-items: flex-end;
        justify-content: center;
        background: rgba(6, 8, 14, 0.78);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        padding: 16px 14px calc(18px + env(safe-area-inset-bottom, 0px));
      }
      #${OVERLAY_ID}.show { display: flex; }
      .wcm-sheet {
        width: min(420px, 100%);
        max-height: min(92vh, 760px);
        overflow: auto;
        border-radius: 22px;
        border: 1px solid rgba(62, 230, 176, 0.28);
        background: linear-gradient(165deg, rgba(18,18,26,0.98), rgba(10,10,15,0.98));
        box-shadow: 0 22px 60px rgba(0,0,0,0.5);
        padding: 20px 16px 16px;
        animation: wcm-in 420ms cubic-bezier(0.34, 1.35, 0.64, 1) both;
        position: relative;
      }
      body.light .wcm-sheet {
        background: linear-gradient(165deg, #fff, #f3f4f8);
        box-shadow: 0 16px 40px rgba(0,0,0,0.12);
      }
      .wcm-logo {
        text-align: center;
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        letter-spacing: 0.12em;
        font-size: 12px;
        color: var(--text, #e8e8f0);
      }
      .wcm-logo span { color: ${MINT}; }
      .wcm-title {
        text-align: center;
        margin-top: 8px;
        font-family: 'Space Grotesk', sans-serif;
        font-size: 24px;
        font-weight: 700;
        color: ${MINT};
        letter-spacing: -0.02em;
      }
      .wcm-sub {
        text-align: center;
        margin-top: 4px;
        font-size: 12.5px;
        color: var(--muted, #6b6b85);
      }
      .wcm-map-wrap {
        width: min(230px, 78%);
        margin: 12px auto 8px;
        background: transparent;
      }
      .wcm-map-header {
        display: flex;
        justify-content: center;
        margin-top: 10px;
      }
      .wcm-3d-host {
        width: min(280px, 88%);
        margin: 8px auto 4px;
      }
      .wcm-3d-host .bm3-stage {
        aspect-ratio: 3 / 4.1;
      }
      .wcm-2d-only[hidden], .wcm-3d-host[hidden] { display: none !important; }
      .wcm-svg { width: 100%; height: auto; display: block; background: transparent; }
      body:not(.light) .wcm-svg .wcm-body-image {
        filter: none;
        opacity: 0.95;
      }
      body.light .wcm-svg .wcm-body-image { filter: none; opacity: 1; }
      .wcm-region--idle {
        fill: #2c2c36;
        fill-opacity: 0.55;
        stroke: #6a6a78;
        stroke-width: 0.7px;
      }
      .wcm-region--active {
        filter: drop-shadow(0 0 5px rgba(255, 59, 92, 0.9)) drop-shadow(0 0 14px rgba(255, 59, 92, 0.45));
      }
      body.light .wcm-region--active { filter: drop-shadow(0 0 4px rgba(255, 59, 92, 0.45)); }
      .wcm-stats {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 8px;
        margin-top: 8px;
      }
      .wcm-stat {
        border-radius: 14px;
        border: 1px solid var(--border, #2a2a3a);
        background: rgba(255,255,255,0.03);
        padding: 10px 8px;
        text-align: center;
      }
      .wcm-stat-val {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 16px;
        font-weight: 700;
        color: var(--text, #e8e8f0);
      }
      .wcm-stat-label {
        margin-top: 2px;
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.04em;
      }
      .wcm-stat-label.mint { color: ${MINT}; }
      .wcm-stat-label.coral { color: ${CORAL}; }
      .wcm-section {
        margin-top: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: center;
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted, #6b6b85);
        font-weight: 700;
      }
      .wcm-section::before, .wcm-section::after {
        content: '';
        height: 1px;
        flex: 1;
        background: rgba(255,255,255,0.1);
      }
      .wcm-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        justify-content: center;
        margin-top: 10px;
      }
      .wcm-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.04);
        font-size: 11.5px;
        color: var(--text, #e8e8f0);
      }
      .wcm-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: ${CORAL};
        opacity: var(--wcm-op, 0.7);
      }
      .wcm-actions {
        margin-top: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .wcm-primary {
        border: none;
        border-radius: 14px;
        padding: 14px 16px;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        color: #0a0a0f;
        background: linear-gradient(135deg, ${MINT}, #2bc48a);
      }
      .wcm-primary:active { transform: scale(0.98); }
      .wcm-secondary {
        border: none;
        background: transparent;
        color: var(--muted, #6b6b85);
        font-size: 13px;
        padding: 8px;
        cursor: pointer;
      }
      @media (prefers-reduced-motion: reduce) {
        .wcm-sheet { animation: none !important; }
      }
      @keyframes wcm-in {
        from { opacity: 0; transform: translateY(24px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  function getMuscleLabel(key) {
    if (typeof MUSCLE_LABELS !== 'undefined' && MUSCLE_LABELS[key]) return MUSCLE_LABELS[key].name;
    return key;
  }

  function assetUrl(path) {
    return `${path}?v=v56`;
  }

  function getBodyImages() {
    const isLight = !!(typeof document !== 'undefined' && document.body?.classList?.contains('light'));
    if (typeof MuscleHeatmap !== 'undefined') {
      if (!isLight && MuscleHeatmap.BODY_IMAGES_DARK) return MuscleHeatmap.BODY_IMAGES_DARK;
      if (MuscleHeatmap.BODY_IMAGES) return MuscleHeatmap.BODY_IMAGES;
    }
    return isLight
      ? { front: 'body-map-front.png', back: 'body-map-back.png' }
      : { front: 'body-map-front-dark.png', back: 'body-map-back-dark.png' };
  }

  function intensityOpacity(score) {
    if (!score) return 0;
    return Math.max(0.22, Math.min(0.85, 0.2 + score * 0.18));
  }

  function intensityColor(score) {
    if (score >= 2.2) return CORAL;
    if (score >= 1.2) return '#ff6b4a';
    return '#ff8a9a';
  }

  function analyzeWorkout(workout) {
    const loads = {};
    let volume = 0;
    let sets = 0;
    const exercises = (workout && workout.exercises) || [];

    exercises.forEach((ex) => {
      if (!ex || !ex.name) return;
      const stim = (typeof ExerciseMuscleMap !== 'undefined' && ExerciseMuscleMap.getStimulation)
        ? ExerciseMuscleMap.getStimulation(ex.name)
        : {};
      const muscles = Object.keys(stim).length
        ? Object.keys(stim)
        : ((typeof getMusclesFromExerciseName === 'function') ? getMusclesFromExerciseName(ex.name) : []);

      let exVol = 0;
      let exSets = 0;
      if (ex.mode === 'duration') {
        if (ex.durationSets && ex.durationSets.length) {
          exSets = ex.durationSets.filter((s) => s.completed).length;
          exVol = (typeof getDurationLoad === 'function') ? getDurationLoad(ex) : exSets * 30;
        } else {
          exSets = 1;
          exVol = (ex.durationMin || 0) * 10;
        }
      } else if (ex.setDetails && ex.setDetails.length) {
        ex.setDetails.forEach((s) => {
          if (!s.completed) return;
          exSets += 1;
          exVol += (s.weight || 0) * (s.reps || 0);
        });
        if (exSets === 0 && typeof getExerciseVolume === 'function') {
          exVol = getExerciseVolume(ex);
          exSets = ex.sets || 0;
        }
      } else {
        exVol = (typeof getExerciseVolume === 'function') ? getExerciseVolume(ex) : 0;
        exSets = ex.sets || 0;
      }

      volume += exVol;
      sets += exSets;

      muscles.forEach((m) => {
        const level = stim[m] || 2;
        const score = (exSets * (level / 3)) + (exVol / 900) * (level / 3);
        loads[m] = (loads[m] || 0) + score;
      });
    });

    const tags = Object.keys(loads)
      .map((m) => ({ muscle: m, score: loads[m], label: getMuscleLabel(m) }))
      .sort((a, b) => b.score - a.score);

    let calories = null;
    try {
      if (typeof MuscleGrowthTracker !== 'undefined' && MuscleGrowthTracker.estimateWorkoutCalories) {
        calories = Math.round(MuscleGrowthTracker.estimateWorkoutCalories(workout) || 0);
      }
    } catch (e) { /* ignore */ }

    return { loads, volume, sets, tags, calories };
  }

  function pickView(loads) {
    const backScore = ['back', 'triceps', 'hamstrings'].reduce((s, m) => s + (loads[m] || 0), 0);
    const frontScore = ['chest', 'biceps', 'quads', 'core', 'shoulder'].reduce((s, m) => s + (loads[m] || 0), 0);
    return backScore > frontScore ? 'back' : 'front';
  }

  function buildSvg(view, loads) {
    const regions = (typeof MuscleHeatmap !== 'undefined')
      ? (view === 'back' ? MuscleHeatmap.BACK_REGIONS : MuscleHeatmap.FRONT_REGIONS)
      : [];
    const images = getBodyImages();
    const masks = (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.BODY_MASKS)
      ? MuscleHeatmap.BODY_MASKS
      : { front: 'body-mask-front.png', back: 'body-mask-back.png' };
    const maskId = `wcmMask-${view}`;
    const paths = (regions || []).map((region) => {
      const score = loads[region.muscle] || 0;
      const active = score > 0;
      const opacity = active ? intensityOpacity(score) : 0.55;
      const fill = active ? intensityColor(score) : '#2c2c36';
      const stroke = active ? 'none' : '#6a6a78';
      const strokeW = active ? 0 : 0.7;
      const cls = active ? 'wcm-region--active' : 'wcm-region--idle';
      return `<path class="${cls}" d="${region.d}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="${strokeW}"></path>`;
    }).join('');

    return `
      <svg class="wcm-svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" role="img" aria-label="이번 세션 자극 히트맵">
        <defs>
          <mask id="${maskId}">
            <image href="${assetUrl(masks[view] || masks.front)}" x="0" y="0" width="${VIEWBOX_W}" height="${VIEWBOX_H}"
              preserveAspectRatio="xMidYMid meet"/>
          </mask>
        </defs>
        <image class="wcm-body-image" href="${assetUrl(images[view] || images.front)}" x="0" y="0" width="${VIEWBOX_W}" height="${VIEWBOX_H}"
          preserveAspectRatio="xMidYMid meet" pointer-events="none"/>
        <g mask="url(#${maskId})">${paths}</g>
      </svg>`;
  }

  function countCompletedWorkouts() {
    try {
      if (typeof getCompletedWorkouts === 'function') return getCompletedWorkouts().length;
      if (typeof loadWorkouts === 'function') return loadWorkouts().filter((w) => !w.inProgress).length;
    } catch (e) { /* ignore */ }
    return 0;
  }

  function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hide();
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function show(workout) {
    if (typeof document === 'undefined' || !workout) return false;
    const now = Date.now();
    if (now - lastShownAt < COOLDOWN_MS) return false;
    lastShownAt = now;

    ensureStyles();
    syncMapModeFromStorage();
    teardown3d();

    const overlay = ensureOverlay();
    const stats = analyzeWorkout(workout);
    const view = pickView(stats.loads);
    lastStats = stats;
    lastView = view;
    const nth = countCompletedWorkouts();
    const modeToggle = (typeof BodyMap3D !== 'undefined' && BodyMap3D.buildModeToggle)
      ? BodyMap3D.buildModeToggle(mapMode, { scope: 'complete' })
      : '';

    const calorieHtml = (stats.calories != null && stats.calories > 0)
      ? `<div class="wcm-stat">
          <div class="wcm-stat-val">${escapeHtml(String(stats.calories))}</div>
          <div class="wcm-stat-label mint">kcal</div>
        </div>`
      : `<div class="wcm-stat">
          <div class="wcm-stat-val">${escapeHtml(String(workout.duration || '-'))}</div>
          <div class="wcm-stat-label mint">분</div>
        </div>`;

    overlay.innerHTML = `
      <div class="wcm-sheet" role="dialog" aria-modal="true" aria-labelledby="wcmTitle">
        <div class="wcm-logo">REC<span>O</span>VR</div>
        <div class="wcm-title" id="wcmTitle">운동 완료!</div>
        <div class="wcm-sub">${nth > 0 ? `${nth}번째 운동` : '오늘 세션 요약'}</div>
        <div class="wcm-map-header">${modeToggle}</div>
        <div class="wcm-3d-host" id="wcm3dHost" ${mapMode === '3d' ? '' : 'hidden'}></div>
        <div class="wcm-2d-only wcm-map-wrap" ${mapMode === '3d' ? 'hidden' : ''}>${buildSvg(view, stats.loads)}</div>
        <div class="wcm-stats">
          <div class="wcm-stat">
            <div class="wcm-stat-val">${escapeHtml(Math.round(stats.volume).toLocaleString('ko-KR'))}</div>
            <div class="wcm-stat-label mint">볼륨 kg</div>
          </div>
          <div class="wcm-stat">
            <div class="wcm-stat-val">${escapeHtml(String(stats.sets))}</div>
            <div class="wcm-stat-label coral">세트</div>
          </div>
          ${calorieHtml}
        </div>
        <div class="wcm-section">자극 부위</div>
        <div class="wcm-tags">
          ${stats.tags.length ? stats.tags.slice(0, 6).map((t) => `
            <span class="wcm-tag">
              <span class="wcm-dot" style="--wcm-op:${intensityOpacity(t.score)};background:${intensityColor(t.score)}"></span>
              ${escapeHtml(t.label)}
            </span>`).join('') : '<span class="wcm-tag">기록된 근력 자극 없음</span>'}
        </div>
        <div class="wcm-actions">
          <button type="button" class="wcm-primary" data-wcm-close>확인</button>
          <button type="button" class="wcm-secondary" data-wcm-close>닫기</button>
        </div>
      </div>`;

    overlay.classList.add('show');
    overlay.querySelectorAll('[data-wcm-close]').forEach((btn) => {
      btn.addEventListener('click', hide);
    });

    if (typeof BodyMap3D !== 'undefined' && BodyMap3D.bindModeToggle) {
      BodyMap3D.bindModeToggle(overlay, (mode) => {
        mapMode = mode;
        const host3d = overlay.querySelector('#wcm3dHost');
        const twoD = overlay.querySelector('.wcm-2d-only');
        if (mode === '3d') {
          if (twoD) twoD.hidden = true;
          if (host3d) host3d.hidden = false;
          mountOrUpdate3d(lastStats, lastView);
        } else {
          teardown3d();
          if (host3d) host3d.hidden = true;
          if (twoD) twoD.hidden = false;
        }
      });
    }

    if (mapMode === '3d') mountOrUpdate3d(stats, view);

    try {
      if (typeof CelebrateFx !== 'undefined' && CelebrateFx.confettiBurst && !reducedMotion) {
        CelebrateFx.confettiBurst({ count: 48, y: window.innerHeight * 0.22 });
      }
    } catch (e) { /* ignore */ }

    return true;
  }

  function hide() {
    teardown3d();
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.classList.remove('show');
  }

  function snapshotFromForm() {
    try {
      const dateEl = document.getElementById('workoutDate');
      const durEl = document.getElementById('workoutDuration');
      const exercises = (typeof extractExercisesFromForm === 'function')
        ? extractExercisesFromForm()
        : [];
      return {
        date: dateEl ? dateEl.value : '',
        duration: durEl ? parseInt(durEl.value, 10) || 0 : 0,
        type: (typeof selectedType !== 'undefined') ? selectedType : 'full',
        exercises,
      };
    } catch (e) {
      return null;
    }
  }

  function onClickCapture(e) {
    const saveBtn = e.target.closest('#saveBtn');
    if (!saveBtn || saveBtn.disabled) return;
    // 저장 직전 폼 스냅샷 (closeModal 후 DOM이 비워지기 전)
    pendingWorkout = snapshotFromForm();
    window.setTimeout(() => {
      const overlay = document.getElementById('modalOverlay');
      const closed = !overlay || !overlay.classList.contains('show');
      if (!closed || !pendingWorkout) return;
      const hasName = (pendingWorkout.exercises || []).some((ex) => ex.name && ex.name.trim());
      if (!hasName) return;
      show(pendingWorkout);
      pendingWorkout = null;
    }, 90);
  }

  function onMotionChange(e) {
    reducedMotion = !!(e && e.matches);
  }

  function init() {
    if (initialized || typeof document === 'undefined') return false;
    initialized = true;
    reducedMotion = prefersReducedMotion();
    ensureStyles();
    document.addEventListener('click', onClickCapture, true);
    if (window.matchMedia) {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mq.addEventListener) mq.addEventListener('change', onMotionChange);
      else if (mq.addListener) mq.addListener(onMotionChange);
    }
    return true;
  }

  function destroy() {
    if (!initialized) return;
    document.removeEventListener('click', onClickCapture, true);
    if (mq) {
      if (mq.removeEventListener) mq.removeEventListener('change', onMotionChange);
      else if (mq.removeListener) mq.removeListener(onMotionChange);
      mq = null;
    }
    teardown3d();
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    initialized = false;
  }

  return {
    init,
    destroy,
    show,
    hide,
    analyzeWorkout,
    CORAL,
    MINT,
  };
})();

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => WorkoutCompleteMap.init());
  } else {
    WorkoutCompleteMap.init();
  }
}
