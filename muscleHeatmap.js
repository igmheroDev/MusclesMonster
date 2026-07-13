// ============================================================
// RECOVR - 근육 히트맵 다이어그램 모듈 (독립 모듈)
// 일러스트 이미지 베이스 + 탭/회복색 오버레이
// ============================================================

const MuscleHeatmap = (() => {
  const VIEWBOX_W = 240;
  const VIEWBOX_H = 360;

  const TERRACOTTA = '#c4785a';

  const BODY_IMAGES = {
    front: 'body-map-front.jpg',
    back: 'body-map-back.jpg',
  };

  // 테스트/하위호환용 (이미지 모드에서는 외곽 참고만)
  const BODY_SILHOUETTE = {
    front: 'M120 18C136 18 148 30 148 46C148 62 136 74 120 74C104 74 92 62 92 46C92 30 104 18 120 18Z',
    back: 'M120 18C136 18 148 30 148 46C148 62 136 74 120 74C104 74 92 62 92 46C92 30 104 18 120 18Z',
  };

  const TEXT_MUSCLES = new Set(['chest', 'back', 'quads', 'hamstrings', 'core', 'shoulder']);

  const TEXT_POSITIONS = {
    front: {
      shoulder: { x: 120, y: 88 },
      chest: { x: 120, y: 118 },
      core: { x: 120, y: 168 },
      quads: { x: 120, y: 248 },
    },
    back: {
      shoulder: { x: 120, y: 88 },
      back: { x: 120, y: 130 },
      hamstrings: { x: 120, y: 248 },
    },
  };

  /**
   * 일러스트(전면/후면)에 맞춘 탭·색칠 영역
   * viewBox 240×360 기준, 몸 중심에 맞춤
   */
  const FRONT_REGIONS = [
    { muscle: 'shoulder', d: 'M78 78C66 84 58 98 62 110C66 120 80 124 94 116C102 110 104 98 98 90C92 82 84 76 78 78Z' },
    { muscle: 'shoulder', d: 'M162 78C174 84 182 98 178 110C174 120 160 124 146 116C138 110 136 98 142 90C148 82 156 76 162 78Z' },
    { muscle: 'chest', d: 'M94 96C108 86 132 86 146 96C154 104 156 120 148 132C138 142 128 144 120 140C112 144 102 142 92 132C84 120 86 104 94 96Z' },
    { muscle: 'biceps', d: 'M58 108C46 118 40 136 42 152C44 162 54 166 64 160C72 154 74 140 70 126C68 116 62 110 58 108Z' },
    { muscle: 'biceps', d: 'M182 108C194 118 200 136 198 152C196 162 186 166 176 160C168 154 166 140 170 126C172 116 178 110 182 108Z' },
    { muscle: 'forearms', d: 'M44 156C34 166 30 184 36 198C42 208 56 208 64 198C70 190 68 176 62 166C58 160 50 156 44 156Z' },
    { muscle: 'forearms', d: 'M196 156C206 166 210 184 204 198C198 208 184 208 176 198C170 190 172 176 178 166C182 160 190 156 196 156Z' },
    { muscle: 'core', d: 'M102 138C114 128 126 128 138 138C146 146 148 164 144 182C138 200 130 208 120 208C110 208 102 200 96 182C92 164 94 146 102 138Z' },
    { muscle: 'quads', d: 'M78 210C90 198 104 204 108 222C112 246 106 274 96 296C88 308 74 308 66 296C60 286 62 260 68 238C72 224 72 214 78 210Z' },
    { muscle: 'quads', d: 'M162 210C150 198 136 204 132 222C128 246 134 274 144 296C152 308 166 308 174 296C180 286 178 260 172 238C168 224 168 214 162 210Z' },
    { muscle: 'adductors', d: 'M110 214C116 206 124 206 130 214C132 224 132 246 130 266C128 274 124 278 120 278C116 278 112 274 110 266C108 246 108 224 110 214Z' },
    { muscle: 'calves', d: 'M70 298C84 288 100 296 104 314C106 328 98 344 84 348C70 352 60 338 60 324C60 312 62 302 70 298Z' },
    { muscle: 'calves', d: 'M170 298C156 288 140 296 136 314C134 328 142 344 156 348C170 352 180 338 180 324C180 312 178 302 170 298Z' },
  ];

  const BACK_REGIONS = [
    { muscle: 'shoulder', d: 'M78 78C66 84 58 98 62 110C66 120 80 124 94 116C102 110 104 98 98 90C92 82 84 76 78 78Z' },
    { muscle: 'shoulder', d: 'M162 78C174 84 182 98 178 110C174 120 160 124 146 116C138 110 136 98 142 90C148 82 156 76 162 78Z' },
    { muscle: 'back', d: 'M92 92C108 80 132 80 148 92C156 100 160 116 152 132C142 148 130 154 120 150C110 154 98 148 88 132C80 116 84 100 92 92Z' },
    { muscle: 'back', d: 'M100 140C112 130 128 130 140 140C148 148 150 166 144 184C136 200 128 206 120 204C112 206 104 200 96 184C90 166 92 148 100 140Z' },
    { muscle: 'triceps', d: 'M58 108C46 118 40 136 42 152C44 162 54 166 64 160C72 154 74 140 70 126C68 116 62 110 58 108Z' },
    { muscle: 'triceps', d: 'M182 108C194 118 200 136 198 152C196 162 186 166 176 160C168 154 166 140 170 126C172 116 178 110 182 108Z' },
    { muscle: 'forearms', d: 'M44 156C34 166 30 184 36 198C42 208 56 208 64 198C70 190 68 176 62 166C58 160 50 156 44 156Z' },
    { muscle: 'forearms', d: 'M196 156C206 166 210 184 204 198C198 208 184 208 176 198C170 190 172 176 178 166C182 160 190 156 196 156Z' },
    { muscle: 'hamstrings', d: 'M78 210C90 198 104 204 108 222C112 246 106 274 96 296C88 308 74 308 66 296C60 286 62 260 68 238C72 224 72 214 78 210Z' },
    { muscle: 'hamstrings', d: 'M162 210C150 198 136 204 132 222C128 246 134 274 144 296C152 308 166 308 174 296C180 286 178 260 172 238C168 224 168 214 162 210Z' },
    { muscle: 'adductors', d: 'M110 214C116 206 124 206 130 214C132 224 132 246 130 266C128 274 124 278 120 278C116 278 112 274 110 266C108 246 108 224 110 214Z' },
    { muscle: 'calves', d: 'M70 298C84 288 100 296 104 314C106 328 98 344 84 348C70 352 60 338 60 324C60 312 62 302 70 298Z' },
    { muscle: 'calves', d: 'M170 298C156 288 140 296 136 314C134 328 142 344 156 348C170 352 180 338 180 324C180 312 178 302 170 298Z' },
  ];

  let currentView = 'front';
  let lastRecovery = null;
  let lastActive = [];

  function getRecoveryColor(pct, hasData) {
    if (!hasData) return TERRACOTTA;
    if (typeof getPctColor === 'function') return getPctColor(pct);
    if (pct < 40) return 'var(--red)';
    if (pct < 70) return 'var(--orange)';
    if (pct < 95) return 'var(--yellow)';
    return 'var(--green)';
  }

  function getRecoveryClass(pct, hasData) {
    if (!hasData) return 'mh-region--idle';
    if (pct < 40) return 'mh-region--low';
    if (pct < 70) return 'mh-region--mid';
    return '';
  }

  function getMuscleLabel(muscleKey) {
    if (typeof MUSCLE_LABELS !== 'undefined' && MUSCLE_LABELS[muscleKey]) {
      return MUSCLE_LABELS[muscleKey].name;
    }
    return muscleKey;
  }

  function getMuscleData(muscleKey, recovery) {
    const r = recovery?.[muscleKey];
    if (!r || r.lastDate === null) {
      return { pct: 100, hasData: false };
    }
    return { pct: r.recoveryPct, hasData: true };
  }

  function buildRegionsSvg(view, recovery) {
    const regions = view === 'back' ? BACK_REGIONS : FRONT_REGIONS;
    const textRendered = new Set();

    return regions.map((region) => {
      const { pct, hasData } = getMuscleData(region.muscle, recovery);
      const fill = hasData ? getRecoveryColor(pct, true) : 'transparent';
      const opacity = hasData ? 0.52 : 0;
      const label = getMuscleLabel(region.muscle);
      const title = hasData ? `${label} ${pct}%` : `${label} (기록 없음)`;
      const cls = getRecoveryClass(pct, hasData);

      const path = `<path class="mh-region ${cls}" data-muscle="${region.muscle}" data-label="${label}" data-pct="${hasData ? pct : ''}"
        d="${region.d}" fill="${fill}" fill-opacity="${opacity}" stroke="none" pointer-events="all">
        <title>${title}</title>
      </path>`;

      const showText = hasData && TEXT_MUSCLES.has(region.muscle) && !textRendered.has(region.muscle);
      if (showText) textRendered.add(region.muscle);
      const textPos = TEXT_POSITIONS[view]?.[region.muscle] || { x: 120, y: 170 };

      const text = showText
        ? `<text x="${textPos.x}" y="${textPos.y}" text-anchor="middle" dominant-baseline="middle"
            class="mh-region-text" fill="#ffffff" font-size="10" font-weight="800" pointer-events="none">${pct}%</text>`
        : '';

      return path + text;
    }).join('');
  }

  function buildLegend() {
    const items = [
      { color: 'var(--red)', label: '피로', sub: '~40%' },
      { color: 'var(--orange)', label: '회복중', sub: '40~70%' },
      { color: 'var(--yellow)', label: '준비됨', sub: '70~95%' },
      { color: 'var(--green)', label: '최적', sub: '95%+' },
    ];
    return items.map((item) => `
      <span class="mh-legend-item">
        <span class="mh-legend-dot" style="background:${item.color}"></span>
        <span class="mh-legend-label">${item.label}<span class="mh-legend-sub">${item.sub}</span></span>
      </span>`).join('');
  }

  function buildSvg(view, recovery) {
    const src = BODY_IMAGES[view] || BODY_IMAGES.front;
    return `
      <svg class="mh-svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" role="img" aria-label="근육 회복 히트맵 ${view === 'back' ? '후면' : '전면'}">
        <image class="mh-body-image" href="${src}" x="0" y="0" width="${VIEWBOX_W}" height="${VIEWBOX_H}"
          preserveAspectRatio="xMidYMid meet" pointer-events="none"/>
        <g class="mh-muscles" style="mix-blend-mode:multiply">
          ${buildRegionsSvg(view, recovery)}
        </g>
      </svg>`;
  }

  function setView(view) {
    currentView = view === 'back' ? 'back' : 'front';
    render(lastRecovery, lastActive);
  }

  function onRegionTap(e) {
    const region = e.target.closest('.mh-region');
    if (!region) return;
    const label = region.dataset.label || '';
    const pct = region.dataset.pct;
    const tip = document.getElementById('mhTooltip');
    if (!tip) return;

    const pctNum = parseInt(pct, 10);
    let statusText = '기록 없음';
    let statusClass = '';
    if (pct) {
      if (pctNum < 40) { statusText = `회복 ${pct}% · 피로 누적`; statusClass = 'low'; }
      else if (pctNum < 70) { statusText = `회복 ${pct}% · 회복 중`; statusClass = 'mid'; }
      else if (pctNum < 95) { statusText = `회복 ${pct}% · 준비됨`; statusClass = ''; }
      else { statusText = `회복 ${pct}% · 최적 상태`; statusClass = 'good'; }
    }

    tip.innerHTML = `<span class="mh-tip-label">${label}</span><span class="mh-tip-status ${statusClass}">${statusText}</span>`;
    tip.classList.add('visible');
    clearTimeout(tip._hideTimer);
    tip._hideTimer = setTimeout(() => tip.classList.remove('visible'), 2800);
  }

  function render(recovery, activeMuscles) {
    const container = document.getElementById('muscleHeatmapCard');
    if (!container) return;

    lastRecovery = recovery || {};
    lastActive = activeMuscles || [];

    const hasData = lastActive.length > 0;
    const viewLabel = currentView === 'back' ? '후면' : '전면';

    container.innerHTML = `
      <div class="mh-card">
        <div class="mh-accent-bar"></div>
        <div class="mh-header">
          <div class="mh-title">💪 근육 회복 히트맵</div>
          <div class="mh-toggle">
            <button type="button" class="mh-toggle-btn ${currentView === 'front' ? 'selected' : ''}" data-view="front">전면</button>
            <button type="button" class="mh-toggle-btn ${currentView === 'back' ? 'selected' : ''}" data-view="back">후면</button>
          </div>
        </div>
        <div class="mh-body-wrap">
          ${buildSvg(currentView, lastRecovery)}
          <div class="mh-tooltip" id="mhTooltip"></div>
        </div>
        <div class="mh-legend">${buildLegend()}</div>
        <div class="mh-sub">${hasData ? `${viewLabel} 보기 · 부위를 탭하면 상세 확인` : '운동 기록을 추가하면 부위별 회복도가 표시돼요'}</div>
      </div>`;

    container.querySelectorAll('.mh-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        setView(btn.dataset.view);
      });
    });
    container.querySelector('.mh-svg')?.addEventListener('click', onRegionTap);
  }

  return {
    render,
    setView,
    getRecoveryColor,
    FRONT_REGIONS,
    BACK_REGIONS,
    BODY_SILHOUETTE,
    BODY_IMAGES,
    TERRACOTTA,
  };
})();
