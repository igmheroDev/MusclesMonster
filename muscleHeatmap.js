// ============================================================
// RECOVR - 근육 히트맵 다이어그램 모듈 (독립 모듈)
// 픽토그램형: 매끈한 외곽 + 양팔/다리 벌림 + 외곽에 맞춘 근육 구역
// ============================================================

const MuscleHeatmap = (() => {
  const VIEWBOX_W = 240;
  const VIEWBOX_H = 360;

  const TERRACOTTA = '#c4785a';
  const SEGMENT_STROKE = '#ffffff';
  const OUTER_STROKE = '#1a1a1a';

  const TEXT_MUSCLES = new Set(['chest', 'back', 'quads', 'hamstrings', 'core', 'shoulder']);

  const TEXT_POSITIONS = {
    front: {
      shoulder: { x: 120, y: 92 },
      chest: { x: 120, y: 116 },
      core: { x: 120, y: 162 },
      quads: { x: 120, y: 244 },
    },
    back: {
      shoulder: { x: 120, y: 92 },
      back: { x: 120, y: 124 },
      hamstrings: { x: 120, y: 244 },
    },
  };

  /**
   * 픽토그램 실루엣 (매끈)
   * - 양팔 벌림 (거의 수평)
   * - 다리 어깨너비로 벌림
   *
   * 좌표 가이드 (cx=120):
   *  좌손 ~14,112 / 우손 ~226,112
   *  어깨폭 ~88~152 / 허리 ~98~142
   *  좌발 중심 ~78 / 우발 중심 ~162 / 가랑이 120,210
   */
  const BODY_PATH =
    // 머리
    'M120 12C133 12 144 23 144 36C144 49 133 60 120 60C107 60 96 49 96 36C96 23 107 12 120 12Z' +
    // 목 → 몸통+팔+다리 단일 경로
    'M113 58' +
    'C111 66 109 72 107 76' +
    // 왼팔 바깥 (수평에 가깝게)
    'C90 78 68 84 46 94' +
    'C32 102 20 110 14 120' +
    'C10 128 14 136 24 138' +
    'C34 140 40 134 42 126' +
    'C40 118 48 110 64 104' +
    'C76 100 86 98 92 100' +
    // 좌 몸통 (완만한 허리)
    'L96 148' +
    'C98 162 100 174 104 186' +
    // 왼다리 (어깨너비, 원통형에 가깝게)
    'C90 194 76 210 66 232' +
    'C58 250 54 274 58 298' +
    'C62 318 72 336 88 342' +
    'C100 346 110 340 114 328' +
    'C116 316 114 300 112 282' +
    'C110 258 112 238 116 222' +
    'C118 214 119 210 120 208' +
    // 오른다리
    'C121 210 122 214 124 222' +
    'C128 238 130 258 128 282' +
    'C126 300 124 316 126 328' +
    'C130 340 140 346 152 342' +
    'C168 336 178 318 182 298' +
    'C186 274 182 250 174 232' +
    'C164 210 150 194 136 186' +
    // 우 몸통
    'C140 174 142 162 144 148' +
    'L148 100' +
    // 오른팔
    'C154 98 164 100 176 104' +
    'C192 110 200 118 198 126' +
    'C200 134 206 140 216 138' +
    'C226 136 230 128 226 120' +
    'C220 110 208 102 194 94' +
    'C172 84 150 78 133 76' +
    'C131 72 129 66 127 58' +
    'C123 56 117 56 113 58Z';

  const BODY_SILHOUETTE = { front: BODY_PATH, back: BODY_PATH };

  const HEAD_NECK = {
    front: [
      'M120 14C132 14 142 24 142 36C142 48 132 58 120 58C108 58 98 48 98 36C98 24 108 14 120 14Z',
      'M112 56C114 64 117 68 120 68C123 68 126 64 128 56C124 54 116 54 112 56Z',
    ],
    back: [
      'M120 14C132 14 142 24 142 36C142 48 132 58 120 58C108 58 98 48 98 36C98 24 108 14 120 14Z',
      'M112 56C114 64 117 68 120 68C123 68 126 64 128 56C124 54 116 54 112 56Z',
    ],
  };

  // 근육 구역: clip으로 외곽에 맞춰 잘리도록 충분히 크게
  const FRONT_REGIONS = [
    { muscle: 'shoulder', d: 'M88 76C70 78 54 88 46 100C42 110 52 118 66 116C82 114 98 106 102 94C104 84 98 78 88 76Z' },
    { muscle: 'shoulder', d: 'M152 76C170 78 186 88 194 100C198 110 188 118 174 116C158 114 142 106 138 94C136 84 142 78 152 76Z' },
    { muscle: 'chest', d: 'M96 88C110 80 130 80 144 88C152 96 154 112 146 124C136 134 128 136 120 132C112 136 104 134 94 124C86 112 88 96 96 88Z' },
    { muscle: 'biceps', d: 'M46 98C32 104 20 114 14 124C10 132 16 140 28 138C38 136 46 128 50 118C52 108 50 102 46 98Z' },
    { muscle: 'biceps', d: 'M194 98C208 104 220 114 226 124C230 132 224 140 212 138C202 136 194 128 190 118C188 108 190 102 194 98Z' },
    { muscle: 'forearms', d: 'M12 124C6 130 8 140 20 142C32 144 40 138 38 130C36 124 26 120 18 122C14 122 12 122 12 124Z' },
    { muscle: 'forearms', d: 'M228 124C234 130 232 140 220 142C208 144 200 138 202 130C204 124 214 120 222 122C226 122 228 122 228 124Z' },
    { muscle: 'core', d: 'M98 128C112 118 128 118 142 128C150 136 152 154 148 172C142 190 134 200 120 200C106 200 98 190 92 172C88 154 90 136 98 128Z' },
    { muscle: 'quads', d: 'M70 184C84 170 102 176 106 196C110 220 104 252 94 276C86 288 72 290 62 278C56 268 58 244 64 220C70 196 66 188 70 184Z' },
    { muscle: 'quads', d: 'M170 184C156 170 138 176 134 196C130 220 136 252 146 276C154 288 168 290 178 278C184 268 182 244 176 220C170 196 174 188 170 184Z' },
    { muscle: 'adductors', d: 'M108 196C116 186 124 186 132 196C134 208 134 232 132 252C130 260 126 264 120 264C114 264 110 260 108 252C106 232 106 208 108 196Z' },
    { muscle: 'calves', d: 'M60 278C76 266 96 276 100 298C102 316 92 336 76 340C60 344 52 326 54 310C56 294 56 284 60 278Z' },
    { muscle: 'calves', d: 'M180 278C164 266 144 276 140 298C138 316 148 336 164 340C180 344 188 326 186 310C184 294 184 284 180 278Z' },
  ];

  const BACK_REGIONS = [
    { muscle: 'shoulder', d: 'M88 76C70 78 54 88 46 100C42 110 52 118 66 116C82 114 98 106 102 94C104 84 98 78 88 76Z' },
    { muscle: 'shoulder', d: 'M152 76C170 78 186 88 194 100C198 110 188 118 174 116C158 114 142 106 138 94C136 84 142 78 152 76Z' },
    { muscle: 'back', d: 'M94 84C110 74 130 74 146 84C154 92 158 108 150 122C140 136 130 142 120 138C110 142 100 136 90 122C82 108 86 92 94 84Z' },
    { muscle: 'back', d: 'M98 128C112 118 128 118 142 128C150 136 152 154 146 172C138 188 130 196 120 194C110 196 102 188 94 172C88 154 90 136 98 128Z' },
    { muscle: 'triceps', d: 'M46 98C32 104 20 114 14 124C10 132 16 140 28 138C38 136 46 128 50 118C52 108 50 102 46 98Z' },
    { muscle: 'triceps', d: 'M194 98C208 104 220 114 226 124C230 132 224 140 212 138C202 136 194 128 190 118C188 108 190 102 194 98Z' },
    { muscle: 'forearms', d: 'M12 124C6 130 8 140 20 142C32 144 40 138 38 130C36 124 26 120 18 122C14 122 12 122 12 124Z' },
    { muscle: 'forearms', d: 'M228 124C234 130 232 140 220 142C208 144 200 138 202 130C204 124 214 120 222 122C226 122 228 122 228 124Z' },
    { muscle: 'hamstrings', d: 'M70 184C84 170 102 176 106 196C110 220 104 252 94 276C86 288 72 290 62 278C56 268 58 244 64 220C70 196 66 188 70 184Z' },
    { muscle: 'hamstrings', d: 'M170 184C156 170 138 176 134 196C130 220 136 252 146 276C154 288 168 290 178 278C184 268 182 244 176 220C170 196 174 188 170 184Z' },
    { muscle: 'adductors', d: 'M108 196C116 186 124 186 132 196C134 208 134 232 132 252C130 260 126 264 120 264C114 264 110 260 108 252C106 232 106 208 108 196Z' },
    { muscle: 'calves', d: 'M60 278C76 266 96 276 100 298C102 316 92 336 76 340C60 344 52 326 54 310C56 294 56 284 60 278Z' },
    { muscle: 'calves', d: 'M180 278C164 266 144 276 140 298C138 316 148 336 164 340C180 344 188 326 186 310C184 294 184 284 180 278Z' },
  ];

  const DETAIL_LINES = {
    front: [
      'M120 98L120 126',
      'M108 144L132 144',
      'M108 158L132 158',
      'M108 172L132 172',
      'M120 204L120 268',
    ],
    back: [
      'M120 90L120 178',
      'M104 108C112 120 118 128 120 132',
      'M136 108C128 120 122 128 120 132',
      'M120 204L120 268',
    ],
  };

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

  function buildHeadNeck(view) {
    return (HEAD_NECK[view] || []).map((d) =>
      `<path class="mh-base-part" d="${d}" fill="${TERRACOTTA}" stroke="${SEGMENT_STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`
    ).join('');
  }

  function buildDetailLines(view) {
    return (DETAIL_LINES[view] || []).map((d) =>
      `<path class="mh-detail" d="${d}" fill="none" stroke="${SEGMENT_STROKE}" stroke-width="1.4" stroke-linecap="round" stroke-opacity="0.7"/>`
    ).join('');
  }

  function buildRegionsSvg(view, recovery) {
    const regions = view === 'back' ? BACK_REGIONS : FRONT_REGIONS;
    const textRendered = new Set();

    return regions.map((region) => {
      const { pct, hasData } = getMuscleData(region.muscle, recovery);
      const fill = getRecoveryColor(pct, hasData);
      const opacity = hasData ? 0.92 : 1;
      const label = getMuscleLabel(region.muscle);
      const title = hasData ? `${label} ${pct}%` : `${label} (기록 없음)`;
      const cls = getRecoveryClass(pct, hasData);

      const path = `<path class="mh-region ${cls}" data-muscle="${region.muscle}" data-label="${label}" data-pct="${hasData ? pct : ''}"
        d="${region.d}" fill="${fill}" fill-opacity="${opacity}" stroke="${SEGMENT_STROKE}" stroke-width="1.8" stroke-linejoin="round">
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
    const clipId = `mhClip-${view}`;
    return `
      <svg class="mh-svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" role="img" aria-label="근육 회복 히트맵 ${view === 'back' ? '후면' : '전면'}">
        <defs>
          <filter id="mhBodyShadow" x="-10%" y="-4%" width="120%" height="112%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.35" />
          </filter>
          <clipPath id="${clipId}">
            <path d="${BODY_SILHOUETTE[view]}" />
          </clipPath>
        </defs>
        <g class="mh-body-shell" filter="url(#mhBodyShadow)">
          <path class="mh-body-outline" d="${BODY_SILHOUETTE[view]}" fill="none" stroke="${OUTER_STROKE}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>
          <path class="mh-body-gap" d="${BODY_SILHOUETTE[view]}" fill="none" stroke="${SEGMENT_STROKE}" stroke-width="2.2" stroke-linejoin="round"/>
          <path class="mh-body-fill" d="${BODY_SILHOUETTE[view]}" fill="${TERRACOTTA}" stroke="none"/>
        </g>
        <g class="mh-muscles" clip-path="url(#${clipId})">
          ${buildHeadNeck(view)}
          ${buildRegionsSvg(view, recovery)}
          ${buildDetailLines(view)}
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
    TERRACOTTA,
  };
})();
