// ⑥⑦ 예산 예약 → 제공자 호출. 카카오가 장애·차단이면 TMAP 예산을 따로 예약해 다시 부른다.
import type { Kind, Provider } from './budget/limits.js';
import type { Deps } from './deps.js';
import { reserveFailure } from './guard.js';
import { fail } from './http.js';
import { ProviderError } from './providers/types.js';
import { SESSION_PER_MINUTE } from './ratelimit.js';

export async function reserveAndCall<T>(
  deps: Deps,
  kind: Kind,
  sessionId: string,
  units: number,
  call: (provider: Provider) => Promise<T>,
): Promise<{ provider: Provider; value: T } | Response> {
  // ⑥
  const mode = await deps.control.provider();
  const bindingMissing =
    kind === 'route' ? !deps.limiters.routeSession : !deps.limiters.placesSession;
  const perMinute = bindingMissing ? { perMinute: SESSION_PER_MINUTE[kind] } : {};
  const reserved = await deps.budget.reserve({ kind, sessionId, units, mode, ...perMinute });
  if (!reserved.ok) return reserveFailure(reserved);

  // ⑦
  const attempt = async (provider: Provider): Promise<T | ProviderError> => {
    try {
      return await call(provider);
    } catch (e) {
      if (e instanceof ProviderError) return e;
      throw e;
    }
  };
  let provider = reserved.provider;
  let result = await attempt(provider);
  if (
    result instanceof ProviderError &&
    result.kind === 'unavailable' &&
    provider === 'kakao' &&
    mode === 'auto'
  ) {
    console.error('upstream_unavailable', `kakao_${kind}`);
    const retry = await deps.budget.reserve({ kind, sessionId, units, mode: 'tmap', retry: true });
    if (!retry.ok) return fail('auto_lookup_unavailable');
    provider = 'tmap';
    result = await attempt(provider);
  }
  if (result instanceof ProviderError) {
    if (result.kind === 'no_result') {
      return fail(kind === 'route' ? 'route_not_found' : 'invalid_input');
    }
    console.error('upstream_unavailable', `${provider}_${kind}`);
    return fail('auto_lookup_unavailable');
  }
  return { provider, value: result };
}
