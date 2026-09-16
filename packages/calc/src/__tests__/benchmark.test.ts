// docs/tasks.md의 기준값 테스트 A~E.
// 이 파일의 기대값은 어떤 작업에서도 삭제하거나 바꾸지 않는다 (CLAUDE.md 코딩 규칙).

import { describe, expect, it } from 'vitest';

import { buildSegments } from '../segments.js';
import { computeDifficulty } from '../difficulty.js';
import { settleTrip } from '../settle.js';
import type { Member, TripInput } from '../types.js';
import { 강릉여행, 민수, 지현, 태호, 수빈 } from './fixtures.js';

function 잔액(결과: ReturnType<typeof settleTrip>, id: string): number {
  const m = 결과.members.find((x) => x.memberId === id);
  if (!m) throw new Error(`멤버 없음: ${id}`);
  return m.balanceWon;
}

describe('기준값 테스트 A · 강릉 여행', () => {
  const 결과 = settleTrip(강릉여행());
  const [구간1, 구간2] = 결과.segments;

  it('구간 ① 유류비 / 공통비 / 1인 공통비', () => {
    expect(구간1?.fuelCostWon).toBe(17000);
    expect(구간1?.commonCostWon).toBe(22000);
    expect(구간1?.commonPerPersonWon).toBe(5500);
  });

  it('구간 ② 유류비 / 공통비 / 1인 공통비', () => {
    expect(구간2?.fuelCostWon).toBe(14850);
    expect(구간2?.commonCostWon).toBe(18000);
    expect(구간2?.commonPerPersonWon).toBe(6000);
  });

  it('구간 ① 노동비 / 1인 기본 분담', () => {
    expect(구간1?.laborCostWon).toBe(15480);
    expect(구간1?.laborBasePerPersonWon).toBe(5160);
  });

  it('구간 ② 노동비 / 1인 기본 분담', () => {
    expect(구간2?.laborCostWon).toBe(10320);
    expect(구간2?.laborBasePerPersonWon).toBe(5160);
  });

  it('사람별 보낼 돈 · 받을 돈', () => {
    expect(잔액(결과, 지현)).toBe(-23368);
    expect(잔액(결과, 태호)).toBe(-23884);
    expect(잔액(결과, 수빈)).toBe(-10660);
    expect(잔액(결과, 민수)).toBe(57912);
  });

  it('민수가 받을 돈은 공통비 회수 28,500 + 노동비 29,412이다', () => {
    const m = 결과.members.find((x) => x.memberId === 민수);
    expect(m?.paidWon).toBe(40000);
    expect(m?.commonWon).toBe(11500);
    expect(m?.laborWon).toBe(-29412);
  });

  it('택시 대비 아낀 돈', () => {
    expect(결과.totals.taxiFareWon).toBe(265000);
    expect(결과.totals.actualCostWon).toBe(69412);
    expect(결과.totals.savedVsTaxiWon).toBe(195588);
  });

  it('차액 합계는 0이다', () => {
    expect(결과.members.reduce((s, m) => s + m.balanceWon, 0)).toBe(0);
  });
});

describe('기준값 테스트 E · 주유 결제와 공통비 (해석 12)', () => {
  const 입력 = 강릉여행();
  // 민수의 낸 돈을 주유 실결제 49,500원 + 통행료 8,150원으로 바꾼다.
  입력.payments = [
    { id: 'pay1', kind: 'fuel', payerId: 민수, amountWon: 49500, at: '2026-09-19T10:38:00+09:00' },
    { id: 'pay2', kind: 'toll', payerId: 민수, amountWon: 8150, at: '2026-09-19T11:40:00+09:00' },
  ];
  const 결과 = settleTrip(입력);

  it('구간 ② 유류비는 주유 실결제액이 아니라 계산값 14,850원이다', () => {
    expect(결과.segments[1]?.fuelCostWon).toBe(14850);
  });

  it('1인 공통비는 테스트 A와 같다', () => {
    expect(결과.segments[0]?.commonPerPersonWon).toBe(5500);
    expect(결과.segments[1]?.commonPerPersonWon).toBe(6000);
  });

  it('초과분은 민수 자기 부담이고 동승자 보낼 돈은 테스트 A와 같다', () => {
    expect(잔액(결과, 지현)).toBe(-23368);
    expect(잔액(결과, 태호)).toBe(-23884);
    expect(잔액(결과, 수빈)).toBe(-10660);
    expect(잔액(결과, 민수)).toBe(57912);
    // 주유 49,500원 중 이번 여행 유류비 계산값 31,850원을 넘는 17,650원은 정산에 넣지 않는다.
    expect(결과.selfBorne).toEqual([{ memberId: 민수, kind: 'fuel', amountWon: 17650 }]);
  });

  it('차액 합계는 0이다', () => {
    expect(결과.members.reduce((s, m) => s + m.balanceWon, 0)).toBe(0);
  });
});

describe('기준값 테스트 B · 돌아오는 밤길 (난이도)', () => {
  // 강릉→서울, 20:30 출발, 휴식 없이 00:10 도착(운전 220분), 예상 160분, 비, 체감 4점.
  const 밤길: TripInput = {
    members: [
      { id: 민수, name: '민수', isOwner: true, canDrive: true },
      { id: 지현, name: '지현', isOwner: false, canDrive: false },
    ],
    defaultDriverId: 민수,
    events: [
      { type: 'depart', at: '2026-09-19T20:30:00+09:00', memberIds: [민수, 지현] },
      { type: 'arrive', at: '2026-09-20T00:10:00+09:00' },
    ],
    route: { distanceM: 228000, expectedMinutes: 160, tollWon: 8150, taxiFareWon: 265000 },
    priceSnapshot: {
      at: '2026-09-19T20:20:00+09:00',
      unitPriceWon: 1700,
      fuelType: '휘발유',
      region: '강원',
    },
    payments: [],
    penalties: [],
    laborMethod: 'hourly',
    hourlyWageWon: 10320,
    fuelEfficiencyKmPerL: 12,
    penaltyMode: 'additive',
    weather: 'rain',
    feelScore: 4,
    slowRoadRatio: 0,
  };

  const [구간] = buildSegments(밤길);
  if (!구간) throw new Error('구간 생성 실패');
  const 난이도 = computeDifficulty(구간, 밤길, buildSegments(밤길));

  it('운전 시간은 220분이다', () => {
    expect(구간.driveMinutes).toBe(220);
  });

  it('요소별 값', () => {
    expect(난이도.congestion).toBeCloseTo(0.19, 2);
    expect(난이도.nightMinutes).toBe(130);
    expect(난이도.night).toBeCloseTo(0.18, 2);
    expect(난이도.continuousExcessMinutes).toBe(100);
    expect(난이도.continuous).toBeCloseTo(0.09, 2);
    expect(난이도.roadType).toBeCloseTo(0, 2);
    expect(난이도.weather).toBeCloseTo(0.2, 2);
    expect(난이도.feel).toBeCloseTo(0.05, 2);
  });

  it('난이도 계수 1.71, 노동비 64,706원 (난이도 없이 37,840원)', () => {
    expect(난이도.coefficient).toBe(1.71);
    const 결과 = settleTrip(밤길);
    expect(결과.segments[0]?.laborCostWon).toBe(64706);
    expect(결과.segments[0]?.laborCostWon).not.toBe(37840);
  });
});

describe('기준값 테스트 C · 택시모드', () => {
  // 서울→원주 2인(민수 운전, 지현 뒷자리 표시), 택시 140,000원, 공통비 22,000원, 90분, 난이도 1.0.
  const 둘이서: TripInput = {
    members: [
      { id: 민수, name: '민수', isOwner: true, canDrive: true },
      { id: 지현, name: '지현', isOwner: false, canDrive: false },
    ],
    defaultDriverId: 민수,
    events: [
      { type: 'depart', at: '2026-09-19T09:00:00+09:00', memberIds: [민수, 지현] },
      { type: 'arrive', at: '2026-09-19T10:30:00+09:00' },
    ],
    route: { distanceM: 120000, expectedMinutes: 90, tollWon: 5000, taxiFareWon: 140000 },
    segmentDifficulty: [1.0],
    taxiModeSegments: [0],
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
  };

  const 결과 = settleTrip(둘이서);

  it('공통비 22,000원, 시급형 15,480원', () => {
    expect(결과.segments[0]?.commonCostWon).toBe(22000);
    expect(결과.segments[0]?.hourlyLaborWon).toBe(15480);
  });

  it('택시형 35,400원 → 범위 [23,220, 30,960]로 잘라 30,960원', () => {
    expect(결과.segments[0]?.taxiRawWon).toBe(35400);
    expect(결과.segments[0]?.laborCostWon).toBe(30960);
  });
});

describe('기준값 테스트 D · 규칙', () => {
  it('괘씸 배수는 2.0을 넘지 않는다 (점수 15 → 배수 2.0)', () => {
    const 입력 = 강릉여행();
    입력.penalties = [
      { id: 'x', segmentIndex: 0, memberId: 지현, kind: 'noisy', count: 15, forgiven: false },
    ];
    const 결과 = settleTrip(입력);
    const 몫 = 결과.segments[0]?.laborShares.find((s) => s.memberId === 지현);
    expect(몫?.score).toBe(10);
    expect(몫?.multiplier).toBe(2.0);
  });

  it('감면으로 점수가 0 미만이 되지 않는다', () => {
    const 입력 = 강릉여행();
    입력.penalties = [
      { id: 'x', segmentIndex: 0, memberId: 지현, kind: 'buySnack', count: 1, forgiven: false },
      { id: 'y', segmentIndex: 0, memberId: 지현, kind: 'feedDriver', count: 3, forgiven: false },
    ];
    const 결과 = settleTrip(입력);
    const 몫 = 결과.segments[0]?.laborShares.find((s) => s.memberId === 지현);
    expect(몫?.score).toBe(0);
    expect(몫?.multiplier).toBe(1.0);
  });

  it('기타 항목은 구간당 2회까지만 점수 반영', () => {
    const 입력 = 강릉여행();
    입력.penalties = [
      { id: 'x', segmentIndex: 0, memberId: 지현, kind: 'etc', count: 5, forgiven: false },
    ];
    const 결과 = settleTrip(입력);
    expect(결과.segments[0]?.laborShares.find((s) => s.memberId === 지현)?.score).toBe(2);
  });

  it('난이도 계수는 1.0 미만, 2.0 초과가 되지 않는다', () => {
    const 입력 = 강릉여행();
    delete 입력.segmentDifficulty;
    입력.feelScore = 1;
    입력.route = { ...입력.route, expectedMinutes: 100000 };
    if (입력.segmentRoutes) {
      입력.segmentRoutes = 입력.segmentRoutes.map((r) => ({ ...r, expectedMinutes: 100000 }));
    }
    for (const 구간 of settleTrip(입력).segments) {
      expect(구간.difficulty).toBeGreaterThanOrEqual(1.0);
      expect(구간.difficulty).toBeLessThanOrEqual(2.0);
    }
  });

  it('하차 장소 미선택: 여행 228km, 구간 90분·60분 → 136.8km·91.2km', () => {
    const 입력 = 강릉여행();
    delete 입력.segmentRoutes;
    const 구간들 = buildSegments(입력);
    expect(구간들[0]?.driveMinutes).toBe(90);
    expect(구간들[1]?.driveMinutes).toBe(60);
    expect(구간들[0]?.distanceM).toBe(136800);
    expect(구간들[1]?.distanceM).toBe(91200);
  });

  it('3명이 10,000원을 나누면 합계가 보존된다 (차이는 운전자 몫)', () => {
    const 멤버: Member[] = [
      { id: 민수, name: '민수', isOwner: true, canDrive: true },
      { id: 지현, name: '지현', isOwner: false, canDrive: false },
      { id: 태호, name: '태호', isOwner: false, canDrive: false },
    ];
    const 입력: TripInput = {
      members: 멤버,
      defaultDriverId: 민수,
      events: [
        { type: 'depart', at: '2026-09-19T09:00:00+09:00', memberIds: [민수, 지현, 태호] },
        { type: 'arrive', at: '2026-09-19T10:00:00+09:00' },
      ],
      // 유류비 0, 통행료 10,000원만 있는 여행으로 만든다.
      route: { distanceM: 0, expectedMinutes: 60, tollWon: 10000, taxiFareWon: 0 },
      segmentDifficulty: [1.0],
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
    };
    const 구간 = settleTrip(입력).segments[0];
    expect(구간?.commonCostWon).toBe(10000);
    expect(구간?.commonPerPersonWon).toBe(3333);
    expect(구간?.driverCommonWon).toBe(3334);
    expect((구간?.commonPerPersonWon ?? 0) * 2 + (구간?.driverCommonWon ?? 0)).toBe(10000);
  });
});
