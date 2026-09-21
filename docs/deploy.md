# 배포 절차 (페이지 먼저)

> 목적은 **개인정보처리방침 URL 확보**다. 카카오·TMAP·오피넷 키는 아직 없고, 키를 기다리지 않는다.
> 키 없이 배포하면 자동 조회는 실패하고 앱은 수동 입력으로 넘어간다. 그렇게 설계돼 있고 테스트로 고정했다
> (`apps/worker/test/no-keys.test.ts`).
>
> **이 문서의 명령은 사람 승인을 받고 실행한다.** 에이전트는 준비까지만 한다.

## 1. 키 없이 배포하면 어떻게 되나 (테스트로 확인)

| 요청 | 응답 | 앱 화면 |
|---|---|---|
| `/`, `/guide`, `/calc`, `/privacy`, `/r` | 200 | 정적 페이지. 키와 무관하다 |
| `POST /api/session` (TURNSTILE_SECRET 없음) | 401 | 조회 실패 → "조회 대기 중이에요", 수동 입력 |
| `POST /api/route` (카카오·TMAP 키 없음 → 둘 다 401) | 503 `auto_lookup_unavailable` | 한도 안내 + 거리·통행료 직접 입력 |
| `GET /api/places` | 503 | "장소 이름만 적어도 됩니다" |
| `GET /api/fuel/avg` (KV 비어 있음) | 503 | 유가는 기본값(1,700원/L) |
| Cron 유가 갱신 | 실패해도 KV를 건드리지 않음 | — |
| 로그 | `upstream_unavailable` 같은 코드만. 비밀 값·좌표·검색어 없음 | — |

정산·결과 링크·공유는 키와 무관하게 동작한다. **키가 없어도 앱은 끝까지 쓸 수 있다.**

### TURNSTILE_SECRET을 어떻게 할지

| 선택 | 결과 | 비고 |
|---|---|---|
| **넣지 않는다(권장)** | 세션 발급 401 → 앱은 "조회 대기"로 수동 입력 | 사실과 맞는 문구. 외부 키가 없어 조회 자체가 안 되는 상태다 |
| Cloudflare 테스트 secret(`1x0000…AA`) | 세션은 발급되고 조회에서 503 → "오늘 자동 조회 한도에 닿았어요" | 문구가 사실과 다르다. 또 테스트 키는 누구나 통과해 세션이 무제한 발급된다 |

키를 받은 뒤 실제 Turnstile 위젯을 만들고 그때 넣는다.

## 2. 사전 작업

### 어디서 하나

| 일 | 어떻게 | 누가 |
|---|---|---|
| Cloudflare 로그인 | `npx wrangler login` (브라우저 인증) | **사람** |
| 계정 확인 | `npx wrangler whoami` | 사람 또는 에이전트 |
| KV 네임스페이스 생성 | `npx wrangler kv namespace create CTRL` | 명령. 로그인 뒤에는 에이전트도 가능 |
| secret 넣기 | `npx wrangler secret put <이름>` (값은 표준 입력) | **사람**(값을 아는 사람이 직접) |
| Durable Object 생성·마이그레이션 | 첫 `deploy` 때 자동 | 명령 |
| Cron 등록 | `deploy` 때 자동 | 명령 |
| 배포 | `pnpm run deploy` | 명령 |
| 비상 스위치 값 바꾸기 | `wrangler kv key put` 또는 대시보드 | 둘 다 가능 |
| 결과 확인(DO·Cron·요청 수) | 대시보드 Workers & Pages | 사람 |

대시보드에서만 할 수 있는 일은 **없다.** 로그인과 secret 값 입력만 사람이 하면 나머지는 명령으로 끝난다.

### 사람이 하는 일 (Cloudflare 계정 필요)

1. `wrangler login` (브라우저 인증). 계정이 여러 개면 대상 계정을 고른다.
2. KV 네임스페이스 생성:

   ```bash
   cd apps/worker
   npx wrangler kv namespace create CTRL
   ```

   **완료(2026-09-21): `d0f039a55c6a435288f207cea8a2e9ab`.** `wrangler.jsonc`에 반영했다.
3. 배포에 필요한 secret 두 개를 넣는다(외부 API 키가 아니라 이 앱이 스스로 쓰는 값이다).

   ```bash
   npx wrangler secret put SESSION_SECRET   # 세션 토큰 서명, IP 해시 솔트
   npx wrangler secret put CACHE_SECRET     # 캐시 키 해시
   ```

   값은 각각 무작위 32바이트 이상. 예: `openssl rand -base64 32`. 비밀번호 관리자에 보관한다.
   **둘 중 하나라도 없으면 `/api`는 전부 503이다**(정적 페이지는 영향 없음).
4. Rate Limiting 바인딩을 무료 플랜에서 쓸 수 있는지 확인한다. 배포가 그 이유로 실패하면 `wrangler.jsonc`의 `ratelimits` 블록을 지우고 다시 배포한다(세션 분당 제한은 Durable Object가 대신 센다).

### 코드로 준비된 것 (이미 되어 있음)

- Durable Object `BudgetCounter`·`RouteCache`와 마이그레이션(`new_sqlite_classes`)은 `wrangler.jsonc`에 있다. 첫 배포 때 자동으로 만들어진다.
- Cron 트리거 `0 * * * *` 하나.
- `vars.UPSTREAM = "live"`, `vars.ALLOWED_ORIGINS = ""`(앱 WebView `https://localhost`는 코드 기본값으로 허용).
- 정적 자산: `apps/site` → `/`, `apps/result` 빌드 → `/r`.

### 배포 전에 정할 값

| 값 | 누가 | 메모 |
|---|---|---|
| Worker 이름(= 주소) | — | **확정: `driver-labor`** → `https://driver-labor.<계정>.workers.dev` |
| 개인정보처리방침 시행일 | — | 2026-09-21로 넣었다. 실제 공개일이 다르면 고친다 |
| 문의 이메일 | — | **확정: musikga1116@gmail.com** (세 앱 공용). 페이지에 채웠다 |

## 3. 배포 명령과 순서

```bash
cd apps/worker
pnpm run build     # 정적 자산 모으기 + dry-run 확인
pnpm run deploy    # 실제 배포 (assets + Worker + DO + Cron)
```

`deploy`는 `pnpm run assets`를 먼저 돌리므로 `apps/result` 빌드가 되어 있어야 한다(루트 `pnpm build`가 해준다).

## 4. 배포 후 확인 절차

순서대로 열어 본다.

1. `https://<주소>/` → 소개 페이지. 제목이 "오늘 운전 완료"
2. `https://<주소>/privacy` → 개인정보처리방침. **이 주소를 스토어에 넣는다**
3. `https://<주소>/guide`, `/calc` → 200
4. `https://<주소>/r` → 결과 보기 페이지(빈 링크라 "손상된 링크" 안내가 정상)
5. `curl -i https://<주소>/api/route -X POST -H 'content-type: application/json' -d '{"points":[{"lat":37.5,"lng":127.0}]}'` → **400**(입력 검증이 먼저 걸린다)
6. `curl -X POST https://<주소>/api/session -H 'content-type: application/json' -d '{"turnstileToken":"x"}'` → **401**(Turnstile secret 없음). SESSION_SECRET·CACHE_SECRET을 안 넣었다면 503이 온다 — 그러면 2·3단계로 돌아간다
7. Cloudflare 대시보드에서 Durable Object 두 개와 Cron 트리거가 만들어졌는지 확인
8. 앱(에뮬레이터)에서 결과 링크를 만들어 그 주소로 열리는지 확인 — 앱 빌드에 주소를 넣은 뒤에 한다(6장)

## 5. 되돌리기

| 상황 | 방법 |
|---|---|
| 배포가 잘못됨 | `npx wrangler rollback` (직전 버전으로). 또는 고쳐서 다시 `deploy` |
| 조회를 급히 끄고 싶음 | KV `CTRL`에 `auto_route=off`, `auto_places=off` (재배포 없이, 최대 60초 뒤 반영) |
| 전부 내리고 싶음 | `npx wrangler delete` — **Durable Object 저장소(카운터)도 함께 사라진다.** 정적 페이지 주소도 죽으므로 스토어에 방침 URL을 넣은 뒤에는 쓰지 않는다 |
| secret 교체 | `npx wrangler secret put <이름>` 다시 실행 |

방침 URL은 스토어 심사에 걸려 있으므로 **주소를 바꾸거나 내리지 않는 것을 전제로 이름을 정한다.**

## 6. 배포 주소가 정해진 뒤 채울 값

| 대상 | 값 | 누가 |
|---|---|---|
| `apps/web/.env.app.local`(커밋하지 않음) | `VITE_API_BASE=https://<주소>`, `VITE_RESULT_BASE=https://<주소>` | 코드(에이전트) |
| `apps/worker/wrangler.jsonc` | `kv_namespaces[0].id`를 실제 값으로 | 코드(에이전트) |
| `ALLOWED_ORIGINS` | 기본값(`https://localhost`)으로 충분. 웹에서 테스트할 주소가 생기면 추가 | 코드 |
| Turnstile 위젯 호스트 | 실제 키를 받은 뒤 등록 | 사람 |
| 스토어 등록정보 | 개인정보처리방침 URL = `https://<주소>/privacy` | 사람 |
| `apps/site/privacy.html` | 실제 공개일이 2026-09-21과 다르면 시행일만 | 코드 |

이 값들을 채운 뒤 릴리스 AAB를 만들어야 앱에서 자동 조회와 결과 링크가 제 주소를 가리킨다.
