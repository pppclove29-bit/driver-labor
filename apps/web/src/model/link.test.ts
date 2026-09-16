// 정산 결과 → 결과 링크 → 해제까지 금액이 그대로인지 본다.

import { settleTrip } from '@dl/calc';
import { decodeResult, LIMITS } from '@dl/link-codec';
import { describe, expect, it } from 'vitest';

import { buildPayload, buildResultLink } from './link.js';
import type { AppTrip } from './trip.js';
import { newTrip, toTripInput } from './trip.js';

const 민수 = 'm0';
const 지현 = 'm1';
const 태호 = 'm2';
const 수빈 = 'm3';

function 강릉여행앱(): AppTrip {
  const trip = newTrip({
    id: 't1',
    now: '2026-09-19T09:00:00+09:00',
    origin: '서울',
    destination: '강릉',
    driverName: '민수',
    companionNames: ['지현', '태호', '수빈'],
  });
  trip.events.push(
    { type: 'rest', at: '2026-09-19T10:30:00+09:00', endAt: '2026-09-19T10:40:00+09:00' },
    { type: 'dropoff', at: '2026-09-19T10:36:00+09:00', memberId: 수빈 },
    { type: 'refuel', at: '2026-09-19T10:38:00+09:00', liters: 30, unitPriceWon: 1650 },
    { type: 'arrive', at: '2026-09-19T11:40:00+09:00' },
  );
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
  trip.payments = [
    { id: 'pay1', kind: 'fuel', payerId: 민수, amountWon: 31850, at: '2026-09-19T10:38:00+09:00' },
    { id: 'pay2', kind: 'toll', payerId: 민수, amountWon: 8150, at: '2026-09-19T11:40:00+09:00' },
  ];
  trip.route = { distanceM: 228000, expectedMinutes: 150, tollWon: 8150, taxiFareWon: 265000 };
  trip.segmentRoutes = [
    { distanceM: 120000, expectedMinutes: 90, tollWon: 5000, taxiFareWon: 140000 },
    { distanceM: 108000, expectedMinutes: 60, tollWon: 3150, taxiFareWon: 125000 },
  ];
  trip.segmentDifficulty = [1.0, 1.0];
  return trip;
}

describe('결과 링크 왕복', () => {
  const trip = 강릉여행앱();
  const result = settleTrip(toTripInput(trip));
  const at = '2026-09-19T11:45:00+09:00';

  it('링크를 풀면 사람별 금액이 그대로다', async () => {
    const url = await buildResultLink(trip, result, at, 'https://example.com');
    expect(url.startsWith('https://example.com/r#v1.')).toBe(true);

    const payload = await decodeResult(url);
    expect(payload.people.map((p) => [p.n, p.b])).toEqual([
      ['민수', 57912],
      ['지현', -23368],
      ['태호', -23884],
      ['수빈', -10660],
    ]);
    expect(payload.people.reduce((s, p) => s + p.b, 0)).toBe(0);
    expect(payload.driver).toBe(0);
    expect(payload.saved).toBe(195588);
    expect(payload.from).toBe('서울');
    expect(payload.to).toBe('강릉');
  });

  it('구간 요약과 괘씸 사유 코드가 담긴다', async () => {
    const payload = await decodeResult(await buildResultLink(trip, result, at, 'https://x.io'));
    expect(payload.segments).toHaveLength(2);
    expect(payload.segments[0]).toEqual({
      n: 4,
      d: 120000,
      t: 90,
      f: 17000,
      o: 5000,
      l: 15480,
      x: 1,
    });
    expect(payload.people[1]?.r).toEqual(['frontSeatSleep']);
    expect(payload.people[2]?.r).toEqual(['eatAlone', 'noisy']);
    // 용서한 기록은 담지 않는다.
    expect(payload.people[1]?.r).not.toContain('etc');
  });

  it('기타 메모와 계좌번호는 담을 자리가 없다', () => {
    const payload = buildPayload(trip, result, at);
    const json = JSON.stringify(payload);
    expect(json).not.toContain('메모');
    expect(payload.pay).toBeUndefined();
  });

  it('메신저 호환을 위해 링크가 짧다', async () => {
    const url = await buildResultLink(trip, result, at, 'https://example.com');
    expect(url.length).toBeLessThan(2000);
    expect(new TextEncoder().encode(url).length).toBeLessThan(LIMITS.encodedBytes);
  });

  it('이름이 길면 잘라서 담는다', async () => {
    const 긴이름 = 강릉여행앱();
    긴이름.members = 긴이름.members.map((m, i) =>
      i === 1 ? { ...m, name: '아주아주아주아주아주 긴 이름' } : m,
    );
    const 결과2 = settleTrip(toTripInput(긴이름));
    const payload = await decodeResult(
      await buildResultLink(긴이름, 결과2, at, 'https://example.com'),
    );
    expect(payload.people[1]?.n.length).toBeLessThanOrEqual(LIMITS.nameChars);
  });
});
