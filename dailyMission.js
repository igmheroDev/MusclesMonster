// ============================================================
// DailyMission — 데일리 미션 시스템
// 설정의 목표·현재 상태·부상 메모를 반영해 홈트/재활/체중감량 미션을 제공합니다.
// 완료 시 캘린더에 도장(스탬프) 기록
// ============================================================

const DailyMission = (() => {
  const STORAGE_KEY = 'recovr_daily_missions_v1';
  const MISSIONS_PER_DAY = 3;

  const PROFILE_META = {
    general: {
      label: '일반 홈트',
      icon: '📋',
      safetyNote: '',
      seedOffset: 11,
    },
    cervical_disc: {
      label: '목디스크·목 통증 주의',
      icon: '🧣',
      safetyNote: '목/팔 저림, 통증, 어지러움이 있으면 즉시 중단하고 의료진 지시를 우선하세요.',
      seedOffset: 101,
    },
    lumbar_disc: {
      label: '허리디스크·허리 통증 주의',
      icon: '🧘',
      safetyNote: '허리·다리 방사통, 저림, 통증이 있으면 중단하세요. 구부림/비틀림/점프 동작은 피합니다.',
      seedOffset: 211,
    },
    rehab_general: {
      label: '재활·회복 운동',
      icon: '🩹',
      safetyNote: '통증 없는 범위에서 천천히 진행하세요. 치료 중이면 담당 의료진 지시를 우선합니다.',
      seedOffset: 307,
    },
    fat_loss: {
      label: '체중감량·저충격',
      icon: '🔥',
      safetyNote: '숨은 차지만 대화가 가능한 강도로 진행하세요. 무릎/허리가 불편하면 충격 동작을 줄입니다.',
      seedOffset: 401,
    },
  };

  // ── 미션 풀 (홈트레이닝 가능한 운동) ──────────────────────
  const MISSION_POOL = [
    // 일반 홈트
    { id: 'pushup_10',           name: '푸시업',              target: 10, unit: '개',  icon: '💪', difficulty: 1, profiles: ['general'] },
    { id: 'pushup_20',           name: '푸시업',              target: 20, unit: '개',  icon: '💪', difficulty: 2, profiles: ['general'] },
    { id: 'squat_20',            name: '스쿼트',              target: 20, unit: '개',  icon: '🦵', difficulty: 1, profiles: ['general', 'fat_loss'] },
    { id: 'squat_30',            name: '스쿼트',              target: 30, unit: '개',  icon: '🦵', difficulty: 2, profiles: ['general', 'fat_loss'] },
    { id: 'burpee_10',           name: '버피테스트',          target: 10, unit: '개',  icon: '🔥', difficulty: 2, profiles: ['general'] },
    { id: 'burpee_20',           name: '버피테스트',          target: 20, unit: '개',  icon: '🔥', difficulty: 3, profiles: ['general'] },
    { id: 'plank_30',            name: '플랭크',              target: 30, unit: '초',  icon: '⚡', difficulty: 1, profiles: ['general'] },
    { id: 'plank_60',            name: '플랭크',              target: 60, unit: '초',  icon: '⚡', difficulty: 2, profiles: ['general'] },
    { id: 'lunge_20',            name: '런지',                target: 20, unit: '개',  icon: '🦵', difficulty: 1, profiles: ['general'] },
    { id: 'lunge_30',            name: '런지',                target: 30, unit: '개',  icon: '🦵', difficulty: 2, profiles: ['general'] },
    { id: 'jumping_jack_30',     name: '점핑잭',              target: 30, unit: '개',  icon: '⭐', difficulty: 1, profiles: ['general'] },
    { id: 'jumping_jack_50',     name: '점핑잭',              target: 50, unit: '개',  icon: '⭐', difficulty: 2, profiles: ['general'] },
    { id: 'mountain_climber_20', name: '마운틴 클라이머',    target: 20, unit: '개',  icon: '🏔️', difficulty: 2, profiles: ['general'] },
    { id: 'situp_15',            name: '싯업',                target: 15, unit: '개',  icon: '🔶', difficulty: 1, profiles: ['general'] },
    { id: 'situp_25',            name: '싯업',                target: 25, unit: '개',  icon: '🔶', difficulty: 2, profiles: ['general'] },
    { id: 'high_knee_30',        name: '하이니',              target: 30, unit: '개',  icon: '🏃', difficulty: 1, profiles: ['general'] },
    { id: 'glute_bridge_15',     name: '글루트 브릿지',      target: 15, unit: '개',  icon: '🍑', difficulty: 1, profiles: ['general', 'lumbar_disc', 'rehab_general', 'fat_loss'] },
    { id: 'glute_bridge_25',     name: '글루트 브릿지',      target: 25, unit: '개',  icon: '🍑', difficulty: 2, profiles: ['general', 'fat_loss'] },
    { id: 'tricep_dip_10',       name: '의자 딥스',           target: 10, unit: '개',  icon: '💪', difficulty: 2, profiles: ['general'] },
    { id: 'calf_raise_30',       name: '카프레이즈',          target: 30, unit: '개',  icon: '🦶', difficulty: 1, profiles: ['general', 'rehab_general', 'fat_loss'] },
    { id: 'dead_bug_10',         name: '데드버그',            target: 10, unit: '개',  icon: '🐛', difficulty: 1, profiles: ['general', 'lumbar_disc', 'rehab_general'] },
    { id: 'russian_twist_20',    name: '러시안 트위스트',    target: 20, unit: '개',  icon: '🌀', difficulty: 2, profiles: ['general'] },
    { id: 'superman_10',         name: '슈퍼맨',              target: 10, unit: '개',  icon: '🦸', difficulty: 1, profiles: ['general'] },
    { id: 'side_plank_20',       name: '사이드 플랭크',      target: 20, unit: '초',  icon: '⚡', difficulty: 2, profiles: ['general'] },
    { id: 'walkout_8',           name: '월크아웃',            target: 8,  unit: '개',  icon: '🚶', difficulty: 2, profiles: ['general'] },
    { id: 'leg_raise_15',        name: '레그레이즈',          target: 15, unit: '개',  icon: '🔶', difficulty: 2, profiles: ['general'] },
    { id: 'diamond_pushup_8',    name: '다이아몬드 푸시업',  target: 8,  unit: '개',  icon: '💎', difficulty: 3, profiles: ['general'] },
    { id: 'jump_squat_15',       name: '점프 스쿼트',         target: 15, unit: '개',  icon: '🦵', difficulty: 3, profiles: ['general'] },
    { id: 'inchworm_8',          name: '인치웜',              target: 8,  unit: '개',  icon: '🐛', difficulty: 2, profiles: ['general'] },
    { id: 'wall_sit_30',         name: '월싯',                target: 30, unit: '초',  icon: '🦵', difficulty: 2, profiles: ['general', 'fat_loss'] },

    // 목디스크·목 통증 주의
    { id: 'chin_tuck_8',         name: '턱 당기기',           target: 8,  unit: '회',  icon: '🧣', difficulty: 1, profiles: ['cervical_disc', 'rehab_general'] },
    { id: 'neck_isometric_5',    name: '목 등척성 버티기',    target: 5,  unit: '초×4방향', icon: '🧣', difficulty: 1, profiles: ['cervical_disc'] },
    { id: 'scapular_squeeze_12', name: '견갑 조이기',         target: 12, unit: '회',  icon: '🪽', difficulty: 1, profiles: ['cervical_disc', 'rehab_general'] },
    { id: 'wall_slide_10',       name: '벽 슬라이드',          target: 10, unit: '회',  icon: '🧱', difficulty: 1, profiles: ['cervical_disc', 'rehab_general'] },
    { id: 'shoulder_roll_10',    name: '어깨 돌리기',          target: 10, unit: '회',  icon: '🟡', difficulty: 1, profiles: ['cervical_disc', 'rehab_general'] },
    { id: 'chest_open_20',       name: '가슴 열기 스트레칭',   target: 20, unit: '초',  icon: '🫁', difficulty: 1, profiles: ['cervical_disc', 'rehab_general'] },
    { id: 'breathing_60',        name: '복식호흡',             target: 60, unit: '초',  icon: '🌬️', difficulty: 1, profiles: ['cervical_disc', 'lumbar_disc', 'rehab_general'] },

    // 허리디스크·허리 통증 주의
    { id: 'pelvic_tilt_10',      name: '골반 기울이기',        target: 10, unit: '회',  icon: '🧘', difficulty: 1, profiles: ['lumbar_disc', 'rehab_general'] },
    { id: 'bird_dog_8',          name: '버드독',               target: 8,  unit: '회',  icon: '🐦', difficulty: 1, profiles: ['lumbar_disc', 'rehab_general'] },
    { id: 'cat_cow_8',           name: '캣카우',               target: 8,  unit: '회',  icon: '🐈', difficulty: 1, profiles: ['lumbar_disc', 'rehab_general'] },
    { id: 'knee_to_chest_20',    name: '한쪽 무릎 당기기',     target: 20, unit: '초',  icon: '🦵', difficulty: 1, profiles: ['lumbar_disc'] },
    { id: 'heel_slide_10',       name: '힐 슬라이드',          target: 10, unit: '회',  icon: '🦶', difficulty: 1, profiles: ['lumbar_disc', 'rehab_general'] },
    { id: 'hip_hinge_8',         name: '힙힌지 연습',          target: 8,  unit: '회',  icon: '🍑', difficulty: 1, profiles: ['lumbar_disc'] },

    // 재활·체중감량 공용 저충격
    { id: 'walk_5min',           name: '가볍게 걷기',          target: 5,  unit: '분',  icon: '🚶', difficulty: 1, profiles: ['cervical_disc', 'lumbar_disc', 'rehab_general', 'fat_loss'] },
    { id: 'walk_10min',          name: '가볍게 걷기',          target: 10, unit: '분',  icon: '🚶', difficulty: 1, profiles: ['fat_loss'] },
    { id: 'sit_to_stand_8',      name: '의자 앉았다 일어나기', target: 8,  unit: '회',  icon: '🪑', difficulty: 1, profiles: ['rehab_general', 'fat_loss'] },
    { id: 'wall_pushup_8',       name: '벽 푸시업',            target: 8,  unit: '회',  icon: '🧱', difficulty: 1, profiles: ['rehab_general', 'fat_loss'] },
    { id: 'step_touch_40',       name: '스텝 터치',            target: 40, unit: '회',  icon: '👣', difficulty: 1, profiles: ['fat_loss'] },
    { id: 'march_in_place_60',   name: '제자리 걷기',          target: 60, unit: '초',  icon: '🚶', difficulty: 1, profiles: ['fat_loss', 'rehab_general'] },
    { id: 'low_impact_cardio_5', name: '저충격 유산소',        target: 5,  unit: '분',  icon: '🔥', difficulty: 2, profiles: ['fat_loss'] },
    { id: 'ankle_pump_20',       name: '발목 펌프',            target: 20, unit: '회',  icon: '🦶', difficulty: 1, profiles: ['rehab_general'] },
  ];

  const MISSION_SETS_BY_PROFILE = {
    general: [
      { name: '🌅 가벼운 시작',    missions: ['pushup_10', 'squat_20', 'plank_30'] },
      { name: '🔶 코어 집중',       missions: ['plank_60', 'situp_15', 'dead_bug_10'] },
      { name: '⭐ 전신 활성화',     missions: ['jumping_jack_30', 'lunge_20', 'glute_bridge_15'] },
      { name: '💪 상체 챌린지',     missions: ['pushup_20', 'tricep_dip_10', 'mountain_climber_20'] },
      { name: '🦵 하체 집중',       missions: ['squat_30', 'lunge_20', 'calf_raise_30'] },
      { name: '🔥 유산소 부스트',   missions: ['burpee_10', 'high_knee_30', 'jumping_jack_30'] },
      { name: '🏆 근지구력 도전',   missions: ['plank_60', 'pushup_20', 'burpee_10'] },
      { name: '🍑 하체 & 코어',     missions: ['glute_bridge_25', 'squat_30', 'russian_twist_20'] },
      { name: '🐛 스트레칭 & 코어', missions: ['superman_10', 'dead_bug_10', 'inchworm_8'] },
      { name: '🦸 전신 스트렝스',   missions: ['burpee_20', 'jump_squat_15', 'diamond_pushup_8'] },
      { name: '🧘 회복의 날',       missions: ['plank_30', 'glute_bridge_15', 'superman_10'] },
      { name: '💎 오늘의 챌린지',   missions: ['diamond_pushup_8', 'leg_raise_15', 'wall_sit_30'] },
      { name: '🚶 기능성 운동',     missions: ['walkout_8', 'inchworm_8', 'side_plank_20'] },
      { name: '🌀 코어 올인',       missions: ['russian_twist_20', 'leg_raise_15', 'situp_25'] },
    ],
    cervical_disc: [
      { name: '🧣 목 부담 낮추기',  missions: ['chin_tuck_8', 'scapular_squeeze_12', 'breathing_60'] },
      { name: '🪽 어깨 안정화',      missions: ['wall_slide_10', 'shoulder_roll_10', 'chest_open_20'] },
      { name: '🚶 목디스크 회복 루틴', missions: ['chin_tuck_8', 'walk_5min', 'scapular_squeeze_12'] },
      { name: '🌬️ 긴장 완화',        missions: ['breathing_60', 'chest_open_20', 'neck_isometric_5'] },
    ],
    lumbar_disc: [
      { name: '🧘 허리 안정화',      missions: ['pelvic_tilt_10', 'dead_bug_10', 'breathing_60'] },
      { name: '🐦 코어 재활',        missions: ['bird_dog_8', 'glute_bridge_15', 'cat_cow_8'] },
      { name: '🚶 허리 부담 낮추기', missions: ['walk_5min', 'heel_slide_10', 'pelvic_tilt_10'] },
      { name: '🍑 둔근 깨우기',      missions: ['glute_bridge_15', 'hip_hinge_8', 'knee_to_chest_20'] },
    ],
    rehab_general: [
      { name: '🩹 재활 시작',        missions: ['breathing_60', 'ankle_pump_20', 'walk_5min'] },
      { name: '🪑 기초 기능 회복',   missions: ['sit_to_stand_8', 'wall_pushup_8', 'calf_raise_30'] },
      { name: '🐈 부드러운 가동성',  missions: ['cat_cow_8', 'wall_slide_10', 'heel_slide_10'] },
      { name: '🪽 자세 안정화',      missions: ['scapular_squeeze_12', 'dead_bug_10', 'breathing_60'] },
    ],
    fat_loss: [
      { name: '🔥 저충격 감량 시작', missions: ['walk_10min', 'step_touch_40', 'calf_raise_30'] },
      { name: '🚶 가벼운 유산소',    missions: ['march_in_place_60', 'sit_to_stand_8', 'wall_pushup_8'] },
      { name: '🦵 하체 순환',        missions: ['squat_20', 'glute_bridge_25', 'walk_10min'] },
      { name: '👣 땀 살짝 루틴',     missions: ['low_impact_cardio_5', 'step_touch_40', 'wall_sit_30'] },
    ],
  };

  function _seededRandom(seed) {
    const x = Math.sin(seed + 1) * 10000;
    return x - Math.floor(x);
  }

  function _dateToSeed(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return y * 10000 + m * 100 + d;
  }

  function _getMissionById(id) {
    return MISSION_POOL.find(m => m.id === id) || null;
  }

  function _loadSettings() {
    try {
      return typeof loadSettings === 'function' ? loadSettings() : {};
    } catch (_) {
      return {};
    }
  }

  function _normalizeProfile(profile) {
    if (typeof UserProfile !== 'undefined' && typeof UserProfile.normalize === 'function') {
      return UserProfile.normalize(profile);
    }
    return profile && typeof profile === 'object' ? profile : {};
  }

  function _detectProfileKey() {
    const settings = _loadSettings();
    const profile = _normalizeProfile(settings.profile);
    const condition = profile.condition || 'none';
    const goal = profile.goal || '';
    const memo = String(profile.injuryNotes || '').toLowerCase();

    if (condition && condition !== 'none') return condition;
    if (/목|경추|거북목|일자목|cervical|neck/.test(memo)) return 'cervical_disc';
    if (/허리|요추|좌골|디스크|협착|lumbar|back|sciatica/.test(memo)) return 'lumbar_disc';
    if (goal === 'rehab') return 'rehab_general';
    if (goal === 'fat_loss') return 'fat_loss';

    return 'general';
  }

  function _getContext(profileKey) {
    const key = PROFILE_META[profileKey] ? profileKey : 'general';
    return { key, ...PROFILE_META[key] };
  }

  function _generateDailySet(dateStr, profileKey) {
    const context = _getContext(profileKey || _detectProfileKey());
    const sets = MISSION_SETS_BY_PROFILE[context.key] || MISSION_SETS_BY_PROFILE.general;
    const seed = _dateToSeed(dateStr);
    const setIdx = Math.floor(_seededRandom(seed * 37 + context.seedOffset) * sets.length);
    return { ...sets[setIdx], profileKey: context.key };
  }

  function _getCurrentMissionIds(dateStr) {
    return _generateDailySet(dateStr).missions;
  }

  function _sameMissionIds(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((id, idx) => id === b[idx]);
  }

  function _alignRecordForCurrentMissions(dateStr, record) {
    const currentIds = _getCurrentMissionIds(dateStr);
    if (record.stamp === true) return record;
    if (record.missionIds && !_sameMissionIds(record.missionIds, currentIds)) {
      return {
        ...record,
        completed: record.completed.filter(id => currentIds.includes(id)),
        missionIds: currentIds,
        profileKey: _detectProfileKey(),
      };
    }
    return {
      ...record,
      missionIds: record.missionIds || currentIds,
      profileKey: record.profileKey || _detectProfileKey(),
    };
  }

  function _loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function _saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function _normalizeDayRecord(raw) {
    if (Array.isArray(raw)) {
      return {
        completed: raw,
        missionIds: null,
        profileKey: null,
        stamp: false,
        legacy: true,
      };
    }
    if (raw && typeof raw === 'object') {
      return {
        completed: Array.isArray(raw.completed) ? raw.completed : [],
        missionIds: Array.isArray(raw.missionIds) ? raw.missionIds : null,
        profileKey: raw.profileKey || null,
        stamp: raw.stamp === true,
        completedAt: raw.completedAt || null,
        legacy: false,
      };
    }
    return { completed: [], missionIds: null, profileKey: null, stamp: false, legacy: false };
  }

  function _getDayRecord(data, dateStr) {
    return _normalizeDayRecord(data[dateStr]);
  }

  function _getRequiredMissionIds(dateStr, record) {
    return record.missionIds || _getCurrentMissionIds(dateStr);
  }

  function _isRecordCompleted(dateStr, record) {
    const required = _getRequiredMissionIds(dateStr, record);
    if (!required.length) return false;
    return required.every(id => record.completed.includes(id));
  }

  function _saveDayRecord(data, dateStr, record) {
    data[dateStr] = {
      completed: [...new Set(record.completed)],
      missionIds: record.missionIds || _getCurrentMissionIds(dateStr),
      profileKey: record.profileKey || _detectProfileKey(),
      stamp: record.stamp === true || _isRecordCompleted(dateStr, record),
      completedAt: record.completedAt || (_isRecordCompleted(dateStr, record) ? new Date().toISOString() : null),
    };
  }

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

  function getMissionContext() {
    return _getContext(_detectProfileKey());
  }

  function getCompletedForDate(dateStr) {
    const data = _loadData();
    const record = _alignRecordForCurrentMissions(dateStr, _getDayRecord(data, dateStr));
    return record.completed;
  }

  function toggleMission(dateStr, missionId) {
    const data = _loadData();
    const record = _alignRecordForCurrentMissions(dateStr, _getDayRecord(data, dateStr));

    const idx = record.completed.indexOf(missionId);
    if (idx >= 0) {
      record.completed.splice(idx, 1);
      record.stamp = false;
      record.completedAt = null;
    } else {
      record.completed.push(missionId);
    }

    if (_isRecordCompleted(dateStr, record)) {
      record.stamp = true;
      record.completedAt = record.completedAt || new Date().toISOString();
    }

    _saveDayRecord(data, dateStr, record);
    _saveData(data);
    return record.completed.includes(missionId);
  }

  function isDayCompleted(dateStr) {
    const data = _loadData();
    const record = _getDayRecord(data, dateStr);
    return record.stamp === true || _isRecordCompleted(dateStr, record);
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

  function _todayStr() {
    return _formatDateObj(new Date());
  }

  function _formatDateObj(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

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
    const context = getMissionContext();

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
            <div class="dm-header-icon">${allDone ? '🏆' : context.icon}</div>
            <div>
              <div class="dm-title">오늘의 데일리 미션</div>
              <div class="dm-set-name">${setName}</div>
            </div>
          </div>
          <div class="dm-progress-badge">${completedCount}/${missions.length}</div>
        </div>

        <div class="dm-profile-chip">${context.icon} ${context.label}</div>
        ${context.safetyNote ? `<div class="dm-safety-note">${context.safetyNote}</div>` : ''}

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
    getTodayMissions,
    getMissionsForDate,
    getSetNameForDate,
    getMissionContext,
    getCompletedForDate,
    toggleMission,
    isDayCompleted,
    getStampedDates,
    getMissionStreak,
    getTotalStamps,
    renderHomeCard,
    onMissionTap,
  };
})();
