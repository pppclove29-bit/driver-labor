// 오피넷 시·도별 평균 유가. Cron에서만 하루 4회 부른다(하드 상한 하루 50건).
import type { FuelTable } from '../fuel.js';
import type { Upstream } from '../upstream.js';
import { FUEL_PRODUCTS, type FuelProduct, SIDO_CODES, type SidoCode } from '../validate.js';
import { fetchJson, num } from './http.js';
import { ProviderError } from './types.js';

interface OpinetAvg {
  RESULT?: { OIL?: { SIDOCD?: unknown; PRODCD?: unknown; PRICE?: unknown }[] };
}

/** 시·도 17곳 × 휘발유·경유·LPG만 남기고 원 단위로 반올림한다. */
export function reduceOpinetAvg(body: unknown): FuelTable['prices'] {
  const prices: FuelTable['prices'] = {};
  for (const row of (body as OpinetAvg | null)?.RESULT?.OIL ?? []) {
    const sido = row.SIDOCD as SidoCode;
    const prod = row.PRODCD as FuelProduct;
    const price = Math.round(num(row.PRICE));
    if (!SIDO_CODES.includes(sido) || !FUEL_PRODUCTS.includes(prod) || price <= 0) continue;
    (prices[sido] ??= {})[prod] = price;
  }
  if (Object.keys(prices).length === 0) throw new ProviderError('no_result');
  return prices;
}

export async function fetchOpinetAvg(
  upstream: Upstream,
  key: string,
): Promise<FuelTable['prices']> {
  const url = new URL('https://www.opinet.co.kr/api/avgSidoPrice.do');
  url.searchParams.set('out', 'json');
  url.searchParams.set('code', key);
  return reduceOpinetAvg(await fetchJson(upstream, new Request(url)));
}
