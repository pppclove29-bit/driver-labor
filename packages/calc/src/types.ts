// 도메인 타입. 금액은 원 단위 정수, 시간은 분 단위 정수, 시각은 ISO 8601, 거리는 미터 정수.

export type MemberId = string;

export interface Member {
  id: MemberId;
  name: string;
  /** 차주 여부. 기본 운전자를 정할 때 쓴다. */
  isOwner: boolean;
  canDrive: boolean;
}

/** 여행 중 탭으로 남기는 기록. 이 기록에서 구간이 자동으로 만들어진다. */
export type TripEvent =
  | { type: 'depart'; at: string; memberIds: MemberId[] }
  | { type: 'arrive'; at: string }
  | { type: 'dropoff'; at: string; memberId: MemberId }
  | { type: 'pickup'; at: string; memberId: MemberId }
  | { type: 'driverChange'; at: string; driverId: MemberId }
  | { type: 'rest'; at: string; endAt: string }
  | { type: 'refuel'; at: string; liters: number; unitPriceWon: number };

export type PaymentKind = 'fuel' | 'toll' | 'parking' | 'etc';

export interface PaymentRecord {
  id: string;
  kind: PaymentKind;
  payerId: MemberId;
  amountWon: number;
  at: string;
}

/** 조회 시점의 지역 평균 유가. 나중에 다시 계산해도 값이 바뀌지 않게 스냅샷으로 보관한다. */
export interface PriceSnapshot {
  at: string;
  unitPriceWon: number;
  fuelType: string;
  region: string;
}

/** 경로 조회 결과. 여행 전체 1회, 하차 장소를 고르면 구간별로 재조회한다. */
export interface RouteInfo {
  distanceM: number;
  expectedMinutes: number;
  tollWon: number;
  taxiFareWon: number;
}

export type PenaltyKind =
  // 가산
  | 'frontSeatSleep'
  | 'backSeatSleep'
  | 'eatAlone'
  | 'smellyFood'
  | 'litter'
  | 'noisy'
  | 'backseatDriving'
  | 'etc'
  // 감면
  | 'feedDriver'
  | 'buySnack'
  | 'navigate'
  | 'offerSwap';

export interface PenaltyEvent {
  id: string;
  segmentIndex: number;
  memberId: MemberId;
  kind: PenaltyKind;
  /** 시간 기반 항목(수면·내비)의 누적 분. */
  minutes?: number;
  /** 횟수 기반 항목의 횟수. 기본 1. */
  count?: number;
  /** 도착 요약에서 해제하거나 운전자가 용서한 기록. 점수에 넣지 않는다. */
  forgiven: boolean;
}

export type Weather = 'clear' | 'rain';
/** 운전자 체감 1~5점. 3점이 보통. */
export type FeelScore = 1 | 2 | 3 | 4 | 5;

export type LaborMethod = 'hourly' | 'taxi';
export type PenaltyMode = 'additive' | 'redistribute';

export interface TripInput {
  members: Member[];
  /** 기본 운전자. 보통 차주. */
  defaultDriverId: MemberId;
  events: TripEvent[];
  /** 여행 전체 1회 조회. */
  route: RouteInfo;
  /**
   * 하차·합류 장소를 골라 구간별로 재조회한 경로.
   * 없으면 구간 거리를 운전 시간 비율로 배분한다(해석 8).
   */
  segmentRoutes?: RouteInfo[];
  /** 구간별 난이도 계수를 직접 넣을 때. 없으면 기록에서 계산한다. */
  segmentDifficulty?: (number | undefined)[];
  /** 좌석 변경으로 뒷자리를 표시한 구간에만 택시모드를 적용한다. */
  taxiModeSegments?: number[];
  priceSnapshot: PriceSnapshot;
  payments: PaymentRecord[];
  penalties: PenaltyEvent[];
  laborMethod: LaborMethod;
  hourlyWageWon: number;
  fuelEfficiencyKmPerL: number;
  penaltyMode: PenaltyMode;
  weather: Weather;
  feelScore: FeelScore;
  /** 원활한데 40km/h 미만인 도로(도심·산길)의 거리 비율 0~1. */
  slowRoadRatio?: number;
}

/** 운전 시간 구간 하나. 휴식은 빠져 있다. */
export interface DriveInterval {
  segmentIndex: number;
  driverId: MemberId;
  startAt: string;
  endAt: string;
  minutes: number;
}

export interface Segment {
  index: number;
  startAt: string;
  endAt: string;
  driverId: MemberId;
  /** 운전자를 포함한 탑승자 전원. */
  passengerIds: MemberId[];
  /** 휴식을 뺀 운전 시간. */
  driveMinutes: number;
  distanceM: number;
  expectedMinutes: number;
  tollWon: number;
  taxiFareWon: number;
  /** 이 구간에 적용한 유가. 주유 기록이 있으면 주유 단가. */
  fuelUnitPriceWon: number;
  driveIntervals: DriveInterval[];
}
