// S9b 난이도 상세. 어떤 요소가 얼마를 올렸는지 막대로 보여준다.
// 급제동·급가속 같은 운전 행동 지표는 표시하지 않는다(거친 운전이 더 받는 역보상을 막는다).

import { buildSegments, computeDifficulty } from '@dl/calc';
import type { FeelScore } from '@dl/calc';

import { duration } from '../model/format.js';
import { toTripInput } from '../model/trip.js';
import type { AppTrip } from '../model/trip.js';
import { Card, Chip, Screen } from '../ui/parts.jsx';

const FEEL_LABELS: Record<FeelScore, string> = {
  1: '아주 편함',
  2: '편함',
  3: '보통',
  4: '힘듦',
  5: '아주 힘듦',
};

/** 요소별 최대치. 막대 길이는 최대치 대비 비율이다. */
const MAX = {
  congestion: 0.3,
  night: 0.3,
  continuous: 0.2,
  roadType: 0.1,
  weather: 0.2,
  feel: 0.1,
};

export function Difficulty({
  trip,
  onChange,
  onBack,
}: {
  trip: AppTrip;
  onChange: (next: AppTrip) => void;
  onBack: () => void;
}) {
  const input = toTripInput(trip);
  const segments = buildSegments(input);

  return (
    <Screen
      title="운전 난이도"
      sub="길이 얼마나 어려웠는지만 잽니다"
      onBack={onBack}
      bottom={
        <button type="button" className="btn btn--primary" onClick={onBack}>
          확인
        </button>
      }
    >
      <Card label="기상">
        <div className="chips">
          <Chip
            selected={trip.weather === 'clear'}
            onClick={() => {
              onChange({ ...trip, weather: 'clear' });
            }}
          >
            맑음
          </Chip>
          <Chip
            selected={trip.weather === 'rain'}
            onClick={() => {
              onChange({ ...trip, weather: 'rain' });
            }}
          >
            비·눈 (+0.2)
          </Chip>
        </div>
        <p className="screen__sub">위치 기반 기상 조회는 하지 않습니다.</p>
      </Card>

      <Card label="운전자 체감">
        <div className="chips">
          {([1, 2, 3, 4, 5] as FeelScore[]).map((score) => (
            <Chip
              key={score}
              selected={trip.feelScore === score}
              onClick={() => {
                onChange({ ...trip, feelScore: score });
              }}
            >
              {FEEL_LABELS[score]}
            </Chip>
          ))}
        </div>
      </Card>

      {segments.map((segment) => {
        const d = computeDifficulty(segment, input, segments);
        const override = trip.segmentDifficulty?.[segment.index];
        const factors: { label: string; value: number; max: number; hint?: string }[] = [
          {
            label: '정체',
            value: d.congestion,
            max: MAX.congestion,
            hint: `실제 ${duration(segment.driveMinutes)} / 예상 ${duration(segment.expectedMinutes)}`,
          },
          { label: '야간', value: d.night, max: MAX.night, hint: `${String(d.nightMinutes)}분` },
          {
            label: '연속 운전',
            value: d.continuous,
            max: MAX.continuous,
            hint: `2시간 초과 ${String(d.continuousExcessMinutes)}분`,
          },
          { label: '도로 유형', value: d.roadType, max: MAX.roadType },
          { label: '기상', value: d.weather, max: MAX.weather },
          { label: '체감', value: d.feel, max: MAX.feel },
        ].sort((a, b) => b.value - a.value);

        return (
          <Card key={segment.index} label={`구간 ${segment.index + 1}`}>
            <div className="split">
              <span>난이도 계수</span>
              <span className="big">
                {(override ?? d.coefficient).toFixed(2)}
                {override !== undefined ? <span className="tag"> 직접 입력</span> : null}
              </span>
            </div>
            {factors
              .filter((f) => f.value !== 0)
              .map((f) => (
                <div key={f.label} style={{ margin: '6px 0' }}>
                  <div className="split">
                    <span>
                      {f.label}
                      {f.hint ? <span className="dim"> · {f.hint}</span> : null}
                    </span>
                    <span>
                      {f.value > 0 ? '+' : '−'}
                      {Math.abs(f.value).toFixed(2)}
                    </span>
                  </div>
                  <div
                    aria-hidden
                    style={{
                      height: 6,
                      borderRadius: 3,
                      background: 'var(--line)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${String(Math.min(100, (Math.abs(f.value) / f.max) * 100))}%`,
                        height: '100%',
                        background: f.value > 0 ? 'var(--warn)' : 'var(--credit)',
                      }}
                    />
                  </div>
                </div>
              ))}
            <p className="screen__sub">
              {factors
                .filter((f) => f.value === 0)
                .map((f) => f.label)
                .join(' · ')}{' '}
              0
            </p>
          </Card>
        );
      })}
    </Screen>
  );
}
