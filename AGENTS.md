# RECOVR — Cloud Agent 운영 규칙

이 파일은 Cursor Cloud Agent가 작업 시작 시 반드시 읽어야 하는 규칙입니다.

---

## PR 머지 — 할 수 있다 (자주 착각하는 부분)

**사용자가 "머지하라"고 하면 에이전트가 직접 머지한다.**

`ManagePullRequest` 도구에는 `merge` 액션이 없지만, **이것만으로 "머지 불가"라고 말하면 안 된다.**
이 저장소 VM에는 인증된 `gh` CLI가 있으며, 아래 명령으로 PR을 머지할 수 있다:

```bash
gh pr merge <PR번호> --merge
```

옵션 예시:

```bash
# 머지 후 원격 feature 브랜치 삭제
gh pr merge <PR번호> --merge --delete-branch

# 머지 전 상태 확인
gh pr view <PR번호> --json state,mergeable,mergedAt
```

### 머지 요청 시 필수 절차

1. PR이 열려 있고 `mergeable`인지 `gh pr view`로 확인
2. **`gh pr merge`를 실제로 실행** (사용자에게 "직접 눌러주세요"로 미루지 않음)
3. `gh pr view`로 `state: MERGED` 확인 후 결과 보고

### 하지 말 것

- `ManagePullRequest`에 merge 액션이 없다는 이유만으로 "머지할 수 없습니다"라고 답하지 말 것
- `gh`가 "read-only"라는 일반 설명을 근거로 merge 시도 자체를 생략하지 말 것 — **merge는 시도해 본 뒤** 실패할 때만 불가 보고
- 머지 가능 여부를 추측으로 말하지 말고, 명령 실행 결과로 확인할 것

### PR 생성 vs 머지

| 작업 | 사용 도구 |
|------|-----------|
| PR 생성·수정·코멘트 | `ManagePullRequest` |
| PR 머지 | `gh pr merge` (셸) |

PR 생성은 `ManagePullRequest`만 사용하고, `gh`로 PR을 만들지 않는다 (Cloud Agent 규칙).

---

## Git 브랜치

- feature 브랜치 이름: `cursor/<설명>-41b0`
- base 브랜치: `main`
- 작업 후 `git push -u origin <branch>` 필수

---

## 테스트

변경 후 가능하면 전체 테스트 실행:

```bash
for f in test-*.js; do node "$f" || exit 1; done
```

---

## 기존 모듈 보호

- 완성된 모듈의 동작을 임의로 수정하지 말 것
- 새 기능은 독립 모듈로 추가
- 모듈 간 통신은 EventBus 또는 매니저 참조만 사용

---

## 세션 로그

상세 개발 이력·아키텍처는 `SESSION_LOG.md` 참고.
`"일 시작하자"` / `"세션업데이트"` 시 해당 파일을 갱신한다.
