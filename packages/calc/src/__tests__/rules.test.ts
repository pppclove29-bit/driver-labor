// 기준값 테스트가 건드리지 않는 규칙들. spec-calc.md의 계산 로직 절을 따른다.

import { describe, expect, it } from 'vitest';

import { buildSegments } from '../segments.js';
import { continuousExcessBySegment } from '../difficulty.js';
import { settleTrip } from '../settle.js';
import type { Member, TripInput } from '../types.js';
import { 강릉여행, 민수, 지현, 태호, 수빈 } from './fixtures.js';

const 두명: Member[] = [
  { id: 민수, name: '민수', isOwner: true, canDrive: true },
  { id: 지현, name: '지현', isOwner: false, canDrive: true },
];

function 기본여행(부분: Partial<TripInput>): TripInput {
  return {
    members: 두명,
    defaultDriverId: 민수,
    events: [
      { type: 'depart', at: '2026-09-19T09:00:00+09:00', memberIds: [민수, 지현] },
      { type: 'arrive', at: '2026-09-19T11:00:00+09:00' },
    ],
    route: { distanceM: 120000, expectedMinutes: 120, tollWon: 4000, taxiFareWon: 140000 },
    priceSnapshot: {
      at: '2026-09-19T08:50:00+09:00',
      unitPriceWon: 1700,
      fuelType: '휘발유',
      region: '서울',
    },
    payments: [],
    penalties: [],
    laborMethod: 'hourly',
    hourlyWageWon: 10320,
    fuelEfficiencyKmPerL: 12,
    penaltyMode: 'additive',
    weather: 'clear',
    feelScore: 3,
    ...부분,
  };
}

describe('구간 자동 생성', () => {
  it('운전 교대 기록에서 구간이 나뉘고 운전자가 바뀐다', () => {
    const 구간들 = buildSegments(
      기본여행({
        events: [
          { type: 'depart', at: '2026-09-19T09:00:00+09:00', memberIds: [민수, 지현] },
          { type: 'driverChange', at: '2026-09-19T10:00:00+09:00', driverId: 지현 },
          { type: 'arrive', at: '2026-09-19T11:00:00+09:00' },
        ],
      }),
    );
    expect(구간들).toHaveLength(2);
    expect(구간들[0]?.driverId).toBe(민수);
    expect(구간들[1]?.driverId).toBe(지현);
    expect(구간들[0]?.driveMinutes).toBe(60);
    expect(구간들[1]?.driveMinutes).toBe(60);
  });

  it('합류 기록에서 탑승자가 늘어난다', () => {
    const 구간들 = buildSegments(
      기본여행({
        members: [...두명, { id: 태호, name: '태호', isOwner: false, canDrive: false }],
        events: [
          { type: 'depart', at: '2026-09-19T09:00:00+09:00', memberIds: [민수, 지현] },
          { type: 'pickup', at: '2026-09-19T10:00:00+09:00', memberId: 태호 },
          { type: 'arrive', at: '2026-09-19T11:00:00+09:00' },
        ],
      }),
    );
    expect(구간들[0]?.passengerIds).toEqual([민수, 지현]);
    expect(구간들[1]?.passengerIds).toEqual([민수, 지현, 태호]);
  });

  it('휴식은 운전 시간에서 빠지고 구간 경계에 걸치면 쪼개진다', () => {
    const 구간들 = buildSegments(강릉여행());
    // 09:00~11:40 = 160분, 휴식 10:30~10:40 중 6분은 구간 ①, 4분은 구간 ②에 걸친다.
    expect(구간들[0]?.driveMinutes).toBe(90);
    expect(구간들[1]?.driveMinutes).toBe(60);
    expect(구간들[0]?.driveIntervals).toHaveLength(1);
    expect(구간들[1]?.driveIntervals[0]?.startAt).toBe('2026-09-19T10:40:00+09:00');
  });

  it('주유 이후 구간은 주유소 단가를 쓴다', () => {
    const 구간들 = buildSegments(강릉여행());
    expect(구간들[0]?.fuelUnitPriceWon).toBe(1700);
    expect(구간들[1]?.fuelUnitPriceWon).toBe(1650);
  });
});

describe('연속 운전', () => {
  it('15분 이상 휴식이면 초기화된다', () => {
    const 구간들 = buildSegments(
      기본여행({
        events: [
          { type: 'depart', at: '2026-09-19T09:00:00+09:00', memberIds: [민수, 지현] },
          {
            type: 'rest',
            at: '2026-09-19T11:00:00+09:00',
            endAt: '2026-09-19T11:20:00+09:00',
          },
          { type: 'arrive', at: '2026-09-19T13:00:00+09:00' },
        ],
      }),
    );
    expect(continuousExcessBySegment(구간들)[0]).toBe(0);
  });

  it('15분 미만 휴식은 초기화하지 않는다', () => {
    const 구간들 = buildSegments(
      기본여행({
        events: [
          { type: 'depart', at: '2026-09-19T09:00:00+09:00', memberIds: [민수, 지현] },
          {
            type: 'rest',
            at: '2026-09-19T11:00:00+09:00',
            endAt: '2026-09-19T11:10:00+09:00',
          },
          { type: 'arrive', at: '2026-09-19T13:00:00+09:00' },
        ],
      }),
    );
    // 120분 + 110분 = 230분 연속 → 2시간 초과분 110분
    expect(continuousExcessBySegment(구간들)[0]).toBe(110);
  });
});

describe('노동비 방식', () => {
  it('택시형은 (택시 예상요금 − 공통비) × 30%이고 범위를 자르지 않는다', () => {
    const 결과 = settleTrip(
      기본여행({
        laborMethod: 'taxi',
        segmentDifficulty: [1.0],
        route: { distanceM: 120000, expectedMinutes: 120, tollWon: 5000, taxiFareWon: 140000 },
      }),
    );
    expect(결과.segments[0]?.commonCostWon).toBe(22000);
    expect(결과.segments[0]?.taxiRawWon).toBe(35400);
    expect(결과.segments[0]?.laborCostWon).toBe(35400);
  });
});

describe('괘씸 반영 방식', () => {
  it('가산형은 괘씸한 만큼 노동비 총액이 늘어난다', () => {
    const 결과 = settleTrip(강릉여행());
    const 구간1 = 결과.segments[0];
    const 합 = 구간1?.laborShares.reduce((a, s) => a + s.amountWon, 0) ?? 0;
    expect(구간1?.laborCostWon).toBe(15480);
    expect(합).toBe(17544);
  });

  it('재분배형은 노동비 총액을 고정하고 비중만 바꾼다', () => {
    const 입력 = 강릉여행();
    입력.penaltyMode = 'redistribute';
    const 결과 = settleTrip(입력);
    const 구간1 = 결과.segments[0];
    const 합 = 구간1?.laborShares.reduce((a, s) => a + s.amountWon, 0) ?? 0;
    // 반올림 차이는 운전자 몫에서 흡수하므로 1원까지 벌어질 수 있다.
    expect(Math.abs(합 - (구간1?.laborCostWon ?? 0))).toBeLessThanOrEqual(1);

    const 지현몫 = 구간1?.laborShares.find((s) => s.memberId === 지현)?.amountWon ?? 0;
    const 수빈몫 = 구간1?.laborShares.find((s) => s.memberId === 수빈)?.amountWon ?? 0;
    // 괘씸한 지현이 더 내고, 착한 수빈은 가산형(5,160)보다 덜 낸다.
    expect(지현몫).toBeGreaterThan(수빈몫);
    expect(수빈몫).toBeLessThan(5160);
    expect(결과.members.reduce((s, m) => s + m.balanceWon, 0)).toBe(0);
  });
});

describe('최소 송금 목록', () => {
  it('보낼 사람에서 받을 사람으로 차액만큼 배정하고 합계가 맞는다', () => {
    const 결과 = settleTrip(강릉여행());
    expect(결과.transfers).toEqual([
      { fromId: 태호, toId: 민수, amountWon: 23884 },
      { fromId: 지현, toId: 민수, amountWon: 23368 },
      { fromId: 수빈, toId: 민수, amountWon: 10660 },
    ]);
    expect(결과.transfers.reduce((a, t) => a + t.amountWon, 0)).toBe(57912);
  });
});
