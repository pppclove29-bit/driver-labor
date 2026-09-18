// /api 라우터. 방어 순서(architecture.md "요청이 거치는 방어 순서"):
//   ① 입력 검증 → ② 세션 토큰 → ③ 차단 목록 → ④ 분당 제한
//   → ⑤ 캐시 → ⑥ 일일 예산(DO) → ⑦ 외부 호출
// 앞 단계에서 거절되면 뒤 단계는 실행하지 않는다.
//
// 요청 본문·쿼리·좌표를 로그로 출력하지 않는다 (CLAUDE.md 절대 규칙 7).
import { fail } from './http.js';
import {
  parseFuelQuery,
  parsePlacesQuery,
  parseRouteBody,
  parseSessionBody,
  readJsonBody,
} from './validate.js';

type Handler = (request: Request, url: URL) => Promise<Response>;

const notYet = async (): Promise<Response> => fail('not_implemented');

const handlers: Record<string, Partial<Record<string, Handler>>> = {
  '/api/session': {
    POST: async (request) => {
      if (parseSessionBody(await readJsonBody(request)) === null) return fail('invalid_input');
      return notYet();
    },
  },
  '/api/route': {
    POST: async (request) => {
      if (parseRouteBody(await readJsonBody(request)) === null) return fail('invalid_input');
      return notYet();
    },
  },
  '/api/places': {
    GET: async (_request, url) => {
      if (parsePlacesQuery(url) === null) return fail('invalid_input');
      return notYet();
    },
  },
  '/api/fuel/avg': {
    GET: async (_request, url) => {
      if (parseFuelQuery(url) === null) return fail('invalid_input');
      return notYet();
    },
  },
};

export async function handleApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const methods = handlers[url.pathname];
  if (!methods) return fail('not_found');
  const handler = methods[request.method];
  if (!handler) return fail('method_not_allowed');
  return handler(request, url);
}
