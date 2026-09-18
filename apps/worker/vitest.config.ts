import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Worker 테스트는 Node에서 가짜 바인딩(KV, DO 저장소, 분당 제한)과 fixtures로 돌린다.
// 실제 카카오·TMAP·오피넷을 부르지 않는다 (CLAUDE.md 절대 규칙 8).
export default defineConfig({
  resolve: {
    alias: {
      'cloudflare:workers': fileURLToPath(new URL('./test/cloudflare-workers.ts', import.meta.url)),
    },
  },
  test: {
    name: '@dl/worker',
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
