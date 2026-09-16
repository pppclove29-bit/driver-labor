// S7 결제 기록(축소판). 누가 무엇을 냈는지 받아 "낸 돈"으로 반영한다.
// 주유소 검색·정밀 모드(탱크 잔량 가중평균)는 M5에서 붙인다.

import { fuelPaymentWon } from '@dl/calc';
import type { MemberId, PaymentKind } from '@dl/calc';
import { useState } from 'react';

import { currentRiders, memberName } from '../model/trip.js';
import type { AppTrip } from '../model/trip.js';
import { Card, Screen } from '../ui/parts.jsx';

const KINDS: { id: PaymentKind; label: string }[] = [
  { id: 'fuel', label: '주유' },
  { id: 'toll', label: '통행료' },
  { id: 'parking', label: '주차' },
  { id: 'etc', label: '기타' },
];

export function PaymentSheet({
  trip,
  onBack,
  onSave,
}: {
  trip: AppTrip;
  onBack: () => void;
  onSave: (next: AppTrip) => void;
}) {
  const riders = currentRiders(trip);
  const [kind, setKind] = useState<PaymentKind>('fuel');
  const [payerId, setPayerId] = useState<MemberId>(trip.driverId);
  const [amount, setAmount] = useState('');
  const [liters, setLiters] = useState('');
  const [unitPrice, setUnitPrice] = useState('');

  const amountWon = Number(amount.replace(/[^0-9]/g, ''));
  const litersNum = Number(liters);
  const unitPriceNum = Number(unitPrice);
  const fuelComputed = kind === 'fuel' && litersNum > 0 && unitPriceNum > 0;
  const finalAmount =
    fuelComputed && amountWon === 0 ? fuelPaymentWon(litersNum, unitPriceNum) : amountWon;
  const canSave = finalAmount > 0;

  const save = (): void => {
    const now = new Date().toISOString();
    const next: AppTrip = {
      ...trip,
      payments: [
        ...trip.payments,
        {
          id: `pay${String(Date.now())}`,
          kind,
          payerId,
          amountWon: finalAmount,
          at: now,
        },
      ],
    };
    // 주유 단가는 이후 구간 유류비에 적용된다.
    if (fuelComputed) {
      next.events = [
        ...trip.events,
        { type: 'refuel', at: now, liters: litersNum, unitPriceWon: unitPriceNum },
      ];
    }
    onSave(next);
  };

  return (
    <Screen
      title="결제 기록"
      onBack={onBack}
      bottom={
        <button type="button" className="btn btn--primary" disabled={!canSave} onClick={save}>
          기록하기
        </button>
      }
    >
      <Card label="무엇을 냈나요">
        <div className="chips">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className="chip"
              aria-pressed={kind === k.id}
              onClick={() => {
                setKind(k.id);
              }}
            >
              {k.label}
            </button>
          ))}
        </div>
      </Card>

      {kind === 'fuel' ? (
        <Card label="주유">
          <div className="field">
            <input
              inputMode="decimal"
              placeholder="주유량 (L)"
              value={liters}
              onChange={(e) => {
                setLiters(e.target.value);
              }}
            />
            <input
              inputMode="numeric"
              placeholder="단가 (원/L)"
              value={unitPrice}
              onChange={(e) => {
                setUnitPrice(e.target.value);
              }}
            />
          </div>
          <p className="screen__sub">
            단가를 넣으면 이후 구간 기름값에 적용됩니다. 주유소 검색은 다음 단계에서.
          </p>
        </Card>
      ) : null}

      <Card label="금액">
        <div className="field">
          <input
            inputMode="numeric"
            placeholder={
              fuelComputed ? String(fuelPaymentWon(litersNum, unitPriceNum)) : '금액 (원)'
            }
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
            }}
          />
        </div>
      </Card>

      <Card label="누가 냈나요">
        <div className="chips">
          {riders.map((id) => (
            <button
              key={id}
              type="button"
              className="chip"
              aria-pressed={payerId === id}
              onClick={() => {
                setPayerId(id);
              }}
            >
              {memberName(trip, id)}
            </button>
          ))}
        </div>
      </Card>

      {trip.payments.length > 0 ? (
        <Card label="지금까지">
          {trip.payments.map((p) => (
            <div key={p.id} className="row">
              <span>
                {KINDS.find((k) => k.id === p.kind)?.label} · {memberName(trip, p.payerId)} 결제
              </span>
              <span>{p.amountWon.toLocaleString('ko-KR')}원</span>
            </div>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
