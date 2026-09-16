// 저장소 인터페이스. 웹은 IndexedDB, 나중의 네이티브는 SQLite로 교체한다.
// 모든 입력은 즉시 저장한다. 저장 버튼은 두지 않는다 (spec-screens.md 공통 UI 규칙).

export const PACKAGE_NAME = '@dl/storage';

export type StoreName = 'trips' | 'settings';

export const STORE_NAMES: readonly StoreName[] = ['trips', 'settings'];

export interface Entry<T> {
  key: string;
  value: T;
}

export interface Storage {
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  put<T>(store: StoreName, key: string, value: T): Promise<void>;
  remove(store: StoreName, key: string): Promise<void>;
  list<T>(store: StoreName): Promise<Entry<T>[]>;
  clear(store: StoreName): Promise<void>;
}

/** 테스트와 서버 사이드 렌더링용. 브라우저 밖에서도 앱 로직을 돌릴 수 있게 한다. */
export function createMemoryStorage(): Storage {
  const data = new Map<StoreName, Map<string, unknown>>();
  const of = (store: StoreName): Map<string, unknown> => {
    let m = data.get(store);
    if (!m) {
      m = new Map<string, unknown>();
      data.set(store, m);
    }
    return m;
  };

  return {
    get<T>(store: StoreName, key: string): Promise<T | undefined> {
      return Promise.resolve(of(store).get(key) as T | undefined);
    },
    put<T>(store: StoreName, key: string, value: T): Promise<void> {
      of(store).set(key, structuredClone(value));
      return Promise.resolve();
    },
    remove(store: StoreName, key: string): Promise<void> {
      of(store).delete(key);
      return Promise.resolve();
    },
    list<T>(store: StoreName): Promise<Entry<T>[]> {
      return Promise.resolve(
        [...of(store).entries()].map(([key, value]) => ({ key, value: value as T })),
      );
    },
    clear(store: StoreName): Promise<void> {
      of(store).clear();
      return Promise.resolve();
    },
  };
}

const DB_NAME = 'driver-labor';
const DB_VERSION = 1;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      reject(req.error ?? new Error('IndexedDB 요청 실패'));
    };
  });
}

/** 웹 구현. 여행 기록은 폰에만 남고 서버로 나가지 않는다 (CLAUDE.md 절대 규칙 1). */
export function createIndexedDbStorage(dbName = DB_NAME): Storage {
  let dbPromise: Promise<IDBDatabase> | undefined;

  const open = (): Promise<IDBDatabase> => {
    dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName, DB_VERSION);
      req.onupgradeneeded = () => {
        for (const name of STORE_NAMES) {
          if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
        }
      };
      req.onsuccess = () => {
        resolve(req.result);
      };
      req.onerror = () => {
        reject(req.error ?? new Error('IndexedDB 열기 실패'));
      };
    });
    return dbPromise;
  };

  const tx = async <T>(
    store: StoreName,
    mode: IDBTransactionMode,
    run: (s: IDBObjectStore) => Promise<T>,
  ): Promise<T> => {
    const db = await open();
    const transaction = db.transaction(store, mode);
    const result = await run(transaction.objectStore(store));
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => {
        resolve();
      };
      transaction.onabort = () => {
        reject(transaction.error ?? new Error('IndexedDB 트랜잭션 중단'));
      };
      transaction.onerror = () => {
        reject(transaction.error ?? new Error('IndexedDB 트랜잭션 실패'));
      };
    });
    return result;
  };

  return {
    get<T>(store: StoreName, key: string): Promise<T | undefined> {
      return tx(store, 'readonly', (s) => request(s.get(key) as IDBRequest<T | undefined>));
    },
    put<T>(store: StoreName, key: string, value: T): Promise<void> {
      return tx(store, 'readwrite', async (s) => {
        await request(s.put(value as unknown as object, key));
      });
    },
    remove(store: StoreName, key: string): Promise<void> {
      return tx(store, 'readwrite', async (s) => {
        await request(s.delete(key));
      });
    },
    list<T>(store: StoreName): Promise<Entry<T>[]> {
      return tx(store, 'readonly', async (s) => {
        const keys = await request(s.getAllKeys());
        const values = await request(s.getAll() as IDBRequest<T[]>);
        return keys.map((key, i) => ({ key: String(key), value: values[i] as T }));
      });
    },
    clear(store: StoreName): Promise<void> {
      return tx(store, 'readwrite', async (s) => {
        await request(s.clear());
      });
    },
  };
}
