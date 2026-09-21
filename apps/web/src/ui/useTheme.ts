// 야간 모드. 폰이 다크 모드면 항상, 라이트여도 18:00~06:00이면 자동 전환한다.
// 일몰 시각 계산은 위치가 필요해 쓰지 않는다 (spec-screens.md S6N).

import { Capacitor } from '@capacitor/core';
import { Style, StatusBar } from '@capacitor/status-bar';
import { useEffect, useState } from 'react';

export type ThemeMode = 'auto' | 'day' | 'night';

const NIGHT_FROM = 18;
const NIGHT_TO = 6;

export function isNightHour(date: Date): boolean {
  const h = date.getHours();
  return h >= NIGHT_FROM || h < NIGHT_TO;
}

export function resolveTheme(mode: ThemeMode, prefersDark: boolean, now: Date): 'day' | 'night' {
  if (mode !== 'auto') return mode;
  return prefersDark || isNightHour(now) ? 'night' : 'day';
}

export function useTheme(mode: ThemeMode = 'auto'): 'day' | 'night' {
  const [theme, setTheme] = useState<'day' | 'night'>(() =>
    resolveTheme(mode, matchMedia('(prefers-color-scheme: dark)').matches, new Date()),
  );

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = (): void => {
      setTheme(resolveTheme(mode, media.matches, new Date()));
    };
    apply();
    media.addEventListener('change', apply);
    // 18시·6시 경계를 넘길 때를 위해 1분마다 다시 본다.
    const timer = setInterval(apply, 60_000);
    return () => {
      media.removeEventListener('change', apply);
      clearInterval(timer);
    };
  }, [mode]);

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'night' ? '#000000' : '#0E6B47');
    // 앱에서는 상태바 글자색도 배경에 맞춘다. Style.Dark = 어두운 배경 + 밝은 글자.
    // Android 15는 화면 끝까지 그리는 방식이라 배경색 지정이 무시될 수 있어 글자색만 맞춘다.
    if (!Capacitor.isNativePlatform()) return;
    void StatusBar.setStyle({ style: theme === 'night' ? Style.Dark : Style.Light }).catch(
      () => undefined,
    );
  }, [theme]);

  return theme;
}
