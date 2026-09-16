// 정산. 사람별 낸 돈·몫·차액, 최소 송금 목록, 택시 대비 아낀 돈.
// 1원 미만은 반올림하고, 반올림으로 생긴 차이는 운전자 몫에서 흡수해 차액 합계가 항상 0이 되게 한다.

import { computeDifficulty, type DifficultyBreakdown } from './difficulty.js';
import { clampToTaxiMode, hourlyLabor, taxiLabor } from './labor.js';
import { scoreToMultiplier, segmentScores } from './penalty.js';
import { buildSegments } from './segments.js';
import { epochMin } from './time.js';
import type { MemberId, PaymentKind, Segment, TripInput } from './types.js';

export interface LaborShare {
  memberId: MemberId;
  score: number;
  multiplier: number;
  amountWon: number;
}

export interface SegmentBreakdown {
  index: number;
  startAt: string;
  endAt: string;
  driverId: MemberId;
  passengerIds: MemberId[];
  passengerCount: number;
  driveMinutes: number;
  distanceM: number;
  fuelLiters: number;
  fuelUnitPriceWon: number;
  fuelCostWon: number;
  tollWon: number;
  parkingWon: number;
  commonCostWon: number;
  /** 비운전 탑승자 1인 공통비. */
  commonPerPersonWon: number;
  /** 운전자 공통비. 반올림 차이를 흡수한다. */
  driverCommonWon: number;
  difficulty: number;
  difficultyBreakdown: DifficultyBreakdown;
  /** 난이도까지 반영한 시급형 금액. 택시모드 범위를 정하는 기준이다. */
  hourlyLaborWon: number;
  /** 택시모드일 때 자르기 전 택시형 금액. */
  taxiRawWon?: number;
  taxiMode: boolean;
  laborCostWon: number;
  /** 비운전 탑승자 1인 기본 분담(괘씸 배수 적용 전). */
  laborBasePerPersonWon: number;
  laborShares: LaborShare[];
  taxiFareWon: number;
}

export interface MemberSettlement {
  memberId: MemberId;
  commonWon: number;
  /** 비운전 탑승자는 내는 금액(양수), 운전자는 받는 금액(음수). */
  laborWon: number;
  shareWon: number;
  paidWon: number;
  /** 양수면 받을 돈, 음수면 보낼 돈. */
  balanceWon: number;
}

export interface Transfer {
  fromId: MemberId;
  toId: MemberId;
  amountWon: number;
}

export interface SelfBorne {
  memberId: MemberId;
  kind: PaymentKind;
  amountWon: number;
}

export interface Settlement {
  segments: SegmentBreakdown[];
  members: MemberSettlement[];
  transfers: Transfer[];
  /** 결제 금액이 그 항목의 공통비 계산값을 넘어 결제자 자기 부담이 된 금액 (해석 12). */
  selfBorne: SelfBorne[];
  totals: {
    commonCostWon: number;
    /** 실제로 운전자에게 가는 노동비 합계(괘씸 가산 포함). */
    laborCostWon: number;
    taxiFareWon: number;
    actualCostWon: number;
    savedVsTaxiWon: number;
  };
}

/** 주차·기타 결제는 결제 시각이 속한 구간의 공통비로 붙인다. */
function extraCostBySegment(input: TripInput, segments: Segment[]): number[] {
  const out = segments.map(() => 0);
  for (const p of input.payments) {
    if (p.kind !== 'parking' && p.kind !== 'etc') continue;
    const at = epochMin(p.at);
    let idx = segments.findIndex((s) => at >= epochMin(s.startAt) && at < epochMin(s.endAt));
    if (idx < 0) idx = segments.length - 1;
    if (idx < 0) continue;
    out[idx] = (out[idx] ?? 0) + p.amountWon;
  }
  return out;
}

function buildSegmentBreakdowns(input: TripInput, segments: Segment[]): SegmentBreakdown[] {
  const extras = extraCostBySegment(input, segments);
  const taxiModeSet = new Set(input.taxiModeSegments ?? []);

  return segments.map((seg) => {
    const km = seg.distanceM / 1000;
    const liters = km / input.fuelEfficiencyKmPerL;
    const fuelCostWon = Math.round(liters * seg.fuelUnitPriceWon);
    const parkingWon = extras[seg.index] ?? 0;
    const commonCostWon = fuelCostWon + seg.tollWon + parkingWon;

    const n = seg.passengerIds.length;
    const commonPerPersonWon = n > 0 ? Math.round(commonCostWon / n) : 0;
    const nonDrivers = seg.passengerIds.filter((id) => id !== seg.driverId);
    // 반올림 차이는 운전자가 흡수한다.
    const driverCommonWon = commonCostWon - commonPerPersonWon * nonDrivers.length;

    const breakdown = computeDifficulty(seg, input, segments);
    const difficulty = input.segmentDifficulty?.[seg.index] ?? breakdown.coefficient;

    const hourlyWon = hourlyLabor(seg.driveMinutes, input.hourlyWageWon, difficulty);
    const taxiMode = taxiModeSet.has(seg.index);
    let laborCostWon = hourlyWon;
    let taxiRawWon: number | undefined;
    if (taxiMode || input.laborMethod === 'taxi') {
      taxiRawWon = taxiLabor(seg.taxiFareWon, commonCostWon);
      laborCostWon = taxiMode ? clampToTaxiMode(taxiRawWon, hourlyWon) : taxiRawWon;
    }

    const laborBasePerPersonWon =
      nonDrivers.length > 0 ? Math.round(laborCostWon / nonDrivers.length) : 0;

    const scores = segmentScores(input.penalties, seg.index);
    const shares: LaborShare[] = [];
    if (input.penaltyMode === 'redistribute' && nonDrivers.length > 0) {
      // 노동비 총액은 고정하고 괘씸한 사람의 비중만 키운다.
      const weights = nonDrivers.map((id) => scoreToMultiplier(scores.get(id) ?? 0));
      const weightSum = weights.reduce((a, b) => a + b, 0);
      nonDrivers.forEach((id, i) => {
        const score = scores.get(id) ?? 0;
        shares.push({
          memberId: id,
          score,
          multiplier: weights[i] ?? 1,
          amountWon: Math.round((laborCostWon * (weights[i] ?? 1)) / weightSum),
        });
      });
    } else {
      // 가산형: 괘씸한 사람이 더 낸 만큼 운전자가 더 받고, 착한 동승자 부담은 그대로다.
      for (const id of nonDrivers) {
        const score = scores.get(id) ?? 0;
        const multiplier = scoreToMultiplier(score);
        shares.push({
          memberId: id,
          score,
          multiplier,
          amountWon: Math.round(laborBasePerPersonWon * multiplier),
        });
      }
    }

    return {
      index: seg.index,
      startAt: seg.startAt,
      endAt: seg.endAt,
      driverId: seg.driverId,
      passengerIds: seg.passengerIds,
      passengerCount: n,
      driveMinutes: seg.driveMinutes,
      distanceM: seg.distanceM,
      fuelLiters: liters,
      fuelUnitPriceWon: seg.fuelUnitPriceWon,
      fuelCostWon,
      tollWon: seg.tollWon,
      parkingWon,
      commonCostWon,
      commonPerPersonWon,
      driverCommonWon,
      difficulty,
      difficultyBreakdown: breakdown,
      hourlyLaborWon: hourlyWon,
      ...(taxiRawWon !== undefined ? { taxiRawWon } : {}),
      taxiMode,
      laborCostWon,
      laborBasePerPersonWon,
      laborShares: shares,
      taxiFareWon: seg.taxiFareWon,
    };
  });
}

/**
 * 결제 항목별 "낸 돈"은 그 항목의 공통비 계산값을 넘지 않는 만큼만 정산에 반영한다 (해석 12).
 * 초과분은 결제자 자기 부담이다. 탱크에 남는 기름값까지 동승자가 내면 차액 합계 0이 깨진다.
 */
function creditPayments(
  input: TripInput,
  breakdowns: SegmentBreakdown[],
): { paid: Map<MemberId, number>; selfBorne: SelfBorne[] } {
  const computed: Record<PaymentKind, number | undefined> = {
    fuel: breakdowns.reduce((a, s) => a + s.fuelCostWon, 0),
    toll: breakdowns.reduce((a, s) => a + s.tollWon, 0),
    // 주차·기타는 결제 금액 자체가 공통비라서 상한이 없다.
    parking: undefined,
    etc: undefined,
  };

  const paid = new Map<MemberId, number>();
  const selfBorne: SelfBorne[] = [];
  const kinds: PaymentKind[] = ['fuel', 'toll', 'parking', 'etc'];

  for (const kind of kinds) {
    const rows = input.payments.filter((p) => p.kind === kind);
    if (rows.length === 0) continue;
    const total = rows.reduce((a, p) => a + p.amountWon, 0);
    const cap = computed[kind];
    const credited = cap === undefined ? total : Math.min(total, cap);

    // 같은 항목을 여러 사람이 냈으면 낸 비율대로 인정한다.
    let assigned = 0;
    rows.forEach((p, i) => {
      const amount =
        i === rows.length - 1
          ? credited - assigned
          : Math.round((credited * p.amountWon) / (total || 1));
      assigned += amount;
      paid.set(p.payerId, (paid.get(p.payerId) ?? 0) + amount);
      const over = p.amountWon - amount;
      if (over > 0) selfBorne.push({ memberId: p.payerId, kind, amountWon: over });
    });
  }
  return { paid, selfBorne };
}

/** 차액이 큰 채무자부터 큰 채권자에게 순서대로 배정하는 탐욕 방식 (해석 11). */
export function minimalTransfers(members: MemberSettlement[]): Transfer[] {
  const debtors = members
    .filter((m) => m.balanceWon < 0)
    .map((m) => ({ id: m.memberId, amount: -m.balanceWon }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = members
    .filter((m) => m.balanceWon > 0)
    .map((m) => ({ id: m.memberId, amount: m.balanceWon }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let di = 0;
  let ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di];
    const creditor = creditors[ci];
    if (!debtor || !creditor) break;
    const amount = Math.min(debtor.amount, creditor.amount);
    if (amount > 0) transfers.push({ fromId: debtor.id, toId: creditor.id, amountWon: amount });
    debtor.amount -= amount;
    creditor.amount -= amount;
    if (debtor.amount === 0) di++;
    if (creditor.amount === 0) ci++;
  }
  return transfers;
}

export function settleTrip(input: TripInput): Settlement {
  const segments = buildSegments(input);
  const breakdowns = buildSegmentBreakdowns(input, segments);

  const common = new Map<MemberId, number>();
  const labor = new Map<MemberId, number>();
  for (const m of input.members) {
    common.set(m.id, 0);
    labor.set(m.id, 0);
  }

  for (const s of breakdowns) {
    for (const id of s.passengerIds) {
      const own = id === s.driverId ? s.driverCommonWon : s.commonPerPersonWon;
      common.set(id, (common.get(id) ?? 0) + own);
    }
    let received = 0;
    for (const share of s.laborShares) {
      labor.set(share.memberId, (labor.get(share.memberId) ?? 0) + share.amountWon);
      received += share.amountWon;
    }
    // 운전자가 받는 금액은 비운전 탑승자 분담의 합이다. 그래서 차액 합계가 0으로 닫힌다.
    labor.set(s.driverId, (labor.get(s.driverId) ?? 0) - received);
  }

  const { paid, selfBorne } = creditPayments(input, breakdowns);

  const members: MemberSettlement[] = input.members.map((m) => {
    const commonWon = common.get(m.id) ?? 0;
    const laborWon = labor.get(m.id) ?? 0;
    const shareWon = commonWon + laborWon;
    const paidWon = paid.get(m.id) ?? 0;
    return {
      memberId: m.id,
      commonWon,
      laborWon,
      shareWon,
      paidWon,
      balanceWon: paidWon - shareWon,
    };
  });

  const commonCostWon = breakdowns.reduce((a, s) => a + s.commonCostWon, 0);
  const laborPaidWon = breakdowns.reduce(
    (a, s) => a + s.laborShares.reduce((b, x) => b + x.amountWon, 0),
    0,
  );
  const taxiFareWon = breakdowns.reduce((a, s) => a + s.taxiFareWon, 0);
  const actualCostWon = commonCostWon + laborPaidWon;

  return {
    segments: breakdowns,
    members,
    transfers: minimalTransfers(members),
    selfBorne,
    totals: {
      commonCostWon,
      laborCostWon: laborPaidWon,
      taxiFareWon,
      actualCostWon,
      savedVsTaxiWon: taxiFareWon - actualCostWon,
    },
  };
}
