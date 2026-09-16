// 정산 결과 → 결과 링크 payload.
// 링크에는 이름·금액·사유 코드만 담는다. 기타 메모, 여행 날짜 상세, 계좌번호는 담지 않는다.

import type { Settlement } from '@dl/calc';
import { encodeResult, LIMITS } from '@dl/link-codec';
import type { LinkPayload, LinkPerson, ReasonCode, LinkSegment } from '@dl/link-codec';

import { memberName } from './trip.js';
import type { AppTrip } from './trip.js';

/** 링크에 담을 수 있게 이름을 자른다. */
function shortName(name: string, max: number): string {
  const trimmed = name.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export function buildPayload(trip: AppTrip, result: Settlement, now: string): LinkPayload {
  const people: LinkPerson[] = result.members.map((m) => {
    // 기타 항목의 메모는 링크에 넣지 않는다. 코드만 보낸다.
    const codes = [
      ...new Set(
        trip.penalties
          .filter((p) => !p.forgiven && p.memberId === m.memberId)
          .map((p) => p.kind as ReasonCode),
      ),
    ];
    return {
      n: shortName(memberName(trip, m.memberId), LIMITS.nameChars),
      c: m.commonWon,
      l: m.laborWon,
      p: m.paidWon,
      b: m.balanceWon,
      r: codes,
    };
  });

  const segments: LinkSegment[] = result.segments.slice(0, LIMITS.segments).map((s) => ({
    n: s.passengerCount,
    d: s.distanceM,
    t: s.driveMinutes,
    f: s.fuelCostWon,
    o: s.tollWon,
    l: s.laborCostWon,
    x: s.difficulty,
  }));

  const driverIndex = Math.max(
    0,
    result.members.findIndex((m) => m.memberId === trip.driverId),
  );

  return {
    v: 1,
    from: shortName(trip.origin, LIMITS.placeChars),
    to: shortName(trip.destination, LIMITS.placeChars),
    at: now,
    tone: trip.tone,
    driver: driverIndex,
    people,
    segments,
    taxi: result.totals.taxiFareWon,
    actual: result.totals.actualCostWon,
    saved: Math.max(0, result.totals.savedVsTaxiWon),
  };
}

/**
 * 결과 링크를 만든다. 길면 구간 상세를 빼고 사람별 합계만 담는다
 * (architecture.md "결과 링크 구조").
 */
export async function buildResultLink(
  trip: AppTrip,
  result: Settlement,
  now: string,
  origin: string,
): Promise<string> {
  const payload = buildPayload(trip, result, now);
  let fragment: string;
  try {
    fragment = await encodeResult(payload);
  } catch {
    fragment = await encodeResult({ ...payload, segments: [] });
  }
  return `${origin}/r#${fragment}`;
}
