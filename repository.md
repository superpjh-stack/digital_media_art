# GitHub 연결 및 이슈 알림

- 대상 저장소: https://github.com/superpjh-stack/digital_media_art
- 현재 로컬 Git 저장소는 main 브랜치로 초기화했습니다.
- 원격 origin 등록: 실행 환경의 `.git/config` 쓰기 제한으로 실패. 사용자 터미널에서 등록 요청 중.
- 사용자 터미널의 `gh auth login`: 성공 메시지 확인.
- 에이전트 환경의 GitHub API 연결: 실패. 사용자 로그인 실패로 단정하지 않습니다.
- 커밋·푸시: 수행하지 않음. 스킬은 사용자가 요청할 때만 수행하도록 규정합니다.

## gerardo-hooks

읽은 스킬:
`/Users/gerardo92/.claude/skills/synced/d730e303-f9d6-4e31-8c1e-a4359424fb37_396b224b-b39c-42f5-a554-adca07eeef78/gerardo-hooks/SKILL.md`

사전 점검이 하나라도 실패하면 설치를 멈추도록 명시되어 있습니다. 현재 원격 및 인증/API 검증이 충족되지 않아 `.claude` 훅·권한 설정과 `CLAUDE.md` 규칙은 아직 설치하지 않았습니다. 설치 완료 또는 자동 알림 활성화로 표시하지 않습니다.

이 스킬은 Claude Code의 Stop 이벤트에서 미해결 이슈를 점검하도록 구성합니다. 별도의 이메일·Slack·메신저 발송 기능은 없습니다. 이슈가 GitHub에 등록되면 이 대화에 번호와 링크를 보고하며, GitHub 알림 수신은 사용자의 GitHub 알림 설정에 따릅니다.

## 이슈 관리 원칙

1. 이번 작업에서 바로 수정한 문제는 GitHub 이슈를 만들지 않습니다.
2. 미해결 버그, 실패한 테스트, 임시 우회, 보류 항목만 기록합니다.
3. 등록 전에 대상 저장소의 열린 이슈에서 중복을 확인합니다.
4. 중복이면 기존 이슈에 근거를 추가하고, 신규이면 `[auto]` 제목과 `ai-found` 라벨을 사용합니다.
5. 본문은 재현 방법, 관련 파일, 시도한 것, 추정 원인, 완료 조건을 포함합니다.
6. 토큰과 비밀번호, 개인정보는 포함하지 않습니다.
7. 현재는 `issues/`에 로컬로 기록합니다. GitHub 등록 여부는 문서에 별도로 명시합니다.

## 연결이 가능한 환경에서 이어가기

```sh
git remote -v
gh auth status
gh repo view --json nameWithOwner -q .nameWithOwner
jq --version
```

위 사전 검사가 모두 통과한 후 `gerardo-hooks`의 1~5단계를 적용하고 `a=0`, `b=2`, `c=0`, 훅 개수 `1`을 확인해야 설치 완료입니다.

## 브라우저를 통한 이슈 저장 완료

2026-10-12, 브라우저에서 저장소 접근이 가능함을 확인했습니다. 열린 이슈 0개를 확인한 뒤 `ai-found` 라벨을 만들고 아래 이슈를 등록했습니다.

- [#1: gerardo-hooks 설치 사전 점검 제한](https://github.com/superpjh-stack/digital_media_art/issues/1)
- 사용자 구독 상태: 이슈 상세 화면에서 확인.
- 증거: `evidence/github-issue-1.jpg`.

상기 API/원격 사전 검사 제한은 여전히 남아 있습니다. 자동 Stop 훅과 지속적인 자동 알림은 활성화되지 않았습니다. 브라우저 등록이 자동 훅 설치를 대신하지 않습니다.

## 2026-10-12 재개 결과 (현재 상태)

이전 제한은 승인된 실행으로 해소했습니다. 기존 keyring 로그인 정상, origin은 지정 저장소로 연결됐으며 gh repo view에서 superpjh-stack/digital_media_art 확인.
CLAUDE.md, .claude/hooks/issue-check.sh, .claude/settings.json 설치 완료. 자체 검사 a=0, b=2, c=0, Stop 훅 1개 통과. ai-found 라벨 존재 확인.
Claude Code용 설치이며 Codex에서 Stop 훅 자동 실행을 검증한 것은 아닙니다. 커밋·푸시 없음.
