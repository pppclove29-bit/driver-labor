import { describe, expect, it } from 'vitest';

import type { ApiClient, PlaceRef, RouteResponse } from '../api/client.js';
import {
  applyFuel,
  applyTripRoute,
  boundaryKey,
  fetchSegmentRoutes,
  fetchTripLookups,
  segmentRoutePoints,
  sidoFromAddress,
} from './lookup.js';
import { newTrip, toTripInput, withEstimatedRoute } from './trip.js';
import type { AppTrip } from './trip.js';

const gangnam: PlaceRef = {
  name: '강남역',
  address: '서울 강남구 강남대로 396',
  lat: 37.4979,
  lng: 127.0276,
};
const wonju: PlaceRef = {
  name: '문막휴게소',
  address: '강원특별자치도 원주시 문막읍',
  lat: 37.328,
  lng: 127.811,
};
const gyeongpo: PlaceRef = {
  name: '경포해변',
  address: '강원특별자치도 강릉시 창해로 514',
  lat: 37.8055,
  lng: 128.9086,
};

const leg = (distanceM: number, provider: 'kakao' | 'tmap' = 'kakao'): RouteResponse => ({
  provider,
  legs: [
    {
      distanceM,
      durationMin: 173,
      tollWon: 12400,
      taxiFareWon: 231500,
      congestedRatio: 0.02,
      slowRoadRatio: 0.04,
    },
  ],
});

function trip(): AppTrip {
  const t = newTrip({
    id: 't1',
    now: '2026-09-18T09:00:00+09:00',
    origin: '강남역',
    destination: '경포해변',
    originPlace: gangnam,
    destinationPlace: gyeongpo,
    driverName: '나',
    companionNames: ['수빈'],
  });
  t.events.push({ type: 'arrive', at: '2026-09-18T12:00:00+09:00' });
  return t;
}

describe('시·도 판단 (주소 → 오피넷 코드)', () => {
  it.each([
    ['서울 강남구 강남대로 396', '01'],
    ['강원특별자치도 강릉시 창해로 514', '03'],
    ['전북특별자치도 전주시', '06'],
    ['경상남도 창원시', '09'],
    ['세종특별자치시 한누리대로', '19'],
  ])('%s → %s', (address, code) => {
    expect(sidoFromAddress(address)?.code).toBe(code);
  });

  it('모르는 주소 → null', () => {
    expect(sidoFromAddress('집')).toBeNull();
  });
});

describe('경로 조회 반영', () => {
  it('성공: 경로값·출처·저속 도로 비율을 넣는다. 어림값으로 덮어쓰지 않는다', () => {
    const next = applyTripRoute(trip(), { ok: true, value: leg(228214) });
    expect(next.route).toEqual({
      distanceM: 228214,
      expectedMinutes: 173,
      tollWon: 12400,
      taxiFareWon: 231500,
    });
    expect(next.routeSource).toBe('kakao');
    expect(next.routeLookup).toBe('done');
    expect(toTripInput(next).slowRoadRatio).toBe(0.04);
    expect(withEstimatedRoute(next).route.distanceM).toBe(228214);
  });

  it('503(limit): 경로값은 그대로(기본값), 상태 limit → 수동 입력 안내', () => {
    const before = trip();
    const next = applyTripRoute(before, { ok: false, reason: 'limit' });
    expect(next.route).toEqual(before.route);
    expect(next.routeLookup).toBe('limit');
    expect(next.routeSource).toBeUndefined();
    // 도착하면 기존처럼 운전 시간 어림값으로 채운다
    expect(withEstimatedRoute(next).route.distanceM).not.toBe(before.route.distanceM);
  });

  it('오프라인(waiting) → pending(연결되면 다시 조회)', () => {
    expect(applyTripRoute(trip(), { ok: false, reason: 'waiting' }).routeLookup).toBe('pending');
  });

  it('직접 고친 거리·통행료는 덮어쓰지 않는다', () => {
    const edited = { ...trip(), editedFields: ['distance', 'toll'] };
    edited.route = { ...edited.route, distanceM: 250000, tollWon: 15000 };
    const next = applyTripRoute(edited, { ok: true, value: leg(228214) });
    expect(next.route.distanceM).toBe(250000);
    expect(next.route.tollWon).toBe(15000);
    expect(next.route.taxiFareWon).toBe(231500);
  });

  it('유가: 성공이면 단가·기준 시각·시·도, 실패면 그대로', () => {
    const ok = applyFuel(
      trip(),
      { ok: true, value: { priceWon: 1725, updatedAt: '2026-09-18T00:00:00Z' } },
      '서울',
    );
    expect(toTripInput(ok).priceSnapshot).toEqual({
      at: '2026-09-18T00:00:00Z',
      unitPriceWon: 1725,
      fuelType: '휘발유',
      region: '서울',
    });
    expect(applyFuel(trip(), { ok: false, reason: 'limit' }, '서울').fuelUnitPriceWon).toBe(1700);
  });
});

function fakeApi(responses: RouteResponse[]): ApiClient & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  return {
    calls,
    route: async (points) => {
      calls.push(['route', points]);
      const r = responses.shift();
      return r ? { ok: true, value: r } : { ok: false, reason: 'limit' };
    },
    places: async () => ({ ok: false, reason: 'limit' }),
    fuelAvg: async (sido, prod) => {
      calls.push(['fuel', sido, prod]);
      return { ok: true, value: { priceWon: 1725, updatedAt: 'x' } };
    },
  };
}

describe('출발 직후 조회', () => {
  it('경로 1회(좌표 2개) + 출발지 시·도 유가 1회', async () => {
    const api = fakeApi([leg(228214)]);
    const patch = await fetchTripLookups(api, trip());
    const next = patch(trip());
    expect(api.calls).toEqual([
      ['route', [gangnam, gyeongpo]],
      ['fuel', '01', 'B027'],
    ]);
    expect(next.route.distanceM).toBe(228214);
    expect(next.fuelUnitPriceWon).toBe(1725);
  });

  it('장소를 안 골랐으면 조회하지 않는다(기본값·어림값)', async () => {
    const api = fakeApi([]);
    const t = { ...trip() };
    delete t.destinationPlace;
    delete t.originPlace;
    const next = (await fetchTripLookups(api, t))(t);
    expect(api.calls).toEqual([]);
    expect(next.route).toEqual(t.route);
  });
});

describe('하차 장소 구간 재조회', () => {
  const withDropoff = (): AppTrip => {
    const t = trip();
    t.events.push({ type: 'dropoff', at: '2026-09-18T10:20:00+09:00', memberId: 'm1' });
    return t;
  };

  it('경계 장소가 없으면 재조회하지 않는다(운전 시간 비율)', () => {
    expect(segmentRoutePoints(withDropoff())).toBeNull();
  });

  it('모든 경계에 장소가 있으면 출발 → 경계 → 도착으로 구간별 조회', async () => {
    const t = withDropoff();
    t.boundaryPlaces = { [boundaryKey('2026-09-18T10:20:00+09:00')]: wonju };
    t.routeSource = 'kakao';
    expect(segmentRoutePoints(t)).toEqual([gangnam, wonju, gyeongpo]);
    const api = fakeApi([
      {
        provider: 'kakao',
        legs: [
          {
            distanceM: 97512,
            durationMin: 77,
            tollWon: 4900,
            taxiFareWon: 102300,
            congestedRatio: 0.04,
            slowRoadRatio: 0.03,
          },
          {
            distanceM: 131208,
            durationMin: 95,
            tollWon: 7500,
            taxiFareWon: 132800,
            congestedRatio: 0,
            slowRoadRatio: 0.07,
          },
        ],
      },
    ]);
    const next = (await fetchSegmentRoutes(api, t))(t);
    expect(next.segmentRoutes?.map((r) => r.distanceM)).toEqual([97512, 131208]);
    expect(api.calls).toHaveLength(1);
  });

  it('재조회 제공자가 여행 경로와 다르면 여행 경로도 다시 조회한다', async () => {
    const t = withDropoff();
    t.boundaryPlaces = { [boundaryKey('2026-09-18T10:20:00+09:00')]: wonju };
    t.routeSource = 'kakao';
    const tmapLegs: RouteResponse = {
      provider: 'tmap',
      legs: [...leg(97000).legs, ...leg(132000).legs],
    };
    const api = fakeApi([tmapLegs, leg(229880, 'tmap')]);
    const next = (await fetchSegmentRoutes(api, t))(t);
    expect(api.calls).toHaveLength(2);
    expect(next.routeSource).toBe('tmap');
    expect(next.route.distanceM).toBe(229880);
  });

  it('재조회 실패(한도)면 재조회 값을 지우고 비율 배분으로', async () => {
    const t = withDropoff();
    t.boundaryPlaces = { [boundaryKey('2026-09-18T10:20:00+09:00')]: wonju };
    t.segmentRoutes = [
      { distanceM: 1, expectedMinutes: 1, tollWon: 0, taxiFareWon: 0 },
      { distanceM: 1, expectedMinutes: 1, tollWon: 0, taxiFareWon: 0 },
    ];
    const next = (await fetchSegmentRoutes(fakeApi([]), t))(t);
    expect(next.segmentRoutes).toBeUndefined();
  });
});
