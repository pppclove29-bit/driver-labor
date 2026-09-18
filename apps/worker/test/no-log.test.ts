// 로그에 요청 본문·좌표·검색어가 없어야 한다 (CLAUDE.md 절대 규칙 7, M3 완료 기준).
// 정상·거절·장애 경로를 모두 돌리며 console 출력을 가로챈다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApi } from '../src/app.js';
import { BudgetCounter } from '../src/budget/BudgetCounter.js';
import { checkUsage, refreshFuel } from '../src/cron.js';
import { FIXTURE_POINTS, fixtureUpstream } from '../src/providers/fixtures.js';
import { issueToken } from '../src/session.js';
import { makeDeps, NOW, SECRETS } from './deps.js';
import { fakeCtx, FakeKV, recordingUpstream } from './fakes.js';
import { get, postJson, TEST_IP } from './requests.js';

const SENSITIVE = [
  '37.4979',
  '127.0276',
  '37.8055',
  '128.9086',
  '37.328',
  '127.811',
  '경포',
  '강릉',
  '%EA%B0%95', // "강" URL 인코딩
  TEST_IP,
  'turnstileToken',
  'points',
  SECRETS.sessionSecret,
  SECRETS.kakaoKey,
  'test-opinet-key',
];

let output: string[];

beforeEach(() => {
  output = [];
  for (const m of ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const) {
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      output.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('로그에 요청 본문·좌표·검색어가 없다', () => {
  it('정상·거절·장애 시나리오 전체', async () => {
    const { gangnam, gyeongpo } = FIXTURE_POINTS;
    const { token } = await issueToken(SECRETS.sessionSecret, NOW);
    const route = { points: [gangnam, gyeongpo] };
    const down = () => new Response('', { status: 500 });

    // 정상
    await handleApi(postJson('/api/session', { turnstileToken: 'ok' }), makeDeps());
    await handleApi(postJson('/api/route', route, token), makeDeps());
    await handleApi(get('/api/places?q=강릉 경포', token), makeDeps());
    await handleApi(get('/api/fuel/avg?sido=03&prod=B027', token), makeDeps());
    // 거절
    await handleApi(
      postJson('/api/route', { points: [gangnam, { lat: 35.68, lng: 139.76 }] }),
      makeDeps(),
    );
    await handleApi(postJson('/api/route', route, 'v1.bad.token.x'), makeDeps());
    await handleApi(postJson('/api/session', { turnstileToken: 'invalid' }), makeDeps());
    // 장애: 카카오 → TMAP, 둘 다 장애
    const kakaoDown = recordingUpstream(fixtureUpstream, {
      'apis-navi.kakaomobility.com': down,
      'dapi.kakao.com': down,
    });
    await handleApi(
      postJson('/api/route', route, token),
      makeDeps({ upstream: kakaoDown.upstream }),
    );
    await handleApi(get('/api/places?q=강릉', token), makeDeps({ upstream: kakaoDown.upstream }));
    const allDown = recordingUpstream(fixtureUpstream, {
      'apis-navi.kakaomobility.com': down,
      'apis.openapi.sk.com': down,
      'dapi.kakao.com': down,
    });
    await handleApi(postJson('/api/route', route, token), makeDeps({ upstream: allDown.upstream }));
    await handleApi(get('/api/places?q=강릉', token), makeDeps({ upstream: allDown.upstream }));
    // 설정 누락
    await handleApi(
      get('/api/places?q=강릉', token),
      makeDeps({ secrets: { ...SECRETS, sessionSecret: '' } }),
    );
    // Cron: 오피넷 장애, 웹훅 장애
    const cronDown = recordingUpstream(fixtureUpstream, {
      'www.opinet.co.kr': down,
      'discord.com': down,
    });
    const budget = new BudgetCounter(fakeCtx(), {});
    const cron = {
      upstream: cronDown.upstream,
      kv: new FakeKV().asKV(),
      budget,
      opinetKey: 'test-opinet-key',
      alertWebhookUrl: 'https://discord.com/api/webhooks/fixture',
    };
    await refreshFuel(cron, NOW);
    for (let i = 0; i < 5; i++) await budget.reserveDaily('opinet');
    await checkUsage({
      ...cron,
      budget: Object.assign(budget, {
        stats: async () => ({
          ...(await BudgetCounter.prototype.stats.call(budget)),
          sessionsCapped: 20,
        }),
      }),
    });

    // 오류 로그는 실제로 남았고(검사가 헛돌지 않음), 민감한 값은 없다.
    expect(output.length).toBeGreaterThan(3);
    const all = output.join('\n');
    for (const s of SENSITIVE) expect(all).not.toContain(s);
  });
});
