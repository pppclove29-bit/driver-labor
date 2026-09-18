// ④ 분당 호출 제한 (Rate Limiting 바인딩). 위치별로 대략 세는 방식이라 순간 폭주만 싸게 거른다.
// 돈과 직결되는 일일 상한은 Durable Object가 정확히 센다.
//
// IP는 이 바인딩의 키로만 쓰고, 그날만 쓰는 솔트로 해시해서 넘긴다. 우리 저장소에 남기지 않는다.
// 바인딩을 쓸 수 없으면(무료 플랜 미지원 등) 해당 제한은 통과시키고,
// 경로·장소의 세션 분당 제한은 DO가 대신 센다 (decisions.md).
import { hmacHex } from './crypto.js';
import { kstDay } from './time.js';

export interface Limiters {
  /** 세션 발급: IP 분당 2회 */
  readonly sessionIp?: RateLimit | undefined;
  /** 경로: 세션 분당 5회 */
  readonly routeSession?: RateLimit | undefined;
  /** 경로: IP 분당 15회 */
  readonly routeIp?: RateLimit | undefined;
  /** 장소: 세션 분당 30회 */
  readonly placesSession?: RateLimit | undefined;
  /** 장소: IP 분당 90회 */
  readonly placesIp?: RateLimit | undefined;
}

/** 바인딩이 없으면 DO가 대신 셀 세션 분당 한도. */
export const SESSION_PER_MINUTE = { route: 5, places: 30 } as const;

export async function allow(limiter: RateLimit | undefined, key: string): Promise<boolean> {
  if (!limiter) return true;
  const { success } = await limiter.limit({ key });
  return success;
}

export const clientIp = (request: Request): string => request.headers.get('cf-connecting-ip') ?? '';

/** 그날만 쓰는 솔트로 해시한 IP. 차단 목록과 분당 제한 키에 쓴다. */
export const ipHash = (secret: string, ip: string, nowMs: number): Promise<string> =>
  hmacHex(secret, `ip:${kstDay(nowMs)}:${ip}`).then((h) => h.slice(0, 32));
