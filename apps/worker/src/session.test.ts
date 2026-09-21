import { describe, expect, it } from 'vitest';
import { handleApi } from './app.js';
import { issueToken, TOKEN_TTL_MS, verifyToken } from './session.js';
import { makeDeps, NOW, SECRETS } from '../test/deps.js';
import { FakeLimiter, recordingUpstream } from '../test/fakes.js';
import { fixtureUpstream } from './providers/fixtures.js';
import { get, postJson } from '../test/requests.js';

describe('② 세션 토큰', () => {
  it('Turnstile 통과 → 2시간짜리 토큰', async () => {
    const res = await handleApi(postJson('/api/session', { turnstileToken: 'ok' }), makeDeps());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; expiresAt: string };
    expect(Date.parse(body.expiresAt)).toBe(NOW + TOKEN_TTL_MS);
    expect(await verifyToken(SECRETS.sessionSecret, body.token, NOW)).toMatch(
      /^[A-Za-z0-9_-]{22}$/,
    );
  });

  it('Turnstile 실패 → 401, Turnstile 장애 → 503', async () => {
    const failRes = await handleApi(
      postJson('/api/session', { turnstileToken: 'invalid' }),
      makeDeps(),
    );
    expect(failRes.status).toBe(401);
    const { upstream } = recordingUpstream(fixtureUpstream, {
      'challenges.cloudflare.com': () => new Response('', { status: 500 }),
    });
    const down = await handleApi(
      postJson('/api/session', { turnstileToken: 'ok' }),
      makeDeps({ upstream }),
    );
    expect(down.status).toBe(503);
  });

  it('Turnstile secret이 없으면 Cloudflare를 부르지 않고 401', async () => {
    const { upstream, calls } = recordingUpstream(fixtureUpstream);
    const deps = makeDeps({ upstream, secrets: { ...SECRETS, turnstileSecret: '' } });
    const res = await handleApi(postJson('/api/session', { turnstileToken: 'ok' }), deps);
    // 503(한도 도달처럼 보임)이 아니라 401이어야 앱이 "조회 대기"로 넘어간다.
    expect(res.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('세션 발급은 IP 분당 2회', async () => {
    const deps = makeDeps({ limiters: { sessionIp: new FakeLimiter(2).asRateLimit() } });
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) {
      statuses.push(
        (await handleApi(postJson('/api/session', { turnstileToken: 'ok' }), deps)).status,
      );
    }
    expect(statuses).toEqual([200, 200, 429]);
  });

  it('Turnstile 하루 상한에 닿으면 503, siteverify를 부르지 않는다', async () => {
    const { upstream, calls } = recordingUpstream(fixtureUpstream);
    const deps = makeDeps({ upstream });
    const exhausted: typeof deps.budget.reserveDaily = async () => false;
    const res = await handleApi(
      postJson('/api/session', { turnstileToken: 'ok' }),
      makeDeps({ upstream, budget: Object.assign(deps.budget, { reserveDaily: exhausted }) }),
    );
    expect(res.status).toBe(503);
    expect(calls).toEqual([]);
  });

  it('세션 발급 1번에 Turnstile 예산 1건', async () => {
    const deps = makeDeps();
    await handleApi(postJson('/api/session', { turnstileToken: 'ok' }), deps);
    await handleApi(postJson('/api/session', { turnstileToken: 'invalid' }), deps);
    expect((await deps.budget.stats()).counts.turnstile).toBe(2);
  });

  it('분당 제한에 걸리면 Turnstile을 부르지 않는다', async () => {
    const { upstream, calls } = recordingUpstream(fixtureUpstream);
    const limiter = new FakeLimiter(0).asRateLimit();
    const deps = makeDeps({ upstream, limiters: { sessionIp: limiter } });
    await handleApi(postJson('/api/session', { turnstileToken: 'ok' }), deps);
    expect(calls).toEqual([]);
  });

  describe('토큰 검증', () => {
    it('만료 → null', async () => {
      const { token } = await issueToken(SECRETS.sessionSecret, NOW);
      expect(
        await verifyToken(SECRETS.sessionSecret, token, NOW + TOKEN_TTL_MS - 1000),
      ).not.toBeNull();
      expect(await verifyToken(SECRETS.sessionSecret, token, NOW + TOKEN_TTL_MS)).toBeNull();
    });

    it('다른 비밀 값으로 서명 → null', async () => {
      const { token } = await issueToken('attacker-secret', NOW);
      expect(await verifyToken(SECRETS.sessionSecret, token, NOW)).toBeNull();
    });

    it('만료 시각을 늘리면 서명이 맞지 않는다', async () => {
      const { token } = await issueToken(SECRETS.sessionSecret, NOW);
      const [v, sid, exp, sig] = token.split('.');
      const forged = [v, sid, String(Number(exp) + 86400), sig].join('.');
      expect(await verifyToken(SECRETS.sessionSecret, forged, NOW)).toBeNull();
    });

    it.each([
      '',
      'v1',
      'v1.a.b.c',
      'v2.aaaaaaaaaaaaaaaaaaaaaa.9999999999.xx',
      'v1.aaaaaaaaaaaaaaaaaaaaaa.x.y',
    ])('형식 오류 %j → null', async (token) => {
      expect(await verifyToken(SECRETS.sessionSecret, token, NOW)).toBeNull();
    });
  });

  it('토큰 없거나 위조면 /api/route·places·fuel 모두 401', async () => {
    const deps = makeDeps();
    const route = {
      points: [
        { lat: 37.4979, lng: 127.0276 },
        { lat: 37.8055, lng: 128.9086 },
      ],
    };
    const { token } = await issueToken('attacker-secret', NOW);
    for (const t of [undefined, token]) {
      expect((await handleApi(postJson('/api/route', route, t), deps)).status).toBe(401);
      expect((await handleApi(get('/api/places?q=강릉', t), deps)).status).toBe(401);
      expect((await handleApi(get('/api/fuel/avg?sido=01&prod=B027', t), deps)).status).toBe(401);
    }
  });

  it('SESSION_SECRET이 없으면 503', async () => {
    const deps = makeDeps({ secrets: { ...SECRETS, sessionSecret: '' } });
    const res = await handleApi(postJson('/api/session', { turnstileToken: 'ok' }), deps);
    expect(res.status).toBe(503);
  });
});
