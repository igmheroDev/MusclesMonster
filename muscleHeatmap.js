// ============================================================
// RECOVR - 근육 히트맵 다이어그램 모듈 (독립 모듈)
// 스타일 A: 보디빌더형 해부 근육맵 (테라코타 + 흰 세그먼트 퍼즐)
// ============================================================

const MuscleHeatmap = (() => {
  const VIEWBOX_W = 220;
  const VIEWBOX_H = 380;

  const TERRACOTTA = '#c4785a';
  const SEGMENT_STROKE = '#ffffff';
  const OUTER_STROKE = '#1a1a1a';

  const TEXT_MUSCLES = new Set(['chest', 'back', 'quads', 'hamstrings', 'core', 'shoulder']);

  const TEXT_POSITIONS = {
    front: {
      shoulder: { x: 110, y: 98 },
      chest: { x: 110, y: 128 },
      core: { x: 110, y: 178 },
      quads: { x: 110, y: 268 },
    },
    back: {
      shoulder: { x: 110, y: 98 },
      back: { x: 110, y: 138 },
      hamstrings: { x: 110, y: 268 },
    },
  };

  // 보디빌더 외곽 (넓은 어깨·두꺼운 팔다리·V테이퍼)
  const BODY_PATH =
    'M110 8C126 8 138 20 138 36C138 52 126 64 110 64C94 64 82 52 82 36C82 20 94 8 110 8Z' +
    'M102 62L98 74' +
    'C72 78 46 92 36 112' +
    'C26 134 24 160 22 184' +
    'C20 204 18 222 24 238' +
    'C28 248 26 258 32 266' +
    'C38 274 52 270 58 258' +
    'L62 246' +
    'C58 220 58 194 62 170' +
    'C66 146 70 126 78 116' +
    'C84 108 90 104 98 102' +
    'L94 138' +
    'C90 164 92 186 100 200' +
    'L94 218' +
    'C76 236 66 268 64 298' +
    'C62 322 68 344 76 360' +
    'C78 368 76 376 74 380' +
    'C72 386 82 390 96 388' +
    'L108 384' +
    'C108 368 108 348 110 326' +
    'C112 296 114 268 114 244' +
    'L114 234' +
    'C114 268 116 296 118 326' +
    'C120 348 120 368 120 384' +
    'L132 388' +
    'C146 390 156 386 154 380' +
    'C152 376 150 368 152 360' +
    'C160 344 166 322 164 298' +
    'C162 268 152 236 134 218' +
    'L128 200' +
    'C136 186 138 164 134 138' +
    'L130 102' +
    'C138 104 144 108 150 116' +
    'C158 126 162 146 166 170' +
    'C170 194 170 220 166 246' +
    'L170 258' +
    'C176 270 190 274 196 266' +
    'C202 258 200 248 204 238' +
    'C210 222 208 204 206 184' +
    'C204 160 202 134 192 112' +
    'C182 92 156 78 130 74' +
    'L126 62' +
    'C122 60 114 60 102 62Z';

  const BODY_SILHOUETTE = { front: BODY_PATH, back: BODY_PATH };

  const HEAD_NECK = {
    front: [
      'M110 10C125 10 136 21 136 36C136 51 125 62 110 62C95 62 84 51 84 36C84 21 95 10 110 10Z',
      'M100 60C104 68 108 72 110 72C112 72 116 68 120 60C114 58 106 58 100 60Z',
    ],
    back: [
      'M110 10C125 10 136 21 136 36C136 51 125 62 110 62C95 62 84 51 84 36C84 21 95 10 110 10Z',
      'M100 60C104 68 108 72 110 72C112 72 116 68 120 60C114 58 106 58 100 60Z',
    ],
  };

  // 전면 — 퍼즐형 빵빵 근육
  const FRONT_REGIONS = [
    // 삼각근 (둥글고 큼)
    { muscle: 'shoulder', d: 'M52 82C38 90 32 108 40 124C48 138 66 142 80 130C90 120 92 104 84 92C76 80 62 76 52 82Z' },
    { muscle: 'shoulder', d: 'M168 82C182 90 188 108 180 124C172 138 154 142 140 130C130 120 128 104 136 92C144 80 158 76 168 82Z' },
    // 대흉근 좌/우
    { muscle: 'chest', d: 'M84 100C96 90 108 94 110 108C110 124 104 138 94 144C82 150 70 142 66 128C62 114 72 104 84 100Z' },
    { muscle: 'chest', d: 'M136 100C124 90 112 94 110 108C110 124 116 138 126 144C138 150 150 142 154 128C158 114 148 104 136 100Z' },
    // 이두 빵빵
    { muscle: 'biceps', d: 'M44 124C34 134 32 156 36 176C40 192 48 202 58 200C68 198 72 184 68 166C64 144 58 132 50 126C48 124 46 122 44 124Z' },
    { muscle: 'biceps', d: 'M176 124C186 134 188 156 184 176C180 192 172 202 162 200C152 198 148 184 152 166C156 144 162 132 170 126C172 124 174 122 176 124Z' },
    // 전완
    { muscle: 'forearms', d: 'M34 194C26 204 26 222 30 238C34 250 44 256 54 250C62 244 64 230 60 218C56 204 48 196 40 192C38 192 36 192 34 194Z' },
    { muscle: 'forearms', d: 'M186 194C194 204 194 222 190 238C186 250 176 256 166 250C158 244 156 230 160 218C164 204 172 196 180 192C182 192 184 192 186 194Z' },
    // 코어 (복근 영역)
    { muscle: 'core', d: 'M90 148C100 138 120 138 130 148C138 156 140 170 136 188C130 210 122 222 110 222C98 222 90 210 84 188C80 170 82 156 90 148Z' },
    // 대퇴사두 초대형
    { muscle: 'quads', d: 'M84 224C96 210 108 218 110 240C112 268 110 298 104 322C100 334 90 338 80 330C70 322 68 302 68 278C68 250 72 234 84 224Z' },
    { muscle: 'quads', d: 'M136 224C124 210 112 218 110 240C108 268 110 298 116 322C120 334 130 338 140 330C150 322 152 302 152 278C152 250 148 234 136 224Z' },
    // 내전
    { muscle: 'adductors', d: 'M102 240C106 230 114 230 118 240C122 250 122 270 118 292C116 302 114 308 110 308C106 308 104 302 102 292C98 270 98 250 102 240Z' },
    // 종아리 다이아몬드
    { muscle: 'calves', d: 'M78 330C90 318 104 326 106 346C108 362 104 374 94 380C84 386 74 376 72 360C70 346 70 336 78 330Z' },
    { muscle: 'calves', d: 'M142 330C130 318 116 326 114 346C112 362 116 374 126 380C136 386 146 376 148 360C150 346 150 336 142 330Z' },
  ];

  // 후면
  const BACK_REGIONS = [
    { muscle: 'shoulder', d: 'M52 82C38 90 32 108 40 124C48 138 66 142 80 130C90 120 92 104 84 92C76 80 62 76 52 82Z' },
    { muscle: 'shoulder', d: 'M168 82C182 90 188 108 180 124C172 138 154 142 140 130C130 120 128 104 136 92C144 80 158 76 168 82Z' },
    // 승모·광배 (V윙)
    { muscle: 'back', d: 'M76 92C94 78 126 78 144 92C156 102 162 120 154 138C140 158 124 166 110 160C96 166 80 158 66 138C58 120 64 102 76 92Z' },
    { muscle: 'back', d: 'M84 148C98 136 122 136 136 148C146 158 148 174 138 190C128 206 116 214 110 210C104 214 92 206 82 190C72 174 74 158 84 148Z' },
    { muscle: 'triceps', d: 'M44 124C34 134 32 156 36 176C40 192 48 202 58 200C68 198 72 184 68 166C64 144 58 132 50 126C48 124 46 122 44 124Z' },
    { muscle: 'triceps', d: 'M176 124C186 134 188 156 184 176C180 192 172 202 162 200C152 198 148 184 152 166C156 144 162 132 170 126C172 124 174 122 176 124Z' },
    { muscle: 'forearms', d: 'M34 194C26 204 26 222 30 238C34 250 44 256 54 250C62 244 64 230 60 218C56 204 48 196 40 192C38 192 36 192 34 194Z' },
    { muscle: 'forearms', d: 'M186 194C194 204 194 222 190 238C186 250 176 256 166 250C158 244 156 230 160 218C164 204 172 196 180 192C182 192 184 192 186 194Z' },
    // 둔근 + 햄스트링
    { muscle: 'hamstrings', d: 'M84 216C96 202 108 210 110 230C112 256 110 286 106 310C102 324 92 330 80 322C70 314 68 294 68 270C68 244 72 228 84 216Z' },
    { muscle: 'hamstrings', d: 'M136 216C124 202 112 210 110 230C108 256 110 286 114 310C118 324 128 330 140 322C150 314 152 294 152 270C152 244 148 228 136 216Z' },
    { muscle: 'adductors', d: 'M102 240C106 230 114 230 118 240C122 250 122 270 118 292C116 302 114 308 110 308C106 308 104 302 102 292C98 270 98 250 102 240Z' },
    { muscle: 'calves', d: 'M78 330C90 318 104 326 106 346C108 362 104 374 94 380C84 386 74 376 72 360C70 346 70 336 78 330Z' },
    { muscle: 'calves', d: 'M142 330C130 318 116 326 114 346C112 362 116 374 126 380C136 386 146 376 148 360C150 346 150 336 142 330Z' },
  ];

  const DETAIL_LINES = {
    front: [
      'M110 108L110 142',
      'M96 158L124 158',
      'M96 172L124 172',
      'M96 186L124 186',
      'M96 200L124 200',
      'M110 228L110 318',
      'M90 256L104 256',
      'M116 256L130 256',
      'M88 350L98 368',
      'M132 350L122 368',
    ],
    back: [
      'M110 90L110 206',
      'M88 112C98 128 106 136 110 140',
      'M132 112C122 128 114 136 110 140',
      'M92 166C102 180 110 186 110 186',
      'M128 166C118 180 110 186 110 186',
      'M110 236L110 318',
      'M88 350L98 368',
      'M132 350L122 368',
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
      `<path class="mh-base-part" d="${d}" fill="${TERRACOTTA}" stroke="${SEGMENT_STROKE}" stroke-width="2" stroke-linejoin="round"/>`
    ).join('');
  }

  function buildDetailLines(view) {
    return (DETAIL_LINES[view] || []).map((d) =>
      `<path class="mh-detail" d="${d}" fill="none" stroke="${SEGMENT_STROKE}" stroke-width="1.8" stroke-linecap="round" stroke-opacity="0.9"/>`
    ).join('');
  }

  function buildRegionsSvg(view, recovery) {
    const regions = view === 'back' ? BACK_REGIONS : FRONT_REGIONS;
    const textRendered = new Set();

    return regions.map((region) => {
      const { pct, hasData } = getMuscleData(region.muscle, recovery);
      const fill = getRecoveryColor(pct, hasData);
      const opacity = hasData ? 0.93 : 1;
      const label = getMuscleLabel(region.muscle);
      const title = hasData ? `${label} ${pct}%` : `${label} (기록 없음)`;
      const cls = getRecoveryClass(pct, hasData);

      const path = `<path class="mh-region ${cls}" data-muscle="${region.muscle}" data-label="${label}" data-pct="${hasData ? pct : ''}"
        d="${region.d}" fill="${fill}" fill-opacity="${opacity}" stroke="${SEGMENT_STROKE}" stroke-width="2.4" stroke-linejoin="round">
        <title>${title}</title>
      </path>`;

      const showText = hasData && TEXT_MUSCLES.has(region.muscle) && !textRendered.has(region.muscle);
      if (showText) textRendered.add(region.muscle);
      const textPos = TEXT_POSITIONS[view]?.[region.muscle] || { x: 110, y: 180 };

      const text = showText
        ? `<text x="${textPos.x}" y="${textPos.y}" text-anchor="middle" dominant-baseline="middle"
            class="mh-region-text" fill="#ffffff" font-size="11" font-weight="800" pointer-events="none">${pct}%</text>`
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
          <filter id="mhBodyShadow" x="-14%" y="-5%" width="128%" height="114%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.42" />
          </filter>
          <clipPath id="${clipId}">
            <path d="${BODY_SILHOUETTE[view]}" />
          </clipPath>
        </defs>
        <g class="mh-body-shell" filter="url(#mhBodyShadow)">
          <path class="mh-body-outline" d="${BODY_SILHOUETTE[view]}" fill="none" stroke="${OUTER_STROKE}" stroke-width="6" stroke-linejoin="round"/>
          <path class="mh-body-gap" d="${BODY_SILHOUETTE[view]}" fill="none" stroke="${SEGMENT_STROKE}" stroke-width="3.4" stroke-linejoin="round"/>
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
