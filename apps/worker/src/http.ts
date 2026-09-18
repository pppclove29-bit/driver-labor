// /api 응답 규약. 앱은 200이 아니면 모두 수동 입력을 펼치고, 503에서만 한도 안내 문구를 띄운다.

export type ErrorCode =
  | 'invalid_input' // 400 ① 입력 검증
  | 'unauthorized' // 401 ② 세션 토큰
  | 'forbidden' // 403 ③ 차단 목록
  | 'not_found' // 404
  | 'method_not_allowed' // 405
  | 'route_not_found' // 422 제공자가 경로를 못 찾음(출발·도착이 너무 가까움 등)
  | 'rate_limited' // 429 ④ 분당 제한
  | 'session_limit' // 429 ⑥ 세션 하루 한도
  | 'auto_lookup_unavailable'; // 503 예산 소진·비상 스위치·제공자 모두 장애

const STATUS: Record<ErrorCode, number> = {
  invalid_input: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  method_not_allowed: 405,
  route_not_found: 422,
  rate_limited: 429,
  session_limit: 429,
  auto_lookup_unavailable: 503,
};

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

export const fail = (error: ErrorCode): Response => json({ error }, STATUS[error]);
