// fixtures 모드의 가짜 외부 API. wrangler dev(`UPSTREAM=fixtures`)와 테스트가 쓴다.
// 실제 카카오·TMAP·오피넷 키로 반복 호출하지 않는다 (CLAUDE.md 절대 규칙 8).
import kakaoSeoulGangneung from '../../../../fixtures/kakao/directions-seoul-gangneung.json';
import kakaoSeoulWonju from '../../../../fixtures/kakao/directions-seoul-wonju.json';
import kakaoWonjuGangneung from '../../../../fixtures/kakao/directions-wonju-gangneung.json';
import kakaoPlaces from '../../../../fixtures/kakao/places-gangneung.json';
import opinetAvg from '../../../../fixtures/opinet/avg-sido.json';
import tmapPois from '../../../../fixtures/tmap/pois-gangneung.json';
import tmapRoute from '../../../../fixtures/tmap/route-seoul-gangneung.json';
import type { Upstream } from '../upstream.js';

/** fixtures에 들어 있는 지점. 경도, 위도. */
export const FIXTURE_POINTS = {
  gangnam: { lng: 127.0276, lat: 37.4979 },
  wonju: { lng: 127.811, lat: 37.328 },
  gyeongpo: { lng: 128.9086, lat: 37.8055 },
} as const;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const near = (xy: string | null, p: { lng: number; lat: number }): boolean => {
  const [x, y] = (xy ?? '').split(',').map(Number);
  return Math.abs((x ?? NaN) - p.lng) < 0.01 && Math.abs((y ?? NaN) - p.lat) < 0.01;
};

function kakaoDirections(url: URL): Response {
  const origin = url.searchParams.get('origin');
  const destination = url.searchParams.get('destination');
  if (origin === destination) {
    return json({
      trans_id: 'fixture-same-point',
      routes: [{ result_code: 104, result_msg: '출발지와 도착지가 5 m 이내로 설정된 경우 경로를 탐색할 수 없음' }],
    });
  }
  if (near(origin, FIXTURE_POINTS.gangnam) && near(destination, FIXTURE_POINTS.wonju)) {
    return json(kakaoSeoulWonju);
  }
  if (near(origin, FIXTURE_POINTS.wonju)) return json(kakaoWonjuGangneung);
  return json(kakaoSeoulGangneung);
}

export const fixtureUpstream: Upstream = async (request) => {
  const url = new URL(request.url);
  const key = `${url.hostname}${url.pathname}`;
  switch (key) {
    case 'apis-navi.kakaomobility.com/v1/directions':
      return kakaoDirections(url);
    case 'dapi.kakao.com/v2/local/search/keyword.json':
      return json(kakaoPlaces);
    case 'apis.openapi.sk.com/tmap/routes':
      return json(tmapRoute);
    case 'apis.openapi.sk.com/tmap/pois':
      return json(tmapPois);
    case 'www.opinet.co.kr/api/avgSidoPrice.do':
      return json(opinetAvg);
    case 'challenges.cloudflare.com/turnstile/v0/siteverify': {
      const form = await request.formData();
      const token = form.get('response');
      const ok = typeof token === 'string' && token.length > 0 && token !== 'invalid';
      return json(ok ? { success: true } : { success: false, 'error-codes': ['invalid-input-response'] });
    }
    case 'discord.com/api/webhooks/fixture':
      return new Response(null, { status: 204 });
    default:
      return json({ error: 'fixture_not_found' }, 404);
  }
};
