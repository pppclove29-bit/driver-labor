// S2b 도착 시각 확인. 완료를 늦게 눌렀을 때만 나온다.
// 시작 시각은 앱이 잰 값을 그대로 쓰고, 도착 시각만 사람에게 묻는다. 자동으로 잘라내지 않는다.

import { useState } from 'react';

import { checkArrival, localParts, LONG_TRIP_MS, partsToIso } from '../model/meter.js';
import { Card, Screen } from '../ui/parts.jsx';

export function ArrivalTime({
  startedAt,
  now,
  onConfirm,
  onBack,
}: {
  startedAt: string;
  now: Date;
  onConfirm: (arriveIso: string) => void;
  onBack: () => void;
}) {
  const start = localParts(startedAt);
  const initial = localParts(now.toISOString());
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);

  const arriveIso = partsToIso(date, time);
  const check = checkArrival(startedAt, arriveIso);
  const hours = Math.round(LONG_TRIP_MS / 3_600_000);

  return (
    <Screen
      title="언제 도착했어요?"
      sub="완료를 누르는 걸 깜빡했나 봐요"
      onBack={onBack}
      bottom={
        <button
          type="button"
          className="btn btn--primary"
          disabled={check === 'before-depart'}
          onClick={() => {
            onConfirm(arriveIso);
          }}
        >
          {check === 'too-long' ? '이 시간이 맞아요' : '확인'}
        </button>
      }
    >
      <Card label="출발">
        <p className="big" style={{ margin: 0 }}>
          {start.date} {start.time}
        </p>
        <p className="screen__sub" style={{ margin: 0 }}>
          앱이 잰 시각이라 고칠 수 없어요.
        </p>
      </Card>

      <Card label="도착">
        <div className="field">
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
            }}
          />
          <input
            type="time"
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
            }}
          />
        </div>
        {check === 'before-depart' ? (
          <div className="note">도착이 출발보다 빨라요. 시각을 다시 넣어 주세요.</div>
        ) : null}
        {check === 'too-long' ? (
          <div className="note">
            출발에서 {hours}시간이 넘어요. 맞으면 그대로 두고, 아니면 시각을 고쳐 주세요.
          </div>
        ) : null}
      </Card>

      <p className="screen__sub">넣은 도착 시각은 결과에 “직접 입력”으로 표시돼요.</p>
    </Screen>
  );
}
