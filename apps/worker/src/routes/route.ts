// POST /api/route: 지점 좌표 2~11개 → 구간별 숫자 6개.
// 구간마다 제공자를 따로 호출해 구간별 통행료·택시요금을 받는다 (decisions.md, 해석 15 ①).
// 한 요청의 구간은 모두 같은 제공자로 조회한다.
import type { Provider } from '../budget/limits.js';
import { ROUTE_CACHE_TTL_MS } from '../cache/RouteCache.js';
import { hmacHex } from '../crypto.js';
import type { Deps } from '../deps.js';
import { guard } from '../guard.js';
import { fail, json } from '../http.js';
import { reserveAndCall } from '../lookup.js';
import { kakaoRoute } from '../providers/kakao.js';
import { tmapRoute } from '../providers/tmap.js';
import type { RouteLeg } from '../providers/types.js';
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

  // ⑥⑦
  const result = await reserveAndCall(deps, 'route', sid, points.length - 1, (provider) => {
    const adapter =
      provider === 'kakao'
        ? kakaoRoute(deps.upstream, deps.secrets.kakaoKey)
        : tmapRoute(deps.upstream, deps.secrets.tmapKey);
    return Promise.all(points.slice(1).map((to, i) => adapter(points[i]!, to)));
  });
  if (result instanceof Response) return result;

  const body: RouteResponse = { provider: result.provider, legs: result.value };
  await deps.routeCache.put(key, JSON.stringify(body), ROUTE_CACHE_TTL_MS);
  return json(body);
}
