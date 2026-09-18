// 자동 조회(경로·유가) 결과를 여행에 반영한다. 조회가 막혀도 앱은 기본값·직접 입력으로 끝까지 동작한다.
// 금액은 계산하지 않는다. 조회값을 계산 엔진 입력(RouteInfo·유가 단가)으로 옮길 뿐이다.

import type { RouteInfo } from '@dl/calc';
import { buildSegments } from '@dl/calc';

import type {
  ApiClient,
  LatLng,
  Lookup,
  PlaceRef,
  RouteLeg,
  RouteResponse,
} from '../api/client.js';
import { toTripInput } from './trip.js';
import type { AppTrip } from './trip.js';

/** 한도 도달 안내. 팝업 대신 입력 필드 위에 띄우고 수동 입력 필드를 펼친다. */
export const LOOKUP_LIMIT_MESSAGE = '오늘 자동 조회 한도에 닿았어요. 직접 입력해 주세요.';
export const LOOKUP_WAITING_MESSAGE = '조회 대기 중이에요. 연결되면 다시 조회합니다.';

/**
 * 결과·고치기 화면에 띄울 경로 조회 안내.
 * limit: 한도 안내 + 거리·통행료 수동 입력. waiting: 조회 대기(연결되면 다시 조회).
 */
export function routeNotice(trip: AppTrip): 'limit' | 'waiting' | null {
  if (trip.routeSource) return null;
  if (trip.routeLookup === 'limit') return 'limit';
  if (trip.routeLookup === 'pending') return 'waiting';
  return null;
}

/** 오피넷 시·도 코드. 주소 첫 단어로 판단한다(서버에는 코드만 간다). */
const SIDO: [RegExp, string, string][] = [
  [/^서울/, '01', '서울'],
  [/^경기/, '02', '경기'],
  [/^강원/, '03', '강원'],
  [/^(충북|충청북도)/, '04', '충북'],
  [/^(충남|충청남도)/, '05', '충남'],
  [/^(전북|전라북도|전북특별자치도)/, '06', '전북'],
  [/^(전남|전라남도)/, '07', '전남'],
  [/^(경북|경상북도)/, '08', '경북'],
  [/^(경남|경상남도)/, '09', '경남'],
  [/^부산/, '10', '부산'],
  [/^제주/, '11', '제주'],
  [/^대구/, '14', '대구'],
  [/^인천/, '15', '인천'],
  [/^광주/, '16', '광주'],
  [/^대전/, '17', '대전'],
  [/^울산/, '18', '울산'],
  [/^세종/, '19', '세종'],
];

export function sidoFromAddress(address: string): { code: string; name: string } | null {
  const head = address.trim();
  for (const [re, code, name] of SIDO) if (re.test(head)) return { code, name };
  return null;
}

/** 휘발유. 차량 유종 선택이 생기면 여기서 바꾼다. */
export const FUEL_PRODUCT = 'B027';

export const toRouteInfo = (leg: RouteLeg): RouteInfo => ({
  distanceM: leg.distanceM,
  expectedMinutes: leg.durationMin,
  tollWon: leg.tollWon,
  taxiFareWon: leg.taxiFareWon,
});

const statusOf = (reason: 'limit' | 'waiting' | 'invalid'): NonNullable<AppTrip['routeLookup']> =>
  reason === 'limit' ? 'limit' : reason === 'waiting' ? 'pending' : 'failed';

/** 여행 경로 조회에 쓸 좌표. 출발·도착 장소를 둘 다 골랐을 때만. */
export function tripRoutePoints(trip: AppTrip): LatLng[] | null {
  if (!trip.originPlace || !trip.destinationPlace) return null;
  return [trip.originPlace, trip.destinationPlace];
}

/** 여행 경로 조회 결과 반영. 직접 고친 거리·통행료·택시요금은 덮어쓰지 않는다. */
export function applyTripRoute(trip: AppTrip, result: Lookup<RouteResponse>): AppTrip {
  if (!result.ok) return { ...trip, routeLookup: statusOf(result.reason) };
  const leg = result.value.legs[0];
  if (!leg) return { ...trip, routeLookup: 'failed' };
  const edited = new Set(trip.editedFields ?? []);
  const fetched = toRouteInfo(leg);
  return {
    ...trip,
    route: {
      distanceM: edited.has('distance') ? trip.route.distanceM : fetched.distanceM,
      expectedMinutes: fetched.expectedMinutes,
      tollWon: edited.has('toll') ? trip.route.tollWon : fetched.tollWon,
      taxiFareWon: edited.has('taxi') ? trip.route.taxiFareWon : fetched.taxiFareWon,
    },
    routeSource: result.value.provider,
    routeLookup: 'done',
    routeCongestedRatio: leg.congestedRatio,
    routeSlowRoadRatio: leg.slowRoadRatio,
  };
}

/** 유가 조회 결과 반영. 실패하거나 직접 고쳤으면 그대로(기본값·직접 입력). */
export function applyFuel(
  trip: AppTrip,
  result: Lookup<{ priceWon: number; updatedAt: string }>,
  regionName: string,
): AppTrip {
  if (!result.ok || (trip.editedFields ?? []).includes('fuelPrice')) return trip;
  return {
    ...trip,
    fuelUnitPriceWon: result.value.priceWon,
    fuelPriceAt: result.value.updatedAt,
    fuelRegion: regionName,
  };
}

/**
 * 출발 직후(또는 빠른 정산 직후) 경로 1회·유가 1회 조회.
 * 조회는 오래 걸릴 수 있으므로, 그 사이 사용자가 바꾼 최신 여행에 결과만 얹는 함수를 돌려준다.
 */
export async function fetchTripLookups(
  api: ApiClient,
  trip: AppTrip,
): Promise<(latest: AppTrip) => AppTrip> {
  const points = tripRoutePoints(trip);
  const sido = trip.originPlace ? sidoFromAddress(trip.originPlace.address) : null;
  const needFuel = sido !== null && !trip.fuelPriceAt;
  const [route, fuel] = await Promise.all([
    points ? api.route(points) : Promise.resolve(null),
    needFuel ? api.fuelAvg(sido.code, FUEL_PRODUCT) : Promise.resolve(null),
  ]);
  return (latest) => {
    let next = latest;
    if (route) next = applyTripRoute(next, route);
    if (fuel && sido) next = applyFuel(next, fuel, sido.name);
    return next;
  };
}

/** 경계 시각(epoch 분) 키. buildSegments와 같은 단위. */
export const boundaryKey = (at: string): string => String(Math.floor(Date.parse(at) / 60000));

/**
 * 구간별 재조회 좌표: 출발 → 경계 장소들 → 도착.
 * 모든 경계에 장소가 있어야 한다. 하나라도 없으면 운전 시간 비율 배분(해석 8)이라 null.
 */
export function segmentRoutePoints(trip: AppTrip): PlaceRef[] | null {
  if (!trip.originPlace || !trip.destinationPlace || !trip.boundaryPlaces) return null;
  const segments = buildSegments(toTripInput(trip));
  if (segments.length < 2) return null;
  const middle: PlaceRef[] = [];
  for (const s of segments.slice(1)) {
    const place = trip.boundaryPlaces[boundaryKey(s.startAt)];
    if (!place) return null;
    middle.push(place);
  }
  return [trip.originPlace, ...middle, trip.destinationPlace];
}

/** 구간별 재조회 결과 반영. 실패하면 재조회 값을 지워 비율 배분으로 둔다. */
export function applySegmentRoutes(trip: AppTrip, result: Lookup<RouteResponse> | null): AppTrip {
  if (!result || !result.ok) {
    const next = { ...trip };
    delete next.segmentRoutes;
    return next;
  }
  return { ...trip, segmentRoutes: result.value.legs.map(toRouteInfo) };
}

/**
 * 하차 장소를 고른 뒤 구간별로 다시 조회한다.
 * 한 여행의 구간은 같은 제공자로 맞춘다: 재조회 제공자가 여행 경로 제공자와 다르면
 * 여행 경로도 다시 조회한다 (architecture.md "경로 제공자 어댑터").
 */
export async function fetchSegmentRoutes(
  api: ApiClient,
  trip: AppTrip,
): Promise<(latest: AppTrip) => AppTrip> {
  const points = segmentRoutePoints(trip);
  if (!points) return (latest) => applySegmentRoutes(latest, null);
  const segments = await api.route(points);
  let whole: Lookup<RouteResponse> | null = null;
  const tripPoints = tripRoutePoints(trip);
  if (
    segments.ok &&
    trip.routeSource &&
    segments.value.provider !== trip.routeSource &&
    tripPoints
  ) {
    whole = await api.route(tripPoints);
  }
  return (latest) => {
    let next = applySegmentRoutes(latest, segments);
    if (whole) next = applyTripRoute(next, whole);
    return next;
  };
}
