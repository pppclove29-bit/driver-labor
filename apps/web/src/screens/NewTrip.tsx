// S2 새 여행. 출발 전 필수 입력은 도착지와 동승자 2개뿐이다.
// 여기에 필드를 더 추가하지 않는다 (CLAUDE.md 절대 규칙 5).

import { useState } from 'react';

import type { PlaceRef } from '../api/client.js';
import { Card, Chip, Screen } from '../ui/parts.jsx';
import { PlaceSearch } from '../ui/PlaceSearch.jsx';

const COMPANION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

export interface DepartParams {
  origin: string;
  destination: string;
  originPlace?: PlaceRef | undefined;
  destinationPlace?: PlaceRef | undefined;
  companions: string[];
}

export function NewTrip({
  origin,
  originPlace,
  recentCompanions,
  onBack,
  onDepart,
}: {
  origin: string;
  originPlace?: PlaceRef | undefined;
  recentCompanions: string[];
  onBack: () => void;
  onDepart: (params: DepartParams) => void;
}) {
  const [destination, setDestination] = useState('');
  const [destinationPlace, setDestinationPlace] = useState<PlaceRef>();
  const [from, setFrom] = useState(origin);
  const [fromPlace, setFromPlace] = useState<PlaceRef | undefined>(originPlace);
  const [picked, setPicked] = useState<string[]>([]);
  const [anonymous, setAnonymous] = useState(0);

  const companions = [
    ...picked,
    ...Array.from({ length: anonymous }, (_, i) => `동승자 ${COMPANION_LETTERS[i] ?? String(i)}`),
  ];
  const canDepart = destination.trim().length > 0;

  return (
    <Screen
      title="새 여행"
      sub="도착지와 동승자만 정하면 됩니다"
      onBack={onBack}
      bottom={
        <button
          type="button"
          className="btn btn--primary"
          disabled={!canDepart}
          onClick={() => {
            onDepart({
              origin: from.trim() || '집',
              destination: destination.trim(),
              originPlace: fromPlace,
              destinationPlace,
              companions,
            });
          }}
        >
          출발
        </button>
      }
    >
      <Card label="어디로 가나요">
        <PlaceSearch
          value={destination}
          place={destinationPlace}
          placeholder="도착지"
          onChange={(text, place) => {
            setDestination(text);
            setDestinationPlace(place);
          }}
        />
        {!canDepart ? <p className="screen__sub">어디로 가는지 알려주세요.</p> : null}
      </Card>

      <Card label="출발지">
        <PlaceSearch
          value={from}
          place={fromPlace}
          placeholder="집"
          onChange={(text, place) => {
            setFrom(text);
            setFromPlace(place);
          }}
        />
        <p className="screen__sub">
          기기 현재 위치로 채우지 않습니다. 출발지와 도착지를 목록에서 고르면 경로를 조회합니다.
        </p>
      </Card>

      <Card label="같이 가는 사람">
        <div className="chips">
          {recentCompanions.map((name) => (
            <Chip
              key={name}
              selected={picked.includes(name)}
              onClick={() => {
                setPicked((prev) =>
                  prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
                );
              }}
            >
              {name}
            </Chip>
          ))}
          <button
            type="button"
            className="chip"
            onClick={() => {
              setAnonymous((n) => Math.min(n + 1, COMPANION_LETTERS.length));
            }}
          >
            +1명
          </button>
          {anonymous > 0 ? (
            <button
              type="button"
              className="chip"
              onClick={() => {
                setAnonymous((n) => Math.max(0, n - 1));
              }}
            >
              −1명
            </button>
          ) : null}
        </div>
        <p className="screen__sub">
          {companions.length > 0
            ? `나 + ${companions.join(', ')}`
            : '아무도 안 고르면 나 혼자 기록합니다. 이름은 결과 화면에서 바꿉니다.'}
        </p>
      </Card>

      <Card label="기본값">
        <p className="screen__sub">
          휘발유 12km/L · 시급형 10,320원 · 괘씸모드 켜짐 · 가산형. 결과 화면에서 고칩니다.
        </p>
      </Card>
    </Screen>
  );
}
