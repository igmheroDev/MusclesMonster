// ============================================================
// RECOVR - 운동 완료 축하 영상 (독립 모듈)
// 저장(#saveBtn) 직후, 이번 세션에서 가장 많이 성장한 개별 부위의
// 보디빌더 포즈 영상(5초)을 전체 화면으로 한 번 보여준다.
// - 성장 데이터: MuscleGrowthTracker.computeMuscleGrowth (읽기 전용)
// - 성장 데이터 없으면: 이번 세션에서 가장 많이 자극한 개별 부위
// - 근력 부위가 없고 유산소 분이 있으면: 유산소 장면
// - 아무것도 없으면: 건너뜀
// 기존 운동 완료 요약(WorkoutCompleteMap)은 그대로 아래에 뜨고,
// 이 영상 오버레이가 닫히면 그대로 보인다. 다른 모듈은 수정하지 않는다.
// ============================================================

const WorkoutCelebrateVideo = (() => {
  const STYLE_ID = 'workout-celebrate-video-styles';
  const OVERLAY_ID = 'wcvOverlay';
  const ASSET_DIR = 'assets/celebrate/';
  const LIME = '#b8ff3d';
  const TEAL = '#1aa88a';
  const LIME_THRESHOLD = 1.5;
  const TEXT_AT_SEC = 3.3;
  const AUTO_CLOSE_AFTER_END_MS = 1500;
  const COOLDOWN_MS = 1800;
  const SAVE_DELAY_MS = 120;
  const RECENT_SAVE_MS = 15000;

  // 장면(영상) → 부위 키 (bodyMap3d KO_LABELS 키 + app.js MUSCLE_ORDER 키)
  // 고유 근육 15개 + 유산소. 어깨 세부(전/측/후면)와 core/abs는 같은 장면으로 묶는다.
  // 우산 키 `back`(등)은 sceneForMuscle에서 광배/승모근/기립근 중 자극이 큰 쪽으로 보낸다.
  const SCENES = {
    chest:        { label: '가슴',     muscles: ['chest'] },
    shoulder:     { label: '어깨',     muscles: ['shoulder', 'front_delts', 'side_delts', 'rear_delts'] },
    biceps:       { label: '이두',     muscles: ['biceps'] },
    triceps:      { label: '삼두',     muscles: ['triceps'] },
    forearms:     { label: '전완',     muscles: ['forearms'] },
    lats:         { label: '광배',     muscles: ['lats'] },
    traps:        { label: '승모근',   muscles: ['traps'] },
    lower_back:   { label: '기립근',   muscles: ['lower_back'] },
    abs:          { label: '복근',     muscles: ['core', 'abs'] },
    obliques:     { label: '복사근',   muscles: ['obliques'] },
    quads:        { label: '대퇴사두', muscles: ['quads'] },
    adductors:    { label: '내전근',   muscles: ['adductors'] },
    glutes:       { label: '둔근',     muscles: ['glutes'] },
    hamstrings:   { label: '햄스트링', muscles: ['hamstrings'] },
    calves:       { label: '종아리',   muscles: ['calves'] },
    cardio:       { label: '유산소',   muscles: [] },
  };
  const SCENE_ORDER = [
    'chest', 'shoulder', 'biceps', 'triceps', 'forearms',
    'lats', 'traps', 'lower_back', 'abs', 'obliques',
    'quads', 'adductors', 'glutes', 'hamstrings', 'calves', 'cardio',
  ];
  const BACK_SCENES = ['lats', 'traps', 'lower_back'];

  const MUSCLE_TO_SCENE = {};
  SCENE_ORDER.forEach((scene) => {
    (SCENES[scene].muscles || []).forEach((m) => { MUSCLE_TO_SCENE[m] = scene; });
  });

  let initialized = false;
  let lastShownAt = 0;
  let active = null; // { overlay, video, timers, onKey }

  function sceneForMuscle(muscle, loads) {
    if (muscle === 'back') {
      const map = loads || {};
      const best = BACK_SCENES.reduce((acc, m) => ((map[m] || 0) > (map[acc] || 0) ? m : acc), 'lats');
      return best;
    }
    return MUSCLE_TO_SCENE[muscle] || null;
  }

  function videoUrl(scene) { return `${ASSET_DIR}${scene}.mp4`; }
  function posterUrl(scene) { return `${ASSET_DIR}${scene}-poster.jpg`; }

  function colorForPct(pct) {
    return (Number(pct) >= LIME_THRESHOLD) ? LIME : TEAL;
  }

  function formatPct(pct) {
    const n = Math.round((Number(pct) || 0) * 10) / 10;
    return `+${n.toFixed(1)}%`;
  }

  function formatMinutes(min) {
    const n = Math.max(0, Math.round(Number(min) || 0));
    return `${n}분`;
  }

  // 오버레이 문구 (순수 함수 — 테스트 대상)
  function overlayCopy(pick) {
    if (!pick || !SCENES[pick.scene]) return null;
    const label = pick.label || SCENES[pick.scene].label;
    if (pick.scene === 'cardio') {
      return { kicker: '오늘의 운동', bigText: `${label} ${formatMinutes(pick.minutes)}`, color: TEAL };
    }
    const hasPct = pick.pct != null && Number.isFinite(Number(pick.pct));
    if (hasPct) {
      return { kicker: '오늘의 성장', bigText: `${label} ${formatPct(pick.pct)}`, color: colorForPct(pick.pct) };
    }
    return { kicker: '오늘의 운동', bigText: `${label} 완료!`, color: TEAL };
  }

  function getCardioMinutes(workout, opts) {
    const o = opts || {};
    if (o.cardioMinutes != null) return Math.max(0, Number(o.cardioMinutes) || 0);
    try {
      if (typeof CardioTracker !== 'undefined' && CardioTracker.getWorkoutCardioMinutes) {
        return Math.max(0, CardioTracker.getWorkoutCardioMinutes(workout) || 0);
      }
    } catch (e) { /* ignore */ }
    if (workout && workout.type === 'cardio') {
      const fromEx = ((workout.exercises) || []).reduce((sum, ex) => {
        const m = ex && (parseInt(ex.durationMin, 10) || parseInt(ex.duration, 10) || 0);
        return sum + (m || 0);
      }, 0);
      if (fromEx > 0) return fromEx;
      return Math.max(0, parseInt(workout.duration, 10) || 0);
    }
    return 0;
  }

  function mergeBackLoad(loads) {
    const out = Object.assign({}, loads);
    if (!(out.back > 0)) return out;
    const best = BACK_SCENES.reduce((acc, m) => ((out[m] || 0) > (out[acc] || 0) ? m : acc), 'lats');
    out[best] = (out[best] || 0) + out.back;
    delete out.back;
    return out;
  }

  // ------------------------------------------------------------
  // 이번 세션 부위 자극량 (ExerciseMuscleMap 우선, 없으면 이름 키워드)
  // ------------------------------------------------------------
  function exerciseVolume(ex) {
    try {
      if (ex.mode === 'duration') {
        return (typeof getDurationLoad === 'function') ? (getDurationLoad(ex) || 1) : 1;
      }
      if (typeof getExerciseVolume === 'function') return getExerciseVolume(ex) || 1;
    } catch (e) { /* ignore */ }
    return 1;
  }

  function musclesForExercise(name) {
    const stim = (typeof ExerciseMuscleMap !== 'undefined' && ExerciseMuscleMap.getStimulation)
      ? (ExerciseMuscleMap.getStimulation(name) || {})
      : {};
    if (Object.keys(stim).length) return stim;
    const list = (typeof getMusclesFromExerciseName === 'function') ? getMusclesFromExerciseName(name) : [];
    const out = {};
    (list || []).forEach((m) => { out[m] = 2; });
    return out;
  }

  function sessionLoads(workout) {
    const loads = {};
    ((workout && workout.exercises) || []).forEach((ex) => {
      if (!ex || !ex.name) return;
      const stim = musclesForExercise(ex.name);
      const vol = exerciseVolume(ex);
      Object.keys(stim).forEach((m) => {
        loads[m] = (loads[m] || 0) + vol * ((stim[m] || 2) / 3);
      });
    });
    return loads;
  }

  function toMidday(dateStr) {
    return new Date(`${dateStr}T12:00:00`);
  }

  // ------------------------------------------------------------
  // 장면 고르기 (순수 함수 — 테스트 대상)
  // opts.growthFn(workouts, muscleKey, now) → { growthPct } | null
  // 반환: { scene, label, pct|null, minutes?, source: 'growth'|'trained'|'cardio' } | null
  // ------------------------------------------------------------
  function pickScene(workout, workouts, opts) {
    if (!workout) return null;
    const o = opts || {};
    const loads = mergeBackLoad(o.loads || sessionLoads(workout));
    const trained = Object.keys(loads).filter((m) => loads[m] > 0 && sceneForMuscle(m, loads));

    const growthFn = o.growthFn !== undefined ? o.growthFn
      : ((typeof MuscleGrowthTracker !== 'undefined' && MuscleGrowthTracker.computeMuscleGrowth)
        ? MuscleGrowthTracker.computeMuscleGrowth : null);
    const now = o.now || (workout.date ? toMidday(workout.date) : new Date());

    const byOrder = (a, b) => SCENE_ORDER.indexOf(a) - SCENE_ORDER.indexOf(b);

    if (trained.length) {
      // 1) 개별 근육 성장률 최대, 동점이면 자극량
      const growthByMuscle = {};
      trained.forEach((m) => {
        if (!growthFn) return;
        let g = null;
        try { g = growthFn(workouts || [], m, now); } catch (e) { g = null; }
        const pct = g && Number.isFinite(g.growthPct) ? g.growthPct : null;
        if (pct != null && pct > 0) growthByMuscle[m] = pct;
      });
      const growthMuscles = Object.keys(growthByMuscle).sort(byOrder);
      if (growthMuscles.length) {
        const best = growthMuscles.reduce((acc, m) => (
          growthByMuscle[m] > growthByMuscle[acc]
          || (growthByMuscle[m] === growthByMuscle[acc] && (loads[m] || 0) > (loads[acc] || 0)) ? m : acc
        ));
        const scene = sceneForMuscle(best, loads);
        return { scene, label: SCENES[scene].label, pct: growthByMuscle[best], source: 'growth' };
      }

      // 2) 성장 데이터 없음 → 가장 많이 자극한 개별 부위
      const loadMuscles = trained.slice().sort(byOrder);
      const top = loadMuscles.reduce((acc, m) => (loads[m] > loads[acc] ? m : acc));
      const scene = sceneForMuscle(top, loads);
      return { scene, label: SCENES[scene].label, pct: null, source: 'trained' };
    }

    // 3) 근력 장면 없음 → 유산소 분이 있으면 유산소 장면
    const minutes = getCardioMinutes(workout, o);
    if (minutes > 0) {
      return { scene: 'cardio', label: SCENES.cardio.label, pct: null, minutes, source: 'cardio' };
    }
    return null;
  }

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------
  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID} {
        position: fixed; inset: 0; z-index: 12200;
        background: #000;
        display: flex; align-items: center; justify-content: center;
        opacity: 0; transition: opacity .25s ease;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        overscroll-behavior: contain;
      }
      #${OVERLAY_ID}.show { opacity: 1; }
      #${OVERLAY_ID} .wcv-media {
        position: absolute; inset: 0; width: 100%; height: 100%;
        object-fit: cover; background: #000;
      }
      #${OVERLAY_ID} .wcv-shade {
        position: absolute; left: 0; right: 0; top: 0; height: 38%;
        background: linear-gradient(180deg, rgba(0,0,0,.55), rgba(0,0,0,0));
        pointer-events: none;
      }
      #${OVERLAY_ID} .wcv-text {
        position: absolute; left: 0; right: 0;
        top: calc(env(safe-area-inset-top, 0px) + 60px);
        text-align: center; pointer-events: none;
        opacity: 0; transform: translateY(10px);
        transition: opacity .45s ease, transform .45s ease;
      }
      #${OVERLAY_ID} .wcv-text.show { opacity: 1; transform: none; }
      #${OVERLAY_ID} .wcv-kicker {
        font-size: 14px; font-weight: 700; letter-spacing: .08em;
        color: rgba(255,255,255,.82); margin-bottom: 6px;
        text-shadow: 0 1px 6px rgba(0,0,0,.6);
      }
      #${OVERLAY_ID} .wcv-big {
        font-size: 38px; font-weight: 900; line-height: 1.1;
        color: var(--wcv-color, ${TEAL});
        text-shadow: 0 0 18px var(--wcv-color, ${TEAL}), 0 2px 10px rgba(0,0,0,.7);
        word-break: keep-all;
      }
      #${OVERLAY_ID} .wcv-skip {
        position: absolute; right: 14px;
        top: calc(env(safe-area-inset-top, 0px) + 14px);
        min-height: 40px; padding: 8px 16px; border-radius: 999px;
        border: 1px solid rgba(255,255,255,.35);
        background: rgba(0,0,0,.45); color: #fff;
        font-size: 14px; font-weight: 700;
      }
      #${OVERLAY_ID} .wcv-ok {
        position: absolute; left: 50%; transform: translateX(-50%);
        bottom: calc(env(safe-area-inset-bottom, 0px) + 28px);
        min-width: 160px; min-height: 48px; padding: 12px 28px; border-radius: 999px;
        border: 0; background: var(--wcv-color, ${TEAL}); color: #0b0b10;
        font-size: 16px; font-weight: 800;
      }
      #${OVERLAY_ID} .wcv-ok[hidden], #${OVERLAY_ID} .wcv-media[hidden] { display: none; }
      @media (prefers-reduced-motion: reduce) {
        #${OVERLAY_ID}, #${OVERLAY_ID} .wcv-text { transition: none; }
      }
    `;
    document.head.appendChild(style);
  }

  function clearTimers() {
    if (!active) return;
    active.timers.forEach((t) => window.clearTimeout(t));
    active.timers = [];
  }

  function hide() {
    if (!active) return false;
    const { overlay, video, onKey } = active;
    clearTimers();
    document.removeEventListener('keydown', onKey, true);
    if (video) {
      try { video.pause(); } catch (e) { /* ignore */ }
      video.removeAttribute('src');
      try { video.load(); } catch (e) { /* ignore */ }
    }
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    active = null;
    return true;
  }

  function showText() {
    if (!active || active.textShown) return;
    active.textShown = true;
    const t = active.overlay.querySelector('.wcv-text');
    if (t) t.classList.add('show');
  }

  function showPosterMode() {
    if (!active) return;
    const { overlay, video } = active;
    active.posterMode = true;
    if (video) {
      try { video.pause(); } catch (e) { /* ignore */ }
      video.hidden = true;
    }
    const img = overlay.querySelector('.wcv-poster');
    if (img) img.hidden = false;
    const ok = overlay.querySelector('.wcv-ok');
    if (ok) ok.hidden = false;
    showText();
  }

  // pick: { scene, label, pct } — 디버그/수동 호출도 가능
  function show(pick, options) {
    if (typeof document === 'undefined' || !pick || !SCENES[pick.scene]) return false;
    const o = options || {};
    const now = Date.now();
    if (!o.force && now - lastShownAt < COOLDOWN_MS) return false;
    lastShownAt = now;
    hide();
    ensureStyles();

    const scene = pick.scene;
    const copy = overlayCopy(pick);
    const color = copy.color;
    const bigText = copy.bigText;
    const kicker = copy.kicker;
    const reduced = o.reducedMotion != null ? !!o.reducedMotion : prefersReducedMotion();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', `${kicker} ${bigText}`);
    overlay.dataset.scene = scene;
    overlay.style.setProperty('--wcv-color', color);
    overlay.innerHTML = `
      <img class="wcv-media wcv-poster" src="${posterUrl(scene)}" alt="" hidden>
      <video class="wcv-media wcv-video" muted playsinline webkit-playsinline preload="auto"
        poster="${posterUrl(scene)}" disablepictureinpicture></video>
      <div class="wcv-shade"></div>
      <div class="wcv-text">
        <div class="wcv-kicker">${kicker}</div>
        <div class="wcv-big">${bigText}</div>
      </div>
      <button type="button" class="wcv-skip" data-wcv-close>건너뛰기</button>
      <button type="button" class="wcv-ok" data-wcv-close hidden>확인</button>`;

    const video = overlay.querySelector('video');
    const onKey = (e) => { if (e.key === 'Escape') hide(); };
    active = { overlay, video, timers: [], onKey, textShown: false, posterMode: false, scene };

    // 아무 곳이나 탭하면 닫기 (버튼 포함)
    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      hide();
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    // 다음 프레임에 페이드인
    window.requestAnimationFrame(() => { if (active && active.overlay === overlay) overlay.classList.add('show'); });

    if (reduced) {
      showPosterMode();
      return true;
    }

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.addEventListener('timeupdate', () => {
      if (video.currentTime >= TEXT_AT_SEC) showText();
    });
    video.addEventListener('ended', () => {
      showText();
      if (!active || active.video !== video) return;
      active.timers.push(window.setTimeout(hide, AUTO_CLOSE_AFTER_END_MS));
    });
    video.addEventListener('error', () => { if (active && active.video === video) showPosterMode(); });
    video.src = videoUrl(scene);

    let started = false;
    video.addEventListener('playing', () => {
      if (started || !active || active.video !== video) return;
      started = true;
      // timeupdate가 드문 환경 대비 보조 타이머
      active.timers.push(window.setTimeout(showText, TEXT_AT_SEC * 1000 + 150));
    });

    try {
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => { if (active && active.video === video) showPosterMode(); });
      }
    } catch (e) {
      showPosterMode();
    }
    // 4초 안에 재생 시작 못 하면 포스터+텍스트로
    active.timers.push(window.setTimeout(() => {
      if (active && active.video === video && !started) showPosterMode();
    }, 4000));
    return true;
  }

  function isOpen() { return !!active; }

  // ------------------------------------------------------------
  // 저장 감지 (WorkoutCompleteMap과 같은 캡처 단계 방식)
  // ------------------------------------------------------------
  function latestJustSaved() {
    let workouts = [];
    try {
      workouts = (typeof loadWorkouts === 'function') ? loadWorkouts() : [];
    } catch (e) {
      return null;
    }
    const completed = (workouts || []).filter((w) => w && !w.inProgress && w.date);
    if (!completed.length) return null;
    const ts = (w) => new Date(w.updatedAt || w.createdAt || 0).getTime() || 0;
    const latest = completed.reduce((acc, w) => (ts(w) >= ts(acc) ? w : acc));
    if (Date.now() - ts(latest) > RECENT_SAVE_MS) return null;
    return { workout: latest, workouts };
  }

  function handleSaved() {
    const found = latestJustSaved();
    if (!found) return false;
    let pick = null;
    try { pick = pickScene(found.workout, found.workouts); } catch (e) { pick = null; }
    if (!pick) return false;
    return show(pick);
  }

  function onClickCapture(e) {
    const saveBtn = e.target && e.target.closest && e.target.closest('#saveBtn');
    if (!saveBtn || saveBtn.disabled) return;
    window.setTimeout(() => {
      const modal = document.getElementById('modalOverlay');
      const closed = !modal || !modal.classList.contains('show');
      if (!closed) return; // 검증 실패 등으로 저장되지 않음
      handleSaved();
    }, SAVE_DELAY_MS);
  }

  function init() {
    if (initialized || typeof document === 'undefined') return false;
    initialized = true;
    document.addEventListener('click', onClickCapture, true);
    return true;
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  const api = {
    init,
    show,
    hide,
    isOpen,
    pickScene,
    sceneForMuscle,
    colorForPct,
    formatPct,
    formatMinutes,
    overlayCopy,
    getCardioMinutes,
    handleSaved,
    SCENES,
    SCENE_ORDER,
    MUSCLE_TO_SCENE,
    videoUrl,
    posterUrl,
  };
  if (typeof window !== 'undefined') window.WorkoutCelebrateVideo = api;
  return api;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = WorkoutCelebrateVideo;
