# Forest Voice and Music Implementation Plan

> For agentic workers: execute inline with executing-plans; one fresh review after implementation.

**Goal:** Add animal-specific realtime Korean voice conversations and independently controlled ambient music to the existing forest.
**Architecture:** Dependency-free Node server exchanges WebRTC offers with OpenAI; browser owns microphone/audio lifecycle, and a separate Web Audio music engine supplies ambient sound. Existing visual renderer consumes bounded voice amplitude.
**Tech Stack:** Node 24, native fetch/HTTP, plain JavaScript, WebRTC, Web Audio, Canvas.
**Spec:** docs/superpowers/specs/2026-10-12-forest-voice-music-design.md

## Global constraints
- Bind 127.0.0.1:8766, keep API key server-only, preserve offline scenery/music and existing attribution.
- Realtime model configurable, default gpt-realtime-2.1; deer cedar, rabbit marin.
- No publishing or commits. Real voice verification requires a usable API key and microphone.
- Music ducks to 20% of chosen volume; voice ends on hidden tab and at 10 minutes.

## Review focus
- Late microphone/SDP responses after cancellation must not revive a call (Task 2 tests).
- Hidden tab and animal switch must release every track/connection (Task 2 tests).
- Malicious paths/origins and upstream error bodies must not reveal credentials (Task 1 tests).
- Repeated music clicks must not stack contexts/timers (Task 3 tests).
- Mobile controls, panel and credit must not overlap; blocked playback needs recovery (Task 4 browser tests).

## Task 1: Server
- [x] Write tests/server.test.mjs: allowlisted static files, key absence, unsafe paths/origins, malformed/oversize SDP, controlled upstream success/failure/timeout, concurrent initialization.
- [x] Verify tests fail before server.mjs exists.
- [x] Implement createHandler({apiKey, model, fetchImpl, timeoutMs, rootDir}) returning async HTTP handler; GET /api/config -> {voiceAvailable}, POST /api/session {animal,sdp} -> {sdp}; no secrets in response.
- [x] Add .env.example/.gitignore and dependency-free start command. Run server tests.

## Task 2: Voice lifecycle
- [x] Write tests/voice.test.cjs for cancellation races, missing key, mute/end, animal switching, stale events and errors.
- [x] Implement voice-session.js ForestVoiceSession class with start(animal), stop(), setMuted(bool), onState/onTranscript/onStream callbacks and injectable platform dependencies.
- [x] Use semantic_vad and server-owned personality. Handle session.created, speech events, output buffer events, response transcripts, response failure.
- [x] Implement voice.js UI and audio analyser; microphone acquisition only after user action/config confirmation. Verify lifecycle tests.

## Task 3: Music
- [x] Write tests/music.test.cjs for idempotent start/stop, volume and 20% ducking, async start cancellation, visibility stop.
- [x] Implement music.js ForestMusic engine with start/stop/setVolume/setDucked. Slow soft chords and bells, own audio graph, scheduler cleanup.
- [x] Verify tests and inspect rendered audio signal in browser.

## Task 4: Integration and verification
- [x] Update HTML/CSS with music controls, nonmodal voice panel, state/captions/mute/end, mobile layout. Preserve signature.
- [x] Feed audio amplitude to night.js through forest-voice-level event; reduced motion remains static.
- [x] Browser checks: PC/mobile screenshots, missing-key honest state, music context/volume, keyboard, existing effects, offline fallback. Mock WebRTC separate from real connection evidence.
- [x] Fresh-context read-only review; resolve important findings, rerun affected tests.
- [x] Update README, progress, verification and loop log; report exact real API verification limits.

## Execution ledger

Ruling: User explicitly requested implementation after reviewing the linked design. Proceed inline under that authorization without another general approval round. No product dependency installation or paid API call is needed for mock verification.
Ruling: Use current workspace because all existing files are uncommitted and requested changes belong here; do not commit or create a worktree that omits these files.
Ruling: API key is absent in process environment. Finish code and mock/browser verification; mark actual voice round trip unverified until local key configuration.

## 루프 5 — 음성 대화와 배경음악 (2026-10-12, 최신)

- 사용자 구현 승인에 따라 사슴/토끼별 한국어 Realtime WebRTC 대화, 마이크 끄기/종료, 자막, 발화 반응을 구현했습니다. 기본 모델은 gpt-realtime-2.1이며 서버 설정으로 변경할 수 있습니다.
- 별도 Web Audio 배경음악과 음량 조절, 대화 중 20% 음량, 탭 숨김 시 정지를 구현했습니다. 서명 `made by Gerardo 2026.10.12`를 유지했습니다.
- 실행: `node server.mjs`, http://127.0.0.1:8766 . 이전 Python 정적 서버(8765)는 종료했습니다.
- API 키는 서버 전용 `.env` 설정입니다. 채팅에 제공된 키는 저장하거나 사용하지 않았습니다. 노출된 키 폐기 및 새 키의 로컬 설정이 필요합니다.
- Node 검사 29개 통과. Chrome의 PC 4개 해상도와 모바일에서 배치, 음악 신호/음량, 모의 음성 연결/종료/음소거/자막, 재생 차단 복구, 탭 숨김 정리, 오프라인 안내를 확인했습니다. 런타임 예외 0개.
- 근거: evidence/audio-unit-tests.txt, evidence/audio-browser-checks.json, evidence/audio-forest-*.png, evidence/audio-panel-*.png. 모의 연결 증거는 실제 AI 응답이 아닙니다.
- 독립 코드 검토와 자체 검토 완료. 입력 동물 식별자의 타입 검증 및 첫 인사의 동물/한국어 지시를 보완하고 회귀 검사를 통과했습니다.
- 미확인: 실제 API 음성 왕복, 물리 마이크/스피커 품질, 실제 장치 터치/전체 화면/장시간 성능. 유료 API 호출은 수행하지 않았습니다.
- 커밋·푸시·배포 없음. 기존 무음/음성 제외 사양은 이번 승인 범위로 대체됩니다.
