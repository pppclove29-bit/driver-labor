// 유가 평균표 (KV `fuel:avg`). Cron만 쓰고 /api/fuel/avg는 읽기만 한다.
import type { FuelProduct, SidoCode } from './validate.js';

export const FUEL_KEY = 'fuel:avg';

export interface FuelTable {
  /** 오피넷에서 받은 시각 (ISO 8601) */
  updatedAt: string;
  /** 시·도 → 유종 → 원/L (정수) */
  prices: Partial<Record<SidoCode, Partial<Record<FuelProduct, number>>>>;
}

/** KV 읽기 한도를 아끼려고 isolate 메모리에 10분 캐시한다. */
const CACHE_MS = 10 * 60 * 1000;

export class FuelReader {
  private cached: { until: number; table: FuelTable | null } | null = null;

  constructor(
    private readonly kv: KVNamespace,
    private readonly now: () => number,
  ) {}

  async table(): Promise<FuelTable | null> {
    const t = this.now();
    if (this.cached && this.cached.until > t) return this.cached.table;
    const table = await this.kv.get<FuelTable>(FUEL_KEY, 'json');
    this.cached = { until: t + CACHE_MS, table };
    return table;
  }
}
