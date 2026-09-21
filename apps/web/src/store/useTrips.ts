// 여행 목록과 자동 저장. 모든 입력은 즉시 폰에 저장하고 저장 버튼은 두지 않는다.
// 저장은 IndexedDB(폰) 뿐이다. 여행 내용은 서버로 보내지 않는다 (CLAUDE.md 절대 규칙 1).

import { createIndexedDbStorage, type Storage } from '@dl/storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { PlaceRef } from '../api/client.js';
import { trySave } from '../model/saving.js';
import type { AppTrip, TripSettings } from '../model/trip.js';
import { DEFAULT_SETTINGS, migrateTrip } from '../model/trip.js';

export interface Preferences {
  settings: TripSettings;
  /** 최근 함께한 사람 이름. 동승자 칩에 쓴다. */
  recentCompanions: string[];
  recentOrigin: string;
  /** 첫 실행 고지를 본 문구 버전. 없으면 아직 못 봤다. */
  noticeVersion?: number;
  /** 최근 출발지를 검색해서 골랐으면 그 장소. 폰에만 저장한다. */
  recentOriginPlace?: PlaceRef;
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
  /** 저장된 최신 여행에 변경을 얹는다. 조회처럼 늦게 끝나는 작업이 그 사이 입력을 덮어쓰지 않게. */
  patch: (id: string, change: (latest: AppTrip) => AppTrip) => Promise<void>;
  remove: (id: string) => Promise<void>;
  savePreferences: (next: Preferences) => Promise<void>;
}

/**
 * 여행 저장소. 저장이 실패하면 onSaveFail로 알린다(서버 사본이 없어 조용히 넘기면 안 된다).
 */
export function useTrips(storage?: Storage, onSaveFail?: (message: string) => void): TripStore {
  const db = useMemo(() => storage ?? createIndexedDbStorage(), [storage]);
  const [ready, setReady] = useState(false);
  const [trips, setTrips] = useState<AppTrip[]>([]);
  const latest = useRef<AppTrip[]>([]);
  latest.current = trips;
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const rows = await db.list<AppTrip>('trips');
      const prefs = await db.get<Preferences>('settings', 'preferences');
      if (!alive) return;
      setTrips(
        rows
          .map((r) => migrateTrip(r.value))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
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
        const sorted = next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        latest.current = sorted;
        return sorted;
      });
      await trySave(() => db.put('trips', trip.id, trip), onSaveFail ?? (() => undefined));
    },
    [db, onSaveFail],
  );

  const patch = useCallback(
    async (id: string, change: (trip: AppTrip) => AppTrip) => {
      const current = latest.current.find((t) => t.id === id);
      if (!current) return;
      await save(change(current));
    },
    [save],
  );

  const remove = useCallback(
    async (id: string) => {
      setTrips((prev) => prev.filter((t) => t.id !== id));
      await trySave(() => db.remove('trips', id), onSaveFail ?? (() => undefined));
    },
    [db, onSaveFail],
  );

  const savePreferences = useCallback(
    async (next: Preferences) => {
      setPreferences(next);
      await trySave(() => db.put('settings', 'preferences', next), onSaveFail ?? (() => undefined));
    },
    [db, onSaveFail],
  );

  return { ready, trips, preferences, save, patch, remove, savePreferences };
}
