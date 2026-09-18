// GET /api/fuel/avg?sido=&prod=: KV에서 읽기만 한다. 외부 호출·예산 차감 없음.
// 시·도는 폰이 주소 문자열에서 판단한다. 서버는 주소·좌표를 받지 않는다.
import type { Deps } from '../deps.js';
import { guard } from '../guard.js';
import { fail, json } from '../http.js';
import { parseFuelQuery } from '../validate.js';

export interface FuelAvgResponse {
  priceWon: number;
  updatedAt: string;
}

export async function handleFuelAvg(request: Request, url: URL, deps: Deps): Promise<Response> {
  // ①
  const query = parseFuelQuery(url);
  if (query === null) return fail('invalid_input');
  // ②③
  const sid = await guard(request, deps, null);
  if (sid instanceof Response) return sid;
  const table = await deps.fuel.table();
  const priceWon = table?.prices[query.sido]?.[query.prod];
  if (!table || priceWon === undefined) return fail('auto_lookup_unavailable');
  const body: FuelAvgResponse = { priceWon, updatedAt: table.updatedAt };
  return json(body);
}
