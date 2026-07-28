// ============================================================
// RECOVR - 운동 자극 히트맵 UI (독립 모듈)
// 1) 종목 피커에서 운동 자극 부위 히트맵 미리보기
// 2) 홈 히트맵 부위 탭 → 관련 운동 목록
// MuscleHeatmap / ExercisePicker 기능을 덮어쓰지 않고 연결만 함
// ============================================================

const ExerciseStimHeatmap = (() => {
  const VIEWBOX_W = 240;
  const VIEWBOX_H = 360;

  let currentView = 'front';
  let currentExercise = null;
  let currentMuscle = null;
  let pickerHooked = false;
  let homeHooked = false;
  let pickerObserver = null;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function getMap() {
    return typeof ExerciseMuscleMap !== 'undefined' ? ExerciseMuscleMap : null;
  }

  function getMuscleLabel(muscleKey) {
    if (typeof MUSCLE_LABELS !== 'undefined' && MUSCLE_LABELS[muscleKey]) {
      return MUSCLE_LABELS[muscleKey].name;
    }
    if (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.getShortName) {
      return MuscleHeatmap.getShortName(muscleKey);
    }
    return muscleKey;
  }

  function getShortName(muscleKey) {
    if (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.SHORT_NAMES) {
      return MuscleHeatmap.SHORT_NAMES[muscleKey] || getMuscleLabel(muscleKey);
    }
    return getMuscleLabel(muscleKey);
  }

  function assetUrl(path) {
    const ver = 'v53';
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

  function getRegions(view) {
    if (typeof MuscleHeatmap === 'undefined') return [];
    return view === 'back' ? (MuscleHeatmap.BACK_REGIONS || []) : (MuscleHeatmap.FRONT_REGIONS || []);
  }

  function getLabelPositions(view) {
    if (typeof MuscleHeatmap === 'undefined') return {};
    return (MuscleHeatmap.LABEL_POSITIONS && MuscleHeatmap.LABEL_POSITIONS[view]) || {};
  }

  function buildStimPaths(view, stim) {
    const map = getMap();
    const regions = getRegions(view);
    return regions.map((region) => {
      const level = stim[region.muscle] || 0;
      const label = getMuscleLabel(region.muscle);
      const fill = level && map ? map.getLevelColor(level) : 'transparent';
      const opacity = level && map ? map.getLevelOpacity(level) : 0;
      const levelLabel = level && map ? (map.LEVEL_LABELS[level] || '') : '';
      const title = level ? `${label} · ${levelLabel}` : `${label} (자극 없음)`;
      const cls = level >= 3 ? 'esh-region--primary' : (level >= 2 ? 'esh-region--secondary' : (level ? 'esh-region--assist' : 'esh-region--idle'));

      return `<path class="esh-region ${cls}" data-muscle="${region.muscle}" data-level="${level}"
        d="${region.d}" fill="${fill}" fill-opacity="${opacity}" stroke="none" pointer-events="all">
        <title>${title}</title>
      </path>`;
    }).join('');
  }

  function buildStimLabels(view, stim) {
    const positions = getLabelPositions(view);
    const map = getMap();
    const labeled = new Set();

    return Object.keys(positions).map((muscle) => {
      if (labeled.has(muscle)) return '';
      labeled.add(muscle);
      const pos = positions[muscle];
      const level = stim[muscle] || 0;
      const name = getShortName(muscle);
      if (!level) {
        return `<text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="middle"
          class="esh-region-label esh-region-label--idle" pointer-events="none">${escapeHtml(name)}</text>`;
      }
      const levelLabel = map ? (map.LEVEL_LABELS[level] || '') : '';
      return `<text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="middle"
          class="esh-region-label esh-region-label--active" pointer-events="none">
          <tspan x="${pos.x}" dy="-5" class="esh-region-name">${escapeHtml(name)}</tspan>
          <tspan x="${pos.x}" dy="12" class="esh-region-level">${escapeHtml(levelLabel)}</tspan>
        </text>`;
    }).join('');
  }

  function buildStimSvg(view, stim) {
    const assets = getBodyAssets(view);
    const maskId = `eshMask-${view}`;
    return `
      <svg class="esh-svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" role="img"
        aria-label="운동 자극 히트맵 ${view === 'back' ? '후면' : '전면'}">
        <defs>
          <mask id="${maskId}">
            <image href="${assets.mask}" x="0" y="0" width="${VIEWBOX_W}" height="${VIEWBOX_H}"
              preserveAspectRatio="xMidYMid meet"/>
          </mask>
        </defs>
        <image class="esh-body-image" href="${assets.image}" x="0" y="0" width="${VIEWBOX_W}" height="${VIEWBOX_H}"
          preserveAspectRatio="xMidYMid meet" pointer-events="none"/>
        <g class="esh-muscles" mask="url(#${maskId})" style="mix-blend-mode:multiply">
          ${buildStimPaths(view, stim)}
        </g>
        <g class="esh-labels">${buildStimLabels(view, stim)}</g>
      </svg>`;
  }

  function buildLegend() {
    return `
      <span class="esh-legend-item"><span class="esh-legend-dot" style="background:var(--red)"></span>주자극</span>
      <span class="esh-legend-item"><span class="esh-legend-dot" style="background:var(--orange)"></span>보조</span>
      <span class="esh-legend-item"><span class="esh-legend-dot" style="background:var(--yellow)"></span>협응</span>`;
  }

  function buildMuscleChips(entries) {
    if (!entries.length) {
      return `<div class="esh-chip-empty">이 운동의 근육 매핑이 없어요</div>`;
    }
    return entries.map((e) => `
      <button type="button" class="esh-chip esh-chip--lv${e.level}"
        onclick="ExerciseStimHeatmap.openMuscle('${e.muscle}')">
        <span class="esh-chip-icon">${escapeHtml(e.icon)}</span>
        <span class="esh-chip-name">${escapeHtml(e.label)}</span>
        <span class="esh-chip-lv">${escapeHtml(e.levelLabel)}</span>
      </button>`).join('');
  }

  // ── 운동 자극 미리보기 시트 ────────────────────────────────
  function openExercise(name, options = {}) {
    const overlay = document.getElementById('eshExerciseOverlay');
    if (!overlay || !name) return;

    currentExercise = name;
    currentMuscle = null;
    currentView = 'front';

    const map = getMap();
    const stim = map ? map.getStimulation(name) : {};
    const entries = map ? map.getStimulationEntries(name) : [];
    const showAdd = options.showAdd !== false && typeof ExercisePicker !== 'undefined';

    overlay.innerHTML = `
      <div class="esh-sheet" onclick="event.stopPropagation()">
        <div class="esh-sheet-header">
          <div>
            <div class="esh-sheet-kicker">자극 부위</div>
            <div class="esh-sheet-title">${escapeHtml(name)}</div>
          </div>
          <button type="button" class="esh-sheet-close" onclick="ExerciseStimHeatmap.closeExercise()">닫기</button>
        </div>
        <div class="esh-toggle">
          <button type="button" class="esh-toggle-btn selected" data-view="front">전면</button>
          <button type="button" class="esh-toggle-btn" data-view="back">후면</button>
        </div>
        <div class="esh-body-wrap" id="eshExerciseBody">
          ${buildStimSvg(currentView, stim)}
        </div>
        <div class="esh-legend">${buildLegend()}</div>
        <div class="esh-chips" id="eshExerciseChips">${buildMuscleChips(entries)}</div>
        <div class="esh-actions">
          ${showAdd ? `<button type="button" class="esh-primary-btn" onclick="ExerciseStimHeatmap.addCurrentExercise()">이 운동 추가</button>` : ''}
          <button type="button" class="esh-secondary-btn" onclick="ExerciseStimHeatmap.closeExercise()">확인</button>
        </div>
      </div>`;

    overlay.classList.add('show');
    overlay.querySelectorAll('.esh-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentView = btn.dataset.view === 'back' ? 'back' : 'front';
        overlay.querySelectorAll('.esh-toggle-btn').forEach((b) => {
          b.classList.toggle('selected', b.dataset.view === currentView);
        });
        const body = document.getElementById('eshExerciseBody');
        if (body) body.innerHTML = buildStimSvg(currentView, stim);
      });
    });
  }

  function closeExercise() {
    const overlay = document.getElementById('eshExerciseOverlay');
    if (overlay) overlay.classList.remove('show');
    currentExercise = null;
  }

  function closeExerciseOnOverlay(e) {
    if (e.target.id === 'eshExerciseOverlay') closeExercise();
  }

  function addCurrentExercise() {
    if (!currentExercise || typeof ExercisePicker === 'undefined') return;
    const name = currentExercise;
    closeExercise();
    ExercisePicker.select(name);
  }

  // ── 근육 → 운동 목록 시트 ──────────────────────────────────
  function openMuscle(muscleKey) {
    const overlay = document.getElementById('eshMuscleOverlay');
    const map = getMap();
    if (!overlay || !map || !muscleKey) return;

    currentMuscle = muscleKey;
    const label = getMuscleLabel(muscleKey);
    const icon = (typeof MUSCLE_LABELS !== 'undefined' && MUSCLE_LABELS[muscleKey])
      ? MUSCLE_LABELS[muscleKey].icon
      : '🎯';
    const list = map.getExercisesForMuscle(muscleKey, { minLevel: 1, limit: 36 });

    const listHtml = list.length
      ? list.map((item) => {
        const encoded = encodeURIComponent(item.name);
        return `
          <button type="button" class="esh-ex-item" onclick="ExerciseStimHeatmap.openExercise(decodeURIComponent('${encoded}'), { showAdd: false })">
            <div class="esh-ex-main">
              <div class="esh-ex-name">${escapeHtml(item.name)}</div>
              <div class="esh-ex-meta">${escapeHtml(item.levelLabel)} · 탭하면 자극 히트맵</div>
            </div>
            <span class="esh-ex-badge esh-ex-badge--lv${item.level}">${escapeHtml(item.levelLabel)}</span>
          </button>`;
      }).join('')
      : `<div class="esh-empty">이 부위를 자극하는 등록 운동이 없어요</div>`;

    overlay.innerHTML = `
      <div class="esh-sheet esh-sheet--list" onclick="event.stopPropagation()">
        <div class="esh-sheet-header">
          <div>
            <div class="esh-sheet-kicker">부위별 운동</div>
            <div class="esh-sheet-title">${escapeHtml(icon)} ${escapeHtml(label)}</div>
          </div>
          <button type="button" class="esh-sheet-close" onclick="ExerciseStimHeatmap.closeMuscle()">닫기</button>
        </div>
        <div class="esh-list-hint">주자극 운동부터 보여줘요. 종목을 탭하면 자극 히트맵을 볼 수 있어요.</div>
        <div class="esh-ex-list">${listHtml}</div>
      </div>`;

    overlay.classList.add('show');
  }

  function closeMuscle() {
    const overlay = document.getElementById('eshMuscleOverlay');
    if (overlay) overlay.classList.remove('show');
    currentMuscle = null;
  }

  function closeMuscleOnOverlay(e) {
    if (e.target.id === 'eshMuscleOverlay') closeMuscle();
  }

  // ── 종목 피커 강화 ─────────────────────────────────────────
  function enhancePickerItems() {
    const list = document.getElementById('exPickerList');
    if (!list) return;

    list.querySelectorAll('.ex-picker-item').forEach((item) => {
      if (item.dataset.stimEnhanced === '1') return;
      item.dataset.stimEnhanced = '1';

      const onclick = item.getAttribute('onclick') || '';
      const match = onclick.match(/decodeURIComponent\('([^']+)'\)/);
      if (!match) return;
      const encoded = match[1];

      item.classList.add('ex-picker-item--with-stim');
      const stimBtn = document.createElement('span');
      stimBtn.setAttribute('role', 'button');
      stimBtn.tabIndex = 0;
      stimBtn.className = 'ex-picker-stim-btn';
      stimBtn.setAttribute('aria-label', '자극 부위 보기');
      stimBtn.textContent = '자극';
      const openStim = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openExercise(decodeURIComponent(encoded), { showAdd: true });
      };
      stimBtn.addEventListener('click', openStim);
      stimBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') openStim(e);
      });
      item.appendChild(stimBtn);
    });
  }

  function hookPicker() {
    if (pickerHooked) return;
    pickerHooked = true;

    const list = document.getElementById('exPickerList');
    if (list && typeof MutationObserver !== 'undefined') {
      pickerObserver = new MutationObserver(() => enhancePickerItems());
      pickerObserver.observe(list, { childList: true, subtree: false });
    }

    // open 직후에도 강화
    if (typeof ExercisePicker !== 'undefined' && ExercisePicker.open) {
      const origOpen = ExercisePicker.open.bind(ExercisePicker);
      ExercisePicker.open = function wrappedOpen(...args) {
        const result = origOpen(...args);
        setTimeout(enhancePickerItems, 0);
        setTimeout(enhancePickerItems, 120);
        return result;
      };
    }
  }

  // ── 홈 히트맵 연결 ─────────────────────────────────────────
  function buildBrowseEmptyCard() {
    const stim = {}; // 빈 자극 = 윤곽만
    return `
      <div class="mh-card esh-home-browse">
        <div class="mh-accent-bar"></div>
        <div class="mh-header">
          <div class="mh-title">💪 근육 회복 히트맵</div>
          <div class="mh-toggle">
            <button type="button" class="mh-toggle-btn ${currentView === 'front' ? 'selected' : ''}" data-esh-view="front">전면</button>
            <button type="button" class="mh-toggle-btn ${currentView === 'back' ? 'selected' : ''}" data-esh-view="back">후면</button>
          </div>
        </div>
        <div class="mh-body-wrap esh-home-body" id="eshHomeBrowseBody">
          ${buildStimSvg(currentView, stim)}
        </div>
        <div class="mh-sub">운동 기록이 없어도 부위를 탭하면 관련 운동을 볼 수 있어요</div>
      </div>`;
  }

  function renderHomeBrowse(container) {
    container.innerHTML = buildBrowseEmptyCard();
    container.querySelectorAll('[data-esh-view]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        currentView = btn.dataset.eshView === 'back' ? 'back' : 'front';
        renderHomeBrowse(container);
      });
    });
  }

  function onHomeCardClick(e) {
    const region = e.target.closest('.mh-region, .esh-region');
    if (!region) return;
    const muscle = region.dataset.muscle;
    if (!muscle) return;
    // 툴팁이 먼저 떠도, 관련 운동 시트는 바로 연다
    openMuscle(muscle);
  }

  function afterHomeRender() {
    const container = document.getElementById('muscleHeatmapCard');
    if (!container) return;

    // 데이터 없는 empty 카드 → 탐색용 바디맵으로 교체
    if (container.querySelector('.mh-card--empty')) {
      renderHomeBrowse(container);
    }

    if (!homeHooked) {
      homeHooked = true;
      container.addEventListener('click', onHomeCardClick);
    }
  }

  function init() {
    hookPicker();
    // 홈이 이미 렌더됐을 수 있으므로 한 번 보정
    setTimeout(afterHomeRender, 0);
  }

  return {
    init,
    afterHomeRender,
    openExercise,
    closeExercise,
    closeExerciseOnOverlay,
    addCurrentExercise,
    openMuscle,
    closeMuscle,
    closeMuscleOnOverlay,
    enhancePickerItems,
    buildStimSvg,
  };
})();
