import { describe, expect, it } from 'vitest';
import kakaoPlacesFixture from '../../../../fixtures/kakao/places-gangneung.json';
import tmapPoisFixture from '../../../../fixtures/tmap/pois-gangneung.json';
import { handleApi } from '../app.js';
import { fixtureUpstream } from '../providers/fixtures.js';
import { reduceKakaoPlaces } from '../providers/kakao.js';
import { reduceTmapPlaces } from '../providers/tmap.js';
import { issueToken } from '../session.js';
import { makeDeps, NOW, SECRETS } from '../../test/deps.js';
import { FakeKV, recordingUpstream } from '../../test/fakes.js';
import { get } from '../../test/requests.js';

const token = async () => (await issueToken(SECRETS.sessionSecret, NOW)).token;

describe('장소 검색 축소', () => {
  it('카카오: 상위 5개, 이름·주소(도로명 우선)·좌표만', () => {
    const places = reduceKakaoPlaces(kakaoPlacesFixture);
    expect(places).toHaveLength(5);
    expect(places[0]).toEqual({
      name: '경포해변',
      address: '강원특별자치도 강릉시 창해로 514',
      lat: 37.805521,
      lng: 128.908588,
    });
    // 도로명 주소가 없으면 지번
    expect(places[1]!.address).toBe('강원특별자치도 강릉시 운정동 1');
    expect(JSON.stringify(places)).not.toMatch(/033-|phone|category|place_url/);
  });

  it('TMAP: 상위 5개, 도로명 없으면 지번 조합', () => {
    const places = reduceTmapPlaces(tmapPoisFixture);
    expect(places).toHaveLength(5);
    expect(places[0]).toEqual({
      name: '경포해변',
      address: '강원특별자치도 강릉시 창해로 514',
      lat: 37.80552,
      lng: 128.90859,
    });
    expect(places[1]!.address).toBe('강원 강릉시 운정동 1');
    expect(JSON.stringify(places)).not.toMatch(/0330000000|telNo|Biz/);
  });

  it('결과 없음(null·빈 목록)은 빈 배열', () => {
    expect(reduceKakaoPlaces(null)).toEqual([]);
    expect(reduceTmapPlaces(null)).toEqual([]);
  });
});

describe('GET /api/places', () => {
  it('카카오로 5개', async () => {
    const { upstream, calls } = recordingUpstream(fixtureUpstream);
    const res = await handleApi(get('/api/places?q=강릉', await token()), makeDeps({ upstream }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { provider: string; places: unknown[] };
    expect(body.provider).toBe('kakao');
    expect(body.places).toHaveLength(5);
    expect(calls).toEqual(['dapi.kakao.com']);
  });

  it('카카오 장애 → TMAP POI', async () => {
    const { upstream, calls } = recordingUpstream(fixtureUpstream, {
      'dapi.kakao.com': () => new Response('', { status: 429 }),
    });
    const deps = makeDeps({ upstream });
    const res = await handleApi(get('/api/places?q=강릉', await token()), deps);
    expect(((await res.json()) as { provider: string }).provider).toBe('tmap');
    expect(calls).toEqual(['dapi.kakao.com', 'apis.openapi.sk.com']);
    const { counts } = await deps.budget.stats();
    expect([counts.kakao_places, counts.tmap_places]).toEqual([1, 1]);
  });

  it('TMAP POI 204(결과 없음) → 빈 목록', async () => {
    const kv = new FakeKV();
    await kv.put('provider', 'tmap');
    const { upstream } = recordingUpstream(fixtureUpstream, {
      'apis.openapi.sk.com': () => new Response(null, { status: 204 }),
    });
    const res = await handleApi(
      get('/api/places?q=없는곳', await token()),
      makeDeps({ upstream }, kv),
    );
    expect(await res.json()).toEqual({ provider: 'tmap', places: [] });
  });

  it('검색어는 캐시하지 않는다(같은 검색어도 매번 예산 차감)', async () => {
    const deps = makeDeps();
    const t = await token();
    await handleApi(get('/api/places?q=강릉', t), deps);
    await handleApi(get('/api/places?q=강릉', t), deps);
    expect((await deps.budget.stats()).counts.kakao_places).toBe(2);
  });

  it('세션 하루 300건 → 429', async () => {
    const deps = makeDeps({
      limiters: { placesSession: { limit: async () => ({ success: true }) } },
    });
    const t = await token();
    let last = 0;
    for (let i = 0; i < 301; i++)
      last = (await handleApi(get('/api/places?q=강릉', t), deps)).status;
    expect(last).toBe(429);
  });
});
