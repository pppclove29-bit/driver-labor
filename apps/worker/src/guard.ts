// 방어 순서 ②③④. 외부 호출·DO를 건드리지 않고 싸게 거절한다.
import type { Kind } from './budget/limits.js';
import type { ReserveResult } from './budget/BudgetCounter.js';
import type { Deps } from './deps.js';
import { fail } from './http.js';
import { allow, clientIp, ipHash } from './ratelimit.js';
import { bearerToken, verifyToken } from './session.js';

/** ② 세션 토큰 확인. 통과하면 세션 ID. */
async function authorize(request: Request, deps: Deps): Promise<string | Response> {
  const token = bearerToken(request);
  if (!token) return fail('unauthorized');
  const sid = await verifyToken(deps.secrets.sessionSecret, token, deps.now());
  return sid ?? fail('unauthorized');
}

/** ②③(④). kind가 null이면(유가) 분당 제한과 스위치는 건너뛴다. 통과하면 세션 ID. */
export async function guard(
  request: Request,
  deps: Deps,
  kind: Kind | null,
): Promise<string | Response> {
  // ②
  const sid = await authorize(request, deps);
  if (sid instanceof Response) return sid;
  // ③
  const ip = await ipHash(deps.secrets.sessionSecret, clientIp(request), deps.now());
  if (await deps.control.blocked(sid, ip)) return fail('forbidden');
  if (kind === null) return sid;
  const enabled =
    kind === 'route' ? await deps.control.autoRoute() : await deps.control.autoPlaces();
  if (!enabled) return fail('auto_lookup_unavailable');
  // ④
  const { limiters } = deps;
  const [bySession, byIp] =
    kind === 'route'
      ? [limiters.routeSession, limiters.routeIp]
      : [limiters.placesSession, limiters.placesIp];
  if (!(await allow(bySession, `${kind}:s:${sid}`))) return fail('rate_limited');
  if (!(await allow(byIp, `${kind}:ip:${ip}`))) return fail('rate_limited');
  return sid;
}

/** ⑥ 예산 거절을 응답으로. */
export function reserveFailure(result: Extract<ReserveResult, { ok: false }>): Response {
  if (result.reason === 'session_daily') return fail('session_limit');
  if (result.reason === 'rate') return fail('rate_limited');
  return fail('auto_lookup_unavailable');
}
