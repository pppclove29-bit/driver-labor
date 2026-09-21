import { describe, expect, it } from 'vitest';

import { clock, day, duration, km, signedWon, timeValue, won } from './format.js';

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

  it('입력칸 값은 로캘과 무관하게 24시간 HH:mm', () => {
    const morning = new Date(2026, 8, 21, 9, 5);
    const evening = new Date(2026, 8, 21, 16, 53);
    expect(timeValue(morning.toISOString())).toBe('09:05');
    expect(timeValue(evening.toISOString())).toBe('16:53');
  });

  it('화면에 보이는 시각은 폰 로캘을 따른다(입력칸 표기와 맞추려고)', () => {
    const evening = new Date(2026, 8, 21, 16, 53).toISOString();
    expect(clock(evening, 'en-US')).toBe('4:53 PM');
    // 24시간제 로캘은 24시간으로
    expect(clock(evening, 'de-DE')).toBe('16:53');
    // 한국어는 오전·오후 표기(Node ICU 데이터에 따라 "오후"/"PM"이 섞일 수 있어 시각만 확인)
    expect(clock(evening, 'ko-KR')).toContain('4:53');
  });

  it('날짜는 한국어 표기', () => {
    expect(day(new Date(2026, 8, 21, 9, 5).toISOString())).toBe('9월 21일');
  });
});
