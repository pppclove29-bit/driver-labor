import { describe, expect, it } from 'vitest';
import { handleApi } from '../app.js';
import { BudgetCounter } from '../budget/BudgetCounter.js';
import { RouteCache } from '../cache/RouteCache.js';
import { FIXTURE_POINTS, fixtureUpstream } from '../providers/fixtures.js';
import { issueToken } from '../session.js';
import { makeDeps, NOW, SECRETS } from '../../test/deps.js';
import { fakeCtx, FakeKV, FakeStorage, recordingUpstream } from '../../test/fakes.js';
import { postJson } from '../../test/requests.js';

const { gangnam, wonju, gyeongpo } = FIXTURE_POINTS;
const token = async () => (await issueToken(SECRETS.sessionSecret, NOW)).token;

describe('POST /api/route', () => {
  it('구간 2개 → 구간별 숫자 6개 2세트, 카카오', async () => {
    const res = await handleApi(
      postJson('/api/route', { points: [gangnam, wonju, gyeongpo] }, await token()),
      makeDeps(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { provider: string; legs: Record<string, number>[] };
    expect(body.provider).toBe('kakao');
    expect(body.legs.map((l) => l.distanceM)).toEqual([97512, 131208]);
    expect(Object.keys(body.legs[0]!).sort()).toEqual(
      [
        'congestedRatio',
        'distanceM',
        'durationMin',
        'slowRoadRatio',
        'taxiFareWon',
        'tollWon',
      ].sort(),
    );
  });

  it('같은 좌표 반복은 캐시에서. 예산·외부 호출 없음. 좌표 문자열이 캐시에 남지 않는다', async () => {
    const { upstream, calls } = recordingUpstream(fixtureUpstream);
    const cacheStorage = new FakeStorage();
    const budgetStorage = new FakeStorage();
    const deps = makeDeps({
      upstream,
      routeCache: new RouteCache(fakeCtx(cacheStorage), {}),
      budget: new BudgetCounter(fakeCtx(budgetStorage), {}),
    });
    const t = await token();
    // 약 10m 안쪽 차이는 같은 키
    const first = await handleApi(postJson('/api/route', { points: [gangnam, gyeongpo] }, t), deps);
    const nudged = { lat: gangnam.lat + 0.00003, lng: gangnam.lng - 0.00002 };
    const second = await handleApi(postJson('/api/route', { points: [nudged, gyeongpo] }, t), deps);
    expect(await second.json()).toEqual(await first.json());
    expect(calls).toEqual(['apis-navi.kakaomobility.com']);
    expect((await deps.budget.stats()).counts.kakao_route).toBe(1);
    const stored = JSON.stringify([...cacheStorage.data.entries()]);
    expect(stored).not.toContain('37.4979');
    expect(stored).not.toContain('127.0276');
  });

  it.each([
    ['5xx', () => new Response('', { status: 502 })],
    ['403(앱 차단)', () => new Response('', { status: 403 })],
    ['네트워크 오류', () => Promise.reject(new TypeError('network'))],
  ])('카카오 %s → TMAP으로 조회, provider tmap', async (_name, kakaoFails) => {
    const { upstream, calls } = recordingUpstream(fixtureUpstream, {
      'apis-navi.kakaomobility.com': kakaoFails,
    });
    const deps = makeDeps({ upstream });
    const res = await handleApi(
      postJson('/api/route', { points: [gangnam, gyeongpo] }, await token()),
      deps,
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { provider: string }).provider).toBe('tmap');
    expect(calls).toEqual(['apis-navi.kakaomobility.com', 'apis.openapi.sk.com']);
    const { counts } = await deps.budget.stats();
    expect([counts.kakao_route, counts.tmap_route]).toEqual([1, 1]);
  });

  it('provider=kakao 고정이면 카카오 장애에도 TMAP으로 넘어가지 않고 503', async () => {
    const kv = new FakeKV();
    await kv.put('provider', 'kakao');
    const { upstream, calls } = recordingUpstream(fixtureUpstream, {
      'apis-navi.kakaomobility.com': () => new Response('', { status: 500 }),
    });
    const res = await handleApi(
      postJson('/api/route', { points: [gangnam, gyeongpo] }, await token()),
      makeDeps({ upstream }, kv),
    );
    expect(res.status).toBe(503);
    expect(calls).toEqual(['apis-navi.kakaomobility.com']);
  });

  it('provider=tmap 고정이면 처음부터 TMAP', async () => {
    const kv = new FakeKV();
    await kv.put('provider', 'tmap');
    const { upstream, calls } = recordingUpstream(fixtureUpstream);
    const res = await handleApi(
      postJson('/api/route', { points: [gangnam, gyeongpo] }, await token()),
      makeDeps({ upstream }, kv),
    );
    expect(((await res.json()) as { provider: string }).provider).toBe('tmap');
    expect(calls).toEqual(['apis.openapi.sk.com']);
  });

  it('카카오·TMAP 모두 한도 → 503, 외부 호출 없음', async () => {
    const budget = new BudgetCounter(fakeCtx(), {});
    const exhausted: typeof budget.reserve = async () => ({ ok: false, reason: 'budget' });
    const { upstream, calls } = recordingUpstream(fixtureUpstream);
    const res = await handleApi(
      postJson('/api/route', { points: [gangnam, gyeongpo] }, await token()),
      makeDeps({ upstream, budget: Object.assign(budget, { reserve: exhausted }) }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'auto_lookup_unavailable' });
    expect(calls).toEqual([]);
  });

  it('카카오·TMAP 둘 다 장애 → 503', async () => {
    const down = () => new Response('', { status: 503 });
    const { upstream } = recordingUpstream(fixtureUpstream, {
      'apis-navi.kakaomobility.com': down,
      'apis.openapi.sk.com': down,
    });
    const res = await handleApi(
      postJson('/api/route', { points: [gangnam, gyeongpo] }, await token()),
      makeDeps({ upstream }),
    );
    expect(res.status).toBe(503);
  });

  it('출발·도착이 같으면 422, TMAP으로 넘어가지 않는다', async () => {
    const { upstream, calls } = recordingUpstream(fixtureUpstream);
    const res = await handleApi(
      postJson('/api/route', { points: [gangnam, gangnam] }, await token()),
      makeDeps({ upstream }),
    );
    expect(res.status).toBe(422);
    expect(calls).toEqual(['apis-navi.kakaomobility.com']);
  });

  it('세션 하루 40건을 넘으면 429 session_limit', async () => {
    const deps = makeDeps({ routeCache: { get: async () => null, put: async () => {} } });
    const t = await token();
    const tenLegs = { points: Array.from({ length: 11 }, (_, i) => (i % 2 ? gyeongpo : gangnam)) };
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push((await handleApi(postJson('/api/route', tenLegs, t), deps)).status);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 429]);
  });

  it('분당 제한 바인딩이 없으면 DO가 세션 분당 5회를 센다', async () => {
    const deps = makeDeps({ routeCache: { get: async () => null, put: async () => {} } });
    const t = await token();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push(
        (await handleApi(postJson('/api/route', { points: [gangnam, gyeongpo] }, t), deps)).status,
      );
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });
});

describe('RouteCache', () => {
  it('6시간 뒤 만료, 알람이 지운다', async () => {
    const storage = new FakeStorage();
    const cache = new RouteCache(fakeCtx(storage), {});
    await cache.put('k', 'v', 1000);
    expect(await cache.get('k')).toBe('v');
    expect(storage.alarm).not.toBeNull();
    const realNow = Date.now;
    Date.now = () => realNow() + 2000;
    try {
      expect(await cache.get('k')).toBeNull();
      await cache.alarm();
      expect(storage.data.size).toBe(0);
    } finally {
      Date.now = realNow;
    }
  });
});
