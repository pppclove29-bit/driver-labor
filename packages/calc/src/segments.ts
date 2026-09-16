// 구간 자동 생성. 사용자는 구간을 만들지 않고, 여행 중 누른 기록에서 앱이 만든다.

import { epochMin, overlapMinutes } from './time.js';
import type { DriveInterval, MemberId, Segment, TripEvent, TripInput } from './types.js';

interface Span {
  startAt: string;
  endAt: string;
}

/** 합계가 보존되도록 비율 배분한다. 나머지는 마지막 구간이 가져간다. */
function distribute(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const rawSum = weights.reduce((a, b) => a + b, 0);
  // 거리·시간이 모두 0이면 비율을 낼 수 없으므로 균등하게 나눈다.
  const effective = rawSum > 0 ? weights : weights.map(() => 1);
  const sum = rawSum > 0 ? rawSum : effective.length;
  const out = effective.map((w) => Math.round((total * w) / sum));
  const diff = total - out.reduce((a, b) => a + b, 0);
  const last = out.length - 1;
  if (last >= 0) out[last] = (out[last] ?? 0) + diff;
  return out;
}

function sortedEvents(events: TripEvent[]): TripEvent[] {
  return [...events].sort((a, b) => epochMin(a.at) - epochMin(b.at));
}

function requireEvent<T extends TripEvent['type']>(
  events: TripEvent[],
  type: T,
): Extract<TripEvent, { type: T }> {
  const found = events.find((e) => e.type === type);
  if (!found) throw new Error(`${type} 기록이 없다`);
  return found as Extract<TripEvent, { type: T }>;
}

/** 휴식 구간을 여행 범위로 잘라 반환한다. */
function restSpans(events: TripEvent[], tripStart: number, tripEnd: number): [number, number][] {
  return events
    .filter((e): e is Extract<TripEvent, { type: 'rest' }> => e.type === 'rest')
    .map((e): [number, number] => [
      Math.max(tripStart, epochMin(e.at)),
      Math.min(tripEnd, epochMin(e.endAt)),
    ])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
}

/** 구간 범위에서 휴식을 뺀 실제 운전 구간들. */
function driveIntervalsOf(
  span: Span,
  rests: [number, number][],
  segmentIndex: number,
  driverId: MemberId,
  isoAt: (min: number) => string,
): DriveInterval[] {
  const start = epochMin(span.startAt);
  const end = epochMin(span.endAt);
  const out: DriveInterval[] = [];
  let cursor = start;
  for (const [restStart, restEnd] of rests) {
    if (restEnd <= cursor || restStart >= end) continue;
    if (restStart > cursor) {
      out.push({
        segmentIndex,
        driverId,
        startAt: isoAt(cursor),
        endAt: isoAt(restStart),
        minutes: restStart - cursor,
      });
    }
    cursor = Math.max(cursor, restEnd);
  }
  if (cursor < end) {
    out.push({
      segmentIndex,
      driverId,
      startAt: isoAt(cursor),
      endAt: isoAt(end),
      minutes: end - cursor,
    });
  }
  return out;
}

export function buildSegments(input: TripInput): Segment[] {
  const events = sortedEvents(input.events);
  const depart = requireEvent(events, 'depart');
  const arrive = requireEvent(events, 'arrive');
  const tripStart = epochMin(depart.at);
  const tripEnd = epochMin(arrive.at);
  if (tripEnd <= tripStart) throw new Error('도착이 출발보다 빠르다');

  // 출발·도착 시각의 오프셋을 그대로 써서 경계 시각을 ISO로 되돌린다.
  const baseIso = depart.at;
  const zone = /([+-]\d{2}:\d{2}|Z)$/.exec(baseIso)?.[1] ?? 'Z';
  const offsetMin =
    zone === 'Z'
      ? 0
      : (zone.startsWith('-') ? -1 : 1) *
        (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)));
  const isoAt = (min: number): string => {
    const local = new Date((min + offsetMin) * 60000).toISOString().slice(0, 19);
    return zone === 'Z' ? `${local}Z` : `${local}${zone}`;
  };

  const rests = restSpans(events, tripStart, tripEnd);

  // 하차·합류·운전 교대 기록 시각이 구간 경계가 된다.
  const boundaryTypes = new Set<TripEvent['type']>(['dropoff', 'pickup', 'driverChange']);
  const boundaries = [
    ...new Set(
      events
        .filter((e) => boundaryTypes.has(e.type))
        .map((e) => epochMin(e.at))
        .filter((t) => t > tripStart && t < tripEnd),
    ),
  ].sort((a, b) => a - b);

  const cuts = [tripStart, ...boundaries, tripEnd];
  const spans: Span[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    spans.push({ startAt: isoAt(cuts[i] ?? 0), endAt: isoAt(cuts[i + 1] ?? 0) });
  }

  // 구간 시작 시각 기준의 탑승자·운전자를 이벤트를 훑으며 확정한다.
  const segments: Segment[] = [];
  const riders = new Set<MemberId>(depart.memberIds);
  let driverId = input.defaultDriverId;

  const driveMinutesOf = (span: Span): number => {
    const s = epochMin(span.startAt);
    const e = epochMin(span.endAt);
    return e - s - rests.reduce((acc, [rs, re]) => acc + overlapMinutes(s, e, rs, re), 0);
  };
  const driveMinutes = spans.map(driveMinutesOf);

  // 구간 거리: 재조회한 경로가 있으면 그 값, 없으면 운전 시간 비율로 배분 (해석 8).
  const routes = input.segmentRoutes;
  const usePerSegmentRoute = routes !== undefined && routes.length === spans.length;
  const distances = usePerSegmentRoute
    ? routes.map((r) => r.distanceM)
    : distribute(input.route.distanceM, driveMinutes);

  // 구간 예상 시간: 재조회 값이 있으면 그 값, 없으면 전체 예상 시간을 거리 비율로 배분.
  const expected = usePerSegmentRoute
    ? routes.map((r) => r.expectedMinutes)
    : distribute(input.route.expectedMinutes, distances);

  // 통행료: ① 재조회 값 ② 통행료 결제 기록 합계를 거리 비율 배분 ③ 여행 경로값을 거리 비율 배분 (해석 9).
  const tollPaid = input.payments
    .filter((p) => p.kind === 'toll')
    .reduce((a, p) => a + p.amountWon, 0);
  const tolls = usePerSegmentRoute
    ? routes.map((r) => r.tollWon)
    : distribute(tollPaid > 0 ? tollPaid : input.route.tollWon, distances);

  const taxiFares = usePerSegmentRoute
    ? routes.map((r) => r.taxiFareWon)
    : distribute(input.route.taxiFareWon, distances);

  const refuels = events
    .filter((e): e is Extract<TripEvent, { type: 'refuel' }> => e.type === 'refuel')
    .sort((a, b) => epochMin(a.at) - epochMin(b.at));

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    if (!span) continue;
    const spanStart = epochMin(span.startAt);

    // 이 구간이 시작하는 시점까지의 하차·합류·교대를 반영한다.
    for (const e of events) {
      const at = epochMin(e.at);
      if (at > spanStart) break;
      if (at === tripStart && e.type === 'depart') continue;
      if (e.type === 'dropoff') riders.delete(e.memberId);
      else if (e.type === 'pickup') riders.add(e.memberId);
      else if (e.type === 'driverChange') driverId = e.driverId;
    }

    // 주유 이후 구간은 주유소 단가를 쓴다. 주유는 보통 구간 경계의 휴식 중에 일어나므로
    // 구간이 끝나는 시각까지의 마지막 주유 기록을 그 구간의 단가로 본다 (해석 10).
    const spanEnd = epochMin(span.endAt);
    const lastRefuel = refuels.filter((r) => epochMin(r.at) <= spanEnd).at(-1);

    segments.push({
      index: i,
      startAt: span.startAt,
      endAt: span.endAt,
      driverId,
      passengerIds: [...riders],
      driveMinutes: driveMinutes[i] ?? 0,
      distanceM: distances[i] ?? 0,
      expectedMinutes: expected[i] ?? 0,
      tollWon: tolls[i] ?? 0,
      taxiFareWon: taxiFares[i] ?? 0,
      fuelUnitPriceWon: lastRefuel?.unitPriceWon ?? input.priceSnapshot.unitPriceWon,
      driveIntervals: driveIntervalsOf(span, rests, i, driverId, isoAt),
    });
  }

  return segments;
}
