// /api 라우터. 방어 순서(architecture.md "요청이 거치는 방어 순서"):
//   ① 입력 검증 → ② 세션 토큰 → ③ 차단 목록 → ④ 분당 제한
//   → ⑤ 캐시 → ⑥ 일일 예산(DO) → ⑦ 외부 호출
// 앞 단계에서 거절되면 뒤 단계는 실행하지 않는다.
//
// 요청 본문·쿼리·좌표를 로그로 출력하지 않는다 (CLAUDE.md 절대 규칙 7).
import { preflight, withCors } from './cors.js';
import type { Deps } from './deps.js';
import { fail } from './http.js';
import { handleFuelAvg } from './routes/fuel.js';
import { handlePlaces } from './routes/places.js';
import { handleRoute } from './routes/route.js';
import { handleSession } from './routes/session.js';

type Handler = (request: Request, url: URL, deps: Deps) => Promise<Response>;

const handlers: Record<string, Partial<Record<string, Handler>>> = {
  '/api/session': { POST: handleSession },
  '/api/route': { POST: handleRoute },
  '/api/places': { GET: handlePlaces },
  '/api/fuel/avg': { GET: handleFuelAvg },
};

export async function handleApi(request: Request, deps: Deps): Promise<Response> {
  const url = new URL(request.url);
  // 사전 요청은 검증·토큰·예산 앞에서 끝낸다. 사전 요청으로 한도를 태우지 않는다.
  if (request.method === 'OPTIONS') return preflight(request, deps.allowedOrigins);
  return withCors(await route(request, url, deps), request, deps.allowedOrigins);
}

async function route(request: Request, url: URL, deps: Deps): Promise<Response> {
  const methods = handlers[url.pathname];
  if (!methods) return fail('not_found');
  const handler = methods[request.method];
  if (!handler) return fail('method_not_allowed');
  if (!deps.secrets.sessionSecret || !deps.secrets.cacheSecret) {
    // 배포 설정 누락. 비밀 값 이름만 남긴다.
    console.error('missing_secret');
    return fail('auto_lookup_unavailable');
  }
  return handler(request, url, deps);
}
