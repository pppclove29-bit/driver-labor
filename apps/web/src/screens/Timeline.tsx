// S9c 여행 타임라인. 여행 중 누른 기록을 시간순으로 보여주고, 깜빡한 기록을 도착 후에 넣는다.
// 지도·현재 위치는 쓰지 않는다 (0원·서버 최소 정보 원칙).

import type { TripEvent } from '@dl/calc';
import { buildSegments } from '@dl/calc';

import { clock, duration, km, won } from '../model/format.js';
import { currentRiders, memberName, toTripInput } from '../model/trip.js';
import type { AppTrip } from '../model/trip.js';
import { Card, Screen } from '../ui/parts.jsx';

function label(trip: AppTrip, event: TripEvent): string {
  switch (event.type) {
    case 'depart':
      return `출발 · ${event.memberIds.length}명`;
    case 'arrive':
      return '도착';
    case 'dropoff':
      return `${memberName(trip, event.memberId)} 하차`;
    case 'pickup':
      return `${memberName(trip, event.memberId)} 합류`;
    case 'driverChange':
      return `운전 교대 · ${memberName(trip, event.driverId)}`;
    case 'rest':
      return `휴식 ${String(Math.round((Date.parse(event.endAt) - Date.parse(event.at)) / 60000))}분`;
    case 'refuel':
      return `주유 ${String(event.liters)}L · ${won(event.unitPriceWon)}/L`;
  }
}

export function Timeline({
  trip,
  onChange,
  onBack,
}: {
  trip: AppTrip;
  onChange: (next: AppTrip) => void;
  onBack: () => void;
}) {
  const sorted = [...trip.events].sort((a, b) => a.at.localeCompare(b.at));
  const segments = buildSegments(toTripInput(trip));
  const riders = currentRiders(trip);
  const others = trip.members.filter((m) => m.id !== trip.driverId);

  const setTime = (index: number, time: string): void => {
    const target = sorted[index];
    if (!target) return;
    const base = new Date(target.at);
    const [h, m] = time.split(':');
    base.setHours(Number(h), Number(m), 0, 0);
    const at = base.toISOString();
    onChange({
      ...trip,
      events: trip.events.map((e) => (e === target ? { ...e, at } : e)),
    });
  };

  const remove = (index: number): void => {
    const target = sorted[index];
    if (!target || target.type === 'depart' || target.type === 'arrive') return;
    onChange({ ...trip, events: trip.events.filter((e) => e !== target) });
  };

  const addEvent = (event: TripEvent): void => {
    onChange({ ...trip, events: [...trip.events, event] });
  };

  // 새 기록은 여행 한가운데 시각으로 넣고, 사용자가 시각을 고친다.
  const middle = (() => {
    const depart = sorted.find((e) => e.type === 'depart')?.at;
    const arrive = sorted.find((e) => e.type === 'arrive')?.at;
    if (!depart || !arrive) return new Date().toISOString();
    return new Date((Date.parse(depart) + Date.parse(arrive)) / 2).toISOString();
  })();

  return (
    <Screen
      title="여행 타임라인"
      sub="깜빡한 기록을 지금 넣어도 됩니다"
      onBack={onBack}
      bottom={
        <button type="button" className="btn btn--primary" onClick={onBack}>
          확인
        </button>
      }
    >
      <Card label="기록">
        {sorted.map((event, index) => (
          <div key={`${event.type}-${event.at}-${String(index)}`} className="row">
            <span>
              <input
                type="time"
                value={clock(event.at)}
                style={{ minHeight: 44, marginRight: 8 }}
                onChange={(e) => {
                  setTime(index, e.target.value);
                }}
              />
              {label(trip, event)}
            </span>
            {event.type !== 'depart' && event.type !== 'arrive' ? (
              <button
                type="button"
                className="btn btn--ghost"
                aria-label="기록 지우기"
                onClick={() => {
                  remove(index);
                }}
              >
                ✕
              </button>
            ) : null}
          </div>
        ))}
      </Card>

      <Card label="기록 추가">
        <div className="chips">
          {others.map((m) => (
            <button
              key={`drop-${m.id}`}
              type="button"
              className="chip"
              disabled={!riders.includes(m.id)}
              onClick={() => {
                addEvent({ type: 'dropoff', at: middle, memberId: m.id });
              }}
            >
              🚪 {m.name} 하차
            </button>
          ))}
          {others.map((m) => (
            <button
              key={`swap-${m.id}`}
              type="button"
              className="chip"
              onClick={() => {
                addEvent({ type: 'driverChange', at: middle, driverId: m.id });
              }}
            >
              🔄 {m.name} 교대
            </button>
          ))}
          <button
            type="button"
            className="chip"
            onClick={() => {
              addEvent({
                type: 'rest',
                at: middle,
                endAt: new Date(Date.parse(middle) + 20 * 60000).toISOString(),
              });
            }}
          >
            ☕ 휴식 20분
          </button>
        </div>
      </Card>

      <Card label="자동으로 나뉜 구간">
        {segments.map((s) => (
          <div key={s.index} className="split">
            <span>
              구간 {s.index + 1} · {clock(s.startAt)}–{clock(s.endAt)}
            </span>
            <span className="dim">
              {km(s.distanceM)} · {duration(s.driveMinutes)} · {s.passengerIds.length}명
            </span>
          </div>
        ))}
        <p className="screen__sub">
          하차 장소를 고르면 경로를 다시 조회해 구간 거리를 확정합니다. 장소 검색은 다음 단계에서.
        </p>
      </Card>
    </Screen>
  );
}
