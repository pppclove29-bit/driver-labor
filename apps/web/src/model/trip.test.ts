// M2 완료 기준: 기준값 테스트 A의 입력을 화면 흐름으로 재현하면 같은 금액이 나온다.
// 화면에서 누르는 순서 그대로 AppTrip을 만들고, 계산은 @dl/calc에 맡긴다.

import { settleTrip } from '@dl/calc';
import { createMemoryStorage } from '@dl/storage';
import { describe, expect, it } from 'vitest';

import type { AppTrip } from './trip.js';
import { currentRiders, currentSegmentIndex, newTrip, toTripInput } from './trip.js';

const 민수 = 'm0';
const 지현 = 'm1';
const 태호 = 'm2';
const 수빈 = 'm3';

/** S2 → S6 → S9 흐름으로 강릉 여행을 만든다. */
function 강릉여행앱(): AppTrip {
  const trip = newTrip({
    id: 't1',
    now: '2026-09-19T09:00:00+09:00',
    origin: '서울',
    destination: '강릉',
    driverName: '민수',
    companionNames: ['지현', '태호', '수빈'],
  });

  // S6에서 누른 기록들
  trip.events.push(
    { type: 'rest', at: '2026-09-19T10:30:00+09:00', endAt: '2026-09-19T10:40:00+09:00' },
    { type: 'dropoff', at: '2026-09-19T10:36:00+09:00', memberId: 수빈 },
    { type: 'refuel', at: '2026-09-19T10:38:00+09:00', liters: 30, unitPriceWon: 1650 },
    { type: 'arrive', at: '2026-09-19T11:40:00+09:00' },
  );
  trip.status = 'arrived';

  trip.penalties = [
    {
      id: 'p1',
      segmentIndex: 0,
      memberId: 지현,
      kind: 'frontSeatSleep',
      minutes: 60,
      forgiven: false,
    },
    { id: 'p2', segmentIndex: 0, memberId: 태호, kind: 'eatAlone', count: 1, forgiven: false },
    { id: 'p3', segmentIndex: 1, memberId: 태호, kind: 'noisy', count: 3, forgiven: false },
    { id: 'p4', segmentIndex: 1, memberId: 지현, kind: 'etc', count: 1, forgiven: true },
  ];

  // S7에서 기록한 결제. 공통비 40,000원을 민수가 냈다.
  trip.payments = [
    { id: 'pay1', kind: 'fuel', payerId: 민수, amountWon: 31850, at: '2026-09-19T10:38:00+09:00' },
    { id: 'pay2', kind: 'toll', payerId: 민수, amountWon: 8150, at: '2026-09-19T11:40:00+09:00' },
  ];

  // 경로 API(M3)와 난이도 상세(S9b, M5) 전까지 쓰는 개발용 스텁.
  trip.route = { distanceM: 228000, expectedMinutes: 150, tollWon: 8150, taxiFareWon: 265000 };
  trip.segmentRoutes = [
    { distanceM: 120000, expectedMinutes: 90, tollWon: 5000, taxiFareWon: 140000 },
    { distanceM: 108000, expectedMinutes: 60, tollWon: 3150, taxiFareWon: 125000 },
  ];
  trip.segmentDifficulty = [1.0, 1.0];
  return trip;
}

describe('화면 흐름으로 기준값 테스트 A 재현', () => {
  const 결과 = settleTrip(toTripInput(강릉여행앱()));
  const 잔액 = (id: string): number =>
    결과.members.find((m) => m.memberId === id)?.balanceWon ?? NaN;

  it('구간별 공통비·노동비가 기준값과 같다', () => {
    expect(결과.segments[0]?.fuelCostWon).toBe(17000);
    expect(결과.segments[0]?.commonCostWon).toBe(22000);
    expect(결과.segments[0]?.commonPerPersonWon).toBe(5500);
    expect(결과.segments[0]?.laborCostWon).toBe(15480);
    expect(결과.segments[1]?.fuelCostWon).toBe(14850);
    expect(결과.segments[1]?.commonCostWon).toBe(18000);
    expect(결과.segments[1]?.commonPerPersonWon).toBe(6000);
    expect(결과.segments[1]?.laborCostWon).toBe(10320);
  });

  it('사람별 금액이 기준값과 같다', () => {
    expect(잔액(지현)).toBe(-23368);
    expect(잔액(태호)).toBe(-23884);
    expect(잔액(수빈)).toBe(-10660);
    expect(잔액(민수)).toBe(57912);
    expect(결과.totals.savedVsTaxiWon).toBe(195588);
    expect(결과.members.reduce((s, m) => s + m.balanceWon, 0)).toBe(0);
  });
});

describe('기록 없이 출발·도착만 해도 정산된다', () => {
  it('필수 탭만으로 금액이 나온다', () => {
    const trip = newTrip({
      id: 't2',
      now: '2026-09-19T09:00:00+09:00',
      origin: '서울',
      destination: '속초',
      driverName: '나',
      companionNames: ['동승자 A'],
    });
    trip.events.push({ type: 'arrive', at: '2026-09-19T11:00:00+09:00' });
    const 결과 = settleTrip(toTripInput(trip));
    expect(결과.segments).toHaveLength(1);
    expect(결과.segments[0]?.driveMinutes).toBe(120);
    expect(결과.members.reduce((s, m) => s + m.balanceWon, 0)).toBe(0);
  });
});

describe('여행 중 상태', () => {
  const trip = 강릉여행앱();

  it('하차 기록이 현재 탑승자와 구간 번호에 반영된다', () => {
    expect(currentRiders(trip)).toEqual([민수, 지현, 태호]);
    expect(currentSegmentIndex(trip)).toBe(1);
  });

  it('도착 기록이 없으면 지금까지로 중간 계산을 보여준다', () => {
    const 진행중 = newTrip({
      id: 't3',
      now: '2026-09-19T09:00:00+09:00',
      origin: '서울',
      destination: '강릉',
      driverName: '나',
      companionNames: ['동승자 A'],
    });
    const 결과 = settleTrip(toTripInput(진행중, '2026-09-19T10:00:00+09:00'));
    expect(결과.segments[0]?.driveMinutes).toBe(60);
  });
});

describe('자동 저장', () => {
  it('저장한 진행 중 여행을 다시 읽어도 그대로다', async () => {
    const db = createMemoryStorage();
    const trip = 강릉여행앱();
    await db.put('trips', trip.id, trip);

    const rows = await db.list<AppTrip>('trips');
    const 복원 = rows[0]?.value;
    expect(복원).toEqual(trip);
    // 복원한 여행으로 계산해도 금액이 같다.
    expect(
      settleTrip(toTripInput(복원 as AppTrip)).members.find((m) => m.memberId === 민수)?.balanceWon,
    ).toBe(57912);
  });
});
