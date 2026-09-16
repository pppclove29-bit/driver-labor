// 화면 흐름: S1 홈 → S2 새 여행 → S6 기록 → S9 도착 요약 → S10 정산 결과.
// 필수 탭은 여행 한 건에 약 5회 (spec-screens.md "입력 최소화").

import type { Storage } from '@dl/storage';
import { useCallback, useState } from 'react';

import type { AppTrip } from './model/trip.js';
import { newTrip } from './model/trip.js';
import { Arrival } from './screens/Arrival.jsx';
import { Home } from './screens/Home.jsx';
import { NewTrip } from './screens/NewTrip.jsx';
import { PaymentSheet } from './screens/PaymentSheet.jsx';
import { Record } from './screens/Record.jsx';
import { Result } from './screens/Result.jsx';
import { useTrips } from './store/useTrips.js';
import { Toast, type ToastState } from './ui/Toast.jsx';
import { useTheme } from './ui/useTheme.js';

type ScreenId = 'home' | 'new' | 'record' | 'payment' | 'arrival' | 'result';

export function App({ storage }: { storage?: Storage }) {
  useTheme();
  const { ready, trips, preferences, save, savePreferences } = useTrips(storage);
  const [screen, setScreen] = useState<ScreenId>('home');
  const [activeId, setActiveId] = useState<string>();
  const [toast, setToast] = useState<ToastState>();

  const trip = trips.find((t) => t.id === activeId);

  const notify = useCallback((message: string, undo?: () => void) => {
    setToast({ id: Date.now(), message, ...(undo ? { undo } : {}) });
  }, []);

  const update = useCallback(
    (next: AppTrip) => {
      void save(next);
    },
    [save],
  );

  const open = (t: AppTrip): void => {
    setActiveId(t.id);
    setScreen(t.status === 'settled' ? 'result' : t.status === 'arrived' ? 'arrival' : 'record');
  };

  if (!ready) return <div className="screen">불러오는 중…</div>;

  const startTrip = ({
    origin,
    destination,
    companions,
  }: {
    origin: string;
    destination: string;
    companions: string[];
  }): void => {
    const created = newTrip({
      id: `t${String(Date.now())}`,
      now: new Date().toISOString(),
      origin,
      destination,
      driverName: '나',
      companionNames: companions,
    });
    created.settings = { ...preferences.settings };
    created.tone = preferences.lastTone;
    void save(created);
    void savePreferences({
      ...preferences,
      recentOrigin: origin,
      recentCompanions: [
        ...new Set([
          ...companions.filter((n) => !n.startsWith('동승자')),
          ...preferences.recentCompanions,
        ]),
      ].slice(0, 8),
    });
    setActiveId(created.id);
    setScreen('record');
  };

  const body = (): React.ReactNode => {
    if (screen === 'new') {
      return (
        <NewTrip
          origin={preferences.recentOrigin}
          recentCompanions={preferences.recentCompanions}
          onBack={() => {
            setScreen('home');
          }}
          onDepart={startTrip}
        />
      );
    }
    if (screen === 'home' || !trip) {
      return (
        <Home
          trips={trips}
          onNew={() => {
            setScreen('new');
          }}
          onOpen={open}
        />
      );
    }
    if (screen === 'record') {
      return (
        <Record
          trip={trip}
          onChange={update}
          onArrive={() => {
            update({
              ...trip,
              status: 'arrived',
              events: [...trip.events, { type: 'arrive', at: new Date().toISOString() }],
            });
            setScreen('arrival');
          }}
          onOpenPayment={() => {
            setScreen('payment');
          }}
          toast={notify}
        />
      );
    }
    if (screen === 'payment') {
      return (
        <PaymentSheet
          trip={trip}
          onBack={() => {
            setScreen('record');
          }}
          onSave={(next) => {
            update(next);
            setScreen('record');
            notify('결제를 기록했어요');
          }}
        />
      );
    }
    if (screen === 'arrival') {
      return (
        <Arrival
          trip={trip}
          onChange={update}
          onBack={() => {
            setScreen('record');
          }}
          onSettle={() => {
            // "정산하기"가 곧 계산 등록. 광고는 이때 1번만 (M5에서 카드 부착).
            update({
              ...trip,
              status: 'settled',
              settledAt: trip.settledAt ?? new Date().toISOString(),
            });
            setScreen('result');
          }}
        />
      );
    }
    return (
      <Result
        trip={trip}
        onChange={(next) => {
          update(next);
          void savePreferences({ ...preferences, lastTone: next.tone });
        }}
        onHome={() => {
          setScreen('home');
        }}
      />
    );
  };

  return (
    <>
      {body()}
      {toast ? (
        <Toast
          toast={toast}
          onClose={() => {
            setToast(undefined);
          }}
        />
      ) : null}
    </>
  );
}
