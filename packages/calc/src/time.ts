// 시각 계산. 시각은 ISO 8601 문자열, 길이는 분 단위 정수로만 다룬다.

const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

export interface Instant {
  /** 에폭 기준 분. 길이 계산에 쓴다. */
  epochMin: number;
  /** UTC 대비 분. 시각대(22~06시 야간) 판정에 쓴다. */
  offsetMin: number;
}

export function parseInstant(iso: string): Instant {
  const m = ISO.exec(iso);
  if (!m) throw new Error(`ISO 8601 시각이 아니다: ${iso}`);
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`해석할 수 없는 시각: ${iso}`);

  const zone = m[7];
  let offsetMin = 0;
  if (zone && zone !== 'Z') {
    const sign = zone.startsWith('-') ? -1 : 1;
    offsetMin = sign * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)));
  }
  return { epochMin: Math.round(ms / 60000), offsetMin };
}

export function epochMin(iso: string): number {
  return parseInstant(iso).epochMin;
}

export function minutesBetween(fromIso: string, toIso: string): number {
  return epochMin(toIso) - epochMin(fromIso);
}

/** 두 구간이 겹치는 분. */
export function overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/**
 * 22:00~06:00에 걸친 분. 시각대는 해당 시각의 UTC 오프셋으로 판정한다.
 * 야간 창 [22:00, 다음날 06:00)은 480분이고 날마다 겹치지 않는다.
 */
export function nightMinutes(startIso: string, endIso: string): number {
  const start = parseInstant(startIso);
  const end = parseInstant(endIso);
  const startLocal = start.epochMin + start.offsetMin;
  const endLocal = end.epochMin + end.offsetMin;
  if (endLocal <= startLocal) return 0;

  let total = 0;
  const firstDay = Math.floor(startLocal / 1440) - 1;
  const lastDay = Math.floor(endLocal / 1440) + 1;
  for (let day = firstDay; day <= lastDay; day++) {
    const windowStart = day * 1440 + 22 * 60;
    total += overlapMinutes(startLocal, endLocal, windowStart, windowStart + 480);
  }
  return total;
}
