// 카카오모빌리티 자동차 길찾기(주력). 무료 일 10,000건, 하드 상한 9,000건.
import type { Upstream } from '../upstream.js';
import type { Point } from '../validate.js';
import { fetchJson, num } from './http.js';
import {
  ProviderError,
  ratio,
  type RouteAdapter,
  type RouteLeg,
  secondsToMinutes,
  SLOW_ROAD_KMH,
} from './types.js';

/**
 * 카카오 traffic_state: 0 정보 없음, 1 정체, 2 지체, 3 서행, 4 원활, 6 사고.
 * 정체·지체(1·2)만 정체 비율로 센다 (decisions.md. 카카오 문서로 최종 확인 필요).
 */
export const KAKAO_CONGESTED = [1, 2];
export const KAKAO_SMOOTH = 4;

interface KakaoRoad {
  distance?: unknown;
  traffic_speed?: unknown;
  traffic_state?: unknown;
}

interface KakaoDirections {
  routes?: {
    result_code?: unknown;
    summary?: { distance?: unknown; duration?: unknown; fare?: { taxi?: unknown; toll?: unknown } };
    sections?: { roads?: KakaoRoad[] }[];
  }[];
}

const xy = (p: Point) => `${p.lng},${p.lat}`;

export function reduceKakaoDirections(body: unknown): RouteLeg {
  const route = (body as KakaoDirections).routes?.[0];
  if (!route || num(route.result_code) !== 0 || route.result_code === undefined || !route.summary) {
    throw new ProviderError('no_result');
  }
  const roads = (route.sections ?? []).flatMap((s) => s.roads ?? []);
  let total = 0;
  let congested = 0;
  let slow = 0;
  for (const r of roads) {
    const d = num(r.distance);
    const state = num(r.traffic_state);
    total += d;
    if (KAKAO_CONGESTED.includes(state)) congested += d;
    else if (state === KAKAO_SMOOTH && num(r.traffic_speed) < SLOW_ROAD_KMH) slow += d;
  }
  const { summary } = route;
  return {
    distanceM: Math.round(num(summary.distance)),
    durationMin: secondsToMinutes(num(summary.duration)),
    tollWon: Math.round(num(summary.fare?.toll)),
    taxiFareWon: Math.round(num(summary.fare?.taxi)),
    congestedRatio: ratio(congested, total),
    slowRoadRatio: ratio(slow, total),
  };
}

export function kakaoRoute(upstream: Upstream, key: string): RouteAdapter {
  return async (from, to) => {
    const url = new URL('https://apis-navi.kakaomobility.com/v1/directions');
    url.searchParams.set('origin', xy(from));
    url.searchParams.set('destination', xy(to));
    url.searchParams.set('priority', 'RECOMMEND');
    url.searchParams.set('summary', 'false');
    const body = await fetchJson(
      upstream,
      new Request(url, { headers: { authorization: `KakaoAK ${key}` } }),
    );
    return reduceKakaoDirections(body);
  };
}
