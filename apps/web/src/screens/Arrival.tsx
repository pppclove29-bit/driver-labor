// S9 도착 요약. 앱이 자동으로 채운 값을 한 장으로 보여주고, 사용자는 "정산하기"만 누르면 된다.

import { buildSegments, computeDifficulty, settleTrip } from '@dl/calc';
import type { FeelScore, Weather } from '@dl/calc';

import { duration, won } from '../model/format.js';
import { memberName, toTripInput } from '../model/trip.js';
import type { AppTrip } from '../model/trip.js';
import { Card, Chip, Screen } from '../ui/parts.jsx';

/** 도착 요약의 체감 3단계는 1·3·5점으로 저장한다 (해석 7). */
const FEEL_CHIPS: { score: FeelScore; label: string }[] = [
  { score: 1, label: '할 만했어요' },
  { score: 3, label: '보통' },
  { score: 5, label: '힘들었어요' },
];

const WEATHER_CHIPS: { id: Weather; label: string }[] = [
  { id: 'clear', label: '맑음' },
  { id: 'rain', label: '비·눈' },
];

export function Arrival({
  trip,
  onChange,
  onSettle,
  onBack,
  onOpenPenalties,
  onOpenDifficulty,
  onOpenTimeline,
}: {
  trip: AppTrip;
  onChange: (next: AppTrip) => void;
  onSettle: () => void;
  onBack: () => void;
  onOpenPenalties: () => void;
  onOpenDifficulty: () => void;
  onOpenTimeline: () => void;
}) {
  const input = toTripInput(trip);
  const segments = buildSegments(input);
  const result = settleTrip(input);

  const driveMinutes = segments.reduce((a, s) => a + s.driveMinutes, 0);
  const penaltyCount = trip.penalties.filter((p) => !p.forgiven).length;
  const maxDifficulty = Math.max(...result.segments.map((s) => s.difficulty), 1);
  const topFactor = (() => {
    const worst = segments
      .map((s) => computeDifficulty(s, input, segments))
      .sort((a, b) => b.coefficient - a.coefficient)[0];
    if (!worst) return undefined;
    const factors: [string, number][] = [
      ['정체', worst.congestion],
      ['야간', worst.night],
      ['연속 운전', worst.continuous],
      ['도로', worst.roadType],
      ['기상', worst.weather],
      ['체감', worst.feel],
    ];
    return factors.sort((a, b) => b[1] - a[1])[0];
  })();

  return (
    <Screen
      title="도착했어요"
      sub={`${trip.origin} → ${trip.destination}`}
      onBack={onBack}
      bottom={
        <button type="button" className="btn btn--primary" onClick={onSettle}>
          정산하기
        </button>
      }
    >
      <Card label="자동으로 채운 값">
        <div className="split">
          <span>
            운전 시간{' '}
            {trip.timeSource === 'manual' ? <span className="tag">✎ 직접 입력</span> : null}
          </span>
          <span className="big">{duration(driveMinutes)}</span>
        </div>
        <button type="button" className="row" onClick={onOpenTimeline}>
          <span>구간</span>
          <span>{segments.length}개 · 타임라인 ›</span>
        </button>
        <div className="split">
          <span>탑승</span>
          <span>{trip.members.length}명</span>
        </div>
        <button type="button" className="row" onClick={onOpenPenalties}>
          <span>괘씸 기록</span>
          <span className={penaltyCount > 0 ? 'penalty' : 'dim'}>{penaltyCount}건 보기 ›</span>
        </button>
        <button type="button" className="row" onClick={onOpenDifficulty}>
          <span>난이도</span>
          <span>
            {maxDifficulty.toFixed(2)}
            {topFactor && topFactor[1] > 0 ? (
              <span className="dim"> · {topFactor[0]} 가장 큼</span>
            ) : null}{' '}
            상세 ›
          </span>
        </button>
      </Card>

      <Card label="날씨">
        <div className="chips">
          {WEATHER_CHIPS.map((w) => (
            <Chip
              key={w.id}
              selected={trip.weather === w.id}
              onClick={() => {
                onChange({ ...trip, weather: w.id });
              }}
            >
              {w.label}
            </Chip>
          ))}
        </div>
        <p className="screen__sub">위치 기반 기상 조회는 하지 않습니다.</p>
      </Card>

      <Card label="운전자 체감">
        <div className="chips">
          {FEEL_CHIPS.map((f) => (
            <Chip
              key={f.score}
              selected={trip.feelScore === f.score}
              onClick={() => {
                onChange({ ...trip, feelScore: f.score });
              }}
            >
              {f.label}
            </Chip>
          ))}
        </div>
      </Card>

      <Card label="미리 보기">
        <div className="split">
          <span>{memberName(trip, trip.driverId)}가 받을 돈</span>
          <span className="big">
            {won(
              Math.max(
                0,
                result.members.find((m) => m.memberId === trip.driverId)?.balanceWon ?? 0,
              ),
            )}
          </span>
        </div>
      </Card>
    </Screen>
  );
}
