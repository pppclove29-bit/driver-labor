// S9a 괘씸 기록 보기. 기본은 기록 그대로 반영되므로, 이의가 있을 때만 들어오는 화면.
// 기록 시각을 같이 보여줘서 "그때 진짜 잤잖아"라는 대화가 나오게 한다.

import { settleTrip } from '@dl/calc';

import { memberName, toTripInput } from '../model/trip.js';
import type { AppTrip } from '../model/trip.js';
import { penaltyReason } from '../model/tone.js';
import { Card, Screen } from '../ui/parts.jsx';

export function PenaltyReview({
  trip,
  onChange,
  onBack,
}: {
  trip: AppTrip;
  onChange: (next: AppTrip) => void;
  onBack: () => void;
}) {
  const result = settleTrip(toTripInput(trip));

  const toggle = (id: string, forgiven: boolean): void => {
    onChange({
      ...trip,
      penalties: trip.penalties.map((p) => (p.id === id ? { ...p, forgiven } : p)),
    });
  };

  const bySegment = new Map<number, typeof trip.penalties>();
  for (const p of trip.penalties) {
    bySegment.set(p.segmentIndex, [...(bySegment.get(p.segmentIndex) ?? []), p]);
  }

  return (
    <Screen
      title="괘씸 기록"
      sub="이의가 있으면 체크를 해제하세요"
      onBack={onBack}
      bottom={
        <button type="button" className="btn btn--primary" onClick={onBack}>
          확인
        </button>
      }
    >
      {trip.penalties.length === 0 ? <Card>기록된 괘씸이 없어요.</Card> : null}

      {[...bySegment.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([index, items]) => (
          <Card key={index} label={`구간 ${index + 1}`}>
            {items.map((p) => (
              <label key={p.id} className="row" style={{ cursor: 'pointer' }}>
                <span>
                  <span className={p.forgiven ? 'dim' : 'penalty'}>
                    {memberName(trip, p.memberId)} ·{' '}
                    {penaltyReason(p.kind, trip.tone, p.minutes ?? 0, p.count ?? 1)}
                  </span>
                  {p.forgiven ? <span className="dim"> · 용서함</span> : null}
                </span>
                <input
                  type="checkbox"
                  checked={!p.forgiven}
                  style={{ width: 24, height: 24 }}
                  onChange={(e) => {
                    toggle(p.id, !e.target.checked);
                  }}
                />
              </label>
            ))}
            <p className="screen__sub">
              최종 배수:{' '}
              {result.segments[index]?.laborShares
                .map((s) => `${memberName(trip, s.memberId)} ×${s.multiplier.toFixed(1)}`)
                .join(' · ') ?? '—'}
            </p>
          </Card>
        ))}
    </Screen>
  );
}
