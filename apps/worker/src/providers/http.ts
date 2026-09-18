// 제공자 호출 공통. 응답 본문·요청 URL(키·좌표·검색어 포함)을 로그로 남기지 않는다.
import type { Upstream } from '../upstream.js';
import { ProviderError, UPSTREAM_TIMEOUT_MS } from './types.js';

/** JSON 응답을 받는다. 400은 no_result, 그 밖의 실패는 unavailable. */
export async function fetchJson(upstream: Upstream, request: Request): Promise<unknown> {
  let res: Response;
  try {
    res = await upstream(
      new Request(request, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) }),
    );
  } catch {
    throw new ProviderError('unavailable');
  }
  if (res.status === 400) throw new ProviderError('no_result');
  // TMAP POI는 결과가 없으면 204를 준다.
  if (res.status === 204) return null;
  if (!res.ok) throw new ProviderError('unavailable');
  try {
    return (await res.json()) as unknown;
  } catch {
    throw new ProviderError('unavailable');
  }
}

export const num = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
};
