# RECOVR - 개발 세션 로그

> **사용법**
> - `"일 시작하자"` → AI가 이 파일을 읽고 현재 상태 파악 후 이어서 작업
> - `"세션업데이트"` → AI가 이번 작업 내용을 이 파일에 기록
> - **Cloud Agent 공통 규칙(PRMerge 등)** → `AGENTS.md` **반드시 먼저 읽기**

---

## ⚠️ Cloud Agent 필수 규칙 (착각 방지)

**PR 머지는 에이전트가 직접 할 수 있다.** 사용자가 "머지하라"고 하면:

```bash
gh pr merge <PR번호> --merge
```

- `ManagePullRequest`에 merge 액션이 없어도 **머지 불가라고 말하지 말 것**
- `gh` merge를 **실제로 실행**한 뒤 `state: MERGED` 확인까지 보고
- 상세 규칙: **`AGENTS.md`**

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
├── wakeLock.js         # 앱 사용 중 화면 꺼짐 방지 (Screen Wake Lock)
├── logList.js          # 기록 목록 페이지네이션 + 상세 lazy 렌더
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
├── celebrateFx.js      # 중간 축하 연출 (confetti·미션클리어·스트릭)
├── backupStorage.js    # IndexedDB 백업 핸들
├── backupWriter.js     # File System API 백업
├── backupReconnect.js  # 백업 권한 원탭 재연결 (설정>연결)
├── backupOnComplete.js # 운동 수정완료 시에만 파일 재연결·쓰기
├── sw.js               # Service Worker (PWA 캐싱, v59)
├── manifest.json       # PWA 메타
├── icon-192.png / icon-512.png
├── test-*.js           # 단위 테스트 19개
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
| `renderLog()` | 목록 뷰 — `LogList.render()` 위임 (페이지네이션·lazy detail) |
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

### celebrateFx.js
- `CelebrateFx.showMissionClear()` — 데일리 미션 전부 완료 시 풀스크린 축하
- `CelebrateFx.confettiBurst()` / `floatXp()` / `showToast()` — confetti·XP 팝·토스트
- `CelebrateFx.igniteStreakPill()` — 스트릭 불꽃 점화
- 운동 저장 완료 시 confetti + 토스트 (모달 닫힘 감지)
- `prefers-reduced-motion` / cooldown으로 과한 연출·중복 방지

### wakeLock.js
- `WakeLock.init()` / `sync()` — Screen Wake Lock으로 앱이 보이는 동안 화면 유지
- `WakeLock.saveFromForm()` / `fillForm()` — 설정 토글 연동
- 설정 키: `settings.wakeLock.enabled` (기본 ON)
- `visibilitychange` 시 재요청 · 미지원 브라우저는 상태 문구로 안내

### logList.js
- `LogList.render()` — 기록 목록 렌더 (최근 `PAGE_SIZE=40`개)
- `LogList.loadMore()` — 「더 보기」로 40개씩 추가 표시
- `LogList.toggleDetail()` — 펼칠 때 세트 상세 HTML lazy 생성
- 정렬 시 원본 인덱스 유지 (`indexOf` O(n²) 제거)
- `buildExerciseDetailHTML()`는 캘린더 day detail과 공용 유지

### 자동 백업 트리거
- **운동 「저장하기 / 수정 완료」(`saveWorkout`)만** 파일 재연결 + 쓰기 (`BackupOnComplete`)
- 앱 시작 시에는 FS 권한 조회·재연결·쓰기를 **하지 않음** (홈 렌더 안정성)
- 세트 체크·진행중 자동저장은 localStorage만 갱신 (파일 백업 안 함)
- 조건: 설정 >「자동 백업 파일 연결」로 File System Access 핸들 연결 필요
- 설정 >「연결」버튼으로도 수동 재연결 가능

### backupOnComplete.js
- `BackupOnComplete.syncAfterWorkoutSave(deps)` — 저장 버튼 제스처에서 권한 복원 후 쓰기
- `BackupOnComplete.getSettingsGuide()` — 「수정 완료」시에만 백업된다는 안내

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
- `WorkoutRecommendation.compute()` — 10일치 기록 분석 → **23종 유형** 중 1개 자동 추천
- `WorkoutRecommendation.setType()` — 드롭다운으로 유형 직접 선택 (7그룹 optgroup)
- `WorkoutRecommendation.render()` — 홈 화면 추천 카드 + select 드롭다운
- `WorkoutRecommendation.apply()` — 추천 내용으로 운동 모달 열기 (세트 미체크 prefill, 즉시 저장 없음)
- `roundWeightToGymPlate()` — 추천 무게 **5kg 단위** 반올림 (53.2kg → 55kg)
- **23종 유형 · 7개 카테고리(optgroup)**:
  - 강화 · 근력(상·하체): 상·하체 유지/성장, 전신 유지
  - 강화 · 부위별: 가슴/등/어깨/팔/복근·코어/둔근·햄스트링/종아리 강화 (`chest_focus` 등, `MUSCLE_FOCUS_CONFIG` 참조)
  - 보충 · 약점 보완: **근손실 부위 강화**(`muscle_loss_focus`) — `MuscleGrowthTracker.compute()`의 근손실 지수 중 최상위 부위를 `ExerciseMuscleMap.getExercisesForMuscle()`로 매칭해 추천, 데이터 없으면 정적 폴백 루틴
  - 기능성: 밸런스·안정성 / 파워·순발력 / 근지구력 강화
  - 다이어트 · 체형: 체중감소, 기능성 유산소
  - 모빌리티: 가동성·스트레칭
  - 재활 · 회복: 목·허리 재활, 재활·회복, 코어 안정화
- `scoreFocusRecommendations()` — 부위별 강화/보충/기능성 점수를 `scoreExtendedRecommendations()`와 분리된 함수로 독립 채점(기존 점수 로직 미수정). 목·허리디스크 등 재활 필요 상태에서는 강화형 추천 전체를 억제해 재활 유형이 항상 우선되도록 함
- 유형별 `EXERCISE_PRESETS` 프리셋 운동 목록 (부위별 강화는 기록 우선 → `ExerciseMuscleMap` → 정적 폴백 순으로 종목 선정)
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

### 세션 20 — 2026-07-14

**중간 수준 축하 연출 (CelebrateFx)**
- 독립 모듈 `celebrateFx.js` — 기존 모듈 비침투 (이벤트 위임)
- 데일리 미션 전부 완료 → **풀스크린 미션 클리어** + confetti + 스트릭 표시
- 세트/시간 체크 → **+1 XP 팝** + 소량 confetti
- 운동 저장 완료 → confetti + 「운동 기록 완료」토스트 + 스트릭 점화
- 스트릭 pill 텍스트 변경 시 **불꽃 점화** 애니메이션
- 진동 피드백(`navigator.vibrate`) + cooldown + `prefers-reduced-motion`
- SW 캐시 `recovr-cache-v48`, `test-celebrate-fx.js` 추가

**무결성 검사**
- JS 문법 검사: `celebrateFx.js` / `sw.js` 통과 ✓
- 단위 테스트 16개 스위트: ALL PASSED ✓
- SW `ASSETS` ↔ 실제 파일 일치 ✓
- `index.html` script 참조 ↔ 실제 파일 일치 ✓

**다음 세션 후보 작업**
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정
- [ ] 앱 버전 1.1.0 정식 릴리스 검토

**현재 sw.js 캐시 버전**: `recovr-cache-v48`

**현재 앱 버전**: `1.0.0`

---

### 세션 21 — 2026-07-14 (main 머지)

**근육 히트맵 근육명 라벨 (PR #48)**
- 전면/후면 부위에 한국어 짧은 근육명 표시 (가슴·등·어깨·이두·삼두·코어·전완·대퇴·햄스·내전·종아리)
- 회복 데이터 있으면 `이름 + %`, 없으면 이름만
- 라벨을 multiply 블렌드/마스크 **밖**에 배치해 가독성 확보

**백업 파일 연결 원탭 재연결 (PR #49)**
- 독립 모듈 `backupReconnect.js` 추가
- 브라우저 보안상 새로고침 후 권한(`prompt`) 풀림은 완전 무조작 유지 불가
- IndexedDB 핸들은 유지 → 상단 **「다시 연결」** 한 번으로 `requestPermission` 복원 (파일 재선택 불필요)
- PWA 설치 / 권한 「매번 허용」 시 유지되는 경우 많음 → 가이드 문구 반영
- 재연결 쓰기 실패 시에도 핸들 clear 하지 않음
- `visibilitychange` / `pageshow` 시 권한 재확인
- SW 캐시 `recovr-cache-v50`, `test-backup-reconnect.js` 추가

**무결성 검사**
- JS 문법 검사: `muscleHeatmap.js` / `backupReconnect.js` / `app.js` / `sw.js` 통과 ✓
- 단위 테스트 17개 스위트: ALL PASSED ✓
- SW `ASSETS` ↔ 실제 파일 일치 ✓
- `index.html` script 참조 ↔ 실제 파일 일치 ✓

**main 머지**
| PR | 기능 |
|----|------|
| #48 | 근육 히트맵 부위별 근육명 라벨 |
| #49 | 백업 파일 연결 원탭 재연결 |

**다음 세션 후보 작업**
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정
- [ ] 앱 버전 1.1.0 정식 릴리스 검토
- [ ] 백업 재연결 실기기(Android Chrome/PWA) 확인

**현재 sw.js 캐시 버전**: `recovr-cache-v50`

**현재 앱 버전**: `1.0.0`

---

### 세션 22 — 2026-07-17 (main 머지)

**앱 사용 중 화면 유지 (PR #54)**
- 독립 모듈 `wakeLock.js` 추가 (Screen Wake Lock API)
- 앱이 화면에 보이는 동안 꺼짐 방지 (기본 ON)
- 설정 > **화면** >「앱 사용 중 화면 유지」토글
- 탭 복귀(`visibilitychange`) 시 자동 재요청
- SW 캐시 `recovr-cache-v54`, `test-wake-lock.js` 추가

**자동 백업 안내 명확화**
- 운동 추가·세트 체크 시에도 `saveWorkoutProgress` → `triggerAutoBackup`으로 파일 백업됨 (기존 동작)
- 설정 가이드 / `BackupWriter.getSettingsGuide()` 문구를 그 동작에 맞게 수정

**무결성 검사**
- JS 문법 검사: `wakeLock.js` / `app.js` / `sw.js` / `backupWriter.js` 통과 ✓
- 단위 테스트 18개 스위트: ALL PASSED ✓
- SW `ASSETS` ↔ 실제 파일 일치 ✓
- `index.html` script 참조 ↔ 실제 파일 일치 ✓

**main 머지**
| PR | 기능 |
|----|------|
| #54 | 화면 유지(Wake Lock) + 자동 백업 안내 명확화 |

**다음 세션 후보 작업**
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정
- [ ] 앱 버전 1.1.0 정식 릴리스 검토
- [ ] 화면 유지·자동 백업 실기기(Android Chrome/PWA) 확인

**현재 sw.js 캐시 버전**: `recovr-cache-v54`

**현재 앱 버전**: `1.0.0`

---

### 세션 23 — 2026-07-17 (main 머지)

**기록 목록 페이지네이션 + 상세 lazy 렌더 (PR #56)**
- 독립 모듈 `logList.js` 추가
- 목록은 최근 **40개**만 표시, 「더 보기」로 40개씩 확장 (`N / 전체` 표시)
- 세트 상세·수정/삭제 버튼은 **펼칠 때만** 생성
- `app.js`의 `renderLog` / `toggleWorkoutDetail`는 `LogList`에 위임
- 정렬 시 원본 인덱스 유지로 대량 목록 성능 개선
- SW 캐시 `recovr-cache-v55`, `test-log-list.js` 추가

**무결성 검사**
- JS 문법 검사: `logList.js` / `app.js` / `sw.js` 통과 ✓
- 단위 테스트 19개 스위트: ALL PASSED ✓
- SW `ASSETS` ↔ 실제 파일 일치 ✓
- `index.html` script 참조 ↔ 실제 파일 일치 ✓

**main 머지**
| PR | 기능 |
|----|------|
| #56 | 기록 목록 페이지네이션 + 상세 lazy 렌더 |

**다음 세션 후보 작업**
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정
- [ ] 앱 버전 1.1.0 정식 릴리스 검토
- [ ] 대량 기록(수백~수천) 실기기 스크롤·더보기 체감 확인

**현재 sw.js 캐시 버전**: `recovr-cache-v55`

**현재 앱 버전**: `1.0.0`

---

### 세션 24 — 2026-07-21 (main 머지, 로그 후기입)

**프로필 출생년 (PR #58·#59)**
- 나이(age) → 출생년(birthYear) 필드로 변경
- age→birthYear 마이그레이션 시 `setItem` 실패해도 설정 유실 방지

**홈 상태 요약 (PR #60)**
- `homeStatusSummary.js` — 선택 몸상태·회복 기반 홈 한 줄 요약
- SW 캐시 `recovr-cache-v58`

**백업·홈 안정화 (PR #51·#52, 세션 21 후속)**
- 앱 시작 시 백업 자동 재연결 배너 비활성화 (홈 깨짐 방지)
- 설정 >「연결」로만 권한 재허용

**무결성**
- main에 머지 완료 (#58~#60)

**현재 sw.js 캐시 버전**: `recovr-cache-v58`

**현재 앱 버전**: `1.0.0`

---

### 세션 25 — 2026-07-24

**자동 백업: 운동 수정완료 시에만 파일 연결·쓰기**
- 원인: 앱 시작 직후 백업 파일 재연결/쓰기가 홈 렌더와 겹치면 화면이 갱신되지 않거나 에러 발생
- 독립 모듈 `backupOnComplete.js` 추가
- `saveWorkout()`(저장하기 / 수정 완료) **제스처 안에서만** 권한 복원 + 파일 쓰기
- `initBackupFromStorage()`: 앱 시작 시 FS `queryPermission`/핸들 활성화 **안 함**
- 진행중 자동저장·세트 체크·설정/템플릿 저장은 localStorage만 (파일 백업 안 함)
- `triggerAutoBackup()` 레거시 no-op 유지
- 설정 가이드 문구를 「수정 완료 시에만 백업」으로 변경
- SW 캐시 `recovr-cache-v59`, `test-backup-on-complete.js` 추가

**기대 효과**
- 홈 첫 렌더와 FS API 경쟁 제거 → 시작 시 홈 깨짐·에러 감소
- 권한 요청이 저장 버튼 사용자 제스처에 묶여 브라우저 정책에도 더 안전

**다음 세션 후보 작업**
- [ ] 실기기에서 「수정 완료」후 백업 파일 갱신·권한 팝업 확인
- [ ] 앱 버전 1.1.0 정식 릴리스 검토

**현재 sw.js 캐시 버전**: `recovr-cache-v59`

**현재 앱 버전**: `1.0.0`

---

### 세션 26 — 2026-07-28 (main 머지, 로그 후기입)

**운동 자극 히트맵 + 부위별 관련 운동 탐색 (PR #62)**
- 독립 모듈 `exerciseStimHeatmap.js`, 매핑 데이터 `exerciseMuscleMap.js` 추가
- `ExerciseMuscleMap.STIM_PROFILES` — 100여 개 운동의 근육별 자극 강도(1~3) 정의
- 종목 검색/카테고리에서 선택 운동의 자극 부위를 히트맵으로 미리보기
- 홈 근육 히트맵에서 부위 탭 시 해당 근육을 자극하는 관련 운동 목록 표시
- `calcMuscleRecovery`(회복도 계산)는 기존과 동일하게 `getMusclesFromExerciseName`(키워드)만 사용 — `ExerciseMuscleMap`은 자극 미리보기 전용이라 회복 로직과 분리됨
- SW 캐시 `recovr-cache-v60`, `test-exercise-stim-heatmap.js` 추가

**무결성 검사**
- 단위 테스트 스위트 통과 확인 (`test-exercise-stim-heatmap.js` 포함)

**다음 세션 후보 작업**
- [ ] 실기기에서 자극 히트맵 인터랙션(터치) 확인

**현재 sw.js 캐시 버전**: `recovr-cache-v60`

**현재 앱 버전**: `1.0.0`

---

### 세션 27 — 2026-07-28 (main 머지, 로그 후기입)

**부위 목록에서 운동 선택 시 상하 분할 미리보기 (PR #63)**
- `exerciseStimHeatmap.js` 개선: 근육 리스트 위에 축소 자극 히트맵을 상하 분할로 표시해 리스트와 한 화면에서 비교 가능하게 변경
- 기존 별도 오버레이 방식은 리스트 뒤에 가려지는 z-index 문제가 있어 제거
- SW 캐시 `recovr-cache-v61`

**무결성 검사**
- `test-exercise-stim-heatmap.js` 케이스 추가 및 통과 확인

**다음 세션 후보 작업**
- [ ] 실기기에서 분할 레이아웃 스크롤 체감 확인

**현재 sw.js 캐시 버전**: `recovr-cache-v61`

**현재 앱 버전**: `1.0.0`

---

### 세션 28 — 2026-08-04 (main 머지, 로그 후기입)

**모바일 당겨서 새로고침(pull-to-refresh) 방지 (PR #64)**
- 독립 모듈 `pullRefreshGuard.js` 추가
- 운동 기록 중 화면을 아래로 끌면 브라우저가 새로고침되어 입력 중이던 세트/시간 기록이 날아가는 문제 방지
- `overscroll-behavior` CSS + `PullRefreshGuard` 모듈(터치 제스처 감지) 이중 방어
- SW 캐시 `recovr-cache-v62`

**무결성 검사**
- 관련 테스트 스위트 참조·통과 확인

**다음 세션 후보 작업**
- [ ] 실기기(Android/iOS 웹뷰) 당겨서 새로고침 차단 확인

**현재 sw.js 캐시 버전**: `recovr-cache-v62`

**현재 앱 버전**: `1.0.0`

---

### 세션 29 — 2026-08-04 (main 머지, 로그 후기입)

**백그라운드 복귀·잠깐 종료 후 앱 재개 강화 (PR #65)**
- 독립 모듈 `appResume.js` 추가
- `visibilitychange` / `pageshow` / `freeze` / 시간 점프(기기 절전 등)를 감지해 복귀 시 즉시 반영:
  - `WakeLock` 재요청, 진행 중이던 스톱워치·휴식 타이머 시간 보정
  - 진행 중이던 운동 모달을 확인창 없이 자동 복원 (기존에는 확인 팝업 필요)
- `durationTimer.js` / `restTimer.js`에 시간 보정을 위한 보조 함수 추가 (기존 동작에는 영향 없음)
- SW 캐시 `recovr-cache-v63`, `test-app-resume.js` 추가

**무결성 검사**
- `test-app-resume.js` 신규 스위트 통과 확인

**다음 세션 후보 작업**
- [ ] 실기기에서 장시간 백그라운드 후 복귀 시나리오(수 시간 절전) 확인
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정
- [ ] 앱 버전 1.1.0 정식 릴리스 검토

**현재 sw.js 캐시 버전**: `recovr-cache-v63`

**현재 앱 버전**: `1.0.0`

---

### 세션 30 — 2026-08-29 (main 머지)

**근성장 · 근손실 추적 + 칼로리 소모 추정 (독립 모듈)**
- 독립 모듈 `muscleGrowthTracker.js` 추가 — `calcMuscleRecovery`(app.js)는 전혀 수정하지 않음
- 기존 "회복도"는 시간(h) 단위로 "며칠 쉬어야 하는지"만 계산하고, 손실/성장 방향은 계산하지 않던 문제를 보완
- **칼로리 소모 추정**: 운동 타입별 MET(대사당량) × 피로도 보정 × 체중(kg) × 시간(h) 공식. 유산소는 `CardioMetrics`에 사용자가 직접 입력한 칼로리를 우선 사용
- **근성장 지수**: 최근 4주간 부위별 훈련 빈도(이상적 주 2회 기준) + 과부하 진행도(최근 2주 vs 이전 2주 평균 볼륨)로 0~3% 추정 지수 산출
- **근손실(디트레이닝) 지수**: 부위별 마지막 훈련일로부터 경과일 기준, 2주까지는 0%, 8주 이상은 최대 8%로 비례 산출
- 홈 화면에 `#muscleGrowthCard` 신규 카드 추가 (근성장 +N% / 근손실 -N%), 기록이 없으면 렌더하지 않음
- 저장 완료 시 그날 소모 칼로리를 토스트로 안내 (`recovr_growth_log_v1`에 일자별 로그 저장)
- **체성분 실측이 아닌 훈련 패턴 기반 추정치**임을 카드 하단에 명시 (기존 회복도와 동일하게 추정 모델임을 사용자에게 안내)
- SW 캐시 `recovr-cache-v64`, `test-muscle-growth-tracker.js` 추가 (칼로리/성장/손실/로그 저장 6개 시나리오 검증)

**중요 발견 및 수정 — 모달 내부 클릭이 `document` 버블 델리게이션으로 감지 안 되던 문제 (사용자 승인 후 수정 완료)**
- `.modal` 컨테이너가 `onclick="event.stopPropagation()"`로 오버레이 배경 클릭 시에만 모달이 닫히도록 방어하고 있음 (`index.html` 3401행, 의도된 기존 동작 — 그대로 유지)
- 이 때문에 `#saveBtn`을 포함한 모달 내부의 모든 클릭은 **`document`까지 버블링되지 않았음**
- `celebrateFx.js`·`microAnim.js`도 `document.addEventListener('click', fn, false)`(버블 단계)로 `#saveBtn`/`.set-check` 등을 감지하는 패턴이라, **실제로는 저장 시 "운동 기록 완료" 토스트·컨페티, 세트 체크 시 `+1 세트` XP 팝업, 저장 버튼 성공 펄스가 전혀 발동하지 않고 있었음** (Playwright 실브라우저 재현으로 확인 및 수정 후 재검증 완료)
- `muscleGrowthTracker.js`는 처음부터 **캡처 단계**(`document.addEventListener('click', fn, true)`)로 등록해 정상 동작
- 사용자 승인을 받아 `celebrateFx.js`·`microAnim.js`의 동일한 `document.addEventListener('click', ...)` 호출을 버블→캡처 단계로 수정 (`removeEventListener`도 동일 capture 플래그로 맞춤). 두 핸들러 모두 실제 로직은 `setTimeout`/`requestAnimationFrame`으로 지연 실행되므로 캡처 단계로 바꿔도 동작 차이 없이 안전하게 적용됨
- 수정 후 Playwright e2e로 재검증: 세트 체크 시 `+1 세트`+컨페티, 저장 시 "운동 기록 완료 💪" 토스트, 저장 버튼 `ma-success-pulse` 효과 모두 정상 발동 확인
- **추후 모달 내부 클릭을 감지해야 하는 신규 모듈은 반드시 캡처 단계를 사용할 것**

**발견 및 수정 — 회복도(%) 음수 표시 엣지 케이스 (사용자 승인 후 수정 완료)**
- `calcMuscleRecovery`(app.js)가 세션 시각을 항상 정오(`T12:00:00`)로 가정해서, 당일 낮 12시 이전에 운동을 저장하면 `hoursElapsed`가 음수가 되어 홈 히어로에 `-18%` 같은 음수 회복도가 표시되던 문제
- `hoursElapsed`, `recoveryPct` 모두 `Math.max(0, ...)` 하한 클램프 추가로 수정. Playwright e2e로 저장 직후 회복도가 `0%`로 정상 표시되는 것 확인

**무결성 검사**
- JS 문법 검사: `muscleGrowthTracker.js` / `app.js` / `index.html` / `sw.js` 통과 ✓
- 단위 테스트 25개 스위트: ALL PASSED ✓ (`test-muscle-growth-tracker.js` 신규 포함, 캐시 버전 하드코딩된 7개 테스트 파일도 v64로 동기화)
- Playwright 기반 실브라우저 e2e로 저장→칼로리 추정→토스트→홈 카드 렌더까지 실제 클릭 흐름 검증
- SW `ASSETS`/`NETWORK_FIRST_PATHS` ↔ 실제 파일 일치 ✓
- `index.html` script 참조 ↔ 실제 파일 일치 ✓

**main 머지**
| PR | 기능 |
|----|------|
| #67 | 근성장/근손실 추적 + 칼로리 소모 추정, 모달 클릭 버블링 버그·회복도 음수 표시 버그 수정 |

**다음 세션 후보 작업**
- [ ] 실기기에서 세트 체크·저장 시 복원된 컨페티/토스트/펄스 연출 체감 확인
- [ ] 근성장/근손실 추정 공식에 대한 실사용자 피드백 반영 (임계값·상한값 튜닝)
- [ ] 칼로리 추정치와 실제 웨어러블 기기 데이터 비교 검증
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정
- [ ] 앱 버전 1.1.0 정식 릴리스 검토

**현재 sw.js 캐시 버전**: `recovr-cache-v64`

**현재 앱 버전**: `1.0.0`

---

### 세션 31 — 2026-08-29

**개별 운동 기록에 칼로리·근성장 배지 추가**
- 홈 카드는 "최근 4주 종합 지수"만 보여주고, 목록/캘린더의 개별 운동 기록에는 아무 정보가 없던 부분을 보완
- `muscleGrowthTracker.js`에 `getWorkoutContribution(workout, workouts, weightKg)` 추가
  - 그 운동을 **저장한 날짜 시점까지의 기록만으로** 계산 (미래 데이터 누수 방지)
  - 소모 칼로리(`estimateWorkoutCalories` 재사용) + 그 운동이 자극한 부위들의 근성장 지수 평균
  - 자극 부위가 없는 순수 유산소 기록은 `growthPct: null` (칼로리만 표시)
- `renderWorkoutDetailBadge(workout)` 추가 — `🔥 소모 칼로리 542kcal · 📈 근성장 지수 +0.2%` 형태의 배지 HTML 생성
- `app.js`의 `buildExerciseDetailHTML()`(기록 목록 상세·캘린더 day detail 공용 함수) 끝에 위 배지를 추가로 붙이도록 1줄 훅 삽입 — 공용 함수라 목록/주간/월간 캘린더 모두에 자동 반영됨
- `index.html`에 `.mgt-workout-badge` 스타일 추가
- SW 캐시 `recovr-cache-v65`, `test-muscle-growth-tracker.js`에 개별 운동 기여도 테스트 6개 추가

**무결성 검사**
- JS 문법 검사: `app.js` / `muscleGrowthTracker.js` 통과 ✓
- 단위 테스트 25개 스위트: ALL PASSED ✓
- Playwright 실브라우저 e2e로 기록 목록 상세와 캘린더(월간) day detail 양쪽에서 배지가 동일하게 렌더링되는 것 확인, 콘솔 에러 없음

**다음 세션 후보 작업**
- [ ] 근성장/근손실 추정 공식에 대한 실사용자 피드백 반영 (임계값·상한값 튜닝)
- [ ] 칼로리 추정치와 실제 웨어러블 기기 데이터 비교 검증
- [ ] 전체 UI/UX 실기기 테스트 후 버그 수정
- [ ] 앱 버전 1.1.0 정식 릴리스 검토

**현재 sw.js 캐시 버전**: `recovr-cache-v65`

**현재 앱 버전**: `1.0.0`

---

### 세션 32 — 2026-08-31

**미션 클리어 컨페티를 "낙하"에서 "폭죽 터짐"으로 변경**
- 사용자 피드백: 미션 클리어 등 완료 연출 시 컨페티가 화면 위에서 아래로 후두둑 떨어지는 느낌이라, 불꽃놀이처럼 펑 터지는 느낌을 원함
- `celebrateFx.js`의 `confettiBurst()` 궤적을 원점 → `110vh`(화면 거의 전체)까지 수직 낙하하던 방식에서, 원점을 중심으로 **사방(360도) 랜덤 각도로 반경만큼 뿜어져 나갔다가** 짧게 중력으로 가라앉으며 페이드아웃되는 방식으로 교체
  - CSS 키프레임 `cfx-confetti-fall` → `cfx-confetti-burst`로 교체 (0% 원점 → 18% 버스트 정점(`--cfx-bx`/`--cfx-by`, 확대+회전) → 100% 최종 낙하 지점(`--cfx-fx`/`--cfx-fy`, 축소+페이드)의 3단 키프레임, 구간별 `animation-timing-function`으로 "빠르게 튀어나갔다가 서서히 가라앉는" 곡선 구현)
  - JS에서 조각별로 랜덤 각도(`angle`)·버스트 반경(`burstRadius` 55~155px)로 원형에 가까운 퍼짐을 만들고, 이후 소폭 드리프트(`settleDrift`)+중력 낙하(`gravityFall` 70~200px)만 추가해 낙하 거리를 화면 전체가 아닌 짧은 구간으로 제한
  - `CONFETTI_MS`를 1600ms → 1150ms로 줄여 더 스냅감 있는 "펑" 타이밍으로 조정
- 미션 클리어 풀스크린 오버레이, 운동 기록 저장, 세트/미션 체크 등 `confettiBurst()`를 호출하는 기존 트리거는 전부 그대로 유지 (호출부 수정 없음, 이펙트 내부 궤적만 교체)
- SW 캐시 `recovr-cache-v66`, 캐시 버전을 하드코딩한 테스트 파일 7개(`test-pull-refresh-guard.js`, `test-log-list.js`, `test-home-status-summary.js`, `test-celebrate-fx.js`, `test-backup-reconnect.js`, `test-backup-on-complete.js`, `test-app-resume.js`) 동기화

**무결성 검사**
- JS 문법 검사: `celebrateFx.js` / `sw.js` 통과 ✓
- 단위 테스트 26개 스위트: ALL PASSED ✓ (`test-celebrate-fx.js` 포함, `confettiBurst`/`showMissionClear`/`workoutSaved` 등 API 그대로 유지되는 것 확인)
- Playwright + 시스템 Chrome으로 `index.html`을 직접 열어 `CelebrateFx.confettiBurst()`를 실행하고 40ms~1100ms 구간 스크린샷 연속 캡처로 실제 궤적 확인: 원점 주변으로 원형에 가깝게 사방으로 퍼졌다가 짧게 가라앉으며 사라지는 것을 시각적으로 검증 (기존처럼 화면 하단까지 길게 떨어지지 않음)

**현재 sw.js 캐시 버전**: `recovr-cache-v66`

**현재 앱 버전**: `1.0.0`

---

### 세션 33 — 2026-08-31

**세트 체크 콤보 재미 연출 신규 독립 모듈 `comboFx.js` 추가**
- 사용자 피드백: "운동은 힘들어도 앱이라도 재미나야지, 신나게 재밌게" — 기존 확인 연출(컨페티/토스트/펄스) 외에 게임적인 재미 요소를 추가해달라는 요청
- 세트 체크(`.set-check`, `.duration-check`)를 3초 안에 연속으로 체크하면 콤보가 쌓이고, 2콤보부터 체크박스 위에 "N 콤보!" 텍스트가 통통 튀며 뜨는 연출 추가
  - 콤보 단계별로 점점 화려해짐: 2~3콤보(노란색) → 4~6콤보(주황+🔥) → 7~9콤보(네온그린+💪, 화면 전체에 옅은 색 플래시 추가) → 10콤보 이상(그라디언트+🐲 "괴물모드", 더 강한 진동 패턴)
  - 3초 안에 다음 체크가 없으면 콤보가 끊기고 다시 1부터 시작 (`COMBO_WINDOW_MS`)
  - `prefers-reduced-motion` 감지 시 연출 자체를 건너뜀 (기존 모듈들과 동일한 접근성 원칙)
- `celebrateFx.js`/`microAnim.js`와 동일한 패턴으로 완전 독립 모듈로 구현: 자체 `STYLE_ID`/`LAYER_ID`(`combo-fx-styles`/`comboFxLayer`)와 `cbf-` 프리픽스 클래스만 사용해 기존 모듈과 CSS/DOM 충돌 없음. 기존 모듈의 로직·이벤트 리스너는 전혀 수정하지 않음
- 모달 내부 클릭 감지를 위해 `document.addEventListener('click', onClick, true)` 캡처 단계 사용 (세션 31 발견사항과 동일한 규칙 적용), 체크 토글(app.js의 인라인 `onclick`) 이후 `requestAnimationFrame`으로 최종 `checked` 상태를 확인
- `index.html`에 `<script src="comboFx.js"></script>` 1줄 추가(celebrateFx.js 다음), 기존 스크립트 순서·로직은 그대로 유지
- SW 캐시 `recovr-cache-v66`, `ASSETS`/`NETWORK_FIRST_PATHS`에 `comboFx.js` 추가, 캐시 버전을 하드코딩한 테스트 파일 7개 동기화, `test-combo-fx.js` 신규 추가(콤보 카운트 증가/시간창 만료/리셋/팝업 트리거 임계값/정적 연동 검증)

**무결성 검사**
- JS 문법 검사: `comboFx.js` / `sw.js` 통과 ✓
- 단위 테스트 27개 스위트: ALL PASSED ✓ (`test-combo-fx.js` 신규 포함)
- Playwright + 시스템 Chrome으로 `index.html`을 직접 열어 `ComboFx.registerCheck()`를 반복 호출해 2/4/7/10콤보 단계별 실제 렌더링을 스크린샷으로 확인. 10콤보 단계에서 텍스트가 화면 밖으로 살짝 넘칠 수 있는 것을 발견해 팝업 x좌표에 안전 영역 클램프(가장자리에서 84px 이상 확보)를 추가하고 재검증

**이어서 — 콤보 최고 기록 저장/표시 + 랜덤 응원 대사 추가 (같은 세션, 같은 PR)**
- 사용자 요청: "콤보최고 기록 표시 / 랜덤 응원 대사를 넣자"
- **콤보 최고 기록**: `comboFx.js`에 `localStorage`(`recovr_combo_best_v1`) 기반 최고 콤보 기록 저장 기능 추가
  - 콤보가 역대 최고를 넘어서면(`RECORD_MIN_COMBO=2`부터 인정) 저장 + "🏆 최고 기록 경신! N콤보" 전용 배지 연출 + `CelebrateFx.confettiBurst()`를 선택적으로 호출해 축하 컨페티 추가(모듈이 없어도 안전하게 동작하도록 `typeof CelebrateFx !== 'undefined'` 가드 — muscleGrowthTracker.js가 `CelebrateFx.showToast()`를 재사용하는 것과 동일한 기존 관례)
  - 홈 화면에 `#comboBestCard` 플레이스홀더를 추가(`index.html`, `muscleGrowthCard`와 동일한 패턴)하고, `ComboFx.renderHomeCard()`가 "🏆 최고 콤보 N콤보" 카드를 렌더링. 기록이 없으면 카드를 비워 숨김
  - `app.js`의 기존 `renderHome()` 훅 클러스터(`DailyMission.renderHomeCard()` 다음)에 `ComboFx.renderHomeCard()` 호출을 1줄 추가 — 이 프로젝트의 모든 홈 카드 모듈이 등록되는 기존 확장 지점을 그대로 재사용(기존 로직 변경 없음)
  - 카드 CSS는 `mgt-card`와 동일하게 `index.html`의 메인 스타일시트에 정적으로 추가(일회성 이펙트가 아닌 상시 카드이므로 `celebrateFx.js`류의 동적 `ensureStyles()` 패턴과는 다르게, 기존 `muscleGrowthCard`와 동일한 관례를 따름)
- **랜덤 응원 대사**: 신규 독립 모듈 `hypeFx.js` 추가
  - 세트 체크 시 말풍선으로 짧은 응원 한마디(예: "좋아 좋아!", "괴물 모드 ON 🐲")가 체크박스 위에 뜸 (쿨다운 4초, 매번 뜨면 시끄러우므로 빈도 제한)
  - 운동 저장 시 화면 상단에 조금 더 긴 축하 문구(예: "오늘도 자신을 이겼다 💪", "한 걸음 더 괴물이 됐다 🐲")가 배너로 뜸. `celebrateFx.js`의 "운동 기록 완료 💪" 하단 토스트(~1.45초)와 겹치지 않도록 1.6초 지연 + 화면 상단 배치로 위치/타이밍을 분리(muscleGrowthTracker.js가 동일 토스트와 겹치지 않도록 `TOAST_DELAY_MS=1700`을 쓰는 기존 관례와 동일한 접근)
  - 같은 문구가 연달아 두 번 뜨지 않도록 직전 인덱스를 피해서 랜덤 선택
  - `comboFx.js`/`celebrateFx.js`와 동일한 독립 모듈 패턴(자체 style/layer, 캡처 단계 클릭 위임, `prefers-reduced-motion` 대응)
- SW 캐시 `recovr-cache-v67`, `ASSETS`/`NETWORK_FIRST_PATHS`에 `hypeFx.js` 추가, 캐시 버전을 하드코딩한 테스트 파일 8개 동기화
- `test-combo-fx.js`에 최고 기록 저장/갱신/갱신 실패(더 낮은 콤보)/새로고침 후 복원(별도 모듈 인스턴스로 `localStorage` 영속성 검증) 테스트 추가, `test-hype-fx.js` 신규 추가(문구 풀 크기/쿨다운/쿨다운 해제 후 재발동/정적 연동 검증)

**무결성 검사 (2차)**
- JS 문법 검사: `comboFx.js` / `hypeFx.js` / `app.js` / `sw.js` 통과 ✓
- 단위 테스트 29개 스위트: ALL PASSED ✓ (`test-combo-fx.js` 확장, `test-hype-fx.js` 신규 포함)
- Playwright + 시스템 Chrome으로 `index.html`을 직접 열어: (1) 콤보 5 달성 시 "🏆 최고 기록 경신" 배지 + 컨페티 렌더 확인, (2) `#comboBestCard`가 홈 화면에 정상 렌더(스크롤 후 확인, 기존 카드들과 동일한 스타일) (3) 페이지 새로고침 후에도 `localStorage`에서 최고 기록(5콤보)이 복원되는 것 확인 (4) 세트 체크 시 응원 말풍선, 저장 시 상단 배너가 각각 올바른 위치에 렌더되고 기존 컨페티/토스트와 겹치지 않는 것 확인 (5) 콘솔 에러 0건 확인

**다음 세션 후보 작업**
- [ ] 실기기(모바일)에서 콤보 연출 체감 및 진동 패턴 강도 피드백 반영
- [ ] 실기기(모바일)에서 새 컨페티 버스트 연출 체감 확인
- [ ] 랜덤 응원 대사 문구 풀에 대한 실사용자 반응 확인 후 문구 추가/교체
- [ ] 효과음(사운드) 추가 여부 검토 — Web Audio API로 짧은 소리를 코드로만 생성(오디오 파일 없이)
- [ ] 근성장/근손실 추정 공식에 대한 실사용자 피드백 반영 (임계값·상한값 튜닝)
- [ ] 칼로리 추정치와 실제 웨어러블 기기 데이터 비교 검증
- [ ] 앱 버전 1.1.0 정식 릴리스 검토

**현재 sw.js 캐시 버전**: `recovr-cache-v67`

**현재 앱 버전**: `1.0.0`

---

### 세션 34 — 2026-08-31

**근성장/근손실 히트맵·목록 시트에 "부위 탭 → 추천 운동" 연동 (PR #71 후속)**
- 사용자 요청: "근손실 히트맵의 부위를 누르면 회복 히트맵처럼 추천 운동이 나오게 해줘 / 근성장·근손실지수를 누르면 부위가 나오는데 그 부위를 누르면 추천 운동도 뜨게 해줘"
- 기존 동작 파악: `muscleHeatmap.js`(회복 히트맵)는 자체적으로 부위 탭 시 추천 운동을 열지 않고, `exerciseStimHeatmap.js`가 `#muscleHeatmapCard`에 별도 클릭 리스너(`onHomeCardClick`)를 위임해 `ExerciseStimHeatmap.openMuscle(muscle)`(부위→운동 목록 바텀시트, `#eshMuscleOverlay`)을 여는 구조. `muscleGrowthDetail.js`(근성장/근손실 히트맵·목록)에는 이 연동이 없어서 부위를 눌러도 상태 툴팁만 뜨고 추천 운동은 뜨지 않았음
- 해결: `ExerciseStimHeatmap`/`MuscleHeatmap`은 완성된 모듈이라 전혀 수정하지 않고, `muscleGrowthDetail.js`에서 `ExerciseStimHeatmap.openMuscle()` 공개 API만 읽기 전용으로 재사용
  - `openMuscleExercises(muscleKey)` 함수 신규 추가(모듈 공개 API로 노출): 근성장/근손실 부위별 목록 시트(`#mgdOverlay`, z-index 1220)는 추천 운동 시트(`#eshMuscleOverlay`, z-index 1200)보다 z-index가 높아 열려 있으면 추천 운동 시트를 가리므로, 먼저 `closeList()`로 목록 시트를 닫은 뒤 `ExerciseStimHeatmap.openMuscle()`을 호출
  - **히트맵 카드**(`#muscleGrowthHeatmapCard`): 부위(`.mh-region`) 탭 시 기존 상태 툴팁(`onRegionTap`)은 그대로 유지하면서, 추가로 `openMuscleExercises()`를 호출 — 회복 히트맵에서 부위 탭 시 툴팁과 추천 운동 시트가 함께 뜨는 것과 동일한 사용자 경험
  - **부위별 목록 시트**(근성장/근손실 지수 탭 시 뜨는 `#mgdOverlay`): 각 부위 항목(`mgd-list-item`)에 `role="button"`/`onclick`을 추가해 탭 가능하게 만들고, 탭하면 `openMuscleExercises(muscle)`을 호출해 목록 시트가 닫히고 바로 추천 운동 시트가 열림. 항목에 `mgd-list-arrow`(›) 아이콘을 추가해 탭 가능함을 시각적으로 안내
  - 안내 문구 갱신: 히트맵 카드 하단(`부위를 탭하면 상태 확인 + 추천 운동`), 목록 시트 하단(`부위를 탭하면 추천 운동을 볼 수 있어요`)
  - `index.html`에 `.mgd-list-item--tap`(탭 피드백, 기존 `.mgt-item--tap`과 동일한 관례) / `.mgd-list-arrow` CSS 추가
- SW 캐시 `recovr-cache-v69`, 캐시 버전을 하드코딩한 테스트 파일 9개(`test-pull-refresh-guard.js`, `test-log-list.js`, `test-hype-fx.js`, `test-combo-fx.js`, `test-home-status-summary.js`, `test-celebrate-fx.js`, `test-backup-reconnect.js`, `test-app-resume.js`, `test-backup-on-complete.js`) 동기화
- `test-muscle-growth-detail.js`에 신규 섹션 추가: (1) 히트맵 부위 탭 시 기존 툴팁 유지 + `ExerciseStimHeatmap.openMuscle` 호출 검증(SVG 클릭 이벤트를 모킹해 실제 버블링 흐름 재현) (2) 목록 항목 HTML에 `openMuscleExercises` 연결·화살표 표시 검증 (3) `openMuscleExercises` 호출 시 목록 시트가 자동으로 닫히는 것(z-index 충돌 방지) 검증 (4) 모듈 연결 지점 검사에 `ExerciseStimHeatmap.openMuscle` 참조 여부 추가

**무결성 검사**
- JS 문법 검사: `muscleGrowthDetail.js` / `sw.js` 통과 ✓
- 단위 테스트 28개 스위트: ALL PASSED ✓ (`test-muscle-growth-detail.js` 확장)

**다음 세션 후보 작업**
- [ ] 실기기(모바일)에서 히트맵 탭 → 추천 운동 시트 전환 체감(두 시트가 연속으로 열리는 느낌) 확인
- [ ] 앱 버전 1.1.0 정식 릴리스 검토

**현재 sw.js 캐시 버전**: `recovr-cache-v69`

**현재 앱 버전**: `1.0.0`

---

### 세션 35 — 2026-08-31 (같은 PR 후속)

**추천 운동 목록에 "유튜브에서 영상으로 보기" 연결 (신규 독립 모듈 `youtubeSearchLink.js`)**
- 사용자 요청: "추천운동은 잘 알려주는데 이름만 알지 어떻게 하는지를 모르겠어. 추천운동을 누르면 유튜브에서 검색어를 넣어 나온 링크로 연결해줄래?"
- `ExerciseStimHeatmap`(부위→추천 운동 시트)의 완성된 로직·마크업은 전혀 수정하지 않고, 신규 독립 모듈 `youtubeSearchLink.js`가 이미 렌더된 DOM에 `MutationObserver`로 "▶ 영상" 버튼만 추가로 붙이는 방식으로 연결(기존에 `exerciseStimHeatmap.js`가 `exercisePicker.js`를 확장할 때 쓴 것과 동일한 관례: `#exPickerList`를 `MutationObserver`로 감지해 `ex-picker-stim-btn`을 덧붙이는 패턴을 그대로 재사용)
  - `YoutubeSearchLink.buildSearchUrl(name)`: `https://www.youtube.com/results?search_query=<운동명> 운동 방법` 형태의 검색 URL 생성. `open(name)`은 `window.open(url, '_blank', 'noopener')`로 새 탭에서 오픈(모바일에서 유튜브 앱이 설치돼 있으면 OS의 유니버설/앱 링크 처리로 앱이 바로 열리는 경우가 많음 — 웹에서 앱을 강제로 여는 표준 방법은 없어 이 방식이 최선)
  - 부위별 추천 운동 목록(`#eshMuscleOverlay .esh-ex-item`) 각 항목에 "▶ 영상" 버튼 추가 — 항목 자체(자극 히트맵 미리보기 오픈)의 기존 클릭 동작은 그대로 두고, 버튼 클릭 시 `stopPropagation`으로 항목의 클릭이 발생하지 않게 함(exercisePicker.js의 `.ex-picker-item` 버튼 안에 `ex-picker-stim-btn`을 넣는 것과 동일한 "버튼 안 버튼" 관례)
  - 운동을 선택해 펼쳐지는 분할 미리보기 헤더(`.esh-split-preview-head`)에도 동일한 버튼 추가 (접기 버튼 옆에 배치, 기존 2단 레이아웃 유지)
  - 종목 피커의 "자극" 버튼으로 연 단일 운동 상세 시트(`#eshExerciseOverlay`)에는 "이 운동 추가"/"확인" 액션 버튼 위에 전체 폭 "▶ 유튜브에서 영상으로 보기" 버튼 추가
  - `index.html`에 `<script src="youtubeSearchLink.js"></script>` 1줄 추가(muscleGrowthDetail.js 다음), 부트스트랩 스크립트에 `YoutubeSearchLink.init()` 1줄 추가, `.ytl-btn`/`.ytl-actions-inline`/`.ytl-video-btn` CSS 추가
- SW 캐시 `recovr-cache-v70`, `ASSETS`/`NETWORK_FIRST_PATHS`에 `youtubeSearchLink.js` 추가, 캐시 버전을 하드코딩한 테스트 파일 9개 동기화
- `test-youtube-search-link.js` 신규 추가: 검색 URL 생성, 목록/분할 미리보기/단일 상세 시트 각각에 버튼이 붙는지, 버튼 클릭이 상위 항목 클릭으로 전파되지 않는지(stopPropagation), 재렌더 시 버튼이 중복 추가되지 않는지(idempotent), 모듈 연결 지점(스크립트 태그·sw.js 등록·`ExerciseStimHeatmap` 시그니처 불변)을 검증. 실제 브라우저 DOM이 없어 `createElement`/`appendChild`/`insertBefore`/`querySelector`/이벤트 버블링을 흉내내는 최소 fake DOM을 테스트 파일 내부에 직접 구현(이 프로젝트는 별도 테스트 프레임워크·jsdom 의존성이 없는 순수 Node 스크립트 컨벤션을 따름)

**무결성 검사**
- JS 문법 검사: `youtubeSearchLink.js` / `sw.js` 통과 ✓
- 단위 테스트 29개 스위트: ALL PASSED ✓ (`test-youtube-search-link.js` 신규 포함)

**다음 세션 후보 작업**
- [ ] 실기기(모바일 Chrome/Safari, PWA 설치 상태)에서 "▶ 영상" 버튼 탭 시 실제로 유튜브 앱으로 연결되는지 확인 (기기·브라우저별 유니버설 링크 처리 차이가 있을 수 있음)
- [ ] 운동 종목 피커(`exercisePicker.js`)의 메인 목록에도 동일한 유튜브 링크 버튼을 붙일지 검토(사용자 요청 범위 밖이라 이번엔 보류, 제안만 기록)
- [ ] 앱 버전 1.1.0 정식 릴리스 검토

**현재 sw.js 캐시 버전**: `recovr-cache-v70`

**현재 앱 버전**: `1.0.0`

---

### 세션 36 — 2026-09-01

**추천 운동 목록에 "근손실 부위 강화" + 부위별/기능성 강화 유형 대거 추가, 카테고리(optgroup) 재구성**
- 사용자 요청: "추천운동 만들어주는 리스트 중에 근손실되는 부위강화 하는 추천 리스트도 추가해줘. 또 다른 추천리스트도 부위별이나 기능성 등으로 추가해줘. 리스트가 많다면 카테고리를 나눠도 좋겠네. 재활 보충 강화, 모빌리티 다이어트 등등"
- 기존 동작 파악: `recommendation.js`(12종 유형, 3그룹 optgroup)와 `muscleGrowthDetail.js`가 이미 노출한 `MuscleGrowthTracker`(근성장/근손실 지수)·`ExerciseMuscleMap`(부위→운동 매핑)을 읽기 전용으로 재사용할 수 있음을 확인. 기존 완성 함수(`scoreStrengthRecommendations`/`scoreExtendedRecommendations`/`buildSuggestedExercises`의 기존 분기 등)는 전혀 수정하지 않고, 전부 새 함수/새 분기로 **추가**만 하는 방식으로 개발
- **근손실 부위 강화** (`muscle_loss_focus`, 카테고리 `reinforce`): `MuscleGrowthTracker.compute()`의 부위별 근손실 지수 중 손실이 가장 큰 부위를 찾아 `ExerciseMuscleMap.getExercisesForMuscle()`로 해당 부위 운동을 추천. 근손실 데이터가 없으면(장기 미훈련 부위가 없거나 모듈 미로드) 방치되기 쉬운 부위 위주의 정적 폴백 루틴(`EXERCISE_PRESETS.muscle_loss_focus`) 사용
- **부위별 강화** 7종 신규 추가(`chest_focus`/`back_focus`/`shoulder_focus`/`arm_focus`/`abs_focus`/`glute_ham_focus`/`calf_focus`, 카테고리 `focus`): `MUSCLE_FOCUS_CONFIG`로 유형→근육 키를 매핑. 새 헬퍼 `daysSinceLastMuscleTraining()`/`countMuscleSessions()`로 부위별 마지막 훈련 경과일을 계산해, 다른 부위 평균 대비 상대적으로 오래 방치된 부위(경과일이 평균의 1.25배 이상 & 4일 이상)에 가중치를 부여하는 `scoreFocusRecommendations()` 신설. 추천 종목은 (1) 해당 부위 기록이 충분하면 기록 기반 → (2) 부족하면 `ExerciseMuscleMap` → (3) 그래도 없으면 정적 프리셋 순으로 선정(`buildMuscleFocusExercises()`)
- **기능성 강화** 3종 신규 추가(`balance_stability`/`power_explosive`/`endurance_boost`, 카테고리 `functional`): 정적 프리셋 기반. 목표(근력)·최근 주간 세션 수·나이·경력 등 가벼운 프로필 가중치만 적용
- **안전 우선 원칙 유지**: 목·허리디스크 등 재활이 필요한 상태로 감지되면(`detectEffectiveCondition`) 신규 강화형 유형(부위별 강화·근손실 부위 강화·기능성 강화) 점수를 전부 억제해, 기존 재활 유형이 항상 최우선으로 추천되도록 함(기존 세션3 테스트의 목디스크 자동 추천 시나리오가 그대로 통과하는 것으로 확인)
- **카테고리 재구성**: 기존 3그룹(근력·상하체 / 체형·유산소 / 재활·회복) → 7그룹(강화·근력(상·하체) / 강화·부위별 / 보충·약점 보완 / 기능성 / 다이어트·체형 / 모빌리티 / 재활·회복)으로 재편. `모빌리티`를 재활 그룹에서 분리해 단독 그룹으로 이동
- `buildReason()`/`getTipForType()`에 신규 카테고리(`reinforce`/`focus`/`functional`)별 안내 문구 분기 추가(기존 `rehab`/`cardio`/`mobility` 분기는 그대로 유지)
- `buildStats()`가 반환하는 `stats`에 `muscleFocusStats`(부위별 방치 정보)·`muscleLossInfo`(근손실 최상위 부위) 필드 추가(기존 필드는 그대로 유지, 추가만 함). `buildSuggestedExercises(workouts, id, stats)`로 시그니처에 `stats` 파라미터 추가(내부 전용 함수라 외부 API 영향 없음)
- SW 캐시 `recovr-cache-v71`, 캐시 버전을 하드코딩한 테스트 파일 9개(`test-pull-refresh-guard.js`, `test-log-list.js`, `test-hype-fx.js`, `test-combo-fx.js`, `test-home-status-summary.js`, `test-celebrate-fx.js`, `test-backup-reconnect.js`, `test-app-resume.js`, `test-backup-on-complete.js`) 동기화
- `test-recommendation-focus-types.js` 신규 추가: (1) 신규 유형 메타·카테고리 그룹 존재 검증 (2) 근손실 부위(가슴) 감지 → `muscle_loss_focus` 점수 상승 → `ExerciseMuscleMap` 기반 맞춤 운동 추천 검증 (3) 근손실 미감지 시 정적 폴백 루틴 검증 (4) 상대적으로 방치된 부위(종아리) 강화 점수가 다른 부위보다 높게 나오는지 검증 (5) 부위별 강화의 기록 기반 종목 선정 검증 (6) 목디스크 등 재활 상태에서 강화형 추천이 억제되고 재활 유형이 최우선 유지되는지 검증 (7) 정적 검사

**무결성 검사**
- JS 문법 검사: `recommendation.js` / `sw.js` 통과 ✓
- 단위 테스트 30개 스위트: ALL PASSED ✓ (기존 `test-recommendation-types.js` 그대로 통과 확인 + `test-recommendation-focus-types.js` 신규 포함)

**다음 세션 후보 작업**
- [ ] 신규 유형(부위별 강화·근손실 부위 강화·기능성 강화) 홈 카드 UI를 실제 브라우저에서 열어 optgroup 7개·드롭다운 스크롤 UX 확인 (Playwright 브라우저 미사용 환경이라 이번엔 Node 단위 테스트로만 검증)
- [ ] 부위별 강화 점수식(평균 대비 1.25배 임계값)에 대한 실사용자 데이터 기반 튜닝
- [ ] 앱 버전 1.1.0 정식 릴리스 검토

**현재 sw.js 캐시 버전**: `recovr-cache-v71`

**현재 앱 버전**: `1.0.0`

---

### 세션 37 — 2026-09-18

**정적 리스트 3곳에 탭 인터랙션 추가 (신규 독립 모듈 `listQuickActions.js`)**
- 사용자 요청: "홈 탭의 부위별 회복 상태 리스트(코어·어깨·삼두 등)와 통계 탭의 개인 기록(PR) 리스트(스쿼트·레그프레스 등)를 눌러도 아무 반응이 없다. 눌렀을 때 회복 상태나 관련 운동을 보여주면 좋겠다. 다른 인터랙션 없는 곳은 없나?"
- 기존 동작 파악: `app.js`의 `renderHome()`(`#muscleList`)/`renderWeeklyFrequency()`(`#freqList`)/`renderPRList()`(`#prList`)가 렌더하는 `.muscle-card`들은 순수 정보 표시용 `<div>`일 뿐 `onclick`/`role`이 전혀 없어 탭해도 반응이 없었음. 반면 `exerciseStimHeatmap.js`는 이미 "부위 → 관련 운동 목록"(`openMuscle`)과 "운동 → 자극 부위 히트맵"(`openExercise`) 바텀시트를 완성해서 히트맵·근성장 목록 등 다른 곳에서 재사용 중이었음
- 위 세 리스트가 정확히 어떤 정보인지 확인: `#muscleList`="부위별 회복 상태"(코어/어깨/삼두 등 회복 % 카드, 홈), `#freqList`="주간 부위별 빈도"(통계), `#prList`="🏆 개인 기록(PR)"(스쿼트/레그프레스 등 최고 무게·e1RM, 통계)
- 완성된 렌더 로직(`app.js`)과 완성된 시트 로직(`exerciseStimHeatmap.js`)은 전혀 수정하지 않고, 신규 독립 모듈 `listQuickActions.js`로 두 모듈을 매니저 참조로만 연결:
  - `#muscleList` 카드 탭 → 카드의 `.mc-name` 텍스트(예: "코어")를 `MUSCLE_LABELS`와 대조해 부위 키를 역추적한 뒤 `ExerciseStimHeatmap.openMuscle(muscleKey)` 호출 → 그 부위를 자극하는 추천 운동 목록이 뜸(회복 %/추세는 이미 카드 자체에 표시돼 있으므로, 탭 시에는 "관련 운동"을 추가로 보여주는 것이 자연스러움)
  - `#freqList` 행 탭 → 동일한 방식으로 부위 키를 역추적해 `openMuscle()` 호출
  - `#prList` 카드 탭 → `.mc-name`(운동명)을 그대로 `ExerciseStimHeatmap.openExercise(name, { showAdd: false })`에 전달 → 그 운동이 자극하는 부위 히트맵 미리보기가 뜸("이 운동 추가" 버튼은 통계 화면 맥락에 맞지 않아 숨김)
  - `app.js`에 `data-*` 속성을 새로 추가하지 않고, 이미 화면에 보이는 텍스트만 읽기 전용으로 활용(부위명은 `MUSCLE_LABELS` 11개가 서로 겹치지 않는 고유 문자열이라 오매칭 없음) → app.js를 단 1바이트도 건드리지 않고 완전히 독립적으로 구현
  - 리스트는 `innerHTML` 통째 교체 방식이라, 컨테이너(`#muscleList`/`#freqList`/`#prList`)에 클릭/키보드(Enter·Space) 이벤트를 1회만 위임 등록하고, `MutationObserver`로 재렌더될 때마다 새 카드에 `role="button"`/`tabindex="0"`을 다시 부여(기존 `exerciseStimHeatmap.js`의 `exPickerList` 감시 패턴과 동일한 관례)
  - `ensureStyles()`로 커서 포인터 + 우측 "›" 화살표(탭 가능 표시) + 포커스 아웃라인을 동적 주입(`heatmapModeTabs.js`와 동일한 관례). `index.html`의 기존 스타일시트는 건드리지 않음
- `index.html`에 `<script src="listQuickActions.js"></script>` 1줄 추가(heatmapModeTabs.js 다음, ExerciseStimHeatmap 로드 이후) + 부트스트랩에 `ListQuickActions.init()` 1줄 추가
- SW 캐시 `recovr-cache-v75`, `ASSETS`/`NETWORK_FIRST_PATHS`에 `listQuickActions.js` 추가, 캐시 버전을 하드코딩한 테스트 파일 12개 동기화
- `test-list-quick-actions.js` 신규 추가: 부위 라벨→키 역추적, 스타일 주입, 3개 리스트 각각 클릭/키보드(Enter) 인터랙션, 재렌더 후 재적용, 완성 모듈(app.js/exerciseStimHeatmap.js/muscleHeatmap.js) 미참조·미수정 검증, 스크립트 등록·sw.js 캐시 버전 등 정적 연동 검사

**실브라우저 검증 (Playwright + 시스템 Chrome, headless)**
- 스쿼트·레그프레스·벤치 프레스로 운동 기록을 심어 실제로 페이지를 열고 클릭까지 수행: 홈 "대퇴사두" 카드 탭 → `🦵 대퇴사두` 추천 운동 시트(21개 종목) 정상 오픈, 통계 "레그프레스"/"스쿼트" PR 카드 탭 → 해당 운동의 자극 부위 시트 정상 오픈("이 운동 추가" 버튼 숨김 확인), 통계 "대퇴사두" 빈도 행 탭 → 동일 부위 추천 운동 시트 오픈. 콘솔 에러/경고 0건
- 스크린샷으로 카드 우측 "›" 화살표가 기존 회복%/뱃지 레이아웃을 가리지 않고 자연스럽게 표시되는 것 확인

**다른 인터랙션 없는 곳(발견했지만 이번 세션 범위 밖 — 제안만 기록)**
- [ ] "🏆 개인 기록 (PR)" 카드를 탭했을 때, 단순 자극 부위 미리보기보다 **그 운동의 기록 추이(무게/e1RM 그래프)** 를 보여주는 편이 "PR" 리스트의 맥락에 더 잘 맞을 수 있음 — 별도 데이터 시각화(추이 차트) 모듈이 필요해 이번 세션 범위 밖으로 보류
- [ ] 통계 "최근 추세"(`#trendChart`) 막대 그래프도 막대를 탭하면 그날의 운동 상세로 이동하면 좋을 것 같음(현재는 순수 시각화)
- [ ] 통계 "유산소 세부 지표"/"유산소 기구별"(`cardioMetricsStats`/`cardioMachineList`) 카드들도 탭 인터랙션이 없어 보임(모듈 소유가 `cardioMetrics.js`/`cardioTracker.js`라 이번 세션에서는 손대지 않음)

**무결성 검사**
- JS 문법 검사: 전체 `*.js` 파일 통과 ✓
- 단위 테스트 31개 스위트: ALL PASSED ✓ (`test-list-quick-actions.js` 신규 포함)

**다음 세션 후보 작업**
- [ ] PR 리스트 탭 시 자극 부위 미리보기 대신/추가로 운동별 기록 추이 그래프를 보여주는 기능 검토
- [ ] 유산소 통계 카드들에도 탭 인터랙션 추가할지 검토
- [ ] 앱 버전 1.1.0 정식 릴리스 검토

**현재 sw.js 캐시 버전**: `recovr-cache-v75`

**현재 앱 버전**: `1.0.0`

---
