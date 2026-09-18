// index.ts 연결 확인: Env 바인딩 → Deps, /api와 정적 자산 분기.
import { describe, expect, it } from 'vitest';
import worker, { BudgetCounter, RouteCache } from '../src/index.js';
import { FIXTURE_POINTS } from '../src/providers/fixtures.js';
import { fakeCtx, FakeKV } from './fakes.js';
import { get, postJson } from './requests.js';

function env(over: Record<string, unknown> = {}) {
  const budget = new BudgetCounter(fakeCtx(), {});
  const cache = new RouteCache(fakeCtx(), {});
  return {
    ASSETS: { fetch: async () => new Response('asset') },
    CTRL: new FakeKV().asKV(),
    BUDGET: { getByName: () => budget },
    ROUTE_CACHE: { getByName: () => cache },
    UPSTREAM: 'fixtures',
    TURNSTILE_SECRET: 't',
    SESSION_SECRET: 's',
    CACHE_SECRET: 'c',
    ...over,
  } as never;
}

describe('Worker 진입점', () => {
  it('fixtures 모드: 세션 발급 → 경로 조회', async () => {
    const e = env();
    const s = await worker.fetch(postJson('/api/session', { turnstileToken: 'ok' }), e);
    const { token } = (await s.json()) as { token: string };
    const r = await worker.fetch(
      postJson('/api/route', { points: [FIXTURE_POINTS.gangnam, FIXTURE_POINTS.gyeongpo] }, token),
      e,
    );
    expect(r.status).toBe(200);
    expect(((await r.json()) as { legs: unknown[] }).legs).toHaveLength(1);
  });

  it('/api 밖은 정적 자산', async () => {
    const res = await worker.fetch(get('/r'), env());
    expect(await res.text()).toBe('asset');
  });

  it('비밀 값이 없으면 503', async () => {
    const res = await worker.fetch(
      postJson('/api/session', { turnstileToken: 'ok' }),
      env({ SESSION_SECRET: undefined }),
    );
    expect(res.status).toBe(503);
  });
});
