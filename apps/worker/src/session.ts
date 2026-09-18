// ② 세션 토큰. Turnstile을 통과한 앱에 2시간짜리 HMAC 서명 토큰을 준다.
// 토큰 검증은 서명 계산만 하므로 외부 호출 없이 끝난다.
// 세션 ID는 무작위 값이고 기기 정보·앱 식별자를 담지 않는다.
import { fromBase64Url, hmacSign, hmacVerify, randomId, toBase64Url } from './crypto.js';
import type { Upstream } from './upstream.js';

export const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const VERSION = 'v1';

export interface IssuedToken {
  token: string;
  expiresAt: string;
}

export async function issueToken(secret: string, nowMs: number): Promise<IssuedToken> {
  const sid = randomId();
  const exp = Math.floor((nowMs + TOKEN_TTL_MS) / 1000);
  const payload = `${VERSION}.${sid}.${exp}`;
  const sig = toBase64Url(await hmacSign(secret, payload));
  return { token: `${payload}.${sig}`, expiresAt: new Date(exp * 1000).toISOString() };
}

/** 서명·만료를 확인하고 세션 ID를 돌려준다. 위조·만료면 null. */
export async function verifyToken(
  secret: string,
  token: string,
  nowMs: number,
): Promise<string | null> {
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [version, sid, expText, sigText] = parts as [string, string, string, string];
  if (version !== VERSION || !/^[A-Za-z0-9_-]{16,64}$/.test(sid) || !/^\d{1,12}$/.test(expText)) {
    return null;
  }
  const sig = fromBase64Url(sigText);
  if (!sig || sig.length !== 32) return null;
  if (!(await hmacVerify(secret, `${version}.${sid}.${expText}`, sig))) return null;
  if (Number(expText) * 1000 <= nowMs) return null;
  return sid;
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const m = /^Bearer ([A-Za-z0-9._-]{1,256})$/.exec(header);
  return m ? (m[1] ?? null) : null;
}

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileResult = 'pass' | 'fail' | 'error';

/** Turnstile 검증. 사용자 IP는 넘기지 않는다. */
export async function verifyTurnstile(
  upstream: Upstream,
  secret: string,
  token: string,
): Promise<TurnstileResult> {
  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);
  try {
    const res = await upstream(new Request(SITEVERIFY, { method: 'POST', body: form }));
    if (!res.ok) return 'error';
    const body = (await res.json()) as { success?: unknown };
    return body.success === true ? 'pass' : 'fail';
  } catch {
    return 'error';
  }
}
