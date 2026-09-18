// TMAP 자동차 경로안내(예비). Free 요금제 일 1,000건, 하드 상한 900건.
// 카카오 상한 도달·장애·provider=tmap 고정일 때만 쓴다.
import type { Upstream } from '../upstream.js';
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
 * TMAP traffic 혼잡도: 0 정보 없음, 1 원활, 2 서행, 3 지체, 4 정체.
 * 지체·정체(3·4)만 정체 비율로 센다 (카카오 1·2와 같은 뜻).
 */
export const TMAP_CONGESTED = [3, 4];
export const TMAP_SMOOTH = 1;

interface TmapFeature {
  geometry?: { type?: unknown; coordinates?: unknown[]; traffic?: unknown[][] };
  properties?: {
    totalDistance?: unknown;
    totalTime?: unknown;
    totalFare?: unknown;
    taxiFare?: unknown;
    distance?: unknown;
  };
}

export function reduceTmapRoute(body: unknown): RouteLeg {
  const features = (body as { features?: TmapFeature[] }).features;
  const summary = features?.[0]?.properties;
  if (!features || !summary || summary.totalDistance === undefined) {
    throw new ProviderError('no_result');
  }
  let total = 0;
  let congested = 0;
  let slow = 0;
  for (const f of features) {
    if (f.geometry?.type !== 'LineString') continue;
    const d = num(f.properties?.distance);
    total += d;
    // traffic: [시작 좌표 번호, 끝 좌표 번호, 혼잡도, 속도]. 좌표 구간 수 비율로 거리를 나눈다.
    const spans = Math.max(1, (f.geometry.coordinates?.length ?? 2) - 1);
    for (const t of f.geometry.traffic ?? []) {
      const part = (d * Math.max(0, num(t[1]) - num(t[0]))) / spans;
      const code = num(t[2]);
      if (TMAP_CONGESTED.includes(code)) congested += part;
      else if (code === TMAP_SMOOTH && num(t[3]) < SLOW_ROAD_KMH) slow += part;
    }
  }
  return {
    distanceM: Math.round(num(summary.totalDistance)),
    durationMin: secondsToMinutes(num(summary.totalTime)),
    tollWon: Math.round(num(summary.totalFare)),
    taxiFareWon: Math.round(num(summary.taxiFare)),
    congestedRatio: ratio(congested, total),
    slowRoadRatio: ratio(slow, total),
  };
}

export function tmapRoute(upstream: Upstream, key: string): RouteAdapter {
  return async (from, to) => {
    const body = await fetchJson(
      upstream,
      new Request('https://apis.openapi.sk.com/tmap/routes?version=1', {
        method: 'POST',
        headers: { appKey: key, 'content-type': 'application/json' },
        body: JSON.stringify({
          startX: String(from.lng),
          startY: String(from.lat),
          endX: String(to.lng),
          endY: String(to.lat),
          reqCoordType: 'WGS84GEO',
          resCoordType: 'WGS84GEO',
          searchOption: '0',
          trafficInfo: 'Y',
        }),
      }),
    );
    return reduceTmapRoute(body);
  };
}
