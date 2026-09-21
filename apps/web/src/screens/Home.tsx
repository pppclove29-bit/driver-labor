// S1 홈. 여행 중에 앱을 다시 열었을 때 한 번에 기록 화면(S6)으로 돌아가는 것이 가장 중요한 일.

import type { AppTrip } from '../model/trip.js';
import { appVersion } from '../config.js';
import { day, duration } from '../model/format.js';
import { homeState } from '../model/meter.js';
import { STORAGE_LINE } from '../model/notice.js';
import { Card, Screen } from '../ui/parts.jsx';

export function Home({
  trips,
  now,
  onStart,
  onComplete,
  onQuick,
  onOpen,
}: {
  trips: AppTrip[];
  /** 경과 시간 계산 기준. 테스트에서 고정하려고 받는다. */
  now: Date;
  onStart: () => void;
  onComplete: (trip: AppTrip) => void;
  onQuick: () => void;
  onOpen: (trip: AppTrip) => void;
}) {
  const past = trips.filter((t) => t.status === 'settled');
  const { mode, trip: active, elapsedMinutes: elapsed, nudge } = homeState(trips, now);
  const running = mode === 'complete' ? active : undefined;

  return (
    <Screen
      title="운전 노동 정산기"
      bottom={
        running ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              onComplete(running);
            }}
          >
            완료
          </button>
        ) : active ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              onOpen(active);
            }}
          >
            이어서 입력
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={onStart}>
            시작
          </button>
        )
      }
    >
      {running ? (
        <Card label="진행 중">
          <p className="huge" style={{ margin: 0 }}>
            {duration(elapsed)}
          </p>
          <p className="dim" style={{ margin: 0 }}>
            {day(running.createdAt)} 출발 · 시간을 재고 있어요
          </p>
          {nudge ? (
            <div className="note" style={{ marginTop: 10 }}>
              아직 진행 중이에요. 도착 시각을 넣어 주세요.
            </div>
          ) : null}
        </Card>
      ) : null}

      {active && !running ? (
        <Card label="입력 중">
          <button
            type="button"
            className="row"
            onClick={() => {
              onOpen(active);
            }}
          >
            <span>
              <span className="big">{active.destination || '도착지 미입력'}</span>
              <br />
              <span className="dim">{day(active.createdAt)}</span>
            </span>
            <span className="dim">›</span>
          </button>
        </Card>
      ) : null}

      {past.length > 0 ? (
        <Card label="지난 여행">
          {past.map((trip) => (
            <button
              key={trip.id}
              type="button"
              className="row"
              onClick={() => {
                onOpen(trip);
              }}
            >
              <span>
                {trip.destination}
                <br />
                <span className="dim">{day(trip.createdAt)}</span>
              </span>
              <span className="dim">›</span>
            </button>
          ))}
        </Card>
      ) : null}

      {!active && past.length === 0 ? (
        <Card>
          <p>출발할 때 시작을 누르고 폰을 덮으세요. 도착해서 완료만 누르면 정산해 드려요.</p>
          <p className="screen__sub" style={{ margin: 0 }}>
            {STORAGE_LINE}
          </p>
        </Card>
      ) : null}

      <button type="button" className="row" onClick={onQuick}>
        <span>
          시작을 못 눌렀나요?
          <br />
          <span className="dim">도착지·인원·시각만 넣으면 정산돼요</span>
        </span>
        <span className="dim">지난 여행 입력 ›</span>
      </button>

      {appVersion() ? (
        <p className="screen__sub" style={{ textAlign: 'center', margin: 0 }}>
          v{appVersion()}
        </p>
      ) : null}
    </Screen>
  );
}
