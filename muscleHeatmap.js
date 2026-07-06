// ============================================================
// RECOVR - 근육 히트맵 다이어그램 모듈 (독립 모듈)
// 전면/후면 신체 실루엣에 부위별 회복도 색상 표시
// ============================================================

const MuscleHeatmap = (() => {
  const VIEWBOX_W = 100;
  const VIEWBOX_H = 160;

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
    return regions.map((region) => {
      const { pct, hasData } = getMuscleData(region.muscle, recovery);
      const fill = getRecoveryColor(pct, hasData);
      const opacity = hasData ? 0.82 : 0.35;
      const label = getMuscleLabel(region.muscle);
      const title = hasData ? `${label} ${pct}%` : `${label} (기록 없음)`;
      return `<ellipse class="mh-region" data-muscle="${region.muscle}" data-label="${label}" data-pct="${hasData ? pct : ''}"
        cx="${region.cx}" cy="${region.cy}" rx="${region.rx}" ry="${region.ry}"
        fill="${fill}" fill-opacity="${opacity}" stroke="rgba(255,255,255,0.12)" stroke-width="0.6">
        <title>${title}</title>
      </ellipse>`;
    }).join('');
  }

  function buildLegend() {
    const items = [
      { color: 'var(--red)', label: '40% 미만' },
      { color: 'var(--orange)', label: '40~70%' },
      { color: 'var(--yellow)', label: '70~95%' },
      { color: 'var(--green)', label: '95%+' },
    ];
    return items.map((item) => `
      <span class="mh-legend-item">
        <span class="mh-legend-dot" style="background:${item.color}"></span>${item.label}
      </span>`).join('');
  }

  function buildSvg(view, recovery) {
    return `
      <svg class="mh-svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" role="img" aria-label="근육 회복 히트맵 ${view === 'back' ? '후면' : '전면'}">
        <path class="mh-body-outline" d="${BODY_OUTLINE[view]}" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
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
    tip.textContent = pct ? `${label} · 회복 ${pct}%` : `${label} · 기록 없음`;
    tip.style.display = 'block';
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
        <div class="mh-header">
          <div class="mh-title">근육 회복 히트맵</div>
          <div class="mh-toggle">
            <button type="button" class="mh-toggle-btn ${currentView === 'front' ? 'selected' : ''}" data-view="front">전면</button>
            <button type="button" class="mh-toggle-btn ${currentView === 'back' ? 'selected' : ''}" data-view="back">후면</button>
          </div>
        </div>
        <div class="mh-body-wrap">
          ${buildSvg(currentView, lastRecovery)}
          <div class="mh-tooltip" id="mhTooltip" style="display:none"></div>
        </div>
        <div class="mh-legend">${buildLegend()}</div>
        <div class="mh-sub">${hasData ? `${viewLabel} · 탭하여 부위 확인` : '운동 기록을 추가하면 부위별 회복도가 표시돼요'}</div>
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
