# Changelog

## v1.1.0 - 2026-03-20

### Added

- `/teams/filtered-usage-events` 동기화 및 최근 24시간 이벤트 비용/토큰 요약 카드
- Mock 모드(`mock_demo`)에 Usage Events 목업 응답 추가
- 설정 탭 API Key 즉시 검증(저장 전 인증) + 표시/숨김(eye toggle) UI
- 미니 모드 잔여 사용량 강조 카드(잔여 퍼센트 칩 + 대형 잔여 금액)

### Changed

- 요약 탭 원형 차트 하단 문구를 `사용 / 한도(또는 예산)` 형식으로 통일
- 요약 탭의 `개인 한도`, `팀 예산` 보조 카드 제거 및 레이아웃 밀도 개선
- 데스크톱/크롬 옵션 화면 높이 축소(`640 -> 600`)로 불필요 여백 최소화
- 미니 모드 잔여 퍼센트 칩을 위험도 기반 컬러(파랑/초록/주황/빨강)로 표시

### Fixed

- `client.postFilteredUsageEvents is not a function` 런타임 오류 대응
- `postFilteredUsageEvents` 미지원 클라이언트에서도 graceful fallback 처리

## v1.0.0 - 2026-03-19

- Cursor Usage Extension 초기 릴리스
- Chrome MV3 + Tauri 데스크톱 듀얼 산출
- Cursor Admin API 기반 사용량/비용 대시보드
- 5분(spend) + 1시간(daily-usage) 혼합 동기화
- 수동 새로고침 + in-flight dedupe
- 개인/팀 임계치 경고(사이클당 1회)
- Teams Webhook + Resend 다중 수신 알림
- 관리자 한도 설정(`/teams/user-spend-limit`)
- 한국어 UI, 다크/라이트, KRW 환산 병기
