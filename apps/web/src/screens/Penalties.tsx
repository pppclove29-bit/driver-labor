// S9a 괘씸 입력·확인. 도착해서 차 안에서 다 같이 보며 넣는다.
// 넣은 뒤 이의가 있으면 같은 화면에서 체크를 풀어 뺀다.

import { buildSegments, settleTrip } from '@dl/calc';
import type { MemberId, PenaltyKind } from '@dl/calc';
import { useRef, useState } from 'react';

import {
  addPenalty,
  CREDIT_TILES,
  countOf,
  etcLeft,
  minutesOf,
  PENALTY_TILES,
  removePenalty,
  setPenaltyMinutes,
  type TileSpec,
} from '../model/penalty.js';
import { memberName, toTripInput } from '../model/trip.js';
import type { AppTrip } from '../model/trip.js';
import { penaltyReason } from '../model/tone.js';
import { Card, Chip, Screen } from '../ui/parts.jsx';

const LONG_PRESS_MS = 500;
const newId = (): string => `p${String(Date.now())}${String(Math.floor(Math.random() * 1000))}`;

export function Penalties({
  trip,
  onChange,
  onOpenEtc,
  onBack,
}: {
  trip: AppTrip;
  onChange: (next: AppTrip) => void;
  onOpenEtc: (segment: number, member: MemberId) => void;
  onBack: () => void;
}) {
  const segments = buildSegments(toTripInput(trip));
  const result = settleTrip(toTripInput(trip));
  const [segment, setSegment] = useState(0);
  const current = segments[Math.min(segment, segments.length - 1)];
  const riders = current?.passengerIds ?? trip.members.map((m) => m.id);
  const companions = riders.filter((id) => id !== current?.driverId);
  const [target, setTarget] = useState<MemberId | undefined>(companions[0]);
  const selected = target && companions.includes(target) ? target : companions[0];
  const pressedAt = useRef(0);

  const tile = (spec: TileSpec): React.ReactNode => {
    if (!selected) return null;
    const count = countOf(trip, segment, selected, spec.kind);
    const minutes = minutesOf(trip, segment, selected, spec.kind);
    if (spec.timed) {
      return (
        <label key={spec.kind} className="row">
          <span>
            {spec.emoji} {spec.label}
          </span>
          <span className="chips">
            <input
              inputMode="numeric"
              value={minutes === 0 ? '' : String(minutes)}
              placeholder="0"
              style={{ width: 90 }}
              onChange={(e) => {
                const next = Number(e.target.value.replace(/[^0-9]/g, ''));
                onChange(setPenaltyMinutes(trip, segment, selected, spec.kind, next, newId()));
              }}
            />
            <span className="dim">분</span>
          </span>
        </label>
      );
    }
    return (
      <button
        key={spec.kind}
        type="button"
        className="tile"
        onPointerDown={() => {
          pressedAt.current = Date.now();
        }}
        onPointerUp={() => {
          const long = Date.now() - pressedAt.current >= LONG_PRESS_MS;
          onChange(
            long
              ? removePenalty(trip, segment, selected, spec.kind)
              : addPenalty(trip, segment, selected, spec.kind, newId()),
          );
        }}
      >
        <span className="tile__emoji">{spec.emoji}</span>
        <span>{spec.label}</span>
        {count > 0 ? <span className="tile__count">{count}</span> : null}
      </button>
    );
  };

  return (
    <Screen
      title="괘씸·감면"
      sub="도착해서 다 같이 보며 넣으세요"
      onBack={onBack}
      bottom={
        <button type="button" className="btn btn--primary" onClick={onBack}>
          확인
        </button>
      }
    >
      {segments.length > 1 ? (
        <Card label="구간">
          <div className="chips">
            {segments.map((s) => (
              <Chip
                key={s.index}
                selected={s.index === segment}
                onClick={() => {
                  setSegment(s.index);
                }}
              >
                구간 {s.index + 1}
              </Chip>
            ))}
          </div>
        </Card>
      ) : null}

      <Card label="누구">
        <div className="chips">
          {companions.map((id) => (
            <Chip
              key={id}
              selected={id === selected}
              onClick={() => {
                setTarget(id);
              }}
            >
              {memberName(trip, id)}
            </Chip>
          ))}
        </div>
        {companions.length === 0 ? <p className="screen__sub">혼자 탄 구간이에요.</p> : null}
      </Card>

      {selected ? (
        <>
          <Card label="괘씸 · 탭 +1, 길게 −1">
            <div className="tiles">{PENALTY_TILES.filter((t) => !t.timed).map(tile)}</div>
            {PENALTY_TILES.filter((t) => t.timed).map(tile)}
            <button
              type="button"
              className="row"
              onClick={() => {
                onOpenEtc(segment, selected);
              }}
            >
              <span>➕ 기타</span>
              <span className="dim">{etcLeft(trip, segment, selected)}회 남음 ›</span>
            </button>
          </Card>

          <Card label="감면">
            <div className="tiles tiles--credit">
              {CREDIT_TILES.filter((t) => !t.timed).map(tile)}
            </div>
            {CREDIT_TILES.filter((t) => t.timed).map(tile)}
          </Card>
        </>
      ) : null}

      {trip.penalties.length > 0 ? (
        <Card label="넣은 기록 · 체크를 풀면 빠져요">
          {trip.penalties.map((p) => (
            <label key={p.id} className="row" style={{ cursor: 'pointer' }}>
              <span>
                <span className={p.forgiven ? 'dim' : 'penalty'}>
                  구간 {p.segmentIndex + 1} · {memberName(trip, p.memberId)} ·{' '}
                  {penaltyReason(p.kind as PenaltyKind, trip.tone, p.minutes ?? 0, p.count ?? 1)}
                </span>
                {p.forgiven ? <span className="dim"> · 용서함</span> : null}
              </span>
              <input
                type="checkbox"
                checked={!p.forgiven}
                style={{ width: 24, height: 24 }}
                onChange={(e) => {
                  onChange({
                    ...trip,
                    penalties: trip.penalties.map((x) =>
                      x.id === p.id ? { ...x, forgiven: !e.target.checked } : x,
                    ),
                  });
                }}
              />
            </label>
          ))}
          <p className="screen__sub">
            최종 배수:{' '}
            {result.segments[segment]?.laborShares
              .map((s) => `${memberName(trip, s.memberId)} ×${s.multiplier.toFixed(1)}`)
              .join(' · ') ?? '—'}
          </p>
        </Card>
      ) : null}
    </Screen>
  );
}
