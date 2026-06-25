// ============================================================
// DailyMission — 데일리 미션 시스템
// 홈에서 가지 않아도 되는 가벼운 미션 제공 (집에서 가능)
// 완료 시 캘린더에 도장(스탬프) 기록
// ============================================================

const DailyMission = (() => {
  const STORAGE_KEY = 'recovr_daily_missions_v1';
  const MISSIONS_PER_DAY = 3;

  // ── 미션 풀 (홈트레이닝 가능한 운동만) ──────────────────────
  const MISSION_POOL = [
    { id: 'pushup_10',           name: '푸시업',           target: 10, unit: '개',  icon: '💪', difficulty: 1 },
    { id: 'pushup_20',           name: '푸시업',           target: 20, unit: '개',  icon: '💪', difficulty: 2 },
    { id: 'squat_20',            name: '스쿼트',           target: 20, unit: '개',  icon: '🦵', difficulty: 1 },
    { id: 'squat_30',            name: '스쿼트',           target: 30, unit: '개',  icon: '🦵', difficulty: 2 },
    { id: 'burpee_10',           name: '버피테스트',       target: 10, unit: '개',  icon: '🔥', difficulty: 2 },
    { id: 'burpee_20',           name: '버피테스트',       target: 20, unit: '개',  icon: '🔥', difficulty: 3 },
    { id: 'plank_30',            name: '플랭크',           target: 30, unit: '초',  icon: '⚡', difficulty: 1 },
    { id: 'plank_60',            name: '플랭크',           target: 60, unit: '초',  icon: '⚡', difficulty: 2 },
    { id: 'lunge_20',            name: '런지',             target: 20, unit: '개',  icon: '🦵', difficulty: 1 },
    { id: 'lunge_30',            name: '런지',             target: 30, unit: '개',  icon: '🦵', difficulty: 2 },
    { id: 'jumping_jack_30',     name: '점핑잭',           target: 30, unit: '개',  icon: '⭐', difficulty: 1 },
    { id: 'jumping_jack_50',     name: '점핑잭',           target: 50, unit: '개',  icon: '⭐', difficulty: 2 },
    { id: 'mountain_climber_20', name: '마운틴 클라이머', target: 20, unit: '개',  icon: '🏔️', difficulty: 2 },
    { id: 'situp_15',            name: '싯업',             target: 15, unit: '개',  icon: '🔶', difficulty: 1 },
    { id: 'situp_25',            name: '싯업',             target: 25, unit: '개',  icon: '🔶', difficulty: 2 },
    { id: 'high_knee_30',        name: '하이니',           target: 30, unit: '개',  icon: '🏃', difficulty: 1 },
    { id: 'glute_bridge_15',     name: '글루트 브릿지',   target: 15, unit: '개',  icon: '🍑', difficulty: 1 },
    { id: 'glute_bridge_25',     name: '글루트 브릿지',   target: 25, unit: '개',  icon: '🍑', difficulty: 2 },
    { id: 'tricep_dip_10',       name: '의자 딥스',        target: 10, unit: '개',  icon: '💪', difficulty: 2 },
    { id: 'calf_raise_30',       name: '카프레이즈',       target: 30, unit: '개',  icon: '🦶', difficulty: 1 },
    { id: 'dead_bug_10',         name: '데드버그',         target: 10, unit: '개',  icon: '🐛', difficulty: 1 },
    { id: 'russian_twist_20',    name: '러시안 트위스트', target: 20, unit: '개',  icon: '🌀', difficulty: 2 },
    { id: 'superman_10',         name: '슈퍼맨',           target: 10, unit: '개',  icon: '🦸', difficulty: 1 },
    { id: 'side_plank_20',       name: '사이드 플랭크',   target: 20, unit: '초',  icon: '⚡', difficulty: 2 },
    { id: 'walkout_8',           name: '월크아웃',         target: 8,  unit: '개',  icon: '🚶', difficulty: 2 },
    { id: 'leg_raise_15',        name: '레그레이즈',       target: 15, unit: '개',  icon: '🔶', difficulty: 2 },
    { id: 'diamond_pushup_8',    name: '다이아몬드 푸시업',target: 8,  unit: '개',  icon: '💎', difficulty: 3 },
    { id: 'jump_squat_15',       name: '점프 스쿼트',      target: 15, unit: '개',  icon: '🦵', difficulty: 3 },
    { id: 'inchworm_8',          name: '인치웜',           target: 8,  unit: '개',  icon: '🐛', difficulty: 2 },
    { id: 'wall_sit_30',         name: '월싯',             target: 30, unit: '초',  icon: '🦵', difficulty: 2 },
  ];

  // ── 미리 만들어진 미션 세트 ────────────────────────────────
  const MISSION_SETS = [
    { name: '🌅 가벼운 시작',   missions: ['pushup_10',       'squat_20',        'plank_30']          },
    { name: '🔶 코어 집중',      missions: ['plank_60',        'situp_15',        'dead_bug_10']       },
    { name: '⭐ 전신 활성화',    missions: ['jumping_jack_30', 'lunge_20',        'glute_bridge_15']   },
    { name: '💪 상체 챌린지',    missions: ['pushup_20',       'tricep_dip_10',   'mountain_climber_20'] },
    { name: '🦵 하체 집중',      missions: ['squat_30',        'lunge_20',        'calf_raise_30']     },
    { name: '🔥 유산소 부스트',  missions: ['burpee_10',       'high_knee_30',    'jumping_jack_30']   },
    { name: '🏆 근지구력 도전',  missions: ['plank_60',        'pushup_20',       'burpee_10']         },
    { name: '🍑 하체 & 코어',    missions: ['glute_bridge_25', 'squat_30',        'russian_twist_20']  },
    { name: '🐛 스트레칭 & 코어',missions: ['superman_10',     'dead_bug_10',     'inchworm_8']        },
    { name: '🦸 전신 스트렝스',  missions: ['burpee_20',       'jump_squat_15',   'diamond_pushup_8']  },
    { name: '🧘 회복의 날',      missions: ['plank_30',        'glute_bridge_15', 'superman_10']       },
    { name: '💎 오늘의 챌린지',  missions: ['diamond_pushup_8','leg_raise_15',    'wall_sit_30']       },
    { name: '🚶 기능성 운동',    missions: ['walkout_8',       'inchworm_8',      'side_plank_20']     },
    { name: '🌀 코어 올인',      missions: ['russian_twist_20','leg_raise_15',    'situp_25']          },
  ];

  // ── 날짜 기반 시드 랜덤 (같은 날은 항상 같은 미션) ───────
  function _seededRandom(seed) {
    const x = Math.sin(seed + 1) * 10000;
    return x - Math.floor(x);
  }

  function _dateToSeed(dateStr) {
    // "2026-06-25" → 2026*10000 + 6*100 + 25
    const [y, m, d] = dateStr.split('-').map(Number);
    return y * 10000 + m * 100 + d;
  }

  function _generateDailySet(dateStr) {
    const seed = _dateToSeed(dateStr);
    const setIdx = Math.floor(_seededRandom(seed * 37 + 11) * MISSION_SETS.length);
    return MISSION_SETS[setIdx];
  }

  function _getMissionById(id) {
    return MISSION_POOL.find(m => m.id === id) || null;
  }

  // ── 데이터 로드/저장 ───────────────────────────────────────
  function _loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function _saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // ── 공개 API ──────────────────────────────────────────────

  function getTodayMissions() {
    return getMissionsForDate(_todayStr());
  }

  function getMissionsForDate(dateStr) {
    const set = _generateDailySet(dateStr);
    return set.missions.map(_getMissionById).filter(Boolean);
  }

  function getSetNameForDate(dateStr) {
    return _generateDailySet(dateStr).name;
  }

  function getCompletedForDate(dateStr) {
    const data = _loadData();
    return data[dateStr] || [];
  }

  function toggleMission(dateStr, missionId) {
    const data = _loadData();
    if (!data[dateStr]) data[dateStr] = [];
    const idx = data[dateStr].indexOf(missionId);
    if (idx >= 0) {
      data[dateStr].splice(idx, 1);
    } else {
      data[dateStr].push(missionId);
    }
    _saveData(data);
    return data[dateStr].includes(missionId);
  }

  function isDayCompleted(dateStr) {
    const missions = getMissionsForDate(dateStr);
    if (missions.length === 0) return false;
    const completed = getCompletedForDate(dateStr);
    return missions.every(m => completed.includes(m.id));
  }

  function getStampedDates() {
    const data = _loadData();
    return Object.keys(data).filter(date => isDayCompleted(date));
  }

  function getMissionStreak() {
    const today = _todayStr();
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(12, 0, 0, 0);

    if (!isDayCompleted(today)) {
      cursor.setDate(cursor.getDate() - 1);
    }

    for (let i = 0; i < 365; i++) {
      const ds = _formatDateObj(cursor);
      if (!isDayCompleted(ds)) break;
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function getTotalStamps() {
    return getStampedDates().length;
  }

  // ── 내부 유틸 ─────────────────────────────────────────────
  function _todayStr() {
    return _formatDateObj(new Date());
  }

  function _formatDateObj(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // ── UI 렌더링 ─────────────────────────────────────────────
  function renderHomeCard() {
    const container = document.getElementById('dailyMissionCard');
    if (!container) return;

    const today = _todayStr();
    const missions = getTodayMissions();
    const completed = getCompletedForDate(today);
    const completedCount = missions.filter(m => completed.includes(m.id)).length;
    const allDone = completedCount === missions.length && missions.length > 0;
    const streak = getMissionStreak();
    const setName = getSetNameForDate(today);
    const totalStamps = getTotalStamps();

    const missionsHtml = missions.map(m => {
      const done = completed.includes(m.id);
      return `
        <div class="dm-mission-item${done ? ' done' : ''}"
             onclick="DailyMission.onMissionTap('${today}', '${m.id}')">
          <div class="dm-mission-check${done ? ' checked' : ''}">✓</div>
          <div class="dm-mission-info">
            <span class="dm-mission-icon">${m.icon}</span>
            <span class="dm-mission-name">${m.name}</span>
            <span class="dm-mission-target">${m.target}${m.unit}</span>
          </div>
        </div>`;
    }).join('');

    const progressPct = missions.length > 0 ? Math.round((completedCount / missions.length) * 100) : 0;

    container.innerHTML = `
      <div class="dm-card${allDone ? ' completed' : ''}">
        <div class="dm-header">
          <div class="dm-header-left">
            <div class="dm-header-icon">${allDone ? '🏆' : '📋'}</div>
            <div>
              <div class="dm-title">오늘의 데일리 미션</div>
              <div class="dm-set-name">${setName}</div>
            </div>
          </div>
          <div class="dm-progress-badge">${completedCount}/${missions.length}</div>
        </div>

        ${allDone ? `
          <div class="dm-completed-banner">
            <span>🎉 미션 완료! 오늘 도장을 획득했어요!</span>
            <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
              ${streak >= 2 ? `<span class="dm-streak-pill">🔥 ${streak}일 연속</span>` : ''}
              <span class="dm-total-pill">🎯 총 ${totalStamps}개</span>
            </div>
          </div>
        ` : ''}

        <div class="dm-missions-list">
          ${missionsHtml}
        </div>

        <div class="dm-bar-wrap">
          <div class="dm-bar" style="width:${progressPct}%"></div>
        </div>
        <div class="dm-bar-label">${progressPct}% 완료 · 캘린더에서 도장을 확인해보세요</div>
      </div>`;
  }

  function onMissionTap(dateStr, missionId) {
    toggleMission(dateStr, missionId);
    renderHomeCard();
    // 모두 완료됐으면 작은 피드백 효과
    if (isDayCompleted(dateStr)) {
      _flashCompleteEffect();
    }
  }

  function _flashCompleteEffect() {
    const card = document.querySelector('.dm-card');
    if (!card) return;
    card.style.transition = 'box-shadow 0.3s';
    card.style.boxShadow = '0 0 0 2px var(--yellow)';
    setTimeout(() => {
      card.style.boxShadow = '';
    }, 800);
  }

  return {
    // 데이터
    getTodayMissions,
    getMissionsForDate,
    getSetNameForDate,
    getCompletedForDate,
    toggleMission,
    isDayCompleted,
    getStampedDates,
    getMissionStreak,
    getTotalStamps,
    // UI
    renderHomeCard,
    onMissionTap,
  };
})();
