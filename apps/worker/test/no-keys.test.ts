// 키 없이 배포했을 때(개인정보처리방침 URL을 먼저 띄우는 단계)의 동작.
// 외부 API 키가 없으면 조회는 실패하고 앱은 수동 입력으로 넘어가야 한다.
// 어떤 경우에도 오류로 죽거나 비밀 값을 로그에 남기면 안 된다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApi } from '../src/app.js';
import { BudgetCounter } from '../src/budget/BudgetCounter.js';
import { refreshFuel } from '../src/cron.js';
import { issueToken } from '../src/session.js';
import type { Upstream } from '../src/upstream.js';
import { makeDeps, NOW, SECRETS } from './deps.js';
import { fakeCtx, FakeKV } from './fakes.js';
import { get, postJson } from './requests.js';

/** 키가 비어 있을 때 각 제공자가 실제로 주는 응답에 가깝게. */
const noKeyUpstream: Upstream = async (request) => {
  const { hostname } = new URL(request.url);
  if (hostname === 'challenges.cloudflare.com') {
    // Turnstile secret이 없으면 검증이 실패한다.
    return new Response(
      JSON.stringify({ success: false, 'error-codes': ['invalid-input-secret'] }),
      {
        headers: { 'content-type': 'application/json' },
      },
    );
  }
  if (hostname === 'www.opinet.co.kr') {
    // 키가 없으면 JSON이 아닌 오류 문서가 온다.
    return new Response('<html>ERROR</html>', { headers: { 'content-type': 'text/html' } });
  }
  // 카카오·TMAP은 키가 없으면 401.
  return new Response(JSON.stringify({ msg: 'unauthorized' }), { status: 401 });
};

/** 배포 때 반드시 넣는 두 가지만 있고 외부 API 키는 없는 상태. */
const keylessSecrets = {
  turnstileSecret: '',
  sessionSecret: SECRETS.sessionSecret,
  cacheSecret: SECRETS.cacheSecret,
  kakaoKey: '',
  tmapKey: '',
} as const;

const route = {
  points: [
    { lat: 37.4979, lng: 127.0276 },
    { lat: 37.8055, lng: 128.9086 },
  ],
};

let output: string[];

beforeEach(() => {
  output = [];
  for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      output.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('외부 API 키 없이 배포했을 때', () => {
  const deps = () => makeDeps({ secrets: keylessSecrets, upstream: noKeyUpstream });

  it('세션 발급은 401. 앱은 조회 대기로 넘어간다', async () => {
    const res = await handleApi(postJson('/api/session', { turnstileToken: 'x' }), deps());
    expect(res.status).toBe(401);
  });

  it('토큰이 있어도 경로·장소는 503(수동 입력 전환)', async () => {
    const d = deps();
    const { token } = await issueToken(SECRETS.sessionSecret, NOW);
    const r = await handleApi(postJson('/api/route', route, token), d);
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: 'auto_lookup_unavailable' });
    const p = await handleApi(get('/api/places?q=강릉', token), d);
    expect(p.status).toBe(503);
  });

  it('유가는 KV가 비어 있어 503', async () => {
    const { token } = await issueToken(SECRETS.sessionSecret, NOW);
    const res = await handleApi(get('/api/fuel/avg?sido=03&prod=B027', token), deps());
    expect(res.status).toBe(503);
  });

  it('Cron 유가 갱신이 실패해도 죽지 않고 KV를 건드리지 않는다', async () => {
    const kv = new FakeKV();
    await refreshFuel(
      {
        upstream: noKeyUpstream,
        kv: kv.asKV(),
        budget: new BudgetCounter(fakeCtx(), {}),
        opinetKey: '',
        alertWebhookUrl: '',
      },
      NOW,
    );
    expect(kv.data.size).toBe(0);
  });

  it('로그에 비밀 값·좌표·검색어가 없다', async () => {
    const d = deps();
    const { token } = await issueToken(SECRETS.sessionSecret, NOW);
    await handleApi(postJson('/api/route', route, token), d);
    await handleApi(get('/api/places?q=강릉', token), d);
    await handleApi(postJson('/api/session', { turnstileToken: 'x' }), d);
    const all = output.join('\n');
    expect(all).not.toContain(SECRETS.sessionSecret);
    expect(all).not.toContain(SECRETS.cacheSecret);
    expect(all).not.toContain('37.4979');
    expect(all).not.toContain('강릉');
    // 오류 코드는 남는다(무슨 일이 났는지 볼 수 있어야 한다).
    expect(all).toContain('upstream_unavailable');
  });

  it('정적 자산 요청은 키와 무관하다', async () => {
    const res = await handleApi(get('/api/nope'), deps());
    expect(res.status).toBe(404);
  });
});
