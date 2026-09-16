import { defineConfig } from 'vite';

// 결과 보기 페이지. Worker가 /r 아래로 서빙한다.
// 외부 스크립트·광고·분석 도구를 넣지 않는다 (CLAUDE.md 절대 규칙 3).
export default defineConfig({
  base: '/r/',
  server: {
    port: 5174,
  },
  build: {
    // 링크를 받은 사람이 바로 열어야 하므로 번들을 쪼개지 않는다.
    modulePreload: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
