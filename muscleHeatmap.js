// ============================================================
// RECOVR - 근육 히트맵 다이어그램 모듈 (독립 모듈)
// 전면/후면 인체형 실루엣 + 해부학 근육 패스에 회복도 색상 표시
// ============================================================

const MuscleHeatmap = (() => {
  const VIEWBOX_W = 200;
  const VIEWBOX_H = 340;

  const TEXT_MUSCLES = new Set(['chest', 'back', 'quads', 'hamstrings', 'core', 'shoulder']);

  const TEXT_POSITIONS = {
    front: {
      shoulder: { x: 100, y: 88 },
      chest: { x: 100, y: 118 },
      core: { x: 100, y: 158 },
      quads: { x: 100, y: 242 },
    },
    back: {
      shoulder: { x: 100, y: 88 },
      back: { x: 100, y: 126 },
      hamstrings: { x: 100, y: 242 },
    },
  };

  /**
   * 인체 실루엣 — 좁은 목, V테이퍼 몸통, 팔 분리, 허벅지→종아리→발 비율, 가랑이 분리
   */
  const BODY_PATH =
    // 머리
    'M100 12C112 12 122 22 122 34C122 46 112 56 100 56C88 56 78 46 78 34C78 22 88 12 100 12Z' +
    // 목·어깨·팔·몸통·다리 (자연스러운 운동선수 비율)
    'M94 54L92 63' +
    'C76 67 58 78 52 92' +
    'C46 108 44 126 42 146' +
    'C40 162 38 176 40 188' +
    'C42 196 40 204 42 210' +
    'C44 216 52 218 58 214' +
    'L62 210' +
    'C62 198 60 186 60 174' +
    'C60 158 62 142 64 128' +
    'C66 114 68 104 72 100' +
    'C74 96 76 94 80 94' +
    'L80 128' +
    'C81 146 84 160 88 170' +
    'L86 186' +
    'C76 200 70 224 68 250' +
    'C66 270 68 288 72 302' +
    'C74 310 72 318 70 324' +
    'C68 330 74 334 84 332' +
    'L94 328' +
    'C94 316 94 300 96 284' +
    'C98 260 99 236 99 214' +
    'L99 208' +
    'L101 208' +
    'C101 236 102 260 104 284' +
    'C106 300 106 316 106 328' +
    'L116 332' +
    'C126 334 132 330 130 324' +
    'C128 318 126 310 128 302' +
    'C132 288 134 270 132 250' +
    'C130 224 124 200 114 186' +
    'L112 170' +
    'C116 160 119 146 120 128' +
    'L120 94' +
    'C124 94 126 96 128 100' +
    'C132 104 134 114 136 128' +
    'C138 142 140 158 140 174' +
    'C140 186 138 198 138 210' +
    'L142 214' +
    'C148 218 156 216 158 210' +
    'C160 204 158 196 160 188' +
    'C162 176 160 162 158 146' +
    'C156 126 154 108 148 92' +
    'C142 78 124 67 108 63' +
    'L106 54' +
    'C103 53 97 53 94 54Z';

  const BODY_SILHOUETTE = {
    front: BODY_PATH,
    back: BODY_PATH,
  };

  // 전면 근육 — 해부학 형태 (실루엣 비율에 맞춤)
  const FRONT_REGIONS = [
    { muscle: 'shoulder', d: 'M52 82C44 88 42 100 46 110C50 118 58 120 66 114C72 108 74 98 70 90C66 82 58 78 52 82Z' },
    { muscle: 'shoulder', d: 'M148 82C156 88 158 100 154 110C150 118 142 120 134 114C128 108 126 98 130 90C134 82 142 78 148 82Z' },
    { muscle: 'chest', d: 'M78 98C88 90 112 90 122 98C130 104 132 118 126 128C118 138 108 142 100 138C92 142 82 138 74 128C68 118 70 104 78 98Z' },
    { muscle: 'biceps', d: 'M48 112C42 118 40 132 40 146C40 158 44 168 50 170C56 172 60 164 60 152C60 136 58 122 54 114C52 110 50 110 48 112Z' },
    { muscle: 'biceps', d: 'M152 112C158 118 160 132 160 146C160 158 156 168 150 170C144 172 140 164 140 152C140 136 142 122 146 114C148 110 150 110 152 112Z' },
    { muscle: 'forearms', d: 'M40 168C34 174 34 186 36 198C38 206 44 210 50 208C54 206 56 198 54 188C52 176 48 168 44 166C42 166 40 166 40 168Z' },
    { muscle: 'forearms', d: 'M160 168C166 174 166 186 164 198C162 206 156 210 150 208C146 206 144 198 146 188C148 176 152 168 156 166C158 166 160 166 160 168Z' },
    { muscle: 'core', d: 'M86 140C94 134 106 134 114 140C120 146 122 158 118 172C114 186 108 194 100 194C92 194 86 186 82 172C78 158 80 146 86 140Z' },
    { muscle: 'quads', d: 'M80 200C90 192 98 198 100 214C102 236 100 258 96 278C94 286 88 290 82 286C76 282 74 268 74 250C74 228 74 210 80 200Z' },
    { muscle: 'quads', d: 'M120 200C110 192 102 198 100 214C98 236 100 258 104 278C106 286 112 290 118 286C124 282 126 268 126 250C126 228 126 210 120 200Z' },
    { muscle: 'adductors', d: 'M94 210C98 204 102 204 106 210C108 216 108 230 106 248C104 256 102 260 100 260C98 260 96 256 94 248C92 230 92 216 94 210Z' },
    { muscle: 'calves', d: 'M76 284C84 276 94 280 96 294C98 306 96 316 90 320C84 324 78 318 76 308C74 298 72 288 76 284Z' },
    { muscle: 'calves', d: 'M124 284C116 276 106 280 104 294C102 306 104 316 110 320C116 324 122 318 124 308C126 298 128 288 124 284Z' },
  ];

  // 후면 근육
  const BACK_REGIONS = [
    { muscle: 'shoulder', d: 'M52 82C44 88 42 100 46 110C50 118 58 120 66 114C72 108 74 98 70 90C66 82 58 78 52 82Z' },
    { muscle: 'shoulder', d: 'M148 82C156 88 158 100 154 110C150 118 142 120 134 114C128 108 126 98 130 90C134 82 142 78 148 82Z' },
    { muscle: 'back', d: 'M74 94C86 84 114 84 126 94C134 100 138 114 132 128C122 144 110 150 100 146C90 150 78 144 68 128C62 114 66 100 74 94Z' },
    { muscle: 'back', d: 'M82 140C92 132 108 132 118 140C124 146 126 158 120 170C114 182 106 186 100 184C94 186 86 182 80 170C74 158 76 146 82 140Z' },
    { muscle: 'triceps', d: 'M48 112C42 118 40 132 40 146C40 158 44 168 50 170C56 172 60 164 60 152C60 136 58 122 54 114C52 110 50 110 48 112Z' },
    { muscle: 'triceps', d: 'M152 112C158 118 160 132 160 146C160 158 156 168 150 170C144 172 140 164 140 152C140 136 142 122 146 114C148 110 150 110 152 112Z' },
    { muscle: 'forearms', d: 'M40 168C34 174 34 186 36 198C38 206 44 210 50 208C54 206 56 198 54 188C52 176 48 168 44 166C42 166 40 166 40 168Z' },
    { muscle: 'forearms', d: 'M160 168C166 174 166 186 164 198C162 206 156 210 150 208C146 206 144 198 146 188C148 176 152 168 156 166C158 166 160 166 160 168Z' },
    { muscle: 'hamstrings', d: 'M80 200C90 192 98 198 100 214C102 236 100 258 96 278C94 286 88 290 82 286C76 282 74 268 74 250C74 228 74 210 80 200Z' },
    { muscle: 'hamstrings', d: 'M120 200C110 192 102 198 100 214C98 236 100 258 104 278C106 286 112 290 118 286C124 282 126 268 126 250C126 228 126 210 120 200Z' },
    { muscle: 'adductors', d: 'M94 210C98 204 102 204 106 210C108 216 108 230 106 248C104 256 102 260 100 260C98 260 96 256 94 248C92 230 92 216 94 210Z' },
    { muscle: 'calves', d: 'M76 284C84 276 94 280 96 294C98 306 96 316 90 320C84 324 78 318 76 308C74 298 72 288 76 284Z' },
    { muscle: 'calves', d: 'M124 284C116 276 106 280 104 294C102 306 104 316 110 320C116 324 122 318 124 308C126 298 128 288 124 284Z' },
  ];

  const DETAIL_LINES = {
    front: [
      'M100 60L100 70',
      'M88 118C94 122 106 122 112 118',
      'M100 142L100 186',
      'M92 154L108 154',
      'M92 166L108 166',
      'M92 178L108 178',
      'M100 214L100 272',
    ],
    back: [
      'M100 60L100 70',
      'M100 96L100 160',
      'M84 112C90 126 96 134 100 138',
      'M116 112C110 126 104 134 100 138',
      'M100 214L100 272',
    ],
  };

  let currentView = 'front';
  let lastRecovery = null;
  let lastActive = [];

  function getRecoveryColor(pct, hasData) {
    if (!hasData) return 'rgba(255,255,255,0.08)';
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

  function buildDetailLines(view) {
    return (DETAIL_LINES[view] || []).map((d) =>
      `<path class="mh-detail" d="${d}" fill="none" stroke="rgba(255,255,255,0.13)" stroke-width="1.4" stroke-linecap="round"/>`
    ).join('');
  }

  function buildRegionsSvg(view, recovery) {
    const regions = view === 'back' ? BACK_REGIONS : FRONT_REGIONS;
    const textRendered = new Set();

    return regions.map((region) => {
      const { pct, hasData } = getMuscleData(region.muscle, recovery);
      const fill = getRecoveryColor(pct, hasData);
      const opacity = hasData ? 0.86 : 0.30;
      const label = getMuscleLabel(region.muscle);
      const title = hasData ? `${label} ${pct}%` : `${label} (기록 없음)`;
      const cls = getRecoveryClass(pct, hasData);

      const path = `<path class="mh-region ${cls}" data-muscle="${region.muscle}" data-label="${label}" data-pct="${hasData ? pct : ''}"
        d="${region.d}" fill="${fill}" fill-opacity="${opacity}" stroke="rgba(255,255,255,0.22)" stroke-width="1.1">
        <title>${title}</title>
      </path>`;

      const showText = hasData && TEXT_MUSCLES.has(region.muscle) && !textRendered.has(region.muscle);
      if (showText) textRendered.add(region.muscle);
      const textPos = TEXT_POSITIONS[view]?.[region.muscle] || { x: 100, y: 170 };

      const text = showText
        ? `<text x="${textPos.x}" y="${textPos.y}" text-anchor="middle" dominant-baseline="middle"
            class="mh-region-text" fill="rgba(255,255,255,0.96)" font-size="10" font-weight="700" pointer-events="none">${pct}%</text>`
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
          <linearGradient id="mhSkinFill" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stop-color="#d8bc98" stop-opacity="0.32" />
            <stop offset="50%" stop-color="#b89572" stop-opacity="0.22" />
            <stop offset="100%" stop-color="#8a7056" stop-opacity="0.16" />
          </linearGradient>
          <linearGradient id="mhSkinEdge" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.26" />
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0.10" />
          </linearGradient>
          <filter id="mhBodyShadow" x="-18%" y="-6%" width="136%" height="116%">
            <feDropShadow dx="0" dy="5" stdDeviation="8" flood-color="#000000" flood-opacity="0.45" />
          </filter>
          <clipPath id="${clipId}">
            <path d="${BODY_SILHOUETTE[view]}" />
          </clipPath>
        </defs>
        <g class="mh-body-shell" filter="url(#mhBodyShadow)">
          <path class="mh-body-fill" d="${BODY_SILHOUETTE[view]}" fill="url(#mhSkinFill)" stroke="url(#mhSkinEdge)" stroke-width="2.2" stroke-linejoin="round"/>
        </g>
        <g class="mh-muscles" clip-path="url(#${clipId})">
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
  };
})();
