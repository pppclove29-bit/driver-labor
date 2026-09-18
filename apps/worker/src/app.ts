// /api 라우터. 방어 순서(architecture.md "요청이 거치는 방어 순서"):
//   ① 입력 검증 → ② 세션 토큰 → ③ 차단 목록 → ④ 분당 제한
//   → ⑤ 캐시 → ⑥ 일일 예산(DO) → ⑦ 외부 호출
// 앞 단계에서 거절되면 뒤 단계는 실행하지 않는다.
//
// 요청 본문·쿼리·좌표를 로그로 출력하지 않는다 (CLAUDE.md 절대 규칙 7).
import type { Deps } from './deps.js';
import { fail, json } from './http.js';
import { allow, clientIp, ipHash } from './ratelimit.js';
import { bearerToken, issueToken, verifyToken, verifyTurnstile } from './session.js';
import {
  parseFuelQuery,
  parsePlacesQuery,
  parseRouteBody,
  parseSessionBody,
  readJsonBody,
} from './validate.js';

type Handler = (request: Request, url: URL, deps: Deps) => Promise<Response>;

/** ② 세션 토큰 확인. 통과하면 세션 ID. */
async function authorize(request: Request, deps: Deps): Promise<string | Response> {
  const token = bearerToken(request);
  if (!token) return fail('unauthorized');
  const sid = await verifyToken(deps.secrets.sessionSecret, token, deps.now());
  return sid ?? fail('unauthorized');
}

const notYet = async (): Promise<Response> => fail('not_implemented');

async function handleSession(request: Request, _url: URL, deps: Deps): Promise<Response> {
  // ①
  const turnstileToken = parseSessionBody(await readJsonBody(request));
  if (turnstileToken === null) return fail('invalid_input');
  // ④ 세션 대량 발급 방지: IP 분당 2회
  const ip = await ipHash(deps.secrets.sessionSecret, clientIp(request), deps.now());
  if (!(await allow(deps.limiters.sessionIp, `session:${ip}`))) return fail('rate_limited');
  // Turnstile 검증 (Cloudflare, 무료·무제한)
  const result = await verifyTurnstile(deps.upstream, deps.secrets.turnstileSecret, turnstileToken);
  if (result === 'error') return fail('auto_lookup_unavailable');
  if (result === 'fail') return fail('unauthorized');
  return json(await issueToken(deps.secrets.sessionSecret, deps.now()));
}

const handlers: Record<string, Partial<Record<string, Handler>>> = {
  '/api/session': { POST: handleSession },
  '/api/route': {
    POST: async (request, _url, deps) => {
      if (parseRouteBody(await readJsonBody(request)) === null) return fail('invalid_input');
      const sid = await authorize(request, deps);
      if (sid instanceof Response) return sid;
      return notYet();
    },
  },
  '/api/places': {
    GET: async (request, url, deps) => {
      if (parsePlacesQuery(url) === null) return fail('invalid_input');
      const sid = await authorize(request, deps);
      if (sid instanceof Response) return sid;
      return notYet();
    },
  },
  '/api/fuel/avg': {
    GET: async (request, url, deps) => {
      if (parseFuelQuery(url) === null) return fail('invalid_input');
      const sid = await authorize(request, deps);
      if (sid instanceof Response) return sid;
      return notYet();
    },
  },
};

export async function handleApi(request: Request, deps: Deps): Promise<Response> {
  const url = new URL(request.url);
  const methods = handlers[url.pathname];
  if (!methods) return fail('not_found');
  const handler = methods[request.method];
  if (!handler) return fail('method_not_allowed');
  if (!deps.secrets.sessionSecret) {
    // 배포 설정 누락. 비밀 값 이름만 남긴다.
    console.error('missing_secret', 'SESSION_SECRET');
    return fail('auto_lookup_unavailable');
  }
  return handler(request, url, deps);
}
