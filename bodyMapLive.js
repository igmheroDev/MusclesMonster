// ============================================================
// RECOVR - 운동 기록 중 실시간 2D 바디맵 (독립 모듈)
// MuscleHeatmap 경로 / ExerciseMuscleMap 자극을 참조만 함
// ============================================================

const BodyMapLive = (() => {
  const STYLE_ID = 'body-map-live-styles';
  const HOST_ID = 'bodyMapLiveHost';
  const CORAL = '#ff3b5c';
  const MINT = '#3ee6b0';
  const VIEWBOX_W = 240;
  const VIEWBOX_H = 360;

  // 후면 주로 보이는 근육 → 자동 플립용
  const BACK_PRIMARY = new Set(['back', 'triceps', 'hamstrings']);

  let initialized = false;
  let currentView = 'front';
  let lastLoads = {}; // muscle -> load score
  let lastPop = null; // { muscle, delta }
  let reducedMotion = false;
  let mq = null;
  let modalObserver = null;

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
      #${HOST_ID} {
        margin: 0 0 14px;
      }
      .bml-card {
        position: relative;
        background: var(--card, #1a1a24);
        border: 1px solid var(--border, #2a2a3a);
        border-radius: 16px;
        padding: 12px 12px 10px;
        overflow: hidden;
      }
      .bml-accent {
        position: absolute;
        left: 0; right: 0; top: 0;
        height: 2px;
        background: linear-gradient(90deg, ${CORAL}, ${MINT});
      }
      .bml-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
      }
      .bml-title {
        font-size: 12.5px;
        font-weight: 700;
        letter-spacing: -0.01em;
        color: var(--text, #e8e8f0);
      }
      .bml-sub {
        font-size: 10px;
        color: var(--muted, #6b6b85);
        margin-top: 2px;
      }
      .bml-flip {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        border: 1px solid rgba(62, 230, 176, 0.35);
        background: rgba(62, 230, 176, 0.08);
        color: ${MINT};
        border-radius: 999px;
        width: 52px;
        height: 52px;
        justify-content: center;
        cursor: pointer;
        font-size: 10px;
        font-weight: 700;
        padding: 0;
      }
      .bml-flip:active { transform: scale(0.96); }
      .bml-flip-icon { font-size: 16px; line-height: 1; }
      .bml-stage {
        perspective: 900px;
        width: min(100%, 220px);
        margin: 0 auto;
      }
      .bml-flipper {
        position: relative;
        width: 100%;
        transform-style: preserve-3d;
        transition: transform 0.55s cubic-bezier(0.4, 0.15, 0.2, 1);
      }
      .bml-flipper.is-back { transform: rotateY(180deg); }
      .bml-face {
        width: 100%;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
      }
      .bml-face--back {
        position: absolute;
        inset: 0;
        transform: rotateY(180deg);
      }
      .bml-svg { width: 100%; height: auto; display: block; }
      .bml-region {
        transition: fill-opacity 0.35s ease, fill 0.35s ease;
        cursor: pointer;
      }
      .bml-pop {
        position: absolute;
        z-index: 3;
        pointer-events: none;
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: 13px;
        color: #fff;
        background: ${CORAL};
        border: 1.5px solid rgba(255,255,255,0.85);
        border-radius: 999px;
        padding: 3px 8px;
        box-shadow: 0 4px 14px rgba(255, 59, 92, 0.45);
        animation: bml-pop-in 0.7s ease both;
        white-space: nowrap;
      }
      .bml-load-row {
        margin-top: 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .bml-load-label {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: var(--muted, #6b6b85);
      }
      .bml-load-label b { color: ${MINT}; font-weight: 700; }
      .bml-load-track {
        height: 7px;
        border-radius: 999px;
        background: rgba(255,255,255,0.06);
        overflow: hidden;
      }
      .bml-load-fill {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, rgba(255,59,92,0.55), ${CORAL});
        transition: width 0.4s ease;
        width: 0%;
      }
      .bml-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      .bml-tag {
        font-size: 10.5px;
        padding: 4px 8px;
        border-radius: 999px;
        border: 1px solid rgba(255,59,92,0.35);
        background: rgba(255,59,92,0.1);
        color: var(--text, #e8e8f0);
      }
      .bml-tag span {
        display: inline-block;
        width: 7px; height: 7px;
        border-radius: 50%;
        background: ${CORAL};
        margin-right: 5px;
        opacity: var(--bml-op, 0.5);
      }
      .bml-empty {
        text-align: center;
        font-size: 11px;
        color: var(--muted, #6b6b85);
        padding: 8px 4px 4px;
      }
      @media (prefers-reduced-motion: reduce) {
        .bml-flipper { transition: none !important; }
        .bml-region { transition: none !important; }
        .bml-pop { animation: none !important; }
        .bml-load-fill { transition: none !important; }
      }
      @keyframes bml-pop-in {
        0% { opacity: 0; transform: translate(-50%, 8px) scale(0.7); }
        25% { opacity: 1; transform: translate(-50%, -4px) scale(1.08); }
        100% { opacity: 0; transform: translate(-50%, -28px) scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  function getRegions(view) {
    if (typeof MuscleHeatmap === 'undefined') return [];
    return view === 'back' ? (MuscleHeatmap.BACK_REGIONS || []) : (MuscleHeatmap.FRONT_REGIONS || []);
  }

  function assetUrl(path) {
    const ver = (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.ASSET_VERSION)
      ? MuscleHeatmap.ASSET_VERSION
      : 'v53';
    return `${path}?v=${ver}`;
  }

  function getBodyAssets(view) {
    const images = (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.BODY_IMAGES)
      ? MuscleHeatmap.BODY_IMAGES
      : { front: 'body-map-front.png', back: 'body-map-back.png' };
    const masks = (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.BODY_MASKS)
      ? MuscleHeatmap.BODY_MASKS
      : { front: 'body-mask-front.png', back: 'body-mask-back.png' };
    return {
      image: assetUrl(images[view] || images.front),
      mask: assetUrl(masks[view] || masks.front),
    };
  }

  function getMuscleLabel(key) {
    if (typeof MUSCLE_LABELS !== 'undefined' && MUSCLE_LABELS[key]) return MUSCLE_LABELS[key].name;
    if (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.getShortName) return MuscleHeatmap.getShortName(key);
    return key;
  }

  function intensityOpacity(load) {
    if (!load || load <= 0) return 0;
    // 세트/볼륨이 쌓일수록 진해짐 (최대 0.82)
    return Math.max(0.18, Math.min(0.82, 0.16 + load * 0.12));
  }

  function buildFace(view, loads, pop) {
    const regions = getRegions(view);
    const assets = getBodyAssets(view);
    const maskId = `bmlMask-${view}`;
    const paths = regions.map((region) => {
      const load = loads[region.muscle] || 0;
      const opacity = intensityOpacity(load);
      const fill = load > 0 ? CORAL : 'transparent';
      return `<path class="bml-region" data-muscle="${region.muscle}" data-view="${view}"
        d="${region.d}" fill="${fill}" fill-opacity="${opacity}" stroke="none"></path>`;
    }).join('');

    let popHtml = '';
    if (pop && pop.muscle && pop.delta > 0) {
      const hit = regions.find((r) => r.muscle === pop.muscle);
      if (hit) {
        // path 대략 중심: 라벨 좌표 우선
        const pos = (typeof MuscleHeatmap !== 'undefined'
          && MuscleHeatmap.LABEL_POSITIONS
          && MuscleHeatmap.LABEL_POSITIONS[view]
          && MuscleHeatmap.LABEL_POSITIONS[view][pop.muscle])
          || { x: 120, y: 100 };
        const pctX = (pos.x / VIEWBOX_W) * 100;
        const pctY = (pos.y / VIEWBOX_H) * 100;
        popHtml = `<div class="bml-pop" style="left:${pctX}%;top:${pctY}%;transform:translate(-50%,-50%)">+${escapeHtml(String(pop.delta))}</div>`;
      }
    }

    return `
      <div class="bml-face-inner" style="position:relative">
        <svg class="bml-svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" role="img"
          aria-label="실시간 자극 바디맵 ${view === 'back' ? '후면' : '전면'}">
          <defs>
            <mask id="${maskId}">
              <image href="${assets.mask}" x="0" y="0" width="${VIEWBOX_W}" height="${VIEWBOX_H}"
                preserveAspectRatio="xMidYMid meet"/>
            </mask>
          </defs>
          <image href="${assets.image}" x="0" y="0" width="${VIEWBOX_W}" height="${VIEWBOX_H}"
            preserveAspectRatio="xMidYMid meet" pointer-events="none"/>
          <g mask="url(#${maskId})" style="mix-blend-mode:multiply">${paths}</g>
        </svg>
        ${popHtml}
      </div>`;
  }

  function computeSessionLoads() {
    const loads = {};
    if (typeof extractExercisesFromForm !== 'function') return loads;

    let exercises = [];
    try { exercises = extractExercisesFromForm() || []; } catch (e) { return loads; }

    exercises.forEach((ex) => {
      if (!ex || !ex.name) return;
      const stim = (typeof ExerciseMuscleMap !== 'undefined' && ExerciseMuscleMap.getStimulation)
        ? ExerciseMuscleMap.getStimulation(ex.name)
        : {};
      const muscles = Object.keys(stim).length
        ? Object.keys(stim)
        : ((typeof getMusclesFromExerciseName === 'function') ? getMusclesFromExerciseName(ex.name) : []);

      if (!muscles.length) return;

      let completedSets = 0;
      let volume = 0;
      if (ex.mode === 'duration') {
        if (ex.durationSets && ex.durationSets.length) {
          completedSets = ex.durationSets.filter((s) => s.completed).length;
          volume = (typeof getDurationLoad === 'function') ? getDurationLoad(ex) : completedSets * 30;
        } else if (ex.durationMin) {
          completedSets = 1;
          volume = (ex.durationMin || 0) * 10;
        }
      } else if (ex.setDetails && ex.setDetails.length) {
        ex.setDetails.forEach((s) => {
          if (!s.completed) return;
          completedSets += 1;
          volume += (s.weight || 0) * (s.reps || 0);
        });
      }

      if (completedSets <= 0 && volume <= 0) return;

      muscles.forEach((m) => {
        const level = stim[m] || 2;
        const score = completedSets * (level / 3) + (volume / 800) * (level / 3);
        loads[m] = (loads[m] || 0) + score;
      });
    });

    return loads;
  }

  function pickPrimaryMuscle(loads) {
    let best = null;
    let bestScore = 0;
    Object.keys(loads).forEach((m) => {
      if (loads[m] > bestScore) {
        bestScore = loads[m];
        best = m;
      }
    });
    return best;
  }

  function desiredViewForMuscle(muscle) {
    if (!muscle) return currentView;
    return BACK_PRIMARY.has(muscle) ? 'back' : 'front';
  }

  function ensureHost() {
    const modal = document.querySelector('#modalOverlay .modal');
    if (!modal) return null;
    let host = document.getElementById(HOST_ID);
    if (host) return host;
    host = document.createElement('div');
    host.id = HOST_ID;
    // 피로도 섹션 앞(운동 항목 위)에 삽입해 로깅 흐름과 맞춤
    const exerciseGroup = modal.querySelector('#exerciseRows')?.closest('.form-group');
    if (exerciseGroup && exerciseGroup.parentNode) {
      exerciseGroup.parentNode.insertBefore(host, exerciseGroup);
    } else {
      modal.insertBefore(host, modal.querySelector('.save-btn'));
    }
    return host;
  }

  function render(options = {}) {
    ensureStyles();
    const host = ensureHost();
    if (!host) return false;

    const loads = options.loads || computeSessionLoads();
    const pop = options.pop || null;
    lastLoads = loads;
    lastPop = pop;

    const primary = pickPrimaryMuscle(loads);
    if (options.autoFlip !== false && primary) {
      const want = desiredViewForMuscle(primary);
      if (want !== currentView) currentView = want;
    }

    const entries = Object.keys(loads)
      .map((m) => ({ muscle: m, load: loads[m], label: getMuscleLabel(m) }))
      .sort((a, b) => b.load - a.load);

    const top = entries[0];
    const loadPct = top ? Math.min(100, Math.round(top.load * 18)) : 0;
    const hasData = entries.length > 0;

    host.innerHTML = `
      <div class="bml-card">
        <div class="bml-accent"></div>
        <div class="bml-header">
          <div>
            <div class="bml-title">실시간 자극 맵</div>
            <div class="bml-sub">${hasData ? '세트 완료 시 부위가 진해져요' : '세트를 완료하면 자극 부위가 표시돼요'}</div>
          </div>
          <button type="button" class="bml-flip" data-bml-flip aria-label="전면 후면 전환">
            <span class="bml-flip-icon" aria-hidden="true">↻</span>
            <span>${currentView === 'back' ? '후면' : '전면'}</span>
          </button>
        </div>
        <div class="bml-stage">
          <div class="bml-flipper ${currentView === 'back' ? 'is-back' : ''}" data-bml-flipper>
            <div class="bml-face bml-face--front">${buildFace('front', loads, currentView === 'front' ? pop : null)}</div>
            <div class="bml-face bml-face--back">${buildFace('back', loads, currentView === 'back' ? pop : null)}</div>
          </div>
        </div>
        ${hasData ? `
          <div class="bml-load-row">
            <div class="bml-load-label"><span>${escapeHtml(top.label)} 부하</span><b>${loadPct}%</b></div>
            <div class="bml-load-track"><div class="bml-load-fill" style="width:${loadPct}%"></div></div>
          </div>
          <div class="bml-tags">
            ${entries.slice(0, 4).map((e) => `
              <span class="bml-tag" style="--bml-op:${intensityOpacity(e.load)}">
                <span></span>${escapeHtml(e.label)}
              </span>`).join('')}
          </div>
        ` : `<div class="bml-empty">아직 완료된 세트가 없어요</div>`}
      </div>`;

    const flipBtn = host.querySelector('[data-bml-flip]');
    if (flipBtn) {
      flipBtn.addEventListener('click', (e) => {
        e.preventDefault();
        flipView();
      });
    }

    if (pop && !reducedMotion) {
      window.setTimeout(() => {
        if (lastPop === pop) {
          lastPop = null;
          render({ loads: lastLoads, pop: null, autoFlip: false });
        }
      }, 750);
    }
    return true;
  }

  function flipView() {
    currentView = currentView === 'back' ? 'front' : 'back';
    const flipper = document.querySelector('[data-bml-flipper]');
    if (flipper && !reducedMotion) {
      flipper.classList.toggle('is-back', currentView === 'back');
      // 라벨/팝 동기화를 위해 짧은 딜레이 후 전체 리렌더
      window.setTimeout(() => render({ loads: lastLoads, pop: null, autoFlip: false }), reducedMotion ? 0 : 280);
    } else {
      render({ loads: lastLoads, pop: null, autoFlip: false });
    }
  }

  function diffLoads(prev, next) {
    let muscle = null;
    let delta = 0;
    Object.keys(next).forEach((m) => {
      const d = (next[m] || 0) - (prev[m] || 0);
      if (d > delta) {
        delta = d;
        muscle = m;
      }
    });
    if (!muscle || delta <= 0) return null;
    // UI용 +N: 세트 단위에 가깝게 반올림
    const n = Math.max(1, Math.round(delta * 2.2));
    return { muscle, delta: n };
  }

  function refreshFromForm(fromSetComplete) {
    const prev = { ...lastLoads };
    const next = computeSessionLoads();
    const pop = fromSetComplete ? diffLoads(prev, next) : null;
    render({ loads: next, pop, autoFlip: !!fromSetComplete });
  }

  function isModalOpen() {
    return !!document.getElementById('modalOverlay')?.classList.contains('show');
  }

  function onDocumentClick(e) {
    if (!isModalOpen()) return;
    const check = e.target.closest('.set-check, .duration-check');
    if (check) {
      window.requestAnimationFrame(() => {
        window.setTimeout(() => refreshFromForm(true), 30);
      });
      return;
    }
    if (e.target.closest('.add-set-btn, .set-del, .duration-set-del, .row-del, .row-mode-toggle')) {
      window.setTimeout(() => refreshFromForm(false), 40);
    }
  }

  function onDocumentInput(e) {
    if (!isModalOpen()) return;
    if (!e.target.closest('#exerciseRows')) return;
    window.setTimeout(() => refreshFromForm(false), 80);
  }

  function watchModal() {
    const overlay = document.getElementById('modalOverlay');
    if (!overlay || typeof MutationObserver === 'undefined') return;
    modalObserver = new MutationObserver(() => {
      if (isModalOpen()) {
        window.setTimeout(() => render({ autoFlip: true }), 50);
      }
    });
    modalObserver.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  }

  function onMotionChange(e) {
    reducedMotion = !!(e && e.matches);
  }

  function init() {
    if (initialized || typeof document === 'undefined') return false;
    initialized = true;
    reducedMotion = prefersReducedMotion();
    ensureStyles();
    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('input', onDocumentInput, true);
    watchModal();
    if (window.matchMedia) {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mq.addEventListener) mq.addEventListener('change', onMotionChange);
      else if (mq.addListener) mq.addListener(onMotionChange);
    }
    if (isModalOpen()) render({ autoFlip: true });
    return true;
  }

  function destroy() {
    if (!initialized) return;
    document.removeEventListener('click', onDocumentClick, true);
    document.removeEventListener('input', onDocumentInput, true);
    if (modalObserver) { modalObserver.disconnect(); modalObserver = null; }
    if (mq) {
      if (mq.removeEventListener) mq.removeEventListener('change', onMotionChange);
      else if (mq.removeListener) mq.removeListener(onMotionChange);
      mq = null;
    }
    const host = document.getElementById(HOST_ID);
    if (host && host.parentNode) host.parentNode.removeChild(host);
    initialized = false;
  }

  return {
    init,
    destroy,
    render,
    refreshFromForm,
    flipView,
    computeSessionLoads,
    intensityOpacity,
    CORAL,
    MINT,
    BACK_PRIMARY,
  };
})();

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BodyMapLive.init());
  } else {
    BodyMapLive.init();
  }
}
