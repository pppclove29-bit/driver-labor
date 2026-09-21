// 앱 WebView(https://localhost)에서 /api를 부를 수 있게 하는 CORS.
// 허용 목록에 있는 출처에만 헤더를 준다. 와일드카드(*)는 쓰지 않고 쿠키도 쓰지 않는다.
//
// CORS는 브라우저 쪽 제한일 뿐이라 서버 방어가 아니다. 서버 방어는 세션 토큰(②),
// 차단 목록(③), 분당 제한(④), 일일 예산(⑥)이 맡는다.

/** 기본 허용 출처: Capacitor 안드로이드 WebView. */
export const DEFAULT_ALLOWED_ORIGINS = ['https://localhost'];

const ALLOW_HEADERS = 'content-type, authorization';
const ALLOW_METHODS = 'GET, POST, OPTIONS';
const MAX_AGE = '86400';

export const parseAllowedOrigins = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

const allowed = (origin: string | null, origins: string[]): boolean =>
  origin !== null && origins.includes(origin);

/** 사전 요청(OPTIONS). 검증·토큰·예산을 거치지 않고 바로 답한다. */
export function preflight(request: Request, origins: string[]): Response {
  const origin = request.headers.get('origin');
  const headers = new Headers({ vary: 'Origin' });
  if (allowed(origin, origins)) {
    headers.set('access-control-allow-origin', origin!);
    headers.set('access-control-allow-methods', ALLOW_METHODS);
    headers.set('access-control-allow-headers', ALLOW_HEADERS);
    headers.set('access-control-max-age', MAX_AGE);
  }
  return new Response(null, { status: 204, headers });
}

/** 응답에 허용 헤더를 붙인다. 허용 목록 밖이면 Vary만 붙는다. */
export function withCors(response: Response, request: Request, origins: string[]): Response {
  const origin = request.headers.get('origin');
  const headers = new Headers(response.headers);
  headers.append('vary', 'Origin');
  if (allowed(origin, origins)) headers.set('access-control-allow-origin', origin!);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
