// S6 여행 중 기록. 흔들리는 차 안에서 동승자가 들고 쓰는 화면.
// 모든 기록은 탭 한 번, 되돌리기는 토스트 "취소" 또는 길게 누르기 −1.

import type { MemberId, PenaltyEvent, PenaltyKind } from '@dl/calc';
import { useRef, useState } from 'react';

import { duration } from '../model/format.js';
import { currentDriverId, currentRiders, currentSegmentIndex, memberName } from '../model/trip.js';
import type { AppTrip } from '../model/trip.js';
import { Card, Screen } from '../ui/parts.jsx';

interface TileSpec {
  kind: PenaltyKind;
  emoji: string;
  label: string;
  /** 시간 기반 항목은 타이머로 기록한다. */
  timed?: boolean;
}

const PENALTY_TILES: TileSpec[] = [
  { kind: 'frontSeatSleep', emoji: '😴', label: '조수석 수면', timed: true },
  { kind: 'backSeatSleep', emoji: '💤', label: '뒷자리 잠', timed: true },
  { kind: 'eatAlone', emoji: '🍪', label: '혼자 먹음' },
  { kind: 'smellyFood', emoji: '🍔', label: '냄새 음식' },
  { kind: 'litter', emoji: '🗑️', label: '부스러기' },
  { kind: 'noisy', emoji: '📢', label: '시끄러움' },
  { kind: 'backseatDriving', emoji: '🗺️', label: '훈수·재촉' },
  { kind: 'etc', emoji: '➕', label: '기타' },
];

const CREDIT_TILES: TileSpec[] = [
  { kind: 'feedDriver', emoji: '🍫', label: '먹여줌' },
  { kind: 'buySnack', emoji: '☕', label: '간식 사줌' },
  { kind: 'navigate', emoji: '🧭', label: '내비·말동무', timed: true },
  { kind: 'offerSwap', emoji: '🔁', label: '교대 제안' },
];

const LONG_PRESS_MS = 500;
const ETC_LIMIT_PER_SEGMENT = 2;

function countOf(trip: AppTrip, segment: number, memberId: MemberId, kind: PenaltyKind): number {
  return trip.penalties
    .filter(
      (p) =>
        !p.forgiven && p.segmentIndex === segment && p.memberId === memberId && p.kind === kind,
    )
    .reduce((a, p) => a + (p.count ?? (p.minutes !== undefined ? 1 : 1)), 0);
}

export function Record({
  trip,
  onChange,
  onArrive,
  onOpenPayment,
  toast,
}: {
  trip: AppTrip;
  onChange: (next: AppTrip) => void;
  onArrive: () => void;
  onOpenPayment: () => void;
  toast: (message: string, undo?: () => void) => void;
}) {
  const riders = currentRiders(trip);
  const driverId = currentDriverId(trip);
  const segment = currentSegmentIndex(trip);
  const companions = riders.filter((id) => id !== driverId);
  const [target, setTarget] = useState<MemberId | undefined>(companions[0]);
  const pressedAt = useRef(0);

  const selected = target && riders.includes(target) ? target : companions[0];

  const add = (kind: PenaltyKind, delta: 1 | -1, minutes?: number): void => {
    if (!selected) return;
    const before = trip;
    if (delta === -1) {
      const last = [...trip.penalties]
        .reverse()
        .find((p) => p.segmentIndex === segment && p.memberId === selected && p.kind === kind);
      if (!last) return;
      onChange({ ...trip, penalties: trip.penalties.filter((p) => p.id !== last.id) });
      toast(`${memberName(trip, selected)} ${kind} −1`, () => {
        onChange(before);
      });
      return;
    }
    if (kind === 'etc' && countOf(trip, segment, selected, 'etc') >= ETC_LIMIT_PER_SEGMENT) {
      toast('기타는 구간당 2회까지예요');
      return;
    }
    const event: PenaltyEvent = {
      id: `p${String(Date.now())}${String(trip.penalties.length)}`,
      segmentIndex: segment,
      memberId: selected,
      kind,
      forgiven: false,
      ...(minutes !== undefined ? { minutes } : { count: 1 }),
    };
    onChange({ ...trip, penalties: [...trip.penalties, event] });
    toast(
      `${memberName(trip, selected)} ${kind} ${minutes !== undefined ? `${String(minutes)}분` : '+1'}`,
      () => {
        onChange(before);
      },
    );
  };

  const toggleTimer = (kind: PenaltyKind): void => {
    if (!selected) return;
    const timers = { ...(trip.sleepTimers ?? {}) };
    const key = `${selected}:${kind}`;
    const startedAt = timers[key];
    if (startedAt) {
      const minutes = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000));
      delete timers[key];
      onChange({ ...trip, sleepTimers: timers });
      if (minutes > 0) add(kind, 1, minutes);
      else toast('1분이 안 돼 기록하지 않았어요');
      return;
    }
    timers[key] = new Date().toISOString();
    onChange({ ...trip, sleepTimers: timers });
    toast(`${memberName(trip, selected)} ${kind} 시작`);
  };

  const tile = (spec: TileSpec, credit: boolean) => {
    const key = selected ? `${selected}:${spec.kind}` : '';
    const running = spec.timed && trip.sleepTimers?.[key] !== undefined;
    const count = selected ? countOf(trip, segment, selected, spec.kind) : 0;
    return (
      <button
        key={spec.kind}
        type="button"
        className={credit ? 'tile tile--credit' : 'tile'}
        disabled={!selected}
        onPointerDown={() => {
          pressedAt.current = Date.now();
        }}
        onPointerUp={() => {
          const long = Date.now() - pressedAt.current >= LONG_PRESS_MS;
          if (spec.timed) {
            if (long) add(spec.kind, -1);
            else toggleTimer(spec.kind);
            return;
          }
          add(spec.kind, long ? -1 : 1);
        }}
      >
        <span className="tile__emoji">{spec.emoji}</span>
        <span>{spec.label}</span>
        <span className="tile__count" data-zero={count === 0 && !running}>
          {running ? '●' : count}
        </span>
      </button>
    );
  };

  const now = new Date().toISOString();

  return (
    <Screen
      title={trip.destination}
      sub={`${trip.origin} 출발`}
      bottom={
        <button type="button" className="btn btn--primary" onClick={onArrive}>
          도착했어요
        </button>
      }
    >
      <Card label="현재 구간">
        <p className="big" style={{ margin: 0 }}>
          구간 {segment + 1} · 운전 {memberName(trip, driverId)}
        </p>
        <p className="dim" style={{ margin: 0 }}>
          탑승 {riders.length}명 · {riders.map((id) => memberName(trip, id)).join(', ')}
          {trip.restStartedAt ? ' · 휴식 중' : ''}
        </p>
      </Card>

      {trip.settings.penaltyEnabled && companions.length > 0 ? (
        <>
          <Card label="누구">
            <div className="chips">
              {companions.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="chip"
                  aria-pressed={selected === id}
                  onClick={() => {
                    setTarget(id);
                  }}
                >
                  {memberName(trip, id)}
                </button>
              ))}
            </div>
          </Card>

          <Card label="괘씸 · 탭 +1, 길게 −1">
            <div className="tiles">{PENALTY_TILES.map((t) => tile(t, false))}</div>
          </Card>

          <Card label="감면">
            <div className="tiles tiles--credit">{CREDIT_TILES.map((t) => tile(t, true))}</div>
          </Card>
        </>
      ) : null}

      <Card label="기록">
        <div className="chips">
          <button type="button" className="chip" onClick={onOpenPayment}>
            💳 결제 기록
          </button>
          {companions.map((id) => (
            <button
              key={id}
              type="button"
              className="chip"
              onClick={() => {
                const before = trip;
                onChange({
                  ...trip,
                  events: [...trip.events, { type: 'dropoff', at: now, memberId: id }],
                });
                toast(`${memberName(trip, id)} 하차`, () => {
                  onChange(before);
                });
              }}
            >
              🚪 {memberName(trip, id)} 하차
            </button>
          ))}
          {riders
            .filter((id) => id !== driverId)
            .map((id) => (
              <button
                key={`swap-${id}`}
                type="button"
                className="chip"
                onClick={() => {
                  const before = trip;
                  onChange({
                    ...trip,
                    events: [...trip.events, { type: 'driverChange', at: now, driverId: id }],
                  });
                  toast(`운전 교대 · ${memberName(trip, id)}`, () => {
                    onChange(before);
                  });
                }}
              >
                🔄 {memberName(trip, id)}로 교대
              </button>
            ))}
          <button
            type="button"
            className="chip"
            aria-pressed={trip.restStartedAt !== undefined}
            onClick={() => {
              if (trip.restStartedAt) {
                const { restStartedAt, ...rest } = trip;
                onChange({
                  ...rest,
                  events: [...trip.events, { type: 'rest', at: restStartedAt, endAt: now }],
                });
                toast(
                  `휴식 ${duration(
                    Math.round((Date.now() - new Date(restStartedAt).getTime()) / 60000),
                  )}`,
                );
              } else {
                onChange({ ...trip, restStartedAt: now });
                toast('휴식 시작 · 운전 시간에서 빠져요');
              }
            }}
          >
            ☕ {trip.restStartedAt ? '휴식 끝내기' : '휴식'}
          </button>
        </div>
      </Card>

      <p className="screen__sub">아무것도 안 눌러도 됩니다. 출발·도착 탭만으로 정산이 나와요.</p>
    </Screen>
  );
}
