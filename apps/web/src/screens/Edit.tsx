// S10c 고치기. 출발 전에 묻지 않은 값을 결과를 보면서 고치는 곳.
// 값마다 출처를 표시한다: 기본값(앱이 가정) · 자동(기록에서) · 직접 입력(사용자가 고침).

import { useState } from 'react';

import { km, won } from '../model/format.js';
import { LOOKUP_LIMIT_MESSAGE, routeNotice } from '../model/lookup.js';
import { memberName } from '../model/trip.js';
import type { AppTrip } from '../model/trip.js';
import { Card, DefaultTag, Screen } from '../ui/parts.jsx';

/** 거리·통행료를 직접 고치면 구간 재조회 값을 버리고 운전 시간 비율 배분으로 되돌린다. */
function dropSegmentRoutes(trip: AppTrip): AppTrip {
  const next = { ...trip };
  delete next.segmentRoutes;
  return next;
}

function Source({ kind }: { kind: 'default' | 'auto' | 'manual' }) {
  if (kind === 'default') return <DefaultTag />;
  if (kind === 'auto') return <span className="tag">자동</span>;
  return <span className="tag">✎ 직접 입력</span>;
}

interface NumberFieldProps {
  label: string;
  value: number;
  suffix: string;
  source: 'default' | 'auto' | 'manual';
  onChange: (value: number) => void;
}

function NumberField({ label, value, suffix, source, onChange }: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  return (
    <div className="field" style={{ marginBottom: 12 }}>
      <label className="card__label">
        {label} <Source kind={source} />
      </label>
      <div className="split">
        <input
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const next = Number(e.target.value.replace(/[^0-9.]/g, ''));
            if (Number.isFinite(next) && next > 0) onChange(next);
          }}
        />
        <span className="dim">{suffix}</span>
      </div>
    </div>
  );
}

export function Edit({
  trip,
  onChange,
  onBack,
}: {
  trip: AppTrip;
  onChange: (next: AppTrip) => void;
  onBack: () => void;
}) {
  const edited = (next: AppTrip): AppTrip => ({ ...next, editedAt: new Date().toISOString() });
  const touched = new Set(trip.editedFields ?? []);
  const mark = (field: string): string[] => [...new Set([...touched, field])];

  const sourceOf = (field: string, fallback: 'default' | 'auto'): 'default' | 'auto' | 'manual' =>
    touched.has(field) ? 'manual' : fallback;
  // 경로를 조회했으면 거리·통행료·택시요금은 "자동".
  const routeSource = trip.routeSource ? 'auto' : 'default';

  return (
    <Screen
      title="고치기"
      sub="고치면 금액이 바로 바뀝니다"
      onBack={onBack}
      bottom={
        <button type="button" className="btn btn--primary" onClick={onBack}>
          결과로 돌아가기
        </button>
      }
    >
      <Card label="이름">
        {trip.members.map((m) => (
          <div key={m.id} className="field" style={{ marginBottom: 10 }}>
            <input
              value={m.name}
              onChange={(e) => {
                onChange(
                  edited({
                    ...trip,
                    members: trip.members.map((x) =>
                      x.id === m.id ? { ...x, name: e.target.value } : x,
                    ),
                    editedFields: mark('names'),
                  }),
                );
              }}
            />
          </div>
        ))}
      </Card>

      <Card label="거리와 경로">
        {routeNotice(trip) === 'limit' ? (
          <div className="note" style={{ marginBottom: 12 }}>
            {LOOKUP_LIMIT_MESSAGE}
          </div>
        ) : null}
        <NumberField
          label="여행 거리"
          value={trip.route.distanceM / 1000}
          suffix="km"
          source={sourceOf('distance', routeSource)}
          onChange={(value) => {
            onChange(
              edited({
                ...dropSegmentRoutes(trip),
                route: { ...trip.route, distanceM: Math.round(value * 1000) },
                editedFields: mark('distance'),
              }),
            );
          }}
        />
        <NumberField
          label="통행료"
          value={trip.route.tollWon}
          suffix="원"
          source={sourceOf('toll', routeSource)}
          onChange={(value) => {
            onChange(
              edited({
                ...dropSegmentRoutes(trip),
                route: { ...trip.route, tollWon: Math.round(value) },
                editedFields: mark('toll'),
              }),
            );
          }}
        />
        <NumberField
          label="택시 예상요금"
          value={trip.route.taxiFareWon}
          suffix="원"
          source={sourceOf('taxi', routeSource)}
          onChange={(value) => {
            onChange(
              edited({
                ...dropSegmentRoutes(trip),
                route: { ...trip.route, taxiFareWon: Math.round(value) },
                editedFields: mark('taxi'),
              }),
            );
          }}
        />
        <p className="screen__sub">
          거리를 고치면 구간 거리 비율도 다시 계산됩니다. 지금은 {km(trip.route.distanceM)} ·{' '}
          {won(trip.route.tollWon)}.
        </p>
      </Card>

      <Card label="차량과 기준">
        <NumberField
          label="연비"
          value={trip.settings.fuelEfficiencyKmPerL}
          suffix="km/L"
          source={sourceOf('efficiency', 'default')}
          onChange={(value) => {
            onChange(
              edited({
                ...trip,
                settings: { ...trip.settings, fuelEfficiencyKmPerL: value },
                editedFields: mark('efficiency'),
              }),
            );
          }}
        />
        <NumberField
          label="기준 시급"
          value={trip.settings.hourlyWageWon}
          suffix="원"
          source={sourceOf('wage', 'default')}
          onChange={(value) => {
            onChange(
              edited({
                ...trip,
                settings: { ...trip.settings, hourlyWageWon: Math.round(value) },
                editedFields: mark('wage'),
              }),
            );
          }}
        />
        <NumberField
          label="유가"
          value={trip.fuelUnitPriceWon}
          suffix="원/L"
          source={sourceOf('fuelPrice', trip.fuelPriceAt ? 'auto' : 'default')}
          onChange={(value) => {
            onChange(
              edited({
                ...trip,
                fuelUnitPriceWon: Math.round(value),
                editedFields: mark('fuelPrice'),
              }),
            );
          }}
        />
      </Card>

      <Card label="노동비 방식">
        <div className="chips">
          <button
            type="button"
            className="chip"
            aria-pressed={trip.settings.laborMethod === 'hourly'}
            onClick={() => {
              onChange(
                edited({
                  ...trip,
                  settings: { ...trip.settings, laborMethod: 'hourly' },
                  editedFields: mark('laborMethod'),
                }),
              );
            }}
          >
            시급형
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={trip.settings.laborMethod === 'taxi'}
            onClick={() => {
              onChange(
                edited({
                  ...trip,
                  settings: { ...trip.settings, laborMethod: 'taxi' },
                  editedFields: mark('laborMethod'),
                }),
              );
            }}
          >
            택시형
          </button>
        </div>
        <p className="screen__sub">택시형은 (택시 예상요금 − 공통비)의 30%를 수고비로 봅니다.</p>
      </Card>

      <Card label="괘씸 반영">
        <div className="chips">
          <button
            type="button"
            className="chip"
            aria-pressed={trip.settings.penaltyMode === 'additive'}
            onClick={() => {
              onChange(
                edited({
                  ...trip,
                  settings: { ...trip.settings, penaltyMode: 'additive' },
                  editedFields: mark('penaltyMode'),
                }),
              );
            }}
          >
            가산형
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={trip.settings.penaltyMode === 'redistribute'}
            onClick={() => {
              onChange(
                edited({
                  ...trip,
                  settings: { ...trip.settings, penaltyMode: 'redistribute' },
                  editedFields: mark('penaltyMode'),
                }),
              );
            }}
          >
            재분배형
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={!trip.settings.penaltyEnabled}
            onClick={() => {
              onChange(
                edited({
                  ...trip,
                  settings: { ...trip.settings, penaltyEnabled: !trip.settings.penaltyEnabled },
                  editedFields: mark('penaltyMode'),
                }),
              );
            }}
          >
            괘씸모드 끄기
          </button>
        </div>
      </Card>

      <Card label="운전자">
        <div className="chips">
          {trip.members.map((m) => (
            <button
              key={m.id}
              type="button"
              className="chip"
              aria-pressed={trip.driverId === m.id}
              onClick={() => {
                onChange(edited({ ...trip, driverId: m.id, editedFields: mark('driver') }));
              }}
            >
              {memberName(trip, m.id)}
            </button>
          ))}
        </div>
      </Card>
    </Screen>
  );
}
