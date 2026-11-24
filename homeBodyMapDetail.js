// ============================================================
// RECOVR - 홈 3D 바디맵 "자세히 보기" (독립 모듈)
//
// 3D는 재미용 · 2D는 정확한 상세 보기.
// Heatmap3dModes의 현재 모드(회복/성장/손실)를 따르며,
// 기존 MuscleHeatmap SVG · calcMuscleRecovery · MuscleGrowthTracker
// 계산만 읽기 전용으로 재사용한다.
// BodyMap3D.setPreferredMode / 전역 2D·3D 선호는 건드리지 않는다.
// ============================================================

const HomeBodyMapDetail = (() => {
  const STYLE_ID = 'home-body-map-detail-styles';
  const BTN_WRAP_ID = 'hbmdDetailBtnWrap';
  const OVERLAY_ID = 'hbmdOverlay';
  const HISTORY_FLAG = 'hbmdDetail';
  const ASSET_VERSION = (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.ASSET_VERSION) || 'v56';
  const MIN_TAP = 44;
  // Must match map paint thresholds (getFill) for card + list value colors
  const STRONG_GROWTH_PCT = 1.5;
  const GROWTH_TEAL = '#1aa88a';
  const GROWTH_LIME = '#b8ff3d';
  const STRONG_LOSS_PCT = 4;
  const REGION_STROKE = 'rgba(8,8,14,0.85)';
  const REGION_STROKE_W = 1.15;
  const LABEL_LINE_H = 28; // name + pct stack at ~390px CSS width
  const LABEL_MIN_GAP = 8;
  const LOSS_VIOLET = '#7b6cff';
  const LOSS_INDIGO = '#4a3dc8';
  /**
   * After SVG userSpaceOnUse masking, paths already sit near the silhouette.
   * A tiny expand about mid-torso closes the ~3% halo between path edges and
   * grey art outlines (measured on clean path-on-art composites). Same matrix
   * for front & back — do NOT use large scales (they lift the chest/shoulders).
   */
  const FILL_CALIBRATE = {
    cx: 120,
    cy: 200,
    scale: 1.04,
    tx: 0,
    ty: 3,
  };

  const MODE_TITLES = {
    recovery: '회복 자세히 보기',
    growth: '성장 자세히 보기',
    loss: '손실 자세히 보기',
  };
  const MODE_KICKERS = {
    recovery: '회복',
    growth: '성장',
    loss: '손실',
  };

  // Front / back muscles visible on that silhouette (app coarse keys).
  const VIEW_MUSCLES = {
    front: ['chest', 'shoulder', 'biceps', 'core', 'forearms', 'quads', 'adductors', 'calves'],
    back: ['back', 'shoulder', 'triceps', 'forearms', 'hamstrings', 'adductors', 'calves'],
  };

  // Detail-only label ids that share an app muscle bucket (3D KEY_TO_APP / LOAD_ALIASES).
  const LABEL_DATA_KEY = {
    glutes: 'hamstrings',
  };

  const DETAIL_SHORT_NAMES = {
    glutes: '둔근',
  };

  /**
   * Detail-view back regions: traps / lats / lower-back are separate shapes
   * (all map to app key `back`) so fatigued "등" is not one giant blob.
   * Glutes are separate shapes mapped to `hamstrings` (app bucket 둔근/햄스트링).
   */
  /**
   * Split from MuscleHeatmap's measured back outline (viewBox 240×360) with NO
   * horizontal inset — inset was shrinking fills vs the silhouette. Tiny Y gaps
   * only for visible borders; glute band was the bottom of the old mega-path.
   */
  const DETAIL_BACK_REGIONS = [
    // Upper back / traps
    { muscle: 'back', d: 'M112.1 51.7L111.4 56.2L108.0 60.8L100.9 65.2L93.4 70.5L97.5 75.0L100.5 79.5L102.8 84.0L105.8 89.2L106.9 93.8L108.3 98.0L131.3 98.0L132.8 93.8L134.2 89.2L136.5 84.0L139.1 79.5L141.4 75.0L146.2 70.5L138.4 65.2L131.6 60.8L128.2 56.2L127.5 51.7Z' },
    // Mid back / lats
    { muscle: 'back', d: 'M97.5 101.0L87.8 103.5L88.9 108.0L90.8 112.5L92.2 117.0L94.5 122.2L96.4 126.8L97.9 131.2L96.8 135.8L96.5 138.0L143.0 138.0L142.5 135.8L141.4 131.2L143.2 126.8L144.8 122.2L147.0 117.0L149.2 112.5L150.8 108.0L151.9 103.5L142.1 101.0Z' },
    // Lower back / erectors
    { muscle: 'back', d: 'M96.0 141.0L95.2 145.5L94.9 150.0L93.8 155.2L92.6 159.8L91.1 164.2L91.0 165.0L148.2 165.0L148.1 164.2L147.4 159.8L145.9 155.2L144.4 150.0L144.4 145.5L143.6 141.0Z' },
    // Glutes (was bottom of mega back path) → hamstrings app key
    { muscle: 'hamstrings', labelId: 'glutes', d: 'M90.9 168.0L90.8 168.8L90.4 174.0L91.1 178.5L93.4 183.0L103.5 188.2L120.0 188.2L120.0 168.0Z' },
    { muscle: 'hamstrings', labelId: 'glutes', d: 'M120.0 168.0L120.0 188.2L135.8 188.2L145.5 183.0L148.1 178.5L148.9 174.0L148.9 168.8L148.8 168.0Z' },
  ];

  // Spaced callouts for ~390px sheet width (collision packer still runs).
  const DETAIL_LABEL_POSITIONS = {
    front: {
      shoulder: { x: 16, y: 72, anchor: 'end', tipX: 78, tipY: 78 },
      chest: { x: 16, y: 100, anchor: 'end', tipX: 100, tipY: 96 },
      biceps: { x: 16, y: 132, anchor: 'end', tipX: 72, tipY: 118 },
      core: { x: 224, y: 148, anchor: 'start', tipX: 150, tipY: 148 },
      forearms: { x: 16, y: 172, anchor: 'end', tipX: 52, tipY: 168 },
      quads: { x: 224, y: 230, anchor: 'start', tipX: 158, tipY: 220 },
      adductors: { x: 224, y: 198, anchor: 'start', tipX: 132, tipY: 205 },
      calves: { x: 224, y: 292, anchor: 'start', tipX: 158, tipY: 292 },
    },
    back: {
      shoulder: { x: 14, y: 64, anchor: 'end', tipX: 78, tipY: 82 },
      back: { x: 14, y: 108, anchor: 'end', tipX: 108, tipY: 112 },
      triceps: { x: 14, y: 152, anchor: 'end', tipX: 70, tipY: 112 },
      forearms: { x: 14, y: 196, anchor: 'end', tipX: 50, tipY: 168 },
      glutes: { x: 226, y: 168, anchor: 'start', tipX: 128, tipY: 178 },
      hamstrings: { x: 226, y: 218, anchor: 'start', tipX: 158, tipY: 230 },
      adductors: { x: 226, y: 262, anchor: 'start', tipX: 128, tipY: 215 },
      calves: { x: 226, y: 308, anchor: 'start', tipX: 158, tipY: 292 },
    },
  };

  let currentView = 'front';
  let currentMode = 'recovery';
  let selectedMuscle = null;
  let isOpen = false;
  let recoveryCache = null;
  let growthCache = null;
  let historyHooked = false;
  let swipeStartY = null;

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getMuscleOrder() {
    return (typeof MUSCLE_ORDER !== 'undefined') ? MUSCLE_ORDER.slice() : [];
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

  function getShortName(muscleKey) {
    if (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.SHORT_NAMES) {
      return MuscleHeatmap.SHORT_NAMES[muscleKey] || getMuscleLabel(muscleKey);
    }
    return getMuscleLabel(muscleKey);
  }

  function getIcon(muscleKey) {
    if (typeof MUSCLE_LABELS !== 'undefined' && MUSCLE_LABELS[muscleKey]) {
      return MUSCLE_LABELS[muscleKey].icon || '🎯';
    }
    return '🎯';
  }

  function assetUrl(path) {
    return `${path}?v=${ASSET_VERSION}`;
  }

  function getBodyImage(view) {
    const images = (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.BODY_IMAGES)
      || { front: 'body-map-front.png', back: 'body-map-back.png' };
    if (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.getBodyImageSrc) {
      return MuscleHeatmap.getBodyImageSrc(view);
    }
    return assetUrl(images[view] || images.front);
  }

  function getBodyMask(view) {
    const masks = (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.BODY_MASKS)
      || { front: 'body-mask-front.png', back: 'body-mask-back.png' };
    return assetUrl(masks[view] || masks.front);
  }

  function getFrontRegions() {
    return (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.FRONT_REGIONS) || [];
  }

  function getBackRegions() {
    const base = (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.BACK_REGIONS) || [];
    // Replace the single mega `back` path with split traps/lats/lower + glutes.
    const withoutBack = base.filter((r) => r.muscle !== 'back');
    return DETAIL_BACK_REGIONS.concat(withoutBack);
  }

  function getLabelPositions(view) {
    return DETAIL_LABEL_POSITIONS[view] || {};
  }

  function resolveDataKey(labelOrMuscle) {
    return LABEL_DATA_KEY[labelOrMuscle] || labelOrMuscle;
  }

  function musclesForView(view) {
    return (VIEW_MUSCLES[view] || VIEW_MUSCLES.front).slice();
  }

  function pickDefaultMuscle(view) {
    const allowed = new Set(musclesForView(view));
    const rows = buildSortedList().filter((r) => allowed.has(r.muscle));
    if (!rows.length) return musclesForView(view)[0] || null;
    // Prefer a muscle that has a signal on this side; else first in sorted list.
    const signaled = rows.find((r) => r.hasSignal);
    return (signaled || rows[0]).muscle;
  }

  function ensureSelectionForView(view) {
    const allowed = new Set(musclesForView(view));
    if (!selectedMuscle || !allowed.has(selectedMuscle)) {
      selectedMuscle = pickDefaultMuscle(view);
    }
  }

  function loadWorkoutsSafe() {
    try { return (typeof loadWorkouts === 'function') ? loadWorkouts() : []; }
    catch (e) { return []; }
  }

  function loadSettingsSafe() {
    try { return (typeof loadSettings === 'function') ? loadSettings() : {}; }
    catch (e) { return {}; }
  }

  function refreshCaches() {
    try {
      if (typeof calcMuscleRecovery === 'function') {
        recoveryCache = calcMuscleRecovery(loadWorkoutsSafe(), loadSettingsSafe());
      }
    } catch (e) {
      recoveryCache = recoveryCache || {};
    }
    try {
      if (typeof MuscleGrowthTracker !== 'undefined' && MuscleGrowthTracker.compute) {
        growthCache = MuscleGrowthTracker.compute(loadWorkoutsSafe(), new Date());
      }
    } catch (e) {
      growthCache = growthCache || null;
    }
  }

  function resolveMode(preferred) {
    if (preferred === 'recovery' || preferred === 'growth' || preferred === 'loss') return preferred;
    if (typeof Heatmap3dModes !== 'undefined' && Heatmap3dModes.getState) {
      const m = Heatmap3dModes.getState().mode;
      if (m === 'recovery' || m === 'growth' || m === 'loss') return m;
    }
    return 'recovery';
  }

  function formatDateKo(dateStr) {
    if (!dateStr) return '기록 없음';
    const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  function formatVolume(vol) {
    if (vol == null || !(vol > 0)) return '최근 볼륨 없음';
    const n = Math.round(vol);
    return `최근 볼륨 ${n.toLocaleString('ko-KR')}`;
  }

  function hasBatchim(word) {
    const ch = String(word || '').slice(-1);
    const code = ch.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return (code - 0xAC00) % 28 !== 0;
  }

  function withTopic(name) {
    return `${name}${hasBatchim(name) ? '은' : '는'}`;
  }

  function withObject(name) {
    return `${name}${hasBatchim(name) ? '을' : '를'}`;
  }

  function getRecoveryEntry(muscle) {
    return (recoveryCache && recoveryCache[muscle]) || null;
  }

  function getGrowthEntry(muscle) {
    const per = growthCache && growthCache.perMuscle;
    return (per && per[muscle] && per[muscle].growth) || null;
  }

  function getLossEntry(muscle) {
    const per = growthCache && growthCache.perMuscle;
    return (per && per[muscle] && per[muscle].loss) || null;
  }

  function getRow(muscle) {
    const rec = getRecoveryEntry(muscle);
    const growth = getGrowthEntry(muscle);
    const loss = getLossEntry(muscle);
    const lastDate = rec && rec.lastDate != null ? rec.lastDate : null;
    const volume = rec && rec.volume > 0
      ? rec.volume
      : (growth && growth.recentAvgVolume > 0 ? growth.recentAvgVolume : null);

    if (currentMode === 'growth') {
      const pct = growth && growth.growthPct != null ? growth.growthPct : 0;
      return {
        muscle,
        pct,
        hasSignal: !!(growth && growth.growthPct > 0),
        lastDate,
        volume: (growth && growth.recentAvgVolume) || volume,
        sessions: growth ? growth.sessionCount : 0,
        daysSince: loss ? loss.daysSince : null,
        sortKey: pct,
      };
    }
    if (currentMode === 'loss') {
      const pct = loss && loss.lossPct != null ? loss.lossPct : 0;
      return {
        muscle,
        pct,
        hasSignal: !!(loss && loss.lossPct > 0),
        lastDate,
        volume,
        sessions: growth ? growth.sessionCount : 0,
        daysSince: loss ? loss.daysSince : null,
        sortKey: pct,
      };
    }
    const hasData = !!(rec && rec.lastDate != null);
    const pct = hasData ? (rec.recoveryPct != null ? rec.recoveryPct : 100) : null;
    return {
      muscle,
      pct: pct == null ? 100 : pct,
      hasSignal: hasData,
      lastDate,
      volume: rec ? rec.volume : null,
      hoursLeft: hasData && typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.getHoursUntilReady
        ? MuscleHeatmap.getHoursUntilReady(muscle, recoveryCache)
        : null,
      sortKey: hasData ? pct : 101,
    };
  }

  function buildTip(row) {
    const name = getMuscleLabel(row.muscle);
    if (currentMode === 'growth') {
      if (row.hasSignal && row.pct >= 1.5) {
        return `${withTopic(name)} 요즘 잘 자극되고 있어요. 지금 페이스를 유지해 보세요.`;
      }
      if (row.hasSignal) {
        return `${name}에 성장 신호가 있어요. 세션을 조금 더 꾸준히 쌓아 보세요.`;
      }
      return `${withTopic(name)} 최근 성장 신호가 약해요. 자극을 조금 늘려 보세요.`;
    }
    if (currentMode === 'loss') {
      if (row.hasSignal && row.pct >= 4) {
        return `${withObject(name)} 오래 쉬었어요. 가벼운 무게부터 다시 시작해 보세요.`;
      }
      if (row.hasSignal) {
        return `${name}에 손실 신호가 보여요. 이번 주에 한 번만 자극해도 좋아요.`;
      }
      return `${withTopic(name)} 잘 유지되고 있어요. 지금처럼 이어 가면 됩니다.`;
    }
    if (!row.hasSignal) {
      return `${name} 기록이 아직 없어요. 운동을 남기면 회복 상태를 볼 수 있어요.`;
    }
    if (row.pct < 40) {
      return `${withTopic(name)} 아직 피곤해요. 충분히 쉰 뒤 다시 자극하세요.`;
    }
    if (row.pct < 95) {
      return `${withTopic(name)} 회복 중이에요. 무리하지 말고 상태를 봐 주세요.`;
    }
    return `${withTopic(name)} 준비됐어요. 오늘 운동해도 좋아요.`;
  }

  function formatValueLabel(row) {
    if (currentMode === 'growth') {
      return row.hasSignal ? `성장 +${row.pct}%` : '성장 신호 없음';
    }
    if (currentMode === 'loss') {
      return row.hasSignal ? `손실 −${row.pct}%` : '손실 없음';
    }
    if (!row.hasSignal) return '기록 없음';
    return `회복 ${row.pct}%`;
  }

  function formatValueColor(row) {
    if (currentMode === 'growth') {
      if (!row.hasSignal) return 'var(--muted)';
      return row.pct >= STRONG_GROWTH_PCT ? GROWTH_LIME : GROWTH_TEAL;
    }
    if (currentMode === 'loss') {
      return row.hasSignal ? (row.pct >= STRONG_LOSS_PCT ? LOSS_INDIGO : LOSS_VIOLET) : 'var(--muted)';
    }
    if (!row.hasSignal) return 'var(--muted)';
    if (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.getRecoveryColor) {
      return MuscleHeatmap.getRecoveryColor(row.pct, true);
    }
    if (row.pct < 40) return '#ff3b5c';
    if (row.pct < 95) return '#f5a524';
    return '#3ee6b0';
  }

  function recoveryStatusClass(row) {
    // Do NOT use mh-region--idle — global CSS forces fill:transparent !important.
    if (!row.hasSignal) return '';
    if (row.pct < 40) return 'mh-region--low';
    if (row.pct < 95) return 'mh-region--mid';
    return 'mh-region--ready';
  }

  function getFill(row) {
    if (currentMode === 'growth') {
      // No growth signal → leave silhouette unpainted (neutral), matching 3D unlit.
      if (!row.hasSignal) return { fill: '#1e1e26', opacity: 0 };
      const strong = row.pct >= STRONG_GROWTH_PCT;
      return { fill: strong ? GROWTH_LIME : GROWTH_TEAL, opacity: 0.5 + Math.min(0.35, row.pct / 3 * 0.35) };
    }
    if (currentMode === 'loss') {
      if (!row.hasSignal) return { fill: '#3a3a44', opacity: 0 };
      const deep = row.pct >= STRONG_LOSS_PCT;
      return { fill: deep ? LOSS_INDIGO : LOSS_VIOLET, opacity: 0.5 + Math.min(0.35, row.pct / 8 * 0.35) };
    }
    if (!row.hasSignal) {
      // Recovery: neutral grey only — not a status color.
      return { fill: (MuscleHeatmap && MuscleHeatmap.IDLE_FILL) || '#2c2c36', opacity: 0.22 };
    }
    const color = (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.getRecoveryColor)
      ? MuscleHeatmap.getRecoveryColor(row.pct, true)
      : formatValueColor(row);
    return { fill: color, opacity: 0.82 };
  }

  function buildRegionPaths(view) {
    const regions = view === 'back' ? getBackRegions() : getFrontRegions();
    return regions.map((region) => {
      const row = getRow(region.muscle);
      const { fill, opacity } = getFill(row);
      const label = getMuscleLabel(region.muscle);
      const painted = opacity > 0.02;
      // White selection stroke on transparent paths reads as empty white bars — skip it.
      const selected = (selectedMuscle === region.muscle && painted) ? ' hbmd-region--selected' : '';
      // Skip mh-region--low/mid/ready: global drop-shadow filters make fills look like
      // small floating blobs that no longer match the silhouette outlines.
      const stroke = painted ? REGION_STROKE : 'none';
      const sw = painted ? REGION_STROKE_W : 0;
      // Inline fill must win over global .mh-region--idle { fill:transparent !important }
      const style = `fill:${fill};fill-opacity:${opacity};filter:none`;
      return `<path class="hbmd-region${selected}" data-muscle="${region.muscle}"
        d="${region.d}" style="${style}"
        stroke="${stroke}" stroke-width="${sw}" pointer-events="all">
        <title>${escapeHtml(label)} · ${escapeHtml(formatValueLabel(row))}</title>
      </path>`;
    }).join('');
  }

  function getLabelShortName(labelId) {
    if (DETAIL_SHORT_NAMES[labelId]) return DETAIL_SHORT_NAMES[labelId];
    return getShortName(resolveDataKey(labelId));
  }

  /**
   * Pack callout labels on left (anchor end) / right (anchor start) columns
   * so name+pct stacks do not overlap at ~390px sheet width.
   */
  function packLabelLayouts(entries) {
    const bySide = { left: [], right: [] };
    entries.forEach((e) => {
      const side = (e.pos.anchor === 'start') ? 'right' : 'left';
      bySide[side].push({ ...e, side, y: e.pos.y });
    });
    ['left', 'right'].forEach((side) => {
      const list = bySide[side].sort((a, b) => a.y - b.y);
      let prevBottom = -Infinity;
      list.forEach((item) => {
        const minY = prevBottom + LABEL_LINE_H / 2 + LABEL_MIN_GAP;
        if (item.y < minY) item.y = minY;
        // Keep inside viewBox with padding for the two-line stack
        item.y = Math.max(28, Math.min(340, item.y));
        prevBottom = item.y + LABEL_LINE_H / 2;
      });
      // If bottom overflowed, pull the column up while keeping gaps
      const last = list[list.length - 1];
      if (last && last.y > 340) {
        const overflow = last.y - 340;
        list.forEach((item) => { item.y -= overflow; });
        let prev = -Infinity;
        list.forEach((item) => {
          const minY = prev + LABEL_LINE_H / 2 + LABEL_MIN_GAP;
          if (item.y < minY) item.y = minY;
          item.y = Math.max(28, item.y);
          prev = item.y + LABEL_LINE_H / 2;
        });
      }
    });
    return bySide.left.concat(bySide.right);
  }

  function buildRegionLabels(view) {
    const positions = getLabelPositions(view);
    const labeled = new Set();
    const entries = [];
    Object.keys(positions).forEach((labelId) => {
      if (labeled.has(labelId)) return;
      labeled.add(labelId);
      const dataKey = resolveDataKey(labelId);
      const row = getRow(dataKey);
      if (!row.hasSignal) return;
      entries.push({ labelId, dataKey, row, pos: positions[labelId] });
    });
    const packed = packLabelLayouts(entries);
    return packed.map((item) => {
      const { labelId, dataKey, row, pos, y } = item;
      const name = getLabelShortName(labelId);
      const anchor = pos.anchor || 'middle';
      // Tip anchors follow the same calibrate transform as fills so leaders land on paint.
      const rawTipX = pos.tipX != null ? pos.tipX : pos.x;
      const rawTipY = pos.tipY != null ? pos.tipY : pos.y;
      const tipX = FILL_CALIBRATE.cx
        + (rawTipX - FILL_CALIBRATE.cx) * FILL_CALIBRATE.scale
        + FILL_CALIBRATE.tx;
      const tipY = FILL_CALIBRATE.cy
        + (rawTipY - FILL_CALIBRATE.cy) * FILL_CALIBRATE.scale
        + FILL_CALIBRATE.ty;
      const midX = anchor === 'end' ? pos.x + 8 : (anchor === 'start' ? pos.x - 8 : pos.x);
      const pctText = currentMode === 'growth'
        ? `+${row.pct}%`
        : (currentMode === 'loss' ? `−${row.pct}%` : `${row.pct}%`);
      // Inline fill beats global `.mh-region-pct { fill:#3ee6b0 }` so loss/growth match legend.
      const pctColor = formatValueColor(row);
      return `<g class="mh-label-group" data-muscle="${dataKey}" data-label-id="${labelId}" pointer-events="none">
          <path class="mh-label-leader" d="M${pos.x} ${y} L${midX} ${y} L${tipX} ${tipY}"/>
          <text x="${pos.x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle"
            class="mh-region-label mh-region-label--active">
            <tspan x="${pos.x}" dy="-6" class="mh-region-name">${escapeHtml(name)}</tspan>
            <tspan x="${pos.x}" dy="13" class="mh-region-pct" style="fill:${pctColor}">${escapeHtml(pctText)}</tspan>
          </text>
        </g>`;
    }).join('');
  }

  function buildSvg(view) {
    const img = getBodyImage(view);
    const mask = getBodyMask(view);
    // SVG <mask> must use userSpaceOnUse for BOTH units. Default maskUnits=
    // objectBoundingBox sizes the mask to the path-group bbox — that shrinks and
    // shifts fills upward vs the body outline image (same viewBox 240×360).
    // Also avoid CSS mask-image on <g> (same bbox bug).
    const maskId = `hbmdMask-${view}`;
    // Do NOT reuse class "mh-svg" — home CSS caps max-height at 42vh/360px which
    // distorts the CSS viewport vs viewBox and makes fills look shifted/undersized.
    return `<svg class="hbmd-svg" viewBox="0 0 240 360" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeHtml(MODE_TITLES[currentMode])} ${view === 'back' ? '후면' : '전면'}">
      <defs>
        <mask id="${maskId}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse"
          x="0" y="0" width="240" height="360">
          <image href="${mask}" x="0" y="0" width="240" height="360"
            preserveAspectRatio="xMidYMid meet"/>
        </mask>
      </defs>
      <image class="mh-body-image" href="${img}" x="0" y="0" width="240" height="360"
        preserveAspectRatio="xMidYMid meet" pointer-events="none"></image>
      <g class="hbmd-muscles" mask="url(#${maskId})"
        transform="translate(${FILL_CALIBRATE.cx} ${FILL_CALIBRATE.cy}) scale(${FILL_CALIBRATE.scale}) translate(${-FILL_CALIBRATE.cx} ${-FILL_CALIBRATE.cy}) translate(${FILL_CALIBRATE.tx} ${FILL_CALIBRATE.ty})">
        ${buildRegionPaths(view)}
      </g>
      <g class="hbmd-labels" aria-hidden="false">
        ${buildRegionLabels(view)}
      </g>
    </svg>`;
  }

  function buildSortedList() {
    const rows = getMuscleOrder().map(getRow);
    if (currentMode === 'recovery') {
      rows.sort((a, b) => {
        if (a.hasSignal !== b.hasSignal) return a.hasSignal ? -1 : 1;
        return a.sortKey - b.sortKey;
      });
    } else {
      rows.sort((a, b) => {
        if (a.hasSignal !== b.hasSignal) return a.hasSignal ? -1 : 1;
        return b.sortKey - a.sortKey;
      });
    }
    return rows;
  }

  function buildDetailCard(muscle) {
    if (!muscle) {
      return `<div class="hbmd-detail hbmd-detail--empty" data-hbmd-detail>
        지도를 탭하면 부위별 수치와 안내가 여기에 보여요.
      </div>`;
    }
    const row = getRow(muscle);
    const name = getMuscleLabel(muscle);
    const last = formatDateKo(row.lastDate);
    const vol = formatVolume(row.volume);
    const tip = buildTip(row);
    const value = formatValueLabel(row);
    const color = formatValueColor(row);
    const extra = currentMode === 'growth' && row.sessions
      ? `<div class="hbmd-meta">최근 4주 세션 ${row.sessions}회</div>`
      : (currentMode === 'loss' && row.daysSince != null
        ? `<div class="hbmd-meta">${row.daysSince}일째 미훈련</div>`
        : (currentMode === 'recovery' && row.hoursLeft != null && row.hoursLeft > 0
          ? `<div class="hbmd-meta">준비까지 약 ${row.hoursLeft}시간</div>`
          : ''));
    return `<div class="hbmd-detail" data-hbmd-detail data-muscle="${escapeHtml(muscle)}">
      <div class="hbmd-detail-top">
        <div class="hbmd-detail-icon">${getIcon(muscle)}</div>
        <div class="hbmd-detail-main">
          <div class="hbmd-detail-name">${escapeHtml(name)}</div>
          <div class="hbmd-detail-value" style="color:${color}">${escapeHtml(value)}</div>
        </div>
      </div>
      <div class="hbmd-meta">마지막 훈련 · ${escapeHtml(last)}</div>
      <div class="hbmd-meta">${escapeHtml(vol)}</div>
      ${extra}
      <p class="hbmd-tip">${escapeHtml(tip)}</p>
    </div>`;
  }

  function buildListHtml() {
    const rows = buildSortedList();
    return rows.map((row) => {
      const name = getMuscleLabel(row.muscle);
      const color = formatValueColor(row);
      const value = formatValueLabel(row);
      const sub = row.lastDate
        ? `마지막 훈련 ${formatDateKo(row.lastDate)}`
        : '아직 훈련 기록 없음';
      const sel = selectedMuscle === row.muscle ? ' hbmd-list-item--selected' : '';
      return `<button type="button" class="hbmd-list-item${sel}" data-hbmd-muscle="${row.muscle}" aria-label="${escapeHtml(name)} ${escapeHtml(value)}">
        <span class="hbmd-list-icon" aria-hidden="true">${getIcon(row.muscle)}</span>
        <span class="hbmd-list-main">
          <span class="hbmd-list-name">${escapeHtml(name)}</span>
          <span class="hbmd-list-sub">${escapeHtml(sub)}</span>
        </span>
        <span class="hbmd-list-pct" style="color:${color}">${escapeHtml(value)}</span>
      </button>`;
    }).join('');
  }

  function legendHtml() {
    if (currentMode === 'growth') {
      return `<span><i style="background:#1aa88a"></i>성장 중</span>
        <span><i style="background:#b8ff3d"></i>강한 성장</span>
        <span><i style="background:#1e1e26"></i>신호 없음</span>`;
    }
    if (currentMode === 'loss') {
      return `<span><i style="background:${LOSS_VIOLET}"></i>손실</span>
        <span><i style="background:${LOSS_INDIGO}"></i>손실 심함</span>
        <span><i style="background:#3a3a44"></i>유지</span>`;
    }
    return `<span><i style="background:#ff3b5c"></i>피로</span>
      <span><i style="background:#f5a524"></i>회복 중</span>
      <span><i style="background:#3ee6b0"></i>준비됨</span>`;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BTN_WRAP_ID} {
        display: flex; justify-content: center; padding: 10px 12px 4px;
      }
      .hbmd-open-btn {
        min-height: ${MIN_TAP}px; min-width: ${MIN_TAP}px;
        padding: 0 18px; border-radius: 12px;
        border: 1px solid var(--border, #2a2a36);
        background: var(--card, #16161f); color: var(--text, #eee);
        font-size: 14px; font-weight: 700; letter-spacing: -0.02em;
        cursor: pointer; touch-action: manipulation;
        width: 100%; max-width: 420px;
      }
      .hbmd-open-btn:active { opacity: 0.85; }
      .hbmd-overlay {
        display: none; position: fixed; inset: 0; z-index: 1300;
        background: rgba(0,0,0,0.62);
        align-items: stretch; justify-content: center;
        overscroll-behavior: contain;
      }
      .hbmd-overlay.show { display: flex; animation: fadeIn 0.18s ease; }
      .hbmd-sheet {
        width: min(560px, 100%); height: 100%; max-height: 100%;
        background: var(--bg, #0c0c12); color: var(--text, #eee);
        border: none; border-radius: 0;
        display: flex; flex-direction: column;
        overflow: hidden; touch-action: pan-y;
        overscroll-behavior: contain;
        padding: env(safe-area-inset-top, 0) 0 env(safe-area-inset-bottom, 0);
      }
      .hbmd-sheet-header {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px; padding: 10px 14px; flex-shrink: 0;
        border-bottom: 1px solid var(--border, #2a2a36);
        min-height: ${MIN_TAP}px;
        touch-action: none;
      }
      .hbmd-sheet-kicker { font-size: 11px; color: var(--muted); font-weight: 600; }
      .hbmd-sheet-title { font-size: 17px; font-weight: 800; letter-spacing: -0.02em; word-break: keep-all; }
      .hbmd-sheet-close {
        min-width: ${MIN_TAP}px; min-height: ${MIN_TAP}px;
        border: none; border-radius: 12px; padding: 0 14px;
        background: var(--card, #16161f); color: var(--muted);
        font-size: 13px; font-weight: 700; cursor: pointer;
        touch-action: manipulation;
      }
      .hbmd-sheet-body {
        flex: 1; overflow: auto; -webkit-overflow-scrolling: touch;
        touch-action: pan-y; overscroll-behavior: contain;
        padding: 12px 14px 24px;
      }
      .hbmd-view-toggle {
        display: inline-flex; gap: 6px; margin: 0 0 10px;
        background: var(--card, #16161f); border-radius: 12px; padding: 4px;
        border: 1px solid var(--border, #2a2a36);
      }
      .hbmd-view-btn {
        min-height: ${MIN_TAP}px; min-width: 72px; padding: 0 14px;
        border: none; border-radius: 10px; background: transparent;
        color: var(--muted); font-weight: 700; font-size: 13px;
        cursor: pointer; touch-action: manipulation;
      }
      .hbmd-view-btn.selected { background: rgba(255,255,255,0.08); color: var(--text); }
      .hbmd-map-wrap {
        position: relative; display: flex; justify-content: center;
        margin: 0 auto 10px; max-width: 280px; width: 100%;
      }
      .hbmd-svg {
        width: 100%; height: auto; display: block;
        overflow: visible; max-width: 100%;
        max-height: none !important; /* beat .mh-svg max-height if class leaks */
        aspect-ratio: 240 / 360;
      }
      .hbmd-muscles { /* fills share SVG user space with body image — no CSS mask */ }
      .hbmd-region {
        vector-effect: non-scaling-stroke;
        filter: none !important; /* no home heatmap glow on detail fills */
      }
      .hbmd-region--selected { stroke: #fff !important; stroke-width: 2px; }
      .hbmd-svg .mh-region-label { font-size: 9.5px; }
      .hbmd-svg .mh-region-name { font-weight: 800; }
      /* Override global mint-only pct color — inline style on tspan sets the real fill */
      .hbmd-overlay .hbmd-svg .mh-region-pct { font-weight: 800; font-size: 8.5px; }
      .hbmd-overlay .hbmd-svg .mh-label-leader {
        stroke: rgba(240,240,245,0.35); stroke-width: 1px; fill: none;
      }
      /* Keep recovery glow but never let idle !important wipe detail fills */
      .hbmd-overlay .hbmd-svg .mh-region.mh-region--idle {
        fill: unset;
        fill-opacity: unset;
      }
      .hbmd-legend {
        display: flex; flex-wrap: wrap; gap: 10px 14px; justify-content: center;
        font-size: 11px; color: var(--muted); margin: 0 0 12px; word-break: keep-all;
      }
      .hbmd-legend i {
        display: inline-block; width: 9px; height: 9px; border-radius: 50%;
        margin-right: 5px; vertical-align: middle;
      }
      .hbmd-detail {
        background: var(--card, #16161f); border: 1px solid var(--border, #2a2a36);
        border-radius: 14px; padding: 12px 14px; margin-bottom: 14px;
        word-break: keep-all;
      }
      .hbmd-detail--empty { color: var(--muted); font-size: 13px; text-align: center; }
      .hbmd-detail-top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
      .hbmd-detail-icon { font-size: 22px; }
      .hbmd-detail-name { font-size: 16px; font-weight: 800; }
      .hbmd-detail-value { font-size: 14px; font-weight: 800; margin-top: 2px; }
      .hbmd-meta { font-size: 12px; color: var(--muted); margin-top: 3px; }
      .hbmd-tip {
        margin: 10px 0 0; font-size: 13.5px; line-height: 1.45; font-weight: 600;
        word-break: keep-all;
      }
      .hbmd-list-title {
        font-size: 13px; font-weight: 800; margin: 4px 0 8px; word-break: keep-all;
      }
      .hbmd-list { display: flex; flex-direction: column; gap: 8px; }
      .hbmd-list-item {
        display: flex; align-items: center; gap: 10px;
        min-height: ${MIN_TAP}px; width: 100%; text-align: left;
        padding: 10px 12px; border-radius: 12px;
        border: 1px solid var(--border, #2a2a36);
        background: var(--card, #16161f); color: inherit;
        cursor: pointer; touch-action: manipulation;
      }
      .hbmd-list-item--selected { outline: 1.5px solid rgba(62,230,176,0.55); }
      .hbmd-list-icon { font-size: 18px; flex-shrink: 0; }
      .hbmd-list-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .hbmd-list-name { font-size: 13.5px; font-weight: 700; word-break: keep-all; }
      .hbmd-list-sub { font-size: 10.5px; color: var(--muted); margin-top: 2px; word-break: keep-all; }
      .hbmd-list-pct { font-size: 13px; font-weight: 800; flex-shrink: 0; word-break: keep-all; }
      .hbmd-footnote {
        margin-top: 12px; font-size: 11px; color: var(--muted); line-height: 1.4;
        word-break: keep-all;
      }
      @media (prefers-reduced-motion: reduce) {
        .hbmd-overlay.show { animation: none; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.className = 'hbmd-overlay';
      overlay.setAttribute('role', 'presentation');
      document.body.appendChild(overlay);
    }
    if (overlay.getAttribute('data-hbmd-wired') !== '1') {
      overlay.setAttribute('data-hbmd-wired', '1');
      overlay.classList.add('hbmd-overlay');
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
      });
    }
    return overlay;
  }

  function ensureHistoryHook() {
    if (historyHooked) return;
    historyHooked = true;
    window.addEventListener('popstate', () => {
      if (isOpen) close({ fromPopstate: true });
    });
  }

  function bindSwipe(header) {
    if (!header) return;
    const onStart = (e) => {
      const t = e.touches && e.touches[0];
      swipeStartY = t ? t.clientY : null;
    };
    const onMove = (e) => {
      if (swipeStartY == null) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      const dy = t.clientY - swipeStartY;
      if (dy > 90) {
        swipeStartY = null;
        close();
      }
    };
    const onEnd = () => { swipeStartY = null; };
    header.addEventListener('touchstart', onStart, { passive: true });
    header.addEventListener('touchmove', onMove, { passive: true });
    header.addEventListener('touchend', onEnd, { passive: true });
    header.addEventListener('touchcancel', onEnd, { passive: true });
  }

  function renderSheet() {
    const overlay = ensureOverlay();
    const title = MODE_TITLES[currentMode] || '자세히 보기';
    const kicker = MODE_KICKERS[currentMode] || '';
    overlay.innerHTML = `
      <div class="hbmd-sheet" role="dialog" aria-modal="true" aria-labelledby="hbmdTitle" onclick="event.stopPropagation()">
        <div class="hbmd-sheet-header" data-hbmd-header>
          <div>
            <div class="hbmd-sheet-kicker">${escapeHtml(kicker)} · 2D 상세</div>
            <div class="hbmd-sheet-title" id="hbmdTitle">${escapeHtml(title)}</div>
          </div>
          <button type="button" class="hbmd-sheet-close" data-hbmd-close aria-label="닫기">닫기</button>
        </div>
        <div class="hbmd-sheet-body" data-hbmd-body>
          <div class="hbmd-view-toggle" role="group" aria-label="전면 후면">
            <button type="button" class="hbmd-view-btn ${currentView === 'front' ? 'selected' : ''}" data-hbmd-view="front">전면</button>
            <button type="button" class="hbmd-view-btn ${currentView === 'back' ? 'selected' : ''}" data-hbmd-view="back">후면</button>
          </div>
          <div class="hbmd-map-wrap" data-hbmd-map>${buildSvg(currentView)}</div>
          <div class="hbmd-legend">${legendHtml()}</div>
          ${buildDetailCard(selectedMuscle)}
          <div class="hbmd-list-title">부위별 수치 목록</div>
          <div class="hbmd-list" data-hbmd-list>${buildListHtml()}</div>
          <p class="hbmd-footnote">3D는 참고용이에요. 숫자는 훈련 기록으로 계산한 추정치이며 체성분 실측이 아닙니다.</p>
        </div>
      </div>`;

    const closeBtn = overlay.querySelector('[data-hbmd-close]');
    if (closeBtn) closeBtn.addEventListener('click', () => close());

    overlay.querySelectorAll('[data-hbmd-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.getAttribute('data-hbmd-view') === 'back' ? 'back' : 'front';
        if (next === currentView) return;
        currentView = next;
        ensureSelectionForView(currentView);
        renderSheet();
      });
    });

    const map = overlay.querySelector('[data-hbmd-map]');
    if (map) {
      map.addEventListener('click', (e) => {
        const region = e.target.closest('[data-muscle]');
        if (!region) return;
        const key = region.getAttribute('data-muscle');
        selectedMuscle = resolveDataKey(key);
        renderSheet();
      });
    }

    overlay.querySelectorAll('[data-hbmd-muscle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedMuscle = resolveDataKey(btn.getAttribute('data-hbmd-muscle'));
        // If list picks a muscle only on the other side, flip the silhouette.
        const frontSet = new Set(musclesForView('front'));
        const backSet = new Set(musclesForView('back'));
        if (currentView === 'back' && frontSet.has(selectedMuscle) && !backSet.has(selectedMuscle)) {
          currentView = 'front';
        } else if (currentView === 'front' && backSet.has(selectedMuscle) && !frontSet.has(selectedMuscle)) {
          currentView = 'back';
        }
        renderSheet();
        const detail = overlay.querySelector('[data-hbmd-detail]');
        if (detail && detail.scrollIntoView) {
          detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      });
    });

    bindSwipe(overlay.querySelector('[data-hbmd-header]'));
  }

  function open(mode) {
    ensureStyles();
    ensureHistoryHook();
    refreshCaches();
    currentMode = resolveMode(mode);
    currentView = 'front';
    selectedMuscle = null;
    ensureSelectionForView(currentView);
    renderSheet();
    const overlay = ensureOverlay();
    overlay.classList.add('show');
    if (!isOpen) {
      isOpen = true;
      try {
        history.pushState({ [HISTORY_FLAG]: true }, '');
      } catch (e) { /* ignore */ }
    }
  }

  function close(opts) {
    const fromPopstate = !!(opts && opts.fromPopstate);
    if (!isOpen && !document.getElementById(OVERLAY_ID)) return;
    const wasOpen = isOpen;
    isOpen = false;
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.classList.remove('show');
      overlay.innerHTML = '';
    }
    if (wasOpen && !fromPopstate) {
      try {
        if (history.state && history.state[HISTORY_FLAG]) history.back();
      } catch (e) { /* ignore */ }
    }
  }

  function ensureOpenButton() {
    ensureStyles();
    const host = document.getElementById('heatmapModeHost');
    const shared = document.getElementById('h3dSharedHost');
    if (!host || !shared) return null;

    let wrap = document.getElementById(BTN_WRAP_ID);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = BTN_WRAP_ID;
      if (shared.nextSibling) host.insertBefore(wrap, shared.nextSibling);
      else host.appendChild(wrap);
    }
    if (!wrap.querySelector('[data-hbmd-open]')) {
      wrap.innerHTML = `<button type="button" class="hbmd-open-btn" data-hbmd-open aria-label="자세히 보기">자세히 보기</button>`;
      const btn = wrap.querySelector('[data-hbmd-open]');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        open();
      });
    }
    return wrap;
  }

  function afterHomeRender() {
    ensureOpenButton();
  }

  // Test helpers
  function buildTipForTest(mode, row) {
    const prev = currentMode;
    currentMode = mode;
    const tip = buildTip(row);
    currentMode = prev;
    return tip;
  }

  function formatValueColorForTest(mode, row) {
    const prev = currentMode;
    currentMode = mode;
    const color = formatValueColor(row);
    currentMode = prev;
    return color;
  }

  function getFillForTest(mode, row) {
    const prev = currentMode;
    currentMode = mode;
    const fill = getFill(row);
    currentMode = prev;
    return fill;
  }

  function getSortedListForTest(mode, recovery, growth) {
    const prevMode = currentMode;
    const prevRec = recoveryCache;
    const prevGrowth = growthCache;
    currentMode = mode;
    recoveryCache = recovery || {};
    growthCache = growth || null;
    const list = buildSortedList();
    currentMode = prevMode;
    recoveryCache = prevRec;
    growthCache = prevGrowth;
    return list;
  }

  function withTestState(mode, recovery, growth, fn) {
    const prevMode = currentMode;
    const prevRec = recoveryCache;
    const prevGrowth = growthCache;
    const prevView = currentView;
    const prevSel = selectedMuscle;
    currentMode = mode || prevMode;
    if (recovery !== undefined) recoveryCache = recovery || {};
    if (growth !== undefined) growthCache = growth || null;
    const result = fn();
    currentMode = prevMode;
    recoveryCache = prevRec;
    growthCache = prevGrowth;
    currentView = prevView;
    selectedMuscle = prevSel;
    return result;
  }

  /** Every painted region must resolve to a known app muscle key (no stray aliases). */
  function auditRegionMapping() {
    const allowed = new Set(getMuscleOrder());
    const issues = [];
    ['front', 'back'].forEach((view) => {
      const regions = view === 'back' ? getBackRegions() : getFrontRegions();
      regions.forEach((r, i) => {
        if (!allowed.has(r.muscle)) {
          issues.push(`${view}[${i}] unknown muscle key: ${r.muscle}`);
        }
      });
      const positions = getLabelPositions(view);
      Object.keys(positions).forEach((labelId) => {
        const key = resolveDataKey(labelId);
        if (!allowed.has(key)) {
          issues.push(`${view} label '${labelId}' → unknown key: ${key}`);
        }
      });
    });
    return issues;
  }

  function getBackRegionMusclesForTest() {
    return getBackRegions().map((r) => r.muscle);
  }

  function countBackSplitsForTest() {
    return getBackRegions().filter((r) => r.muscle === 'back').length;
  }

  function packLabelsForTest(view, mode, recovery, growth) {
    return withTestState(mode, recovery, growth, () => {
      currentMode = mode;
      const positions = getLabelPositions(view);
      const entries = [];
      Object.keys(positions).forEach((labelId) => {
        const dataKey = resolveDataKey(labelId);
        const row = getRow(dataKey);
        if (!row.hasSignal) return;
        entries.push({ labelId, dataKey, row, pos: positions[labelId] });
      });
      return packLabelLayouts(entries).map((e) => ({
        labelId: e.labelId,
        dataKey: e.dataKey,
        y: e.y,
        side: e.side,
      }));
    });
  }

  function pickDefaultMuscleForTest(view, mode, recovery, growth) {
    return withTestState(mode, recovery, growth, () => {
      currentView = view;
      selectedMuscle = null;
      return pickDefaultMuscle(view);
    });
  }

  function ensureSelectionForTest(view, mode, recovery, growth, current) {
    return withTestState(mode, recovery, growth, () => {
      currentView = view;
      selectedMuscle = current;
      ensureSelectionForView(view);
      return selectedMuscle;
    });
  }

  function buildSvgForTest(view, mode, recovery, growth) {
    return withTestState(mode, recovery, growth, () => {
      currentView = view;
      currentMode = mode;
      ensureSelectionForView(view);
      return buildSvg(view);
    });
  }

  return {
    afterHomeRender,
    open,
    close,
    ensureOpenButton,
    getSortedListForTest,
    buildTipForTest,
    formatValueColorForTest,
    getFillForTest,
    formatValueLabel,
    auditRegionMapping,
    getBackRegionMusclesForTest,
    countBackSplitsForTest,
    packLabelsForTest,
    pickDefaultMuscleForTest,
    ensureSelectionForTest,
    buildSvgForTest,
    resolveDataKey,
    VIEW_MUSCLES,
    LABEL_DATA_KEY,
    DETAIL_LABEL_POSITIONS,
    STRONG_GROWTH_PCT,
    GROWTH_TEAL,
    GROWTH_LIME,
    LOSS_VIOLET,
    LOSS_INDIGO,
    FILL_CALIBRATE,
    STRONG_LOSS_PCT,
    MODE_TITLES,
    OVERLAY_ID,
    BTN_WRAP_ID,
    HISTORY_FLAG,
  };
})();

if (typeof window !== 'undefined') {
  window.HomeBodyMapDetail = HomeBodyMapDetail;
}
