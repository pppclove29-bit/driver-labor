// POST /api/route: 지점 좌표 2~11개 → 구간별 숫자 6개.
// 구간마다 제공자를 따로 호출해 구간별 통행료·택시요금을 받는다 (decisions.md, 해석 15 ①).
// 한 요청의 구간은 모두 같은 제공자로 조회한다.
import type { Provider } from '../budget/limits.js';
import { ROUTE_CACHE_TTL_MS } from '../cache/RouteCache.js';
import { hmacHex } from '../crypto.js';
import type { Deps } from '../deps.js';
import { guard, reserveFailure } from '../guard.js';
import { fail, json } from '../http.js';
import { kakaoRoute } from '../providers/kakao.js';
import { tmapRoute } from '../providers/tmap.js';
import { ProviderError, type RouteLeg } from '../providers/types.js';
import { SESSION_PER_MINUTE } from '../ratelimit.js';
import { parseRouteBody, type Point, readJsonBody } from '../validate.js';

export interface RouteResponse {
  provider: Provider;
  legs: RouteLeg[];
}

/** 소수점 4자리(약 10m)로 반올림. 캐시 키와 외부 호출 양쪽에 쓴다. */
export const roundPoint = (p: Point): Point => ({
  lat: Math.round(p.lat * 1e4) / 1e4,
  lng: Math.round(p.lng * 1e4) / 1e4,
});

async function lookup(
  deps: Deps,
  provider: Provider,
  points: Point[],
): Promise<RouteLeg[] | ProviderError> {
  const adapter =
    provider === 'kakao'
      ? kakaoRoute(deps.upstream, deps.secrets.kakaoKey)
      : tmapRoute(deps.upstream, deps.secrets.tmapKey);
  try {
    return await Promise.all(points.slice(1).map((to, i) => adapter(points[i]!, to)));
  } catch (e) {
    if (e instanceof ProviderError) return e;
    throw e;
  }
}

export async function handleRoute(request: Request, _url: URL, deps: Deps): Promise<Response> {
  // ①
  const parsed = parseRouteBody(await readJsonBody(request));
  if (parsed === null) return fail('invalid_input');
  // ②③④
  const sid = await guard(request, deps, 'route');
  if (sid instanceof Response) return sid;

  // ⑤
  const points = parsed.map(roundPoint);
  const key = await hmacHex(
    deps.secrets.cacheSecret,
    `route:v1:${points.map((p) => `${p.lat},${p.lng}`).join(';')}`,
  );
  const cached = await deps.routeCache.get(key);
  if (cached !== null) return json(JSON.parse(cached) as RouteResponse);

  // ⑥
  const units = points.length - 1;
  const mode = await deps.control.provider();
  const perMinute = deps.limiters.routeSession ? {} : { perMinute: SESSION_PER_MINUTE.route };
  const reserved = await deps.budget.reserve({
    kind: 'route',
    sessionId: sid,
    units,
    mode,
    ...perMinute,
  });
  if (!reserved.ok) return reserveFailure(reserved);

  // ⑦ 카카오가 장애·차단이면 TMAP으로 다시 (TMAP 예산을 따로 예약)
  let provider = reserved.provider;
  let result = await lookup(deps, provider, points);
  if (
    result instanceof ProviderError &&
    result.kind === 'unavailable' &&
    provider === 'kakao' &&
    mode === 'auto'
  ) {
    console.error('upstream_unavailable', 'kakao_route');
    const retry = await deps.budget.reserve({
      kind: 'route',
      sessionId: sid,
      units,
      mode: 'tmap',
      retry: true,
    });
    if (!retry.ok) return fail('auto_lookup_unavailable');
    provider = 'tmap';
    result = await lookup(deps, provider, points);
  }
  if (result instanceof ProviderError) {
    if (result.kind === 'no_result') return fail('route_not_found');
    console.error('upstream_unavailable', `${provider}_route`);
    return fail('auto_lookup_unavailable');
  }

  const body: RouteResponse = { provider, legs: result };
  await deps.routeCache.put(key, JSON.stringify(body), ROUTE_CACHE_TTL_MS);
  return json(body);
}
