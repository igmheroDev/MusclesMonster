// ============================================================
// RECOVR - 근육 히트맵 다이어그램 모듈 (독립 모듈)
// 일러스트 이미지 베이스 + 일러스트 근육선에 맞춘 오버레이
// ============================================================

const MuscleHeatmap = (() => {
  const VIEWBOX_W = 240;
  const VIEWBOX_H = 360;

  const TERRACOTTA = '#c4785a';

  const BODY_IMAGES = {
    front: 'body-map-front.jpg',
    back: 'body-map-back.jpg',
  };

  const BODY_MASKS = {
    front: 'body-mask-front.png',
    back: 'body-mask-back.png',
  };

  // 테스트/하위호환용
  const BODY_SILHOUETTE = {
    front: 'M120 20C134 20 144 30 144 44C144 58 134 68 120 68C106 68 96 58 96 44C96 30 106 20 120 20Z',
    back: 'M120 20C134 20 144 30 144 44C144 58 134 68 120 68C106 68 96 58 96 44C96 30 106 20 120 20Z',
  };

  const TEXT_MUSCLES = new Set(['chest', 'back', 'quads', 'hamstrings', 'core']);

  const TEXT_POSITIONS = {
    front: {
      chest: { x: 120, y: 108 },
      core: { x: 120, y: 165 },
      quads: { x: 100, y: 245 },
    },
    back: {
      back: { x: 120, y: 120 },
      hamstrings: { x: 100, y: 245 },
    },
  };

  /**
   * body-map 일러스트 실측 좌표 (viewBox 240×360)
   * 팔은 몸 옆, 다리는 어깨너비 — 가랑이 중앙 blob 금지
   */
  const FRONT_REGIONS = [
    { muscle: 'shoulder', d: 'M76 74C72 80 72 90 78 98C84 104 96 102 100 94C102 86 96 78 88 74C84 72 78 72 76 74Z' },
    { muscle: 'shoulder', d: 'M164 74C168 80 168 90 162 98C156 104 144 102 140 94C138 86 144 78 152 74C156 72 162 72 164 74Z' },
    { muscle: 'chest', d: 'M90 88C102 82 116 80 120 80C124 80 138 82 150 88C154 96 154 114 148 126C140 132 128 134 120 132C112 134 100 132 92 126C86 114 86 96 90 88Z' },
    { muscle: 'biceps', d: 'M72 98C66 106 64 120 64 134C64 144 70 150 76 148C82 146 86 136 86 122C86 110 80 102 72 98Z' },
    { muscle: 'biceps', d: 'M168 98C174 106 176 120 176 134C176 144 170 150 164 148C158 146 154 136 154 122C154 110 160 102 168 98Z' },
    { muscle: 'forearms', d: 'M66 148C58 156 54 170 54 182C54 190 60 196 66 194C74 192 78 182 78 170C78 158 72 150 66 148Z' },
    { muscle: 'forearms', d: 'M174 148C182 156 186 170 186 182C186 190 180 196 174 194C166 192 162 182 162 170C162 158 168 150 174 148Z' },
    { muscle: 'core', d: 'M92 128C106 124 134 124 148 128C152 140 152 168 148 188C142 202 130 208 120 208C110 208 98 202 92 188C88 168 88 140 92 128Z' },
    { muscle: 'quads', d: 'M88 202C86 218 85 242 86 262C88 276 96 282 104 280C112 278 114 260 114 240C114 220 110 208 102 202C96 198 90 198 88 202Z' },
    { muscle: 'quads', d: 'M152 202C154 218 155 242 154 262C152 276 144 282 136 280C128 278 126 260 126 240C126 220 130 208 138 202C144 198 150 198 152 202Z' },
    { muscle: 'adductors', d: 'M104 214C108 208 114 208 116 216C118 232 118 252 116 268C114 274 110 276 106 272C102 256 102 232 104 214Z' },
    { muscle: 'adductors', d: 'M136 214C132 208 126 208 124 216C122 232 122 252 124 268C126 274 130 276 134 272C138 256 138 232 136 214Z' },
    { muscle: 'calves', d: 'M88 282C86 294 86 308 90 318C94 324 100 324 102 316C104 304 102 292 98 284C96 280 90 280 88 282Z' },
    { muscle: 'calves', d: 'M152 282C154 294 154 308 150 318C146 324 140 324 138 316C136 304 138 292 142 284C144 280 150 280 152 282Z' },
  ];

  const BACK_REGIONS = [
    { muscle: 'shoulder', d: 'M76 74C72 80 72 90 78 98C84 104 96 102 100 94C102 86 96 78 88 74C84 72 78 72 76 74Z' },
    { muscle: 'shoulder', d: 'M164 74C168 80 168 90 162 98C156 104 144 102 140 94C138 86 144 78 152 74C156 72 162 72 164 74Z' },
    { muscle: 'back', d: 'M90 84C104 74 136 74 150 84C156 94 158 112 150 128C140 138 128 142 120 140C112 142 100 138 90 128C82 112 84 94 90 84Z' },
    { muscle: 'back', d: 'M94 130C108 122 132 122 146 130C152 142 152 166 146 186C138 200 128 206 120 204C112 206 102 200 94 186C88 166 88 142 94 130Z' },
    { muscle: 'triceps', d: 'M72 98C66 106 64 120 64 134C64 144 70 150 76 148C82 146 86 136 86 122C86 110 80 102 72 98Z' },
    { muscle: 'triceps', d: 'M168 98C174 106 176 120 176 134C176 144 170 150 164 148C158 146 154 136 154 122C154 110 160 102 168 98Z' },
    { muscle: 'forearms', d: 'M66 148C58 156 54 170 54 182C54 190 60 196 66 194C74 192 78 182 78 170C78 158 72 150 66 148Z' },
    { muscle: 'forearms', d: 'M174 148C182 156 186 170 186 182C186 190 180 196 174 194C166 192 162 182 162 170C162 158 168 150 174 148Z' },
    { muscle: 'hamstrings', d: 'M88 202C86 218 85 242 86 262C88 276 96 282 104 280C112 278 114 260 114 240C114 220 110 208 102 202C96 198 90 198 88 202Z' },
    { muscle: 'hamstrings', d: 'M152 202C154 218 155 242 154 262C152 276 144 282 136 280C128 278 126 260 126 240C126 220 130 208 138 202C144 198 150 198 152 202Z' },
    { muscle: 'adductors', d: 'M104 214C108 208 114 208 116 216C118 232 118 252 116 268C114 274 110 276 106 272C102 256 102 232 104 214Z' },
    { muscle: 'adductors', d: 'M136 214C132 208 126 208 124 216C122 232 122 252 124 268C126 274 130 276 134 272C138 256 138 232 136 214Z' },
    { muscle: 'calves', d: 'M88 282C86 294 86 308 90 318C94 324 100 324 102 316C104 304 102 292 98 284C96 280 90 280 88 282Z' },
    { muscle: 'calves', d: 'M152 282C154 294 154 308 150 318C146 324 140 324 138 316C136 304 138 292 142 284C144 280 150 280 152 282Z' },
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
      const opacity = hasData ? 0.55 : 0;
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
    const mask = BODY_MASKS[view] || BODY_MASKS.front;
    const maskId = `mhMask-${view}`;
    return `
      <svg class="mh-svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" role="img" aria-label="근육 회복 히트맵 ${view === 'back' ? '후면' : '전면'}">
        <defs>
          <mask id="${maskId}">
            <image href="${mask}" x="0" y="0" width="${VIEWBOX_W}" height="${VIEWBOX_H}"
              preserveAspectRatio="xMidYMid meet"/>
          </mask>
        </defs>
        <image class="mh-body-image" href="${src}" x="0" y="0" width="${VIEWBOX_W}" height="${VIEWBOX_H}"
          preserveAspectRatio="xMidYMid meet" pointer-events="none"/>
        <g class="mh-muscles" mask="url(#${maskId})" style="mix-blend-mode:multiply">
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
    BODY_MASKS,
    TERRACOTTA,
  };
})();
