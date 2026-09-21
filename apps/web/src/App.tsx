// 화면 흐름: S1 홈 → S2 새 여행 → S6 기록 → S9 도착 요약 → S10 정산 결과.
// 필수 탭은 여행 한 건에 약 5회 (spec-screens.md "입력 최소화").

import { App as CapacitorApp } from '@capacitor/app';
import type { Storage } from '@dl/storage';
import { useCallback, useEffect, useState } from 'react';

import { api } from './api/index.js';
import { backTarget, type ScreenId } from './model/navigation.js';
import { fetchSegmentRoutes, fetchTripLookups } from './model/lookup.js';
import type { AppTrip } from './model/trip.js';
import { arrivalAt, newTrip, withEstimatedRoute } from './model/trip.js';
import { Arrival } from './screens/Arrival.jsx';
import { Difficulty } from './screens/Difficulty.jsx';
import { EtcPenalty } from './screens/EtcPenalty.jsx';
import { Edit } from './screens/Edit.jsx';
import { Home } from './screens/Home.jsx';
import { NewTrip, type DepartParams } from './screens/NewTrip.jsx';
import { PenaltyReview } from './screens/PenaltyReview.jsx';
import { QuickSettle } from './screens/QuickSettle.jsx';
import { Timeline } from './screens/Timeline.jsx';
import { PaymentSheet } from './screens/PaymentSheet.jsx';
import { Record } from './screens/Record.jsx';
import { Result } from './screens/Result.jsx';
import { useTrips } from './store/useTrips.js';
import { Toast, type ToastState } from './ui/Toast.jsx';
import { useTheme } from './ui/useTheme.js';

export function App({ storage }: { storage?: Storage }) {
  useTheme();
  const { ready, trips, preferences, save, patch, savePreferences } = useTrips(storage);
  const [screen, setScreen] = useState<ScreenId>('home');
  const [activeId, setActiveId] = useState<string>();
  const [toast, setToast] = useState<ToastState>();

  const trip = trips.find((t) => t.id === activeId);

  // 안드로이드 뒤로 가기 버튼. 화면의 "‹" 버튼과 같은 곳으로 가고, 홈에서는 앱을 닫는다.
  // 웹 브라우저에서는 이 이벤트가 오지 않는다.
  useEffect(() => {
    const handle = CapacitorApp.addListener('backButton', () => {
      const target = backTarget(screen);
      if (target === 'exit') void CapacitorApp.exitApp();
      else setScreen(target);
    });
    return () => {
      void handle.then((h) => {
        h.remove();
      });
    };
  }, [screen]);

  const notify = useCallback((message: string, undo?: () => void) => {
    setToast({ id: Date.now(), message, ...(undo ? { undo } : {}) });
  }, []);

  const update = useCallback(
    (next: AppTrip) => {
      void save(next);
    },
    [save],
  );

  /** 출발(또는 빠른 정산) 직후 경로 1회·유가 1회 조회. 결과는 그 사이 바뀐 최신 여행에 얹는다. */
  const lookUp = useCallback(
    (t: AppTrip) => {
      void fetchTripLookups(api, t).then((apply) => patch(t.id, apply));
    },
    [patch],
  );

  /** 하차 장소를 고르거나 지우면 구간별 재조회. */
  const lookUpSegments = useCallback(
    (t: AppTrip) => {
      void fetchSegmentRoutes(api, t).then((apply) => patch(t.id, apply));
    },
    [patch],
  );

  // 오프라인이라 미룬 조회(조회 대기)는 앱을 열 때와 연결이 돌아올 때 다시 한다.
  useEffect(() => {
    if (!ready) return;
    const retry = (): void => {
      for (const t of trips) if (t.routeLookup === 'pending') lookUp(t);
    };
    retry();
    window.addEventListener('online', retry);
    return () => {
      window.removeEventListener('online', retry);
    };
    // 준비됐을 때 한 번과 online 이벤트에서만. trips가 바뀔 때마다 다시 부르지 않는다.
  }, [ready]);

  const open = (t: AppTrip): void => {
    setActiveId(t.id);
    setScreen(t.status === 'settled' ? 'result' : t.status === 'arrived' ? 'arrival' : 'record');
  };

  if (!ready) return <div className="screen">불러오는 중…</div>;

  const startTrip = ({
    origin,
    destination,
    originPlace,
    destinationPlace,
    companions,
  }: DepartParams): void => {
    const created = newTrip({
      id: `t${String(Date.now())}`,
      now: new Date().toISOString(),
      origin,
      destination,
      originPlace,
      destinationPlace,
      driverName: '나',
      companionNames: companions,
    });
    created.settings = { ...preferences.settings };
    created.tone = preferences.lastTone;
    void save(created).then(() => {
      lookUp(created);
    });
    const prefs = { ...preferences };
    // 출발지를 글자로만 바꿨으면 예전 장소 좌표를 버린다.
    if (originPlace) prefs.recentOriginPlace = originPlace;
    else delete prefs.recentOriginPlace;
    void savePreferences({
      ...prefs,
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
          originPlace={preferences.recentOriginPlace}
          recentCompanions={preferences.recentCompanions}
          onBack={() => {
            setScreen('home');
          }}
          onDepart={startTrip}
        />
      );
    }
    if (screen === 'quick') {
      return (
        <QuickSettle
          origin={preferences.recentOrigin}
          originPlace={preferences.recentOriginPlace}
          onBack={() => {
            setScreen('home');
          }}
          onSettle={(created) => {
            created.settings = { ...preferences.settings };
            created.tone = preferences.lastTone;
            const estimated = withEstimatedRoute(created);
            void save(estimated).then(() => {
              lookUp(estimated);
            });
            setActiveId(created.id);
            setScreen('result');
          }}
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
          onQuick={() => {
            setScreen('quick');
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
            update(
              withEstimatedRoute({
                ...trip,
                status: 'arrived',
                events: [...trip.events, { type: 'arrive', at: arrivalAt(trip, new Date()) }],
              }),
            );
            setScreen('arrival');
          }}
          onOpenPayment={() => {
            setScreen('payment');
          }}
          onOpenEtc={() => {
            setScreen('etc');
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
          onOpenPenalties={() => {
            setScreen('penalties');
          }}
          onOpenDifficulty={() => {
            setScreen('difficulty');
          }}
          onOpenTimeline={() => {
            setScreen('timeline');
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
    if (screen === 'etc') {
      return (
        <EtcPenalty
          trip={trip}
          onBack={() => {
            setScreen('record');
          }}
          onSave={(next) => {
            update(next);
            setScreen('record');
            notify('기타 괘씸 +1');
          }}
        />
      );
    }
    if (screen === 'timeline') {
      return (
        <Timeline
          trip={trip}
          onChange={update}
          onPlacesChange={lookUpSegments}
          onBack={() => {
            setScreen('arrival');
          }}
        />
      );
    }
    if (screen === 'penalties') {
      return (
        <PenaltyReview
          trip={trip}
          onChange={update}
          onBack={() => {
            setScreen('arrival');
          }}
        />
      );
    }
    if (screen === 'difficulty') {
      return (
        <Difficulty
          trip={trip}
          onChange={update}
          onBack={() => {
            setScreen('arrival');
          }}
        />
      );
    }
    if (screen === 'edit') {
      return (
        <Edit
          trip={trip}
          onChange={update}
          onBack={() => {
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
        onEdit={() => {
          setScreen('edit');
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
