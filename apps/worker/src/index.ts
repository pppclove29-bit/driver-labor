// Cloudflare Worker. /api 중계와 정적 자산 서빙.
//
// 요청 본문·쿼리·좌표를 로그로 출력하지 않는다 (CLAUDE.md 절대 규칙 7).
import { handleApi } from './app.js';
import { BudgetCounter } from './budget/BudgetCounter.js';
import { RouteCache } from './cache/RouteCache.js';
import { Control } from './control.js';
import { DEFAULT_ALLOWED_ORIGINS, parseAllowedOrigins } from './cors.js';
import { runCron } from './cron.js';
import { FuelReader } from './fuel.js';
import type { Deps } from './deps.js';
import { fixtureUpstream } from './providers/fixtures.js';
import { liveUpstream } from './upstream.js';

interface Env {
  readonly ASSETS: Fetcher;
  readonly CTRL: KVNamespace;
  readonly BUDGET: DurableObjectNamespace<BudgetCounter>;
  readonly ROUTE_CACHE: DurableObjectNamespace<RouteCache>;
  /** `live`(기본) 또는 `fixtures`. 로컬 개발은 .dev.vars에서 fixtures로 둔다. */
  readonly UPSTREAM?: string;
  /** CORS 허용 출처. 쉼표로 구분. 비워 두면 앱 WebView(https://localhost)만 허용한다. */
  readonly ALLOWED_ORIGINS?: string;
  readonly TURNSTILE_SECRET?: string;
  readonly SESSION_SECRET?: string;
  readonly CACHE_SECRET?: string;
  readonly KAKAO_REST_KEY?: string;
  readonly TMAP_APP_KEY?: string;
  readonly OPINET_KEY?: string;
  /** 디스코드 웹훅 URL */
  readonly ALERT_WEBHOOK_URL?: string;
  readonly RL_SESSION_IP?: RateLimit;
  readonly RL_ROUTE_SESSION?: RateLimit;
  readonly RL_ROUTE_IP?: RateLimit;
  readonly RL_PLACES_SESSION?: RateLimit;
  readonly RL_PLACES_IP?: RateLimit;
}

// isolate마다 하나. KV 값 메모리 캐시(60초)를 요청 사이에 공유한다.
let control: Control | undefined;
let fuel: FuelReader | undefined;

const upstreamFrom = (env: Env) => (env.UPSTREAM === 'fixtures' ? fixtureUpstream : liveUpstream);

function depsFrom(env: Env): Deps {
  control ??= new Control(env.CTRL, () => Date.now());
  fuel ??= new FuelReader(env.CTRL, () => Date.now());
  return {
    fuel,
    allowedOrigins: [...DEFAULT_ALLOWED_ORIGINS, ...parseAllowedOrigins(env.ALLOWED_ORIGINS)],
    control,
    budget: env.BUDGET.getByName('global'),
    routeCache: env.ROUTE_CACHE.getByName('route'),
    secrets: {
      turnstileSecret: env.TURNSTILE_SECRET ?? '',
      sessionSecret: env.SESSION_SECRET ?? '',
      cacheSecret: env.CACHE_SECRET ?? '',
      kakaoKey: env.KAKAO_REST_KEY ?? '',
      tmapKey: env.TMAP_APP_KEY ?? '',
    },
    upstream: upstreamFrom(env),
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

export { BudgetCounter, RouteCache };

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

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runCron(
        {
          upstream: upstreamFrom(env),
          kv: env.CTRL,
          budget: env.BUDGET.getByName('global'),
          opinetKey: env.OPINET_KEY ?? '',
          alertWebhookUrl: env.ALERT_WEBHOOK_URL ?? '',
          refreshFuelEveryRun: env.UPSTREAM === 'fixtures',
        },
        controller.scheduledTime,
      ),
    );
  },
} satisfies ExportedHandler<Env>;
