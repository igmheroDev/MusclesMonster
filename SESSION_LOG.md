# RECOVR - 개발 세션 로그

> **사용법**
> - `"일 시작하자"` → AI가 이 파일을 읽고 현재 상태 파악 후 이어서 작업
> - `"세션업데이트"` → AI가 이번 작업 내용을 이 파일에 기록

---

## 📁 프로젝트 현재 상태

### 파일 구성
```
MusclesMonster/
├── index.html          # UI 전체 (뷰, 스타일, 모달, AI 채팅 포함)
├── app.js              # 메인 로직
├── userProfile.js      # 사용자 프로필 (신체정보·목표·회복 보정)
├── workoutUtils.js     # 운동 분석 공통 유틸 (lookback·근육 그룹 상수)
├── durationTimer.js    # 시간 운동 스톱워치 (세트별 시작/정지)
├── durationAutoSave.js # 스톱워치 실행 중 주기적 자동 저장
├── restTimer.js        # 세트 간 휴식 타이머 (카운트다운·진동)
├── pwaUpdate.js        # PWA 새 버전 안내 배너
├── cardioTracker.js    # 유산소 추적 (프리셋·주간 통계)
├── cardioMetrics.js    # 유산소 세부 지표 (거리·칼로리·심박)
├── workoutGoals.js     # 월별 운동·유산소 목표
├── muscleHeatmap.js    # 근육 회복 히트맵 (일러스트 베이스 + 오버레이)
├── body-map-front.png / body-map-back.png   # 히트맵 바디 일러스트 (4색 PNG)
├── body-mask-front.png / body-mask-back.png # 히트맵 실루엣 마스크
├── recommendation.js   # 운동 추천 (12종 유형)
├── workoutAdvice.js    # 운동 패턴 조언
├── aiCoachFallback.js  # AI 한도 초과 규칙 기반 폴백
├── aiCoach.js          # AI 코치 (Gemini Flash, BYOK)
├── dailyMission.js     # 데일리 미션
├── exercisePicker.js   # 운동 종목 피커
├── microAnim.js        # 마이크로 애니메이션 (터치·완료 피드백)
├── backupStorage.js    # IndexedDB 백업 핸들
├── backupWriter.js     # File System API 백업
├── sw.js               # Service Worker (PWA 캐싱, v47)
├── manifest.json       # PWA 메타
├── icon-192.png / icon-512.png
├── test-*.js           # 단위 테스트 15개
└── SESSION_LOG.md
```

### 기술 스택
- **Vanilla JS + HTML/CSS** (프레임워크 없음)
- **PWA** (Service Worker, manifest, 오프라인 캐싱)
  - 설치형 앱도 동일 URL에서 로드 → **인터넷 연결 후 앱 실행 시** SW가 최신 코드 반영
  - JS/HTML은 **네트워크 우선**, 오프라인 시 캐시 폴백
  - AI 코치(Gemini API)만 온라인 필수, 운동 기록·회복도는 오프라인 가능
- **localStorage** 데이터 저장 (서버 없음, 완전 로컬)
- **GitHub Pages** 배포: `https://igmheroDev.github.io/MusclesMonster/`

---

## 🏗️ 아키텍처 요약

### 뷰 구조 (하단 네비 5탭)
```
홈(home) / 기록(log) / + FAB / 통계(stats) / 설정(settings)
```

### 기록 탭 내부 (상단 3탭)
```
목록 / 주간 / 월간
```

### 주요 모듈 (app.js)
| 함수/상수 | 역할 |
|-----------|------|
| `MUSCLE_KEYWORDS` | 운동명 → 부위 키워드 매핑 |
| `COMMON_EXERCISES` | 자동완성 운동명 사전 |
| `MUSCLE_BASE_RECOVERY` | 부위별 기본 회복 시간(h) |
| `FATIGUE_RECOVERY_SCALE` | 피로도(1~5) → 회복 시간 배율 |
| `calcMuscleRecovery()` | 회복도 계산 엔진 |
| `renderHome()` | 홈 뷰 렌더링 (회복도 + 추천 + 스트릭) |
| `renderLog()` | 목록 뷰 - 드롭다운 방식 |
| `renderCalendar()` | 주간/월간 캘린더 렌더링 |
| `renderCalDayDetail()` | 날짜 탭 시 세부 운동 표시 |
| `toggleWorkoutDetail()` | 목록 드롭다운 열기/닫기 |
| `buildExerciseDetailHTML()` | 세부 운동 HTML 공용 생성 |
| `calcStreak()` | 연속 운동일 계산 |
| `renderPwaInstallSection()` | PWA 설치 안내 (플랫폼 감지) |
| `manualBackupSave()` | 수동 백업 저장 |
| `addExerciseRow()` | 운동 행 추가 (무게/시간 모드) |
| `addSetRow()` | 무게 모드 세트 행 추가 |
| `setRowMode()` | 무게 ↔ 시간 모드 전환 + 세트 추가 버튼 표시 |
| `autoDetectMode()` | 운동명 기반 시간 모드 자동 전환 (유산소/모빌리티) |
| `getWorkoutTypeMeta()` | 운동 타입 메타 (상체/하체/전신/유산소 라벨·색상) |
| `openCardioModal()` | 유산소 타입으로 운동 기록 모달 열기 |
| `buildCalendarByDate()` | 완료 운동만 날짜별 그룹 (캘린더 색상용) |
| `getCalStatusClass()` | 캘린더 칸 상태 클래스 (운동/미션/둘다) |

### dailyMission.js
- `DailyMission.getMissionsForDate()` — 날짜별 미션 3개 (프로필·상태 기반 시드)
- `DailyMission.toggleMission()` — 미션 완료 토글 + 도장(stamp) 기록
- `DailyMission.isDayCompleted()` / `getStampedDates()` — 완료일·캘린더 연동
- `DailyMission.getMissionContext()` — 목디스크/허리디스크/체중감량/재활 등 상태 감지
- `DailyMission.renderHomeCard()` — 홈 `오늘의 데일리 미션` 카드
- 저장 키: `recovr_daily_missions_v1` (백업·import 포함)

### exercisePicker.js
- `ExercisePicker.open()` — 운동 종목 목록 모달 (카테고리·기구·검색)
- `ExercisePicker.select()` — 선택 종목을 운동 행에 적용 (빈 행 재사용)
- `ExercisePicker.getCatalog()` — COMMON_EXERCISES 기반 카탈로그 + 최근 수행일
- 초성 검색·카테고리 칩(상체/하체/코어/유산소 등) 지원

### microAnim.js
- `MicroAnim.init()` — 스타일 주입 + 전역 이벤트 위임 (자동 기동)
- `MicroAnim.pop()` / `ripple()` / `stamp()` / `successPulse()` — 피드백 API
- 세트·시간·미션 체크, 저장/FAB/네비 터치 피드백 (기존 모듈 비침투)
- `prefers-reduced-motion: reduce` 시 애니메이션 비활성

### cardioTracker.js
- `CardioTracker.isCardioExercise()` — 유산소 운동 판별 (키워드 + duration 모드)
- `CardioTracker.getWorkoutCardioMinutes()` — 세션별 유산소 시간 합산
- `CardioTracker.getWeeklyStats()` — 주간 유산소 시간·횟수·목표 달성률 (150분)
- `CardioTracker.addPreset()` — 기구 프리셋으로 운동 행 추가 (천국의계단, 로잉머신 등)
- `CardioTracker.applyQuickMinutes()` — 마지막 항목에 프리셋 분(10/15/20/30/45) 적용
- `CardioTracker.applyCustomMinutes()` — 임의 분(1~300) 직접 입력 적용
- `CardioTracker.renderHomeCard()` — 홈 유산소 요약 카드
- `CardioTracker.renderTrendChart()` — 통계 탭 유산소 추세 그래프
- `CardioTracker.renderMachineBreakdown()` — 기구별 주간 분석
- 프리셋 8종: 천국의 계단, 로잉머신, 트레드밀, 실내자전거, 일립티컬, 스텝퍼, 수영, 줄넘기

### durationTimer.js
- `DurationTimer.addSetRow()` — 시간 모드 세트별 스톱워치 행 추가
- `DurationTimer.populateWrap()` — 저장된 durationSets 복원
- `DurationTimer.readFromWrap()` — 폼에서 시간 세트 읽기 (실행 중 타이머 유지)
- `DurationTimer.freezeActiveTimer()` — 저장/읽기 전 타이머 고정
- `DurationTimer.formatExerciseSummary()` — 기록 표시용 시간 요약
- `DurationTimer.openManualEditor()` — 시간 표시 탭 시 분·초 직접 입력 UI
- `DurationTimer.secondsFromParts()` — 분·초 → 초 변환 유틸
- `DurationTimer.applyManualSeconds()` — 프로그래밍 방식으로 세트 시간 설정

### recommendation.js
- `WorkoutRecommendation.compute()` — 10일치 기록 분석 → **12종 유형** 중 1개 자동 추천
- `WorkoutRecommendation.setType()` — 드롭다운으로 유형 직접 선택 (3그룹 optgroup)
- `WorkoutRecommendation.render()` — 홈 화면 추천 카드 + select 드롭다운
- `WorkoutRecommendation.apply()` — 추천 내용으로 운동 모달 열기 (세트 미체크 prefill, 즉시 저장 없음)
- `roundWeightToGymPlate()` — 추천 무게 **5kg 단위** 반올림 (53.2kg → 55kg)
- **12종 유형**: 상·하체 유지/성장, 전신 유지, 체중감소, 기능성 유산소, 목·허리 재활, 재활·회복, 가동성, 코어 안정화
- 유형별 `EXERCISE_PRESETS` 프리셋 운동 목록
- 선택값 `localStorage` 키: `recovr_rec_selected_v1`

### muscleHeatmap.js
- `MuscleHeatmap.render()` — 전면/후면 일러스트 베이스 + 부위별 회복도 오버레이
- `MuscleHeatmap.setView()` — 전면/후면 토글
- `body-map-*.png` 일러스트(4색 팔레트) + `body-mask-*.png` 실루엣 마스크
- 흰색 분할선 기준 구역 path, 기본 근육색 옅은 회색 (`#eeeeef`)
- 이미지 URL `?v=` + SW 네트워크 우선으로 캐시 잔존 방지
- 큰 근육에 회복 % 숫자 직접 표시, 낮은 회복 부위 glow pulse
- 부위 탭 시 glassmorphism 툴팁 (피로·회복중·준비됨·최적)

### 캘린더 날짜 색상 규칙 (주간·월간)
| 상태 | CSS 클래스 | 색상 |
|------|-----------|------|
| 일반 | (없음) | 기존 surface |
| 운동 기록 있음 | `cal-status-workout` | 옅은 파랑 |
| 데일리 미션 완료 | `cal-status-mission` | 옅은 초록 |
| 둘 다 완료 | `cal-status-both` | 황금 |

### workoutAdvice.js
- `WorkoutAdvice.compute()` — 14일 패턴 분석 (푸시/풀, 상하체, 허리 주의, **유산소 빈도**)
- `WorkoutAdvice.render()` — 홈 화면 조언 카드

### aiCoach.js
- `AiCoach.sendMessage()` — Gemini 2.5 Flash API 호출 (BYOK)
- `AiCoach.buildContext()` — 운동 기록·회복도·규칙 추천/조언 컨텍스트 생성
- `AiCoach.renderHomeCard()` — 홈 AI 코치 카드
- API 키 설정: `settings.geminiApiKey` (localStorage)
- 대화 기록 키: `recovr_ai_chat_v1`
- thinkingBudget: 0, maxOutputTokens: 8192, MAX_TOKENS 시 자동 이어쓰기
- **무료 티어 한도**: 약 15회/분, 1,500회/일 (Google 정책, 변경 가능) — 무제한 아님
- 서버 없음(BYOK) → 앱 운영 비용 0, 한도는 사용자 API 키 기준

### 회복 시간 로직
```
최종 회복시간 = MUSCLE_BASE_RECOVERY[부위] × userScale × intensityFactor × fatigueScale
  - userScale: 설정값/48 (개인 회복 속도)
  - intensityFactor: 볼륨/기준볼륨, 0.5~2.0 클램프
  - fatigueScale: 피로도 1→0.7, 3→1.0, 5→1.55
```

### 데이터 구조 (localStorage)
```js
// workout 객체
{
  date: "2026-06-20",
  startTime: "10:00",
  duration: 100,           // 분
  type: "upper",           // upper | lower | full | cardio
  fatigue: 3,              // 1~5
  exercises: [{
    name: "벤치 프레스",
    mode: "duration",        // 시간 모드 (없으면 무게 모드)
    durationMin: 20,           // 구버전 duration (단일)
    durationSets: [{ seconds: 60, completed: true }],  // 신버전 시간 세트
    weight: 60,                // sets 모드 (구버전)
    reps: 10,
    sets: 3,
    setDetails: [{ weight, reps, completed }]  // 신버전 무게 세트
  }],
  createdAt: "ISO string",
  updatedAt: "ISO string"
}
```

---

## 📋 세션 로그

---

### 세션 1 — 2026-06-20

**배포 관련**
- GitHub 저장소: `https://github.com/igmheroDev/MusclesMonster`
- GitHub Pages 활성화 (Public 저장소)
- PWA 아이콘 `icon-192.png`, `icon-512.png` 생성 및 push

**기능 개발**
1. **더미 데이터 제거** — `seedDemoData()` 함수 및 호출부 삭제
2. **운동 추천 모듈** (`recommendation.js`) 신규 생성
   - 10일치 기록 기반 상체/하체 × 유지/성장 4가지 추천
   - 홈 화면 추천 카드 + "이 추천으로 운동 시작" 버튼
3. **부위별 회복 시간 차별화** — `MUSCLE_BASE_RECOVERY` 상수 추가
   - 소근육(이두·삼두) 36h ~ 대근육(등·대퇴사두) 64h
4. **운동 키워드 대폭 보강** — T바 로우, 케이블 킥백, TRX 파이크 등 30+개 추가
5. **피로도 직접 입력** — 운동 저장 시 😌~🥵 5단계 선택, 회복 시간 반영
6. **연속 운동일 스트릭** — 헤더에 🔥N일 연속 뱃지 (2일+부터, 7일+ 빨간색)
7. **PWA 설치 안내** — 설정 탭에 플랫폼 감지 기반 설치 안내 (Android/iPhone/PC 각각)
8. **백업 수동 저장 버튼** — 파일 연결 시 `💾 저장` 버튼 표시, "저장 중→✓저장됨" 피드백
9. **기록+캘린더 탭 통합** — 하단 네비 6탭→5탭, 기록 탭 내 목록/주간/월간 상단 탭
   - 목록 뷰: 드롭다운 방식으로 세부 운동 내용 표시, 탭→수정 모달
   - 주간/월간 뷰: 날짜 탭→세부 운동 내용 + 추가 버튼

**다음 세션 후보 작업**
- [ ] 운동 목표 설정 (월별 목표 횟수 등)
- [ ] 세트 간 휴식 타이머
- [ ] 근육 히트맵 다이어그램 (전면/후면 신체 실루엣)
- [ ] 모빌리티 전용 운동 목록 확충
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정

**현재 sw.js 캐시 버전**: `recovr-cache-v8`

---

### 세션 2 — 2026-06-21

**버전 관리 도입**
- 앱 버전 `1.0.0` 설정
- `app.js` 최상단에 `APP_VERSION = '1.0.0'` 상수 추가
- `manifest.json`에 `"version": "1.0.0"` 필드 추가
- `index.html` 설정 탭 하단에 `RECOVR v1.0.0` 버전 라벨 표시 (JS에서 주입)
- `sw.js` 캐시 버전 `v11 → v12`

**백업 시스템 버그 수정 (PR #3)**
- 자동 백업 파일 연결 시 파일이 0바이트가 되는 문제 수정
  - `linkBackupFile()`: 파일 선택 전에 JSON 페이로드 미리 빌드 → 선택 직후 즉시 전체 쓰기 (exportData 방식)
  - `linkBackupFile()`: 쓰기 실패 시 연결 취소 + alert 표시 (기존은 0바이트 방치)
  - `writeBackupFile()`: 기존 파일 내용 미리 읽기 → 실패 시 직접 복원 폴백 추가
  - `writeBackupFile()`: 성공/실패 `boolean` 반환으로 변경
  - `manualBackupSave()`: 쓰기 실패 시 "⚠️ 실패" 표시 (기존은 항상 "✓ 저장됨")

**현재 sw.js 캐시 버전**: `recovr-cache-v12`

**현재 앱 버전**: `1.0.0`

---

### 세션 3 — 2026-06-22

**AI 코치 상담 기능 (PR #7, #8, #9)**
- `aiCoach.js` 신규 모듈 — Gemini 2.5 Flash API 연동 (BYOK, 무료 티어)
- 홈 화면 AI 코치 카드 + 채팅 모달 UI
- 설정 탭에 Gemini API 키 입력란 추가
- 운동 기록·회복도·규칙 추천/조언을 컨텍스트로 전송
- **버그 수정**: `ex.sets`가 숫자인데 배열로 처리하던 오류 수정 (PR #8)
- **응답 잘림 수정**: thinkingBudget 0, maxOutputTokens 8192, MAX_TOKENS 자동 이어쓰기 (PR #9)
- **페르소나 강화**: 헬스 트레이너 20년차 · 모빌리티·근비대·체형교정 전문가 톤

**운동 추천 드롭다운 (PR #10)**
- 상체/하체 × 유지/성장 4가지를 `<select>` 드롭다운으로 직접 선택
- 기록 분석 자동 추천은 `★ 추천` 표시 + 기본값
- 선택값 `recovr_rec_selected_v1` localStorage 저장
- 수동 선택 시 "기록 분석 추천: ~" 힌트 표시

**머지된 PR 목록**
| PR | 내용 |
|----|------|
| #7 | AI 코치 기능 추가 |
| #8 | AI 코치 sets/setDetails 오류 수정 |
| #9 | AI 코치 응답 잘림 + 트레이너 페르소나 |
| #10 | 운동 추천 드롭다운 선택 |

**다음 세션 후보 작업**
- [ ] AI 코치 답변 품질 실기기 테스트 및 프롬프트 미세 조정
- [ ] 운동 목표 설정 (월별 목표 횟수 등)
- [ ] 세트 간 휴식 타이머
- [ ] 근육 히트맵 다이어그램 (전면/후면 신체 실루엣)
- [ ] 모빌리티 전용 운동 목록 확충
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정

**현재 sw.js 캐시 버전**: `recovr-cache-v19`

**현재 앱 버전**: `1.0.0`

---

### 세션 4 — 2026-06-22

**사용자 프로필 맞춤 기능 (PR #11)**
- `userProfile.js` 신규 독립 모듈 — 성별·나이·키·몸무게·목표·경력·주당 일수·부상 메모
- 설정 탭 `👤 내 프로필` 섹션 UI 추가
- `calcMuscleRecovery()` — 프로필 기반 회복 배율 보정 (`getRecoveryScale`)
- `recommendation.js` — 목표·경력·주당 운동 일수 기반 추천 점수 보정
- `aiCoach.js` — AI 컨텍스트에 프로필 정보 포함
- 홈 화면 프로필 요약 한 줄 표시 (입력 완료 시)
- `sw.js` 캐시 `v19 → v20`, `userProfile.js` 캐시 목록 추가
- **버그 수정**: 회복 기준값만 변경 시 빈 폼이 프로필을 덮어쓰던 문제 (`saveSettings` 분리, `init`/`import` 시 `fillForm`)
- `test-profile-integration.js` 검증 스크립트 추가

**프로필 스키마** (`settings.profile`)
```js
{
  gender: 'male' | 'female' | 'other' | '',
  age: number | null,
  heightCm: number | null,
  weightKg: number | null,
  goal: 'hypertrophy' | 'fat_loss' | 'maintain' | 'strength' | 'rehab' | '',
  experience: 'beginner' | 'under1year' | '1to3years' | '3years+' | '',
  daysPerWeek: number | null,
  injuryNotes: string
}
```

**회복 보정 공식**
```
최종 userScale = (baseRecoveryHours / 48) × 나이계수 × 경력계수 × BMI계수
```

**현재 sw.js 캐시 버전**: `recovr-cache-v20`

**현재 앱 버전**: `1.0.0`

---

### 세션 5 — 2026-06-24

**시간 운동 스톱워치 (PR #12, #13)**
- `durationTimer.js` 신규 독립 모듈 — 플랭크·실내자전거 등 세트별 시작/정지 스톱워치
- 운동 행에 ⏱/🏋️ 모드 토글 버튼 추가
- `durationSets: [{ seconds, completed }]` 스키마로 시간 세트 저장
- `test-duration-timer.js` 단위 테스트 추가
- **버그 수정 (PR #13)**: 스톱워치 재생 중 `readFromWrap()`이 타이머를 즉시 멈추던 문제 → `freezeActiveTimer()` 분리

**무게 모드 세트 추가 버튼 버그 (PR #14, #15)**
- **증상**: 무게 운동 시 "+ 세트 추가" 버튼이 처음에 안 보임. 시간↔무게 토글 후에만 나타남
- **원인 1 (PR #14)**: `addExerciseRow()` HTML에서 `add-set-btn`에 무게 모드 `display:none`이 반대로 설정됨
- **원인 2 (PR #15)**: SW 캐시 우선 전략으로 구버전 `app.js`가 설치형 앱에 계속 서빙됨
- **수정**:
  - `display:none` 조건 제거
  - `addExerciseRow` 종료 시 `setRowMode(row, durationActive)` 호출로 표시 규칙 통일
  - `autoDetectMode` 후 실제 duration 모드 기준으로 세트 초기화
  - SW `v22 → v23`, JS/HTML **네트워크 우선** + 로드 시 `reg.update()`
  - `test-add-set-btn.js` 5항목 크로스체크 테스트 추가

**PWA 설치형 앱 동작 정리**
- 설치한 앱도 동일 URL 기반 → 머지·배포 후 **인터넷 연결 상태로 앱 실행** 시 최신 코드 반영
- 오프라인: 운동 기록·회복도·템플릿 등 localStorage 기반 기능 동작
- 오프라인 불가: AI 코치(Gemini API), 최초 설치·업데이트 다운로드

**머지된 PR 목록**
| PR | 내용 |
|----|------|
| #11 | 사용자 프로필 기반 맞춤 회복·운동 추천 |
| #12 | 시간 운동 세트별 스톱워치 |
| #13 | 스톱워치 재생 시 타이머 멈춤 버그 수정 |
| #14 | 무게 모드 세트 추가 버튼 display:none 수정 |
| #15 | SW 구캐시 서빙 + 초기화 경로 보강 |

**다음 세션 후보 작업**
- [ ] AI 코치 답변 품질 실기기 테스트 및 프롬프트 미세 조정
- [ ] 운동 목표 설정 (월별 목표 횟수 등)
- [ ] 세트 간 휴식 타이머
- [ ] 근육 히트맵 다이어그램 (전면/후면 신체 실루엣)
- [ ] 모빌리티 전용 운동 목록 확충
- [ ] PWA 설치형 앱 업데이트 안내 UI (새 버전 있을 때 알림)
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정

**현재 sw.js 캐시 버전**: `recovr-cache-v23`

**현재 앱 버전**: `1.0.0`

---

### 세션 6 — 2026-06-24

**유산소(심폐지구력) 추적 기능 (PR #16)**
- `cardioTracker.js` 신규 독립 모듈 — 유산소 운동 측정·주간 통계·기구 프리셋
- 운동 종류에 **유산소** 타입 추가 (상체/하체/전신/유산소 4종)
- 유산소 선택 시 기구 프리셋 UI: 천국의 계단, 로잉머신, 트레드밀, 실내자전거, 일립티컬, 스텝퍼, 수영, 줄넘기
- 빠른 시간 설정 버튼 (10/15/20/30/45분)
- 홈 화면 유산소 요약 카드 — 주간 시간, WHO 권장 150분 목표 달성률
- 통계 탭: 유산소 시간·횟수, 추세 그래프, 기구별 분석
- 캘린더·주간 바·기록 목록에 유산소 색상(핑크) 구분
- `workoutAdvice.js` — 유산소 부족/목표 달성 조언 추가
- 키워드 확장: 스텝밀, 천국의계단, 어설트 바이크, 크로스트레이너 등
- `test-cardio-tracker.js` 단위 테스트 추가
- `sw.js` 캐시 `v23 → v24`, `cardioTracker.js` 캐시 목록 추가

**머지된 PR 목록**
| PR | 내용 |
|----|------|
| #16 | 유산소(심폐지구력) 추적 기능 추가 |

**다음 세션 후보 작업**
- [ ] 유산소 세부 지표 (거리 km, 칼로리, 심박수) 입력 옵션
- [ ] AI 코치 답변 품질 실기기 테스트 및 프롬프트 미세 조정
- [ ] 운동 목표 설정 (월별 목표 횟수·유산소 시간 등)
- [ ] 세트 간 휴식 타이머
- [ ] 근육 히트맵 다이어그램 (전면/후면 신체 실루엣)
- [ ] 모빌리티 전용 운동 목록 확충
- [ ] PWA 설치형 앱 업데이트 안내 UI (새 버전 있을 때 알림)
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정

**현재 sw.js 캐시 버전**: `recovr-cache-v24`

**현재 앱 버전**: `1.0.0`

---

### 세션 7 — 2026-06-24

**데일리 미션 시스템 (PR #17, #19)**
- `dailyMission.js` 신규 독립 모듈 — 홈트·재활·체중감량 미션 3개/일
- 홈 `오늘의 데일리 미션` 카드 + 탭으로 완료 체크
- 프로필 목표·부상 메모 기반 상태 감지 (목디스크/허리디스크/재활/체중감량 등)
- 완료 시 `stamp: true` 저장 → 캘린더 연동
- **PR #19**: 상태별 미션 풀 분리 (고충격 동작 제외, 재활 맞춤 운동)
- `test-daily-mission-profile.js` 검증 스크립트 추가
- 백업·import 시 `dailyMissions` 포함

**운동 종목 피커 (PR #18)**
- `exercisePicker.js` 신규 독립 모듈 — 종목 목록에서 선택
- 카테고리 칩·기구 필터·초성 검색·최근 수행일 표시
- 빈 운동 행 재사용 (중복 행 방지)

**홈 추천 12종 확장 (PR #20)**
- `recommendation.js` 4종 → **12종** (근력 5 + 체형·유산소 2 + 재활·웰니스 5)
- 드롭다운 optgroup 3그룹 UI
- 유형별 프리셋 운동·팁·점수 보정 로직 확장
- `test-recommendation-types.js` 추가

**캘린더 미션·운동 색상 (PR #21 → #22)**
- **PR #21**: 미션 완료일 레몬색 채우기 (이후 #22로 대체)
- **PR #22**: 날짜 상태별 4색 체계 확정
  - 일반: 기존 흰색/서피스
  - 운동: 옅은 파랑 (`cal-status-workout`)
  - 미션: 옅은 초록 (`cal-status-mission`)
  - 둘 다: 황금 (`cal-status-both`)
- `buildCalendarByDate()` / `getCalStatusClass()` 추가 (완료 운동만 색상 판단)
- 범례 2줄: 상태 색상 + 운동 종류 점(상체/하체/전신/유산소)

**논의·정리 (코드 변경 없음)**
- AI 코치: 클라우드 API 무료 **무제한은 없음** (Gemini 무료 티어 한도). 규칙 기반 추천·미션·조언은 토큰 0
- PWA 설치 앱: 머지 후 **온라인 + 앱 재실행** 시 반영, 오프라인은 캐시 버전으로 동작

**머지된 PR 목록**
| PR | 내용 |
|----|------|
| #17 | 데일리 미션 시스템 |
| #18 | ExercisePicker 종목 선택 |
| #19 | 상태 맞춤형 재활 데일리 미션 |
| #20 | 홈 추천 12종 확장 |
| #21 | 미션 완료일 레몬색 (→ #22로 대체) |
| #22 | 캘린더 상태별 색상 (파랑·초록·황금) |

**다음 세션 후보 작업**
- [ ] AI 한도 초과 시 규칙 기반 답변 폴백 (하이브리드)
- [ ] PWA 설치형 앱 업데이트 안내 UI
- [ ] 미션 완료 시 캘린더 즉시 갱신 (현재 탭 전환 시 반영)
- [ ] 유산소 세부 지표 (거리 km, 칼로리, 심박수) 입력 옵션
- [ ] 운동 목표 설정 (월별 목표 횟수·유산소 시간 등)
- [ ] 세트 간 휴식 타이머
- [ ] 근육 히트맵 다이어그램 (전면/후면 신체 실루엣)
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정

**현재 sw.js 캐시 버전**: `recovr-cache-v30`

**현재 앱 버전**: `1.0.0`

---

### 세션 8 — 2026-07-06

**운동 종류별 캘린더 도형 구분 (PR #23)**
- 주간·월간 캘린더 범례 도형을 운동 종류별로 구분
  - 상체 △ / 하체 ▽ / 전신 □ / 유산소 ○
- `index.html` 범례·캘린더 점 스타일 CSS 수정

**운동 추가 UX 개선 (PR #24)**
- `+ 운동 추가` 시 **종목 피커 자동 열기** (빈 행 추가 후 바로 선택)
- 운동 행 상단에 **「종목 선택」** 버튼 추가 (기존 행에서도 피커 재호출)
- `app.js` — `addExerciseRow()` 후 `ExercisePicker.open()` 연동

**시간 운동 수동 입력 (PR #25)**
- **배경**: 스톱워치 사용 중 앱 강제 종료 시 시간 기록 소실, 세트별 직접 입력 불가
- `durationTimer.js` — 시간 표시 칸 탭 → 분·초 입력 UI → ✓ 적용
  - 스톱워치 실행 중인 세트는 탭 입력 불가 (정지 후 입력)
  - 바깥 영역 탭 시 입력 취소
  - `secondsFromParts()`, `applyManualSeconds()` API 추가
- `cardioTracker.js` — `applyCustomMinutes()` 유산소 임의 분(1~300) 직접 입력
- `index.html` — 수동 입력 스타일, 유산소 「분 직접 입력」 필드
- `test-duration-timer.js` — 수동 입력 유닛 테스트 추가

**머지된 PR 목록**
| PR | 내용 |
|----|------|
| #23 | 운동 종류별 범례·캘린더 도형 구분 |
| #24 | 운동 추가 시 종목 피커 자동 열기 |
| #25 | 시간 운동 세트별 수동 입력 (앱 종료 시 복구용) |

**다음 세션 후보 작업**
- [ ] 스톱워치 실행 중 주기적 자동 저장 (크래시 복구 강화)
- [ ] AI 한도 초과 시 규칙 기반 답변 폴백 (하이브리드)
- [ ] PWA 설치형 앱 업데이트 안내 UI
- [ ] 유산소 세부 지표 (거리 km, 칼로리, 심박수) 입력 옵션
- [ ] 운동 목표 설정 (월별 목표 횟수·유산소 시간 등)
- [ ] 세트 간 휴식 타이머
- [ ] 근육 히트맵 다이어그램 (전면/후면 신체 실루엣)
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정

**현재 sw.js 캐시 버전**: `recovr-cache-v30`

**현재 앱 버전**: `1.0.0`

---

### 세션 9 — 2026-07-06

**세트 간 휴식 타이머**
- `restTimer.js` 신규 독립 모듈 — 세트 완료 시 카운트다운 · 진동 알림
- 무게 모드(✓ 체크) · 시간 모드(✓ 체크·스톱워치 정지) 모두 연동
- 설정 탭: 사용 on/off, 기본 휴식 60/90/120/180초 프리셋 · 직접 입력(10~600초)
- 운동 모달 하단 sticky 오버레이: 카운트다운 · 진행 바 · +30초 · 건너뛰기
- `settings.restTimer` localStorage 저장 (백업·import 자동 포함)
- `test-rest-timer.js` 단위 테스트 추가

**중복 로직 정리**
- `workoutUtils.js` 신규 — `getWorkoutsInLookback()`, `UPPER_MUSCLES`, `LOWER_MUSCLES` 일원화
- `recommendation.js` · `workoutAdvice.js` · `aiCoach.js` 중복 함수·상수 제거
- `UPPER_MUSCLES`에 `forearms` 포함으로 통일 (기존 recommendation.js 누락 수정)
- `test-workout-utils.js` 단위 테스트 추가

**다음 세션 후보 작업**
- [ ] 스톱워치 실행 중 주기적 자동 저장 (크래시 복구 강화)
- [ ] AI 한도 초과 시 규칙 기반 답변 폴백 (하이브리드)
- [ ] PWA 설치형 앱 업데이트 안내 UI
- [ ] 유산소 세부 지표 (거리 km, 칼로리, 심박수) 입력 옵션
- [ ] 운동 목표 설정 (월별 목표 횟수·유산소 시간 등)
- [ ] 근육 히트맵 다이어그램 (전면/후면 신체 실루엣)
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정

**현재 sw.js 캐시 버전**: `recovr-cache-v31`

**현재 앱 버전**: `1.0.0`

---

### 세션 10 — 2026-07-06

**스톱워치 주기적 자동 저장**
- `durationAutoSave.js` 신규 독립 모듈 — 스톱워치 실행 중 30초마다 `saveWorkoutProgress` 호출
- `.duration-set-row.is-running` DOM 감지 (durationTimer.js 수정 없음)
- 앱 백그라운드 전환 시 즉시 flush (기존 `flushWorkoutProgress` 연동)
- `test-duration-autosave.js` 단위 테스트 추가

**PWA 업데이트 안내 UI**
- `pwaUpdate.js` 신규 독립 모듈 — 새 SW 설치 시 상단 배너 (새로고침 / 나중에)
- `sw.js`: install 시 자동 `skipWaiting` 제거 → 사용자 확인 후 `SKIP_WAITING` 메시지로 활성화
- 최초 설치(컨트롤러 없음)는 자동 활성화 유지
- `controllerchange` 시 페이지 새로고침
- `test-pwa-update.js` 검증 스크립트 추가

**다음 세션 후보 작업**
- [ ] AI 한도 초과 시 규칙 기반 답변 폴백 (하이브리드)
- [ ] 유산소 세부 지표 (거리 km, 칼로리, 심박수) 입력 옵션
- [ ] 운동 목표 설정 (월별 목표 횟수·유산소 시간 등)
- [ ] 근육 히트맵 다이어그램 (전면/후면 신체 실루엣)
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정

**현재 sw.js 캐시 버전**: `recovr-cache-v32`

**현재 앱 버전**: `1.0.0`

---

### 세션 11 — 2026-07-06

**월별 운동 목표 설정**
- `workoutGoals.js` 신규 독립 모듈 — 이번 달 운동 횟수·유산소 시간 목표
- 홈 `🎯 이번 달 목표` 카드: 달성률 진행 바, 미설정 시 설정 안내
- 설정 탭: 운동 횟수(1~60회)·유산소(30~3000분) 각각 on/off
- `settings.monthlyGoals` localStorage 저장 (백업·import 자동 포함)
- `CardioTracker.getWorkoutCardioMinutes` 연동으로 유산소 집계
- `test-workout-goals.js` 단위 테스트 추가

**버그 검사·테스트 수정**
- `test-cardio-tracker.js`: 고정 날짜(2026-06-24) → 동적 날짜로 수정 (lookback 실패 해결)
- `test-add-set-btn.js`: SW 캐시 v30 하드코딩 → `recovr-cache-v\d+` 패턴 검사로 수정
- 전체 11개 테스트 스위트 ALL PASSED ✓

**다음 세션 후보 작업**
- [ ] AI 한도 초과 시 규칙 기반 답변 폴백 (하이브리드)
- [ ] 유산소 세부 지표 (거리 km, 칼로리, 심박수) 입력 옵션
- [ ] 근육 히트맵 다이어그램 (전면/후면 신체 실루엣)
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정

**현재 sw.js 캐시 버전**: `recovr-cache-v33`

**현재 앱 버전**: `1.0.0`

---

### 세션 12 — 2026-07-06

**근육 히트맵 다이어그램**
- `muscleHeatmap.js` 신규 독립 모듈 — 전면/후면 SVG 실루엣 + 11개 부위 회복도 색상
- 홈 `부위별 회복 상태` 섹션 상단에 히트맵 카드 배치
- 전면/후면 토글, 부위 탭 시 툴팁 (이름·회복 %)
- 회복도 색상: 기존 `getPctColor` 연동 (빨강→주황→노랑→초록)
- 기록 없는 부위: 흐린 회색 표시
- `test-muscle-heatmap.js` 단위 테스트 추가

**버그 검사**
- 전체 12개 테스트 스위트 ALL PASSED ✓

**다음 세션 후보 작업**
- [ ] AI 한도 초과 시 규칙 기반 답변 폴백 (하이브리드)
- [ ] 유산소 세부 지표 (거리 km, 칼로리, 심박수) 입력 옵션
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정

**현재 sw.js 캐시 버전**: `recovr-cache-v34`

**현재 앱 버전**: `1.0.0`

---

### 세션 13 — 2026-07-06

**AI 한도 초과 규칙 기반 폴백**
- `aiCoachFallback.js` 신규 독립 모듈 — API 429·네트워크·503 오류 시 로컬 답변
- 질문 의도 감지: 오늘 운동 / 주간 계획 / 밸런스 / 회복 / 유산소 / 일반
- `WorkoutRecommendation` · `WorkoutAdvice` · `calcMuscleRecovery` · `CardioTracker` 연동
- `aiCoach.js` 최소 연동: catch 시 폴백 시도, 네트워크·503 에러 분류 추가
- `test-ai-coach-fallback.js` 단위 테스트 추가

**버그 검사**
- 전체 13개 테스트 스위트 ALL PASSED ✓

**다음 세션 후보 작업**
- [ ] 유산소 세부 지표 (거리 km, 칼로리, 심박수) 입력 옵션
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정

**현재 sw.js 캐시 버전**: `recovr-cache-v35`

**현재 앱 버전**: `1.0.0`

---

### 세션 14 — 2026-07-06

**유산소 세부 지표 입력**
- `cardioMetrics.js` 신규 독립 모듈 — 거리(km)·칼로리·평균 심박(bpm) 선택 입력
- 유산소 운동 행에 세부 지표 필드 자동 표시 (유산소 타입·종목 감지)
- `exercise.cardioMetrics` 스키마로 저장 (백업·import 자동 포함)
- 홈: 이번 주 거리·칼로리·심박 요약 한 줄
- 통계 탭: 주간 거리·칼로리·평균 심박 카드
- 기록 상세·캘린더에 세부 지표 표시
- `test-cardio-metrics.js` 단위 테스트 추가

**버그 검사**
- 전체 14개 테스트 스위트 ALL PASSED ✓

**다음 세션 후보 작업**
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정

**현재 sw.js 캐시 버전**: `recovr-cache-v36`

**현재 앱 버전**: `1.0.0`

---

### 세션 15 — 2026-07-06 (main 머지)

**무결성 검사**
- JS 문법 검사: 전체 `.js` 파일 통과 ✓
- 단위 테스트 14개 스위트: ALL PASSED ✓
- SW `ASSETS` ↔ 실제 파일 일치 (19개) ✓
- `index.html` script 참조 ↔ 실제 파일 일치 (19개) ✓

**main 머지 (PR #26~#31 일괄 통합)**
| PR | 기능 |
|----|------|
| #26 | 세트 간 휴식 타이머 + workoutUtils 중복 정리 |
| #27 | 스톱워치 주기적 자동 저장 + PWA 업데이트 안내 |
| #28 | 월별 운동 목표 설정 + 테스트 버그 수정 |
| #29 | 근육 회복 히트맵 (전면/후면 SVG) |
| #30 | AI 한도 초과 규칙 기반 폴백 |
| #31 | 유산소 세부 지표 (거리·칼로리·심박) |

**신규 모듈 10개**: `restTimer.js`, `workoutUtils.js`, `durationAutoSave.js`, `pwaUpdate.js`, `workoutGoals.js`, `muscleHeatmap.js`, `aiCoachFallback.js`, `cardioMetrics.js` (+ 기존 모듈 연동)

**다음 세션 후보 작업**
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정
- [ ] 앱 버전 1.1.0 정식 릴리스 검토

**현재 sw.js 캐시 버전**: `recovr-cache-v36`

**현재 앱 버전**: `1.0.0`

---

### 세션 16 — 2026-07-08 (main 머지)

**추천 운동 UX 개선 (PR #32)**
- `이 추천으로 운동 시작` 시 세트가 **미체크** 상태로 열림 (과거 `completed: true` 복사 방지)
- duration 프리셋도 `durationSets`를 `completed: false`로 생성
- `openModalWithPrefill`에서 모달 열자마자 `saveWorkoutProgress` 호출 제거 → 닫으면 저장 안 됨
- `test-recommendation-types.js` 미체크 prefill 검증 추가

**근육 회복 히트맵 시각 개선 (PR #33)**
- 큰 근육(가슴·등·허벅지·햄스트링·코어·어깨)에 회복 % 숫자 직접 표시
- 낮은 회복 부위 glow pulse 애니메이션 (피로 빨강 / 회복중 주황)
- 카드 상단 gradient accent bar, segmented control 토글, glassmorphism 툴팁
- **인체 도형 실루엣 개선**: 고스트 바디 가이드 레이어 + 타원 비율·각도 재조정

**추천 무게 5kg 단위 (PR #34)**
- `roundWeightToGymPlate()` — 헬스장 원판 단위(5kg)로 반올림 (53.2kg → 55kg)
- 유지/성장 모든 추천 prefill에 적용, 성장 모드 bump 후에도 5kg 단위 유지

**무결성 검사**
- JS 문법 검사: 전체 `.js` 파일 통과 ✓
- 단위 테스트 14개 스위트: ALL PASSED ✓

**main 머지**
| PR | 기능 |
|----|------|
| #32 | 추천 운동 시작 시 세트 미체크 + 즉시 저장 방지 |
| #33 | 근육 회복 히트맵 시각·인체 실루엣 개선 |
| #34 | 추천 운동 무게 5kg 단위 반올림 |

**다음 세션 후보 작업**
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정
- [ ] 앱 버전 1.1.0 정식 릴리스 검토

**현재 sw.js 캐시 버전**: `recovr-cache-v36`

**현재 앱 버전**: `1.0.0`

---

### 세션 17 — 2026-07-13 (main 머지)

**근육 회복 히트맵 전면 개편**
- SVG 손그림 실루엣 → **일러스트 이미지 베이스** (`body-map-front.jpg` / `body-map-back.jpg`)
- SVG는 부위 탭 + 회복색 오버레이만 담당
- 일러스트 흰색 분할선 기준으로 구역 path 추출 → blob 오버레이 정렬 개선
- 몸 실루엣 마스크(`body-mask-*.png`)로 배경 번짐 방지
- 기본 근육색을 테라코타 → **옅은 회색 (`#eeeeef`)** 로 변경해 회복색과 대비 확보

**무결성 검사**
- JS 문법 검사: 전체 `.js` 파일 통과 ✓
- 단위 테스트 14개 스위트: ALL PASSED ✓
- SW `ASSETS` ↔ 실제 파일 일치 ✓
- `index.html` script 참조 ↔ 실제 파일 일치 ✓

**main 머지**
| PR | 기능 |
|----|------|
| #38 | 히트맵 스타일 A / 픽토그램 실루엣 |
| #39 | 일러스트 이미지 베이스 히트맵 |
| #40 | 근육 칸 정렬 + 실루엣 마스크 |
| #41 | 기본 근육색 옅은 회색 |

**다음 세션 후보 작업**
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정
- [ ] 앱 버전 1.1.0 정식 릴리스 검토

**현재 sw.js 캐시 버전**: `recovr-cache-v44`

**현재 앱 버전**: `1.0.0`

---

### 세션 18 — 2026-07-13 (main 머지)

**히트맵 바디 에셋 정리·캐시 보정**
- 기본 몸통이 주황으로 보이던 문제 → **SW/브라우저 캐시 잔존** 확인
- 바디맵·마스크 네트워크 우선 + `?v=` 쿼리로 구캐시 우회 (PR #43, v45)
- JPEG 압축·주황 제거 잔여 픽셀 정리 → **4색 팔레트 PNG** 재생성 (PR #44)
- `body-map-*.jpg` 제거, `body-map-*.png`로 교체, 구역 path 재추출
- SW 캐시 `recovr-cache-v46`

**무결성 검사**
- JS 문법 검사: `muscleHeatmap.js` / `sw.js` 통과 ✓
- `test-muscle-heatmap.js` PASSED ✓
- SW `ASSETS` ↔ 실제 파일 일치 ✓

**main 머지**
| PR | 기능 |
|----|------|
| #43 | 히트맵 바디 이미지 캐시 잔존 방지 |
| #44 | 바디맵 무압축 PNG로 깔끔하게 재생성 |

**다음 세션 후보 작업**
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정
- [ ] 앱 버전 1.1.0 정식 릴리스 검토

**현재 sw.js 캐시 버전**: `recovr-cache-v46`

**현재 앱 버전**: `1.0.0`

---

### 세션 19 — 2026-07-14

**마이크로 애니메이션 모듈 추가**
- 독립 모듈 `microAnim.js` — 기존 모듈 로직 수정 없이 이벤트 위임으로 연결
- 세트/시간/미션 체크 완료 시 **pop + glow flash**
- 저장·타입·FAB 등 주요 버튼 **터치 리플**
- 네비/탭 **press scale**, 미션 하루 완료 시 **stamp + success pulse**
- `prefers-reduced-motion` 존중 (모션 끄기)
- SW 캐시 `recovr-cache-v47`, `test-micro-anim.js` 추가

**무결성 검사**
- JS 문법 검사: `microAnim.js` / `sw.js` 통과 ✓
- 단위 테스트 15개 스위트: ALL PASSED ✓
- SW `ASSETS` ↔ 실제 파일 일치 ✓
- `index.html` script 참조 ↔ 실제 파일 일치 ✓

**다음 세션 후보 작업**
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정
- [ ] 앱 버전 1.1.0 정식 릴리스 검토
- [ ] 마이크로 애니메이션 범위 확장(진행바 숫자 카운트 등) 검토

**현재 sw.js 캐시 버전**: `recovr-cache-v47`

**현재 앱 버전**: `1.0.0`

---
