import { describe, expect, it } from 'vitest';
import { handleApi } from './app.js';
import { fixtureUpstream } from './providers/fixtures.js';
import { issueToken } from './session.js';
import { makeDeps, NOW, SECRETS } from '../test/deps.js';
import { recordingUpstream } from '../test/fakes.js';
import { BASE, get } from '../test/requests.js';

const APP_ORIGIN = 'https://localhost';

function options(path: string, origin: string): Request {
  return new Request(`${BASE}${path}`, {
    method: 'OPTIONS',
    headers: {
      origin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type, authorization',
    },
  });
}

function withOrigin(request: Request, origin: string): Request {
  const headers = new Headers(request.headers);
  headers.set('origin', origin);
  return new Request(request, { headers });
}

const token = async () => (await issueToken(SECRETS.sessionSecret, NOW)).token;

describe('CORS', () => {
  it('앱 WebView 사전 요청 → 204와 허용 헤더', async () => {
    const res = await handleApi(options('/api/route', APP_ORIGIN), makeDeps());
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(APP_ORIGIN);
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')).toContain('authorization');
    expect(res.headers.get('access-control-max-age')).toBe('86400');
    expect(res.headers.get('vary')).toBe('Origin');
  });

  it('사전 요청은 토큰·예산·외부 호출을 건드리지 않는다', async () => {
    const { upstream, calls } = recordingUpstream(fixtureUpstream);
    const deps = makeDeps({ upstream });
    await handleApi(options('/api/route', APP_ORIGIN), deps);
    await handleApi(options('/api/places', 'https://evil.example'), deps);
    expect(calls).toEqual([]);
    const { counts } = await deps.budget.stats();
    expect(counts.kakao_route + counts.kakao_places + counts.turnstile).toBe(0);
  });

  it('허용 목록 밖 출처 → 사전 요청에 허용 헤더가 없다', async () => {
    const res = await handleApi(options('/api/route', 'https://evil.example'), makeDeps());
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('허용 출처의 응답에는 Allow-Origin과 Vary가 붙는다', async () => {
    const res = await handleApi(
      withOrigin(get('/api/places?q=강릉', await token()), APP_ORIGIN),
      makeDeps(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(APP_ORIGIN);
    expect(res.headers.get('vary')).toContain('Origin');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('허용 목록 밖 출처도 서버는 평소대로 처리한다(CORS는 브라우저 쪽 제한)', async () => {
    const res = await handleApi(
      withOrigin(get('/api/places?q=강릉', await token()), 'https://evil.example'),
      makeDeps(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('거절 응답에도 허용 헤더가 붙어 앱이 오류 내용을 읽을 수 있다', async () => {
    const res = await handleApi(withOrigin(get('/api/places?q=강'), APP_ORIGIN), makeDeps());
    expect(res.status).toBe(400);
    expect(res.headers.get('access-control-allow-origin')).toBe(APP_ORIGIN);
  });

  it('설정으로 개발 주소를 더할 수 있다', async () => {
    const deps = makeDeps({ allowedOrigins: ['https://localhost', 'http://localhost:5173'] });
    const res = await handleApi(options('/api/route', 'http://localhost:5173'), deps);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });
});
