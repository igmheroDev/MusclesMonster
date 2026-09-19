// ============================================================
// RECOVR - 정적 리스트 탭 인터랙션 연결 (독립 모듈)
//
// 다음 세 리스트는 정보만 보여줄 뿐 탭해도 아무 반응이 없었다.
//  - 홈 "부위별 회복 상태" (#muscleList) — 코어/어깨/삼두 등 회복도 카드
//  - 통계 "주간 부위별 빈도" (#freqList)
//  - 통계 "🏆 개인 기록 (PR)" (#prList) — 스쿼트/인클라인/레그프레스 등
//
// 이 모듈은 위 리스트를 렌더하는 app.js(renderHome/renderWeeklyFrequency/
// renderPRList)의 코드를 전혀 수정하지 않는다. 대신 이미 완성된
// ExerciseStimHeatmap의 "부위 → 관련 운동" / "운동 → 자극 부위" 시트를
// 매니저 참조로만 재사용해, 렌더된 DOM의 텍스트를 읽어 탭 인터랙션만
// 이벤트 위임(delegation)으로 덧붙인다.
//   - 회복 상태 카드(부위) 탭  → ExerciseStimHeatmap.openMuscle(muscle)
//   - 주간 빈도 카드(부위) 탭  → ExerciseStimHeatmap.openMuscle(muscle)
//   - 개인 기록 카드(운동) 탭  → PrTrendDetail.open(name) (기록 추이 그래프,
//     PrTrendDetail 미로드 시에만 ExerciseStimHeatmap.openExercise로 폴백)
// ============================================================

const ListQuickActions = (() => {
  const STYLE_ID = 'list-quick-actions-styles';
  const ENHANCE_ATTR = 'data-lqa-ready';

  const registry = {};

  function getStim() {
    return (typeof ExerciseStimHeatmap !== 'undefined') ? ExerciseStimHeatmap : null;
  }

  function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  // 카드에 남아있는 텍스트(예: "코어")만으로 MUSCLE_LABELS의 부위 키를 역추적한다.
  // app.js의 렌더 로직에는 data-muscle 속성이 없으므로, 화면에 이미 보이는
  // 라벨 텍스트를 읽기 전용으로 매칭한다(부위명은 모두 서로 겹치지 않는 고유 문자열).
  function findMuscleKeyByLabel(text) {
    if (typeof MUSCLE_LABELS === 'undefined') return null;
    const t = normalizeText(text);
    if (!t) return null;
    return Object.keys(MUSCLE_LABELS).find((key) => {
      const name = MUSCLE_LABELS[key] && MUSCLE_LABELS[key].name;
      return !!name && t.indexOf(name) !== -1;
    }) || null;
  }

  function isActivateKey(e) {
    return !!e && (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar');
  }

  function ensureStyles() {
    if (typeof document === 'undefined') return false;
    if (document.getElementById(STYLE_ID)) return true;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #muscleList .muscle-card,
      #prList .muscle-card {
        cursor: pointer;
        position: relative;
        padding-right: 30px;
        transition: transform 0.12s ease, opacity 0.12s ease;
      }
      #muscleList .muscle-card::after,
      #prList .muscle-card::after {
        content: '\\203A';
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--muted);
        font-size: 20px;
        font-weight: 700;
        pointer-events: none;
      }
      #freqList .muscle-card > div {
        cursor: pointer;
        transition: transform 0.12s ease, opacity 0.12s ease;
      }
      #muscleList .muscle-card:active,
      #prList .muscle-card:active,
      #freqList .muscle-card > div:active {
        transform: scale(0.98);
        opacity: 0.82;
      }
      #muscleList .muscle-card:focus-visible,
      #prList .muscle-card:focus-visible,
      #freqList .muscle-card > div:focus-visible {
        outline: 2px solid var(--text);
        outline-offset: 2px;
        border-radius: 8px;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
    return true;
  }

  function enhanceA11y(el, ariaLabel) {
    if (!el || !el.setAttribute || el.getAttribute(ENHANCE_ATTR) === '1') return;
    el.setAttribute(ENHANCE_ATTR, '1');
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    if (ariaLabel) el.setAttribute('aria-label', ariaLabel);
  }

  // ------------------------------------------------------------
  // 홈 "부위별 회복 상태" (#muscleList)
  // 카드를 탭하면 그 부위를 자극하는 추천 운동 목록을 보여준다.
  // ------------------------------------------------------------
  function enhanceMuscleListCards() {
    const container = document.getElementById('muscleList');
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll('.muscle-card').forEach((card) => {
      const nameEl = card.querySelector && card.querySelector('.mc-name');
      const label = nameEl ? normalizeText(nameEl.textContent) : '';
      enhanceA11y(card, label ? `${label} 관련 운동 보기` : undefined);
    });
  }

  function activateMuscleListCard(card) {
    const nameEl = card.querySelector && card.querySelector('.mc-name');
    const muscleKey = findMuscleKeyByLabel(nameEl ? nameEl.textContent : '');
    const stim = getStim();
    if (muscleKey && stim && typeof stim.openMuscle === 'function') {
      stim.openMuscle(muscleKey);
    }
  }

  function onMuscleListClick(e) {
    const card = e.target && e.target.closest ? e.target.closest('.muscle-card') : null;
    if (!card) return;
    activateMuscleListCard(card);
  }

  function onMuscleListKeydown(e) {
    if (!isActivateKey(e)) return;
    const card = e.target && e.target.closest ? e.target.closest('.muscle-card') : null;
    if (!card) return;
    e.preventDefault && e.preventDefault();
    activateMuscleListCard(card);
  }

  // ------------------------------------------------------------
  // 통계 "주간 부위별 빈도" (#freqList)
  // 행(부위)을 탭하면 그 부위의 추천 운동 목록을 보여준다.
  // (renderWeeklyFrequency는 하나의 .muscle-card 안에 부위별 행을
  //  직접 자식 div로 쌓는 구조라, 행 자체에는 별도 클래스가 없다)
  // ------------------------------------------------------------
  function enhanceFreqListRows() {
    const container = document.getElementById('freqList');
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll('.muscle-card').forEach((wrap) => {
      Array.prototype.forEach.call(wrap.children || [], (row) => {
        const firstSpan = row.children && row.children[0];
        const label = firstSpan ? normalizeText(firstSpan.textContent) : '';
        enhanceA11y(row, label ? `${label} 관련 운동 보기` : undefined);
      });
    });
  }

  function findFreqRow(container, target) {
    const wrap = container.querySelector && container.querySelector('.muscle-card');
    if (!wrap) return null;
    let node = target;
    while (node && node !== container) {
      if (node.parentNode === wrap) return node;
      node = node.parentNode;
    }
    return null;
  }

  function activateFreqListRow(row) {
    const firstSpan = row.children && row.children[0];
    const muscleKey = findMuscleKeyByLabel(firstSpan ? firstSpan.textContent : '');
    const stim = getStim();
    if (muscleKey && stim && typeof stim.openMuscle === 'function') {
      stim.openMuscle(muscleKey);
    }
  }

  function onFreqListClick(e) {
    const container = document.getElementById('freqList');
    if (!container) return;
    const row = findFreqRow(container, e.target);
    if (!row) return;
    activateFreqListRow(row);
  }

  function onFreqListKeydown(e) {
    if (!isActivateKey(e)) return;
    const container = document.getElementById('freqList');
    if (!container) return;
    const row = findFreqRow(container, e.target);
    if (!row) return;
    e.preventDefault && e.preventDefault();
    activateFreqListRow(row);
  }

  // ------------------------------------------------------------
  // 통계 "🏆 개인 기록 (PR)" (#prList)
  // 운동 카드를 탭하면 그 운동의 기록 추이(무게/e1RM 그래프) 시트를 보여준다
  // (PrTrendDetail 모듈, 자극 부위 히트맵은 그 시트 내 보조 버튼으로 이동).
  // PrTrendDetail이 로드되지 않은 경우에만 기존 자극 부위 미리보기로 폴백한다.
  // ------------------------------------------------------------
  function enhancePrListCards() {
    const container = document.getElementById('prList');
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll('.muscle-card').forEach((card) => {
      const nameEl = card.querySelector && card.querySelector('.mc-name');
      const label = nameEl ? normalizeText(nameEl.textContent) : '';
      enhanceA11y(card, label ? `${label} 기록 추이 보기` : undefined);
    });
  }

  function activatePrListCard(card) {
    const nameEl = card.querySelector && card.querySelector('.mc-name');
    const name = normalizeText(nameEl ? nameEl.textContent : '');
    if (!name) return;

    if (typeof PrTrendDetail !== 'undefined' && typeof PrTrendDetail.open === 'function') {
      PrTrendDetail.open(name);
      return;
    }

    const stim = getStim();
    if (stim && typeof stim.openExercise === 'function') {
      stim.openExercise(name, { showAdd: false });
    }
  }

  function onPrListClick(e) {
    const card = e.target && e.target.closest ? e.target.closest('.muscle-card') : null;
    if (!card) return;
    activatePrListCard(card);
  }

  function onPrListKeydown(e) {
    if (!isActivateKey(e)) return;
    const card = e.target && e.target.closest ? e.target.closest('.muscle-card') : null;
    if (!card) return;
    e.preventDefault && e.preventDefault();
    activatePrListCard(card);
  }

  // ------------------------------------------------------------
  // 컨테이너별 훅: 클릭/키보드 위임은 컨테이너당 1회만 등록(재렌더에도 유지).
  // 리스트는 innerHTML 통째 교체 방식이라, MutationObserver로 재렌더될 때마다
  // 새 카드에 a11y 속성(role/tabindex)을 다시 붙여준다
  // (exerciseStimHeatmap.js의 exPickerList MutationObserver와 동일한 관례).
  // ------------------------------------------------------------
  function hookContainer(id, enhanceFn, onClick, onKeydown) {
    const container = document.getElementById(id);
    if (!container) return false;

    registry[id] = registry[id] || { hooked: false, observer: null };
    enhanceFn();

    if (registry[id].hooked) return true;
    registry[id].hooked = true;

    container.addEventListener('click', onClick);
    container.addEventListener('keydown', onKeydown);

    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => enhanceFn());
      observer.observe(container, { childList: true, subtree: true });
      registry[id].observer = observer;
    }
    return true;
  }

  function init() {
    ensureStyles();
    hookContainer('muscleList', enhanceMuscleListCards, onMuscleListClick, onMuscleListKeydown);
    hookContainer('freqList', enhanceFreqListRows, onFreqListClick, onFreqListKeydown);
    hookContainer('prList', enhancePrListCards, onPrListClick, onPrListKeydown);
  }

  return {
    init,
    ensureStyles,
    findMuscleKeyByLabel,
    activateMuscleListCard,
    activateFreqListRow,
    activatePrListCard,
  };
})();

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ListQuickActions.init());
  } else {
    ListQuickActions.init();
  }
}
