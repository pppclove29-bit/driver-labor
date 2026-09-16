// 여행 목록과 자동 저장. 모든 입력은 즉시 폰에 저장하고 저장 버튼은 두지 않는다.
// 저장은 IndexedDB(폰) 뿐이다. 여행 내용은 서버로 보내지 않는다 (CLAUDE.md 절대 규칙 1).

import { createIndexedDbStorage, type Storage } from '@dl/storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { AppTrip, TripSettings } from '../model/trip.js';
import { DEFAULT_SETTINGS } from '../model/trip.js';

export interface Preferences {
  settings: TripSettings;
  /** 최근 함께한 사람 이름. 동승자 칩에 쓴다. */
  recentCompanions: string[];
  recentOrigin: string;
  lastTone: AppTrip['tone'];
}

export const DEFAULT_PREFERENCES: Preferences = {
  settings: DEFAULT_SETTINGS,
  recentCompanions: [],
  recentOrigin: '집',
  lastTone: 'mild',
};

export interface TripStore {
  ready: boolean;
  trips: AppTrip[];
  preferences: Preferences;
  save: (trip: AppTrip) => Promise<void>;
  remove: (id: string) => Promise<void>;
  savePreferences: (next: Preferences) => Promise<void>;
}

export function useTrips(storage?: Storage): TripStore {
  const db = useMemo(() => storage ?? createIndexedDbStorage(), [storage]);
  const [ready, setReady] = useState(false);
  const [trips, setTrips] = useState<AppTrip[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const rows = await db.list<AppTrip>('trips');
      const prefs = await db.get<Preferences>('settings', 'preferences');
      if (!alive) return;
      setTrips(rows.map((r) => r.value).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setPreferences(prefs ?? DEFAULT_PREFERENCES);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [db]);

  const save = useCallback(
    async (trip: AppTrip) => {
      setTrips((prev) => {
        const next = prev.filter((t) => t.id !== trip.id);
        next.push(trip);
        return next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
      await db.put('trips', trip.id, trip);
    },
    [db],
  );

  const remove = useCallback(
    async (id: string) => {
      setTrips((prev) => prev.filter((t) => t.id !== id));
      await db.remove('trips', id);
    },
    [db],
  );

  const savePreferences = useCallback(
    async (next: Preferences) => {
      setPreferences(next);
      await db.put('settings', 'preferences', next);
    },
    [db],
  );

  return { ready, trips, preferences, save, remove, savePreferences };
}
