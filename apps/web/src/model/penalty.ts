// 괘씸·감면 입력. 도착해서 다 같이 보며 넣는다(주행 중 기록 화면은 없앴다).
// 점수 계산은 @dl/calc이 한다. 여기서는 기록을 더하고 빼기만 한다.

import type { MemberId, PenaltyEvent, PenaltyKind } from '@dl/calc';

import type { AppTrip } from './trip.js';

export interface TileSpec {
  kind: PenaltyKind;
  emoji: string;
  label: string;
  /** 시간 기반 항목. 횟수 대신 분을 넣는다(수면 20분당 +1). */
  timed?: boolean;
}

export const PENALTY_TILES: TileSpec[] = [
  { kind: 'frontSeatSleep', emoji: '😴', label: '조수석 수면', timed: true },
  { kind: 'backSeatSleep', emoji: '💤', label: '뒷자리 잠', timed: true },
  { kind: 'eatAlone', emoji: '🍪', label: '혼자 먹음' },
  { kind: 'smellyFood', emoji: '🍔', label: '냄새 음식' },
  { kind: 'litter', emoji: '🗑️', label: '부스러기' },
  { kind: 'noisy', emoji: '📢', label: '시끄러움' },
  { kind: 'backseatDriving', emoji: '🗺️', label: '훈수·재촉' },
];

export const CREDIT_TILES: TileSpec[] = [
  { kind: 'feedDriver', emoji: '🍫', label: '먹여줌' },
  { kind: 'buySnack', emoji: '☕', label: '간식 사줌' },
  { kind: 'navigate', emoji: '🧭', label: '내비·말동무', timed: true },
  { kind: 'offerSwap', emoji: '🔁', label: '교대 제안' },
];

/** "기타"는 구간·사람당 2회까지. 과열 방지 (decisions.md 괘씸 점수표). */
export const ETC_LIMIT_PER_SEGMENT = 2;

const match = (p: PenaltyEvent, segment: number, member: MemberId, kind: PenaltyKind): boolean =>
  p.segmentIndex === segment && p.memberId === member && p.kind === kind;

/** 그 구간·사람의 항목 횟수(용서한 것은 빼고). */
export function countOf(
  trip: AppTrip,
  segment: number,
  member: MemberId,
  kind: PenaltyKind,
): number {
  return trip.penalties
    .filter((p) => !p.forgiven && match(p, segment, member, kind))
    .reduce((a, p) => a + (p.count ?? 1), 0);
}

/** 시간 기반 항목의 분. 없으면 0. */
export function minutesOf(
  trip: AppTrip,
  segment: number,
  member: MemberId,
  kind: PenaltyKind,
): number {
  return trip.penalties
    .filter((p) => !p.forgiven && match(p, segment, member, kind))
    .reduce((a, p) => a + (p.minutes ?? 0), 0);
}

export const etcLeft = (trip: AppTrip, segment: number, member: MemberId): number =>
  Math.max(0, ETC_LIMIT_PER_SEGMENT - countOf(trip, segment, member, 'etc'));

/** 횟수 항목 +1. 기타는 구간·사람당 2회를 넘기지 않는다. */
export function addPenalty(
  trip: AppTrip,
  segment: number,
  member: MemberId,
  kind: PenaltyKind,
  id: string,
): AppTrip {
  if (kind === 'etc' && etcLeft(trip, segment, member) === 0) return trip;
  const event: PenaltyEvent = {
    id,
    segmentIndex: segment,
    memberId: member,
    kind,
    forgiven: false,
  };
  return { ...trip, penalties: [...trip.penalties, event] };
}

/** 횟수 항목 −1. 마지막에 넣은 것부터 지운다. */
export function removePenalty(
  trip: AppTrip,
  segment: number,
  member: MemberId,
  kind: PenaltyKind,
): AppTrip {
  const last = [...trip.penalties].reverse().find((p) => match(p, segment, member, kind));
  if (!last) return trip;
  return { ...trip, penalties: trip.penalties.filter((p) => p !== last) };
}

/** 시간 기반 항목의 분을 정한다. 0이면 기록을 지운다. */
export function setPenaltyMinutes(
  trip: AppTrip,
  segment: number,
  member: MemberId,
  kind: PenaltyKind,
  minutes: number,
  id: string,
): AppTrip {
  const rest = trip.penalties.filter((p) => !match(p, segment, member, kind));
  const value = Math.max(0, Math.round(minutes));
  if (value === 0) return { ...trip, penalties: rest };
  const event: PenaltyEvent = {
    id,
    segmentIndex: segment,
    memberId: member,
    kind,
    minutes: value,
    forgiven: false,
  };
  return { ...trip, penalties: [...rest, event] };
}
