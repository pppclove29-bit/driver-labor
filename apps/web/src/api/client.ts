// Worker /api 호출. 서버로 가는 값은 architecture.md "서버가 받는 것" 표뿐이다:
//   세션: Turnstile 토큰 / 장소: 검색어 / 경로: 지점 좌표 목록 / 유가: 시·도 코드와 유종.
// 멤버 이름·금액·날짜·현재 위치는 보내지 않는다 (CLAUDE.md 절대 규칙 1·2).

export type Provider = 'kakao' | 'tmap';

export interface LatLng {
  lat: number;
  lng: number;
}

/** 사용자가 검색해서 고른 장소. 폰에만 저장한다. */
export interface PlaceRef extends LatLng {
  name: string;
  address: string;
}

/** 구간 하나의 경로 요약(숫자 6개). */
export interface RouteLeg {
  distanceM: number;
  durationMin: number;
  tollWon: number;
  taxiFareWon: number;
  congestedRatio: number;
  slowRoadRatio: number;
}

export interface RouteResponse {
  provider: Provider;
  legs: RouteLeg[];
}

export interface PlacesResponse {
  provider: Provider;
  places: PlaceRef[];
}

export interface FuelAvgResponse {
  priceWon: number;
  updatedAt: string;
}

/**
 * limit: 자동 조회 한도·비상 스위치(503). 안내 문구 + 수동 입력 펼침.
 * waiting: 오프라인·일시 제한(429)·서버 장애. "조회 대기", 연결되면 다시 조회.
 * invalid: 입력 문제·차단(400·403·422). 조용히 수동 입력.
 */
export type LookupFailure = 'limit' | 'waiting' | 'invalid';

export type Lookup<T> = { ok: true; value: T } | { ok: false; reason: LookupFailure };

export interface ApiClient {
  route: (points: LatLng[]) => Promise<Lookup<RouteResponse>>;
  places: (q: string) => Promise<Lookup<PlacesResponse>>;
  fuelAvg: (sido: string, prod: string) => Promise<Lookup<FuelAvgResponse>>;
}

export interface ApiClientOptions {
  fetch: typeof fetch;
  /** Turnstile 토큰을 받아 온다. */
  turnstile: () => Promise<string>;
  now?: () => number;
  base?: string;
}

const failed = <T>(reason: LookupFailure): Lookup<T> => ({ ok: false, reason });

function failureOf(status: number): LookupFailure {
  if (status === 503) return 'limit';
  if (status === 400 || status === 403 || status === 422) return 'invalid';
  return 'waiting';
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const now = options.now ?? (() => Date.now());
  const base = options.base ?? '';
  let session: { token: string; expiresAt: number } | null = null;

  /** 세션 토큰. 만료 1분 전이면 새로 받는다. 못 받으면 실패 이유. */
  async function ensureSession(): Promise<string | LookupFailure> {
    if (session && session.expiresAt - 60_000 > now()) return session.token;
    session = null;
    let res: Response;
    try {
      const turnstileToken = await options.turnstile();
      res = await options.fetch(`${base}/api/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ turnstileToken }),
      });
    } catch {
      return 'waiting';
    }
    if (!res.ok) return failureOf(res.status);
    const body = (await res.json()) as { token: string; expiresAt: string };
    session = { token: body.token, expiresAt: Date.parse(body.expiresAt) };
    return session.token;
  }

  async function call<T>(path: string, init: RequestInit, retried = false): Promise<Lookup<T>> {
    const token = await ensureSession();
    if (token === 'limit' || token === 'waiting' || token === 'invalid') return failed(token);
    let res: Response;
    try {
      res = await options.fetch(`${base}${path}`, {
        ...init,
        headers: { ...(init.headers as Record<string, string>), authorization: `Bearer ${token}` },
      });
    } catch {
      return failed('waiting');
    }
    // 토큰이 만료·무효면 한 번만 새 세션으로 다시 시도한다.
    if (res.status === 401 && !retried) {
      session = null;
      return call(path, init, true);
    }
    if (!res.ok) return failed(failureOf(res.status));
    return { ok: true, value: (await res.json()) as T };
  }

  return {
    route: (points) =>
      call('/api/route', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // 좌표만. 장소 이름·주소는 보내지 않는다.
        body: JSON.stringify({ points: points.map((p) => ({ lat: p.lat, lng: p.lng })) }),
      }),
    places: (q) => call(`/api/places?q=${encodeURIComponent(q)}`, {}),
    fuelAvg: (sido, prod) =>
      call(`/api/fuel/avg?sido=${encodeURIComponent(sido)}&prod=${encodeURIComponent(prod)}`, {}),
  };
}
