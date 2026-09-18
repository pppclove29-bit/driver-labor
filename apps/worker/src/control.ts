// ③ 차단 목록과 비상 스위치 (KV). 재배포 없이 Cloudflare 대시보드에서 값을 바꾼다.
//
//   auto_route    on | off   경로 자동 조회. off면 /api/route 즉시 503
//   auto_places   on | off   장소 검색. off면 /api/places 즉시 503
//   provider      auto | kakao | tmap   카카오 앱 차단·장애 시 tmap으로 고정
//   block:YYYY-MM-DD  {"sessions":[…],"ipHashes":[…]}  수동 등록, 당일만 유효(expirationTtl)
//
// KV 읽기 한도(하루 10만)를 아끼려고 isolate 메모리에 60초 캐시한다.
// 그래서 스위치를 바꾸면 최대 60초 뒤에 반영된다.
import { kstDay } from './time.js';

export type ProviderMode = 'auto' | 'kakao' | 'tmap';

const CACHE_MS = 60_000;

export class Control {
  private readonly cache = new Map<string, { until: number; value: string | null }>();

  constructor(
    private readonly kv: KVNamespace,
    private readonly now: () => number,
  ) {}

  private async read(key: string): Promise<string | null> {
    const t = this.now();
    const hit = this.cache.get(key);
    if (hit && hit.until > t) return hit.value;
    const value = await this.kv.get(key, 'text');
    this.cache.set(key, { until: t + CACHE_MS, value });
    return value;
  }

  async autoRoute(): Promise<boolean> {
    return (await this.read('auto_route')) !== 'off';
  }

  async autoPlaces(): Promise<boolean> {
    return (await this.read('auto_places')) !== 'off';
  }

  async provider(): Promise<ProviderMode> {
    const v = await this.read('provider');
    return v === 'kakao' || v === 'tmap' ? v : 'auto';
  }

  /** 세션 ID 또는 그날 솔트로 해시한 IP가 오늘 차단 목록에 있는지. */
  async blocked(sessionId: string | null, ipHash: string): Promise<boolean> {
    const raw = await this.read(`block:${kstDay(this.now())}`);
    if (!raw) return false;
    let list: { sessions?: unknown; ipHashes?: unknown };
    try {
      list = JSON.parse(raw) as typeof list;
    } catch {
      return false;
    }
    const has = (arr: unknown, v: string) => Array.isArray(arr) && arr.includes(v);
    return (sessionId !== null && has(list.sessions, sessionId)) || has(list.ipHashes, ipHash);
  }
}
