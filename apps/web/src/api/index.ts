// 앱 전체가 쓰는 API 클라이언트 하나. 세션 토큰을 메모리에서 공유한다.
import { apiBase } from '../config.js';
import { createApiClient } from './client.js';
import { turnstileToken } from './turnstile.js';

export const api = createApiClient({
  fetch: (input, init) => fetch(input, init),
  turnstile: turnstileToken,
  // 앱에서는 절대 주소, 웹 개발에서는 빈 값(같은 출처).
  base: apiBase(),
});

export type { ApiClient, Lookup, PlaceRef, Provider, RouteResponse } from './client.js';
