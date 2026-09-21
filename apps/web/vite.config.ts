import { readFileSync } from 'node:fs';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// 화면 앱. 출시 형태는 안드로이드 앱(Capacitor)이고, 이 빌드 결과를 앱이 그대로 담는다.
//   `vite build`               웹 빌드(서비스 워커 포함). 개발·미리보기용
//   `vite build --mode app`     릴리스 앱 빌드(.env.app)
//   `vite build --mode app-dev` 에뮬레이터용 앱 빌드(.env.app-dev)
// 앱 타깃(app*)은 서비스 워커를 빼고 자산만 만든다. 앱은 화면을 내장하므로
// 캐시가 두 겹이 되면 업데이트가 꼬인다.
// 버전은 apps/mobile/version.json 한 곳에서 관리한다. 화면 맨 아래에 표시해
// 사용자가 알려온 문제를 어느 빌드인지 맞춰 볼 수 있게 한다.
const version = JSON.parse(
  readFileSync(new URL('../mobile/version.json', import.meta.url), 'utf8'),
) as { versionName: string; versionCode: number };

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(`${version.versionName} (${String(version.versionCode)})`),
  },
  plugins: [
    react(),
    ...(mode.startsWith('app')
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            manifest: {
              name: '운전 노동 정산기',
              short_name: '운전정산',
              description: '운전 수고비와 기름값·통행료를 정산합니다',
              lang: 'ko',
              start_url: '/',
              scope: '/',
              display: 'standalone',
              background_color: '#F3F4F2',
              theme_color: '#0E6B47',
              icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              // 결과 보기 페이지(/r)는 별도 앱이라 이 앱의 서비스 워커가 가로채지 않는다.
              navigateFallbackDenylist: [/^\/r/, /^\/api/],
            },
          }),
        ]),
  ],
  server: {
    port: 5173,
    // `pnpm dev:web`으로 화면만 띄울 때 /api는 로컬 wrangler dev(fixtures 모드)로 보낸다.
    proxy: { '/api': 'http://localhost:8788' },
  },
}));
