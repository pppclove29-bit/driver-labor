// 미터기. 출발할 때 "시작", 도착해서 "완료"를 누른다. 앱이 재는 것은 총 경과 시간이고,
// 휴게소 정차는 알 수 없으므로 휴식 시간은 도착 후에 사람이 넣는다 (decisions.md 사용 시점).

import type { AppTrip } from './trip.js';

/** 이만큼 지나서 완료를 누르면 도착 시각을 따로 묻는다(S2b). */
export const ASK_ARRIVAL_AFTER_MS = 6 * 60 * 60 * 1000;
/** 이만큼을 넘으면 정말 이 시간이 맞는지 한 번 더 확인한다. */
export const LONG_TRIP_MS = 24 * 60 * 60 * 1000;

export const departAt = (trip: AppTrip): string | undefined =>
  trip.events.find((e) => e.type === 'depart')?.at;

/** 시작한 뒤 지난 시간(분). 시작 기록이 없으면 0. */
export function elapsedMinutes(trip: AppTrip, now: Date): number {
  const at = departAt(trip);
  if (!at) return 0;
  return Math.max(0, Math.floor((now.getTime() - Date.parse(at)) / 60000));
}

/** 완료를 누를 때 도착 시각을 물어야 하는지. 오래 걸린 여행만 묻는다. */
export function needsArrivalTime(trip: AppTrip, now: Date): boolean {
  const at = departAt(trip);
  if (!at) return false;
  return now.getTime() - Date.parse(at) >= ASK_ARRIVAL_AFTER_MS;
}

export type ArrivalCheck = 'ok' | 'before-depart' | 'too-long';

/** 도착 시각 검증. 자동으로 잘라내지 않고 사람에게 묻는다. */
export function checkArrival(departIso: string, arriveIso: string): ArrivalCheck {
  const depart = Date.parse(departIso);
  const arrive = Date.parse(arriveIso);
  if (!Number.isFinite(arrive) || arrive <= depart) return 'before-depart';
  if (arrive - depart > LONG_TRIP_MS) return 'too-long';
  return 'ok';
}
