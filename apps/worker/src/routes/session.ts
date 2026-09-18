// POST /api/session: Turnstile 통과 → 2시간짜리 세션 토큰.
import type { Deps } from '../deps.js';
import { fail, json } from '../http.js';
import { allow, clientIp, ipHash } from '../ratelimit.js';
import { issueToken, verifyTurnstile } from '../session.js';
import { parseSessionBody, readJsonBody } from '../validate.js';

export async function handleSession(request: Request, _url: URL, deps: Deps): Promise<Response> {
  // ①
  const turnstileToken = parseSessionBody(await readJsonBody(request));
  if (turnstileToken === null) return fail('invalid_input');
  const ip = await ipHash(deps.secrets.sessionSecret, clientIp(request), deps.now());
  // ③ 차단된 IP
  if (await deps.control.blocked(null, ip)) return fail('forbidden');
  // ④ 세션 대량 발급 방지: IP 분당 2회
  if (!(await allow(deps.limiters.sessionIp, `session:${ip}`))) return fail('rate_limited');
  // Turnstile 검증 (Cloudflare, 무료·무제한)
  const result = await verifyTurnstile(deps.upstream, deps.secrets.turnstileSecret, turnstileToken);
  if (result === 'error') return fail('auto_lookup_unavailable');
  if (result === 'fail') return fail('unauthorized');
  return json(await issueToken(deps.secrets.sessionSecret, deps.now()));
}
