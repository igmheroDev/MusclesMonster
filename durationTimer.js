// ============================================================
// RECOVR - 시간 운동 스톱워치 모듈 (독립 모듈)
// 플랭크·실내자전거 등 duration 모드에서 세트별 시작/정지로 시간 기록
// ============================================================

const DurationTimer = (() => {
  const TICK_MS = 200;

  let active = null;
  let editingSetRow = null;
  let editingWrap = null;

  function secondsFromParts(minVal, secVal) {
    const m = Math.max(0, parseInt(minVal, 10) || 0);
    let s = Math.max(0, parseInt(secVal, 10) || 0);
    if (s > 59) s = 59;
    return m * 60 + s;
  }

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
    el.classList.remove('editing');
    el.textContent = formatSeconds(seconds);
    el.classList.toggle('running', running);
  }

  function closeManualEditor(apply, totalSec) {
    const setRow = editingSetRow;
    const wrap = editingWrap;
    if (!setRow) return;

    document.removeEventListener('click', onManualEditorOutsideClick, true);
    editingSetRow = null;
    editingWrap = null;

    const displayEl = setRow.querySelector('.duration-display');
    if (!displayEl?.classList.contains('editing')) return;

    if (apply) {
      writeSecondsToRow(setRow, totalSec ?? 0, wrap);
      return;
    }

    displayEl.classList.remove('editing');
    updateSetDisplay(setRow, readSecondsFromRow(setRow), false);
  }

  function onManualEditorOutsideClick(e) {
    if (!editingSetRow) return;
    if (e.target.closest('.duration-display.editing')) return;
    closeManualEditor(false);
  }

  function openManualEditor(setRow, wrap) {
    if (active?.setRowEl === setRow) return;

    if (editingSetRow && editingSetRow !== setRow) {
      closeManualEditor(false);
    }

    const displayEl = setRow.querySelector('.duration-display');
    if (!displayEl || displayEl.classList.contains('editing')) return;

    const seconds = getLiveSeconds(setRow);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;

    displayEl.classList.add('editing');
    displayEl.title = '';
    displayEl.innerHTML = `
      <input type="number" class="dur-manual-min" inputmode="numeric" min="0" max="999" value="${m}" aria-label="분">
      <span class="dur-manual-sep">:</span>
      <input type="number" class="dur-manual-sec" inputmode="numeric" min="0" max="59" value="${s}" aria-label="초">
      <button type="button" class="dur-manual-ok" aria-label="적용">✓</button>
    `;

    const minInput = displayEl.querySelector('.dur-manual-min');
    const secInput = displayEl.querySelector('.dur-manual-sec');
    const okBtn = displayEl.querySelector('.dur-manual-ok');

    const apply = () => {
      const totalSec = secondsFromParts(minInput.value, secInput.value);
      closeManualEditor(true, totalSec);
    };

    okBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      apply();
    });
    secInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') apply();
    });
    minInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') apply();
    });

    editingSetRow = setRow;
    editingWrap = wrap;
    setTimeout(() => document.addEventListener('click', onManualEditorOutsideClick, true), 0);

    minInput.focus();
    minInput.select();
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
    if (editingSetRow === setRow) closeManualEditor(false);
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
      <span>세트</span><span title="탭하여 직접 입력">시간</span><span>시작/정지</span><span>완료</span><span></span>
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
      <div class="duration-display" title="탭하여 직접 입력">${formatSeconds(seconds)}</div>
      <button type="button" class="duration-toggle-btn" title="시작">▶</button>
      <div class="duration-check ${completed ? 'checked' : ''}">✓</div>
      <button type="button" class="duration-set-del">✕</button>
    `;

    setRow.querySelector('.duration-display').addEventListener('click', (e) => {
      if (active?.setRowEl === setRow) return;
      e.preventDefault();
      e.stopPropagation();
      openManualEditor(setRow, wrap);
    });
    setRow.querySelector('.duration-toggle-btn').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleTimer(setRow, wrap);
    });
    setRow.querySelector('.duration-check').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCheck(setRow.querySelector('.duration-check'));
    });
    setRow.querySelector('.duration-set-del').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
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
    if (editingWrap === wrap) closeManualEditor(false);
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

  function readFromWrap(wrap) {
    const sets = [];
    wrap.querySelectorAll('.duration-set-row').forEach((setRow) => {
      sets.push({
        seconds: getLiveSeconds(setRow),
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

  function freezeActiveTimer() {
    stopActive(true);
  }

  function extractFromWrap(wrap) {
    if (active?.wrapEl === wrap) freezeActiveTimer();
    return readFromWrap(wrap);
  }

  function onModalClose() {
    closeManualEditor(false);
    freezeActiveTimer();
  }

  function applyManualSeconds(setRow, wrap, seconds) {
    if (!setRow) return;
    if (active?.setRowEl === setRow) stopActive(true);
    writeSecondsToRow(setRow, seconds, wrap);
  }

  return {
    formatSeconds,
    secondsFromParts,
    normalizeSets,
    totalSeconds,
    totalMinutes,
    formatExerciseSummary,
    populateWrap,
    addSetRow,
    clearWrap,
    readFromWrap,
    extractFromWrap,
    freezeActiveTimer,
    toggleCheck,
    onModalClose,
    applyManualSeconds,
    openManualEditor,
    closeManualEditor,
  };
})();
