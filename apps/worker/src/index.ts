// Cloudflare Worker. /api 중계와 정적 자산 서빙.
//
// 요청 본문·쿼리·좌표를 로그로 출력하지 않는다 (CLAUDE.md 절대 규칙 7).
import { handleApi } from './app.js';
import { BudgetCounter } from './budget/BudgetCounter.js';
import { Control } from './control.js';
import type { Deps } from './deps.js';
import { fixtureUpstream } from './providers/fixtures.js';
import { liveUpstream } from './upstream.js';

interface Env {
  readonly ASSETS: Fetcher;
  readonly CTRL: KVNamespace;
  readonly BUDGET: DurableObjectNamespace<BudgetCounter>;
  /** `live`(기본) 또는 `fixtures`. 로컬 개발은 .dev.vars에서 fixtures로 둔다. */
  readonly UPSTREAM?: string;
  readonly TURNSTILE_SECRET?: string;
  readonly SESSION_SECRET?: string;
  readonly RL_SESSION_IP?: RateLimit;
  readonly RL_ROUTE_SESSION?: RateLimit;
  readonly RL_ROUTE_IP?: RateLimit;
  readonly RL_PLACES_SESSION?: RateLimit;
  readonly RL_PLACES_IP?: RateLimit;
}

// isolate마다 하나. KV 값 메모리 캐시(60초)를 요청 사이에 공유한다.
let control: Control | undefined;

function depsFrom(env: Env): Deps {
  control ??= new Control(env.CTRL, () => Date.now());
  return {
    control,
    budget: env.BUDGET.getByName('global'),
    secrets: {
      turnstileSecret: env.TURNSTILE_SECRET ?? '',
      sessionSecret: env.SESSION_SECRET ?? '',
    },
    upstream: env.UPSTREAM === 'fixtures' ? fixtureUpstream : liveUpstream,
    now: () => Date.now(),
    limiters: {
      sessionIp: env.RL_SESSION_IP,
      routeSession: env.RL_ROUTE_SESSION,
      routeIp: env.RL_ROUTE_IP,
      placesSession: env.RL_PLACES_SESSION,
      placesIp: env.RL_PLACES_IP,
    },
  };
}

export { BudgetCounter };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith('/api/')) {
      return handleApi(request, depsFrom(env));
    }

    // run_worker_first가 /api/* 만 지정하므로 여기까지 오는 것은
    // 정적 자산에서 찾지 못한 경로뿐이다.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
