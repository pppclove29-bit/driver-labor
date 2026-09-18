import { describe, expect, it } from 'vitest';
import kakaoSeoulGangneung from '../../../../fixtures/kakao/directions-seoul-gangneung.json';
import kakaoSeoulWonju from '../../../../fixtures/kakao/directions-seoul-wonju.json';
import kakaoWonjuGangneung from '../../../../fixtures/kakao/directions-wonju-gangneung.json';
import tmapSeoulGangneung from '../../../../fixtures/tmap/route-seoul-gangneung.json';
import { reduceKakaoDirections } from './kakao.js';
import { reduceTmapRoute } from './tmap.js';
import { ProviderError } from './types.js';

describe('카카오 경로 → 숫자 6개', () => {
  it('서울 → 강릉', () => {
    // 정체(1)·지체(2) 4,200m, 원활(4)·32km/h 9,000m, 총 228,214m
    expect(reduceKakaoDirections(kakaoSeoulGangneung)).toEqual({
      distanceM: 228214,
      durationMin: 173,
      tollWon: 12400,
      taxiFareWon: 231500,
      congestedRatio: 0.02,
      slowRoadRatio: 0.04,
    });
  });

  it('서울 → 원주, 원주 → 강릉', () => {
    expect(reduceKakaoDirections(kakaoSeoulWonju)).toEqual({
      distanceM: 97512,
      durationMin: 77,
      tollWon: 4900,
      taxiFareWon: 102300,
      congestedRatio: 0.04,
      slowRoadRatio: 0.03,
    });
    expect(reduceKakaoDirections(kakaoWonjuGangneung)).toEqual({
      distanceM: 131208,
      durationMin: 95,
      tollWon: 7500,
      taxiFareWon: 132800,
      congestedRatio: 0,
      slowRoadRatio: 0.07,
    });
  });

  it('서행(3)은 정체로 세지 않는다', () => {
    const body = {
      routes: [
        {
          result_code: 0,
          summary: { distance: 1000, duration: 60, fare: { taxi: 0, toll: 0 } },
          sections: [{ roads: [{ distance: 1000, traffic_state: 3, traffic_speed: 20 }] }],
        },
      ],
    };
    expect(reduceKakaoDirections(body)).toMatchObject({ congestedRatio: 0, slowRoadRatio: 0 });
  });

  it('result_code가 0이 아니면 no_result', () => {
    expect(() => reduceKakaoDirections({ routes: [{ result_code: 104 }] })).toThrow(ProviderError);
    expect(() => reduceKakaoDirections({})).toThrow(ProviderError);
  });

  it('출력에 경로 좌표·도로 정보가 없다', () => {
    const out = JSON.stringify(reduceKakaoDirections(kakaoSeoulGangneung));
    expect(out).not.toMatch(/vertexes|roads|name|영동/);
  });
});

describe('TMAP 경로 → 숫자 6개', () => {
  it('서울 → 강릉', () => {
    // 지체(3)·정체(4) 1,800 + 2,400 + 9,480/2 = 8,940m, 원활(1)·32km/h 4,740m, 총 229,880m
    expect(reduceTmapRoute(tmapSeoulGangneung)).toEqual({
      distanceM: 229880,
      durationMin: 177,
      tollWon: 12400,
      taxiFareWon: 233900,
      congestedRatio: 0.04,
      slowRoadRatio: 0.02,
    });
  });

  it('요약이 없으면 no_result', () => {
    expect(() => reduceTmapRoute({ features: [] })).toThrow(ProviderError);
  });
});
