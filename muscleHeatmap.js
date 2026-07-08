// ============================================================
// RECOVR - 근육 히트맵 다이어그램 모듈 (독립 모듈)
// 전면/후면 신체 실루엣에 부위별 회복도 색상 표시
// ============================================================

const MuscleHeatmap = (() => {
  const VIEWBOX_W = 100;
  const VIEWBOX_H = 160;

  // 텍스트 % 표시할 근육 (충분히 큰 타원 부위)
  const TEXT_MUSCLES = new Set(['chest', 'back', 'quads', 'hamstrings', 'core', 'shoulder']);

  const FRONT_REGIONS = [
    { muscle: 'shoulder', cx: 31, cy: 48, rx: 9, ry: 8 },
    { muscle: 'shoulder', cx: 69, cy: 48, rx: 9, ry: 8 },
    { muscle: 'chest', cx: 50, cy: 56, rx: 17, ry: 10 },
    { muscle: 'biceps', cx: 23, cy: 64, rx: 7, ry: 13 },
    { muscle: 'biceps', cx: 77, cy: 64, rx: 7, ry: 13 },
    { muscle: 'forearms', cx: 19, cy: 82, rx: 5, ry: 12 },
    { muscle: 'forearms', cx: 81, cy: 82, rx: 5, ry: 12 },
    { muscle: 'core', cx: 50, cy: 72, rx: 13, ry: 9 },
    { muscle: 'quads', cx: 42, cy: 108, rx: 10, ry: 22 },
    { muscle: 'quads', cx: 58, cy: 108, rx: 10, ry: 22 },
    { muscle: 'adductors', cx: 50, cy: 112, rx: 8, ry: 14 },
    { muscle: 'calves', cx: 42, cy: 138, rx: 7, ry: 11 },
    { muscle: 'calves', cx: 58, cy: 138, rx: 7, ry: 11 },
  ];

  const BACK_REGIONS = [
    { muscle: 'shoulder', cx: 31, cy: 48, rx: 9, ry: 8 },
    { muscle: 'shoulder', cx: 69, cy: 48, rx: 9, ry: 8 },
    { muscle: 'back', cx: 50, cy: 54, rx: 17, ry: 11 },
    { muscle: 'back', cx: 50, cy: 68, rx: 14, ry: 9 },
    { muscle: 'triceps', cx: 23, cy: 64, rx: 7, ry: 13 },
    { muscle: 'triceps', cx: 77, cy: 64, rx: 7, ry: 13 },
    { muscle: 'forearms', cx: 19, cy: 82, rx: 5, ry: 12 },
    { muscle: 'forearms', cx: 81, cy: 82, rx: 5, ry: 12 },
    { muscle: 'hamstrings', cx: 42, cy: 108, rx: 10, ry: 21 },
    { muscle: 'hamstrings', cx: 58, cy: 108, rx: 10, ry: 21 },
    { muscle: 'adductors', cx: 50, cy: 112, rx: 8, ry: 12 },
    { muscle: 'calves', cx: 42, cy: 138, rx: 7, ry: 11 },
    { muscle: 'calves', cx: 58, cy: 138, rx: 7, ry: 11 },
  ];

  const BODY_OUTLINE = {
    front: 'M50 18a8 8 0 1 1 0 16a8 8 0 1 1 0-16M34 36h32l6 14v8l-4 52M34 36L26 58l-4 38M66 36l8 22l4 38M42 110v28M58 110v28',
    back: 'M50 18a8 8 0 1 1 0 16a8 8 0 1 1 0-16M34 36h32l6 14v8l-4 52M34 36L26 58l-4 38M66 36l8 22l4 38M42 110v28M58 110v28',
  };

  let currentView = 'front';
  let lastRecovery = null;
  let lastActive = [];

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
        fill="${fill}" fill-opacity="${opacity}" stroke="rgba(255,255,255,0.22)" stroke-width="0.7">
        <title>${title}</title>
      </ellipse>`;

      // 큰 근육 타원에만 % 숫자 표시 (첫 번째 타원만)
      const showText = hasData && TEXT_MUSCLES.has(region.muscle) && !textRendered.has(region.muscle);
      if (showText) textRendered.add(region.muscle);

      const text = showText
        ? `<text x="${region.cx}" y="${region.cy + 0.6}" text-anchor="middle" dominant-baseline="middle"
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
        <path class="mh-body-outline" d="${BODY_OUTLINE[view]}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
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
