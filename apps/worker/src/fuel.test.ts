import { describe, expect, it } from 'vitest';
import opinetFixture from '../../../fixtures/opinet/avg-sido.json';
import { handleApi } from './app.js';
import { BudgetCounter } from './budget/BudgetCounter.js';
import { checkUsage, type CronDeps, refreshFuel, runCron } from './cron.js';
import { FUEL_KEY } from './fuel.js';
import { fixtureUpstream } from './providers/fixtures.js';
import { reduceOpinetAvg } from './providers/opinet.js';
import { issueToken } from './session.js';
import { makeDeps, NOW, SECRETS } from '../test/deps.js';
import { fakeCtx, FakeKV, recordingUpstream } from '../test/fakes.js';
import { get } from '../test/requests.js';

const WEBHOOK = 'https://discord.com/api/webhooks/fixture';
const token = async () => (await issueToken(SECRETS.sessionSecret, NOW)).token;

function cronDeps(over: Partial<CronDeps> = {}) {
  const kv = new FakeKV();
  const rec = recordingUpstream(fixtureUpstream);
  const deps: CronDeps = {
    upstream: rec.upstream,
    kv: kv.asKV(),
    budget: new BudgetCounter(fakeCtx(), {}),
    opinetKey: 'test-opinet-key',
    alertWebhookUrl: WEBHOOK,
    ...over,
  };
  return { deps, kv, calls: rec.calls };
}

describe('오피넷 평균가 축소', () => {
  it('시·도 17곳 × 휘발유·경유·LPG, 원 단위 정수. 고급휘발유는 버린다', () => {
    const prices = reduceOpinetAvg(opinetFixture);
    expect(Object.keys(prices)).toHaveLength(17);
    expect(prices['01']).toEqual({ B027: 1725, D047: 1585, K015: 1055 });
    expect(Object.values(prices).every((p) => Object.keys(p).length === 3)).toBe(true);
  });
});

describe('Cron 유가 갱신', () => {
  it('KST 6시: 오피넷 → KV 기록, 오피넷 예산 1건', async () => {
    const { deps, kv, calls } = cronDeps();
    const at = Date.parse('2026-09-17T21:00:00Z'); // 09-18 06:00 KST
    await runCron(deps, at);
    expect(calls).toContain('www.opinet.co.kr');
    const table = JSON.parse(kv.data.get(FUEL_KEY)!);
    expect(table.updatedAt).toBe('2026-09-17T21:00:00.000Z');
    expect(table.prices['03'].B027).toBeGreaterThan(0);
    expect((await deps.budget.stats()).counts.opinet).toBe(1);
  });

  it('KST 7시에는 유가를 갱신하지 않는다', async () => {
    const { deps, calls } = cronDeps();
    await runCron(deps, Date.parse('2026-09-17T22:00:00Z'));
    expect(calls).not.toContain('www.opinet.co.kr');
  });

  it('오피넷 실패 → 기존 값 유지', async () => {
    const { upstream } = recordingUpstream(fixtureUpstream, {
      'www.opinet.co.kr': () => new Response('', { status: 500 }),
    });
    const { deps, kv } = cronDeps({ upstream });
    await kv.put(FUEL_KEY, '{"updatedAt":"old","prices":{}}');
    await refreshFuel(deps, NOW);
    expect(kv.data.get(FUEL_KEY)).toBe('{"updatedAt":"old","prices":{}}');
  });

  it('오피넷 하루 50건 상한', async () => {
    const { deps, calls } = cronDeps();
    for (let i = 0; i < 51; i++) await refreshFuel(deps, NOW);
    expect(calls.filter((h) => h === 'www.opinet.co.kr')).toHaveLength(50);
  });
});

describe('GET /api/fuel/avg', () => {
  it('KV에서 읽기만, 외부 호출 없음', async () => {
    const kv = new FakeKV();
    await kv.put(
      FUEL_KEY,
      JSON.stringify({ updatedAt: '2026-09-18T00:00:00.000Z', prices: { '03': { B027: 1701 } } }),
    );
    const { upstream, calls } = recordingUpstream(fixtureUpstream);
    const res = await handleApi(
      get('/api/fuel/avg?sido=03&prod=B027', await token()),
      makeDeps({ upstream }, kv),
    );
    expect(await res.json()).toEqual({ priceWon: 1701, updatedAt: '2026-09-18T00:00:00.000Z' });
    expect(calls).toEqual([]);
  });

  it('값이 없으면 503(앱은 기본값 단가)', async () => {
    const res = await handleApi(get('/api/fuel/avg?sido=03&prod=B027', await token()), makeDeps());
    expect(res.status).toBe(503);
  });

  it('KV는 10분 메모리 캐시', async () => {
    const kv = new FakeKV();
    await kv.put(FUEL_KEY, JSON.stringify({ updatedAt: 'x', prices: { '01': { D047: 1500 } } }));
    const deps = makeDeps({}, kv);
    const t = await token();
    const before = kv.reads;
    await handleApi(get('/api/fuel/avg?sido=01&prod=D047', t), deps);
    await handleApi(get('/api/fuel/avg?sido=01&prod=D047', t), deps);
    // 차단 목록 1번 + 유가 1번
    expect(kv.reads - before).toBe(2);
  });
});

describe('Cron 사용률 알림', () => {
  async function withUsage(kakaoRoute: number, sessionsCapped = 0) {
    const budget = new BudgetCounter(fakeCtx(), {});
    const stats = await budget.stats();
    const fake = Object.assign(budget, {
      stats: async () => ({
        ...stats,
        counts: { ...stats.counts, kakao_route: kakaoRoute },
        sessionsCapped,
        alerted: (await BudgetCounter.prototype.stats.call(budget)).alerted,
      }),
    });
    return fake;
  }

  it('50% → 알림 1번, 같은 단계는 다시 보내지 않는다', async () => {
    const bodies: string[] = [];
    const { upstream } = recordingUpstream(fixtureUpstream, {
      'discord.com': async (r) => {
        bodies.push(await r.text());
        return new Response(null, { status: 204 });
      },
    });
    const budget = await withUsage(4_500);
    const { deps } = cronDeps({ upstream, budget });
    await checkUsage(deps);
    await checkUsage(deps);
    expect(bodies).toHaveLength(1);
    expect(JSON.parse(bodies[0]!).content).toContain('카카오 경로 4,500/9,000 (50%)');
  });

  it('80%, 95%는 각각 한 번씩 더', async () => {
    const bodies: string[] = [];
    const { upstream } = recordingUpstream(fixtureUpstream, {
      'discord.com': async (r) => {
        bodies.push(await r.text());
        return new Response(null, { status: 204 });
      },
    });
    const budget = new BudgetCounter(fakeCtx(), {});
    let count = 4_500;
    const real = budget.stats.bind(budget);
    budget.stats = async () => {
      const s = await real();
      return { ...s, counts: { ...s.counts, kakao_route: count } };
    };
    const { deps } = cronDeps({ upstream, budget });
    for (const c of [4_500, 7_300, 7_400, 8_600, 9_000]) {
      count = c;
      await checkUsage(deps);
    }
    expect(bodies.map((b) => /\((\d+)%\)/.exec(JSON.parse(b).content)?.[1])).toEqual([
      '50',
      '81',
      '95',
    ]);
  });

  it('한도에 닿은 세션 11개 → 공격 의심 알림. 본문에 숫자만', async () => {
    const bodies: string[] = [];
    const { upstream } = recordingUpstream(fixtureUpstream, {
      'discord.com': async (r) => {
        bodies.push(await r.text());
        return new Response(null, { status: 204 });
      },
    });
    const budget = await withUsage(0, 11);
    const { deps } = cronDeps({ upstream, budget });
    await checkUsage(deps);
    const content = JSON.parse(bodies[0]!).content as string;
    expect(content).toContain('공격 의심: 세션 하루 한도에 닿은 세션 11개');
    expect(content).not.toMatch(/\d+\.\d{3,}/); // 좌표 같은 소수 없음
  });

  it('웹훅 URL이 없으면 보내지 않는다', async () => {
    const budget = await withUsage(9_000);
    const { deps, calls } = cronDeps({ budget, alertWebhookUrl: '' });
    await checkUsage(deps);
    expect(calls).toEqual([]);
  });
});
