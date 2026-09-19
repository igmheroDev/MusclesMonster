// ============================================================
// RECOVR - 개인 기록(PR) 카드 탭 → 기록 추이 그래프 (독립 모듈)
//
// 통계 "🏆 개인 기록 (PR)" 카드는 지금까지 탭하면 그 운동의 자극 부위
// 히트맵만 미리 보여줬다. PR 리스트 맥락에는 "이 운동이 시간에 따라
// 어떻게 성장했는지"(무게/e1RM 추이)가 더 어울리므로, 세션별 최고 e1RM
// 막대그래프 + 전체 기간 PR 요약을 보여주는 새 시트를 추가한다.
// 자극 부위 정보는 시트 하단 버튼으로 여전히 접근할 수 있게 유지한다
// (기존 ExerciseStimHeatmap.openExercise 재사용, 대체가 아닌 보조 동선).
//
// 이 모듈은 app.js(renderPRList)를 전혀 수정하지 않는다. renderPRList와
// 동일한 PR 집계 로직(세트별 e1RM/최고무게/세션볼륨)을 app.js가 이미
// 공개해 둔 전역 함수(getCompletedWorkouts/calcE1RM/getExerciseVolume)만
// 재사용해 독립적으로 다시 계산한다(app.js 내부 상태를 읽지 않음).
//
// listQuickActions.js는 이 모듈이 로드되어 있으면 PR 카드 탭을
// PrTrendDetail.open()으로 위임한다(그 파일의 activatePrListCard만 수정).
// ============================================================

const PrTrendDetail = (() => {
  const OVERLAY_ID = 'prTrendOverlay';
  const MAX_BARS = 8;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function loadWorkoutsSafe() {
    try {
      if (typeof getCompletedWorkouts === 'function') return getCompletedWorkouts();
    } catch (e) { /* ignore */ }
    return [];
  }

  function calcE1RMSafe(weight, reps) {
    if (typeof calcE1RM === 'function') return calcE1RM(weight, reps);
    if (!weight || !reps) return 0;
    return weight * (1 + reps / 30);
  }

  function getExerciseVolumeSafe(ex) {
    if (typeof getExerciseVolume === 'function') return getExerciseVolume(ex);
    if (ex.setDetails && ex.setDetails.length > 0) {
      return ex.setDetails.reduce((sum, s) => (s.completed ? sum + (s.weight || 0) * (s.reps || 0) : sum), 0);
    }
    return (ex.weight || 0) * (ex.reps || 0) * (ex.sets || 0);
  }

  // renderPRList()와 동일한 후보 산출 방식(세트별 입력이 있으면 세트별로,
  // 없으면 대표 weight/reps 1건)으로 한 세션의 최고 무게/e1RM/볼륨을 구한다.
  function buildSessions(name) {
    const workouts = loadWorkoutsSafe();
    const sessions = [];

    workouts.forEach((w) => {
      if (!w || !w.date) return;
      let found = false;
      let volume = 0;
      let maxWeight = 0;
      let maxE1RM = 0;

      (w.exercises || []).forEach((ex) => {
        if (!ex || ex.name !== name || ex.mode === 'duration') return;
        found = true;
        volume += getExerciseVolumeSafe(ex);

        const candidates = (ex.setDetails && ex.setDetails.length > 0)
          ? ex.setDetails.map((s) => ({ weight: s.weight, reps: s.reps }))
          : [{ weight: ex.weight, reps: ex.reps }];

        candidates.forEach((c) => {
          if ((c.weight || 0) > maxWeight) maxWeight = c.weight;
          const e1rm = calcE1RMSafe(c.weight, c.reps);
          if (e1rm > maxE1RM) maxE1RM = e1rm;
        });
      });

      if (found) sessions.push({ date: w.date, volume, maxWeight, maxE1RM });
    });

    sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return sessions;
  }

  function formatDateLabel(dateStr) {
    const d = new Date(`${dateStr}T12:00:00`);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function buildChartHtml(sessions) {
    if (!sessions.length) return `<div class="esh-empty">표시할 기록이 없어요</div>`;
    const recent = sessions.slice(-MAX_BARS);
    const maxVal = Math.max(...recent.map((s) => s.maxE1RM), 1);

    const bars = recent.map((s) => {
      const h = Math.max(4, Math.round((s.maxE1RM / maxVal) * 100));
      return `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end">
          <div style="font-size:9px;color:var(--muted)">${s.maxE1RM.toFixed(0)}</div>
          <div style="width:100%;height:${h}%;background:var(--cyan);border-radius:4px 4px 0 0;min-height:4px"></div>
          <div style="font-size:9px;color:var(--muted)">${formatDateLabel(s.date)}</div>
        </div>`;
    }).join('');

    return `<div style="display:flex;align-items:flex-end;gap:8px;height:120px">${bars}</div>`;
  }

  function buildStatsGridHtml(sessions) {
    const maxWeight = sessions.reduce((m, s) => Math.max(m, s.maxWeight), 0);
    const maxE1RM = sessions.reduce((m, s) => Math.max(m, s.maxE1RM), 0);
    const maxVolume = sessions.reduce((m, s) => Math.max(m, s.volume), 0);

    return `
      <div class="stats-grid" style="margin-top:10px">
        <div class="stat-card">
          <div class="stat-label">최고 무게</div>
          <div class="stat-val" style="color:var(--green)">${maxWeight}</div>
          <div class="stat-sub">kg</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">최고 e1RM</div>
          <div class="stat-val" style="color:var(--green)">${maxE1RM.toFixed(1)}</div>
          <div class="stat-sub">kg</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">최고 세션 볼륨</div>
          <div class="stat-val" style="color:var(--green)">${maxVolume.toLocaleString()}</div>
          <div class="stat-sub">kg</div>
        </div>
      </div>`;
  }

  function buildSheetHtml(name) {
    const sessions = buildSessions(name);
    const chartHtml = buildChartHtml(sessions);
    const statsHtml = sessions.length ? buildStatsGridHtml(sessions) : '';
    const hasStim = typeof ExerciseStimHeatmap !== 'undefined' && typeof ExerciseStimHeatmap.openExercise === 'function';
    const stimBtn = hasStim
      ? `<div class="esh-actions" style="margin-top:12px">
          <button type="button" class="esh-secondary-btn" onclick="PrTrendDetail.openStim()">🎯 이 운동의 자극 부위 보기</button>
        </div>`
      : '';

    return `
      <div class="esh-sheet esh-sheet--list" onclick="event.stopPropagation()">
        <div class="esh-sheet-header">
          <div>
            <div class="esh-sheet-kicker">개인 기록 · 기록 추이</div>
            <div class="esh-sheet-title">${escapeHtml(name)}</div>
          </div>
          <button type="button" class="esh-sheet-close" onclick="PrTrendDetail.close()">닫기</button>
        </div>
        <div class="esh-list-hint">최근 ${Math.min(sessions.length, MAX_BARS)}회 세션 · e1RM(추정 1RM, kg) 기준</div>
        <div class="stat-card" style="padding:16px;">${chartHtml}</div>
        ${statsHtml}
        ${stimBtn}
      </div>`;
  }

  let currentName = null;

  function open(name) {
    if (!name) return;
    const overlay = typeof document !== 'undefined' ? document.getElementById(OVERLAY_ID) : null;
    if (!overlay) return;
    currentName = name;
    overlay.innerHTML = buildSheetHtml(name);
    overlay.classList.add('show');
  }

  function close() {
    const overlay = typeof document !== 'undefined' ? document.getElementById(OVERLAY_ID) : null;
    if (!overlay) return;
    overlay.classList.remove('show');
    overlay.innerHTML = '';
  }

  function closeOnOverlay(e) {
    if (e && e.target && e.target.id === OVERLAY_ID) close();
  }

  function openStim() {
    const name = currentName;
    close();
    if (name && typeof ExerciseStimHeatmap !== 'undefined' && typeof ExerciseStimHeatmap.openExercise === 'function') {
      ExerciseStimHeatmap.openExercise(name, { showAdd: false });
    }
  }

  return {
    open,
    close,
    closeOnOverlay,
    openStim,
    buildSessions,
    buildSheetHtml,
  };
})();
