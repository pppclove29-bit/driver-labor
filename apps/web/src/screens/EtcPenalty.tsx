// S6a 기타 괘씸 기록. 점수표는 고정하되 "표에 없는데 괘씸하다"는 순간을 받아준다.
// 제한이 화면에 그대로 보이게 한다. 메모는 폰에만 저장한다.

import { useState } from 'react';

import { currentRiders, currentSegmentIndex, memberName } from '../model/trip.js';
import type { AppTrip } from '../model/trip.js';
import { Card, Screen } from '../ui/parts.jsx';

const MEMO_MAX = 20;
const PER_SEGMENT = 2;

export function EtcPenalty({
  trip,
  defaultTarget,
  onBack,
  onSave,
}: {
  trip: AppTrip;
  defaultTarget?: string;
  onBack: () => void;
  onSave: (next: AppTrip) => void;
}) {
  const segment = currentSegmentIndex(trip);
  const driverId = trip.driverId;
  const companions = currentRiders(trip).filter((id) => id !== driverId);
  const [target, setTarget] = useState(defaultTarget ?? companions[0] ?? '');
  const [memo, setMemo] = useState('');

  const used = trip.penalties.filter(
    (p) => p.kind === 'etc' && p.segmentIndex === segment && p.memberId === target && !p.forgiven,
  ).length;
  const left = Math.max(0, PER_SEGMENT - used);

  const save = (): void => {
    const id = `p${String(Date.now())}`;
    const next: AppTrip = {
      ...trip,
      penalties: [
        ...trip.penalties,
        { id, segmentIndex: segment, memberId: target, kind: 'etc', count: 1, forgiven: false },
      ],
    };
    const trimmed = memo.trim();
    if (trimmed.length > 0) {
      next.penaltyMemos = { ...(trip.penaltyMemos ?? {}), [id]: trimmed.slice(0, MEMO_MAX) };
    }
    onSave(next);
  };

  return (
    <Screen
      title="기타 괘씸"
      sub="점수는 +1 고정입니다"
      onBack={onBack}
      bottom={
        <button
          type="button"
          className="btn btn--primary"
          disabled={target === '' || left === 0}
          onClick={save}
        >
          기록하기 (+1)
        </button>
      }
    >
      <Card label="누구">
        <div className="chips">
          {companions.map((id) => (
            <button
              key={id}
              type="button"
              className="chip"
              aria-pressed={target === id}
              onClick={() => {
                setTarget(id);
              }}
            >
              {memberName(trip, id)}
            </button>
          ))}
        </div>
      </Card>

      <Card label={`메모 (최대 ${String(MEMO_MAX)}자, 비워도 됩니다)`}>
        <div className="field">
          <input
            value={memo}
            maxLength={MEMO_MAX}
            placeholder="예: 창문 계속 열었다 닫음"
            onChange={(e) => {
              setMemo(e.target.value);
            }}
          />
        </div>
        <p className="screen__sub">
          메모는 이 폰에만 저장됩니다. 결과 링크에는 “기타”로만 나갑니다.
        </p>
      </Card>

      <Card>
        <div className="split">
          <span>이 구간 남은 횟수</span>
          <span className="big">{left}회</span>
        </div>
        {left === 0 ? <p className="screen__sub">구간당 2회까지만 반영됩니다.</p> : null}
      </Card>
    </Screen>
  );
}
