// 기준값 테스트용 입력. docs/tasks.md의 "기준값 테스트" 값을 그대로 옮긴 것이다.

import type { Member, PenaltyEvent, TripInput } from '../types.js';

export const 민수 = 'm1';
export const 지현 = 'm2';
export const 태호 = 'm3';
export const 수빈 = 'm4';

export const 강릉멤버: Member[] = [
  { id: 민수, name: '민수', isOwner: true, canDrive: true },
  { id: 지현, name: '지현', isOwner: false, canDrive: false },
  { id: 태호, name: '태호', isOwner: false, canDrive: false },
  { id: 수빈, name: '수빈', isOwner: false, canDrive: false },
];

const 강릉괘씸: PenaltyEvent[] = [
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
  // 지현의 기타 1건은 도착 요약에서 용서해 점수에 넣지 않는다.
  { id: 'p4', segmentIndex: 1, memberId: 지현, kind: 'etc', count: 1, forgiven: true },
];

/**
 * 기준값 테스트 A · 강릉 여행.
 * 09:00 출발(4명) → 10:30~10:40 휴식 → 10:36 수빈 하차 → 10:38 주유 30L × 1,650원 → 11:40 도착.
 */
export function 강릉여행(): TripInput {
  return {
    members: 강릉멤버,
    defaultDriverId: 민수,
    events: [
      { type: 'depart', at: '2026-09-19T09:00:00+09:00', memberIds: [민수, 지현, 태호, 수빈] },
      { type: 'rest', at: '2026-09-19T10:30:00+09:00', endAt: '2026-09-19T10:40:00+09:00' },
      { type: 'dropoff', at: '2026-09-19T10:36:00+09:00', memberId: 수빈 },
      { type: 'refuel', at: '2026-09-19T10:38:00+09:00', liters: 30, unitPriceWon: 1650 },
      { type: 'arrive', at: '2026-09-19T11:40:00+09:00' },
    ],
    route: { distanceM: 228000, expectedMinutes: 150, tollWon: 8150, taxiFareWon: 265000 },
    // 수빈 하차 장소(원주휴게소)를 골라 구간별로 재조회한 경로.
    segmentRoutes: [
      { distanceM: 120000, expectedMinutes: 90, tollWon: 5000, taxiFareWon: 140000 },
      { distanceM: 108000, expectedMinutes: 60, tollWon: 3150, taxiFareWon: 125000 },
    ],
    // 두 구간 모두 주간·원활·고속도로 위주라 난이도 1.0 (tasks.md 테스트 A 입력).
    segmentDifficulty: [1.0, 1.0],
    priceSnapshot: {
      at: '2026-09-19T08:50:00+09:00',
      unitPriceWon: 1700,
      fuelType: '휘발유',
      region: '서울',
    },
    // 테스트 A는 공통비 40,000원을 민수가 모두 냈다고 본다.
    payments: [
      {
        id: 'pay1',
        kind: 'fuel',
        payerId: 민수,
        amountWon: 31850,
        at: '2026-09-19T10:38:00+09:00',
      },
      { id: 'pay2', kind: 'toll', payerId: 민수, amountWon: 8150, at: '2026-09-19T11:40:00+09:00' },
    ],
    penalties: 강릉괘씸,
    laborMethod: 'hourly',
    hourlyWageWon: 10320,
    fuelEfficiencyKmPerL: 12,
    penaltyMode: 'additive',
    weather: 'clear',
    feelScore: 3,
  };
}
