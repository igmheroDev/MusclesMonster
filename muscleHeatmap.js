// ============================================================
// RECOVR - 근육 히트맵 다이어그램 모듈 (독립 모듈)
// 전면/후면 신체 실루엣에 부위별 회복도 색상 표시
// ============================================================

const MuscleHeatmap = (() => {
  const VIEWBOX_W = 100;
  const VIEWBOX_H = 160;

  // 텍스트 % 표시할 근육 (충분히 큰 타원 부위)
  const TEXT_MUSCLES = new Set(['chest', 'back', 'quads', 'hamstrings', 'core', 'shoulder']);

  const TEXT_POSITIONS = {
    front: {
      shoulder: { x: 50, y: 48.5 },
      chest: { x: 50, y: 56.5 },
      core: { x: 50, y: 73 },
      quads: { x: 50, y: 108 },
    },
    back: {
      shoulder: { x: 50, y: 48.5 },
      back: { x: 50, y: 60 },
      hamstrings: { x: 50, y: 108 },
    },
  };

  const BODY_GUIDES = {
    front: [
      { cx: 50, cy: 28.5, rx: 8.8, ry: 9.2, cls: 'mh-guide-head' },
      { cx: 50, cy: 55, rx: 21, ry: 16 },
      { cx: 50, cy: 76, rx: 13.5, ry: 12.5 },
      { cx: 28, cy: 64, rx: 7.8, ry: 20, rotate: -8 },
      { cx: 72, cy: 64, rx: 7.8, ry: 20, rotate: 8 },
      { cx: 19.5, cy: 86, rx: 5.2, ry: 16.5, rotate: -6 },
      { cx: 80.5, cy: 86, rx: 5.2, ry: 16.5, rotate: 6 },
      { cx: 42.5, cy: 108, rx: 11.5, ry: 25, rotate: 2 },
      { cx: 57.5, cy: 108, rx: 11.5, ry: 25, rotate: -2 },
      { cx: 42.5, cy: 138.5, rx: 7.6, ry: 14, rotate: 3 },
      { cx: 57.5, cy: 138.5, rx: 7.6, ry: 14, rotate: -3 },
    ],
    back: [
      { cx: 50, cy: 28.5, rx: 8.8, ry: 9.2, cls: 'mh-guide-head' },
      { cx: 50, cy: 55, rx: 21, ry: 16 },
      { cx: 50, cy: 75.5, rx: 14.5, ry: 12.8 },
      { cx: 28, cy: 64, rx: 7.8, ry: 20, rotate: -8 },
      { cx: 72, cy: 64, rx: 7.8, ry: 20, rotate: 8 },
      { cx: 19.5, cy: 86, rx: 5.2, ry: 16.5, rotate: -6 },
      { cx: 80.5, cy: 86, rx: 5.2, ry: 16.5, rotate: 6 },
      { cx: 42.5, cy: 108.5, rx: 11.3, ry: 24.5, rotate: 2 },
      { cx: 57.5, cy: 108.5, rx: 11.3, ry: 24.5, rotate: -2 },
      { cx: 42.5, cy: 138.5, rx: 7.6, ry: 14, rotate: 3 },
      { cx: 57.5, cy: 138.5, rx: 7.6, ry: 14, rotate: -3 },
    ],
  };

  const FRONT_REGIONS = [
    { muscle: 'shoulder', cx: 34, cy: 48.5, rx: 8.5, ry: 7.8, rotate: -18 },
    { muscle: 'shoulder', cx: 66, cy: 48.5, rx: 8.5, ry: 7.8, rotate: 18 },
    { muscle: 'chest', cx: 50, cy: 56, rx: 16.5, ry: 9.2 },
    { muscle: 'biceps', cx: 26, cy: 64, rx: 6.7, ry: 12.5, rotate: -10 },
    { muscle: 'biceps', cx: 74, cy: 64, rx: 6.7, ry: 12.5, rotate: 10 },
    { muscle: 'forearms', cx: 19.5, cy: 84.5, rx: 4.8, ry: 10.8, rotate: -7 },
    { muscle: 'forearms', cx: 80.5, cy: 84.5, rx: 4.8, ry: 10.8, rotate: 7 },
    { muscle: 'core', cx: 50, cy: 73, rx: 11.8, ry: 9.2 },
    { muscle: 'quads', cx: 44, cy: 108, rx: 8.8, ry: 21.5, rotate: 3 },
    { muscle: 'quads', cx: 56, cy: 108, rx: 8.8, ry: 21.5, rotate: -3 },
    { muscle: 'adductors', cx: 50, cy: 112, rx: 6.4, ry: 13 },
    { muscle: 'calves', cx: 43.5, cy: 138.5, rx: 6.1, ry: 10.5, rotate: 3 },
    { muscle: 'calves', cx: 56.5, cy: 138.5, rx: 6.1, ry: 10.5, rotate: -3 },
  ];

  const BACK_REGIONS = [
    { muscle: 'shoulder', cx: 34, cy: 48.5, rx: 8.5, ry: 7.8, rotate: -18 },
    { muscle: 'shoulder', cx: 66, cy: 48.5, rx: 8.5, ry: 7.8, rotate: 18 },
    { muscle: 'back', cx: 50, cy: 54.5, rx: 16.5, ry: 10.5 },
    { muscle: 'back', cx: 50, cy: 68.5, rx: 13.3, ry: 8.8 },
    { muscle: 'triceps', cx: 26, cy: 64, rx: 6.7, ry: 12.5, rotate: -10 },
    { muscle: 'triceps', cx: 74, cy: 64, rx: 6.7, ry: 12.5, rotate: 10 },
    { muscle: 'forearms', cx: 19.5, cy: 84.5, rx: 4.8, ry: 10.8, rotate: -7 },
    { muscle: 'forearms', cx: 80.5, cy: 84.5, rx: 4.8, ry: 10.8, rotate: 7 },
    { muscle: 'hamstrings', cx: 44, cy: 108.5, rx: 8.8, ry: 21, rotate: 3 },
    { muscle: 'hamstrings', cx: 56, cy: 108.5, rx: 8.8, ry: 21, rotate: -3 },
    { muscle: 'adductors', cx: 50, cy: 112.5, rx: 6.2, ry: 12.5 },
    { muscle: 'calves', cx: 43.5, cy: 138.5, rx: 6.1, ry: 10.5, rotate: 3 },
    { muscle: 'calves', cx: 56.5, cy: 138.5, rx: 6.1, ry: 10.5, rotate: -3 },
  ];

  const BODY_OUTLINE = {
    front: 'M38 40C42 35 46 33 50 33C54 33 58 35 62 40L69 47C74 52 76 58 76 66V81C76 90 73 99 68 106L63 114C61 117 60 121 60 126V145C60 151 58 156 55 159C53.5 160.6 51.8 161.4 50 161.4C48.2 161.4 46.5 160.6 45 159C42 156 40 151 40 145V126C40 121 39 117 37 114L32 106C27 99 24 90 24 81V66C24 58 26 52 31 47Z',
    back: 'M38 40C42 35 46 33 50 33C54 33 58 35 62 40L69 47C74 52 76 58 76 66V81C76 90 73 99 68 106L63 114C61 117 60 121 60 126V145C60 151 58 156 55 159C53.5 160.6 51.8 161.4 50 161.4C48.2 161.4 46.5 160.6 45 159C42 156 40 151 40 145V126C40 121 39 117 37 114L32 106C27 99 24 90 24 81V66C24 58 26 52 31 47Z',
  };

  let currentView = 'front';
  let lastRecovery = null;
  let lastActive = [];

  function getTransform(region) {
    return region.rotate ? ` transform="rotate(${region.rotate} ${region.cx} ${region.cy})"` : '';
  }

  function buildGuideSvg(view) {
    const guides = BODY_GUIDES[view] || [];
    return guides.map((guide) => `
      <ellipse class="mh-guide ${guide.cls || ''}" cx="${guide.cx}" cy="${guide.cy}" rx="${guide.rx}" ry="${guide.ry}"
        fill="url(#mhGuideFill)" stroke="rgba(255,255,255,0.08)" stroke-width="0.8"${getTransform(guide)} />
    `).join('');
  }

  function getRecoveryColor(pct, hasData) {
    if (!hasData) return 'rgba(255,255,255,0.06)';
    if (typeof getPctColor === 'function') return getPctColor(pct);
    if (pct < 40) return 'var(--red)';
    if (pct < 70) return 'var(--orange)';
    if (pct < 95) return 'var(--yellow)';
    return 'var(--green)';
  }

  function getRecoveryClass(pct, hasData) {
    if (!hasData) return '';
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
      const fill = getRecoveryColor(pct, hasData);
      const opacity = hasData ? 0.85 : 0.3;
      const label = getMuscleLabel(region.muscle);
      const title = hasData ? `${label} ${pct}%` : `${label} (기록 없음)`;
      const cls = getRecoveryClass(pct, hasData);

      const ellipse = `<ellipse class="mh-region ${cls}" data-muscle="${region.muscle}" data-label="${label}" data-pct="${hasData ? pct : ''}"
        cx="${region.cx}" cy="${region.cy}" rx="${region.rx}" ry="${region.ry}"
        fill="${fill}" fill-opacity="${opacity}" stroke="rgba(255,255,255,0.22)" stroke-width="0.7"${getTransform(region)}>
        <title>${title}</title>
      </ellipse>`;

      // 큰 근육 타원에만 % 숫자 표시 (첫 번째 타원만)
      const showText = hasData && TEXT_MUSCLES.has(region.muscle) && !textRendered.has(region.muscle);
      if (showText) textRendered.add(region.muscle);
      const textPos = TEXT_POSITIONS[view]?.[region.muscle] || { x: region.cx, y: region.cy };

      const text = showText
        ? `<text x="${textPos.x}" y="${textPos.y}" text-anchor="middle" dominant-baseline="middle"
            class="mh-region-text" fill="rgba(255,255,255,0.95)" font-size="4.6" font-weight="700" pointer-events="none">${pct}%</text>`
        : '';

      return ellipse + text;
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
    return `
      <svg class="mh-svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" role="img" aria-label="근육 회복 히트맵 ${view === 'back' ? '후면' : '전면'}">
        <defs>
          <linearGradient id="mhGuideFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.09" />
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0.03" />
          </linearGradient>
          <filter id="mhBodyShadow" x="-30%" y="-20%" width="160%" height="170%">
            <feDropShadow dx="0" dy="2" stdDeviation="5" flood-color="#000000" flood-opacity="0.35" />
          </filter>
        </defs>
        <g class="mh-body-shell" filter="url(#mhBodyShadow)">
          <path class="mh-body-outline" d="${BODY_OUTLINE[view]}" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.16)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          ${buildGuideSvg(view)}
        </g>
        ${buildRegionsSvg(view, recovery)}
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
  };
})();
