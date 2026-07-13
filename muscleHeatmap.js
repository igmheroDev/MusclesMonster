// ============================================================
// RECOVR - 근육 히트맵 다이어그램 모듈 (독립 모듈)
// 스타일 2(중간): 근육 굴곡 외곽 + 큰 부위만 분할
// ============================================================

const MuscleHeatmap = (() => {
  const VIEWBOX_W = 200;
  const VIEWBOX_H = 360;

  const TERRACOTTA = '#c4785a';
  const SEGMENT_STROKE = '#ffffff';
  const OUTER_STROKE = '#1a1a1a';

  const TEXT_MUSCLES = new Set(['chest', 'back', 'quads', 'hamstrings', 'core', 'shoulder']);

  const TEXT_POSITIONS = {
    front: {
      shoulder: { x: 100, y: 96 },
      chest: { x: 100, y: 124 },
      core: { x: 100, y: 172 },
      quads: { x: 100, y: 255 },
    },
    back: {
      shoulder: { x: 100, y: 96 },
      back: { x: 100, y: 132 },
      hamstrings: { x: 100, y: 255 },
    },
  };

  /**
   * 중간 스타일 외곽
   * - 미끈한 소세지 금지
   * - 삼각근 / 이두 / 허리 / 대퇴 / 종아리 봉우리가 부드러운 곡선으로 보임
   * clip-path로 잘라내지 않음 (외곽 굴곡 유지)
   */
  const BODY_PATH =
    // 머리
    'M100 10' +
    'C114 10 125 21 125 35' +
    'C125 49 114 60 100 60' +
    'C86 60 75 49 75 35' +
    'C75 21 86 10 100 10Z' +
    // 목
    'M93 58L90 70' +
    // 좌 어깨 → 삼각근 봉우리
    'C78 74 62 82 48 92' +
    'C36 100 28 112 26 124' +
    // 삼각근 아래 골 → 이두 봉우리
    'C30 132 28 140 24 150' +
    'C20 162 18 174 22 186' +
    // 팔꿈치 골 → 전완 → 손
    'C24 198 20 210 22 222' +
    'C24 232 30 240 40 242' +
    'C50 244 58 238 60 228' +
    // 팔 안쪽 → 겨드랑이
    'C56 214 54 198 54 182' +
    'C54 166 56 150 62 138' +
    'C68 126 76 116 86 110' +
    // 몸통 옆: 가슴 → 허리 잘록 → 엉덩이
    'L84 138' +
    'C80 154 78 168 82 180' +
    'C84 190 80 200 74 208' +
    // 대퇴 바깥 봉우리
    'C62 224 52 244 50 266' +
    'C48 284 52 300 58 314' +
    // 무릎 골 → 종아리 봉우리 → 발
    'C54 324 50 336 52 348' +
    'C54 356 60 362 70 362' +
    'C80 362 90 358 94 350' +
    // 다리 안쪽 → 가랑이
    'C94 336 94 318 96 300' +
    'C98 276 100 254 100 236' +
    'L100 228' +
    // 우 대칭
    'L100 236' +
    'C100 254 102 276 104 300' +
    'C106 318 106 336 106 350' +
    'C110 358 120 362 130 362' +
    'C140 362 146 356 148 348' +
    'C150 336 146 324 142 314' +
    'C148 300 152 284 150 266' +
    'C148 244 138 224 126 208' +
    'C120 200 116 190 118 180' +
    'C122 168 120 154 116 138' +
    'L114 110' +
    'C124 116 132 126 138 138' +
    'C144 150 146 166 146 182' +
    'C146 198 144 214 140 228' +
    'C142 238 150 244 160 242' +
    'C170 240 176 232 178 222' +
    'C180 210 176 198 178 186' +
    'C182 174 180 162 176 150' +
    'C172 140 170 132 174 124' +
    'C172 112 164 100 152 92' +
    'C138 82 122 74 110 70' +
    'L107 58' +
    'C104 56 96 56 93 58Z';

  const BODY_SILHOUETTE = { front: BODY_PATH, back: BODY_PATH };

  // 머리·목 (비상호작용)
  const HEAD_NECK = {
    front: [
      'M100 12C113 12 123 22 123 35C123 48 113 58 100 58C87 58 77 48 77 35C77 22 87 12 100 12Z',
      'M91 56C94 64 98 68 100 68C102 68 106 64 109 56C104 54 96 54 91 56Z',
    ],
    back: [
      'M100 12C113 12 123 22 123 35C123 48 113 58 100 58C87 58 77 48 77 35C77 22 87 12 100 12Z',
      'M91 56C94 64 98 68 100 68C102 68 106 64 109 56C104 54 96 54 91 56Z',
    ],
  };

  // 전면 — 큰 부위만 (중간 밀도)
  const FRONT_REGIONS = [
    { muscle: 'shoulder', d: 'M46 90C34 98 30 114 36 128C42 140 58 142 70 132C78 124 80 110 72 100C64 90 54 86 46 90Z' },
    { muscle: 'shoulder', d: 'M154 90C166 98 170 114 164 128C158 140 142 142 130 132C122 124 120 110 128 100C136 90 146 86 154 90Z' },
    { muscle: 'chest', d: 'M78 104C90 94 110 94 122 104C130 112 132 126 124 136C114 146 106 148 100 144C94 148 86 146 76 136C68 126 70 112 78 104Z' },
    { muscle: 'biceps', d: 'M40 128C32 138 30 156 32 172C34 186 42 194 50 192C58 190 60 176 58 160C56 144 50 134 44 130C42 128 40 128 40 128Z' },
    { muscle: 'biceps', d: 'M160 128C168 138 170 156 168 172C166 186 158 194 150 192C142 190 140 176 142 160C144 144 150 134 156 130C158 128 160 128 160 128Z' },
    { muscle: 'forearms', d: 'M34 188C28 198 28 214 32 228C36 238 46 242 54 236C60 230 60 218 56 208C52 196 44 190 38 188C36 188 34 188 34 188Z' },
    { muscle: 'forearms', d: 'M166 188C172 198 172 214 168 228C164 238 154 242 146 236C140 230 140 218 144 208C148 196 156 190 162 188C164 188 166 188 166 188Z' },
    { muscle: 'core', d: 'M84 144C94 136 106 136 116 144C122 150 124 164 120 180C114 200 108 210 100 210C92 210 86 200 80 180C76 164 78 150 84 144Z' },
    { muscle: 'quads', d: 'M76 214C88 202 100 210 102 230C104 254 102 280 96 300C92 310 84 314 76 308C68 302 66 284 66 264C66 240 68 224 76 214Z' },
    { muscle: 'quads', d: 'M124 214C112 202 100 210 98 230C96 254 98 280 104 300C108 310 116 314 124 308C132 302 134 284 134 264C134 240 132 224 124 214Z' },
    { muscle: 'adductors', d: 'M94 230C98 222 102 222 106 230C108 238 108 254 106 272C104 280 102 284 100 284C98 284 96 280 94 272C92 254 92 238 94 230Z' },
    { muscle: 'calves', d: 'M70 308C82 298 94 306 96 324C98 338 94 350 84 354C74 358 66 348 64 334C62 322 64 312 70 308Z' },
    { muscle: 'calves', d: 'M130 308C118 298 106 306 104 324C102 338 106 350 116 354C126 358 134 348 136 334C138 322 136 312 130 308Z' },
  ];

  // 후면 — 큰 부위만
  const BACK_REGIONS = [
    { muscle: 'shoulder', d: 'M46 90C34 98 30 114 36 128C42 140 58 142 70 132C78 124 80 110 72 100C64 90 54 86 46 90Z' },
    { muscle: 'shoulder', d: 'M154 90C166 98 170 114 164 128C158 140 142 142 130 132C122 124 120 110 128 100C136 90 146 86 154 90Z' },
    { muscle: 'back', d: 'M72 96C88 84 112 84 128 96C138 104 142 120 134 136C122 154 108 160 100 156C92 160 78 154 66 136C58 120 62 104 72 96Z' },
    { muscle: 'back', d: 'M82 144C94 134 106 134 118 144C126 152 128 166 120 180C112 194 104 200 100 198C96 200 88 194 80 180C72 166 74 152 82 144Z' },
    { muscle: 'triceps', d: 'M40 128C32 138 30 156 32 172C34 186 42 194 50 192C58 190 60 176 58 160C56 144 50 134 44 130C42 128 40 128 40 128Z' },
    { muscle: 'triceps', d: 'M160 128C168 138 170 156 168 172C166 186 158 194 150 192C142 190 140 176 142 160C144 144 150 134 156 130C158 128 160 128 160 128Z' },
    { muscle: 'forearms', d: 'M34 188C28 198 28 214 32 228C36 238 46 242 54 236C60 230 60 218 56 208C52 196 44 190 38 188C36 188 34 188 34 188Z' },
    { muscle: 'forearms', d: 'M166 188C172 198 172 214 168 228C164 238 154 242 146 236C140 230 140 218 144 208C148 196 156 190 162 188C164 188 166 188 166 188Z' },
    { muscle: 'hamstrings', d: 'M76 212C88 200 100 208 102 228C104 252 102 278 96 298C92 308 84 312 76 306C68 300 66 282 66 262C66 238 68 222 76 212Z' },
    { muscle: 'hamstrings', d: 'M124 212C112 200 100 208 98 228C96 252 98 278 104 298C108 308 116 312 124 306C132 300 134 282 134 262C134 238 132 222 124 212Z' },
    { muscle: 'adductors', d: 'M94 230C98 222 102 222 106 230C108 238 108 254 106 272C104 280 102 284 100 284C98 284 96 280 94 272C92 254 92 238 94 230Z' },
    { muscle: 'calves', d: 'M70 308C82 298 94 306 96 324C98 338 94 350 84 354C74 358 66 348 64 334C62 322 64 312 70 308Z' },
    { muscle: 'calves', d: 'M130 308C118 298 106 306 104 324C102 338 106 350 116 354C126 358 134 348 136 334C138 322 136 312 130 308Z' },
  ];

  // 중간 디테일 가이드 (클릭 불가) — 복근·중앙선 정도만
  const DETAIL_LINES = {
    front: [
      'M100 112L100 140',
      'M88 156L112 156',
      'M88 170L112 170',
      'M88 184L112 184',
      'M100 220L100 296',
    ],
    back: [
      'M100 100L100 190',
      'M84 118C92 132 98 140 100 144',
      'M116 118C108 132 102 140 100 144',
      'M100 220L100 296',
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
      `<path class="mh-base-part" d="${d}" fill="${TERRACOTTA}" stroke="${SEGMENT_STROKE}" stroke-width="1.8" stroke-linejoin="round"/>`
    ).join('');
  }

  function buildDetailLines(view) {
    return (DETAIL_LINES[view] || []).map((d) =>
      `<path class="mh-detail" d="${d}" fill="none" stroke="${SEGMENT_STROKE}" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.75"/>`
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
        d="${region.d}" fill="${fill}" fill-opacity="${opacity}" stroke="${SEGMENT_STROKE}" stroke-width="2" stroke-linejoin="round">
        <title>${title}</title>
      </path>`;

      const showText = hasData && TEXT_MUSCLES.has(region.muscle) && !textRendered.has(region.muscle);
      if (showText) textRendered.add(region.muscle);
      const textPos = TEXT_POSITIONS[view]?.[region.muscle] || { x: 100, y: 170 };

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
    return `
      <svg class="mh-svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" role="img" aria-label="근육 회복 히트맵 ${view === 'back' ? '후면' : '전면'}">
        <defs>
          <filter id="mhBodyShadow" x="-16%" y="-5%" width="132%" height="114%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity="0.40" />
          </filter>
        </defs>
        <g class="mh-body-shell" filter="url(#mhBodyShadow)">
          <path class="mh-body-outline" d="${BODY_SILHOUETTE[view]}" fill="none" stroke="${OUTER_STROKE}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
          <path class="mh-body-gap" d="${BODY_SILHOUETTE[view]}" fill="none" stroke="${SEGMENT_STROKE}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
          <path class="mh-body-fill" d="${BODY_SILHOUETTE[view]}" fill="${TERRACOTTA}" stroke="none"/>
        </g>
        <g class="mh-muscles">
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
