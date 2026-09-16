// 괘씸 점수 → 배수. 점수 0~10, 배수 1.0~2.0.
// 점수는 0 아래로 내려가지 않는다. 감면으로 "착한 행동으로 돈 버는" 역효과를 막는다.

import type { MemberId, PenaltyEvent, PenaltyKind } from './types.js';

interface Rule {
  /** 1회당 점수. 시간 기반 항목은 perMinutes마다 1회로 센다. */
  points: number;
  perMinutes?: number;
  /** 구간·사람·항목별 점수 상한(절대값). */
  cap?: number;
  /** 구간·사람·항목별 횟수 상한. */
  maxCount?: number;
}

const RULES: Record<PenaltyKind, Rule> = {
  frontSeatSleep: { points: 1, perMinutes: 20, cap: 5 },
  backSeatSleep: { points: 1, perMinutes: 60, cap: 2 },
  eatAlone: { points: 1 },
  smellyFood: { points: 2 },
  litter: { points: 2 },
  noisy: { points: 1 },
  backseatDriving: { points: 1 },
  etc: { points: 1, maxCount: 2 },
  feedDriver: { points: -1 },
  buySnack: { points: -2 },
  navigate: { points: -1, perMinutes: 30 },
  offerSwap: { points: -1 },
};

export const SCORE_MAX = 10;

function eventScore(event: PenaltyEvent): number {
  const rule = RULES[event.kind];
  const times =
    rule.perMinutes !== undefined
      ? Math.floor((event.minutes ?? 0) / rule.perMinutes)
      : (event.count ?? 1);
  const capped = rule.maxCount !== undefined ? Math.min(times, rule.maxCount) : times;
  const score = capped * rule.points;
  if (rule.cap === undefined) return score;
  return score >= 0 ? Math.min(score, rule.cap) : Math.max(score, -rule.cap);
}

/** 구간 s에서 멤버별 괘씸 점수. 용서·해제한 기록은 세지 않는다. */
export function segmentScores(
  penalties: PenaltyEvent[],
  segmentIndex: number,
): Map<MemberId, number> {
  // 상한은 항목별로 적용하므로 멤버 → 항목 → 점수로 먼저 모은다.
  const byMember = new Map<MemberId, Map<PenaltyKind, number>>();
  for (const e of penalties) {
    if (e.forgiven || e.segmentIndex !== segmentIndex) continue;
    let kinds = byMember.get(e.memberId);
    if (!kinds) {
      kinds = new Map<PenaltyKind, number>();
      byMember.set(e.memberId, kinds);
    }
    kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + eventScore(e));
  }

  const totals = new Map<MemberId, number>();
  for (const [memberId, kinds] of byMember) {
    let sum = 0;
    for (const score of kinds.values()) sum += score;
    totals.set(memberId, Math.min(SCORE_MAX, Math.max(0, sum)));
  }
  return totals;
}

/** 괘씸 배수 = 1.0 + 0.1 × 점수. 정수 나눗셈으로 부동소수 오차를 피한다. */
export function scoreToMultiplier(score: number): number {
  return (10 + Math.min(SCORE_MAX, Math.max(0, score))) / 10;
}
