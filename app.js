// ============================================================
// RECOVR - 근육 회복 트래커
// 모든 계산은 로컬에서 수행됩니다. AI/외부 API 호출 없음.
// ============================================================

const STORAGE_KEY = 'recovr_workouts_v1';
const SETTINGS_KEY = 'recovr_settings_v1';

// ============================================================
// 운동명 → 부위 매핑 (키워드 기반 패턴 매칭)
// 정확한 운동명을 1000개 외울 필요 없이, 부위별 핵심 키워드와
// 기구/방식 키워드를 조합해 자동으로 부위를 인식합니다.
// 예: "덤벨 스쿼트", "바벨 스쿼트", "맨몸 스쿼트", "스미스 머신 스쿼트"
//     -> 전부 '스쿼트' 키워드가 포함되어 quads로 인식됨
// ============================================================

// 부위별 핵심 키워드 (운동 동작/부위명). 여기에 기구명을 붙여도
// 포함(includes) 매칭으로 잡힙니다.
const MUSCLE_KEYWORDS = {
  chest: [
    '벤치', '벤치프레스', '벤치 프레스', '체스트', '가슴', '펙', '딥스', '딥',
    '플라이', '플라이오', '체스트프레스', '인클라인', '디클라인', '플랫 프레스',
    '푸시업', '푸쉬업', '팔굽혀펴기', '체스트 플라이', '펙덱', '케이블 크로스',
    '크로스오버', '데클라인'
  ],
  back: [
    '랫풀', '랫 풀', '풀다운', '풀업', '턱걸이', '로우', '로잉', '바벨로우',
    '시티드로우', '시티드 로우', '케이블 로우', '원암 로우', '백 익스텐션',
    '데드리프트', '데드', '슈러그', '트랩', '광배근', '등',
    '슈퍼맨', '굿모닝', '벤트오버', '풀오버', '리버스 플라이',
    '하이로우', '로우풀', '인버티드 로우'
  ],
  shoulder: [
    '숄더', '어깨', '오버헤드', '밀리터리 프레스', '프레스업', '쇼울더',
    '레터럴', '레이즈', '레이즈업', '프론트 레이즈', '리어 델트', '아놀드 프레스',
    '업라이트', '페이스 풀', '숄더프레스', '쇼울더 프레스', '삼각근', '델트'
  ],
  biceps: [
    '컬', '바벨컬', '덤벨컬', '암컬', '이두', '이두근', '컨센트레이션',
    '해머컬', '프리처', '프리처컬', '케이블 컬', '스파이더 컬', '인클라인 컬',
    '리버스 컬', '21컬', '드래그컬', '바이셉'
  ],
  triceps: [
    '트라이셉스', '삼두', '삼두근', '익스텐션', '킥백', '오버헤드 익스텐션',
    '푸시다운', '푸쉬다운', '로프 푸시다운', '로프 익스텐션', '로프 풀다운',
    '암 풀다운', '로프 암 풀다운', '스컬크러셔', '클로즈그립', '클로즈그립 벤치',
    '딥 머신', '트라이셉 익스텐션', '오버헤드 트라이셉스'
  ],
  quads: [
    '스쿼트', '레그프레스', '레그 프레스', '레그익스텐션', '레그 익스텐션',
    '런지', '핵스쿼트', '핵 스쿼트', '와이드 스쿼트', '점프 스쿼트', '피스톨 스쿼트',
    '브이업', '대퇴사두', '벌크업 스쿼트', '점핑잭', '스플릿 스쿼트', '불가리안 스플릿',
    '실시드 스쿼트', '고블릿 스쿼트', '프론트 스쿼트', '백 스쿼트', '월싯', '스텝업'
  ],
  hamstrings: [
    '레그컬', '레그 컬', '햄스트링', '루마니안', '데드리프트', '굿모닝', '백런지',
    '글루트', '힙쓰러스트', '힙 쓰러스트', '브릿지', '글루트 브릿지', '둔근',
    '스티프 레그', '루마니안 데드리프트', 'rdl', '시티드 레그 컬', '라잉 레그컬',
    '케틀벨 스윙', '킥백', '도그', '버드독'
  ],
  adductors: [
    '어덕션', '어브덕션', '이너타이', '아웃타이', '이너 타이', '아웃 타이',
    '내전근', '외전근', '힙 어덕션', '힙 어브덕션', '인사이드 사이',
    '아웃사이드 사이', '어덕터', '어브덕터'
  ],
  calves: [
    '카프', '종아리', '카프레이즈', '카프 레이즈', '스탠딩 카프', '시티드 카프',
    '발끝', '레그프레스 카프', '동키 카프'
  ],
  core: [
    '플랭크', '크런치', '복근', '코어', '싯업', '윗몸일으키기', '레그레이즈',
    '레그 레이즈', '행잉 레그', '러시안 트위스트', '바이시클', '마운틴 클라이머',
    '데드버그', '브이업', '사이드 플랭크', '에이비 휠', 'ab', '복부'
  ],
  forearms: [
    '리스트 컬', '손목', '전완', '그립', '파머스 워크'
  ],
  mobility: [
    '스트레칭', '모빌리티', '폼롤러', '요가', '필라테스', '워밍업', '쿨다운'
  ],
  cardio: [
    '러닝', '조깅', '달리기', '트레드밀', '사이클', '싸이클', '자전거', '로잉머신',
    '로잉 머신', '일립티컬', '스텝퍼', '계단', '줄넘기', '점핑로프', '수영',
    '유산소', '인터벌', 'hiit', '버피', '클라이밍', '등산', '걷기', '파워워킹'
  ],
};

// 회복도 계산에 포함되는 부위 (근력 운동)
const MUSCLE_ORDER = ['chest','back','shoulder','biceps','triceps','quads','hamstrings','adductors','calves','core','forearms'];

const MUSCLE_LABELS = {
  chest:      { name: '가슴',           icon: '🫁' },
  back:       { name: '등',             icon: '🔵' },
  shoulder:   { name: '어깨',           icon: '🟡' },
  biceps:     { name: '이두',           icon: '💪' },
  triceps:    { name: '삼두',           icon: '🔱' },
  quads:      { name: '대퇴사두',       icon: '🦵' },
  hamstrings: { name: '둔근/햄스트링',  icon: '🍑' },
  adductors:  { name: '내전/외전근',    icon: '⬡' },
  calves:     { name: '종아리',         icon: '🦶' },
  core:       { name: '코어',           icon: '🔶' },
  forearms:   { name: '전완',           icon: '✊' },
};

// 회복도 계산에서 제외되는 활동 (기록은 되지만 회복 부담으로 카운트하지 않음)
const NON_MUSCLE_ORDER = ['mobility','cardio'];

const NON_MUSCLE_LABELS = {
  mobility: { name: '스트레칭/모빌리티', icon: '🧘' },
  cardio:   { name: '유산소', icon: '🏃' },
};

// ============================================================
// 자동완성용 운동명 사전 (자주 쓰는 전체 운동명)
// ============================================================
const COMMON_EXERCISES = [
  // 가슴
  '벤치 프레스','인클라인 벤치 프레스','디클라인 벤치 프레스','덤벨 벤치 프레스',
  '덤벨 인클라인 프레스','체스트 프레스 머신','펙덱 플라이','케이블 플라이',
  '딥스','맨몸 딥스','푸시업','와이드 푸시업','케이블 크로스오버','스미스 머신 벤치 프레스',
  // 등
  '랫 풀다운','풀업','맨몸 턱걸이','어시스트 풀업','시티드 케이블 로우','벤트오버 바벨로우',
  '원암 덤벨 로우','데드리프트','루마니안 데드리프트','백 익스텐션','티바 로우','풀오버',
  '인버티드 로우','하이로우 머신',
  // 어깨
  '숄더 프레스 머신','덤벨 숄더 프레스','오버헤드 프레스','바벨 밀리터리 프레스',
  '아놀드 프레스','덤벨 사이드 레터럴 레이즈','케이블 레터럴 레이즈','프론트 레이즈',
  '리어 델트 플라이','페이스 풀','업라이트 로우',
  // 이두
  '바벨 컬','덤벨 컬','해머 컬','케이블 컬','프리처 컬','인클라인 덤벨 컬','컨센트레이션 컬',
  // 삼두
  '로프 트라이셉스 푸시다운','오버헤드 트라이셉스 익스텐션','스컬크러셔','클로즈그립 벤치프레스',
  '딥 머신','킥백','로프 암 풀다운',
  // 대퇴사두
  '스쿼트','바벨 백 스쿼트','프론트 스쿼트','스미스 머신 스쿼트','핵 스쿼트',
  '레그프레스','레그 익스텐션','런지','덤벨 런지','불가리안 스플릿 스쿼트','고블릿 스쿼트',
  '점프 스쿼트','월싯','스텝업',
  // 둔근/햄스트링
  '레그컬','시티드 레그컬','라잉 레그컬','힙 쓰러스트','글루트 브릿지','케틀벨 스윙',
  '굿모닝','백 런지','RDL',
  // 내전/외전근
  '힙 어덕션 머신','힙 어브덕션 머신','이너 타이','아웃 타이',
  // 종아리
  '스탠딩 카프레이즈','시티드 카프레이즈','레그프레스 카프레이즈','동키 카프레이즈',
  // 코어
  '플랭크','크런치','레그레이즈','행잉 레그레이즈','러시안 트위스트','싯업','케이블 크런치',
  // 전완
  '리스트 컬','파머스 워크',
  // 유산소
  '러닝','트레드밀 러닝','사이클','실내자전거','로잉머신','줄넘기','수영','계단 오르기','걷기',
  // 모빌리티
  '스트레칭','폼롤러','요가','필라테스','워밍업','쿨다운',
];

function getExerciseSuggestions(query) {
  if (!query || query.trim().length === 0) return [];
  const normalizedQuery = normalizeExerciseName(query);

  // 기록에서 사용한 운동명도 포함 (최근 사용 우선)
  const workouts = loadWorkouts();
  const usedNames = [];
  [...workouts].reverse().forEach(w => {
    (w.exercises || []).forEach(ex => {
      if (ex.name && !usedNames.includes(ex.name)) usedNames.push(ex.name);
    });
  });

  const pool = [...usedNames, ...COMMON_EXERCISES];
  const seen = new Set();
  const results = [];

  for (const name of pool) {
    const normalizedName = normalizeExerciseName(name);
    if (normalizedName.includes(normalizedQuery) && !seen.has(name)) {
      seen.add(name);
      results.push(name);
      if (results.length >= 6) break;
    }
  }

  return results;
}


function loadWorkouts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveWorkouts(workouts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
  triggerAutoBackup();
}

function triggerAutoBackup() {
  if (backupFileHandle) {
    writeBackupFile();
  }
}

// ============================================================
// 파일 시스템 자동 백업 (File System Access API)
// 지원 브라우저(Chrome/Edge 등)에서는 폰/PC의 실제 파일에
// 운동 기록이 저장될 때마다 자동으로 덮어쓰기 백업됨.
// iOS Safari는 미지원 -> 수동 내보내기로 안내.
// ============================================================
let backupFileHandle = null; // FileSystemFileHandle (in-memory only per session)

function isFileSystemAccessSupported() {
  return 'showSaveFilePicker' in window;
}

async function linkBackupFile() {
  if (!isFileSystemAccessSupported()) {
    alert('이 브라우저는 파일 자동 저장을 지원하지 않아요.\n\n대신 "전체 데이터 내보내기"로 수동 백업해주세요.\n(아이폰 Safari는 미지원, PC/안드로이드 Chrome 권장)');
    return;
  }

  try {
    backupFileHandle = await window.showSaveFilePicker({
      suggestedName: 'recovr_backup.json',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    });

    localStorage.setItem('recovr_backup_linked', 'true');

    await writeBackupFile();
    updateBackupStatus();
    alert('백업 파일이 연결됐어요!\n앞으로 운동 기록을 저장할 때마다 이 파일에 자동으로 백업돼요.\n\n(브라우저를 새로고침하면 다시 연결해야 해요)');
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('백업 파일 연결 실패:', err);
    }
  }
}

async function writeBackupFile() {
  if (!backupFileHandle) return;
  try {
    const data = {
      workouts: loadWorkouts(),
      settings: loadSettings(),
      templates: loadTemplates(),
      exportedAt: new Date().toISOString(),
    };
    const writable = await backupFileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
  } catch (err) {
    console.error('자동 백업 실패:', err);
  }
}

function updateBackupStatus() {
  const el = document.getElementById('backupStatus');
  if (!el) return;

  if (!isFileSystemAccessSupported()) {
    el.textContent = '이 브라우저 미지원 (수동 내보내기 이용)';
    const btn = document.getElementById('linkBackupBtn');
    if (btn) btn.style.display = 'none';
    return;
  }

  if (backupFileHandle) {
    el.textContent = `연결됨: ${backupFileHandle.name}`;
  } else if (localStorage.getItem('recovr_backup_linked') === 'true') {
    el.textContent = '연결 끊김 (다시 연결해주세요)';
  } else {
    el.textContent = '연결 안 됨';
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : { baseRecoveryHours: 48 };
  } catch (e) { return { baseRecoveryHours: 48 }; }
}

function saveSettingsToStorage(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  triggerAutoBackup();
}

// ============================================================
// Recovery calculation engine (rule-based, no AI)
// ============================================================
// 회복 모델:
//  - 각 운동은 (무게 x 세트 x 반복) 형태로 부위별 볼륨에 누적
//  - 부위별 "강도 점수" = 볼륨 합 (정규화)
//  - 회복 기준 시간 = baseHours x (1 + 강도보정)
//  - 강도보정은 해당 세션의 부위별 볼륨이 그 부위의 "평균적인 1세션 볼륨" 대비 얼마나 높은지로 계산
//  - 회복도(%) = min(100, (경과시간 / 회복기준시간) * 100)
//  - 여러 세션이 겹치면 가장 최근(가장 회복 안 된) 세션 기준으로 계산

const REFERENCE_VOLUME = {
  // 부위별 "표준 1세션 볼륨" 참고값 (kg) - 사용자 데이터 기반 추정
  chest: 3600, back: 2820, shoulder: 2400, biceps: 1800, triceps: 1800,
  quads: 5000, hamstrings: 2400, adductors: 2880, calves: 1500, core: 500, forearms: 800,
};

// 운동명을 정규화 (소문자화, 공백/특수문자 제거 후 비교용 버전도 생성)
function normalizeExerciseName(name) {
  return name.toLowerCase().replace(/\s+/g, '');
}

// 운동 1개 항목의 볼륨(kg) 계산.
// setDetails(세트별 입력)가 있으면 "완료(✓)" 표시된 세트만 합산.
// 없으면 weight x reps x sets로 계산 (기존 방식).
function getExerciseVolume(ex) {
  if (ex.setDetails && ex.setDetails.length > 0) {
    return ex.setDetails.reduce((sum, s) => {
      if (!s.completed) return sum;
      return sum + (s.weight || 0) * (s.reps || 0);
    }, 0);
  }
  return (ex.weight || 0) * (ex.reps || 0) * (ex.sets || 0);
}

// 운동명에서 매칭되는 부위 목록을 반환.
// 키워드가 길수록(더 구체적일수록) 우선 매칭되도록 정렬해서 비교.
function matchKeywordCategories(name, categoryOrder) {
  if (!name) return [];
  const normalized = normalizeExerciseName(name);
  const matches = [];

  for (const key of categoryOrder) {
    const keywords = MUSCLE_KEYWORDS[key] || [];
    let bestLen = 0;
    for (const kw of keywords) {
      const normKw = normalizeExerciseName(kw);
      if (normalized.includes(normKw) && normKw.length > bestLen) {
        bestLen = normKw.length;
      }
    }
    if (bestLen > 0) {
      matches.push({ key, len: bestLen });
    }
  }

  if (matches.length === 0) return [];

  matches.sort((a, b) => b.len - a.len);
  const topLen = matches[0].len;
  const top = matches.filter(m => m.len === topLen);
  return [...new Set(top.map(m => m.key))];
}

// 부위(회복도 계산 대상) 매칭
function getMusclesFromExerciseName(name) {
  return matchKeywordCategories(name, MUSCLE_ORDER);
}

// 유산소/모빌리티 등 비-근력 활동 매칭 (회복도 계산에는 영향 없음)
function getActivityTagsFromExerciseName(name) {
  return matchKeywordCategories(name, NON_MUSCLE_ORDER);
}

// Returns: { chest: { volume, lastWorkoutDate, recoveryPct, hoursElapsed, recoveryHours }, ... }
function calcMuscleRecovery(workouts, settings) {
  const now = new Date();
  const baseHours = settings.baseRecoveryHours || 48;
  const result = {};

  MUSCLE_ORDER.forEach(m => {
    result[m] = { volume: 0, lastDate: null, recoveryPct: 100, hoursElapsed: null, recoveryHours: baseHours, exercises: [] };
  });

  // For each muscle, find the most recent workout that hit it, and accumulate that session's volume for that muscle
  MUSCLE_ORDER.forEach(muscleKey => {
    let mostRecent = null;
    let mostRecentDate = null;

    workouts.forEach(w => {
      const wDate = new Date(w.date + 'T12:00:00'); // assume midday
      let sessionVolumeForMuscle = 0;
      const exNames = [];

      (w.exercises || []).forEach(ex => {
        const muscles = getMusclesFromExerciseName(ex.name);
        if (muscles.includes(muscleKey)) {
          const vol = getExerciseVolume(ex);
          sessionVolumeForMuscle += vol;
          exNames.push(ex.name);
        }
      });

      if (sessionVolumeForMuscle > 0) {
        if (!mostRecentDate || wDate > mostRecentDate) {
          mostRecentDate = wDate;
          mostRecent = { volume: sessionVolumeForMuscle, exercises: exNames, date: w.date };
        }
      }
    });

    if (mostRecent) {
      const hoursElapsed = (now - mostRecentDate) / (1000 * 60 * 60);
      const refVol = REFERENCE_VOLUME[muscleKey] || 2000;
      const intensityFactor = mostRecent.volume / refVol; // 1.0 = average session
      // recovery hours scales with intensity: harder session -> longer recovery
      // clamp factor between 0.5 and 2.0 to avoid extreme values
      const clampedFactor = Math.max(0.5, Math.min(2.0, intensityFactor));
      const recoveryHours = baseHours * clampedFactor;

      const pct = Math.min(100, Math.round((hoursElapsed / recoveryHours) * 100));

      result[muscleKey] = {
        volume: mostRecent.volume,
        lastDate: mostRecent.date,
        recoveryPct: pct,
        hoursElapsed: Math.round(hoursElapsed),
        recoveryHours: Math.round(recoveryHours),
        exercises: mostRecent.exercises,
      };
    }
  });

  return result;
}

function getStatusBadge(pct) {
  if (pct < 40) return { label: '집중 회복 필요', cls: 'b-rest' };
  if (pct < 70) return { label: '회복중', cls: 'b-recovering' };
  if (pct < 95) return { label: '거의 회복', cls: 'b-almost' };
  return { label: '재운동 가능', cls: 'b-ready' };
}

function getBarColor(pct) {
  if (pct < 40) return 'linear-gradient(90deg, var(--red), var(--orange))';
  if (pct < 70) return 'linear-gradient(90deg, var(--orange), var(--yellow))';
  if (pct < 95) return 'linear-gradient(90deg, var(--yellow), var(--green))';
  return 'linear-gradient(90deg, var(--green), #00ffcc)';
}

function formatHoursElapsed(hours) {
  if (hours === null) return '';
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}일 ${remHours}시간 전`;
}

// ============================================================
// Rendering
// ============================================================
function renderHome() {
  const workouts = loadWorkouts();
  const settings = loadSettings();
  const recovery = calcMuscleRecovery(workouts, settings);

  checkRecoveryNotifications(recovery);

  // overall = average recovery across muscles that have data
  const active = MUSCLE_ORDER.filter(m => recovery[m].lastDate !== null);
  let overallPct = 100;
  if (active.length > 0) {
    overallPct = Math.round(active.reduce((sum, m) => sum + recovery[m].recoveryPct, 0) / active.length);
  }

  document.getElementById('overallPct').innerHTML = `${overallPct}<span class="unit">% 회복</span>`;

  const ring = document.getElementById('heroRing');
  let desc, ringBg, ringIcon;
  if (active.length === 0) {
    desc = '운동 기록을 추가하면 회복도가 표시돼요.';
    ringBg = 'rgba(255,255,255,0.05)'; ringIcon = '🧘';
  } else if (overallPct < 40) {
    desc = '최근 운동 강도가 높았어요. 휴식을 추천해요.';
    ringBg = 'rgba(255,59,92,0.12)'; ringIcon = '🔥';
  } else if (overallPct < 70) {
    desc = '회복 진행 중이에요. 가벼운 활동이 좋아요.';
    ringBg = 'rgba(255,107,53,0.12)'; ringIcon = '⏳';
  } else if (overallPct < 95) {
    desc = '거의 회복됐어요. 곧 재운동 가능해요.';
    ringBg = 'rgba(255,214,0,0.12)'; ringIcon = '👍';
  } else {
    desc = '대부분 회복 완료! 운동하기 좋은 날이에요.';
    ringBg = 'rgba(0,255,157,0.12)'; ringIcon = '💪';
  }
  ring.style.background = ringBg;
  ring.textContent = ringIcon;
  document.getElementById('overallDesc').textContent = desc;

  // week bar
  renderWeekBar(workouts);

  // muscle list
  const muscleList = document.getElementById('muscleList');
  muscleList.innerHTML = '';

  if (active.length === 0) {
    muscleList.innerHTML = `
      <div class="empty-state">
        <div class="ee-icon">📭</div>
        <div class="ee-title">아직 운동 기록이 없어요</div>
        <div class="ee-body">하단의 + 버튼을 눌러<br>첫 운동을 기록해보세요.</div>
      </div>`;
    return;
  }

  // sort by recovery pct ascending (least recovered first)
  const sorted = [...active].sort((a, b) => recovery[a].recoveryPct - recovery[b].recoveryPct);

  sorted.forEach(m => {
    const r = recovery[m];
    const label = MUSCLE_LABELS[m];
    const badge = getStatusBadge(r.recoveryPct);
    const barColor = getBarColor(r.recoveryPct);
    const exNames = [...new Set(r.exercises)].join(' · ');

    muscleList.innerHTML += `
      <div class="muscle-card">
        <div class="mc-top">
          <div class="mc-icon" style="background:rgba(255,255,255,0.04)">${label.icon}</div>
          <div class="mc-info">
            <div class="mc-name">${label.name}</div>
            <div class="mc-detail">${exNames}</div>
          </div>
          <div class="mc-right">
            <div class="mc-pct" style="color:${getPctColor(r.recoveryPct)}">${r.recoveryPct}%</div>
            <div class="badge ${badge.cls}">${badge.label}</div>
          </div>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${r.recoveryPct}%;background:${barColor}"></div></div>
        <div class="mc-time" style="margin-top:4px">${formatHoursElapsed(r.hoursElapsed)} · ${r.recoveryHours}h 기준</div>
      </div>`;
  });
}

function getPctColor(pct) {
  if (pct < 40) return 'var(--red)';
  if (pct < 70) return 'var(--orange)';
  if (pct < 95) return 'var(--yellow)';
  return 'var(--green)';
}

function renderWeekBar(workouts) {
  const weekBar = document.getElementById('weekBar');
  weekBar.innerHTML = '';
  const dayLabels = ['일','월','화','수','목','금','토'];
  const today = new Date();
  today.setHours(0,0,0,0);

  // build a map date string -> workout type
  const byDate = {};
  workouts.forEach(w => {
    if (!byDate[w.date]) byDate[w.date] = w.type;
  });

  // show last 7 days ending today
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d);
    const dow = d.getDay();
    const type = byDate[dateStr];
    let cls = 'week-day';
    let content = dayLabels[dow];
    if (type === 'upper') { cls += ' workout-upper'; content = '상'; }
    else if (type === 'lower') { cls += ' workout-lower'; content = '하'; }
    else if (type === 'full') { cls += ' workout-upper'; content = '전'; }
    if (i === 0) cls += ' today';
    weekBar.innerHTML += `<div class="${cls}">${content}</div>`;
  }
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function renderLog() {
  const workouts = loadWorkouts();
  const list = document.getElementById('workoutList');
  list.innerHTML = '';

  if (workouts.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="ee-icon">📋</div>
        <div class="ee-title">운동 기록이 없어요</div>
        <div class="ee-body">오른쪽 위 + 추가를 눌러<br>운동을 기록해보세요.</div>
      </div>`;
    return;
  }

  const sorted = [...workouts].sort((a,b) => new Date(b.date) - new Date(a.date));

  sorted.forEach((w, idx) => {
    const realIdx = workouts.indexOf(w);
    const totalVolume = (w.exercises || []).reduce((sum, ex) => sum + getExerciseVolume(ex), 0);
    const typeLabel = w.type === 'upper' ? '상체' : w.type === 'lower' ? '하체' : '전신';
    const typeCls = w.type === 'lower' ? 'lower' : 'upper';
    const dateObj = new Date(w.date + 'T12:00:00');
    const dateStr = `${dateObj.getMonth()+1}월 ${dateObj.getDate()}일`;

    // 유산소/모빌리티 태그 수집
    const activityTags = new Set();
    (w.exercises || []).forEach(ex => {
      getActivityTagsFromExerciseName(ex.name).forEach(tag => activityTags.add(tag));
    });
    let tagsHtml = '';
    activityTags.forEach(tag => {
      const label = NON_MUSCLE_LABELS[tag];
      tagsHtml += `<span class="activity-tag">${label.icon} ${label.name}</span>`;
    });

    list.innerHTML += `
      <div class="workout-item" style="cursor:default">
        <div class="wi-top">
          <div class="wi-date">${dateStr}</div>
          <div style="display:flex;gap:6px;align-items:center">
            <div class="wi-type ${typeCls}">${typeLabel}</div>
            <button class="wi-action" onclick="openEditModal(${realIdx})" title="수정">✏️</button>
            <button class="wi-action" onclick="deleteWorkoutPrompt(${realIdx})" title="삭제">🗑️</button>
          </div>
        </div>
        <div class="wi-meta">
          <span>볼륨 <b>${totalVolume.toLocaleString()}</b> kg</span>
          <span>${w.duration || '-'}분</span>
          <span>${(w.exercises||[]).length}개 종목</span>
        </div>
        ${tagsHtml ? `<div style="margin-top:6px">${tagsHtml}</div>` : ''}
      </div>`;
  });
}

function deleteWorkoutPrompt(idx) {
  if (confirm('이 운동 기록을 삭제하시겠어요?')) {
    const workouts = loadWorkouts();
    workouts.splice(idx, 1);
    saveWorkouts(workouts);
    renderLog();
    renderHome();
  }
}

function renderStats() {
  const workouts = loadWorkouts();
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const thisWeek = workouts.filter(w => new Date(w.date) >= weekAgo);
  const weekVolume = thisWeek.reduce((sum, w) => sum + (w.exercises||[]).reduce((s,ex)=>s+getExerciseVolume(ex),0), 0);
  const upperCount = thisWeek.filter(w => w.type === 'upper').length;
  const lowerCount = thisWeek.filter(w => w.type === 'lower').length;

  const totalVolume = workouts.reduce((sum, w) => sum + (w.exercises||[]).reduce((s,ex)=>s+getExerciseVolume(ex),0), 0);

  document.getElementById('statWeekVolume').textContent = weekVolume.toLocaleString();
  document.getElementById('statWeekCount').textContent = thisWeek.length;
  document.getElementById('statUpperCount').textContent = upperCount;
  document.getElementById('statLowerCount').textContent = lowerCount;
  document.getElementById('statTotalVolume').textContent = totalVolume.toLocaleString();
  document.getElementById('statTotalCount').textContent = workouts.length;

  renderTrendChart(workouts);
  renderWeeklyFrequency(workouts);
  renderPRList(workouts);
}

// e1RM (Epley formula): weight x (1 + reps/30)
function calcE1RM(weight, reps) {
  if (!weight || !reps) return 0;
  return weight * (1 + reps / 30);
}

function renderWeeklyFrequency(workouts) {
  const container = document.getElementById('freqList');
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const thisWeek = workouts.filter(w => new Date(w.date) >= weekAgo);

  // count sessions per muscle this week
  const counts = {};
  MUSCLE_ORDER.forEach(m => counts[m] = 0);

  thisWeek.forEach(w => {
    const musclesHitToday = new Set();
    (w.exercises || []).forEach(ex => {
      getMusclesFromExerciseName(ex.name).forEach(m => musclesHitToday.add(m));
    });
    musclesHitToday.forEach(m => counts[m]++);
  });

  // only show muscles that have ever been trained
  const everTrained = new Set();
  workouts.forEach(w => (w.exercises || []).forEach(ex => {
    getMusclesFromExerciseName(ex.name).forEach(m => everTrained.add(m));
  }));

  const relevant = MUSCLE_ORDER.filter(m => everTrained.has(m));

  if (relevant.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:16px"><div class="ee-body">기록이 쌓이면<br>부위별 주간 빈도가 표시돼요.</div></div>`;
    return;
  }

  let html = '<div class="muscle-card" style="padding:14px 15px">';
  relevant.forEach(m => {
    const c = counts[m];
    const label = MUSCLE_LABELS[m];
    let statusColor, statusText;
    if (c === 0) { statusColor = 'var(--red)'; statusText = '0회 - 빈도 부족'; }
    else if (c === 1) { statusColor = 'var(--yellow)'; statusText = '1회'; }
    else { statusColor = 'var(--green)'; statusText = `${c}회`; }

    html += `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:12.5px">${label.icon} ${label.name}</span>
        <span style="font-size:12px;font-weight:700;color:${statusColor}">${statusText}</span>
      </div>`;
  });
  html += '</div>';

  // overall recommendation
  const zeroCount = relevant.filter(m => counts[m] === 0).length;
  if (zeroCount > 0) {
    html += `<div class="tip" style="margin-top:8px">
      <div class="tip-icon">📅</div>
      <div>
        <div class="tip-title">이번 주 자극 없는 부위가 있어요</div>
        <div class="tip-body">근성장에는 부위별 주 2회 자극이 권장돼요. 0회인 부위를 다음 운동에 포함해보세요.</div>
      </div>
    </div>`;
  }

  container.innerHTML = html;
}

function renderPRList(workouts) {
  const container = document.getElementById('prList');

  // group by exercise name, find max weight, max e1RM, max volume per session
  const prs = {}; // name -> { maxWeight, maxWeightDate, maxE1RM, maxE1RMDate, maxVolume, maxVolumeDate }

  workouts.forEach(w => {
    const byName = {}; // for this workout, sum volume per exercise name
    (w.exercises || []).forEach(ex => {
      if (!ex.name) return;
      if (ex.mode === 'duration') return; // skip cardio/mobility for PR tracking
      const vol = getExerciseVolume(ex);

      if (!prs[ex.name]) {
        prs[ex.name] = { maxWeight: 0, maxWeightDate: null, maxE1RM: 0, maxE1RMDate: null, maxVolume: 0, maxVolumeDate: null };
      }
      const p = prs[ex.name];

      // 세트별 입력이 있으면 각 세트를 개별로 PR 후보로 검토
      const candidates = (ex.setDetails && ex.setDetails.length > 0)
        ? ex.setDetails.map(s => ({ weight: s.weight, reps: s.reps }))
        : [{ weight: ex.weight, reps: ex.reps }];

      candidates.forEach(c => {
        const e1rm = calcE1RM(c.weight, c.reps);
        if (c.weight > p.maxWeight) { p.maxWeight = c.weight; p.maxWeightDate = w.date; }
        if (e1rm > p.maxE1RM) { p.maxE1RM = e1rm; p.maxE1RMDate = w.date; }
      });

      if (!byName[ex.name]) byName[ex.name] = 0;
      byName[ex.name] += vol;
    });

    Object.entries(byName).forEach(([name, vol]) => {
      const p = prs[name];
      if (vol > p.maxVolume) { p.maxVolume = vol; p.maxVolumeDate = w.date; }
    });
  });

  const names = Object.keys(prs);
  if (names.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:16px"><div class="ee-body">운동 기록이 쌓이면<br>개인 기록이 표시돼요.</div></div>`;
    return;
  }

  // sort by max e1RM descending, show top entries
  names.sort((a,b) => prs[b].maxE1RM - prs[a].maxE1RM);

  let html = '';
  names.forEach(name => {
    const p = prs[name];
    const muscles = getMusclesFromExerciseName(name);
    const icon = muscles.length > 0 ? MUSCLE_LABELS[muscles[0]].icon : '🏋️';

    html += `
      <div class="muscle-card">
        <div class="mc-top" style="margin-bottom:0">
          <div class="mc-icon" style="background:rgba(255,255,255,0.04)">${icon}</div>
          <div class="mc-info">
            <div class="mc-name">${name}</div>
            <div class="mc-detail">최고 무게 ${p.maxWeight}kg · e1RM ${p.maxE1RM.toFixed(1)}kg</div>
          </div>
          <div class="mc-right">
            <div class="mc-pct" style="font-size:14px;color:var(--green)">${p.maxVolume.toLocaleString()}<span style="font-size:10px;color:var(--muted)">kg</span></div>
            <div class="mc-time">최고 세션 볼륨</div>
          </div>
        </div>
      </div>`;
  });

  container.innerHTML = html;
}

function renderTrendChart(workouts) {
  const container = document.getElementById('trendChart');
  if (workouts.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:12px;padding:20px 0">데이터가 쌓이면<br>볼륨 추세 그래프가 표시돼요.</div>`;
    return;
  }

  const sorted = [...workouts].sort((a,b) => new Date(a.date) - new Date(b.date)).slice(-8);
  const maxVol = Math.max(...sorted.map(w => (w.exercises||[]).reduce((s,ex)=>s+getExerciseVolume(ex),0)), 1);

  let html = '<div style="display:flex;align-items:flex-end;gap:8px;height:120px">';
  sorted.forEach(w => {
    const vol = (w.exercises||[]).reduce((s,ex)=>s+getExerciseVolume(ex),0);
    const h = Math.max(4, Math.round((vol / maxVol) * 100));
    const color = w.type === 'lower' ? 'var(--orange)' : 'var(--cyan)';
    const d = new Date(w.date + 'T12:00:00');
    html += `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end">
        <div style="font-size:9px;color:var(--muted)">${(vol/1000).toFixed(1)}k</div>
        <div style="width:100%;height:${h}%;background:${color};border-radius:4px 4px 0 0;min-height:4px"></div>
        <div style="font-size:9px;color:var(--muted)">${d.getMonth()+1}/${d.getDate()}</div>
      </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

// ============================================================
// Theme (dark / light)
// ============================================================
const THEME_KEY = 'recovr_theme_v1';

function loadTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('light');
    document.getElementById('themeToggle').textContent = '☀️';
  } else {
    document.body.classList.remove('light');
    document.getElementById('themeToggle').textContent = '🌙';
  }
}

function toggleTheme() {
  const current = loadTheme();
  const next = current === 'light' ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

// ============================================================
// Calendar view
// ============================================================
let calViewDate = new Date(); // month being viewed
let calWeekDate = new Date(); // a date within the week being viewed
let calSelectedDate = null;
let calViewMode = 'week'; // 'week' or 'month'

function setCalViewMode(mode) {
  calViewMode = mode;
  document.getElementById('calToggleWeek').classList.toggle('selected', mode === 'week');
  document.getElementById('calToggleMonth').classList.toggle('selected', mode === 'month');
  document.getElementById('weekStripView').style.display = mode === 'week' ? '' : 'none';
  document.getElementById('monthGridView').style.display = mode === 'month' ? '' : 'none';
  renderCalendar();
}

function changeCalMonth(delta) {
  calViewDate.setMonth(calViewDate.getMonth() + delta);
  renderCalendar();
}

function changeCalWeek(delta) {
  calWeekDate.setDate(calWeekDate.getDate() + delta * 7);
  renderCalendar();
}

const ACTIVITY_ICONS = { upper: '💪', lower: '🦵', full: '🔥' };

function renderWeekStrip(byDate) {
  const grid = document.getElementById('weekStrip');
  grid.innerHTML = '';

  // find the Sunday of the week containing calWeekDate
  const ref = new Date(calWeekDate);
  ref.setDate(ref.getDate() - ref.getDay()); // back to Sunday
  ref.setHours(0,0,0,0);

  const today = formatDate(new Date());
  const dowLabels = ['일','월','화','수','목','금','토'];

  // month label = the month most days fall in (use middle of week, Wednesday)
  const mid = new Date(ref);
  mid.setDate(mid.getDate() + 3);
  document.getElementById('weekLabel').textContent = `${mid.getFullYear()}년 ${mid.getMonth()+1}월`;

  for (let i = 0; i < 7; i++) {
    const d = new Date(ref);
    d.setDate(d.getDate() + i);
    const dateStr = formatDate(d);
    const dayWorkouts = byDate[dateStr] || [];

    let cls = 'week-strip-day';
    if (dateStr === today) cls += ' today';
    if (dateStr === calSelectedDate) cls += ' selected';

    let icon = '';
    if (dayWorkouts.length > 0) {
      const types = new Set(dayWorkouts.map(w => w.type));
      const primaryType = types.has('lower') && types.has('upper') ? 'full' : [...types][0];
      cls += ` has-workout ${primaryType}`;
      icon = ACTIVITY_ICONS[primaryType] || '🏋️';
    }

    grid.innerHTML += `
      <div class="${cls}" onclick="selectCalDay('${dateStr}')">
        <div class="wsd-dow">${dowLabels[i]}</div>
        <div class="wsd-date">${d.getDate()}</div>
        <div class="wsd-icon">${icon}</div>
      </div>`;
  }
}

function renderCalendar() {
  const workouts = loadWorkouts();
  const byDate = {};
  workouts.forEach(w => {
    if (!byDate[w.date]) byDate[w.date] = [];
    byDate[w.date].push(w);
  });

  if (calViewMode === 'week') {
    renderWeekStrip(byDate);
  } else {
    renderMonthGrid(byDate);
  }

  if (!calSelectedDate) {
    renderCalDayDetail(null);
  } else {
    renderCalDayDetail(calSelectedDate);
  }
}

function renderMonthGrid(byDate) {
  const year = calViewDate.getFullYear();
  const month = calViewDate.getMonth();

  document.getElementById('calMonthLabel').textContent = `${year}년 ${month + 1}월`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const today = formatDate(new Date());

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  // leading empty cells
  for (let i = 0; i < startWeekday; i++) {
    grid.innerHTML += `<div class="cal-day empty"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDate(new Date(year, month, day));
    const dayWorkouts = byDate[dateStr] || [];
    let cls = 'cal-day';
    if (dateStr === today) cls += ' today';
    if (dateStr === calSelectedDate) cls += ' selected';

    let dots = '';
    dayWorkouts.forEach(w => {
      dots += `<div class="cal-dot ${w.type}"></div>`;
    });

    grid.innerHTML += `
      <div class="${cls}" onclick="selectCalDay('${dateStr}')">
        <div>${day}</div>
        <div style="display:flex;gap:2px">${dots}</div>
      </div>`;
  }
}

function selectCalDay(dateStr) {
  calSelectedDate = dateStr;
  renderCalendar();
}

function renderCalDayDetail(dateStr) {
  const label = document.getElementById('calSelectedLabel');
  const detail = document.getElementById('calDayDetail');

  if (!dateStr) {
    label.textContent = '날짜를 선택하세요';
    detail.innerHTML = `<div class="empty-state" style="padding:20px"><div class="ee-body">달력에서 날짜를 탭하면<br>그날의 운동 기록이 표시돼요.</div></div>`;
    return;
  }

  const d = new Date(dateStr + 'T12:00:00');
  label.textContent = `${d.getMonth()+1}월 ${d.getDate()}일 (${['일','월','화','수','목','금','토'][d.getDay()]})`;

  const allWorkouts = loadWorkouts();
  const workouts = allWorkouts.filter(w => w.date === dateStr);

  if (workouts.length === 0) {
    detail.innerHTML = `<div class="empty-state" style="padding:20px">
      <div class="ee-icon">💤</div>
      <div class="ee-body">이 날은 운동 기록이 없어요.</div>
    </div>`;
    return;
  }

  detail.innerHTML = '';
  workouts.forEach(w => {
    const realIdx = allWorkouts.indexOf(w);
    const totalVolume = (w.exercises || []).reduce((sum, ex) => sum + getExerciseVolume(ex), 0);
    const typeLabel = w.type === 'upper' ? '상체' : w.type === 'lower' ? '하체' : '전신';
    const typeCls = w.type === 'lower' ? 'lower' : 'upper';

    let exList = '';
    const grouped = {};
    (w.exercises || []).forEach(ex => {
      if (!grouped[ex.name]) grouped[ex.name] = [];
      if (ex.mode === 'duration') {
        grouped[ex.name].push(`${ex.durationMin}분`);
      } else if (ex.setDetails && ex.setDetails.length > 0) {
        ex.setDetails.forEach(s => {
          const mark = s.completed ? '' : ' (미완료)';
          grouped[ex.name].push(`${s.weight}kg×${s.reps}${mark}`);
        });
      } else {
        grouped[ex.name].push(`${ex.weight}kg×${ex.reps}`);
      }
    });
    Object.entries(grouped).forEach(([name, sets]) => {
      exList += `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">
        <span>${name}</span><span style="color:var(--muted)">${sets.join(', ')}</span>
      </div>`;
    });

    detail.innerHTML += `
      <div class="workout-item" onclick="openEditModal(${realIdx})">
        <div class="wi-top">
          <div class="wi-date">${typeLabel} 운동</div>
          <div style="display:flex;gap:6px;align-items:center">
            <div class="wi-type ${typeCls}">${w.duration || '-'}분</div>
            <button class="wi-action" onclick="event.stopPropagation(); deleteWorkoutAndRefreshCalendar(${realIdx})" title="삭제">🗑️</button>
          </div>
        </div>
        <div class="wi-meta" style="margin-bottom:8px"><span>볼륨 <b>${totalVolume.toLocaleString()}</b> kg</span></div>
        ${exList}
      </div>`;
  });
}

function deleteWorkoutAndRefreshCalendar(idx) {
  if (confirm('이 운동 기록을 삭제하시겠어요?')) {
    const workouts = loadWorkouts();
    workouts.splice(idx, 1);
    saveWorkouts(workouts);
    renderCalendar();
    renderHome();
  }
}

// ============================================================
// ICS export (for Google Calendar import)
// ============================================================
function exportICS() {
  const workouts = loadWorkouts();
  if (workouts.length === 0) {
    alert('내보낼 운동 기록이 없어요.');
    return;
  }

  const pad = (n) => String(n).padStart(2, '0');
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//RECOVR//Workout Tracker//KO\r\nCALSCALE:GREGORIAN\r\n';

  workouts.forEach((w, idx) => {
    const totalVolume = (w.exercises || []).reduce((sum, ex) => sum + getExerciseVolume(ex), 0);
    const typeLabel = w.type === 'upper' ? '상체' : w.type === 'lower' ? '하체' : '전신';

    const [y, m, d] = w.date.split('-');
    const startDate = `${y}${m}${d}`;
    const startHM = (w.startTime && /^\d{2}:\d{2}$/.test(w.startTime)) ? w.startTime : '18:00';
    const startTime = startHM.replace(':', '') + '00';
    const durationMin = w.duration || 60;
    const startDt = new Date(`${w.date}T${startHM}:00`);
    const endDt = new Date(startDt.getTime() + durationMin * 60000);
    const endStr = `${endDt.getFullYear()}${pad(endDt.getMonth()+1)}${pad(endDt.getDate())}T${pad(endDt.getHours())}${pad(endDt.getMinutes())}00`;

    let desc = (w.exercises || []).map(ex => {
      if (ex.mode === 'duration') return `${ex.name} ${ex.durationMin}분`;
      return `${ex.name} ${ex.weight}kg x ${ex.reps}`;
    }).join('\\n');
    desc += `\\n\\n총 볼륨: ${totalVolume.toLocaleString()}kg`;

    const uid = `recovr-${w.date}-${idx}-${Date.now()}@recovr.app`;
    const now = new Date();
    const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

    ics += 'BEGIN:VEVENT\r\n';
    ics += `UID:${uid}\r\n`;
    ics += `DTSTAMP:${dtstamp}\r\n`;
    ics += `DTSTART:${startDate}T${startTime}\r\n`;
    ics += `DTEND:${endStr}\r\n`;
    ics += `SUMMARY:🏋️ ${typeLabel} 운동 (${totalVolume.toLocaleString()}kg)\r\n`;
    ics += `DESCRIPTION:${desc}\r\n`;
    ics += 'END:VEVENT\r\n';
  });

  ics += 'END:VCALENDAR\r\n';

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recovr_workouts_${formatDate(new Date())}.ics`;
  a.click();
  URL.revokeObjectURL(url);

  setTimeout(() => {
    alert('다운로드 완료!\n\n구글 캘린더에서:\n설정 > 가져오기 및 내보내기 > 가져오기\n에서 이 파일을 선택하면 운동 기록이 캘린더에 추가돼요.');
  }, 300);
}

// ============================================================
// Notifications (PWA)
// ============================================================
const NOTIFIED_KEY = 'recovr_notified_v1';

function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function checkRecoveryNotifications(recovery) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const today = formatDate(new Date());
  let notified = {};
  try { notified = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}'); } catch(e) {}

  const readyMuscles = [];
  MUSCLE_ORDER.forEach(m => {
    const r = recovery[m];
    if (r.lastDate && r.recoveryPct >= 95) {
      readyMuscles.push(MUSCLE_LABELS[m].name);
    }
  });

  if (readyMuscles.length > 0 && notified[today] !== readyMuscles.join(',')) {
    new Notification('💪 RECOVR', {
      body: `${readyMuscles.join(', ')} 회복 완료! 오늘 운동하기 좋아요.`,
      icon: './icon-192.png',
    });
    notified[today] = readyMuscles.join(',');
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified));
  }
}

// ============================================================
// View switching
// ============================================================
function switchView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + viewName).classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (navItem) navItem.classList.add('active');

  if (viewName === 'home') renderHome();
  if (viewName === 'log') renderLog();
  if (viewName === 'calendar') renderCalendar();
  if (viewName === 'stats') renderStats();
  if (viewName === 'settings') {
    const s = loadSettings();
    document.getElementById('baseRecoveryHours').value = s.baseRecoveryHours || 48;
    updateBackupStatus();
  }
}

// ============================================================
// Routine templates
// ============================================================
const TEMPLATES_KEY = 'recovr_templates_v1';

function loadTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveTemplates(templates) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  triggerAutoBackup();
}

function populateTemplateSelect() {
  const select = document.getElementById('templateSelect');
  const templates = loadTemplates();
  select.innerHTML = '<option value="">템플릿 불러오기...</option>';
  templates.forEach((t, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = `${t.name} (${t.exercises.length}개 종목)`;
    select.appendChild(opt);
  });
  if (templates.length > 0) {
    const deleteOpt = document.createElement('option');
    deleteOpt.value = 'manage';
    deleteOpt.textContent = '— 템플릿 관리 —';
    select.appendChild(deleteOpt);
  }
}

function saveAsTemplate() {
  const exercises = extractExercisesFromForm();

  if (exercises.length === 0) {
    alert('저장할 운동 항목이 없어요.');
    return;
  }

  const name = prompt('템플릿 이름을 입력하세요 (예: 상체 루틴 A)');
  if (!name) return;

  const templates = loadTemplates();
  templates.push({ name, type: selectedType, exercises });
  saveTemplates(templates);
  populateTemplateSelect();
  alert(`"${name}" 템플릿이 저장됐어요.`);
}

function loadTemplate() {
  const select = document.getElementById('templateSelect');
  const value = select.value;

  if (value === 'manage') {
    manageTemplates();
    select.value = '';
    return;
  }

  if (value === '') return;

  const templates = loadTemplates();
  const t = templates[parseInt(value)];
  if (!t) return;

  document.getElementById('exerciseRows').innerHTML = '';
  t.exercises.forEach(ex => addExerciseRow(ex));
  selectType(t.type || selectedType);
  select.value = '';
}

function manageTemplates() {
  const templates = loadTemplates();
  if (templates.length === 0) { alert('저장된 템플릿이 없어요.'); return; }

  const names = templates.map((t, i) => `${i+1}. ${t.name}`).join('\n');
  const input = prompt(`삭제할 템플릿 번호를 입력하세요:\n${names}`);
  const idx = parseInt(input) - 1;
  if (isNaN(idx) || idx < 0 || idx >= templates.length) return;

  if (confirm(`"${templates[idx].name}" 템플릿을 삭제할까요?`)) {
    templates.splice(idx, 1);
    saveTemplates(templates);
    populateTemplateSelect();
  }
}

// ============================================================
// Modal / Add workout
// ============================================================
let selectedType = 'upper';
let editingIndex = null; // null = new workout, number = editing existing index

// ============================================================
// 입력 중 자동 임시저장 (Draft)
// 모달에 입력하는 도중 새로고침/창 닫힘이 발생해도 내용이
// 사라지지 않도록, 변경될 때마다 localStorage에 자동 저장하고
// 다음에 모달을 열 때 복구를 제안함.
// ============================================================
const DRAFT_KEY = 'recovr_draft_v1';
let draftSaveTimer = null;

function saveDraft() {
  // editingIndex가 있으면(기존 기록 수정 중) 드래프트 저장 안 함
  // (수정 중 새로고침되면 그냥 원본 데이터로 돌아가는 게 안전함)
  if (editingIndex !== null) return;

  clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(() => {
    try {
      const draft = {
        date: document.getElementById('workoutDate').value,
        startTime: document.getElementById('workoutTime').value,
        duration: document.getElementById('workoutDuration').value,
        type: selectedType,
        exercises: extractExercisesFromForm(),
        savedAt: new Date().toISOString(),
      };
      // 빈 운동 1개뿐이면(아무것도 안 적은 상태) 드래프트 저장 안 함
      const hasContent = draft.exercises.some(ex =>
        ex.name && (ex.name.trim() !== '' )
      );
      if (!hasContent) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      showDraftIndicator();
    } catch (e) { /* ignore */ }
  }, 400);
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function showDraftIndicator() {
  const el = document.getElementById('draftIndicator');
  if (!el) return;
  el.style.opacity = '1';
  clearTimeout(showDraftIndicator._t);
  showDraftIndicator._t = setTimeout(() => { el.style.opacity = '0'; }, 1200);
}

function applyDraftToForm(draft) {
  document.getElementById('workoutDate').value = draft.date || formatDate(new Date());
  document.getElementById('workoutTime').value = draft.startTime || '';
  document.getElementById('workoutDuration').value = draft.duration || 100;
  document.getElementById('exerciseRows').innerHTML = '';

  (draft.exercises || []).forEach(ex => addExerciseRow(ex));
  if ((draft.exercises || []).length === 0) addExerciseRow();

  selectType(draft.type || 'upper');
}

// 모달 내 모든 입력 변화를 감지해서 saveDraft 호출
function attachDraftListeners() {
  const modal = document.querySelector('.modal');
  if (!modal) return;
  modal.addEventListener('input', saveDraft);
  modal.addEventListener('click', (e) => {
    // 체크박스, 세트추가, 세트삭제, 모드전환 등 클릭 기반 변경도 감지
    if (e.target.closest('.set-check, .add-set-btn, .set-del, .row-mode-toggle, .row-del, .type-btn')) {
      saveDraft();
    }
  });
}


function openModal() {
  editingIndex = null;
  document.getElementById('modalTitle').textContent = '운동 기록 추가';
  document.getElementById('saveBtn').textContent = '저장하기';
  document.getElementById('modalOverlay').classList.add('show');

  const draft = loadDraft();
  if (draft) {
    const savedTime = new Date(draft.savedAt);
    const minsAgo = Math.round((new Date() - savedTime) / 60000);
    const timeLabel = minsAgo < 1 ? '방금' : minsAgo < 60 ? `${minsAgo}분 전` : `${Math.round(minsAgo/60)}시간 전`;
    const restore = confirm(`작성 중이던 기록이 있어요 (${timeLabel} 저장됨).\n이어서 작성하시겠어요?\n\n취소하면 새로 시작해요.`);
    if (restore) {
      applyDraftToForm(draft);
      populateTemplateSelect();
      attachDraftListeners();
      return;
    } else {
      clearDraft();
    }
  }

  document.getElementById('workoutDate').value = formatDate(new Date());
  const now = new Date();
  document.getElementById('workoutTime').value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  document.getElementById('workoutDuration').value = 100;
  document.getElementById('exerciseRows').innerHTML = '';
  addExerciseRow();
  selectType('upper');
  populateTemplateSelect();
  attachDraftListeners();
}

function openEditModal(idx) {
  const workouts = loadWorkouts();
  const w = workouts[idx];
  if (!w) return;

  editingIndex = idx;
  document.getElementById('modalTitle').textContent = '운동 기록 수정';
  document.getElementById('saveBtn').textContent = '수정 완료';
  document.getElementById('modalOverlay').classList.add('show');
  document.getElementById('workoutDate').value = w.date;
  document.getElementById('workoutTime').value = w.startTime || '';
  document.getElementById('workoutDuration').value = w.duration || 0;
  document.getElementById('exerciseRows').innerHTML = '';

  (w.exercises || []).forEach(ex => addExerciseRow(ex));
  if ((w.exercises || []).length === 0) addExerciseRow();

  selectType(w.type || 'upper');
  populateTemplateSelect();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

function closeModalOnOverlay(e) {
  if (e.target.id === 'modalOverlay') closeModal();
}

function selectType(type) {
  selectedType = type;
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.remove('selected');
    if (btn.dataset.type === type) btn.classList.add('selected');
  });
}

function addExerciseRow(prefill) {
  const container = document.getElementById('exerciseRows');
  const row = document.createElement('div');
  row.className = 'exercise-row-wrap';

  const isDuration = prefill?.mode === 'duration';

  row.innerHTML = `
    <div class="exercise-row ${isDuration ? 'duration-mode' : ''}">
      <input type="text" placeholder="예: 스쿼트" class="ex-name" value="${prefill?.name || ''}" autocomplete="off">
      <input type="number" placeholder="분" class="ex-duration" value="${prefill?.durationMin || ''}" style="${isDuration ? '' : 'display:none'}">
      <button class="row-mode-toggle" title="시간 입력으로 전환" style="${isDuration ? 'display:none' : ''}">⏱</button>
      <button class="row-mode-toggle" title="세트 입력으로 전환" style="${isDuration ? '' : 'display:none'}">🏋️</button>
      <button class="row-del" onclick="this.closest('.exercise-row-wrap').remove()">✕</button>
    </div>
    <div class="ex-suggest"></div>
    <div class="set-checklist" style="${isDuration ? 'display:none' : ''}"></div>
    <button class="add-set-btn" style="${isDuration ? 'display:none' : ''}">+ 세트 추가</button>
  `;
  container.appendChild(row);

  const nameInput = row.querySelector('.ex-name');
  const suggestBox = row.querySelector('.ex-suggest');
  const toggleBtns = row.querySelectorAll('.row-mode-toggle');
  const checklist = row.querySelector('.set-checklist');
  const addSetBtn = row.querySelector('.add-set-btn');

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      setRowMode(row, !row.querySelector('.exercise-row').classList.contains('duration-mode'));
    });
  });

  addSetBtn.addEventListener('click', () => {
    addSetRow(row);
  });

  nameInput.addEventListener('input', () => {
    showSuggestions(nameInput, suggestBox);
    autoDetectMode(row, nameInput.value);
  });
  nameInput.addEventListener('focus', () => {
    showSuggestions(nameInput, suggestBox);
  });
  nameInput.addEventListener('blur', () => {
    // delay so click on suggestion registers first
    setTimeout(() => { suggestBox.innerHTML = ''; }, 150);
  });

  // if a prefill name is present, run auto-detect once (won't override explicit prefill.mode)
  if (prefill?.name && prefill?.mode === undefined) {
    autoDetectMode(row, prefill.name, true);
  }

  // 세트별 입력 초기화: prefill.setDetails가 있으면 그대로, 없으면
  // weight/reps/sets(구버전 데이터 또는 신규 행)로부터 세트 생성
  if (!isDuration) {
    if (prefill?.setDetails && prefill.setDetails.length > 0) {
      prefill.setDetails.forEach(s => addSetRow(row, s));
    } else {
      const numSets = prefill?.sets ?? 1;
      for (let i = 0; i < numSets; i++) {
        addSetRow(row, { weight: prefill?.weight || '', reps: prefill?.reps || '', completed: false });
      }
    }
  }
}

// 새 세트 행 추가. 값이 없으면 마지막 세트의 무게/횟수를 복사.
function addSetRow(row, values) {
  const checklist = row.querySelector('.set-checklist');

  // build header if empty
  if (checklist.children.length === 0) {
    checklist.innerHTML = `<div class="set-checklist-header">
      <span>세트</span><span>무게(kg)</span><span>횟수</span><span>완료</span><span></span>
    </div>`;
  }

  let weight = values?.weight ?? '';
  let reps = values?.reps ?? '';
  const completed = values?.completed ?? false;

  // copy from last set if no values provided
  if (values === undefined) {
    const lastRow = checklist.querySelector('.set-row:last-child');
    if (lastRow) {
      weight = lastRow.querySelector('.set-weight').value;
      reps = lastRow.querySelector('.set-reps').value;
    }
  }

  const setRow = document.createElement('div');
  setRow.className = 'set-row';
  const setNum = checklist.querySelectorAll('.set-row').length + 1;
  setRow.innerHTML = `
    <div class="set-num">${setNum}</div>
    <input type="number" class="set-weight" value="${weight}">
    <input type="number" class="set-reps" value="${reps}">
    <div class="set-check ${completed ? 'checked' : ''}" onclick="this.classList.toggle('checked')">✓</div>
    <button class="set-del" onclick="removeSetRow(this)">✕</button>
  `;
  checklist.appendChild(setRow);
}

function removeSetRow(btn) {
  const setRow = btn.closest('.set-row');
  const checklist = setRow.closest('.set-checklist');
  setRow.remove();

  // renumber remaining sets
  checklist.querySelectorAll('.set-row').forEach((r, i) => {
    r.querySelector('.set-num').textContent = i + 1;
  });

  // if no sets left, remove header too
  if (checklist.querySelectorAll('.set-row').length === 0) {
    checklist.innerHTML = '';
  }
}



// 운동명이 유산소/모빌리티로만 인식되고 근력부위와 매칭되지 않으면
// 자동으로 "시간 입력" 모드로 전환 제안
function autoDetectMode(row, name, silent) {
  const muscles = getMusclesFromExerciseName(name);
  const activities = getActivityTagsFromExerciseName(name);

  if (muscles.length === 0 && activities.length > 0) {
    setRowMode(row, true);
  } else if (!silent && muscles.length > 0) {
    setRowMode(row, false);
  }
}

function setRowMode(row, durationMode) {
  const exRow = row.querySelector('.exercise-row');
  const duration = row.querySelector('.ex-duration');
  const checklist = row.querySelector('.set-checklist');
  const addSetBtn = row.querySelector('.add-set-btn');
  const toggleBtns = row.querySelectorAll('.row-mode-toggle');

  if (durationMode) {
    exRow.classList.add('duration-mode');
    duration.style.display = '';
    checklist.style.display = 'none';
    addSetBtn.style.display = 'none';
    toggleBtns[0].style.display = 'none';
    toggleBtns[1].style.display = '';
  } else {
    exRow.classList.remove('duration-mode');
    duration.style.display = 'none';
    checklist.style.display = '';
    addSetBtn.style.display = '';
    toggleBtns[0].style.display = '';
    toggleBtns[1].style.display = 'none';

    // 세트가 없으면 하나 추가
    if (checklist.querySelectorAll('.set-row').length === 0) {
      addSetRow(row, { weight: '', reps: '', completed: false });
    }
  }
}

function showSuggestions(inputEl, suggestBox) {
  const query = inputEl.value.trim();
  const suggestions = getExerciseSuggestions(query);

  if (suggestions.length === 0) {
    suggestBox.innerHTML = '';
    return;
  }

  suggestBox.innerHTML = suggestions.map(name =>
    `<div class="ex-suggest-item" onmousedown="event.preventDefault(); this.closest('.exercise-row-wrap').querySelector('.ex-name').value='${name.replace(/'/g, "\\'")}'; this.closest('.ex-suggest').innerHTML='';">${name}</div>`
  ).join('');
}

// 모달의 #exerciseRows에서 운동 목록을 추출 (저장/템플릿 저장 공용)
function extractExercisesFromForm() {
  const wraps = document.querySelectorAll('#exerciseRows .exercise-row-wrap');
  const exercises = [];

  wraps.forEach(wrap => {
    const row = wrap.querySelector('.exercise-row');
    const name = row.querySelector('.ex-name').value.trim();
    if (!name) return;

    if (row.classList.contains('duration-mode')) {
      const durationMin = parseInt(row.querySelector('.ex-duration').value) || 0;
      exercises.push({ name, mode: 'duration', durationMin, weight: 0, reps: 0, sets: 0 });
    } else {
      const setDetails = [];
      wrap.querySelectorAll('.set-row').forEach(setRow => {
        setDetails.push({
          weight: parseFloat(setRow.querySelector('.set-weight').value) || 0,
          reps: parseInt(setRow.querySelector('.set-reps').value) || 0,
          completed: setRow.querySelector('.set-check').classList.contains('checked'),
        });
      });

      // 대표 weight/reps/sets (구버전 호환 및 PR 계산용): 첫 세트 기준
      const first = setDetails[0] || { weight: 0, reps: 0 };
      exercises.push({
        name,
        weight: first.weight,
        reps: first.reps,
        sets: setDetails.length || 1,
        setDetails,
      });
    }
  });

  return exercises;
}

function saveWorkout() {
  const date = document.getElementById('workoutDate').value;
  const startTime = document.getElementById('workoutTime').value;
  const duration = parseInt(document.getElementById('workoutDuration').value) || 0;

  if (!date) { alert('날짜를 선택해주세요.'); return; }

  const exercises = extractExercisesFromForm();

  if (exercises.length === 0) { alert('최소 1개의 운동을 입력해주세요.'); return; }

  const workouts = loadWorkouts();

  if (editingIndex !== null) {
    // edit existing
    const existing = workouts[editingIndex];
    workouts[editingIndex] = {
      ...existing,
      date,
      startTime,
      duration,
      type: selectedType,
      exercises,
      updatedAt: new Date().toISOString(),
    };
  } else {
    // new
    workouts.push({
      date,
      startTime,
      duration,
      type: selectedType,
      exercises,
      createdAt: new Date().toISOString(),
    });
  }

  saveWorkouts(workouts);
  editingIndex = null;
  clearDraft();

  closeModal();
  renderHome();
  renderLog();
  if (document.getElementById('view-calendar').classList.contains('active')) {
    renderCalendar();
  }
}

// ============================================================
// Settings / Import / Export
// ============================================================
function saveSettings() {
  const baseRecoveryHours = parseInt(document.getElementById('baseRecoveryHours').value) || 48;
  saveSettingsToStorage({ baseRecoveryHours });
  renderHome();
}

function exportData() {
  const data = {
    workouts: loadWorkouts(),
    settings: loadSettings(),
    templates: loadTemplates(),
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recovr_backup_${formatDate(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.workouts) saveWorkouts(data.workouts);
      if (data.settings) saveSettingsToStorage(data.settings);
      if (data.templates) saveTemplates(data.templates);
      alert('데이터를 불러왔어요.');
      renderHome(); renderLog(); renderStats();
    } catch (err) {
      alert('파일을 읽을 수 없어요. JSON 형식을 확인해주세요.');
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (confirm('모든 운동 기록이 삭제됩니다. 계속하시겠어요?')) {
    if (confirm('정말로 삭제하시겠어요? 이 작업은 되돌릴 수 없어요.')) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SETTINGS_KEY);
      renderHome(); renderLog(); renderStats();
      alert('삭제되었어요.');
    }
  }
}

// ============================================================
// Seed data (optional - for first-time demo)
// ============================================================
function seedDemoData() {
  const existing = loadWorkouts();
  if (existing.length > 0) return;

  const today = new Date();
  const fmt = (daysAgo) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    return formatDate(d);
  };

  const demo = [
    {
      date: fmt(1), duration: 100, type: 'lower',
      exercises: [
        { name: '스쿼트', weight: 80, reps: 10, sets: 2 },
        { name: '스쿼트', weight: 60, reps: 10, sets: 1 },
        { name: '덤벨 런지', weight: 20, reps: 10, sets: 3 },
        { name: '시티드 레그 프레스', weight: 110, reps: 10, sets: 3 },
        { name: '시티드 레그 컬', weight: 55, reps: 10, sets: 3 },
        { name: '힙 어덕션 (이너 타이)', weight: 60, reps: 12, sets: 2 },
        { name: '힙 어브덕션 (아웃 타이)', weight: 60, reps: 12, sets: 2 },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      date: fmt(3), duration: 100, type: 'upper',
      exercises: [
        { name: '벤치 프레스', weight: 60, reps: 10, sets: 3 },
        { name: '체스트 프레스 머신', weight: 60, reps: 10, sets: 3 },
        { name: '랫 풀다운', weight: 47, reps: 10, sets: 3 },
        { name: '시티드 케이블 로우 (롱 풀)', weight: 47, reps: 10, sets: 3 },
        { name: '숄더 프레스 머신', weight: 40, reps: 10, sets: 3 },
        { name: '로프 암 풀다운', weight: 40, reps: 10, sets: 3 },
        { name: '바벨 컬', weight: 20, reps: 10, sets: 3 },
        { name: '덤벨 사이드 레터럴 레이즈', weight: 10, reps: 10, sets: 3 },
      ],
      createdAt: new Date().toISOString(),
    },
  ];

  saveWorkouts(demo);
}

// ============================================================
// Init
// ============================================================
function init() {
  // PWA: register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  // theme
  applyTheme(loadTheme());

  // date label
  const now = new Date();
  const dayNames = ['일','월','화','수','목','금','토'];
  document.getElementById('todayLabel').textContent =
    `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} (${dayNames[now.getDay()]})`;

  seedDemoData();
  renderHome();

  // refresh recovery every 60s while app is open
  setInterval(() => {
    const activeView = document.querySelector('.view.active').id;
    if (activeView === 'view-home') renderHome();
  }, 60000);
}

init();
