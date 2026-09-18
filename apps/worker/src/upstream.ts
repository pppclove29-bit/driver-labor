// 외부 호출 주입 지점. 운영은 fetch, 테스트와 wrangler dev는 fixtures.
export type Upstream = (request: Request) => Promise<Response>;

export const liveUpstream: Upstream = (request) => fetch(request);
