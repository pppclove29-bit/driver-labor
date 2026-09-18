// 테스트용 요청 만들기.
export const BASE = 'https://driver-labor.test';
export const TEST_IP = '203.0.113.7';

export function postJson(path: string, body: unknown, token?: string): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'cf-connecting-ip': TEST_IP,
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

export function get(pathWithQuery: string, token?: string): Request {
  const headers: Record<string, string> = { 'cf-connecting-ip': TEST_IP };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request(`${BASE}${pathWithQuery}`, { headers });
}
