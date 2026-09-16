# 운전 노동 정산기

친구와 차로 여행할 때 운전자의 수고(노동비)와 기름값·통행료를 정산하고, 괘씸한 동승자에게 조금 더 받는 앱.
PWA로 먼저 출시하고, 나중에 네이티브(Expo)로 옮긴다.

## 문서 (작업 전 해당 문서를 먼저 읽을 것)
- `docs/tasks.md` 마일스톤, 완료 기준, 테스트 기준값, 확정이 필요한 해석
- `docs/spec-calc.md` 계산 로직 (구간 자동 생성, 유류비, 노동비, 난이도, 괘씸, 택시모드, 정산)
- `docs/spec-screens.md` 화면별 동작 규칙 (S1~S11)
- `docs/architecture.md` Worker API, 서버 최소 정보, 0원 운영, 어뷰징 대응, 데이터 모델
- `docs/decisions.md` 확정한 결정, 남은 확인 사항, 광고 규칙, 로드맵
- `mockups/final.html` 전체 기획서와 폰 목업 (브라우저로 열어 시각 참고)

## 절대 규칙
1. 멤버 이름, 금액, 괘씸·결제 기록, 여행 날짜, GPS·속도, 결과 링크 내용을 서버로 보내지 않는다. 서버로 가는 값은 architecture.md의 "서버가 받는 것" 표에 있는 것뿐이다.
2. 기기 현재 위치를 서버로 보내지 않는다. "현재 위치로 검색" 기능을 만들지 않는다.
3. 결과 보기 페이지(`apps/result`)에는 외부 스크립트, 광고, 분석 도구를 넣지 않는다. 링크 데이터는 텍스트로만 출력한다(innerHTML 금지).
4. 결과 링크에 계좌번호를 넣지 않는다. 송금 버튼은 허용 형식의 송금 링크만.
5. 출발 전 입력 필드를 추가하지 않는다(도착지·동승자 2개만). 새 값은 기본값 + 결과 화면 "고치기"(S10c)로.
6. 결제수단 등록이 필요한 서비스, 유료 API를 쓰지 않는다. 외부 API 호출은 Worker의 일일 하드 상한을 반드시 거친다.
7. API 키는 코드·저장소에 넣지 않는다(`wrangler secret`). 요청 본문·검색어·좌표를 로그로 출력하지 않는다.
8. 개발·테스트는 `fixtures/`의 샘플 응답으로 한다. 실제 카카오·TMAP·오피넷 키로 반복 호출하지 않는다.
9. 광고는 정산 결과 화면(S10) 맨 아래 카드 1개, 계산 등록 1회당 1번만. 여행 중 화면과 결과 보기 페이지에는 없다.
10. `docs/decisions.md`와 충돌하는 요구가 생기면 구현을 멈추고 사람에게 묻는다.

## 기술 스택과 구조
- pnpm 워크스페이스 모노레포, TypeScript strict
- `packages/calc` 계산 엔진, 순수 함수, 외부 의존성 없음, Vitest
- `packages/link-codec` 결과 링크 압축·해제·스키마 검증
- `packages/storage` 저장소 인터페이스 (웹 구현: IndexedDB)
- `apps/web` PWA (Vite + React)
- `apps/result` 결과 보기 정적 페이지 (Vite, 외부 스크립트 없음)
- `apps/worker` Cloudflare Worker (/api, Durable Object 예산 카운터, KV, Cron, 정적 자산 서빙)

## 코딩 규칙
- 금액은 원 단위 정수. 1원 미만은 반올림, 반올림 차이는 운전자 몫에서 흡수(차액 합계 항상 0)
- 시간은 분 단위 정수, 시각은 ISO 8601 문자열. 거리는 미터 정수
- 계산 로직은 `packages/calc`에만. UI·Worker에서 금액을 직접 계산하지 않는다
- 계산 변경은 테스트를 먼저 쓰거나 고친다. `docs/tasks.md`의 기준값 테스트는 절대 삭제하지 않는다
- UI 문구는 한국어. 금액 표기는 천 단위 쉼표 + "원"

## 명령어

Node 22.11 이상이 필요하다(`.nvmrc` = 22.22.2). `nvm use`로 맞춘 뒤 실행한다.

| 명령 | 하는 일 |
|---|---|
| `pnpm install` | 의존성 설치 |
| `pnpm test` | 전체 테스트 (Vitest, 루트에서 워크스페이스 전체) |
| `pnpm test:watch` | 테스트 watch 모드 |
| `pnpm typecheck` | 전체 패키지 `tsc --noEmit` |
| `pnpm lint` | ESLint (절대 규칙 3·7을 `no-restricted-properties`·`no-console`로 강제) |
| `pnpm format` | Prettier 전체 적용 |
| `pnpm dev:web` | PWA 개발 서버 (`apps/web`) |
| `pnpm dev:result` | 결과 보기 페이지 개발 서버 (`apps/result`) |
| `pnpm dev:worker` | web·result 빌드 → 자산 수집 → `wrangler dev`. `/`에 web, `/r`에 result |
| `pnpm build` | web → result → worker 순서로 빌드 (worker는 `wrangler deploy --dry-run`) |

- `apps/worker`에서 `pnpm run assets`는 빌드된 web·result를 `dist-assets/`로 모은다(`/` = web, `/r` = result). `dev`·`build`가 먼저 실행하므로 따로 부를 일은 없다.
- `pnpm --filter @dl/worker deploy`로 배포한다. API 키는 `wrangler secret put`으로만 넣는다(절대 규칙 7).

## 작업 방식
- 한 번에 한 마일스톤. 시작 전 계획을 보여주고 승인받는다
- 마일스톤 끝에 테스트 통과 확인, `docs/tasks.md` 체크 표시, 커밋
- 마일스톤 끝마다 서버로 나가는 요청을 모두 찾아 절대 규칙 1·2와 대조한 결과를 보고한다
