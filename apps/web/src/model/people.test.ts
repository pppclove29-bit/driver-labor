import { describe, expect, it } from 'vitest';

import { newTrip, setPeopleCount } from './trip.js';

const base = () =>
  newTrip({ id: 't1', now: '2026-09-21T09:00:00.000Z', origin: '집', driverName: '나' });

describe('인원 맞추기', () => {
  it('늘리면 동승자 A, B…가 생긴다', () => {
    const t = setPeopleCount(base(), 3);
    expect(t.members.map((m) => m.name)).toEqual(['나', '동승자 A', '동승자 B']);
    expect(t.events.find((e) => e.type === 'depart')).toMatchObject({
      memberIds: ['m0', 'm1', 'm2'],
    });
  });

  it('줄이면 이름을 넣지 않은 사람부터 지우고 기록도 정리한다', () => {
    let t = setPeopleCount(base(), 3);
    t = { ...t, members: t.members.map((m) => (m.id === 'm1' ? { ...m, name: '수빈' } : m)) };
    t = {
      ...t,
      penalties: [
        {
          id: 'p1',
          segmentIndex: 0,
          memberId: 'm2',
          kind: 'noisy',
          forgiven: false,
        },
      ],
    };
    const smaller = setPeopleCount(t, 2);
    expect(smaller.members.map((m) => m.name)).toEqual(['나', '수빈']);
    expect(smaller.penalties).toHaveLength(0);
  });

  it('운전자 혼자보다 적게는 못 줄이고, 10명을 넘지 않는다', () => {
    expect(setPeopleCount(base(), 0).members).toHaveLength(1);
    expect(setPeopleCount(base(), 99).members).toHaveLength(10);
  });
});
