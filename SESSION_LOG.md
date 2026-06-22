# RECOVR - 개발 세션 로그

> **사용법**
> - `"일 시작하자"` → AI가 이 파일을 읽고 현재 상태 파악 후 이어서 작업
> - `"세션업데이트"` → AI가 이번 작업 내용을 이 파일에 기록

---

## 📁 프로젝트 현재 상태

### 파일 구성
```
MusclesMonster/
├── index.html        # UI 전체 (뷰, 스타일, 모달, AI 채팅 포함)
├── app.js            # 메인 로직 (~2460줄)
├── recommendation.js # 운동 추천 모듈 (독립 모듈, 드롭다운 선택)
├── userProfile.js    # 사용자 프로필 모듈 (신체정보·목표·회복 보정)
├── workoutAdvice.js  # 운동 패턴 조언 모듈 (독립 모듈)
├── aiCoach.js        # AI 코치 상담 모듈 (Gemini Flash, BYOK)
├── backupStorage.js  # IndexedDB 백업 핸들 저장
├── backupWriter.js   # File System API 백업 쓰기
├── sw.js             # Service Worker (PWA 캐싱, 현재 v19)
├── manifest.json     # PWA 메타 정보
├── icon-192.png      # PWA 앱 아이콘
├── icon-512.png      # PWA 앱 아이콘
└── SESSION_LOG.md    # 이 파일
```

### 기술 스택
- **Vanilla JS + HTML/CSS** (프레임워크 없음)
- **PWA** (Service Worker, manifest, 오프라인 캐싱)
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

### recommendation.js
- `WorkoutRecommendation.compute()` — 10일치 기록 분석 → 4가지 추천 중 1개 선택 (자동)
- `WorkoutRecommendation.setType()` — 드롭다운으로 상·하체 × 유지/성장 직접 선택
- `WorkoutRecommendation.render()` — 홈 화면 추천 카드 + select 드롭다운
- `WorkoutRecommendation.apply()` — 추천 내용으로 운동 모달 열기
- 선택값 `localStorage` 키: `recovr_rec_selected_v1`

### workoutAdvice.js
- `WorkoutAdvice.compute()` — 14일 패턴 분석 (푸시/풀, 상하체, 허리 주의 등)
- `WorkoutAdvice.render()` — 홈 화면 조언 카드

### aiCoach.js
- `AiCoach.sendMessage()` — Gemini 2.5 Flash API 호출 (BYOK)
- `AiCoach.buildContext()` — 운동 기록·회복도·규칙 추천/조언 컨텍스트 생성
- `AiCoach.renderHomeCard()` — 홈 AI 코치 카드
- API 키 설정: `settings.geminiApiKey` (localStorage)
- 대화 기록 키: `recovr_ai_chat_v1`
- thinkingBudget: 0, maxOutputTokens: 8192, MAX_TOKENS 시 자동 이어쓰기

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
  type: "upper",           // upper | lower | full
  fatigue: 3,              // 1~5
  exercises: [{
    name: "벤치 프레스",
    mode: "sets" | "duration",
    durationMin: 20,       // duration 모드
    weight: 60,            // sets 모드 (구버전)
    reps: 10,
    sets: 3,
    setDetails: [{ weight, reps, completed }]  // 신버전
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

**사용자 프로필 맞춤 기능 (PR 예정)**
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
