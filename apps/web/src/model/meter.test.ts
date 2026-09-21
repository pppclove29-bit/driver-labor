import { describe, expect, it } from 'vitest';

import {
  ASK_ARRIVAL_AFTER_MS,
  checkArrival,
  elapsedMinutes,
  homeState,
  localParts,
  needsArrivalTime,
  partsToIso,
} from './meter.js';
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

describe('운전 시간 출처', () => {
  it('시작 버튼으로 만든 여행은 앱이 잰 값', () => {
    expect(trip().timeSource).toBe('app');
  });
});

describe('홈 화면 상태', () => {
  const running = () => trip();
  const arrived = () => ({ ...trip(), status: 'arrived' as const });
  const settled = () => ({ ...trip(), status: 'settled' as const });

  it('여행이 없으면 시작', () => {
    expect(homeState([], at(0))).toMatchObject({ mode: 'start', elapsedMinutes: 0, nudge: false });
    expect(homeState([settled()], at(0)).mode).toBe('start');
  });

  it('시간을 재는 중이면 완료와 경과 시간', () => {
    const state = homeState([running()], at(134 * 60_000));
    expect(state.mode).toBe('complete');
    expect(state.elapsedMinutes).toBe(134);
    expect(state.nudge).toBe(false);
  });

  it('6시간이 지나면 안내를 켠다', () => {
    expect(homeState([running()], at(ASK_ARRIVAL_AFTER_MS)).nudge).toBe(true);
  });

  it('완료를 눌러 입력 중이면 이어서 입력', () => {
    expect(homeState([arrived()], at(0))).toMatchObject({ mode: 'continue', nudge: false });
  });
});

describe('도착 시각 입력칸', () => {
  it('지역 시각 칸과 ISO를 오간다', () => {
    const iso = new Date(2026, 8, 21, 14, 5).toISOString();
    const parts = localParts(iso);
    expect(parts).toEqual({ date: '2026-09-21', time: '14:05' });
    expect(partsToIso(parts.date, parts.time)).toBe(iso);
  });
});
