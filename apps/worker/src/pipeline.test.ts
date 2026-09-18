import { describe, expect, it } from 'vitest';
import { handleApi } from './app.js';
import { Control } from './control.js';
import { ipHash } from './ratelimit.js';
import { issueToken, verifyToken } from './session.js';
import { makeDeps, NOW, SECRETS } from '../test/deps.js';
import { FakeKV, FakeLimiter, recordingUpstream } from '../test/fakes.js';
import { fixtureUpstream } from './providers/fixtures.js';
import { get, postJson, TEST_IP } from '../test/requests.js';

const route = {
  points: [
    { lat: 37.4979, lng: 127.0276 },
    { lat: 37.8055, lng: 128.9086 },
  ],
};

async function session() {
  const { token } = await issueToken(SECRETS.sessionSecret, NOW);
  const sid = (await verifyToken(SECRETS.sessionSecret, token, NOW))!;
  return { token, sid };
}

describe('③ 차단 목록·비상 스위치', () => {
  it('차단된 세션 → 403, 외부 호출 없음', async () => {
    const { token, sid } = await session();
    const kv = new FakeKV();
    await kv.put('block:2026-09-18', JSON.stringify({ sessions: [sid], ipHashes: [] }));
    const { upstream, calls } = recordingUpstream(fixtureUpstream);
    const deps = makeDeps({ upstream }, kv);
    expect((await handleApi(postJson('/api/route', route, token), deps)).status).toBe(403);
    expect((await handleApi(get('/api/places?q=강릉', token), deps)).status).toBe(403);
    expect((await handleApi(get('/api/fuel/avg?sido=01&prod=B027', token), deps)).status).toBe(403);
    expect(calls).toEqual([]);
  });

  it('그날 솔트로 해시한 IP로 차단한다. 다른 날에는 풀린다', async () => {
    const { token } = await session();
    const hash = await ipHash(SECRETS.sessionSecret, TEST_IP, NOW);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    const kv = new FakeKV();
    await kv.put('block:2026-09-18', JSON.stringify({ sessions: [], ipHashes: [hash] }));
    expect((await handleApi(get('/api/places?q=강릉', token), makeDeps({}, kv))).status).toBe(403);
    expect(
      (await handleApi(postJson('/api/session', { turnstileToken: 'ok' }), makeDeps({}, kv)))
        .status,
    ).toBe(403);
    expect(await ipHash(SECRETS.sessionSecret, TEST_IP, NOW + 86_400_000)).not.toBe(hash);
  });

  it('auto_route·auto_places off → 503, 외부 호출 없음', async () => {
    const { token } = await session();
    const kv = new FakeKV();
    await kv.put('auto_route', 'off');
    await kv.put('auto_places', 'off');
    const { upstream, calls } = recordingUpstream(fixtureUpstream);
    const deps = makeDeps({ upstream }, kv);
    const r = await handleApi(postJson('/api/route', route, token), deps);
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: 'auto_lookup_unavailable' });
    expect((await handleApi(get('/api/places?q=강릉', token), deps)).status).toBe(503);
    expect(calls).toEqual([]);
  });

  it('KV 값은 60초 동안 메모리에서 읽는다', async () => {
    const kv = new FakeKV();
    let t = NOW;
    const control = new Control(kv.asKV(), () => t);
    expect(await control.autoRoute()).toBe(true);
    await kv.put('auto_route', 'off');
    expect(await control.autoRoute()).toBe(true);
    t += 60_001;
    expect(await control.autoRoute()).toBe(false);
    expect(kv.reads).toBe(2);
  });

  it('provider 스위치: 모르는 값은 auto', async () => {
    const kv = new FakeKV();
    await kv.put('provider', 'naver');
    expect(await new Control(kv.asKV(), () => NOW).provider()).toBe('auto');
    await kv.put('provider', 'tmap');
    expect(await new Control(kv.asKV(), () => NOW).provider()).toBe('tmap');
  });
});

describe('④ 분당 제한', () => {
  it('경로 세션 분당 5회 → 6번째 429', async () => {
    const { token } = await session();
    const deps = makeDeps({ limiters: { routeSession: new FakeLimiter(5).asRateLimit() } });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await handleApi(postJson('/api/route', route, token), deps)).status);
    }
    expect(statuses.slice(0, 5)).not.toContain(429);
    expect(statuses[5]).toBe(429);
  });

  it('IP 한도는 세션이 달라도 같이 센다', async () => {
    const ipLimiter = new FakeLimiter(1).asRateLimit();
    const deps = makeDeps({ limiters: { placesIp: ipLimiter } });
    const a = await session();
    const b = await session();
    expect((await handleApi(get('/api/places?q=강릉', a.token), deps)).status).not.toBe(429);
    expect((await handleApi(get('/api/places?q=강릉', b.token), deps)).status).toBe(429);
  });
});
