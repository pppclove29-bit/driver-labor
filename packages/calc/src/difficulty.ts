// 운전 난이도 지수. "길이 얼마나 어려웠나"만 재고, 운전자 행동 지표는 쓰지 않는다.
// 난이도 계수 = 1.0 + 정체 + 야간 + 연속 운전 + 도로 유형 + 기상 + 체감 (최소 1.0, 최대 2.0)

import { epochMin, nightMinutes } from './time.js';
import type { FeelScore, Segment, TripInput } from './types.js';

export interface DifficultyBreakdown {
  congestion: number;
  night: number;
  continuous: number;
  roadType: number;
  weather: number;
  feel: number;
  /** 소수점 둘째 자리까지 반올림한 최종 계수. */
  coefficient: number;
  nightMinutes: number;
  continuousExcessMinutes: number;
}

const FEEL_SCORE: Record<FeelScore, number> = {
  1: -0.1,
  2: -0.05,
  3: 0,
  4: 0.05,
  5: 0.1,
};

/** 15분 이상 쉬지 않고 2시간을 넘긴 시간. 운전 교대나 15분 이상 휴식이면 초기화한다 (해석 3). */
const CONTINUOUS_LIMIT_MIN = 120;
const RESET_REST_MIN = 15;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 구간별 "2시간 초과 연속 운전" 분.
 * 연속 여부는 운전자 타임라인 전체로 보고(해석 3), 초과분은 그 시간이 속한 구간에 귀속한다(해석 2).
 */
export function continuousExcessBySegment(segments: Segment[]): number[] {
  const excess = segments.map(() => 0);
  const intervals = segments
    .flatMap((s) => s.driveIntervals)
    .sort((a, b) => epochMin(a.startAt) - epochMin(b.startAt));

  let streak = 0;
  let prevEnd: number | undefined;
  let prevDriver: string | undefined;

  for (const iv of intervals) {
    const gap = prevEnd === undefined ? 0 : epochMin(iv.startAt) - prevEnd;
    if (prevDriver !== undefined && (iv.driverId !== prevDriver || gap >= RESET_REST_MIN)) {
      streak = 0;
    }
    const before = streak;
    const after = streak + iv.minutes;
    const gained =
      Math.max(0, after - CONTINUOUS_LIMIT_MIN) - Math.max(0, before - CONTINUOUS_LIMIT_MIN);
    excess[iv.segmentIndex] = (excess[iv.segmentIndex] ?? 0) + gained;
    streak = after;
    prevEnd = epochMin(iv.endAt);
    prevDriver = iv.driverId;
  }
  return excess;
}

export function computeDifficulty(
  segment: Segment,
  input: TripInput,
  allSegments: Segment[],
): DifficultyBreakdown {
  const drive = segment.driveMinutes;

  // 정체: 실제 운전 시간이 예상보다 얼마나 늘었나.
  const congestion =
    segment.expectedMinutes > 0 ? clamp((drive / segment.expectedMinutes - 1) * 0.5, 0, 0.3) : 0;

  const nightMin = segment.driveIntervals.reduce(
    (acc, iv) => acc + nightMinutes(iv.startAt, iv.endAt),
    0,
  );
  const night = drive > 0 ? clamp((nightMin / drive) * 0.3, 0, 0.3) : 0;

  const excessMin = continuousExcessBySegment(allSegments)[segment.index] ?? 0;
  const continuous = drive > 0 ? clamp((excessMin / drive) * 0.2, 0, 0.2) : 0;

  const roadType = clamp((input.slowRoadRatio ?? 0) * 0.1, 0, 0.1);
  const weather = input.weather === 'rain' ? 0.2 : 0;
  const feel = FEEL_SCORE[input.feelScore];

  // 요소는 원값으로 합산하고 계수만 반올림한다. 영수증에 찍는 요소별 값은 각각 반올림한다.
  const raw = 1 + congestion + night + continuous + roadType + weather + feel;

  return {
    congestion,
    night,
    continuous,
    roadType,
    weather,
    feel,
    coefficient: clamp(round2(raw), 1.0, 2.0),
    nightMinutes: nightMin,
    continuousExcessMinutes: excessMin,
  };
}
