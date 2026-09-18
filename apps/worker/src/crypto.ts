// HMAC-SHA256 도우미. 세션 토큰 서명, 캐시 키, IP 해시에 쓴다.

const encoder = new TextEncoder();
const keys = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string): Promise<CryptoKey> {
  let key = keys.get(secret);
  if (!key) {
    key = crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    );
    keys.set(secret, key);
  }
  return key;
}

export function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export async function hmacSign(secret: string, data: string): Promise<Uint8Array> {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(data));
  return new Uint8Array(sig);
}

/** 상수 시간 비교로 서명을 확인한다. */
export async function hmacVerify(secret: string, data: string, sig: Uint8Array): Promise<boolean> {
  return crypto.subtle.verify('HMAC', await hmacKey(secret), sig, encoder.encode(data));
}

export async function hmacHex(secret: string, data: string): Promise<string> {
  const sig = await hmacSign(secret, data);
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomId(bytes = 16): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}
