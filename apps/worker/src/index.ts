// Cloudflare Worker. /api 중계와 정적 자산 서빙.
//
// M0에서는 /api/* 가 501로 응답하는 스텁만 둔다. 실제 엔드포인트
// (session, places, route, fuel/avg)와 방어 순서는 M3에서 붙인다:
//   ① 입력 검증 → ② 세션 토큰 → ③ 차단 목록 → ④ 분당 제한
//   → ⑤ 캐시 → ⑥ 일일 예산(DO) → ⑦ 외부 호출
//
// 요청 본문·쿼리·좌표를 로그로 출력하지 않는다 (CLAUDE.md 절대 규칙 7).

interface Env {
  readonly ASSETS: Fetcher;
}

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith('/api/')) {
      return json({ error: 'not_implemented', milestone: 'M3' }, 501);
    }

    // run_worker_first가 /api/* 만 지정하므로 여기까지 오는 것은
    // 정적 자산에서 찾지 못한 경로뿐이다.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
