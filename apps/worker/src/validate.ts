// ① 경로·메서드·입력값 검증. CPU만 쓰고 외부 호출·KV·DO를 건드리지 않는다.
// 서버가 받는 값은 architecture.md "서버가 받는 것" 표뿐이다. 모르는 필드가 있으면 거절한다.

export interface Point {
  lat: number;
  lng: number;
}

/** 대한민국 영역(독도·마라도 포함) 대략의 경계 상자. */
export const KOREA = { latMin: 33.0, latMax: 38.9, lngMin: 124.5, lngMax: 132.0 } as const;

/** 지점 최대 11개 = 구간 10개. */
export const POINTS_MIN = 2;
export const POINTS_MAX = 11;
export const QUERY_MIN = 2;
export const QUERY_MAX = 40;
export const MAX_BODY_BYTES = 2048;

/** 오피넷 시·도 코드. */
export const SIDO_CODES = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
] as const;
export type SidoCode = (typeof SIDO_CODES)[number];

/** 오피넷 제품 코드: 휘발유, 경유, 자동차용 부탄(LPG). */
export const FUEL_PRODUCTS = ['B027', 'D047', 'K015'] as const;
export type FuelProduct = (typeof FUEL_PRODUCTS)[number];

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const hasOnlyKeys = (o: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(o).every((k) => keys.includes(k));

/** JSON 본문을 읽는다. 형식·크기가 어긋나면 null. */
export async function readJsonBody(request: Request): Promise<unknown> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) return null;
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

const inKorea = (p: Point): boolean =>
  p.lat >= KOREA.latMin && p.lat <= KOREA.latMax && p.lng >= KOREA.lngMin && p.lng <= KOREA.lngMax;

/** `{ points: [{lat, lng}, …] }` 2~11개. 이름·날짜·인원 같은 다른 필드는 받지 않는다. */
export function parseRouteBody(body: unknown): Point[] | null {
  if (!isPlainObject(body) || !hasOnlyKeys(body, ['points'])) return null;
  const { points } = body;
  if (!Array.isArray(points) || points.length < POINTS_MIN || points.length > POINTS_MAX)
    return null;
  const out: Point[] = [];
  for (const raw of points) {
    if (!isPlainObject(raw) || !hasOnlyKeys(raw, ['lat', 'lng'])) return null;
    const { lat, lng } = raw;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const p = { lat, lng };
    if (!inKorea(p)) return null;
    out.push(p);
  }
  return out;
}

/** `?q=` 하나만. 앞뒤 공백을 지우고 NFC로 맞춘 뒤 2~40자. */
export function parsePlacesQuery(url: URL): string | null {
  if (![...url.searchParams.keys()].every((k) => k === 'q')) return null;
  const all = url.searchParams.getAll('q');
  if (all.length !== 1) return null;
  const q = (all[0] ?? '').trim().normalize('NFC');
  const length = [...q].length;
  if (length < QUERY_MIN || length > QUERY_MAX) return null;
  return q;
}

/** `?sido=&prod=` 둘만. */
export function parseFuelQuery(url: URL): { sido: SidoCode; prod: FuelProduct } | null {
  if (![...url.searchParams.keys()].every((k) => k === 'sido' || k === 'prod')) return null;
  const sido = url.searchParams.get('sido');
  const prod = url.searchParams.get('prod');
  if (!(SIDO_CODES as readonly (string | null)[]).includes(sido)) return null;
  if (!(FUEL_PRODUCTS as readonly (string | null)[]).includes(prod)) return null;
  return { sido: sido as SidoCode, prod: prod as FuelProduct };
}

/** `{ turnstileToken }` 하나만. Turnstile 토큰은 2,048자 이하. */
export function parseSessionBody(body: unknown): string | null {
  if (!isPlainObject(body) || !hasOnlyKeys(body, ['turnstileToken'])) return null;
  const { turnstileToken } = body;
  if (typeof turnstileToken !== 'string') return null;
  if (turnstileToken.length === 0 || turnstileToken.length > 2048) return null;
  return turnstileToken;
}
