// 앱이 들고 있는 여행 상태와, 계산 엔진 입력으로 바꾸는 변환.
// 금액 계산은 하지 않는다. 계산은 전부 @dl/calc이 한다 (CLAUDE.md 코딩 규칙).

import {
  buildSegments,
  DEFAULT_FUEL_EFFICIENCY_KM_PER_L,
  DEFAULT_HOURLY_WAGE_WON,
  estimateRoute,
} from '@dl/calc';
import type { PlaceRef, Provider } from '../api/client.js';
import type {
  FeelScore,
  LaborMethod,
  Member,
  MemberId,
  PaymentRecord,
  PenaltyEvent,
  PenaltyMode,
  RouteInfo,
  TripEvent,
  TripInput,
  Weather,
} from '@dl/calc';

export type Tone = 'mild' | 'spicy' | 'business';
/**
 * running: "시작"을 눌러 시간을 재는 중. arrived: "완료"를 눌러 도착 후 입력 중.
 * settled: 정산까지 끝남.
 */
export type TripStatus = 'running' | 'arrived' | 'settled';

export interface TripSettings {
  hourlyWageWon: number;
  fuelEfficiencyKmPerL: number;
  laborMethod: LaborMethod;
  penaltyMode: PenaltyMode;
  /** 괘씸모드 끄기. 꺼지면 S6에서 괘씸·감면 영역을 감춘다. */
  penaltyEnabled: boolean;
}

export const DEFAULT_SETTINGS: TripSettings = {
  hourlyWageWon: DEFAULT_HOURLY_WAGE_WON,
  fuelEfficiencyKmPerL: DEFAULT_FUEL_EFFICIENCY_KM_PER_L,
  laborMethod: 'hourly',
  penaltyMode: 'additive',
  penaltyEnabled: true,
};

export interface AppTrip {
  id: string;
  createdAt: string;
  status: TripStatus;
  origin: string;
  destination: string;
  /** 검색해서 고른 출발·도착 장소. 경로 조회에는 좌표만 나간다. 폰에만 저장한다. */
  originPlace?: PlaceRef;
  destinationPlace?: PlaceRef;
  members: Member[];
  driverId: MemberId;
  events: TripEvent[];
  payments: PaymentRecord[];
  penalties: PenaltyEvent[];
  weather: Weather;
  feelScore: FeelScore;
  tone: Tone;
  settings: TripSettings;
  /** 유가 스냅샷. 조회 전·실패 시에는 기본값을 쓴다. */
  fuelUnitPriceWon: number;
  /** 유가를 오피넷 평균가로 채웠으면 그 기준 시각과 시·도. */
  fuelPriceAt?: string;
  fuelRegion?: string;
  /**
   * 여행 경로. 거리는 미터, 시간은 분, 금액은 원.
   * `POST /api/route` 조회값, 조회 전에는 기본값·운전 시간 어림값.
   */
  route: RouteInfo;
  /**
   * 운전 시간의 출처. app: 시작·완료를 눌러 앱이 잼. manual: 사람이 시각을 넣음
   * (지난 여행 입력, 늦은 완료). 결과에 "직접 입력" 표시를 붙일지 정한다.
   */
  timeSource?: 'app' | 'manual';
  /** 경로를 조회한 제공자. 계산 근거에 "조회: 카카오"로 표시한다. 없으면 기본값·어림값. */
  routeSource?: Provider;
  /**
   * 경로 조회 상태. pending: 오프라인 등으로 대기, 연결되면 다시 조회.
   * limit: 자동 조회 한도라 수동 입력. failed: 경로를 찾지 못해 수동 입력.
   */
  routeLookup?: 'pending' | 'done' | 'limit' | 'failed';
  /** 조회한 경로의 정체·지체 도로 거리 비율. 계산 엔진은 아직 쓰지 않는다. */
  routeCongestedRatio?: number;
  /** 조회한 경로의 저속 원활 도로 비율. 난이도 "도로 유형"에 쓴다. */
  routeSlowRoadRatio?: number;
  /**
   * 구간 경계(하차·합류·교대) 장소. 키는 경계 시각(epoch 분). 폰에만 저장한다.
   * 모든 경계에 장소가 있으면 구간별로 재조회한다.
   */
  boundaryPlaces?: Record<string, PlaceRef>;
  /** 하차 장소를 골라 구간별로 재조회한 경로. */
  segmentRoutes?: RouteInfo[];
  /** 난이도 직접 지정. S9b(M5) 전까지 개발용 스텁에서만 넣는다. */
  segmentDifficulty?: (number | undefined)[];
  /** 좌석 변경으로 뒷자리를 표시한 구간. */
  taxiModeSegments?: number[];
  /** 휴식을 켜 둔 시각. 끄면 rest 이벤트로 바뀐다. */
  restStartedAt?: string;
  /** 조수석 수면 타이머를 켠 시각. 멤버별로 하나. 끄면 분이 괘씸 점수로 바뀐다. */
  sleepTimers?: Record<MemberId, string>;
  /**
   * 기타 괘씸의 메모. 폰에만 저장하고 결과 링크·결과 이미지에는 "기타"로만 나간다
   * (CLAUDE.md 절대 규칙 1, spec-screens.md S6a).
   */
  penaltyMemos?: Record<string, string>;
  /** 계산을 처음 등록한 시각. */
  settledAt?: string;
  /** 결과 링크를 발급한 시각. 이후 값을 고치면 "새 링크를 공유하세요" 안내를 띄운다. */
  sharedAt?: string;
  /** 결과 화면에서 값을 고친 시각. */
  editedAt?: string;
  /** 직접 입력으로 바뀐 항목. 결과 영수증의 "기본값" 표시를 끈다. */
  editedFields?: string[];
}

/** 경로 API가 붙기 전 기본 경로값. 결과 화면에 "기본값"으로 표시한다. */
export const STUB_ROUTE: RouteInfo = {
  distanceM: 120000,
  expectedMinutes: 100,
  tollWon: 5000,
  taxiFareWon: 140000,
};

export const STUB_FUEL_PRICE_WON = 1700;

export function newTrip(params: {
  id: string;
  now: string;
  origin: string;
  /** 도착지는 도착 후에 넣는다. 시작 버튼만 누른 여행은 비어 있다. */
  destination?: string;
  originPlace?: PlaceRef | undefined;
  destinationPlace?: PlaceRef | undefined;
  driverName: string;
  companionNames?: string[];
}): AppTrip {
  const driver: Member = { id: 'm0', name: params.driverName, isOwner: true, canDrive: true };
  const companions: Member[] = (params.companionNames ?? []).map((name, i) => ({
    id: `m${String(i + 1)}`,
    name,
    isOwner: false,
    canDrive: false,
  }));
  const members = [driver, ...companions];

  return {
    id: params.id,
    createdAt: params.now,
    status: 'running',
    timeSource: 'app',
    origin: params.origin,
    destination: params.destination ?? '',
    ...(params.originPlace ? { originPlace: params.originPlace } : {}),
    ...(params.destinationPlace ? { destinationPlace: params.destinationPlace } : {}),
    members,
    driverId: driver.id,
    events: [{ type: 'depart', at: params.now, memberIds: members.map((m) => m.id) }],
    payments: [],
    penalties: [],
    weather: 'clear',
    feelScore: 3,
    tone: 'mild',
    settings: { ...DEFAULT_SETTINGS },
    fuelUnitPriceWon: STUB_FUEL_PRICE_WON,
    route: { ...STUB_ROUTE },
  };
}

/**
 * 도착 시점에 경로값을 운전 시간으로 어림해 넣는다.
 * 경로를 조회했거나(routeSource) 직접 고친 값은 건드리지 않는다.
 */
export function withEstimatedRoute(trip: AppTrip): AppTrip {
  if (trip.routeSource) return trip;
  const edited = new Set(trip.editedFields ?? []);
  if (edited.has('distance') || edited.has('toll') || edited.has('taxi')) return trip;

  const segments = buildSegments(toTripInput(trip));
  const driveMinutes = segments.reduce((a, s) => a + s.driveMinutes, 0);
  if (driveMinutes <= 0) return trip;
  return { ...trip, route: estimateRoute(driveMinutes) };
}

/**
 * 저장소에서 읽은 여행을 지금 형식으로 맞춘다.
 * 옛 상태값 driving(주행 중 기록 화면이 있던 시절)은 running으로 옮긴다.
 */
export function migrateTrip(trip: AppTrip): AppTrip {
  const status = (trip.status as string) === 'driving' ? 'running' : trip.status;
  return status === trip.status ? trip : { ...trip, status };
}

export function memberName(trip: AppTrip, id: MemberId): string {
  return trip.members.find((m) => m.id === id)?.name ?? '?';
}

/** 지금 차에 타고 있는 사람. 하차·합류 기록을 순서대로 반영한다. */
export function currentRiders(trip: AppTrip): MemberId[] {
  const riders = new Set<MemberId>();
  for (const e of [...trip.events].sort((a, b) => a.at.localeCompare(b.at))) {
    if (e.type === 'depart') for (const id of e.memberIds) riders.add(id);
    else if (e.type === 'dropoff') riders.delete(e.memberId);
    else if (e.type === 'pickup') riders.add(e.memberId);
  }
  return [...riders];
}

export function currentDriverId(trip: AppTrip): MemberId {
  const changes = trip.events.filter((e) => e.type === 'driverChange');
  return changes.at(-1)?.driverId ?? trip.driverId;
}

/** 지금까지 누른 기록으로 만들어질 구간 번호(0부터). 괘씸 기록을 어느 구간에 붙일지 정한다. */
export function currentSegmentIndex(trip: AppTrip): number {
  const boundaries = trip.events.filter(
    (e) => e.type === 'dropoff' || e.type === 'pickup' || e.type === 'driverChange',
  );
  return boundaries.length;
}

/**
 * 계산 엔진 입력으로 바꾼다.
 * 도착 기록이 없으면(여행 중) `now`를 임시 도착 시각으로 써서 중간 계산을 보여준다.
 */
export function toTripInput(trip: AppTrip, now?: string): TripInput {
  const events = [...trip.events];
  if (!events.some((e) => e.type === 'arrive')) {
    events.push({ type: 'arrive', at: now ?? new Date().toISOString() });
  }
  // 휴식을 켜 둔 채 도착했으면 그 시점까지를 휴식으로 본다.
  if (trip.restStartedAt) {
    const arriveAt = events.find((e) => e.type === 'arrive')?.at;
    if (arriveAt && arriveAt > trip.restStartedAt) {
      events.push({ type: 'rest', at: trip.restStartedAt, endAt: arriveAt });
    }
  }

  return {
    members: trip.members,
    defaultDriverId: trip.driverId,
    events,
    route: trip.route,
    ...(trip.segmentRoutes ? { segmentRoutes: trip.segmentRoutes } : {}),
    ...(trip.segmentDifficulty ? { segmentDifficulty: trip.segmentDifficulty } : {}),
    ...(trip.taxiModeSegments ? { taxiModeSegments: trip.taxiModeSegments } : {}),
    priceSnapshot: {
      at: trip.fuelPriceAt ?? trip.createdAt,
      unitPriceWon: trip.fuelUnitPriceWon,
      fuelType: '휘발유',
      region: trip.fuelRegion ?? trip.origin,
    },
    payments: trip.payments,
    penalties: trip.settings.penaltyEnabled ? trip.penalties : [],
    laborMethod: trip.settings.laborMethod,
    hourlyWageWon: trip.settings.hourlyWageWon,
    fuelEfficiencyKmPerL: trip.settings.fuelEfficiencyKmPerL,
    penaltyMode: trip.settings.penaltyMode,
    weather: trip.weather,
    feelScore: trip.feelScore,
    ...(trip.routeSlowRoadRatio !== undefined ? { slowRoadRatio: trip.routeSlowRoadRatio } : {}),
  };
}

/** 동승자 수를 맞춘다(운전자 포함 인원). 이름을 넣은 사람은 뒤에서부터 지우지 않는다. */
export function setPeopleCount(trip: AppTrip, people: number): AppTrip {
  const target = Math.max(1, Math.min(10, Math.round(people)));
  const members = [...trip.members];
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  while (members.length > target) {
    // 이름을 넣지 않은 사람부터 지운다.
    const removable = [...members].reverse().find((m) => !m.isOwner && /^동승자 /.test(m.name));
    const victim = removable ?? members.at(-1);
    if (!victim || victim.isOwner) break;
    members.splice(members.indexOf(victim), 1);
  }
  while (members.length < target) {
    const i = members.length - 1;
    members.push({
      id: `m${String(members.length)}`,
      name: `동승자 ${letters[i] ?? String(i)}`,
      isOwner: false,
      canDrive: false,
    });
  }
  const ids = members.map((m) => m.id);
  const kept = new Set(ids);
  return {
    ...trip,
    members,
    // 출발 멤버 목록을 맞추고, 지운 사람의 기록도 함께 정리한다.
    events: trip.events.map((e) => (e.type === 'depart' ? { ...e, memberIds: ids } : e)),
    penalties: trip.penalties.filter((p) => kept.has(p.memberId)),
    payments: trip.payments.filter((p) => kept.has(p.payerId)),
  };
}
