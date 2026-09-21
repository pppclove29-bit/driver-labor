import { describe, expect, it } from 'vitest';

import { ASK_ARRIVAL_AFTER_MS, checkArrival, elapsedMinutes, needsArrivalTime } from './meter.js';
import { newTrip } from './trip.js';

const START = '2026-09-21T09:00:00.000Z';
const trip = () => newTrip({ id: 't1', now: START, origin: '집', driverName: '나' });
const at = (ms: number) => new Date(Date.parse(START) + ms);

describe('미터기', () => {
  it('시작한 뒤 지난 시간을 분으로 센다', () => {
    expect(elapsedMinutes(trip(), at(0))).toBe(0);
    expect(elapsedMinutes(trip(), at(134 * 60_000))).toBe(134);
    // 기기 시각이 뒤로 가도 음수가 되지 않는다
    expect(elapsedMinutes(trip(), at(-60_000))).toBe(0);
  });

  it('6시간이 지나 완료를 누르면 도착 시각을 묻는다', () => {
    expect(needsArrivalTime(trip(), at(ASK_ARRIVAL_AFTER_MS - 1))).toBe(false);
    expect(needsArrivalTime(trip(), at(ASK_ARRIVAL_AFTER_MS))).toBe(true);
  });

  it('도착은 출발보다 뒤여야 하고, 24시간을 넘으면 한 번 더 확인한다', () => {
    expect(checkArrival(START, '2026-09-21T12:00:00.000Z')).toBe('ok');
    expect(checkArrival(START, START)).toBe('before-depart');
    expect(checkArrival(START, '2026-09-21T08:00:00.000Z')).toBe('before-depart');
    expect(checkArrival(START, '2026-09-22T10:00:00.000Z')).toBe('too-long');
    expect(checkArrival(START, '엉터리')).toBe('before-depart');
  });
});
