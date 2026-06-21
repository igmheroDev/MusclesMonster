# RECOVR - 개발 세션 로그

> **사용법**
> - `"일 시작하자"` → AI가 이 파일을 읽고 현재 상태 파악 후 이어서 작업
> - `"세션업데이트"` → AI가 이번 작업 내용을 이 파일에 기록

---

## 📁 프로젝트 현재 상태

### 파일 구성
```
MusclesMonster/
├── index.html        # UI 전체 (뷰, 스타일, 모달 포함)
├── app.js            # 메인 로직 (~2100줄)
├── recommendation.js # 운동 추천 모듈 (독립 모듈)
├── sw.js             # Service Worker (PWA 캐싱, 현재 v8)
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
- `WorkoutRecommendation.compute()` — 10일치 기록 분석 → 4가지 추천 중 1개 선택
- `WorkoutRecommendation.render()` — 홈 화면 추천 카드 렌더링
- `WorkoutRecommendation.apply()` — 추천 내용으로 운동 모달 열기

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
