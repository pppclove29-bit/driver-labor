import { describe, expect, it } from 'vitest';

import {
  addPenalty,
  countOf,
  etcLeft,
  minutesOf,
  removePenalty,
  setPenaltyMinutes,
} from './penalty.js';
import { newTrip, setPeopleCount } from './trip.js';

const base = () =>
  setPeopleCount(
    newTrip({ id: 't1', now: '2026-09-21T09:00:00.000Z', origin: '집', driverName: '나' }),
    2,
  );

describe('도착 후 괘씸 입력', () => {
  it('탭하면 +1, 길게 누르면 −1', () => {
    let t = addPenalty(base(), 0, 'm1', 'noisy', 'p1');
    t = addPenalty(t, 0, 'm1', 'noisy', 'p2');
    expect(countOf(t, 0, 'm1', 'noisy')).toBe(2);
    t = removePenalty(t, 0, 'm1', 'noisy');
    expect(countOf(t, 0, 'm1', 'noisy')).toBe(1);
    // 없는 기록을 빼도 그대로
    expect(countOf(removePenalty(t, 1, 'm1', 'noisy'), 0, 'm1', 'noisy')).toBe(1);
  });

  it('기타는 구간·사람당 2회까지', () => {
    let t = base();
    expect(etcLeft(t, 0, 'm1')).toBe(2);
    t = addPenalty(t, 0, 'm1', 'etc', 'e1');
    t = addPenalty(t, 0, 'm1', 'etc', 'e2');
    t = addPenalty(t, 0, 'm1', 'etc', 'e3');
    expect(countOf(t, 0, 'm1', 'etc')).toBe(2);
    expect(etcLeft(t, 0, 'm1')).toBe(0);
    // 다른 구간·다른 사람은 따로 센다
    expect(etcLeft(t, 1, 'm1')).toBe(2);
    expect(etcLeft(t, 0, 'm0')).toBe(2);
  });

  it('조수석 수면은 분으로 넣고, 0분이면 기록이 사라진다', () => {
    let t = setPenaltyMinutes(base(), 0, 'm1', 'frontSeatSleep', 60, 's1');
    expect(minutesOf(t, 0, 'm1', 'frontSeatSleep')).toBe(60);
    // 다시 넣으면 덮어쓴다(더하지 않는다)
    t = setPenaltyMinutes(t, 0, 'm1', 'frontSeatSleep', 25, 's2');
    expect(minutesOf(t, 0, 'm1', 'frontSeatSleep')).toBe(25);
    expect(t.penalties).toHaveLength(1);
    t = setPenaltyMinutes(t, 0, 'm1', 'frontSeatSleep', 0, 's3');
    expect(t.penalties).toHaveLength(0);
  });

  it('분 입력은 음수·소수를 받지 않는다', () => {
    const minus = setPenaltyMinutes(base(), 0, 'm1', 'frontSeatSleep', -30, 's1');
    expect(minus.penalties).toHaveLength(0);
    const rounded = setPenaltyMinutes(base(), 0, 'm1', 'frontSeatSleep', 24.6, 's2');
    expect(minutesOf(rounded, 0, 'm1', 'frontSeatSleep')).toBe(25);
  });

  it('용서한 기록은 세지 않는다', () => {
    const t = addPenalty(base(), 0, 'm1', 'litter', 'p1');
    const forgiven = { ...t, penalties: t.penalties.map((p) => ({ ...p, forgiven: true })) };
    expect(countOf(forgiven, 0, 'm1', 'litter')).toBe(0);
  });
});
