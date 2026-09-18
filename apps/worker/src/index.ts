// Cloudflare Worker. /api 중계와 정적 자산 서빙.
//
// 요청 본문·쿼리·좌표를 로그로 출력하지 않는다 (CLAUDE.md 절대 규칙 7).
import { handleApi } from './app.js';

interface Env {
  readonly ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith('/api/')) {
      return handleApi(request);
    }

    // run_worker_first가 /api/* 만 지정하므로 여기까지 오는 것은
    // 정적 자산에서 찾지 못한 경로뿐이다.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
