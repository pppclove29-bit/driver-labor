import { describe, expect, it } from 'vitest';

import { createApiClient } from './client.js';

interface Sent {
  url: string;
  method: string;
  body: string | undefined;
  auth: string | undefined;
}

/** 요청을 기록하고 경로별로 정해 둔 응답을 돌려주는 가짜 fetch. */
function fakeFetch(routes: Record<string, (n: number) => Response | Promise<Response>>) {
  const sent: Sent[] = [];
  const counts = new Map<string, number>();
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const path = url.split('?')[0]!;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    sent.push({
      url,
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : undefined,
      auth: headers.authorization,
    });
    const n = (counts.get(path) ?? 0) + 1;
    counts.set(path, n);
    const handler = routes[path];
    if (!handler) throw new TypeError('offline');
    return handler(n);
  }) as typeof globalThis.fetch;
  return { fetch, sent };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const session = () =>
  json({ token: 'v1.sid.1.sig', expiresAt: new Date(Date.now() + 7_200_000).toISOString() });

const ROUTE = {
  provider: 'kakao',
  legs: [
    {
      distanceM: 228214,
      durationMin: 173,
      tollWon: 12400,
      taxiFareWon: 231500,
      congestedRatio: 0.02,
      slowRoadRatio: 0.04,
    },
  ],
};

const client = (routes: Parameters<typeof fakeFetch>[0]) => {
  const f = fakeFetch(routes);
  return {
    api: createApiClient({ fetch: f.fetch, turnstile: async () => 'ts-token' }),
    sent: f.sent,
  };
};

const gangnam = {
  name: '강남역',
  address: '서울 강남구 강남대로 396',
  lat: 37.4979,
  lng: 127.0276,
};
const gyeongpo = {
  name: '경포해변',
  address: '강원특별자치도 강릉시 창해로 514',
  lat: 37.8055,
  lng: 128.9086,
};

describe('API 클라이언트', () => {
  it('세션을 한 번 받아 재사용하고, 경로 요청 본문에는 좌표만 담는다', async () => {
    const { api, sent } = client({ '/api/session': session, '/api/route': () => json(ROUTE) });
    expect(await api.route([gangnam, gyeongpo])).toEqual({ ok: true, value: ROUTE });
    await api.route([gangnam, gyeongpo]);
    expect(sent.filter((s) => s.url === '/api/session')).toHaveLength(1);
    expect(JSON.parse(sent[0]!.body!)).toEqual({ turnstileToken: 'ts-token' });
    const routeReq = sent.find((s) => s.url === '/api/route')!;
    expect(routeReq.auth).toBe('Bearer v1.sid.1.sig');
    // 장소 이름·주소는 서버로 가지 않는다 (절대 규칙 1·2)
    expect(JSON.parse(routeReq.body!)).toEqual({
      points: [
        { lat: 37.4979, lng: 127.0276 },
        { lat: 37.8055, lng: 128.9086 },
      ],
    });
  });

  it('장소 검색은 q만, 유가는 sido·prod만 보낸다', async () => {
    const { api, sent } = client({
      '/api/session': session,
      '/api/places': () => json({ provider: 'kakao', places: [] }),
      '/api/fuel/avg': () => json({ priceWon: 1701, updatedAt: 'x' }),
    });
    await api.places('강릉 경포');
    await api.fuelAvg('03', 'B027');
    expect(sent.map((s) => s.url)).toEqual([
      '/api/session',
      '/api/places?q=%EA%B0%95%EB%A6%89%20%EA%B2%BD%ED%8F%AC',
      '/api/fuel/avg?sido=03&prod=B027',
    ]);
  });

  it('503 → limit (한도 안내 + 수동 입력)', async () => {
    const { api } = client({
      '/api/session': session,
      '/api/route': () => json({ error: 'auto_lookup_unavailable' }, 503),
    });
    expect(await api.route([gangnam, gyeongpo])).toEqual({ ok: false, reason: 'limit' });
  });

  it('429·오프라인 → waiting, 422·400 → invalid', async () => {
    const busy = client({ '/api/session': session, '/api/route': () => json({}, 429) });
    expect(await busy.api.route([gangnam, gyeongpo])).toEqual({ ok: false, reason: 'waiting' });
    const offline = client({});
    expect(await offline.api.places('강릉')).toEqual({ ok: false, reason: 'waiting' });
    const far = client({ '/api/session': session, '/api/route': () => json({}, 422) });
    expect(await far.api.route([gangnam, gangnam])).toEqual({ ok: false, reason: 'invalid' });
  });

  it('401이면 세션을 새로 받아 한 번만 다시 시도한다', async () => {
    const { api, sent } = client({
      '/api/session': session,
      '/api/route': (n) => (n === 1 ? json({ error: 'unauthorized' }, 401) : json(ROUTE)),
    });
    expect((await api.route([gangnam, gyeongpo])).ok).toBe(true);
    expect(sent.map((s) => s.url)).toEqual([
      '/api/session',
      '/api/route',
      '/api/session',
      '/api/route',
    ]);
  });

  it('세션 발급이 503이면 limit', async () => {
    const { api } = client({ '/api/session': () => json({}, 503) });
    expect(await api.places('강릉')).toEqual({ ok: false, reason: 'limit' });
  });
});
