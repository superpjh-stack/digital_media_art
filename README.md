# 손끝에 깨어나는 숲 · 밤숲

달빛 아래 사슴과 토끼, 붉게 빛나는 꽃과 시냇물이 반응하는 인터랙티브 미디어 아트입니다. 동물과의 한국어 실시간 음성 대화와 잔잔한 배경음악을 지원합니다. 사실적인 이미지에 실시간 2D 변형과 빛 효과를 결합했습니다. 동영상이나 3D 골격 애니메이션은 아닙니다.

## 작품 열기

Node.js 24에서 프로젝트 폴더를 열고 실행합니다.

```sh
node server.mjs
```

브라우저에서 http://127.0.0.1:8766 을 엽니다. 배경음악은 **음악 켜기**를 누르면 시작합니다. 화면이 이전 버전이면 `Cmd+Shift+R`로 새로고침하세요.

### 실제 음성 대화 설정

1. 채팅에 노출한 API 키는 [API 키 관리](https://platform.openai.com/api-keys)에서 폐기하고 새 키를 만드세요.
2. `.env.example`을 `.env`로 복사하고, 로컬 텍스트 편집기로 `OPENAI_API_KEY=` 뒤에 새 키를 입력해 저장하세요. 키를 채팅에 보내지 마세요.
3. 실행 중인 서버를 `Ctrl+C`로 종료한 뒤 `node server.mjs`로 다시 시작하세요.
4. 브라우저에서 **동물과 대화**를 열고 사슴 또는 토끼를 선택한 뒤 대화를 시작하고 마이크를 허용하세요.

API 사용에는 계정의 사용 요금이 발생할 수 있습니다. 키는 서버에서만 사용하며 `.env`는 Git 제외 대상입니다. 서버는 작품 파일만 제공하므로 `.env`를 내려받을 수 없습니다. 이 폴더에서 범용 정적 서버 대신 제공한 Node 서버를 사용하세요.

대화 중 마이크 끄기와 종료가 가능합니다. 동물을 바꾸거나 패널을 닫거나 탭을 숨기면 연결과 마이크가 종료됩니다. 한 대화는 최대 10분입니다. 음악은 대화 중 선택한 음량의 20%로 낮아지고 종료 후 복원됩니다. 브라우저가 소리 재생을 막으면 재생 버튼으로 다시 시도하세요.

키 없이도 작품과 배경음악을 사용할 수 있습니다. `index.html`을 직접 여는 오프라인 실행에서도 작품과 음악은 동작하지만, 실시간 대화에는 Node 서버와 인터넷이 필요합니다. 실제 API 음성 왕복과 물리 마이크는 아직 검증하지 않았습니다.

## 감상과 조작

- 사슴: 호흡과 고개의 미세한 움직임. 클릭하면 고개 움직임과 청록빛 입자가 나타납니다.
- 토끼: 호흡과 귀의 미세한 움직임. 클릭하면 작게 뛰며 가까운 꽃이 흔들립니다.
- 붉은 꽃: 바람에 흔들립니다. 마우스를 올리거나 클릭하면 더 밝게 빛납니다.
- 숲과 물: 안개·나뭇잎·반딧불이·수면 빛이 움직이고 클릭 지점에서 빛의 파문이 퍼집니다.
- 키보드: `Tab`으로 동물·꽃·버튼 선택, `Enter` 또는 `Space`로 실행.
- 움직임 줄이기: 모든 자동 움직임을 멈추고 정적인 테두리로 입력을 표시합니다. 운영체제 설정도 반영합니다.
- 전체 화면: 오른쪽 아래 버튼. `Esc`로 종료합니다.
- 도움말: 버튼으로 열고 닫기 또는 `Esc`로 닫습니다.

일반 노트북에서는 마우스·트랙패드를 사용합니다. 화면을 직접 누르는 조작은 터치스크린이 필요합니다.

## 색상·속도·위치 수정

`styles.css`의 `:root`에서 아래 값을 바꾸고 새로고침합니다.

```css
--sunlight: #98f4df; /* 입력 입자와 강조색 */
--deer-duration: 2000ms;
--rabbit-duration: 1000ms;
--grass-duration: 1200ms; /* 꽃 반응: 기존 설정 이름 유지 */
--deer-x: 34%;
--deer-y: 31%;
--rabbit-x: 63%;
--rabbit-y: 65%;
```

효과 시간은 양수로 지정합니다. 1000ms는 1초입니다. 작은 화면에는 CSS 하단의 별도 배치가 적용됩니다. 꽃 위치는 `script.js`의 `grassLocations`에서 변경합니다. 배경과 동물 자체의 색은 이미지에 포함되어 있어 `--sunlight`로 바뀌지 않습니다.

## 파일

- `index.html`: 작품 화면과 접근 가능한 입력 버튼
- `styles.css`: 전체 화면 구성, 꽃·안개·나뭇잎 움직임
- `script.js`: 입력과 상태, 도움말, 전체 화면, 움직임 줄이기
- `night.js`: 동물 이미지 변형, 반딧불이, 수면 빛, 클릭 파문
- `server.mjs`: 서버 전용 API 키와 WebRTC 세션 생성
- `voice-session.js`, `voice.js`: 음성 연결 수명 관리와 대화 UI
- `music.js`: 배경음악 생성과 음량 조절
- `assets/night-forest.png`: 밤숲 배경
- `assets/moon-deer.png`, `assets/moon-rabbit.png`: 투명 동물 이미지
- `assets/ember-flowers.png`: 투명 꽃 이미지
- `assets/GENERATED-ASSETS.md`: 생성 방식과 프롬프트
- `verification.md`: 확인한 범위와 미확인 항목
- `progress.md`, `loop-log.md`: 재개 지침과 작업 이력

## 개발용 검사

```sh
node --test tests/state.test.cjs tests/voice.test.cjs tests/music.test.cjs tests/server.test.mjs
node tools/audio-browser-check.cjs
```

브라우저 검사는 macOS Google Chrome과 실행 중인 Node 서버(8766)를 사용합니다. 음성 전송은 모의 연결이며 실제 API 성공 증거와 구분합니다. 최신 검사 결과는 `evidence/audio-unit-tests.txt`, `evidence/audio-browser-checks.json`에 있습니다.

GitHub: https://github.com/superpjh-stack/digital_media_art

## Hostinger VPS Docker 배포

`docker-compose.yml`은 앱을 VPS의 `127.0.0.1:8766`에 연결합니다. 기존 HTTPS 프록시에서 해당 포트로 연결하고 원래 Host 헤더를 유지하세요. 컨테이너 프록시를 사용한다면 같은 Docker 네트워크에서 `forest:8766`으로 연결하세요.

VPS 프로젝트 폴더에 `.env.example`을 `.env`로 복사하고 `PUBLIC_ORIGIN=https://실제도메인`을 설정합니다. 음성을 사용할 경우 새 `OPENAI_API_KEY`를 VPS에서 직접 설정하세요. 키 없이도 화면과 음악은 동작합니다.

```sh
docker compose up -d --build
docker compose ps
```

기존 HTTPS 프록시가 없고 포트 80/443이 비어 있다면, 도메인의 DNS를 VPS로 연결한 뒤 아래 구성을 사용할 수 있습니다. Caddy가 인증서를 발급하며 `/data` 볼륨에 보관합니다.

```sh
docker compose -f docker-compose.yml -f compose.https.yml up -d --build
```

공개 도메인의 마이크 사용에는 HTTPS가 필요합니다. 기존 프록시가 사용 중인 포트와 충돌하지 않도록 VPS 상태 확인 후 실행해야 합니다. Docker 이미지는 코드와 작품 자산만 포함하며 `.env`, Git 이력, 검증 스크린샷은 포함하지 않습니다.

현재 상태: 로컬 배포 파일 준비 완료. VPS 접속 정보와 도메인이 아직 제공되지 않아 실제 Hostinger 배포/인증서 발급/외부 접속은 미확인입니다.
