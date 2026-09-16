// S1 홈. 여행 중에 앱을 다시 열었을 때 한 번에 기록 화면(S6)으로 돌아가는 것이 가장 중요한 일.

import type { AppTrip } from '../model/trip.js';
import { day } from '../model/format.js';
import { Card, Screen } from '../ui/parts.jsx';

export function Home({
  trips,
  onNew,
  onQuick,
  onOpen,
}: {
  trips: AppTrip[];
  onNew: () => void;
  onQuick: () => void;
  onOpen: (trip: AppTrip) => void;
}) {
  const active = trips.find((t) => t.status !== 'settled');
  const past = trips.filter((t) => t.status === 'settled');

  return (
    <Screen
      title="운전 노동 정산기"
      bottom={
        <button type="button" className="btn btn--primary" onClick={onNew}>
          새 여행
        </button>
      }
    >
      {active ? (
        <Card label="진행 중">
          <button
            type="button"
            className="row"
            onClick={() => {
              onOpen(active);
            }}
          >
            <span>
              <span className="big">{active.destination}</span>
              <br />
              <span className="dim">
                {active.origin} 출발 · {day(active.createdAt)}
              </span>
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
          <p>아직 여행이 없어요. 출발지와 도착지만 넣으면 운전자 몫을 계산해 드려요.</p>
        </Card>
      ) : null}

      <button type="button" className="row" onClick={onQuick}>
        <span>
          앱을 못 켰나요?
          <br />
          <span className="dim">도착지·인원·시각만으로 바로 정산</span>
        </span>
        <span className="dim">빠른 정산 ›</span>
      </button>
    </Screen>
  );
}
