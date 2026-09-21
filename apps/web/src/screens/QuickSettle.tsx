// S3 빠른 정산. 여행 중 앱을 못 켰거나 기록이 귀찮았던 여행을 위한 입구.
// 기록이 없다는 이유로 정산을 포기하지 않게 한다.

import { useState } from 'react';

import type { PlaceRef } from '../api/client.js';
import { newTrip } from '../model/trip.js';
import type { AppTrip } from '../model/trip.js';
import { Card, Chip, Screen } from '../ui/parts.jsx';
import { PlaceSearch } from '../ui/PlaceSearch.jsx';

const REST_CHIPS = [
  { minutes: 0, label: '안 쉼' },
  { minutes: 20, label: '20분' },
  { minutes: 40, label: '40분' },
];

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

function todayAt(time: string, date: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function QuickSettle({
  origin,
  originPlace,
  onBack,
  onSettle,
}: {
  origin: string;
  originPlace?: PlaceRef | undefined;
  onBack: () => void;
  onSettle: (trip: AppTrip) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [destination, setDestination] = useState('');
  const [destinationPlace, setDestinationPlace] = useState<PlaceRef>();
  const [date, setDate] = useState(today);
  const [departTime, setDepartTime] = useState('09:00');
  const [arriveTime, setArriveTime] = useState('12:00');
  const [people, setPeople] = useState(2);
  const [restMinutes, setRestMinutes] = useState(0);

  const departAt = todayAt(departTime, date);
  const arriveAt = todayAt(arriveTime, date);
  const valid = destination.trim().length > 0 && arriveAt > departAt;

  const settle = (): void => {
    const trip = newTrip({
      id: `t${String(Date.now())}`,
      now: departAt,
      origin,
      destination: destination.trim(),
      originPlace,
      destinationPlace,
      driverName: '나',
      // 이름 대신 동승자 A, B, C로 만든다. 이름은 결과 화면에서 바꾼다.
      companionNames: Array.from(
        { length: Math.max(0, people - 1) },
        (_, i) => `동승자 ${LETTERS[i] ?? String(i)}`,
      ),
    });
    if (restMinutes > 0) {
      const restStart = new Date(new Date(arriveAt).getTime() - restMinutes * 60000).toISOString();
      trip.events.push({ type: 'rest', at: restStart, endAt: arriveAt });
    }
    trip.events.push({ type: 'arrive', at: arriveAt });
    trip.status = 'settled';
    // 사람이 넣은 시각이라 결과에 "직접 입력"으로 표시한다.
    trip.timeSource = 'manual';
    trip.settledAt = new Date().toISOString();
    onSettle(trip);
  };

  return (
    <Screen
      title="빠른 정산"
      sub="기록을 안 한 여행도 4개만 넣으면 정산됩니다"
      onBack={onBack}
      bottom={
        <button type="button" className="btn btn--primary" disabled={!valid} onClick={settle}>
          정산하기
        </button>
      }
    >
      <Card label="어디로 갔나요">
        <PlaceSearch
          value={destination}
          place={destinationPlace}
          placeholder="도착지"
          onChange={(text, place) => {
            setDestination(text);
            setDestinationPlace(place);
          }}
        />
      </Card>

      <Card label="몇 명이 탔나요">
        <div className="split">
          <span className="big">{people}명</span>
          <span className="chips">
            <button
              type="button"
              className="chip"
              onClick={() => {
                setPeople((n) => Math.max(1, n - 1));
              }}
            >
              −
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => {
                setPeople((n) => Math.min(10, n + 1));
              }}
            >
              +
            </button>
          </span>
        </div>
        <p className="screen__sub">운전자는 나. 이름은 결과 화면에서 바꿉니다.</p>
      </Card>

      <Card label="언제">
        <div className="field">
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
            }}
          />
          <div className="split">
            <input
              type="time"
              value={departTime}
              onChange={(e) => {
                setDepartTime(e.target.value);
              }}
            />
            <span className="dim">→</span>
            <input
              type="time"
              value={arriveTime}
              onChange={(e) => {
                setArriveTime(e.target.value);
              }}
            />
          </div>
        </div>
        {!valid && destination.trim().length > 0 ? (
          <p className="screen__sub">도착이 출발보다 빨라요.</p>
        ) : null}
      </Card>

      <Card label="휴식">
        <div className="chips">
          {REST_CHIPS.map((r) => (
            <Chip
              key={r.minutes}
              selected={restMinutes === r.minutes}
              onClick={() => {
                setRestMinutes(r.minutes);
              }}
            >
              {r.label}
            </Chip>
          ))}
        </div>
      </Card>
    </Screen>
  );
}
