// S9c 여행 타임라인. 여행 중 누른 기록을 시간순으로 보여주고, 깜빡한 기록을 도착 후에 넣는다.
// 지도·현재 위치는 쓰지 않는다 (0원·서버 최소 정보 원칙).

import type { TripEvent } from '@dl/calc';
import { buildSegments } from '@dl/calc';
import { useState } from 'react';

import type { PlaceRef } from '../api/client.js';
import { clock, duration, km, won } from '../model/format.js';
import { boundaryKey } from '../model/lookup.js';
import { currentRiders, memberName, toTripInput } from '../model/trip.js';
import type { AppTrip } from '../model/trip.js';
import { Card, Screen } from '../ui/parts.jsx';
import { PlaceSearch } from '../ui/PlaceSearch.jsx';

/** 구간 경계가 되는 기록. 여기에만 장소를 붙인다. */
const isBoundary = (e: TripEvent): boolean =>
  e.type === 'dropoff' || e.type === 'pickup' || e.type === 'driverChange';

/** 경계 장소를 새 키로 옮기거나 지운다. */
function movePlace(trip: AppTrip, fromAt: string, toAt: string | null): AppTrip {
  const places = { ...(trip.boundaryPlaces ?? {}) };
  const place = places[boundaryKey(fromAt)];
  if (!place) return trip;
  delete places[boundaryKey(fromAt)];
  if (toAt) places[boundaryKey(toAt)] = place;
  return { ...trip, boundaryPlaces: places };
}

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
  onPlacesChange,
  onOpenPayment,
  onBack,
}: {
  trip: AppTrip;
  onChange: (next: AppTrip) => void;
  /** 경계 장소나 경계 시각이 바뀌면 구간별 재조회(또는 재조회 값 지우기). */
  onPlacesChange: (next: AppTrip) => void;
  onOpenPayment: () => void;
  onBack: () => void;
}) {
  const [restMinutes, setRestMinutes] = useState(20);
  const [searching, setSearching] = useState<string>();
  const [query, setQuery] = useState('');
  const canRequery = Boolean(trip.originPlace && trip.destinationPlace);

  /** 저장하고, 경계 장소가 걸려 있으면 재조회. */
  const commit = (next: AppTrip, placesTouched: boolean): void => {
    onChange(next);
    if (placesTouched) onPlacesChange(next);
  };

  const pickPlace = (at: string, place: PlaceRef): void => {
    setSearching(undefined);
    setQuery('');
    commit({ ...trip, boundaryPlaces: { ...trip.boundaryPlaces, [boundaryKey(at)]: place } }, true);
  };

  const clearPlace = (at: string): void => {
    commit(movePlace(trip, at, null), true);
  };
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
    const moved = isBoundary(target) ? movePlace(trip, target.at, at) : trip;
    commit(
      { ...moved, events: trip.events.map((e) => (e === target ? { ...e, at } : e)) },
      isBoundary(target) && Boolean(trip.boundaryPlaces || trip.segmentRoutes),
    );
  };

  const remove = (index: number): void => {
    const target = sorted[index];
    if (!target || target.type === 'depart' || target.type === 'arrive') return;
    const moved = isBoundary(target) ? movePlace(trip, target.at, null) : trip;
    commit(
      { ...moved, events: trip.events.filter((e) => e !== target) },
      isBoundary(target) && Boolean(trip.boundaryPlaces || trip.segmentRoutes),
    );
  };

  const addEvent = (event: TripEvent): void => {
    // 경계가 늘면 재조회 값의 구간 수가 맞지 않으므로 다시 판단한다.
    commit(
      { ...trip, events: [...trip.events, event] },
      isBoundary(event) && Boolean(trip.segmentRoutes),
    );
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
        {sorted.map((event, index) => {
          const key = `${event.type}-${event.at}-${String(index)}`;
          const place = isBoundary(event)
            ? trip.boundaryPlaces?.[boundaryKey(event.at)]
            : undefined;
          return (
            <div key={key}>
              <div className="row">
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
              {isBoundary(event) && canRequery ? (
                <div className="chips" style={{ margin: '6px 0' }}>
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={Boolean(place)}
                    onClick={() => {
                      setSearching(searching === key ? undefined : key);
                      setQuery('');
                    }}
                  >
                    📍 {place ? place.name : '장소 고르기'}
                  </button>
                  {place ? (
                    <button
                      type="button"
                      className="chip"
                      onClick={() => {
                        clearPlace(event.at);
                      }}
                    >
                      장소 지우기
                    </button>
                  ) : null}
                </div>
              ) : null}
              {searching === key ? (
                <PlaceSearch
                  value={query}
                  placeholder="휴게소·역 이름"
                  onChange={(text, picked) => {
                    if (picked) pickPlace(event.at, picked);
                    else setQuery(text);
                  }}
                />
              ) : null}
            </div>
          );
        })}
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
                endAt: new Date(Date.parse(middle) + restMinutes * 60000).toISOString(),
              });
            }}
          >
            ☕ 휴식 {restMinutes}분 넣기
          </button>
          <span className="chips">
            <input
              inputMode="numeric"
              value={String(restMinutes)}
              style={{ width: 80 }}
              aria-label="휴식 분"
              onChange={(e) => {
                setRestMinutes(Math.max(0, Number(e.target.value.replace(/[^0-9]/g, ''))));
              }}
            />
            <span className="dim">분</span>
          </span>
          <button type="button" className="chip" onClick={onOpenPayment}>
            💳 결제 기록
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
          휴게소에서 쉰 시간은 운전 시간에서 빠집니다. 기름값·통행료를 누가 냈는지도 여기서
          넣습니다.
        </p>
        <p className="screen__sub">
          {!canRequery
            ? '출발지·도착지를 목록에서 고른 여행만 구간 경로를 다시 조회할 수 있어요. 지금은 운전 시간 비율로 거리를 나눕니다.'
            : trip.segmentRoutes?.length === segments.length
              ? '하차 장소로 구간 경로를 다시 조회했어요.'
              : '하차·합류·교대 장소를 모두 고르면 구간 경로를 다시 조회해 거리를 확정합니다. 고르지 않으면 운전 시간 비율로 나눕니다.'}
        </p>
      </Card>
    </Screen>
  );
}
