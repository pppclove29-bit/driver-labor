// 제공자 공통 형식. 앱은 어느 회사가 조회했는지 몰라도 된다(출처 표시용 provider만 받는다).
import type { Point } from '../validate.js';

/**
 * 구간 하나의 경로 요약. 숫자 6개만 내보낸다 (architecture.md "응답 축소").
 * 경로 좌표(vertexes), 도로별 정보, 도로 이름은 Worker 안에서 버린다.
 */
export interface RouteLeg {
  distanceM: number;
  durationMin: number;
  tollWon: number;
  taxiFareWon: number;
  /** 정체·지체 도로 거리 비율 0~1 */
  congestedRatio: number;
  /** 교통 원활인데 40km/h 미만인 도로 거리 비율 0~1 (도심·산길) */
  slowRoadRatio: number;
}

/** 장소 하나. 전화번호·카테고리·페이지 넘김은 내보내지 않는다. */
export interface Place {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

/**
 * unavailable: 네트워크 오류·시간 초과·5xx·429·인증 실패(앱 차단). 예비 제공자로 넘어간다.
 * no_result: 제공자가 정상 응답했지만 경로를 만들 수 없음(출발·도착이 너무 가까움 등).
 */
export class ProviderError extends Error {
  constructor(readonly kind: 'unavailable' | 'no_result') {
    super(kind);
  }
}

export const UPSTREAM_TIMEOUT_MS = 5_000;

/** 원활인데 이 속도 미만이면 저속 도로 (spec-calc.md 난이도 "도로 유형"). */
export const SLOW_ROAD_KMH = 40;

export const ratio = (part: number, total: number): number =>
  total > 0 ? Math.round((part / total) * 100) / 100 : 0;

export const secondsToMinutes = (s: number): number => Math.round(s / 60);

export type RouteAdapter = (from: Point, to: Point) => Promise<RouteLeg>;

/** 장소 검색 결과 최대 개수. */
export const PLACES_MAX = 5;

/** 좌표가 숫자가 아니면 null. */
export function toPlace(name: unknown, address: unknown, lat: unknown, lng: unknown): Place | null {
  const la = Number(lat);
  const ln = Number(lng);
  if (typeof name !== 'string' || !name || !Number.isFinite(la) || !Number.isFinite(ln))
    return null;
  return { name, address: typeof address === 'string' ? address : '', lat: la, lng: ln };
}
