import { describe, expect, it } from 'vitest';
import { FIXTURE_POINTS, fixtureUpstream } from '../src/providers/fixtures.js';

const xy = (p: { lng: number; lat: number }) => `${p.lng},${p.lat}`;

describe('fixtures', () => {
  it('카카오 경로 fixtures의 도로 거리 합이 요약 거리와 같다', async () => {
    const pairs = [
      [FIXTURE_POINTS.gangnam, FIXTURE_POINTS.gyeongpo, 228214],
      [FIXTURE_POINTS.gangnam, FIXTURE_POINTS.wonju, 97512],
      [FIXTURE_POINTS.wonju, FIXTURE_POINTS.gyeongpo, 131208],
    ] as const;
    for (const [o, d, distance] of pairs) {
      const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${xy(o)}&destination=${xy(d)}`;
      const body = (await (await fixtureUpstream(new Request(url))).json()) as {
        routes: { summary: { distance: number }; sections: { roads: { distance: number }[] }[] }[];
      };
      const route = body.routes[0]!;
      const roads = route.sections.flatMap((s) => s.roads);
      expect(route.summary.distance).toBe(distance);
      expect(roads.reduce((a, r) => a + r.distance, 0)).toBe(distance);
    }
  });

  it('모르는 주소는 404', async () => {
    const res = await fixtureUpstream(new Request('https://example.com/'));
    expect(res.status).toBe(404);
  });
});
