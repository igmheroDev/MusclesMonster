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

  /**
   * 보디빌더 외곽 — peak(봉우리)와 valley(골)을 번갈아 둬서
   * 삼각근/이두/대퇴/종아리 굴곡이 외곽선에 보이게 함
   */
  const BODY_PATH =
    // 머리
    'M110 8C126 8 138 20 138 36C138 52 126 64 110 64C94 64 82 52 82 36C82 20 94 8 110 8Z' +
    // 목
    'M102 62L98 74' +
    // 좌 어깨 → 삼각근 PEAK → 겨드랑이 VALLEY
    'L82 80L60 90L38 106L24 120' +
    'L36 132' +
    // 좌 이두 PEAK → 팔꿈치 VALLEY
    'L20 148L12 164L16 180L28 194' +
    // 좌 전완 PEAK → 손목/손
    'L18 212L16 228L24 244L38 254L54 250L60 236' +
    // 좌 팔 안쪽 올라가며 겨드랑이
    'L54 218L50 198L52 176L60 156L74 136L90 120L98 114' +
    // 좌 몸통: 가슴 옆 → 허리 VALLEY → 엉덩이
    'L94 138L88 158L86 176L94 190L100 200' +
    'L90 212L80 222' +
    // 좌 대퇴 PEAK → 무릎 VALLEY
    'L64 240L50 260L44 284L50 306L62 322' +
    'L58 334' +
    // 좌 종아리 PEAK → 발목 → 발
    'L48 348L46 362L54 376L70 386L90 384L102 374' +
    // 좌 다리 안쪽 → 가랑이
    'L104 352L106 324L108 294L110 266L110 246L110 234' +
    // 우 대칭
    'L110 246L112 266L114 294L116 324L118 352L118 374' +
    'L130 384L150 386L166 376L174 362L172 348' +
    'L162 334L158 322L170 306L176 284L170 260L156 240' +
    'L140 222L130 212L120 200L126 190L134 176L132 158L126 138' +
    'L122 114L130 120L146 136L160 156L168 176L170 198L166 218L160 236' +
    'L166 250L182 254L196 244L204 228L202 212' +
    'L192 194L204 180L208 164L200 148' +
    'L184 132L196 120L182 106L160 90L138 80L122 74L118 62' +
    'C114 60 106 60 102 62Z';

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

  // 전면 — 퍼즐형 빵빵 근육 (외곽 굴곡에 맞춤)
  const FRONT_REGIONS = [
    // 삼각근 봉우리
    { muscle: 'shoulder', d: 'M48 86C34 94 28 112 34 128C42 144 62 148 78 134C88 124 90 108 82 96C74 84 58 80 48 86Z' },
    { muscle: 'shoulder', d: 'M172 86C186 94 192 112 186 128C178 144 158 148 142 134C132 124 130 108 138 96C146 84 162 80 172 86Z' },
    // 대흉근
    { muscle: 'chest', d: 'M84 102C96 92 108 96 110 110C110 126 104 140 94 146C82 152 70 144 66 130C62 116 72 106 84 102Z' },
    { muscle: 'chest', d: 'M136 102C124 92 112 96 110 110C110 126 116 140 126 146C138 152 150 144 154 130C158 116 148 106 136 102Z' },
    // 이두 피크
    { muscle: 'biceps', d: 'M38 126C28 138 24 160 28 180C32 196 42 206 54 202C64 198 68 182 64 164C60 142 52 132 44 128C42 126 40 124 38 126Z' },
    { muscle: 'biceps', d: 'M182 126C192 138 196 160 192 180C188 196 178 206 166 202C156 198 152 182 156 164C160 142 168 132 176 128C178 126 180 124 182 126Z' },
    // 전완
    { muscle: 'forearms', d: 'M28 196C20 208 20 226 26 242C30 254 42 260 52 254C60 248 62 234 58 222C54 208 44 200 36 196C34 196 30 196 28 196Z' },
    { muscle: 'forearms', d: 'M192 196C200 208 200 226 194 242C190 254 178 260 168 254C160 248 158 234 162 222C166 208 176 200 184 196C186 196 190 196 192 196Z' },
    // 코어
    { muscle: 'core', d: 'M90 150C100 140 120 140 130 150C138 158 140 172 136 190C130 212 122 224 110 224C98 224 90 212 84 190C80 172 82 158 90 150Z' },
    // 대퇴 바깥 피크
    { muscle: 'quads', d: 'M82 220C94 206 108 214 110 238C112 268 108 300 100 324C96 336 86 340 74 330C64 320 60 298 62 274C64 248 70 230 82 220Z' },
    { muscle: 'quads', d: 'M138 220C126 206 112 214 110 238C108 268 112 300 120 324C124 336 134 340 146 330C156 320 160 298 158 274C156 248 150 230 138 220Z' },
    // 내전
    { muscle: 'adductors', d: 'M102 242C106 232 114 232 118 242C122 252 122 272 118 294C116 304 114 310 110 310C106 310 104 304 102 294C98 272 98 252 102 242Z' },
    // 종아리 다이아몬드
    { muscle: 'calves', d: 'M72 332C86 318 102 328 104 350C106 366 100 380 88 386C76 392 66 380 64 362C62 348 64 338 72 332Z' },
    { muscle: 'calves', d: 'M148 332C134 318 118 328 116 350C114 366 120 380 132 386C144 392 154 380 156 362C158 348 156 338 148 332Z' },
  ];

  // 후면
  const BACK_REGIONS = [
    { muscle: 'shoulder', d: 'M48 86C34 94 28 112 34 128C42 144 62 148 78 134C88 124 90 108 82 96C74 84 58 80 48 86Z' },
    { muscle: 'shoulder', d: 'M172 86C186 94 192 112 186 128C178 144 158 148 142 134C132 124 130 108 138 96C146 84 162 80 172 86Z' },
    { muscle: 'back', d: 'M74 94C94 78 126 78 146 94C158 104 164 122 156 140C142 160 124 168 110 162C96 168 78 160 64 140C56 122 62 104 74 94Z' },
    { muscle: 'back', d: 'M84 150C98 138 122 138 136 150C146 160 148 176 138 192C128 208 116 216 110 212C104 216 92 208 82 192C72 176 74 160 84 150Z' },
    { muscle: 'triceps', d: 'M38 126C28 138 24 160 28 180C32 196 42 206 54 202C64 198 68 182 64 164C60 142 52 132 44 128C42 126 40 124 38 126Z' },
    { muscle: 'triceps', d: 'M182 126C192 138 196 160 192 180C188 196 178 206 166 202C156 198 152 182 156 164C160 142 168 132 176 128C178 126 180 124 182 126Z' },
    { muscle: 'forearms', d: 'M28 196C20 208 20 226 26 242C30 254 42 260 52 254C60 248 62 234 58 222C54 208 44 200 36 196C34 196 30 196 28 196Z' },
    { muscle: 'forearms', d: 'M192 196C200 208 200 226 194 242C190 254 178 260 168 254C160 248 158 234 162 222C166 208 176 200 184 196C186 196 190 196 192 196Z' },
    { muscle: 'hamstrings', d: 'M82 218C94 204 108 212 110 234C112 260 108 292 102 316C98 328 88 334 76 324C66 314 62 292 64 268C66 242 70 228 82 218Z' },
    { muscle: 'hamstrings', d: 'M138 218C126 204 112 212 110 234C108 260 112 292 118 316C122 328 132 334 144 324C154 314 158 292 156 268C154 242 150 228 138 218Z' },
    { muscle: 'adductors', d: 'M102 242C106 232 114 232 118 242C122 252 122 272 118 294C116 304 114 310 110 310C106 310 104 304 102 294C98 272 98 252 102 242Z' },
    { muscle: 'calves', d: 'M72 332C86 318 102 328 104 350C106 366 100 380 88 386C76 392 66 380 64 362C62 348 64 338 72 332Z' },
    { muscle: 'calves', d: 'M148 332C134 318 118 328 116 350C114 366 120 380 132 386C144 392 154 380 156 362C158 348 156 338 148 332Z' },
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
    return `
      <svg class="mh-svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" role="img" aria-label="근육 회복 히트맵 ${view === 'back' ? '후면' : '전면'}">
        <defs>
          <filter id="mhBodyShadow" x="-16%" y="-5%" width="132%" height="114%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.42" />
          </filter>
        </defs>
        <g class="mh-body-shell" filter="url(#mhBodyShadow)">
          <!-- 근육 굴곡 외곽 (검정→흰 갭→테라코타) -->
          <path class="mh-body-outline" d="${BODY_SILHOUETTE[view]}" fill="none" stroke="${OUTER_STROKE}" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"/>
          <path class="mh-body-gap" d="${BODY_SILHOUETTE[view]}" fill="none" stroke="${SEGMENT_STROKE}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
          <path class="mh-body-fill" d="${BODY_SILHOUETTE[view]}" fill="${TERRACOTTA}" stroke="none"/>
        </g>
        <!-- clip 제거: 근육 봉우리가 외곽 굴곡을 가리지 않도록 -->
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
