// ============================================================
// RECOVR - 기록 목록 최적화 모듈 (독립)
// 1) 페이지네이션(더보기): 최근 N개만 렌더
// 2) 상세 lazy: 펼칠 때만 세트 HTML 생성
// ============================================================

const LogList = (() => {
  const PAGE_SIZE = 40;
  const STYLE_ID = 'log-list-styles';
  const FATIGUE_EMOJI = ['', '😌', '🙂', '😐', '😓', '🥵'];
  const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

  let visibleCount = PAGE_SIZE;
  /** @type {Map<number, object>} realIdx → workout */
  let workoutByIdx = new Map();

  function ensureStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .log-load-more-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 14px 8px 20px;
      }
      .log-load-more-btn {
        width: 100%;
        max-width: 320px;
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: var(--card);
        color: var(--text);
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }
      .log-load-more-btn:active { opacity: 0.8; background: var(--card-hover); }
      .log-load-more-meta {
        font-size: 11px;
        color: var(--muted);
      }
    `;
    document.head.appendChild(style);
  }

  function sortWithIndex(workouts) {
    return (workouts || [])
      .map((w, idx) => ({ w, idx }))
      .sort((a, b) => new Date(b.w.date) - new Date(a.w.date));
  }

  function getVisibleEntries(sortedEntries, count) {
    const limit = Math.max(0, count || 0);
    return (sortedEntries || []).slice(0, limit);
  }

  function hasMore(total, count) {
    return (count || 0) < (total || 0);
  }

  function formatDateLabel(dateStr) {
    const dateObj = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(dateObj.getTime())) return dateStr || '';
    return `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${DOW_LABELS[dateObj.getDay()]})`;
  }

  function buildTagsHtml(w) {
    if (typeof getActivityTagsFromExerciseName !== 'function' || typeof NON_MUSCLE_LABELS === 'undefined') {
      return '';
    }
    const activityTags = new Set();
    (w.exercises || []).forEach((ex) => {
      getActivityTagsFromExerciseName(ex.name).forEach((tag) => activityTags.add(tag));
    });
    let tagsHtml = '';
    activityTags.forEach((tag) => {
      const lbl = NON_MUSCLE_LABELS[tag];
      if (lbl) tagsHtml += `<span class="activity-tag">${lbl.icon} ${lbl.name}</span>`;
    });
    return tagsHtml;
  }

  function buildSummaryMeta(w) {
    const totalVolume = typeof getExerciseVolume === 'function'
      ? (w.exercises || []).reduce((sum, ex) => sum + getExerciseVolume(ex), 0)
      : 0;
    const typeMeta = typeof getWorkoutTypeMeta === 'function'
      ? getWorkoutTypeMeta(w.type)
      : { label: w.type || '-', cls: '' };
    const cardioMin = (typeof CardioTracker !== 'undefined' && CardioTracker.getWorkoutCardioMinutes)
      ? CardioTracker.getWorkoutCardioMinutes(w)
      : 0;
    const progressBadge = w.inProgress
      ? '<span class="wi-type" style="padding:1px 6px;font-size:9px;background:rgba(0,229,255,0.15);color:var(--cyan)">진행 중</span>'
      : '';

    const volumeOrCardio = (w.type === 'cardio' || cardioMin > 0)
      ? `<span>유산소 <b>${cardioMin || w.duration || '-'}</b>분</span>`
      : `<span>볼륨 <b>${totalVolume.toLocaleString()}</b> kg</span>`;

    return {
      typeLabel: typeMeta.label,
      typeCls: typeMeta.cls,
      progressBadge,
      volumeOrCardio,
      duration: w.duration || '-',
      fatigueEmoji: w.fatigue ? FATIGUE_EMOJI[w.fatigue] : '',
    };
  }

  function buildActionsHtml(realIdx) {
    return `
      <div style="display:flex;gap:6px;margin-top:10px">
        <button class="wi-action" style="flex:1;width:auto;border-radius:8px;font-size:12px;padding:6px" onclick="event.stopPropagation();openEditModal(${realIdx})">✏️ 수정</button>
        <button class="wi-action" style="flex:1;width:auto;border-radius:8px;font-size:12px;padding:6px;color:var(--red)" onclick="event.stopPropagation();deleteWorkoutPrompt(${realIdx})">🗑️ 삭제</button>
      </div>`;
  }

  function ensureDetailLoaded(panel) {
    if (!panel || panel.dataset.detailReady === '1') return;
    const realIdx = parseInt(panel.dataset.realIdx, 10);
    if (!Number.isFinite(realIdx)) return;

    const w = workoutByIdx.get(realIdx);
    const body = panel.querySelector('.log-detail-body');
    if (!body) return;

    const detailHtml = (w && typeof buildExerciseDetailHTML === 'function')
      ? buildExerciseDetailHTML(w, realIdx)
      : '<div class="ee-body" style="padding:8px 0;color:var(--muted)">상세를 불러올 수 없어요.</div>';

    body.innerHTML = `${detailHtml}${buildActionsHtml(realIdx)}`;
    panel.dataset.detailReady = '1';
  }

  function createItemElement(w, realIdx) {
    const itemId = `wi-${realIdx}`;
    const panelId = `wp-${realIdx}`;
    const meta = buildSummaryMeta(w);
    const tagsHtml = buildTagsHtml(w);
    const dateStr = formatDateLabel(w.date);

    const item = document.createElement('div');
    item.className = 'workout-item' + (w.inProgress ? ' in-progress' : '');
    item.id = itemId;
    item.innerHTML = `
      <div class="wi-top" onclick="LogList.toggleDetail('${panelId}', '${itemId}')">
        <div>
          <div class="wi-date">${dateStr}</div>
          <div class="wi-meta" style="margin-top:4px">
            <span><span class="wi-type ${meta.typeCls}" style="padding:1px 6px;font-size:9px">${meta.typeLabel}</span></span>
            ${meta.progressBadge}
            ${meta.volumeOrCardio}
            <span>${meta.duration}분</span>
            ${meta.fatigueEmoji ? `<span>${meta.fatigueEmoji}</span>` : ''}
          </div>
          ${tagsHtml ? `<div style="margin-top:4px">${tagsHtml}</div>` : ''}
        </div>
        <span class="wi-expand-icon" id="icon-${realIdx}">▼</span>
      </div>
      <div class="workout-detail-panel" id="${panelId}" data-real-idx="${realIdx}">
        <div class="log-detail-body" style="padding:10px 0 4px"></div>
      </div>`;
    return item;
  }

  function appendLoadMore(list, shown, total) {
    const wrap = document.createElement('div');
    wrap.className = 'log-load-more-wrap';
    wrap.innerHTML = `
      <button type="button" class="log-load-more-btn" onclick="LogList.loadMore()">더 보기</button>
      <div class="log-load-more-meta">${shown} / ${total}개 표시</div>`;
    list.appendChild(wrap);
  }

  function toggleDetail(panelId, itemId) {
    const panel = typeof document !== 'undefined' ? document.getElementById(panelId) : null;
    const idx = String(panelId || '').replace('wp-', '');
    const icon = typeof document !== 'undefined' ? document.getElementById(`icon-${idx}`) : null;
    if (!panel) return;

    const isOpen = panel.classList.contains('open');
    document.querySelectorAll('.workout-detail-panel.open').forEach((p) => {
      p.classList.remove('open');
    });
    document.querySelectorAll('.wi-expand-icon.open').forEach((ic) => ic.classList.remove('open'));

    if (!isOpen) {
      ensureDetailLoaded(panel);
      panel.classList.add('open');
      if (icon) icon.classList.add('open');
    }
  }

  function loadMore() {
    visibleCount += PAGE_SIZE;
    render({ reset: false });
  }

  function render(options) {
    const opts = options || {};
    if (opts.reset !== false) visibleCount = PAGE_SIZE;

    ensureStyles();
    workoutByIdx = new Map();

    if (typeof loadWorkouts !== 'function') return;

    const workouts = loadWorkouts();
    const list = typeof document !== 'undefined' ? document.getElementById('workoutList') : null;
    if (!list) return;
    list.innerHTML = '';

    if (!workouts.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="ee-icon">📋</div>
          <div class="ee-title">운동 기록이 없어요</div>
          <div class="ee-body">오른쪽 위 + 추가를 눌러<br>운동을 기록해보세요.</div>
        </div>`;
      return;
    }

    const sorted = sortWithIndex(workouts);
    const page = getVisibleEntries(sorted, visibleCount);

    page.forEach(({ w, idx }) => {
      workoutByIdx.set(idx, w);
      list.appendChild(createItemElement(w, idx));
    });

    if (hasMore(sorted.length, visibleCount)) {
      appendLoadMore(list, page.length, sorted.length);
    }
  }

  function getVisibleCount() {
    return visibleCount;
  }

  function getPageSize() {
    return PAGE_SIZE;
  }

  return {
    PAGE_SIZE,
    render,
    loadMore,
    toggleDetail,
    ensureDetailLoaded,
    sortWithIndex,
    getVisibleEntries,
    hasMore,
    getVisibleCount,
    getPageSize,
    formatDateLabel,
  };
})();
