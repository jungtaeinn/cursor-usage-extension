# Cursor Usage Extension v1.0.0 by TAEINN

Cursor Admin API 기반으로 팀/개인 사용량, 비용, 한도, 경고 알림을 확인하는 듀얼 클라이언트 프로젝트입니다.

- Chrome MV3 확장: `apps/chrome-extension`
- Tauri 데스크톱 앱(Windows/macOS): `apps/desktop-tauri`
- 공통 코어 엔진: `packages/core`

## 주요 기능

- `5분 polling`: `/teams/spend`
- `1시간 polling`: `/teams/daily-usage-data`
- `manual refresh`: 즉시 전체 동기화
- 탭 전환 시 네트워크 재요청 없음(캐시 기반)
- USD + KRW(약) 병기
- 개인/팀 임계치 경고(사이클당 1회)
- Teams Webhook + Resend 다중 수신자 알림
- 관리자 탭에서 `/teams/user-spend-limit` 적용/해제
- 다크/라이트 모드 + 한국어/영어 UI

## 개발 환경

- Node.js 20+
- pnpm 10+
- (Tauri 빌드용) Rust toolchain + Tauri prerequisites

## 시작하기

```bash
pnpm install
```

### Chrome Extension 개발

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

빌드 후에도 동일하게 `apps/chrome-extension/dist` 경로를 로드하면 됩니다.

확장 로드 후 접근 경로:

- 팝업: Chrome 툴바에서 `Cursor Usage Extension` 아이콘 클릭
- 옵션(대시보드): `chrome-extension://<EXTENSION_ID>/options.html`

개발 모드 연결 오류(`Cannot connect to http://localhost:5173`)가 뜰 때:

1. `pnpm dev:chrome`가 실행 중인지 확인 (터미널 종료하면 연결이 끊깁니다)
2. `chrome://extensions`에서 확장 `새로고침`
3. 5173 포트 점유 프로세스가 있으면 종료 후 다시 실행
4. 개발 서버 없이 쓰려면 아래처럼 빌드 후 `dist`를 로드

```bash
pnpm --filter @cursor-usage/chrome-extension build
```

### Tauri Desktop 개발

```bash
pnpm dev:desktop
```

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

## License

Apache License 2.0
