// ============================================================
// RECOVR - 추천 운동 → 유튜브 검색 연결 (독립 모듈)
//
// ExerciseStimHeatmap(부위→추천 운동 시트)의 완성된 로직·마크업은 전혀
// 수정하지 않는다. 이미 렌더된 DOM을 MutationObserver로 감지해
// "▶ 영상" 버튼만 추가로 붙이는 방식으로 연결한다
// (exerciseStimHeatmap.js가 exercisePicker.js를 확장하는 것과 동일한 패턴).
//
// 버튼을 누르면 유튜브 검색 결과 페이지로 이동한다. 모바일에서 유튜브
// 앱이 설치돼 있으면 OS의 유니버설/앱 링크 처리에 의해 앱으로 바로
// 연결되는 경우가 많다(웹에서 강제로 앱을 열 수 있는 표준 방법은 없음).
// ============================================================

const YoutubeSearchLink = (() => {
  const SEARCH_SUFFIX = '운동 방법';

  let observersHooked = false;

  function buildSearchUrl(name) {
    const query = `${String(name || '').trim()} ${SEARCH_SUFFIX}`.trim();
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  }

  function open(name) {
    if (!name) return;
    const url = buildSearchUrl(name);
    window.open(url, '_blank', 'noopener');
  }

  function bindTrigger(el, name) {
    const trigger = (e) => {
      e.preventDefault();
      e.stopPropagation();
      open(name);
    };
    el.addEventListener('click', trigger);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') trigger(e);
    });
  }

  function createInlineButton(name) {
    const btn = document.createElement('span');
    btn.className = 'ytl-btn';
    btn.setAttribute('role', 'button');
    btn.tabIndex = 0;
    btn.setAttribute('aria-label', `${name} 유튜브에서 검색`);
    btn.textContent = '▶ 영상';
    bindTrigger(btn, name);
    return btn;
  }

  function createFullWidthButton(name) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ytl-video-btn';
    btn.textContent = '▶ 유튜브에서 영상으로 보기';
    bindTrigger(btn, name);
    return btn;
  }

  // 접기/닫기 버튼과 나란히 묶어서 우측 상단에 배치 (기존 space-between 2단 레이아웃 유지)
  function placeBesideCloseButton(head, ytBtn) {
    const closeBtn = head.querySelector('.esh-sheet-close');
    if (!closeBtn) {
      head.appendChild(ytBtn);
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'ytl-actions-inline';
    closeBtn.parentNode.insertBefore(wrap, closeBtn);
    wrap.appendChild(ytBtn);
    wrap.appendChild(closeBtn);
  }

  function getExerciseName(el, selector) {
    const nameEl = el.querySelector(selector);
    return nameEl ? nameEl.textContent.trim() : '';
  }

  // ── 부위별 추천 운동 목록 + 목록 안에서 펼쳐지는 자극 미리보기 (#eshMuscleOverlay) ──
  function enhanceExerciseListItems(root) {
    root.querySelectorAll('.esh-ex-item').forEach((item) => {
      if (item.dataset.ytEnhanced === '1') return;
      const name = getExerciseName(item, '.esh-ex-name');
      if (!name) return;
      item.dataset.ytEnhanced = '1';
      item.appendChild(createInlineButton(name));
    });
  }

  function enhanceSplitPreviewHead(root) {
    const head = root.querySelector('.esh-split-preview-head');
    if (!head || head.dataset.ytEnhanced === '1') return;
    const name = getExerciseName(head, '.esh-split-ex-name');
    if (!name) return;
    head.dataset.ytEnhanced = '1';
    placeBesideCloseButton(head, createInlineButton(name));
  }

  function enhanceMuscleOverlay() {
    const root = document.getElementById('eshMuscleOverlay');
    if (!root) return;
    enhanceExerciseListItems(root);
    enhanceSplitPreviewHead(root);
  }

  // ── 단일 운동 자극 상세 시트 (#eshExerciseOverlay) ──────────
  function enhanceExerciseOverlay() {
    const root = document.getElementById('eshExerciseOverlay');
    if (!root) return;
    const sheet = root.querySelector('.esh-sheet');
    const actions = root.querySelector('.esh-actions');
    if (!sheet || !actions || sheet.dataset.ytEnhanced === '1') return;
    const name = getExerciseName(root, '.esh-sheet-title');
    if (!name) return;
    sheet.dataset.ytEnhanced = '1';
    actions.parentNode.insertBefore(createFullWidthButton(name), actions);
  }

  // ── DOM 변화 감지 (ExerciseStimHeatmap 코드는 건드리지 않음) ──
  function hookObservers() {
    if (observersHooked || typeof MutationObserver === 'undefined') return;

    const muscleOverlay = document.getElementById('eshMuscleOverlay');
    const exerciseOverlay = document.getElementById('eshExerciseOverlay');
    if (!muscleOverlay && !exerciseOverlay) return;
    observersHooked = true;

    if (muscleOverlay) {
      new MutationObserver(enhanceMuscleOverlay).observe(muscleOverlay, { childList: true });
      enhanceMuscleOverlay();
    }
    if (exerciseOverlay) {
      new MutationObserver(enhanceExerciseOverlay).observe(exerciseOverlay, { childList: true });
      enhanceExerciseOverlay();
    }
  }

  function init() {
    hookObservers();
  }

  return {
    init,
    buildSearchUrl,
    open,
    enhanceMuscleOverlay,
    enhanceExerciseOverlay,
  };
})();
