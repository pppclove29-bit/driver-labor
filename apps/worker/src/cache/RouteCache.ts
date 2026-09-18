// ⑤ 경로 응답 캐시 (Durable Object). workers.dev에서는 Cache API가 동작하지 않고
// KV는 쓰기 한도(하루 1,000)가 작아서 DO 저장소에 둔다 (decisions.md).
// 장소 검색은 서버에서 캐시하지 않는다(앱 디바운스·메모리 캐시).
//
// 키는 반올림한 좌표를 비밀 값과 섞은 HMAC이라 좌표 문자열이 저장소에 남지 않는다.
import { DurableObject } from 'cloudflare:workers';

/** 경로 캐시 보관 시간. 교통 상황이 바뀌므로 짧게 둔다. */
export const ROUTE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface Entry {
  exp: number;
  body: string;
}

export class RouteCache extends DurableObject {
  async get(key: string): Promise<string | null> {
    const entry = await this.ctx.storage.get<Entry>(`c:${key}`);
    if (!entry || entry.exp <= Date.now()) return null;
    return entry.body;
  }

  async put(key: string, body: string, ttlMs: number): Promise<void> {
    const exp = Date.now() + ttlMs;
    await this.ctx.storage.put(`c:${key}`, { exp, body } satisfies Entry);
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(exp);
  }

  /** 만료된 항목을 지우고, 남은 것이 있으면 가장 빠른 만료 시각에 다시 깨어난다. */
  override async alarm(): Promise<void> {
    const now = Date.now();
    let next = Infinity;
    for (const [key, entry] of await this.ctx.storage.list<Entry>({ prefix: 'c:' })) {
      if (entry.exp <= now) await this.ctx.storage.delete(key);
      else next = Math.min(next, entry.exp);
    }
    if (next !== Infinity) await this.ctx.storage.setAlarm(next);
  }
}

export type CachePort = Pick<RouteCache, 'get' | 'put'>;
