// ============================================================
// RECOVR - 운동 ↔ 근육 자극 매핑 (독립 모듈)
// 기존 getMusclesFromExerciseName 을 참조만 하고 수정하지 않음
// intensity: 3=주자극, 2=보조, 1=협응
// ============================================================

const ExerciseMuscleMap = (() => {
  const LEVEL = { primary: 3, secondary: 2, assist: 1 };
  const LEVEL_LABELS = {
    3: '주자극',
    2: '보조',
    1: '협응',
  };

  // 자주 쓰는 운동의 명시적 자극 프로필 (이름 정규화 전 원문 키)
  const STIM_PROFILES = {
    // 가슴
    '벤치 프레스': { chest: 3, triceps: 2, shoulder: 2 },
    '인클라인 벤치 프레스': { chest: 3, shoulder: 2, triceps: 2 },
    '디클라인 벤치 프레스': { chest: 3, triceps: 2, shoulder: 1 },
    '덤벨 벤치 프레스': { chest: 3, triceps: 2, shoulder: 2 },
    '덤벨 인클라인 프레스': { chest: 3, shoulder: 2, triceps: 2 },
    '체스트 프레스 머신': { chest: 3, triceps: 2, shoulder: 1 },
    '펙덱 플라이': { chest: 3, shoulder: 1 },
    '케이블 플라이': { chest: 3, shoulder: 1 },
    '케이블 크로스오버': { chest: 3, shoulder: 1 },
    '케이블 체스트 플라이': { chest: 3, shoulder: 1 },
    '스미스 머신 벤치 프레스': { chest: 3, triceps: 2, shoulder: 2 },
    '딥스': { chest: 3, triceps: 3, shoulder: 2 },
    '맨몸 딥스': { chest: 3, triceps: 3, shoulder: 2 },
    '링 딥스': { chest: 3, triceps: 3, shoulder: 2, core: 1 },
    '체스트 딥스': { chest: 3, triceps: 2, shoulder: 2 },
    '푸시업': { chest: 3, triceps: 2, shoulder: 2, core: 1 },
    '와이드 푸시업': { chest: 3, shoulder: 2, triceps: 1, core: 1 },

    // 등
    '랫 풀다운': { back: 3, biceps: 2, forearms: 1 },
    '풀업': { back: 3, biceps: 2, forearms: 2, core: 1 },
    '맨몸 턱걸이': { back: 3, biceps: 2, forearms: 2 },
    '어시스트 풀업': { back: 3, biceps: 2, forearms: 1 },
    '시티드 케이블 로우': { back: 3, biceps: 2, forearms: 1 },
    '벤트오버 바벨로우': { back: 3, biceps: 2, core: 1, hamstrings: 1 },
    '원암 덤벨 로우': { back: 3, biceps: 2, core: 1 },
    '데드리프트': { back: 3, hamstrings: 3, quads: 2, core: 2, forearms: 2 },
    '루마니안 데드리프트': { hamstrings: 3, back: 2, core: 2, forearms: 1 },
    '헥스 바 데드리프트': { quads: 3, hamstrings: 2, back: 2, core: 2 },
    '백 익스텐션': { back: 3, hamstrings: 2, core: 1 },
    'T바 로우': { back: 3, biceps: 2, core: 1 },
    '티바 로우': { back: 3, biceps: 2, core: 1 },
    '머신 로우': { back: 3, biceps: 2 },
    '체스트 서포티드 로우': { back: 3, biceps: 2 },
    '풀오버': { back: 3, chest: 2, core: 1 },
    '인버티드 로우': { back: 3, biceps: 2, core: 1 },
    '하이로우 머신': { back: 3, biceps: 2 },
    '스트레이트 암 풀다운': { back: 3, core: 1 },

    // 어깨
    '숄더 프레스 머신': { shoulder: 3, triceps: 2 },
    '덤벨 숄더 프레스': { shoulder: 3, triceps: 2, core: 1 },
    '오버헤드 프레스': { shoulder: 3, triceps: 2, core: 2 },
    '바벨 밀리터리 프레스': { shoulder: 3, triceps: 2, core: 2 },
    '아놀드 프레스': { shoulder: 3, triceps: 2 },
    '덤벨 사이드 레터럴 레이즈': { shoulder: 3 },
    '케이블 레터럴 레이즈': { shoulder: 3 },
    '프론트 레이즈': { shoulder: 3 },
    '리어 델트 플라이': { shoulder: 3, back: 1 },
    '리어 델트 머신': { shoulder: 3 },
    '페이스 풀': { shoulder: 3, back: 2 },
    '케이블 페이스 풀': { shoulder: 3, back: 2 },
    '업라이트 로우': { shoulder: 3, biceps: 1 },
    'W레이즈': { shoulder: 3, back: 1 },

    // 이두
    '바벨 컬': { biceps: 3, forearms: 2 },
    '덤벨 컬': { biceps: 3, forearms: 1 },
    '해머 컬': { biceps: 3, forearms: 2 },
    '케이블 컬': { biceps: 3, forearms: 1 },
    '프리처 컬': { biceps: 3 },
    '인클라인 덤벨 컬': { biceps: 3 },
    '컨센트레이션 컬': { biceps: 3 },
    '크로스바디 해머컬': { biceps: 3, forearms: 2 },
    '스파이더 컬': { biceps: 3 },

    // 삼두
    '로프 트라이셉스 푸시다운': { triceps: 3 },
    '오버헤드 트라이셉스 익스텐션': { triceps: 3 },
    '스컬크러셔': { triceps: 3 },
    '클로즈그립 벤치프레스': { triceps: 3, chest: 2, shoulder: 1 },
    '딥 머신': { triceps: 3, chest: 2 },
    '로프 암 풀다운': { triceps: 3 },
    '케이블 오버헤드 익스텐션': { triceps: 3 },

    // 하체
    '스쿼트': { quads: 3, hamstrings: 2, core: 2, calves: 1 },
    '바벨 백 스쿼트': { quads: 3, hamstrings: 2, core: 2, calves: 1 },
    '프론트 스쿼트': { quads: 3, core: 3, hamstrings: 1 },
    '스미스 머신 스쿼트': { quads: 3, hamstrings: 2, core: 1 },
    '핵 스쿼트': { quads: 3, hamstrings: 1 },
    '레그프레스': { quads: 3, hamstrings: 2 },
    '레그 익스텐션': { quads: 3 },
    '런지': { quads: 3, hamstrings: 2, core: 1 },
    '덤벨 런지': { quads: 3, hamstrings: 2, core: 1 },
    '불가리안 스플릿 스쿼트': { quads: 3, hamstrings: 2, core: 1 },
    '고블릿 스쿼트': { quads: 3, core: 2, hamstrings: 1 },
    '점프 스쿼트': { quads: 3, calves: 2, hamstrings: 1 },
    '박스 점프': { quads: 3, calves: 2, hamstrings: 1 },
    '월싯': { quads: 3, core: 1 },
    '스텝업': { quads: 3, hamstrings: 2 },
    '워킹 런지': { quads: 3, hamstrings: 2, core: 1 },
    '리버스 런지': { quads: 3, hamstrings: 2 },
    '시저 런지': { quads: 3, hamstrings: 2 },

    '레그컬': { hamstrings: 3 },
    '시티드 레그컬': { hamstrings: 3 },
    '라잉 레그컬': { hamstrings: 3 },
    '힙 쓰러스트': { hamstrings: 3, core: 1 },
    '바벨 힙 쓰러스트': { hamstrings: 3, core: 1 },
    '힙 쓰러스트 머신': { hamstrings: 3 },
    '글루트 브릿지': { hamstrings: 3, core: 1 },
    '케틀벨 스윙': { hamstrings: 3, core: 2, back: 1, shoulder: 1 },
    '굿모닝': { hamstrings: 3, back: 2, core: 2 },
    '백 런지': { quads: 2, hamstrings: 3 },
    'RDL': { hamstrings: 3, back: 2, core: 2 },
    '싱글 레그 데드리프트': { hamstrings: 3, core: 2 },
    '케이블 킥백': { hamstrings: 3 },
    '글루트 킥백 머신': { hamstrings: 3 },
    '노르딕 컬': { hamstrings: 3 },

    '힙 어덕션 머신': { adductors: 3 },
    '힙 어브덕션 머신': { adductors: 3 },
    '이너 타이': { adductors: 3 },
    '아웃 타이': { adductors: 3 },
    '코펜하겐 플랭크': { adductors: 3, core: 2 },

    '스탠딩 카프레이즈': { calves: 3 },
    '시티드 카프레이즈': { calves: 3 },
    '레그프레스 카프레이즈': { calves: 3 },
    '동키 카프레이즈': { calves: 3 },
    '싱글 레그 카프레이즈': { calves: 3 },

    // 코어
    '플랭크': { core: 3, shoulder: 1 },
    '사이드 플랭크': { core: 3, shoulder: 1 },
    '크런치': { core: 3 },
    '레그레이즈': { core: 3 },
    '행잉 레그레이즈': { core: 3, forearms: 1 },
    '러시안 트위스트': { core: 3 },
    '싯업': { core: 3 },
    '케이블 크런치': { core: 3 },
    '에이비 휠': { core: 3, shoulder: 1 },
    'TRX 파이크': { core: 3, shoulder: 2 },
    '드래곤 플래그': { core: 3 },
    '케이블 우드찹': { core: 3, shoulder: 1 },
    '토 투 바': { core: 3, forearms: 1 },
    'V싯업': { core: 3 },
    '행잉 니 레이즈': { core: 3, forearms: 1 },
    '마운틴 클라이머': { core: 3, shoulder: 1 },
    '데드버그': { core: 3 },

    // 전완
    '리스트 컬': { forearms: 3 },
    '파머스 워크': { forearms: 3, core: 2, shoulder: 1 },
    '리버스 리스트 컬': { forearms: 3 },
    '바 행잉': { forearms: 3, back: 1 },
  };

  function normalizeKey(name) {
    if (typeof normalizeExerciseName === 'function') {
      return normalizeExerciseName(name);
    }
    return String(name || '').toLowerCase().replace(/\s+/g, '');
  }

  // 정규화 키 → 프로필 룩업 테이블
  const PROFILE_BY_NORM = {};
  Object.keys(STIM_PROFILES).forEach((name) => {
    PROFILE_BY_NORM[normalizeKey(name)] = STIM_PROFILES[name];
  });

  function cleanProfile(profile) {
    const out = {};
    Object.keys(profile || {}).forEach((muscle) => {
      const level = Number(profile[muscle]);
      if (level > 0 && level <= 3) out[muscle] = level;
    });
    return out;
  }

  function fallbackFromKeywords(name) {
    const muscles = typeof getMusclesFromExerciseName === 'function'
      ? getMusclesFromExerciseName(name)
      : [];
    if (!muscles.length) return {};
    const out = {};
    muscles.forEach((m, idx) => {
      out[m] = idx === 0 ? LEVEL.primary : LEVEL.secondary;
    });
    return out;
  }

  /** @returns {Record<string, number>} muscle → intensity 1~3 */
  function getStimulation(name) {
    if (!name) return {};
    const direct = STIM_PROFILES[name];
    if (direct) return cleanProfile(direct);
    const byNorm = PROFILE_BY_NORM[normalizeKey(name)];
    if (byNorm) return cleanProfile(byNorm);
    return fallbackFromKeywords(name);
  }

  function getStimulationEntries(name) {
    const stim = getStimulation(name);
    return Object.keys(stim)
      .map((muscle) => ({
        muscle,
        level: stim[muscle],
        levelLabel: LEVEL_LABELS[stim[muscle]] || '',
        label: (typeof MUSCLE_LABELS !== 'undefined' && MUSCLE_LABELS[muscle])
          ? MUSCLE_LABELS[muscle].name
          : muscle,
        icon: (typeof MUSCLE_LABELS !== 'undefined' && MUSCLE_LABELS[muscle])
          ? MUSCLE_LABELS[muscle].icon
          : '🎯',
      }))
      .sort((a, b) => b.level - a.level || a.label.localeCompare(b.label, 'ko'));
  }

  function getCatalogNames() {
    if (typeof getAllExerciseNames === 'function') return getAllExerciseNames();
    if (typeof COMMON_EXERCISES !== 'undefined') return [...COMMON_EXERCISES];
    return Object.keys(STIM_PROFILES);
  }

  /**
   * 특정 근육을 자극하는 운동 목록
   * @returns {{ name: string, level: number, levelLabel: string, stim: Record<string,number> }[]}
   */
  function getExercisesForMuscle(muscleKey, options = {}) {
    if (!muscleKey) return [];
    const minLevel = options.minLevel || 1;
    const limit = options.limit || 40;
    const names = getCatalogNames();
    const results = [];

    names.forEach((name) => {
      const stim = getStimulation(name);
      const level = stim[muscleKey];
      if (!level || level < minLevel) return;
      // 유산소/모빌리티만 매칭되면 스킵 (근력 자극 탐색용)
      const activities = typeof getActivityTagsFromExerciseName === 'function'
        ? getActivityTagsFromExerciseName(name)
        : [];
      const hasMuscle = Object.keys(stim).length > 0;
      if (!hasMuscle && activities.length) return;

      results.push({
        name,
        level,
        levelLabel: LEVEL_LABELS[level] || '',
        stim,
      });
    });

    results.sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return a.name.localeCompare(b.name, 'ko');
    });

    // 동일 정규화명 중복 제거
    const seen = new Set();
    const unique = [];
    for (const item of results) {
      const key = normalizeKey(item.name);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
      if (unique.length >= limit) break;
    }
    return unique;
  }

  function getLevelColor(level) {
    if (level >= 3) return 'var(--red)';
    if (level >= 2) return 'var(--orange)';
    if (level >= 1) return 'var(--yellow)';
    return 'transparent';
  }

  function getLevelOpacity(level) {
    if (level >= 3) return 0.72;
    if (level >= 2) return 0.48;
    if (level >= 1) return 0.28;
    return 0;
  }

  return {
    LEVEL,
    LEVEL_LABELS,
    STIM_PROFILES,
    getStimulation,
    getStimulationEntries,
    getExercisesForMuscle,
    getLevelColor,
    getLevelOpacity,
    getCatalogNames,
  };
})();
