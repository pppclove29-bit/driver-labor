// Capacitor 설정. 앱 화면은 apps/web 빌드 결과를 그대로 담는다 (decisions.md 2026-09-21).
// 화면은 앱 안에서 https://localhost로 뜬다. Worker /api는 절대 주소로 부르고 CORS로 허용한다(M8).
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'kr.driverlabor.app',
  appName: '오늘 운전 완료',
  // apps/web의 앱 타깃 빌드(`pnpm --filter @dl/web build:app`) 결과.
  webDir: '../web/dist',
  android: {
    // 기본값 유지. Turnstile 위젯 호스트와 Worker CORS 허용 목록이 이 출처에 맞춰진다.
    // (https://localhost)
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
