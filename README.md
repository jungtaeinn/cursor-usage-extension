# Cursor Usage Extension v1.1.0 by TAEINN

Cursor Admin API 기반으로 팀/개인 사용량, 비용, 한도, 경고 알림을 확인하는 경량 모니터링 프로젝트입니다.

- Chrome MV3 확장: `apps/chrome-extension`
- Tauri 데스크톱 앱(Windows/macOS): `apps/desktop-tauri`
- 공통 코어 엔진: `packages/core`

## 주요 기능

- `5분 polling`: `/teams/spend`
- `1시간 polling`: `/teams/daily-usage-data`
- `1시간 polling`: `/teams/filtered-usage-events` (이벤트 비용/토큰 요약)
- `manual refresh`: 즉시 전체 동기화
- 탭 전환 시 네트워크 재요청 없음(캐시 기반)
- USD + KRW(약) 병기
- 개인/팀 임계치 경고(사이클당 1회 dedupe)
- Teams Webhook + Resend 다중 수신자 알림
- 관리자 탭에서 `/teams/user-spend-limit` 적용/해제
- 다크/라이트 + 한국어/영어 UI
- 미니 모드(잔여 사용량 강조) / 맥스 모드 전환

## 개발 환경

- Node.js 20+
- pnpm 10+
- (Tauri 빌드/실행용) Rust toolchain + Tauri prerequisites

## 시작하기

```bash
pnpm install
```

## 사용법

1. 앱(Chrome 확장 또는 Desktop)을 실행합니다.
2. `Settings` 탭에서 `Cursor API Key`, `내 이메일`, `팀 월예산` 등을 입력합니다.
3. 필요하면 `인증하기`로 API Key를 즉시 검증합니다.
4. `설정 저장` 후 `새로고침` 또는 자동 동기화로 데이터를 반영합니다.
5. `Summary / Team` 탭에서 사용률, 비용, 이벤트 요약을 확인합니다.

## 시스템 동작 Flow

1. 앱 시작 시 로컬 저장소에서 `AppConfig + SyncSnapshot`을 로드합니다.
2. 스케줄러가 주기 실행됩니다.
- 5분마다 `/teams/spend`
- 1시간마다 `/teams/daily-usage-data`, `/teams/filtered-usage-events`
3. 수동 새로고침은 즉시 전체 동기화를 트리거합니다.
4. 요청은 `in-flight dedupe`와 `AbortController`로 중복/경합을 방지합니다.
5. 응답은 정규화 후 캐시에 저장되고, UI는 캐시 스냅샷만 읽어 즉시 렌더링합니다.
6. 임계치 초과 시 `cycleStart + alertType + threshold` 키로 사이클당 1회만 알림 전송합니다.
7. 탭 전환은 네트워크를 다시 호출하지 않고 캐시만 사용합니다(`stale-while-revalidate` 정책).

## 목업 데이터 테스트 모드

실제 Enterprise API 키 없이 UI/알림 흐름을 테스트하려면 API Key에 아래 값을 저장하세요.

```text
mock_demo
```

저장 후 수동 새로고침/자동 동기화 시 아래 형식의 목업 응답이 로드됩니다.

- `POST /teams/spend`
- `POST /teams/daily-usage-data`
- `POST /teams/filtered-usage-events`
- `POST /teams/user-spend-limit`

## Chrome Extension 개발

개발 서버:

```bash
pnpm dev:chrome
```

Chrome 연결 경로(개발 모드):

1. `pnpm dev:chrome` 실행 후 터미널을 켜둡니다.
2. Chrome에서 `chrome://extensions` 접속
3. 우측 상단 `개발자 모드` 활성화
4. `압축해제된 확장 프로그램을 로드` 클릭
5. 아래 경로 선택

```text
apps/chrome-extension/dist
```

절대경로 예시:

```text
/Users/jungtaeinn/projects/cursor-usage-extension/apps/chrome-extension/dist
```

빌드:

```bash
pnpm --filter @cursor-usage/chrome-extension build
```

확장 로드 후 접근 경로:

- 팝업: Chrome 툴바 `Cursor Usage Extension` 아이콘 클릭
- 옵션(대시보드): `chrome-extension://<EXTENSION_ID>/options.html`

개발 모드 연결 오류(`Cannot connect to http://localhost:5173`)가 뜰 때:

1. `pnpm dev:chrome`가 실행 중인지 확인
2. `chrome://extensions`에서 확장 `새로고침`
3. 5173 포트 점유 프로세스 종료 후 재실행
4. 개발 서버 없이 사용 시 빌드 후 `dist` 로드

## Tauri Desktop 개발

```bash
pnpm dev:desktop
```

> `cargo metadata` 에러가 나면 Rust/Cargo 설치 후 다시 실행하세요.

빌드:

```bash
pnpm --filter @cursor-usage/desktop-tauri build
```

## 테스트

```bash
pnpm test
```

핵심 테스트 범위:

- 통화/환율 계산
- 임계치 경고 dedupe
- 429 백오프 재시도
- 수동 동기화 in-flight dedupe
- 탭 전환 시 비재요청 정책
- Mock 모드 응답 정합성

## License

Apache License 2.0
