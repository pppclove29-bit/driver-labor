// 계산 엔진. 순수 함수만, 외부 의존성 없음.
// 금액을 계산하는 코드는 이 패키지 밖에 두지 않는다 (CLAUDE.md 코딩 규칙).

export const PACKAGE_NAME = '@dl/calc';

export * from './types.js';
export { buildSegments } from './segments.js';
export { computeDifficulty, continuousExcessBySegment } from './difficulty.js';
export type { DifficultyBreakdown } from './difficulty.js';
export { scoreToMultiplier, segmentScores, SCORE_MAX } from './penalty.js';
export {
  clampToTaxiMode,
  hourlyLabor,
  taxiLabor,
  DEFAULT_FUEL_EFFICIENCY_KM_PER_L,
  DEFAULT_HOURLY_WAGE_WON,
  TAXI_RATE,
  TAXI_MODE_MAX_RATIO,
  TAXI_MODE_MIN_RATIO,
} from './labor.js';
export { fuelPaymentWon, minimalTransfers, settleTrip } from './settle.js';
export type {
  LaborShare,
  MemberSettlement,
  SegmentBreakdown,
  SelfBorne,
  Settlement,
  Transfer,
} from './settle.js';
export { epochMin, minutesBetween, nightMinutes, overlapMinutes, parseInstant } from './time.js';
export type { Instant } from './time.js';
