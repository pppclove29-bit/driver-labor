// 결과 링크 압축·해제·스키마 검증.
// 결과 JSON → deflate-raw → base64url → /r#v1.{문자열}
// 링크의 # 뒤는 브라우저가 서버로 보내지 않아서 Cloudflare 로그에도 남지 않는다.

import { LinkError, LIMITS, validatePayload } from './schema.js';
import type { LinkPayload } from './schema.js';

export const PACKAGE_NAME = '@dl/link-codec';

/** 결과 링크 형식 버전. 옛 링크를 계속 열기 위해 유지한다. */
export const LINK_VERSION = 'v1';

export * from './schema.js';
export * from './phrases.js';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deflate(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** 압축 폭탄을 막으려고 해제 중에도 상한을 본다. 넘으면 즉시 중단한다. */
async function inflate(bytes: Uint8Array, maxBytes: number): Promise<string> {
  const reader = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
    .getReader();

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new LinkError('압축을 풀었을 때 너무 크다', 'too-large');
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(merged);
}

/** 결과 → `v1.{base64url}`. 링크는 `/r#` 뒤에 붙인다. */
export async function encodeResult(payload: LinkPayload): Promise<string> {
  const checked = validatePayload(payload);
  const encoded = toBase64Url(await deflate(JSON.stringify(checked)));
  const fragment = `${LINK_VERSION}.${encoded}`;
  if (new TextEncoder().encode(fragment).length > LIMITS.encodedBytes) {
    throw new LinkError('링크 데이터가 너무 크다', 'too-large');
  }
  return fragment;
}

/** `v1.{base64url}` 또는 `#v1.…`, 전체 URL을 받아 결과로 되돌린다. */
export async function decodeResult(input: string): Promise<LinkPayload> {
  const hash = input.includes('#') ? input.slice(input.indexOf('#') + 1) : input;
  const fragment = hash.startsWith('/') ? hash.slice(1) : hash;

  const dot = fragment.indexOf('.');
  if (dot < 0) throw new LinkError('링크 형식이 아니다', 'corrupt');

  const version = fragment.slice(0, dot);
  const body = fragment.slice(dot + 1);
  if (version !== LINK_VERSION) {
    const known = /^v(\d+)$/.exec(version);
    if (known && Number(known[1]) > 1) throw new LinkError('더 새로운 버전의 링크다', 'too-new');
    throw new LinkError('링크 버전을 모른다', 'corrupt');
  }
  if (body.length === 0) throw new LinkError('링크에 내용이 없다', 'corrupt');
  if (new TextEncoder().encode(fragment).length > LIMITS.encodedBytes) {
    throw new LinkError('링크 데이터가 너무 크다', 'too-large');
  }

  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(body);
  } catch {
    throw new LinkError('링크가 잘렸거나 손상됐다', 'corrupt');
  }

  let json: string;
  try {
    json = await inflate(bytes, LIMITS.inflatedBytes);
  } catch (error) {
    if (error instanceof LinkError) throw error;
    throw new LinkError('링크가 잘렸거나 손상됐다', 'corrupt');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new LinkError('링크가 잘렸거나 손상됐다', 'corrupt');
  }

  return validatePayload(parsed);
}
