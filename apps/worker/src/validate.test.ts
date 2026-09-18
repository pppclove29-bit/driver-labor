import { describe, expect, it } from 'vitest';
import { handleApi } from './app.js';
import { get, postJson } from '../test/requests.js';

const gangnam = { lat: 37.4979, lng: 127.0276 };
const gyeongpo = { lat: 37.8055, lng: 128.9086 };

describe('① 입력 검증', () => {
  it('모르는 경로 404, 잘못된 메서드 405', async () => {
    expect((await handleApi(get('/api/nope'))).status).toBe(404);
    expect((await handleApi(get('/api/route'))).status).toBe(405);
    expect((await handleApi(postJson('/api/places?q=강릉', {}))).status).toBe(405);
  });

  describe('POST /api/route', () => {
    const bad: [string, unknown][] = [
      ['지점 1개', { points: [gangnam] }],
      ['지점 12개', { points: Array.from({ length: 12 }, () => gangnam) }],
      ['한국 밖 좌표(도쿄)', { points: [gangnam, { lat: 35.68, lng: 139.76 }] }],
      ['숫자가 아닌 좌표', { points: [gangnam, { lat: '37.8', lng: 128.9 }] }],
      ['NaN 대신 null', { points: [gangnam, { lat: null, lng: 128.9 }] }],
      ['지점에 이름', { points: [gangnam, { ...gyeongpo, name: '경포해변' }] }],
      ['여행 날짜 필드', { points: [gangnam, gyeongpo], date: '2026-09-18' }],
      ['배열 본문', [gangnam, gyeongpo]],
    ];
    it.each(bad)('%s → 400', async (_name, body) => {
      const res = await handleApi(postJson('/api/route', body));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_input' });
    });

    it('2KB 넘는 본문 → 400', async () => {
      const res = await handleApi(postJson('/api/route', `{"points":[${' '.repeat(2100)}]}`));
      expect(res.status).toBe(400);
    });

    it('JSON이 아닌 content-type → 400', async () => {
      const req = new Request('https://x.test/api/route', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ points: [gangnam, gyeongpo] }),
      });
      expect((await handleApi(req)).status).toBe(400);
    });

    it('정상 입력은 검증을 통과한다(다음 단계로)', async () => {
      const res = await handleApi(postJson('/api/route', { points: [gangnam, gyeongpo] }));
      expect(res.status).not.toBe(400);
    });
  });

  describe('GET /api/places', () => {
    it.each([
      ['1자', '/api/places?q=강'],
      ['공백만', '/api/places?q=%20%20%20'],
      ['41자', `/api/places?q=${'가'.repeat(41)}`],
      ['q 없음', '/api/places'],
      ['q 두 개', '/api/places?q=강릉&q=속초'],
      ['현재 위치 좌표 동반', '/api/places?q=강릉&x=127.0&y=37.5'],
    ])('%s → 400', async (_name, path) => {
      expect((await handleApi(get(path))).status).toBe(400);
    });

    it('2자와 40자는 통과', async () => {
      expect((await handleApi(get('/api/places?q=강릉'))).status).not.toBe(400);
      expect((await handleApi(get(`/api/places?q=${'가'.repeat(40)}`))).status).not.toBe(400);
    });
  });

  describe('GET /api/fuel/avg', () => {
    it.each([
      ['없는 시·도', '/api/fuel/avg?sido=12&prod=B027'],
      ['고급휘발유', '/api/fuel/avg?sido=01&prod=B034'],
      ['주소 동반', '/api/fuel/avg?sido=01&prod=B027&addr=서울'],
      ['유종 없음', '/api/fuel/avg?sido=01'],
    ])('%s → 400', async (_name, path) => {
      expect((await handleApi(get(path))).status).toBe(400);
    });
  });

  describe('POST /api/session', () => {
    it.each([
      ['토큰 없음', {}],
      ['빈 토큰', { turnstileToken: '' }],
      ['기기 정보 동반', { turnstileToken: 'x', device: 'iPhone' }],
    ])('%s → 400', async (_name, body) => {
      expect((await handleApi(postJson('/api/session', body))).status).toBe(400);
    });
  });
});
