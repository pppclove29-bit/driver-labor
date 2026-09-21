// S10 정산 결과. 운전자가 받을 돈을 가장 크게 두고, 말투를 고르면 사유 문장이 바로 바뀐다.
// 금액은 말투와 무관하게 같다.

import { settleTrip } from '@dl/calc';
import { useState } from 'react';

import { resultBase } from '../config.js';
import { buildResultLink } from '../model/link.js';

import { duration, km, signedWon, won } from '../model/format.js';
import { LOOKUP_LIMIT_MESSAGE, LOOKUP_WAITING_MESSAGE, routeNotice } from '../model/lookup.js';
import { memberName, toTripInput } from '../model/trip.js';
import type { AppTrip, Tone } from '../model/trip.js';
import { justification, penaltyReason, receiptTitle, shareText, TONES } from '../model/tone.js';
import { AdCard } from '../ui/AdCard.jsx';
import { Card, DefaultTag, Screen } from '../ui/parts.jsx';

/** 계산 근거의 경로 출처. 두 회사의 택시요금·통행료 추정값은 조금 다를 수 있다. */
function sourceLabel(trip: AppTrip): string {
  if (trip.routeSource === 'kakao') return '카카오';
  if (trip.routeSource === 'tmap') return 'TMAP';
  return '기본값(운전 시간으로 어림)';
}

export function Result({
  trip,
  onChange,
  onHome,
  onEdit,
}: {
  trip: AppTrip;
  onChange: (next: AppTrip) => void;
  onHome: () => void;
  onEdit: () => void;
}) {
  const [showBasis, setShowBasis] = useState(false);
  const [copied, setCopied] = useState(false);
  const input = toTripInput(trip);
  const result = settleTrip(input);

  const driver = result.members.find((m) => m.memberId === trip.driverId);
  const others = result.members.filter((m) => m.memberId !== trip.driverId);
  const penalized = new Set(
    result.segments.flatMap((s) => s.laborShares.filter((x) => x.score > 0).map((x) => x.memberId)),
  );

  const setTone = (tone: Tone): void => {
    onChange({ ...trip, tone });
  };

  /** 사람별 괘씸 사유. 말투에 따라 문장만 바뀐다. */
  const reasonsFor = (memberId: string): string[] => {
    const out: string[] = [];
    for (const p of trip.penalties) {
      if (p.forgiven || p.memberId !== memberId) continue;
      out.push(penaltyReason(p.kind, trip.tone, p.minutes ?? 0, p.count ?? 1));
    }
    return out;
  };

  const share = async (): Promise<void> => {
    const url = await buildResultLink(trip, result, new Date().toISOString(), resultBase());
    const text = shareText(trip.tone, trip.destination, penalized.size);
    // 링크 발급 후 값을 고치면 예전 결과가 되므로 발급 시각을 남긴다.
    onChange({ ...trip, sharedAt: new Date().toISOString() });
    if (navigator.share) {
      await navigator.share({ text, url });
      return;
    }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    setCopied(true);
  };

  const note = justification(trip.tone);
  const edited = new Set(trip.editedFields ?? []);
  const defaultsLeft = [
    ...(edited.has('efficiency') ? [] : ['연비']),
    ...(edited.has('wage') ? [] : ['기준 시급']),
    ...(edited.has('distance') || trip.routeSource ? [] : ['거리']),
    ...(edited.has('toll') || trip.routeSource ? [] : ['통행료']),
    ...(edited.has('fuelPrice') || trip.fuelPriceAt ? [] : ['유가']),
  ];
  const overDistance =
    result.segments.reduce((a, s) => a + s.driveMinutes, 0) > input.route.expectedMinutes * 1.3;

  return (
    <Screen
      title={receiptTitle(trip.tone)}
      sub={`${trip.origin} → ${trip.destination} · 운전 ${memberName(trip, trip.driverId)}`}
      onBack={onHome}
      bottom={
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            void share();
          }}
        >
          {copied ? '링크를 복사했어요' : '결과 링크 공유'}
        </button>
      }
    >
      <Card label={`${memberName(trip, trip.driverId)}가 받을 돈`}>
        <p className="huge" style={{ margin: 0 }}>
          {won(driver?.balanceWon ?? 0)}
        </p>
        <p className="dim" style={{ margin: 0 }}>
          공통비 회수 {won((driver?.paidWon ?? 0) - (driver?.commonWon ?? 0))} + 수고비{' '}
          {won(-(driver?.laborWon ?? 0))}
        </p>
      </Card>

      <div className="chips">
        {TONES.map((t) => (
          <button
            key={t.id}
            type="button"
            className="chip"
            aria-pressed={trip.tone === t.id}
            onClick={() => {
              setTone(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card label="보낼 돈">
        {others.map((m) => {
          const reasons = reasonsFor(m.memberId);
          return (
            <div key={m.memberId} className="row" style={{ alignItems: 'flex-start' }}>
              <span>
                <span className="big">{memberName(trip, m.memberId)}</span>
                <br />
                <span className="dim">
                  공통비 {won(m.commonWon)} + 수고비 {won(m.laborWon)}
                </span>
                {reasons.length > 0 ? (
                  <>
                    <br />
                    <span className="penalty">{reasons.join(' · ')}</span>
                  </>
                ) : null}
              </span>
              <span className="big">{won(-m.balanceWon)}</span>
            </div>
          );
        })}
      </Card>

      <Card label="택시였다면">
        <div className="split">
          <span>택시 예상</span>
          <span>{won(result.totals.taxiFareWon)}</span>
        </div>
        <div className="split">
          <span>실제 총비용</span>
          <span>{won(result.totals.actualCostWon)}</span>
        </div>
        <div className="split">
          <span>{memberName(trip, trip.driverId)} 덕분에 아낀 돈</span>
          <span className="big">{won(result.totals.savedVsTaxiWon)}</span>
        </div>
      </Card>

      {result.assumedCommonWon > 0 ? (
        <p className="screen__sub">
          결제 기록이 없어 공통비 {won(result.assumedCommonWon)}을{' '}
          {memberName(trip, result.assumedCommonPayerId ?? trip.driverId)}가 낸 것으로 봤어요{' '}
          <DefaultTag />. 실제로 나눠 냈다면 결제 기록을 추가하세요.
        </p>
      ) : null}

      {trip.sharedAt && trip.sharedAt < (trip.editedAt ?? '') ? (
        <div className="note">이미 공유한 링크는 예전 결과예요. 새 링크를 공유하세요.</div>
      ) : null}

      {routeNotice(trip) === 'limit' ? (
        <div className="note">
          {LOOKUP_LIMIT_MESSAGE} 거리·통행료는 고치기에서 넣으면 금액이 바로 바뀝니다.
        </div>
      ) : null}

      {routeNotice(trip) === 'waiting' ? (
        <div className="note">{LOOKUP_WAITING_MESSAGE}</div>
      ) : null}

      {overDistance ? (
        <div className="note">경로보다 멀리 돌았나요? 고치기에서 거리를 바꿔 보세요.</div>
      ) : null}

      {defaultsLeft.length > 0 ? (
        <div className="note">
          {defaultsLeft.join(' · ')}은 <DefaultTag /> 입니다. 고치기에서 바꾸면 금액이 바로
          바뀝니다.
        </div>
      ) : null}

      <div className="chips">
        <button type="button" className="btn" onClick={onEdit}>
          고치기 ›
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setShowBasis((v) => !v);
          }}
        >
          계산 근거 {showBasis ? '접기' : '보기'}
        </button>
      </div>

      {showBasis ? (
        <Card label="구간별">
          <p className="dim" style={{ margin: 0 }}>
            조회: {sourceLabel(trip)} · 유가 {won(trip.fuelUnitPriceWon)}/L
            {trip.fuelPriceAt ? ` (${trip.fuelRegion ?? ''} 평균)` : ' (기본값)'}
          </p>
          {result.segments.map((s) => (
            <div key={s.index} style={{ borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
              <p style={{ margin: 0 }}>
                구간 {s.index + 1} · {km(s.distanceM)} · {duration(s.driveMinutes)} ·{' '}
                {s.passengerCount}명
              </p>
              <p className="dim" style={{ margin: 0 }}>
                유류비 {won(s.fuelCostWon)} + 통행료 {won(s.tollWon)} = 공통비{' '}
                {won(s.commonCostWon)} (1인 {won(s.commonPerPersonWon)})
              </p>
              <p className="dim" style={{ margin: 0 }}>
                수고비 {won(s.laborCostWon)} · 난이도 {s.difficulty.toFixed(2)} · 1인{' '}
                {won(s.laborBasePerPersonWon)}
              </p>
              {s.laborShares
                .filter((x) => x.score > 0)
                .map((x) => (
                  <p key={x.memberId} className="dim" style={{ margin: 0 }}>
                    {memberName(trip, x.memberId)} 괘씸 {x.score}점 → ×{x.multiplier.toFixed(1)} ={' '}
                    {won(x.amountWon)}
                  </p>
                ))}
            </div>
          ))}
          <p className="card__label" style={{ marginTop: 10 }}>
            낸 돈 − 자기 몫
          </p>
          {result.members.map((m) => (
            <div key={m.memberId} className="split">
              <span>{memberName(trip, m.memberId)}</span>
              <span>
                {won(m.paidWon)} − {won(m.shareWon)} = {signedWon(m.balanceWon)}
              </span>
            </div>
          ))}
          <div className="split">
            <span className="dim">차액 합계</span>
            <span className="dim">{won(result.members.reduce((a, m) => a + m.balanceWon, 0))}</span>
          </div>
          {result.selfBorne.length > 0 ? (
            <p className="screen__sub">
              주유 결제 중 이번 여행 몫을 넘는{' '}
              {won(result.selfBorne.reduce((a, s) => a + s.amountWon, 0))}은 결제자 자기 부담입니다.
            </p>
          ) : null}
        </Card>
      ) : null}

      {result.transfers.length > 0 ? (
        <Card label="누가 누구에게">
          {result.transfers.map((t) => (
            <div key={`${t.fromId}-${t.toId}`} className="split">
              <span>
                {memberName(trip, t.fromId)} → {memberName(trip, t.toId)}
              </span>
              <span>{won(t.amountWon)}</span>
            </div>
          ))}
        </Card>
      ) : null}

      {note ? <p className="screen__sub">{note}</p> : null}
      <p className="screen__sub">링크의 # 뒤 결과는 서버로 가지 않습니다.</p>

      {trip.settledAt && !trip.adDismissed ? (
        <AdCard
          onClose={() => {
            onChange({ ...trip, adDismissed: true });
          }}
        />
      ) : null}
    </Screen>
  );
}
