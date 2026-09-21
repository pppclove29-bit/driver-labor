import { describe, expect, it } from 'vitest';

import { clock, day, duration, km, signedWon, won } from './format.js';

describe('표기', () => {
  it('금액은 천 단위 쉼표 + 원', () => {
    expect(won(0)).toBe('0원');
    expect(won(674)).toBe('674원');
    expect(won(1_234_567)).toBe('1,234,567원');
  });

  it('차액은 부호를 붙이고 0은 부호가 없다', () => {
    expect(signedWon(0)).toBe('0원');
    expect(signedWon(11_314)).toBe('+11,314원');
    expect(signedWon(-11_314)).toBe('−11,314원');
  });

  it('시간은 0분·정시·시간+분을 나눠 쓴다', () => {
    expect(duration(0)).toBe('0분');
    expect(duration(59)).toBe('59분');
    expect(duration(60)).toBe('1시간');
    expect(duration(134)).toBe('2시간 14분');
    expect(duration(1440)).toBe('24시간');
  });

  it('거리는 km로, 소수 한 자리까지', () => {
    expect(km(0)).toBe('0km');
    expect(km(228_214)).toBe('228.2km');
    expect(km(950)).toBe('1km');
  });

  it('시각·날짜는 기기 시간대로 읽는다', () => {
    const at = new Date(2026, 8, 21, 9, 5);
    expect(clock(at.toISOString())).toBe('09:05');
    expect(day(at.toISOString())).toBe('9월 21일');
  });
});
