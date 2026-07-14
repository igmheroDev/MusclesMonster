// ============================================================
// RECOVR - 근육 회복 트래커
// 모든 계산은 로컬에서 수행됩니다. AI/외부 API 호출 없음.
// ============================================================

const APP_VERSION = '1.0.0';

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
    '크로스오버', '데클라인', '링 딥스', '불가리안 딥스', '체스트 딥스',
    '케이블 체스트 플라이', '체스트 서포티드 플라이', '스미스 머신 벤치'
  ],
  back: [
    '랫풀', '랫 풀', '풀다운', '풀업', '턱걸이', '로우', '로잉', '바벨로우',
    '시티드로우', '시티드 로우', '케이블 로우', '원암 로우', '백 익스텐션',
    '데드리프트', '데드', '슈러그', '트랩', '광배근', '등',
    '슈퍼맨', '굿모닝', '벤트오버', '풀오버', '리버스 플라이',
    '하이로우', '로우풀', '인버티드 로우', 'T바 로우', '티바 로우',
    '머신 로우', '체스트 서포티드 로우', '스트레이트 암 풀다운',
    '케이블 스트레이트 풀다운', '이지바 로우', '헥스 바 데드리프트'
  ],
  shoulder: [
    '숄더', '어깨', '오버헤드', '밀리터리 프레스', '프레스업', '쇼울더',
    '레터럴', '레이즈', '레이즈업', '프론트 레이즈', '리어 델트', '아놀드 프레스',
    '업라이트', '페이스 풀', '숄더프레스', '쇼울더 프레스', '삼각근', '델트',
    '리어 델트 머신', 'W레이즈', 'Y레이즈', 'T레이즈', '케이블 페이스 풀',
    '밴드 페이스 풀', '어깨 내회전', '어깨 외회전'
  ],
  biceps: [
    '컬', '바벨컬', '덤벨컬', '암컬', '이두', '이두근', '컨센트레이션',
    '해머컬', '프리처', '프리처컬', '케이블 컬', '스파이더 컬', '인클라인 컬',
    '리버스 컬', '21컬', '드래그컬', '바이셉', '크로스바디 해머컬',
    '케이블 해머 컬', '밴드 컬'
  ],
  triceps: [
    '트라이셉스', '삼두', '삼두근', '익스텐션', '킥백', '오버헤드 익스텐션',
    '푸시다운', '푸쉬다운', '로프 푸시다운', '로프 익스텐션', '로프 풀다운',
    '암 풀다운', '로프 암 풀다운', '스컬크러셔', '클로즈그립', '클로즈그립 벤치',
    '딥 머신', '트라이셉 익스텐션', '오버헤드 트라이셉스',
    'JM 프레스', '케이블 오버헤드 익스텐션', '밴드 푸시다운'
  ],
  quads: [
    '스쿼트', '레그프레스', '레그 프레스', '레그익스텐션', '레그 익스텐션',
    '런지', '핵스쿼트', '핵 스쿼트', '와이드 스쿼트', '점프 스쿼트', '피스톨 스쿼트',
    '대퇴사두', '스플릿 스쿼트', '불가리안 스플릿',
    '고블릿 스쿼트', '프론트 스쿼트', '백 스쿼트', '월싯', '스텝업',
    '스미스 머신 스쿼트', '스미스 런지', '박스 스쿼트', '박스 점프',
    '시저 런지', '리버스 런지', '워킹 런지'
  ],
  hamstrings: [
    '레그컬', '레그 컬', '햄스트링', '루마니안', '데드리프트', '굿모닝', '백런지',
    '글루트', '힙쓰러스트', '힙 쓰러스트', '브릿지', '글루트 브릿지', '둔근',
    '스티프 레그', '루마니안 데드리프트', 'rdl', '시티드 레그 컬', '라잉 레그컬',
    '케틀벨 스윙', '도그', '버드독',
    '바벨 힙 쓰러스트', '힙 쓰러스트 머신', '슈퍼맨 힙 익스텐션',
    '케이블 킥백', '도어 앵커 킥백', '싱글 레그 데드리프트',
    '노르딕 컬', '글루트 킥백 머신'
  ],
  adductors: [
    '어덕션', '어브덕션', '이너타이', '아웃타이', '이너 타이', '아웃 타이',
    '내전근', '외전근', '힙 어덕션', '힙 어브덕션', '인사이드 사이',
    '아웃사이드 사이', '어덕터', '어브덕터',
    '코펜하겐 플랭크', '슬라이딩 어덕션'
  ],
  calves: [
    '카프', '종아리', '카프레이즈', '카프 레이즈', '스탠딩 카프', '시티드 카프',
    '발끝', '레그프레스 카프', '동키 카프', '싱글 레그 카프레이즈'
  ],
  core: [
    '플랭크', '크런치', '복근', '코어', '싯업', '윗몸일으키기', '레그레이즈',
    '레그 레이즈', '행잉 레그', '러시안 트위스트', '바이시클', '마운틴 클라이머',
    '데드버그', '브이업', '사이드 플랭크', '에이비 휠', 'ab', '복부',
    'TRX 파이크', '드래곤 플래그', '케이블 우드찹', '토 투 바',
    'V싯업', 'L싯', '행잉 니 레이즈', '행잉 레그레이즈',
    '케이블 크런치', '씨 크런치', '스파이더 플랭크'
  ],
  forearms: [
    '리스트 컬', '손목', '전완', '그립', '파머스 워크',
    '리버스 리스트 컬', '바 행잉', '핑거 익스텐션', '그립 트레이너'
  ],
  mobility: [
    '스트레칭', '모빌리티', '동적스트레칭', '동적 스트레칭', '정적스트레칭', '정적 스트레칭',
    '폼롤러', '요가', '필라테스', '워밍업', '쿨다운', '고관절', '어깨회전'
  ],
  cardio: [
    '러닝', '조깅', '달리기', '트레드밀', '사이클', '싸이클', '자전거', '로잉머신',
    '로잉 머신', '일립티컬', '스텝퍼', '계단', '천국의계단', '천국의 계단', '스텝밀',
    '스텝 클라이머', '스텝클라이머', 'stairmaster', 'stair climber', '줄넘기', '점핑로프',
    '수영', '유산소', '인터벌', 'hiit', '버피', '클라이밍', '등산', '걷기', '파워워킹',
    '어설트 바이크', 'assault bike', '에어로우', 'concept2', '콘셉트2', '스핀', 'spin',
    '크로스트레이너', 'arc trainer', '워킹', '인클라인 워킹', '사이클링',
  ],
};

const WORKOUT_TYPE_META = {
  upper:  { label: '상체', cls: 'upper',  color: 'var(--cyan)' },
  lower:  { label: '하체', cls: 'lower',  color: 'var(--orange)' },
  full:   { label: '전신', cls: 'full',   color: 'var(--green)' },
  cardio: { label: '유산소', cls: 'cardio', color: 'var(--cardio)' },
};

function getWorkoutTypeMeta(type) {
  return WORKOUT_TYPE_META[type] || WORKOUT_TYPE_META.full;
}

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
  '딥스','맨몸 딥스','링 딥스','체스트 딥스','푸시업','와이드 푸시업',
  '케이블 크로스오버','케이블 체스트 플라이','스미스 머신 벤치 프레스',
  // 등
  '랫 풀다운','풀업','맨몸 턱걸이','어시스트 풀업',
  '시티드 케이블 로우','벤트오버 바벨로우','원암 덤벨 로우',
  '데드리프트','루마니안 데드리프트','헥스 바 데드리프트',
  '백 익스텐션','T바 로우','티바 로우','머신 로우','체스트 서포티드 로우',
  '풀오버','인버티드 로우','하이로우 머신','스트레이트 암 풀다운',
  // 어깨
  '숄더 프레스 머신','덤벨 숄더 프레스','오버헤드 프레스','바벨 밀리터리 프레스',
  '아놀드 프레스','덤벨 사이드 레터럴 레이즈','케이블 레터럴 레이즈',
  '프론트 레이즈','리어 델트 플라이','리어 델트 머신',
  '페이스 풀','케이블 페이스 풀','업라이트 로우','W레이즈',
  // 이두
  '바벨 컬','덤벨 컬','해머 컬','케이블 컬','프리처 컬',
  '인클라인 덤벨 컬','컨센트레이션 컬','크로스바디 해머컬','스파이더 컬',
  // 삼두
  '로프 트라이셉스 푸시다운','오버헤드 트라이셉스 익스텐션','스컬크러셔',
  '클로즈그립 벤치프레스','딥 머신','로프 암 풀다운','케이블 오버헤드 익스텐션',
  // 대퇴사두
  '스쿼트','바벨 백 스쿼트','프론트 스쿼트','스미스 머신 스쿼트','핵 스쿼트',
  '레그프레스','레그 익스텐션','런지','덤벨 런지','불가리안 스플릿 스쿼트',
  '고블릿 스쿼트','점프 스쿼트','박스 점프','월싯','스텝업',
  '워킹 런지','리버스 런지','시저 런지',
  // 둔근/햄스트링
  '레그컬','시티드 레그컬','라잉 레그컬',
  '힙 쓰러스트','바벨 힙 쓰러스트','힙 쓰러스트 머신','글루트 브릿지',
  '케틀벨 스윙','굿모닝','백 런지','RDL','싱글 레그 데드리프트',
  '케이블 킥백','글루트 킥백 머신','노르딕 컬',
  // 내전/외전근
  '힙 어덕션 머신','힙 어브덕션 머신','이너 타이','아웃 타이','코펜하겐 플랭크',
  // 종아리
  '스탠딩 카프레이즈','시티드 카프레이즈','레그프레스 카프레이즈',
  '동키 카프레이즈','싱글 레그 카프레이즈',
  // 코어
  '플랭크','사이드 플랭크','크런치','레그레이즈','행잉 레그레이즈',
  '러시안 트위스트','싯업','케이블 크런치','에이비 휠',
  'TRX 파이크','드래곤 플래그','케이블 우드찹','토 투 바',
  'V싯업','행잉 니 레이즈','마운틴 클라이머','데드버그',
  // 전완
  '리스트 컬','파머스 워크','리버스 리스트 컬','바 행잉',
  // 기능성 / 전신
  '배틀로프','슬레드 푸시','슬레드 풀','메디신볼 슬램','케틀벨 클린',
  '케틀벨 스내치','터키시 겟업',
  // 유산소
  '러닝','트레드밀 러닝','사이클','실내자전거','로잉머신',
  '천국의 계단','스텝퍼','일립티컬','크로스트레이너',
  '줄넘기','수영','계단 오르기','걷기','버피','인터벌 러닝',
  '어설트 바이크','스핀','인클라인 워킹',
  // 모빌리티
  '스트레칭','모빌리티','동적 스트레칭','정적 스트레칭',
  '폼롤러','요가','필라테스','워밍업','쿨다운',
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

// 종목 피커용 전체 운동명 목록 (최근 사용 우선 + 사전)
function getAllExerciseNames() {
  const workouts = loadWorkouts();
  const usedNames = [];
  [...workouts].reverse().forEach(w => {
    (w.exercises || []).forEach(ex => {
      if (ex.name && !usedNames.includes(ex.name)) usedNames.push(ex.name);
    });
  });

  const seen = new Set();
  const results = [];
  for (const name of [...usedNames, ...COMMON_EXERCISES]) {
    if (!seen.has(name)) {
      seen.add(name);
      results.push(name);
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

// 완료된 운동만 (진행 중 임시 기록 제외)
function getCompletedWorkouts() {
  return loadWorkouts().filter(w => !w.inProgress);
}

let backupWriteInProgress = false;
let backupWritePending = false;
let backupDebounceTimer = null;

function triggerAutoBackup() {
  if (!backupRootHandle) return;
  clearTimeout(backupDebounceTimer);
  backupDebounceTimer = setTimeout(() => {
    writeBackupFile();
  }, 300);
}

function buildBackupPayload() {
  const payload = {
    workouts: loadWorkouts(),
    settings: loadSettings(),
    templates: loadTemplates(),
    exportedAt: new Date().toISOString(),
  };
  // 데일리 미션 완료 기록도 백업에 포함
  try {
    const missionRaw = localStorage.getItem('recovr_daily_missions_v1');
    if (missionRaw) payload.dailyMissions = JSON.parse(missionRaw);
  } catch (_) {}
  return payload;
}

// ============================================================
// 파일 시스템 자동 백업 (File System Access API)
// 지원 브라우저(Chrome/Edge 등)에서는 폰/PC의 실제 파일에
// 운동 기록이 저장될 때마다 자동으로 덮어쓰기 백업됨.
// iOS Safari는 미지원 -> 수동 내보내기로 안내.
// ============================================================
let backupRootHandle = null; // FileSystemFileHandle | FileSystemDirectoryHandle

// ============================================================
// PWA 설치 안내 (beforeinstallprompt 이벤트 캡처)
// ============================================================
let pwaInstallPrompt = null; // beforeinstallprompt 이벤트 저장

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  pwaInstallPrompt = e;
  renderPwaInstallSection(); // 설정 뷰가 열려 있으면 즉시 갱신
});

window.addEventListener('appinstalled', () => {
  pwaInstallPrompt = null;
  renderPwaInstallSection();
});

function isRunningAsPwa() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroid() {
  return /android/i.test(navigator.userAgent);
}

function renderPwaInstallSection() {
  const section = document.getElementById('pwaInstallSection');
  if (!section) return;

  if (isRunningAsPwa()) {
    // 이미 앱으로 실행 중
    section.innerHTML = `
      <div class="settings-row" style="background:rgba(0,255,157,0.05);border-color:rgba(0,255,157,0.2)">
        <div>
          <div class="sr-label" style="color:var(--green)">✅ 앱으로 실행 중</div>
          <div class="sr-sub">홈 화면에 설치되어 앱처럼 동작하고 있어요.</div>
        </div>
      </div>`;
    return;
  }

  if (pwaInstallPrompt) {
    // Android Chrome - 브라우저가 설치 배너 제공 가능
    section.innerHTML = `
      <div class="settings-row">
        <div>
          <div class="sr-label">홈 화면에 앱 추가</div>
          <div class="sr-sub">아이콘을 만들어 앱처럼 바로 실행할 수 있어요.</div>
        </div>
        <span class="add-link" onclick="triggerPwaInstall()" style="color:var(--green);white-space:nowrap">+ 설치</span>
      </div>`;
    return;
  }

  if (isIos()) {
    // iPhone/iPad - Safari에서 수동 안내
    section.innerHTML = `
      <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:10px">
        <div>
          <div class="sr-label">📱 iPhone 홈 화면에 추가</div>
          <div class="sr-sub">Safari에서 아래 단계를 따라 하세요.</div>
        </div>
        <div style="font-size:11.5px;line-height:1.85;color:var(--text);width:100%">
          1️⃣ <b>Safari</b>로 이 페이지를 열기<br>
          2️⃣ 하단 <b>공유 버튼 (□↑)</b> 탭<br>
          3️⃣ <b>"홈 화면에 추가"</b> 선택<br>
          4️⃣ 오른쪽 위 <b>"추가"</b> 탭
        </div>
        <div style="font-size:10px;color:var(--muted)">⚠️ Chrome, Edge 등 다른 브라우저에서는 PWA 설치가 지원되지 않아요.</div>
      </div>`;
    return;
  }

  if (isAndroid()) {
    // Android - Chrome 외 브라우저이거나 아직 프롬프트 없음
    section.innerHTML = `
      <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:10px">
        <div>
          <div class="sr-label">📱 Android 홈 화면에 추가</div>
          <div class="sr-sub">Chrome 브라우저에서 아래 단계를 따라 하세요.</div>
        </div>
        <div style="font-size:11.5px;line-height:1.85;color:var(--text);width:100%">
          1️⃣ <b>Chrome</b>으로 이 페이지를 열기<br>
          2️⃣ 우측 상단 <b>메뉴 (⋮)</b> 탭<br>
          3️⃣ <b>"홈 화면에 추가"</b> 또는 <b>"앱 설치"</b> 선택
        </div>
      </div>`;
    return;
  }

  // PC 또는 기타
  section.innerHTML = `
    <div class="settings-row">
      <div>
        <div class="sr-label">앱 설치</div>
        <div class="sr-sub">Chrome/Edge 주소창 오른쪽의 설치 아이콘을 눌러 설치할 수 있어요.</div>
      </div>
    </div>`;
}

async function triggerPwaInstall() {
  if (!pwaInstallPrompt) return;
  pwaInstallPrompt.prompt();
  const { outcome } = await pwaInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    pwaInstallPrompt = null;
    renderPwaInstallSection();
  }
}

function isFileSystemAccessSupported() {
  if (typeof BackupWriter !== 'undefined') {
    return BackupWriter.supportsAutoFileBackup();
  }
  return 'showSaveFilePicker' in window;
}

async function clearBackupConnection() {
  backupRootHandle = null;
  localStorage.removeItem('recovr_backup_linked');
  if (typeof BackupStorage !== 'undefined') {
    await BackupStorage.clearBackupHandle();
  }
  updateBackupStatus();
}

async function linkBackupFile() {
  if (!isFileSystemAccessSupported()) {
    const msg = typeof BackupWriter !== 'undefined'
      ? BackupWriter.getUnsupportedBrowserMessage()
      : '이 브라우저는 파일 자동 저장을 지원하지 않아요.\n\n대신 "전체 데이터보내기"로 수동 백업해주세요.';
    alert(msg);
    return;
  }

  if (typeof BackupWriter === 'undefined') {
    alert('백업 모듈을 불러오지 못했어요. 페이지를 새로고침해주세요.');
    return;
  }

  try {
    const json = JSON.stringify(buildBackupPayload(), null, 2);

    // 1) IndexedDB에 남아 있는 핸들이 있으면 파일 재선택 없이 권한만 복원
    if (typeof BackupStorage !== 'undefined') {
      const stored = await BackupStorage.loadBackupHandle();
      if (stored) {
        let restored = false;
        if (typeof BackupReconnect !== 'undefined') {
          const result = await BackupReconnect.restoreWithGesture(stored);
          restored = result.status === 'restored';
        } else {
          const perm = await stored.requestPermission({ mode: 'readwrite' });
          restored = perm === 'granted';
        }

        if (restored) {
          const writeResult = await BackupWriter.writeToRoot(stored, json);
          if (writeResult.ok) {
            backupRootHandle = stored;
            localStorage.setItem('recovr_backup_linked', 'true');
            if (typeof BackupReconnect !== 'undefined') BackupReconnect.hideBanner();
            updateBackupStatus();
            return;
          }
          // 권한은 살아 있으니 핸들은 유지 (연결을 지우지 않음)
          console.warn('[Backup] 재연결 후 쓰기 실패(핸들 유지):', writeResult.error);
          backupRootHandle = stored;
          localStorage.setItem('recovr_backup_linked', 'true');
          updateBackupStatus();
          const reconnectMsg = BackupWriter.describeError(writeResult.error);
          if (reconnectMsg) alert(reconnectMsg);
          return;
        }
      }
    }

    if (BackupWriter.prefersDirectoryBackup()) {
      if (!confirm(BackupWriter.getMobileConnectGuide() + '\n\n계속하시겠어요?')) {
        return;
      }
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const dirResult = await BackupWriter.writeToDirectory(dirHandle, json);
      if (!dirResult.ok) {
        const msg = BackupWriter.describeError(dirResult.error);
        if (msg) alert(msg);
        return;
      }
      backupRootHandle = dirHandle;
      if (typeof BackupStorage !== 'undefined') {
        await BackupStorage.saveBackupHandle(backupRootHandle);
      }
      localStorage.setItem('recovr_backup_linked', 'true');
      if (typeof BackupReconnect !== 'undefined') BackupReconnect.hideBanner();
      updateBackupStatus();
      return;
    }

    const handle = await window.showSaveFilePicker({
      suggestedName: BackupWriter.BACKUP_FILE_NAME,
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    });

    const fileResult = await BackupWriter.writeToFileHandle(handle, json);
    if (!fileResult.ok) {
      const msg = BackupWriter.describeError(fileResult.error);
      if (msg) alert(msg);
      return;
    }

    backupRootHandle = handle;
    if (typeof BackupStorage !== 'undefined') {
      await BackupStorage.saveBackupHandle(backupRootHandle);
    }
    localStorage.setItem('recovr_backup_linked', 'true');
    if (typeof BackupReconnect !== 'undefined') BackupReconnect.hideBanner();
    updateBackupStatus();
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('백업 파일 연결 실패:', err);
      const msg = BackupWriter.describeError(err);
      if (msg) alert(msg);
    }
  }
}

async function writeBackupFile() {
  if (!backupRootHandle || typeof BackupWriter === 'undefined') return false;
  if (backupWriteInProgress) {
    backupWritePending = true;
    return false;
  }

  backupWriteInProgress = true;

  const json = JSON.stringify(buildBackupPayload(), null, 2);
  if (!json || json.length < 10) {
    backupWriteInProgress = false;
    return false;
  }

  let originalContent = null;
  if (!BackupWriter.shouldSkipPreRead() && backupRootHandle.kind === 'file') {
    try {
      const existingFile = await backupRootHandle.getFile();
      if (existingFile.size > 0) {
        originalContent = await existingFile.text();
      }
    } catch (_) { /* ignore */ }
  }

  const result = await BackupWriter.writeToRoot(backupRootHandle, json);
  const success = result.ok;

  if (!success) {
    if (originalContent && originalContent.length > 10 && backupRootHandle.kind === 'file') {
      await BackupWriter.writeToFileHandle(backupRootHandle, originalContent);
    }
    console.error('[Backup] 자동 백업 실패:', result.error);
  }

  backupWriteInProgress = false;
  if (backupWritePending) {
    backupWritePending = false;
    writeBackupFile();
  }
  return success;
}

function updateBackupGuideText() {
  const el = document.getElementById('backupGuideText');
  if (!el || typeof BackupWriter === 'undefined') return;
  el.textContent = BackupWriter.getSettingsGuide();
}

function updateBackupStatus() {
  const el = document.getElementById('backupStatus');
  if (!el) return;

  const manualBtn = document.getElementById('manualBackupBtn');
  const linkBtn = document.getElementById('linkBackupBtn');

  if (!isFileSystemAccessSupported()) {
    const hint = typeof BackupWriter !== 'undefined'
      ? BackupWriter.getBackupStatusHint()
      : '이 브라우저 미지원 (수동보내기 이용)';
    el.textContent = hint;
    if (linkBtn) linkBtn.style.display = 'none';
    if (manualBtn) manualBtn.style.display = 'none';
    return;
  }

  if (backupRootHandle) {
    const label = typeof BackupWriter !== 'undefined'
      ? BackupWriter.getRootLabel(backupRootHandle)
      : backupRootHandle.name;
    el.textContent = `연결됨: ${label}`;
    if (manualBtn) manualBtn.style.display = '';
    if (linkBtn) linkBtn.textContent = '변경';
  } else if (localStorage.getItem('recovr_backup_linked') === 'true') {
    el.textContent = '재연결 필요 (연결 버튼 한 번 탭)';
    if (manualBtn) manualBtn.style.display = 'none';
    if (linkBtn) linkBtn.textContent = '연결';
  } else {
    el.textContent = '연결 안 됨';
    if (manualBtn) manualBtn.style.display = 'none';
    if (linkBtn) linkBtn.textContent = '연결';
  }
}

async function manualBackupSave() {
  if (!backupRootHandle) {
    alert('백업 파일이 연결되지 않았어요. 먼저 연결해주세요.');
    return;
  }
  const btn = document.getElementById('manualBackupBtn');
  const original = btn ? btn.textContent : '';
  if (btn) btn.textContent = '저장 중...';
  const ok = await writeBackupFile();
  if (btn) {
    btn.textContent = ok ? '✓ 저장됨' : '⚠️ 실패';
    setTimeout(() => { btn.textContent = original; }, 1800);
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const settings = raw ? JSON.parse(raw) : { baseRecoveryHours: 48 };
    if (typeof UserProfile !== 'undefined') {
      return UserProfile.mergeIntoSettings(settings);
    }
    return settings;
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

// duration 모드 운동(플랭크 등 시간 기반 등척성 운동)의 초당 환산 부하 (kg/초)
// 기준: core REFERENCE_VOLUME 500 기준, 3세트×60초=180초 → 180×3.0=540 ≈ 평균 세션(factor≈1.0)
// 대근육(chest, back 등)은 REFERENCE_VOLUME이 커서 자동으로 "가벼운 세션(0.5배 클램프)"으로 처리됨
const DURATION_LOAD_PER_SECOND = 3.0;

// 부위별 기본 회복 시간 (시간) - 근육 크기와 피로 특성 반영
// 사용자의 "회복 속도" 설정이 이 값에 배율로 적용됩니다.
// 기준: 설정 48h = ×1.0 (보통), 36h = ×0.75 (빠름), 60h = ×1.25 (느림)
const MUSCLE_BASE_RECOVERY = {
  forearms:   36,  // 소근육 · 일상에서 지속 사용 · 회복 빠름
  biceps:     38,  // 소근육
  triceps:    38,  // 소근육
  calves:     40,  // 소근육 · 지근 비율 높아 회복 빠름
  core:       40,  // 자세근 · 지근 비율 높음
  adductors:  44,  // 중소 근육
  shoulder:   48,  // 중근육 · 다관절 참여
  chest:      52,  // 중대 근육 · 다관절
  back:       60,  // 대근육 · 복합 근육군
  hamstrings: 64,  // 대근육 · 집중 자극 → 회복 느림
  quads:      64,  // 대근육 · 하체 주력
};

// 운동명을 정규화 (소문자화, 공백/특수문자 제거 후 비교용 버전도 생성)
function normalizeExerciseName(name) {
  if (name == null || name === '') return '';
  return String(name).toLowerCase().replace(/\s+/g, '');
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

// duration 모드 운동의 근육 회복 계산용 환산 부하를 반환.
// 완료(completed)된 세트의 초합계에 DURATION_LOAD_PER_SECOND를 곱해 합산.
// durationSets가 없으면 durationMin(분)으로 폴백.
// 회복 계산(calcMuscleRecovery) 전용 — 볼륨 표시 UI에는 사용하지 않음.
function getDurationLoad(ex) {
  if (ex.mode !== 'duration') return 0;
  if (ex.durationSets && ex.durationSets.length > 0) {
    const completedSeconds = ex.durationSets.reduce((sum, s) => {
      return s.completed ? sum + (s.seconds || 0) : sum;
    }, 0);
    return completedSeconds * DURATION_LOAD_PER_SECOND;
  }
  return (ex.durationMin || 0) * 60 * DURATION_LOAD_PER_SECOND;
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
  // 사용자 설정값 + 프로필 보정으로 개인 회복 속도 배율 계산
  const userScale = (typeof UserProfile !== 'undefined')
    ? UserProfile.getRecoveryScale(settings)
    : (settings.baseRecoveryHours || 48) / 48;
  const result = {};

  MUSCLE_ORDER.forEach(m => {
    const muscleBase = (MUSCLE_BASE_RECOVERY[m] || 48) * userScale;
    result[m] = { volume: 0, lastDate: null, recoveryPct: 100, hoursElapsed: null, recoveryHours: Math.round(muscleBase), exercises: [] };
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
          const vol = ex.mode === 'duration' ? getDurationLoad(ex) : getExerciseVolume(ex);
          sessionVolumeForMuscle += vol;
          exNames.push(ex.name);
        }
      });

      if (sessionVolumeForMuscle > 0) {
        if (!mostRecentDate || wDate > mostRecentDate) {
          mostRecentDate = wDate;
          mostRecent = { volume: sessionVolumeForMuscle, exercises: exNames, date: w.date, fatigue: w.fatigue || 3 };
        }
      }
    });

    if (mostRecent) {
      const hoursElapsed = (now - mostRecentDate) / (1000 * 60 * 60);
      const refVol = REFERENCE_VOLUME[muscleKey] || 2000;
      const intensityFactor = mostRecent.volume / refVol; // 1.0 = average session
      // 볼륨 강도에 따라 0.5~2.0배 보정
      const clampedFactor = Math.max(0.5, Math.min(2.0, intensityFactor));
      // 피로도 보정: 1(0.7배)~5(1.55배), 기본 3(1.0배)
      const fatigueScale = FATIGUE_RECOVERY_SCALE[mostRecent.fatigue] || 1.0;
      const muscleBase = (MUSCLE_BASE_RECOVERY[muscleKey] || 48) * userScale;
      const recoveryHours = muscleBase * clampedFactor * fatigueScale;

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
// 연속 운동일(Streak) 계산
// 오늘 또는 어제까지 운동 기록이 있으면 연속으로 인정
function calcStreak(workouts) {
  if (workouts.length === 0) return 0;

  const dates = new Set(workouts.map(w => w.date));
  const today = formatDate(new Date());

  let streak = 0;
  let cursor = new Date();
  cursor.setHours(12, 0, 0, 0);

  // 오늘 운동 기록이 없으면 어제부터 체크 (하루 유예)
  if (!dates.has(today)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const ds = formatDate(cursor);
    if (!dates.has(ds)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function renderStreak(workouts) {
  const pill = document.getElementById('streakPill');
  if (!pill) return;
  const streak = calcStreak(workouts);
  if (streak < 2) {
    pill.style.display = 'none';
    return;
  }
  pill.style.display = '';
  pill.classList.toggle('hot', streak >= 7);
  pill.textContent = `🔥 ${streak}일 연속`;
}

function renderHome() {
  // 히어로를 먼저 갱신해 "—" 고착을 방지
  try {
    const pctEl = document.getElementById('overallPct');
    if (pctEl) pctEl.innerHTML = `100<span class="unit">% 회복</span>`;
  } catch (_) { /* ignore */ }

  let workouts = [];
  let settings = { baseRecoveryHours: 48 };
  let recovery = {};
  let active = [];

  try {
    workouts = getCompletedWorkouts();
  } catch (e) {
    console.warn('[RECOVR] 운동 로드 실패:', e);
  }

  try {
    settings = loadSettings() || { baseRecoveryHours: 48 };
  } catch (e) {
    console.warn('[RECOVR] 설정 로드 실패:', e);
  }

  try {
    recovery = calcMuscleRecovery(workouts, settings) || {};
  } catch (e) {
    console.warn('[RECOVR] 회복도 계산 실패:', e);
    recovery = {};
  }

  try {
    active = MUSCLE_ORDER.filter(m => recovery[m] && recovery[m].lastDate !== null);
  } catch (e) {
    active = [];
  }

  let overallPct = 100;
  if (active.length > 0) {
    try {
      overallPct = Math.round(active.reduce((sum, m) => sum + (recovery[m].recoveryPct || 0), 0) / active.length);
    } catch (_) {
      overallPct = 100;
    }
  }

  try {
    document.getElementById('overallPct').innerHTML = `${overallPct}<span class="unit">% 회복</span>`;
  } catch (_) { /* ignore */ }

  try {
    checkRecoveryNotifications(recovery);
  } catch (e) {
    console.warn('[RECOVR] 알림 체크 실패:', e);
  }

  try {
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
    if (ring) {
      ring.style.background = ringBg;
      ring.textContent = ringIcon;
    }
    const descEl = document.getElementById('overallDesc');
    if (descEl) descEl.textContent = desc;
  } catch (e) {
    console.warn('[RECOVR] 히어로 렌더 실패:', e);
  }

  try {
    const profileSummaryEl = document.getElementById('profileSummary');
    if (profileSummaryEl) {
      const summary = (typeof UserProfile !== 'undefined')
        ? UserProfile.getHomeSummary(settings.profile, settings)
        : '';
      profileSummaryEl.textContent = summary;
      profileSummaryEl.style.display = summary ? '' : 'none';
    }
  } catch (e) {
    console.warn('[RECOVR] 프로필 요약 실패:', e);
  }

  try { renderStreak(workouts); } catch (e) { console.warn('[RECOVR] 스트릭 실패:', e); }
  try { renderWeekBar(workouts); } catch (e) { console.warn('[RECOVR] 주간바 실패:', e); }

  try {
    if (typeof WorkoutGoals !== 'undefined') WorkoutGoals.renderHomeCard();
  } catch (e) {
    console.warn('[RECOVR] 목표 카드 렌더 실패:', e);
  }

  try {
    if (typeof WorkoutRecommendation !== 'undefined') WorkoutRecommendation.render();
  } catch (e) {
    console.warn('[RECOVR] 추천 카드 렌더 실패:', e);
  }

  try {
    if (typeof WorkoutAdvice !== 'undefined') WorkoutAdvice.render();
  } catch (e) {
    console.warn('[RECOVR] 조언 카드 렌더 실패:', e);
  }

  try {
    if (typeof CardioTracker !== 'undefined') CardioTracker.renderHomeCard();
  } catch (e) {
    console.warn('[RECOVR] 유산소 카드 렌더 실패:', e);
  }

  try {
    if (typeof CardioMetrics !== 'undefined') CardioMetrics.renderHomeHint();
  } catch (e) {
    console.warn('[RECOVR] 유산소 세부 지표 렌더 실패:', e);
  }

  try {
    if (typeof AiCoach !== 'undefined') AiCoach.renderHomeCard();
  } catch (e) {
    console.warn('[RECOVR] AI 코치 카드 렌더 실패:', e);
  }

  try {
    if (typeof DailyMission !== 'undefined') DailyMission.renderHomeCard();
  } catch (e) {
    console.warn('[RECOVR] 데일리 미션 카드 렌더 실패:', e);
  }

  try {
    if (typeof MuscleHeatmap !== 'undefined') MuscleHeatmap.render(recovery, active);
  } catch (e) {
    console.warn('[RECOVR] 히트맵 렌더 실패:', e);
  }

  const muscleList = document.getElementById('muscleList');
  if (!muscleList) return;

  try {
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

    const sorted = [...active].sort((a, b) => recovery[a].recoveryPct - recovery[b].recoveryPct);

    sorted.forEach(m => {
      const r = recovery[m];
      const label = MUSCLE_LABELS[m];
      if (!r || !label) return;
      const badge = getStatusBadge(r.recoveryPct);
      const barColor = getBarColor(r.recoveryPct);
      const exNames = [...new Set(r.exercises || [])].join(' · ');

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
  } catch (e) {
    console.warn('[RECOVR] 근육 목록 렌더 실패:', e);
    muscleList.innerHTML = `
      <div class="empty-state">
        <div class="ee-icon">📭</div>
        <div class="ee-title">아직 운동 기록이 없어요</div>
        <div class="ee-body">하단의 + 버튼을 눌러<br>첫 운동을 기록해보세요.</div>
      </div>`;
  }
}

function getPctColor(pct) {
  if (pct < 40) return 'var(--red)';
  if (pct < 70) return 'var(--orange)';
  if (pct < 95) return 'var(--yellow)';
  return 'var(--green)';
}

function renderWeekBar(workouts) {
  const weekBar = document.getElementById('weekBar');
  if (!weekBar) return;
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
    else if (type === 'full') { cls += ' workout-full'; content = '전'; }
    else if (type === 'cardio') { cls += ' workout-cardio'; content = '유'; }
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

// 운동 세부 내용 HTML 생성 (캘린더 day detail과 공용)
function buildExerciseDetailHTML(w, realIdx) {
  const grouped = {};
  (w.exercises || []).forEach(ex => {
    if (!grouped[ex.name]) grouped[ex.name] = [];
    if (ex.mode === 'duration') {
      if (ex.durationSets?.length && typeof DurationTimer !== 'undefined') {
        ex.durationSets.forEach((s) => {
          const mark = s.completed ? '' : ' (미완료)';
          grouped[ex.name].push(`${DurationTimer.formatSeconds(s.seconds)}${mark}`);
        });
      } else {
        grouped[ex.name].push(`${ex.durationMin || '-'}분`);
      }
      if (typeof CardioMetrics !== 'undefined') {
        const metricsSummary = CardioMetrics.formatSummary(ex);
        if (metricsSummary) grouped[ex.name].push(metricsSummary);
      }
    } else if (ex.setDetails && ex.setDetails.length > 0) {
      ex.setDetails.forEach(s => {
        const mark = s.completed ? '' : ' (미완료)';
        grouped[ex.name].push(`${s.weight}kg×${s.reps}${mark}`);
      });
    } else {
      grouped[ex.name].push(`${ex.weight || '-'}kg×${ex.reps || '-'}`);
    }
  });

  return Object.entries(grouped).map(([name, sets]) => `
    <div class="exercise-detail-row" onclick="event.stopPropagation(); openEditModal(${realIdx})">
      <span class="ex-name">${name}</span>
      <span class="ex-sets">${sets.join(', ')}</span>
    </div>`).join('');
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
  const FATIGUE_EMOJI = ['','😌','🙂','😐','😓','🥵'];

  sorted.forEach((w) => {
    const realIdx = workouts.indexOf(w);
    const totalVolume = (w.exercises || []).reduce((sum, ex) => sum + getExerciseVolume(ex), 0);
    const typeMeta = getWorkoutTypeMeta(w.type);
    const typeLabel = typeMeta.label;
    const typeCls = typeMeta.cls;
    const cardioMin = (typeof CardioTracker !== 'undefined') ? CardioTracker.getWorkoutCardioMinutes(w) : 0;
    const dateObj = new Date(w.date + 'T12:00:00');
    const dowLabels = ['일','월','화','수','목','금','토'];
    const dateStr = `${dateObj.getMonth()+1}월 ${dateObj.getDate()}일 (${dowLabels[dateObj.getDay()]})`;

    const activityTags = new Set();
    (w.exercises || []).forEach(ex => {
      getActivityTagsFromExerciseName(ex.name).forEach(tag => activityTags.add(tag));
    });
    let tagsHtml = '';
    activityTags.forEach(tag => {
      const lbl = NON_MUSCLE_LABELS[tag];
      tagsHtml += `<span class="activity-tag">${lbl.icon} ${lbl.name}</span>`;
    });

    const exDetailHTML = buildExerciseDetailHTML(w, realIdx);
    const itemId = `wi-${realIdx}`;
    const panelId = `wp-${realIdx}`;
    const progressBadge = w.inProgress
      ? '<span class="wi-type" style="padding:1px 6px;font-size:9px;background:rgba(0,229,255,0.15);color:var(--cyan)">진행 중</span>'
      : '';

    const item = document.createElement('div');
    item.className = 'workout-item' + (w.inProgress ? ' in-progress' : '');
    item.id = itemId;
    item.innerHTML = `
      <div class="wi-top" onclick="toggleWorkoutDetail('${panelId}', '${itemId}')">
        <div>
          <div class="wi-date">${dateStr}</div>
          <div class="wi-meta" style="margin-top:4px">
            <span><span class="wi-type ${typeCls}" style="padding:1px 6px;font-size:9px">${typeLabel}</span></span>
            ${progressBadge}
            ${w.type === 'cardio' || cardioMin > 0
              ? `<span>유산소 <b>${cardioMin || w.duration || '-'}</b>분</span>`
              : `<span>볼륨 <b>${totalVolume.toLocaleString()}</b> kg</span>`}
            <span>${w.duration || '-'}분</span>
            ${w.fatigue ? `<span>${FATIGUE_EMOJI[w.fatigue]}</span>` : ''}
          </div>
          ${tagsHtml ? `<div style="margin-top:4px">${tagsHtml}</div>` : ''}
        </div>
        <span class="wi-expand-icon" id="icon-${realIdx}">▼</span>
      </div>
      <div class="workout-detail-panel" id="${panelId}">
        <div style="padding:10px 0 4px">
          ${exDetailHTML}
          <div style="display:flex;gap:6px;margin-top:10px">
            <button class="wi-action" style="flex:1;width:auto;border-radius:8px;font-size:12px;padding:6px" onclick="event.stopPropagation();openEditModal(${realIdx})">✏️ 수정</button>
            <button class="wi-action" style="flex:1;width:auto;border-radius:8px;font-size:12px;padding:6px;color:var(--red)" onclick="event.stopPropagation();deleteWorkoutPrompt(${realIdx})">🗑️ 삭제</button>
          </div>
        </div>
      </div>`;
    list.appendChild(item);
  });
}

function toggleWorkoutDetail(panelId, itemId) {
  const panel = document.getElementById(panelId);
  const idx = panelId.replace('wp-', '');
  const icon = document.getElementById('icon-' + idx);
  if (!panel) return;
  const isOpen = panel.classList.contains('open');
  // 다른 열린 패널 모두 닫기
  document.querySelectorAll('.workout-detail-panel.open').forEach(p => {
    p.classList.remove('open');
  });
  document.querySelectorAll('.wi-expand-icon.open').forEach(ic => ic.classList.remove('open'));
  if (!isOpen) {
    panel.classList.add('open');
    if (icon) icon.classList.add('open');
  }
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
  const workouts = getCompletedWorkouts();
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const thisWeek = workouts.filter(w => new Date(w.date) >= weekAgo);
  const weekVolume = thisWeek.reduce((sum, w) => sum + (w.exercises||[]).reduce((s,ex)=>s+getExerciseVolume(ex),0), 0);
  const upperCount = thisWeek.filter(w => w.type === 'upper').length;
  const lowerCount = thisWeek.filter(w => w.type === 'lower').length;
  const cardioCount = thisWeek.filter(w => w.type === 'cardio' || (typeof CardioTracker !== 'undefined' && CardioTracker.isCardioWorkout(w))).length;
  const weekCardioMin = (typeof CardioTracker !== 'undefined')
    ? CardioTracker.getWeeklyStats(thisWeek, 7).totalMinutes
    : 0;

  const totalVolume = workouts.reduce((sum, w) => sum + (w.exercises||[]).reduce((s,ex)=>s+getExerciseVolume(ex),0), 0);

  document.getElementById('statWeekVolume').textContent = weekVolume.toLocaleString();
  document.getElementById('statWeekCount').textContent = thisWeek.length;
  document.getElementById('statUpperCount').textContent = upperCount;
  document.getElementById('statLowerCount').textContent = lowerCount;
  if (document.getElementById('statCardioMin')) {
    document.getElementById('statCardioMin').textContent = weekCardioMin;
  }
  if (document.getElementById('statCardioCount')) {
    document.getElementById('statCardioCount').textContent = cardioCount;
  }
  document.getElementById('statTotalVolume').textContent = totalVolume.toLocaleString();
  document.getElementById('statTotalCount').textContent = workouts.length;

  renderTrendChart(workouts);
  renderWeeklyFrequency(workouts);
  renderPRList(workouts);
  if (typeof CardioTracker !== 'undefined') {
    CardioTracker.renderTrendChart(workouts);
    CardioTracker.renderMachineBreakdown(workouts);
  }
  try {
    if (typeof CardioMetrics !== 'undefined') CardioMetrics.renderStatsCard(workouts);
  } catch (e) { /* ignore */ }
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
    const color = w.type === 'lower' ? 'var(--orange)' : w.type === 'cardio' ? 'var(--cardio)' : w.type === 'full' ? 'var(--green)' : 'var(--cyan)';
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
let logTabMode = 'list'; // 'list' | 'week' | 'month'

function setLogTab(mode) {
  logTabMode = mode;
  document.getElementById('logTabList').classList.toggle('selected', mode === 'list');
  document.getElementById('logTabWeek').classList.toggle('selected', mode === 'week');
  document.getElementById('logTabMonth').classList.toggle('selected', mode === 'month');
  document.getElementById('logListView').style.display  = mode === 'list'  ? '' : 'none';
  document.getElementById('logWeekView').style.display  = mode === 'week'  ? '' : 'none';
  document.getElementById('logMonthView').style.display = mode === 'month' ? '' : 'none';

  const icsBtn = document.querySelector('#view-log .save-btn');
  if (icsBtn) icsBtn.style.display = mode === 'list' ? 'none' : '';

  if (mode === 'list') renderLog();
  else renderCalendar();
}

function changeCalMonth(delta) {
  calViewDate.setMonth(calViewDate.getMonth() + delta);
  renderCalendar();
}

function changeCalWeek(delta) {
  calWeekDate.setDate(calWeekDate.getDate() + delta * 7);
  renderCalendar();
}

const ACTIVITY_ICONS = { upper: '💪', lower: '🦵', full: '🔥', cardio: '🏃' };

function buildCalendarByDate() {
  const byDate = {};
  getCompletedWorkouts().forEach(w => {
    if (!byDate[w.date]) byDate[w.date] = [];
    byDate[w.date].push(w);
  });
  return byDate;
}

function getCalStatusClass(hasWorkout, hasMission) {
  if (hasWorkout && hasMission) return 'cal-status-both';
  if (hasWorkout) return 'cal-status-workout';
  if (hasMission) return 'cal-status-mission';
  return '';
}

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

  // 미션 스탬프 날짜 세트 (DailyMission 모듈 연동)
  const stampedSet = (typeof DailyMission !== 'undefined')
    ? new Set(DailyMission.getStampedDates())
    : new Set();

  for (let i = 0; i < 7; i++) {
    const d = new Date(ref);
    d.setDate(d.getDate() + i);
    const dateStr = formatDate(d);
    const dayWorkouts = byDate[dateStr] || [];
    const hasWorkout = dayWorkouts.length > 0;
    const hasMission = stampedSet.has(dateStr);

    let cls = 'week-strip-day';
    if (dateStr === today) cls += ' today';
    if (dateStr === calSelectedDate) cls += ' selected';
    const statusCls = getCalStatusClass(hasWorkout, hasMission);
    if (statusCls) cls += ` ${statusCls}`;

    let icon = '';
    if (hasWorkout) {
      const types = new Set(dayWorkouts.map(w => w.type));
      let primaryType;
      if (types.has('cardio') && types.size === 1) primaryType = 'cardio';
      else if (types.has('lower') && types.has('upper')) primaryType = 'full';
      else primaryType = [...types][0];
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
  const byDate = buildCalendarByDate();

  if (logTabMode === 'week') {
    renderWeekStrip(byDate);
  } else if (logTabMode === 'month') {
    renderMonthGrid(byDate);
  }

  renderCalDayDetail(calSelectedDate);
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

  // 미션 스탬프 날짜 세트 (DailyMission 모듈 연동)
  const stampedSet = (typeof DailyMission !== 'undefined')
    ? new Set(DailyMission.getStampedDates())
    : new Set();

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  // leading empty cells
  for (let i = 0; i < startWeekday; i++) {
    grid.innerHTML += `<div class="cal-day empty"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDate(new Date(year, month, day));
    const dayWorkouts = byDate[dateStr] || [];
    const hasWorkout = dayWorkouts.length > 0;
    const hasMission = stampedSet.has(dateStr);
    let cls = 'cal-day';
    if (dateStr === today) cls += ' today';
    if (dateStr === calSelectedDate) cls += ' selected';
    const statusCls = getCalStatusClass(hasWorkout, hasMission);
    if (statusCls) cls += ` ${statusCls}`;

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
  // 주간/월간 각 패널에 렌더링
  const detailEl = logTabMode === 'week'
    ? document.getElementById('logDayDetail')
    : document.getElementById('logMonthDayDetail');
  if (!detailEl) return;

  if (!dateStr) {
    detailEl.innerHTML = `<div class="empty-state" style="padding:20px">
      <div class="ee-body">날짜를 탭하면 그날의 운동 기록이 표시돼요.</div>
    </div>`;
    return;
  }

  const d = new Date(dateStr + 'T12:00:00');
  const dowLabels = ['일','월','화','수','목','금','토'];
  const dateLabel = `${d.getMonth()+1}월 ${d.getDate()}일 (${dowLabels[d.getDay()]})`;

  const allWorkouts = loadWorkouts();
  const dayWorkouts = allWorkouts.filter(w => w.date === dateStr);

  if (dayWorkouts.length === 0) {
    detailEl.innerHTML = `
      <div class="section-title" style="margin-top:16px"><span>${dateLabel}</span>
        <span class="add-link" onclick="openModal()">+ 추가</span>
      </div>
      <div class="empty-state" style="padding:20px">
        <div class="ee-icon">💤</div>
        <div class="ee-body">이 날은 운동 기록이 없어요.</div>
      </div>`;
    return;
  }

  let html = `<div class="section-title" style="margin-top:16px"><span>${dateLabel}</span>
    <span class="add-link" onclick="openModal()">+ 추가</span>
  </div>`;

  dayWorkouts.forEach(w => {
    const realIdx = allWorkouts.indexOf(w);
    const typeMeta = getWorkoutTypeMeta(w.type);
    const typeLabel = typeMeta.label;
    const totalVolume = (w.exercises || []).reduce((sum, ex) => sum + getExerciseVolume(ex), 0);
    const cardioMin = (typeof CardioTracker !== 'undefined') ? CardioTracker.getWorkoutCardioMinutes(w) : 0;
    const exDetailHTML = buildExerciseDetailHTML(w, realIdx);
    const progressBadge = w.inProgress
      ? '<span style="font-size:9px;color:var(--cyan);margin-left:4px">진행 중</span>'
      : '';

    html += `
      <div class="workout-item">
        <div class="wi-top">
          <div>
            <div class="wi-date">${typeLabel} 운동${progressBadge}</div>
            <div class="wi-meta" style="margin-top:3px">
              ${w.type === 'cardio' || cardioMin > 0
                ? `<span>유산소 <b>${cardioMin || w.duration || '-'}</b>분</span>`
                : `<span>볼륨 <b>${totalVolume.toLocaleString()}</b> kg</span>`}
              <span>${w.duration || '-'}분</span>
            </div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="wi-action" onclick="openEditModal(${realIdx})" title="수정">✏️</button>
            <button class="wi-action" onclick="deleteWorkoutAndRefreshCalendar(${realIdx})" title="삭제">🗑️</button>
          </div>
        </div>
        <div style="padding-top:8px">${exDetailHTML}</div>
      </div>`;
  });

  detailEl.innerHTML = html;
}

function deleteWorkoutAndRefreshCalendar(idx) {
  if (confirm('이 운동 기록을 삭제하시겠어요?')) {
    const workouts = loadWorkouts();
    workouts.splice(idx, 1);
    saveWorkouts(workouts);
    renderCalendar();
    renderLog();
    renderHome();
  }
}

// ============================================================
// ICS export (for Google Calendar import)
// ============================================================
function exportICS() {
  const workouts = getCompletedWorkouts();
  if (workouts.length === 0) {
    alert('내보낼 운동 기록이 없어요.');
    return;
  }

  const pad = (n) => String(n).padStart(2, '0');
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//RECOVR//Workout Tracker//KO\r\nCALSCALE:GREGORIAN\r\n';

  workouts.forEach((w, idx) => {
    const totalVolume = (w.exercises || []).reduce((sum, ex) => sum + getExerciseVolume(ex), 0);
    const typeLabel = getWorkoutTypeMeta(w.type).label;

    const [y, m, d] = w.date.split('-');
    const startDate = `${y}${m}${d}`;
    const startHM = (w.startTime && /^\d{2}:\d{2}$/.test(w.startTime)) ? w.startTime : '18:00';
    const startTime = startHM.replace(':', '') + '00';
    const durationMin = w.duration || 60;
    const startDt = new Date(`${w.date}T${startHM}:00`);
    const endDt = new Date(startDt.getTime() + durationMin * 60000);
    const endStr = `${endDt.getFullYear()}${pad(endDt.getMonth()+1)}${pad(endDt.getDate())}T${pad(endDt.getHours())}${pad(endDt.getMinutes())}00`;

    let desc = (w.exercises || []).map(ex => {
      if (ex.mode === 'duration') {
        if (typeof DurationTimer !== 'undefined' && ex.durationSets?.length) {
          return `${ex.name} ${DurationTimer.formatExerciseSummary(ex)}`;
        }
        return `${ex.name} ${ex.durationMin}분`;
      }
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
  if (viewName === 'log') {
    if (logTabMode === 'list') renderLog();
    else renderCalendar();
  }
  if (viewName === 'stats') renderStats();
  if (viewName === 'settings') {
    const s = loadSettings();
    document.getElementById('baseRecoveryHours').value = s.baseRecoveryHours || 48;
    if (typeof UserProfile !== 'undefined') UserProfile.fillForm(s);
    updateBackupStatus();
    renderPwaInstallSection();
    try {
      if (typeof AiCoach !== 'undefined') AiCoach.renderSettings();
    } catch (e) { /* ignore */ }
    try {
      if (typeof RestTimer !== 'undefined') RestTimer.fillForm();
    } catch (e) { /* ignore */ }
    try {
      if (typeof WorkoutGoals !== 'undefined') WorkoutGoals.fillForm();
    } catch (e) { /* ignore */ }
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
let selectedFatigue = 3; // 1~5, 기본 '보통'
let editingIndex = null; // null = new workout, number = editing existing index

// 피로도 선택 (1=매우가벼움 ~ 5=매우힘들었음)
const FATIGUE_LABELS = ['', '매우 가벼움', '가벼움', '보통', '힘들었음', '매우 힘들었음'];
const FATIGUE_RECOVERY_SCALE = { 1: 0.7, 2: 0.85, 3: 1.0, 4: 1.25, 5: 1.55 };

function selectFatigue(val) {
  selectedFatigue = val;
  document.querySelectorAll('.fatigue-btn').forEach(btn => {
    btn.classList.toggle('selected', Number(btn.dataset.val) === val);
  });
  const desc = [
    '', '볼륨 기준 회복 시간의 70%로 단축', '회복 시간 약간 단축',
    '회복 시간 볼륨 기준 그대로 적용', '회복 시간 25% 연장', '회복 시간 55% 연장'
  ];
  const el = document.getElementById('fatigueDesc');
  if (el) el.textContent = desc[val] || '';
  saveWorkoutProgress(true);
}

// ============================================================
// 입력 중 자동 저장 (세트 체크, 스트레칭 시간 등)
// 운동 중 앱을 나갔다 와도 내용이 유지되도록
// localStorage + 자동 백업 파일에 즉시 반영합니다.
// ============================================================
const DRAFT_KEY = 'recovr_draft_v1';
let autoSaveTimer = null;
let activeSessionId = null;
let modalListenersAttached = false;

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isModalOpen() {
  return document.getElementById('modalOverlay')?.classList.contains('show');
}

function findInProgressWorkout() {
  const workouts = loadWorkouts();
  const inProgress = workouts.filter(w => w.inProgress);
  if (inProgress.length === 0) return null;
  return inProgress.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0];
}

function applyWorkoutToForm(w) {
  document.getElementById('workoutDate').value = w.date || formatDate(new Date());
  document.getElementById('workoutTime').value = w.startTime || '';
  document.getElementById('workoutDuration').value = w.duration || 100;
  document.getElementById('exerciseRows').innerHTML = '';
  (w.exercises || []).forEach(ex => addExerciseRow(ex));
  if ((w.exercises || []).length === 0) addExerciseRow();
  selectType(w.type || 'upper');
  selectFatigue(w.fatigue || 3);
  activeSessionId = w.sessionId || generateSessionId();
}

function saveWorkoutProgress(immediate) {
  if (!isModalOpen()) return;

  const runSave = () => {
    try {
      const exercises = extractExercisesFromForm();
      const hasContent = exercises.some(ex => ex.name && ex.name.trim());
      if (!hasContent) return;

      const date = document.getElementById('workoutDate').value;
      const startTime = document.getElementById('workoutTime').value;
      const duration = parseInt(document.getElementById('workoutDuration').value) || 0;
      const workouts = loadWorkouts();

      if (editingIndex !== null) {
        const existing = workouts[editingIndex];
        if (!existing) return;
        workouts[editingIndex] = {
          ...existing,
          date,
          startTime,
          duration,
          type: selectedType,
          fatigue: selectedFatigue,
          exercises,
          updatedAt: new Date().toISOString(),
        };
      } else {
        if (!activeSessionId) activeSessionId = generateSessionId();
        const idx = workouts.findIndex(w => w.inProgress && w.sessionId === activeSessionId);
        const payload = {
          date,
          startTime,
          duration,
          type: selectedType,
          fatigue: selectedFatigue,
          exercises,
          inProgress: true,
          sessionId: activeSessionId,
          updatedAt: new Date().toISOString(),
        };
        if (idx >= 0) {
          workouts[idx] = { ...workouts[idx], ...payload };
        } else {
          workouts.push({ ...payload, createdAt: new Date().toISOString() });
        }
      }

      saveWorkouts(workouts);
      showDraftIndicator();
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) { /* ignore */ }
  };

  if (immediate) {
    clearTimeout(autoSaveTimer);
    runSave();
  } else {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(runSave, 400);
  }
}

function flushWorkoutProgress() {
  saveWorkoutProgress(true);
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
  applyWorkoutToForm(draft);
}

let onModalInput = null;
let onModalClick = null;

function attachDraftListeners() {
  const modal = document.querySelector('.modal');
  if (!modal || modalListenersAttached) return;
  modalListenersAttached = true;

  onModalInput = () => saveWorkoutProgress(false);
  onModalClick = (e) => {
    if (e.target.closest('.duration-toggle-btn')) return;
    if (e.target.closest('.set-check, .add-set-btn, .set-del, .row-mode-toggle, .row-del, .type-btn, .fatigue-btn, .duration-check, .duration-set-del')) {
      saveWorkoutProgress(true);
    }
  };

  modal.addEventListener('input', onModalInput);
  modal.addEventListener('click', onModalClick);
}

function setupBackgroundSave() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushWorkoutProgress();
  });
  window.addEventListener('pagehide', flushWorkoutProgress);
}


function openModal() {
  editingIndex = null;
  activeSessionId = null;
  document.getElementById('modalTitle').textContent = '운동 기록 추가';
  document.getElementById('saveBtn').textContent = '저장하기';
  document.getElementById('modalOverlay').classList.add('show');

  // 구버전 드래프트 호환
  const legacyDraft = loadDraft();
  if (legacyDraft) {
    const savedTime = new Date(legacyDraft.savedAt || 0);
    const minsAgo = Math.round((new Date() - savedTime) / 60000);
    const timeLabel = minsAgo < 1 ? '방금' : minsAgo < 60 ? `${minsAgo}분 전` : `${Math.round(minsAgo/60)}시간 전`;
    const restore = confirm(`작성 중이던 기록이 있어요 (${timeLabel} 저장됨).\n이어서 작성하시겠어요?\n\n취소하면 새로 시작해요.`);
    if (restore) {
      applyDraftToForm(legacyDraft);
      populateTemplateSelect();
      attachDraftListeners();
      return;
    }
    clearDraft();
  }

  const inProgress = findInProgressWorkout();
  if (inProgress) {
    const savedTime = new Date(inProgress.updatedAt || inProgress.createdAt || 0);
    const minsAgo = Math.round((new Date() - savedTime) / 60000);
    const timeLabel = minsAgo < 1 ? '방금' : minsAgo < 60 ? `${minsAgo}분 전` : `${Math.round(minsAgo/60)}시간 전`;
    const restore = confirm(`진행 중인 운동 기록이 있어요 (${timeLabel} 저장됨).\n이어서 작성하시겠어요?\n\n취소하면 새로 시작해요.`);
    if (restore) {
      applyWorkoutToForm(inProgress);
      populateTemplateSelect();
      attachDraftListeners();
      return;
    }
    const workouts = loadWorkouts();
    const idx = workouts.findIndex(w => w.sessionId === inProgress.sessionId);
    if (idx >= 0) {
      workouts.splice(idx, 1);
      saveWorkouts(workouts);
    }
  }

  document.getElementById('workoutDate').value = formatDate(new Date());
  const now = new Date();
  document.getElementById('workoutTime').value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  document.getElementById('workoutDuration').value = 100;
  document.getElementById('exerciseRows').innerHTML = '';
  addExerciseRowAndPick();
  selectType('upper');
  selectFatigue(3);
  if (typeof CardioTracker !== 'undefined') CardioTracker.togglePresetArea(false);
  activeSessionId = generateSessionId();
  populateTemplateSelect();
  attachDraftListeners();
}

function openModalWithPrefill({ type, exercises, title }) {
  clearDraft();
  editingIndex = null;
  activeSessionId = generateSessionId();
  document.getElementById('modalTitle').textContent = title || '운동 기록 추가';
  document.getElementById('saveBtn').textContent = '저장하기';
  document.getElementById('modalOverlay').classList.add('show');

  document.getElementById('workoutDate').value = formatDate(new Date());
  const now = new Date();
  document.getElementById('workoutTime').value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  document.getElementById('workoutDuration').value = 100;
  document.getElementById('exerciseRows').innerHTML = '';

  (exercises || []).forEach(ex => addExerciseRow(ex));
  if (!exercises || exercises.length === 0) addExerciseRowAndPick();

  selectType(type || 'upper');
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
  selectFatigue(w.fatigue || 3);
  populateTemplateSelect();
  attachDraftListeners();
}

function closeModal() {
  if (typeof DurationTimer !== 'undefined') DurationTimer.onModalClose();
  if (typeof RestTimer !== 'undefined') RestTimer.onModalClose();
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

  const isCardio = type === 'cardio';
  if (typeof CardioTracker !== 'undefined') {
    CardioTracker.togglePresetArea(isCardio);
    if (isCardio) CardioTracker.renderPresetButtons();
  }

  const durationInput = document.getElementById('workoutDuration');
  if (isCardio && durationInput && (!durationInput.value || durationInput.value === '100')) {
    durationInput.value = 30;
  }

  try {
    if (typeof CardioMetrics !== 'undefined') CardioMetrics.refreshAllRows();
  } catch (e) { /* ignore */ }
}

function getLastExerciseRow() {
  const rows = document.querySelectorAll('#exerciseRows .exercise-row-wrap');
  return rows.length ? rows[rows.length - 1] : null;
}

function openExercisePickerForRow(row) {
  if (typeof ExercisePicker === 'undefined' || !row) return;
  setTimeout(() => ExercisePicker.open(row), 120);
}

function addExerciseRowAndPick(prefill) {
  addExerciseRow(prefill);
  if (!prefill?.name) {
    openExercisePickerForRow(getLastExerciseRow());
  }
}

function openExercisePickerTop() {
  if (typeof ExercisePicker === 'undefined') return;
  const emptyRow = getLastExerciseRow();
  const nameInput = emptyRow?.querySelector('.ex-name');
  if (emptyRow && nameInput && !nameInput.value.trim()) {
    openExercisePickerForRow(emptyRow);
    return;
  }
  ExercisePicker.open();
}

function addExerciseRow(prefill) {
  const container = document.getElementById('exerciseRows');
  const row = document.createElement('div');
  row.className = 'exercise-row-wrap';

  const isDuration = prefill?.mode === 'duration';

  row.innerHTML = `
    <div class="exercise-row ${isDuration ? 'duration-mode' : ''}">
      <input type="text" placeholder="예: 스쿼트" class="ex-name" value="${prefill?.name || ''}" autocomplete="off">
      <button type="button" class="row-pick-btn" title="종목에서 선택">📋</button>
      <button class="row-mode-toggle" title="시간 입력으로 전환" style="${isDuration ? 'display:none' : ''}">⏱</button>
      <button class="row-mode-toggle" title="세트 입력으로 전환" style="${isDuration ? '' : 'display:none'}">🏋️</button>
      <button class="row-del" onclick="this.closest('.exercise-row-wrap').remove()">✕</button>
    </div>
    <div class="ex-suggest"></div>
    <div class="set-checklist" style="${isDuration ? 'display:none' : ''}"></div>
    <div class="duration-checklist" style="${isDuration ? '' : 'display:none'}"></div>
    <div class="duration-total" style="${isDuration ? '' : 'display:none'}">합계 <span class="duration-total-val">0:00</span></div>
    <button class="add-set-btn">${isDuration ? '+ 시간 세트 추가' : '+ 세트 추가'}</button>
  `;
  container.appendChild(row);

  const nameInput = row.querySelector('.ex-name');
  const suggestBox = row.querySelector('.ex-suggest');
  const pickBtn = row.querySelector('.row-pick-btn');
  const toggleBtns = row.querySelectorAll('.row-mode-toggle');
  const checklist = row.querySelector('.set-checklist');
  const addSetBtn = row.querySelector('.add-set-btn');

  if (pickBtn) {
    pickBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof ExercisePicker !== 'undefined') ExercisePicker.open(row);
    });
  }

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      setRowMode(row, !row.querySelector('.exercise-row').classList.contains('duration-mode'));
    });
  });

  addSetBtn.addEventListener('click', () => {
    const isDur = row.querySelector('.exercise-row').classList.contains('duration-mode');
    if (isDur && typeof DurationTimer !== 'undefined') {
      DurationTimer.addSetRow(row);
      if (typeof saveWorkoutProgress === 'function') saveWorkoutProgress(true);
    } else {
      addSetRow(row);
    }
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

  // 세트별 입력 초기화: prefill.setDetails가 있으면 그대로, 없으면
  // weight/reps/sets(구버전 데이터 또는 신규 행)로부터 세트 생성
  let durationActive = row.querySelector('.exercise-row').classList.contains('duration-mode');
  if (prefill?.name && prefill?.mode === undefined) {
    autoDetectMode(row, prefill.name, true);
    durationActive = row.querySelector('.exercise-row').classList.contains('duration-mode');
  }

  if (durationActive) {
    if (typeof DurationTimer !== 'undefined') {
      DurationTimer.populateWrap(row, prefill);
    }
  } else {
    if (prefill?.setDetails && prefill.setDetails.length > 0) {
      prefill.setDetails.forEach(s => addSetRow(row, s));
    } else {
      const numSets = prefill?.sets ?? 1;
      for (let i = 0; i < numSets; i++) {
        addSetRow(row, { weight: prefill?.weight || '', reps: prefill?.reps || '', completed: false });
      }
    }
  }

  // 초기 HTML과 setRowMode 표시 규칙을 맞춤 (세트 추가 버튼 항상 표시)
  setRowMode(row, durationActive);

  try {
    if (typeof CardioMetrics !== 'undefined') CardioMetrics.onRowAdded(row, prefill);
  } catch (e) { /* ignore */ }
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
    <div class="set-check ${completed ? 'checked' : ''}" onclick="toggleSetCheck(this)">✓</div>
    <button class="set-del" onclick="removeSetRow(this)">✕</button>
  `;
  checklist.appendChild(setRow);
}

function toggleSetCheck(el) {
  el.classList.toggle('checked');
  saveWorkoutProgress(true);
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
  const checklist = row.querySelector('.set-checklist');
  const durationChecklist = row.querySelector('.duration-checklist');
  const durationTotal = row.querySelector('.duration-total');
  const addSetBtn = row.querySelector('.add-set-btn');
  const toggleBtns = row.querySelectorAll('.row-mode-toggle');

  if (durationMode) {
    exRow.classList.add('duration-mode');
    checklist.style.display = 'none';
    if (durationChecklist) durationChecklist.style.display = '';
    if (durationTotal) durationTotal.style.display = '';
    addSetBtn.style.display = '';
    addSetBtn.textContent = '+ 시간 세트 추가';
    toggleBtns[0].style.display = 'none';
    toggleBtns[1].style.display = '';
    if (typeof DurationTimer !== 'undefined') {
      if (durationChecklist && durationChecklist.querySelectorAll('.duration-set-row').length === 0) {
        DurationTimer.populateWrap(row, {});
      }
    }
  } else {
    if (typeof DurationTimer !== 'undefined') DurationTimer.clearWrap(row);
    exRow.classList.remove('duration-mode');
    checklist.style.display = '';
    if (durationChecklist) durationChecklist.style.display = 'none';
    if (durationTotal) durationTotal.style.display = 'none';
    addSetBtn.style.display = '';
    addSetBtn.textContent = '+ 세트 추가';
    toggleBtns[0].style.display = '';
    toggleBtns[1].style.display = 'none';

    // 세트가 없으면 하나 추가
    if (checklist.querySelectorAll('.set-row').length === 0) {
      addSetRow(row, { weight: '', reps: '', completed: false });
    }
  }

  try {
    if (typeof CardioMetrics !== 'undefined') CardioMetrics.updateVisibility(row);
  } catch (e) { /* ignore */ }
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
      const durationData = (typeof DurationTimer !== 'undefined')
        ? DurationTimer.readFromWrap(wrap)
        : { durationMin: 0, durationSets: [], sets: 0, weight: 0, reps: 0 };
      const exercise = { name, mode: 'duration', ...durationData };
      if (typeof CardioMetrics !== 'undefined') {
        const metrics = CardioMetrics.readFromWrap(wrap);
        if (metrics) exercise.cardioMetrics = metrics;
      }
      exercises.push(exercise);
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
  if (typeof DurationTimer !== 'undefined') DurationTimer.freezeActiveTimer();
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
      fatigue: selectedFatigue,
      exercises,
      updatedAt: new Date().toISOString(),
    };
    delete workouts[editingIndex].inProgress;
    delete workouts[editingIndex].sessionId;
  } else {
    // new — 진행 중 임시 기록을 완료 처리하거나 새로 추가
    const idx = activeSessionId
      ? workouts.findIndex(w => w.inProgress && w.sessionId === activeSessionId)
      : -1;
    const finalized = {
      date,
      startTime,
      duration,
      type: selectedType,
      fatigue: selectedFatigue,
      exercises,
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) {
      workouts[idx] = {
        ...workouts[idx],
        ...finalized,
      };
      delete workouts[idx].inProgress;
      delete workouts[idx].sessionId;
    } else {
      workouts.push({
        ...finalized,
        createdAt: new Date().toISOString(),
      });
    }
  }

  saveWorkouts(workouts);
  editingIndex = null;
  activeSessionId = null;
  clearDraft();

  closeModal();
  renderHome();
  renderLog();
  if (logTabMode !== 'list') renderCalendar();
}

// ============================================================
// Settings / Import / Export
// ============================================================
function saveSettings() {
  const settings = loadSettings();
  settings.baseRecoveryHours = parseInt(document.getElementById('baseRecoveryHours').value) || 48;
  saveSettingsToStorage(settings);
  if (typeof UserProfile !== 'undefined') UserProfile.updateHint(settings.profile, settings);
  renderHome();
}

function exportData() {
  const data = buildBackupPayload();
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
      if (data.dailyMissions) {
        localStorage.setItem('recovr_daily_missions_v1', JSON.stringify(data.dailyMissions));
      }
      if (typeof UserProfile !== 'undefined') UserProfile.fillForm(loadSettings());
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

async function onBackupReconnectResult(result) {
  if (result && result.status === 'restored' && result.handle) {
    backupRootHandle = result.handle;
    localStorage.setItem('recovr_backup_linked', 'true');
    updateBackupStatus();
    try { await writeBackupFile(); } catch (_) { /* ignore */ }
    return;
  }
  updateBackupStatus();
}

// 자동 배너/재연결 훅은 홈 화면 안정성을 위해 비활성화.
// 설정 > 연결 버튼으로만 권한을 다시 허용합니다.
async function initBackupFromStorage() {
  if (!isFileSystemAccessSupported()) {
    updateBackupStatus();
    return;
  }

  try {
    if (typeof BackupReconnect !== 'undefined' && BackupReconnect.hideBanner) {
      BackupReconnect.hideBanner();
    }
    if (typeof BackupStorage === 'undefined') {
      updateBackupStatus();
      return;
    }

    const handle = await BackupStorage.loadBackupHandle();
    if (!handle) {
      updateBackupStatus();
      return;
    }

    let perm = 'prompt';
    try {
      if (handle.queryPermission) {
        perm = await handle.queryPermission({ mode: 'readwrite' });
      }
    } catch (_) {
      perm = 'prompt';
    }

    if (perm === 'granted') {
      backupRootHandle = handle;
      localStorage.setItem('recovr_backup_linked', 'true');
    } else {
      // 핸들은 IndexedDB에 유지. 설정에서 "연결" 시 권한만 다시 요청.
      localStorage.setItem('recovr_backup_linked', 'true');
      backupRootHandle = null;
    }
  } catch (e) {
    console.warn('[RECOVR] 백업 파일 자동 복원 실패:', e);
  }

  updateBackupStatus();
}

// ============================================================
// Init
// ============================================================
function init() {
  // PWA: register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        reg.update();
        try {
          if (typeof PwaUpdate !== 'undefined') PwaUpdate.init(reg);
        } catch (e) { /* ignore */ }
      }).catch(() => {});
    });
  }

  // theme
  applyTheme(loadTheme());

  // date label
  const now = new Date();
  const dayNames = ['일','월','화','수','목','금','토'];
  document.getElementById('todayLabel').textContent =
    `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} (${dayNames[now.getDay()]})`;

  initBackupFromStorage();
  updateBackupGuideText();
  setupBackgroundSave();

  if (typeof UserProfile !== 'undefined') {
    try { UserProfile.fillForm(loadSettings()); } catch (e) { console.warn('[RECOVR] 프로필 폼 실패:', e); }
  }

  const versionText = `v${APP_VERSION}`;
  document.querySelectorAll('#appVersionBadge, #appVersionLabel').forEach(el => {
    el.textContent = el.id === 'appVersionLabel' ? `RECOVR ${versionText}` : versionText;
  });

  renderHome();

  try {
    if (typeof AiCoach !== 'undefined') AiCoach.init();
  } catch (e) { /* ignore */ }

  try {
    if (typeof RestTimer !== 'undefined') RestTimer.init();
  } catch (e) { /* ignore */ }

  try {
    if (typeof DurationAutoSave !== 'undefined') DurationAutoSave.init();
  } catch (e) { /* ignore */ }

  try {
    if (typeof CardioMetrics !== 'undefined') CardioMetrics.init();
  } catch (e) { /* ignore */ }

  // refresh recovery every 60s while app is open
  setInterval(() => {
    const activeView = document.querySelector('.view.active').id;
    if (activeView === 'view-home') renderHome();
  }, 60000);
}
