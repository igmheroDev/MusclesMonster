// ============================================================
// RECOVR - 근성장/근손실 부위별 상세 뷰 (독립 모듈)
//
// MuscleGrowthTracker(홈 카드 · 지수 계산)와 MuscleHeatmap(회복 히트맵)의
// 완성된 로직은 전혀 수정하지 않고, 두 모듈이 이미 노출한 데이터/자산만
// 읽기 전용으로 재사용해 아래 두 가지를 새로 제공한다.
//
//  1) 홈의 "근성장 · 근손실 추적" 카드 바로 아래에 부위별 히트맵을 추가로
//     그려서, 어느 부위가 성장 중이고 어느 부위가 손실 중인지 한눈에 보여줌
//  2) 홈 카드의 "근성장 지수 / 근손실 지수"를 탭하면 부위별 퍼센트 목록을
//     바텀시트로 보여줌 (근성장 탭 → 성장 중 부위 리스트, 근손실 탭 → 손실 리스트)
// ============================================================

const MuscleGrowthDetail = (() => {
  const VIEWBOX_W = 240;
  const VIEWBOX_H = 360;
  const ASSET_VERSION = 'v53'; // MuscleHeatmap과 동일한 이미지/마스크 버전을 사용

  const GROWTH_COLOR = 'var(--green)';
  const LOSS_COLOR_MID = 'var(--orange)';
  const LOSS_COLOR_HIGH = 'var(--red)';
  const NEUTRAL_COLOR = 'var(--muted)';
  const LOSS_HIGH_RATIO = 0.5; // 손실 상한의 절반 이상이면 강한 손실(빨강)로 표시

  let currentView = 'front';
  let summaryHooked = false;

  // ------------------------------------------------------------
  // 다른 모듈 데이터 읽기 전용 참조
  // ------------------------------------------------------------
  function getMuscleOrder() {
    return (typeof MUSCLE_ORDER !== 'undefined') ? MUSCLE_ORDER : [];
  }

  function getMuscleLabel(muscleKey) {
    if (typeof MUSCLE_LABELS !== 'undefined' && MUSCLE_LABELS[muscleKey]) {
      return MUSCLE_LABELS[muscleKey].name;
    }
    if (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.getShortName) {
      return MuscleHeatmap.getShortName(muscleKey);
    }
    return muscleKey;
  }

  function getMuscleIcon(muscleKey) {
    if (typeof MUSCLE_LABELS !== 'undefined' && MUSCLE_LABELS[muscleKey]) {
      return MUSCLE_LABELS[muscleKey].icon || '🎯';
    }
    return '🎯';
  }

  function getShortName(muscleKey) {
    if (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.SHORT_NAMES && MuscleHeatmap.SHORT_NAMES[muscleKey]) {
      return MuscleHeatmap.SHORT_NAMES[muscleKey];
    }
    return getMuscleLabel(muscleKey);
  }

  function getFrontRegions() {
    return (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.FRONT_REGIONS) || [];
  }

  function getBackRegions() {
    return (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.BACK_REGIONS) || [];
  }

  function getLabelPositions(view) {
    return (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.LABEL_POSITIONS && MuscleHeatmap.LABEL_POSITIONS[view]) || {};
  }

  function assetUrl(path) {
    return `${path}?v=${ASSET_VERSION}`;
  }

  function getBodyImage(view) {
    const images = (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.BODY_IMAGES)
      || { front: 'body-map-front.png', back: 'body-map-back.png' };
    return assetUrl(images[view] || images.front);
  }

  function getBodyMask(view) {
    const masks = (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.BODY_MASKS)
      || { front: 'body-mask-front.png', back: 'body-mask-back.png' };
    return assetUrl(masks[view] || masks.front);
  }

  function getMaxGrowthPct() {
    return (typeof MuscleGrowthTracker !== 'undefined' && MuscleGrowthTracker.MAX_GROWTH_PCT) || 3;
  }

  function getMaxLossPct() {
    return (typeof MuscleGrowthTracker !== 'undefined' && MuscleGrowthTracker.MAX_LOSS_PCT) || 8;
  }

  function loadWorkoutsSafe() {
    try {
      return (typeof loadWorkouts === 'function') ? loadWorkouts() : [];
    } catch (e) {
      return [];
    }
  }

  function computeResult() {
    if (typeof MuscleGrowthTracker === 'undefined' || typeof MuscleGrowthTracker.compute !== 'function') return null;
    try {
      return MuscleGrowthTracker.compute(loadWorkoutsSafe(), new Date());
    } catch (e) {
      console.warn('[RECOVR] 근성장/근손실 상세 계산 실패:', e);
      return null;
    }
  }

  // ------------------------------------------------------------
  // 부위별 상태 판정 (히트맵 색상 결정용, growth/loss 두 지표 중 우세한 쪽 선택)
  // ------------------------------------------------------------
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function getMuscleVisual(perMuscle, muscleKey) {
    const entry = perMuscle && perMuscle[muscleKey];
    const growth = entry && entry.growth;
    const loss = entry && entry.loss;
    const growthPct = growth ? growth.growthPct : null;
    const lossPct = loss ? loss.lossPct : null;

    // 두 지표의 척도(상한값)가 다르므로 비율로 정규화해 우세 지표를 비교
    const growthRatio = growthPct != null ? growthPct / getMaxGrowthPct() : -1;
    const lossRatio = lossPct != null ? lossPct / getMaxLossPct() : -1;

    if (growthPct != null && growthPct > 0 && growthRatio >= lossRatio) {
      return { status: 'growth', pct: growthPct };
    }
    if (lossPct != null && lossPct > 0) {
      return { status: 'loss', pct: lossPct };
    }
    if (growthPct != null || lossPct != null) {
      return { status: 'neutral', pct: 0 };
    }
    return { status: 'idle', pct: null };
  }

  function getVisualFill(visual) {
    if (visual.status === 'growth') return GROWTH_COLOR;
    if (visual.status === 'loss') {
      const threshold = getMaxLossPct() * LOSS_HIGH_RATIO;
      return visual.pct >= threshold ? LOSS_COLOR_HIGH : LOSS_COLOR_MID;
    }
    if (visual.status === 'neutral') return NEUTRAL_COLOR;
    return 'transparent';
  }

  function getVisualOpacity(visual) {
    if (visual.status === 'growth') {
      return clamp(0.28 + (visual.pct / getMaxGrowthPct()) * 0.34, 0.28, 0.62);
    }
    if (visual.status === 'loss') {
      return clamp(0.28 + (visual.pct / getMaxLossPct()) * 0.34, 0.28, 0.62);
    }
    if (visual.status === 'neutral') return 0.16;
    return 0;
  }

  function buildTooltipText(label, visual) {
    if (visual.status === 'growth') return `${label} · 성장 +${visual.pct}%`;
    if (visual.status === 'loss') return `${label} · 손실 -${visual.pct}%`;
    if (visual.status === 'neutral') return `${label} · 정체 (변화 없음)`;
    return `${label} (기록 없음)`;
  }

  // ------------------------------------------------------------
  // 히트맵 SVG (MuscleHeatmap의 region path/이미지/마스크만 재사용)
  // ------------------------------------------------------------
  function buildRegionPaths(view, perMuscle) {
    const regions = view === 'back' ? getBackRegions() : getFrontRegions();

    return regions.map((region) => {
      const visual = getMuscleVisual(perMuscle, region.muscle);
      const fill = getVisualFill(visual);
      const opacity = getVisualOpacity(visual);
      const label = getMuscleLabel(region.muscle);
      const title = buildTooltipText(label, visual);

      return `<path class="mh-region" data-muscle="${region.muscle}" data-label="${label}" data-status="${visual.status}" data-pct="${visual.pct != null ? visual.pct : ''}"
        d="${region.d}" fill="${fill}" fill-opacity="${opacity}" stroke="none" pointer-events="all">
        <title>${title}</title>
      </path>`;
    }).join('');
  }

  function buildRegionLabels(view, perMuscle) {
    const positions = getLabelPositions(view);
    const labeled = new Set();

    return Object.keys(positions).map((muscle) => {
      if (labeled.has(muscle)) return '';
      labeled.add(muscle);

      const pos = positions[muscle];
      const visual = getMuscleVisual(perMuscle, muscle);
      const name = getShortName(muscle);

      if (visual.status === 'idle') {
        return `<text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="middle"
            class="mh-region-label mh-region-label--idle" data-muscle="${muscle}" pointer-events="none">${name}</text>`;
      }

      const pctText = visual.status === 'growth' ? `+${visual.pct}%`
        : visual.status === 'loss' ? `-${visual.pct}%`
        : '±0%';

      return `<text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="middle"
          class="mh-region-label mh-region-label--active" data-muscle="${muscle}" pointer-events="none">
          <tspan x="${pos.x}" dy="-5" class="mh-region-name">${name}</tspan>
          <tspan x="${pos.x}" dy="12" class="mh-region-pct">${pctText}</tspan>
        </text>`;
    }).join('');
  }

  function buildLegend() {
    const items = [
      { color: GROWTH_COLOR, label: '성장 중', sub: '+' },
      { color: NEUTRAL_COLOR, label: '정체', sub: '0%' },
      { color: LOSS_COLOR_MID, label: '손실 주의', sub: `~${Math.round(getMaxLossPct() * LOSS_HIGH_RATIO)}%` },
      { color: LOSS_COLOR_HIGH, label: '손실 심함', sub: `${Math.round(getMaxLossPct() * LOSS_HIGH_RATIO)}%+` },
    ];
    return items.map((item) => `
      <span class="mh-legend-item">
        <span class="mh-legend-dot" style="background:${item.color}"></span>
        <span class="mh-legend-label">${item.label}<span class="mh-legend-sub">${item.sub}</span></span>
      </span>`).join('');
  }

  function buildSvg(view, perMuscle) {
    const src = getBodyImage(view);
    const mask = getBodyMask(view);
    const maskId = `mgdMask-${view}`;
    return `
      <svg class="mh-svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" role="img" aria-label="근성장 근손실 히트맵 ${view === 'back' ? '후면' : '전면'}">
        <defs>
          <mask id="${maskId}">
            <image href="${mask}" x="0" y="0" width="${VIEWBOX_W}" height="${VIEWBOX_H}"
              preserveAspectRatio="xMidYMid meet"/>
          </mask>
        </defs>
        <image class="mh-body-image" href="${src}" x="0" y="0" width="${VIEWBOX_W}" height="${VIEWBOX_H}"
          preserveAspectRatio="xMidYMid meet" pointer-events="none"/>
        <g class="mh-muscles" mask="url(#${maskId})" style="mix-blend-mode:multiply">
          ${buildRegionPaths(view, perMuscle)}
        </g>
        <g class="mh-labels" aria-hidden="false">
          ${buildRegionLabels(view, perMuscle)}
        </g>
      </svg>`;
  }

  // ------------------------------------------------------------
  // 부위 탭 → 추천 운동 (ExerciseStimHeatmap의 완성된 "부위→운동" 시트를
  // 읽기 전용 공개 API로만 재사용. ExerciseStimHeatmap/MuscleHeatmap 코드는 수정하지 않음)
  // ------------------------------------------------------------
  function openMuscleExercises(muscleKey) {
    if (!muscleKey) return;
    // mgd-overlay(z-index 1220)가 esh-overlay(z-index 1200)보다 위에 있어
    // 목록 시트가 열린 상태로는 추천 운동 시트가 가려지므로 먼저 닫는다
    closeList();
    if (typeof ExerciseStimHeatmap !== 'undefined' && typeof ExerciseStimHeatmap.openMuscle === 'function') {
      ExerciseStimHeatmap.openMuscle(muscleKey);
    }
  }

  function onRegionTap(e) {
    const region = e.target.closest('.mh-region');
    if (!region) return;
    const tip = document.getElementById('mgdTooltip');
    if (tip) {
      const label = region.dataset.label || '';
      const status = region.dataset.status;
      const pct = region.dataset.pct;

      let statusText = '기록 없음';
      let statusClass = '';
      if (status === 'growth') { statusText = `성장 +${pct}% · 훈련 패턴 양호`; statusClass = 'good'; }
      else if (status === 'loss') { statusText = `손실 -${pct}% · 훈련 필요`; statusClass = 'low'; }
      else if (status === 'neutral') { statusText = '정체 · 최근 변화 없음'; statusClass = 'mid'; }

      tip.innerHTML = `<span class="mh-tip-label">${label}</span><span class="mh-tip-status ${statusClass}">${statusText}</span>`;
      tip.classList.add('visible');
      clearTimeout(tip._hideTimer);
      tip._hideTimer = setTimeout(() => tip.classList.remove('visible'), 2800);
    }

    openMuscleExercises(region.dataset.muscle);
  }

  function setView(view) {
    currentView = view === 'back' ? 'back' : 'front';
    renderHeatmapCard();
  }

  function renderHeatmapCard() {
    const container = document.getElementById('muscleGrowthHeatmapCard');
    if (!container) return;

    const result = computeResult();
    if (!result || !result.hasData) {
      container.innerHTML = '';
      return;
    }

    const perMuscle = result.perMuscle || {};
    const viewLabel = currentView === 'back' ? '후면' : '전면';

    container.innerHTML = `
      <div class="mh-card">
        <div class="mh-accent-bar" style="background:linear-gradient(90deg, var(--red) 0%, var(--orange) 35%, var(--muted) 55%, var(--green) 100%)"></div>
        <div class="mh-header">
          <div class="mh-title">🔥 근성장 · 근손실 히트맵</div>
          <div class="mh-toggle">
            <button type="button" class="mh-toggle-btn ${currentView === 'front' ? 'selected' : ''}" data-mgd-view="front">전면</button>
            <button type="button" class="mh-toggle-btn ${currentView === 'back' ? 'selected' : ''}" data-mgd-view="back">후면</button>
          </div>
        </div>
        <div class="mh-body-wrap">
          ${buildSvg(currentView, perMuscle)}
          <div class="mh-tooltip" id="mgdTooltip"></div>
        </div>
        <div class="mh-legend">${buildLegend()}</div>
        <div class="mh-sub">${viewLabel} 보기 · 부위를 탭하면 상태 확인 + 추천 운동 · 위 지수를 탭하면 목록으로 봐요</div>
      </div>`;

    container.querySelectorAll('[data-mgd-view]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        setView(btn.dataset.mgdView);
      });
    });
    const svg = container.querySelector('.mh-svg');
    if (svg) svg.addEventListener('click', onRegionTap);
  }

  // ------------------------------------------------------------
  // 부위별 성장/손실 목록 (탭 → 바텀시트)
  // ------------------------------------------------------------
  function getGrowthList(perMuscle) {
    return getMuscleOrder()
      .map((muscle) => ({ muscle, growth: perMuscle && perMuscle[muscle] && perMuscle[muscle].growth }))
      .filter((x) => x.growth && x.growth.growthPct > 0)
      .map((x) => ({ muscle: x.muscle, pct: x.growth.growthPct, sessionCount: x.growth.sessionCount }))
      .sort((a, b) => b.pct - a.pct);
  }

  function getLossList(perMuscle) {
    return getMuscleOrder()
      .map((muscle) => ({ muscle, loss: perMuscle && perMuscle[muscle] && perMuscle[muscle].loss }))
      .filter((x) => x.loss && x.loss.lossPct > 0)
      .map((x) => ({ muscle: x.muscle, pct: x.loss.lossPct, daysSince: x.loss.daysSince }))
      .sort((a, b) => b.pct - a.pct);
  }

  const LIST_CONFIG = {
    growth: {
      icon: '📈',
      kicker: '근성장',
      title: '성장 중인 부위',
      color: GROWTH_COLOR,
      emptyText: '아직 성장 중인 부위가 없어요. 최근 4주간 꾸준히, 점진적으로 훈련해보세요!',
      formatPct: (pct) => `+${pct}%`,
      formatSub: (item) => `최근 4주 세션 ${item.sessionCount}회 기준`,
    },
    loss: {
      icon: '📉',
      kicker: '근손실',
      title: '손실 중인 부위',
      color: LOSS_COLOR_HIGH,
      emptyText: '장기간 방치된 부위가 없어요. 지금처럼 유지해봐요!',
      formatPct: (pct) => `-${pct}%`,
      formatSub: (item) => `${item.daysSince}일째 미훈련`,
    },
  };

  function buildListItemHtml(item, config) {
    const label = getMuscleLabel(item.muscle);
    const icon = getMuscleIcon(item.muscle);
    return `
      <div class="mgd-list-item mgd-list-item--tap" role="button" tabindex="0"
        aria-label="${label} 추천 운동 보기"
        onclick="MuscleGrowthDetail.openMuscleExercises('${item.muscle}')">
        <div class="mgd-list-icon">${icon}</div>
        <div class="mgd-list-main">
          <div class="mgd-list-name">${label}</div>
          <div class="mgd-list-sub">${config.formatSub(item)}</div>
        </div>
        <div class="mgd-list-pct" style="color:${config.color}">${config.formatPct(item.pct)}</div>
        <div class="mgd-list-arrow" aria-hidden="true">›</div>
      </div>`;
  }

  function buildListSheetHtml(type, list, config) {
    const items = list.length
      ? list.map((item) => buildListItemHtml(item, config)).join('')
      : `<div class="mgd-list-empty">${config.emptyText}</div>`;

    return `
      <div class="mgd-sheet" onclick="event.stopPropagation()">
        <div class="mgd-sheet-header">
          <div>
            <div class="mgd-sheet-kicker">${config.icon} ${config.kicker}</div>
            <div class="mgd-sheet-title">${config.title}</div>
          </div>
          <button type="button" class="mgd-sheet-close" onclick="MuscleGrowthDetail.closeList()">닫기</button>
        </div>
        <div class="mgd-list">${items}</div>
        <div class="mgd-hint">부위를 탭하면 추천 운동을 볼 수 있어요 · 체성분 실측이 아닌 훈련 패턴 기반 추정치예요.</div>
      </div>`;
  }

  function openList(type) {
    if (type !== 'growth' && type !== 'loss') return;
    const overlay = document.getElementById('mgdOverlay');
    if (!overlay) return;

    const result = computeResult();
    const perMuscle = (result && result.perMuscle) || {};
    const config = LIST_CONFIG[type];
    const list = type === 'growth' ? getGrowthList(perMuscle) : getLossList(perMuscle);

    overlay.innerHTML = buildListSheetHtml(type, list, config);
    overlay.classList.add('show');
  }

  function closeList() {
    const overlay = document.getElementById('mgdOverlay');
    if (!overlay) return;
    overlay.classList.remove('show');
    overlay.innerHTML = '';
  }

  function closeListOnOverlay(e) {
    if (e.target && e.target.id === 'mgdOverlay') closeList();
  }

  // ------------------------------------------------------------
  // 홈 카드("근성장 · 근손실 추적")의 지수를 탭하면 목록 오픈
  // 기존 MuscleGrowthTracker.renderHomeCard() 코드는 수정하지 않고,
  // 렌더된 DOM에 이벤트 위임만 연결한다 (컨테이너 노드는 재렌더에도 유지됨)
  // ------------------------------------------------------------
  function onSummaryCardClick(e) {
    const item = e.target.closest('[data-mgt-type]');
    if (!item) return;
    openList(item.dataset.mgtType);
  }

  function hookSummaryCard() {
    if (summaryHooked) return;
    const container = document.getElementById('muscleGrowthCard');
    if (!container) return;
    summaryHooked = true;
    container.addEventListener('click', onSummaryCardClick);
  }

  function afterHomeRender() {
    hookSummaryCard();
    renderHeatmapCard();
  }

  return {
    afterHomeRender,
    renderHeatmapCard,
    setView,
    openList,
    closeList,
    closeListOnOverlay,
    openMuscleExercises,
    getGrowthList,
    getLossList,
    getMuscleVisual,
    buildSvg,
    buildListSheetHtml,
  };
})();
