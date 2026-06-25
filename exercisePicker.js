// ============================================================
// ExercisePicker — 종목 목록에서 운동 선택
// app.js의 운동 사전·부위 매칭 함수를 참조 (직접 수정 없음)
// ============================================================

const ExercisePicker = (() => {
  const CATEGORY_CHIPS = [
    { id: 'all',      label: '전체' },
    { id: 'chest',    label: '가슴' },
    { id: 'back',     label: '등' },
    { id: 'shoulder', label: '어깨' },
    { id: 'lower',    label: '하체' },
    { id: 'arms',     label: '팔' },
    { id: 'core',     label: '코어' },
    { id: 'cardio',   label: '유산소' },
    { id: 'mobility', label: '스트레칭' },
  ];

  const EQUIPMENT_OPTIONS = [
    { id: 'all',        label: '전체 도구' },
    { id: 'machine',    label: '머신' },
    { id: 'barbell',    label: '바벨' },
    { id: 'dumbbell',   label: '덤벨' },
    { id: 'cable',      label: '케이블' },
    { id: 'bodyweight', label: '맨몸' },
    { id: 'kettlebell', label: '케틀벨' },
    { id: 'other',      label: '기타' },
  ];

  const LOWER_MUSCLES = new Set(['quads', 'hamstrings', 'adductors', 'calves']);
  const ARM_MUSCLES = new Set(['biceps', 'triceps', 'forearms']);

  const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

  let targetRow = null;
  let createNewRow = false;
  let activeCategory = 'all';
  let activeEquipment = 'all';
  let searchQuery = '';
  let lastPerformedMap = null;

  // ── 한글 초성 검색 ─────────────────────────────────────────
  function toChosung(str) {
    let result = '';
    for (const ch of str) {
      const code = ch.charCodeAt(0);
      if (code >= 0xAC00 && code <= 0xD7A3) {
        result += CHOSUNG[Math.floor((code - 0xAC00) / 588)];
      } else {
        result += ch.toLowerCase();
      }
    }
    return result;
  }

  function matchesSearch(name, query) {
    if (!query) return true;
    const q = query.trim().toLowerCase();
    const normalized = typeof normalizeExerciseName === 'function'
      ? normalizeExerciseName(name)
      : name.toLowerCase().replace(/\s+/g, '');
    const nq = q.replace(/\s+/g, '');
    if (name.toLowerCase().includes(q)) return true;
    if (normalized.includes(nq)) return true;
    if (toChosung(name).includes(q)) return true;
    return false;
  }

  // ── 부위·도구 분류 ─────────────────────────────────────────
  function getPrimaryCategory(name) {
    const muscles = typeof getMusclesFromExerciseName === 'function'
      ? getMusclesFromExerciseName(name) : [];
    const activities = typeof getActivityTagsFromExerciseName === 'function'
      ? getActivityTagsFromExerciseName(name) : [];

    if (activities.includes('cardio')) return 'cardio';
    if (activities.includes('mobility')) return 'mobility';
    if (muscles.includes('chest')) return 'chest';
    if (muscles.includes('back')) return 'back';
    if (muscles.includes('shoulder')) return 'shoulder';
    if (muscles.some(m => LOWER_MUSCLES.has(m))) return 'lower';
    if (muscles.some(m => ARM_MUSCLES.has(m))) return 'arms';
    if (muscles.includes('core')) return 'core';
    return 'all';
  }

  function getEquipmentType(name) {
    const n = name.toLowerCase();
    if (/머신|머신|프레스 머신|레그프레스|풀다운|스미스/.test(n)) return 'machine';
    if (/바벨|백 스쿼트|데드리프트|밀리터리/.test(n)) return 'barbell';
    if (/덤벨/.test(n)) return 'dumbbell';
    if (/케이블|로프/.test(n)) return 'cable';
    if (/케틀벨/.test(n)) return 'kettlebell';
    if (/맨몸|푸시업|풀업|턱걸이|플랭크|딥스|버피|줄넘기|걷기|러닝|달리기/.test(n)) return 'bodyweight';
    return 'other';
  }

  function getExerciseIcon(name) {
    const muscles = typeof getMusclesFromExerciseName === 'function'
      ? getMusclesFromExerciseName(name) : [];
    const activities = typeof getActivityTagsFromExerciseName === 'function'
      ? getActivityTagsFromExerciseName(name) : [];

    if (activities.includes('cardio') && typeof NON_MUSCLE_LABELS !== 'undefined') {
      return NON_MUSCLE_LABELS.cardio.icon;
    }
    if (activities.includes('mobility') && typeof NON_MUSCLE_LABELS !== 'undefined') {
      return NON_MUSCLE_LABELS.mobility.icon;
    }
    if (muscles.length > 0 && typeof MUSCLE_LABELS !== 'undefined') {
      return MUSCLE_LABELS[muscles[0]].icon;
    }
    return '🏋️';
  }

  function getCategoryLabel(name) {
    const cat = getPrimaryCategory(name);
    const chip = CATEGORY_CHIPS.find(c => c.id === cat);
    return chip ? chip.label : '';
  }

  // ── 최근 수행일 ───────────────────────────────────────────
  function buildLastPerformedMap() {
    const map = {};
    if (typeof loadWorkouts !== 'function') return map;

    const workouts = loadWorkouts()
      .filter(w => !w.inProgress)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    workouts.forEach(w => {
      (w.exercises || []).forEach(ex => {
        if (!ex.name || map[ex.name]) return;
        map[ex.name] = w.date;
      });
    });
    return map;
  }

  function formatLastPerformed(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 30) return `${diffDays}일 전`;
    const months = Math.floor(diffDays / 30);
    return `${months}개월 전`;
  }

  // ── 종목 목록 빌드 ─────────────────────────────────────────
  function getCatalog() {
    const names = typeof getAllExerciseNames === 'function'
      ? getAllExerciseNames()
      : [];

    return names.map(name => ({
      name,
      category: getPrimaryCategory(name),
      equipment: getEquipmentType(name),
      icon: getExerciseIcon(name),
      categoryLabel: getCategoryLabel(name),
      lastDate: lastPerformedMap ? lastPerformedMap[name] : null,
    }));
  }

  function getFilteredList() {
    return getCatalog().filter(item => {
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;
      if (activeEquipment !== 'all' && item.equipment !== activeEquipment) return false;
      if (!matchesSearch(item.name, searchQuery)) return false;
      return true;
    }).sort((a, b) => {
      // 최근 수행 우선, 그 다음 이름순
      if (a.lastDate && !b.lastDate) return -1;
      if (!a.lastDate && b.lastDate) return 1;
      if (a.lastDate && b.lastDate) return b.lastDate.localeCompare(a.lastDate);
      return a.name.localeCompare(b.name, 'ko');
    });
  }

  // ── UI 렌더링 ─────────────────────────────────────────────
  function renderChips() {
    const el = document.getElementById('exPickerChips');
    if (!el) return;
    el.innerHTML = CATEGORY_CHIPS.map(chip => `
      <button type="button"
        class="ex-picker-chip${activeCategory === chip.id ? ' selected' : ''}"
        data-cat="${chip.id}"
        onclick="ExercisePicker.setCategory('${chip.id}')">${chip.label}</button>
    `).join('');
  }

  function renderList() {
    const el = document.getElementById('exPickerList');
    if (!el) return;

    const items = getFilteredList();

    if (items.length === 0) {
      el.innerHTML = `
        <div class="ex-picker-empty">
          <div class="ex-picker-empty-icon">🔍</div>
          <div>검색 결과가 없어요</div>
          <div style="font-size:11px;margin-top:4px;color:var(--muted)">다른 키워드나 필터를 시도해보세요</div>
        </div>`;
      return;
    }

    el.innerHTML = items.map(item => {
      const lastLabel = item.lastDate ? formatLastPerformed(item.lastDate) : '';
      const meta = [item.categoryLabel, lastLabel].filter(Boolean).join(' · ');
      return `
        <button type="button" class="ex-picker-item" onclick="ExercisePicker.select('${item.name.replace(/'/g, "\\'")}')">
          <div class="ex-picker-item-icon">${item.icon}</div>
          <div class="ex-picker-item-body">
            <div class="ex-picker-item-name">${item.name}</div>
            ${meta ? `<div class="ex-picker-item-meta">${meta}</div>` : ''}
          </div>
        </button>`;
    }).join('');
  }

  function render() {
    renderChips();
    renderList();
  }

  // ── 선택 적용 ─────────────────────────────────────────────
  function applyToRow(row, name) {
    if (!row) return;

    const nameInput = row.querySelector('.ex-name');
    if (nameInput) {
      nameInput.value = name;
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if (typeof autoDetectMode === 'function') {
      autoDetectMode(row, name);
    }
    if (typeof saveWorkoutProgress === 'function') {
      saveWorkoutProgress(true);
    }
  }

  function select(name) {
    let row = targetRow;

    if (createNewRow && typeof addExerciseRow === 'function') {
      addExerciseRow({ name });
      const wraps = document.querySelectorAll('#exerciseRows .exercise-row-wrap');
      row = wraps[wraps.length - 1];
    } else if (row) {
      applyToRow(row, name);
    } else if (typeof addExerciseRow === 'function') {
      addExerciseRow({ name });
    }

    close();
  }

  // ── 열기/닫기 ─────────────────────────────────────────────
  function open(rowOrOptions) {
    const overlay = document.getElementById('exPickerOverlay');
    if (!overlay) return;

    if (rowOrOptions && rowOrOptions.nodeType === 1) {
      targetRow = rowOrOptions;
      createNewRow = false;
    } else {
      targetRow = null;
      createNewRow = true;
    }

    activeCategory = 'all';
    activeEquipment = 'all';
    searchQuery = '';
    lastPerformedMap = buildLastPerformedMap();

    const searchEl = document.getElementById('exPickerSearch');
    const equipEl = document.getElementById('exPickerEquipment');
    if (searchEl) searchEl.value = '';
    if (equipEl) equipEl.value = 'all';

    render();
    overlay.classList.add('show');
    setTimeout(() => searchEl?.focus(), 200);
  }

  function close() {
    const overlay = document.getElementById('exPickerOverlay');
    if (overlay) overlay.classList.remove('show');
    targetRow = null;
    createNewRow = false;
  }

  function closeOnOverlay(e) {
    if (e.target.id === 'exPickerOverlay') close();
  }

  function setCategory(cat) {
    activeCategory = cat;
    render();
  }

  function setEquipment(val) {
    activeEquipment = val;
    render();
  }

  function onSearchInput(val) {
    searchQuery = val;
    renderList();
  }

  function init() {
    const searchEl = document.getElementById('exPickerSearch');
    const equipEl = document.getElementById('exPickerEquipment');
    if (searchEl) {
      searchEl.addEventListener('input', () => onSearchInput(searchEl.value));
    }
    if (equipEl) {
      equipEl.addEventListener('change', () => setEquipment(equipEl.value));
    }
  }

  return {
    init,
    open,
    close,
    closeOnOverlay,
    setCategory,
    setEquipment,
    select,
  };
})();
