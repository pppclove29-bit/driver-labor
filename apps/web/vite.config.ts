import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// PWA 앱. Worker 요청 한도가 소진돼도 화면은 서비스 워커 캐시로 뜬다
// (architecture.md "Worker 요청 한도 방어").
export default defineConfig({
  plugins: [
    react(),
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
  ],
  server: {
    port: 5173,
  },
});
