// GET /api/places?q=: 검색어만 받아 상위 5개(이름·주소·좌표).
// 현재 위치 좌표는 받지 않는다 (CLAUDE.md 절대 규칙 2). 서버 캐시는 두지 않는다(decisions.md).
import type { Provider } from '../budget/limits.js';
import type { Deps } from '../deps.js';
import { guard } from '../guard.js';
import { fail, json } from '../http.js';
import { reserveAndCall } from '../lookup.js';
import { kakaoPlaces } from '../providers/kakao.js';
import { tmapPlaces } from '../providers/tmap.js';
import type { Place } from '../providers/types.js';
import { parsePlacesQuery } from '../validate.js';

export interface PlacesResponse {
  provider: Provider;
  places: Place[];
}

export async function handlePlaces(request: Request, url: URL, deps: Deps): Promise<Response> {
  // ①
  const q = parsePlacesQuery(url);
  if (q === null) return fail('invalid_input');
  // ②③④
  const sid = await guard(request, deps, 'places');
  if (sid instanceof Response) return sid;
  // ⑥⑦
  const result = await reserveAndCall(deps, 'places', sid, 1, (provider) =>
    provider === 'kakao'
      ? kakaoPlaces(deps.upstream, deps.secrets.kakaoKey, q)
      : tmapPlaces(deps.upstream, deps.secrets.tmapKey, q),
  );
  if (result instanceof Response) return result;
  const body: PlacesResponse = { provider: result.provider, places: result.value };
  return json(body);
}
