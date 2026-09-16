// 노동비. 시급형이 기본, 택시형은 사용자가 고르거나 괘씸 택시모드에서만 쓴다.

/** 기준 시급 기본값. 해당 연도 최저시급(2026년). */
export const DEFAULT_HOURLY_WAGE_WON = 10320;
/** 차량 연비 기본값. 결과 화면에서 한 번 고치면 다음 여행부터 기억한다. */
export const DEFAULT_FUEL_EFFICIENCY_KM_PER_L = 12;

export const TAXI_RATE = 0.3;
export const TAXI_MODE_MIN_RATIO = 1.5;
export const TAXI_MODE_MAX_RATIO = 2.0;

/** 시급형 = 운전 시간 × 기준 시급 × 난이도 계수. */
export function hourlyLabor(
  driveMinutes: number,
  hourlyWageWon: number,
  difficulty: number,
): number {
  return Math.round((driveMinutes / 60) * hourlyWageWon * difficulty);
}

/** 택시형 = (택시 예상요금 − 공통비) × 반영률 α. */
export function taxiLabor(taxiFareWon: number, commonCostWon: number): number {
  return Math.round(Math.max(0, taxiFareWon - commonCostWon) * TAXI_RATE);
}

/**
 * 택시모드 노동비. 택시형 금액을 [시급형 × 1.5, 시급형 × 2.0]로 자른다.
 * 택시 느낌은 살리되 괘씸 배수와 같은 상한(2.0배)을 지킨다.
 */
export function clampToTaxiMode(taxiRawWon: number, hourlyWon: number): number {
  const min = Math.round(hourlyWon * TAXI_MODE_MIN_RATIO);
  const max = Math.round(hourlyWon * TAXI_MODE_MAX_RATIO);
  return Math.min(max, Math.max(min, taxiRawWon));
}
