// Worker 바인딩의 테스트 대역. 실제 Cloudflare 없이 Node에서 돈다.
import type { Upstream } from '../src/upstream.js';

/** KVNamespace에서 쓰는 부분만. 읽기·쓰기 횟수를 센다. */
export class FakeKV {
  readonly data = new Map<string, string>();
  reads = 0;
  writes = 0;

  async get(key: string, type?: 'text' | 'json'): Promise<unknown> {
    this.reads += 1;
    const v = this.data.get(key);
    if (v === undefined) return null;
    return type === 'json' ? JSON.parse(v) : v;
  }

  async put(key: string, value: string): Promise<void> {
    this.writes += 1;
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  asKV(): KVNamespace {
    return this as unknown as KVNamespace;
  }
}

/** DurableObjectStorage의 KV API 부분만. put 횟수로 행 쓰기를 센다. */
export class FakeStorage {
  readonly data = new Map<string, unknown>();
  puts = 0;
  alarm: number | null = null;

  async get<T>(key: string): Promise<T | undefined> {
    const v = this.data.get(key);
    return v === undefined ? undefined : (structuredClone(v) as T);
  }

  async put(key: string, value: unknown): Promise<void> {
    this.puts += 1;
    this.data.set(key, structuredClone(value));
  }

  async delete(key: string): Promise<boolean> {
    return this.data.delete(key);
  }

  async list<T>(options: { prefix?: string } = {}): Promise<Map<string, T>> {
    const out = new Map<string, T>();
    for (const [k, v] of [...this.data.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (!options.prefix || k.startsWith(options.prefix)) out.set(k, structuredClone(v) as T);
    }
    return out;
  }

  async getAlarm(): Promise<number | null> {
    return this.alarm;
  }

  async setAlarm(time: number): Promise<void> {
    this.alarm = time;
  }
}

export function fakeCtx(storage = new FakeStorage()): DurableObjectState {
  return { storage } as unknown as DurableObjectState;
}

/** Rate Limiting 바인딩 대역. 키별로 limit 번까지 통과. */
export class FakeLimiter {
  readonly counts = new Map<string, number>();
  constructor(readonly max: number) {}

  async limit({ key }: { key: string }): Promise<{ success: boolean }> {
    const n = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, n);
    return { success: n <= this.max };
  }

  asRateLimit(): RateLimit {
    return this as unknown as RateLimit;
  }
}

/** 외부 호출을 기록하는 upstream. 특정 호스트만 바꿔치기할 수 있다. */
export function recordingUpstream(
  base: Upstream,
  overrides: Record<string, (request: Request) => Promise<Response> | Response> = {},
) {
  const calls: string[] = [];
  const upstream: Upstream = async (request) => {
    const url = new URL(request.url);
    calls.push(url.hostname);
    const override = overrides[url.hostname];
    return override ? override(request) : base(request);
  };
  return { upstream, calls };
}
