// 앱 전체가 쓰는 API 클라이언트 하나. 세션 토큰을 메모리에서 공유한다.
import { createApiClient } from './client.js';
import { turnstileToken } from './turnstile.js';

export const api = createApiClient({
  fetch: (input, init) => fetch(input, init),
  turnstile: turnstileToken,
});

export type { ApiClient, Lookup, PlaceRef, Provider, RouteResponse } from './client.js';
