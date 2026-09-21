import { describe, expect, it } from 'vitest';

import { backTarget, type ScreenId } from './navigation.js';

const ALL: ScreenId[] = [
  'home',
  'quick',
  'started',
  'arriveTime',
  'payment',
  'arrival',
  'penalties',
  'timeline',
  'etc',
  'difficulty',
  'result',
  'edit',
];

describe('뒤로 가기', () => {
  it('선택 화면은 연 화면으로 돌아간다', () => {
    expect(backTarget('payment')).toBe('timeline');
    expect(backTarget('etc')).toBe('penalties');
    expect(backTarget('timeline')).toBe('arrival');
    expect(backTarget('penalties')).toBe('arrival');
    expect(backTarget('difficulty')).toBe('arrival');
    expect(backTarget('edit')).toBe('result');
  });

  it('시작 화면들은 홈으로, 홈에서는 앱을 닫는다', () => {
    expect(backTarget('quick')).toBe('home');
    expect(backTarget('started')).toBe('home');
    expect(backTarget('arriveTime')).toBe('home');
    expect(backTarget('arrival')).toBe('home');
    expect(backTarget('result')).toBe('home');
    expect(backTarget('home')).toBe('exit');
  });

  it('모든 화면에 갈 곳이 있고, 홈 말고는 앱을 닫지 않는다', () => {
    for (const screen of ALL) {
      const target = backTarget(screen);
      expect(target).toBeDefined();
      if (screen !== 'home') expect(target).not.toBe('exit');
    }
  });

  it('어느 화면에서든 뒤로만 눌러도 홈에 닿는다', () => {
    for (const screen of ALL) {
      let current: ScreenId = screen;
      let steps = 0;
      while (current !== 'home' && steps < ALL.length) {
        const next = backTarget(current);
        expect(next).not.toBe('exit');
        current = next as ScreenId;
        steps += 1;
      }
      expect(current).toBe('home');
    }
  });
});
