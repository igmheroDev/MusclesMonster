// ============================================================
// RECOVR - 시간 운동 스톱워치 모듈 (독립 모듈)
// 플랭크·실내자전거 등 duration 모드에서 세트별 시작/정지로 시간 기록
// ============================================================

const DurationTimer = (() => {
  const TICK_MS = 200;

  let active = null;

  function formatSeconds(totalSec) {
    const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function normalizeSets(exercise) {
    if (!exercise) return [];
    if (Array.isArray(exercise.durationSets) && exercise.durationSets.length > 0) {
      return exercise.durationSets.map((s) => ({
        seconds: Math.max(0, Math.floor(Number(s.seconds) || 0)),
        completed: !!s.completed,
      }));
    }
    const min = parseInt(exercise.durationMin, 10);
    if (min > 0) {
      return [{ seconds: min * 60, completed: true }];
    }
    return [];
  }

  function totalSeconds(sets) {
    return (sets || []).reduce((sum, s) => sum + (s.seconds || 0), 0);
  }

  function totalMinutes(sets) {
    const sec = totalSeconds(sets);
    if (sec <= 0) return 0;
    return Math.max(1, Math.ceil(sec / 60));
  }

  function formatExerciseSummary(ex) {
    const sets = normalizeSets(ex);
    if (sets.length === 0) return `${ex.durationMin || 0}분`;
    if (sets.length === 1) return formatSeconds(sets[0].seconds);
    return sets.map((s) => formatSeconds(s.seconds)).join(' + ');
  }

  function getLiveSeconds(setRow) {
    let seconds = Math.max(0, parseInt(setRow.dataset.seconds, 10) || 0);
    if (active?.setRowEl === setRow && active.startedAt) {
      seconds = Math.floor(active.baseSeconds + (Date.now() - active.startedAt) / 1000);
    }
    return seconds;
  }

  function updateWrapTotal(wrap) {
    const totalEl = wrap.querySelector('.duration-total-val');
    if (!totalEl) return;
    let sum = 0;
    wrap.querySelectorAll('.duration-set-row').forEach((row) => {
      sum += getLiveSeconds(row);
    });
    totalEl.textContent = formatSeconds(sum);
  }

  function updateSetDisplay(setRow, seconds, running) {
    const el = setRow.querySelector('.duration-display');
    if (!el) return;
    el.textContent = formatSeconds(seconds);
    el.classList.toggle('running', running);
  }

  function updateToggleBtn(setRow, running) {
    const btn = setRow.querySelector('.duration-toggle-btn');
    if (!btn) return;
    btn.textContent = running ? '■' : '▶';
    btn.title = running ? '정지' : '시작';
    btn.classList.toggle('active', running);
    setRow.classList.toggle('is-running', running);
  }

  function readSecondsFromRow(setRow) {
    return Math.max(0, parseInt(setRow.dataset.seconds, 10) || 0);
  }

  function writeSecondsToRow(setRow, seconds, wrap) {
    const sec = Math.max(0, Math.floor(seconds));
    setRow.dataset.seconds = String(sec);
    updateSetDisplay(setRow, sec, false);
    updateToggleBtn(setRow, false);
    if (sec > 0) {
      const check = setRow.querySelector('.duration-check');
      if (check) check.classList.add('checked');
    }
    if (wrap) updateWrapTotal(wrap);
    if (typeof saveWorkoutProgress === 'function') saveWorkoutProgress(true);
  }

  function stopActive(saveElapsed) {
    if (!active) return;
    clearInterval(active.intervalId);
    const { setRowEl, wrapEl, startedAt, baseSeconds } = active;
    if (saveElapsed && startedAt) {
      const total = Math.floor(baseSeconds + (Date.now() - startedAt) / 1000);
      setRowEl.dataset.seconds = String(total);
      updateSetDisplay(setRowEl, total, false);
      updateToggleBtn(setRowEl, false);
      if (wrapEl) updateWrapTotal(wrapEl);
    } else {
      updateSetDisplay(setRowEl, readSecondsFromRow(setRowEl), false);
      updateToggleBtn(setRowEl, false);
    }
    active = null;
  }

  function toggleTimer(setRow, wrap) {
    if (active?.setRowEl === setRow) {
      const elapsed = (Date.now() - active.startedAt) / 1000;
      const total = Math.floor(active.baseSeconds + elapsed);
      stopActive(false);
      writeSecondsToRow(setRow, total, wrap);
      return;
    }

    stopActive(true);
    const base = readSecondsFromRow(setRow);
    active = {
      setRowEl: setRow,
      wrapEl: wrap,
      baseSeconds: base,
      startedAt: Date.now(),
      intervalId: setInterval(() => {
        if (!active || active.setRowEl !== setRow) return;
        const sec = active.baseSeconds + (Date.now() - active.startedAt) / 1000;
        updateSetDisplay(setRow, sec, true);
        if (active.wrapEl) updateWrapTotal(active.wrapEl);
      }, TICK_MS),
    };
    updateToggleBtn(setRow, true);
    updateSetDisplay(setRow, base, true);
  }

  function removeSetRow(wrap, setRow) {
    if (active?.setRowEl === setRow) stopActive(false);
    setRow.remove();
    const checklist = wrap.querySelector('.duration-checklist');
    if (!checklist) return;
    checklist.querySelectorAll('.duration-set-row').forEach((r, i) => {
      r.querySelector('.set-num').textContent = i + 1;
    });
    if (checklist.querySelectorAll('.duration-set-row').length === 0) {
      checklist.innerHTML = '';
    }
    updateWrapTotal(wrap);
    if (typeof saveWorkoutProgress === 'function') saveWorkoutProgress(true);
  }

  function ensureHeader(checklist) {
    if (checklist.querySelector('.duration-checklist-header')) return;
    checklist.innerHTML = `<div class="duration-checklist-header">
      <span>세트</span><span>시간</span><span>시작/정지</span><span>완료</span><span></span>
    </div>`;
  }

  function addSetRow(wrap, values) {
    const checklist = wrap.querySelector('.duration-checklist');
    if (!checklist) return null;

    ensureHeader(checklist);

    const setRow = document.createElement('div');
    setRow.className = 'duration-set-row';
    const setNum = checklist.querySelectorAll('.duration-set-row').length + 1;
    const seconds = values?.seconds ?? 0;
    const completed = values?.completed ?? (seconds > 0);
    setRow.dataset.seconds = String(seconds);

    setRow.innerHTML = `
      <div class="set-num">${setNum}</div>
      <div class="duration-display">${formatSeconds(seconds)}</div>
      <button type="button" class="duration-toggle-btn" title="시작">▶</button>
      <div class="duration-check ${completed ? 'checked' : ''}">✓</div>
      <button type="button" class="duration-set-del">✕</button>
    `;

    setRow.querySelector('.duration-toggle-btn').addEventListener('click', (e) => {
      e.preventDefault();
      toggleTimer(setRow, wrap);
    });
    setRow.querySelector('.duration-check').addEventListener('click', () => {
      toggleCheck(setRow.querySelector('.duration-check'));
    });
    setRow.querySelector('.duration-set-del').addEventListener('click', (e) => {
      e.preventDefault();
      removeSetRow(wrap, setRow);
    });

    checklist.appendChild(setRow);
    updateWrapTotal(wrap);
    return setRow;
  }

  function toggleCheck(el) {
    el.classList.toggle('checked');
    if (typeof saveWorkoutProgress === 'function') saveWorkoutProgress(true);
  }

  function populateWrap(wrap, prefill) {
    const checklist = wrap.querySelector('.duration-checklist');
    if (!checklist) return;
    stopActive(true);
    checklist.innerHTML = '';
    const sets = normalizeSets(prefill);
    if (sets.length === 0) {
      addSetRow(wrap, { seconds: 0, completed: false });
    } else {
      sets.forEach((s) => addSetRow(wrap, s));
    }
    updateWrapTotal(wrap);
  }

  function clearWrap(wrap) {
    stopActive(true);
    const checklist = wrap.querySelector('.duration-checklist');
    if (checklist) checklist.innerHTML = '';
    const totalEl = wrap.querySelector('.duration-total-val');
    if (totalEl) totalEl.textContent = '0:00';
  }

  function extractFromWrap(wrap) {
    if (active?.wrapEl === wrap) {
      const row = active.setRowEl;
      const total = Math.floor(active.baseSeconds + (Date.now() - active.startedAt) / 1000);
      stopActive(false);
      row.dataset.seconds = String(total);
      updateSetDisplay(row, total, false);
    } else {
      stopActive(true);
    }

    const sets = [];
    wrap.querySelectorAll('.duration-set-row').forEach((setRow) => {
      sets.push({
        seconds: readSecondsFromRow(setRow),
        completed: setRow.querySelector('.duration-check')?.classList.contains('checked') || false,
      });
    });

    return {
      durationSets: sets,
      durationMin: totalMinutes(sets),
      sets: sets.length,
      weight: 0,
      reps: 0,
    };
  }

  function onModalClose() {
    stopActive(true);
  }

  return {
    formatSeconds,
    normalizeSets,
    totalSeconds,
    totalMinutes,
    formatExerciseSummary,
    populateWrap,
    addSetRow,
    clearWrap,
    extractFromWrap,
    toggleCheck,
    onModalClose,
  };
})();
